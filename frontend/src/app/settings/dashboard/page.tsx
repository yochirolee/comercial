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
import { Save } from "lucide-react";

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

  useEffect(() => {
    setConfig(getDashboardConfig());
    setLoaded(true);
  }, []);

  function handleSave(): void {
    saveDashboardConfig(config);
    toast.success("Configuración guardada");
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
        title="Configuración del Dashboard" 
        description="Configura los parámetros de visualización del dashboard"
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
