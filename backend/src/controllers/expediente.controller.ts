import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { Readable } from 'stream';

export const ExpedienteController = {
  async downloadExpediente(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    try {
      // Obtener importadora con todas sus relaciones
      const importadora = await prisma.importadora.findUnique({
        where: { id },
        include: {
          clientes: {
            include: {
              cliente: true,
            },
          },
          ofertasImportadora: {
            include: {
              cliente: {
                select: {
                  id: true,
                  nombre: true,
                  apellidos: true,
                  nombreCompania: true,
                },
              },
            },
            orderBy: { fecha: 'desc' },
          },
          operaciones: {
            include: {
              offerCustomer: {
                include: {
                  cliente: {
                    select: {
                      id: true,
                      nombre: true,
                      apellidos: true,
                      nombreCompania: true,
                    },
                  },
                },
              },
              invoice: {
                include: {
                  cliente: {
                    select: {
                      id: true,
                      nombre: true,
                      apellidos: true,
                      nombreCompania: true,
                    },
                  },
                  items: {
                    include: {
                      producto: {
                        select: {
                          id: true,
                          nombre: true,
                          codigo: true,
                        },
                      },
                    },
                  },
                },
              },
              containers: {
                include: {
                  events: {
                    orderBy: { eventDate: 'desc' },
                  },
                },
                orderBy: { sequenceNo: 'asc' },
              },
              events: {
                orderBy: { eventDate: 'desc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!importadora) {
        res.status(404).json({ error: 'Importadora no encontrada' });
        return;
      }

      // ========== Buscar TODAS las facturas relacionadas por múltiples vías ==========
      const facturaInclude = {
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            nombreCompania: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
              },
            },
          },
        },
      };

      // 1. Facturas con importadoraId directamente asignado
      const facturasDirectas = await prisma.factura.findMany({
        where: { importadoraId: id },
        include: facturaInclude,
        orderBy: { fecha: 'desc' },
      });
      const facturasIdsDirectas = facturasDirectas.map(f => f.id);
      
      // 2. Facturas a través de operaciones de esta importadora
      const facturasPorOperaciones = importadora.operaciones
        .filter(op => op.invoiceId && op.invoice)
        .map(op => op.invoice)
        .filter((f): f is NonNullable<typeof f> => f !== null && !facturasIdsDirectas.includes(f.id));
      
      // 3. Obtener IDs de Ofertas a Importadora de esta importadora
      const ofertasImportadoraIds = importadora.ofertasImportadora.map(o => o.id);
      
      // 4. Buscar facturas creadas desde estas Ofertas a Importadora
      const facturasPorOfertasImportadora = ofertasImportadoraIds.length > 0 ? await prisma.factura.findMany({
        where: {
          tipoOfertaOrigen: 'importadora',
          ofertaOrigenId: { in: ofertasImportadoraIds },
          id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id)] },
        },
        include: facturaInclude,
        orderBy: { fecha: 'desc' },
      }) : [];
      
      // 5. Obtener IDs de Ofertas a Cliente relacionadas con esta importadora
      const ofertasClienteIds = importadora.ofertasImportadora
        .map(o => o.ofertaClienteId)
        .filter((oid): oid is string => oid !== null);
      
      // 6. Buscar facturas creadas desde estas Ofertas a Cliente
      // Sin filtrar por clienteId - si la oferta a cliente generó una oferta a importadora
      // de esta importadora, la factura pertenece
      const facturasPorOfertasCliente = ofertasClienteIds.length > 0 ? await prisma.factura.findMany({
        where: {
          tipoOfertaOrigen: 'cliente',
          ofertaOrigenId: { in: ofertasClienteIds },
          id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id), ...facturasPorOfertasImportadora.map(f => f.id)] },
        },
        include: facturaInclude,
        orderBy: { fecha: 'desc' },
      }) : [];
      
      // Combinar todas las facturas y eliminar duplicados
      const todasLasFacturasCombinadas = [
        ...facturasDirectas,
        ...facturasPorOperaciones,
        ...facturasPorOfertasImportadora,
        ...facturasPorOfertasCliente,
      ];
      
      // Eliminar duplicados por ID
      const todasLasFacturas = Array.from(
        new Map(todasLasFacturasCombinadas.map(f => [f.id, f])).values()
      ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      // Todas las ofertas a importadora pertenecen por definición (ya están vinculadas directamente)
      const ofertasFiltradas = importadora.ofertasImportadora;

      // ========== Obtener clientes con actividad real ==========
      // 1. Clientes de las ofertas a importadora
      const clientesDeOfertas = new Set(
        importadora.ofertasImportadora.map(o => o.clienteId)
      );
      // 2. Clientes de las facturas (directas e indirectas)
      const clientesDeFacturas = new Set(
        todasLasFacturas.map(f => f.clienteId)
      );
      // 3. Clientes de las operaciones (a través de offerCustomer)
      const clientesDeOperaciones = new Set(
        importadora.operaciones
          .filter(op => op.offerCustomer?.clienteId)
          .map(op => op.offerCustomer!.clienteId)
      );
      // 4. Clientes directos de ClienteImportadora
      const clientesDirectos = new Set(
        importadora.clientes.map(c => c.clienteId)
      );
      
      // Combinar todos los clientes con actividad
      const clientesConActividadIds = new Set([
        ...clientesDirectos,
        ...clientesDeOfertas,
        ...clientesDeFacturas,
        ...clientesDeOperaciones,
      ]);
      
      // Obtener información completa de los clientes con actividad
      const clientesConActividad = clientesConActividadIds.size > 0
        ? await prisma.cliente.findMany({
            where: { id: { in: Array.from(clientesConActividadIds) } },
            select: {
              id: true,
              nombre: true,
              apellidos: true,
              nombreCompania: true,
              email: true,
              telefono: true,
              direccion: true,
              nit: true,
            },
            orderBy: { nombre: 'asc' },
          })
        : [];

      // Calcular métricas usando datos actualizados
      const containers = importadora.operaciones.flatMap(op => op.containers);
      const metrics = {
        totalClientes: clientesConActividad.length,
        totalOfertas: ofertasFiltradas.length,
        totalFacturas: todasLasFacturas.length,
        totalOperaciones: importadora.operaciones.length,
        totalContainers: containers.length,
        containersEnTransito: containers.filter(c => ['Departed US', 'Arrived Cuba'].includes(c.status)).length,
        containersEnAduana: containers.filter(c => c.status === 'Customs').length,
        containersEntregados: containers.filter(c => ['Delivered', 'Closed'].includes(c.status)).length,
        totalFacturado: todasLasFacturas.reduce((sum, f) => sum + f.total, 0),
        totalOfertasCIF: ofertasFiltradas.reduce((sum, o) => sum + (o.precioCIF || 0), 0),
      };

      // Crear ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="expediente_${importadora.nombre.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.zip"`);
      
      archive.pipe(res);

      // Generar PDF
      const pdfBuffer = await generatePDF(importadora, metrics, todasLasFacturas);
      archive.append(pdfBuffer, { name: 'resumen.pdf' });

      // Generar Excel
      const excelBuffer = await generateExcel(importadora, containers, todasLasFacturas, ofertasFiltradas, clientesConActividad);
      archive.append(excelBuffer, { name: 'datos.xlsx' });

      // Finalizar ZIP
      await archive.finalize();

    } catch (error) {
      console.error('Error al generar expediente:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al generar expediente' });
      }
    }
  },
};

// Función para generar PDF
async function generatePDF(importadora: any, metrics: any, todasLasFacturas: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(20).font('Helvetica-Bold').text('EXPEDIENTE DE IMPORTADORA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text(importadora.nombre, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generado el: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);

    // Información general
    doc.fontSize(14).font('Helvetica-Bold').text('INFORMACIÓN GENERAL', { underline: true });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    
    const generalInfo = [
      ['País:', importadora.pais || 'N/A'],
      ['Dirección:', importadora.direccion || 'N/A'],
      ['Contacto:', importadora.contacto || 'N/A'],
      ['Teléfono:', importadora.telefono || 'N/A'],
      ['Email:', importadora.email || 'N/A'],
      ['Puerto Destino Default:', importadora.puertoDestinoDefault || 'N/A'],
    ];

    generalInfo.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, { indent: 20 });
    });

    if (importadora.notas) {
      doc.moveDown();
      doc.text(`Notas: ${importadora.notas}`, { indent: 20 });
    }

    doc.moveDown(2);

    // Métricas
    doc.fontSize(14).font('Helvetica-Bold').text('MÉTRICAS RESUMIDAS', { underline: true });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');

    const metricsData = [
      ['Total de Clientes:', metrics.totalClientes.toString()],
      ['Total de Ofertas:', metrics.totalOfertas.toString()],
      ['Total de Facturas:', metrics.totalFacturas.toString()],
      ['Total de Operaciones:', metrics.totalOperaciones.toString()],
      ['Total de Contenedores:', metrics.totalContainers.toString()],
      ['Contenedores en Tránsito:', metrics.containersEnTransito.toString()],
      ['Contenedores en Aduana:', metrics.containersEnAduana.toString()],
      ['Contenedores Entregados:', metrics.containersEntregados.toString()],
      ['Total Facturado:', `$${metrics.totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Total Ofertas CIF:', `$${metrics.totalOfertasCIF.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ];

    metricsData.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, { indent: 20 });
    });

    doc.moveDown(2);

    // Resumen de relaciones
    doc.fontSize(14).font('Helvetica-Bold').text('RESUMEN DE RELACIONES', { underline: true });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    
    doc.text(`Esta importadora tiene ${metrics.totalClientes} cliente(s) asociado(s), ${metrics.totalOfertas} oferta(s), ${metrics.totalFacturas} factura(s) y ${metrics.totalOperaciones} operación(es).`);
    doc.moveDown();
    doc.text(`El total facturado es de $${metrics.totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y el total de ofertas CIF es de $${metrics.totalOfertasCIF.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);

    doc.end();
  });
}

// Función para generar Excel
async function generateExcel(importadora: any, containers: any[], todasLasFacturas: any[], ofertasFiltradas: any[], clientesConActividad: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Hoja: Clientes (usar clientes con actividad real, no solo los directos)
  const clientesSheet = workbook.addWorksheet('Clientes');
  clientesSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Nombre', key: 'nombre', width: 20 },
    { header: 'Apellidos', key: 'apellidos', width: 20 },
    { header: 'Compañía', key: 'nombreCompania', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 15 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'NIT', key: 'nit', width: 15 },
  ];
  
  clientesConActividad.forEach((cli: any) => {
    clientesSheet.addRow({
      id: cli.id,
      nombre: cli.nombre,
      apellidos: cli.apellidos || '',
      nombreCompania: cli.nombreCompania || '',
      email: cli.email || '',
      telefono: cli.telefono || '',
      direccion: cli.direccion || '',
      nit: cli.nit || '',
    });
  });

  // Hoja: Ofertas
  const ofertasSheet = workbook.addWorksheet('Ofertas');
  ofertasSheet.columns = [
    { header: 'Número', key: 'numero', width: 15 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Precio CIF', key: 'precioCIF', width: 15 },
    { header: 'Observaciones', key: 'observaciones', width: 40 },
  ];
  
  ofertasFiltradas.forEach((oferta: any) => {
    ofertasSheet.addRow({
      numero: oferta.numero,
      fecha: oferta.fecha ? new Date(oferta.fecha).toLocaleDateString('es-ES') : '',
      cliente: oferta.cliente ? `${oferta.cliente.nombre} ${oferta.cliente.apellidos || ''}` : '',
      estado: oferta.estado,
      precioCIF: oferta.precioCIF ? `$${oferta.precioCIF.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      observaciones: oferta.observaciones || '',
    });
  });

  // Hoja: Facturas
  const facturasSheet = workbook.addWorksheet('Facturas');
  facturasSheet.columns = [
    { header: 'Número', key: 'numero', width: 15 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Observaciones', key: 'observaciones', width: 40 },
  ];
  
  todasLasFacturas.forEach((factura: any) => {
    facturasSheet.addRow({
      numero: factura.numero,
      fecha: factura.fecha ? new Date(factura.fecha).toLocaleDateString('es-ES') : '',
      cliente: factura.cliente ? `${factura.cliente.nombre} ${factura.cliente.apellidos || ''}` : '',
      estado: factura.estado,
      total: `$${factura.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      observaciones: factura.observaciones || '',
    });
  });

  // Hoja: Operaciones
  const operacionesSheet = workbook.addWorksheet('Operaciones');
  operacionesSheet.columns = [
    { header: 'Número', key: 'operationNo', width: 15 },
    { header: 'Tipo', key: 'operationType', width: 15 },
    { header: 'Estado', key: 'status', width: 15 },
    { header: 'Ubicación Actual', key: 'currentLocation', width: 20 },
    { header: 'Puerto Origen', key: 'originPort', width: 20 },
    { header: 'Puerto Destino', key: 'destinationPort', width: 20 },
    { header: 'Contenedores', key: 'containers', width: 12 },
    { header: 'Fecha Creación', key: 'createdAt', width: 18 },
  ];
  
  importadora.operaciones.forEach((op: any) => {
    operacionesSheet.addRow({
      operationNo: op.operationNo,
      operationType: op.operationType,
      status: op.status,
      currentLocation: op.currentLocation || '',
      originPort: op.originPort || '',
      destinationPort: op.destinationPort || '',
      containers: op.containers.length,
      createdAt: op.createdAt ? new Date(op.createdAt).toLocaleString('es-ES') : '',
    });
  });

  // Crear mapa de operaciones por ID para acceso rápido (antes de usarlo)
  const operationMap = new Map(importadora.operaciones.map((op: any) => [op.id, op]));
  
  // Hoja: Contenedores
  const containersSheet = workbook.addWorksheet('Contenedores');
  containersSheet.columns = [
    { header: 'Operación', key: 'operationNo', width: 15 },
    { header: 'Secuencia', key: 'sequenceNo', width: 12 },
    { header: 'Container No', key: 'containerNo', width: 18 },
    { header: 'Booking No', key: 'bookingNo', width: 18 },
    { header: 'BL No', key: 'blNo', width: 18 },
    { header: 'Estado', key: 'status', width: 15 },
    { header: 'Ubicación Actual', key: 'currentLocation', width: 20 },
    { header: 'Puerto Origen', key: 'originPort', width: 20 },
    { header: 'Puerto Destino', key: 'destinationPort', width: 20 },
    { header: 'ETD Estimado', key: 'etdEstimated', width: 18 },
    { header: 'ETA Estimado', key: 'etaEstimated', width: 18 },
    { header: 'ETD Real', key: 'etdActual', width: 18 },
    { header: 'ETA Real', key: 'etaActual', width: 18 },
  ];
  
  containers.forEach((container: any) => {
    // Buscar la operación del contenedor
    const operation = Array.from(operationMap.values()).find((op: any) => 
      op.containers.some((c: any) => c.id === container.id)
    ) as any;
    
    containersSheet.addRow({
      operationNo: (operation && operation.operationNo) ? operation.operationNo : '',
      sequenceNo: container.sequenceNo,
      containerNo: container.containerNo || '',
      bookingNo: container.bookingNo || '',
      blNo: container.blNo || '',
      status: container.status,
      currentLocation: container.currentLocation || '',
      originPort: container.originPort || '',
      destinationPort: container.destinationPort || '',
      etdEstimated: container.etdEstimated ? new Date(container.etdEstimated).toLocaleString('es-ES') : '',
      etaEstimated: container.etaEstimated ? new Date(container.etaEstimated).toLocaleString('es-ES') : '',
      etdActual: container.etdActual ? new Date(container.etdActual).toLocaleString('es-ES') : '',
      etaActual: container.etaActual ? new Date(container.etaActual).toLocaleString('es-ES') : '',
    });
  });

  // Hoja: Timeline Operaciones
  const timelineOpsSheet = workbook.addWorksheet('Timeline Operaciones');
  timelineOpsSheet.columns = [
    { header: 'Operación', key: 'operationNo', width: 15 },
    { header: 'Fecha Evento', key: 'eventDate', width: 18 },
    { header: 'Tipo', key: 'eventType', width: 15 },
    { header: 'Título', key: 'title', width: 30 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Estado Anterior', key: 'fromStatus', width: 15 },
    { header: 'Estado Nuevo', key: 'toStatus', width: 15 },
  ];
  
  importadora.operaciones.forEach((op: any) => {
    op.events.forEach((event: any) => {
      timelineOpsSheet.addRow({
        operationNo: op.operationNo,
        eventDate: new Date(event.eventDate).toLocaleString('es-ES'),
        eventType: event.eventType,
        title: event.title,
        description: event.description || '',
        fromStatus: event.fromStatus || '',
        toStatus: event.toStatus || '',
      });
    });
  });

  // Hoja: Timeline Contenedores
  const timelineContSheet = workbook.addWorksheet('Timeline Contenedores');
  timelineContSheet.columns = [
    { header: 'Container No', key: 'containerNo', width: 18 },
    { header: 'Operación', key: 'operationNo', width: 15 },
    { header: 'Fecha Evento', key: 'eventDate', width: 18 },
    { header: 'Tipo', key: 'eventType', width: 15 },
    { header: 'Título', key: 'title', width: 30 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Ubicación', key: 'location', width: 20 },
    { header: 'Estado Anterior', key: 'fromStatus', width: 15 },
    { header: 'Estado Nuevo', key: 'toStatus', width: 15 },
  ];
  
  // Usar el mismo mapa de operaciones
  containers.forEach((container: any) => {
    const operation = Array.from(operationMap.values()).find((op: any) => 
      op.containers.some((c: any) => c.id === container.id)
    ) as any;
    
    container.events.forEach((event: any) => {
      timelineContSheet.addRow({
        containerNo: container.containerNo || '',
        operationNo: (operation && operation.operationNo) ? operation.operationNo : '',
        eventDate: new Date(event.eventDate).toLocaleString('es-ES'),
        eventType: event.eventType,
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        fromStatus: event.fromStatus || '',
        toStatus: event.toStatus || '',
      });
    });
  });

  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
