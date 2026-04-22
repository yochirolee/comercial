"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCombobox } from "@/components/ui/product-combobox";
import { toast } from "sonner";
import {
  Search, TrendingUp, TrendingDown, Minus,
  FileText, Receipt, ChevronDown, ChevronRight,
} from "lucide-react";
import { reportsApi } from "@/lib/api";
import type { ReporteOfertaCliente, ReportePrecioProducto } from "@/lib/api";

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function EstadoBadge({ estado }: { estado: string }): React.ReactElement {
  const map: Record<string, string> = {
    aceptada: "bg-green-100 text-green-700",
    pendiente: "bg-yellow-100 text-yellow-700",
    rechazada: "bg-red-100 text-red-700",
    vencida: "bg-slate-100 text-slate-500",
    pagada: "bg-green-100 text-green-700",
    emitida: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[estado] ?? "bg-slate-100 text-slate-600"}`}>
      {estado}
    </span>
  );
}

function clienteNombre(c: { nombre: string; apellidos: string | null; nombreCompania: string | null }): string {
  return c.nombreCompania?.trim() || `${c.nombre} ${c.apellidos || ""}`.trim();
}

// ==================== FILTROS COMPARTIDOS ====================

function FiltroFechas({
  dateFrom, dateTo,
  onDateFrom, onDateTo,
}: {
  dateFrom: string; dateTo: string;
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void;
}): React.ReactElement {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} className="h-9 text-sm" />
      </div>
    </>
  );
}

// Fechas por defecto: primer día del mes actual → hoy
function defaultDateFrom(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultDateTo(): string {
  return new Date().toISOString().split("T")[0];
}

// ==================== REPORTE 1: OFERTAS A CLIENTE ====================

function ReporteOfertasCliente(): React.ReactElement {
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; apellidos: string | null; nombreCompania: string | null }>>([]);
  const [clienteId, setClienteId] = useState("all");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [data, setData] = useState<ReporteOfertaCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    reportsApi.clientesConFacturas().then(setClientes).catch(console.error);
  }, []);

  const load = useCallback(async (override?: { dateFrom?: string; dateTo?: string; clienteId?: string }) => {
    setLoading(true);
    setSearched(true);
    try {
      const result = await reportsApi.ofertasCliente({
        dateFrom: (override?.dateFrom ?? dateFrom) || undefined,
        dateTo: (override?.dateTo ?? dateTo) || undefined,
        clienteId: (override?.clienteId ?? (clienteId !== "all" ? clienteId : undefined)),
      });
      setData(result);
      setExpandedIds(new Set());
    } catch {
      toast.error("Error al cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, clienteId]);

  useEffect(() => { load({}); }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalOfertado = data.reduce((s, r) => s + r.total, 0);
  const totalFacturado = data.reduce((s, r) => s + (r.facturaResumen?.total ?? 0), 0);
  const totalFlete = data.reduce((s, r) => s + (r.facturaResumen?.flete ?? 0), 0);
  const totalSeguro = data.reduce((s, r) => s + (r.facturaResumen?.seguro ?? 0), 0);

  const byCliente = data.reduce<Record<string, { cliente: ReporteOfertaCliente["cliente"]; rows: ReporteOfertaCliente[] }>>((acc, row) => {
    const key = row.cliente.id;
    if (!acc[key]) acc[key] = { cliente: row.cliente, rows: [] };
    acc[key].rows.push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700">Filtros (opcionales)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Cliente</Label>
              <ProductCombobox
                value={clienteId}
                onValueChange={setClienteId}
                placeholder="Todos los clientes"
                options={[
                  { id: "all", nombre: "Todos los clientes" },
                  ...clientes.map((c) => ({ id: c.id, nombre: clienteNombre(c) })),
                ]}
              />
            </div>
            <FiltroFechas
              dateFrom={dateFrom} dateTo={dateTo}
              onDateFrom={setDateFrom} onDateTo={setDateTo}
            />
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button onClick={() => load()} disabled={loading} className="h-9 w-full">
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Cargando..." : "Filtrar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs — 2 columnas en móvil */}
      {searched && !loading && data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-slate-500">Ofertas</p>
              <p className="text-2xl font-bold text-slate-900">{data.length}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-green-700 font-medium">Total real</p>
              <p className="text-xl font-bold text-green-800 break-all">{formatCurrency(totalOfertado)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-slate-500">Facturado</p>
              <p className="text-xl font-bold text-slate-700 break-all">{formatCurrency(totalFacturado)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-slate-500">Flete + Seg.</p>
              <p className="text-xl font-bold text-slate-700 break-all">{formatCurrency(totalFlete + totalSeguro)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sin resultados */}
      {searched && !loading && data.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay ofertas concretadas en factura con estos filtros.</p>
        </div>
      )}

      {/* Por cliente */}
      {!loading && Object.values(byCliente).map(({ cliente, rows }) => {
        const subtotalCliente = rows.reduce((s, r) => s + r.total, 0);
        return (
          <Card key={cliente.id} className="border-slate-200 overflow-hidden">
            {/* Cabecera cliente */}
            <div className="bg-slate-50 py-3 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{clienteNombre(cliente)}</p>
                  <p className="text-xs text-slate-500">{rows.length} oferta{rows.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-500">Real ofertado</p>
                <p className="font-bold text-green-700 text-sm">{formatCurrency(subtotalCliente)}</p>
              </div>
            </div>

            {/* Filas de ofertas */}
            {rows.map((row) => {
              const expanded = expandedIds.has(row.id);
              const fr = row.facturaResumen;
              const diff = fr ? row.total - fr.total : null;
              return (
                <div key={row.id} className="border-b border-slate-100 last:border-0">
                  {/* Fila compacta — touch-friendly */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(row.id)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {expanded
                        ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Línea 1: número + estado + fecha */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{row.numero}</span>
                          <EstadoBadge estado={row.estado} />
                          <span className="text-xs text-slate-400">{formatDate(row.fecha)}</span>
                        </div>
                        {/* Línea 2: precios */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                          <span className="font-bold text-green-700">
                            Real: {formatCurrency(row.total)}
                          </span>
                          {fr && (
                            <span className="text-slate-500">
                              Fact: {formatCurrency(fr.total)}
                              {diff !== null && diff > 0.01 && (
                                <span className="text-amber-500 ml-1">(−{formatCurrency(diff)})</span>
                              )}
                            </span>
                          )}
                        </div>
                        {/* Línea 3: facturas + flete/seguro */}
                        {fr && (
                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>{fr.count > 1 ? `${fr.count} facturas: ` : "Factura: "}<span className="text-slate-500 font-medium">{fr.numeros}</span></span>
                            {fr.flete > 0 && <span>Flete {formatCurrency(fr.flete)}</span>}
                            {fr.seguro > 0 && <span>Seg. {formatCurrency(fr.seguro)}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {expanded && (
                    <div className="bg-slate-50 border-t border-slate-100 px-3 py-3 space-y-3">
                      {/* Tabla de productos */}
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs min-w-[140px]">Producto</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Cant.</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Precio real</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {row.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs font-medium">
                                  {item.producto?.nombre ?? item.nombreProducto ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs text-right whitespace-nowrap">
                                  {item.cantidad.toLocaleString()} {item.unidadMedida?.abreviatura ?? ""}
                                </TableCell>
                                <TableCell className="text-xs text-right font-bold text-green-700 whitespace-nowrap">
                                  {formatCurrency(item.precioUnitario)}
                                </TableCell>
                                <TableCell className="text-xs text-right font-semibold whitespace-nowrap">
                                  {formatCurrency(item.subtotal)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-slate-50 font-bold">
                              <TableCell colSpan={3} className="text-right text-xs">Total ofertado (real)</TableCell>
                              <TableCell className="text-right text-xs text-green-700 whitespace-nowrap">{formatCurrency(row.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Desglose de facturas individuales si hay más de una */}
                      {fr && fr.facturas.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                            <p className="text-xs font-semibold text-slate-600">
                              Facturas vinculadas ({fr.facturas.length})
                            </p>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead className="text-xs">Factura</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Fecha</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Estado</TableHead>
                                <TableHead className="text-xs text-right whitespace-nowrap">Flete</TableHead>
                                <TableHead className="text-xs text-right whitespace-nowrap">Seguro</TableHead>
                                <TableHead className="text-xs text-right whitespace-nowrap">Total fact.</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fr.facturas.map((f) => (
                                <TableRow key={f.id}>
                                  <TableCell className="text-xs font-semibold">{f.numero}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{formatDate(f.fecha)}</TableCell>
                                  <TableCell><EstadoBadge estado={f.estado} /></TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap">{f.flete > 0 ? formatCurrency(f.flete) : "—"}</TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap">{f.seguro > 0 ? formatCurrency(f.seguro) : "—"}</TableCell>
                                  <TableCell className="text-xs text-right font-semibold whitespace-nowrap">{formatCurrency(f.total)}</TableCell>
                                </TableRow>
                              ))}
                              {fr.facturas.length > 1 && (
                                <TableRow className="bg-slate-50 font-bold">
                                  <TableCell colSpan={5} className="text-right text-xs">Total facturado</TableCell>
                                  <TableCell className="text-right text-xs whitespace-nowrap">{formatCurrency(fr.total)}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}

      {/* Gran total */}
      {searched && !loading && data.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-4 px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">TOTAL REAL OFERTADO</p>
                <p className="text-xs text-green-600">{data.length} oferta{data.length !== 1 ? "s" : ""} concretadas</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-green-800">{formatCurrency(totalOfertado)}</p>
                {totalFacturado > 0 && Math.abs(totalFacturado - totalOfertado) > 0.01 && (
                  <p className="text-xs text-slate-500">Facturado: {formatCurrency(totalFacturado)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== REPORTE 2: PRECIOS DE PRODUCTOS ====================

function ReporteProductosPrecios(): React.ReactElement {
  const [productos, setProductos] = useState<Array<{ id: string; nombre: string; codigo: string | null }>>([]);
  const [productoId, setProductoId] = useState("all");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [data, setData] = useState<ReportePrecioProducto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    reportsApi.productosEnOfertas().then(setProductos).catch(console.error);
  }, []);

  const load = useCallback(async (override?: { dateFrom?: string; dateTo?: string; productoId?: string }) => {
    setLoading(true);
    setSearched(true);
    try {
      const result = await reportsApi.productosPrecios({
        dateFrom: (override?.dateFrom ?? dateFrom) || undefined,
        dateTo: (override?.dateTo ?? dateTo) || undefined,
        productoId: (override?.productoId ?? (productoId !== "all" ? productoId : undefined)),
      });
      setData(result);
    } catch {
      toast.error("Error al cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, productoId]);

  useEffect(() => { load({}); }, [productoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function tendencia(precios: ReportePrecioProducto["precios"]): React.ReactElement {
    if (precios.length < 2) return <Minus className="h-4 w-4 text-slate-400" />;
    const d = precios[precios.length - 1].precioUnitario - precios[0].precioUnitario;
    if (d > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (d < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4 text-slate-400" />;
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700">Filtros (opcionales)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Producto</Label>
              <ProductCombobox
                value={productoId}
                onValueChange={setProductoId}
                placeholder="Todos los productos"
                options={[
                  { id: "all", nombre: "Todos los productos" },
                  ...productos.map((p) => ({ id: p.id, nombre: p.nombre, abreviatura: p.codigo ?? undefined })),
                ]}
              />
            </div>
            <FiltroFechas
              dateFrom={dateFrom} dateTo={dateTo}
              onDateFrom={setDateFrom} onDateTo={setDateTo}
            />
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button onClick={() => load()} disabled={loading} className="h-9 w-full">
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Cargando..." : "Filtrar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {searched && !loading && data.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay registros de precios para estos filtros.</p>
        </div>
      )}

      {!loading && data.map((grupo) => {
        const precios = grupo.precios;
        const precioMin = Math.min(...precios.map((p) => p.precioUnitario));
        const precioMax = Math.max(...precios.map((p) => p.precioUnitario));
        const precioActual = precios[precios.length - 1]?.precioUnitario ?? 0;

        return (
          <Card key={grupo.producto.id} className="border-slate-200 overflow-hidden">
            {/* Cabecera producto */}
            <div className="bg-slate-50 py-3 px-4 border-b border-slate-200">
              <div className="flex items-start gap-2 mb-2">
                {tendencia(precios)}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{grupo.producto.nombre}</p>
                  {grupo.producto.codigo && (
                    <p className="text-xs text-slate-400">Código: {grupo.producto.codigo}</p>
                  )}
                </div>
              </div>
              {/* Stats — 2×2 en mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-400">Precio actual</p>
                  <p className="font-bold text-slate-900 text-sm">{formatCurrency(precioActual)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-400">Mínimo</p>
                  <p className="font-semibold text-green-700 text-sm">{formatCurrency(precioMin)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-400">Máximo</p>
                  <p className="font-semibold text-red-600 text-sm">{formatCurrency(precioMax)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-400">Registros</p>
                  <p className="font-semibold text-slate-700 text-sm">{precios.length}</p>
                </div>
              </div>
            </div>

            {/* Tabla con scroll horizontal en mobile */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Oferta</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Estado</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">Cant.</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap font-semibold">Precio</TableHead>
                    <TableHead className="text-xs text-right whitespace-nowrap">Variación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {precios.map((p, idx) => {
                    const prev = idx > 0 ? precios[idx - 1].precioUnitario : null;
                    const diff = prev !== null ? p.precioUnitario - prev : null;
                    return (
                      <TableRow key={`${p.ofertaNumero}-${idx}`} className={idx === precios.length - 1 ? "bg-slate-50/60 font-medium" : ""}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(p.fecha)}</TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">{p.ofertaNumero}</TableCell>
                        <TableCell><EstadoBadge estado={p.ofertaEstado} /></TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[100px] truncate">{clienteNombre(p.cliente)}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">{p.cantidad.toLocaleString()} {p.unidad ?? ""}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(p.precioUnitario)}
                        </TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">
                          {diff === null ? (
                            <span className="text-slate-300">—</span>
                          ) : diff > 0 ? (
                            <span className="text-red-500 flex items-center justify-end gap-0.5">
                              <TrendingUp className="h-3 w-3" />+{formatCurrency(diff)}
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-green-600 flex items-center justify-end gap-0.5">
                              <TrendingDown className="h-3 w-3" />{formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="text-slate-400">=</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ==================== PAGE ====================

export default function ReportesPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Reportes"
        description="Ofertas concretadas y evolución de precios."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto">
        <Tabs defaultValue="ofertas">
          <TabsList className="mb-5 w-full sm:w-auto">
            <TabsTrigger value="ofertas" className="flex-1 sm:flex-none gap-2 text-xs sm:text-sm">
              <Receipt className="h-4 w-4" />
              Ofertas
            </TabsTrigger>
            <TabsTrigger value="precios" className="flex-1 sm:flex-none gap-2 text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              Precios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ofertas">
            <ReporteOfertasCliente />
          </TabsContent>

          <TabsContent value="precios">
            <ReporteProductosPrecios />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
