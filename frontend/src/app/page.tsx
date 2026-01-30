"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
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
  ArrowRight
} from "lucide-react";
import { clientesApi, productosApi, ofertasClienteApi, ofertasImportadoraApi, ofertasGeneralesApi, facturasApi } from "@/lib/api";
import type { Producto, Factura, OfertaCliente, OfertaImportadora, Cliente } from "@/lib/api";
import { cn } from "@/lib/utils";

// ==========================================
// TIPOS
// ==========================================

interface KpiMetric {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
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
          {metric.badge && (
            <div className={`text-xs font-medium ${metric.badge.color}`}>
              {metric.badge.text}
            </div>
          )}
        </div>
        {!metric.badge && <div className="h-5"></div>}
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

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Dashboard(): React.ReactElement {
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
  });
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats(): Promise<void> {
      try {
        const [clientes, productos, ofertasCliente, ofertasImportadora, ofertasGenerales, facturas] = await Promise.all([
          clientesApi.getAll(),
          productosApi.getAll(),
          ofertasClienteApi.getAll(),
          ofertasImportadoraApi.getAll(),
          ofertasGeneralesApi.getAll(),
          facturasApi.getAll(),
        ]);

        const totalFacturado = facturas
          .filter((f: Factura) => f.estado === "pagada")
          .reduce((acc: number, f: Factura) => acc + f.total, 0);

        const facturasPagadas = facturas.filter((f: Factura) => f.estado === "pagada").length;
        const facturasPendientes = facturas.filter((f: Factura) => f.estado === "pendiente").length;

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
        const now = new Date();
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
            const dias = Math.floor((now.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
            if (dias <= 7) agingData[0].value++;
            else if (dias <= 15) agingData[1].value++;
            else if (dias <= 30) agingData[2].value++;
            else agingData[3].value++;
          });

        // Calcular clientes nuevos este mes
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
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
          productos: productos.filter((p: Producto) => p.activo).length,
          ofertas: ofertasCliente.length + ofertasImportadora.length,
          ofertasCliente: ofertasCliente.length,
          ofertasImportadora: ofertasImportadora.length,
          facturas: facturas.length,
          facturasPagadas,
          facturasPendientes,
          totalFacturado,
        });
        setFunnel(funnelData);
        setAgingBuckets(agingData);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  // Fila 1: 3 cards grandes (KPI principal)
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
    },
    {
      title: "Total Facturado",
      value: loading ? "..." : `$${stats.totalFacturado.toLocaleString()}`,
      icon: DollarSign,
      iconColor: "text-green-600",
      iconBg: "bg-green-100",
    },
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

  const conversionRate = stats.ofertas > 0 
    ? Math.round((stats.facturas / stats.ofertas) * 100) 
    : 0;

  return (
    <div>
      <Header 
        title="Dashboard" 
        description="Resumen general del sistema"
      />
      
      <div className="p-4 sm:p-5 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
        {/* Fila 1: Clientes, Productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
          <KpiCard metric={kpiCards[0]} />
          <KpiCard metric={kpiCards[1]} />
          <div className="hidden md:block">
            <KpiCard metric={kpiCards[2]} />
          </div>
        </div>

        {/* Fila 2: Facturas, Facturas emitidas, Ofertas (en grande) / Total Facturado, Facturas (en mediano) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
          {/* Facturas - siempre visible, primera posición en grande */}
          <BreakdownCard
            title="Facturas"
            total={loading ? 0 : stats.facturas}
            breakdown={facturasBreakdown}
            icon={Receipt}
          />
          {/* Facturas emitidas - visible solo en tablet/desktop, segunda posición en grande */}
          <div className="hidden sm:block">
            <BreakdownCard
              title="Facturas emitidas"
              total={loading ? 0 : stats.facturas}
              badge={stats.facturasPendientes > 0 ? {
                icon: AlertCircle,
                color: "bg-red-100 text-red-700",
              } : undefined}
              breakdown={[]}
              icon={FileText}
            />
          </div>
          {/* Ofertas - solo visible en pantallas grandes (md+), tercera posición */}
          <div className="hidden md:block">
            <BreakdownCard
              title="Ofertas"
              total={loading ? 0 : stats.ofertas}
              badge={stats.facturasPendientes > 0 ? {
                text: String(stats.facturasPendientes),
                color: "bg-amber-100 text-amber-700",
              } : undefined}
              breakdown={ofertasBreakdown}
              icon={FileText}
            />
          </div>
          {/* Total Facturado - solo visible en móvil, se posiciona al inicio */}
          <div className="sm:hidden md:hidden order-first">
            <KpiCard metric={kpiCards[2]} />
          </div>
        </div>

        {/* Fila 3: Facturas emitidas (solo móvil/tablet), Ofertas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6 mb-4 md:mb-6">
          <div className="md:hidden">
            <BreakdownCard
              title="Facturas emitidas"
              total={loading ? 0 : stats.facturas}
              badge={stats.facturasPendientes > 0 ? {
                icon: AlertCircle,
                color: "bg-red-100 text-red-700",
              } : undefined}
              breakdown={[]}
              icon={FileText}
            />
          </div>
          <div className="md:hidden">
            <BreakdownCard
              title="Ofertas"
              total={loading ? 0 : stats.ofertas}
              badge={stats.facturasPendientes > 0 ? {
                text: String(stats.facturasPendientes),
                color: "bg-amber-100 text-amber-700",
              } : undefined}
              breakdown={ofertasBreakdown}
              icon={FileText}
            />
          </div>
        </div>

        {/* Fila 3: Panel Comercial */}
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
      </div>
    </div>
  );
}
