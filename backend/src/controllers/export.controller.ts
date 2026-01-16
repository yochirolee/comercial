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
// COLUMNAS DE TABLA COMUNES
// ITEM | DESCRIPCION | CANT. SACOS | CANT. LBS | PRECIO X LB | IMPORTE
// ==========================================
const TABLE_HEADERS = ['ITEM', 'DESCRIPCION', 'CANT.\nSACOS', 'CANT.\nLBS', 'PRECIO\nX LB', 'IMPORTE'];
const COL_WIDTHS_PDF = [30, 160, 60, 65, 65, 80]; // Total ~460
const COL_WIDTHS_EXCEL = [6, 35, 12, 12, 12, 14];

// ==========================================
// PDF - HEADER COMÚN
// ==========================================
function renderPdfHeader(doc: PDFKit.PDFDocument, empresa: EmpresaInfo, margin: number, contentWidth: number): number {
  // Título: "OFERTA DE VENTAS"
  doc.fontSize(16).font('Helvetica-Bold').text('OFERTA DE VENTAS', { align: 'center' });
  doc.moveDown(0.5);

  const headerY = doc.y;
  
  // Logo a la izquierda (si existe)
  const logoPath = getImagePath(empresa.logo);
  if (logoPath) {
    doc.image(logoPath, margin, headerY, { width: 70 });
  }

  // Empresa centrada
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(empresa.nombre, margin, headerY, { width: contentWidth, align: 'center' });
  
  doc.fontSize(9).font('Helvetica');
  doc.text(empresa.direccion, margin, headerY + 16, { width: contentWidth, align: 'center' });
  doc.text(`${empresa.telefono}, ${empresa.email}`, margin, headerY + 28, { width: contentWidth, align: 'center' });

  return headerY + 50;
}

// ==========================================
// PDF - TABLA DE ITEMS
// ==========================================
function renderPdfTable(
  doc: PDFKit.PDFDocument, 
  items: any[], 
  margin: number,
  usePrecioAjustado: boolean = false
): { yPos: number; totalImporte: number } {
  const tableTop = doc.y;
  const tableLeft = margin;
  const tableWidth = COL_WIDTHS_PDF.reduce((a, b) => a + b, 0);
  const HEADER_HEIGHT = 28; // Altura para encabezados de 2 líneas
  
  // Fondo gris para encabezados
  doc.rect(tableLeft, tableTop, tableWidth, HEADER_HEIGHT).fill('#e8e8e8');
  doc.fillColor('#000');
  
  // Encabezados - centrados verticalmente en la fila
  doc.font('Helvetica-Bold').fontSize(7);
  let xPos = tableLeft;
  const headerTextY = tableTop + 4;
  
  TABLE_HEADERS.forEach((header, i) => {
    const align = i <= 1 ? 'left' : 'center';
    doc.text(header, xPos + 2, headerTextY, { width: COL_WIDTHS_PDF[i] - 4, align, lineGap: 1 });
    xPos += COL_WIDTHS_PDF[i];
  });
  
  // Línea después de encabezados
  doc.moveTo(tableLeft, tableTop + HEADER_HEIGHT).lineTo(tableLeft + tableWidth, tableTop + HEADER_HEIGHT).stroke();
  
  // Items
  doc.font('Helvetica').fontSize(8);
  let yPos = tableTop + HEADER_HEIGHT + 6; // Espacio después de la línea
  let itemNum = 1;
  let totalImporte = 0;

  for (const item of items) {
    const cantidadSacos = item.cantidadCajas || '-';
    const cantidadLbs = item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    const importe = cantidadLbs * precioXLb;
    totalImporte += importe;
    
    xPos = tableLeft;
    
    // ITEM
    doc.text(String(itemNum), xPos + 3, yPos, { width: COL_WIDTHS_PDF[0] - 6, align: 'center' });
    xPos += COL_WIDTHS_PDF[0];
    
    // DESCRIPCION
    doc.text(item.producto.nombre, xPos + 3, yPos, { width: COL_WIDTHS_PDF[1] - 6 });
    xPos += COL_WIDTHS_PDF[1];
    
    // CANTIDAD DE SACOS
    doc.text(String(cantidadSacos), xPos + 3, yPos, { width: COL_WIDTHS_PDF[2] - 6, align: 'center' });
    xPos += COL_WIDTHS_PDF[2];
    
    // CANTIDAD LBS
    doc.text(formatCurrency(cantidadLbs), xPos + 3, yPos, { width: COL_WIDTHS_PDF[3] - 6, align: 'right' });
    xPos += COL_WIDTHS_PDF[3];
    
    // PRECIO X LB
    doc.text(`$${formatCurrency(precioXLb)}`, xPos + 3, yPos, { width: COL_WIDTHS_PDF[4] - 6, align: 'right' });
    xPos += COL_WIDTHS_PDF[4];
    
    // IMPORTE
    doc.text(`$${formatCurrency(importe)}`, xPos + 3, yPos, { width: COL_WIDTHS_PDF[5] - 6, align: 'right' });
    
    yPos += 16; // Espacio entre filas aumentado
    itemNum++;
    
    if (yPos > 650) {
      doc.addPage();
      yPos = 50;
    }
  }

  // Línea final de tabla
  doc.moveTo(tableLeft, yPos).lineTo(tableLeft + tableWidth, yPos).stroke();
  
  return { yPos: yPos + 8, totalImporte };
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

  // Título
  worksheet.mergeCells(`A${row}:${lastCol}${row}`);
  worksheet.getCell(`A${row}`).value = 'OFERTA DE VENTAS';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 16 };
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(row).height = 25;
  row++;

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

  // Empresa
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
  return row;
}

// ==========================================
// EXCEL - TABLA DE ITEMS
// ==========================================
function renderExcelTable(
  worksheet: ExcelJS.Worksheet, 
  items: any[], 
  startRow: number,
  usePrecioAjustado: boolean = false
): { endRow: number; totalImporte: number } {
  let row = startRow;

  // Encabezados (sin saltos de línea para Excel)
  const excelHeaders = ['ITEM', 'DESCRIPCION', 'CANT. SACOS', 'CANT. LBS', 'PRECIO X LB', 'IMPORTE'];
  const headerRow = worksheet.getRow(row);
  headerRow.values = excelHeaders;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
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
    const cantidadSacos = item.cantidadCajas || '-';
    const cantidadLbs = item.cantidad;
    const precioXLb = usePrecioAjustado ? (item.precioAjustado || item.precioUnitario) : item.precioUnitario;
    const importe = cantidadLbs * precioXLb;
    totalImporte += importe;

    dataRow.values = [
      itemNum,
      item.producto.nombre,
      cantidadSacos,
      cantidadLbs,
      precioXLb,
      importe,
    ];

    dataRow.getCell(1).alignment = { horizontal: 'center' };
    dataRow.getCell(3).alignment = { horizontal: 'right' };
    dataRow.getCell(4).alignment = { horizontal: 'right' };
    dataRow.getCell(4).numFmt = '#,##0.00';
    dataRow.getCell(5).alignment = { horizontal: 'right' };
    dataRow.getCell(5).numFmt = '"$"#,##0.00';
    dataRow.getCell(6).alignment = { horizontal: 'right' };
    dataRow.getCell(6).numFmt = '"$"#,##0.00';

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

  return { endRow: row, totalImporte };
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

  // Imagen de firma (si existe)
  const firmaPath = getImagePath(empresa.firmaPresidente);
  if (firmaPath) {
    const firmaImage = workbook.addImage({
      filename: firmaPath,
      extension: getImageExtension(firmaPath),
    });
    worksheet.addImage(firmaImage, {
      tl: { col: 0.5, row: row - 1 },
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

    // HEADER COMÚN
    const afterHeaderY = renderPdfHeader(doc, empresa, margin, contentWidth);
    doc.y = afterHeaderY + 10;

    // TABLA DE ITEMS
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false);
    doc.y = yPos + 10;

    // TOTAL CIF (única línea)
    doc.font('Helvetica-Bold').fontSize(10);
    const totalX = margin + COL_WIDTHS_PDF[0] + COL_WIDTHS_PDF[1] + COL_WIDTHS_PDF[2] + COL_WIDTHS_PDF[3];
    doc.text('TOTAL CIF:', totalX, doc.y, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(totalImporte)}`, totalX + COL_WIDTHS_PDF[4], doc.y - doc.currentLineHeight(), { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    
    doc.moveDown(2);

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

    // Configurar columnas
    worksheet.columns = COL_WIDTHS_EXCEL.map(w => ({ width: w }));
    const lastCol = 'F';

    // HEADER COMÚN
    let row = renderExcelHeader(worksheet, workbook, empresa, lastCol);

    // TABLA DE ITEMS
    const { endRow, totalImporte } = renderExcelTable(worksheet, oferta.items, row, false);
    row = endRow + 1;

    // TOTAL CIF
    worksheet.getCell(`E${row}`).value = 'TOTAL CIF:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = totalImporte;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
    row += 2;

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

    // TABLA DE ITEMS
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, false);
    doc.y = yPos + 10;

    // TOTAL CIF
    doc.font('Helvetica-Bold').fontSize(10);
    const totalX = margin + COL_WIDTHS_PDF[0] + COL_WIDTHS_PDF[1] + COL_WIDTHS_PDF[2] + COL_WIDTHS_PDF[3];
    doc.text('TOTAL CIF:', totalX, doc.y, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(totalImporte)}`, totalX + COL_WIDTHS_PDF[4], doc.y - doc.currentLineHeight(), { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    
    doc.moveDown(2);

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

    worksheet.columns = COL_WIDTHS_EXCEL.map(w => ({ width: w }));
    const lastCol = 'F';

    // HEADER COMÚN
    let row = renderExcelHeader(worksheet, workbook, empresa, lastCol);

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

    row++;

    // TABLA DE ITEMS
    const { endRow, totalImporte } = renderExcelTable(worksheet, oferta.items, row, false);
    row = endRow + 1;

    // TOTAL CIF
    worksheet.getCell(`E${row}`).value = 'TOTAL CIF:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = totalImporte;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
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

    // TABLA DE ITEMS (usa precioAjustado)
    const { yPos, totalImporte } = renderPdfTable(doc, oferta.items, margin, true);
    doc.y = yPos + 10;

    // TOTALES: FOB, FLETE, SEGURO, CIF
    const totalX = margin + COL_WIDTHS_PDF[0] + COL_WIDTHS_PDF[1] + COL_WIDTHS_PDF[2] + COL_WIDTHS_PDF[3];
    let totalsY = doc.y;
    
    doc.font('Helvetica-Bold').fontSize(9);
    
    // TOTAL FOB
    doc.text('TOTAL FOB:', totalX, totalsY, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(totalImporte)}`, totalX + COL_WIDTHS_PDF[4], totalsY, { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    totalsY += 14;

    // FLETE
    doc.text('FLETE:', totalX, totalsY, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(oferta.flete || 0)}`, totalX + COL_WIDTHS_PDF[4], totalsY, { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    totalsY += 14;

    // SEGURO
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    doc.text('SEGURO:', totalX, totalsY, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(seguro)}`, totalX + COL_WIDTHS_PDF[4], totalsY, { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    totalsY += 14;

    // TOTAL CIF
    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    doc.text('TOTAL CIF:', totalX, totalsY, { width: COL_WIDTHS_PDF[4], align: 'right' });
    doc.text(`$${formatCurrency(totalCIF)}`, totalX + COL_WIDTHS_PDF[4], totalsY, { 
      width: COL_WIDTHS_PDF[5], 
      align: 'right' 
    });
    
    doc.y = totalsY + 25;

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

    worksheet.columns = COL_WIDTHS_EXCEL.map(w => ({ width: w }));
    const lastCol = 'F';

    // HEADER COMÚN
    let row = renderExcelHeader(worksheet, workbook, empresa, lastCol);

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

    row++;

    // TABLA DE ITEMS (usa precioAjustado)
    const { endRow, totalImporte } = renderExcelTable(worksheet, oferta.items, row, true);
    row = endRow + 1;

    // TOTALES: FOB, FLETE, SEGURO, CIF
    worksheet.getCell(`E${row}`).value = 'TOTAL FOB:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = totalImporte;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
    row++;

    worksheet.getCell(`E${row}`).value = 'FLETE:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = oferta.flete || 0;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
    row++;

    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
    worksheet.getCell(`E${row}`).value = 'SEGURO:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = seguro;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
    row++;

    const totalCIF = totalImporte + (oferta.flete || 0) + seguro;
    worksheet.getCell(`E${row}`).value = 'TOTAL CIF:';
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`E${row}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${row}`).value = totalCIF;
    worksheet.getCell(`F${row}`).numFmt = '"$"#,##0.00';
    worksheet.getCell(`F${row}`).font = { bold: true };
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

    // Guardar fila para firmas
    const firmaStartRow = row + 2;
    const incluyeFirmaCliente = oferta.incluyeFirmaCliente !== false; // Por defecto true para importadora

    // FIRMA EMPRESA
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

    // Líneas y texto de firma empresa
    worksheet.getCell(`A${row}`).value = '________________________________';
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    // Firma cliente (condicional)
    if (incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = '________________________________';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.representante;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
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
    
    if (incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = 'DIRECTOR';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
    }
    row++;

    worksheet.getCell(`A${row}`).value = empresa.nombre;
    worksheet.mergeCells(`A${row}:B${row}`);
    worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
    
    if (incluyeFirmaCliente) {
      worksheet.getCell(`E${row}`).value = oferta.cliente.nombreCompania || '';
      worksheet.mergeCells(`E${row}:F${row}`);
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'center' };
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
