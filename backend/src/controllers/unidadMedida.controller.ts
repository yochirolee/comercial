import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const unidadMedidaSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido'),
  abreviatura: z.string().min(1, 'Abreviatura es requerida'),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

export const UnidadMedidaController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    const unidades = await prisma.unidadMedida.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(unidades);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const unidad = await prisma.unidadMedida.findUnique({
      where: { id },
      include: { productos: true },
    });
    
    if (!unidad) {
      res.status(404).json({ error: 'Unidad de medida no encontrada' });
      return;
    }
    
    res.json(unidad);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = unidadMedidaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const unidad = await prisma.unidadMedida.create({
      data: validation.data,
    });
    
    res.status(201).json(unidad);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = unidadMedidaSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const unidad = await prisma.unidadMedida.update({
      where: { id },
      data: validation.data,
    });
    
    res.json(unidad);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    // Verificar si hay productos usando esta unidad
    const productosConUnidad = await prisma.producto.count({
      where: { unidadMedidaId: id },
    });
    
    if (productosConUnidad > 0) {
      res.status(400).json({ 
        error: 'No se puede eliminar: hay productos usando esta unidad de medida' 
      });
      return;
    }
    
    await prisma.unidadMedida.delete({
      where: { id },
    });
    
    res.status(204).send();
  },
};

