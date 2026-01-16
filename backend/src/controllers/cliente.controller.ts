import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const clienteSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido'),
  apellidos: z.string().optional(),
  contacto: z.string().optional(),
  nombreCompania: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  nit: z.string().optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

export const ClienteController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { search } = req.query;
    
    const clientes = await prisma.cliente.findMany({
      where: search ? {
        OR: [
          { nombre: { contains: String(search) } },
          { apellidos: { contains: String(search) } },
          { nit: { contains: String(search) } },
          { email: { contains: String(search) } },
        ],
      } : undefined,
      orderBy: { nombre: 'asc' },
    });
    
    res.json(clientes);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        ofertasCliente: { orderBy: { fecha: 'desc' }, take: 5 },
        ofertasImportadora: { orderBy: { fecha: 'desc' }, take: 5 },
        facturas: { orderBy: { fecha: 'desc' }, take: 5 },
      },
    });
    
    if (!cliente) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    
    res.json(cliente);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = clienteSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const cliente = await prisma.cliente.create({
      data: validation.data,
    });
    
    res.status(201).json(cliente);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = clienteSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: validation.data,
    });
    
    res.json(cliente);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await prisma.cliente.delete({
      where: { id },
    });
    
    res.status(204).send();
  },
};

