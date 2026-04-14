import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { formatStoredDateOnlyEs } from '../lib/date-only.js';
import { buildOperationsBoardExcelBuffer } from '../lib/operations-board-excel.js';
import { buildOperationsBoardPdfBuffer } from '../lib/operations-board-pdf.js';
import { sendOperationsBoardExcelEmail, sendOperationsBoardPdfEmail } from '../services/email.service.js';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Cache para imágenes descargadas (evita descargar múltiples veces)
const imageCache: Map<string, Buffer> = new Map();

/** URL absoluta (p. ej. protocolo relativo //cdn...) */
function normalizeImageSource(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

/**
 * PDFKit / Excel suelen fallar con WebP. En Cloudinary forzamos entrega PNG en el fetch.
 */
function cloudinaryFetchUrl(url: string): string {
  const basePath = url.split('?')[0].split('#')[0];
  if (!/cloudinary\.com\/.+\/image\/upload\//i.test(url)) return url;
  if (!/\.webp(\?|$)/i.test(basePath)) return url;
  if (/\/image\/upload\/[^/]*\bf_(png|jpg|jpeg)\b/i.test(url)) return url;
  return url.replace(/\/image\/upload\//i, '/image/upload/f_png,q_auto/');
}

// Función para descargar imagen remota y obtener buffer
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const normalized = normalizeImageSource(url) ?? url.trim();
  const fetchUrl = cloudinaryFetchUrl(normalized);
  try {
    if (imageCache.has(fetchUrl)) {
      return imageCache.get(fetchUrl)!;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.warn('[export] fetch imagen HTTP', response.status, fetchUrl.slice(0, 120));
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    imageCache.set(fetchUrl, buffer);

    return buffer;
  } catch (error) {
    console.error('[export] Error fetching image:', fetchUrl.slice(0, 120), error);
    return null;
  }
}

// Función para agregar imagen a Excel (maneja URLs remotas y archivos locales)
async function addImageToExcel(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  imagePath: string | null,
  position: { col: number; row: number },
  size: { width: number; height: number }
): Promise<void> {
  if (!imagePath) return;

  try {
    const resolved = normalizeImageSource(imagePath) ?? imagePath.trim();
    const isRemote = resolved.startsWith('http://') || resolved.startsWith('https://');

    if (isRemote) {
      const buffer = await fetchImageBuffer(resolved);
      if (!buffer) {
        console.warn('[export] Excel: imagen remota no disponible:', resolved.slice(0, 100));
        return;
      }

      const ext = getImageExtension(cloudinaryFetchUrl(resolved));
      const imageId = workbook.addImage({
        // @ts-expect-error - Buffer type compatibility issue with exceljs
        buffer,
        extension: ext,
      });
      worksheet.addImage(imageId, {
        tl: position,
        ext: size,
      });
    } else {
      if (!fs.existsSync(resolved)) return;

      const imageId = workbook.addImage({
        filename: resolved,
        extension: getImageExtension(resolved),
      });
      worksheet.addImage(imageId, {
        tl: position,
        ext: size,
      });
    }
  } catch (error) {
    console.error('Error adding image to Excel:', error);
  }
}

// ==========================================
// CONSTANTES DE EMPRESA (valores por defecto)
// ==========================================
const DEFAULT_COMPANY = {
  nombre: 'ZAS BY JMC CORP',
  direccion: '7081 NW 72 AVE MIAMI, FL 33166',
  telefono: 'TEL:+1 786-636-4893',
  email: 'E-MAIL: boris@zasbyjmc.com  claudia@zasbyjmc.com',
  representante: 'LIC. BORIS LUIS CABRERA PEREZ',
  cargoRepresentante: 'PRESIDENTE',
  codigoMincex: 'US-0439',
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyUnitPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

async function buildUnidadAbrevMapFromItems(items: any[]): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(
      items
        .map((item) => (item as any)?.unidadMedidaId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  if (ids.length === 0) return new Map();

  const unidades = await prisma.unidadMedida.findMany({
    where: { id: { in: ids } },
    select: { id: true, abreviatura: true },
  });
  return new Map(unidades.map((u) => [u.id, u.abreviatura]));
}

function getItemUnidadAbrev(item: any, unidadAbrevMap?: Map<string, string>): string {
  return (
    item?.producto?.unidadMedida?.abreviatura ??
    item?.unidadMedida?.abreviatura ??
    ((item?.unidadMedidaId && unidadAbrevMap?.get(item.unidadMedidaId)) || '') ??
    ''
  );
}

async function getImageForPdf(imagePath: string): Promise<Buffer | string | null> {
  if (!imagePath) return null;

  const resolved = normalizeImageSource(imagePath) ?? imagePath.trim();
  const isRemote = resolved.startsWith('http://') || resolved.startsWith('https://');

  if (isRemote) {
    return await fetchImageBuffer(resolved);
  } else {
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date).toUpperCase();
}

interface EmpresaInfo {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  representante: string;
  cargoRepresentante: string;
  codigoMincex: string;
  logo: string | null;
  firmaPresidente: string | null;
  cunoEmpresa: string | null;
}

async function getEmpresaInfo(): Promise<EmpresaInfo> {
  const empresa = await prisma.empresa.findFirst({
    orderBy: { updatedAt: 'desc' },
  });
  return {
    nombre: empresa?.nombre || DEFAULT_COMPANY.nombre,
    direccion: empresa?.direccion || DEFAULT_COMPANY.direccion,
    telefono: empresa?.telefono || DEFAULT_COMPANY.telefono,
    email: empresa?.email || DEFAULT_COMPANY.email,
    representante: empresa?.representante || DEFAULT_COMPANY.representante,
    cargoRepresentante: empresa?.cargoRepresentante || DEFAULT_COMPANY.cargoRepresentante,
    codigoMincex: empresa?.codigoMincex || DEFAULT_COMPANY.codigoMincex,
    logo: empresa?.logo || null,
    firmaPresidente: empresa?.firmaPresidente || null,
    cunoEmpresa: empresa?.cunoEmpresa || null,
  };
}

function getImagePath(imagePath: string | null): string | null {
  const normalized = normalizeImageSource(imagePath);
  if (!normalized) return null;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const rel = normalized.replace(/^[/\\]+/, '');
  const candidates = [
    path.join(process.cwd(), 'uploads', rel),
    path.join(process.cwd(), rel),
    path.join(process.cwd(), 'uploads', path.basename(rel)),
  ];
  for (const fullPath of candidates) {
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function getImageExtension(imagePath: string): 'png' | 'jpeg' | 'gif' {
  if (/\/image\/upload\/[^/]*\bf_png\b/i.test(imagePath)) return 'png';
  if (/\/image\/upload\/[^/]*\bf_jpe?g\b/i.test(imagePath)) return 'jpeg';
  let ext = '';
  if (imagePath.includes('?')) {
    ext = path.extname(imagePath.split('?')[0]).toLowerCase();
  } else {
    ext = path.extname(imagePath).toLowerCase();
  }
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.gif') return 'gif';
  if (ext === '.webp') return 'png';
  return 'png';
}

// Función para agregar imagen a PDF (maneja URLs remotas y archivos locales)
async function addImageToPdf(
  doc: PDFKit.PDFDocument,
  imagePath: string | null,
  x: number,
  y: number,
  options: { width?: number; height?: number }
): Promise<void> {
  if (!imagePath) return;

  try {
    const resolved = normalizeImageSource(imagePath) ?? imagePath;
    const isRemote = resolved.startsWith('http://') || resolved.startsWith('https://');

    if (isRemote) {
      const buffer = await fetchImageBuffer(resolved);
      if (buffer) {
        doc.image(buffer, x, y, options);
      } else {
        console.warn('[export] PDF: imagen remota no disponible:', resolved.slice(0, 100));
      }
    } else {
      // Archivo local
      if (fs.existsSync(imagePath)) {
        doc.image(imagePath, x, y, options);
      }
    }
  } catch (error) {
    console.error('Error adding image to PDF:', error);
  }
}

// ==========================================
// COLUMNAS DE TABLA - DINÁMICAS según campos con valores
// ==========================================

// Campos opcionales que se pueden mostrar
interface OptionalFields {
  codigoArancelario: boolean;
  cantidadSacos: boolean;
  pesoXSaco: boolean;
  precioXSaco: boolean;
  cantidadCajas: boolean;
  pesoXCaja: boolean;
  precioXCaja: boolean;
}

// Detectar qué campos opcionales tienen valores en los items
function detectOptionalFields(items: any[]): OptionalFields {
  const fields: OptionalFields = {
    codigoArancelario: false,
    cantidadSacos: false,
    pesoXSaco: false,
    precioXSaco: false,
    cantidadCajas: false,
    pesoXCaja: false,
    precioXCaja: false,
  };

  for (const item of items) {
    if (item.codigoArancelario !== null && item.codigoArancelario !== undefined && String(item.codigoArancelario).trim() !== '') fields.codigoArancelario = true;
    if (item.cantidadSacos !== null && item.cantidadSacos !== undefined) fields.cantidadSacos = true;
    if (item.pesoXSaco !== null && item.pesoXSaco !== undefined) fields.pesoXSaco = true;
    if (item.precioXSaco !== null && item.precioXSaco !== undefined) fields.precioXSaco = true;
    if (item.cantidadCajas !== null && item.cantidadCajas !== undefined) fields.cantidadCajas = true;
    if (item.pesoXCaja !== null && item.pesoXCaja !== undefined) fields.pesoXCaja = true;
    if (item.precioXCaja !== null && item.precioXCaja !== undefined) fields.precioXCaja = true;
  }

  return fields;
}

function getCamposOpcionalesArray(item: any): { label: string; value?: string }[] {
  if (!item?.camposOpcionales) return [];
  const raw = item.camposOpcionales;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getDynamicOptionalLabels(items: any[]): string[] {
  const labelsSet = new Set<string>();
  for (const item of items) {
    const campos = getCamposOpcionalesArray(item);
    for (const campo of campos) {
      if (!campo || typeof campo.label !== 'string') continue;
      const label = campo.label.trim();
      if (!label) continue;
      if (!labelsSet.has(label)) {
        labelsSet.add(label);
      }
    }
  }
  return Array.from(labelsSet);
}

// Construir headers y anchos dinámicamente
interface DynamicColumns {
  headers: string[];
  widthsPdf: number[];
  widthsExcel: number[];
  optionalFields: OptionalFields;
  dynamicLabels: string[];
}

function buildDynamicColumns(items: any[]): DynamicColumns {
  const optionalFields = detectOptionalFields(items);
  const dynamicLabels = getDynamicOptionalLabels(items);
  
  // Columnas base: ITEM, DESCRIPCION, UM
  const headers: string[] = ['ITEM', 'DESCRIPCION', 'UM'];
  const widthsPdf: number[] = [30, 190, 30]; // Descripción ancha + columna UM
  const widthsExcel: number[] = [6, 40, 8];

  // Campos opcionales dinámicos (por label), justo después de UM
  for (const label of dynamicLabels) {
    const trimmed = label.trim();
    headers.push(trimmed ? trimmed.toUpperCase() : '');
    // Ancho base amplio para valores largos (se ajusta abajo si la tabla excede la página)
    widthsPdf.push(72);
    widthsExcel.push(12);
  }

  // Agregar campos opcionales fijos en orden lógico
  if (optionalFields.codigoArancelario) {
    headers.push('PARTIDA\nARANCEL');
    widthsPdf.push(70);
    widthsExcel.push(18);
  }
  if (optionalFields.cantidadSacos) {
    headers.push('CANT.\nSACOS');
    widthsPdf.push(50);
    widthsExcel.push(10);
  }
  if (optionalFields.pesoXSaco) {
    headers.push('PESO\nX SACO');
    widthsPdf.push(50);
    widthsExcel.push(10);
  }
  if (optionalFields.precioXSaco) {
    headers.push('PRECIO\nX SACO');
    widthsPdf.push(55);
    widthsExcel.push(11);
  }
  if (optionalFields.cantidadCajas) {
    headers.push('CANT.\nCAJAS');
    widthsPdf.push(50);
    widthsExcel.push(10);
  }
  if (optionalFields.pesoXCaja) {
    headers.push('PESO\nX CAJA');
    widthsPdf.push(50);
    widthsExcel.push(10);
  }
  if (optionalFields.precioXCaja) {
    headers.push('PRECIO\nX CAJA');
    widthsPdf.push(55);
    widthsExcel.push(11);
  }

  // Columnas finales genéricas: CANTIDAD, PRECIO UNITARIO, IMPORTE
  headers.push('CANT.', 'PRECIO', 'IMPORTE');
  widthsPdf.push(55, 55, 70);
  widthsExcel.push(11, 11, 13);

  // Ajustar anchos PDF si la tabla se pasa del ancho disponible
  const maxTableWidth = 532; // carta 612 − márgenes 40×2
  const totalWidth = widthsPdf.reduce((sum, w) => sum + w, 0);
  if (totalWidth > maxTableWidth) {
    const nDyn = dynamicLabels.length;
    const idxLast3 = widthsPdf.length - 3;
    const minW = (i: number): number => {
      if (i === 0) return 22;
      if (i === 1) return 88;
      if (i === 2) return 26;
      if (i >= 3 && i < 3 + nDyn) return 50;
      if (i >= idxLast3) {
        const k = i - idxLast3;
        return k === 0 ? 42 : k === 1 ? 42 : 52;
      }
      return 34;
    };
    const scale = maxTableWidth / totalWidth;
    for (let i = 0; i < widthsPdf.length; i++) {
      widthsPdf[i] = Math.max(minW(i), Math.round(widthsPdf[i] * scale));
    }
    let sumW = widthsPdf.reduce((a, b) => a + b, 0);
    while (sumW > maxTableWidth) {
      let progressed = false;
      for (let i = widthsPdf.length - 1; i >= 0; i--) {
        if (widthsPdf[i] > minW(i)) {
          widthsPdf[i]--;
          sumW--;
          progressed = true;
          if (sumW <= maxTableWidth) break;
        }
      }
      if (!progressed) break;
    }
  }

  return { headers, widthsPdf, widthsExcel, optionalFields, dynamicLabels };
}

// ==========================================
// PDF - HEADER COMÚN (Empresa primero, luego título)
// ==========================================
async function renderPdfHeader(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number, contentWidth: number): Promise<number> {
  const headerY = doc.y;
  
  // Logo a la izquierda (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    await addImageToPdf(doc, logoPath, margin, headerY, { width: 70 });
  }

  // Empresa centrada (PRIMERO)
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text(empresa.nombre, margin, headerY, { width: contentWidth, align: 'center' });
  
  doc.fontSize(10).font('Helvetica');
  doc.text(empresa.direccion, margin, headerY + 18, { width: contentWidth, align: 'center' });
  doc.text(`${empresa.telefono}, ${empresa.email}`, margin, headerY + 32, { width: contentWidth, align: 'center' });

  // Título "OFERTA DE VENTAS" (DESPUÉS)
  doc.y = headerY + 55;
  doc.fontSize(14).font('Helvetica-Bold').text('OFERTA DE VENTAS', { align: 'center' });
  doc.moveDown(0.8);

  return doc.y;
}

// ==========================================
// PDF - TABLA DE ITEMS (alineada a la izquierda, con columnas dinámicas)
// ==========================================
function renderPdfTable(
  doc: PDFKit.PDFDocument, 
  items: any[], 
  margin: number,
  usePrecioAjustado: boolean = false,
  includeTotal: boolean = false,
  totalLabel: string = 'TOTAL CIF',
  unidadAbrevMap?: Map<string, string>
): { yPos: number; totalImporte: number; tableLeft: number; tableWidth: number; lastColWidth: number } {
  const { headers, widthsPdf, optionalFields, dynamicLabels } = buildDynamicColumns(items);
  
  const tableTop = doc.y;
  const tableWidth = widthsPdf.reduce((a, b) => a + b, 0);
  const tableLeft = margin;
  const lastColWidth = widthsPdf[widthsPdf.length - 1];

  doc.font('Helvetica-Bold').fontSize(7);
  let headerContentH = 0;
  headers.forEach((header, i) => {
    const w = Math.max(1, widthsPdf[i] - 4);
    const align = i <= 1 ? 'left' : 'center';
    const h = doc.heightOfString(header, { width: w, lineGap: 1, align });
    headerContentH = Math.max(headerContentH, h);
  });
  const HEADER_HEIGHT = Math.max(30, Math.ceil(headerContentH) + 10);
  
  // Fondo gris para encabezados
  doc.rect(tableLeft, tableTop, tableWidth, HEADER_HEIGHT).fill('#e8e8e8');
  doc.fillColor('#000');
  
  let xPos = tableLeft;
  const headerTextY = tableTop + 5;
  
  headers.forEach((header, i) => {
    const align = i <= 1 ? 'left' : 'center';
    doc.text(header, xPos + 2, headerTextY, { width: widthsPdf[i] - 4, align, lineGap: 1 });
    xPos += widthsPdf[i];
  });
  
  // Línea después de encabezados
  doc.moveTo(tableLeft, tableTop + HEADER_HEIGHT).lineTo(tableLeft + tableWidth, tableTop + HEADER_HEIGHT).stroke();
  
  // Items
  doc.font('Helvetica').fontSize(8);
  const pdfRowLineGap = 1;
  const pdfRowVPad = 4;
  const pdfMinRowHeight = 15;
  let yPos = tableTop + HEADER_HEIGHT + 6;
  let itemNum = 1;
  let totalImporte = 0;

  for (const item of items) {
    const cantidadLbs = item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    const importe = cantidadLbs * precioXLb;
    totalImporte += importe;

    const itemNombrePdf = (item as any).producto?.nombre ?? (item as any).nombreProducto ?? '';
    const descColInnerW = Math.max(1, widthsPdf[1] - 6);
    let rowHeight = Math.max(
      pdfMinRowHeight,
      doc.heightOfString(itemNombrePdf, { width: descColInnerW, lineGap: pdfRowLineGap }) + pdfRowVPad
    );

    let measureCol = 3;
    if (dynamicLabels.length > 0) {
      const camposM = getCamposOpcionalesArray(item);
      for (const label of dynamicLabels) {
        const campo = camposM.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
        const val =
          campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
        const inner = Math.max(1, widthsPdf[measureCol] - 6);
        rowHeight = Math.max(
          rowHeight,
          doc.heightOfString(val, { width: inner, lineGap: pdfRowLineGap, align: 'left' }) + pdfRowVPad
        );
        measureCol++;
      }
    }
    if (optionalFields.codigoArancelario) {
      const val = (item as any).codigoArancelario ? String((item as any).codigoArancelario) : '-';
      const inner = Math.max(1, widthsPdf[measureCol] - 6);
      rowHeight = Math.max(
        rowHeight,
        doc.heightOfString(val, { width: inner, lineGap: pdfRowLineGap }) + pdfRowVPad
      );
    }

    if (yPos + rowHeight > 650) {
      doc.addPage();
      yPos = 50;
    }

    xPos = tableLeft;
    let colIndex = 0;

    // ITEM
    doc.text(String(itemNum), xPos + 3, yPos, {
      width: widthsPdf[colIndex] - 6,
      align: 'center',
      lineGap: pdfRowLineGap,
    });
    xPos += widthsPdf[colIndex++];

    // DESCRIPCION (wrap; altura de fila ya calculada)
    doc.text(itemNombrePdf, xPos + 3, yPos, {
      width: widthsPdf[colIndex] - 6,
      lineGap: pdfRowLineGap,
    });
    xPos += widthsPdf[colIndex++];

    // UNIDAD DE MEDIDA
    const unidadMedidaAbrev = getItemUnidadAbrev(item, unidadAbrevMap);
    doc.text(unidadMedidaAbrev, xPos + 3, yPos, {
      width: widthsPdf[colIndex] - 6,
      align: 'center',
      lineGap: pdfRowLineGap,
    });
    xPos += widthsPdf[colIndex++];

    // Campos opcionales dinámicos (por label), se muestran en el orden detectado
    if (dynamicLabels.length > 0) {
      const campos = getCamposOpcionalesArray(item);
      for (const label of dynamicLabels) {
        const campo = campos.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
        const val = campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
        doc.text(val, xPos + 3, yPos, {
          width: widthsPdf[colIndex] - 6,
          align: 'left',
          lineGap: pdfRowLineGap,
        });
        xPos += widthsPdf[colIndex++];
      }
    }

    // Campos opcionales
    if (optionalFields.codigoArancelario) {
      const val = (item as any).codigoArancelario ? String((item as any).codigoArancelario) : '-';
      doc.text(val, xPos + 3, yPos, {
        width: widthsPdf[colIndex] - 6,
        align: 'center',
        lineGap: pdfRowLineGap,
      });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.cantidadSacos) {
      const val = item.cantidadSacos ?? '-';
      doc.text(String(val), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.pesoXSaco) {
      const val = item.pesoXSaco != null ? formatCurrency(item.pesoXSaco) : '-';
      doc.text(val, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.precioXSaco) {
      const val = item.precioXSaco != null ? `$${formatCurrency(item.precioXSaco)}` : '-';
      doc.text(val, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.cantidadCajas) {
      const val = item.cantidadCajas ?? '-';
      doc.text(String(val), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.pesoXCaja) {
      const val = item.pesoXCaja != null ? formatCurrency(item.pesoXCaja) : '-';
      doc.text(val, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
      xPos += widthsPdf[colIndex++];
    }
    if (optionalFields.precioXCaja) {
      const val = item.precioXCaja != null ? `$${formatCurrency(item.precioXCaja)}` : '-';
      doc.text(val, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
      xPos += widthsPdf[colIndex++];
    }
    
    // CANTIDAD LBS
    doc.text(formatCurrency(cantidadLbs), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // PRECIO X LB
    doc.text(`$${formatCurrency(precioXLb)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // IMPORTE
    doc.text(`$${formatCurrency(importe)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    
    yPos += rowHeight;
    itemNum++;
  }

  // Línea separadora antes del total
  doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).stroke();
  
  // Fila de TOTAL (si se solicita)
  if (includeTotal) {
    yPos += 4;
    doc.font('Helvetica-Bold').fontSize(9);

    // Evitar solapamiento cuando hay muchas columnas opcionales:
    // renderizamos "TOTAL + valor" en un solo bloque derecho.
    const totalBlockWidth = Math.max(widthsPdf[widthsPdf.length - 1] + widthsPdf[widthsPdf.length - 2] - 6, 120);
    const totalBlockX = tableLeft + tableWidth - totalBlockWidth;
    doc.text(`${totalLabel}: $${formatCurrency(totalImporte)}`, totalBlockX, yPos, {
      width: totalBlockWidth,
      align: 'right',
      lineBreak: false,
    });
    
    yPos += 16;
    // Sin línea final después del total
  }
  
  return { yPos: yPos + 8, totalImporte, tableLeft, tableWidth, lastColWidth };
}

// ==========================================
// PDF - TÉRMINOS Y CONDICIONES
// ==========================================
function renderPdfTerminos(doc: PDFKit.PDFDocument, margin: number): void {
  doc.font('Helvetica').fontSize(9);
  doc.text('TERMINOS Y CONDICIONES: PAGO 100% ANTES DEL EMBARQUE', margin, doc.y);
}

// ==========================================
// PDF - FIRMA COMÚN
// ==========================================
async function renderPdfFirma(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number): Promise<void> {
  // Más espacio antes de la firma para no tapar el texto
  doc.moveDown(4);
  
  // Espacio para la imagen de firma (arriba de la línea)
  const firmaImageY = doc.y;
  const firmaWidth = 180;

  // Imagen de firma (si existe) - arriba de la línea
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    await addImageToPdf(doc, firmaPath, margin + 30, firmaImageY, { width: 100, height: 45 });
  }
  
  // Línea de firma (debajo de la imagen)
  const firmaLineY = firmaImageY + 50;
  doc.moveTo(margin, firmaLineY).lineTo(margin + firmaWidth, firmaLineY).stroke();
  
  // Texto de firma (debajo de la línea)
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(empresa.representante, margin, firmaLineY + 5, { width: firmaWidth, align: 'center' });
  doc.font('Helvetica').fontSize(9);
  doc.text(empresa.cargoRepresentante, margin, firmaLineY + 18, { width: firmaWidth, align: 'center' });
  doc.text(empresa.nombre, margin, firmaLineY + 30, { width: firmaWidth, align: 'center' });

  // Cuño (si existe) - al lado de la firma
  const cunoPath = getImagePath(empresa.cunoEmpresa);
  if (cunoPath) {
    await addImageToPdf(doc, cunoPath, margin + firmaWidth + 20, firmaImageY + 10, { width: 70, height: 70 });
  }
}

// ==========================================
// EXCEL - HEADER COMÚN
// ==========================================
async function renderExcelHeader(
  worksheet: ExcelJS.Worksheet, 
  workbook: ExcelJS.Workbook,
  empresa: EmpresaInfo, 
  lastCol: string
): Promise<number> {
  let row = 1;

  // Logo (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 70, height: 50 });
  }

  // Empresa primero (nombre, dirección, contacto)
  worksheet.mergeCells(`B${row}:${lastCol}${row}`);
  worksheet.getCell(`B${row}`).value = empresa.nombre;
  worksheet.getCell(`B${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
  worksheet.getRow(row).height = 18;
  row++;

  worksheet.mergeCells(`B${row}:${lastCol}${row}`);
  worksheet.getCell(`B${row}`).value = empresa.direccion;
  worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
  row++;

  worksheet.mergeCells(`B${row}:${lastCol}${row}`);
  worksheet.getCell(`B${row}`).value = `${empresa.telefono}, ${empresa.email}`;
  worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
  row++;

  row++; // Espacio

  // Título "OFERTA DE VENTAS" después de los datos de empresa
  worksheet.mergeCells(`A${row}:${lastCol}${row}`);
  worksheet.getCell(`A${row}`).value = 'OFERTA DE VENTAS';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 16 };
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

  row++; // Espacio después del título
  return row;
}

// ==========================================
// EXCEL - TABLA DE ITEMS (con columnas dinámicas)
// ==========================================
function renderExcelTable(
  worksheet: ExcelJS.Worksheet, 
  items: any[], 
  startRow: number,
  usePrecioAjustado: boolean = false,
  unidadAbrevMap?: Map<string, string>
): { endRow: number; totalImporte: number; lastCol: string; numCols: number } {
  const { headers, widthsExcel, optionalFields, dynamicLabels } = buildDynamicColumns(items);
  
  let row = startRow;

  // Configurar anchos de columnas
  worksheet.columns = widthsExcel.map(w => ({ width: w }));
  
  // Encabezados (sin saltos de línea para Excel)
  const excelHeaders = headers.map(h => h.replace('\n', ' '));
  const headerRow = worksheet.getRow(row);
  headerRow.values = excelHeaders;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = { 
      top: { style: 'thin' }, 
      bottom: { style: 'thin' }, 
      left: { style: 'thin' }, 
      right: { style: 'thin' } 
    };
  });
  row++;

  // Items
  let itemNum = 1;
  let totalImporte = 0;

  for (const item of items) {
    const dataRow = worksheet.getRow(row);
    const cantidadLbs = item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    const importe = cantidadLbs * precioXLb;
    totalImporte += importe;

    // Construir valores dinámicamente
    const unidadMedidaAbrev = getItemUnidadAbrev(item, unidadAbrevMap);
    const values: (string | number)[] = [itemNum, (item as any).producto?.nombre ?? (item as any).nombreProducto ?? '', unidadMedidaAbrev];
    
    // Campos opcionales dinámicos (por label) inmediatamente después de UM
    if (dynamicLabels.length > 0) {
      const campos = getCamposOpcionalesArray(item);
      for (const label of dynamicLabels) {
        const campo = campos.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
        const val = campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
        values.push(val);
      }
    }
    
    if (optionalFields.codigoArancelario) values.push((item as any).codigoArancelario ?? '-');
    if (optionalFields.cantidadSacos) values.push(item.cantidadSacos ?? '-');
    if (optionalFields.pesoXSaco) values.push(item.pesoXSaco ?? '-');
    if (optionalFields.precioXSaco) values.push(item.precioXSaco ?? '-');
    if (optionalFields.cantidadCajas) values.push(item.cantidadCajas ?? '-');
    if (optionalFields.pesoXCaja) values.push(item.pesoXCaja ?? '-');
    if (optionalFields.precioXCaja) values.push(item.precioXCaja ?? '-');
    
    values.push(cantidadLbs, precioXLb, importe);
    
    dataRow.values = values;

    // Formateo de celdas
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    
    // Índices de las últimas 3 columnas (cantidad, precio, importe)
    const numCols = values.length;
    dataRow.getCell(numCols - 2).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols - 2).numFmt = '#,##0.00';
    dataRow.getCell(numCols - 1).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols - 1).numFmt = '"$"#,##0.00';
    dataRow.getCell(numCols).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols).numFmt = '"$"#,##0.00';
    
    // Formatear campos opcionales de precio con $
    let colIdx = 4 + dynamicLabels.length;
    if (optionalFields.codigoArancelario) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'center' };
      colIdx++;
    }
    if (optionalFields.cantidadSacos) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'center' };
      colIdx++;
    }
    if (optionalFields.pesoXSaco) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'right' };
      if (typeof dataRow.getCell(colIdx).value === 'number') {
        dataRow.getCell(colIdx).numFmt = '#,##0.00';
      }
      colIdx++;
    }
    if (optionalFields.precioXSaco) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'right' };
      if (typeof dataRow.getCell(colIdx).value === 'number') {
        dataRow.getCell(colIdx).numFmt = '"$"#,##0.00';
      }
      colIdx++;
    }
    if (optionalFields.cantidadCajas) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'center' };
      colIdx++;
    }
    if (optionalFields.pesoXCaja) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'right' };
      if (typeof dataRow.getCell(colIdx).value === 'number') {
        dataRow.getCell(colIdx).numFmt = '#,##0.00';
      }
      colIdx++;
    }
    if (optionalFields.precioXCaja) {
      dataRow.getCell(colIdx).alignment = { horizontal: 'right' };
      if (typeof dataRow.getCell(colIdx).value === 'number') {
        dataRow.getCell(colIdx).numFmt = '"$"#,##0.00';
      }
      colIdx++;
    }

    dataRow.eachCell((cell) => {
      cell.border = { 
        top: { style: 'thin' }, 
        bottom: { style: 'thin' }, 
        left: { style: 'thin' }, 
        right: { style: 'thin' } 
      };
    });

    row++;
    itemNum++;
  }

  // Calcular última columna (A, B, C, ... Z, AA, etc.)
  const lastColIndex = headers.length;
  const lastCol = lastColIndex <= 26 
    ? String.fromCharCode(64 + lastColIndex) 
    : 'A' + String.fromCharCode(64 + lastColIndex - 26);

  return { endRow: row, totalImporte, lastCol, numCols: headers.length };
}

// ==========================================
// EXCEL - FILA TOTAL CIF (dentro de la tabla)
// ==========================================
function renderExcelTotalRow(
  worksheet: ExcelJS.Worksheet,
  row: number,
  totalImporte: number,
  numCols: number,
  lastCol: string
): number {
  const totalRow = worksheet.getRow(row);
  
  // Columna anterior a la última para el label
  const prevCol = numCols - 1;
  const importeCol = numCols;
  
  // Fila TOTAL CIF con fondo gris
  totalRow.getCell(prevCol).value = 'TOTAL CIF:';
  totalRow.getCell(prevCol).font = { bold: true };
  totalRow.getCell(prevCol).alignment = { horizontal: 'right' };
  totalRow.getCell(prevCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  totalRow.getCell(prevCol).border = { 
    top: { style: 'thin' }, 
    bottom: { style: 'thin' }, 
    left: { style: 'thin' }, 
    right: { style: 'thin' } 
  };
  
  totalRow.getCell(importeCol).value = totalImporte;
  totalRow.getCell(importeCol).numFmt = '"$"#,##0.00';
  totalRow.getCell(importeCol).font = { bold: true };
  totalRow.getCell(importeCol).alignment = { horizontal: 'right' };
  totalRow.getCell(importeCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  totalRow.getCell(importeCol).border = { 
    top: { style: 'thin' }, 
    bottom: { style: 'thin' }, 
    left: { style: 'thin' }, 
    right: { style: 'thin' } 
  };
  
  // Rellenar celdas vacías con el fondo gris y bordes para uniformidad
  for (let i = 1; i < prevCol; i++) {
    totalRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    totalRow.getCell(i).border = { 
      top: { style: 'thin' }, 
      bottom: { style: 'thin' }, 
      left: { style: 'thin' }, 
      right: { style: 'thin' } 
    };
  }
  
  return row + 1;
}

// ==========================================
// EXCEL - TÉRMINOS
// ==========================================
function renderExcelTerminos(worksheet: ExcelJS.Worksheet, row: number, lastCol: string): number {
  worksheet.mergeCells(`A${row}:${lastCol}${row}`);
  worksheet.getCell(`A${row}`).value = 'TERMINOS Y CONDICIONES: PAGO 100% ANTES DEL EMBARQUE';
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
  return row + 1;
}

// ==========================================
// EXCEL - FIRMA
// ==========================================
async function renderExcelFirma(
  worksheet: ExcelJS.Worksheet, 
  workbook: ExcelJS.Workbook,
  empresa: EmpresaInfo, 
  startRow: number
): Promise<number> {
  let row = startRow + 2;

  // Imagen de firma (si existe) - centrada sobre la sección de firma (columnas A-C)
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    await addImageToExcel(workbook, worksheet, firmaPath, { col: 1.2, row: row - 1 }, { width: 100, height: 50 });
    row += 3;
  }

  // Cuño (si existe) - al lado de la firma
  const cunoPath = getImagePath(empresa.cunoEmpresa);
  if (cunoPath) {
    await addImageToExcel(workbook, worksheet, cunoPath, { col: 3, row: startRow + 1 }, { width: 70, height: 70 });
  }

  // Línea y texto de firma
  worksheet.mergeCells(`A${row}:C${row}`);
  worksheet.getCell(`A${row}`).value = '________________________________';
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row++;

  worksheet.mergeCells(`A${row}:C${row}`);
  worksheet.getCell(`A${row}`).value = empresa.representante;
  worksheet.getCell(`A${row}`).font = { bold: true };
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row++;

  worksheet.mergeCells(`A${row}:C${row}`);
  worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row++;

  worksheet.mergeCells(`A${row}:C${row}`);
  worksheet.getCell(`A${row}`).value = empresa.nombre;
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };

  return row;
}

// ==========================================
// TIPO 1: OFERTA GENERAL (Price List)
// NO muestra: Oferta No, Fecha, Consignado A, Dirección, NIT, Puerto, Origen, Moneda
// SÍ muestra: Header, Tabla, "TOTAL CIF:", Términos, Firma
// ==========================================

export const ExportController = {
  async ofertaGeneralPdf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaGeneral.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_general_${oferta.numero || 'sin-numero'}.pdf"`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // HEADER COMÚN (empresa primero, luego título)
    const afterHeaderY = await renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY;

    // TABLA DE ITEMS (centrada, con total incluido)
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false, true, 'TOTAL CIF', unidadAbrevMap);
    doc.y = yPos + 15;

    // TÉRMINOS
    renderPdfTerminos(doc, margin);

    // FIRMA
    await renderPdfFirma(doc, empresa, margin);

    doc.end();
  },

  async ofertaGeneralExcel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaGeneral.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Oferta General');

    // Primero, calcular columnas para saber lastCol
    const { headers } = buildDynamicColumns(oferta.items);
    const lastColIndex = headers.length;
    const lastCol = lastColIndex <= 26 
      ? String.fromCharCode(64 + lastColIndex) 
      : 'A' + String.fromCharCode(64 + lastColIndex - 26);

    // HEADER (empresa + título)
    let row = await renderExcelHeader(worksheet, workbook, empresa, lastCol);

    // TABLA DE ITEMS
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false, unidadAbrevMap);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // TÉRMINOS
    row = renderExcelTerminos(worksheet, row, lastCol);

    // FIRMA
    await renderExcelFirma(worksheet, workbook, empresa, row);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_general_${oferta.numero || 'sin-numero'}.xlsx"`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // TIPO 2: OFERTA CLIENTE
  // Muestra: OFERTA NO, Fecha, CONSIGNADO A, Dirección, NIT, ANEXO-1
  //          Tabla, TOTAL CIF, Términos+Puerto+Origen+Moneda, Firma
  // ==========================================

  async ofertaClientePdf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaCliente.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_cliente_${oferta.numero}.pdf"`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // HEADER COMÚN
    const afterHeaderY = await renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY + 10;

    // INFO DE OFERTA Y CLIENTE
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`OFERTA  NO: ${oferta.numero}`, margin, doc.y);
    doc.font('Helvetica').fontSize(10);
    doc.text(formatDate(new Date(oferta.fecha)));
    doc.moveDown(0.3);
    doc.text(`CONSIGNADO A : ${oferta.cliente.nombreCompania || oferta.cliente.nombre}`);
    doc.text(oferta.cliente.direccion || '');
    doc.text(`NIT ${oferta.cliente.nit || ''}`);
    doc.moveDown(0.5);

    // ANEXO-1 centrado
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('ANEXO-1', { align: 'center' });
    doc.moveDown(0.5);

    // TABLA DE ITEMS (centrada, con total incluido)
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false, true, 'TOTAL CIF', unidadAbrevMap);
    doc.y = yPos + 15;

    // Bloque en DOS COLUMNAS: Términos (izquierda 60%) y Método de pago (derecha 40%)
    const leftWidth = contentWidth * 0.6;
    const rightWidth = contentWidth - leftWidth;
    const leftX = margin;
    const rightX = margin + leftWidth + 10; // pequeño espacio entre columnas
    const topY = doc.y;

    // Columna izquierda: TÉRMINOS Y CONDICIONES
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TÉRMINOS Y CONDICIONES', leftX, topY, { width: leftWidth, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5);

    const puertoDestino = 'Mariel, Cuba.';
    // Oferta a cliente: no mostrar valor por defecto; dejar en blanco si está vacío o es "NEW ORLEANS, LA"
    const rawPuerto = (oferta.puertoEmbarque ?? '').trim();
    const puertoEmbarque = rawPuerto && rawPuerto.toUpperCase() !== 'NEW ORLEANS, LA' ? rawPuerto : '';
    const origen = oferta.origen || 'Estados Unidos.';
    const terminosPago = oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const moneda = oferta.moneda || 'USD';

    const terminosDoc = (oferta as any).terminosDocumentoTexto?.trim();

    let leftBottomY = doc.y;
    if (terminosDoc && terminosDoc.length > 0) {
      const lineas = terminosDoc.split(/\r?\n/);
      for (const linea of lineas) {
        doc.text(linea, { width: leftWidth, align: 'left' });
        doc.moveDown(0.2);
        leftBottomY = doc.y;
      }
    } else {
      const terminosParrafos = [
        `Validez de la Oferta: 15 días.`,
        `Puerto Destino: ${puertoDestino}`,
        `Puerto de Embarque: ${puertoEmbarque}`,
        `Origen: ${origen}`,
        `Términos de Entrega: Máximo 15 días posteriores al pago.`,
        `Pago: 100% del valor a la firma del contrato.`,
        `Moneda: Dólar Americano (${moneda}).`,
        `Métodos de Pago: Transferencia bancaria o cheques del banco pagador.`,
        `ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.`,
        `El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.`,
        // Dejamos el término original al final, por si quieres conservarlo
        `Condición de pago original: ${terminosPago}`,
      ];

      for (const p of terminosParrafos) {
        doc.text(p, { width: leftWidth, align: 'left' });
        doc.moveDown(0.2);
        leftBottomY = doc.y;
      }
    }

    // Columna derecha: MÉTODO DE PAGO
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('MÉTODO DE PAGO', rightX, topY, { width: rightWidth, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5);

    const metodoPagoDoc = (oferta as any).metodoPagoDocumentoTexto?.trim();

    let rightBottomY = doc.y;
    if (metodoPagoDoc && metodoPagoDoc.length > 0) {
      const lineasMetodo = metodoPagoDoc.split(/\r?\n/);
      for (const linea of lineasMetodo) {
        doc.text(linea, { width: rightWidth, align: 'left' });
        doc.moveDown(0.2);
        rightBottomY = doc.y;
      }
    } else {
      const metodoPagoParrafos = [
        `Banco: Truist Bank`,
        `Titular: ZAS BY JMC CORP`,
        `Número de Cuenta: 1100035647757`,
        `Número de Ruta (transferencias dentro de USA): 263191387`,
        `Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166`,
      ];

      for (const p of metodoPagoParrafos) {
        doc.text(p, { width: rightWidth, align: 'left' });
        doc.moveDown(0.2);
        rightBottomY = doc.y;
      }
    }

    // Continuar debajo de la columna más larga
    doc.y = Math.max(leftBottomY, rightBottomY) + 18;

    // FIRMAS Y CUÑO - misma página
    doc.moveDown(2);
    const firmaStartY = doc.y;
    const firmaWidth = 180;
    const firmaClienteX = pageWidth - margin - firmaWidth;

    // Imagen de firma empresa (si existe)
    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      await addImageToPdf(doc, firmaPath, margin + 40, firmaStartY, { width: 100, height: 45 });
    }

    // Cuño (si existe) - al lado de la firma empresa
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      await addImageToPdf(doc, cunoPath, margin + firmaWidth + 20, firmaStartY + 10, { width: 70, height: 70 });
    }

    // Líneas de firma
    const firmaLineY = firmaStartY + 50;
    doc.moveTo(margin, firmaLineY).lineTo(margin + firmaWidth, firmaLineY).stroke();
    
    if (oferta.incluyeFirmaCliente) {
      doc.moveTo(firmaClienteX, firmaLineY).lineTo(firmaClienteX + firmaWidth, firmaLineY).stroke();
    }
    
    // Texto firma empresa
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(empresa.representante, margin, firmaLineY + 5, { width: firmaWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    doc.text(empresa.cargoRepresentante, margin, firmaLineY + 18, { width: firmaWidth, align: 'center' });
    doc.text(empresa.nombre, margin, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    
    // Texto firma cliente (si está configurado)
    if (oferta.incluyeFirmaCliente) {
      const nombreCompleto = `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos || ''}`.trim();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(nombreCompleto, firmaClienteX, firmaLineY + 5, { width: firmaWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9);
      doc.text('DIRECTOR', firmaClienteX, firmaLineY + 18, { width: firmaWidth, align: 'center' });
      doc.text(oferta.cliente.nombreCompania || '', firmaClienteX, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    }

    doc.end();
  },

  async ofertaClienteExcel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaCliente.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Oferta');

    // Calcular columnas dinámicas primero
    const { headers } = buildDynamicColumns(oferta.items);
    const lastColIndex = headers.length;
    const lastCol = lastColIndex <= 26 
      ? String.fromCharCode(64 + lastColIndex) 
      : 'A' + String.fromCharCode(64 + lastColIndex - 26);

    let row = 1;

    // LOGO (si existe)
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: 0 }, { width: 70, height: 50 });
    }

    // Empresa (nombre, dirección, contacto) - primero
    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = empresa.nombre;
    worksheet.getCell(`B${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    worksheet.getRow(row).height = 18;
    row++;

    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = empresa.direccion;
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = `${empresa.telefono}, ${empresa.email}`;
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    row++;

    row++; // Espacio

    // Título "OFERTA DE VENTAS"
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = 'OFERTA DE VENTAS';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 16 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 25;
    row++;

    row++; // Espacio

    // INFO DE OFERTA Y CLIENTE
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `OFERTA  NO: ${oferta.numero}`;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = formatDate(new Date(oferta.fecha));
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `CONSIGNADO A : ${oferta.cliente.nombreCompania || oferta.cliente.nombre}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = oferta.cliente.direccion || '';
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `NIT ${oferta.cliente.nit || ''}`;
    row++;

    row++;

    // ANEXO-1 centrado
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = 'ANEXO-1';
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    row++; // Espacio antes de la tabla

    // TABLA DE ITEMS
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false, unidadAbrevMap);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // Bloque en DOS COLUMNAS: Términos (izquierda ~60%) y Método de pago (derecha ~40%)
    const leftLastColIndex = Math.max(1, Math.floor(lastColIndex * 0.6));
    const rightFirstColIndex = Math.min(lastColIndex, leftLastColIndex + 1);

    const getColLetter = (index: number): string => {
      if (index <= 26) {
        return String.fromCharCode(64 + index);
      }
      const first = String.fromCharCode(64 + Math.floor((index - 1) / 26));
      const second = String.fromCharCode(65 + ((index - 1) % 26));
      return `${first}${second}`;
    };

    const leftLastCol = getColLetter(leftLastColIndex);
    const rightFirstCol = getColLetter(rightFirstColIndex);

    const puertoDestino = 'Mariel, Cuba.';
    // Oferta a cliente: no mostrar valor por defecto; dejar en blanco si está vacío o es "NEW ORLEANS, LA"
    const rawPuertoExcel = (oferta.puertoEmbarque ?? '').trim();
    const puertoEmbarqueExcel =
      rawPuertoExcel && rawPuertoExcel.toUpperCase() !== 'NEW ORLEANS, LA'
        ? rawPuertoExcel
        : '';
    const origen = oferta.origen || 'Estados Unidos.';
    const terminosPago = oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const moneda = oferta.moneda || 'USD';

    const terminosDocExcel = (oferta as any).terminosDocumentoTexto?.trim();
    const metodoPagoDocExcel = (oferta as any).metodoPagoDocumentoTexto?.trim();

    const terminosTexto = terminosDocExcel && terminosDocExcel.length > 0
      ? ['TÉRMINOS Y CONDICIONES', '', terminosDocExcel].join('\n')
      : [
          'TÉRMINOS Y CONDICIONES',
          '',
          'Validez de la Oferta: 15 días.',
          `Puerto Destino: ${puertoDestino}`,
          puertoEmbarqueExcel ? `Puerto de Embarque: ${puertoEmbarqueExcel}` : 'Puerto de Embarque:',
          `Origen: ${origen}`,
          'Términos de Entrega: Máximo 15 días posteriores al pago.',
          'Pago: 100% del valor a la firma del contrato.',
          `Moneda: Dólar Americano (${moneda}).`,
          'Métodos de Pago: Transferencia bancaria o cheques del banco pagador.',
          'ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.',
          'El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.',
          `Condición de pago original: ${terminosPago}`,
        ].join('\n');

    const metodoPagoTexto = metodoPagoDocExcel && metodoPagoDocExcel.length > 0
      ? ['MÉTODO DE PAGO', '', metodoPagoDocExcel].join('\n')
      : [
          'MÉTODO DE PAGO',
          '',
          'Banco: Truist Bank',
          'Titular: ZAS BY JMC CORP',
          'Número de Cuenta: 1100035647757',
          'Número de Ruta (transferencias dentro de USA): 263191387',
          'Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166',
        ].join('\n');

    // Columna izquierda: términos
    worksheet.mergeCells(`A${row}:${leftLastCol}${row + 6}`);
    const leftCell = worksheet.getCell(`A${row}`);
    leftCell.value = terminosTexto;
    leftCell.alignment = { vertical: 'top', wrapText: true };

    // Columna derecha: método de pago
    worksheet.mergeCells(`${rightFirstCol}${row}:${lastCol}${row + 6}`);
    const rightCell = worksheet.getCell(`${rightFirstCol}${row}`);
    rightCell.value = metodoPagoTexto;
    rightCell.alignment = { vertical: 'top', wrapText: true };

    row = row + 7; // Continuar después del bloque

    // FIRMAS Y CUÑO - Empresa a la izquierda, Cliente a la derecha (en la misma fila)
    row += 2; // Espacio para separar del bloque de términos
    const firmaStartRow = row + 2;

    row = firmaStartRow + 3;

    // Líneas y texto de firma empresa (columnas A-B)
    worksheet.getCell(`A${row}`).value = '________________________________';
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    // Firma cliente en la misma fila (columnas E-F)
    if (oferta.incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = '________________________________';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.representante;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (oferta.incluyeFirmaCliente) {
      const nombreCompleto = `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos || ''}`.trim();
      worksheet.getCell(`E${row}`).value = nombreCompleto;
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).font = { bold: true };
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (oferta.incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = 'DIRECTOR';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (oferta.incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = oferta.cliente.nombreCompania || '';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_cliente_${oferta.numero}.xlsx"`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // TIPO 3: OFERTA IMPORTADORA
  // Misma cabecera que CLIENTE + ANEXO-1
  // Totales: TOTAL FOB, FLETE, SEGURO, TOTAL CIF
  // Términos + Puerto + Origen + Moneda, Firma
  // ==========================================

  async ofertaImportadoraPdf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_importadora_${oferta.numero}.pdf"`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // HEADER COMÚN
    const afterHeaderY = await renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY + 10;

    // INFO DE OFERTA Y CLIENTE (igual que CLIENTE)
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`OFERTA  NO: ${oferta.numero}`, margin, doc.y);
    doc.font('Helvetica').fontSize(10);
    doc.text(formatDate(new Date(oferta.fecha)));
    doc.moveDown(0.3);
    doc.text(`CONSIGNADO A : ${oferta.cliente.nombreCompania || oferta.cliente.nombre}`);
    doc.text(oferta.cliente.direccion || '');
    doc.text(`NIT ${oferta.cliente.nit || ''}`);
    doc.moveDown(0.5);

    // ANEXO-1 centrado
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('ANEXO-1', { align: 'center' });
    doc.moveDown(0.5);

    // TABLA DE ITEMS (centrada, usa precioAjustado)
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { yPos, totalImporte, tableLeft, tableWidth, lastColWidth } = renderPdfTable(doc, oferta.items, margin, true, false, 'TOTAL CIF', unidadAbrevMap);
    doc.y = yPos + 5;

    // TOTALES: FOB, FLETE, (SEGURO si aplica), CIF (alineados con la tabla)
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`TOTAL FOB: $${formatCurrency(totalImporte)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`FLETE: $${formatCurrency(oferta.flete || 0)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    
    if (oferta.tieneSeguro) {
      doc.moveDown(0.3);
      doc.text(`SEGURO: $${formatCurrency(seguro)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    }
    
    doc.moveDown(0.3);
    doc.text(`TOTAL CIF: $${formatCurrency(totalCIF)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    
    doc.moveDown(1.5);

    // Bloque en DOS COLUMNAS: Términos (izquierda 60%) y Método de pago (derecha 40%)
    const leftWidthImp = contentWidth * 0.6;
    const rightWidthImp = contentWidth - leftWidthImp;
    const leftXImp = margin;
    const rightXImp = margin + leftWidthImp + 10; // pequeño espacio entre columnas
    const topYImp = doc.y;

    // Columna izquierda: TÉRMINOS Y CONDICIONES
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TÉRMINOS Y CONDICIONES', leftXImp, topYImp, { width: leftWidthImp, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5);

    const puertoDestinoImp = 'Mariel, Cuba.';
    // No usar valor por defecto fijo; si está vacío o es "NEW ORLEANS, LA" lo dejamos en blanco
    const rawPuertoImp = (oferta.puertoEmbarque ?? '').trim();
    const puertoEmbarqueImp =
      rawPuertoImp && rawPuertoImp.toUpperCase() !== 'NEW ORLEANS, LA' ? rawPuertoImp : '';
    const origenImp = oferta.origen || 'Estados Unidos.';
    const terminosPagoImp = oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const monedaImp = oferta.moneda || 'USD';

    const terminosImpDoc = (oferta as any).terminosDocumentoTexto?.trim();

    let leftBottomYImp = doc.y;
    if (terminosImpDoc && terminosImpDoc.length > 0) {
      const lineasImp = terminosImpDoc.split(/\r?\n/);
      for (const linea of lineasImp) {
        doc.text(linea, { width: leftWidthImp, align: 'left' });
        doc.moveDown(0.2);
        leftBottomYImp = doc.y;
      }
    } else {
      const terminosParrafosImp = [
        `Validez de la Oferta: 15 días.`,
        `Puerto Destino: ${puertoDestinoImp}`,
        `Puerto de Embarque: ${puertoEmbarqueImp}`,
        `Origen: ${origenImp}`,
        `Términos de Entrega: Máximo 15 días posteriores al pago.`,
        `Pago: 100% del valor a la firma del contrato.`,
        `Moneda: Dólar Americano (${monedaImp}).`,
        `Métodos de Pago: Transferencia bancaria o cheques del banco pagador.`,
        `ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.`,
        `El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.`,
        `Condición de pago original: ${terminosPagoImp}`,
      ];

      for (const p of terminosParrafosImp) {
        doc.text(p, { width: leftWidthImp, align: 'left' });
        doc.moveDown(0.2);
        leftBottomYImp = doc.y;
      }
    }

    // Columna derecha: MÉTODO DE PAGO
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('MÉTODO DE PAGO', rightXImp, topYImp, { width: rightWidthImp, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5);

    const metodoPagoImpDoc = (oferta as any).metodoPagoDocumentoTexto?.trim();

    let rightBottomYImp = doc.y;
    if (metodoPagoImpDoc && metodoPagoImpDoc.length > 0) {
      const lineasMetodoImp = metodoPagoImpDoc.split(/\r?\n/);
      for (const linea of lineasMetodoImp) {
        doc.text(linea, { width: rightWidthImp, align: 'left' });
        doc.moveDown(0.2);
        rightBottomYImp = doc.y;
      }
    } else {
      const metodoPagoParrafosImp = [
        `Banco: Truist Bank`,
        `Titular: ZAS BY JMC CORP`,
        `Número de Cuenta: 1100035647757`,
        `Número de Ruta (transferencias dentro de USA): 263191387`,
        `Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166`,
      ];

      for (const p of metodoPagoParrafosImp) {
        doc.text(p, { width: rightWidthImp, align: 'left' });
        doc.moveDown(0.2);
        rightBottomYImp = doc.y;
      }
    }

    // Continuar debajo de la columna más larga
    doc.y = Math.max(leftBottomYImp, rightBottomYImp) + 18;

    // FIRMAS
    doc.moveDown(2);
    
    const firmaStartY = doc.y;
    const firmaWidth = 180;
    const incluyeFirmaCliente = oferta.incluyeFirmaCliente !== false; // Por defecto true para importadora
    const firmaClienteX = pageWidth - margin - firmaWidth;

    // Imagen de firma empresa (si existe)
    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      await addImageToPdf(doc, firmaPath, margin + 40, firmaStartY, { width: 100, height: 45 });
    }

    // Cuño (si existe) - entre las dos firmas o al lado si no hay firma cliente
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      await addImageToPdf(doc, cunoPath, margin + firmaWidth + 20, firmaStartY + 10, { width: 70, height: 70 });
    }

    // Líneas de firma
    const firmaLineY = firmaStartY + 50;
    doc.moveTo(margin, firmaLineY).lineTo(margin + firmaWidth, firmaLineY).stroke();
    
    if (incluyeFirmaCliente) {
      doc.moveTo(firmaClienteX, firmaLineY).lineTo(firmaClienteX + firmaWidth, firmaLineY).stroke();
    }
    
    // Texto firma empresa
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(empresa.representante, margin, firmaLineY + 5, { width: firmaWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    doc.text(empresa.cargoRepresentante, margin, firmaLineY + 18, { width: firmaWidth, align: 'center' });
    doc.text(empresa.nombre, margin, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    
    // Texto firma cliente (si está configurado)
    if (incluyeFirmaCliente) {
      const nombreCompleto = `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos || ''}`.trim();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(nombreCompleto, firmaClienteX, firmaLineY + 5, { width: firmaWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9);
      doc.text('DIRECTOR', firmaClienteX, firmaLineY + 18, { width: firmaWidth, align: 'center' });
      doc.text(oferta.cliente.nombreCompania || '', firmaClienteX, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    }

    doc.end();
  },

  async ofertaImportadoraExcel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    const empresa = await getEmpresaInfo();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Oferta');

    // Primero renderizar tabla para obtener lastCol dinámico
    const tableStartRow = 14;
    const unidadAbrevMap = await buildUnidadAbrevMapFromItems(oferta.items);
    const { endRow, totalImporte, lastCol } = renderExcelTable(worksheet, oferta.items, tableStartRow, true, unidadAbrevMap);

    // Llenar header con lastCol correcto
    let row = 1;

    // Logo (si existe)
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 70, height: 50 });
    }

    // EMPRESA PRIMERO
    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = empresa.nombre;
    worksheet.getCell(`B${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    worksheet.getRow(row).height = 18;
    row++;

    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = empresa.direccion;
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    worksheet.getCell(`B${row}`).value = `${empresa.telefono}, ${empresa.email}`;
    worksheet.getCell(`B${row}`).alignment = { horizontal: 'center' };
    row++;

    row++; // Espacio

    // TÍTULO DESPUÉS
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = 'OFERTA DE VENTAS';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 16 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(row).height = 25;
    row++;

    row++;

    // INFO DE OFERTA Y CLIENTE
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `OFERTA  NO: ${oferta.numero}`;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = formatDate(new Date(oferta.fecha));
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `CONSIGNADO A : ${oferta.cliente.nombreCompania || oferta.cliente.nombre}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = oferta.cliente.direccion || '';
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `NIT ${oferta.cliente.nit || ''}`;
    row++;

    row++;

    // ANEXO-1 centrado
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = 'ANEXO-1';
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    // La tabla ya está renderizada
    row = endRow + 1;

    // TOTALES - usar penúltima y última columna
    const prevCol = String.fromCharCode(lastCol.charCodeAt(0) - 1);
    
    worksheet.getCell(`${prevCol}${row}`).value = 'TOTAL FOB:';
    worksheet.getCell(`${prevCol}${row}`).font = { bold: true };
    worksheet.getCell(`${prevCol}${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`${lastCol}${row}`).value = totalImporte;
    worksheet.getCell(`${lastCol}${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`${lastCol}${row}`).font = { bold: true };
    row++;

    worksheet.getCell(`${prevCol}${row}`).value = 'FLETE:';
    worksheet.getCell(`${prevCol}${row}`).font = { bold: true };
    worksheet.getCell(`${prevCol}${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`${lastCol}${row}`).value = oferta.flete || 0;
    worksheet.getCell(`${lastCol}${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`${lastCol}${row}`).font = { bold: true };
    row++;

    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    if (oferta.tieneSeguro) {
      worksheet.getCell(`${prevCol}${row}`).value = 'SEGURO:';
      worksheet.getCell(`${prevCol}${row}`).font = { bold: true };
      worksheet.getCell(`${prevCol}${row}`).alignment = { horizontal: 'right' };
      worksheet.getCell(`${lastCol}${row}`).value = seguro;
      worksheet.getCell(`${lastCol}${row}`).numFmt = '"$"#,##0.00';
      worksheet.getCell(`${lastCol}${row}`).font = { bold: true };
      row++;
    }

    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    worksheet.getCell(`${prevCol}${row}`).value = 'TOTAL CIF:';
    worksheet.getCell(`${prevCol}${row}`).font = { bold: true };
    worksheet.getCell(`${prevCol}${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`${lastCol}${row}`).value = totalCIF;
    worksheet.getCell(`${lastCol}${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`${lastCol}${row}`).font = { bold: true };
    row += 2;

    // Bloque en DOS COLUMNAS: Términos (izquierda ~60%) y Método de pago (derecha ~40%)
    const lastColIndexImp = lastCol.charCodeAt(0) - 64; // A=1, B=2, ...
    const leftLastColIndexImp = Math.max(1, Math.floor(lastColIndexImp * 0.6));
    const rightFirstColIndexImp = Math.min(lastColIndexImp, leftLastColIndexImp + 1);

    const getColLetterImp = (index: number): string => {
      return String.fromCharCode(64 + index);
    };

    const leftLastColImp = getColLetterImp(leftLastColIndexImp);
    const rightFirstColImp = getColLetterImp(rightFirstColIndexImp);

    const puertoDestinoImpX = 'Mariel, Cuba.';
    const rawPuertoExcelImp = (oferta.puertoEmbarque ?? '').trim();
    const puertoEmbarqueExcelImp =
      rawPuertoExcelImp && rawPuertoExcelImp.toUpperCase() !== 'NEW ORLEANS, LA'
        ? rawPuertoExcelImp
        : '';
    const origenImpX = oferta.origen || 'Estados Unidos.';
    const terminosPagoImpX = oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const monedaImpX = oferta.moneda || 'USD';

    const terminosImpDocExcel = (oferta as any).terminosDocumentoTexto?.trim();
    const metodoPagoImpDocExcel = (oferta as any).metodoPagoDocumentoTexto?.trim();

    const terminosTextoImp =
      terminosImpDocExcel && terminosImpDocExcel.length > 0
        ? ['TÉRMINOS Y CONDICIONES', '', terminosImpDocExcel].join('\n')
        : [
            'TÉRMINOS Y CONDICIONES',
            '',
            'Validez de la Oferta: 15 días.',
            `Puerto Destino: ${puertoDestinoImpX}`,
            puertoEmbarqueExcelImp ? `Puerto de Embarque: ${puertoEmbarqueExcelImp}` : 'Puerto de Embarque:',
            `Origen: ${origenImpX}`,
            'Términos de Entrega: Máximo 15 días posteriores al pago.',
            'Pago: 100% del valor a la firma del contrato.',
            `Moneda: Dólar Americano (${monedaImpX}).`,
            'Métodos de Pago: Transferencia bancaria o cheques del banco pagador.',
            'ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.',
            'El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.',
            `Condición de pago original: ${terminosPagoImpX}`,
          ].join('\n');

    const metodoPagoTextoImp =
      metodoPagoImpDocExcel && metodoPagoImpDocExcel.length > 0
        ? ['MÉTODO DE PAGO', '', metodoPagoImpDocExcel].join('\n')
        : [
            'MÉTODO DE PAGO',
            '',
            'Banco: Truist Bank',
            'Titular: ZAS BY JMC CORP',
            'Número de Cuenta: 1100035647757',
            'Número de Ruta (transferencias dentro de USA): 263191387',
            'Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166',
          ].join('\n');

    // Columna izquierda: términos
    worksheet.mergeCells(`A${row}:${leftLastColImp}${row + 6}`);
    const leftCellImp = worksheet.getCell(`A${row}`);
    leftCellImp.value = terminosTextoImp;
    leftCellImp.alignment = { vertical: 'top', wrapText: true };

    // Columna derecha: método de pago
    worksheet.mergeCells(`${rightFirstColImp}${row}:${lastCol}${row + 6}`);
    const rightCellImp = worksheet.getCell(`${rightFirstColImp}${row}`);
    rightCellImp.value = metodoPagoTextoImp;
    rightCellImp.alignment = { vertical: 'top', wrapText: true };

    row = row + 7; // Continuar después del bloque

    // Firmas
    const firmaStartRow = row + 2;
    const incluyeFirmaCliente = oferta.incluyeFirmaCliente !== false;

    row = firmaStartRow + 3;

    worksheet.getCell(`A${row}`).value = '________________________________';
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
      const lastColNum = lastCol.charCodeAt(0) - 64;
      const firmaClienteCol = String.fromCharCode(64 + lastColNum - 1);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = '________________________________';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.representante;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
      const lastColNum = lastCol.charCodeAt(0) - 64;
      const firmaClienteCol = String.fromCharCode(64 + lastColNum - 1);
      const nombreCompleto = `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos || ''}`.trim();
      worksheet.getCell(`${firmaClienteCol}${row}`).value = nombreCompleto;
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).font = { bold: true };
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
      const lastColNum = lastCol.charCodeAt(0) - 64;
      const firmaClienteCol = String.fromCharCode(64 + lastColNum - 1);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = 'DIRECTOR';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
      const lastColNum = lastCol.charCodeAt(0) - 64;
      const firmaClienteCol = String.fromCharCode(64 + lastColNum - 1);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = oferta.cliente.nombreCompania || '';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="oferta_importadora_${oferta.numero}.xlsx"`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // FACTURAS (FACTURA - PACKING LIST)
  // ==========================================
  async facturaPdf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!factura) {
      res.status(404).json({ error: 'Factura no encontrada' });
      return;
    }

    const facturaUnidadAbrevMap = await buildUnidadAbrevMapFromItems(factura.items);

    // Obtener número de oferta cliente si existe
    let numeroOfertaCliente = factura.numero;
    if (factura.tipoOfertaOrigen === 'cliente' && factura.ofertaOrigenId) {
      const ofertaCliente = await prisma.ofertaCliente.findUnique({
        where: { id: factura.ofertaOrigenId },
        select: { numero: true },
      });
      if (ofertaCliente) {
        numeroOfertaCliente = ofertaCliente.numero;
      }
    }

    const empresa = await getEmpresaInfo();
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Factura_${factura.numero}.pdf"`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Mismo orden que oferta a cliente: logo + datos empresa, luego título del documento
    const tituloNumero = (numeroOfertaCliente || '').replace(/^FAC-/i, '');
    const headerY = doc.y;

    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToPdf(doc, logoPath, margin, headerY, { width: 70 });
    }

    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(empresa.nombre, margin, headerY, { width: contentWidth, align: 'center' });

    doc.fontSize(10).font('Helvetica');
    doc.text(empresa.direccion, margin, headerY + 18, { width: contentWidth, align: 'center' });
    doc.text(`${empresa.telefono}, ${empresa.email}`, margin, headerY + 32, { width: contentWidth, align: 'center' });

    doc.y = headerY + 55;
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text(`FACTURA- PACKING LIST ${tituloNumero}`, { align: 'center' });
    doc.moveDown(0.8);

    // CODIGO MINCEX Y FECHA (sin borde)
    const codigoMincex = (factura as any).codigoMincex || empresa.codigoMincex;
    doc.fontSize(10).font('Helvetica');
    doc.text(`CODIGO MINCEX: ${codigoMincex}`, margin, doc.y);
    // NRO CONTRATO (solo si tiene valor)
    if ((factura as any).nroContrato && (factura as any).nroContrato.trim() !== '') {
      doc.text(`NRO CONTRATO: ${(factura as any).nroContrato}`, margin, doc.y);
    }
    doc.text(`FECHA: ${formatDate(new Date(factura.fecha))}`, margin, doc.y);

    // CONSIGNADO A
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold');
    doc.text(`CONSIGNADO A: ${factura.cliente.nombreCompania || factura.cliente.nombre}`);
    doc.font('Helvetica');
    doc.text(`NIT ${factura.cliente.nit || ''}`);
    doc.text(factura.cliente.direccion || '');
    doc.moveDown(0.5);

    // TABLA DE ITEMS
    const tableTop = doc.y;
    const unidadMedida = getItemUnidadAbrev(factura.items[0], facturaUnidadAbrevMap) || 'KG';
    
    // Headers de tabla para factura (con PESO NETO y PESO BRUTO)
    const facturaHeaders = ['PRODUCTO', 'UM'];
    
    // Detectar campos opcionales fijos y dinámicos
    const optionalFields = detectOptionalFields(factura.items);
    const dynamicLabels = getDynamicOptionalLabels(factura.items);
    
    // Contar columnas opcionales (fijas + dinámicas) para ajustar ancho de descripción
    let numOptionalCols = 0;
    if (optionalFields.codigoArancelario) numOptionalCols++;
    if (optionalFields.cantidadSacos) numOptionalCols++;
    if (optionalFields.pesoXSaco) numOptionalCols++;
    if (optionalFields.precioXSaco) numOptionalCols++;
    if (optionalFields.cantidadCajas) numOptionalCols++;
    if (optionalFields.pesoXCaja) numOptionalCols++;
    if (optionalFields.precioXCaja) numOptionalCols++;
    const numOptionalTotal = numOptionalCols + dynamicLabels.length;
    
    // Ajustar ancho de PRODUCTO según columnas opcionales totales
    const descWidthPdf = numOptionalTotal >= 6 ? 90 : numOptionalTotal >= 4 ? 120 : numOptionalTotal >= 2 ? 150 : 190;
    const facturaWidths = [descWidthPdf, 30];
    
    // Campos opcionales dinámicos (por label) después de UM — sin truncar título
    for (const label of dynamicLabels) {
      const trimmed = label.trim();
      facturaHeaders.push(trimmed ? trimmed.toUpperCase() : '');
      facturaWidths.push(68);
    }

    if (optionalFields.codigoArancelario) {
      facturaHeaders.push('PARTIDA\nARANCEL');
      facturaWidths.push(55);
    }

    if (optionalFields.cantidadSacos) {
      facturaHeaders.push('CANT.\nSACOS');
      facturaWidths.push(40);
    }
    if (optionalFields.pesoXSaco) {
      facturaHeaders.push('PESO\nX SACO');
      facturaWidths.push(40);
    }
    if (optionalFields.precioXSaco) {
      facturaHeaders.push('PRECIO\nX SACO');
      facturaWidths.push(45);
    }
    if (optionalFields.cantidadCajas) {
      facturaHeaders.push('CANT.\nCAJAS');
      facturaWidths.push(40);
    }
    if (optionalFields.pesoXCaja) {
      facturaHeaders.push('PESO\nX CAJA');
      facturaWidths.push(40);
    }
    if (optionalFields.precioXCaja) {
      facturaHeaders.push('PRECIO\nX CAJA');
      facturaWidths.push(45);
    }
    
    // Columnas finales fijas
    facturaHeaders.push(`CANT.\n${unidadMedida}`, 'PESO\nNETO', 'PESO\nBRUTO', `PRECIO\n/${unidadMedida}`, 'IMPORTE');
    facturaWidths.push(45, 45, 45, 50, 60);

    const maxFacturaTableW = 532;
    const totalFacturaW = facturaWidths.reduce((a, b) => a + b, 0);
    const nDynFac = dynamicLabels.length;
    const nColsFac = facturaWidths.length;
    const idxLast5Fac = nColsFac - 5;
    if (totalFacturaW > maxFacturaTableW) {
      const minWF = (i: number): number => {
        if (i === 0) return 76;
        if (i === 1) return 26;
        if (i >= 2 && i < 2 + nDynFac) return 48;
        if (i >= idxLast5Fac) {
          const k = i - idxLast5Fac;
          return [40, 40, 40, 44, 52][k];
        }
        return 32;
      };
      const scaleF = maxFacturaTableW / totalFacturaW;
      for (let i = 0; i < facturaWidths.length; i++) {
        facturaWidths[i] = Math.max(minWF(i), Math.round(facturaWidths[i] * scaleF));
      }
      let sumWF = facturaWidths.reduce((a, b) => a + b, 0);
      while (sumWF > maxFacturaTableW) {
        let progressed = false;
        for (let i = facturaWidths.length - 1; i >= 0; i--) {
          if (facturaWidths[i] > minWF(i)) {
            facturaWidths[i]--;
            sumWF--;
            progressed = true;
            if (sumWF <= maxFacturaTableW) break;
          }
        }
        if (!progressed) break;
      }
    }
    
    const tableWidth = facturaWidths.reduce((a, b) => a + b, 0);
    const tableLeft = margin;

    doc.font('Helvetica-Bold').fontSize(7);
    let facturaHeaderH = 0;
    facturaHeaders.forEach((header, i) => {
      const w = Math.max(1, facturaWidths[i] - 4);
      const h = doc.heightOfString(header, { width: w, lineGap: 1, align: 'center' });
      facturaHeaderH = Math.max(facturaHeaderH, h);
    });
    const HEADER_HEIGHT = Math.max(30, Math.ceil(facturaHeaderH) + 10);
    
    // Fondo gris para encabezados
    doc.rect(tableLeft, tableTop, tableWidth, HEADER_HEIGHT).fill('#e8e8e8');
    doc.fillColor('#000');
    
    let xPos = tableLeft;
    const headerTextY = tableTop + 5;
    
    facturaHeaders.forEach((header, i) => {
      doc.text(header, xPos + 2, headerTextY, { width: facturaWidths[i] - 4, align: 'center', lineGap: 1 });
      xPos += facturaWidths[i];
    });
    
    doc.moveTo(tableLeft, tableTop + HEADER_HEIGHT).lineTo(tableLeft + tableWidth, tableTop + HEADER_HEIGHT).stroke();
    
    // Items
    doc.font('Helvetica').fontSize(8);
    const facLineGap = 1;
    const facVPad = 4;
    const facMinRow = 15;
    let yPos = tableTop + HEADER_HEIGHT + 6;
    let totalImporte = 0;
    let totalPesoNeto = 0;
    let totalPesoBruto = 0;

    for (const item of factura.items) {
      const pesoNeto = (item as any).pesoNeto || item.cantidad;
      const pesoBruto = (item as any).pesoBruto || pesoNeto;
      const importe = item.subtotal;
      totalImporte += importe;
      totalPesoNeto += pesoNeto;
      totalPesoBruto += pesoBruto;

      const itemNombreFactPdf = (item as any).producto?.nombre ?? (item as any).nombreProducto ?? '';
      const descInner = Math.max(1, facturaWidths[0] - 4);
      let rowHeight = Math.max(
        facMinRow,
        doc.heightOfString(itemNombreFactPdf, { width: descInner, lineGap: facLineGap }) + facVPad
      );

      let measureIdx = 2;
      if (dynamicLabels.length > 0) {
        const camposM = getCamposOpcionalesArray(item);
        for (const label of dynamicLabels) {
          const campo = camposM.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
          const val =
            campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
          const inner = Math.max(1, facturaWidths[measureIdx] - 4);
          rowHeight = Math.max(
            rowHeight,
            doc.heightOfString(val, { width: inner, lineGap: facLineGap, align: 'left' }) + facVPad
          );
          measureIdx++;
        }
      }
      if (optionalFields.codigoArancelario) {
        const val = String((item as any).codigoArancelario ?? '-');
        const inner = Math.max(1, facturaWidths[measureIdx] - 4);
        rowHeight = Math.max(
          rowHeight,
          doc.heightOfString(val, { width: inner, lineGap: facLineGap, align: 'center' }) + facVPad
        );
      }

      if (yPos + rowHeight > 650) {
        doc.addPage();
        yPos = 50;
      }

      xPos = tableLeft;

      // PRODUCTO
      doc.text(itemNombreFactPdf, xPos + 2, yPos, { width: facturaWidths[0] - 4, lineGap: facLineGap });
      xPos += facturaWidths[0];
      
      // UM
      doc.text(getItemUnidadAbrev(item, facturaUnidadAbrevMap), xPos + 2, yPos, {
        width: facturaWidths[1] - 4,
        align: 'center',
        lineGap: facLineGap,
      });
      xPos += facturaWidths[1];
      
      let colIdx = 2;
      
      // Campos opcionales dinámicos
      if (dynamicLabels.length > 0) {
        const campos = getCamposOpcionalesArray(item);
        for (const label of dynamicLabels) {
          const campo = campos.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
          const val = campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
          doc.text(val, xPos + 2, yPos, {
            width: facturaWidths[colIdx] - 4,
            align: 'left',
            lineGap: facLineGap,
          });
          xPos += facturaWidths[colIdx++];
        }
      }
      
      // Campos opcionales fijos
      if (optionalFields.codigoArancelario) {
        doc.text(String((item as any).codigoArancelario ?? '-'), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.cantidadSacos) {
        doc.text(String((item as any).cantidadSacos ?? '-'), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.pesoXSaco) {
        doc.text((item as any).pesoXSaco ? formatCurrency((item as any).pesoXSaco) : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.precioXSaco) {
        doc.text((item as any).precioXSaco ? `$${formatCurrency((item as any).precioXSaco)}` : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.cantidadCajas) {
        doc.text(String((item as any).cantidadCajas ?? '-'), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.pesoXCaja) {
        doc.text((item as any).pesoXCaja ? formatCurrency((item as any).pesoXCaja) : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.precioXCaja) {
        doc.text((item as any).precioXCaja ? `$${formatCurrency((item as any).precioXCaja)}` : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      
      // CANTIDAD
      doc.text(formatCurrency(item.cantidad), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
      xPos += facturaWidths[colIdx++];
      
      // PESO NETO
      doc.text(formatCurrency(pesoNeto), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
      xPos += facturaWidths[colIdx++];
      
      // PESO BRUTO
      doc.text(formatCurrency(pesoBruto), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
      xPos += facturaWidths[colIdx++];
      
      // PRECIO
      doc.text(`$${formatCurrencyUnitPrice(item.precioUnitario)}`, xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
      xPos += facturaWidths[colIdx++];
      
      // IMPORTE
      doc.text(`$${formatCurrency(importe)}`, xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
      
      yPos += rowHeight;
    }

    // Línea separadora
    doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).stroke();
    yPos += 10;

    // TOTALES: COSTO FOB, FLETE, SEGURO, COSTO CFR
    const flete = factura.flete || 0;
    const seguro = factura.tieneSeguro ? (factura.seguro || 0) : 0;
    const costoCFR = totalImporte + flete + seguro;
    
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`COSTO FOB: $${formatCurrency(totalImporte)}`, margin, yPos, { width: tableWidth, align: 'right' });
    yPos += 14;
    doc.text(`FLETE: $${formatCurrency(flete)}`, margin, yPos, { width: tableWidth, align: 'right' });
    yPos += 14;
    if (factura.tieneSeguro && seguro > 0) {
      doc.text(`SEGURO: $${formatCurrency(seguro)}`, margin, yPos, { width: tableWidth, align: 'right' });
      yPos += 14;
    }
    doc.text(`COSTO CFR: $${formatCurrency(costoCFR)}`, margin, yPos, { width: tableWidth, align: 'right' });
    yPos += 20;

    // TÉRMINOS Y CONDICIONES / MÉTODO DE PAGO (bloques configurables en DOS COLUMNAS 60/40)
    const leftWidthFac = contentWidth * 0.6;
    const rightWidthFac = contentWidth - leftWidthFac;
    const leftXFac = margin;
    const rightXFac = margin + leftWidthFac + 10;
    const topYFac = yPos;

    // Columna izquierda: TÉRMINOS Y CONDICIONES
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TÉRMINOS Y CONDICIONES', leftXFac, topYFac, { width: leftWidthFac, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);

    const terminosDocFactura = (factura as any).terminosDocumentoTexto?.trim();
    const rawPuertoFac = ((factura as any).puertoEmbarque ?? '').trim();
    const puertoEmbarqueFac =
      rawPuertoFac && rawPuertoFac.toUpperCase() !== 'NEW ORLEANS, LA' ? rawPuertoFac : '';
    const origenFac = (factura as any).origen || 'Estados Unidos.';
    const terminosPagoFac = (factura as any).terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const monedaFac = (factura as any).moneda || 'USD';

    let leftBottomYFac = doc.y;
    if (terminosDocFactura && terminosDocFactura.length > 0) {
      const lineas = terminosDocFactura.split(/\r?\n/);
      for (const linea of lineas) {
        doc.text(linea, { width: leftWidthFac, align: 'left' });
        doc.moveDown(0.2);
        leftBottomYFac = doc.y;
      }
    } else {
      const terminosParrafosFac = [
        `Validez de la Oferta: 15 días.`,
        `Puerto Destino: Mariel, Cuba.`,
        `Puerto de Embarque: ${puertoEmbarqueFac}`,
        `Origen: ${origenFac}`,
        `Términos de Entrega: Máximo 15 días posteriores al pago.`,
        `Pago: 100% del valor a la firma del contrato.`,
        `Moneda: Dólar Americano (${monedaFac}).`,
        `Métodos de Pago: Transferencia bancaria o cheques del banco pagador.`,
        `ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.`,
        `El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.`,
        `Condición de pago original: ${terminosPagoFac}`,
      ];

      for (const p of terminosParrafosFac) {
        doc.text(p, { width: leftWidthFac, align: 'left' });
        doc.moveDown(0.2);
        leftBottomYFac = doc.y;
      }
    }

    // Columna derecha: MÉTODO DE PAGO
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('MÉTODO DE PAGO', rightXFac, topYFac, { width: rightWidthFac, align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);

    const metodoPagoDocFactura = (factura as any).metodoPagoDocumentoTexto?.trim();
    let rightBottomYFac = doc.y;
    if (metodoPagoDocFactura && metodoPagoDocFactura.length > 0) {
      const lineasMetodo = metodoPagoDocFactura.split(/\r?\n/);
      for (const linea of lineasMetodo) {
        doc.text(linea, { width: rightWidthFac, align: 'left' });
        doc.moveDown(0.2);
        rightBottomYFac = doc.y;
      }
    } else {
      const metodoPagoParrafosFac = [
        `Banco: Truist Bank`,
        `Titular: ZAS BY JMC CORP`,
        `Número de Cuenta: 1100035647757`,
        `Número de Ruta (transferencias dentro de USA): 263191387`,
        `Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166`,
      ];

      for (const p of metodoPagoParrafosFac) {
        doc.text(p, { width: rightWidthFac, align: 'left' });
        doc.moveDown(0.2);
        rightBottomYFac = doc.y;
      }
    }

    // Continuar debajo de la columna más larga
    doc.y = Math.max(leftBottomYFac, rightBottomYFac) + 18;

    // FIRMAS
    doc.moveDown(3);
    
    const firmaStartY = doc.y;
    const firmaWidth = 180;
    const firmaClienteX = pageWidth - margin - firmaWidth;

    // Imagen de firma empresa
    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      const firmaData = await getImageForPdf(firmaPath);
      if (firmaData) {
        doc.image(firmaData, margin + 40, firmaStartY, { width: 100, height: 45 });
      }
    }

    // Cuño
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      const cunoData = await getImageForPdf(cunoPath);
      if (cunoData) {
        doc.image(cunoData, margin + firmaWidth + 20, firmaStartY + 10, { width: 70, height: 70 });
      }
    }

    // Líneas de firma
    const firmaLineY = firmaStartY + 50;
    doc.moveTo(margin, firmaLineY).lineTo(margin + firmaWidth, firmaLineY).stroke();
    
    if ((factura as any).incluyeFirmaCliente) {
      doc.moveTo(firmaClienteX, firmaLineY).lineTo(firmaClienteX + firmaWidth, firmaLineY).stroke();
    }
    
    // Texto firma empresa
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(empresa.representante, margin, firmaLineY + 5, { width: firmaWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    doc.text(empresa.cargoRepresentante, margin, firmaLineY + 18, { width: firmaWidth, align: 'center' });
    doc.text(empresa.nombre, margin, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    
    // Texto firma cliente
    if ((factura as any).incluyeFirmaCliente) {
      const nombreCliente = (factura as any).firmaClienteNombre || `${factura.cliente.nombre || ''} ${factura.cliente.apellidos || ''}`.trim();
      const cargoCliente = (factura as any).firmaClienteCargo || 'DIRECTOR';
      const empresaCliente = (factura as any).firmaClienteEmpresa || factura.cliente.nombreCompania || '';
      
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(nombreCliente, firmaClienteX, firmaLineY + 5, { width: firmaWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9);
      doc.text(cargoCliente, firmaClienteX, firmaLineY + 18, { width: firmaWidth, align: 'center' });
      doc.text(empresaCliente, firmaClienteX, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    }

    doc.end();
  },

  async facturaExcel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    if (!factura) {
      res.status(404).json({ error: 'Factura no encontrada' });
      return;
    }

    const facturaUnidadAbrevMap = await buildUnidadAbrevMapFromItems(factura.items);

    // Obtener número de oferta cliente si existe
    let numeroOfertaCliente = factura.numero;
    if (factura.tipoOfertaOrigen === 'cliente' && factura.ofertaOrigenId) {
      const ofertaCliente = await prisma.ofertaCliente.findUnique({
        where: { id: factura.ofertaOrigenId },
        select: { numero: true },
      });
      if (ofertaCliente) {
        numeroOfertaCliente = ofertaCliente.numero;
      }
    }

    const empresa = await getEmpresaInfo();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Factura');

    const unidadMedida = getItemUnidadAbrev(factura.items[0], facturaUnidadAbrevMap) || 'KG';
    const optionalFields = detectOptionalFields(factura.items);
    const dynamicLabels = getDynamicOptionalLabels(factura.items);
    
    // Calcular número de columnas
    let numCols = 7; // PRODUCTO, UM, CANT, PESO NETO, PESO BRUTO, PRECIO, IMPORTE
    if (optionalFields.codigoArancelario) numCols++;
    if (optionalFields.cantidadSacos) numCols++;
    if (optionalFields.pesoXSaco) numCols++;
    if (optionalFields.precioXSaco) numCols++;
    if (optionalFields.cantidadCajas) numCols++;
    if (optionalFields.pesoXCaja) numCols++;
    if (optionalFields.precioXCaja) numCols++;
    numCols += dynamicLabels.length;
    
    const lastCol = numCols <= 26 ? String.fromCharCode(64 + numCols) : 'A' + String.fromCharCode(64 + numCols - 26);
    
    let row = 1;

    // TÍTULO: FACTURA - PACKING LIST {solo número, sin prefijo FAC-}
    const tituloNumero = (numeroOfertaCliente || '').replace(/^FAC-/i, '');
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `FACTURA- PACKING LIST ${tituloNumero}`;
    worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    worksheet.getRow(row).height = 22;
    row++;

    // LOGO (mismo tamaño que otros Excel de export)
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 70, height: 50 });
    }

    // DATOS DE EMPRESA (centrado en toda la fila)
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = empresa.direccion;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = empresa.telefono;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = empresa.email;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    row++; // Espacio

    // CODIGO MINCEX (sin borde)
    const codigoMincex = (factura as any).codigoMincex || empresa.codigoMincex;
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `CODIGO MINCEX: ${codigoMincex}`;
    row++;

    // NRO CONTRATO (solo si tiene valor)
    if ((factura as any).nroContrato && (factura as any).nroContrato.trim() !== '') {
      worksheet.mergeCells(`A${row}:${lastCol}${row}`);
      worksheet.getCell(`A${row}`).value = `NRO CONTRATO: ${(factura as any).nroContrato}`;
      row++;
    }

    // FECHA (fila separada, sin borde)
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `FECHA: ${formatDate(new Date(factura.fecha))}`;
    row++;

    // CONSIGNADO A
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `CONSIGNADO A: ${factura.cliente.nombreCompania || factura.cliente.nombre}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `NIT ${factura.cliente.nit || ''}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = factura.cliente.direccion || '';
    row++;

    row++; // Espacio

    // ENCABEZADOS DE TABLA
    const headers: string[] = ['PRODUCTO', 'UM'];
    
    // Contar columnas opcionales (fijas + dinámicas) para ajustar ancho de descripción
    let numOptionalCols = 0;
    if (optionalFields.codigoArancelario) numOptionalCols++;
    if (optionalFields.cantidadSacos) numOptionalCols++;
    if (optionalFields.pesoXSaco) numOptionalCols++;
    if (optionalFields.precioXSaco) numOptionalCols++;
    if (optionalFields.cantidadCajas) numOptionalCols++;
    if (optionalFields.pesoXCaja) numOptionalCols++;
    if (optionalFields.precioXCaja) numOptionalCols++;
    const numOptionalTotal = numOptionalCols + dynamicLabels.length;
    
    // Ajustar ancho de PRODUCTO según columnas opcionales
    const descWidthExcel = numOptionalTotal >= 6 ? 22 : numOptionalTotal >= 4 ? 28 : numOptionalTotal >= 2 ? 34 : 40;
    const widths: number[] = [descWidthExcel, 8];
    
    // Campos dinámicos después de UM
    for (const label of dynamicLabels) {
      const trimmed = label.trim();
      let headerLabel = trimmed;
      if (headerLabel.length > 16) {
        headerLabel = headerLabel.slice(0, 15) + '.';
      }
      headers.push(headerLabel.toUpperCase());
      widths.push(10);
    }
    
    if (optionalFields.codigoArancelario) {
      headers.push('PARTIDA ARANCEL');
      widths.push(16);
    }

    if (optionalFields.cantidadSacos) {
      headers.push('CANT SACOS');
      widths.push(10);
    }
    if (optionalFields.pesoXSaco) {
      headers.push('PESO X SACO');
      widths.push(10);
    }
    if (optionalFields.precioXSaco) {
      headers.push('PRECIO X SACO');
      widths.push(12);
    }
    if (optionalFields.cantidadCajas) {
      headers.push('CANT CAJAS');
      widths.push(10);
    }
    if (optionalFields.pesoXCaja) {
      headers.push('PESO X CAJA');
      widths.push(10);
    }
    if (optionalFields.precioXCaja) {
      headers.push('PRECIO X CAJA');
      widths.push(12);
    }
    
    headers.push(`CANT ${unidadMedida}`, 'PESO NETO', 'PESO BRUTO', `PRECIO/${unidadMedida}`, 'IMPORTE');
    widths.push(10, 10, 10, 12, 14);
    
    // Configurar anchos
    worksheet.columns = widths.map(w => ({ width: w }));
    
    const headerRow = worksheet.getRow(row);
    headerRow.values = headers;
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', wrapText: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.border = { 
        top: { style: 'thin' }, 
        bottom: { style: 'thin' }, 
        left: { style: 'thin' }, 
        right: { style: 'thin' } 
      };
    });
    row++;

    // ITEMS
    let totalImporte = 0;
    let totalPesoNeto = 0;
    let totalPesoBruto = 0;

    for (const item of factura.items) {
      const pesoNeto = (item as any).pesoNeto || item.cantidad;
      const pesoBruto = (item as any).pesoBruto || pesoNeto;
      const importe = item.subtotal;
      totalImporte += importe;
      totalPesoNeto += pesoNeto;
      totalPesoBruto += pesoBruto;

      const values: (string | number)[] = [
        (item as any).producto?.nombre ?? (item as any).nombreProducto ?? '',
        getItemUnidadAbrev(item, facturaUnidadAbrevMap),
      ];
      
      // Campos dinámicos
      if (dynamicLabels.length > 0) {
        const campos = getCamposOpcionalesArray(item);
        for (const label of dynamicLabels) {
          const campo = campos.find((c: any) => typeof c?.label === 'string' && c.label.trim() === label);
          const val = campo && campo.value != null && String(campo.value).trim() !== '' ? String(campo.value) : '-';
          values.push(val);
        }
      }
      
      if (optionalFields.codigoArancelario) values.push((item as any).codigoArancelario ?? '-');
      if (optionalFields.cantidadSacos) values.push((item as any).cantidadSacos ?? '-');
      if (optionalFields.pesoXSaco) values.push((item as any).pesoXSaco ?? '-');
      if (optionalFields.precioXSaco) values.push((item as any).precioXSaco ?? '-');
      if (optionalFields.cantidadCajas) values.push((item as any).cantidadCajas ?? '-');
      if (optionalFields.pesoXCaja) values.push((item as any).pesoXCaja ?? '-');
      if (optionalFields.precioXCaja) values.push((item as any).precioXCaja ?? '-');
      
      values.push(item.cantidad, pesoNeto, pesoBruto, item.precioUnitario, importe);
      
      const dataRow = worksheet.getRow(row);
      dataRow.values = values;
      
      // Calcular altura basada en la longitud de la descripción
      const descLength = ((item as any).producto?.nombre ?? (item as any).nombreProducto ?? '').length;
      const avgCharsPerLine = descWidthExcel * 1.2;
      const numLines = Math.ceil(descLength / avgCharsPerLine);
      dataRow.height = Math.max(24, numLines * 16 + 8);
      
      // Formatear celdas
      dataRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
      dataRow.getCell(2).alignment = { horizontal: 'center' };
      
      // Últimas 5 columnas
      const lastCols = values.length;
      dataRow.getCell(lastCols - 4).alignment = { horizontal: 'right' };
      dataRow.getCell(lastCols - 4).numFmt = '#,##0.00';
      dataRow.getCell(lastCols - 3).alignment = { horizontal: 'right' };
      dataRow.getCell(lastCols - 3).numFmt = '#,##0.00';
      dataRow.getCell(lastCols - 2).alignment = { horizontal: 'right' };
      dataRow.getCell(lastCols - 2).numFmt = '#,##0.00';
      dataRow.getCell(lastCols - 1).alignment = { horizontal: 'right' };
      dataRow.getCell(lastCols - 1).numFmt = '"$"#,##0.000';
      dataRow.getCell(lastCols).alignment = { horizontal: 'right' };
      dataRow.getCell(lastCols).numFmt = '"$"#,##0.00';
      
      dataRow.eachCell((cell) => {
        cell.border = { 
          top: { style: 'thin' }, 
          bottom: { style: 'thin' }, 
          left: { style: 'thin' }, 
          right: { style: 'thin' } 
        };
      });
      
      row++;
    }

    row++; // Espacio

    // TOTALES
    const flete = factura.flete || 0;
    const seguro = factura.tieneSeguro ? (factura.seguro || 0) : 0;
    const costoCFR = totalImporte + flete + seguro;
    
    const prevCol = numCols - 1;
    const importeCol = numCols;
    
    worksheet.getCell(row, prevCol).value = 'COSTO FOB:';
    worksheet.getCell(row, prevCol).font = { bold: true };
    worksheet.getCell(row, prevCol).alignment = { horizontal: 'right' };
    worksheet.getCell(row, importeCol).value = totalImporte;
    worksheet.getCell(row, importeCol).numFmt = '"$"#,##0.00';
    worksheet.getCell(row, importeCol).font = { bold: true };
    row++;

    worksheet.getCell(row, prevCol).value = 'FLETE:';
    worksheet.getCell(row, prevCol).font = { bold: true };
    worksheet.getCell(row, prevCol).alignment = { horizontal: 'right' };
    worksheet.getCell(row, importeCol).value = flete;
    worksheet.getCell(row, importeCol).numFmt = '"$"#,##0.00';
    worksheet.getCell(row, importeCol).font = { bold: true };
    row++;

    if (factura.tieneSeguro && seguro > 0) {
      worksheet.getCell(row, prevCol).value = 'SEGURO:';
      worksheet.getCell(row, prevCol).font = { bold: true };
      worksheet.getCell(row, prevCol).alignment = { horizontal: 'right' };
      worksheet.getCell(row, importeCol).value = seguro;
      worksheet.getCell(row, importeCol).numFmt = '"$"#,##0.00';
      worksheet.getCell(row, importeCol).font = { bold: true };
      row++;
    }

    worksheet.getCell(row, prevCol).value = 'COSTO CFR:';
    worksheet.getCell(row, prevCol).font = { bold: true };
    worksheet.getCell(row, prevCol).alignment = { horizontal: 'right' };
    worksheet.getCell(row, importeCol).value = costoCFR;
    worksheet.getCell(row, importeCol).numFmt = '"$"#,##0.00';
    worksheet.getCell(row, importeCol).font = { bold: true };
    row += 2;

    // TÉRMINOS Y CONDICIONES / MÉTODO DE PAGO (bloques configurables)
    const terminosDocFacX = (factura as any).terminosDocumentoTexto?.trim();
    const metodoPagoDocFacX = (factura as any).metodoPagoDocumentoTexto?.trim();
    const rawPuertoFacX = ((factura as any).puertoEmbarque ?? '').trim();
    const puertoEmbarqueFacX =
      rawPuertoFacX && rawPuertoFacX.toUpperCase() !== 'NEW ORLEANS, LA' ? rawPuertoFacX : '';
    const origenFacX = (factura as any).origen || 'Estados Unidos.';
    const terminosPagoFacX = (factura as any).terminosPago || 'PAGO 100% ANTES DEL EMBARQUE';
    const monedaFacX = (factura as any).moneda || 'USD';

    const terminosTextoFac =
      terminosDocFacX && terminosDocFacX.length > 0
        ? ['TÉRMINOS Y CONDICIONES', '', terminosDocFacX].join('\n')
        : [
            'TÉRMINOS Y CONDICIONES',
            '',
            'Validez de la Oferta: 15 días.',
            'Puerto Destino: Mariel, Cuba.',
            `Puerto de Embarque: ${puertoEmbarqueFacX}`,
            `Origen: ${origenFacX}`,
            'Términos de Entrega: Máximo 15 días posteriores al pago.',
            'Pago: 100% del valor a la firma del contrato.',
            `Moneda: Dólar Americano (${monedaFacX}).`,
            'Métodos de Pago: Transferencia bancaria o cheques del banco pagador.',
            'ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.',
            'El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.',
            `Condición de pago original: ${terminosPagoFacX}`,
          ].join('\n');

    const metodoPagoTextoFac =
      metodoPagoDocFacX && metodoPagoDocFacX.length > 0
        ? ['MÉTODO DE PAGO', '', metodoPagoDocFacX].join('\n')
        : [
            'MÉTODO DE PAGO',
            '',
            'Banco: Truist Bank',
            'Titular: ZAS BY JMC CORP',
            'Número de Cuenta: 1100035647757',
            'Número de Ruta (transferencias dentro de USA): 263191387',
            'Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166',
          ].join('\n');

    // Bloque en DOS COLUMNAS: Términos (izquierda ~60%) y Método de pago (derecha ~40%)
    const lastColIndexFac = numCols;
    const leftLastColIndexFac = Math.max(1, Math.floor(lastColIndexFac * 0.6));
    const rightFirstColIndexFac = Math.min(lastColIndexFac, leftLastColIndexFac + 1);

    const getColLetterFac = (index: number): string => {
      return String.fromCharCode(64 + index);
    };

    const leftLastColFac = getColLetterFac(leftLastColIndexFac);
    const rightFirstColFac = getColLetterFac(rightFirstColIndexFac);

    // Columna izquierda: términos
    worksheet.mergeCells(`A${row}:${leftLastColFac}${row + 6}`);
    const terminosCell = worksheet.getCell(`A${row}`);
    terminosCell.value = terminosTextoFac;
    terminosCell.alignment = { vertical: 'top', wrapText: true };

    // Columna derecha: método de pago
    worksheet.mergeCells(`${rightFirstColFac}${row}:${lastCol}${row + 6}`);
    const metodoCell = worksheet.getCell(`${rightFirstColFac}${row}`);
    metodoCell.value = metodoPagoTextoFac;
    metodoCell.alignment = { vertical: 'top', wrapText: true };

    row = row + 7;

    // FIRMAS
    const firmaStartRow = row + 2;

    row = firmaStartRow + 3;

    // Firma empresa
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = '________________________________';
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    // Firma cliente (si está configurado)
    if ((factura as any).incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = '________________________________';
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = empresa.representante;
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if ((factura as any).incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const nombreCliente = (factura as any).firmaClienteNombre || `${factura.cliente.nombre || ''} ${factura.cliente.apellidos || ''}`.trim();
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = nombreCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).font = { bold: true };
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if ((factura as any).incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const cargoCliente = (factura as any).firmaClienteCargo || 'DIRECTOR';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = cargoCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if ((factura as any).incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const empresaCliente = (factura as any).firmaClienteEmpresa || factura.cliente.nombreCompania || '';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = empresaCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Factura_${factura.numero}.xlsx"`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // EXPORTAR TODOS LOS DATOS (Listas completas)
  // ==========================================

  // Exportar todos los clientes
  async exportClientes(req: Request, res: Response): Promise<void> {
    try {
      const { search } = req.query;
      const { createContainsFilter } = await import('../lib/search-utils.js');
      
      const searchFilter = search ? createContainsFilter(String(search)) : null;
      
      const clientes = await prisma.cliente.findMany({
        where: searchFilter ? {
          OR: [
            { nombre: searchFilter },
            { apellidos: searchFilter },
            { nit: searchFilter },
            { email: searchFilter },
          ],
        } : undefined,
        orderBy: { nombre: 'asc' },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Clientes');
      
      sheet.columns = [
        { header: 'ID', key: 'id', width: 30 },
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Apellidos', key: 'apellidos', width: 20 },
        { header: 'Compañía', key: 'nombreCompania', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Dirección', key: 'direccion', width: 30 },
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'Contacto', key: 'contacto', width: 20 },
      ];

      clientes.forEach(cliente => {
        sheet.addRow({
          id: cliente.id,
          nombre: cliente.nombre,
          apellidos: cliente.apellidos || '',
          nombreCompania: cliente.nombreCompania || '',
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
          nit: cliente.nit || '',
          contacto: cliente.contacto || '',
        });
      });

      // Estilo del encabezado
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="clientes_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar clientes:', error);
      res.status(500).json({ error: 'Error al exportar clientes' });
    }
  },

  // Exportar todos los productos
  async exportProductos(req: Request, res: Response): Promise<void> {
    try {
      const { search, activo, categoriaId } = req.query;
      const { createContainsFilter } = await import('../lib/search-utils.js');
      
      const searchFilter = search ? createContainsFilter(String(search)) : null;
      
      const productos = await prisma.producto.findMany({
        where: {
          AND: [
            searchFilter ? {
              OR: [
                { nombre: searchFilter },
                { codigo: searchFilter },
                { descripcion: searchFilter },
              ],
            } : {},
            activo !== undefined ? { activo: activo === 'true' } : {},
            categoriaId ? { categoriaId: String(categoriaId) } : {},
          ],
        },
        include: {
          unidadMedida: true,
        },
        orderBy: { nombre: 'asc' },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Productos');
      
      sheet.columns = [
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Nombre', key: 'nombre', width: 30 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Precio Base', key: 'precioBase', width: 15 },
        { header: 'Unidad Medida', key: 'unidadMedida', width: 15 },
        { header: 'Código Arancelario', key: 'codigoArancelario', width: 20 },
        { header: 'Activo', key: 'activo', width: 10 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Cant. Cajas', key: 'cantidadCajas', width: 12 },
        { header: 'Cant. Sacos', key: 'cantidadSacos', width: 12 },
        { header: 'Peso Neto', key: 'pesoNeto', width: 12 },
        { header: 'Peso Bruto', key: 'pesoBruto', width: 12 },
      ];

      productos.forEach(producto => {
        sheet.addRow({
          codigo: producto.codigo || '',
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          precioBase: producto.precioBase,
          unidadMedida: producto.unidadMedida?.nombre || '',
          codigoArancelario: producto.codigoArancelario || '',
          activo: producto.activo ? 'Sí' : 'No',
          cantidad: producto.cantidad || '',
          cantidadCajas: producto.cantidadCajas || '',
          cantidadSacos: producto.cantidadSacos || '',
          pesoNeto: producto.pesoNeto || '',
          pesoBruto: producto.pesoBruto || '',
        });
      });

      // Estilo del encabezado
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="productos_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar productos:', error);
      res.status(500).json({ error: 'Error al exportar productos' });
    }
  },

  // Exportar todas las ofertas a cliente
  async exportOfertasCliente(req: Request, res: Response): Promise<void> {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      
      // Construir filtro de fecha si se proporciona
      const fechaFilter: any = {};
      if (fechaDesde) {
        // Crear fecha en hora local (no UTC) para evitar problemas de zona horaria
        const [year, month, day] = String(fechaDesde).split('-').map(Number);
        const fechaDesdeDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        fechaFilter.gte = fechaDesdeDate;
      }
      if (fechaHasta) {
        // Crear fecha en hora local hasta el final del día
        const [year, month, day] = String(fechaHasta).split('-').map(Number);
        const fechaHastaDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        fechaFilter.lte = fechaHastaDate;
      }
      
      const ofertas = await prisma.ofertaCliente.findMany({
        where: Object.keys(fechaFilter).length > 0 ? { fecha: fechaFilter } : undefined,
        include: {
          cliente: {
            select: {
              nombre: true,
              apellidos: true,
              nombreCompania: true,
              email: true,
              telefono: true,
              nit: true,
              direccion: true,
              contacto: true,
            },
          },
          items: {
            include: {
              producto: {
                select: {
                  nombre: true,
                  codigo: true,
                  descripcion: true,
                },
              },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      
      // Hoja: Resumen de Ofertas
      const resumenSheet = workbook.addWorksheet('Resumen Ofertas');
      resumenSheet.columns = [
        { header: 'Número', key: 'numero', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Vigencia Hasta', key: 'vigenciaHasta', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Compañía', key: 'compania', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Código MINCEX', key: 'codigoMincex', width: 15 },
        { header: 'Puerto Embarque', key: 'puertoEmbarque', width: 20 },
        { header: 'Origen', key: 'origen', width: 20 },
        { header: 'Moneda', key: 'moneda', width: 12 },
        { header: 'Términos Pago', key: 'terminosPago', width: 30 },
        { header: 'Incluye Firma', key: 'incluyeFirma', width: 12 },
        { header: 'Observaciones', key: 'observaciones', width: 40 },
      ];

      ofertas.forEach(oferta => {
        resumenSheet.addRow({
          numero: oferta.numero,
          fecha: oferta.fecha ? new Date(oferta.fecha).toLocaleDateString('es-ES') : '',
          vigenciaHasta: oferta.vigenciaHasta ? new Date(oferta.vigenciaHasta).toLocaleDateString('es-ES') : '',
          cliente: oferta.cliente ? `${oferta.cliente.nombre} ${oferta.cliente.apellidos || ''}` : '',
          compania: oferta.cliente?.nombreCompania || '',
          email: oferta.cliente?.email || '',
          telefono: oferta.cliente?.telefono || '',
          nit: oferta.cliente?.nit || '',
          estado: oferta.estado,
          total: oferta.total,
          codigoMincex: oferta.codigoMincex || '',
          puertoEmbarque: oferta.puertoEmbarque || '',
          origen: oferta.origen || '',
          moneda: oferta.moneda || '',
          terminosPago: oferta.terminosPago || '',
          incluyeFirma: oferta.incluyeFirmaCliente ? 'Sí' : 'No',
          observaciones: oferta.observaciones || '',
        });
      });

      // Hoja: Items de Ofertas
      const itemsSheet = workbook.addWorksheet('Items');
      itemsSheet.columns = [
        { header: 'Oferta', key: 'oferta', width: 15 },
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Precio Unitario', key: 'precioUnitario', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Cant. Cajas', key: 'cantidadCajas', width: 12 },
        { header: 'Cant. Sacos', key: 'cantidadSacos', width: 12 },
        { header: 'Peso Neto', key: 'pesoNeto', width: 12 },
        { header: 'Peso Bruto', key: 'pesoBruto', width: 12 },
        { header: 'Peso x Saco', key: 'pesoXSaco', width: 12 },
        { header: 'Precio x Saco', key: 'precioXSaco', width: 15 },
        { header: 'Peso x Caja', key: 'pesoXCaja', width: 12 },
        { header: 'Precio x Caja', key: 'precioXCaja', width: 15 },
        { header: 'Código Arancelario', key: 'codigoArancelario', width: 20 },
      ];

      ofertas.forEach(oferta => {
        oferta.items.forEach(item => {
          itemsSheet.addRow({
            oferta: oferta.numero,
            producto: item.producto?.nombre || '',
            codigo: item.producto?.codigo || '',
            descripcion: item.descripcion || item.producto?.descripcion || '',
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            cantidadCajas: item.cantidadCajas || '',
            cantidadSacos: item.cantidadSacos || '',
            pesoNeto: item.pesoNeto || '',
            pesoBruto: item.pesoBruto || '',
            pesoXSaco: item.pesoXSaco || '',
            precioXSaco: item.precioXSaco || '',
            pesoXCaja: item.pesoXCaja || '',
            precioXCaja: item.precioXCaja || '',
            codigoArancelario: item.codigoArancelario || '',
          });
        });
      });

      // Estilos
      [resumenSheet, itemsSheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ofertas_cliente_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar ofertas a cliente:', error);
      res.status(500).json({ error: 'Error al exportar ofertas a cliente' });
    }
  },

  // Exportar todas las ofertas generales
  async exportOfertasGenerales(req: Request, res: Response): Promise<void> {
    try {
      const { estado, fechaDesde, fechaHasta } = req.query;
      
      const where: any = {};
      if (estado && String(estado).trim() !== '') {
        where.estado = String(estado);
      }
      
      // Construir filtro de fecha si se proporciona
      const fechaFilter: any = {};
      if (fechaDesde) {
        // Crear fecha en hora local (no UTC) para evitar problemas de zona horaria
        const [year, month, day] = String(fechaDesde).split('-').map(Number);
        const fechaDesdeDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        fechaFilter.gte = fechaDesdeDate;
      }
      if (fechaHasta) {
        // Crear fecha en hora local hasta el final del día
        const [year, month, day] = String(fechaHasta).split('-').map(Number);
        const fechaHastaDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        fechaFilter.lte = fechaHastaDate;
      }
      
      if (Object.keys(fechaFilter).length > 0) {
        where.fecha = fechaFilter;
      }

      const ofertas = await prisma.ofertaGeneral.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: {
          items: {
            include: {
              producto: {
                select: {
                  nombre: true,
                  codigo: true,
                },
              },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      
      // Hoja: Resumen de Ofertas
      const resumenSheet = workbook.addWorksheet('Resumen Ofertas');
      resumenSheet.columns = [
        { header: 'Número', key: 'numero', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Vigencia Hasta', key: 'vigenciaHasta', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Observaciones', key: 'observaciones', width: 40 },
      ];

      ofertas.forEach(oferta => {
        resumenSheet.addRow({
          numero: oferta.numero,
          fecha: oferta.fecha ? new Date(oferta.fecha).toLocaleDateString('es-ES') : '',
          vigenciaHasta: oferta.vigenciaHasta ? new Date(oferta.vigenciaHasta).toLocaleDateString('es-ES') : '',
          estado: oferta.estado,
          total: oferta.total,
          observaciones: oferta.observaciones || '',
        });
      });

      // Hoja: Items de Ofertas
      const itemsSheet = workbook.addWorksheet('Items');
      itemsSheet.columns = [
        { header: 'Oferta', key: 'oferta', width: 15 },
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Precio Unitario', key: 'precioUnitario', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Cant. Cajas', key: 'cantidadCajas', width: 12 },
        { header: 'Cant. Sacos', key: 'cantidadSacos', width: 12 },
      ];

      ofertas.forEach(oferta => {
        oferta.items.forEach(item => {
          itemsSheet.addRow({
            oferta: oferta.numero,
            producto: item.producto?.nombre || '',
            codigo: item.producto?.codigo || '',
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
            cantidadCajas: item.cantidadCajas || '',
            cantidadSacos: item.cantidadSacos || '',
          });
        });
      });

      // Estilos
      [resumenSheet, itemsSheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ofertas_generales_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar ofertas generales:', error);
      res.status(500).json({ error: 'Error al exportar ofertas generales' });
    }
  },

  // Exportar todas las facturas
  async exportFacturas(req: Request, res: Response): Promise<void> {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      
      // Construir filtro de fecha si se proporciona
      const fechaFilter: any = {};
      if (fechaDesde) {
        fechaFilter.gte = new Date(String(fechaDesde));
      }
      if (fechaHasta) {
        const fechaHastaDate = new Date(String(fechaHasta));
        fechaHastaDate.setHours(23, 59, 59, 999);
        fechaFilter.lte = fechaHastaDate;
      }
      
      const facturas = await prisma.factura.findMany({
        where: Object.keys(fechaFilter).length > 0 ? { fecha: fechaFilter } : undefined,
        include: {
          cliente: {
            select: {
              nombre: true,
              apellidos: true,
              nombreCompania: true,
              email: true,
              telefono: true,
              nit: true,
              direccion: true,
            },
          },
          importadora: {
            select: {
              nombre: true,
              pais: true,
              contacto: true,
            },
          },
          items: {
            include: {
              producto: {
                select: {
                  nombre: true,
                  codigo: true,
                  descripcion: true,
                },
              },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      
      // Hoja: Resumen de Facturas
      const resumenSheet = workbook.addWorksheet('Resumen Facturas');
      resumenSheet.columns = [
        { header: 'Número', key: 'numero', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 18 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Compañía', key: 'compania', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'Importadora', key: 'importadora', width: 25 },
        { header: 'País Importadora', key: 'paisImportadora', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Flete', key: 'flete', width: 12 },
        { header: 'Seguro', key: 'seguro', width: 12 },
        { header: 'Tiene Seguro', key: 'tieneSeguro', width: 12 },
        { header: 'Impuestos', key: 'impuestos', width: 12 },
        { header: 'Descuento', key: 'descuento', width: 12 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Código MINCEX', key: 'codigoMincex', width: 15 },
        { header: 'Nro. Contrato', key: 'nroContrato', width: 15 },
        { header: 'Puerto Embarque', key: 'puertoEmbarque', width: 20 },
        { header: 'Origen', key: 'origen', width: 20 },
        { header: 'Moneda', key: 'moneda', width: 12 },
        { header: 'Términos Pago', key: 'terminosPago', width: 30 },
        { header: 'Incluye Firma', key: 'incluyeFirma', width: 12 },
        { header: 'Firma Nombre', key: 'firmaNombre', width: 20 },
        { header: 'Firma Cargo', key: 'firmaCargo', width: 20 },
        { header: 'Firma Empresa', key: 'firmaEmpresa', width: 20 },
        { header: 'Observaciones', key: 'observaciones', width: 40 },
      ];

      facturas.forEach(factura => {
        resumenSheet.addRow({
          numero: factura.numero,
          fecha: factura.fecha ? new Date(factura.fecha).toLocaleDateString('es-ES') : '',
          fechaVencimiento: factura.fechaVencimiento ? new Date(factura.fechaVencimiento).toLocaleDateString('es-ES') : '',
          cliente: factura.cliente ? `${factura.cliente.nombre} ${factura.cliente.apellidos || ''}` : '',
          compania: factura.cliente?.nombreCompania || '',
          email: factura.cliente?.email || '',
          telefono: factura.cliente?.telefono || '',
          nit: factura.cliente?.nit || '',
          importadora: factura.importadora?.nombre || '',
          paisImportadora: factura.importadora?.pais || '',
          estado: factura.estado,
          subtotal: factura.subtotal,
          flete: factura.flete,
          seguro: factura.seguro,
          tieneSeguro: factura.tieneSeguro ? 'Sí' : 'No',
          impuestos: factura.impuestos,
          descuento: factura.descuento,
          total: factura.total,
          codigoMincex: factura.codigoMincex || '',
          nroContrato: factura.nroContrato || '',
          puertoEmbarque: factura.puertoEmbarque || '',
          origen: factura.origen || '',
          moneda: factura.moneda || '',
          terminosPago: factura.terminosPago || '',
          incluyeFirma: factura.incluyeFirmaCliente ? 'Sí' : 'No',
          firmaNombre: factura.firmaClienteNombre || '',
          firmaCargo: factura.firmaClienteCargo || '',
          firmaEmpresa: factura.firmaClienteEmpresa || '',
          observaciones: factura.observaciones || '',
        });
      });

      // Hoja: Items de Facturas
      const itemsSheet = workbook.addWorksheet('Items');
      itemsSheet.columns = [
        { header: 'Factura', key: 'factura', width: 15 },
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Cant. Cajas', key: 'cantidadCajas', width: 12 },
        { header: 'Cant. Sacos', key: 'cantidadSacos', width: 12 },
        { header: 'Precio Unitario', key: 'precioUnitario', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Peso Neto', key: 'pesoNeto', width: 12 },
        { header: 'Peso Bruto', key: 'pesoBruto', width: 12 },
        { header: 'Peso x Saco', key: 'pesoXSaco', width: 12 },
        { header: 'Precio x Saco', key: 'precioXSaco', width: 15 },
        { header: 'Peso x Caja', key: 'pesoXCaja', width: 12 },
        { header: 'Precio x Caja', key: 'precioXCaja', width: 15 },
        { header: 'Código Arancelario', key: 'codigoArancelario', width: 20 },
      ];

      facturas.forEach(factura => {
        factura.items.forEach(item => {
          itemsSheet.addRow({
            factura: factura.numero,
            producto: item.producto?.nombre || '',
            codigo: item.producto?.codigo || '',
            descripcion: item.descripcion || item.producto?.descripcion || '',
            cantidad: item.cantidad,
            cantidadCajas: item.cantidadCajas || '',
            cantidadSacos: item.cantidadSacos || '',
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            pesoNeto: item.pesoNeto || '',
            pesoBruto: item.pesoBruto || '',
            pesoXSaco: item.pesoXSaco || '',
            precioXSaco: item.precioXSaco || '',
            pesoXCaja: item.pesoXCaja || '',
            precioXCaja: item.precioXCaja || '',
            codigoArancelario: item.codigoArancelario || '',
          });
        });
      });

      // Estilos
      [resumenSheet, itemsSheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="facturas_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar facturas:', error);
      res.status(500).json({ error: 'Error al exportar facturas' });
    }
  },

  // Exportar todas las ofertas a importadora
  async exportOfertasImportadora(req: Request, res: Response): Promise<void> {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      
      // Construir filtro de fecha si se proporciona
      const fechaFilter: any = {};
      if (fechaDesde) {
        fechaFilter.gte = new Date(String(fechaDesde));
      }
      if (fechaHasta) {
        const fechaHastaDate = new Date(String(fechaHasta));
        fechaHastaDate.setHours(23, 59, 59, 999);
        fechaFilter.lte = fechaHastaDate;
      }
      
      const ofertas = await prisma.ofertaImportadora.findMany({
        where: Object.keys(fechaFilter).length > 0 ? { fecha: fechaFilter } : undefined,
        include: {
          cliente: {
            select: {
              nombre: true,
              apellidos: true,
              nombreCompania: true,
              email: true,
              telefono: true,
              nit: true,
              direccion: true,
            },
          },
          importadora: {
            select: {
              nombre: true,
              pais: true,
              contacto: true,
            },
          },
          items: {
            include: {
              producto: {
                select: {
                  nombre: true,
                  codigo: true,
                  descripcion: true,
                },
              },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      
      // Hoja: Resumen de Ofertas
      const resumenSheet = workbook.addWorksheet('Resumen Ofertas');
      resumenSheet.columns = [
        { header: 'Número', key: 'numero', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Vigencia Hasta', key: 'vigenciaHasta', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Compañía', key: 'compania', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'Importadora', key: 'importadora', width: 25 },
        { header: 'País Importadora', key: 'paisImportadora', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Subtotal Productos', key: 'subtotalProductos', width: 18 },
        { header: 'Flete', key: 'flete', width: 12 },
        { header: 'Seguro', key: 'seguro', width: 12 },
        { header: 'Tiene Seguro', key: 'tieneSeguro', width: 12 },
        { header: 'Precio CIF', key: 'precioCIF', width: 15 },
        { header: 'Código MINCEX', key: 'codigoMincex', width: 15 },
        { header: 'Puerto Embarque', key: 'puertoEmbarque', width: 20 },
        { header: 'Origen', key: 'origen', width: 20 },
        { header: 'Moneda', key: 'moneda', width: 12 },
        { header: 'Términos Pago', key: 'terminosPago', width: 30 },
        { header: 'Incluye Firma', key: 'incluyeFirma', width: 12 },
        { header: 'Observaciones', key: 'observaciones', width: 40 },
      ];

      ofertas.forEach(oferta => {
        resumenSheet.addRow({
          numero: oferta.numero,
          fecha: oferta.fecha ? new Date(oferta.fecha).toLocaleDateString('es-ES') : '',
          vigenciaHasta: oferta.vigenciaHasta ? new Date(oferta.vigenciaHasta).toLocaleDateString('es-ES') : '',
          cliente: oferta.cliente ? `${oferta.cliente.nombre} ${oferta.cliente.apellidos || ''}` : '',
          compania: oferta.cliente?.nombreCompania || '',
          email: oferta.cliente?.email || '',
          telefono: oferta.cliente?.telefono || '',
          nit: oferta.cliente?.nit || '',
          importadora: oferta.importadora?.nombre || '',
          paisImportadora: oferta.importadora?.pais || '',
          estado: oferta.estado,
          subtotalProductos: oferta.subtotalProductos,
          flete: oferta.flete,
          seguro: oferta.seguro,
          tieneSeguro: oferta.tieneSeguro ? 'Sí' : 'No',
          precioCIF: oferta.precioCIF,
          codigoMincex: oferta.codigoMincex || '',
          puertoEmbarque: oferta.puertoEmbarque || '',
          origen: oferta.origen || '',
          moneda: oferta.moneda || '',
          terminosPago: oferta.terminosPago || '',
          incluyeFirma: oferta.incluyeFirmaCliente ? 'Sí' : 'No',
          observaciones: oferta.observaciones || '',
        });
      });

      // Hoja: Items de Ofertas
      const itemsSheet = workbook.addWorksheet('Items');
      itemsSheet.columns = [
        { header: 'Oferta', key: 'oferta', width: 15 },
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Precio Unitario', key: 'precioUnitario', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Cant. Cajas', key: 'cantidadCajas', width: 12 },
        { header: 'Cant. Sacos', key: 'cantidadSacos', width: 12 },
        { header: 'Peso Neto', key: 'pesoNeto', width: 12 },
        { header: 'Peso Bruto', key: 'pesoBruto', width: 12 },
        { header: 'Peso x Saco', key: 'pesoXSaco', width: 12 },
        { header: 'Precio x Saco', key: 'precioXSaco', width: 15 },
        { header: 'Peso x Caja', key: 'pesoXCaja', width: 12 },
        { header: 'Precio x Caja', key: 'precioXCaja', width: 15 },
        { header: 'Código Arancelario', key: 'codigoArancelario', width: 20 },
      ];

      ofertas.forEach(oferta => {
        oferta.items.forEach((item: any) => {
          itemsSheet.addRow({
            oferta: oferta.numero,
            producto: item.producto?.nombre || '',
            codigo: item.producto?.codigo || '',
            descripcion: item.descripcion || item.producto?.descripcion || '',
            cantidad: item.cantidad,
            precioUnitario: item.precioAjustado || item.precioOriginal || 0,
            subtotal: item.subtotal,
            cantidadCajas: item.cantidadCajas || '',
            cantidadSacos: item.cantidadSacos || '',
            pesoNeto: item.pesoNeto || '',
            pesoBruto: item.pesoBruto || '',
            pesoXSaco: item.pesoXSaco || '',
            precioXSaco: item.precioXSaco || '',
            pesoXCaja: item.pesoXCaja || '',
            precioXCaja: item.precioXCaja || '',
            codigoArancelario: item.codigoArancelario || '',
          });
        });
      });

      // Estilos
      [resumenSheet, itemsSheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ofertas_importadora_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar ofertas a importadora:', error);
      res.status(500).json({ error: 'Error al exportar ofertas a importadora' });
    }
  },

  /** Resumen de operaciones (comercial y Parcel): Excel, una fila por contenedor. */
  async exportOperacionesComerciales(req: Request, res: Response): Promise<void> {
    const INACTIVE_CONTAINER = [
      'Completado',
      'Cancelado',
      'Delivered',
      'Closed',
      'Cancelled',
    ];

    function formatEsDate(d: Date | string | null | undefined): string {
      if (!d) return '';
      const date = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    }

    function productosFromItems(
      items: Array<{ nombreProducto?: string | null; producto?: { nombre?: string | null } | null }>
    ): string {
      if (!items?.length) return '';
      return items
        .map((i) => (i.nombreProducto || i.producto?.nombre || '').trim())
        .filter(Boolean)
        .join(', ');
    }

    function labelOperacion(
      op: { operationType: string; operationNo: string; referenciaOperacion: string | null },
      c: { containerNo?: string | null; blNo?: string | null; bookingNo?: string | null } | null
    ): string {
      if (op.operationType !== 'PARCEL') return op.operationNo;
      if (!c) return (op.referenciaOperacion || '').trim() || op.operationNo;
      const fromC = (c.containerNo || c.blNo || c.bookingNo || '').trim();
      if (fromC) return fromC;
      return (op.referenciaOperacion || '').trim() || op.operationNo;
    }

    try {
      const soloActivas =
        req.query.soloActivas !== '0' && String(req.query.soloActivas).toLowerCase() !== 'false';
      const tipo = String(req.query.tipo || '').toUpperCase();
      const whereOp: { operationType?: string } = {};
      if (tipo === 'COMMERCIAL' || tipo === 'PARCEL') {
        whereOp.operationType = tipo;
      }

      const operations = await prisma.operation.findMany({
        where: Object.keys(whereOp).length ? whereOp : undefined,
        include: {
          offerCustomer: {
            select: {
              fecha: true,
              fechaContratoImportadora: true,
              cliente: true,
              items: {
                orderBy: { createdAt: 'asc' },
                include: { producto: { select: { nombre: true } } },
              },
            },
          },
          importadora: { select: { nombre: true } },
          containers: { orderBy: { sequenceNo: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Operaciones');
      const lastCol = 'J';

      sheet.mergeCells(`A1:${lastCol}1`);
      sheet.getCell('A1').value = 'Resumen de operaciones';
      sheet.getCell('A1').font = { bold: true, size: 13 };
      sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(1).height = 24;

      const headers = [
        'Operación',
        'Producto',
        'Cliente',
        'Importadora',
        'Estado',
        'Fecha Oferta',
        'Fecha Contrato',
        'Fecha Envío',
        'ETA',
        'Salida Mariel',
      ];
      const headerRow = sheet.getRow(2);
      headers.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
      });
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      sheet.columns = [
        { width: 14 },
        { width: 28 },
        { width: 26 },
        { width: 18 },
        { width: 26 },
        { width: 14 },
        { width: 16 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
      ];

      const rows: any[][] = [];

      for (const op of operations) {
        const oferta = op.offerCustomer;
        const productos = oferta ? productosFromItems(oferta.items) : '';
        const cliente = oferta?.cliente
          ? (oferta.cliente.nombreCompania ||
              `${oferta.cliente.nombre} ${oferta.cliente.apellidos || ''}`.trim())
          : '';
        // Oferta: fechas de calendario (YYYY-MM-DD) — usar UTC para coincidir con lo guardado en pantalla
        const fechaOferta = oferta ? formatStoredDateOnlyEs(oferta.fecha) : '';
        const fechaContrato = oferta?.fechaContratoImportadora
          ? formatStoredDateOnlyEs(oferta.fechaContratoImportadora)
          : '';

        const containers = op.containers ?? [];
        const list = containers.length === 0 ? [null] : containers.map((c) => c);

        for (const c of list) {
          if (soloActivas && c && INACTIVE_CONTAINER.includes(c.status)) {
            continue;
          }

          const estado = c?.status ?? op.status;
          const fechaEnvio = c
            ? formatEsDate(c.etdActual ?? c.etdEstimated ?? null)
            : '';
          const eta = c ? formatEsDate(c.etaActual ?? c.etaEstimated ?? null) : '';
          const salidaMariel = '';

          rows.push([
            labelOperacion(
              {
                operationType: op.operationType,
                operationNo: op.operationNo,
                referenciaOperacion: op.referenciaOperacion,
              },
              c
            ),
            productos || (op.operationType === 'PARCEL' ? '—' : ''),
            cliente || '—',
            op.importadora?.nombre || '—',
            estado,
            fechaOferta,
            fechaContrato,
            fechaEnvio,
            eta,
            salidaMariel,
          ]);
        }
      }

      // Ordenar por nombre de operación (columna 0), con orden numérico dentro del texto
      rows.sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true, sensitivity: 'base' })
      );

      rows.forEach((r) => {
        sheet.addRow(r);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const day = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="resumen_operaciones_${day}.xlsx"`
      );
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al exportar resumen de operaciones:', error);
      res.status(500).json({ error: 'Error al exportar el resumen de operaciones' });
    }
  },

  /** Excel Operations Board: hojas Comercial y Parcel (misma lógica de columnas que la UI). */
  async exportOperacionesTablero(req: Request, res: Response): Promise<void> {
    try {
      const soloActivas =
        req.query.soloActivas !== '0' && String(req.query.soloActivas).toLowerCase() !== 'false';
      const tipoRaw = String(req.query.tipo || '').toUpperCase();
      const tipo = tipoRaw === 'COMMERCIAL' || tipoRaw === 'PARCEL' ? tipoRaw : 'all';
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const buffer = await buildOperationsBoardExcelBuffer({ soloActivas, tipo, status, search });
      const day = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="operations_board_${day}.xlsx"`
      );
      res.send(buffer);
    } catch (error) {
      console.error('Error al exportar operations board:', error);
      res.status(500).json({ error: 'Error al exportar el tablero de operaciones' });
    }
  },

  /** PDF Operations Board en un solo archivo: Comercial primero, Parcel después. */
  async exportOperacionesTableroPdf(req: Request, res: Response): Promise<void> {
    try {
      const soloActivas =
        req.query.soloActivas !== '0' && String(req.query.soloActivas).toLowerCase() !== 'false';
      const tipoRaw = String(req.query.tipo || '').toUpperCase();
      const tipo = tipoRaw === 'COMMERCIAL' || tipoRaw === 'PARCEL' ? tipoRaw : 'all';
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const buffer = await buildOperationsBoardPdfBuffer({
        soloActivas,
        tipo,
        status,
        search,
      });
      const day = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="operations_board_${day}.pdf"`);
      res.send(buffer);
    } catch (error) {
      console.error('Error al exportar operations board PDF:', error);
      res.status(500).json({ error: 'Error al exportar PDF del tablero de operaciones' });
    }
  },

  /** Envía por correo el Excel del Operations Board (Resend + adjunto). */
  async emailOperacionesTablero(req: Request, res: Response): Promise<void> {
    const bodySchema = z.object({
      to: z.string().email('Email destino inválido'),
      soloActivas: z.boolean().optional().default(true),
      format: z.enum(['excel', 'pdf']).optional().default('excel'),
      tipo: z.enum(['COMMERCIAL', 'PARCEL', 'all']).optional().default('all'),
      status: z.string().optional(),
      search: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { to, soloActivas, format, tipo, status, search } = parsed.data;

    try {
      const sendResult =
        format === 'pdf'
          ? await (async () => {
              const buffer = await buildOperationsBoardPdfBuffer({ soloActivas, tipo, status, search });
              return sendOperationsBoardPdfEmail(to, buffer);
            })()
          : await (async () => {
              const buffer = await buildOperationsBoardExcelBuffer({ soloActivas, tipo, status, search });
              return sendOperationsBoardExcelEmail(to, buffer);
            })();

      if (!sendResult.ok) {
        console.error('[export] email tablero operaciones:', sendResult.reason);
        res.status(500).json({
          error: 'No se pudo enviar el correo. Revisa Resend y el remitente (dominio verificado).',
        });
        return;
      }

      res.json({
        message: `Informe ${format.toUpperCase()} enviado. Revisa la bandeja de entrada (y spam) del destinatario.`,
      });
    } catch (error) {
      console.error('Error al generar o enviar tablero por email:', error);
      res.status(500).json({ error: 'Error al generar o enviar el informe' });
    }
  },
};
