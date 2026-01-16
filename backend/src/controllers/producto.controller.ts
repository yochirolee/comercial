import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const productoSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().min(1, 'Nombre es requerido'),
  descripcion: z.string().optional(),
  precioBase: z.number().positive('El precio debe ser positivo'),
  unidadMedidaId: z.string().min(1, 'Unidad de medida es requerida'),
  activo: z.boolean().optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

export const ProductoController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { search, activo } = req.query;
    
    const productos = await prisma.producto.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { nombre: { contains: String(search) } },
              { codigo: { contains: String(search) } },
              { descripcion: { contains: String(search) } },
            ],
          } : {},
          activo !== undefined ? { activo: activo === 'true' } : {},
        ],
      },
      include: {
        unidadMedida: true,
      },
      orderBy: { nombre: 'asc' },
    });
    
    res.json(productos);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        unidadMedida: true,
      },
    });
    
    if (!producto) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    
    res.json(producto);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = productoSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Verificar si el código ya existe (si se proporciona)
    if (validation.data.codigo) {
      const existingProducto = await prisma.producto.findUnique({
        where: { codigo: validation.data.codigo },
      });
      
      if (existingProducto) {
        res.status(400).json({ error: 'Ya existe un producto con ese código' });
        return;
      }
    }

    const producto = await prisma.producto.create({
      data: validation.data,
      include: {
        unidadMedida: true,
      },
    });
    
    res.status(201).json(producto);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = productoSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Verificar si el código ya existe en otro producto
    if (validation.data.codigo) {
      const existingProducto = await prisma.producto.findFirst({
        where: { 
          codigo: validation.data.codigo,
          NOT: { id },
        },
      });
      
      if (existingProducto) {
        res.status(400).json({ error: 'Ya existe otro producto con ese código' });
        return;
      }
    }

    const producto = await prisma.producto.update({
      where: { id },
      data: validation.data,
      include: {
        unidadMedida: true,
      },
    });
    
    res.json(producto);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    // En lugar de eliminar, desactivamos el producto
    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });
    
    res.status(204).send();
  },
};

