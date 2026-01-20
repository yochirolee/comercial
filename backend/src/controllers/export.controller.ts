import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

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
  const fullPath = path.join(process.cwd(), 'uploads', imagePath);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

function getImageExtension(imagePath: string): 'png' | 'jpeg' | 'gif' {
  const ext = path.extname(imagePath).toLowerCase();
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
  const widthsPdf: number[] = [30, 140]; // Reducido descripción para dar espacio
  const widthsExcel: number[] = [6, 30];

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
function renderPdfHeader(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number, contentWidth: number): number {
  const headerY = doc.y;
  
  // Logo a la izquierda (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    doc.image(logoPath, margin, headerY, { width: 70 });
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
function renderPdfFirma(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number): void {
  // Más espacio antes de la firma para no tapar el texto
  doc.moveDown(4);
  
  // Espacio para la imagen de firma (arriba de la línea)
  const firmaImageY = doc.y;
  const firmaWidth = 180;

  // Imagen de firma (si existe) - arriba de la línea
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    doc.image(firmaPath, margin + 30, firmaImageY, { width: 100, height: 45 });
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
    doc.image(cunoPath, margin + firmaWidth + 20, firmaImageY + 10, { width: 70, height: 70 });
  }
}

// ==========================================
// EXCEL - HEADER COMÚN
// ==========================================
function renderExcelHeader(
  worksheet: ExcelJS.Worksheet, 
  workbook: ExcelJS.Workbook,
  empresa: EmpresaInfo, 
  lastCol: string
): number {
  let row = 1;

  // Logo (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    const logoImage = workbook.addImage({
      filename: logoPath,
      extension: getImageExtension(logoPath),
    });
    worksheet.addImage(logoImage, {
      tl: { col: 0, row: row - 1 },
      ext: { width: 70, height: 50 },
    });
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
): { endRow: number; totalImporte: number; lastCol: string } {
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
function renderExcelFirma(
  worksheet: ExcelJS.Worksheet, 
  workbook: ExcelJS.Workbook,
  empresa: EmpresaInfo, 
  startRow: number
): number {
  let row = startRow + 2;

  // Imagen de firma (si existe) - centrada sobre la sección de firma (columnas A-C)
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    const firmaImage = workbook.addImage({
      filename: firmaPath,
      extension: getImageExtension(firmaPath),
    });
    worksheet.addImage(firmaImage, {
      tl: { col: 1.2, row: row - 1 },
      ext: { width: 100, height: 50 },
    });
    row += 3;
  }

  // Cuño (si existe) - al lado de la firma
  const cunoPath = getImagePath(empresa.cunoEmpresa);
  if (cunoPath) {
    const cunoImage = workbook.addImage({
      filename: cunoPath,
      extension: getImageExtension(cunoPath),
    });
    worksheet.addImage(cunoImage, {
      tl: { col: 3, row: startRow + 1 },
      ext: { width: 70, height: 70 },
    });
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
    const afterHeaderY = renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY;

    // TABLA DE ITEMS (centrada, con total incluido)
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false, true, 'TOTAL CIF');
    doc.y = yPos + 15;

    // TÉRMINOS
    renderPdfTerminos(doc, margin);

    // FIRMA
    renderPdfFirma(doc, empresa, margin);

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
    let row = renderExcelHeader(worksheet, workbook, empresa, lastCol);

    // TABLA DE ITEMS
    const { endRow, totalImporte, numCols } = renderExcelTable(worksheet, oferta.items, row, false);

    // TOTAL CIF como fila de la tabla
    row = renderExcelTotalRow(worksheet, endRow, totalImporte, numCols, lastCol);
    row++; // Espacio

    // TÉRMINOS
    row = renderExcelTerminos(worksheet, row, lastCol);

    // FIRMA
    renderExcelFirma(worksheet, workbook, empresa, row);

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
    const afterHeaderY = renderPdfHeader(doc, empresa, margin, contentWidth);
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
      doc.image(firmaPath, margin + 40, firmaStartY, { width: 100, height: 45 });
    }

    // Cuño (si existe) - al lado de la firma empresa
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      doc.image(cunoPath, margin + firmaWidth + 20, firmaStartY + 10, { width: 70, height: 70 });
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
      const logoImage = workbook.addImage({
        filename: logoPath,
        extension: getImageExtension(logoPath),
      });
      worksheet.addImage(logoImage, {
        tl: { col: 0, row: 0 },
        ext: { width: 70, height: 50 },
      });
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
      const firmaImage = workbook.addImage({
        filename: firmaPath,
        extension: getImageExtension(firmaPath),
      });
      worksheet.addImage(firmaImage, {
        tl: { col: 0.8, row: firmaStartRow - 1 },
        ext: { width: 100, height: 50 },
      });
    }

    // CUÑO
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      const cunoImage = workbook.addImage({
        filename: cunoPath,
        extension: getImageExtension(cunoPath),
      });
      worksheet.addImage(cunoImage, {
        tl: { col: 2.5, row: firmaStartRow - 1 },
        ext: { width: 70, height: 70 },
      });
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
    const afterHeaderY = renderPdfHeader(doc, empresa, margin, contentWidth);
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
      doc.image(firmaPath, margin + 40, firmaStartY, { width: 100, height: 45 });
    }

    // Cuño (si existe) - entre las dos firmas o al lado si no hay firma cliente
    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      doc.image(cunoPath, margin + firmaWidth + 20, firmaStartY + 10, { width: 70, height: 70 });
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
      const logoImage = workbook.addImage({
        filename: logoPath,
        extension: getImageExtension(logoPath),
      });
      worksheet.addImage(logoImage, {
        tl: { col: 0, row: row - 1 },
        ext: { width: 70, height: 50 },
      });
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
      const firmaImage = workbook.addImage({
        filename: firmaPath,
        extension: getImageExtension(firmaPath),
      });
      worksheet.addImage(firmaImage, {
        tl: { col: 0.8, row: firmaStartRow - 1 },
        ext: { width: 100, height: 50 },
      });
    }

    const cunoPath = getImagePath(empresa.cunoEmpresa);
    if (cunoPath) {
      const cunoImage = workbook.addImage({
        filename: cunoPath,
        extension: getImageExtension(cunoPath),
      });
      worksheet.addImage(cunoImage, {
        tl: { col: 2.5, row: firmaStartRow - 1 },
        ext: { width: 70, height: 70 },
      });
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
  // FACTURAS (mantenemos funcionalidad existente)
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

    const empresa = await getEmpresaInfo();
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${factura.numero}.pdf`);
    
    doc.pipe(res);

    const pageWidth = 612;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    doc.fontSize(18).font('Helvetica-Bold').text('FACTURA', { align: 'center' });
    doc.moveDown(0.5);

    const headerY = doc.y;
    const logoPath = getImagePath(empresa.logo);
    
    if (logoPath) {
      doc.image(logoPath, margin, headerY, { width: 80 });
    }
    
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(empresa.nombre, margin, headerY, { width: contentWidth, align: 'center' });
    
    doc.fontSize(10).font('Helvetica');
    doc.text(empresa.direccion, margin, headerY + 18, { width: contentWidth, align: 'center' });
    doc.text(`Tel: ${empresa.telefono} | Email: ${empresa.email}`, margin, headerY + 30, { 
      width: contentWidth, 
      align: 'center' 
    });
    
    doc.y = headerY + 60;
    doc.moveDown();
    
    doc.fontSize(10).text('FACTURAR A:', { underline: true });
    doc.text(`${factura.cliente.nombre} ${factura.cliente.apellidos || ''}`);
    if (factura.cliente.direccion) doc.text(factura.cliente.direccion);
    if (factura.cliente.nit) doc.text(`NIT: ${factura.cliente.nit}`);
    doc.moveDown();
    
    doc.text(`Factura N°: ${factura.numero}`);
    doc.text(`Fecha: ${formatDate(factura.fecha)}`);
    if (factura.fechaVencimiento) {
      doc.text(`Vencimiento: ${formatDate(factura.fechaVencimiento)}`);
    }
    doc.text(`Estado: ${factura.estado.toUpperCase()}`);
    doc.moveDown();

    const startX = 50;
    let y = doc.y;
    doc.fontSize(9);
    doc.text('Descripción', startX, y, { width: 180 });
    doc.text('Cant.', startX + 180, y, { width: 40 });
    doc.text('Unidad', startX + 220, y, { width: 40 });
    doc.text('P. Unit.', startX + 270, y, { width: 60, align: 'right' });
    doc.text('Subtotal', startX + 350, y, { width: 70, align: 'right' });
    
    doc.moveTo(startX, doc.y + 5).lineTo(500, doc.y + 5).stroke();
    doc.moveDown();

    for (const item of factura.items) {
      y = doc.y;
      const descripcion = item.descripcion || item.producto.nombre;
      doc.text(descripcion, startX, y, { width: 180 });
      doc.text(item.cantidad.toString(), startX + 180, y, { width: 40 });
      doc.text(item.producto.unidadMedida.abreviatura, startX + 220, y, { width: 40 });
      doc.text(`$${formatCurrency(item.precioUnitario)}`, startX + 270, y, { width: 60, align: 'right' });
      doc.text(`$${formatCurrency(item.subtotal)}`, startX + 350, y, { width: 70, align: 'right' });
      doc.moveDown(0.5);
    }

    doc.moveTo(startX, doc.y + 5).lineTo(500, doc.y + 5).stroke();
    doc.moveDown();
    
    doc.text(`Subtotal: $${formatCurrency(factura.subtotal)}`, { align: 'right' });
    if (factura.impuestos > 0) {
      doc.text(`Impuestos: $${formatCurrency(factura.impuestos)}`, { align: 'right' });
    }
    if (factura.descuento > 0) {
      doc.text(`Descuento: $${formatCurrency(factura.descuento)}`, { align: 'right' });
    }
    doc.fontSize(14).text(`TOTAL: $${formatCurrency(factura.total)}`, { align: 'right' });

    if (factura.observaciones) {
      doc.moveDown();
      doc.fontSize(10).text('Observaciones:', { underline: true });
      doc.text(factura.observaciones);
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

    const empresa = await getEmpresaInfo();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Factura');

    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'FACTURA';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = '[LOGO]';
    worksheet.mergeCells('B2:F2');
    worksheet.getCell('B2').value = empresa.nombre;
    worksheet.getCell('B2').font = { bold: true, size: 14 };
    worksheet.getCell('B2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('B3:F3');
    worksheet.getCell('B3').value = empresa.direccion;
    worksheet.getCell('B3').alignment = { horizontal: 'center' };

    worksheet.getCell('A5').value = 'Cliente:';
    worksheet.getCell('B5').value = `${factura.cliente.nombre} ${factura.cliente.apellidos || ''}`;
    worksheet.getCell('A6').value = 'NIT Cliente:';
    worksheet.getCell('B6').value = factura.cliente.nit || '-';
    worksheet.getCell('A7').value = 'Factura N°:';
    worksheet.getCell('B7').value = factura.numero;
    worksheet.getCell('A8').value = 'Fecha:';
    worksheet.getCell('B8').value = formatDate(factura.fecha);
    worksheet.getCell('A9').value = 'Estado:';
    worksheet.getCell('B9').value = factura.estado.toUpperCase();

    const headerRow = worksheet.getRow(11);
    headerRow.values = ['Código', 'Descripción', 'Cantidad', 'Unidad', 'P. Unitario', 'Subtotal'];
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    let rowIndex = 12;
    for (const item of factura.items) {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        item.producto.codigo || '-',
        item.descripcion || item.producto.nombre,
        item.cantidad,
        item.producto.unidadMedida.abreviatura,
        item.precioUnitario,
        item.subtotal,
      ];
      row.getCell(5).numFmt = '"$"#,##0.00';
      row.getCell(6).numFmt = '"$"#,##0.00';
      rowIndex++;
    }

    rowIndex++;
    worksheet.getCell(`E${rowIndex}`).value = 'Subtotal:';
    worksheet.getCell(`F${rowIndex}`).value = factura.subtotal;
    worksheet.getCell(`F${rowIndex}`).numFmt = '"$"#,##0.00';
    
    if (factura.impuestos > 0) {
      rowIndex++;
      worksheet.getCell(`E${rowIndex}`).value = 'Impuestos:';
      worksheet.getCell(`F${rowIndex}`).value = factura.impuestos;
      worksheet.getCell(`F${rowIndex}`).numFmt = '"$"#,##0.00';
    }
    
    if (factura.descuento > 0) {
      rowIndex++;
      worksheet.getCell(`E${rowIndex}`).value = 'Descuento:';
      worksheet.getCell(`F${rowIndex}`).value = factura.descuento;
      worksheet.getCell(`F${rowIndex}`).numFmt = '"$"#,##0.00';
    }
    
    rowIndex++;
    worksheet.getCell(`E${rowIndex}`).value = 'TOTAL:';
    worksheet.getCell(`E${rowIndex}`).font = { bold: true };
    worksheet.getCell(`F${rowIndex}`).value = factura.total;
    worksheet.getCell(`F${rowIndex}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${rowIndex}`).font = { bold: true };

    worksheet.columns = [
      { width: 12 }, { width: 35 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 15 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${factura.numero}.xlsx`);
    
    await workbook.xlsx.write(res);
  },
};
