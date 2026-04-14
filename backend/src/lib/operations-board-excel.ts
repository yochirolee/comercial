import ExcelJS from 'exceljs';
import { prisma } from './prisma.js';
import { formatStoredDateOnlyEs } from './date-only.js';
import { buildOperationSearchOr } from './search-utils.js';
import {
  INACTIVE_CONTAINER_STATUSES,
  normalizeContainerStatus,
  statusFilterValuesForQuery,
} from './operation-status.js';

const GIFT_PARCEL = 'Gift Parcel';

/** Columnas alineadas al board (sin Ubicación). Índices 1-based: ETA = 8, Días Mariel = 9. */
const HEADERS = [
  'Tipo',
  'Operación',
  'Descripción',
  'Estado',
  'Fecha oferta',
  'Fecha contrato',
  'Fecha envío (ETD)',
  'ETA / Arribo Mariel',
  'Días en Mariel',
  'Origen',
  'Destino',
  'Seq',
  'Nº contenedor',
  'BL',
  'Cliente',
  'Importadora',
  'Últ. actualización',
] as const;

const COL_ETA = 8;
const COL_DIAS_MARIEL = 9;

type BoardOperation = Awaited<ReturnType<typeof loadOperationsForBoard>>[number];
type BoardContainer = BoardOperation['containers'][number];
type FilterType = 'COMMERCIAL' | 'PARCEL' | 'all';

function formatEsDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Igual que el board: verde si la fecha de arribo (ETA real o estimada) es hoy o ya pasó. */
function etaArriboMarielIsGreen(container: BoardContainer): boolean {
  const raw = container.etaActual ?? container.etaEstimated;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const today = startOfLocalDay(new Date());
  const etaDay = startOfLocalDay(d);
  return etaDay.getTime() <= today.getTime();
}

/** Días desde arribo hasta hoy; null si aún no aplica. */
function daysInMarielCount(container: BoardContainer): number | null {
  const refRaw = container.etaActual ?? container.etaEstimated;
  if (!refRaw) return null;
  const arr = new Date(refRaw);
  if (Number.isNaN(arr.getTime())) return null;
  const today = startOfLocalDay(new Date());
  const arrDay = startOfLocalDay(arr);
  const diffMs = today.getTime() - arrDay.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 0) return null;
  return days;
}

function statusLabel(status: string): string {
  return normalizeContainerStatus(status);
}

function operationRowLabel(
  op: Pick<BoardOperation, 'operationType' | 'operationNo' | 'referenciaOperacion'>,
  c: BoardContainer
): string {
  const ref = (op.referenciaOperacion || '').trim();
  if (ref) return ref;
  if (op.operationType !== 'PARCEL') return op.operationNo;
  const fromC = (c.containerNo || c.blNo || c.bookingNo || '').trim();
  if (fromC) return fromC;
  return op.operationNo;
}

function tableDescription(op: BoardOperation): string {
  if (op.operationType === 'PARCEL') return GIFT_PARCEL;
  const items = op.offerCustomer?.items;
  if (!items?.length) return '—';
  const parts: string[] = [];
  for (const it of items) {
    const name = (
      (it.nombreProducto || it.producto?.nombre || it.descripcion || '') as string
    ).trim();
    if (name) parts.push(name);
  }
  if (!parts.length) return '—';
  const text = parts.join(', ');
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

function clienteNombre(op: BoardOperation): string {
  const c = op.offerCustomer?.cliente;
  if (!c) return '—';
  const comp = (c.nombreCompania || '').trim();
  if (comp) return comp;
  return [c.nombre, c.apellidos].filter(Boolean).join(' ').trim() || '—';
}

function daysInMarielText(container: BoardContainer): string {
  const n = daysInMarielCount(container);
  return n === null ? '—' : String(n);
}

function lastUpdateShort(container: BoardContainer): string {
  const raw =
    container.trackingLastEventAt ||
    container.trackingLastSyncAt ||
    (container.events?.[0]?.eventDate ?? null) ||
    container.updatedAt;
  return formatEsDate(raw);
}

function etaSortKey(container: BoardContainer): number {
  const raw = container.etaActual ?? container.etaEstimated;
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

async function loadOperationsForBoard(filters: {
  tipo: FilterType;
  status?: string;
  search?: string;
}) {
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
          id: true,
          numero: true,
          fecha: true,
          fechaContratoImportadora: true,
          clienteId: true,
          cliente: {
            select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
          },
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
      importadora: { select: { id: true, nombre: true } },
      carrier: { select: { id: true, name: true, trackingUrlTemplate: true, scac: true } },
      containers: {
        orderBy: { sequenceNo: 'asc' },
        include: {
          events: {
            orderBy: { eventDate: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

type RowTuple = (string | number)[];

function containerToRow(
  op: BoardOperation,
  container: BoardContainer,
  soloActivas: boolean
): RowTuple | null {
  if (soloActivas && INACTIVE_CONTAINER_STATUSES.includes(container.status)) {
    return null;
  }

  const fechaOferta = op.offerCustomer?.fecha
    ? formatStoredDateOnlyEs(op.offerCustomer.fecha)
    : '';
  const fechaContrato = op.offerCustomer?.fechaContratoImportadora
    ? formatStoredDateOnlyEs(op.offerCustomer.fechaContratoImportadora)
    : '';

  const etdRaw = container.etdActual ?? container.etdEstimated;
  const etaRaw = container.etaActual ?? container.etaEstimated;

  return [
    op.operationType === 'COMMERCIAL' ? 'COMERCIAL' : 'PARCEL',
    operationRowLabel(op, container),
    tableDescription(op),
    statusLabel(container.status),
    fechaOferta,
    fechaContrato,
    formatEsDate(etdRaw),
    formatEsDate(etaRaw),
    daysInMarielText(container),
    (container.originPort || op.originPort || '').trim() || '—',
    (container.destinationPort || op.destinationPort || '').trim() || '—',
    container.sequenceNo,
    (container.containerNo || '').trim() || '—',
    (container.blNo || '').trim() || '—',
    clienteNombre(op),
    op.importadora?.nombre?.trim() || '—',
    lastUpdateShort(container),
  ];
}

type RowWithContainer = { row: RowTuple; container: BoardContainer };

function collectRowsForType(
  operations: BoardOperation[],
  type: 'COMMERCIAL' | 'PARCEL',
  soloActivas: boolean
): RowWithContainer[] {
  const rows: Array<RowWithContainer & { sortKey: number }> = [];

  for (const op of operations) {
    if (op.operationType !== type) continue;
    const containers = op.containers ?? [];
    for (const c of containers) {
      const row = containerToRow(op, c, soloActivas);
      if (row) {
        rows.push({ row, container: c, sortKey: etaSortKey(c) });
      }
    }
  }

  rows.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return String(a.row[1]).localeCompare(String(b.row[1]), undefined, { numeric: true });
  });

  return rows.map(({ row, container }) => ({ row, container }));
}

function applyHeaderStyle(sheet: ExcelJS.Worksheet, headerRowIndex: number): void {
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
}

function applyRowHighlights(row: ExcelJS.Row, container: BoardContainer): void {
  if (etaArriboMarielIsGreen(container)) {
    const cell = row.getCell(COL_ETA);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' },
    };
    cell.font = { color: { argb: 'FF166534' } };
  }

  const dCount = daysInMarielCount(container);
  if (dCount !== null && dCount > 10) {
    const cell = row.getCell(COL_DIAS_MARIEL);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
  }
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  titleLine: string,
  dataRows: RowWithContainer[]
): void {
  const sheet = workbook.addWorksheet(name);
  const n = HEADERS.length;
  const lastColLetter = String.fromCharCode('A'.charCodeAt(0) + n - 1);

  sheet.mergeCells(`A1:${lastColLetter}1`);
  sheet.getCell('A1').value = titleLine;
  sheet.getCell('A1').font = { bold: true, size: 11 };
  sheet.getCell('A1').alignment = {
    wrapText: false,
    vertical: 'middle',
    horizontal: 'center',
  };
  sheet.getRow(1).height = 24;

  const headerRow = sheet.getRow(2);
  HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(sheet, 2);

  const widths = [12, 16, 36, 22, 12, 12, 12, 16, 14, 14, 14, 6, 14, 12, 22, 18, 14];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  let dataRowIndex = 3;
  for (const { row: cells, container } of dataRows) {
    sheet.addRow(cells);
    const excelRow = sheet.getRow(dataRowIndex);
    applyRowHighlights(excelRow, container);
    dataRowIndex += 1;
  }
}

/**
 * Excel con dos hojas (Comercial y Parcel), columnas como el Operations Board (sin ubicación).
 * Resalta ETA y días en Mariel como en la app.
 */
export async function buildOperationsBoardExcelBuffer(options: {
  soloActivas: boolean;
  tipo: FilterType;
  status?: string;
  search?: string;
}): Promise<Buffer> {
  const operations = await loadOperationsForBoard({
    tipo: options.tipo,
    status: options.status,
    search: options.search,
  });
  const commercialRows = collectRowsForType(operations, 'COMMERCIAL', options.soloActivas);
  const parcelRows = collectRowsForType(operations, 'PARCEL', options.soloActivas);

  const workbook = new ExcelJS.Workbook();
  const day = new Date().toISOString().split('T')[0];
  workbook.creator = 'ZAS';
  workbook.created = new Date();

  addSheet(
    workbook,
    'Comercial',
    `Operations Board — Comercial (${day})`,
    commercialRows
  );
  addSheet(workbook, 'Parcel', `Operations Board — Parcel (${day})`, parcelRows);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
