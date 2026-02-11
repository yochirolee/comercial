import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { createOperationEvent } from './operation.controller.js';

const ofertaImportadoraSchema = z.object({
  numero: z.string().optional(),
  fecha: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente es requerido'),
  importadoraId: z.string().min(1, 'Importadora es requerida'),
  observaciones: z.string().optional(),
  estado: z.enum(['pendiente', 'aceptada', 'rechazada', 'vencida']).optional(),
  ofertaClienteId: z.string().optional(),
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  incluyeFirmaCliente: z.boolean().optional(),
  flete: z.number().min(0).optional(),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
});

// Genera el siguiente número de oferta en formato Z26XXX
async function generarNumeroOferta(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `Z${year}`;
  
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

  let maxNumero = 0;
  
  if (ultimaOfertaCliente?.numero) {
    const num = parseInt(ultimaOfertaCliente.numero.slice(3), 10);
    if (!isNaN(num) && num > maxNumero) maxNumero = num;
  }
  
  if (ultimaOfertaImportadora?.numero) {
    const num = parseInt(ultimaOfertaImportadora.numero.slice(3), 10);
    if (!isNaN(num) && num > maxNumero) maxNumero = num;
  }

  const siguiente = (maxNumero + 1).toString().padStart(3, '0');
  return `${prefix}${siguiente}`;
}

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  cantidadCajas: z.number().nullable().optional(),
  cantidadSacos: z.number().nullable().optional(),
  pesoNeto: z.number().nullable().optional(),
  pesoBruto: z.number().nullable().optional(),
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  precioAjustado: z.number().positive('El precio debe ser positivo').nullable().optional(), // Para edición directa
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

const crearDesdeOfertaSchema = z.object({
  ofertaClienteId: z.string().min(1, 'Oferta cliente es requerida'),
  importadoraId: z.string().min(1, 'Importadora es requerida'),
  numero: z.string().optional(),
  fecha: z.string().optional(),
  flete: z.number().min(0, 'Flete debe ser positivo'),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
  incluyeFirmaCliente: z.boolean().optional(),
  totalCifDeseado: z.number().optional(), // Si se quiere ajustar al crear
  // Términos
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  // Items opcionales: si se proporcionan, se usan; si no, se copian de la oferta cliente
  items: z.array(itemSchema).optional(),
});

// Función auxiliar para actualizar totales de la oferta (sin tocar precios)
async function actualizarTotales(ofertaId: string): Promise<void> {
  const oferta = await prisma.ofertaImportadora.findUnique({
    where: { id: ofertaId },
    include: { items: true },
  });
  
  if (!oferta) return;
  
  const flete = oferta.flete || 0;
  const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;
  
  // Sumar subtotales de items (ya tienen el precio ajustado aplicado)
  const subtotalProductos = oferta.items.reduce((acc, item) => acc + item.subtotal, 0);
  
  await prisma.ofertaImportadora.update({
    where: { id: ofertaId },
    data: {
      subtotalProductos,
      precioCIF: subtotalProductos + flete + seguro,
    },
  });
}

export const OfertaImportadoraController = {
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
        importadora: true,
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
        importadora: true,
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
  // Copia TODOS los valores de la oferta cliente (precios, cantidades, campos opcionales)
  async createFromOfertaCliente(req: Request, res: Response): Promise<void> {
    const validation = crearDesdeOfertaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { 
      ofertaClienteId, importadoraId, fecha, flete, seguro, tieneSeguro, incluyeFirmaCliente, totalCifDeseado,
      puertoEmbarque, origen, moneda, terminosPago, items: itemsProporcionados,
    } = validation.data;
    
    const numero = validation.data.numero || await generarNumeroOferta();

    const existingOferta = await prisma.ofertaImportadora.findUnique({
      where: { numero },
    });
    
    if (existingOferta) {
      res.status(400).json({ error: 'Ya existe una oferta con ese número' });
      return;
    }

    // Obtener oferta cliente con todos sus datos
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

    const seguroFinal = tieneSeguro ? (seguro || 0) : 0;
    
    // Determinar qué items usar: los proporcionados o los de la oferta cliente
    let itemsParaCrear: Array<{
      productoId: string;
      cantidad: number;
      cantidadCajas?: number | null;
      cantidadSacos?: number | null;
      pesoNeto?: number | null;
      pesoBruto?: number | null;
      precioOriginal: number;
      precioAjustado: number;
      subtotal: number;
      pesoXSaco?: number | null;
      precioXSaco?: number | null;
      pesoXCaja?: number | null;
      precioXCaja?: number | null;
      codigoArancelario?: string | null;
      campoExtra1?: string | null;
      campoExtra2?: string | null;
      campoExtra3?: string | null;
      campoExtra4?: string | null;
    }>;

    if (itemsProporcionados && itemsProporcionados.length > 0) {
      // Usar items proporcionados por el frontend
      itemsParaCrear = itemsProporcionados.map(item => {
        const precioFinal = item.precioAjustado || item.precioUnitario;
        const cantidadParaCalculo = item.pesoNeto || item.cantidad;
        const subtotal = precioFinal * cantidadParaCalculo;
        
        return {
          productoId: item.productoId,
          cantidad: item.cantidad,
          cantidadCajas: item.cantidadCajas || null,
          cantidadSacos: item.cantidadSacos || null,
          pesoNeto: item.pesoNeto || null,
          pesoBruto: item.pesoBruto || null,
          precioOriginal: item.precioUnitario,
          precioAjustado: precioFinal,
          subtotal,
          pesoXSaco: item.pesoXSaco || null,
          precioXSaco: item.precioXSaco || null,
          pesoXCaja: item.pesoXCaja || null,
          precioXCaja: item.precioXCaja || null,
          codigoArancelario: item.codigoArancelario || null,
          campoExtra1: item.campoExtra1 || null,
          campoExtra2: item.campoExtra2 || null,
          campoExtra3: item.campoExtra3 || null,
          campoExtra4: item.campoExtra4 || null,
        };
      });
    } else {
      // Copiar items de la oferta cliente (comportamiento original)
      itemsParaCrear = ofertaCliente.items.map(item => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        cantidadCajas: item.cantidadCajas,
        cantidadSacos: item.cantidadSacos,
        pesoNeto: item.pesoNeto,
        pesoBruto: item.pesoBruto,
        precioOriginal: item.precioUnitario,
        precioAjustado: item.precioUnitario,
        subtotal: item.subtotal,
        pesoXSaco: item.pesoXSaco,
        precioXSaco: item.precioXSaco,
        pesoXCaja: item.pesoXCaja,
        precioXCaja: item.precioXCaja,
        codigoArancelario: item.codigoArancelario,
        campoExtra1: item.campoExtra1,
        campoExtra2: item.campoExtra2,
        campoExtra3: item.campoExtra3,
        campoExtra4: item.campoExtra4,
      }));
    }
    
    // Calcular subtotal de productos desde los items que se van a crear
    const subtotalProductos = itemsParaCrear.reduce((acc, item) => acc + item.subtotal, 0);
    
    // CIF = Subtotal productos + Flete + Seguro
    const cifCalculado = subtotalProductos + flete + seguroFinal;

    // Crear/actualizar relación ClienteImportadora si no existe
    try {
      await prisma.clienteImportadora.upsert({
        where: {
          clienteId_importadoraId: {
            clienteId: ofertaCliente.clienteId,
            importadoraId,
          },
        },
        create: {
          clienteId: ofertaCliente.clienteId,
          importadoraId,
        },
        update: {},
      });
    } catch (error) {
      // Si ya existe, no hacer nada
    }

    // Crear oferta importadora con los items determinados
    const ofertaImportadora = await prisma.ofertaImportadora.create({
      data: {
        numero,
        fecha: fecha ? new Date(fecha) : new Date(),
        clienteId: ofertaCliente.clienteId,
        importadoraId,
        ofertaClienteId,
        codigoMincex: ofertaCliente.codigoMincex,
        // Usar valores proporcionados si existen, si no usar los de oferta cliente
        puertoEmbarque: puertoEmbarque || ofertaCliente.puertoEmbarque,
        origen: origen || ofertaCliente.origen,
        moneda: moneda || ofertaCliente.moneda,
        terminosPago: terminosPago || ofertaCliente.terminosPago,
        incluyeFirmaCliente: incluyeFirmaCliente ?? true,
        flete,
        seguro: seguroFinal,
        tieneSeguro: tieneSeguro || false,
        subtotalProductos,
        precioCIF: cifCalculado,
        items: {
          create: itemsParaCrear,
        },
      },
      include: {
        cliente: true,
        importadora: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });

    // Si se especificó un totalCifDeseado diferente, ajustar los precios
    if (totalCifDeseado && totalCifDeseado !== cifCalculado && totalCifDeseado > 0) {
      const totalFobDeseado = totalCifDeseado - flete - seguroFinal;
      
      if (totalFobDeseado > 0 && subtotalProductos > 0) {
        const factor = totalFobDeseado / subtotalProductos;
        
        // Ajustar precios de todos los items
        const items = ofertaImportadora.items;
        let subtotalAcumulado = 0;
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const cantidadParaCalculo = item.pesoNeto || item.cantidad;
          
          let nuevoPrecioAjustado: number;
          let nuevoSubtotal: number;
          
          if (i < items.length - 1) {
            nuevoPrecioAjustado = Math.round(item.precioOriginal * factor * 1000) / 1000;
            nuevoSubtotal = Math.round(cantidadParaCalculo * nuevoPrecioAjustado * 100) / 100;
            subtotalAcumulado += nuevoSubtotal;
          } else {
            // Último item absorbe diferencia de redondeo
            nuevoSubtotal = Math.round((totalFobDeseado - subtotalAcumulado) * 100) / 100;
            nuevoPrecioAjustado = cantidadParaCalculo > 0 
              ? Math.round((nuevoSubtotal / cantidadParaCalculo) * 1000) / 1000
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
        
        // Actualizar totales de la oferta
        await prisma.ofertaImportadora.update({
          where: { id: ofertaImportadora.id },
          data: {
            subtotalProductos: subtotalAcumulado,
            precioCIF: totalCifDeseado,
          },
        });
      }
    }

    // Buscar operación relacionada y crear evento automático
    try {
      const operation = await prisma.operation.findFirst({
        where: { offerCustomerId: ofertaClienteId },
      });
      
      if (operation) {
        await createOperationEvent(
          operation.id,
          'commercial',
          'Oferta a Importadora Creada',
          `Oferta ${ofertaImportadora.numero} creada`,
          ofertaImportadora.fecha
        );
      }
    } catch (error) {
      // No fallar si no se puede crear el evento
      console.error('Error al crear evento automático en operación:', error);
    }

    // Retornar la oferta actualizada
    const ofertaFinal = await prisma.ofertaImportadora.findUnique({
      where: { id: ofertaImportadora.id },
      include: {
        cliente: true,
        importadora: true,
        ofertaCliente: true,
        items: {
          include: {
            producto: { include: { unidadMedida: true } },
          },
        },
      },
    });

    res.status(201).json(ofertaFinal);
  },

  // Actualizar datos generales de la oferta (NO toca precios de items)
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
    
    // Solo actualizar totales (CIF = subtotal + flete + seguro) sin tocar precios
    await actualizarTotales(id);

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

    const cantidadParaCalculo = validation.data.pesoNeto || validation.data.cantidad;
    const subtotal = cantidadParaCalculo * validation.data.precioUnitario;

    await prisma.itemOfertaImportadora.create({
      data: {
        ofertaImportadoraId: id,
        productoId: validation.data.productoId,
        cantidad: validation.data.cantidad,
        cantidadCajas: validation.data.cantidadCajas,
        cantidadSacos: validation.data.cantidadSacos,
        pesoNeto: validation.data.pesoNeto,
        pesoBruto: validation.data.pesoBruto,
        precioOriginal: validation.data.precioUnitario,
        precioAjustado: validation.data.precioUnitario, // Igual al original
        subtotal,
        pesoXSaco: validation.data.pesoXSaco,
        precioXSaco: validation.data.precioXSaco,
        pesoXCaja: validation.data.pesoXCaja,
        precioXCaja: validation.data.precioXCaja,
        codigoArancelario: codigoArancelario ?? null,
        campoExtra1: validation.data.campoExtra1,
        campoExtra2: validation.data.campoExtra2,
        campoExtra3: validation.data.campoExtra3,
        campoExtra4: validation.data.campoExtra4,
      },
    });
    
    // Actualizar totales
    await actualizarTotales(id);
    
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

  // Actualizar un item - solo cambia los campos enviados, NO recalcula precios ajustados
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

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {};
    
    // Campos que se pueden actualizar directamente
    if (validation.data.productoId !== undefined) updateData.productoId = validation.data.productoId;
    if (validation.data.cantidadCajas !== undefined) updateData.cantidadCajas = validation.data.cantidadCajas;
    if (validation.data.cantidadSacos !== undefined) updateData.cantidadSacos = validation.data.cantidadSacos;
    if (validation.data.pesoNeto !== undefined) updateData.pesoNeto = validation.data.pesoNeto;
    if (validation.data.pesoBruto !== undefined) updateData.pesoBruto = validation.data.pesoBruto;
    if (validation.data.pesoXSaco !== undefined) updateData.pesoXSaco = validation.data.pesoXSaco;
    if (validation.data.precioXSaco !== undefined) updateData.precioXSaco = validation.data.precioXSaco;
    if (validation.data.pesoXCaja !== undefined) updateData.pesoXCaja = validation.data.pesoXCaja;
    if (validation.data.precioXCaja !== undefined) updateData.precioXCaja = validation.data.precioXCaja;
    if (validation.data.codigoArancelario !== undefined) updateData.codigoArancelario = validation.data.codigoArancelario;
    if (validation.data.campoExtra1 !== undefined) updateData.campoExtra1 = validation.data.campoExtra1;
    if (validation.data.campoExtra2 !== undefined) updateData.campoExtra2 = validation.data.campoExtra2;
    if (validation.data.campoExtra3 !== undefined) updateData.campoExtra3 = validation.data.campoExtra3;
    if (validation.data.campoExtra4 !== undefined) updateData.campoExtra4 = validation.data.campoExtra4;
    
    // Cantidad: si cambia, marcar para recalcular subtotal
    let recalcularSubtotal = false;
    if (validation.data.cantidad !== undefined) {
      updateData.cantidad = validation.data.cantidad;
      recalcularSubtotal = true;
    }
    
    // Precio unitario: si cambia, actualizar precioOriginal Y precioAjustado
    if (validation.data.precioUnitario !== undefined) {
      updateData.precioOriginal = validation.data.precioUnitario;
      updateData.precioAjustado = validation.data.precioUnitario;
      recalcularSubtotal = true;
    }
    
    // Precio ajustado directo: solo actualiza precioAjustado (NO precioOriginal)
    if (validation.data.precioAjustado !== undefined) {
      updateData.precioAjustado = validation.data.precioAjustado;
      recalcularSubtotal = true;
    }
    
    // pesoNeto también afecta el subtotal
    if (validation.data.pesoNeto !== undefined) {
      recalcularSubtotal = true;
    }
    
    // Solo recalcular subtotal si cambiaron cantidad, precio o pesoNeto
    if (recalcularSubtotal) {
      const cantidad = (updateData.cantidad as number) ?? existingItem.cantidad;
      const pesoNeto = (updateData.pesoNeto as number) ?? existingItem.pesoNeto;
      const precioAjustado = (updateData.precioAjustado as number) ?? existingItem.precioAjustado;
      
      const cantidadParaCalculo = pesoNeto || cantidad;
      updateData.subtotal = Math.round(cantidadParaCalculo * precioAjustado * 100) / 100;
    }

    await prisma.itemOfertaImportadora.update({
      where: { id: itemId },
      data: updateData,
    });
    
    // Actualizar totales de la oferta
    await actualizarTotales(id);
    
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
    
    await actualizarTotales(id);
    
    res.status(204).send();
  },

  // AJUSTAR AL TOTAL: Única función que modifica los precios ajustados
  // Calcula el factor necesario para que FOB + Flete + Seguro = totalCifDeseado
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

    const flete = oferta.flete || 0;
    const seguro = oferta.tieneSeguro ? (oferta.seguro || 0) : 0;

    // FOB deseado = CIF deseado - Flete - Seguro
    const totalFobDeseado = totalDeseado - flete - seguro;

    if (totalFobDeseado <= 0) {
      res.status(400).json({ error: `El total CIF deseado (${totalDeseado}) es menor que flete (${flete}) + seguro (${seguro})` });
      return;
    }

    // Calcular FOB actual basado en precios ORIGINALES (para mantener proporciones)
    const totalFobOriginal = oferta.items.reduce((sum, item) => {
      const cantidadParaCalculo = item.pesoNeto || item.cantidad;
      return sum + cantidadParaCalculo * item.precioOriginal;
    }, 0);

    if (totalFobOriginal === 0) {
      res.status(400).json({ error: 'La oferta no tiene productos con precio' });
      return;
    }

    // Factor de ajuste
    const factor = totalFobDeseado / totalFobOriginal;

    // Ordenar items por fecha de creación para consistencia
    const itemsOrdenados = [...oferta.items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Actualizar precios ajustados de cada item
    let subtotalAcumulado = 0;
    for (let i = 0; i < itemsOrdenados.length; i++) {
      const item = itemsOrdenados[i];
      const cantidadParaCalculo = item.pesoNeto || item.cantidad;
      
      let nuevoPrecioAjustado: number;
      let nuevoSubtotal: number;
      
      if (i < itemsOrdenados.length - 1) {
        // Para todos excepto el último, aplicar factor con redondeo a 3 decimales para precio
        nuevoPrecioAjustado = Math.round(item.precioOriginal * factor * 1000) / 1000;
        nuevoSubtotal = Math.round(cantidadParaCalculo * nuevoPrecioAjustado * 100) / 100;
        subtotalAcumulado += nuevoSubtotal;
      } else {
        // El último item absorbe la diferencia de redondeo para que el total sea exacto
        nuevoSubtotal = Math.round((totalFobDeseado - subtotalAcumulado) * 100) / 100;
        nuevoPrecioAjustado = cantidadParaCalculo > 0 
          ? Math.round((nuevoSubtotal / cantidadParaCalculo) * 1000) / 1000
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

    // Actualizar totales de la oferta
    await prisma.ofertaImportadora.update({
      where: { id },
      data: {
        subtotalProductos: subtotalAcumulado,
        precioCIF: totalDeseado, // El CIF queda exactamente como se pidió
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
