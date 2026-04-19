import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

type FacturaRow = {
  id: string; numero: string; fecha: Date; total: number;
  flete: number; seguro: number; estado: string;
  ofertaOrigenId: string | null; clienteId: string;
};

const baseFacturaSelect = {
  id: true, numero: true, fecha: true, total: true,
  flete: true, seguro: true, estado: true,
  ofertaOrigenId: true, clienteId: true,
};

/**
 * Recoge TODAS las facturas por ocId, incluyendo:
 *  1. Facturas creadas directamente desde una OfertaCliente
 *  2. Facturas creadas desde cualquier OfertaImportadora que apunta a esa OfertaCliente
 *
 * Devuelve Map<ocId, FacturaRow[]> — puede haber varias facturas por OC.
 */
async function buildFacturasByOcId(
  clienteId?: string,
): Promise<Map<string, FacturaRow[]>> {
  const facturasByOcId = new Map<string, FacturaRow[]>();

  function push(ocId: string, f: FacturaRow) {
    const arr = facturasByOcId.get(ocId) ?? [];
    // evitar duplicados por id
    if (!arr.find((x) => x.id === f.id)) arr.push(f);
    facturasByOcId.set(ocId, arr);
  }

  // Camino 1: OC → Factura directa
  const facturasDirectas = await prisma.factura.findMany({
    where: {
      tipoOfertaOrigen: 'cliente',
      ofertaOrigenId: { not: null },
      ...(clienteId ? { clienteId } : {}),
    },
    select: baseFacturaSelect,
  });

  for (const f of facturasDirectas) {
    if (f.ofertaOrigenId) push(f.ofertaOrigenId, f as FacturaRow);
  }

  // Camino 2: OC → OI → Factura (puede haber varias OI y varias Facturas por OC)
  const facturasViaOI = await prisma.factura.findMany({
    where: {
      tipoOfertaOrigen: 'importadora',
      ofertaOrigenId: { not: null },
      ...(clienteId ? { clienteId } : {}),
    },
    select: baseFacturaSelect,
  });

  const oiIds = [...new Set(facturasViaOI.map((f) => f.ofertaOrigenId!).filter(Boolean))];
  const ois = oiIds.length > 0
    ? await prisma.ofertaImportadora.findMany({
        where: { id: { in: oiIds }, ofertaClienteId: { not: null } },
        select: { id: true, ofertaClienteId: true },
      })
    : [];

  const oiIdToOcId = new Map(ois.map((oi) => [oi.id, oi.ofertaClienteId!]));

  for (const f of facturasViaOI) {
    if (!f.ofertaOrigenId) continue;
    const ocId = oiIdToOcId.get(f.ofertaOrigenId);
    if (ocId) push(ocId, f as FacturaRow);
  }

  return facturasByOcId;
}

export const ReportsController = {
  /**
   * Reporte 1: Ofertas a cliente con TODAS sus facturas sumadas.
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

    const facturasByOcId = await buildFacturasByOcId(
      clienteId ? String(clienteId) : undefined,
    );

    const ocIds = Array.from(facturasByOcId.keys());
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

    const result = ofertasCliente.map((oc) => {
      const facturas = facturasByOcId.get(oc.id) ?? [];
      // Totales consolidados de todas las facturas de esta OC
      const facturaResumen = facturas.length > 0
        ? {
            numeros: facturas.map((f) => f.numero).join(', '),
            count: facturas.length,
            total: facturas.reduce((s, f) => s + f.total, 0),
            flete: facturas.reduce((s, f) => s + f.flete, 0),
            seguro: facturas.reduce((s, f) => s + f.seguro, 0),
            facturas: facturas.map((f) => ({
              id: f.id, numero: f.numero, fecha: f.fecha,
              total: f.total, flete: f.flete, seguro: f.seguro, estado: f.estado,
            })),
          }
        : null;
      return { ...oc, facturaResumen };
    });

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
            id: true, numero: true, fecha: true, estado: true,
            cliente: {
              select: { id: true, nombre: true, apellidos: true, nombreCompania: true },
            },
          },
        },
      },
      orderBy: [{ productoId: 'asc' }, { ofertaCliente: { fecha: 'asc' } }],
    });

    const byProduct = new Map<string, {
      producto: { id: string; nombre: string; codigo: string | null };
      precios: Array<{
        fecha: Date; precioUnitario: number; cantidad: number; subtotal: number;
        unidad: string | null; ofertaNumero: string; ofertaEstado: string;
        cliente: { id: string; nombre: string; apellidos: string | null; nombreCompania: string | null };
      }>;
    }>();

    for (const item of items) {
      if (!item.productoId || !item.producto) continue;
      const key = item.productoId;
      if (!byProduct.has(key)) byProduct.set(key, { producto: item.producto, precios: [] });
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
   * Clientes con al menos una OC concretada en factura.
   * GET /api/reports/clientes-con-facturas
   */
  async clientesConFacturas(_req: Request, res: Response): Promise<void> {
    const facturasByOcId = await buildFacturasByOcId();
    const ocIds = Array.from(facturasByOcId.keys());
    if (ocIds.length === 0) { res.json([]); return; }

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
   * Productos que aparecen en ítems de oferta cliente.
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
