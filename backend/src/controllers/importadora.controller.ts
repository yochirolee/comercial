import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { createContainsFilter } from '../lib/search-utils.js';

const importadoraSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido'),
  direccion: z.string().optional(),
  pais: z.string().optional(),
  puertoDestinoDefault: z.string().optional(),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notas: z.string().optional(),
});

export const ImportadoraController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { search } = req.query;
    
    const searchFilter = search ? createContainsFilter(String(search)) : null;
    
    const importadoras = await prisma.importadora.findMany({
      where: searchFilter ? {
        OR: [
          { nombre: searchFilter },
          { contacto: searchFilter },
          { email: searchFilter },
        ],
      } : undefined,
      orderBy: { nombre: 'asc' },
    });
    
    res.json(importadoras);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const importadora = await prisma.importadora.findUnique({
      where: { id },
      include: {
        clientes: {
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                nombreCompania: true,
                email: true,
                telefono: true,
                direccion: true,
              },
            },
          },
        },
        ofertasImportadora: {
          orderBy: { fecha: 'desc' },
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
        operaciones: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            containers: {
              orderBy: { sequenceNo: 'asc' },
              take: 5,
            },
            invoice: {
              include: {
                cliente: {
                  select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
                },
              },
            },
            offerCustomer: {
              include: {
                cliente: {
                  select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
                },
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
    
    // ========== Buscar TODAS las facturas relacionadas por múltiples vías ==========
    const clienteInclude = {
      cliente: {
        select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
      },
    };
    
    // 1. Facturas con importadoraId directamente asignado
    const facturasDirectas = await prisma.factura.findMany({
      where: { importadoraId: id },
      include: clienteInclude,
      orderBy: { fecha: 'desc' },
    });
    const facturasIdsDirectas = facturasDirectas.map(f => f.id);
    
    // 2. Facturas a través de operaciones de esta importadora
    const facturasPorOperaciones = importadora.operaciones
      .filter(op => op.invoiceId && op.invoice)
      .map(op => op.invoice)
      .filter((f): f is NonNullable<typeof f> => f !== null && !facturasIdsDirectas.includes(f.id));
    
    // 3. Facturas creadas desde Ofertas a Importadora
    const ofertasImportadoraIds = importadora.ofertasImportadora.map(o => o.id);
    const facturasPorOfertasImp = ofertasImportadoraIds.length > 0 ? await prisma.factura.findMany({
      where: {
        tipoOfertaOrigen: 'importadora',
        ofertaOrigenId: { in: ofertasImportadoraIds },
        id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id)] },
      },
      include: clienteInclude,
      orderBy: { fecha: 'desc' },
    }) : [];
    
    // 4. Facturas creadas desde Ofertas a Cliente vinculadas
    const ofertasClienteIds = importadora.ofertasImportadora
      .map(o => o.ofertaClienteId)
      .filter((oid): oid is string => oid !== null);
    const facturasPorOfertasCli = ofertasClienteIds.length > 0 ? await prisma.factura.findMany({
      where: {
        tipoOfertaOrigen: 'cliente',
        ofertaOrigenId: { in: ofertasClienteIds },
        id: { notIn: [...facturasIdsDirectas, ...facturasPorOperaciones.map(f => f.id), ...facturasPorOfertasImp.map(f => f.id)] },
      },
      include: clienteInclude,
      orderBy: { fecha: 'desc' },
    }) : [];
    
    // Combinar todas las facturas y eliminar duplicados
    const todasLasFacturas = [
      ...facturasDirectas,
      ...facturasPorOperaciones,
      ...facturasPorOfertasImp,
      ...facturasPorOfertasCli,
    ];
    const facturasUnicas = Array.from(
      new Map(todasLasFacturas.map(f => [f.id, f])).values()
    ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
     .slice(0, 20);
    
    // Calcular productos asociados (desde facturas y ofertas)
    const facturasIds = facturasUnicas.map(f => f.id);
    const ofertasIds = importadora.ofertasImportadora.map(o => o.id);
    
    const itemsFactura = await prisma.itemFactura.findMany({
      where: { facturaId: { in: facturasIds } },
      include: {
        producto: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            codigoArancelario: true,
          },
        },
      },
    });
    
    const itemsOferta = await prisma.itemOfertaImportadora.findMany({
      where: { ofertaImportadoraId: { in: ofertasIds } },
      include: {
        producto: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            codigoArancelario: true,
          },
        },
      },
    });
    
    // Agrupar productos y calcular totales
    const productosMap = new Map<string, {
      producto: typeof itemsFactura[0]['producto'];
      cantidad: number;
      importe: number;
    }>();
    
    // Sumar desde facturas
    for (const item of itemsFactura) {
      const key = item.productoId;
      const existing = productosMap.get(key) || {
        producto: item.producto,
        cantidad: 0,
        importe: 0,
      };
      existing.cantidad += item.cantidad;
      existing.importe += item.subtotal;
      productosMap.set(key, existing);
    }
    
    // Sumar desde ofertas (solo si no hay factura)
    for (const item of itemsOferta) {
      const key = item.productoId;
      const existing = productosMap.get(key) || {
        producto: item.producto,
        cantidad: 0,
        importe: 0,
      };
      existing.cantidad += item.cantidad;
      existing.importe += item.subtotal;
      productosMap.set(key, existing);
    }
    
    const productos = Array.from(productosMap.values())
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 20); // Top 20 productos
    
    // Calcular estadísticas de contenedores
    const containers = await prisma.operationContainer.findMany({
      where: {
        operation: {
          importadoraId: id,
        },
      },
      include: {
        operation: {
          select: {
            operationNo: true,
            operationType: true,
          },
        },
      },
    });
    
    const containersEnTransito = containers.filter(c => 
      ['Departed US', 'Arrived Cuba'].includes(c.status)
    ).length;
    
    const containersEnAduana = containers.filter(c => 
      c.status === 'Customs'
    ).length;
    
    const containersEntregados = containers.filter(c => 
      ['Delivered', 'Closed'].includes(c.status)
    ).length;
    
    // ========== Obtener clientes con actividad real ==========
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
          },
          orderBy: { nombre: 'asc' },
        })
      : [];
    
    // Formatear clientes para mantener compatibilidad con el frontend
    const clientesFormateados = clientesConActividad.map(cli => ({
      id: cli.id,
      clienteId: cli.id,
      importadoraId: id,
      cliente: cli,
    }));

    res.json({
      ...importadora,
      clientes: clientesFormateados, // Usar clientes con actividad real
      facturas: facturasUnicas, // Usar facturas combinadas (directas + indirectas)
      productos,
      estadisticas: {
        totalClientes: clientesConActividad.length, // Total real de clientes
        totalOfertas: importadora.ofertasImportadora.length,
        totalFacturas: facturasUnicas.length, // Usar el total real
        totalOperaciones: importadora.operaciones.length,
        containersEnTransito,
        containersEnAduana,
        containersEntregados,
        totalContainers: containers.length,
      },
    });
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = importadoraSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const importadora = await prisma.importadora.create({
      data: validation.data,
    });
    
    res.status(201).json(importadora);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = importadoraSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const importadora = await prisma.importadora.update({
      where: { id },
      data: validation.data,
    });
    
    res.json(importadora);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    // Verificar si tiene relaciones
    const ofertas = await prisma.ofertaImportadora.count({
      where: { importadoraId: id },
    });
    
    const facturas = await prisma.factura.count({
      where: { importadoraId: id },
    });
    
    const operaciones = await prisma.operation.count({
      where: { importadoraId: id },
    });
    
    if (ofertas > 0 || facturas > 0 || operaciones > 0) {
      res.status(400).json({ 
        error: 'No se puede eliminar la importadora porque tiene ofertas, facturas u operaciones asociadas',
        detalles: {
          ofertas,
          facturas,
          operaciones,
        },
      });
      return;
    }
    
    await prisma.importadora.delete({
      where: { id },
    });
    
    res.status(204).send();
  },

  // Agregar cliente a importadora (crear relación ClienteImportadora)
  async addCliente(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { clienteId } = req.body;
    
    if (!clienteId) {
      res.status(400).json({ error: 'clienteId es requerido' });
      return;
    }
    
    // Verificar que la importadora existe
    const importadora = await prisma.importadora.findUnique({
      where: { id },
    });
    
    if (!importadora) {
      res.status(404).json({ error: 'Importadora no encontrada' });
      return;
    }
    
    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });
    
    if (!cliente) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    
    // Crear relación (o verificar si ya existe)
    try {
      const relacion = await prisma.clienteImportadora.create({
        data: {
          clienteId,
          importadoraId: id,
        },
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
      });
      
      res.status(201).json(relacion);
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'El cliente ya está asociado a esta importadora' });
        return;
      }
      throw error;
    }
  },

  // Remover cliente de importadora
  async removeCliente(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { clienteId } = req.body;
    
    if (!clienteId) {
      res.status(400).json({ error: 'clienteId es requerido' });
      return;
    }
    
    await prisma.clienteImportadora.deleteMany({
      where: {
        importadoraId: id,
        clienteId,
      },
    });
    
    res.status(204).send();
  },
};
