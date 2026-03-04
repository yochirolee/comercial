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
  const [newCarrier, setNewCarrier] = useState({ name: "", trackingUrlTemplate: "" });

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
      });
      setNewCarrier({ name: "", trackingUrlTemplate: "" });
      toast.success("Carrier creado");
      await loadCarriers();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear carrier");
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
        description="Ajustes del dashboard y carriers de operaciones"
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
                  Configura los carriers disponibles para operaciones y la URL de tracking. Usa {'{container}'} donde va el número de contenedor.
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
                        className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between border rounded-md px-3 py-2"
                      >
                        <div className="text-xs sm:text-sm">
                          <div className="font-medium break-words">{carrier.name}</div>
                          <div className="text-slate-500 break-all text-[11px] sm:text-xs">
                            {carrier.trackingUrlTemplate}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          onClick={() => void handleDeleteCarrier(carrier.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Agregar nuevo carrier</Label>
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
                  <Button
                    variant="outline"
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
