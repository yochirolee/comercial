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
  pesoNeto: z.number().nullable().optional(),
  pesoBruto: z.number().nullable().optional(),
  pesoXSaco: z.number().nullable().optional(),
  precioXSaco: z.number().nullable().optional(),
  pesoXCaja: z.number().nullable().optional(),
  precioXCaja: z.number().nullable().optional(),
  codigoArancelario: z.string().nullable().optional(), // Partida arancelaria
  campoExtra1: z.string().nullable().optional(),
  campoExtra2: z.string().nullable().optional(),
  campoExtra3: z.string().nullable().optional(),
  campoExtra4: z.string().nullable().optional(),
});

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
  // Items para crear en un solo paso
  items: z.array(itemSchema).optional(),
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

    // Extraer items del data
    const { items, ...ofertaData } = validation.data;

    // Calcular total si hay items
    let total = 0;
    const itemsToCreate = await Promise.all(
      items?.map(async (item) => {
        const cantidadParaCalculo = item.pesoNeto || item.cantidad;
        const subtotal = cantidadParaCalculo * item.precioUnitario;
        total += subtotal;
        
        // Obtener codigoArancelario del producto si no se proporciona o está vacío
        let codigoArancelario = item.codigoArancelario?.trim() || null;
        if ((!codigoArancelario || codigoArancelario === '') && item.productoId) {
          const producto = await prisma.producto.findUnique({
            where: { id: item.productoId },
          });
          if (producto && 'codigoArancelario' in producto && producto.codigoArancelario) {
            codigoArancelario = producto.codigoArancelario as string;
          }
        }
        
        return {
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal,
          cantidadCajas: item.cantidadCajas,
          cantidadSacos: item.cantidadSacos,
          pesoNeto: item.pesoNeto,
          pesoBruto: item.pesoBruto,
          pesoXSaco: item.pesoXSaco,
          precioXSaco: item.precioXSaco,
          pesoXCaja: item.pesoXCaja,
          precioXCaja: item.precioXCaja,
          codigoArancelario: codigoArancelario ?? null,
          campoExtra1: item.campoExtra1,
          campoExtra2: item.campoExtra2,
          campoExtra3: item.campoExtra3,
          campoExtra4: item.campoExtra4,
        };
      }) || []
    );

    const oferta = await prisma.ofertaCliente.create({
      data: {
        ...ofertaData,
        numero,
        fecha: ofertaData.fecha ? new Date(ofertaData.fecha) : new Date(),
        vigenciaHasta: ofertaData.vigenciaHasta ? new Date(ofertaData.vigenciaHasta) : null,
        total,
        items: itemsToCreate && itemsToCreate.length > 0 ? {
          create: itemsToCreate,
        } : undefined,
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

    // Extraer items y clienteId del data (no se pueden actualizar directamente)
    const { items, clienteId, ...updateData } = validation.data;

    const oferta = await prisma.ofertaCliente.update({
      where: { id },
      data: {
        ...updateData,
        fecha: updateData.fecha ? new Date(updateData.fecha) : undefined,
        vigenciaHasta: updateData.vigenciaHasta ? new Date(updateData.vigenciaHasta) : undefined,
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

    // Obtener producto para copiar codigoArancelario si no se proporciona o está vacío
    let codigoArancelario = validation.data.codigoArancelario?.trim() || null;
    if ((!codigoArancelario || codigoArancelario === '') && validation.data.productoId) {
      const producto = await prisma.producto.findUnique({
        where: { id: validation.data.productoId },
      });
      if (producto && 'codigoArancelario' in producto && producto.codigoArancelario) {
        codigoArancelario = producto.codigoArancelario as string;
      }
    }

    // Calcular subtotal: usar pesoNeto si existe, sino cantidad
    const cantidadParaCalculo = validation.data.pesoNeto || validation.data.cantidad;
    const subtotal = cantidadParaCalculo * validation.data.precioUnitario;

    const item = await prisma.itemOfertaCliente.create({
      data: {
        ofertaClienteId: id,
        ...validation.data,
        codigoArancelario: codigoArancelario ?? null,
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

    // Construir objeto de actualización incluyendo campos null para limpiarlos
    const updateData: any = {
      cantidad,
      precioUnitario,
      subtotal,
    };

    // Verificar si los campos están en el body original (incluso si son null)
    if ('pesoNeto' in req.body) updateData.pesoNeto = validation.data.pesoNeto ?? null;
    if ('cantidadCajas' in req.body) updateData.cantidadCajas = validation.data.cantidadCajas ?? null;
    if ('cantidadSacos' in req.body) updateData.cantidadSacos = validation.data.cantidadSacos ?? null;
    if ('pesoXSaco' in req.body) updateData.pesoXSaco = validation.data.pesoXSaco ?? null;
    if ('precioXSaco' in req.body) updateData.precioXSaco = validation.data.precioXSaco ?? null;
    if ('pesoXCaja' in req.body) updateData.pesoXCaja = validation.data.pesoXCaja ?? null;
    if ('precioXCaja' in req.body) updateData.precioXCaja = validation.data.precioXCaja ?? null;
    if ('codigoArancelario' in req.body) updateData.codigoArancelario = validation.data.codigoArancelario ?? null;

    const item = await prisma.itemOfertaCliente.update({
      where: { id: itemId },
      data: updateData,
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

  // Ajustar precios para llegar a un total deseado
  async adjustPrices(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { totalDeseado } = req.body;

    if (!totalDeseado || totalDeseado <= 0) {
      res.status(400).json({ error: 'El total deseado debe ser mayor a 0' });
      return;
    }

    const oferta = await prisma.ofertaCliente.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    if (oferta.items.length === 0) {
      res.status(400).json({ error: 'La oferta no tiene productos' });
      return;
    }

    // Calcular total actual
    const totalActual = oferta.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    if (totalActual === 0) {
      res.status(400).json({ error: 'La oferta no tiene productos con precio' });
      return;
    }

    // Calcular factor de ajuste
    const factor = totalDeseado / totalActual;

    // Actualizar precios de cada item (excepto el último)
    let totalAcumulado = 0;
    const itemsOrdenados = [...oferta.items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (let i = 0; i < itemsOrdenados.length; i++) {
      const item = itemsOrdenados[i];
      const cantidadParaCalculo = item.pesoNeto || item.cantidad;
      
      if (i < itemsOrdenados.length - 1) {
        // Para todos excepto el último, aplicar factor con redondeo
        const nuevoPrecio = Math.round(item.precioUnitario * factor * 100) / 100;
        const nuevoSubtotal = Math.round(cantidadParaCalculo * nuevoPrecio * 100) / 100;
        totalAcumulado += nuevoSubtotal;
        
        await prisma.itemOfertaCliente.update({
          where: { id: item.id },
          data: { 
            precioUnitario: nuevoPrecio,
            subtotal: nuevoSubtotal,
          },
        });
      } else {
        // Para el último item, calcular precio para que el total sea exacto
        const subtotalNecesario = Math.round((totalDeseado - totalAcumulado) * 100) / 100;
        const nuevoPrecio = cantidadParaCalculo > 0 
          ? Math.round((subtotalNecesario / cantidadParaCalculo) * 100) / 100
          : 0;
        
        await prisma.itemOfertaCliente.update({
          where: { id: item.id },
          data: { 
            precioUnitario: nuevoPrecio,
            subtotal: subtotalNecesario,
          },
        });
      }
    }

    // Actualizar total de la oferta
    await prisma.ofertaCliente.update({
      where: { id },
      data: { total: totalDeseado },
    });

    // Retornar oferta actualizada
    const ofertaActualizada = await prisma.ofertaCliente.findUnique({
      where: { id },
      include: {
        cliente: true,
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
