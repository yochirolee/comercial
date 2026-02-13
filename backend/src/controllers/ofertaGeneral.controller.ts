import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  // Campos informativos opcionales - aceptan null para limpiar valores
  cantidadCajas: z.number().nullable().optional(),
  cantidadSacos: z.number().nullable().optional(),
  pesoXSaco: z.number().nullable().optional(),
  precioXSaco: z.number().nullable().optional(),
  pesoXCaja: z.number().nullable().optional(),
  precioXCaja: z.number().nullable().optional(),
  campoExtra1: z.string().nullable().optional(),
  campoExtra2: z.string().nullable().optional(),
  campoExtra3: z.string().nullable().optional(),
  campoExtra4: z.string().nullable().optional(),
});

const ofertaGeneralSchema = z.object({
  numero: z.string().optional(), // Ahora es opcional, se genera si no se proporciona
  fecha: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.enum(['activa', 'vencida', 'cancelada']).optional(),
  // Items para crear en un solo paso
  items: z.array(itemSchema).optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

// Generar número consecutivo para ofertas generales
async function generarNumeroOfertaGeneral(): Promise<string> {
  const ultimaOferta = await prisma.ofertaGeneral.findFirst({
    where: {
      numero: {
        startsWith: 'LP-',
      },
    },
    orderBy: {
      numero: 'desc',
    },
  });

  let siguienteNumero = 1;
  if (ultimaOferta?.numero) {
    const match = ultimaOferta.numero.match(/LP-(\d+)/);
    if (match) {
      siguienteNumero = parseInt(match[1], 10) + 1;
    }
  }

  return `LP-${siguienteNumero.toString().padStart(3, '0')}`;
}

export const OfertaGeneralController = {
  // Obtener siguiente número disponible
  async getNextNumber(req: Request, res: Response): Promise<void> {
    const numero = await generarNumeroOfertaGeneral();
    res.json({ numero });
  },

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { estado } = req.query;
      
      // Construir where clause de manera segura
      const where: any = {};
      if (estado && String(estado).trim() !== '') {
        where.estado = String(estado);
      }
      
      const ofertas = await prisma.ofertaGeneral.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
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
    } catch (error: any) {
      console.error('Error en getAll ofertas generales:', error);
      res.status(500).json({ 
        error: 'Error al obtener ofertas generales',
        message: error.message 
      });
    }
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

    // Generar número si no se proporciona
    let numero = validation.data.numero;
    if (!numero || numero.trim() === '') {
      numero = await generarNumeroOfertaGeneral();
    } else {
      // Verificar número único si se proporciona
      const existingOferta = await prisma.ofertaGeneral.findUnique({
        where: { numero },
      });
      
      if (existingOferta) {
        res.status(400).json({ error: 'Ya existe una oferta con ese número' });
        return;
      }
    }

    // Extraer items del data
    const { items, ...ofertaData } = validation.data;

    const oferta = await prisma.ofertaGeneral.create({
      data: {
        ...ofertaData,
        numero,
        fecha: ofertaData.fecha ? new Date(ofertaData.fecha) : new Date(),
        vigenciaHasta: ofertaData.vigenciaHasta ? new Date(ofertaData.vigenciaHasta) : null,
        // Crear items si se proporcionan
        items: items && items.length > 0 ? {
          create: items.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
            cantidadCajas: item.cantidadCajas,
            cantidadSacos: item.cantidadSacos,
            pesoXSaco: item.pesoXSaco,
            precioXSaco: item.precioXSaco,
            pesoXCaja: item.pesoXCaja,
            precioXCaja: item.precioXCaja,
            campoExtra1: item.campoExtra1,
            campoExtra2: item.campoExtra2,
            campoExtra3: item.campoExtra3,
            campoExtra4: item.campoExtra4,
          })),
        } : undefined,
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

    // Extraer items del data (no se puede actualizar directamente)
    const { items, ...updateData } = validation.data;

    const oferta = await prisma.ofertaGeneral.update({
      where: { id },
      data: {
        ...updateData,
        fecha: updateData.fecha ? new Date(updateData.fecha) : undefined,
        vigenciaHasta: updateData.vigenciaHasta ? new Date(updateData.vigenciaHasta) : undefined,
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

    const itemData = validation.data;
    const item = await prisma.itemOfertaGeneral.create({
      data: {
        ofertaGeneralId: id,
        ...itemData,
        subtotal: itemData.cantidad * itemData.precioUnitario,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    res.status(201).json(item);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { itemId } = req.params;
    const validation = itemSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Construir objeto de actualización - incluir todos los campos que vienen en el body original
    const updateData: any = {};

    // Campos requeridos
    if (validation.data.cantidad !== undefined) updateData.cantidad = validation.data.cantidad;
    if (validation.data.precioUnitario !== undefined) updateData.precioUnitario = validation.data.precioUnitario;
    
    // Campos opcionales - verificar si están en el body original (incluso si son null)
    if ('cantidadCajas' in req.body) updateData.cantidadCajas = validation.data.cantidadCajas ?? null;
    if ('cantidadSacos' in req.body) updateData.cantidadSacos = validation.data.cantidadSacos ?? null;
    if ('pesoXSaco' in req.body) updateData.pesoXSaco = validation.data.pesoXSaco ?? null;
    if ('precioXSaco' in req.body) updateData.precioXSaco = validation.data.precioXSaco ?? null;
    if ('pesoXCaja' in req.body) updateData.pesoXCaja = validation.data.pesoXCaja ?? null;
    if ('precioXCaja' in req.body) updateData.precioXCaja = validation.data.precioXCaja ?? null;
    
    const item = await prisma.itemOfertaGeneral.update({
      where: { id: itemId },
      data: updateData,
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    res.json(item);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { itemId } = req.params;
    
    await prisma.itemOfertaGeneral.delete({
      where: { id: itemId },
    });
    
    res.status(204).send();
  },

  // Ajustar precios para llegar a un total deseado
  async adjustPrices(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { totalDeseado } = req.body;

    if (!totalDeseado || totalDeseado <= 0) {
      res.status(400).json({ error: 'El total deseado debe ser mayor a 0' });
      return;
    }

    const oferta = await prisma.ofertaGeneral.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    // Calcular total actual
    const totalActual = oferta.items.reduce(
      (sum, item) => sum + item.cantidad * item.precioUnitario,
      0
    );

    if (totalActual === 0) {
      res.status(400).json({ error: 'La oferta no tiene productos con precio' });
      return;
    }

    // Calcular factor de ajuste
    const factor = totalDeseado / totalActual;

    // Actualizar precios de cada item
    for (const item of oferta.items) {
      const nuevoPrecio = Math.round(item.precioUnitario * factor * 100) / 100; // Redondear a 2 decimales
      await prisma.itemOfertaGeneral.update({
        where: { id: item.id },
        data: { precioUnitario: nuevoPrecio },
      });
    }

    // Retornar oferta actualizada
    const ofertaActualizada = await prisma.ofertaGeneral.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });

    res.json(ofertaActualizada);
  },
};

