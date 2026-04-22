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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { carriersApi, categoriasProductoApi, type Carrier, type CategoriaProducto } from "@/lib/api";
import { Pencil } from "lucide-react";

import {
  type DashboardConfig,
  getDashboardConfig,
  getDefaultDashboardConfig,
  saveDashboardConfig,
} from "@/lib/dashboard-config";

export default function DashboardConfigPage(): React.ReactElement {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const [config, setConfig] = useState<DashboardConfig>(getDefaultDashboardConfig());
  const [loaded, setLoaded] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrierScacEdits, setCarrierScacEdits] = useState<Record<string, string | undefined>>({});
  const [newCarrier, setNewCarrier] = useState({ name: "", trackingUrlTemplate: "", scac: "" });
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);
  const [editingCarrierData, setEditingCarrierData] = useState({ name: "", trackingUrlTemplate: "", scac: "" });
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([]);
  const [newCategoria, setNewCategoria] = useState("");
  const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);
  const [editingCategoriaNombre, setEditingCategoriaNombre] = useState("");

  useEffect(() => {
    setConfig(getDashboardConfig());
    void loadCarriers();
    void loadCategorias();
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

  async function handleUpdateCarrier(): Promise<void> {
    if (!editingCarrierId) return;
    if (!editingCarrierData.name.trim() || !editingCarrierData.trackingUrlTemplate.trim()) {
      toast.error("Nombre y URL de tracking son requeridos");
      return;
    }
    try {
      await carriersApi.update(editingCarrierId, {
        name: editingCarrierData.name.trim(),
        trackingUrlTemplate: editingCarrierData.trackingUrlTemplate.trim(),
        scac: editingCarrierData.scac.trim().toUpperCase().slice(0, 4) || undefined,
      });
      setEditingCarrierId(null);
      toast.success("Carrier actualizado");
      await loadCarriers();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar carrier");
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

  async function loadCategorias(): Promise<void> {
    try {
      const data = await categoriasProductoApi.getAll();
      setCategorias(data);
    } catch (error) {
      console.error("Error al cargar categorías", error);
    }
  }

  async function handleAddCategoria(): Promise<void> {
    if (!newCategoria.trim()) {
      toast.error("El nombre de la categoría es requerido");
      return;
    }
    try {
      await categoriasProductoApi.create({ nombre: newCategoria.trim() });
      setNewCategoria("");
      toast.success("Categoría creada");
      await loadCategorias();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al crear categoría";
      toast.error(msg);
    }
  }

  async function handleUpdateCategoria(id: string): Promise<void> {
    if (!editingCategoriaNombre.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    try {
      await categoriasProductoApi.update(id, { nombre: editingCategoriaNombre.trim() });
      setEditingCategoriaId(null);
      toast.success("Categoría actualizada");
      await loadCategorias();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al actualizar";
      toast.error(msg);
    }
  }

  async function handleDeleteCategoria(id: string): Promise<void> {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    try {
      await categoriasProductoApi.delete(id);
      toast.success("Categoría eliminada");
      await loadCategorias();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al eliminar";
      toast.error(msg);
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
                      <div key={carrier.id} className="border rounded-md px-3 py-2">
                        {editingCarrierId === carrier.id ? (
                          <div className="space-y-2">
                            <Input
                              className="h-8 text-sm"
                              placeholder="Nombre del carrier"
                              value={editingCarrierData.name}
                              onChange={(e) => setEditingCarrierData((p) => ({ ...p, name: e.target.value }))}
                            />
                            <Input
                              className="h-8 text-sm"
                              placeholder="URL de tracking (usa {container})"
                              value={editingCarrierData.trackingUrlTemplate}
                              onChange={(e) => setEditingCarrierData((p) => ({ ...p, trackingUrlTemplate: e.target.value }))}
                            />
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-8 text-sm w-20 uppercase"
                                placeholder="SCAC"
                                maxLength={4}
                                value={editingCarrierData.scac}
                                onChange={(e) => setEditingCarrierData((p) => ({ ...p, scac: e.target.value.toUpperCase().slice(0, 4) }))}
                              />
                              <Button size="sm" className="h-8 text-xs" onClick={() => void handleUpdateCarrier()}>
                                Guardar
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingCarrierId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="text-xs sm:text-sm min-w-0">
                              <div className="font-medium break-words">{carrier.name}</div>
                              <div className="text-slate-500 break-all text-[11px] sm:text-xs">
                                {carrier.trackingUrlTemplate}
                              </div>
                              {carrier.scac && (
                                <div className="text-xs text-slate-400 mt-0.5">SCAC: {carrier.scac}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingCarrierId(carrier.id);
                                  setEditingCarrierData({
                                    name: carrier.name,
                                    trackingUrlTemplate: carrier.trackingUrlTemplate,
                                    scac: carrier.scac ?? "",
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => void handleDeleteCarrier(carrier.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
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

            {/* Categorías de Producto */}
            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Categorías de Producto</Label>
                <p className="text-xs text-slate-500">
                  Configura las categorías para clasificar tus productos (ej: Alimentos, Electrodomésticos, etc.)
                </p>
              </div>

              <div className="space-y-2">
                {categorias.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay categorías configuradas.</p>
                ) : (
                  <div className="space-y-1.5">
                    {categorias.map((cat) => (
                      <div key={cat.id} className="flex items-center gap-2 border rounded-md px-3 py-2">
                        {editingCategoriaId === cat.id ? (
                          <>
                            <Input
                              className="h-8 text-sm flex-1"
                              value={editingCategoriaNombre}
                              onChange={(e) => setEditingCategoriaNombre(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleUpdateCategoria(cat.id);
                                if (e.key === "Escape") setEditingCategoriaId(null);
                              }}
                              autoFocus
                            />
                            <Button size="sm" className="h-8 text-xs" onClick={() => void handleUpdateCategoria(cat.id)}>
                              OK
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditingCategoriaId(null)}>
                              ✕
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm flex-1">{cat.nombre}</span>
                            <span className="text-xs text-slate-400">{cat._count?.productos ?? 0} prod.</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditingCategoriaId(cat.id); setEditingCategoriaNombre(cat.nombre); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => void handleDeleteCategoria(cat.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Nueva categoría (ej: Alimentos)"
                  value={newCategoria}
                  onChange={(e) => setNewCategoria(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddCategoria(); }}
                  className="flex-1"
                />
                <Button variant="default" size="sm" className="gap-1 whitespace-nowrap" onClick={() => void handleAddCategoria()}>
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Notificaciones por email */}
            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Notificaciones por email al cliente</Label>
                <p className="text-xs text-slate-500">
                  Cuando está activo, al guardar cambios en una operación comercial se envía automáticamente
                  un email al cliente con el estado y notas de la operación (si el cliente tiene email registrado).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="auto-email"
                  checked={config.autoEmailOperaciones}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, autoEmailOperaciones: checked }))
                  }
                />
                <Label htmlFor="auto-email" className="text-sm cursor-pointer select-none">
                  {config.autoEmailOperaciones
                    ? "Activado — se envía email al guardar"
                    : "Desactivado — no se envían emails"}
                </Label>
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
