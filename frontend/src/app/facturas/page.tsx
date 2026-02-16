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
  Download,
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
  
  // Estado para diálogo de exportación con rango de fechas
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Form data for new factura
  const [newFormData, setNewFormData] = useState({
    numeroFactura: "",
    fecha: new Date().toISOString().split("T")[0], // Hoy por defecto
    flete: "0",
    seguro: "0",
    tieneSeguro: false,
    codigoMincex: "",
    nroContrato: "",
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
    numeroFactura: "",
    fecha: "",
    estado: "pendiente",
    flete: "0",
    seguro: "0",
    tieneSeguro: false,
    codigoMincex: "",
    nroContrato: "",
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
    // Usar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de timezone
    // Formato: mm/dd/yyyy
    if (!date) return "";
    const dateOnly = date.split("T")[0];
    const [year, month, day] = dateOnly.split("-");
    return `${month}/${day}/${year}`;
  }

  function formatProductos(items: Factura["items"]): string {
    if (!items || items.length === 0) return "Sin productos";
    const primerosDos = items.slice(0, 2);
    const nombres = primerosDos.map(item => item.producto.nombre).join(", ");
    if (items.length > 2) {
      return `${nombres} (+${items.length - 2} más)`;
    }
    return nombres;
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
      nroContrato: "",
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
        nroContrato: "",
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
        nroContrato: newFormData.nroContrato || undefined,
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
      numeroFactura: factura.numero || "",
      fecha: factura.fecha ? factura.fecha.split("T")[0] : "",
      estado: factura.estado || "pendiente",
      flete: String(factura.flete || 0),
      seguro: String(factura.seguro || 0),
      tieneSeguro: factura.tieneSeguro || false,
      codigoMincex: factura.codigoMincex || "",
      nroContrato: factura.nroContrato || "",
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
        numero: editFormData.numeroFactura || undefined,
        fecha: editFormData.fecha || undefined,
        estado: editFormData.estado || undefined,
        flete: parseFloat(editFormData.flete) || 0,
        seguro: parseFloat(editFormData.seguro) || 0,
        tieneSeguro: editFormData.tieneSeguro,
        codigoMincex: editFormData.codigoMincex || undefined,
        nroContrato: editFormData.nroContrato || undefined,
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
    
    // Precargar pesoNeto y pesoBruto desde el producto si están vacíos
    // Solo precargar si el campo está vacío (no sobrescribir valores existentes)
    const pesoNetoValue = item.pesoNeto 
      ? String(item.pesoNeto) 
      : (item.producto?.pesoNeto ? String(item.producto.pesoNeto) : String(item.cantidad));
    
    const pesoBrutoValue = item.pesoBruto 
      ? String(item.pesoBruto) 
      : (item.producto?.pesoBruto ? String(item.producto.pesoBruto) : "");
    
    setEditItemForm({
      cantidad: String(item.cantidad),
      pesoNeto: pesoNetoValue,
      pesoBruto: pesoBrutoValue,
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

  // Remove item
  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedFactura || !confirm("¿Eliminar este producto?")) return;

    try {
      await facturasApi.removeItem(selectedFactura.id, itemId);
      toast.success("Producto eliminado");
      const updated = await facturasApi.getById(selectedFactura.id);
      setSelectedFactura(updated);
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  // Update item
  async function handleUpdateItem(): Promise<void> {
    if (!selectedFactura || !editingItemId) return;
    setSaving(true);
    try {
      // Siempre enviar todos los campos opcionales, incluso si están vacíos (como null para limpiar)
      await facturasApi.updateItem(selectedFactura.id, editingItemId, {
        cantidad: parseFloat(editItemForm.cantidad) || undefined,
        pesoNeto: editItemForm.pesoNeto && editItemForm.pesoNeto.trim() !== '' 
          ? parseFloat(editItemForm.pesoNeto) 
          : null,
        pesoBruto: editItemForm.pesoBruto && editItemForm.pesoBruto.trim() !== '' 
          ? parseFloat(editItemForm.pesoBruto) 
          : null,
        precioUnitario: parseFloat(editItemForm.precioUnitario) || undefined,
        cantidadCajas: editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== '' 
          ? parseFloat(editItemForm.cantidadCajas) 
          : null,
        cantidadSacos: editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== '' 
          ? parseFloat(editItemForm.cantidadSacos) 
          : null,
        pesoXSaco: editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== '' 
          ? parseFloat(editItemForm.pesoXSaco) 
          : null,
        precioXSaco: editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== '' 
          ? parseFloat(editItemForm.precioXSaco) 
          : null,
        pesoXCaja: editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== '' 
          ? parseFloat(editItemForm.pesoXCaja) 
          : null,
        precioXCaja: editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== '' 
          ? parseFloat(editItemForm.precioXCaja) 
          : null,
        codigoArancelario: editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== '' 
          ? editItemForm.codigoArancelario 
          : null,
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setExportDialogOpen(true);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel
            </Button>
            <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Factura
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-auto">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-medium text-slate-700 flex items-center gap-2">
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
                    <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-3">
                      <h4 className="font-medium text-slate-700 text-sm sm:text-base">Términos</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-xs sm:text-sm">Fecha</Label>
                          <Input
                            type="date"
                            value={newFormData.fecha}
                            onChange={(e) => setNewFormData((p) => ({ ...p, fecha: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-xs sm:text-sm">NRO Contrato (opcional)</Label>
                          <Input
                            value={newFormData.nroContrato}
                            onChange={(e) => setNewFormData((p) => ({ ...p, nroContrato: e.target.value }))}
                            placeholder="Número de contrato"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-xs sm:text-sm">Puerto de Embarque</Label>
                          <Input
                            value={newFormData.puertoEmbarque}
                            onChange={(e) => setNewFormData((p) => ({ ...p, puertoEmbarque: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-xs sm:text-sm">Origen</Label>
                          <Input
                            value={newFormData.origen}
                            onChange={(e) => setNewFormData((p) => ({ ...p, origen: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-500 text-xs sm:text-sm">Moneda</Label>
                          <Input
                            value={newFormData.moneda}
                            onChange={(e) => setNewFormData((p) => ({ ...p, moneda: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-slate-500 text-xs sm:text-sm">Términos de Pago</Label>
                          <Input
                            value={newFormData.terminosPago}
                            onChange={(e) => setNewFormData((p) => ({ ...p, terminosPago: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Firma Cliente */}
                    <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-amber-800 text-sm sm:text-base">Firma del Cliente</h4>
                        <Checkbox
                          checked={newFormData.incluyeFirmaCliente}
                          onCheckedChange={(checked) => 
                            setNewFormData((p) => ({ ...p, incluyeFirmaCliente: !!checked }))
                          }
                        />
                      </div>
                      {newFormData.incluyeFirmaCliente && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs sm:text-sm">Nombre</Label>
                            <Input
                              value={newFormData.firmaClienteNombre}
                              onChange={(e) => setNewFormData((p) => ({ ...p, firmaClienteNombre: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs sm:text-sm">Cargo</Label>
                            <Input
                              value={newFormData.firmaClienteCargo}
                              onChange={(e) => setNewFormData((p) => ({ ...p, firmaClienteCargo: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs sm:text-sm">Empresa</Label>
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

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || !selectedOfertaImportadoraId} className="w-full sm:w-auto">
                    {saving ? "Creando..." : "Crear Factura"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">FOB</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">Seguro</TableHead>
                <TableHead className="text-right">Total CFR</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-48">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    No hay facturas
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">{factura.numero}</TableCell>
                    <TableCell>{factura.cliente.nombre} {factura.cliente.apellidos}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm text-slate-700 truncate" title={formatProductos(factura.items)}>
                        {formatProductos(factura.items)}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(factura.fecha)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(factura.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(factura.flete)}</TableCell>
                    <TableCell className="text-right">
                      {factura.tieneSeguro && factura.seguro ? formatCurrency(factura.seguro) : ""}
                    </TableCell>
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
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factura: {selectedFactura?.numero}
            </DialogTitle>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedFactura && exportApi.downloadPdf("facturas", selectedFactura.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedFactura && exportApi.downloadExcel("facturas", selectedFactura.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button onClick={handleSaveChanges} disabled={saving} size="sm" className="gap-2 flex-1 sm:flex-initial">
                <Save className="h-4 w-4" />
                Guardar y Cerrar
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 min-w-0">
            {/* Info básica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 p-4 bg-slate-50 rounded-lg min-w-0">
              <div>
                <Label className="text-slate-500">Cliente</Label>
                <p className="font-medium">
                  {selectedFactura?.cliente.nombreCompania || selectedFactura?.cliente.nombre}
                </p>
                {selectedFactura?.cliente.nit && (
                  <p className="text-slate-500 text-sm mt-1">NIT: {selectedFactura.cliente.nit}</p>
                )}
              </div>
              <div>
                <Label className="text-slate-500">Número</Label>
                <Input
                  className="mt-1"
                  value={editFormData.numeroFactura}
                  onChange={(e) => setEditFormData((p) => ({ ...p, numeroFactura: e.target.value }))}
                  placeholder="FAC-XXX"
                />
              </div>
              <div>
                <Label className="text-slate-500">Fecha</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={editFormData.fecha}
                  onChange={(e) => setEditFormData((p) => ({ ...p, fecha: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-500">Número de Contrato (opcional)</Label>
                <Input
                  className="mt-1"
                  value={editFormData.nroContrato}
                  onChange={(e) => setEditFormData((p) => ({ ...p, nroContrato: e.target.value }))}
                  placeholder="Número de contrato"
                />
              </div>
              <div>
                <Label className="text-slate-500">Estado</Label>
                <Select
                  value={editFormData.estado}
                  onValueChange={(value) => setEditFormData((p) => ({ ...p, estado: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagada">Pagada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Flete, Seguro y Ajuste */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Costos de envío */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <h4 className="font-medium text-slate-700">Costos de Envío</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Flete ($)</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      type="number"
                      step="0.01"
                      value={editFormData.flete}
                      onChange={(e) => setEditFormData((p) => ({ ...p, flete: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editFormData.tieneSeguro}
                        onChange={(e) => setEditFormData((p) => ({ ...p, tieneSeguro: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Seguro ($)
                    </Label>
                    {editFormData.tieneSeguro && (
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        type="number"
                        step="0.01"
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    className="flex-1"
                    placeholder={`Actual: ${formatCurrency(selectedFactura?.total || 0)}`}
                    value={adjustTotal}
                    onChange={(e) => setAdjustTotal(e.target.value)}
                  />
                  <Button 
                    onClick={handleAdjustPrices}
                    disabled={!adjustTotal || parseFloat(adjustTotal) <= 0}
                    className="w-full sm:w-auto"
                  >
                    Ajustar
                  </Button>
                </div>
              </div>
            </div>

            {/* Términos */}
            <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
              <h4 className="font-medium text-slate-700">Términos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm">Puerto Embarque</Label>
                  <Input
                    className="mt-1"
                    value={editFormData.puertoEmbarque}
                    onChange={(e) => setEditFormData((p) => ({ ...p, puertoEmbarque: e.target.value }))}
                    placeholder="NEW ORLEANS, LA"
                  />
                </div>
                <div>
                  <Label className="text-sm">Origen</Label>
                  <Input
                    className="mt-1"
                    value={editFormData.origen}
                    onChange={(e) => setEditFormData((p) => ({ ...p, origen: e.target.value }))}
                    placeholder="ESTADOS UNIDOS"
                  />
                </div>
                <div>
                  <Label className="text-sm">Moneda</Label>
                  <Input
                    className="mt-1"
                    value={editFormData.moneda}
                    onChange={(e) => setEditFormData((p) => ({ ...p, moneda: e.target.value }))}
                    placeholder="USD"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">Términos de Pago</Label>
                <Input
                  className="mt-1"
                  value={editFormData.terminosPago}
                  onChange={(e) => setEditFormData((p) => ({ ...p, terminosPago: e.target.value }))}
                  placeholder="100% antes del embarque"
                />
              </div>
            </div>

            {/* Firma Cliente */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIncluyeFirmaFactura"
                  checked={editFormData.incluyeFirmaCliente}
                  onChange={(e) => setEditFormData((p) => ({ ...p, incluyeFirmaCliente: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="editIncluyeFirmaFactura" className="cursor-pointer font-medium text-amber-800">
                  Incluir firma del cliente en la plantilla
                </Label>
              </div>
              {editFormData.incluyeFirmaCliente && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <Label className="text-sm">Nombre</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.firmaClienteNombre}
                      onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteNombre: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Cargo</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.firmaClienteCargo}
                      onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteCargo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Empresa</Label>
                    <Input
                      className="mt-1"
                      value={editFormData.firmaClienteEmpresa}
                      onChange={(e) => setEditFormData((p) => ({ ...p, firmaClienteEmpresa: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Tabla de productos */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Productos</h4>
              </div>
              {selectedFactura && (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px] max-w-[200px]">Producto</TableHead>
                      <TableHead className="w-16">UM</TableHead>
                      {hasOptionalFields(selectedFactura.items).cantidadSacos && (
                        <TableHead className="text-right w-20">Sacos</TableHead>
                      )}
                      {hasOptionalFields(selectedFactura.items).codigoArancelario && (
                        <TableHead className="min-w-[120px] max-w-[150px]">Partida Arancel.</TableHead>
                      )}
                      <TableHead className="text-right w-24">Cantidad</TableHead>
                      <TableHead className="text-right w-24">Peso Neto</TableHead>
                      <TableHead className="text-right w-24">Peso Bruto</TableHead>
                      <TableHead className="text-right w-24">Precio</TableHead>
                      <TableHead className="text-right w-28">Importe</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFactura.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="min-w-[150px] max-w-[200px]">
                          <div className="truncate" title={item.producto.nombre}>
                            {item.producto.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="w-16">{item.producto.unidadMedida.abreviatura}</TableCell>
                        {hasOptionalFields(selectedFactura.items).cantidadSacos && (
                          <TableCell className="text-right w-20">{item.cantidadSacos || "-"}</TableCell>
                        )}
                        {hasOptionalFields(selectedFactura.items).codigoArancelario && (
                          <TableCell className="min-w-[120px] max-w-[150px]">
                            <div className="truncate" title={item.codigoArancelario || "-"}>
                              {item.codigoArancelario || "-"}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right w-24">{item.cantidad.toFixed(2)}</TableCell>
                        <TableCell className="text-right w-24">{(item.pesoNeto || item.cantidad).toFixed(2)}</TableCell>
                        <TableCell className="text-right w-24">{(item.pesoBruto || "-")}</TableCell>
                        <TableCell className="text-right w-24">{formatCurrencyUnitPrice(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium w-28">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                        <TableCell className="w-20">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditItemDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </div>

            {/* Resumen totales */}
            <div className="flex justify-end">
              <div className="w-full sm:w-80 space-y-2 text-sm p-4 bg-emerald-50 rounded-lg">
                <div className="flex justify-between">
                  <span>FOB (productos):</span>
                  <span className="font-medium">{formatCurrency(selectedFactura?.subtotal || 0)}</span>
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
                  <span>{formatCurrency(selectedFactura?.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
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

      {/* Diálogo para exportar con rango de fechas */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Facturas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecciona un rango de fechas para filtrar las facturas (opcional). Si no seleccionas fechas, se exportarán todas las facturas.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaDesde">Fecha Desde</Label>
                <Input
                  id="fechaDesde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaHasta">Fecha Hasta</Label>
                <Input
                  id="fechaHasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setExportDialogOpen(false);
                  setFechaDesde("");
                  setFechaHasta("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await exportApi.exportAllFacturas(
                      fechaDesde || undefined,
                      fechaHasta || undefined
                    );
                    toast.success("Facturas exportadas correctamente");
                    setExportDialogOpen(false);
                    setFechaDesde("");
                    setFechaHasta("");
                  } catch (error) {
                    toast.error("Error al exportar facturas");
                    console.error(error);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
