import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Recoge todos los pares { ofertaClienteId, factura } buscando:
 *  1. Facturas creadas directamente desde una OfertaCliente
 *  2. Facturas creadas desde una OfertaImportadora que tiene ofertaClienteId
 */
async function buildFacturaByOcId(clienteId?: string, dateFilter?: { gte?: Date; lte?: Date }) {
  type FacturaRow = {
    id: string; numero: string; fecha: Date; total: number;
    flete: number; seguro: number; estado: string;
    ofertaOrigenId: string | null; clienteId: string;
  };

  const baseSelect = {
    id: true, numero: true, fecha: true, total: true,
    flete: true, seguro: true, estado: true,
    ofertaOrigenId: true, clienteId: true,
  };

  // Camino 1: directo OC → Factura
  const facturasDirectas = await prisma.factura.findMany({
    where: {
      tipoOfertaOrigen: 'cliente',
      ofertaOrigenId: { not: null },
      ...(clienteId ? { clienteId } : {}),
    },
    select: baseSelect,
  });

  // Camino 2: OC → OI → Factura
  const facturasViaOI = await prisma.factura.findMany({
    where: {
      tipoOfertaOrigen: 'importadora',
      ofertaOrigenId: { not: null },
      ...(clienteId ? { clienteId } : {}),
    },
    select: baseSelect,
  });

  const oiIds = [...new Set(facturasViaOI.map((f) => f.ofertaOrigenId!).filter(Boolean))];
  const ois = oiIds.length > 0
    ? await prisma.ofertaImportadora.findMany({
        where: { id: { in: oiIds }, ofertaClienteId: { not: null } },
        select: { id: true, ofertaClienteId: true },
      })
    : [];

  const oiIdToOcId = new Map(ois.map((oi) => [oi.id, oi.ofertaClienteId!]));

  // Mapa: ocId → primera factura encontrada
  const facturaByOcId = new Map<string, FacturaRow>();

  for (const f of facturasDirectas) {
    if (f.ofertaOrigenId && !facturaByOcId.has(f.ofertaOrigenId)) {
      facturaByOcId.set(f.ofertaOrigenId, f as FacturaRow);
    }
  }
  for (const f of facturasViaOI) {
    if (!f.ofertaOrigenId) continue;
    const ocId = oiIdToOcId.get(f.ofertaOrigenId);
    if (ocId && !facturaByOcId.has(ocId)) {
      facturaByOcId.set(ocId, f as FacturaRow);
    }
  }

  return facturaByOcId;
}

export const ReportsController = {
  /**
   * Reporte 1: Ofertas a cliente que llegaron a factura (precio real = oferta cliente).
   * GET /api/reports/ofertas-cliente?dateFrom=&dateTo=&clienteId=
   */
  async ofertasCliente(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, clienteId } = req.query;

    const dateFilter =
      dateFrom || dateTo
        ? {
            gte: dateFrom ? new Date(String(dateFrom)) : undefined,
            lte: dateTo ? new Date(String(dateTo) + 'T23:59:59.999Z') : undefined,
          }
        : undefined;

    const facturaByOcId = await buildFacturaByOcId(
      clienteId ? String(clienteId) : undefined,
      dateFilter,
    );

    const ocIds = Array.from(facturaByOcId.keys());
    if (ocIds.length === 0) {
      res.json([]);
      return;
    }

    const ofertasCliente = await prisma.ofertaCliente.findMany({
      where: {
        id: { in: ocIds },
        ...(dateFilter ? { fecha: dateFilter } : {}),
        ...(clienteId ? { clienteId: String(clienteId) } : {}),
      },
      include: {
        cliente: {
          select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
        },
        items: {
          include: {
            producto: { select: { id: true, nombre: true, codigo: true } },
            unidadMedida: { select: { abreviatura: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ cliente: { nombre: 'asc' } }, { fecha: 'desc' }],
    });

    const result = ofertasCliente.map((oc) => ({
      ...oc,
      factura: facturaByOcId.get(oc.id) ?? null,
    }));

    res.json(result);
  },

  /**
   * Reporte 2: Historial de precios de productos en ofertas a cliente.
   * GET /api/reports/productos-precios?dateFrom=&dateTo=&productoId=
   */
  async productosPrecios(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, productoId } = req.query;

    const items = await prisma.itemOfertaCliente.findMany({
      where: {
        productoId: productoId ? String(productoId) : { not: null },
        ofertaCliente: {
          ...(dateFrom || dateTo
            ? {
                fecha: {
                  gte: dateFrom ? new Date(String(dateFrom)) : undefined,
                  lte: dateTo ? new Date(String(dateTo) + 'T23:59:59.999Z') : undefined,
                },
              }
            : {}),
        },
      },
      include: {
        producto: { select: { id: true, nombre: true, codigo: true } },
        unidadMedida: { select: { abreviatura: true } },
        ofertaCliente: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            estado: true,
            cliente: {
              select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
            },
          },
        },
      },
      orderBy: [{ productoId: 'asc' }, { ofertaCliente: { fecha: 'asc' } }],
    });

    const byProduct = new Map<
      string,
      {
        producto: { id: string; nombre: string; codigo: string | null };
        precios: Array<{
          fecha: Date;
          precioUnitario: number;
          cantidad: number;
          subtotal: number;
          unidad: string | null;
          ofertaNumero: string;
          ofertaEstado: string;
          cliente: { id: string; nombre: string; apellidos: string | null; nombreCompania: string | null };
        }>;
      }
    >();

    for (const item of items) {
      if (!item.productoId || !item.producto) continue;
      const key = item.productoId;
      if (!byProduct.has(key)) {
        byProduct.set(key, { producto: item.producto, precios: [] });
      }
      byProduct.get(key)!.precios.push({
        fecha: item.ofertaCliente.fecha,
        precioUnitario: item.precioUnitario,
        cantidad: item.cantidad,
        subtotal: item.subtotal,
        unidad: item.unidadMedida?.abreviatura ?? null,
        ofertaNumero: item.ofertaCliente.numero,
        ofertaEstado: item.ofertaCliente.estado,
        cliente: item.ofertaCliente.cliente,
      });
    }

    res.json(Array.from(byProduct.values()));
  },

  /**
   * Clientes que tienen al menos una oferta a cliente concretada en factura
   * (directo o vía OI). GET /api/reports/clientes-con-facturas
   */
  async clientesConFacturas(_req: Request, res: Response): Promise<void> {
    const facturaByOcId = await buildFacturaByOcId();
    const ocIds = Array.from(facturaByOcId.keys());
    if (ocIds.length === 0) {
      res.json([]);
      return;
    }
    const ocs = await prisma.ofertaCliente.findMany({
      where: { id: { in: ocIds } },
      select: { clienteId: true },
    });
    const clienteIds = [...new Set(ocs.map((oc) => oc.clienteId))];
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(clientes);
  },

  /**
   * Productos que aparecen en items de oferta cliente.
   * GET /api/reports/productos-en-ofertas
   */
  async productosEnOfertas(_req: Request, res: Response): Promise<void> {
    const items = await prisma.itemOfertaCliente.findMany({
      where: { productoId: { not: null } },
      select: { productoId: true, producto: { select: { id: true, nombre: true, codigo: true } } },
      distinct: ['productoId'],
    });
    const productos = items
      .filter((i) => i.producto)
      .map((i) => i.producto!)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    res.json(productos);
  },
};
