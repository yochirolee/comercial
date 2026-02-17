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
    const isRemote = imagePath.startsWith('http://') || imagePath.startsWith('https://');
    
    if (isRemote) {
      const buffer = await fetchImageBuffer(imagePath);
      if (buffer) {
        doc.image(buffer, x, y, options);
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
    cantidadSacos: false,
    pesoXSaco: false,
    precioXSaco: false,
    cantidadCajas: false,
    pesoXCaja: false,
    precioXCaja: false,
  };

  for (const item of items) {
    if (item.cantidadSacos !== null && item.cantidadSacos !== undefined) fields.cantidadSacos = true;
    if (item.pesoXSaco !== null && item.pesoXSaco !== undefined) fields.pesoXSaco = true;
    if (item.precioXSaco !== null && item.precioXSaco !== undefined) fields.precioXSaco = true;
    if (item.cantidadCajas !== null && item.cantidadCajas !== undefined) fields.cantidadCajas = true;
    if (item.pesoXCaja !== null && item.pesoXCaja !== undefined) fields.pesoXCaja = true;
    if (item.precioXCaja !== null && item.precioXCaja !== undefined) fields.precioXCaja = true;
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

function buildDynamicColumns(items: any[]): DynamicColumns {
  const optionalFields = detectOptionalFields(items);
  
  // Columnas base: ITEM, DESCRIPCION
  const headers: string[] = ['ITEM', 'DESCRIPCION'];
  const widthsPdf: number[] = [30, 200]; // Descripción más ancha para tablas con pocas columnas
  const widthsExcel: number[] = [6, 45];

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

  // Columnas finales: CANT. LBS (o CANT.), PRECIO X LB (o PRECIO), IMPORTE
  headers.push('CANT.\nLBS', 'PRECIO\nX LB', 'IMPORTE');
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
  totalLabel: string = 'TOTAL CIF'
): { yPos: number; totalImporte: number; tableLeft: number; tableWidth: number; lastColWidth: number } {
  const { headers, widthsPdf, optionalFields } = buildDynamicColumns(items);
  
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
    const cantidadLbs = item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    const importe = cantidadLbs * precioXLb;
    totalImporte += importe;
    
    xPos = tableLeft;
    let colIndex = 0;
    
    // ITEM
    doc.text(String(itemNum), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'center' });
    xPos += widthsPdf[colIndex++];
    
    // DESCRIPCION
    doc.text(item.producto.nombre, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6 });
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
    
    // CANTIDAD LBS
    doc.text(formatCurrency(cantidadLbs), xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // PRECIO X LB
    doc.text(`$${formatCurrency(precioXLb)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    xPos += widthsPdf[colIndex++];
    
    // IMPORTE
    doc.text(`$${formatCurrency(importe)}`, xPos + 3, yPos, { width: widthsPdf[colIndex] - 6, align: 'right' });
    
    yPos += 16;
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
  usePrecioAjustado: boolean = false
): { endRow: number; totalImporte: number; lastCol: string; numCols: number } {
  const { headers, widthsExcel, optionalFields } = buildDynamicColumns(items);
  
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
    const values: (string | number)[] = [itemNum, item.producto.nombre];
    
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
    let colIdx = 3;
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
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // TÉRMINOS
    row = renderExcelTerminos(worksheet, row, lastCol);

    // FIRMA
    await renderExcelFirma(worksheet, workbook, empresa, row);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=oferta-general-${oferta.numero || 'sin-numero'}.xlsx`);
    
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

    // TÉRMINOS + Puerto + Origen + Moneda
    doc.font('Helvetica').fontSize(9);
    doc.text(`TERMINOS Y CONDICIONES: ${oferta.terminosPago || 'PAGO 100% ANTES DEL EMBARQUE'}`, margin, doc.y);
    doc.text(`PUERTO DE EMBARQUE: ${oferta.puertoEmbarque || 'NEW ORLEANS, LA'}`);
    doc.text(`ORIGEN: ${oferta.origen || 'ESTADOS UNIDOS'}`);
    doc.text(`MONEDA: ${oferta.moneda || 'USD'}`);

    // FIRMAS - Si incluye firma cliente, ambas en la misma línea
    doc.moveDown(4);
    
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
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

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

    // FIRMAS - Empresa a la izquierda, Cliente a la derecha (en la misma fila)
    const firmaStartRow = row + 2;

    // FIRMA EMPRESA - Imagen
    const firmaPath = getImagePath(empresa.firmaPresidente);
    if (firmaPath) {
      await addImageToExcel(workbook, worksheet, firmaPath, { col: 0.8, row: firmaStartRow - 1 }, { width: 100, height: 50 });
    }

    // CUÑO
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      await addImageToExcel(workbook, worksheet, cunoPath, { col: 2.5, row: firmaStartRow - 1 }, { width: 70, height: 70 });
    }

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

    // TOTALES: FOB, FLETE, SEGURO, CIF (alineados con la tabla)
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`TOTAL FOB: $${formatCurrency(totalImporte)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`FLETE: $${formatCurrency(oferta.flete || 0)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
    doc.text(`SEGURO: $${formatCurrency(seguro)}`, margin, doc.y, { width: tableWidth, align: 'right' });
    doc.moveDown(0.3);
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
    const { endRow, totalImporte, lastCol } = renderExcelTable(worksheet, oferta.items, tableStartRow, true);

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
    worksheet.getCell(`${prevCol}${row}`).value = 'SEGURO:';
    worksheet.getCell(`${prevCol}${row}`).font = { bold: true };
    worksheet.getCell(`${prevCol}${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`${lastCol}${row}`).value = seguro;
    worksheet.getCell(`${lastCol}${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`${lastCol}${row}`).font = { bold: true };
    row++;

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
      await addImageToExcel(workbook, worksheet, firmaPath, { col: 0.8, row: firmaStartRow - 1 }, { width: 100, height: 50 });
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
  // FACTURAS (formato original)
  // ==========================================
  async facturaPdf(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const factura = await prisma.factura.findUnique({
        where: { id },
        include: {
          cliente: true,
          importadora: true,
          items: {
            include: {
              producto: {
                include: { unidadMedida: true },
              },
            },
          },
        },
      });

      if (!factura) {
        res.status(404).json({ error: 'Factura no encontrada' });
        return;
      }

      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="factura_${factura.numero}.pdf"`);
        res.send(Buffer.concat(chunks));
      });
      doc.on('error', (error) => {
        console.error('Error al generar PDF:', error);
        res.status(500).json({ error: 'Error al generar PDF' });
      });

      doc.fontSize(20).font('Helvetica-Bold').text(`FACTURA ${factura.numero}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Cliente: ${factura.cliente.nombre} ${factura.cliente.apellidos || ''}`, { align: 'center' });
      if (factura.importadora) {
        doc.text(`Importadora: ${factura.importadora.nombre}`, { align: 'center' });
      }
      doc.text(`Fecha: ${new Date(factura.fecha).toLocaleDateString('es-ES')}`, { align: 'center' });
      if (factura.fechaVencimiento) {
        doc.text(`Vencimiento: ${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}`, { align: 'center' });
      }
      doc.text(`Estado: ${factura.estado}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(14).font('Helvetica-Bold').text('ITEMS', { underline: true });
      doc.moveDown();

      let y = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Producto', 50, y);
      doc.text('Cantidad', 300, y);
      doc.text('Precio Unit.', 380, y);
      doc.text('Subtotal', 460, y);
      y += 20;

      doc.fontSize(9).font('Helvetica');
      factura.items.forEach((item) => {
        doc.text(item.producto.nombre, 50, y);
        doc.text(`${item.cantidad} ${item.producto.unidadMedida.abreviatura}`, 300, y);
        doc.text(`$${item.precioUnitario.toFixed(2)}`, 380, y);
        doc.text(`$${item.subtotal.toFixed(2)}`, 460, y);
        y += 15;
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
      });

      doc.moveDown();
      doc.fontSize(10).font('Helvetica');
      doc.text(`Subtotal: $${factura.subtotal.toFixed(2)}`, 380, doc.y);
      doc.text(`Flete: $${factura.flete.toFixed(2)}`, 380, doc.y + 15);
      if (factura.tieneSeguro) {
        doc.text(`Seguro: $${factura.seguro.toFixed(2)}`, 380, doc.y + 15);
      }
      if (factura.impuestos > 0) {
        doc.text(`Impuestos: $${factura.impuestos.toFixed(2)}`, 380, doc.y + 15);
      }
      if (factura.descuento > 0) {
        doc.text(`Descuento: $${factura.descuento.toFixed(2)}`, 380, doc.y + 15);
      }
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`TOTAL: $${factura.total.toFixed(2)}`, 380, doc.y);

      if (factura.observaciones) {
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Observaciones: ${factura.observaciones}`);
      }

      doc.end();
    } catch (error) {
      console.error('Error al generar PDF:', error);
      res.status(500).json({ error: 'Error al generar PDF' });
    }
  },

  async facturaExcel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const factura = await prisma.factura.findUnique({
        where: { id },
        include: {
          cliente: true,
          importadora: true,
          items: {
            include: {
              producto: {
                include: { unidadMedida: true },
              },
            },
          },
        },
      });

      if (!factura) {
        res.status(404).json({ error: 'Factura no encontrada' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Factura');
      
      sheet.columns = [
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'Unidad', key: 'unidad', width: 12 },
        { header: 'Precio Unitario', key: 'precioUnitario', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
      ];

      factura.items.forEach((item) => {
        sheet.addRow({
          producto: item.producto.nombre,
          cantidad: item.cantidad,
          unidad: item.producto.unidadMedida.abreviatura,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
        });
      });

      sheet.addRow({});
      sheet.addRow({
        producto: 'Subtotal',
        subtotal: factura.subtotal,
      });
      sheet.addRow({
        producto: 'Flete',
        subtotal: factura.flete,
      });
      if (factura.tieneSeguro) {
        sheet.addRow({
          producto: 'Seguro',
          subtotal: factura.seguro,
        });
      }
      if (factura.impuestos > 0) {
        sheet.addRow({
          producto: 'Impuestos',
          subtotal: factura.impuestos,
        });
      }
      if (factura.descuento > 0) {
        sheet.addRow({
          producto: 'Descuento',
          subtotal: -factura.descuento,
        });
      }
      sheet.addRow({
        producto: 'TOTAL',
        subtotal: factura.total,
      });

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="factura_${factura.numero}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error al generar Excel:', error);
      res.status(500).json({ error: 'Error al generar Excel' });
    }
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
      const { search, activo } = req.query;
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
};
