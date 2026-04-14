import PDFDocument from 'pdfkit';
import { prisma } from './prisma.js';
import { buildOperationSearchOr } from './search-utils.js';
import { statusFilterValuesForQuery, INACTIVE_CONTAINER_STATUSES } from './operation-status.js';

type FilterType = 'COMMERCIAL' | 'PARCEL' | 'all';

type ExportFilters = {
  soloActivas: boolean;
  tipo: FilterType;
  status?: string;
  search?: string;
};

type OperationWithContainers = Awaited<ReturnType<typeof loadOperationsForBoard>>[number];
type ContainerRow = {
  operation: OperationWithContainers;
  container: OperationWithContainers['containers'][number];
};

function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function operationRowLabel(op: OperationWithContainers, c: OperationWithContainers['containers'][number]): string {
  const ref = (op.referenciaOperacion || '').trim();
  if (ref) return ref;
  if (op.operationType !== 'PARCEL') return op.operationNo;
  const fromContainer = (c.containerNo || c.blNo || c.bookingNo || '').trim();
  if (fromContainer) return fromContainer;
  return op.operationNo;
}

function operationDescription(op: OperationWithContainers): string {
  if (op.operationType === 'PARCEL') return 'Gift Parcel';
  const items = op.offerCustomer?.items;
  if (!items?.length) return '—';
  const parts: string[] = [];
  for (const it of items) {
    const name = (it.nombreProducto || it.producto?.nombre || it.descripcion || '').trim();
    if (name) parts.push(name);
  }
  if (!parts.length) return '—';
  const text = parts.join(', ');
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function clienteNombreCompania(op: OperationWithContainers): string {
  const c = op.offerCustomer?.cliente;
  if (!c) return '—';
  const comp = c.nombreCompania?.trim();
  if (comp) return comp;
  return [c.nombre, c.apellidos].filter(Boolean).join(' ').trim() || '—';
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMarielDisplay(container: OperationWithContainers['containers'][number]): string {
  const n = daysInMarielCount(container);
  return n === null ? '—' : String(n);
}

function daysInMarielCount(container: OperationWithContainers['containers'][number]): number | null {
  const raw = container.etaActual || container.etaEstimated;
  if (!raw) return null;
  const arr = new Date(raw);
  if (Number.isNaN(arr.getTime())) return null;
  const today = startOfLocalDay(new Date());
  const arrDay = startOfLocalDay(arr);
  const diffMs = today.getTime() - arrDay.getTime();
  const days = Math.floor(diffMs / 86400000);
  return days < 0 ? null : days;
}

function etaArriboMarielIsGreen(container: OperationWithContainers['containers'][number]): boolean {
  const raw = container.etaActual || container.etaEstimated;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const today = startOfLocalDay(new Date());
  const etaDay = startOfLocalDay(d);
  return etaDay.getTime() <= today.getTime();
}

/** ETA futura cercana: entre 1 y 3 días desde hoy (inclusive). */
function etaIsNear(container: OperationWithContainers['containers'][number]): boolean {
  const raw = container.etaActual || container.etaEstimated;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const today = startOfLocalDay(new Date());
  const etaDay = startOfLocalDay(d);
  const diffDays = Math.floor((etaDay.getTime() - today.getTime()) / 86400000);
  return diffDays >= 1 && diffDays <= 3;
}

function etaSortKey(container: OperationWithContainers['containers'][number]): number {
  const raw = container.etaActual || container.etaEstimated;
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Fuerza una sola línea en PDF y trunca con "..." según ancho visual. */
function fitOneLine(doc: any, value: string, maxWidth: number): string {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '—';
  if (doc.widthOfString(raw) <= maxWidth) return raw;
  const ellipsis = '...';
  const ellW = doc.widthOfString(ellipsis);
  let out = '';
  for (const ch of raw) {
    const next = out + ch;
    if (doc.widthOfString(next) + ellW > maxWidth) break;
    out = next;
  }
  return (out || raw.slice(0, 1)) + ellipsis;
}

/** Ajusta texto a 1..N líneas (máximo), con "..." al final si no cabe todo. */
function fitLines(doc: any, value: string, maxWidth: number, maxLines: number): string[] {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return ['—'];
  const words = raw.split(' ');
  const lines: string[] = [];
  let current = '';
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (doc.widthOfString(candidate) <= maxWidth) {
      current = candidate;
      i += 1;
      continue;
    }
    if (!current) {
      lines.push(fitOneLine(doc, words[i], maxWidth));
      i += 1;
    } else {
      lines.push(current);
      current = '';
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (i < words.length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = fitOneLine(doc, `${last} ...`, maxWidth);
  }
  return lines.slice(0, maxLines);
}

async function loadOperationsForBoard(filters: ExportFilters) {
  const where: any = {};
  if (filters.tipo !== 'all') where.operationType = filters.tipo;

  const andParts: any[] = [];
  if (filters.status?.trim()) {
    const values = statusFilterValuesForQuery(filters.status.trim());
    andParts.push({
      OR: [{ status: { in: values } }, { containers: { some: { status: { in: values } } } }],
    });
  }
  if (filters.search?.trim()) {
    andParts.push({ OR: buildOperationSearchOr(filters.search.trim()) });
  }
  if (andParts.length === 1) Object.assign(where, andParts[0]);
  if (andParts.length > 1) where.AND = andParts;

  return prisma.operation.findMany({
    where,
    include: {
      offerCustomer: {
        select: {
          fecha: true,
          fechaContratoImportadora: true,
          cliente: { select: { nombre: true, apellidos: true, nombreCompania: true } },
          items: {
            take: 40,
            orderBy: { id: 'asc' },
            select: {
              nombreProducto: true,
              descripcion: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      },
      importadora: { select: { nombre: true } },
      containers: {
        orderBy: { sequenceNo: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function collectRows(operations: OperationWithContainers[], type: 'COMMERCIAL' | 'PARCEL', soloActivas: boolean): ContainerRow[] {
  const rows: ContainerRow[] = [];
  for (const operation of operations) {
    if (operation.operationType !== type) continue;
    for (const container of operation.containers ?? []) {
      if (soloActivas && INACTIVE_CONTAINER_STATUSES.includes(container.status)) continue;
      rows.push({ operation, container });
    }
  }
  rows.sort((a, b) => {
    const etaCmp = etaSortKey(a.container) - etaSortKey(b.container);
    if (etaCmp !== 0) return etaCmp;
    return operationRowLabel(a.operation, a.container).localeCompare(
      operationRowLabel(b.operation, b.container),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  });
  return rows;
}

export async function buildOperationsBoardPdfBuffer(filters: ExportFilters): Promise<Buffer> {
  const operations = await loadOperationsForBoard(filters);
  const commercialRows = collectRows(operations, 'COMMERCIAL', filters.soloActivas);
  const parcelRows = collectRows(operations, 'PARCEL', filters.soloActivas);

  const doc = new PDFDocument({ size: 'LEGAL', layout: 'landscape', margin: 14 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = doc.y;

  const columns = [
    { key: 'tipo', label: 'Tipo', width: 26 },
    { key: 'op', label: 'Operacion', width: 58 },
    { key: 'desc', label: 'Descripcion', width: 176 },
    { key: 'estado', label: 'Estado', width: 102 },
    { key: 'fof', label: 'F. Oferta', width: 44 },
    { key: 'fct', label: 'F. Contrato', width: 48 },
    { key: 'etd', label: 'ETD', width: 42 },
    { key: 'eta', label: 'ETA', width: 42 },
    { key: 'dias', label: 'Dias Mrl', width: 40 },
    { key: 'seq', label: 'Seq', width: 24 },
    { key: 'cont', label: 'Contenedor', width: 96 },
    { key: 'bl', label: 'BL', width: 86 },
    { key: 'cliente', label: 'Cliente', width: 74 },
    { key: 'imp', label: 'Importadora', width: 98 },
  ] as const;
  const totalColumnWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const x0 = doc.page.margins.left + Math.max(0, (pageWidth - totalColumnWidth) / 2);

  function ensureSpace(height: number): void {
    const limit = doc.page.height - doc.page.margins.bottom;
    if (y + height <= limit) return;
    doc.addPage();
    y = doc.page.margins.top;
  }

  function drawHeader(title: string): void {
    ensureSpace(24);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(title, x0, y, {
      width: totalColumnWidth,
      align: 'left',
    });
    y += 20;
  }

  function drawSectionTitle(title: string, count: number): void {
    ensureSpace(28);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(`${title} (${count})`, x0, y, {
      width: totalColumnWidth,
    });
    y += 16;
  }

  function drawTableHeader(): void {
    ensureSpace(17);
    doc.rect(x0, y, totalColumnWidth, 15).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
    let x = x0 + 2;
    for (const col of columns) {
      doc.text(col.label, x, y + 4, { width: col.width - 4, lineBreak: false });
      x += col.width;
    }
    y += 15;
  }

  function drawRows(rows: ContainerRow[]): void {
    if (rows.length === 0) {
      ensureSpace(16);
      doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Sin filas para este bloque.', x0, y);
      y += 14;
      return;
    }
    drawTableHeader();

    for (const row of rows) {
      const c = row.container;
      const o = row.operation;
      const cells = [
        o.operationType === 'COMMERCIAL' ? 'COM' : 'PKG',
        operationRowLabel(o, c),
        operationDescription(o),
        c.status || o.status || '—',
        formatDateShort(o.offerCustomer?.fecha),
        formatDateShort(o.offerCustomer?.fechaContratoImportadora),
        formatDateShort(c.etdActual || c.etdEstimated),
        formatDateShort(c.etaActual || c.etaEstimated),
        daysInMarielDisplay(c),
        String(c.sequenceNo ?? '—'),
        c.containerNo || '—',
        c.blNo || '—',
        clienteNombreCompania(o),
        o.importadora?.nombre || '—',
      ];
      const rowTopPad = 3;
      const lineStep = 7.2;
      const rowBottomPad = 4;
      const descColIndex = 2;
      const clienteColIndex = 12;
      const multilineMaxLines: Record<number, number> = {
        2: 2,  // descripcion
        3: 3,  // estado
        10: 3, // contenedor
        11: 3, // BL
        12: 2, // cliente
        13: 3, // importadora
      };
      const linesCache = new Map<number, string[]>();
      let maxLinesThisRow = 1;
      for (const [idxRaw, max] of Object.entries(multilineMaxLines)) {
        const idx = Number(idxRaw);
        const w = columns[idx].width - 4;
        const lines = fitLines(doc, String(cells[idx]), w, max);
        linesCache.set(idx, lines);
        if (lines.length > maxLinesThisRow) maxLinesThisRow = lines.length;
      }
      const rowHeight = rowTopPad + maxLinesThisRow * lineStep + rowBottomPad;

      ensureSpace(rowHeight);

      const etaGreen = etaArriboMarielIsGreen(c);
      const etaNear = !etaGreen && etaIsNear(c);
      const daysCount = daysInMarielCount(c);
      const daysDanger = daysCount !== null && daysCount > 10;
      const statusRetenido = (c.status || '').trim().toLowerCase() === 'retenido en aduana';

      let fillX = x0;
      for (let i = 0; i < columns.length; i++) {
        const w = columns[i].width;
        if (i === 3 && statusRetenido) {
          doc.rect(fillX, y + 1, w, rowHeight - 2).fill('#FEF3C7');
        }
        if (i === 7 && etaGreen) {
          doc.rect(fillX, y + 1, w, rowHeight - 2).fill('#DCFCE7');
        }
        if (i === 7 && etaNear) {
          doc.rect(fillX, y + 1, w, rowHeight - 2).fill('#FEF9C3');
        }
        if (i === 8 && daysDanger) {
          doc.rect(fillX, y + 1, w, rowHeight - 2).fill('#FEE2E2');
        }
        fillX += w;
      }

      let x = x0 + 2;
      for (let i = 0; i < columns.length; i++) {
        if (i === 3 && statusRetenido) {
          doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(8);
        } else if (i === 7 && etaGreen) {
          doc.fillColor('#166534').font('Helvetica-Bold').fontSize(8);
        } else if (i === 7 && etaNear) {
          doc.fillColor('#854D0E').font('Helvetica-Bold').fontSize(8);
        } else if (i === 8 && daysDanger) {
          doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(8);
        } else {
          doc.fillColor('#111827').font('Helvetica').fontSize(8);
        }
        const cellWidth = columns[i].width - 4;
        const lines = linesCache.get(i) ?? fitLines(doc, String(cells[i]), cellWidth, 1);
        for (let li = 0; li < lines.length; li++) {
          doc.text(lines[li], x, y + rowTopPad + li * lineStep, {
            width: cellWidth,
            lineBreak: false,
          });
        }
        x += columns[i].width;
      }
      doc.moveTo(x0, y + rowHeight).lineTo(x0 + totalColumnWidth, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.4).stroke();
      y += rowHeight;
    }
  }

  drawHeader('ZAS Operaciones');
  drawSectionTitle('Comercial', commercialRows.length);
  drawRows(commercialRows);
  y += 10;
  drawSectionTitle('Parcel', parcelRows.length);
  drawRows(parcelRows);

  doc.end();
  return done;
}
