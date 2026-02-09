"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileText, FileCheck, Sparkles, FolderCheck, ClipboardCheck } from "lucide-react";
import { ofertasClienteApi, documentosApi } from "@/lib/api";
import type { OfertaCliente } from "@/lib/api";

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const documentTemplates: DocumentTemplate[] = [
  {
    id: "enduser",
    name: "Documento End User",
    description: "Genera un documento Word personalizado desde una plantilla usando los datos de una oferta a cliente.",
    icon: FileText,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    id: "checklist",
    name: "Checklist",
    description: "Genera un documento checklist con fecha, número de oferta y nombre del cliente.",
    icon: ClipboardCheck,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    id: "cierre-expediente",
    name: "Cierre de Expediente",
    description: "Genera un documento de cierre de expediente con fecha, número de oferta y nombre del cliente.",
    icon: FolderCheck,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
];

export default function DocumentacionPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaCliente[]>([]);
  const [selectedOfertaId, setSelectedOfertaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  async function loadOfertas(): Promise<void> {
    try {
      const data = await ofertasClienteApi.getAll();
      setOfertas(data);
      if (data.length > 0) {
        setSelectedOfertaId(data[0].id);
      }
    } catch (error) {
      toast.error("Error al cargar ofertas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOfertas();
  }, []);

  async function handleGenerateDocument(templateId: string): Promise<void> {
    if (!selectedOfertaId) {
      toast.error("Selecciona una oferta");
      return;
    }

    setGenerating(templateId);
    try {
      if (templateId === "enduser") {
        await documentosApi.downloadEndUserDocument(selectedOfertaId);
        toast.success("Documento generado y descargado");
      } else if (templateId === "cierre-expediente") {
        await documentosApi.downloadCierreExpedienteDocument(selectedOfertaId);
        toast.success("Documento generado y descargado");
      } else if (templateId === "checklist") {
        await documentosApi.downloadChecklistDocument(selectedOfertaId);
        toast.success("Documento generado y descargado");
      } else {
        toast.error("Tipo de documento no implementado");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al generar documento");
      console.error("Error al generar documento:", error);
    } finally {
      setGenerating(null);
    }
  }

  const selectedOferta = ofertas.find((o) => o.id === selectedOfertaId);

  return (
    <div>
      <Header
        title="Documentación"
        description="Genera documentos personalizados desde plantillas"
      />

      <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 w-full">
          {/* Selector de Oferta Global */}
          <Card className="border-slate-200 shadow-sm w-full overflow-hidden">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <FileCheck className="h-4 w-4 md:h-5 md:w-5 text-slate-600 flex-shrink-0" />
                <span>Seleccionar Oferta</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm mt-1">
                Elige la oferta a cliente que deseas usar para generar los documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5 lg:p-6 pt-0 w-full overflow-hidden">
              <div className="space-y-2">
                <Label className="text-sm md:text-base">Oferta a Cliente *</Label>
                <Select
                  value={selectedOfertaId}
                  onValueChange={setSelectedOfertaId}
                  disabled={loading}
                >
                  <SelectTrigger className="h-10 md:h-11 text-sm md:text-base w-full max-w-full overflow-hidden">
                    <SelectValue 
                      placeholder="Selecciona una oferta" 
                      className="truncate"
                    />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {loading ? (
                      <SelectItem value="loading" disabled>
                        Cargando ofertas...
                      </SelectItem>
                    ) : ofertas.length === 0 ? (
                      <SelectItem value="no-ofertas" disabled>
                        No hay ofertas disponibles
                      </SelectItem>
                    ) : (
                      ofertas.map((oferta) => (
                        <SelectItem 
                          key={oferta.id} 
                          value={oferta.id}
                          className="truncate max-w-full"
                        >
                          <span className="truncate block">
                            {oferta.numero} - {oferta.cliente.nombre} {oferta.cliente.apellidos || ""}
                            {oferta.cliente.nombreCompania && ` (${oferta.cliente.nombreCompania})`}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedOferta && (
                <div className="mt-4 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                    <div>
                      <div className="text-slate-600 mb-1 text-xs sm:text-sm">Cliente</div>
                      <div className="font-medium text-slate-900 text-sm sm:text-base break-words">
                        {selectedOferta.cliente.nombre} {selectedOferta.cliente.apellidos || ""}
                      </div>
                    </div>
                    {selectedOferta.cliente.nombreCompania && (
                      <div>
                        <div className="text-slate-600 mb-1 text-xs sm:text-sm">Compañía</div>
                        <div className="font-medium text-slate-900 text-sm sm:text-base break-words">{selectedOferta.cliente.nombreCompania}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-slate-600 mb-1 text-xs sm:text-sm">Productos</div>
                      <div className="font-medium text-slate-900 text-sm sm:text-base">{selectedOferta.items.length} items</div>
                    </div>
                    <div>
                      <div className="text-slate-600 mb-1 text-xs sm:text-sm">Total</div>
                      <div className="font-bold text-emerald-700 text-sm sm:text-base">
                        {new Intl.NumberFormat("es-ES", {
                          style: "currency",
                          currency: "USD",
                        }).format(selectedOferta.total || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grid de Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            {documentTemplates.map((template) => {
              const Icon = template.icon;
              const isGenerating = generating === template.id;
              
              // Determinar clase del botón según el template
              const getButtonClass = (templateId: string): string => {
                switch (templateId) {
                  case "enduser":
                    return "w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base";
                  case "cierre-expediente":
                    return "w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base";
                  case "checklist":
                    return "w-full bg-amber-600 hover:bg-amber-700 text-white text-sm sm:text-base";
                  default:
                    return "w-full bg-slate-600 hover:bg-slate-700 text-white text-sm sm:text-base";
                }
              };

              return (
                <Card
                  key={template.id}
                  className={`${template.borderColor} shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col h-full`}
                >
                  <CardHeader className={`${template.bgColor} border-b ${template.borderColor} p-4 md:p-5 lg:p-6`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className={`p-1.5 md:p-2 rounded-lg ${template.bgColor} border ${template.borderColor} flex-shrink-0`}>
                          <Icon className={`h-4 w-4 md:h-5 md:w-5 ${template.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base md:text-lg font-semibold text-slate-900 break-words">
                            {template.name}
                          </CardTitle>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="mt-2 text-slate-600 text-xs md:text-sm leading-relaxed">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-4 md:pt-5 lg:pt-6 p-4 md:p-5 lg:p-6">
                    <div className="flex-1"></div>
                    <Button
                      onClick={() => handleGenerateDocument(template.id)}
                      disabled={!selectedOfertaId || isGenerating || loading}
                      className={`${getButtonClass(template.id)} h-10 md:h-11`}
                    >
                      {isGenerating ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          <span className="hidden md:inline">Generando...</span>
                          <span className="md:hidden">Generando</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          <span className="hidden md:inline">Generar Documento</span>
                          <span className="md:hidden">Generar</span>
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Placeholder para futuros documentos */}
          {documentTemplates.length === 1 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p>Más tipos de documentos estarán disponibles próximamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
