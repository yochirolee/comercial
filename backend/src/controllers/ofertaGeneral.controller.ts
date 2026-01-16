import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const ofertaGeneralSchema = z.object({
  numero: z.string().min(1, 'Número de oferta es requerido'),
  fecha: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.enum(['activa', 'vencida', 'cancelada']).optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  cantidadCajas: z.number().optional(), // Solo si la unidad usa cajas/sacos
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

export const OfertaGeneralController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { estado } = req.query;
    
    const ofertas = await prisma.ofertaGeneral.findMany({
      where: estado ? { estado: String(estado) } : undefined,
      include: {
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
    
    res.json(ofertas);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaGeneral.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }
    
    res.json(oferta);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = ofertaGeneralSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Verificar número único
    const existingOferta = await prisma.ofertaGeneral.findUnique({
      where: { numero: validation.data.numero },
    });
    
    if (existingOferta) {
      res.status(400).json({ error: 'Ya existe una oferta con ese número' });
      return;
    }

    const oferta = await prisma.ofertaGeneral.create({
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : new Date(),
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : null,
      },
      include: {
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.status(201).json(oferta);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = ofertaGeneralSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Verificar número único si se está actualizando
    if (validation.data.numero) {
      const existingOferta = await prisma.ofertaGeneral.findFirst({
        where: { 
          numero: validation.data.numero,
          NOT: { id },
        },
      });
      
      if (existingOferta) {
        res.status(400).json({ error: 'Ya existe otra oferta con ese número' });
        return;
      }
    }

    const oferta = await prisma.ofertaGeneral.update({
      where: { id },
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : undefined,
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : undefined,
      },
      include: {
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
      },
    });
    
    res.json(oferta);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await prisma.ofertaGeneral.delete({
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

    const item = await prisma.itemOfertaGeneral.create({
      data: {
        ofertaGeneralId: id,
        ...validation.data,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    res.status(201).json(item);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { itemId } = req.params;
    
    await prisma.itemOfertaGeneral.delete({
      where: { id: itemId },
    });
    
    res.status(204).send();
  },
};

