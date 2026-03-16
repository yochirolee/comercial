import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const categoriaSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido').max(100),
});

export const CategoriaProductoController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    const categorias = await prisma.categoriaProducto.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
    });
    res.json(categorias);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = categoriaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existing = await prisma.categoriaProducto.findUnique({
      where: { nombre: validation.data.nombre },
    });
    if (existing) {
      res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
      return;
    }

    const categoria = await prisma.categoriaProducto.create({
      data: validation.data,
    });
    res.status(201).json(categoria);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = categoriaSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existing = await prisma.categoriaProducto.findFirst({
      where: { nombre: validation.data.nombre, NOT: { id } },
    });
    if (existing) {
      res.status(400).json({ error: 'Ya existe otra categoría con ese nombre' });
      return;
    }

    const categoria = await prisma.categoriaProducto.update({
      where: { id },
      data: validation.data,
    });
    res.json(categoria);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const count = await prisma.producto.count({ where: { categoriaId: id } });
    if (count > 0) {
      res.status(400).json({
        error: `No se puede eliminar: ${count} producto(s) usan esta categoría. Reasígnalos primero.`,
      });
      return;
    }

    await prisma.categoriaProducto.delete({ where: { id } });
    res.status(204).send();
  },
};
