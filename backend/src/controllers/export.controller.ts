import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Cache para imágenes descargadas (evita descargar múltiples veces)
const imageCache: Map<string, Buffer> = new Map();

// Función para descargar imagen remota y obtener buffer
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    // Verificar cache
    if (imageCache.has(url)) {
      return imageCache.get(url)!;
    }
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    
    // Guardar en cache
    imageCache.set(url, buffer);
    
    return buffer;
  } catch (error) {
    console.error('Error fetching image:', url, error);
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
    const isRemote = imagePath.startsWith('http://') || imagePath.startsWith('https://');
    
    if (isRemote) {
      const buffer = await fetchImageBuffer(imagePath);
      if (!buffer) return;
      
      const ext = getImageExtension(imagePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageId = workbook.addImage({
        buffer: buffer as any,
        extension: ext,
      });
      worksheet.addImage(imageId, {
        tl: position,
        ext: size,
      });
    } else {
      // Archivo local
      if (!fs.existsSync(imagePath)) return;
      
      const imageId = workbook.addImage({
        filename: imagePath,
        extension: getImageExtension(imagePath),
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

// Función para obtener imagen para PDFKit (buffer para URLs, path para locales)
async function getImageForPdf(imagePath: string): Promise<Buffer | string | null> {
  if (!imagePath) return null;
  
  const isRemote = imagePath.startsWith('http://') || imagePath.startsWith('https://');
  
  if (isRemote) {
    return await fetchImageBuffer(imagePath);
  } else {
    // Archivo local
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
    return null;
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
  const empresa = await prisma.empresa.findFirst();
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
  if (!imagePath) return null;
  
  // Si es una URL de Cloudinary u otra URL remota, devolverla tal cual
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si es un path local, buscar en uploads/
  const fullPath = path.join(process.cwd(), 'uploads', imagePath);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

function getImageExtension(imagePath: string): 'png' | 'jpeg' | 'gif' {
  // Extraer extensión de URL o path
  let ext = '';
  if (imagePath.includes('?')) {
    // URL con query params
    ext = path.extname(imagePath.split('?')[0]).toLowerCase();
  } else {
    ext = path.extname(imagePath).toLowerCase();
  }
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.gif') return 'gif';
  return 'png';
}

// ==========================================
// COLUMNAS DE TABLA - DINÁMICAS según campos con valores
// ==========================================

// Campos opcionales que se pueden mostrar
interface OptionalFields {
  cantidadSacos: boolean;
  pesoXSaco: boolean;
  precioXSaco: boolean;
  cantidadCajas: boolean;
  pesoXCaja: boolean;
  precioXCaja: boolean;
  codigoArancelario: boolean;
}

// Detectar qué campos opcionales tienen valores en los items
function detectOptionalFields(items: any[]): OptionalFields {
  const fields: OptionalFields = {
    cantidadSacos: false,
    pesoXSaco: false,
    precioXSaco: false,
    cantidadCajas: false,
    pesoXCaja: false,
    precioXCaja: false,
    codigoArancelario: false,
  };

  for (const item of items) {
    if (item.cantidadSacos !== null && item.cantidadSacos !== undefined) fields.cantidadSacos = true;
    if (item.pesoXSaco !== null && item.pesoXSaco !== undefined) fields.pesoXSaco = true;
    if (item.precioXSaco !== null && item.precioXSaco !== undefined) fields.precioXSaco = true;
    if (item.cantidadCajas !== null && item.cantidadCajas !== undefined) fields.cantidadCajas = true;
    if (item.pesoXCaja !== null && item.pesoXCaja !== undefined) fields.pesoXCaja = true;
    if (item.precioXCaja !== null && item.precioXCaja !== undefined) fields.precioXCaja = true;
    if (item.codigoArancelario !== null && item.codigoArancelario !== undefined && item.codigoArancelario !== '') fields.codigoArancelario = true;
  }

  return fields;
}

// Construir headers y anchos dinámicamente
interface DynamicColumns {
  headers: string[];
  widthsPdf: number[];
  widthsExcel: number[];
  optionalFields: OptionalFields;
}

function buildDynamicColumns(items: any[], unidadMedida?: string): DynamicColumns {
  const optionalFields = detectOptionalFields(items);
  
  // Determinar unidad de medida (usar la del primer producto o 'LB' por defecto)
  const unidad = unidadMedida || items[0]?.producto?.unidadMedida?.abreviatura || 'LB';
  
  // Contar columnas opcionales para ajustar ancho de descripción
  let numOptionalCols = 0;
  if (optionalFields.cantidadSacos) numOptionalCols++;
  if (optionalFields.pesoXSaco) numOptionalCols++;
  if (optionalFields.precioXSaco) numOptionalCols++;
  if (optionalFields.cantidadCajas) numOptionalCols++;
  if (optionalFields.pesoXCaja) numOptionalCols++;
  if (optionalFields.precioXCaja) numOptionalCols++;
  if (optionalFields.codigoArancelario) numOptionalCols++;
  
  // Columnas base: ITEM, DESCRIPCION, UM (ajustar ancho según columnas opcionales)
  const headers: string[] = ['ITEM', 'DESCRIPCION', 'UM'];
  // Si hay muchas columnas, reducir descripción; si hay pocas, ampliarla
  const descWidthPdf = numOptionalCols >= 4 ? 100 : numOptionalCols >= 2 ? 130 : 170;
  const descWidthExcel = numOptionalCols >= 4 ? 25 : numOptionalCols >= 2 ? 30 : 38;
  const widthsPdf: number[] = [30, descWidthPdf, 25];
  const widthsExcel: number[] = [6, descWidthExcel, 6];

  // Agregar campos opcionales en orden lógico
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
  if (optionalFields.codigoArancelario) {
    headers.push('PARTIDA\nARANCELARIA');
    widthsPdf.push(75);
    widthsExcel.push(16);
  }

  // Columnas finales: usar unidad de medida del producto
  headers.push(`CANT.\n${unidad}`, `PRECIO\nX ${unidad}`, 'IMPORTE');
  widthsPdf.push(55, 55, 70);
  widthsExcel.push(11, 11, 13);

  return { headers, widthsPdf, widthsExcel, optionalFields };
}

// ==========================================
// PDF - HEADER COMÚN (Empresa primero, luego título)
// ==========================================
async function renderPdfHeader(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number, contentWidth: number): Promise<number> {
  const headerY = doc.y;
  
  // Logo a la izquierda (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    const imageData = await getImageForPdf(logoPath);
    if (imageData) {
      doc.image(imageData, margin, headerY, { width: 120, height: 45 });
    }
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
  totalLabel: string = 'TOTAL CIF'
): { yPos: number; totalImporte: number; tableLeft: number; tableWidth: number; lastColWidth: number } {
  // Obtener unidad de medida del primer item
  const unidadMedida = items[0]?.producto?.unidadMedida?.abreviatura;
  const { headers, widthsPdf, optionalFields } = buildDynamicColumns(items, unidadMedida);
  
  const tableTop = doc.y;
  const tableWidth = widthsPdf.reduce((a, b) => a + b, 0);
  // Tabla alineada a la izquierda
  const tableLeft = margin;
  const HEADER_HEIGHT = 28;
  const lastColWidth = widthsPdf[widthsPdf.length - 1];
  
  // Fondo gris para encabezados
  doc.rect(tableLeft, tableTop, tableWidth, HEADER_HEIGHT).fill('#e8e8e8');
  doc.fillColor('#000');
  
  // Encabezados
  doc.font('Helvetica-Bold').fontSize(7);
  let xPos = tableLeft;
  const headerTextY = tableTop + 4;
  
  headers.forEach((header, i) => {
    const align = i <= 1 ? 'left' : 'center';
    doc.text(header, xPos + 2, headerTextY, { width: widthsPdf[i] - 4, align, lineGap: 1 });
    xPos += widthsPdf[i];
  });
  
  // Línea después de encabezados
  doc.moveTo(tableLeft, tableTop + HEADER_HEIGHT).lineTo(tableLeft + tableWidth, tableTop + HEADER_HEIGHT).stroke();
  
  // Items
  doc.font('Helvetica').fontSize(8);
  let yPos = tableTop + HEADER_HEIGHT + 6;
  let itemNum = 1;
  let totalImporte = 0;

  for (const item of items) {
    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    // Usar subtotal guardado si existe, sino calcular
    const importe = item.subtotal != null ? item.subtotal : cantidadParaCalculo * precioXLb;
    totalImporte += importe;
    
    xPos = tableLeft;
    let colIndex = 0;
    
    // Calcular altura de la descripción para ajustar la fila
    const descWidth = widthsPdf[1] - 6; // Columna de descripción es la segunda (índice 1)
    const descHeight = doc.heightOfString(item.producto.nombre, { width: descWidth });
    const rowHeight = Math.max(16, descHeight + 4); // Mínimo 16, o altura del texto + padding
    
    // ITEM
    doc.text(String(itemNum), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
    xPos += widthsPdf[colIndex++];
    
    // DESCRIPCION
    doc.text(item.producto.nombre, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6 });
    xPos += widthsPdf[colIndex++];
    
    // UM
    const um = item.producto?.unidadMedida?.abreviatura || '-';
    doc.text(um, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
    xPos += widthsPdf[colIndex++];
    
    // Campos opcionales
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
    if (optionalFields.codigoArancelario) {
      const val = item.codigoArancelario || '-';
      doc.text(val, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
      xPos += widthsPdf[colIndex++];
    }
    
    // CANTIDAD LBS
    doc.text(formatCurrency(item.cantidad), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // PRECIO X LB
    doc.text(`$${formatCurrencyUnitPrice(precioXLb)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // IMPORTE
    doc.text(`$${formatCurrency(importe)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    
    yPos += rowHeight;
    itemNum++;
    
    if (yPos > 650) {
      doc.addPage();
      yPos = 50;
    }
  }

  // Línea separadora antes del total
  doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).stroke();
  
  // Fila de TOTAL (si se solicita)
  if (includeTotal) {
    yPos += 4;
    doc.font('Helvetica-Bold').fontSize(9);
    
    // Calcular posición para "TOTAL CIF:" (penúltima columna) y valor (última columna)
    const totalLabelX = tableLeft + tableWidth - widthsPdf[widthsPdf.length - 1] - widthsPdf[widthsPdf.length - 2];
    const totalValueX = tableLeft + tableWidth - widthsPdf[widthsPdf.length - 1];
    
    doc.text(totalLabel + ':', totalLabelX + 3, yPos, { 
      width: widthsPdf[widthsPdf.length - 2] - 6, 
      align: 'right' 
    });
    doc.text(`$${formatCurrency(totalImporte)}`, totalValueX + 3, yPos, { 
      width: widthsPdf[widthsPdf.length - 1] - 6, 
      align: 'right' 
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
    const firmaData = await getImageForPdf(firmaPath);
    if (firmaData) {
      doc.image(firmaData, margin + 30, firmaImageY, { width: 100, height: 45 });
    }
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
    const cunoData = await getImageForPdf(cunoPath);
    if (cunoData) {
      doc.image(cunoData, margin + firmaWidth + 20, firmaImageY + 10, { width: 70, height: 70 });
    }
  }
}

// ==========================================
// PDF - FIRMA PARA OFERTAS GENERALES (solo texto, sin imágenes ni línea)
// ==========================================
function renderPdfFirmaOfertaGeneral(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number): void {
  // Más espacio antes de la firma
  doc.moveDown(3);
  
  const firmaStartY = doc.y;
  const firmaWidth = 180;
  
  // Texto firma empresa (alineado a la izquierda)
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(empresa.representante, margin, firmaStartY, { width: firmaWidth, align: 'left' });
  doc.font('Helvetica').fontSize(9);
  doc.text(empresa.cargoRepresentante, margin, firmaStartY + 13, { width: firmaWidth, align: 'left' });
  doc.text(empresa.nombre, margin, firmaStartY + 26, { width: firmaWidth, align: 'left' });
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

  // Logo (si existe) - más ancho para logos rectangulares
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 130, height: 45 });
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
  usePrecioAjustado: boolean = false
): { endRow: number; totalImporte: number; lastCol: string; numCols: number } {
  // Obtener unidad de medida del primer item
  const unidadMedida = items[0]?.producto?.unidadMedida?.abreviatura;
  const { headers, widthsExcel, optionalFields } = buildDynamicColumns(items, unidadMedida);
  
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
    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    // Usar subtotal guardado si existe, sino calcular
    const importe = item.subtotal != null ? item.subtotal : cantidadParaCalculo * precioXLb;
    totalImporte += importe;

    // Construir valores dinámicamente
    const um = item.producto?.unidadMedida?.abreviatura || '-';
    const values: (string | number)[] = [itemNum, item.producto.nombre, um];
    
    if (optionalFields.cantidadSacos) values.push(item.cantidadSacos ?? '-');
    if (optionalFields.pesoXSaco) values.push(item.pesoXSaco ?? '-');
    if (optionalFields.precioXSaco) values.push(item.precioXSaco ?? '-');
    if (optionalFields.cantidadCajas) values.push(item.cantidadCajas ?? '-');
    if (optionalFields.pesoXCaja) values.push(item.pesoXCaja ?? '-');
    if (optionalFields.precioXCaja) values.push(item.precioXCaja ?? '-');
    if (optionalFields.codigoArancelario) values.push(item.codigoArancelario ?? '-');
    
    values.push(item.cantidad, precioXLb, importe);
    
    dataRow.values = values;

    // Formateo de celdas
    dataRow.getCell(1).alignment = { horizontal: 'center' };
    
    // Descripción con wrapText para textos largos
    dataRow.getCell(2).alignment = { wrapText: true, vertical: 'bottom' };
    // Calcular altura según longitud del texto
    const descText = item.producto.nombre || '';
    const charsPerLine = 25; // aproximado según ancho de columna
    const numLines = Math.ceil(descText.length / charsPerLine);
    // Altura: 18 base + 12 por cada línea adicional
    dataRow.height = numLines > 1 ? 16 + (numLines * 12) : 18;
    
    // UM - centrado
    dataRow.getCell(3).alignment = { horizontal: 'center' };
    
    // Índices de las últimas 3 columnas (cantidad, precio, importe)
    const numCols = values.length;
    dataRow.getCell(numCols - 2).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols - 2).numFmt = '#,##0.00';
    dataRow.getCell(numCols - 1).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols - 1).numFmt = '"$"#,##0.000';
    dataRow.getCell(numCols).alignment = { horizontal: 'right' };
    dataRow.getCell(numCols).numFmt = '"$"#,##0.00';
    
    // Formatear campos opcionales de precio con $
    let colIdx = 4; // Después de ITEM (1), DESCRIPCION (2), UM (3)
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

  // Imagen de firma (si existe) - centrada sobre la sección de firma
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    await addImageToExcel(workbook, worksheet, firmaPath, { col: 1.8, row: row - 1 }, { width: 100, height: 50 });
    row += 3;
  }

  // Cuño (si existe) - al lado de la firma
  const cunoPath = getImagePath(empresa.cunoEmpresa);
  if (cunoPath) {
    await addImageToExcel(workbook, worksheet, cunoPath, { col: 2.5, row: startRow + 1 }, { width: 70, height: 70 });
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
// EXCEL - FIRMA PARA OFERTAS GENERALES (solo texto, sin imágenes ni línea)
// ==========================================
function renderExcelFirmaOfertaGeneral(
  worksheet: ExcelJS.Worksheet, 
  empresa: EmpresaInfo, 
  startRow: number
): number {
  let row = startRow + 2;

  // Texto firma empresa (alineado a la izquierda, sin línea, sin imágenes)
  worksheet.getCell(`A${row}`).value = empresa.representante;
  worksheet.getCell(`A${row}`).font = { bold: true };
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
  row++;

  worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
  row++;

  worksheet.getCell(`A${row}`).value = empresa.nombre;
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
  row++;

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
    res.setHeader('Content-Disposition', `attachment; filename=oferta-general-${oferta.numero || 'sin-numero'}.pdf`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // HEADER COMÚN (empresa primero, luego título)
    const afterHeaderY = await renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY;

    // TABLA DE ITEMS (centrada, con total incluido)
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false, true, 'TOTAL CIF');
    doc.y = yPos + 15;

    // TÉRMINOS
    renderPdfTerminos(doc, margin);

    // FIRMA (solo texto, sin imágenes ni línea)
    renderPdfFirmaOfertaGeneral(doc, empresa, margin);

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
    const unidadMedida = oferta.items[0]?.producto?.unidadMedida?.abreviatura;
    const { headers } = buildDynamicColumns(oferta.items, unidadMedida);
    const lastColIndex = headers.length;
    const lastCol = lastColIndex <= 26 
      ? String.fromCharCode(64 + lastColIndex) 
      : 'A' + String.fromCharCode(64 + lastColIndex - 26);

    // HEADER (empresa + título)
    let row = await renderExcelHeader(worksheet, workbook, empresa, lastCol);

    // TABLA DE ITEMS
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // TÉRMINOS
    row = renderExcelTerminos(worksheet, row, lastCol);

    // FIRMA (solo texto, sin imágenes ni línea)
    row = renderExcelFirmaOfertaGeneral(worksheet, empresa, row);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=oferta-general-${oferta.numero || 'sin-numero'}.xlsx`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // TIPO 2: OFERTA CLIENTE
  // Muestra: OFERTA NO, Fecha, CONSIGNADO A, Dirección, NIT, ANEXO-1
  //          Tabla, TOTAL CIF, Texto de Validez (campoExtra1), Firma (solo texto, sin imágenes)
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
    res.setHeader('Content-Disposition', `attachment; filename=oferta-${oferta.numero}.pdf`);
    
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
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false, true, 'TOTAL CIF');
    doc.y = yPos + 15;

    // CAMPO DE VALIDEZ (campoExtra1)
    if (oferta.campoExtra1) {
      doc.font('Helvetica').fontSize(9);
      doc.text(oferta.campoExtra1, margin, doc.y, { align: 'left' });
      doc.moveDown(1);
    }

    // FIRMA - Solo texto (sin imagen, sin línea)
    doc.moveDown(3);
    
    const firmaStartY = doc.y;
    
    // Texto firma empresa (alineado a la izquierda)
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(empresa.representante, margin, firmaStartY, { align: 'left' });
    doc.font('Helvetica').fontSize(9);
    doc.text(empresa.cargoRepresentante, margin, firmaStartY + 13, { align: 'left' });
    doc.text(empresa.nombre, margin, firmaStartY + 26, { align: 'left' });

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
    const unidadMedida = oferta.items[0]?.producto?.unidadMedida?.abreviatura;
    const { headers } = buildDynamicColumns(oferta.items, unidadMedida);
    const lastColIndex = headers.length;
    const lastCol = lastColIndex <= 26 
      ? String.fromCharCode(64 + lastColIndex) 
      : 'A' + String.fromCharCode(64 + lastColIndex - 26);

    let row = 1;

    // LOGO (si existe) - más ancho para logos rectangulares
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: 0 }, { width: 130, height: 45 });
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
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // CAMPO DE VALIDEZ (campoExtra1)
    if (oferta.campoExtra1) {
      worksheet.mergeCells(`A${row}:${lastCol}${row}`);
      worksheet.getCell(`A${row}`).value = oferta.campoExtra1;
      worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
      row++;
    }

    // FIRMA - Solo texto (sin imagen, sin línea)
    row += 2;

    // Texto firma empresa (alineado a la izquierda)
    worksheet.getCell(`A${row}`).value = empresa.representante;
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
    row++;

    worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
    row++;

    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=oferta-${oferta.numero}.xlsx`);
    
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
    res.setHeader('Content-Disposition', `attachment; filename=oferta-importadora-${oferta.numero}.pdf`);
    
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
    const { yPos, totalImporte, tableLeft, tableWidth, lastColWidth } = renderPdfTable(doc, oferta.items, margin, true, false);
    doc.y = yPos + 5;

    // TOTALES: FOB, FLETE, SEGURO (si tiene), CIF (alineados con la tabla)
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`TOTAL FOB: $${formatCurrency(totalImporte)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`FLETE: $${formatCurrency(oferta.flete || 0)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
    // Solo mostrar seguro si tiene seguro
    if (oferta.tieneSeguro && seguro > 0) {
      doc.text(`SEGURO: $${formatCurrency(seguro)}`, margin, doc.y, { width: tableWidth, align: 'right' });
      doc.moveDown(0.3);
    }
    doc.text(`TOTAL CIF: $${formatCurrency(totalCIF)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    
    doc.moveDown(1.5);

    // TÉRMINOS + Puerto + Origen + Moneda
    doc.font('Helvetica').fontSize(9);
    doc.text(`TERMINOS Y CONDICIONES: ${oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE'}`, margin, doc.y);
    doc.text(`PUERTO DE EMBARQUE: ${oferta.puertoEmbarque || 'NEW ORLEANS, LA'}`);
    doc.text(`ORIGEN: ${oferta.origen || 'ESTADOS UNIDOS'}`);
    doc.text(`MONEDA: ${oferta.moneda || 'USD'}`);

    // FIRMAS
    doc.moveDown(4);
    
    const firmaStartY = doc.y;
    const firmaWidth = 180;
    const incluyeFirmaCliente = oferta.incluyeFirmaCliente !== false; // Por defecto true para importadora
    const firmaClienteX = pageWidth - margin - firmaWidth;

    // Imagen de firma empresa (si existe)
    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      const firmaData = await getImageForPdf(firmaPath);
      if (firmaData) {
        doc.image(firmaData, margin + 40, firmaStartY, { width: 100, height: 45 });
      }
    }

    // Cuño (si existe) - entre las dos firmas o al lado si no hay firma cliente
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
    const { endRow, totalImporte, lastCol } = renderExcelTable(worksheet, oferta.items, tableStartRow, true);

    // Llenar header con lastCol correcto
    let row = 1;

    // Logo (si existe) - más ancho para logos rectangulares
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 130, height: 45 });
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
    // Solo mostrar seguro si tiene seguro
    if (oferta.tieneSeguro && seguro > 0) {
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

    // TÉRMINOS + Puerto + Origen + Moneda
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `TERMINOS Y CONDICIONES: ${oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `PUERTO DE EMBARQUE: ${oferta.puertoEmbarque || 'NEW ORLEANS, LA'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `ORIGEN: ${oferta.origen || 'ESTADOS UNIDOS'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `MONEDA: ${oferta.moneda || 'USD'}`;
    row++;

    // Firmas
    const firmaStartRow = row + 2;
    const incluyeFirmaCliente = oferta.incluyeFirmaCliente !== false;

    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      await addImageToExcel(workbook, worksheet, firmaPath, { col: 1.8, row: firmaStartRow - 1 }, { width: 100, height: 50 });
    }

    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      await addImageToExcel(workbook, worksheet, cunoPath, { col: 2.5, row: firmaStartRow - 1 }, { width: 70, height: 70 });
    }

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
    res.setHeader('Content-Disposition', `attachment; filename=oferta-importadora-${oferta.numero}.xlsx`);
    
    await workbook.xlsx.write(res);
  },

  // ==========================================
  // FACTURAS - PACKING LIST (nuevo formato)
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
    res.setHeader('Content-Disposition', `attachment; filename=factura-${factura.numero}.pdf`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // TÍTULO: FACTURA - PACKING LIST {numero de oferta cliente}
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text(`FACTURA- PACKING LIST ${numeroOfertaCliente}`, { align: 'center' });
    doc.moveDown(0.5);

    // LOGO (si existe) a la izquierda
    const headerY = doc.y;
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      const logoData = await getImageForPdf(logoPath);
      if (logoData) {
        doc.image(logoData, margin, headerY, { width: 120, height: 45 });
      }
    }

    // DATOS DE EMPRESA (centrado)
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(empresa.nombre, margin, headerY, { width: contentWidth, align: 'center' });
    
    doc.fontSize(10).font('Helvetica');
    doc.text(empresa.direccion, margin, headerY + 16, { width: contentWidth, align: 'center' });
    doc.text(empresa.telefono, margin, headerY + 28, { width: contentWidth, align: 'center' });
    doc.text(empresa.email, margin, headerY + 40, { width: contentWidth, align: 'center' });

    doc.y = headerY + 60;
    doc.moveDown(0.5);

    // CODIGO MINCEX Y FECHA (sin borde)
    const codigoMincex = factura.codigoMincex || empresa.codigoMincex;
    doc.fontSize(10).font('Helvetica');
    doc.text(`CODIGO MINCEX: ${codigoMincex}`, margin, doc.y);
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
    const unidadMedida = factura.items[0]?.producto?.unidadMedida?.abreviatura || 'KG';
    
    // Headers de tabla para factura (con PESO NETO y PESO BRUTO)
    const facturaHeaders = ['PRODUCTO', 'UM'];
    
    // Detectar campos opcionales
    const optionalFields = detectOptionalFields(factura.items);
    
    // Contar columnas opcionales para ajustar ancho de descripción
    let numOptionalCols = 0;
    if (optionalFields.cantidadSacos) numOptionalCols++;
    if (optionalFields.pesoXSaco) numOptionalCols++;
    if (optionalFields.precioXSaco) numOptionalCols++;
    if (optionalFields.cantidadCajas) numOptionalCols++;
    if (optionalFields.codigoArancelario) numOptionalCols++;
    
    // Ajustar ancho de PRODUCTO según columnas opcionales
    const descWidthPdf = numOptionalCols >= 4 ? 100 : numOptionalCols >= 2 ? 140 : 180;
    const facturaWidths = [descWidthPdf, 30];
    
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
    if (optionalFields.codigoArancelario) {
      facturaHeaders.push('PARTIDA\nARANCELARIA');
      facturaWidths.push(70);
    }
    
    // Columnas finales fijas
    facturaHeaders.push(`CANT.\n${unidadMedida}`, 'PESO\nNETO', 'PESO\nBRUTO', `PRECIO\n/${unidadMedida}`, 'IMPORTE');
    facturaWidths.push(45, 45, 45, 50, 60);
    
    const tableWidth = facturaWidths.reduce((a, b) => a + b, 0);
    const tableLeft = margin;
    const HEADER_HEIGHT = 28;
    
    // Fondo gris para encabezados
    doc.rect(tableLeft, tableTop, tableWidth, HEADER_HEIGHT).fill('#e8e8e8');
    doc.fillColor('#000');
    
    // Encabezados
    doc.font('Helvetica-Bold').fontSize(7);
    let xPos = tableLeft;
    const headerTextY = tableTop + 4;
    
    facturaHeaders.forEach((header, i) => {
      doc.text(header, xPos + 2, headerTextY, { width: facturaWidths[i] - 4, align: 'center', lineGap: 1 });
      xPos += facturaWidths[i];
    });
    
    doc.moveTo(tableLeft, tableTop + HEADER_HEIGHT).lineTo(tableLeft + tableWidth, tableTop + HEADER_HEIGHT).stroke();
    
    // Items
    doc.font('Helvetica').fontSize(8);
    let yPos = tableTop + HEADER_HEIGHT + 6;
    let totalImporte = 0;
    let totalPesoNeto = 0;
    let totalPesoBruto = 0;

    for (const item of factura.items) {
      const pesoNeto = item.pesoNeto || item.cantidad;
      const pesoBruto = item.pesoBruto || pesoNeto;
      const importe = item.subtotal;
      totalImporte += importe;
      totalPesoNeto += pesoNeto;
      totalPesoBruto += pesoBruto;
      
      xPos = tableLeft;
      
      // Calcular altura de fila basada en la descripción
      const descWidth = facturaWidths[0] - 6;
      const descHeight = doc.heightOfString(item.producto.nombre, { width: descWidth });
      const rowHeight = Math.max(16, descHeight + 4);
      
      // PRODUCTO
      doc.text(item.producto.nombre, xPos + 2, yPos, { width: facturaWidths[0] - 4 });
      xPos += facturaWidths[0];
      
      // UM
      doc.text(item.producto.unidadMedida.abreviatura, xPos + 2, yPos, { width: facturaWidths[1] - 4, align: 'center' });
      xPos += facturaWidths[1];
      
      let colIdx = 2;
      
      // Campos opcionales
      if (optionalFields.cantidadSacos) {
        doc.text(String(item.cantidadSacos ?? '-'), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.pesoXSaco) {
        doc.text(item.pesoXSaco ? formatCurrency(item.pesoXSaco) : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.precioXSaco) {
        doc.text(item.precioXSaco ? `$${formatCurrency(item.precioXSaco)}` : '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'right' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.cantidadCajas) {
        doc.text(String(item.cantidadCajas ?? '-'), xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
        xPos += facturaWidths[colIdx++];
      }
      if (optionalFields.codigoArancelario) {
        doc.text(item.codigoArancelario || '-', xPos + 2, yPos, { width: facturaWidths[colIdx] - 4, align: 'center' });
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
      
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
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

    // TÉRMINOS Y CONDICIONES
    doc.font('Helvetica').fontSize(9);
    doc.text(`TERMINOS Y CONDICIONES: ${factura.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE'}`, margin, yPos);
    doc.text(`PUERTO DE EMBARQUE: ${factura.puertoEmbarque || 'NEW ORLEANS, LA'}`);
    doc.text(`ORIGEN: ${factura.origen || 'ESTADOS UNIDOS'}`);
    doc.text(`MONEDA: ${factura.moneda || 'USD'}`);

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
    
    if (factura.incluyeFirmaCliente) {
      doc.moveTo(firmaClienteX, firmaLineY).lineTo(firmaClienteX + firmaWidth, firmaLineY).stroke();
    }
    
    // Texto firma empresa
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(empresa.representante, margin, firmaLineY + 5, { width: firmaWidth, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    doc.text(empresa.cargoRepresentante, margin, firmaLineY + 18, { width: firmaWidth, align: 'center' });
    doc.text(empresa.nombre, margin, firmaLineY + 30, { width: firmaWidth, align: 'center' });
    
    // Texto firma cliente
    if (factura.incluyeFirmaCliente) {
      const nombreCliente = factura.firmaClienteNombre || `${factura.cliente.nombre || ''} ${factura.cliente.apellidos || ''}`.trim();
      const cargoCliente = factura.firmaClienteCargo || 'DIRECTOR';
      const empresaCliente = factura.firmaClienteEmpresa || factura.cliente.nombreCompania || '';
      
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

    const unidadMedida = factura.items[0]?.producto?.unidadMedida?.abreviatura || 'KG';
    const optionalFields = detectOptionalFields(factura.items);
    
    // Calcular número de columnas
    let numCols = 7; // PRODUCTO, UM, CANT, PESO NETO, PESO BRUTO, PRECIO, IMPORTE
    if (optionalFields.cantidadSacos) numCols++;
    if (optionalFields.pesoXSaco) numCols++;
    if (optionalFields.precioXSaco) numCols++;
    if (optionalFields.cantidadCajas) numCols++;
    if (optionalFields.codigoArancelario) numCols++;
    
    const lastCol = numCols <= 26 ? String.fromCharCode(64 + numCols) : 'A' + String.fromCharCode(64 + numCols - 26);
    
    let row = 1;

    // TÍTULO: FACTURA - PACKING LIST {numero de oferta cliente}
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `FACTURA- PACKING LIST ${numeroOfertaCliente}`;
    worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    worksheet.getRow(row).height = 22;
    row++;

    // LOGO
    const logoPath = getImagePath(empresa.logo);
    if (logoPath) {
      await addImageToExcel(workbook, worksheet, logoPath, { col: 0, row: row - 1 }, { width: 130, height: 45 });
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
    const codigoMincex = factura.codigoMincex || empresa.codigoMincex;
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `CODIGO MINCEX: ${codigoMincex}`;
    row++;

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
    
    // Contar columnas opcionales para ajustar ancho de descripción
    let numOptionalCols = 0;
    if (optionalFields.cantidadSacos) numOptionalCols++;
    if (optionalFields.pesoXSaco) numOptionalCols++;
    if (optionalFields.precioXSaco) numOptionalCols++;
    if (optionalFields.cantidadCajas) numOptionalCols++;
    if (optionalFields.codigoArancelario) numOptionalCols++;
    
    // Ajustar ancho de PRODUCTO según columnas opcionales
    const descWidthExcel = numOptionalCols >= 4 ? 25 : numOptionalCols >= 2 ? 32 : 40;
    const widths: number[] = [descWidthExcel, 8];
    
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
    if (optionalFields.codigoArancelario) {
      headers.push('PARTIDA\nARANCELARIA');
      widths.push(16);
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
      const pesoNeto = item.pesoNeto || item.cantidad;
      const pesoBruto = item.pesoBruto || pesoNeto;
      const importe = item.subtotal;
      totalImporte += importe;
      totalPesoNeto += pesoNeto;
      totalPesoBruto += pesoBruto;

      const values: (string | number)[] = [item.producto.nombre, item.producto.unidadMedida.abreviatura];
      
      if (optionalFields.cantidadSacos) values.push(item.cantidadSacos ?? '-');
      if (optionalFields.pesoXSaco) values.push(item.pesoXSaco ?? '-');
      if (optionalFields.precioXSaco) values.push(item.precioXSaco ?? '-');
      if (optionalFields.cantidadCajas) values.push(item.cantidadCajas ?? '-');
      if (optionalFields.codigoArancelario) values.push(item.codigoArancelario || '-');
      
      values.push(item.cantidad, pesoNeto, pesoBruto, item.precioUnitario, importe);
      
      const dataRow = worksheet.getRow(row);
      dataRow.values = values;
      
      // Calcular altura basada en la longitud de la descripción
      const descLength = item.producto.nombre.length;
      const avgCharsPerLine = descWidthExcel * 1.2; // Aproximado más conservador
      const numLines = Math.ceil(descLength / avgCharsPerLine);
      dataRow.height = Math.max(24, numLines * 16 + 8); // Mayor altura con padding
      
      // Formatear celdas - descripción centrada verticalmente
      dataRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
      dataRow.getCell(2).alignment = { horizontal: 'center' };
      
      // Últimas 5 columnas (cantidad, peso neto, peso bruto, precio, importe)
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

    // TÉRMINOS Y CONDICIONES
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `TERMINOS Y CONDICIONES: ${factura.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `PUERTO DE EMBARQUE: ${factura.puertoEmbarque || 'NEW ORLEANS, LA'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `ORIGEN: ${factura.origen || 'ESTADOS UNIDOS'}`;
    row++;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    worksheet.getCell(`A${row}`).value = `MONEDA: ${factura.moneda || 'USD'}`;
    worksheet.getRow(row).height = 25;
    row++;

    // FIRMAS
    const firmaStartRow = row + 2;

    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      await addImageToExcel(workbook, worksheet, firmaPath, { col: 0.8, row: firmaStartRow - 1 }, { width: 100, height: 50 });
    }

    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      await addImageToExcel(workbook, worksheet, cunoPath, { col: 1.5, row: firmaStartRow - 1 }, { width: 70, height: 70 });
    }

    row = firmaStartRow + 3;

    // Firma empresa
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = '________________________________';
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    // Firma cliente (si está configurado)
    if (factura.incluyeFirmaCliente) {
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
    
    if (factura.incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const nombreCliente = factura.firmaClienteNombre || `${factura.cliente.nombre || ''} ${factura.cliente.apellidos || ''}`.trim();
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = nombreCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).font = { bold: true };
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = empresa.cargoRepresentante;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (factura.incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const cargoCliente = factura.firmaClienteCargo || 'DIRECTOR';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = cargoCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (factura.incluyeFirmaCliente) {
      const firmaClienteCol = String.fromCharCode(64 + numCols - 1);
      const empresaCliente = factura.firmaClienteEmpresa || factura.cliente.nombreCompania || '';
      worksheet.mergeCells(`${firmaClienteCol}${row}:${lastCol}${row}`);
      worksheet.getCell(`${firmaClienteCol}${row}`).value = empresaCliente;
      worksheet.getCell(`${firmaClienteCol}${row}`).alignment = { horizontal: 'center' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${factura.numero}.xlsx`);
    
    await workbook.xlsx.write(res);
  },
};
