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
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, Ship, ArrowRight, Pencil, Save } from "lucide-react";
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
  Producto
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
  const [selectedOfertaClienteId, setSelectedOfertaClienteId] = useState("");
  const [selectedOfertaCliente, setSelectedOfertaCliente] = useState<OfertaCliente | null>(null);
  const [numeroOferta, setNumeroOferta] = useState("");
  const [flete, setFlete] = useState("");
  const [seguro, setSeguro] = useState("");
  const [tieneSeguro, setTieneSeguro] = useState(false);
  const [incluyeFirmaCliente, setIncluyeFirmaCliente] = useState(true);
  const [totalCifDeseado, setTotalCifDeseado] = useState("");
  const [puertoEmbarque, setPuertoEmbarque] = useState("");
  const [origen, setOrigen] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [terminosPago, setTerminosPago] = useState("");
  const [saving, setSaving] = useState(false);

  // Estado para ajustar precios en edición
  const [totalDeseadoEdit, setTotalDeseadoEdit] = useState("");

  // Estado para editar item existente
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    cantidad: "",
    precioUnitario: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
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
      // Filtrar ofertas cliente que no estén rechazadas ni vencidas
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

  // Reset form al abrir diálogo de crear
  function openNewDialog(): void {
    const primeraOferta = ofertasCliente[0];
    setSelectedOfertaClienteId(primeraOferta?.id || "");
    setSelectedOfertaCliente(primeraOferta || null);
    setNumeroOferta(primeraOferta?.numero || "");
    setFlete("");
    setSeguro("");
    setTieneSeguro(false);
    setIncluyeFirmaCliente(true);
    setTotalCifDeseado("");
    // Cargar términos de la primera oferta
    setPuertoEmbarque(primeraOferta?.puertoEmbarque || "");
    setOrigen(primeraOferta?.origen || "");
    setMoneda(primeraOferta?.moneda || "USD");
    setTerminosPago(primeraOferta?.terminosPago || "");
    setDialogOpen(true);
  }

  function handleSelectOfertaCliente(ofertaClienteId: string): void {
    const oferta = ofertasCliente.find(o => o.id === ofertaClienteId);
    setSelectedOfertaClienteId(ofertaClienteId);
    setSelectedOfertaCliente(oferta || null);
    setNumeroOferta(oferta?.numero || "");
    // Cargar términos de la oferta seleccionada
    setPuertoEmbarque(oferta?.puertoEmbarque || "");
    setOrigen(oferta?.origen || "");
    setMoneda(oferta?.moneda || "USD");
    setTerminosPago(oferta?.terminosPago || "");
  }

  // Calcular CIF
  const fleteNum = parseFloat(flete) || 0;
  const seguroNum = tieneSeguro ? (parseFloat(seguro) || 0) : 0;
  const subtotalProductos = selectedOfertaCliente?.total || 0;
  const cifCalculado = subtotalProductos + fleteNum + seguroNum;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    
    if (!selectedOfertaClienteId) {
      toast.error("Selecciona una oferta al cliente");
      return;
    }

    setSaving(true);

    try {
      const cifDeseado = parseFloat(totalCifDeseado);
      
      await ofertasImportadoraApi.createFromOfertaCliente({
        ofertaClienteId: selectedOfertaClienteId,
        numero: numeroOferta,
        flete: fleteNum,
        seguro: seguroNum,
        tieneSeguro,
        incluyeFirmaCliente,
        // Solo enviar totalCifDeseado si es diferente al calculado
        totalCifDeseado: cifDeseado > 0 && cifDeseado !== cifCalculado ? cifDeseado : undefined,
        // Términos
        puertoEmbarque: puertoEmbarque || undefined,
        origen: origen || undefined,
        moneda: moneda || undefined,
        terminosPago: terminosPago || undefined,
      });
      
      if (cifDeseado > 0 && cifDeseado !== cifCalculado) {
        toast.success(`Oferta creada con CIF ajustado a $${cifDeseado.toLocaleString()}`);
      } else {
        toast.success("Oferta a importadora creada");
      }
      
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear");
      console.error(error);
    } finally {
      setSaving(false);
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

  function openDetailDialog(oferta: OfertaImportadora): void {
    setSelectedOferta(oferta);
    setTotalDeseadoEdit("");
    setDetailDialogOpen(true);
  }

  // Guardar cambios generales de la oferta y cerrar
  async function handleSaveChanges(): Promise<void> {
    if (!selectedOferta) return;

    try {
      await ofertasImportadoraApi.update(selectedOferta.id, {
        numero: selectedOferta.numero,
        flete: selectedOferta.flete,
        seguro: selectedOferta.seguro,
        tieneSeguro: selectedOferta.tieneSeguro,
        puertoEmbarque: selectedOferta.puertoEmbarque,
        origen: selectedOferta.origen,
        moneda: selectedOferta.moneda,
        terminosPago: selectedOferta.terminosPago,
        incluyeFirmaCliente: selectedOferta.incluyeFirmaCliente,
        estado: selectedOferta.estado,
      });
      toast.success("Cambios guardados");
      setDetailDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al guardar");
      console.error(error);
    }
  }

  // Ajustar precios al total CIF deseado
  async function handleAdjustPrices(): Promise<void> {
    if (!selectedOferta) return;
    
    const total = parseFloat(totalDeseadoEdit);
    if (!total || total <= 0) {
      toast.error("Ingresa un total válido mayor a 0");
      return;
    }

    try {
      // Primero guardar cambios de flete/seguro
      await ofertasImportadoraApi.update(selectedOferta.id, {
        flete: selectedOferta.flete,
        seguro: selectedOferta.seguro,
        tieneSeguro: selectedOferta.tieneSeguro,
      });
      
      // Luego ajustar precios
      const updated = await ofertasImportadoraApi.adjustPrices(selectedOferta.id, total);
      setSelectedOferta(updated);
      setTotalDeseadoEdit("");
      toast.success(`Precios ajustados. CIF = $${total.toLocaleString()}`);
      loadData();
    } catch (error) {
      toast.error("Error al ajustar precios");
      console.error(error);
    }
  }

  // Abrir diálogo de edición de item
  function openEditItemDialog(item: OfertaImportadora["items"][0]): void {
    setEditingItemId(item.id);
    setEditItemForm({
      cantidad: (item.pesoNeto || item.cantidad)?.toString() || "",
      precioUnitario: item.precioAjustado?.toString() || "", // Mostrar precio ajustado actual
      cantidadCajas: item.cantidadCajas?.toString() || "",
      cantidadSacos: item.cantidadSacos?.toString() || "",
      pesoXSaco: item.pesoXSaco?.toString() || "",
      precioXSaco: item.precioXSaco?.toString() || "",
      pesoXCaja: item.pesoXCaja?.toString() || "",
      precioXCaja: item.precioXCaja?.toString() || "",
    });
    setEditItemDialogOpen(true);
  }

  // Guardar cambios de item
  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      const itemData = {
        cantidad: editItemForm.cantidad ? parseFloat(editItemForm.cantidad) : undefined,
        // Enviar precio ajustado si fue modificado
        precioAjustado: editItemForm.precioUnitario ? parseFloat(editItemForm.precioUnitario) : undefined,
        cantidadCajas: editItemForm.cantidadCajas ? parseInt(editItemForm.cantidadCajas) : undefined,
        cantidadSacos: editItemForm.cantidadSacos ? parseInt(editItemForm.cantidadSacos) : undefined,
        pesoXSaco: editItemForm.pesoXSaco ? parseFloat(editItemForm.pesoXSaco) : undefined,
        precioXSaco: editItemForm.precioXSaco ? parseFloat(editItemForm.precioXSaco) : undefined,
        pesoXCaja: editItemForm.pesoXCaja ? parseFloat(editItemForm.pesoXCaja) : undefined,
        precioXCaja: editItemForm.precioXCaja ? parseFloat(editItemForm.precioXCaja) : undefined,
      };

      const updated = await ofertasImportadoraApi.updateItem(selectedOferta.id, editingItemId, itemData);
      setSelectedOferta(updated);
      setEditItemDialogOpen(false);
      toast.success("Producto actualizado");
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  return (
    <div>
      <Header
        title="Ofertas a Importadora"
        description="Crear ofertas CIF desde ofertas al cliente. Ajustar precios para llegar al total deseado."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva desde Oferta Cliente
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
                {/* Seleccionar oferta cliente */}
                <div className="space-y-2">
                  <Label>Oferta al Cliente *</Label>
                  <Select
                    value={selectedOfertaClienteId}
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

                {/* Info de la oferta seleccionada */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <h4 className="font-medium mb-2">📋 Datos de la Oferta Cliente</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-600">Cliente:</div>
                      <div className="font-medium">{selectedOfertaCliente.cliente.nombre}</div>
                      <div className="text-slate-600">Productos:</div>
                      <div className="font-medium">{selectedOfertaCliente.items.length} items</div>
                      <div className="text-slate-600">Total acordado:</div>
                      <div className="font-bold text-blue-700">{formatCurrency(selectedOfertaCliente.total)}</div>
                    </div>
                  </div>
                )}

                {/* Número de oferta */}
                <div className="space-y-2">
                  <Label>Número de Oferta</Label>
                  <Input
                    value={numeroOferta}
                    onChange={(e) => setNumeroOferta(e.target.value)}
                    placeholder="Ej: Z26001"
                  />
                </div>

                {/* Flete y Seguro */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <h4 className="font-medium text-blue-800">Costos de Envío</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Flete ($)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={flete}
                          onChange={(e) => setFlete(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={tieneSeguro}
                            onChange={(e) => setTieneSeguro(e.target.checked)}
                          />
                          Seguro ($)
                        </Label>
                        {tieneSeguro && (
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={seguro}
                            onChange={(e) => setSeguro(e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="incluyeFirma"
                        checked={incluyeFirmaCliente}
                        onChange={(e) => setIncluyeFirmaCliente(e.target.checked)}
                      />
                      <Label htmlFor="incluyeFirma" className="cursor-pointer">
                        Incluir firma del cliente en la plantilla
                      </Label>
                    </div>
                  </div>
                )}

                {/* Términos */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                    <h4 className="font-medium text-slate-700">Términos</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Puerto de Embarque</Label>
                        <Input
                          value={puertoEmbarque}
                          onChange={(e) => setPuertoEmbarque(e.target.value)}
                          placeholder="NEW ORLEANS, LA"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Origen</Label>
                        <Input
                          value={origen}
                          onChange={(e) => setOrigen(e.target.value)}
                          placeholder="ESTADOS UNIDOS"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Moneda</Label>
                        <Input
                          value={moneda}
                          onChange={(e) => setMoneda(e.target.value)}
                          placeholder="USD"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Términos de Pago</Label>
                        <Input
                          value={terminosPago}
                          onChange={(e) => setTerminosPago(e.target.value)}
                          placeholder="100% antes del embarque"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen CIF y ajuste */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                    <h4 className="font-medium text-emerald-800">Resumen CIF</h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Productos (FOB):</span>
                        <span className="font-medium">{formatCurrency(subtotalProductos)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>+ Flete:</span>
                        <span>{formatCurrency(fleteNum)}</span>
                      </div>
                      {tieneSeguro && (
                        <div className="flex justify-between">
                          <span>+ Seguro:</span>
                          <span>{formatCurrency(seguroNum)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>= CIF Total:</span>
                        <span>{formatCurrency(cifCalculado)}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="font-medium">¿Quieres otro total CIF?</Label>
                      <p className="text-xs text-slate-600">
                        Si quieres que el CIF sea diferente, escribe el total. Los precios de los productos se ajustarán automáticamente.
                      </p>
                      <Input
                        placeholder={`Dejar vacío para ${formatCurrency(cifCalculado)}`}
                        value={totalCifDeseado}
                        onChange={(e) => setTotalCifDeseado(e.target.value)}
                      />
                      {totalCifDeseado && parseFloat(totalCifDeseado) > 0 && parseFloat(totalCifDeseado) !== cifCalculado && (
                        <p className="text-xs text-amber-600 font-medium">
                          ⚠️ Los precios se ajustarán para que CIF = ${parseFloat(totalCifDeseado).toLocaleString()}
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
                  <Button type="submit" disabled={saving || !selectedOfertaClienteId}>
                    {saving ? "Creando..." : "Crear Oferta"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Tabla de ofertas */}
      <div className="p-8">
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Desde Oferta</TableHead>
                <TableHead>Importadora</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">FOB</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">Seguro</TableHead>
                <TableHead className="text-right">CIF Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
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
                    <TableCell className="text-right">{oferta.tieneSeguro ? formatCurrency(oferta.seguro) : '-'}</TableCell>
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

      {/* Diálogo de detalle/edición */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Oferta: {selectedOferta?.numero}
              {selectedOferta?.ofertaCliente && (
                <Badge variant="outline" className="ml-2">
                  Desde: {selectedOferta.ofertaCliente.numero}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex gap-2 mr-6">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadPdf("ofertas-importadora", selectedOferta.id)}
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadExcel("ofertas-importadora", selectedOferta.id)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button onClick={handleSaveChanges} size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Guardar y Cerrar
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info básica */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-slate-500">Importadora</Label>
                <p className="font-medium">{selectedOferta?.cliente.nombre}</p>
              </div>
              <div>
                <Label className="text-slate-500">Número</Label>
                <Input
                  className="mt-1"
                  value={selectedOferta?.numero || ""}
                  onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, numero: e.target.value } : null)}
                />
              </div>
              <div>
                <Label className="text-slate-500">Estado</Label>
                <Select
                  value={selectedOferta?.estado || "pendiente"}
                  onValueChange={(value) => setSelectedOferta(prev => prev ? { ...prev, estado: value } : null)}
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
              <div>
                <Label className="text-slate-500">Firma cliente</Label>
                <div className="mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOferta?.incluyeFirmaCliente !== false}
                      onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, incluyeFirmaCliente: e.target.checked } : null)}
                    />
                    Incluir en plantilla
                  </label>
                </div>
              </div>
            </div>

            {/* Flete, Seguro y Ajuste */}
            <div className="grid grid-cols-2 gap-4">
              {/* Costos de envío */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                <h4 className="font-medium text-blue-800">Costos de Envío</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Flete ($)</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      value={selectedOferta?.flete || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedOferta(prev => prev ? { ...prev, flete: val } : null);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedOferta?.tieneSeguro || false}
                        onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, tieneSeguro: e.target.checked } : null)}
                      />
                      Seguro ($)
                    </Label>
                    {selectedOferta?.tieneSeguro && (
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        value={selectedOferta?.seguro || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSelectedOferta(prev => prev ? { ...prev, seguro: val } : null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Ajustar al total */}
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
                <h4 className="font-medium text-emerald-800">Ajustar al Total CIF</h4>
                <p className="text-xs text-slate-600">
                  Si quieres que el CIF sea un valor específico, escríbelo aquí. Los precios de los productos se ajustarán.
                </p>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder={`Actual: ${formatCurrency(selectedOferta?.precioCIF || 0)}`}
                    value={totalDeseadoEdit}
                    onChange={(e) => setTotalDeseadoEdit(e.target.value)}
                  />
                  <Button 
                    onClick={handleAdjustPrices}
                    disabled={!totalDeseadoEdit || parseFloat(totalDeseadoEdit) <= 0}
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
                  <Label className="text-sm">Puerto Embarque</Label>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.puertoEmbarque || ""}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, puertoEmbarque: e.target.value } : null)}
                    placeholder="NEW ORLEANS, LA"
                  />
                </div>
                <div>
                  <Label className="text-sm">Origen</Label>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.origen || ""}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, origen: e.target.value } : null)}
                    placeholder="ESTADOS UNIDOS"
                  />
                </div>
                <div>
                  <Label className="text-sm">Moneda</Label>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.moneda || ""}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, moneda: e.target.value } : null)}
                    placeholder="USD"
                  />
                </div>
                <div>
                  <Label className="text-sm">Términos de Pago</Label>
                  <Input
                    className="mt-1"
                    value={selectedOferta?.terminosPago || ""}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, terminosPago: e.target.value } : null)}
                    placeholder="100% antes del embarque"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Tabla de productos */}
            <div>
              <h4 className="font-medium mb-3">Productos</h4>
              {(() => {
                const items = selectedOferta?.items || [];
                const hasCantidadCajas = items.some(i => i.cantidadCajas);
                const hasCantidadSacos = items.some(i => i.cantidadSacos);
                const hasPesoXSaco = items.some(i => i.pesoXSaco);
                const hasPrecioXSaco = items.some(i => i.precioXSaco);
                const hasPesoXCaja = items.some(i => i.pesoXCaja);
                const hasPrecioXCaja = items.some(i => i.precioXCaja);
                
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Unidad</TableHead>
                        {hasCantidadCajas && <TableHead className="text-right">Cajas</TableHead>}
                        {hasCantidadSacos && <TableHead className="text-right">Sacos</TableHead>}
                        {hasPesoXSaco && <TableHead className="text-right">Peso/Saco</TableHead>}
                        {hasPrecioXSaco && <TableHead className="text-right">$/Saco</TableHead>}
                        {hasPesoXCaja && <TableHead className="text-right">Peso/Caja</TableHead>}
                        {hasPrecioXCaja && <TableHead className="text-right">$/Caja</TableHead>}
                        <TableHead className="text-right">P.Original</TableHead>
                        <TableHead className="text-center">→</TableHead>
                        <TableHead className="text-right">P.Ajustado</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.producto.nombre}</TableCell>
                          <TableCell className="text-right">{item.pesoNeto || item.cantidad}</TableCell>
                          <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                          {hasCantidadCajas && <TableCell className="text-right">{item.cantidadCajas || '-'}</TableCell>}
                          {hasCantidadSacos && <TableCell className="text-right">{item.cantidadSacos || '-'}</TableCell>}
                          {hasPesoXSaco && <TableCell className="text-right">{item.pesoXSaco || '-'}</TableCell>}
                          {hasPrecioXSaco && <TableCell className="text-right">{item.precioXSaco ? formatCurrency(item.precioXSaco) : '-'}</TableCell>}
                          {hasPesoXCaja && <TableCell className="text-right">{item.pesoXCaja || '-'}</TableCell>}
                          {hasPrecioXCaja && <TableCell className="text-right">{item.precioXCaja ? formatCurrency(item.precioXCaja) : '-'}</TableCell>}
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
                            <Button variant="ghost" size="icon" onClick={() => openEditItemDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </div>

            {/* Resumen totales */}
            <div className="flex justify-end">
              <div className="w-80 space-y-2 text-sm p-4 bg-emerald-50 rounded-lg">
                <div className="flex justify-between">
                  <span>FOB (productos):</span>
                  <span className="font-medium">{formatCurrency(selectedOferta?.subtotalProductos || 0)}</span>
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
                <Separator />
                <div className="flex justify-between text-lg font-bold text-emerald-700">
                  <span>= CIF Total:</span>
                  <span>{formatCurrency(selectedOferta?.precioCIF || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar item (cantidad + campos informativos, NO precio) */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateItem} className="space-y-4">
            {/* Cantidad y Precio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad (LBS/KG)</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.cantidad}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidad: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio Ajustado</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioUnitario}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioUnitario: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-medium text-slate-500">Campos Informativos</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Cant. Cajas</Label>
                <Input
                  inputMode="numeric"
                  value={editItemForm.cantidadCajas}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidadCajas: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Cant. Sacos</Label>
                <Input
                  inputMode="numeric"
                  value={editItemForm.cantidadSacos}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidadSacos: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Peso/Saco</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.pesoXSaco}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, pesoXSaco: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">$/Saco</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioXSaco}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioXSaco: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Peso/Caja</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.pesoXCaja}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, pesoXCaja: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">$/Caja</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioXCaja}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioXCaja: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditItemDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
