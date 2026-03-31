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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Download,
  FileText,
  FileCheck,
  Sparkles,
  FolderCheck,
  ClipboardCheck,
  TableProperties,
  FileSpreadsheet,
} from "lucide-react";
import { ofertasClienteApi, documentosApi, exportApi } from "@/lib/api";
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

/** Ordenar ofertas por número descendente (ej. Z26035 antes que Z20034) */
function sortOfertasByNumeroDesc(ofertas: OfertaCliente[]): OfertaCliente[] {
  return [...ofertas].sort((a, b) =>
    b.numero.localeCompare(a.numero, undefined, { numeric: true, sensitivity: "base" })
  );
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
  const [reportSoloActivas, setReportSoloActivas] = useState(true);
  const [reportTipo, setReportTipo] = useState<"all" | "COMMERCIAL" | "PARCEL">("all");
  const [exportingReport, setExportingReport] = useState(false);

  async function loadOfertas(): Promise<void> {
    try {
      const data = await ofertasClienteApi.getAll();
      const sorted = sortOfertasByNumeroDesc(data);
      setOfertas(sorted);
      if (sorted.length > 0) {
        setSelectedOfertaId(sorted[0].id);
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

  async function handleExportOperacionesComerciales(): Promise<void> {
    setExportingReport(true);
    try {
      await exportApi.exportOperacionesComerciales({
        soloActivas: reportSoloActivas,
        tipo: reportTipo,
      });
      toast.success("Excel generado con datos del sistema");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al exportar");
      console.error(error);
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <div>
      <Header
        title="Documentación"
      />

      <div className="p-4 md:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-3 w-full">
          {/* Selector de Oferta Global */}
          <Card className="border-slate-200 shadow-sm w-full overflow-hidden">
            <CardHeader className="px-2.5 md:px-3 py-1.5 pb-0">
              <CardTitle className="flex items-center gap-1.5 text-xs md:text-sm">
                <FileCheck className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                <span>Seleccionar Oferta</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 md:px-3 pt-1 pb-2.5 md:pb-3 w-full overflow-hidden">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Oferta a Cliente *</Label>
                <Select
                  value={selectedOfertaId}
                  onValueChange={setSelectedOfertaId}
                  disabled={loading}
                >
                  <SelectTrigger className="h-9 text-sm w-full max-w-full overflow-hidden">
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
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 mb-0.5 text-xs">Cliente</div>
                      <div className="font-medium text-slate-900 text-xs break-words">
                        {selectedOferta.cliente.nombre} {selectedOferta.cliente.apellidos || ""}
                      </div>
                    </div>
                    {selectedOferta.cliente.nombreCompania && (
                      <div>
                        <div className="text-slate-500 mb-0.5 text-xs">Compañía</div>
                        <div className="font-medium text-slate-900 text-xs break-words truncate">{selectedOferta.cliente.nombreCompania}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-slate-500 mb-0.5 text-xs">Productos</div>
                      <div className="font-medium text-slate-900 text-xs">{selectedOferta.items.length} items</div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-0.5 text-xs">Total</div>
                      <div className="font-semibold text-emerald-700 text-xs">
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

          {/* Lista de Documentos */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Documentos Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {documentTemplates.map((template) => {
                  const Icon = template.icon;
                  const isGenerating = generating === template.id;
                  
                  return (
                    <div
                      key={template.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${template.borderColor} ${template.bgColor} hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`p-1.5 rounded ${template.bgColor} border ${template.borderColor} flex-shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${template.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900">
                            {template.name}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {template.description}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleGenerateDocument(template.id)}
                        disabled={!selectedOfertaId || isGenerating || loading}
                        size="sm"
                        className="h-8 px-3 text-xs flex-shrink-0"
                        variant="outline"
                      >
                        {isGenerating ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            <span>Generando...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            <span>Generar</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Resumen de operaciones — mismo estilo de fila que los documentos, con filtros */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Resumen de operaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 hover:shadow-sm transition-shadow p-2.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                  <div className="p-1.5 rounded border border-emerald-200 bg-emerald-50 flex-shrink-0 self-start">
                    <TableProperties className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Excel con datos del sistema (comercial y Parcel): una fila por contenedor, oferta o
                      referencia, productos, cliente, importadora, estado, fechas de oferta y contrato c/
                      importadora, ETD/ETA. Salida Mariel reservada para cuando se registre.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-1 border-t border-emerald-200/80 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2">
                  <div className="w-full sm:w-[min(100%,11rem)] sm:flex-shrink-0 space-y-1">
                    <Label className="text-xs text-slate-600">Tipo</Label>
                    <Select
                      value={reportTipo}
                      onValueChange={(v) => setReportTipo(v as "all" | "COMMERCIAL" | "PARCEL")}
                    >
                      <SelectTrigger className="h-8 w-full text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="COMMERCIAL">Comercial</SelectItem>
                        <SelectItem value="PARCEL">Parcel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none sm:pb-1 sm:min-h-[32px]">
                    <Checkbox
                      checked={reportSoloActivas}
                      onCheckedChange={(c) => setReportSoloActivas(c === true)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs sm:text-sm text-slate-700">Solo contenedores activos</span>
                  </label>
                  <div className="w-full sm:flex-1 sm:min-w-[8rem] sm:flex sm:justify-end md:ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleExportOperacionesComerciales()}
                      disabled={exportingReport}
                      className="h-8 w-full sm:w-auto px-3 text-xs bg-white"
                    >
                      {exportingReport ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Generando…
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                          Descargar Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
