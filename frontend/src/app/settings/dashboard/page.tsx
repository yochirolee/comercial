"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { carriersApi, type Carrier } from "@/lib/api";

const DASHBOARD_CONFIG_KEY = "zas_dashboard_config";

interface DashboardConfig {
  year: number;
}

function getDefaultConfig(): DashboardConfig {
  return {
    year: new Date().getFullYear(),
  };
}

export function getDashboardConfig(): DashboardConfig {
  if (typeof window === "undefined") return getDefaultConfig();
  
  try {
    const stored = localStorage.getItem(DASHBOARD_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.error("Error reading dashboard config");
  }
  return getDefaultConfig();
}

export function saveDashboardConfig(config: DashboardConfig): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(DASHBOARD_CONFIG_KEY, JSON.stringify(config));
  } catch {
    console.error("Error saving dashboard config");
  }
}

export default function DashboardConfigPage(): React.ReactElement {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const [config, setConfig] = useState<DashboardConfig>(getDefaultConfig());
  const [loaded, setLoaded] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrierScacEdits, setCarrierScacEdits] = useState<Record<string, string>>({});
  const [newCarrier, setNewCarrier] = useState({ name: "", trackingUrlTemplate: "", scac: "" });

  useEffect(() => {
    setConfig(getDashboardConfig());
    void loadCarriers();
    setLoaded(true);
  }, []);

  async function loadCarriers(): Promise<void> {
    try {
      const data = await carriersApi.getAll();
      setCarriers(data);
    } catch (error) {
      console.error("Error al cargar carriers", error);
    }
  }

  function handleSave(): void {
    saveDashboardConfig(config);
    toast.success("Configuración guardada");
  }

  async function handleAddCarrier(): Promise<void> {
    if (!newCarrier.name.trim() || !newCarrier.trackingUrlTemplate.trim()) {
      toast.error("Nombre y URL de tracking son requeridos");
      return;
    }

    try {
      await carriersApi.create({
        name: newCarrier.name.trim(),
        trackingUrlTemplate: newCarrier.trackingUrlTemplate.trim(),
        scac: newCarrier.scac.trim() || undefined,
      });
      setNewCarrier({ name: "", trackingUrlTemplate: "", scac: "" });
      toast.success("Carrier creado");
      await loadCarriers();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear carrier");
    }
  }

  async function handleUpdateCarrierScac(carrier: Carrier): Promise<void> {
    const scac = (carrierScacEdits[carrier.id] ?? carrier.scac ?? "").trim().toUpperCase().slice(0, 4);
    try {
      await carriersApi.update(carrier.id, { scac: scac || undefined });
      setCarrierScacEdits((p) => ({ ...p, [carrier.id]: undefined }));
      toast.success("SCAC actualizado");
      await loadCarriers();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar SCAC");
    }
  }

  async function handleDeleteCarrier(id: string): Promise<void> {
    if (!window.confirm("¿Eliminar este carrier?")) return;
    try {
      await carriersApi.delete(id);
      toast.success("Carrier eliminado");
      await loadCarriers();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar carrier");
    }
  }

  if (!loaded) {
    return (
      <div className="p-6">
        <Header title="Configuración del Dashboard" description="Cargando..." />
      </div>
    );
  }

  return (
    <div>
      <Header 
        title="Configuración general" 
        description="Configura parámetros globales del sistema"
      />
      
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-medium">
                Año para Total Facturado
              </Label>
              <p className="text-xs text-slate-500">
                Selecciona el año que se mostrará en el card de Total Facturado del dashboard.
              </p>
              <Select
                value={String(config.year)}
                onValueChange={(value) => setConfig({ ...config, year: parseInt(value) })}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Carriers (navieras)</Label>
                <p className="text-xs text-slate-500">
                  Configura los carriers para operaciones, URL de tracking y opcionalmente SCAC (4 letras) para Terminal49. Usa {'{container}'} donde va el número de contenedor.
                </p>
              </div>

              <div className="space-y-2">
                {carriers.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay carriers configurados.</p>
                ) : (
                  <div className="space-y-2">
                    {carriers.map((carrier) => (
                      <div
                        key={carrier.id}
                        className="flex flex-col gap-2 border rounded-md px-3 py-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="text-xs sm:text-sm min-w-0">
                            <div className="font-medium break-words">{carrier.name}</div>
                            <div className="text-slate-500 break-all text-[11px] sm:text-xs">
                              {carrier.trackingUrlTemplate}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Input
                              placeholder="SCAC"
                              className="w-14 h-8 text-xs uppercase"
                              maxLength={4}
                              value={carrierScacEdits[carrier.id] ?? carrier.scac ?? ""}
                              onChange={(e) =>
                                setCarrierScacEdits((p) => ({
                                  ...p,
                                  [carrier.id]: e.target.value.toUpperCase().slice(0, 4),
                                }))
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => void handleUpdateCarrierScac(carrier)}
                            >
                              SCAC
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              onClick={() => void handleDeleteCarrier(carrier.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Agregar nuevo carrier</Label>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Completa los campos y haz clic en <strong>Agregar carrier</strong> para que aparezca en la lista. &quot;Guardar Configuración&quot; solo guarda el año del dashboard.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Nombre del carrier (ej: Seaboard Marine)"
                    value={newCarrier.name}
                    onChange={(e) => setNewCarrier((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    placeholder="URL de tracking (usa {container} para el número)"
                    value={newCarrier.trackingUrlTemplate}
                    onChange={(e) =>
                      setNewCarrier((p) => ({ ...p, trackingUrlTemplate: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="SCAC (4 letras, opcional, para Terminal49)"
                    value={newCarrier.scac}
                    onChange={(e) =>
                      setNewCarrier((p) => ({ ...p, scac: e.target.value.toUpperCase().slice(0, 4) }))
                    }
                    maxLength={4}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => void handleAddCarrier()}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar carrier
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Guardar Configuración
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
