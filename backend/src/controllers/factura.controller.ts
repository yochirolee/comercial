import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const facturaSchema = z.object({
  numero: z.string().min(1, 'Número de factura es requerido'),
  fecha: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  clienteId: z.string().min(1, 'Cliente es requerido'),
  observaciones: z.string().optional(),
  estado: z.enum(['pendiente', 'pagada', 'vencida', 'cancelada']).optional(),
  // Costos
  flete: z.number().min(0).optional(),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
  impuestos: z.number().min(0).optional(),
  descuento: z.number().min(0).optional(),
  // Términos
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  // Firmas
  incluyeFirmaCliente: z.boolean().optional(),
  firmaClienteNombre: z.string().optional(),
  firmaClienteCargo: z.string().optional(),
  firmaClienteEmpresa: z.string().optional(),
  // Origen
  tipoOfertaOrigen: z.enum(['cliente', 'importadora']).optional(),
  ofertaOrigenId: z.string().optional(),
});

const itemSchema = z.object({
  productoId: z.string().min(1, 'Producto es requerido'),
  descripcion: z.string().optional(),
  cantidad: z.number().positive('La cantidad debe ser positiva'),
  cantidadCajas: z.number().optional(),
  cantidadSacos: z.number().optional(),
  pesoNeto: z.number().optional(),
  pesoBruto: z.number().optional(),
  precioUnitario: z.number().positive('El precio debe ser positivo'),
  pesoXSaco: z.number().optional(),
  precioXSaco: z.number().optional(),
  pesoXCaja: z.number().optional(),
  precioXCaja: z.number().optional(),
  codigoArancelario: z.string().optional(),
});

const fromOfertaClienteSchema = z.object({
  ofertaClienteId: z.string().min(1, 'ID de oferta cliente es requerido'),
  numeroFactura: z.string().min(1, 'Número de factura es requerido'),
  fecha: z.string().optional(),
  // Costos adicionales
  flete: z.number().min(0).optional(),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
  // Términos (opcionales, si no se envían se toman de la oferta)
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  // Firma cliente
  incluyeFirmaCliente: z.boolean().optional(),
  firmaClienteNombre: z.string().optional(),
  firmaClienteCargo: z.string().optional(),
  firmaClienteEmpresa: z.string().optional(),
  // Total deseado para ajustar precios
  totalDeseado: z.number().optional(),
});

const fromOfertaImportadoraSchema = z.object({
  ofertaImportadoraId: z.string().min(1, 'ID de oferta importadora es requerido'),
  numeroFactura: z.string().min(1, 'Número de factura es requerido'),
  fecha: z.string().optional(),
  // Costos adicionales (opcionales, se toman de la oferta si no se envían)
  flete: z.number().min(0).optional(),
  seguro: z.number().min(0).optional(),
  tieneSeguro: z.boolean().optional(),
  // Términos (opcionales, si no se envían se toman de la oferta)
  codigoMincex: z.string().optional(),
  puertoEmbarque: z.string().optional(),
  origen: z.string().optional(),
  moneda: z.string().optional(),
  terminosPago: z.string().optional(),
  // Firma cliente
  incluyeFirmaCliente: z.boolean().optional(),
  firmaClienteNombre: z.string().optional(),
  firmaClienteCargo: z.string().optional(),
  firmaClienteEmpresa: z.string().optional(),
  // Total deseado para ajustar precios
  totalDeseado: z.number().optional(),
});

async function calcularTotales(facturaId: string): Promise<void> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { items: true },
  });
  
  if (!factura) return;
  
  const subtotal = factura.items.reduce((acc, item) => acc + item.subtotal, 0);
  const flete = factura.flete || 0;
  const seguro = factura.tieneSeguro ? (factura.seguro || 0) : 0;
  const impuestos = factura.impuestos || 0;
  const descuento = factura.descuento || 0;
  const total = subtotal + flete + seguro + impuestos - descuento;
  
  await prisma.factura.update({
    where: { id: facturaId },
    data: { subtotal, total },
  });
}

const includeFactura = {
  cliente: true,
  items: {
    include: {
      producto: {
        include: { unidadMedida: true },
      },
    },
  },
};

export const FacturaController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const { estado, clienteId } = req.query;
    
    const facturas = await prisma.factura.findMany({
      where: {
        AND: [
          estado ? { estado: String(estado) } : {},
          clienteId ? { clienteId: String(clienteId) } : {},
        ],
      },
      include: includeFactura,
      orderBy: { fecha: 'desc' },
    });
    
    res.json(facturas);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: includeFactura,
    });
    
    if (!factura) {
      res.status(404).json({ error: 'Factura no encontrada' });
      return;
    }
    
    res.json(factura);
  },

  async create(req: Request, res: Response): Promise<void> {
    const validation = facturaSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingFactura = await prisma.factura.findUnique({
      where: { numero: validation.data.numero },
    });
    
    if (existingFactura) {
      res.status(400).json({ error: 'Ya existe una factura con ese número' });
      return;
    }

    const factura = await prisma.factura.create({
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : new Date(),
        fechaVencimiento: validation.data.fechaVencimiento ? new Date(validation.data.fechaVencimiento) : null,
      },
      include: includeFactura,
    });
    
    res.status(201).json(factura);
  },

  async createFromOfertaCliente(req: Request, res: Response): Promise<void> {
    const validation = fromOfertaClienteSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { 
      ofertaClienteId, 
      numeroFactura,
      fecha, 
      flete = 0, 
      seguro = 0, 
      tieneSeguro = false,
      totalDeseado,
      codigoMincex,
      puertoEmbarque,
      origen,
      moneda,
      terminosPago,
      incluyeFirmaCliente = false,
      firmaClienteNombre,
      firmaClienteCargo,
      firmaClienteEmpresa,
    } = validation.data;

    // Verificar número único
    const existingFactura = await prisma.factura.findUnique({
      where: { numero: numeroFactura },
    });
    
    if (existingFactura) {
      res.status(400).json({ error: 'Ya existe una factura con ese número' });
      return;
    }

    // Obtener oferta cliente con items
    const ofertaCliente = await prisma.ofertaCliente.findUnique({
      where: { id: ofertaClienteId },
      include: {
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
        cliente: true,
      },
    });

    if (!ofertaCliente) {
      res.status(404).json({ error: 'Oferta cliente no encontrada' });
      return;
    }

    // Buscar oferta importadora relacionada (tiene precios ajustados)
    const ofertaImportadora = await prisma.ofertaImportadora.findFirst({
      where: { ofertaClienteId },
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

    // Usar items de oferta importadora si existe (tienen precios ajustados), sino usar oferta cliente
    const itemsOrigen = ofertaImportadora?.items || ofertaCliente.items;
    const subtotalProductos = itemsOrigen.reduce((acc, item) => {
      // Para oferta importadora, usar subtotal; para oferta cliente, calcular
      if (ofertaImportadora) {
        return acc + (item.subtotal || 0);
      } else {
        return acc + (item.subtotal || 0);
      }
    }, 0);
    const seguroFinal = tieneSeguro ? seguro : 0;
    
    // Calcular factor de ajuste si hay total deseado
    let factor = 1;
    if (totalDeseado && totalDeseado > 0) {
      // totalDeseado = subtotalAjustado + flete + seguro
      // subtotalAjustado = totalDeseado - flete - seguro
      const subtotalDeseado = totalDeseado - flete - seguroFinal;
      if (subtotalProductos > 0) {
        factor = subtotalDeseado / subtotalProductos;
      }
    }

    // Preparar items con precios ajustados
    const itemsData = itemsOrigen.map((item, index) => {
      // Si viene de oferta importadora, usar precioAjustado; sino usar precioUnitario
      const precioBase = ofertaImportadora 
        ? (item.precioAjustado || (item as any).precioUnitario || 0)
        : (item.precioUnitario || 0);
      
      let precioAjustado = Math.round(precioBase * factor * 1000) / 1000; // Redondear a 3 decimales
      const cantidadParaCalculo = (item.pesoNeto || item.cantidad);
      let subtotal = Math.round(cantidadParaCalculo * precioAjustado * 100) / 100; // Redondear subtotal a 2 decimales
      
      return {
        productoId: item.productoId,
        descripcion: item.producto.nombre,
        cantidad: item.cantidad,
        cantidadCajas: item.cantidadCajas,
        cantidadSacos: item.cantidadSacos,
        pesoNeto: item.pesoNeto || item.cantidad, // Por defecto igual a cantidad
        pesoBruto: item.pesoBruto,
        precioUnitario: precioAjustado,
        subtotal,
        pesoXSaco: item.pesoXSaco,
        precioXSaco: item.precioXSaco,
        pesoXCaja: item.pesoXCaja,
        precioXCaja: item.precioXCaja,
        codigoArancelario: item.codigoArancelario,
      };
    });

    // Ajuste exacto: distribuir diferencia al último item
    if (totalDeseado && totalDeseado > 0 && itemsData.length > 0) {
      const subtotalCalculado = itemsData.reduce((acc, item) => acc + item.subtotal, 0);
      const subtotalDeseado = totalDeseado - flete - seguroFinal;
      const diferencia = subtotalDeseado - subtotalCalculado;
      
      if (Math.abs(diferencia) > 0.001) {
        const lastItem = itemsData[itemsData.length - 1];
        lastItem.subtotal = Math.round((lastItem.subtotal + diferencia) * 100) / 100;
        if (lastItem.cantidad > 0) {
          lastItem.precioUnitario = Math.round((lastItem.subtotal / lastItem.cantidad) * 1000) / 1000; // Redondear a 3 decimales
        }
      }
    }

    // Crear factura con items
    const factura = await prisma.factura.create({
      data: {
        numero: numeroFactura,
        fecha: fecha ? new Date(fecha) : new Date(),
        clienteId: ofertaCliente.clienteId,
        tipoOfertaOrigen: ofertaImportadora ? 'importadora' : 'cliente',
        ofertaOrigenId: ofertaImportadora ? ofertaImportadora.id : ofertaClienteId,
        flete,
        seguro,
        tieneSeguro,
        codigoMincex: codigoMincex || ofertaCliente.codigoMincex,
        puertoEmbarque: puertoEmbarque || ofertaCliente.puertoEmbarque,
        origen: origen || ofertaCliente.origen,
        moneda: moneda || ofertaCliente.moneda,
        terminosPago: terminosPago || ofertaCliente.terminosPago,
        incluyeFirmaCliente,
        firmaClienteNombre,
        firmaClienteCargo,
        firmaClienteEmpresa,
        items: {
          create: itemsData,
        },
      },
      include: includeFactura,
    });

    await calcularTotales(factura.id);

    const facturaActualizada = await prisma.factura.findUnique({
      where: { id: factura.id },
      include: includeFactura,
    });
    
    res.status(201).json(facturaActualizada);
  },

  async createFromOfertaImportadora(req: Request, res: Response): Promise<void> {
    const validation = fromOfertaImportadoraSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { 
      ofertaImportadoraId, 
      numeroFactura,
      fecha, 
      flete,
      seguro,
      tieneSeguro,
      totalDeseado,
      codigoMincex,
      puertoEmbarque,
      origen,
      moneda,
      terminosPago,
      incluyeFirmaCliente = false,
      firmaClienteNombre,
      firmaClienteCargo,
      firmaClienteEmpresa,
    } = validation.data;

    // Verificar número único
    const existingFactura = await prisma.factura.findUnique({
      where: { numero: numeroFactura },
    });
    
    if (existingFactura) {
      res.status(400).json({ error: 'Ya existe una factura con ese número' });
      return;
    }

    // Obtener oferta importadora con items
    const ofertaImportadora = await prisma.ofertaImportadora.findUnique({
      where: { id: ofertaImportadoraId },
      include: {
        items: {
          include: {
            producto: {
              include: { unidadMedida: true },
            },
          },
        },
        cliente: true,
        ofertaCliente: true,
      },
    });

    if (!ofertaImportadora) {
      res.status(404).json({ error: 'Oferta importadora no encontrada' });
      return;
    }

    // Usar valores de la oferta importadora si no se proporcionaron
    const fleteFinal = flete !== undefined ? flete : (ofertaImportadora.flete || 0);
    const seguroFinal = tieneSeguro !== undefined 
      ? (tieneSeguro ? (seguro !== undefined ? seguro : (ofertaImportadora.seguro || 0)) : 0)
      : (ofertaImportadora.tieneSeguro ? (ofertaImportadora.seguro || 0) : 0);

    // Calcular subtotal de productos desde items de oferta importadora
    const subtotalProductos = ofertaImportadora.items.reduce((acc, item) => {
      return acc + (item.subtotal || 0);
    }, 0);
    
    // Calcular factor de ajuste si hay total deseado
    let factor = 1;
    if (totalDeseado && totalDeseado > 0) {
      const subtotalDeseado = totalDeseado - fleteFinal - seguroFinal;
      if (subtotalProductos > 0) {
        factor = subtotalDeseado / subtotalProductos;
      }
    }

    // Preparar items con precios ajustados
    const itemsData = ofertaImportadora.items.map((item) => {
      const precioBase = item.precioAjustado || 0;
      let precioAjustado = Math.round(precioBase * factor * 1000) / 1000; // Redondear a 3 decimales
      const cantidadParaCalculo = (item.pesoNeto || item.cantidad);
      let subtotal = Math.round(cantidadParaCalculo * precioAjustado * 100) / 100; // Redondear subtotal a 2 decimales
      
      return {
        productoId: item.productoId,
        descripcion: item.producto.nombre,
        cantidad: item.cantidad,
        cantidadCajas: item.cantidadCajas,
        cantidadSacos: item.cantidadSacos,
        pesoNeto: item.pesoNeto || item.cantidad,
        pesoBruto: item.pesoBruto,
        precioUnitario: precioAjustado,
        subtotal,
        pesoXSaco: item.pesoXSaco,
        precioXSaco: item.precioXSaco,
        pesoXCaja: item.pesoXCaja,
        precioXCaja: item.precioXCaja,
        codigoArancelario: item.codigoArancelario,
      };
    });

    // Ajuste exacto: distribuir diferencia al último item
    if (totalDeseado && totalDeseado > 0 && itemsData.length > 0) {
      const subtotalCalculado = itemsData.reduce((acc, item) => acc + item.subtotal, 0);
      const subtotalDeseado = totalDeseado - fleteFinal - seguroFinal;
      const diferencia = subtotalDeseado - subtotalCalculado;
      
      if (Math.abs(diferencia) > 0.001) {
        const lastItem = itemsData[itemsData.length - 1];
        lastItem.subtotal = Math.round((lastItem.subtotal + diferencia) * 100) / 100;
        if (lastItem.cantidad > 0) {
          lastItem.precioUnitario = Math.round((lastItem.subtotal / lastItem.cantidad) * 1000) / 1000;
        }
      }
    }

    // Obtener datos de firma del cliente desde oferta cliente si existe
    const ofertaCliente = ofertaImportadora.ofertaCliente;
    const nombreCliente = firmaClienteNombre || 
      (ofertaCliente ? `${ofertaCliente.cliente.nombre || ""} ${ofertaCliente.cliente.apellidos || ""}`.trim() : 
       `${ofertaImportadora.cliente.nombre || ""} ${ofertaImportadora.cliente.apellidos || ""}`.trim());
    const cargoCliente = firmaClienteCargo || "DIRECTOR";
    const empresaCliente = firmaClienteEmpresa || 
      (ofertaCliente?.cliente.nombreCompania || ofertaImportadora.cliente.nombreCompania || "");

    // Crear factura con items
    const factura = await prisma.factura.create({
      data: {
        numero: numeroFactura,
        fecha: fecha ? new Date(fecha) : new Date(),
        clienteId: ofertaImportadora.clienteId,
        tipoOfertaOrigen: 'importadora',
        ofertaOrigenId: ofertaImportadoraId,
        flete: fleteFinal,
        seguro: seguroFinal,
        tieneSeguro: tieneSeguro !== undefined ? tieneSeguro : ofertaImportadora.tieneSeguro,
        codigoMincex: codigoMincex || ofertaImportadora.codigoMincex,
        puertoEmbarque: puertoEmbarque || ofertaImportadora.puertoEmbarque,
        origen: origen || ofertaImportadora.origen,
        moneda: moneda || ofertaImportadora.moneda,
        terminosPago: terminosPago || ofertaImportadora.terminosPago,
        incluyeFirmaCliente: incluyeFirmaCliente !== undefined 
          ? incluyeFirmaCliente 
          : (ofertaImportadora.incluyeFirmaCliente || false),
        firmaClienteNombre: incluyeFirmaCliente ? nombreCliente : undefined,
        firmaClienteCargo: incluyeFirmaCliente ? cargoCliente : undefined,
        firmaClienteEmpresa: incluyeFirmaCliente ? empresaCliente : undefined,
        items: {
          create: itemsData,
        },
      },
      include: includeFactura,
    });

    await calcularTotales(factura.id);

    const facturaActualizada = await prisma.factura.findUnique({
      where: { id: factura.id },
      include: includeFactura,
    });
    
    res.status(201).json(facturaActualizada);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = facturaSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    if (validation.data.numero) {
      const existingFactura = await prisma.factura.findFirst({
        where: { 
          numero: validation.data.numero,
          NOT: { id },
        },
      });
      
      if (existingFactura) {
        res.status(400).json({ error: 'Ya existe otra factura con ese número' });
        return;
      }
    }

    await prisma.factura.update({
      where: { id },
      data: {
        ...validation.data,
        fecha: validation.data.fecha ? new Date(validation.data.fecha) : undefined,
        fechaVencimiento: validation.data.fechaVencimiento ? new Date(validation.data.fechaVencimiento) : undefined,
      },
    });
    
    await calcularTotales(id);

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: includeFactura,
    });
    
    res.json(factura);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    await prisma.factura.delete({
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

    const subtotal = validation.data.cantidad * validation.data.precioUnitario;

    const item = await prisma.itemFactura.create({
      data: {
        facturaId: id,
        ...validation.data,
        pesoNeto: validation.data.pesoNeto || validation.data.cantidad,
        subtotal,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    await calcularTotales(id);
    
    res.status(201).json(item);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    const validation = itemSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const existingItem = await prisma.itemFactura.findUnique({
      where: { id: itemId },
    });
    
    if (!existingItem) {
      res.status(404).json({ error: 'Item no encontrado' });
      return;
    }

    const cantidad = validation.data.cantidad ?? existingItem.cantidad;
    const precioUnitario = validation.data.precioUnitario ?? existingItem.precioUnitario;
    const subtotal = cantidad * precioUnitario;
    const pesoNeto = validation.data.pesoNeto ?? existingItem.pesoNeto ?? cantidad;

    const item = await prisma.itemFactura.update({
      where: { id: itemId },
      data: {
        ...validation.data,
        pesoNeto,
        subtotal,
      },
      include: {
        producto: {
          include: { unidadMedida: true },
        },
      },
    });
    
    await calcularTotales(id);
    
    res.json(item);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    
    await prisma.itemFactura.delete({
      where: { id: itemId },
    });
    
    await calcularTotales(id);
    
    res.status(204).send();
  },

  async updateEstado(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { estado } = req.body;
    
    if (!['pendiente', 'pagada', 'vencida', 'cancelada'].includes(estado)) {
      res.status(400).json({ error: 'Estado inválido' });
      return;
    }

    const factura = await prisma.factura.update({
      where: { id },
      data: { estado },
      include: includeFactura,
    });
    
    res.json(factura);
  },

  async adjustPrices(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { totalDeseado } = req.body;

    if (typeof totalDeseado !== 'number' || totalDeseado <= 0) {
      res.status(400).json({ error: 'Total deseado debe ser un número positivo' });
      return;
    }

    const factura = await prisma.factura.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!factura) {
      res.status(404).json({ error: 'Factura no encontrada' });
      return;
    }

    if (factura.items.length === 0) {
      res.status(400).json({ error: 'La factura no tiene items' });
      return;
    }

    // totalDeseado = subtotal + flete + seguro
    const flete = factura.flete || 0;
    const seguro = factura.tieneSeguro ? (factura.seguro || 0) : 0;
    const subtotalDeseado = totalDeseado - flete - seguro;
    const subtotalActual = factura.items.reduce((acc, item) => acc + item.subtotal, 0);

    if (subtotalActual === 0) {
      res.status(400).json({ error: 'Subtotal actual es cero' });
      return;
    }

    const factor = subtotalDeseado / subtotalActual;

    // Ajustar precios de cada item
    let subtotalAcumulado = 0;
    for (let i = 0; i < factura.items.length; i++) {
      const item = factura.items[i];
      let nuevoSubtotal: number;
      let nuevoPrecio: number;

      if (i === factura.items.length - 1) {
        // Último item: calcular exactamente para cubrir la diferencia
        nuevoSubtotal = subtotalDeseado - subtotalAcumulado;
        nuevoPrecio = item.cantidad > 0 ? nuevoSubtotal / item.cantidad : 0;
      } else {
        nuevoPrecio = item.precioUnitario * factor;
        nuevoSubtotal = item.cantidad * nuevoPrecio;
      }

      await prisma.itemFactura.update({
        where: { id: item.id },
        data: {
          precioUnitario: nuevoPrecio,
          subtotal: nuevoSubtotal,
        },
      });

      subtotalAcumulado += nuevoSubtotal;
    }

    await calcularTotales(id);

    const facturaActualizada = await prisma.factura.findUnique({
      where: { id },
      include: includeFactura,
    });

    res.json(facturaActualizada);
  },
};
