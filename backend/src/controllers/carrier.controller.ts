import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// URL puede contener placeholder {container}; .url() estricto falla con placeholders
const carrierSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  trackingUrlTemplate: z
    .string()
    .min(1, 'URL de tracking es requerida')
    .refine((s) => s.startsWith('http://') || s.startsWith('https://'), 'Debe ser una URL (http o https)'),
  scac: z.string().max(4).optional().nullable(),
});

export const CarrierController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    const carriers = await prisma.carrier.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(carriers);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = carrierSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const scac = validation.data.scac?.trim();
    const carrier = await prisma.carrier.create({
      data: {
        name: validation.data.name,
        trackingUrlTemplate: validation.data.trackingUrlTemplate,
        scac: scac && scac.length > 0 ? scac.toUpperCase().slice(0, 4) : null,
      },
    });

    res.status(201).json(carrier);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = carrierSchema.partial().safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    try {
      const carrier = await prisma.carrier.update({
        where: { id },
        data: validation.data,
      });
      res.json(carrier);
    } catch (error) {
      console.error('Error updating carrier', error);
      res.status(404).json({ error: 'Carrier no encontrado' });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      await prisma.carrier.delete({
        where: { id },
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting carrier', error);
      res.status(404).json({ error: 'Carrier no encontrado' });
    }
  },
};

