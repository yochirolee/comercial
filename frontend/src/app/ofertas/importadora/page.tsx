"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, Ship, ArrowRight } from "lucide-react";
import { 
  ofertasImportadoraApi, 
  ofertasClienteApi, 
  clientesApi, 
  productosApi, 
  exportApi 
} from "@/lib/api";
import type { 
  OfertaImportadora, 
  OfertaCliente, 
  Cliente, 
  Producto, 
  ItemOfertaImportadoraInput,
  CrearDesdeOfertaClienteInput
} from "@/lib/api";

export default function OfertasImportadoraPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaImportadora[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaImportadora | null>(null);
  
  // Form para crear desde oferta cliente
  const [fromOfertaCliente, setFromOfertaCliente] = useState<CrearDesdeOfertaClienteInput>({
    ofertaClienteId: "",
    numero: "",
    flete: 0,
    seguro: 0,
    tieneSeguro: false,
    incluyeFirmaCliente: true,
    ajustarPrecios: true,
  });
  const [selectedOfertaCliente, setSelectedOfertaCliente] = useState<OfertaCliente | null>(null);
  const [saving, setSaving] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemOfertaImportadoraInput>({
    productoId: "",
    cantidad: 1,
    cantidadCajas: undefined,
    precioOriginal: 0,
  });

  async function loadData(): Promise<void> {
    try {
      const [ofertasData, ofertasClienteData, clientesData, productosData] = await Promise.all([
        ofertasImportadoraApi.getAll(),
        ofertasClienteApi.getAll(),
        clientesApi.getAll(),
        productosApi.getAll(),
      ]);
      setOfertas(ofertasData);
      // Filtrar ofertas cliente que estén aceptadas o pendientes
      setOfertasCliente(ofertasClienteData.filter(o => o.estado !== 'rechazada' && o.estado !== 'vencida'));
      setClientes(clientesData);
      setProductos(productosData.filter((p) => p.activo));
    } catch (error) {
      toast.error("Error al cargar datos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openNewDialog(): void {
    const primeraOferta = ofertasCliente[0];
    setFromOfertaCliente({
      ofertaClienteId: primeraOferta?.id || "",
      numero: primeraOferta?.numero || "", // Usar el mismo número de la oferta cliente
      flete: 0,
      seguro: 0,
      tieneSeguro: false,
      incluyeFirmaCliente: true,
      ajustarPrecios: true,
    });
    setSelectedOfertaCliente(primeraOferta || null);
    setDialogOpen(true);
  }

  function handleSelectOfertaCliente(ofertaClienteId: string): void {
    const oferta = ofertasCliente.find(o => o.id === ofertaClienteId);
    setSelectedOfertaCliente(oferta || null);
    setFromOfertaCliente(prev => ({
      ...prev,
      ofertaClienteId,
      numero: oferta?.numero || prev.numero, // Copiar número de oferta cliente
    }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    
    if (!fromOfertaCliente.ofertaClienteId) {
      toast.error("Selecciona una oferta al cliente");
      return;
    }

    setSaving(true);

    try {
      await ofertasImportadoraApi.createFromOfertaCliente(fromOfertaCliente);
      toast.success("Oferta a importadora creada con precios ajustados");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateFleteSeguro(): Promise<void> {
    if (!selectedOferta) return;

    try {
      // Guardar todos los campos editables
      await ofertasImportadoraApi.update(selectedOferta.id, {
        numero: selectedOferta.numero,
        estado: selectedOferta.estado,
        flete: selectedOferta.flete,
        seguro: selectedOferta.seguro,
        tieneSeguro: selectedOferta.tieneSeguro,
        ajustarPrecios: selectedOferta.ajustarPrecios,
        puertoEmbarque: selectedOferta.puertoEmbarque,
        origen: selectedOferta.origen,
        moneda: selectedOferta.moneda,
        terminosPago: selectedOferta.terminosPago,
        incluyeFirmaCliente: selectedOferta.incluyeFirmaCliente,
      });
      // Recalcular precios
      const recalculado = await ofertasImportadoraApi.recalcular(selectedOferta.id);
      setSelectedOferta(recalculado);
      toast.success("Cambios guardados y precios recalculados");
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Eliminar esta oferta?")) return;

    try {
      await ofertasImportadoraApi.delete(id);
      toast.success("Oferta eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  async function openDetailDialog(oferta: OfertaImportadora): Promise<void> {
    setSelectedOferta(oferta);
    setDetailDialogOpen(true);
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta) return;

    try {
      const updated = await ofertasImportadoraApi.addItem(selectedOferta.id, itemForm);
      setSelectedOferta(updated);
      toast.success("Producto agregado");
      setItemDialogOpen(false);
      setItemForm({ productoId: "", cantidad: 1, precioOriginal: 0 });
      loadData();
    } catch (error) {
      toast.error("Error al agregar");
      console.error(error);
    }
  }

  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedOferta || !confirm("¿Eliminar este producto?")) return;

    try {
      await ofertasImportadoraApi.removeItem(selectedOferta.id, itemId);
      const updated = await ofertasImportadoraApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      loadData();
    } catch (error) {
      toast.error("Error");
      console.error(error);
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  // Calcular FOB y CIF según configuración
  const seguroFinal = fromOfertaCliente.tieneSeguro ? (fromOfertaCliente.seguro || 0) : 0;
  const fobAjustado = selectedOfertaCliente 
    ? (fromOfertaCliente.ajustarPrecios 
        ? selectedOfertaCliente.total - fromOfertaCliente.flete - seguroFinal  // Modo ajuste
        : selectedOfertaCliente.total)  // Modo sin ajuste: FOB = precio acordado
    : 0;
  const cifTotal = selectedOfertaCliente
    ? (fromOfertaCliente.ajustarPrecios
        ? selectedOfertaCliente.total  // Modo ajuste: CIF = precio acordado
        : selectedOfertaCliente.total + fromOfertaCliente.flete + seguroFinal)  // Modo sin ajuste: CIF = acordado + flete + seguro
    : 0;

  return (
    <div>
      <Header
        title="Ofertas a Importadora"
        description="Ofertas CIF con precios ajustados para que el cliente pague lo acordado"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear desde Oferta Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Nueva Oferta a Importadora
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Seleccionar Oferta al Cliente *</Label>
                  <Select
                    value={fromOfertaCliente.ofertaClienteId}
                    onValueChange={handleSelectOfertaCliente}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      {ofertasCliente.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.numero} - {o.cliente.nombre} ({formatCurrency(o.total)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Información de la oferta seleccionada */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">📋 Oferta Cliente Seleccionada</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-600">Cliente:</div>
                      <div className="font-medium">{selectedOfertaCliente.cliente.nombre}</div>
                      <div className="text-slate-600">Productos:</div>
                      <div className="font-medium">{selectedOfertaCliente.items.length} items</div>
                      <div className="text-slate-600">Precio acordado:</div>
                      <div className="font-bold text-blue-700">{formatCurrency(selectedOfertaCliente.total)}</div>
                    </div>
                  </div>
                )}

                {/* Número de oferta */}
                <div className="space-y-2">
                  <Label>Número de Oferta *</Label>
                  <Input
                    value={fromOfertaCliente.numero}
                    onChange={(e) => setFromOfertaCliente((p) => ({ ...p, numero: e.target.value }))}
                    placeholder="Ej: Z26001"
                    required
                  />
                </div>

                {/* Flete y Seguro */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                  <h4 className="font-medium text-slate-700">🚢 Costos de Envío</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Flete ($) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fromOfertaCliente.flete || ""}
                        onChange={(e) =>
                          setFromOfertaCliente((p) => ({ ...p, flete: e.target.value === "" ? 0 : parseFloat(e.target.value) }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seguro ($)</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tieneSeguroCheck"
                          checked={fromOfertaCliente.tieneSeguro}
                          onChange={(e) =>
                            setFromOfertaCliente((p) => ({ ...p, tieneSeguro: e.target.checked, seguro: e.target.checked ? 0 : p.seguro }))
                          }
                          className="h-4 w-4"
                        />
                        {fromOfertaCliente.tieneSeguro ? (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={fromOfertaCliente.seguro || ""}
                            onChange={(e) =>
                              setFromOfertaCliente((p) => ({ ...p, seguro: e.target.value === "" ? 0 : parseFloat(e.target.value) }))
                            }
                            className="flex-1"
                          />
                        ) : (
                          <span className="text-sm text-slate-500">Sin seguro</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modo de cálculo */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="ajustarPreciosImp"
                        checked={fromOfertaCliente.ajustarPrecios ?? true}
                        onChange={(e) =>
                          setFromOfertaCliente((p) => ({ ...p, ajustarPrecios: e.target.checked }))
                        }
                        className="h-4 w-4 mt-0.5"
                      />
                      <div>
                        <Label htmlFor="ajustarPreciosImp" className="cursor-pointer font-medium">
                          Ajustar precios de productos
                        </Label>
                        <p className="text-xs text-slate-500 mt-1">
                          {fromOfertaCliente.ajustarPrecios 
                            ? "✓ El cliente paga lo acordado. Los precios se ajustan para absorber flete y seguro."
                            : "✗ El cliente paga precio acordado + flete + seguro."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opciones de plantilla */}
                <div className="flex items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    id="incluyeFirmaClienteImp"
                    checked={fromOfertaCliente.incluyeFirmaCliente ?? true}
                    onChange={(e) =>
                      setFromOfertaCliente((p) => ({ ...p, incluyeFirmaCliente: e.target.checked }))
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="incluyeFirmaClienteImp" className="cursor-pointer text-sm">
                    Incluir firma del cliente en la plantilla
                  </Label>
                </div>

                {/* Resumen de cálculo */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h4 className="font-medium text-emerald-800 mb-3">📊 Resumen de Costos</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">{fromOfertaCliente.ajustarPrecios ? "FOB (ajustado):" : "FOB (productos):"}</span>
                        <span className={fromOfertaCliente.ajustarPrecios && fobAjustado <= 0 ? "text-red-600 font-bold" : "font-medium"}>
                          {formatCurrency(fobAjustado)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">+ Flete:</span>
                        <span className="font-medium">{formatCurrency(fromOfertaCliente.flete)}</span>
                      </div>
                      {fromOfertaCliente.tieneSeguro && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">+ Seguro:</span>
                          <span className="font-medium">{formatCurrency(fromOfertaCliente.seguro || 0)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between text-base font-bold text-emerald-700">
                        <span>= TOTAL CIF:</span>
                        <span>{formatCurrency(cifTotal)}</span>
                      </div>
                      {fromOfertaCliente.ajustarPrecios && fobAjustado <= 0 && (
                        <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                          ⚠️ El flete y seguro superan el precio acordado
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || (fromOfertaCliente.ajustarPrecios && fobAjustado <= 0)}>
                    {saving ? "Creando..." : "Crear Oferta"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Desde Oferta</TableHead>
                <TableHead>Importadora</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">FOB Ajustado</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">CIF</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No hay ofertas. Crea una desde una oferta al cliente.
                  </TableCell>
                </TableRow>
              ) : (
                ofertas.map((oferta) => (
                  <TableRow key={oferta.id}>
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>
                      {oferta.ofertaCliente ? (
                        <Badge variant="secondary" className="font-mono">
                          {oferta.ofertaCliente.numero}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{oferta.cliente.nombre}</TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(oferta.subtotalProductos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(oferta.flete)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {formatCurrency(oferta.precioCIF)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{oferta.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(oferta)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadPdf("ofertas-importadora", oferta.id)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadExcel("ofertas-importadora", oferta.id)}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(oferta.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Oferta Importadora: {selectedOferta?.numero}
              {selectedOferta?.ofertaCliente && (
                <Badge variant="outline" className="ml-2">
                  Desde: {selectedOferta.ofertaCliente.numero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <span className="text-sm text-slate-500">Importadora:</span>
                <p className="font-medium">{selectedOferta?.cliente.nombre}</p>
                {selectedOferta?.cliente.nombreCompania && (
                  <p className="text-sm text-slate-500">{selectedOferta.cliente.nombreCompania}</p>
                )}
              </div>
              <div>
                <span className="text-sm text-slate-500">Número de Oferta:</span>
                <Input
                  className="mt-1"
                  value={selectedOferta?.numero || ""}
                  onChange={(e) =>
                    setSelectedOferta((prev) =>
                      prev ? { ...prev, numero: e.target.value } : null
                    )
                  }
                />
              </div>
              <div>
                <span className="text-sm text-slate-500">Precio Acordado:</span>
                <p className="font-bold text-blue-600">{formatCurrency(selectedOferta?.precioAcordado || 0)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-500">Estado:</span>
                <Select
                  value={selectedOferta?.estado || "pendiente"}
                  onValueChange={(value) =>
                    setSelectedOferta((prev) =>
                      prev ? { ...prev, estado: value } : null
                    )
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="aceptada">Aceptada</SelectItem>
                    <SelectItem value="rechazada">Rechazada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Costos de envío */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <h4 className="font-medium text-slate-700">🚢 Costos de Envío</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-slate-500">Flete ($):</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    placeholder="0.00"
                    value={selectedOferta?.flete || ""}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, flete: e.target.value === "" ? 0 : parseFloat(e.target.value) } : null
                      )
                    }
                  />
                </div>
                <div>
                  <span className="text-sm text-slate-500 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedOferta?.tieneSeguro || false}
                      onChange={(e) =>
                        setSelectedOferta((prev) =>
                          prev ? { ...prev, tieneSeguro: e.target.checked } : null
                        )
                      }
                    />
                    Seguro ($):
                  </span>
                  {selectedOferta?.tieneSeguro && (
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1"
                      placeholder="0.00"
                      value={selectedOferta?.seguro || ""}
                      onChange={(e) =>
                        setSelectedOferta((prev) =>
                          prev ? { ...prev, seguro: e.target.value === "" ? 0 : parseFloat(e.target.value) } : null
                        )
                      }
                    />
                  )}
                </div>
                <div className="flex items-end">
                  <Button size="sm" variant="outline" onClick={handleUpdateFleteSeguro}>
                    Recalcular Precios
                  </Button>
                </div>
              </div>
              
              {/* Modo de ajuste */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="ajustarPreciosEdit"
                    checked={selectedOferta?.ajustarPrecios !== false}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, ajustarPrecios: e.target.checked } : null
                      )
                    }
                    className="h-4 w-4 mt-0.5"
                  />
                  <div>
                    <Label htmlFor="ajustarPreciosEdit" className="cursor-pointer font-medium">
                      Ajustar precios de productos
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedOferta?.ajustarPrecios !== false
                        ? "✓ El cliente paga lo acordado. Los precios se ajustan para absorber flete y seguro."
                        : "✗ El cliente paga precio acordado + flete + seguro."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Términos y condiciones */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <h4 className="font-medium text-slate-700">📝 Términos y Condiciones</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-500">Puerto de Embarque:</span>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.puertoEmbarque || ""}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, puertoEmbarque: e.target.value } : null
                      )
                    }
                    placeholder="NEW ORLEANS, LA"
                  />
                </div>
                <div>
                  <span className="text-sm text-slate-500">Origen:</span>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.origen || ""}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, origen: e.target.value } : null
                      )
                    }
                    placeholder="ESTADOS UNIDOS"
                  />
                </div>
                <div>
                  <span className="text-sm text-slate-500">Moneda:</span>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.moneda || ""}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, moneda: e.target.value } : null
                      )
                    }
                    placeholder="USD"
                  />
                </div>
                <div>
                  <span className="text-sm text-slate-500">Términos de Pago:</span>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.terminosPago || ""}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, terminosPago: e.target.value } : null
                      )
                    }
                    placeholder="PAGO 100% ANTES DEL EMBARQUE"
                  />
                </div>
              </div>
              
              {/* Firma del cliente */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="incluyeFirmaClienteEdit"
                    checked={selectedOferta?.incluyeFirmaCliente !== false}
                    onChange={(e) =>
                      setSelectedOferta((prev) =>
                        prev ? { ...prev, incluyeFirmaCliente: e.target.checked } : null
                      )
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="incluyeFirmaClienteEdit" className="cursor-pointer">
                    Incluir firma del cliente en la plantilla
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <h4 className="font-medium">Productos (con precios ajustados)</h4>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Producto
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full max-w-md">
                  <DialogHeader>
                    <DialogTitle>Agregar Producto</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Producto</Label>
                      <Select
                        value={itemForm.productoId}
                        onValueChange={(value) => {
                          const prod = productos.find((p) => p.id === value);
                          setItemForm((prev) => ({
                            ...prev,
                            productoId: value,
                            precioOriginal: prod?.precioBase || 0,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} ({formatCurrency(p.precioBase)}/{p.unidadMedida.abreviatura})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cant. Sacos (opcional)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={itemForm.cantidadCajas || ""}
                          onChange={(e) =>
                            setItemForm((prev) => ({
                              ...prev,
                              cantidadCajas: e.target.value ? parseInt(e.target.value) : undefined,
                            }))
                          }
                          placeholder="Ej: 100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cantidad (LBS)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={itemForm.cantidad || ""}
                          onChange={(e) =>
                            setItemForm((prev) => ({
                              ...prev,
                              cantidad: e.target.value === "" ? 0 : parseFloat(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Precio Original x LB</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemForm.precioOriginal || ""}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            precioOriginal: e.target.value === "" ? 0 : parseFloat(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Agregar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">P. Original</TableHead>
                  <TableHead className="text-center">→</TableHead>
                  <TableHead className="text-right">P. Ajustado</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOferta?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.producto.nombre}</TableCell>
                    <TableCell className="text-right">{item.pesoNeto || item.cantidad}</TableCell>
                    <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                    <TableCell className="text-right text-slate-500">
                      {formatCurrency(item.precioOriginal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-slate-400 mx-auto" />
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(item.precioAjustado)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <div className="w-80 space-y-2 text-sm p-4 bg-emerald-50 rounded-lg">
                <div className="flex justify-between text-slate-600">
                  <span>Precio acordado (cliente):</span>
                  <span className="font-medium">{formatCurrency(selectedOferta?.precioAcordado || 0)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span>FOB (productos ajustados):</span>
                  <span>{formatCurrency(selectedOferta?.subtotalProductos || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Flete:</span>
                  <span>{formatCurrency(selectedOferta?.flete || 0)}</span>
                </div>
                {selectedOferta?.tieneSeguro && (
                  <div className="flex justify-between">
                    <span>+ Seguro:</span>
                    <span>{formatCurrency(selectedOferta?.seguro || 0)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold text-emerald-700">
                  <span>= PRECIO CIF:</span>
                  <span>{formatCurrency(selectedOferta?.precioCIF || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
