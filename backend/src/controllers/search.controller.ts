import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { createContainsFilter } from '../lib/search-utils.js';

export const SearchController = {
  // Búsqueda universal: busca en importadoras, clientes, productos, operaciones, facturas
  async search(req: Request, res: Response): Promise<void> {
    const { q } = req.query;
    
    if (!q || String(q).trim().length < 2) {
      res.json({ importadoras: [], clientes: [], productos: [], operaciones: [], facturas: [], ofertasImportadora: [] });
      return;
    }
    
    const term = String(q).trim();
    const containsFilter = createContainsFilter(term);
    
    const [importadoras, clientes, productos, operaciones, facturas, ofertasImportadora] = await Promise.all([
      // Importadoras
      prisma.importadora.findMany({
        where: {
          OR: [
            { nombre: containsFilter },
            { contacto: containsFilter },
            { email: containsFilter },
          ],
        },
        select: {
          id: true,
          nombre: true,
          pais: true,
          contacto: true,
          puertoDestinoDefault: true,
        },
        take: 10,
      }),
      
      // Clientes
      prisma.cliente.findMany({
        where: {
          OR: [
            { nombre: containsFilter },
            { apellidos: containsFilter },
            { nombreCompania: containsFilter },
            { email: containsFilter },
          ],
        },
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          nombreCompania: true,
          email: true,
          telefono: true,
        },
        take: 10,
      }),
      
      // Productos
      prisma.producto.findMany({
        where: {
          OR: [
            { nombre: containsFilter },
            { codigo: containsFilter },
            { codigoArancelario: containsFilter },
          ],
        },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          precioBase: true,
          codigoArancelario: true,
        },
        take: 10,
      }),
      
      // Operaciones
      prisma.operation.findMany({
        where: {
          OR: [
            { operationNo: containsFilter },
            { notes: containsFilter },
          ],
        },
        select: {
          id: true,
          operationNo: true,
          operationType: true,
          status: true,
          currentLocation: true,
        },
        take: 10,
      }),
      
      // Facturas
      prisma.factura.findMany({
        where: {
          OR: [
            { numero: containsFilter },
            { observaciones: containsFilter },
          ],
        },
        select: {
          id: true,
          numero: true,
          fecha: true,
          total: true,
          estado: true,
        },
        take: 10,
      }),
      
      // Ofertas a Importadora
      prisma.ofertaImportadora.findMany({
        where: {
          OR: [
            { numero: containsFilter },
            { importadora: { nombre: containsFilter } },
          ],
        },
        select: {
          id: true,
          numero: true,
          fecha: true,
          estado: true,
          precioCIF: true,
          importadora: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        take: 10,
      }),
    ]);
    
    res.json({
      importadoras,
      clientes,
      productos,
      operaciones,
      facturas,
      ofertasImportadora,
    });
  },

  // Detalle expandido: dado un tipo y un ID, devuelve todo lo relacionado
  async detail(req: Request, res: Response): Promise<void> {
    const { type, id } = req.params;
    
    switch (type) {
      case 'importadora':
        return SearchController.detailImportadora(id, res);
      case 'cliente':
        return SearchController.detailCliente(id, res);
      case 'producto':
        return SearchController.detailProducto(id, res);
      case 'operacion':
        return SearchController.detailOperacion(id, res);
      case 'factura':
        return SearchController.detailFactura(id, res);
      default:
        res.status(400).json({ error: 'Tipo no válido' });
    }
  },

  async detailImportadora(id: string, res: Response): Promise<void> {
    const importadora = await prisma.importadora.findUnique({
      where: { id },
      include: {
        clientes: {
          include: {
            cliente: {
              select: { id: true, nombre: true, apellidos: true, nombreCompania: true, email: true, telefono: true },
            },
          },
        },
        ofertasImportadora: {
          orderBy: { fecha: 'desc' },
          include: {
            cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
          },
        },
        operaciones: {
          orderBy: { createdAt: 'desc' },
          include: {
            containers: { orderBy: { sequenceNo: 'asc' } },
            invoice: {
              include: {
                cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
              },
            },
            offerCustomer: {
              include: {
                cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
              },
            },
          },
        },
      },
    });
    
    if (!importadora) {
      res.status(404).json({ error: 'Importadora no encontrada' });
      return;
    }
    
    // Obtener IDs de clientes relacionados directamente con esta importadora
    const clientesIdsRelacionados = importadora.clientes.map(c => c.clienteId);
    const clientesIdsRelacionadosSet = new Set(clientesIdsRelacionados);
    
    // Obtener facturas relacionadas indirectamente a través de múltiples vías:
    // 1. Facturas con importadoraId directamente asignado (TODAS, no solo las primeras 10)
    // 2. Operaciones que tienen invoiceId y el cliente de la factura está relacionado
    // 3. Facturas creadas desde Ofertas a Importadora de esta importadora
    // 4. Facturas creadas desde Ofertas a Cliente que tienen Ofertas a Importadora de esta importadora
    
    // 1. Obtener TODAS las facturas con importadoraId directamente asignado
    const facturasDirectas = await prisma.factura.findMany({
      where: {
        importadoraId: id,
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
      },
      orderBy: { fecha: 'desc' },
    });
    
    const facturasIdsDirectas = facturasDirectas.map(f => f.id);
    
    // 2. Facturas a través de operaciones, pero solo si el cliente está relacionado
    const facturasPorOperaciones = importadora.operaciones
      .filter(op => op.invoiceId && op.invoice && clientesIdsRelacionadosSet.has(op.invoice.clienteId))
      .map(op => op.invoice)
      .filter((f): f is NonNullable<typeof f> => f !== null && !facturasIdsDirectas.includes(f.id));
    
    // 3. Obtener IDs de Ofertas a Importadora de esta importadora
    const ofertasImportadoraIds = importadora.ofertasImportadora.map(o => o.id);
    
    // 4. Buscar facturas creadas desde estas Ofertas a Importadora
    // PERO solo si el cliente está relacionado con esta importadora
    const facturasPorOfertasImportadora = ofertasImportadoraIds.length > 0 ? await prisma.factura.findMany({
      where: {
        tipoOfertaOrigen: 'importadora',
        ofertaOrigenId: { in: ofertasImportadoraIds },
        clienteId: { in: clientesIdsRelacionados }, // Solo clientes relacionados
        id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id)] },
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
      },
      orderBy: { fecha: 'desc' },
    }) : [];
    
    // 5. Obtener IDs de Ofertas a Cliente relacionadas con esta importadora
    const ofertasClienteIds = importadora.ofertasImportadora
      .map(o => o.ofertaClienteId)
      .filter((id): id is string => id !== null);
    
    // 6. Buscar facturas creadas desde estas Ofertas a Cliente
    // PERO solo si el cliente de la factura está relacionado con esta importadora
    const facturasPorOfertasCliente = ofertasClienteIds.length > 0 ? await prisma.factura.findMany({
      where: {
        tipoOfertaOrigen: 'cliente',
        ofertaOrigenId: { in: ofertasClienteIds },
        clienteId: { in: clientesIdsRelacionados }, // Solo clientes relacionados con esta importadora
        id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id), ...facturasPorOfertasImportadora.map(f => f.id)] },
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
      },
      orderBy: { fecha: 'desc' },
    }) : [];
    
    // Combinar todas las facturas (directas e indirectas)
    const todasLasFacturas = [
      ...facturasDirectas,
      ...facturasPorOperaciones,
      ...facturasPorOfertasImportadora,
      ...facturasPorOfertasCliente,
    ];
    
    // Eliminar duplicados por ID
    const facturasUnicas = Array.from(
      new Map(todasLasFacturas.map(f => [f.id, f])).values()
    );
    
    // Ordenar por fecha descendente y limitar a 10 para mostrar
    const facturasFiltradas = facturasUnicas
      .filter(factura => clientesIdsRelacionadosSet.has(factura.clienteId))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10);
    
    // Productos top
    const facturasIds = facturasUnicas.map(f => f.id);
    const itemsFactura = facturasIds.length > 0 ? await prisma.itemFactura.findMany({
      where: { facturaId: { in: facturasIds } },
      include: { producto: { select: { id: true, codigo: true, nombre: true } } },
    }) : [];
    
    const productosMap = new Map<string, { producto: { id: string; codigo: string | null; nombre: string }; cantidad: number; importe: number }>();
    for (const item of itemsFactura) {
      const existing = productosMap.get(item.productoId) || { producto: item.producto, cantidad: 0, importe: 0 };
      existing.cantidad += item.cantidad;
      existing.importe += item.subtotal;
      productosMap.set(item.productoId, existing);
    }
    const productos = Array.from(productosMap.values()).sort((a, b) => b.importe - a.importe).slice(0, 10);
    
    // Contenedores stats
    const containers = await prisma.operationContainer.findMany({
      where: { operation: { importadoraId: id } },
    });
    
    // Filtrar ofertas a importadora para asegurar que solo muestren clientes relacionados directamente
    const ofertasFiltradas = importadora.ofertasImportadora
      .filter(oferta => clientesIdsRelacionadosSet.has(oferta.clienteId))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10);
    
    // Filtrar operaciones para mostrar solo las más recientes
    const operacionesFiltradas = importadora.operaciones.slice(0, 10);
    
    // Obtener todos los clientes que tienen actividad con esta importadora
    // 1. Clientes de las ofertas a importadora
    const clientesDeOfertas = new Set(
      importadora.ofertasImportadora.map(o => o.clienteId)
    );
    
    // 2. Clientes de las facturas (directas e indirectas)
    const clientesDeFacturas = new Set(
      facturasUnicas.map(f => f.clienteId)
    );
    
    // 3. Clientes de las operaciones (a través de offerCustomer)
    const clientesDeOperaciones = new Set(
      importadora.operaciones
        .filter(op => op.offerCustomer?.clienteId)
        .map(op => op.offerCustomer!.clienteId)
    );
    
    // Combinar todos los clientes con actividad
    const clientesConActividadIds = new Set([
      ...clientesDeOfertas,
      ...clientesDeFacturas,
      ...clientesDeOperaciones,
    ]);
    
    // Obtener información completa de los clientes con actividad
    const clientesConActividad = clientesConActividadIds.size > 0 
      ? await prisma.cliente.findMany({
          where: {
            id: { in: Array.from(clientesConActividadIds) },
          },
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            nombreCompania: true,
            email: true,
            telefono: true,
          },
        })
      : [];
    
    res.json({
      type: 'importadora',
      entity: importadora,
      relaciones: {
        clientes: clientesConActividad,
        ofertas: ofertasFiltradas,
        facturas: facturasFiltradas,
        operaciones: operacionesFiltradas,
        productos,
        containers: {
          total: containers.length,
          enTransito: containers.filter(c => ['Departed US', 'Arrived Cuba'].includes(c.status)).length,
          enAduana: containers.filter(c => c.status === 'Customs').length,
          entregados: containers.filter(c => ['Delivered', 'Closed'].includes(c.status)).length,
        },
      },
    });
  },

  async detailCliente(id: string, res: Response): Promise<void> {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        importadoras: {
          include: {
            importadora: { select: { id: true, nombre: true, pais: true, puertoDestinoDefault: true } },
          },
        },
      },
    });
    
    if (!cliente) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    
    // Ofertas a cliente
    const ofertasCliente = await prisma.ofertaCliente.findMany({
      where: { clienteId: id },
      orderBy: { fecha: 'desc' },
      take: 10,
      select: { id: true, numero: true, fecha: true, estado: true, total: true },
    });
    
    // Ofertas a importadora (donde el cliente es el dueño)
    const ofertasImportadora = await prisma.ofertaImportadora.findMany({
      where: { clienteId: id },
      orderBy: { fecha: 'desc' },
      take: 10,
      select: { id: true, numero: true, fecha: true, estado: true, precioCIF: true },
      // include importadora
    });
    
    // Facturas
    const facturas = await prisma.factura.findMany({
      where: { clienteId: id },
      orderBy: { fecha: 'desc' },
      take: 10,
      include: {
        importadora: { select: { id: true, nombre: true } },
      },
    });
    
    // Operaciones
    const operaciones = await prisma.operation.findMany({
      where: { offerCustomerId: { in: (await prisma.ofertaCliente.findMany({ where: { clienteId: id }, select: { id: true } })).map(o => o.id) } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        importadora: { select: { id: true, nombre: true } },
        containers: { orderBy: { sequenceNo: 'asc' }, take: 5 },
      },
    });
    
    // Productos (desde facturas del cliente)
    const facturasIds = facturas.map(f => f.id);
    const itemsFactura = facturasIds.length > 0 ? await prisma.itemFactura.findMany({
      where: { facturaId: { in: facturasIds } },
      include: { producto: { select: { id: true, codigo: true, nombre: true } } },
    }) : [];
    
    const productosMap = new Map<string, { producto: { id: string; codigo: string | null; nombre: string }; cantidad: number; importe: number }>();
    for (const item of itemsFactura) {
      const existing = productosMap.get(item.productoId) || { producto: item.producto, cantidad: 0, importe: 0 };
      existing.cantidad += item.cantidad;
      existing.importe += item.subtotal;
      productosMap.set(item.productoId, existing);
    }
    const productos = Array.from(productosMap.values()).sort((a, b) => b.importe - a.importe).slice(0, 10);
    
    res.json({
      type: 'cliente',
      entity: cliente,
      relaciones: {
        importadoras: cliente.importadoras.map(i => i.importadora),
        ofertasCliente,
        ofertasImportadora,
        facturas,
        operaciones,
        productos,
      },
    });
  },

  async detailProducto(id: string, res: Response): Promise<void> {
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: { unidadMedida: true },
    });
    
    if (!producto) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    
    // Quién compró este producto (desde facturas)
    const itemsFactura = await prisma.itemFactura.findMany({
      where: { productoId: id },
      include: {
        factura: {
          include: {
            cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
            importadora: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { factura: { fecha: 'desc' } },
      take: 20,
    });
    
    // Agrupar por importadora
    const importadorasMap = new Map<string, { id: string; nombre: string; cantidad: number; importe: number }>();
    for (const item of itemsFactura) {
      if (item.factura.importadora) {
        const imp = item.factura.importadora;
        const existing = importadorasMap.get(imp.id) || { ...imp, cantidad: 0, importe: 0 };
        existing.cantidad += item.cantidad;
        existing.importe += item.subtotal;
        importadorasMap.set(imp.id, existing);
      }
    }
    
    // Agrupar por cliente
    const clientesMap = new Map<string, { id: string; nombre: string; apellidos: string | null; nombreCompania: string | null; cantidad: number; importe: number }>();
    for (const item of itemsFactura) {
      const cli = item.factura.cliente;
      const existing = clientesMap.get(cli.id) || { ...cli, cantidad: 0, importe: 0 };
      existing.cantidad += item.cantidad;
      existing.importe += item.subtotal;
      clientesMap.set(cli.id, existing);
    }
    
    // Operaciones con este producto
    const facturasConProducto = [...new Set(itemsFactura.map(i => i.factura.id))];
    const operaciones = facturasConProducto.length > 0 ? await prisma.operation.findMany({
      where: { invoiceId: { in: facturasConProducto } },
      include: {
        importadora: { select: { id: true, nombre: true } },
        containers: { orderBy: { sequenceNo: 'asc' }, take: 3 },
      },
      take: 10,
    }) : [];
    
    // Facturas recientes con este producto
    const facturas = itemsFactura.slice(0, 10).map(item => ({
      id: item.factura.id,
      numero: item.factura.numero,
      fecha: item.factura.fecha,
      estado: item.factura.estado,
      cantidad: item.cantidad,
      subtotal: item.subtotal,
      cliente: item.factura.cliente,
      importadora: item.factura.importadora,
    }));
    
    res.json({
      type: 'producto',
      entity: producto,
      relaciones: {
        importadoras: Array.from(importadorasMap.values()).sort((a, b) => b.importe - a.importe),
        clientes: Array.from(clientesMap.values()).sort((a, b) => b.importe - a.importe),
        facturas,
        operaciones,
        totalVendido: itemsFactura.reduce((sum, i) => sum + i.cantidad, 0),
        totalImporte: itemsFactura.reduce((sum, i) => sum + i.subtotal, 0),
      },
    });
  },

  async detailOperacion(id: string, res: Response): Promise<void> {
    const operacion = await prisma.operation.findUnique({
      where: { id },
      include: {
        importadora: { select: { id: true, nombre: true, pais: true } },
        offerCustomer: {
          include: {
            cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true } },
          },
        },
        containers: { orderBy: { sequenceNo: 'asc' } },
        events: { orderBy: { eventDate: 'desc' }, take: 10 },
      },
    });
    
    if (!operacion) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    res.json({
      type: 'operacion',
      entity: operacion,
      relaciones: {
        importadora: operacion.importadora,
        cliente: operacion.offerCustomer?.cliente || null,
        containers: operacion.containers,
        eventos: operacion.events,
      },
    });
  },

  async detailFactura(id: string, res: Response): Promise<void> {
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true, apellidos: true, nombreCompania: true, email: true } },
        importadora: { select: { id: true, nombre: true, pais: true } },
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, codigo: true },
              
            },
          },
        },
      },
    });
    
    if (!factura) {
      res.status(404).json({ error: 'Factura no encontrada' });
      return;
    }
    
    // Operación asociada
    const operacion = await prisma.operation.findFirst({
      where: { invoiceId: id },
      include: {
        containers: { orderBy: { sequenceNo: 'asc' } },
      },
    });
    
    res.json({
      type: 'factura',
      entity: factura,
      relaciones: {
        cliente: factura.cliente,
        importadora: factura.importadora,
        productos: factura.items,
        operacion,
      },
    });
  },
};
