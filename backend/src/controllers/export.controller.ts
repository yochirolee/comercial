import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import ExcelJS from 'exceljs';

export const ExportController = {
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
