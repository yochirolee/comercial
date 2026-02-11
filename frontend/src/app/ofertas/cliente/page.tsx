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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, X, Pencil, Save } from "lucide-react";
import { ofertasClienteApi, ofertasGeneralesApi, clientesApi, productosApi, exportApi } from "@/lib/api";
import type { OfertaCliente, OfertaGeneral, Cliente, Producto, ItemOfertaClienteInput } from "@/lib/api";

interface ItemTemp extends ItemOfertaClienteInput {
  tempId: string;
  producto?: Producto;
}

export default function OfertasClientePage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaCliente[]>([]);
  const [ofertasGenerales, setOfertasGenerales] = useState<OfertaGeneral[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaCliente | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state para nueva oferta
  const [formData, setFormData] = useState({
    numero: "",
    fecha: "",
    clienteId: "",
    observaciones: "",
    campoExtra1: "OFERTA VALIDA POR 30 DIAS",
  });
  const [itemsTemp, setItemsTemp] = useState<ItemTemp[]>([]);

  // Form para agregar item temporal - usando strings para evitar pérdida de foco
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemFormStrings, setItemFormStrings] = useState({
    productoId: "",
    cantidad: "",
    precioUnitario: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
    codigoArancelario: "",
  });

  // Estado para agregar items a oferta existente
  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  // Estado para editar item existente
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemFormStrings, setEditItemFormStrings] = useState({
    cantidad: "",
    precioUnitario: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
    codigoArancelario: "",
  });

  // Estado para ajustar precios por total deseado
  const [showAdjustPrices, setShowAdjustPrices] = useState(false);
  const [totalDeseado, setTotalDeseado] = useState("");

  async function loadData(): Promise<void> {
    try {
      const [ofertasData, ofertasGeneralesData, clientesData, productosData] = await Promise.all([
        ofertasClienteApi.getAll(),
        ofertasGeneralesApi.getAll(),
        clientesApi.getAll(),
        productosApi.getAll(),
      ]);
      setOfertas(ofertasData);
      setOfertasGenerales(ofertasGeneralesData);
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

  async function openNewDialog(): Promise<void> {
    try {
      const { numero } = await ofertasClienteApi.getNextNumber();
      setFormData({
        numero,
        fecha: "",
        clienteId: clientes[0]?.id || "",
        observaciones: "",
        campoExtra1: "OFERTA VALIDA POR 30 DIAS",
      });
      setItemsTemp([]);
      setShowAddItem(false);
      setDialogOpen(true);
    } catch (error) {
      toast.error("Error al obtener número de oferta");
      console.error(error);
    }
  }

  function resetItemForm(): void {
    setItemFormStrings({
      productoId: "",
      cantidad: "",
      precioUnitario: "",
      cantidadCajas: "",
      cantidadSacos: "",
      pesoXSaco: "",
      precioXSaco: "",
      pesoXCaja: "",
      precioXCaja: "",
      codigoArancelario: "",
    });
  }

  function handleSelectProduct(productoId: string): void {
    const prod = productos.find((p) => p.id === productoId);
    
    // Buscar si el producto existe en alguna oferta general para precargar campos opcionales
    let itemOfertaGeneral: OfertaGeneral["items"][0] | undefined;
    for (const og of ofertasGenerales) {
      const found = og.items?.find((item) => item.productoId === productoId);
      if (found) {
        itemOfertaGeneral = found;
        break;
      }
    }
    
    setItemFormStrings((prev) => ({
      ...prev,
      productoId,
      precioUnitario: itemOfertaGeneral?.precioUnitario?.toString() || prod?.precioBase?.toString() || "",
      cantidadSacos: itemOfertaGeneral?.cantidadSacos?.toString() || "",
      pesoXSaco: itemOfertaGeneral?.pesoXSaco?.toString() || "",
      precioXSaco: itemOfertaGeneral?.precioXSaco?.toString() || "",
      cantidadCajas: itemOfertaGeneral?.cantidadCajas?.toString() || "",
      pesoXCaja: itemOfertaGeneral?.pesoXCaja?.toString() || "",
      precioXCaja: itemOfertaGeneral?.precioXCaja?.toString() || "",
      codigoArancelario: prod?.codigoArancelario || "",
    }));
  }

  // Convierte el formulario de strings a números para enviar al API
  function getItemFormAsNumbers(): ItemOfertaClienteInput {
    return {
      productoId: itemFormStrings.productoId,
      cantidad: parseFloat(itemFormStrings.cantidad) || 0,
      precioUnitario: parseFloat(itemFormStrings.precioUnitario) || 0,
      cantidadCajas: itemFormStrings.cantidadCajas ? parseInt(itemFormStrings.cantidadCajas) : undefined,
      cantidadSacos: itemFormStrings.cantidadSacos ? parseInt(itemFormStrings.cantidadSacos) : undefined,
      pesoXSaco: itemFormStrings.pesoXSaco ? parseFloat(itemFormStrings.pesoXSaco) : undefined,
      precioXSaco: itemFormStrings.precioXSaco ? parseFloat(itemFormStrings.precioXSaco) : undefined,
      pesoXCaja: itemFormStrings.pesoXCaja ? parseFloat(itemFormStrings.pesoXCaja) : undefined,
      precioXCaja: itemFormStrings.precioXCaja ? parseFloat(itemFormStrings.precioXCaja) : undefined,
      codigoArancelario: itemFormStrings.codigoArancelario?.trim() || undefined,
    };
  }

  function addItemToList(): void {
    const itemData = getItemFormAsNumbers();
    if (!itemData.productoId || itemData.cantidad <= 0) {
      toast.error("Selecciona un producto y cantidad válida");
      return;
    }
    
    const prod = productos.find((p) => p.id === itemData.productoId);
    const newItem: ItemTemp = {
      ...itemData,
      tempId: `temp-${Date.now()}`,
      producto: prod,
    };
    
    setItemsTemp((prev) => [...prev, newItem]);
    resetItemForm();
    setShowAddItem(false);
  }

  function removeItemFromList(tempId: string): void {
    setItemsTemp((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    
    if (itemsTemp.length === 0) {
      toast.error("Agrega al menos un producto a la oferta");
      return;
    }
    
    if (!formData.clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    
    setSaving(true);

    try {
      const items = itemsTemp.map(({ tempId, producto, ...item }) => item);
      
      await ofertasClienteApi.create({
        ...formData,
        items,
      });
      toast.success("Oferta creada");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al guardar oferta");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Estás seguro de eliminar esta oferta?")) return;

    try {
      await ofertasClienteApi.delete(id);
      toast.success("Oferta eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  // Estado para edición de oferta existente
  const [editFormData, setEditFormData] = useState({
    numero: "",
    fecha: "",
    observaciones: "",
    campoExtra1: "",
  });

  async function openDetailDialog(oferta: OfertaCliente): Promise<void> {
    const updated = await ofertasClienteApi.getById(oferta.id);
    setSelectedOferta(updated);
    setEditFormData({
      numero: updated.numero || "",
      fecha: updated.fecha ? updated.fecha.split('T')[0] : "",
      observaciones: updated.observaciones || "",
      campoExtra1: updated.campoExtra1 || "OFERTA VALIDA POR 30 DIAS",
    });
    setDetailDialogOpen(true);
  }

  async function handleUpdateOferta(closeAfter: boolean = false): Promise<void> {
    if (!selectedOferta) return;
    
    try {
      await ofertasClienteApi.update(selectedOferta.id, editFormData);
      toast.success("Oferta actualizada");
      if (closeAfter) {
        setDetailDialogOpen(false);
      } else {
        const updated = await ofertasClienteApi.getById(selectedOferta.id);
        setSelectedOferta(updated);
      }
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    }
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta) return;

    try {
      const itemData = getItemFormAsNumbers();
      await ofertasClienteApi.addItem(selectedOferta.id, itemData);
      toast.success("Producto agregado");
      const updated = await ofertasClienteApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
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
      await ofertasClienteApi.removeItem(selectedOferta.id, itemId);
      toast.success("Producto eliminado");
      const updated = await ofertasClienteApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  function openEditItemDialog(item: OfertaCliente["items"][0]): void {
    setEditingItemId(item.id);
    setEditItemFormStrings({
      cantidad: item.cantidad?.toString() || "",
      precioUnitario: item.precioUnitario?.toString() || "",
      cantidadCajas: item.cantidadCajas?.toString() || "",
      cantidadSacos: item.cantidadSacos?.toString() || "",
      pesoXSaco: item.pesoXSaco?.toString() || "",
      precioXSaco: item.precioXSaco?.toString() || "",
      pesoXCaja: item.pesoXCaja?.toString() || "",
      precioXCaja: item.precioXCaja?.toString() || "",
      codigoArancelario: item.codigoArancelario || "",
    });
    setEditItemDialogOpen(true);
  }

  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      // Siempre enviar todos los campos opcionales, incluso si están vacíos (como null para limpiar)
      const updateData: Partial<ItemOfertaClienteInput> = {
        cantidad: parseFloat(editItemFormStrings.cantidad) || 0,
        precioUnitario: parseFloat(editItemFormStrings.precioUnitario) || 0,
        cantidadCajas: editItemFormStrings.cantidadCajas && editItemFormStrings.cantidadCajas.trim() !== '' 
          ? parseFloat(editItemFormStrings.cantidadCajas) 
          : null,
        cantidadSacos: editItemFormStrings.cantidadSacos && editItemFormStrings.cantidadSacos.trim() !== '' 
          ? parseFloat(editItemFormStrings.cantidadSacos) 
          : null,
        pesoXSaco: editItemFormStrings.pesoXSaco && editItemFormStrings.pesoXSaco.trim() !== '' 
          ? parseFloat(editItemFormStrings.pesoXSaco) 
          : null,
        precioXSaco: editItemFormStrings.precioXSaco && editItemFormStrings.precioXSaco.trim() !== '' 
          ? parseFloat(editItemFormStrings.precioXSaco) 
          : null,
        pesoXCaja: editItemFormStrings.pesoXCaja && editItemFormStrings.pesoXCaja.trim() !== '' 
          ? parseFloat(editItemFormStrings.pesoXCaja) 
          : null,
        precioXCaja: editItemFormStrings.precioXCaja && editItemFormStrings.precioXCaja.trim() !== '' 
          ? parseFloat(editItemFormStrings.precioXCaja) 
          : null,
        codigoArancelario: editItemFormStrings.codigoArancelario && editItemFormStrings.codigoArancelario.trim() !== '' 
          ? editItemFormStrings.codigoArancelario 
          : null,
      };
      
      await ofertasClienteApi.updateItem(selectedOferta.id, editingItemId, updateData);
      toast.success("Producto actualizado");
      const updated = await ofertasClienteApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      setEditItemDialogOpen(false);
      setEditingItemId(null);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar");
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
      const updated = await ofertasClienteApi.adjustPrices(selectedOferta.id, total);
      toast.success("Precios ajustados correctamente");
      setSelectedOferta(updated);
      setShowAdjustPrices(false);
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
    // Usar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de timezone
    // Formato: mm/dd/yyyy
    if (!date) return "";
    const dateOnly = date.split("T")[0];
    const [year, month, day] = dateOnly.split("-");
    return `${month}/${day}/${year}`;
  }

  const estadoColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pendiente: "outline",
    aceptada: "default",
    rechazada: "destructive",
    vencida: "secondary",
  };

  const totalTemp = itemsTemp.reduce(
    (acc, item) => acc + item.cantidad * item.precioUnitario,
    0
  );

  return (
    <div>
      <Header
        title="Ofertas a Clientes"
        description="Ofertas con precios específicos para cada cliente"
        actions={
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Oferta
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No hay ofertas
                  </TableCell>
                </TableRow>
              ) : (
                ofertas.map((oferta) => (
                  <TableRow key={oferta.id}>
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>{oferta.cliente.nombre} {oferta.cliente.apellidos}</TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(oferta.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoColors[oferta.estado]}>{oferta.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(oferta)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadPdf("ofertas-cliente", oferta.id)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadExcel("ofertas-cliente", oferta.id)}
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

      {/* Create Dialog - Todo en un paso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[92vw] sm:w-[90vw] max-w-[900px] max-h-[85vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Nueva Oferta a Cliente</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Número *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                  placeholder="Ej: Z26001"
                  required
                  className="h-9 sm:h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Cliente *</Label>
                <Select
                  value={formData.clienteId}
                  onValueChange={(value) => setFormData((p) => ({ ...p, clienteId: value }))}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} {c.apellidos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Fecha</Label>
                <Input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))}
                  className="h-9 sm:h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Observaciones</Label>
                <Input
                  value={formData.observaciones}
                  onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
                  className="h-9 sm:h-10"
                />
              </div>
            </div>

            {/* Sección de productos */}
            <div className="border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-4">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-semibold text-xs sm:text-base">Productos</h3>
                <Button
                  type="button"
                  size="sm"
                  variant={showAddItem ? "secondary" : "default"}
                  onClick={() => setShowAddItem(!showAddItem)}
                  className="text-xs sm:text-sm"
                >
                  {showAddItem ? <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                  {showAddItem ? "Cancelar" : "Agregar"}
                </Button>
              </div>

              {/* Form para agregar item */}
              {showAddItem && (
                <div className="bg-slate-50 rounded-lg p-2 sm:p-3 space-y-2 sm:space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Producto *</Label>
                      <Select
                        value={itemFormStrings.productoId}
                        onValueChange={handleSelectProduct}
                      >
                        <SelectTrigger className="h-9 sm:h-10 text-sm">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} ({p.unidadMedida.abreviatura})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Cantidad *</Label>
                      <Input
                        placeholder="0"
                        value={itemFormStrings.cantidad}
                        onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                        className="h-9 sm:h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">Precio *</Label>
                      <Input
                        placeholder="0.00"
                        value={itemFormStrings.precioUnitario}
                        onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioUnitario: e.target.value }))}
                        className="h-9 sm:h-10"
                      />
                    </div>
                  </div>

                  {/* Campos informativos opcionales */}
                  <div className="border-t pt-2 sm:pt-3">
                    <p className="text-xs text-slate-500 mb-2">Opcionales</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">Sacos</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.cantidadSacos}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">Peso/S</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.pesoXSaco}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">$/Saco</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.precioXSaco}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXSaco: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">Cajas</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.cantidadCajas}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">Peso/C</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.pesoXCaja}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] sm:text-xs">$/Caja</Label>
                        <Input
                          placeholder="-"
                          value={itemFormStrings.precioXCaja}
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXCaja: e.target.value }))}
                          className="h-8 text-xs px-2"
                        />
                      </div>
                      <div className="space-y-0.5 col-span-2">
                        <Label className="text-[10px] sm:text-xs">Cód. Arancelario</Label>
                        <Input
                          placeholder="Ej: M1500CIULB"
                          value={itemFormStrings.codigoArancelario}
                          className="h-8 text-xs px-2"
                          onChange={(e) => setItemFormStrings((prev) => ({ ...prev, codigoArancelario: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={addItemToList} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de items temporales */}
              <div className="overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>UM</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsTemp.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-slate-500">
                        No hay productos agregados
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsTemp.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell>{item.producto?.nombre}</TableCell>
                        <TableCell>{item.producto?.unidadMedida.abreviatura}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.cantidad * item.precioUnitario)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemFromList(item.tempId)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>

              {itemsTemp.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-base sm:text-lg font-bold">
                    Total: {formatCurrency(totalTemp)}
                  </div>
                </div>
              )}
            </div>

            {/* Campo de validez */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs sm:text-sm">Texto de Validez</Label>
              <Input
                value={formData.campoExtra1}
                onChange={(e) => setFormData((p) => ({ ...p, campoExtra1: e.target.value }))}
                placeholder="OFERTA VALIDA POR 30 DIAS"
                className="h-8 sm:h-9 text-sm"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || itemsTemp.length === 0} className="w-full sm:w-auto">
                {saving ? "Guardando..." : "Crear Oferta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base sm:text-lg">Editar Oferta: {selectedOferta?.numero}</DialogTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadPdf("ofertas-cliente", selectedOferta.id)}
                className="flex-1 sm:flex-none"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadExcel("ofertas-cliente", selectedOferta.id)}
                className="flex-1 sm:flex-none"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button onClick={() => handleUpdateOferta(true)} size="sm" className="gap-2 w-full sm:w-auto">
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3 sm:space-y-4 md:space-y-6 pr-2">
              {/* Información básica editable */}
              <div className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3 md:space-y-4">
                <h3 className="font-semibold text-sm sm:text-base">Información de la Oferta</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Número de Oferta</Label>
                    <Input
                      value={editFormData.numero}
                      onChange={(e) => setEditFormData((p) => ({ ...p, numero: e.target.value }))}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Cliente</Label>
                    <Input
                      value={`${selectedOferta?.cliente.nombre || ""} ${selectedOferta?.cliente.apellidos || ""}`}
                      disabled
                      className="bg-slate-100 h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Fecha</Label>
                    <Input
                      type="date"
                      value={editFormData.fecha}
                      onChange={(e) => setEditFormData((p) => ({ ...p, fecha: e.target.value }))}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Observaciones</Label>
                    <Input
                      value={editFormData.observaciones}
                      onChange={(e) => setEditFormData((p) => ({ ...p, observaciones: e.target.value }))}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Campo de validez */}
              <div className="border rounded-lg p-3 sm:p-4 space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Texto de Validez</Label>
                <Input
                  value={editFormData.campoExtra1}
                  onChange={(e) => setEditFormData((p) => ({ ...p, campoExtra1: e.target.value }))}
                  placeholder="OFERTA VALIDA POR 30 DIAS"
                  className="h-9 sm:h-10 text-sm"
                />
              </div>

              {/* Productos */}
              <div className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm sm:text-base">Productos</h3>
                  <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                    <Button size="sm" onClick={() => setItemDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Producto
                    </Button>
                    <DialogContent className="w-full max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Agregar Producto</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddItem} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Producto *</Label>
                          <Select
                            value={itemFormStrings.productoId}
                            onValueChange={handleSelectProduct}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {productos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre} ({p.unidadMedida.abreviatura})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2">
                            <Label>Cantidad *</Label>
                            <Input
                              placeholder="0"
                              value={itemFormStrings.cantidad}
                              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Precio por UM *</Label>
                            <Input
                              placeholder="0.00"
                              value={itemFormStrings.precioUnitario}
                              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioUnitario: e.target.value }))}
                            />
                          </div>
                        </div>
                        {/* Campos informativos opcionales */}
                        <div className="border-t pt-4">
                          <p className="text-sm text-slate-500 mb-3">Campos informativos (opcionales)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Cant. Sacos</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.cantidadSacos}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Peso x Saco</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.pesoXSaco}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Precio x Saco</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.precioXSaco}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXSaco: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cant. Cajas</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.cantidadCajas}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Peso x Caja</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.pesoXCaja}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Precio x Caja</Label>
                              <Input
                                placeholder="-"
                                value={itemFormStrings.precioXCaja}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXCaja: e.target.value }))}
                              />
                            </div>
                          </div>
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

                <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">P. Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOferta?.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-slate-500">
                        No hay productos
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedOferta?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.producto.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditItemDialog(item)}>
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
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

              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="text-base sm:text-lg font-bold">
                    Total Actual: {formatCurrency(selectedOferta?.total || 0)}
                  </div>
                  <Button
                    size="sm"
                    variant={showAdjustPrices ? "secondary" : "outline"}
                    onClick={() => setShowAdjustPrices(!showAdjustPrices)}
                    className="w-full sm:w-auto"
                  >
                    {showAdjustPrices ? "Cancelar" : "Ajustar a Total"}
                  </Button>
                </div>

                {showAdjustPrices && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm text-amber-800">
                      Ingresa el total deseado y los precios de los productos se ajustarán proporcionalmente.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end">
                      <div className="flex-1 space-y-1 w-full">
                        <Label className="text-xs sm:text-sm">Total Deseado ($)</Label>
                        <Input
                          placeholder="Ej: 5000"
                          value={totalDeseado}
                          onChange={(e) => setTotalDeseado(e.target.value)}
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>
                      <Button onClick={handleAdjustPrices} className="w-full sm:w-auto">
                        Aplicar Ajuste
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input
                  placeholder="0"
                  value={editItemFormStrings.cantidad}
                  onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio por UM *</Label>
                <Input
                  placeholder="0.00"
                  value={editItemFormStrings.precioUnitario}
                  onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioUnitario: e.target.value }))}
                />
              </div>
            </div>
            {/* Campos informativos opcionales */}
            <div className="border-t pt-4">
              <p className="text-sm text-slate-500 mb-3">Campos informativos (opcionales)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cant. Sacos</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.cantidadSacos}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso x Saco</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.pesoXSaco}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio x Saco</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.precioXSaco}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioXSaco: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cant. Cajas</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.cantidadCajas}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso x Caja</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.pesoXCaja}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio x Caja</Label>
                  <Input
                    placeholder="-"
                    value={editItemFormStrings.precioXCaja}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, precioXCaja: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label className="text-xs">Código Arancelario</Label>
                <Input
                  placeholder="Ej: M1500CIULB"
                  value={editItemFormStrings.codigoArancelario}
                  onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, codigoArancelario: e.target.value }))}
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
