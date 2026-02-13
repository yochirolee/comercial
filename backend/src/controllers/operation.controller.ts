import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { createContainsFilter } from '../lib/search-utils.js';
import { z } from 'zod';

// Statuses válidos
const OPERATION_STATUSES = [
  'Draft',
  'Booking Confirmed',
  'Container Assigned',
  'Loaded',
  'Gate In (Port)',
  'BL Final Issued',
  'Departed US',
  'Arrived Cuba',
  'Customs',
  'Released',
  'Delivered',
  'Closed',
  'Cancelled',
] as const;

const CONTAINER_STATUSES = [
  'Draft',
  'Booking Confirmed',
  'Container Assigned',
  'Loaded',
  'Gate In (Port)',
  'BL Final Issued',
  'Departed US',
  'Arrived Cuba',
  'Customs',
  'Released',
  'Delivered',
  'Closed',
  'Cancelled',
] as const;

// Schemas de validación
const operationSchema = z.object({
  operationNo: z.string().optional(), // Opcional: se genera para PARCEL, se requiere para COMMERCIAL sin offerCustomerId
  operationType: z.enum(['COMMERCIAL', 'PARCEL']),
  offerCustomerId: z.string().optional(),
  importadoraId: z.string().min(1, 'Importadora es requerida'),
  invoiceId: z.string().optional(),
  status: z.string().optional().default('Draft'),
  currentLocation: z.string().optional(),
  originPort: z.string().optional(),
  destinationPort: z.string().optional(),
  notes: z.string().optional(),
});

const containerSchema = z.object({
  sequenceNo: z.number().int().positive().optional(), // Opcional: se calcula automáticamente al agregar
  containerNo: z.string().optional(),
  bookingNo: z.string().optional(),
  blNo: z.string().optional(),
  originPort: z.string().optional(),
  destinationPort: z.string().optional(),
  etdEstimated: z.string().optional(),
  etaEstimated: z.string().optional(),
  etdActual: z.string().optional(),
  etaActual: z.string().optional(),
  status: z.string().optional().default('Draft'),
  currentLocation: z.string().optional(),
});

const eventSchema = z.object({
  eventType: z.string(),
  title: z.string().min(1, 'Título es requerido'),
  description: z.string().optional(),
  eventDate: z.string(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  location: z.string().optional(),
  createdBy: z.string().optional(),
});

// Helper para crear eventos automáticos en operaciones (exportable para otros controladores)
export async function createOperationEvent(
  operationId: string,
  eventType: string,
  title: string,
  description?: string,
  eventDate?: Date
): Promise<void> {
  await prisma.operationEvent.create({
    data: {
      operationId,
      eventType,
      title,
      description: description || null,
      eventDate: eventDate || new Date(),
      createdBy: 'System',
    },
  });
}

// Generar número de operación PARCEL: PKG-YYYY-####
async function generarNumeroParcel(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PKG-${year}-`;
  
  const ultimaOperacion = await prisma.operation.findFirst({
    where: { operationNo: { startsWith: prefix } },
    orderBy: { operationNo: 'desc' },
    select: { operationNo: true },
  });
  
  let siguienteNumero = 1;
  if (ultimaOperacion?.operationNo) {
    const match = ultimaOperacion.operationNo.match(/\d+$/);
    if (match) {
      siguienteNumero = parseInt(match[0], 10) + 1;
    }
  }
  
  return `${prefix}${siguienteNumero.toString().padStart(4, '0')}`;
}

export const OperationController = {
  // Crear operación desde Oferta a Cliente
  async createFromOffer(req: Request, res: Response): Promise<void> {
    const { offerCustomerId, importadoraId } = req.body;
    
    if (!offerCustomerId) {
      res.status(400).json({ error: 'offerCustomerId es requerido' });
      return;
    }
    
    if (!importadoraId) {
      res.status(400).json({ error: 'importadoraId es requerido' });
      return;
    }
    
    // Verificar que la oferta existe
    const oferta = await prisma.ofertaCliente.findUnique({
      where: { id: offerCustomerId },
      include: { 
        cliente: true,
        ofertasImportadora: {
          orderBy: { fecha: 'asc' },
          take: 1, // Solo la primera oferta importadora asociada
        },
      },
    });
    
    if (!oferta) {
      res.status(404).json({ error: 'Oferta no encontrada' });
      return;
    }
    
    // Verificar si ya existe una operación para esta oferta
    const existingOperation = await prisma.operation.findFirst({
      where: { offerCustomerId },
    });
    
    if (existingOperation) {
      res.status(400).json({ error: 'Ya existe una operación para esta oferta' });
      return;
    }
    
    // Puerto de destino predefinido: "MARIEL, Cuba"
    const destinationPort = "MARIEL, Cuba";
    
    // Crear/actualizar relación ClienteImportadora si no existe
    try {
      await prisma.clienteImportadora.upsert({
        where: {
          clienteId_importadoraId: {
            clienteId: oferta.clienteId,
            importadoraId,
          },
        },
        create: {
          clienteId: oferta.clienteId,
          importadoraId,
        },
        update: {},
      });
    } catch (error) {
      // Si ya existe, no hacer nada
    }

    // Crear operación
    const operation = await prisma.operation.create({
      data: {
        operationNo: oferta.numero, // COMMERCIAL usa el número de oferta
        operationType: 'COMMERCIAL',
        offerCustomerId,
        importadoraId,
        status: 'Draft',
        originPort: oferta.puertoEmbarque || undefined,
        destinationPort,
      },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
      },
    });
    
    // Crear primer contenedor
    const container = await prisma.operationContainer.create({
      data: {
        operationId: operation.id,
        sequenceNo: 1,
        status: 'Draft',
      },
    });
    
    // Crear eventos automáticos en orden cronológico
    const eventos: Array<{ eventType: string; title: string; description?: string; eventDate: Date }> = [];
    
    // 1. Oferta a Cliente Creada (más antiguo)
    if (oferta.fecha) {
      console.log(`[Operation] Creando evento Oferta a Cliente Creada, fecha: ${oferta.fecha}`);
      eventos.push({
        eventType: 'commercial',
        title: 'Oferta a Cliente Creada',
        description: `Oferta ${oferta.numero} creada`,
        eventDate: oferta.fecha,
      });
    } else {
      console.log(`[Operation] Oferta ${oferta.numero} no tiene fecha`);
    }
    
    // 2. Oferta a Importadora Creada (si existe)
    if (oferta.ofertasImportadora && oferta.ofertasImportadora.length > 0) {
      const ofertaImportadora = oferta.ofertasImportadora[0];
      if (ofertaImportadora.fecha) {
        eventos.push({
          eventType: 'commercial',
          title: 'Oferta a Importadora Creada',
          description: `Oferta ${ofertaImportadora.numero} creada`,
          eventDate: ofertaImportadora.fecha,
        });
      }
    }
    
    // 4. Operación Creada (más reciente)
    eventos.push({
      eventType: 'created',
      title: 'Operación Creada',
      description: `Operación creada desde oferta ${oferta.numero}`,
      eventDate: new Date(),
    });
    
    // Crear todos los eventos en orden cronológico
    for (const evento of eventos.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())) {
      await createOperationEvent(
        operation.id,
        evento.eventType,
        evento.title,
        evento.description,
        evento.eventDate
      );
    }
    
    const result = await prisma.operation.findUnique({
      where: { id: operation.id },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.status(201).json(result);
  },
  
  // Crear operación manual (PARCEL o COMMERCIAL)
  async create(req: Request, res: Response): Promise<void> {
    const validation = operationSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    const { operationNo, operationType, offerCustomerId, importadoraId, invoiceId, status } = validation.data;
    
    let finalOperationNo: string;
    
    // Si es COMMERCIAL y tiene offerCustomerId, usar el número de oferta
    if (operationType === 'COMMERCIAL' && offerCustomerId) {
      const oferta = await prisma.ofertaCliente.findUnique({
        where: { id: offerCustomerId },
      });
      if (!oferta) {
        res.status(404).json({ error: 'Oferta a Cliente no encontrada' });
        return;
      }
      finalOperationNo = oferta.numero;
      
      // Crear/actualizar relación ClienteImportadora
      try {
        await prisma.clienteImportadora.upsert({
          where: {
            clienteId_importadoraId: {
              clienteId: oferta.clienteId,
              importadoraId,
            },
          },
          create: {
            clienteId: oferta.clienteId,
            importadoraId,
          },
          update: {},
        });
      } catch (error) {
        // Si ya existe, no hacer nada
      }
    }
    // Si es PARCEL y no se proporciona operationNo, generarlo
    else if (operationType === 'PARCEL' && (!operationNo || operationNo.trim() === '')) {
      finalOperationNo = await generarNumeroParcel();
    }
    // Si es COMMERCIAL sin offerCustomerId, requiere operationNo
    else if (operationType === 'COMMERCIAL' && (!operationNo || operationNo.trim() === '')) {
      res.status(400).json({ error: 'Número de operación es requerido para operaciones COMMERCIAL sin oferta asociada' });
      return;
    }
    // Usar el operationNo proporcionado
    else {
      finalOperationNo = operationNo!;
    }
    
    // Verificar unicidad
    const existing = await prisma.operation.findUnique({
      where: { operationNo: finalOperationNo },
    });
    
    if (existing) {
      res.status(400).json({ error: 'Ya existe una operación con ese número' });
      return;
    }
    
    const operation = await prisma.operation.create({
      data: {
        operationNo: finalOperationNo,
        operationType,
        offerCustomerId,
        importadoraId,
        invoiceId,
        status: status || 'Draft',
        currentLocation: validation.data.currentLocation,
        originPort: validation.data.originPort,
        destinationPort: validation.data.destinationPort,
        notes: validation.data.notes,
      },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        invoice: true,
      },
    });
    
    // Crear primer contenedor
    await prisma.operationContainer.create({
      data: {
        operationId: operation.id,
        sequenceNo: 1,
        status: 'Draft',
      },
    });
    
    // Crear evento inicial
    await prisma.operationEvent.create({
      data: {
        operationId: operation.id,
        eventType: 'created',
        title: 'Operación Creada',
        description: `Operación ${finalOperationNo} creada manualmente`,
        eventDate: new Date(),
      },
    });
    
    const result = await prisma.operation.findUnique({
      where: { id: operation.id },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.status(201).json(result);
  },
  
  // Listar operaciones con filtros
  async getAll(req: Request, res: Response): Promise<void> {
    const { type, status, search } = req.query;
    
    const where: any = {};
    
    if (type && (type === 'COMMERCIAL' || type === 'PARCEL')) {
      where.operationType = type;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      const searchFilter = createContainsFilter(String(search));
      where.OR = [
        { operationNo: searchFilter },
        { currentLocation: searchFilter },
      ];
    }
    
    const operations = await prisma.operation.findMany({
      where,
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            events: {
              orderBy: { eventDate: 'desc' },
              take: 1, // Solo el último evento para "Última actualización"
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(operations);
  },
  
  // Obtener operación por ID con detalles
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const operation = await prisma.operation.findUnique({
      where: { id },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            events: {
              orderBy: { eventDate: 'asc' }, // Orden cronológico para timeline
            },
          },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    if (!operation) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    // Sincronizar eventos de facturas retroactivamente
    // Buscar todas las facturas relacionadas indirectamente a través de Ofertas a Importadora
    if (operation.offerCustomerId) {
      try {
        // Obtener todas las Ofertas a Importadora de esta Oferta a Cliente
        const ofertasImportadora = await prisma.ofertaImportadora.findMany({
          where: { ofertaClienteId: operation.offerCustomerId },
          select: { id: true },
        });
        
        if (ofertasImportadora.length > 0) {
          const ofertaImportadoraIds = ofertasImportadora.map(o => o.id);
          
          // Buscar todas las facturas creadas desde estas Ofertas a Importadora
          const facturas = await prisma.factura.findMany({
            where: {
              tipoOfertaOrigen: 'importadora',
              ofertaOrigenId: { in: ofertaImportadoraIds },
            },
            select: {
              id: true,
              numero: true,
              fecha: true,
            },
            orderBy: { fecha: 'asc' },
          });
          
          // Obtener números de eventos de facturas ya existentes
          const existingFacturaEvents = await prisma.operationEvent.findMany({
            where: {
              operationId: id,
              title: 'Factura Creada',
            },
            select: { description: true },
          });
          
          const existingFacturaNumbers = new Set(
            existingFacturaEvents
              .map(e => e.description?.match(/Factura (.+?) creada/)?.[1])
              .filter(Boolean)
          );
          
          // Crear eventos para facturas que no tienen evento aún
          for (const factura of facturas) {
            if (!existingFacturaNumbers.has(factura.numero)) {
              console.log(`[Operation] Sincronizando evento retroactivo para factura ${factura.numero}, fecha: ${factura.fecha}`);
              await createOperationEvent(
                id,
                'commercial',
                'Factura Creada',
                `Factura ${factura.numero} creada`,
                factura.fecha
              );
            }
          }
        }
      } catch (error) {
        console.error('[Operation] Error al sincronizar eventos de facturas:', error);
      }
    }
    
    // Recargar la operación con los eventos actualizados
    const operationUpdated = await prisma.operation.findUnique({
      where: { id },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        importadora: true,
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            events: {
              orderBy: { eventDate: 'desc' },
            },
          },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.json(operationUpdated);
  },
  
  // Actualizar operación
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = operationSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    const operation = await prisma.operation.findUnique({
      where: { id },
      select: { 
        status: true,
        originPort: true,
        destinationPort: true,
      },
    });
    
    if (!operation) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    const oldStatus = operation.status;
    const oldOriginPort = operation.originPort;
    const oldDestinationPort = operation.destinationPort;
    const data: any = {};
    
    // Convertir strings de fecha a DateTime si existen
    Object.keys(validation.data).forEach((key) => {
      const value = (validation.data as any)[key];
      if (value !== undefined) {
        data[key] = value;
      }
    });
    
    const updated = await prisma.operation.update({
      where: { id },
      data,
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    // Si cambió el status, crear evento
    if (data.status && data.status !== oldStatus) {
      await createOperationEvent(
        id,
        'status_change',
        'Cambio de Estado',
        `Estado cambiado de "${oldStatus}" a "${data.status}"`,
        new Date()
      );
      // Actualizar el último evento creado con fromStatus y toStatus
      const lastEvent = await prisma.operationEvent.findFirst({
        where: { operationId: id, eventType: 'status_change', title: 'Cambio de Estado' },
        orderBy: { createdAt: 'desc' },
      });
      if (lastEvent) {
        await prisma.operationEvent.update({
          where: { id: lastEvent.id },
          data: {
            fromStatus: oldStatus,
            toStatus: data.status,
          },
        });
      }
    }
    
    // Si cambió el puerto de origen, crear evento
    if (data.originPort !== undefined && data.originPort !== oldOriginPort) {
      const descripcion = oldOriginPort
        ? `Puerto de origen cambiado de "${oldOriginPort}" a "${data.originPort || 'No definido'}"`
        : `Puerto de origen definido: "${data.originPort}"`;
      await createOperationEvent(
        id,
        'commercial',
        'Cambio de Puerto de Origen',
        descripcion,
        new Date()
      );
    }
    
    // Si cambió el puerto de destino, crear evento
    if (data.destinationPort !== undefined && data.destinationPort !== oldDestinationPort) {
      const descripcion = oldDestinationPort
        ? `Puerto de destino cambiado de "${oldDestinationPort}" a "${data.destinationPort || 'No definido'}"`
        : `Puerto de destino definido: "${data.destinationPort}"`;
      await createOperationEvent(
        id,
        'commercial',
        'Cambio de Puerto de Destino',
        descripcion,
        new Date()
      );
    }
    
    const result = await prisma.operation.findUnique({
      where: { id },
      include: {
        offerCustomer: {
          include: { cliente: true },
        },
        invoice: true,
        containers: {
          orderBy: { sequenceNo: 'asc' },
          include: {
            events: {
              orderBy: { eventDate: 'desc' },
            },
          },
        },
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.json(result);
  },
  
  // Agregar contenedor a operación
  async addContainer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = containerSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    // Verificar que la operación existe
    const operation = await prisma.operation.findUnique({
      where: { id },
      include: {
        containers: {
          orderBy: { sequenceNo: 'desc' },
          take: 1,
        },
      },
    });
    
    if (!operation) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    // Determinar el siguiente sequenceNo
    const nextSequenceNo = operation.containers.length > 0
      ? operation.containers[0].sequenceNo + 1
      : 1;
    
    const data: any = {
      ...validation.data,
      operationId: id,
      sequenceNo: nextSequenceNo,
    };
    
    // Convertir fechas de string a DateTime, limpiar strings vacíos
    const dateFields = ['etdEstimated', 'etaEstimated', 'etdActual', 'etaActual'];
    for (const field of dateFields) {
      if (data[field] && data[field].trim() !== '') {
        data[field] = new Date(data[field]);
      } else {
        delete data[field];
      }
    }
    
    // Limpiar strings vacíos en campos opcionales
    const optionalStringFields = ['currentLocation', 'containerNo', 'bookingNo', 'blNo', 'originPort', 'destinationPort'];
    for (const field of optionalStringFields) {
      if (data[field] !== undefined && data[field].trim() === '') {
        delete data[field];
      }
    }
    
    const container = await prisma.operationContainer.create({
      data,
    });
    
    const result = await prisma.operationContainer.findUnique({
      where: { id: container.id },
      include: {
        operation: true,
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.status(201).json(result);
  },
  
  // Eliminar contenedor
  async deleteContainer(req: Request, res: Response): Promise<void> {
    const { id, containerId } = req.params;
    
    const container = await prisma.operationContainer.findUnique({
      where: { id: containerId },
      select: { operationId: true },
    });
    
    if (!container || container.operationId !== id) {
      res.status(404).json({ error: 'Contenedor no encontrado' });
      return;
    }
    
    await prisma.operationContainer.delete({
      where: { id: containerId },
    });
    
    res.status(204).send();
  },
  
  // Actualizar contenedor
  async updateContainer(req: Request, res: Response): Promise<void> {
    const { id, containerId } = req.params;
    const validation = containerSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    const oldContainer = await prisma.operationContainer.findUnique({
      where: { id: containerId },
      select: { 
        operationId: true, 
        status: true,
        containerNo: true,
        bookingNo: true,
        blNo: true,
        etdEstimated: true,
        etaEstimated: true,
        etdActual: true,
        etaActual: true,
        currentLocation: true,
      },
    });
    
    if (!oldContainer || oldContainer.operationId !== id) {
      res.status(404).json({ error: 'Contenedor no encontrado' });
      return;
    }
    
    const oldStatus = oldContainer.status;
    const data: any = {};
    
    Object.keys(validation.data).forEach((key) => {
      const value = (validation.data as any)[key];
      if (value !== undefined) {
        if (key === 'etdEstimated' || key === 'etaEstimated' || key === 'etdActual' || key === 'etaActual') {
          data[key] = value ? new Date(value) : null;
        } else {
          data[key] = value;
        }
      }
    });
    
    const updated = await prisma.operationContainer.update({
      where: { id: containerId },
      data,
    });
    
    // Crear eventos automáticos para cambios en campos específicos
    const eventDate = new Date();
    
    // Helper para normalizar valores vacíos
    const normalizeValue = (value: string | null | undefined): string => {
      if (!value || value.trim() === '' || value === '-' || value.toLowerCase() === 'no definido') {
        return '';
      }
      return value.trim();
    };
    
    // Helper para comparar fechas (ignorando hora si es solo fecha)
    const datesAreEqual = (date1: Date | null | undefined, date2: Date | null | undefined): boolean => {
      if (!date1 && !date2) return true;
      if (!date1 || !date2) return false;
      // Comparar solo la parte de fecha (ignorar hora)
      const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
      const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
      return d1.getTime() === d2.getTime();
    };
    
    // Helper para formatear fechas
    const formatDateForEvent = (date: Date | null | undefined): string => {
      if (!date) return 'No definido';
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    // Array para acumular cambios en esta acción
    const changes: Array<{ field: string; oldVal: string; newVal: string; location?: string }> = [];
    let eventLocation: string | undefined;
    
    // Detectar cambios en containerNo
    if (data.containerNo !== undefined) {
      const oldVal = normalizeValue(oldContainer.containerNo);
      const newVal = normalizeValue(data.containerNo);
      if (oldVal !== newVal) {
        changes.push({
          field: 'Número de Contenedor',
          oldVal: oldVal || 'No definido',
          newVal: newVal || 'No definido',
        });
      }
    }
    
    // Detectar cambios en bookingNo
    if (data.bookingNo !== undefined) {
      const oldVal = normalizeValue(oldContainer.bookingNo);
      const newVal = normalizeValue(data.bookingNo);
      if (oldVal !== newVal) {
        changes.push({
          field: 'Booking',
          oldVal: oldVal || 'No definido',
          newVal: newVal || 'No definido',
        });
      }
    }
    
    // Detectar cambios en blNo
    if (data.blNo !== undefined) {
      const oldVal = normalizeValue(oldContainer.blNo);
      const newVal = normalizeValue(data.blNo);
      if (oldVal !== newVal) {
        changes.push({
          field: 'BL',
          oldVal: oldVal || 'No definido',
          newVal: newVal || 'No definido',
        });
      }
    }
    
    // Detectar cambios en currentLocation
    if (data.currentLocation !== undefined) {
      const oldVal = normalizeValue(oldContainer.currentLocation);
      const newVal = normalizeValue(data.currentLocation);
      if (oldVal !== newVal) {
        changes.push({
          field: 'Ubicación',
          oldVal: oldVal || 'No definido',
          newVal: newVal || 'No definido',
        });
        if (newVal) {
          eventLocation = newVal;
        }
      }
    }
    
    // Detectar cambios en ETD Estimated
    if (data.etdEstimated !== undefined) {
      const oldVal = oldContainer.etdEstimated;
      const newVal = data.etdEstimated;
      if (!datesAreEqual(oldVal, newVal)) {
        changes.push({
          field: 'ETD Estimado',
          oldVal: formatDateForEvent(oldVal),
          newVal: formatDateForEvent(newVal),
        });
      }
    }
    
    // Detectar cambios en ETA Estimated
    if (data.etaEstimated !== undefined) {
      const oldVal = oldContainer.etaEstimated;
      const newVal = data.etaEstimated;
      if (!datesAreEqual(oldVal, newVal)) {
        changes.push({
          field: 'ETA Estimado',
          oldVal: formatDateForEvent(oldVal),
          newVal: formatDateForEvent(newVal),
        });
      }
    }
    
    // Detectar cambios en ETD Actual
    if (data.etdActual !== undefined) {
      const oldVal = oldContainer.etdActual;
      const newVal = data.etdActual;
      if (!datesAreEqual(oldVal, newVal)) {
        changes.push({
          field: 'ETD Real',
          oldVal: formatDateForEvent(oldVal),
          newVal: formatDateForEvent(newVal),
        });
      }
    }
    
    // Detectar cambios en ETA Actual
    if (data.etaActual !== undefined) {
      const oldVal = oldContainer.etaActual;
      const newVal = data.etaActual;
      if (!datesAreEqual(oldVal, newVal)) {
        changes.push({
          field: 'ETA Real',
          oldVal: formatDateForEvent(oldVal),
          newVal: formatDateForEvent(newVal),
        });
      }
    }
    
    // Crear evento agrupado si hay cambios
    if (changes.length > 0) {
      const description = changes
        .map(change => `• ${change.field}: "${change.oldVal}" → "${change.newVal}"`)
        .join('\n');
      
      await prisma.containerEvent.create({
        data: {
          operationContainerId: containerId,
          eventType: 'field_change',
          title: changes.length === 1 
            ? `${changes[0].field} Actualizado`
            : 'Datos del Contenedor Actualizados',
          description,
          eventDate,
          location: eventLocation || null,
        },
      });
    }
    
    // Si cambió el status, crear evento
    if (data.status && data.status !== oldStatus) {
      await prisma.containerEvent.create({
        data: {
          operationContainerId: containerId,
          eventType: 'status_change',
          title: 'Cambio de Estado',
          description: `Estado cambiado de "${oldStatus}" a "${data.status}"`,
          eventDate,
          fromStatus: oldStatus,
          toStatus: data.status,
        },
      });
    }
    
    const result = await prisma.operationContainer.findUnique({
      where: { id: containerId },
      include: {
        operation: true,
        events: {
          orderBy: { eventDate: 'desc' },
        },
      },
    });
    
    res.json(result);
  },
  
  // Agregar evento a operación
  async addEvent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const validation = eventSchema.omit({ location: true }).safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    const operation = await prisma.operation.findUnique({
      where: { id },
    });
    
    if (!operation) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    const event = await prisma.operationEvent.create({
      data: {
        operationId: id,
        ...validation.data,
        eventDate: new Date(validation.data.eventDate),
      },
    });
    
    res.status(201).json(event);
  },
  
  // Agregar evento a contenedor
  async addContainerEvent(req: Request, res: Response): Promise<void> {
    const { id, containerId } = req.params;
    const validation = eventSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }
    
    const container = await prisma.operationContainer.findUnique({
      where: { id: containerId },
      select: { operationId: true },
    });
    
    if (!container || container.operationId !== id) {
      res.status(404).json({ error: 'Contenedor no encontrado' });
      return;
    }
    
    const event = await prisma.containerEvent.create({
      data: {
        operationContainerId: containerId,
        ...validation.data,
        eventDate: new Date(validation.data.eventDate),
      },
    });
    
    res.status(201).json(event);
  },
  
  // Eliminar operación
  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    const operation = await prisma.operation.findUnique({
      where: { id },
    });
    
    if (!operation) {
      res.status(404).json({ error: 'Operación no encontrada' });
      return;
    }
    
    await prisma.operation.delete({
      where: { id },
    });
    
    res.status(204).send();
  },
};
