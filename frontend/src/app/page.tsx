"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Package, 
  FileText, 
  Receipt, 
  TrendingUp,
  DollarSign
} from "lucide-react";
import { clientesApi, productosApi, ofertasClienteApi, facturasApi } from "@/lib/api";
import type { Producto, Factura } from "@/lib/api";

export default function Dashboard(): React.ReactElement {
  const [stats, setStats] = useState({
    clientes: 0,
    productos: 0,
    ofertas: 0,
    facturas: 0,
    totalFacturado: 0,
    facturasPendientes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats(): Promise<void> {
      try {
        const [clientes, productos, ofertas, facturas] = await Promise.all([
          clientesApi.getAll(),
          productosApi.getAll(),
          ofertasClienteApi.getAll(),
          facturasApi.getAll(),
        ]);

        const totalFacturado = facturas
          .filter((f: Factura) => f.estado === "pagada")
          .reduce((acc: number, f: Factura) => acc + f.total, 0);

        const facturasPendientes = facturas.filter(
          (f: Factura) => f.estado === "pendiente"
        ).length;

        setStats({
          clientes: clientes.length,
          productos: productos.filter((p: Producto) => p.activo).length,
          ofertas: ofertas.length,
          facturas: facturas.length,
          totalFacturado,
          facturasPendientes,
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const cards = [
    {
      title: "Clientes",
      value: stats.clientes,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Productos",
      value: stats.productos,
      icon: Package,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Ofertas",
      value: stats.ofertas,
      icon: FileText,
      color: "text-[#0C0A04]",
      bgColor: "bg-[#F3B450]",
    },
    {
      title: "Facturas",
      value: stats.facturas,
      icon: Receipt,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Total Facturado",
      value: `$${stats.totalFacturado.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Facturas Pendientes",
      value: stats.facturasPendientes,
      icon: TrendingUp,
      color: "text-white",
      bgColor: "bg-red-500",
    },
  ];

  return (
    <div>
      <Header 
        title="Dashboard" 
        description="Resumen general del sistema"
      />
      
      <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {cards.map((card) => (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {loading ? "..." : card.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:gap-4 p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <a 
                href="/clientes" 
                className="p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors text-center border border-gray-200 hover:border-blue-300"
              >
                <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">Nuevo Cliente</span>
              </a>
              <a 
                href="/productos" 
                className="p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-emerald-50 transition-colors text-center border border-gray-200 hover:border-emerald-300"
              >
                <Package className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-emerald-600" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">Nuevo Producto</span>
              </a>
              <a 
                href="/ofertas/cliente" 
                className="p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-[#F3B450]/20 transition-colors text-center border border-gray-200 hover:border-[#F3B450]"
              >
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-[#F3B450]" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">Nueva Oferta</span>
              </a>
              <a 
                href="/facturas" 
                className="p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-purple-50 transition-colors text-center border border-gray-200 hover:border-purple-300"
              >
                <Receipt className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-purple-600" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">Nueva Factura</span>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-600 p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <p>
                <strong className="text-[#F3B450]">ZAS by JMC Corp.</strong> te permite gestionar tus ofertas y facturas
                de manera eficiente.
              </p>
              <ul className="list-disc list-inside space-y-1 sm:space-y-2">
                <li>Crea ofertas generales (lista de precios)</li>
                <li>Ofertas personalizadas para clientes</li>
                <li>Ofertas CIF para importadoras en Cuba</li>
                <li>Genera facturas desde ofertas aceptadas</li>
                <li>Exporta todo a PDF y Excel</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
