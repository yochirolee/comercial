import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const ofertaImportadoraSchema = z.object({
  numero: z.string().optional(), // Ahora es opcional, se genera automáticamente
  fecha: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente es requerido'),
  observaciones: z.string().optional(),
  estado: z.enum(['pendiente', 'aceptada', 'rechazada', 'vencida']).optional(),
  ofertaClienteId: z.string().optional(),
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  incluyeFirmaCliente: z.boolean().optional(),
  ajustarPrecios: z.boolean().optional(), // true = ajusta precios, false = suma flete/seguro al total
  precioAcordado: z.number().min(0).optional(),
  flete: z.number().min(0).optional(),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
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
  precioOriginal: z.number().positive('El precio debe ser positivo'),
  campoExtra1: z.string().optional(),
  campoExtra2: z.string().optional(),
  campoExtra3: z.string().optional(),
  campoExtra4: z.string().optional(),
});

const crearDesdeOfertaSchema = z.object({
  ofertaClienteId: z.string().min(1, 'Oferta cliente es requerida'),
  numero: z.string().optional(), // Ahora es opcional, se genera automáticamente
  flete: z.number().min(0, 'Flete debe ser positivo'),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
  incluyeFirmaCliente: z.boolean().optional(),
  ajustarPrecios: z.boolean().optional(), // true = ajusta precios, false = suma flete/seguro al total
});

// Recalcular totales y ajustar precios (respeta configuración ajustarPrecios)
async function recalcularOferta(ofertaId: string): Promise<void> {
  const oferta = await prisma.ofertaImportadora.findUnique({
    where: { id: ofertaId },
    include: { items: true },
  });
  
  if (!oferta) return;
  
  const flete = oferta.flete || 0;
  const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
  const precioAcordado = oferta.precioAcordado || 0;
  const debeAjustar = oferta.ajustarPrecios !== false; // Por defecto true
  
  // Calcular subtotal original de productos
  const subtotalOriginal = oferta.items.reduce((acc, item) => {
    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
    return acc + (cantidadParaCalculo * item.precioOriginal);
  }, 0);
  
  if (subtotalOriginal <= 0 || precioAcordado <= 0) {
    // Si no hay productos o precio acordado, solo actualizamos los totales básicos
    const subtotalProductos = oferta.items.reduce((acc, item) => acc + item.subtotal, 0);
    await prisma.ofertaImportadora.update({
      where: { id: ofertaId },
      data: {
        subtotalProductos,
        precioCIF: subtotalProductos + flete + seguro,
      },
    });
    return;
  }

  let fobFinal: number;
  let cifFinal: number;
  let factorAjuste: number;

  if (debeAjustar) {
    // MODO AJUSTE: El cliente paga lo acordado, se ajustan los precios
    fobFinal = precioAcordado - flete - seguro;
    cifFinal = precioAcordado;
    
    if (fobFinal <= 0) {
      await prisma.ofertaImportadora.update({
        where: { id: ofertaId },
        data: {
          subtotalProductos: 0,
          precioCIF: precioAcordado,
        },
      });
      return;
    }
    
    factorAjuste = fobFinal / subtotalOriginal;
  } else {
    // MODO SIN AJUSTE: Flete y seguro se suman al precio acordado
    fobFinal = subtotalOriginal; // FOB = precio original de productos
    cifFinal = subtotalOriginal + flete + seguro; // CIF = FOB + flete + seguro
    factorAjuste = 1; // No hay ajuste
  }
  
  // Actualizar cada item con precio ajustado
  for (const item of oferta.items) {
    const precioAjustado = item.precioOriginal * factorAjuste;
    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
    const subtotal = cantidadParaCalculo * precioAjustado;
    
    await prisma.itemOfertaImportadora.update({
      where: { id: item.id },
      data: {
        precioAjustado,
        subtotal,
      },
    });
  }
  
  // Actualizar totales de la oferta
  await prisma.ofertaImportadora.update({
    where: { id: ofertaId },
    data: {
      subtotalProductos: fobFinal,
      precioCIF: cifFinal,
    },
  });
}

export const OfertaImportadoraController = {
  // Obtener el siguiente número de oferta disponible
  async getNextNumber(req: Request, res: Response): Promise<void> {
    const numero = await generarNumeroOferta();
    res.json({ numero });
  },

  async getAll(req: Request, res: Response): Promise<void> {
    const { estado, clienteId } = req.query;
    
    const ofertas = await prisma.ofertaImportadora.findMany({
      where: {
        AND: [
          estado ? { estado: String(estado) } : {},
          clienteId ? { clienteId: String(clienteId) } : {},
        ],
      },
      include: {
        cliente: true,
        ofertaCliente: true,
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
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
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
    const validation = ofertaImportadoraSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    // Generar número automático si no se proporciona
    const numero = validation.data.numero || await generarNumeroOferta();

    const existingOferta = await prisma.ofertaImportadora.findUnique({
      where: { numero },
    });
    
    if (existingOferta) {
      res.status(400).json({ error: 'Ya existe una oferta con ese número' });
      return;
    }

    const oferta = await prisma.ofertaImportadora.create({
      data: {
        ...validation.data,
        numero,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : new Date(),
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : null,
      },
      include: {
        cliente: true,
        ofertaCliente: true,
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

  // Crear oferta importadora desde una oferta al cliente
  async createFromOfertaCliente(req: Request, res: Response): Promise<void> {
    const validation = crearDesdeOfertaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { ofertaClienteId, flete, seguro, tieneSeguro, incluyeFirmaCliente, ajustarPrecios } = validation.data;
    
    // Generar número automático si no se proporciona
    const numero = validation.data.numero || await generarNumeroOferta();

    // Verificar número único
    const existingOferta = await prisma.ofertaImportadora.findUnique({
      where: { numero },
    });
    
    if (existingOferta) {
      res.status(400).json({ error: 'Ya existe una oferta con ese número' });
      return;
    }

    // Obtener oferta cliente
    const ofertaCliente = await prisma.ofertaCliente.findUnique({
      where: { id: ofertaClienteId },
      include: {
        cliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });

    if (!ofertaCliente) {
      res.status(404).json({ error: 'Oferta cliente no encontrada' });
      return;
    }

    const precioAcordado = ofertaCliente.total;
    const seguroFinal = tieneSeguro ? (seguro || 0) : 0;
    
    // Calcular subtotal de productos desde los items
    const subtotalProductos = ofertaCliente.items.reduce((acc, item) => acc + item.subtotal, 0);
    
    // CIF = Subtotal productos + Flete + Seguro
    const cifFinal = subtotalProductos + flete + seguroFinal;

    // Crear oferta importadora
    const ofertaImportadora = await prisma.ofertaImportadora.create({
      data: {
        numero,
        clienteId: ofertaCliente.clienteId,
        ofertaClienteId,
        codigoMincex: ofertaCliente.codigoMincex,
        puertoEmbarque: ofertaCliente.puertoEmbarque,
        origen: ofertaCliente.origen,
        moneda: ofertaCliente.moneda,
        terminosPago: ofertaCliente.terminosPago,
        incluyeFirmaCliente: incluyeFirmaCliente ?? true,
        ajustarPrecios: false, // No se ajustan precios en creación
        precioAcordado,
        flete,
        seguro: seguroFinal,
        tieneSeguro: tieneSeguro || false,
        subtotalProductos: subtotalProductos,
        precioCIF: cifFinal,
        items: {
          create: ofertaCliente.items.map(item => {
            // Usar subtotal de oferta cliente directamente (ya tiene ajustes aplicados)
            return {
              productoId: item.productoId,
              cantidad: item.cantidad,
              cantidadCajas: item.cantidadCajas,
              cantidadSacos: item.cantidadSacos,
              pesoNeto: item.pesoNeto,
              pesoBruto: item.pesoBruto,
              precioOriginal: item.precioUnitario,
              precioAjustado: item.precioUnitario,
              subtotal: item.subtotal, // Usar subtotal guardado para mantener exactitud
              // Campos opcionales informativos
              pesoXSaco: item.pesoXSaco,
              precioXSaco: item.precioXSaco,
              pesoXCaja: item.pesoXCaja,
              precioXCaja: item.precioXCaja,
              campoExtra1: item.campoExtra1,
              campoExtra2: item.campoExtra2,
              campoExtra3: item.campoExtra3,
              campoExtra4: item.campoExtra4,
            };
          }),
        },
      },
      include: {
        cliente: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });

    res.status(201).json(ofertaImportadora);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = ofertaImportadoraSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    if (validation.data.numero) {
      const existingOferta = await prisma.ofertaImportadora.findFirst({
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

    await prisma.ofertaImportadora.update({
      where: { id },
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : undefined,
        vigenciaHasta: validation.data.vigenciaHasta ? new Date(validation.data.vigenciaHasta) : undefined,
      },
    });
    
    // Recalcular si cambió flete, seguro o precio acordado
    if (validation.data.flete !== undefined || 
        validation.data.seguro !== undefined || 
        validation.data.precioAcordado !== undefined ||
        validation.data.tieneSeguro !== undefined) {
      await recalcularOferta(id);
    }

    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
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
    
    await prisma.ofertaImportadora.delete({
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

    // Inicialmente, precio ajustado = precio original
    const cantidadParaCalculo = validation.data.pesoNeto || validation.data.cantidad;
    const subtotal = cantidadParaCalculo * validation.data.precioOriginal;

    await prisma.itemOfertaImportadora.create({
      data: {
        ofertaImportadoraId: id,
        ...validation.data,
        precioAjustado: validation.data.precioOriginal,
        subtotal,
      },
    });
    
    // Recalcular para ajustar precios
    await recalcularOferta(id);
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    res.status(201).json(oferta);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    const validation = itemSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingItem = await prisma.itemOfertaImportadora.findUnique({
      where: { id: itemId },
    });
    
    if (!existingItem) {
      res.status(404).json({ error: 'Item no encontrado' });
      return;
    }

    // Obtener los datos a actualizar
    const updateData = { ...validation.data };
    
    // Calcular el nuevo subtotal si cambió cantidad o precioOriginal
    const cantidad = updateData.cantidad ?? existingItem.cantidad;
    const pesoNeto = updateData.pesoNeto ?? existingItem.pesoNeto;
    const precioOriginal = updateData.precioOriginal ?? existingItem.precioOriginal;
    const precioAjustado = existingItem.precioAjustado; // Mantener el precio ajustado actual
    
    const cantidadParaCalculo = pesoNeto || cantidad;
    
    // Si cambió el precioOriginal, ajustar también el precioAjustado proporcionalmente
    if (updateData.precioOriginal !== undefined && updateData.precioOriginal !== existingItem.precioOriginal) {
      const ratio = existingItem.precioOriginal > 0 
        ? existingItem.precioAjustado / existingItem.precioOriginal 
        : 1;
      updateData.precioAjustado = Math.round(updateData.precioOriginal * ratio * 100) / 100;
    }
    
    // Calcular subtotal con el precio ajustado (actual o nuevo)
    const finalPrecioAjustado = updateData.precioAjustado ?? precioAjustado;
    updateData.subtotal = Math.round(cantidadParaCalculo * finalPrecioAjustado * 100) / 100;

    await prisma.itemOfertaImportadora.update({
      where: { id: itemId },
      data: updateData,
    });
    
    // Solo actualizar los totales de la oferta (sin recalcular precios ajustados)
    const ofertaItems = await prisma.itemOfertaImportadora.findMany({
      where: { ofertaImportadoraId: id },
    });
    
    const subtotalProductos = ofertaItems.reduce((acc, item) => acc + item.subtotal, 0);
    const ofertaData = await prisma.ofertaImportadora.findUnique({ where: { id } });
    const flete = ofertaData?.flete || 0;
    const seguro = ofertaData?.tieneSeguro ? (ofertaData.seguro || 0) : 0;
    
    await prisma.ofertaImportadora.update({
      where: { id },
      data: {
        subtotalProductos,
        precioCIF: subtotalProductos + flete + seguro,
      },
    });
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    res.json(oferta);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    
    await prisma.itemOfertaImportadora.delete({
      where: { id: itemId },
    });
    
    await recalcularOferta(id);
    
    res.status(204).send();
  },

  // Recalcular precios manualmente
  async recalcular(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await recalcularOferta(id);
    
    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });
    
    res.json(oferta);
  },

  // Ajustar precios para llegar a un total CIF deseado (sin tocar flete ni seguro)
  async adjustPrices(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { totalDeseado } = req.body;

    if (!totalDeseado || totalDeseado <= 0) {
      res.status(400).json({ error: 'El total deseado debe ser mayor a 0' });
      return;
    }

    const oferta = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }

    // Flete y seguro actuales
    const flete = oferta.flete || 0;
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;

    // Total FOB deseado = Total CIF deseado - Flete - Seguro
    const totalFobDeseado = totalDeseado - flete - seguro;

    if (totalFobDeseado <= 0) {
      res.status(400).json({ error: `El total deseado (${totalDeseado}) es menor que flete (${flete}) + seguro (${seguro})` });
      return;
    }

    // Calcular total FOB actual basado en precios ORIGINALES (para mantener proporciones)
    const totalFobOriginal = oferta.items.reduce((sum, item) => {
      const cantidadParaCalculo = item.pesoNeto || item.cantidad;
      return sum + cantidadParaCalculo * item.precioOriginal;
    }, 0);

    if (totalFobOriginal === 0) {
      res.status(400).json({ error: 'La oferta no tiene productos con precio' });
      return;
    }

    // Calcular factor de ajuste
    const factor = totalFobDeseado / totalFobOriginal;

    // Ordenar items para consistencia (ajustar el último para absorber redondeo)
    const itemsOrdenados = [...oferta.items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Actualizar precios ajustados y subtotales de cada item
    let subtotalAcumulado = 0;
    for (let i = 0; i < itemsOrdenados.length; i++) {
      const item = itemsOrdenados[i];
      const cantidadParaCalculo = item.pesoNeto || item.cantidad;
      
      let nuevoPrecioAjustado: number;
      let nuevoSubtotal: number;
      
      if (i < itemsOrdenados.length - 1) {
        // Para todos excepto el último, aplicar factor con redondeo
        nuevoPrecioAjustado = Math.round(item.precioOriginal * factor * 100) / 100;
        nuevoSubtotal = Math.round(cantidadParaCalculo * nuevoPrecioAjustado * 100) / 100;
        subtotalAcumulado += nuevoSubtotal;
      } else {
        // Para el último item, calcular para que el total sea exacto
        nuevoSubtotal = Math.round((totalFobDeseado - subtotalAcumulado) * 100) / 100;
        nuevoPrecioAjustado = cantidadParaCalculo > 0 
          ? Math.round((nuevoSubtotal / cantidadParaCalculo) * 100) / 100
          : 0;
        subtotalAcumulado += nuevoSubtotal;
      }
      
      await prisma.itemOfertaImportadora.update({
        where: { id: item.id },
        data: { 
          precioAjustado: nuevoPrecioAjustado,
          subtotal: nuevoSubtotal,
        },
      });
    }
    
    const subtotalProductos = subtotalAcumulado;

    // Actualizar totales de la oferta Y el precio acordado (para que futuros recálculos lo respeten)
    await prisma.ofertaImportadora.update({
      where: { id },
      data: {
        precioAcordado: totalDeseado, // Nuevo precio acordado = total CIF deseado
        subtotalProductos,
        precioCIF: totalDeseado,
      },
    });

    // Retornar oferta actualizada
    const ofertaActualizada = await prisma.ofertaImportadora.findUnique({
      where: { id },
      include: {
        cliente: true,
        ofertaCliente: true,
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
