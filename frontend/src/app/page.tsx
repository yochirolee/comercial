"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Package,
  FileText,
  Receipt,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Ship,
  Loader2,
  Anchor,
  CalendarDays,
} from "lucide-react";
import { clientesApi, productosApi, ofertasClienteApi, ofertasImportadoraApi, ofertasGeneralesApi, facturasApi, operationsApi } from "@/lib/api";
import type {
  Producto,
  Factura,
  OfertaCliente,
  OfertaImportadora,
  Cliente,
  Operation,
  OperationContainer,
} from "@/lib/api";
import { operationRowLabel } from "@/lib/operation-display";
import {
  operationStatusBadgeClass,
  operationStatusLabelEs,
} from "@/lib/operation-status";
import {
  formatEtaArriboMarielDashboard,
  etaArriboMarielIsGreenDashboard,
  getDaysInMarielDisplayDashboard,
  getDisplayLocation,
  getLastUpdateDashboard,
  daysInMarielSortKeyDashboard,
} from "@/lib/dashboard-pipeline-helpers";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/** Contadores dashboard: tránsito hacia Mariel (incluye valores legacy en inglés hasta migrar BD). */
const DASHBOARD_ESTADOS_TRANSITO = [
  "Cargando",
  "Sellado",
  "En puerto US",
  "En puerto Brazil",
  "En Tránsito al Puerto del Mariel",
  "En Transito al Puerto del Mariel", // legacy guardado sin tilde
  "Departed US",
  "Departed Brazil",
];
const DASHBOARD_ESTADOS_MARIEL = [
  "En Puerto del Mariel",
  "En Aduana",
  "Retenido en Aduana",
  "Liberado Aduana",
  "Descargado en Puerto del Mariel",
  "Arrived Cuba",
  "Customs",
  "Released",
];

const DASHBOARD_PIPELINE_TOP_N = 10;

// ==========================================
// TIPOS
// ==========================================

interface KpiMetric {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  breakdown?: BreakdownItem[];
  badge?: {
    text: string;
    color: string;
  };
}

interface BreakdownItem {
  label: string;
  value: number;
  color: string;
}

interface BreakdownCardProps {
  title: string;
  total: number;
  breakdown: BreakdownItem[];
  badge?: {
    text?: string;
    icon?: React.ComponentType<{ className?: string }>;
    color: string;
  };
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

interface AgingBucket {
  label: string;
  value: number;
  color: string;
}

// ==========================================
// COMPONENTES
// ==========================================

function KpiCard({ metric }: { metric: KpiMetric }): React.ReactElement {
  const Icon = metric.icon;
  const hasBreakdown = (metric.breakdown?.length ?? 0) > 0;
  return (
    <div className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <h3 className="text-xs sm:text-sm font-medium text-slate-600">{metric.title}</h3>
        <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${metric.iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.iconColor}`} />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
            {metric.value}
          </div>
          {hasBreakdown && (
            <div className="space-y-1.5 pt-1">
              {metric.breakdown?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 truncate pr-2">{item.label}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${item.color} whitespace-nowrap`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {metric.badge && (
            <div className={`text-xs font-medium ${metric.badge.color}`}>
              {metric.badge.text}
            </div>
          )}
        </div>
        {!metric.badge && !hasBreakdown && <div className="h-5"></div>}
      </div>
    </div>
  );
}

function BreakdownCard({ title, total, breakdown, badge, icon: Icon, className }: BreakdownCardProps): React.ReactElement {
  const BadgeIcon = badge?.icon;
  return (
    <div className={cn("bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 relative h-full flex flex-col", className)}>
      {badge && (
        <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 ${badge.color} flex items-center justify-center rounded-full z-10 ${BadgeIcon ? 'h-6 w-6 sm:h-7 sm:w-7' : 'px-2 sm:px-2.5 py-0.5 sm:py-1'}`}>
          {BadgeIcon ? (
            <BadgeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ) : (
            <span className="text-xs font-medium">{badge.text}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        {Icon && <Icon className="h-4 w-4 text-slate-600" />}
        <h3 className="text-xs sm:text-sm font-medium text-slate-600">{title}</h3>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 md:mb-4">
          {total}
        </div>
        {breakdown.length > 0 ? (
          <div className="space-y-1.5 sm:space-y-2">
            {breakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 truncate pr-2">{item.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${item.color} whitespace-nowrap`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-5"></div>
        )}
      </div>
    </div>
  );
}

function CommercialPanel({ 
  funnel, 
  agingBuckets, 
  conversionRate, 
  paymentRate 
}: { 
  funnel: FunnelStep[];
  agingBuckets: AgingBucket[];
  conversionRate: number;
  paymentRate: number;
}): React.ReactElement {
  const maxFunnelValue = Math.max(...funnel.map(f => f.value), 1);
  const maxAgingValue = Math.max(...agingBuckets.map(b => b.value), 1);

  return (
    <div className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200">
      <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-4 md:mb-6">Panel Comercial</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Funnel */}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-slate-700 mb-3 md:mb-4">Funnel Comercial</h4>
          <div className="space-y-2 md:space-y-3">
            {funnel.map((step, idx) => {
              const widthPercent = maxFunnelValue > 0 ? (step.value / maxFunnelValue) * 100 : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate pr-2">{step.label}</span>
                    <span className="font-semibold text-slate-900 whitespace-nowrap">{step.value}</span>
                  </div>
                  <div className="h-7 sm:h-8 rounded-lg overflow-hidden bg-slate-100">
                    <div 
                      className={`h-full ${step.color} rounded-lg transition-all duration-500 flex items-center justify-center`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {step.value > 0 && (
                        <span className="text-xs font-bold text-white">{step.value}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600">% Conversión Oferta → Factura:</span>
              <span className="text-xs sm:text-sm font-bold text-green-600">{conversionRate}%</span>
            </div>
          </div>
        </div>

        {/* Aging Buckets */}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-slate-700 mb-3 md:mb-4">Fact. Pendientes por antigüedad</h4>
          <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
            {agingBuckets.map((bucket, idx) => {
              const widthPercent = maxAgingValue > 0 ? (bucket.value / maxAgingValue) * 100 : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{bucket.label}</span>
                    <span className="font-semibold text-slate-900">{bucket.value}</span>
                  </div>
                  <div className="h-5 sm:h-6 rounded-md overflow-hidden bg-slate-100">
                    <div 
                      className={`h-full ${bucket.color} rounded-md transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5 sm:space-y-2 pt-3 md:pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
              <span className="text-slate-600">% Conversión Oferta → Factura:</span>
              <span className="font-semibold text-green-600">{conversionRate}%</span>
            </div>
            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
              <span className="text-slate-600">% Cobro Factura → Pagadas:</span>
              <span className="font-semibold text-blue-600">{paymentRate}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardContainerCounts {
  transitoTotal: number;
  transitoCommercial: number;
  transitoParcel: number;
  marielTotal: number;
  marielCommercial: number;
  marielParcel: number;
}

function DashboardOperationsPipelineTable({
  rows,
  loading,
  containerCounts,
}: {
  rows: Array<{ operation: Operation; container: OperationContainer }>;
  loading: boolean;
  containerCounts: DashboardContainerCounts;
}): React.ReactElement {
  const router = useRouter();

  return (
    <div className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-xl p-3 sm:p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Últimas operaciones</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Las {DASHBOARD_PIPELINE_TOP_N} operaciones más recientes y su estado
        </p>
      </div>

      {/* Contadores tránsito / Mariel en una sola franja compacta */}
      <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 sm:px-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-100">
              <Ship className="h-3.5 w-3.5 text-cyan-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Tránsito</p>
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-lg font-bold tabular-nums text-slate-900 leading-none">
                  {loading ? "…" : containerCounts.transitoTotal}
                </span>
                <span className="text-[10px] text-slate-600">
                  COM{" "}
                  <span className="font-semibold text-amber-800">
                    {loading ? "…" : containerCounts.transitoCommercial}
                  </span>
                  {" · "}
                  PKG{" "}
                  <span className="font-semibold text-blue-800">
                    {loading ? "…" : containerCounts.transitoParcel}
                  </span>
                </span>
              </p>
            </div>
          </div>
          <div className="hidden sm:block h-10 w-px shrink-0 bg-slate-200" aria-hidden />
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100">
              <Ship className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Mariel</p>
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-lg font-bold tabular-nums text-slate-900 leading-none">
                  {loading ? "…" : containerCounts.marielTotal}
                </span>
                <span className="text-[10px] text-slate-600">
                  COM{" "}
                  <span className="font-semibold text-amber-800">
                    {loading ? "…" : containerCounts.marielCommercial}
                  </span>
                  {" · "}
                  PKG{" "}
                  <span className="font-semibold text-blue-800">
                    {loading ? "…" : containerCounts.marielParcel}
                  </span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 py-2">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">Sin datos en tránsito / Mariel.</p>
      ) : (
        <>
          {/* Tablet / desktop: tabla compacta */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[600px] text-left border-collapse text-[10px] sm:text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1 pr-2 font-medium">Operación</th>
                  <th className="py-1 pr-2 font-medium">Estado</th>
                  <th className="py-1 pr-2 font-medium whitespace-nowrap">ETA Mariel</th>
                  <th className="py-1 pr-2 font-medium">Origen/Destino</th>
                  <th className="py-1 font-medium whitespace-nowrap">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ operation, container }) => (
                  <tr
                    key={container.id}
                    className="border-b border-slate-100 hover:bg-slate-50/90 cursor-pointer"
                    onClick={() => router.push(`/operations/${operation.id}`)}
                  >
                    <td className="py-1.5 pr-2 align-top max-w-[140px] lg:max-w-[180px]">
                      <div className="font-medium text-slate-900 leading-tight line-clamp-2">
                        {operationRowLabel(operation, container)}
                      </div>
                      <div className="font-mono text-slate-500 mt-0.5 truncate">
                        {container.containerNo || "—"}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 align-top max-w-[120px]">
                      <Badge
                        className={cn(
                          operationStatusBadgeClass(container.status),
                          "border-0 font-medium shadow-none whitespace-nowrap rounded px-1.5 py-0.5 w-fit max-w-full text-[9px] sm:text-[10px]"
                        )}
                      >
                        {operationStatusLabelEs(container.status)}
                      </Badge>
                      <div className="text-slate-600 mt-1 line-clamp-2 leading-snug">
                        {getDisplayLocation(container, operation)}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 align-top whitespace-nowrap">
                      {formatEtaArriboMarielDashboard(container) !== "—" ? (
                        <span
                          className={cn(
                            "inline-block font-semibold tabular-nums rounded px-1 py-0.5",
                            etaArriboMarielIsGreenDashboard(container)
                              ? "text-green-800 bg-green-100 border border-green-400/70"
                              : "text-slate-900"
                          )}
                        >
                          {formatEtaArriboMarielDashboard(container)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                      <div className="mt-0.5">
                        {(() => {
                          const d = getDaysInMarielDisplayDashboard(container);
                          if (d.text === "—") {
                            return <span className="text-slate-400">—</span>;
                          }
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 tabular-nums",
                                d.danger ? "font-semibold text-red-600" : "text-slate-700"
                              )}
                            >
                              <CalendarDays
                                className="h-3 w-3 shrink-0 text-slate-400"
                                aria-hidden
                              />
                              {d.text} d
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <div className="flex flex-col gap-0 leading-tight max-w-[140px] lg:max-w-[180px]">
                        <span className="flex items-center gap-0.5 text-slate-700 truncate">
                          <Anchor className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {container.originPort || operation.originPort || "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-0.5 text-slate-700 truncate">
                          <Ship className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {container.destinationPort || operation.destinationPort || "—"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 align-top text-slate-500 whitespace-nowrap">
                      {getLastUpdateDashboard(container)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas compactas */}
          <ul className="md:hidden space-y-2">
            {rows.map(({ operation, container }) => {
              const dMar = getDaysInMarielDisplayDashboard(container);
              return (
                <li key={container.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/operations/${operation.id}`)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white px-2.5 py-2 active:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-900 leading-tight line-clamp-2">
                          {operationRowLabel(operation, container)}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                          {container.containerNo || "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums shrink-0",
                          dMar.danger ? "text-red-600" : "text-slate-700"
                        )}
                      >
                        {dMar.text === "—" ? (
                          "—"
                        ) : (
                          <>
                            <CalendarDays
                              className="h-3 w-3 shrink-0 text-slate-400"
                              aria-hidden
                            />
                            {dMar.text} d
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge
                        className={cn(
                          operationStatusBadgeClass(container.status),
                          "border-0 font-medium shadow-none text-[9px] px-1.5 py-0 rounded"
                        )}
                      >
                        {operationStatusLabelEs(container.status)}
                      </Badge>
                      <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
                        {getDisplayLocation(container, operation)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-slate-600">
                      <span>
                        ETA:{" "}
                        {formatEtaArriboMarielDashboard(container) !== "—" ? (
                          <span
                            className={cn(
                              "font-semibold",
                              etaArriboMarielIsGreenDashboard(container) ? "text-green-700" : "text-slate-900"
                            )}
                          >
                            {formatEtaArriboMarielDashboard(container)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="flex items-center gap-0.5 min-w-0 max-w-[45%]">
                        <Anchor className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {container.originPort || operation.originPort || "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5 min-w-0 max-w-[45%]">
                        <Ship className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {container.destinationPort || operation.destinationPort || "—"}
                        </span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Actualizado: {getLastUpdateDashboard(container)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Dashboard(): React.ReactElement {
  const { usuario, loading: authLoading } = useAuth();
  const isOperador = usuario?.rol?.toLowerCase() === "operador";
  const MAX_PRODUCT_CATEGORIES = 3;
  const [stats, setStats] = useState({
    clientes: 0,
    clientesEsteMes: 0,
    productos: 0,
    ofertas: 0,
    ofertasCliente: 0,
    ofertasImportadora: 0,
    facturas: 0,
    facturasPagadas: 0,
    facturasPendientes: 0,
    totalFacturado: 0,
    totalMesActual: 0,
    totalMesAnterior: 0,
    facturasMesActual: 0,
    facturasMesAnterior: 0,
    yearConfig: new Date().getFullYear(),
    // Contenedores
    contenedoresTransitoCommercial: 0,
    contenedoresTransitoParcel: 0,
    contenedoresMarielCommercial: 0,
    contenedoresMarielParcel: 0,
  });
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([]);
  const [productosBreakdown, setProductosBreakdown] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardOperations, setDashboardOperations] = useState<Operation[]>([]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function loadStats(): Promise<void> {
      try {
        if (isOperador) {
          const operations = await operationsApi.getAll();
          const estadosTransito = DASHBOARD_ESTADOS_TRANSITO;
          const estadosMariel = DASHBOARD_ESTADOS_MARIEL;
          let contenedoresTransitoCommercial = 0;
          let contenedoresTransitoParcel = 0;
          let contenedoresMarielCommercial = 0;
          let contenedoresMarielParcel = 0;
          operations.forEach((op: Operation) => {
            const containers = op.containers || [];
            containers.forEach((container) => {
              if (estadosTransito.includes(container.status)) {
                if (op.operationType === "COMMERCIAL") {
                  contenedoresTransitoCommercial++;
                } else {
                  contenedoresTransitoParcel++;
                }
              } else if (estadosMariel.includes(container.status)) {
                if (op.operationType === "COMMERCIAL") {
                  contenedoresMarielCommercial++;
                } else {
                  contenedoresMarielParcel++;
                }
              }
            });
          });
          setStats((prev) => ({
            ...prev,
            yearConfig: new Date().getFullYear(),
            contenedoresTransitoCommercial,
            contenedoresTransitoParcel,
            contenedoresMarielCommercial,
            contenedoresMarielParcel,
          }));
          setFunnel([]);
          setAgingBuckets([]);
          setProductosBreakdown([]);
          setDashboardOperations(operations);
          return;
        }

        // Leer configuración del dashboard
        let yearConfig = new Date().getFullYear();
        try {
          const stored = localStorage.getItem("zas_dashboard_config");
          if (stored) {
            const config = JSON.parse(stored);
            yearConfig = config.year || yearConfig;
          }
        } catch {
          console.error("Error reading dashboard config");
        }

        const [clientes, productos, ofertasCliente, ofertasImportadora, ofertasGenerales, facturas, operations] = await Promise.all([
          clientesApi.getAll(),
          productosApi.getAll(),
          ofertasClienteApi.getAll(),
          ofertasImportadoraApi.getAll(),
          ofertasGeneralesApi.getAll(),
          facturasApi.getAll(),
          operationsApi.getAll(),
        ]);

        // Filtrar facturas del año configurado
        const facturasDelAno = facturas.filter((f: Factura) => {
          const fecha = new Date(f.fecha);
          return fecha.getFullYear() === yearConfig;
        });

        const totalFacturado = facturasDelAno
          .filter((f: Factura) => f.estado === "pagada")
          .reduce((acc: number, f: Factura) => acc + f.total, 0);

        // Calcular mes actual y mes anterior
        const now = new Date();
        const mesActual = now.getMonth();
        const anoActual = now.getFullYear();
        
        // Mes anterior (puede ser diciembre del año anterior)
        const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
        const anoMesAnterior = mesActual === 0 ? anoActual - 1 : anoActual;

        const totalMesActual = facturas
          .filter((f: Factura) => {
            const fecha = new Date(f.fecha);
            return fecha.getMonth() === mesActual && 
                   fecha.getFullYear() === anoActual && 
                   f.estado === "pagada";
          })
          .reduce((acc: number, f: Factura) => acc + f.total, 0);

        const totalMesAnterior = facturas
          .filter((f: Factura) => {
            const fecha = new Date(f.fecha);
            return fecha.getMonth() === mesAnterior && 
                   fecha.getFullYear() === anoMesAnterior && 
                   f.estado === "pagada";
          })
          .reduce((acc: number, f: Factura) => acc + f.total, 0);

        // Cantidad de facturas emitidas por mes
        const facturasMesActual = facturas.filter((f: Factura) => {
          const fecha = new Date(f.fecha);
          return fecha.getMonth() === mesActual && fecha.getFullYear() === anoActual;
        }).length;

        const facturasMesAnterior = facturas.filter((f: Factura) => {
          const fecha = new Date(f.fecha);
          return fecha.getMonth() === mesAnterior && fecha.getFullYear() === anoMesAnterior;
        }).length;

        // Calcular contenedores por estado y tipo
        const estadosTransito = DASHBOARD_ESTADOS_TRANSITO;
        const estadosMariel = DASHBOARD_ESTADOS_MARIEL;
        
        let contenedoresTransitoCommercial = 0;
        let contenedoresTransitoParcel = 0;
        let contenedoresMarielCommercial = 0;
        let contenedoresMarielParcel = 0;

        operations.forEach((op: Operation) => {
          const containers = op.containers || [];
          containers.forEach((container) => {
            if (estadosTransito.includes(container.status)) {
              if (op.operationType === "COMMERCIAL") {
                contenedoresTransitoCommercial++;
              } else {
                contenedoresTransitoParcel++;
              }
            } else if (estadosMariel.includes(container.status)) {
              if (op.operationType === "COMMERCIAL") {
                contenedoresMarielCommercial++;
              } else {
                contenedoresMarielParcel++;
              }
            }
          });
        });

        const facturasPagadas = facturas.filter((f: Factura) => f.estado === "pagada").length;
        const facturasPendientes = facturas.filter((f: Factura) => f.estado === "pendiente").length;
        const productosActivos = productos.filter((p: Producto) => p.activo);

        // Top categorías para no romper diseño del card.
        const categoriaCounts = new Map<string, number>();
        productosActivos.forEach((p: Producto) => {
          const categoria = p.categoria?.nombre?.trim() || "Sin categoría";
          categoriaCounts.set(categoria, (categoriaCounts.get(categoria) || 0) + 1);
        });
        const categoriasOrdenadas = Array.from(categoriaCounts.entries())
          .sort((a, b) => b[1] - a[1]);
        const topCategorias = categoriasOrdenadas.slice(0, MAX_PRODUCT_CATEGORIES);
        const otrasCount = categoriasOrdenadas
          .slice(MAX_PRODUCT_CATEGORIES)
          .reduce((acc, [, count]) => acc + count, 0);
        const colorPalette = [
          "bg-emerald-100 text-emerald-700",
          "bg-blue-100 text-blue-700",
          "bg-amber-100 text-amber-700",
          "bg-slate-100 text-slate-700",
        ];
        const breakdownCategorias: BreakdownItem[] = topCategorias.map(([label, value], idx) => ({
          label,
          value,
          color: colorPalette[idx % colorPalette.length],
        }));
        if (otrasCount > 0) {
          breakdownCategorias.push({
            label: "Otras",
            value: otrasCount,
            color: "bg-slate-100 text-slate-700",
          });
        }

        // Calcular funnel
        const ofertasClienteCreadas = ofertasCliente.length;
        const ofertasImportadoraCreadas = ofertasImportadora.length;
        const facturasEmitidas = facturas.length;
        const facturasPagadasCount = facturasPagadas;

        const funnelData: FunnelStep[] = [
          { label: "Ofertas a cliente creadas", value: ofertasClienteCreadas, color: "bg-blue-500" },
          { label: "Ofertas a importadora creadas", value: ofertasImportadoraCreadas, color: "bg-indigo-500" },
          { label: "Facturas emitidas", value: facturasEmitidas, color: "bg-purple-500" },
          { label: "Facturas pagadas", value: facturasPagadasCount, color: "bg-green-500" },
        ];

        // Calcular aging buckets
        const nowDate = new Date();
        const agingData: AgingBucket[] = [
          { label: "0–7 días", value: 0, color: "bg-green-400" },
          { label: "8–15 días", value: 0, color: "bg-yellow-400" },
          { label: "16–30 días", value: 0, color: "bg-orange-400" },
          { label: "30+ días", value: 0, color: "bg-red-400" },
        ];

        facturas
          .filter((f: Factura) => f.estado === "pendiente")
          .forEach((f: Factura) => {
            const fecha = new Date(f.fecha);
            const dias = Math.floor((nowDate.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
            if (dias <= 7) agingData[0].value++;
            else if (dias <= 15) agingData[1].value++;
            else if (dias <= 30) agingData[2].value++;
            else agingData[3].value++;
          });

        // Calcular clientes nuevos este mes
        const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
        const clientesEsteMes = clientes.filter((c: Cliente) => {
          if (!c.createdAt) return false;
          const createdDate = new Date(c.createdAt);
          return createdDate >= startOfMonth;
        }).length;

        // Calcular porcentajes
        const totalOfertas = ofertasClienteCreadas + ofertasImportadoraCreadas;
        const conversionRate = totalOfertas > 0 
          ? Math.round((facturasEmitidas / totalOfertas) * 100) 
          : 0;
        const paymentRate = facturas.length > 0 
          ? Math.round((facturasPagadas / facturas.length) * 100) 
          : 0;

        setStats({
          clientes: clientes.length,
          clientesEsteMes,
          productos: productosActivos.length,
          ofertas: ofertasCliente.length + ofertasImportadora.length,
          ofertasCliente: ofertasCliente.length,
          ofertasImportadora: ofertasImportadora.length,
          facturas: facturas.length,
          facturasPagadas,
          facturasPendientes,
          totalFacturado,
          totalMesActual,
          totalMesAnterior,
          facturasMesActual,
          facturasMesAnterior,
          yearConfig,
          contenedoresTransitoCommercial,
          contenedoresTransitoParcel,
          contenedoresMarielCommercial,
          contenedoresMarielParcel,
        });
        setFunnel(funnelData);
        setAgingBuckets(agingData);
        setProductosBreakdown(breakdownCategorias);
        setDashboardOperations(operations);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [authLoading, isOperador]);

  // Helper para nombre de mes
  function getNombreMes(mes: number): string {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return meses[mes];
  }

  const now = new Date();
  const mesActual = now.getMonth();
  const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;

  // Fila 1: 2 cards KPI
  const kpiCards: KpiMetric[] = [
    {
      title: "Clientes",
      value: loading ? "..." : stats.clientes,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100",
      badge: stats.clientesEsteMes > 0 ? {
        text: `+${stats.clientesEsteMes} este mes`,
        color: "text-blue-600",
      } : undefined,
    },
    {
      title: "Productos",
      value: loading ? "..." : stats.productos,
      icon: Package,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100",
      breakdown: loading ? [] : productosBreakdown,
    },
  ];

  // Breakdown para Total Facturado
  const facturadoBreakdown: BreakdownItem[] = [
    { label: `${getNombreMes(mesActual)} (actual)`, value: stats.totalMesActual, color: "bg-green-100 text-green-700" },
    { label: `${getNombreMes(mesAnterior)} (anterior)`, value: stats.totalMesAnterior, color: "bg-blue-100 text-blue-700" },
  ];

  // Breakdown para Facturas Emitidas
  const facturasEmitidasBreakdown: BreakdownItem[] = [
    { label: `${getNombreMes(mesActual)} (actual)`, value: stats.facturasMesActual, color: "bg-purple-100 text-purple-700" },
    { label: `${getNombreMes(mesAnterior)} (anterior)`, value: stats.facturasMesAnterior, color: "bg-indigo-100 text-indigo-700" },
  ];

  // Fila 2: 3 cards medianas
  const facturasBreakdown: BreakdownItem[] = [
    { label: "Pagadas", value: stats.facturasPagadas, color: "bg-green-100 text-green-700" },
    { label: "Pendientes", value: stats.facturasPendientes, color: "bg-red-100 text-red-700" },
  ];

  const ofertasBreakdown: BreakdownItem[] = [
    { label: "Ofertas a Cliente", value: stats.ofertasCliente, color: "bg-blue-100 text-blue-700" },
    { label: "Ofertas a Importadora", value: stats.ofertasImportadora, color: "bg-amber-100 text-amber-700" },
  ];

  // Totales de contenedores
  const totalTransito = stats.contenedoresTransitoCommercial + stats.contenedoresTransitoParcel;
  const totalMariel = stats.contenedoresMarielCommercial + stats.contenedoresMarielParcel;

  const conversionRate = stats.ofertas > 0 
    ? Math.round((stats.facturas / stats.ofertas) * 100) 
    : 0;

  const pipelineSummaryRows = useMemo(() => {
    const estadosTransito = DASHBOARD_ESTADOS_TRANSITO;
    const estadosMariel = DASHBOARD_ESTADOS_MARIEL;
    const rows: Array<{ operation: Operation; container: OperationContainer }> = [];
    dashboardOperations.forEach((op) => {
      (op.containers || []).forEach((c) => {
        if (estadosTransito.includes(c.status) || estadosMariel.includes(c.status)) {
          rows.push({ operation: op, container: c });
        }
      });
    });
    rows.sort((a, b) => {
      const da = daysInMarielSortKeyDashboard(a.container);
      const db = daysInMarielSortKeyDashboard(b.container);
      if (da === -1 && db === -1) return 0;
      if (da === -1) return 1;
      if (db === -1) return -1;
      return db - da;
    });
    return rows.slice(0, DASHBOARD_PIPELINE_TOP_N);
  }, [dashboardOperations]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (isOperador) {
    return (
      <div>
        <Header
          title="Dashboard"
          description="Resumen de operaciones y contenedores"
        />
        <div className="p-4 sm:p-5 md:p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6">
          <p className="text-sm text-slate-600 max-w-xl">
            Vista resumida para tu rol: indicadores de contenedores. Usa el menú para abrir Operaciones o Mi perfil.
          </p>
          <DashboardOperationsPipelineTable
            rows={pipelineSummaryRows}
            loading={loading}
            containerCounts={{
              transitoTotal: totalTransito,
              transitoCommercial: stats.contenedoresTransitoCommercial,
              transitoParcel: stats.contenedoresTransitoParcel,
              marielTotal: totalMariel,
              marielCommercial: stats.contenedoresMarielCommercial,
              marielParcel: stats.contenedoresMarielParcel,
            }}
          />
          <Link
            href="/operations"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0C0A04] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1610] transition-colors"
          >
            Abrir Operations Board
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header 
        title="Dashboard" 
        description="Resumen general del sistema"
      />
      
      <div className="p-4 sm:p-5 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
        {/* Fila 1: Clientes, Productos, Total Facturado (3 en lg, 2 en sm/md) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
          <KpiCard metric={kpiCards[0]} />
          <KpiCard metric={kpiCards[1]} />
          {/* Total Facturado - visible en lg+ */}
          <div className="hidden lg:flex bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 h-full flex-col">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <h3 className="text-xs sm:text-sm font-medium text-slate-600">
                Total Facturado {stats.yearConfig}
              </h3>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 md:mb-4">
                {loading ? "..." : `$${stats.totalFacturado.toLocaleString()}`}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {facturadoBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 truncate pr-2">{item.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${item.color} whitespace-nowrap`}>
                      ${item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fila 2 (sm/md): Total Facturado, Facturas - solo visible en sm/md */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6 lg:hidden">
          {/* Total Facturado */}
          <div className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 md:p-6 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 h-full flex flex-col">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <h3 className="text-xs sm:text-sm font-medium text-slate-600">
                Total Facturado {stats.yearConfig}
              </h3>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 md:mb-4">
                {loading ? "..." : `$${stats.totalFacturado.toLocaleString()}`}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                {facturadoBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 truncate pr-2">{item.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${item.color} whitespace-nowrap`}>
                      ${item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Facturas */}
          <BreakdownCard
            title="Facturas"
            total={loading ? 0 : stats.facturas}
            breakdown={facturasBreakdown}
            icon={Receipt}
          />
        </div>

        {/* Fila 2 (lg): Facturas, Facturas emitidas, Ofertas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
          {/* Facturas - solo visible en lg+ en esta fila */}
          <div className="hidden lg:block">
            <BreakdownCard
              title="Facturas"
              total={loading ? 0 : stats.facturas}
              breakdown={facturasBreakdown}
              icon={Receipt}
            />
          </div>
          <BreakdownCard
            title="Facturas emitidas"
            total={loading ? 0 : stats.facturas}
            breakdown={facturasEmitidasBreakdown}
            icon={FileText}
          />
          <BreakdownCard
            title="Ofertas"
            total={loading ? 0 : stats.ofertas}
            breakdown={ofertasBreakdown}
            icon={FileText}
          />
        </div>

        {/* Panel Comercial */}
        <div className="mb-6">
          <CommercialPanel
            funnel={funnel}
            agingBuckets={agingBuckets}
            conversionRate={conversionRate}
            paymentRate={stats.facturas > 0 
              ? Math.round((stats.facturasPagadas / stats.facturas) * 100) 
              : 0}
          />
        </div>

        <div className="mb-6">
          <DashboardOperationsPipelineTable
            rows={pipelineSummaryRows}
            loading={loading}
            containerCounts={{
              transitoTotal: totalTransito,
              transitoCommercial: stats.contenedoresTransitoCommercial,
              transitoParcel: stats.contenedoresTransitoParcel,
              marielTotal: totalMariel,
              marielCommercial: stats.contenedoresMarielCommercial,
              marielParcel: stats.contenedoresMarielParcel,
            }}
          />
        </div>
      </div>
    </div>
  );
}
