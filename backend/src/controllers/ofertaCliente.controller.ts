import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const ofertaClienteSchema = z.object({
  numero: z.string().optional(), // Ahora es opcional, se genera automáticamente
  fecha: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente es requerido'),
  observaciones: z.string().optional(),
  estado: z.enum(['pendiente', 'aceptada', 'rechazada', 'vencida']).optional(),
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  incluyeFirmaCliente: z.boolean().optional(),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

// Genera el siguiente número de oferta en formato Z26XXX
async function generarNumeroOferta(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26" para 2026
  const prefix = `Z${year}`;
  
  // Buscar el último número de oferta del año actual en ambas tablas
  const [ultimaOfertaCliente, ultimaOfertaImportadora] = await Promise.all([
    prisma.ofertaCliente.findFirst({
      where: { numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    }),
    prisma.ofertaImportadora.findFirst({
      where: { numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    }),
  ]);

  // Extraer los números consecutivos
  let maxNumero = 0;
  
  if (ultimaOfertaCliente?.numero) {
    const num = parseInt(ultimaOfertaCliente.numero.slice(3), 10);
    if (!isNaN(num) && num > maxNumero) maxNumero = num;
  }
  
  if (ultimaOfertaImportadora?.numero) {
    const num = parseInt(ultimaOfertaImportadora.numero.slice(3), 10);
    if (!isNaN(num) && num > maxNumero) maxNumero = num;
  }

  // Siguiente número con padding de 3 dígitos
  const siguiente = (maxNumero + 1).toString().padStart(3, '0');
  return `${prefix}${siguiente}`;
}

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  cantidadCajas: z.number().optional(),
  pesoNeto: z.number().optional(),
  pesoBruto: z.number().optional(),
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

async function calcularTotal(ofertaId: string): Promise<void> {
  const items = await prisma.itemOfertaCliente.findMany({
    where: { ofertaClienteId: ofertaId },
  });
  
  const total = items.reduce((acc, item) => acc + item.subtotal, 0);
  
  await prisma.ofertaCliente.update({
    where: { id: ofertaId },
    data: { total },
  });
}

export const OfertaClienteController = {
  // Obtener el siguiente número de oferta disponible
  async getNextNumber(req: Request, res: Response): Promise<void> {
    const numero = await generarNumeroOferta();
    res.json({ numero });
  },

  async getAll(req: Request, res: Response): Promise<void> {
    const { estado, clienteId } = req.query;
    
    const ofertas = await prisma.ofertaCliente.findMany({
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
    
    res.json(ofertas);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const oferta = await prisma.ofertaCliente.findUnique({
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
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }
    
    res.json(oferta);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = ofertaClienteSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Generar número automático si no se proporciona
    const numero = validation.data.numero || await generarNumeroOferta();

    // Verificar que no exista
    const existingOferta = await prisma.ofertaCliente.findUnique({
      where: { numero },
    });
    
    if (existingOferta) {
      res.status(400).json({ error: 'Ya existe una oferta con ese número' });
      return;
    }

    const oferta = await prisma.ofertaCliente.create({
      data: {
        ...validation.data,
        numero,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : new Date(),
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : null,
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
    
    res.status(201).json(oferta);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = ofertaClienteSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    if (validation.data.numero) {
      const existingOferta = await prisma.ofertaCliente.findFirst({
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

    const oferta = await prisma.ofertaCliente.update({
      where: { id },
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : undefined,
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : undefined,
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
    
    res.json(oferta);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await prisma.ofertaCliente.delete({
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

    // Calcular subtotal: usar pesoNeto si existe, sino cantidad
    const cantidadParaCalculo = validation.data.pesoNeto || validation.data.cantidad;
    const subtotal = cantidadParaCalculo * validation.data.precioUnitario;

    const item = await prisma.itemOfertaCliente.create({
      data: {
        ofertaClienteId: id,
        ...validation.data,
        subtotal,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    await calcularTotal(id);
    
    res.status(201).json(item);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    const validation = itemSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingItem = await prisma.itemOfertaCliente.findUnique({
      where: { id: itemId },
    });
    
    if (!existingItem) {
      res.status(404).json({ error: 'Item no encontrado' });
      return;
    }

    const cantidad = validation.data.cantidad ?? existingItem.cantidad;
    const pesoNeto = validation.data.pesoNeto ?? existingItem.pesoNeto;
    const precioUnitario = validation.data.precioUnitario ?? existingItem.precioUnitario;
    const cantidadParaCalculo = pesoNeto || cantidad;
    const subtotal = cantidadParaCalculo * precioUnitario;

    const item = await prisma.itemOfertaCliente.update({
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
    
    await calcularTotal(id);
    
    res.json(item);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    
    await prisma.itemOfertaCliente.delete({
      where: { id: itemId },
    });
    
    await calcularTotal(id);
    
    res.status(204).send();
  },
};
