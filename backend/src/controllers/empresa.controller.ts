import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const empresaSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido'),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(), // Permite múltiples emails separados por coma
  nit: z.string().optional(),
  representante: z.string().optional(),
  cargoRepresentante: z.string().optional(),
  codigoMincex: z.string().optional(),
  logo: z.string().optional(),
  firmaPresidente: z.string().optional(),
  cunoEmpresa: z.string().optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

/** Misma fila en lectura y escritura si hay varios registros legacy. */
const empresaFindFirstArgs = { orderBy: { updatedAt: 'desc' as const } };

export const EmpresaController = {
  async get(_req: Request, res: Response): Promise<void> {
    const empresa = await prisma.empresa.findFirst(empresaFindFirstArgs);
    res.json(empresa);
  },

  async upsert(req: Request, res: Response): Promise<void> {
    const validation = empresaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingEmpresa = await prisma.empresa.findFirst(empresaFindFirstArgs);
    
    if (existingEmpresa) {
      const empresa = await prisma.empresa.update({
        where: { id: existingEmpresa.id },
        data: validation.data,
      });
      res.json(empresa);
    } else {
      const empresa = await prisma.empresa.create({
        data: validation.data,
      });
      res.status(201).json(empresa);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = empresaSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const empresa = await prisma.empresa.update({
      where: { id },
      data: validation.data,
    });
    res.json(empresa);
  },
};

