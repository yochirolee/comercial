import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const facturaSchema = z.object({
  numero: z.string().min(1, 'Número de factura es requerido'),
  fecha: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente es requerido'),
  observaciones: z.string().optional(),
  estado: z.enum(['pendiente', 'pagada', 'vencida', 'cancelada']).optional(),
  impuestos: z.number().min(0).optional(),
  descuento: z.number().min(0).optional(),
  tipoOfertaOrigen: z.enum(['cliente', 'importadora']).optional(),
  ofertaOrigenId: z.string().optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  descripcion: z.string().optional(),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

const fromOfertaSchema = z.object({
  tipoOferta: z.enum(['cliente', 'importadora']),
  ofertaId: z.string().min(1, 'ID de oferta es requerido'),
  numeroFactura: z.string().min(1, 'Número de factura es requerido'),
});

async function calcularTotales(facturaId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { items: true },
  });
  
  if (!factura) return;
  
  const subtotal = factura.items.reduce((acc, item) => acc + item.subtotal, 0);
  const impuestos = factura.impuestos || 0;
  const descuento = factura.descuento || 0;
  const total = subtotal + impuestos - descuento;
  
  await prisma.factura.update({
    where: { id: facturaId },
    data: { subtotal, total },
  });
}

export const FacturaController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { estado, clienteId } = req.query;
    
    const facturas = await prisma.factura.findMany({
      where: {
        AND: [
          estado ? { estado: String(estado) } : {},
          clienteId ? { clienteId: String(clienteId) } : {},
        ],
      },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
    
    res.json(facturas);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
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
    
    res.json(factura);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = facturaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingFactura = await prisma.factura.findUnique({
      where: { numero: validation.data.numero },
    });
    
    if (existingFactura) {
      res.status(400).json({ error: 'Ya existe una factura con ese número' });
      return;
    }

    const factura = await prisma.factura.create({
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : new Date(),
        fechaVencimiento: validation.data.fechaVencimiento ? new Date(validation.data.fechaVencimiento) : null,
      },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.status(201).json(factura);
  },

  async createFromOferta(req: Request, res: Response): Promise<void> {
    const validation = fromOfertaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { tipoOferta, ofertaId, numeroFactura } = validation.data;

    // Verificar número único
    const existingFactura = await prisma.factura.findUnique({
      where: { numero: numeroFactura },
    });
    
    if (existingFactura) {
      res.status(400).json({ error: 'Ya existe una factura con ese número' });
      return;
    }

    let oferta;
    let items: Array<{
      productoId: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }> = [];

    // Obtener oferta según tipo
    switch (tipoOferta) {
      case 'cliente':
        oferta = await prisma.ofertaCliente.findUnique({
          where: { id: ofertaId },
          include: { items: true },
        });
        if (oferta) {
          items = oferta.items.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
          }));
        }
        break;
      case 'importadora':
        oferta = await prisma.ofertaImportadora.findUnique({
          where: { id: ofertaId },
          include: { items: true },
        });
        if (oferta) {
          items = oferta.items.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioAjustado,
            subtotal: item.subtotal,
          }));
        }
        break;
    }

    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    // Crear factura con items
    const factura = await prisma.factura.create({
      data: {
        numero: numeroFactura,
        clienteId: oferta.clienteId,
        tipoOfertaOrigen: tipoOferta,
        ofertaOrigenId: ofertaId,
        items: {
          create: items,
        },
      },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });

    await calcularTotales(factura.id);

    const facturaActualizada = await prisma.factura.findUnique({
      where: { id: factura.id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.status(201).json(facturaActualizada);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = facturaSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    if (validation.data.numero) {
      const existingFactura = await prisma.factura.findFirst({
        where: { 
          numero: validation.data.numero,
          NOT: { id },
        },
      });
      
      if (existingFactura) {
        res.status(400).json({ error: 'Ya existe otra factura con ese número' });
        return;
      }
    }

    await prisma.factura.update({
      where: { id },
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : undefined,
        fechaVencimiento: validation.data.fechaVencimiento ? new Date(validation.data.fechaVencimiento) : undefined,
      },
    });
    
    await calcularTotales(id);

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.json(factura);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await prisma.factura.delete({
      where: { id },
    });
    
    res.status(204).send();
  },

  async addItem(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = itemSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const subtotal = validation.data.cantidad * validation.data.precioUnitario;

    const item = await prisma.itemFactura.create({
      data: {
        facturaId: id,
        ...validation.data,
        subtotal,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    await calcularTotales(id);
    
    res.status(201).json(item);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    const validation = itemSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingItem = await prisma.itemFactura.findUnique({
      where: { id: itemId },
    });
    
    if (!existingItem) {
      res.status(404).json({ error: 'Item no encontrado' });
      return;
    }

    const cantidad = validation.data.cantidad ?? existingItem.cantidad;
    const precioUnitario = validation.data.precioUnitario ?? existingItem.precioUnitario;
    const subtotal = cantidad * precioUnitario;

    const item = await prisma.itemFactura.update({
      where: { id: itemId },
      data: {
        ...validation.data,
        subtotal,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    await calcularTotales(id);
    
    res.json(item);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    
    await prisma.itemFactura.delete({
      where: { id: itemId },
    });
    
    await calcularTotales(id);
    
    res.status(204).send();
  },

  async updateEstado(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { estado } = req.body;
    
    if (!['pendiente', 'pagada', 'vencida', 'cancelada'].includes(estado)) {
      res.status(400).json({ error: 'Estado inválido' });
      return;
    }

    const factura = await prisma.factura.update({
      where: { id },
      data: { estado },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.json(factura);
  },
};

