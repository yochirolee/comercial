"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { 
  Plus, 
  Trash2, 
  FileDown, 
  Eye, 
  FileSpreadsheet, 
  Receipt,
  Pencil,
  Save,
  DollarSign,
  Ship,
  Package,
} from "lucide-react";
import {
  facturasApi,
  ofertasClienteApi,
  ofertasImportadoraApi,
  exportApi,
} from "@/lib/api";
import type {
  Factura,
  OfertaCliente,
  OfertaImportadora,
  FacturaFromOfertaClienteInput,
  FacturaFromOfertaImportadoraInput,
} from "@/lib/api";

export default function FacturasPage(): React.ReactElement {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [ofertasImportadora, setOfertasImportadora] = useState<OfertaImportadora[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [adjustTotal, setAdjustTotal] = useState("");

  // Selected data
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [selectedOfertaImportadoraId, setSelectedOfertaImportadoraId] = useState("");
  const [editingItemId, setEditingItemId] = useState("");

  // Form data for new factura
  const [newFormData, setNewFormData] = useState({
    numeroFactura: "",
    fecha: new Date().toISOString().split("T")[0], // Hoy por defecto
    flete: "0",
    seguro: "0",
    tieneSeguro: false,
    codigoMincex: "",
    puertoEmbarque: "",
    origen: "",
    moneda: "",
    terminosPago: "",
    incluyeFirmaCliente: false,
    firmaClienteNombre: "",
    firmaClienteCargo: "",
    firmaClienteEmpresa: "",
    totalDeseado: "",
  });

  // Form data for edit factura
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    flete: "0",
    seguro: "0",
    tieneSeguro: false,
    codigoMincex: "",
    puertoEmbarque: "",
    origen: "",
    moneda: "",
    terminosPago: "",
    incluyeFirmaCliente: false,
    firmaClienteNombre: "",
    firmaClienteCargo: "",
    firmaClienteEmpresa: "",
  });

  // Form data for edit item
  const [editItemForm, setEditItemForm] = useState({
    cantidad: "",
    pesoNeto: "",
    pesoBruto: "",
    precioUnitario: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
    codigoArancelario: "",
  });

  const [saving, setSaving] = useState(false);

  async function loadData(): Promise<void> {
    try {
      const [facturasData, ocData, oiData] = await Promise.all([
        facturasApi.getAll(),
        ofertasClienteApi.getAll(),
        ofertasImportadoraApi.getAll(),
      ]);
      setFacturas(facturasData);
      setOfertasCliente(ocData.filter((o) => o.estado === "aceptada" || o.estado === "pendiente"));
      setOfertasImportadora(oiData.filter((o) => o.estado === "aceptada" || o.estado === "pendiente"));
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

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
  }

  function formatCurrencyUnitPrice(value: number): string {
    return new Intl.NumberFormat("es-ES", { 
      style: "currency", 
      currency: "USD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  // Get selected oferta importadora
  function getSelectedOfertaImportadora(): OfertaImportadora | undefined {
    return ofertasImportadora.find((o) => o.id === selectedOfertaImportadoraId);
  }

  // Open new dialog
  function openNewDialog(): void {
    setSelectedOfertaImportadoraId("");
    setNewFormData({
      numeroFactura: "",
      fecha: new Date().toISOString().split("T")[0],
      flete: "0",
      seguro: "0",
      tieneSeguro: false,
      codigoMincex: "",
      puertoEmbarque: "",
      origen: "",
      moneda: "",
      terminosPago: "",
      incluyeFirmaCliente: false,
      firmaClienteNombre: "",
      firmaClienteCargo: "",
      firmaClienteEmpresa: "",
      totalDeseado: "",
    });
    setNewDialogOpen(true);
  }

  // Handle oferta importadora selection
  function handleSelectOfertaImportadora(ofertaId: string): void {
    setSelectedOfertaImportadoraId(ofertaId);
    const oferta = ofertasImportadora.find((o) => o.id === ofertaId);
    if (oferta) {
      // Precargar número de factura basado en oferta
      const numeroFac = `FAC-${oferta.numero}`;
      
      // Obtener datos del cliente desde oferta cliente si existe
      const ofertaCliente = ofertasCliente.find((oc) => oc.id === oferta.ofertaClienteId);
      const nombreCliente = ofertaCliente 
        ? `${ofertaCliente.cliente.nombre || ""} ${ofertaCliente.cliente.apellidos || ""}`.trim()
        : `${oferta.cliente.nombre || ""} ${oferta.cliente.apellidos || ""}`.trim();
      
      setNewFormData((prev) => ({
        ...prev,
        numeroFactura: numeroFac,
        // Términos de la oferta importadora
        codigoMincex: oferta.codigoMincex || "",
        puertoEmbarque: oferta.puertoEmbarque || "NEW ORLEANS, LA",
        origen: oferta.origen || "ESTADOS UNIDOS",
        moneda: oferta.moneda || "USD",
        terminosPago: oferta.terminosPago || "PAGO 100% ANTES DEL EMBARQUE",
        // Flete y seguro desde oferta importadora
        flete: oferta.flete?.toString() || "0",
        tieneSeguro: oferta.tieneSeguro || false,
        seguro: oferta.seguro?.toString() || "0",
        // Firma del cliente
        incluyeFirmaCliente: oferta.incluyeFirmaCliente || false,
        firmaClienteNombre: nombreCliente,
        firmaClienteCargo: "DIRECTOR",
        firmaClienteEmpresa: ofertaCliente?.cliente.nombreCompania || oferta.cliente.nombreCompania || "",
      }));
    }
  }

  // Calculate totals for creation dialog
  function getCalculatedTotals(): { subtotal: number; cifTotal: number } {
    const oferta = getSelectedOfertaImportadora();
    if (!oferta) return { subtotal: 0, cifTotal: 0 };
    
    const subtotal = oferta.subtotalProductos || 0;
    const flete = parseFloat(newFormData.flete) || 0;
    const seguro = newFormData.tieneSeguro ? (parseFloat(newFormData.seguro) || 0) : 0;
    const cifTotal = subtotal + flete + seguro;
    
    return { subtotal, cifTotal };
  }

  // Submit new factura
  async function handleSubmitNew(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOfertaImportadoraId) {
      toast.error("Seleccione una oferta a importadora");
      return;
    }

    setSaving(true);
    try {
      const { cifTotal } = getCalculatedTotals();
      const totalDeseado = parseFloat(newFormData.totalDeseado) || 0;
      
      const data: FacturaFromOfertaImportadoraInput = {
        ofertaImportadoraId: selectedOfertaImportadoraId,
        numeroFactura: newFormData.numeroFactura,
        fecha: newFormData.fecha || undefined,
        flete: parseFloat(newFormData.flete) || 0,
        seguro: parseFloat(newFormData.seguro) || 0,
        tieneSeguro: newFormData.tieneSeguro,
        codigoMincex: newFormData.codigoMincex || undefined,
        puertoEmbarque: newFormData.puertoEmbarque || undefined,
        origen: newFormData.origen || undefined,
        moneda: newFormData.moneda || undefined,
        terminosPago: newFormData.terminosPago || undefined,
        incluyeFirmaCliente: newFormData.incluyeFirmaCliente,
        firmaClienteNombre: newFormData.firmaClienteNombre || undefined,
        firmaClienteCargo: newFormData.firmaClienteCargo || undefined,
        firmaClienteEmpresa: newFormData.firmaClienteEmpresa || undefined,
        // Solo ajustar si el total deseado es diferente al calculado
        totalDeseado: totalDeseado > 0 && totalDeseado !== cifTotal ? totalDeseado : undefined,
      };

      await facturasApi.createFromOfertaImportadora(data);
      toast.success("Factura creada exitosamente");
      setNewDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al crear factura");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  // Open detail dialog
  function openDetailDialog(factura: Factura): void {
    setSelectedFactura(factura);
    setEditFormData({
      fecha: factura.fecha ? factura.fecha.split("T")[0] : "",
      flete: String(factura.flete || 0),
      seguro: String(factura.seguro || 0),
      tieneSeguro: factura.tieneSeguro || false,
      codigoMincex: factura.codigoMincex || "",
      puertoEmbarque: factura.puertoEmbarque || "",
      origen: factura.origen || "",
      moneda: factura.moneda || "",
      terminosPago: factura.terminosPago || "",
      incluyeFirmaCliente: factura.incluyeFirmaCliente || false,
      firmaClienteNombre: factura.firmaClienteNombre || "",
      firmaClienteCargo: factura.firmaClienteCargo || "",
      firmaClienteEmpresa: factura.firmaClienteEmpresa || "",
    });
    setDetailDialogOpen(true);
  }

  // Save changes and close
  async function handleSaveChanges(): Promise<void> {
    if (!selectedFactura) return;
    setSaving(true);
    try {
      await facturasApi.update(selectedFactura.id, {
        fecha: editFormData.fecha || undefined,
        flete: parseFloat(editFormData.flete) || 0,
        seguro: parseFloat(editFormData.seguro) || 0,
        tieneSeguro: editFormData.tieneSeguro,
        codigoMincex: editFormData.codigoMincex || undefined,
        puertoEmbarque: editFormData.puertoEmbarque || undefined,
        origen: editFormData.origen || undefined,
        moneda: editFormData.moneda || undefined,
        terminosPago: editFormData.terminosPago || undefined,
        incluyeFirmaCliente: editFormData.incluyeFirmaCliente,
        firmaClienteNombre: editFormData.firmaClienteNombre || undefined,
        firmaClienteCargo: editFormData.firmaClienteCargo || undefined,
        firmaClienteEmpresa: editFormData.firmaClienteEmpresa || undefined,
      });
      toast.success("Factura actualizada");
      setDetailDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  // Adjust prices
  async function handleAdjustPrices(): Promise<void> {
    if (!selectedFactura) return;
    const total = parseFloat(adjustTotal);
    if (isNaN(total) || total <= 0) {
      toast.error("Ingrese un total válido");
      return;
    }

    setSaving(true);
    try {
      const updated = await facturasApi.adjustPrices(selectedFactura.id, total);
      toast.success("Precios ajustados");
      setSelectedFactura(updated);
      setAdjustTotal("");
      loadData();
    } catch (error) {
      toast.error("Error al ajustar");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  // Open edit item dialog
  function openEditItemDialog(item: Factura["items"][0]): void {
    setEditingItemId(item.id);
    setEditItemForm({
      cantidad: String(item.cantidad),
      pesoNeto: String(item.pesoNeto || item.cantidad),
      pesoBruto: String(item.pesoBruto || ""),
      precioUnitario: String(item.precioUnitario),
      cantidadCajas: String(item.cantidadCajas || ""),
      cantidadSacos: String(item.cantidadSacos || ""),
      pesoXSaco: String(item.pesoXSaco || ""),
      precioXSaco: String(item.precioXSaco || ""),
      pesoXCaja: String(item.pesoXCaja || ""),
      precioXCaja: String(item.precioXCaja || ""),
      codigoArancelario: item.codigoArancelario || "",
    });
    setEditItemDialogOpen(true);
  }

  // Update item
  async function handleUpdateItem(): Promise<void> {
    if (!selectedFactura || !editingItemId) return;
    setSaving(true);
    try {
      await facturasApi.updateItem(selectedFactura.id, editingItemId, {
        cantidad: parseFloat(editItemForm.cantidad) || undefined,
        pesoNeto: parseFloat(editItemForm.pesoNeto) || undefined,
        pesoBruto: parseFloat(editItemForm.pesoBruto) || undefined,
        precioUnitario: parseFloat(editItemForm.precioUnitario) || undefined,
        cantidadCajas: parseFloat(editItemForm.cantidadCajas) || undefined,
        cantidadSacos: parseFloat(editItemForm.cantidadSacos) || undefined,
        pesoXSaco: parseFloat(editItemForm.pesoXSaco) || undefined,
        precioXSaco: parseFloat(editItemForm.precioXSaco) || undefined,
        pesoXCaja: parseFloat(editItemForm.pesoXCaja) || undefined,
        precioXCaja: parseFloat(editItemForm.precioXCaja) || undefined,
        codigoArancelario: editItemForm.codigoArancelario || undefined,
      });
      toast.success("Item actualizado");
      const updated = await facturasApi.getById(selectedFactura.id);
      setSelectedFactura(updated);
      setEditItemDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar item");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  // Delete factura
  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      await facturasApi.delete(id);
      toast.success("Factura eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  // Estado colors
  const estadoColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pendiente: "outline",
    pagada: "default",
    vencida: "destructive",
    cancelada: "secondary",
  };

  // Check if items have optional fields
  function hasOptionalFields(items: Factura["items"]): Record<string, boolean> {
    return {
      cantidadSacos: items.some((i) => i.cantidadSacos),
      pesoXSaco: items.some((i) => i.pesoXSaco),
      precioXSaco: items.some((i) => i.precioXSaco),
      cantidadCajas: items.some((i) => i.cantidadCajas),
      pesoXCaja: items.some((i) => i.pesoXCaja),
      precioXCaja: items.some((i) => i.precioXCaja),
      codigoArancelario: items.some((i) => i.codigoArancelario),
    };
  }

  return (
    <div>
      <Header
        title="Facturas"
        description="Crear facturas desde ofertas a importadora."
        actions={
          <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Factura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Nueva Factura desde Oferta a Importadora
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmitNew} className="space-y-6">
                {/* Oferta Importadora */}
                <div className="space-y-2">
                  <Label>Oferta a Importadora *</Label>
                  <Select
                    value={selectedOfertaImportadoraId}
                    onValueChange={handleSelectOfertaImportadora}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      {ofertasImportadora.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.numero} - {o.cliente.nombre} (CIF: {formatCurrency(o.precioCIF)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Número de Factura */}
                <div className="space-y-2">
                  <Label>Número de Factura *</Label>
                  <Input
                    value={newFormData.numeroFactura}
                    onChange={(e) => setNewFormData((p) => ({ ...p, numeroFactura: e.target.value }))}
                    placeholder="FAC-XXX"
                    required
                  />
                </div>

                {selectedOfertaImportadoraId && (
                  <>
                    {/* Costos de envío y Total */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                        <h4 className="font-medium text-blue-800 flex items-center gap-2">
                          <Ship className="h-4 w-4" />
                          Costos de Envío
                        </h4>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Flete</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newFormData.flete}
                              onChange={(e) => setNewFormData((p) => ({ ...p, flete: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="tieneSeguro"
                              checked={newFormData.tieneSeguro}
                              onCheckedChange={(checked) => 
                                setNewFormData((p) => ({ ...p, tieneSeguro: !!checked }))
                              }
                            />
                            <Label htmlFor="tieneSeguro" className="text-sm">Incluir Seguro</Label>
                          </div>
                          {newFormData.tieneSeguro && (
                            <div className="space-y-2">
                              <Label>Seguro</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={newFormData.seguro}
                                onChange={(e) => setNewFormData((p) => ({ ...p, seguro: e.target.value }))}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                        <h4 className="font-medium text-emerald-800 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Total CFR
                        </h4>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Productos:</span>
                            <span>{formatCurrency(getCalculatedTotals().subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">+ Flete:</span>
                            <span>{formatCurrency(parseFloat(newFormData.flete) || 0)}</span>
                          </div>
                          {newFormData.tieneSeguro && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">+ Seguro:</span>
                              <span>{formatCurrency(parseFloat(newFormData.seguro) || 0)}</span>
                            </div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold text-emerald-800">
                            <span>CFR Calculado:</span>
                            <span>{formatCurrency(getCalculatedTotals().cifTotal)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-600">
                            Total CFR Final (opcional)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Dejar vacío para usar el calculado"
                            value={newFormData.totalDeseado}
                            onChange={(e) => setNewFormData((p) => ({ ...p, totalDeseado: e.target.value }))}
                          />
                          <p className="text-xs text-slate-500">
                            Si ingresa un valor, los precios se ajustarán.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Términos */}
                    <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                      <h4 className="font-medium text-slate-700">Términos</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-500">Fecha</Label>
                          <Input
                            type="date"
                            value={newFormData.fecha}
                            onChange={(e) => setNewFormData((p) => ({ ...p, fecha: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-500">Puerto de Embarque</Label>
                          <Input
                            value={newFormData.puertoEmbarque}
                            onChange={(e) => setNewFormData((p) => ({ ...p, puertoEmbarque: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-500">Origen</Label>
                          <Input
                            value={newFormData.origen}
                            onChange={(e) => setNewFormData((p) => ({ ...p, origen: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-500">Moneda</Label>
                          <Input
                            value={newFormData.moneda}
                            onChange={(e) => setNewFormData((p) => ({ ...p, moneda: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-slate-500">Términos de Pago</Label>
                          <Input
                            value={newFormData.terminosPago}
                            onChange={(e) => setNewFormData((p) => ({ ...p, terminosPago: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Firma Cliente */}
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-amber-800">Firma del Cliente</h4>
                        <Checkbox
                          checked={newFormData.incluyeFirmaCliente}
                          onCheckedChange={(checked) => 
                            setNewFormData((p) => ({ ...p, incluyeFirmaCliente: !!checked }))
                          }
                        />
                      </div>
                      {newFormData.incluyeFirmaCliente && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                              value={newFormData.firmaClienteNombre}
                              onChange={(e) => setNewFormData((p) => ({ ...p, firmaClienteNombre: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Cargo</Label>
                            <Input
                              value={newFormData.firmaClienteCargo}
                              onChange={(e) => setNewFormData((p) => ({ ...p, firmaClienteCargo: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Empresa</Label>
                            <Input
                              value={newFormData.firmaClienteEmpresa}
                              onChange={(e) => setNewFormData((p) => ({ ...p, firmaClienteEmpresa: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || !selectedOfertaImportadoraId}>
                    {saving ? "Creando..." : "Crear Factura"}
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
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">FOB</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">Total CFR</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-48">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No hay facturas
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">{factura.numero}</TableCell>
                    <TableCell>{factura.cliente.nombre} {factura.cliente.apellidos}</TableCell>
                    <TableCell>{formatDate(factura.fecha)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(factura.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(factura.flete)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(factura.total)}</TableCell>
                    <TableCell>
                      <Badge variant={estadoColors[factura.estado]}>{factura.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(factura)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadPdf("facturas", factura.id)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadExcel("facturas", factura.id)}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(factura.id)}>
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
        <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factura: {selectedFactura?.numero}
            </DialogTitle>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportApi.downloadPdf("facturas", selectedFactura?.id || "")}
              >
                <FileDown className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportApi.downloadExcel("facturas", selectedFactura?.id || "")}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button onClick={handleSaveChanges} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                Guardar y Cerrar
              </Button>
            </div>
          </DialogHeader>

          {selectedFactura && (
            <div className="space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-500">Cliente</Label>
                  <p className="font-medium">
                    {selectedFactura.cliente.nombreCompania || selectedFactura.cliente.nombre}
                  </p>
                  {selectedFactura.cliente.nit && (
                    <p className="text-slate-500">NIT: {selectedFactura.cliente.nit}</p>
                  )}
                </div>
                <div>
                  <Label className="text-slate-500">Estado</Label>
                  <p>
                    <Badge variant={estadoColors[selectedFactura.estado]}>
                      {selectedFactura.estado}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* Costos de Envío y Ajuste */}
              <div className="grid grid-cols-2 gap-4">
                {/* Costos de envío */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <h4 className="font-medium text-blue-800">Costos de Envío</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Flete ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="mt-1"
                        value={editFormData.flete}
                        onChange={(e) => setEditFormData((p) => ({ ...p, flete: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-sm flex items-center gap-2">
                        <Checkbox
                          checked={editFormData.tieneSeguro}
                          onCheckedChange={(checked) => 
                            setEditFormData((p) => ({ ...p, tieneSeguro: !!checked }))
                          }
                        />
                        Seguro ($)
                      </Label>
                      {editFormData.tieneSeguro && (
                        <Input
                          type="number"
                          step="0.01"
                          className="mt-1"
                          value={editFormData.seguro}
                          onChange={(e) => setEditFormData((p) => ({ ...p, seguro: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Ajustar al total */}
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                  <h4 className="font-medium text-emerald-800">Ajustar al Total CFR</h4>
                  <p className="text-xs text-slate-600">
                    Si quieres que el CFR sea un valor específico, escríbelo aquí. Los precios de los productos se ajustarán.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder={`Actual: ${formatCurrency(selectedFactura.total)}`}
                      value={adjustTotal}
                      onChange={(e) => setAdjustTotal(e.target.value)}
                    />
                    <Button 
                      onClick={handleAdjustPrices}
                      disabled={!adjustTotal || parseFloat(adjustTotal) <= 0}
                    >
                      Ajustar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Términos */}
              <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                <h4 className="font-medium text-slate-700">Términos</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-sm">Fecha</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={editFormData.fecha}
                      onChange={(e) => setEditFormData((p) => ({ ...p, fecha: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Puerto Embarque</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.puertoEmbarque}
                      onChange={(e) => setEditFormData((p) => ({ ...p, puertoEmbarque: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Origen</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.origen}
                      onChange={(e) => setEditFormData((p) => ({ ...p, origen: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Moneda</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.moneda}
                      onChange={(e) => setEditFormData((p) => ({ ...p, moneda: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Términos de Pago</Label>
                  <Input
                    className="mt-1"
                    value={editFormData.terminosPago}
                    onChange={(e) => setEditFormData((p) => ({ ...p, terminosPago: e.target.value }))}
                  />
                </div>
              </div>

              {/* Firma Cliente */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-amber-800">Firma del Cliente</h4>
                  <Checkbox
                    checked={editFormData.incluyeFirmaCliente}
                    onCheckedChange={(checked) => 
                      setEditFormData((p) => ({ ...p, incluyeFirmaCliente: !!checked }))
                    }
                  />
                </div>
                {editFormData.incluyeFirmaCliente && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={editFormData.firmaClienteNombre}
                        onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteNombre: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Input
                        value={editFormData.firmaClienteCargo}
                        onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteCargo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Empresa</Label>
                      <Input
                        value={editFormData.firmaClienteEmpresa}
                        onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteEmpresa: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Productos */}
              <div>
                <h3 className="font-semibold mb-2">Productos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>UM</TableHead>
                      {hasOptionalFields(selectedFactura.items).cantidadSacos && (
                        <TableHead className="text-right">Sacos</TableHead>
                      )}
                      {hasOptionalFields(selectedFactura.items).codigoArancelario && (
                        <TableHead>Partida Arancel.</TableHead>
                      )}
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Peso Neto</TableHead>
                      <TableHead className="text-right">Peso Bruto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFactura.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.producto.nombre}</TableCell>
                        <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                        {hasOptionalFields(selectedFactura.items).cantidadSacos && (
                          <TableCell className="text-right">{item.cantidadSacos || "-"}</TableCell>
                        )}
                        {hasOptionalFields(selectedFactura.items).codigoArancelario && (
                          <TableCell>{item.codigoArancelario || "-"}</TableCell>
                        )}
                        <TableCell className="text-right">{item.cantidad.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{(item.pesoNeto || item.cantidad).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{(item.pesoBruto || "-")}</TableCell>
                        <TableCell className="text-right">{formatCurrencyUnitPrice(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {(() => {
                            const precioRedondeado = Math.round(item.precioUnitario * 1000) / 1000;
                            const cantidadRedondeada = Math.round(item.cantidad * 100) / 100;
                            return formatCurrency(precioRedondeado * cantidadRedondeada);
                          })()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEditItemDialog(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumen totales */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2 text-sm p-4 bg-emerald-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>FOB (productos):</span>
                    <span className="font-medium">{formatCurrency(selectedFactura.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Flete:</span>
                    <span>{formatCurrency(parseFloat(editFormData.flete) || 0)}</span>
                  </div>
                  {editFormData.tieneSeguro && (
                    <div className="flex justify-between">
                      <span>+ Seguro:</span>
                      <span>{formatCurrency(parseFloat(editFormData.seguro) || 0)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-emerald-700">
                    <span>= CFR Total:</span>
                    <span>{formatCurrency(selectedFactura.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.cantidad}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, cantidad: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.precioUnitario}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, precioUnitario: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso Neto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.pesoNeto}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, pesoNeto: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso Bruto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.pesoBruto}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, pesoBruto: e.target.value }))}
                />
              </div>
            </div>
            
            <Separator />
            <p className="text-sm text-slate-500 font-medium">Campos Informativos (opcionales)</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad de Sacos</Label>
                <Input
                  type="number"
                  value={editItemForm.cantidadSacos}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, cantidadSacos: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso x Saco</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.pesoXSaco}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, pesoXSaco: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio x Saco</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItemForm.precioXSaco}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, precioXSaco: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cantidad de Cajas</Label>
                <Input
                  type="number"
                  value={editItemForm.cantidadCajas}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, cantidadCajas: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Código Arancelario</Label>
                <Input
                  value={editItemForm.codigoArancelario}
                  onChange={(e) => setEditItemForm((p) => ({ ...p, codigoArancelario: e.target.value }))}
                  placeholder="Ej: M1500CIULB"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditItemDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateItem} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
