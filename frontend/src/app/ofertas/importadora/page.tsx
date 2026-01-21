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
  const [itemFormStrings, setItemFormStrings] = useState({
    productoId: "",
    cantidad: "",
    cantidadCajas: "",
    precioOriginal: "",
  });

  // Estado para ajustar precios por total deseado
  const [totalDeseado, setTotalDeseado] = useState("");

  // Estado para editar item existente
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemFormStrings, setEditItemFormStrings] = useState({
    cantidad: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
    precioOriginal: "",
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

  // Resetear el formulario de item
  function resetItemForm(): void {
    setItemFormStrings({
      productoId: "",
      cantidad: "",
      cantidadCajas: "",
      precioOriginal: "",
    });
  }

  // Convierte el formulario de strings a números para enviar al API
  function getItemFormAsNumbers(): ItemOfertaImportadoraInput {
    return {
      productoId: itemFormStrings.productoId,
      cantidad: parseFloat(itemFormStrings.cantidad) || 0,
      cantidadCajas: itemFormStrings.cantidadCajas ? parseInt(itemFormStrings.cantidadCajas) : undefined,
      precioOriginal: parseFloat(itemFormStrings.precioOriginal) || 0,
    };
  }

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
      // Crear la oferta
      const nuevaOferta = await ofertasImportadoraApi.createFromOfertaCliente(fromOfertaCliente);
      
      // Si hay un total CIF diferente deseado, ajustar los precios
      const totalCifDeseado = parseFloat(totalDeseado);
      if (totalCifDeseado > 0 && totalCifDeseado !== cifTotal) {
        await ofertasImportadoraApi.adjustPrices(nuevaOferta.id, totalCifDeseado);
        toast.success(`Oferta creada con CIF ajustado a $${totalCifDeseado.toLocaleString()}`);
      } else {
        toast.success("Oferta a importadora creada");
      }
      
      setDialogOpen(false);
      setTotalDeseado("");
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
      const itemData = getItemFormAsNumbers();
      const updated = await ofertasImportadoraApi.addItem(selectedOferta.id, itemData);
      setSelectedOferta(updated);
      toast.success("Producto agregado");
      setItemDialogOpen(false);
      resetItemForm();
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

  // Abrir diálogo de edición de item
  function openEditItemDialog(item: OfertaImportadora["items"][0]): void {
    setEditingItemId(item.id);
    setEditItemFormStrings({
      cantidad: item.cantidad?.toString() || "",
      cantidadCajas: item.cantidadCajas?.toString() || "",
      cantidadSacos: item.cantidadSacos?.toString() || "",
      pesoXSaco: item.pesoXSaco?.toString() || "",
      precioXSaco: item.precioXSaco?.toString() || "",
      pesoXCaja: item.pesoXCaja?.toString() || "",
      precioXCaja: item.precioXCaja?.toString() || "",
      precioOriginal: item.precioOriginal?.toString() || "",
    });
    setEditItemDialogOpen(true);
  }

  // Guardar cambios de item
  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      const itemData = {
        cantidad: parseFloat(editItemFormStrings.cantidad) || 0,
        cantidadCajas: editItemFormStrings.cantidadCajas ? parseInt(editItemFormStrings.cantidadCajas) : undefined,
        cantidadSacos: editItemFormStrings.cantidadSacos ? parseInt(editItemFormStrings.cantidadSacos) : undefined,
        pesoXSaco: editItemFormStrings.pesoXSaco ? parseFloat(editItemFormStrings.pesoXSaco) : undefined,
        precioXSaco: editItemFormStrings.precioXSaco ? parseFloat(editItemFormStrings.precioXSaco) : undefined,
        pesoXCaja: editItemFormStrings.pesoXCaja ? parseFloat(editItemFormStrings.pesoXCaja) : undefined,
        precioXCaja: editItemFormStrings.precioXCaja ? parseFloat(editItemFormStrings.precioXCaja) : undefined,
        precioOriginal: parseFloat(editItemFormStrings.precioOriginal) || 0,
      };

      const updated = await ofertasImportadoraApi.updateItem(selectedOferta.id, editingItemId, itemData);
      setSelectedOferta(updated);
      toast.success("Producto actualizado");
      setEditItemDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    }
  }

  // Guardar todos los cambios de la oferta
  async function handleSaveAllChanges(): Promise<void> {
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

  async function handleAdjustPrices(): Promise<void> {
    if (!selectedOferta) return;
    
    const total = parseFloat(totalDeseado);
    if (!total || total <= 0) {
      toast.error("Ingresa un total válido mayor a 0");
      return;
    }

    try {
      // Primero guardar los cambios de flete/seguro
      await ofertasImportadoraApi.update(selectedOferta.id, {
        flete: selectedOferta.flete,
        seguro: selectedOferta.seguro,
        tieneSeguro: selectedOferta.tieneSeguro,
        puertoEmbarque: selectedOferta.puertoEmbarque,
        origen: selectedOferta.origen,
        moneda: selectedOferta.moneda,
        terminosPago: selectedOferta.terminosPago,
        incluyeFirmaCliente: selectedOferta.incluyeFirmaCliente,
      });
      
      // Luego ajustar los precios al total deseado
      const updated = await ofertasImportadoraApi.adjustPrices(selectedOferta.id, total);
      toast.success("Precios ajustados a $" + total.toLocaleString());
      setSelectedOferta(updated);
      setTotalDeseado("");
      loadData();
    } catch (error) {
      toast.error("Error al ajustar precios");
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
  // CIF Calculado = Subtotal productos + Flete + Seguro
  const subtotalProductos = selectedOfertaCliente?.items?.reduce((acc, item) => acc + item.subtotal, 0) || selectedOfertaCliente?.total || 0;
  const cifTotal = subtotalProductos + fromOfertaCliente.flete + seguroFinal;

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

                {/* Costos y Total CIF */}
                {selectedOfertaCliente && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <h4 className="font-medium text-blue-800">Costos de Envío y Total CIF</h4>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {/* Columna izquierda: Flete y Seguro */}
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm">Flete ($)</Label>
                          <Input
                            inputMode="decimal"
                            className="mt-1"
                            placeholder="0.00"
                            value={fromOfertaCliente.flete || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || val === "-") {
                                setFromOfertaCliente((p) => ({ ...p, flete: 0 }));
                              } else if (!isNaN(parseFloat(val))) {
                                setFromOfertaCliente((p) => ({ ...p, flete: parseFloat(val) }));
                              }
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-sm flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fromOfertaCliente.tieneSeguro}
                              onChange={(e) =>
                                setFromOfertaCliente((p) => ({ ...p, tieneSeguro: e.target.checked, seguro: e.target.checked ? 0 : p.seguro }))
                              }
                            />
                            Seguro ($)
                          </Label>
                          {fromOfertaCliente.tieneSeguro && (
                            <Input
                              inputMode="decimal"
                              className="mt-1"
                              placeholder="0.00"
                              value={fromOfertaCliente.seguro || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || val === "-") {
                                  setFromOfertaCliente((p) => ({ ...p, seguro: 0 }));
                                } else if (!isNaN(parseFloat(val))) {
                                  setFromOfertaCliente((p) => ({ ...p, seguro: parseFloat(val) }));
                                }
                              }}
                            />
                          )}
                        </div>
                        
                        {/* Checkbox firma */}
                        <div className="pt-2">
                          <Label className="text-sm flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fromOfertaCliente.incluyeFirmaCliente ?? true}
                              onChange={(e) =>
                                setFromOfertaCliente((p) => ({ ...p, incluyeFirmaCliente: e.target.checked }))
                              }
                            />
                            Incluir firma del cliente
                          </Label>
                        </div>
                      </div>

                      {/* Columna derecha: Resumen y Total CIF Final */}
                      <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-blue-300">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Precio acordado:</span>
                            <span className="font-medium">{formatCurrency(selectedOfertaCliente.total)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">+ Flete:</span>
                            <span>{formatCurrency(fromOfertaCliente.flete)}</span>
                          </div>
                          {fromOfertaCliente.tieneSeguro && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">+ Seguro:</span>
                              <span>{formatCurrency(fromOfertaCliente.seguro || 0)}</span>
                            </div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold text-blue-700">
                            <span>CIF Calculado:</span>
                            <span>{formatCurrency(cifTotal)}</span>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Total CIF Final (opcional)</Label>
                          <p className="text-xs text-slate-500">
                            Si desea un total diferente, ingrese el valor. Los precios se ajustarán.
                          </p>
                          <Input
                            placeholder={cifTotal.toFixed(2)}
                            value={totalDeseado}
                            onChange={(e) => setTotalDeseado(e.target.value)}
                          />
                          {totalDeseado && parseFloat(totalDeseado) > 0 && parseFloat(totalDeseado) !== cifTotal && (
                            <p className="text-xs text-amber-600">
                              Los precios de productos se ajustarán para que CIF = ${parseFloat(totalDeseado).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
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
                <TableHead className="text-right">Productos</TableHead>
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Oferta Importadora: {selectedOferta?.numero}
              {selectedOferta?.ofertaCliente && (
                <Badge variant="outline" className="ml-2">
                  Desde: {selectedOferta.ofertaCliente.numero}
                </Badge>
              )}
            </DialogTitle>
            <Button onClick={handleSaveAllChanges} className="gap-2">
              <Save className="h-4 w-4" />
              Guardar y Cerrar
            </Button>
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

            {/* Costos de Envío y Total CIF */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
              <h4 className="font-medium text-blue-800">Costos de Envío y Total CIF</h4>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Columna izquierda: Flete y Seguro */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Flete ($)</Label>
                    <Input
                      inputMode="decimal"
                      className="mt-1"
                      placeholder="0.00"
                      value={selectedOferta?.flete || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "-") {
                          setSelectedOferta((prev) => prev ? { ...prev, flete: 0 } : null);
                        } else if (!isNaN(parseFloat(val))) {
                          setSelectedOferta((prev) => prev ? { ...prev, flete: parseFloat(val) } : null);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedOferta?.tieneSeguro || false}
                        onChange={(e) =>
                          setSelectedOferta((prev) =>
                            prev ? { ...prev, tieneSeguro: e.target.checked } : null
                          )
                        }
                      />
                      Seguro ($)
                    </Label>
                    {selectedOferta?.tieneSeguro && (
                      <Input
                        inputMode="decimal"
                        className="mt-1"
                        placeholder="0.00"
                        value={selectedOferta?.seguro || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || val === "-") {
                            setSelectedOferta((prev) => prev ? { ...prev, seguro: 0 } : null);
                          } else if (!isNaN(parseFloat(val))) {
                            setSelectedOferta((prev) => prev ? { ...prev, seguro: parseFloat(val) } : null);
                          }
                        }}
                      />
                    )}
                  </div>
                  <div className="pt-2">
                    <Button size="sm" variant="outline" onClick={handleUpdateFleteSeguro}>
                      Guardar y Recalcular
                    </Button>
                  </div>
                </div>

                {/* Columna derecha: Total CIF Final */}
                <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-blue-300">
                  <Label className="font-medium text-blue-800">Total CIF Final (opcional)</Label>
                  <p className="text-xs text-slate-600">
                    Si desea un total diferente, ingrese el valor. Los precios se ajustarán.
                  </p>
                  <div className="flex gap-2 items-center">
                    <span className="font-medium">$</span>
                    <Input
                      className="flex-1"
                      placeholder={selectedOferta?.precioCIF?.toFixed(2) || "0"}
                      value={totalDeseado}
                      onChange={(e) => setTotalDeseado(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleAdjustPrices}
                    disabled={!totalDeseado || parseFloat(totalDeseado) <= 0}
                  >
                    Ajustar Precios al Total
                  </Button>
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
                        value={itemFormStrings.productoId}
                        onValueChange={(value) => {
                          const prod = productos.find((p) => p.id === value);
                          setItemFormStrings((prev) => ({
                            ...prev,
                            productoId: value,
                            precioOriginal: prod?.precioBase?.toString() || "",
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
                          placeholder="Ej: 100"
                          value={itemFormStrings.cantidadCajas}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cantidad (LBS)</Label>
                        <Input
                          placeholder="0"
                          value={itemFormStrings.cantidad}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Precio Original x LB</Label>
                      <Input
                        placeholder="0.00"
                        value={itemFormStrings.precioOriginal}
                        onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioOriginal: e.target.value }))}
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

            {/* Detectar campos opcionales con valores */}
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
                      {hasPrecioXSaco && <TableHead className="text-right">Precio/Saco</TableHead>}
                      {hasPesoXCaja && <TableHead className="text-right">Peso/Caja</TableHead>}
                      {hasPrecioXCaja && <TableHead className="text-right">Precio/Caja</TableHead>}
                      <TableHead className="text-right">P. Original</TableHead>
                      <TableHead className="text-center">→</TableHead>
                      <TableHead className="text-right">P. Ajustado</TableHead>
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
              );
            })()}

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

      {/* Diálogo para editar item */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad (LBS) *</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={editItemFormStrings.cantidad}
                  onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio Original x LB *</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editItemFormStrings.precioOriginal}
                  onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioOriginal: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Campos Opcionales</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cant. Cajas</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={editItemFormStrings.cantidadCajas}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cant. Sacos</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    value={editItemFormStrings.cantidadSacos}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso x Saco</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={editItemFormStrings.pesoXSaco}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio x Saco</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editItemFormStrings.precioXSaco}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioXSaco: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso x Caja</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={editItemFormStrings.pesoXCaja}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio x Caja</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={editItemFormStrings.precioXCaja}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioXCaja: e.target.value }))}
                  />
                </div>
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
