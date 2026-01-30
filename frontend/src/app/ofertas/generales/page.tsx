"use client";

import { useEffect, useState } from "react";
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
import { ofertasGeneralesApi, productosApi, exportApi } from "@/lib/api";
import type { OfertaGeneral, Producto, ItemOfertaGeneralInput } from "@/lib/api";

interface ItemTemp extends ItemOfertaGeneralInput {
  tempId: string;
  producto?: Producto;
}

export default function OfertasGeneralesPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaGeneral[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaGeneral | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state para nueva oferta
  const [formData, setFormData] = useState({
    numero: "",
    observaciones: "",
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
  });

  // Estado para editar oferta existente
  const [editingOferta, setEditingOferta] = useState(false);
  const [editFormData, setEditFormData] = useState({
    numero: "",
    observaciones: "",
  });

  // Estado para agregar items a oferta existente
  const [showAddItemToExisting, setShowAddItemToExisting] = useState(false);

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
  });

  // Estado para ajustar precios por total deseado
  const [showAdjustPrices, setShowAdjustPrices] = useState(false);
  const [totalDeseado, setTotalDeseado] = useState("");

  async function loadData(): Promise<void> {
    try {
      const [ofertasData, productosData] = await Promise.all([
        ofertasGeneralesApi.getAll(),
        productosApi.getAll(),
      ]);
      setOfertas(ofertasData);
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
      const { numero } = await ofertasGeneralesApi.getNextNumber();
      setFormData({ numero, observaciones: "" });
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
    });
  }

  function handleSelectProduct(productoId: string): void {
    const prod = productos.find((p) => p.id === productoId);
    setItemFormStrings((prev) => ({
      ...prev,
      productoId,
      precioUnitario: prod?.precioBase?.toString() || "",
    }));
  }

  // Convierte el formulario de strings a números para enviar al API
  function getItemFormAsNumbers(): ItemOfertaGeneralInput {
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
      toast.error("Agrega al menos un producto a la lista");
      return;
    }
    
    setSaving(true);

    try {
      const items = itemsTemp.map(({ tempId, producto, ...item }) => item);
      
      await ofertasGeneralesApi.create({
        ...formData,
        items,
      });
      toast.success("Lista de precios creada");
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
      await ofertasGeneralesApi.delete(id);
      toast.success("Oferta eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar oferta");
      console.error(error);
    }
  }

  async function openDetailDialog(oferta: OfertaGeneral): Promise<void> {
    const updated = await ofertasGeneralesApi.getById(oferta.id);
    setSelectedOferta(updated);
    setEditFormData({
      numero: updated.numero,
      observaciones: updated.observaciones || "",
    });
    setEditingOferta(false);
    setShowAddItemToExisting(false);
    resetItemForm();
    setDetailDialogOpen(true);
  }

  async function handleUpdateOferta(): Promise<void> {
    if (!selectedOferta) return;
    setSaving(true);
    try {
      await ofertasGeneralesApi.update(selectedOferta.id, editFormData);
      toast.success("Oferta actualizada");
      const updated = await ofertasGeneralesApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      setEditingOferta(false);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar oferta");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItemToExisting(): Promise<void> {
    const itemData = getItemFormAsNumbers();
    if (!selectedOferta || !itemData.productoId || itemData.cantidad <= 0) {
      toast.error("Selecciona un producto y cantidad válida");
      return;
    }

    try {
      await ofertasGeneralesApi.addItem(selectedOferta.id, itemData);
      toast.success("Producto agregado");
      const updated = await ofertasGeneralesApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      resetItemForm();
      setShowAddItemToExisting(false);
      loadData();
    } catch (error) {
      toast.error("Error al agregar producto");
      console.error(error);
    }
  }

  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedOferta || !confirm("¿Eliminar este producto?")) return;

    try {
      await ofertasGeneralesApi.removeItem(selectedOferta.id, itemId);
      toast.success("Producto eliminado");
      const updated = await ofertasGeneralesApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      loadData();
    } catch (error) {
      toast.error("Error al eliminar producto");
      console.error(error);
    }
  }

  function openEditItemDialog(item: OfertaGeneral["items"][0]): void {
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
    });
    setEditItemDialogOpen(true);
  }

  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      // Siempre enviar todos los campos opcionales, incluso si están vacíos (como null)
      const updateData: Partial<ItemOfertaGeneralInput> = {
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
      };
      
      await ofertasGeneralesApi.updateItem(selectedOferta.id, editingItemId, updateData);
      toast.success("Producto actualizado");
      const updated = await ofertasGeneralesApi.getById(selectedOferta.id);
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
      const updated = await ofertasGeneralesApi.adjustPrices(selectedOferta.id, total);
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
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  const totalTemp = itemsTemp.reduce(
    (acc, item) => acc + item.cantidad * item.precioUnitario,
    0
  );

  // Función inline para renderizar el formulario de item (evita re-crear componente)
  const renderItemForm = (onAdd: () => void, onCancel: () => void) => (
    <div className="bg-slate-50 rounded p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        <div className="space-y-0.5">
          <Label className="text-[9px] sm:text-xs">Producto *</Label>
          <Select value={itemFormStrings.productoId} onValueChange={handleSelectProduct}>
            <SelectTrigger className="h-7 sm:h-9 text-[10px] sm:text-sm px-1 sm:px-3">
              <SelectValue placeholder="Sel." />
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
        <div className="space-y-0.5">
          <Label className="text-[9px] sm:text-xs">Cant. *</Label>
          <Input
            placeholder="0"
            value={itemFormStrings.cantidad}
            onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
            className="h-7 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] sm:text-xs">Precio *</Label>
          <Input
            placeholder="0.00"
            value={itemFormStrings.precioUnitario}
            onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioUnitario: e.target.value }))}
            className="h-7 sm:h-9 text-[10px] sm:text-xs px-1 sm:px-2"
          />
        </div>
      </div>

      {/* Campos informativos opcionales */}
      <div className="border-t pt-1">
        <p className="text-[9px] text-slate-500 mb-0.5">Opcionales</p>
        <div className="grid grid-cols-6 gap-0.5 sm:gap-1">
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">Sacos</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.cantidadSacos}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">Peso/S</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.pesoXSaco}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">$/S</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.precioXSaco}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXSaco: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">Cajas</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.cantidadCajas}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">Peso/C</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.pesoXCaja}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[8px] sm:text-[10px]">$/C</Label>
            <Input
              placeholder="-"
              value={itemFormStrings.precioXCaja}
              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioXCaja: e.target.value }))}
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] px-0.5 sm:px-1"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-6 sm:h-7 text-[9px] sm:text-xs px-1.5 sm:px-2">
          <X className="h-3 w-3 sm:hidden" />
          <span className="hidden sm:inline">Cancelar</span>
        </Button>
        <Button type="button" size="sm" onClick={onAdd} className="h-6 sm:h-7 text-[9px] sm:text-xs px-1.5 sm:px-2">
          <Plus className="h-3 w-3" />
          <span className="hidden sm:inline sm:ml-1">Agregar</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <Header
        title="Lista de Precios"
        description="Ofertas generales"
        actions={
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Lista
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No hay ofertas generales
                  </TableCell>
                </TableRow>
              ) : (
                ofertas.map((oferta) => {
                  const productosNombres = oferta.items
                    .map(item => item.producto?.nombre || '')
                    .filter(Boolean)
                    .join(', ');
                  const productosPreview = productosNombres.length > 60 
                    ? productosNombres.substring(0, 60) + '...' 
                    : productosNombres;
                  
                  return (
                  <TableRow key={oferta.id}>
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={productosNombres}>
                        {productosPreview || 'Sin productos'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={oferta.estado === "activa" ? "default" : "secondary"}>
                        {oferta.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailDialog(oferta)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadPdf("ofertas-generales", oferta.id)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportApi.downloadExcel("ofertas-generales", oferta.id)}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(oferta.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog - Todo en un paso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[96vw] sm:w-[90vw] max-w-[900px] max-h-[90vh] overflow-y-auto p-2 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">Nueva Lista de Precios</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
              <div className="space-y-0.5 sm:space-y-1">
                <Label htmlFor="numero" className="text-[10px] sm:text-xs">Número *</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
                  required
                  className="h-7 sm:h-10 text-xs sm:text-sm px-2"
                />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <Label htmlFor="observaciones" className="text-[10px] sm:text-xs">Observ.</Label>
                <Input
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                  className="h-7 sm:h-10 text-xs sm:text-sm px-2"
                />
              </div>
            </div>

            {/* Sección de productos */}
            <div className="border rounded p-1.5 sm:p-4 space-y-1.5 sm:space-y-3">
              <div className="flex justify-between items-center gap-1">
                <h3 className="font-semibold text-[10px] sm:text-base">Productos</h3>
                <Button
                  type="button"
                  size="sm"
                  variant={showAddItem ? "secondary" : "default"}
                  onClick={() => { setShowAddItem(!showAddItem); resetItemForm(); }}
                  className="h-6 px-1.5 text-[10px]"
                >
                  {showAddItem ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  <span className="hidden sm:inline sm:ml-1">{showAddItem ? "Cancelar" : "Agregar"}</span>
                </Button>
              </div>

              {showAddItem && renderItemForm(
                addItemToList, 
                () => { setShowAddItem(false); resetItemForm(); }
              )}

              {/* Lista de items temporales */}
              <div className="overflow-x-auto -mx-1.5 sm:mx-0">
              <Table className="text-[10px] sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-1 sm:px-4">Producto</TableHead>
                    <TableHead className="px-1 sm:px-4 hidden sm:table-cell">UM</TableHead>
                    <TableHead className="px-1 sm:px-4 text-right">Cant.</TableHead>
                    <TableHead className="px-1 sm:px-4 text-right">Precio</TableHead>
                    <TableHead className="px-1 sm:px-4 text-right">Total</TableHead>
                    <TableHead className="w-8 sm:w-12 px-1"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsTemp.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-2 sm:py-4 text-slate-500 text-[10px] sm:text-sm">
                        No hay productos
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsTemp.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell className="px-1 sm:px-4 max-w-[80px] sm:max-w-none truncate">{item.producto?.nombre}</TableCell>
                        <TableCell className="px-1 sm:px-4 hidden sm:table-cell">{item.producto?.unidadMedida.abreviatura}</TableCell>
                        <TableCell className="px-1 sm:px-4 text-right">{item.cantidad}</TableCell>
                        <TableCell className="px-1 sm:px-4 text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="px-1 sm:px-4 text-right font-medium">
                          {formatCurrency(item.cantidad * item.precioUnitario)}
                        </TableCell>
                        <TableCell className="px-1 sm:px-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemFromList(item.tempId)}
                            className="h-6 w-6 sm:h-8 sm:w-8"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>

              {itemsTemp.length > 0 && (
                <div className="flex justify-end px-1 sm:px-0">
                  <div className="text-xs sm:text-lg font-bold">
                    Total: {formatCurrency(totalTemp)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-1.5 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-7 sm:h-9 text-[10px] sm:text-sm px-2 sm:px-4">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || itemsTemp.length === 0} className="h-7 sm:h-9 text-[10px] sm:text-sm px-2 sm:px-4">
                {saving ? "..." : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <span className="truncate">Lista: {selectedOferta?.numero}</span>
              {!editingOferta && (
                <Button variant="ghost" size="icon" onClick={() => setEditingOferta(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Información básica - editable */}
            {editingOferta ? (
              <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={editFormData.numero}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, numero: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Input
                      value={editFormData.observaciones}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingOferta(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleUpdateOferta} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-slate-500">Fecha:</span>{" "}
                  {selectedOferta && formatDate(selectedOferta.fecha)}
                </div>
                {selectedOferta?.observaciones && (
                  <div>
                    <span className="text-slate-500">Observaciones:</span>{" "}
                    {selectedOferta.observaciones}
                  </div>
                )}
              </div>
            )}

            {/* Sección de productos */}
            <div className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base">Productos</h3>
                <Button
                  size="sm"
                  variant={showAddItemToExisting ? "secondary" : "default"}
                  onClick={() => { setShowAddItemToExisting(!showAddItemToExisting); resetItemForm(); }}
                  className="w-full sm:w-auto"
                >
                  {showAddItemToExisting ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {showAddItemToExisting ? "Cancelar" : "Agregar"}
                </Button>
              </div>

              {showAddItemToExisting && renderItemForm(
                handleAddItemToExisting, 
                () => { setShowAddItemToExisting(false); resetItemForm(); }
              )}

              <div className="overflow-x-auto -mx-4 px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>UM</TableHead>
                    <TableHead className="text-right">Sacos</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOferta?.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-slate-500">
                        No hay productos
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedOferta?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.producto.nombre}</TableCell>
                        <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                        <TableCell className="text-right">
                          {item.cantidadSacos || item.cantidadCajas || "-"}
                        </TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.cantidad * item.precioUnitario)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditItemDialog(item)}
                            >
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.id)}
                            >
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

              {selectedOferta && selectedOferta.items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold">
                      Total Actual: {formatCurrency(
                        selectedOferta.items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0)
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={showAdjustPrices ? "secondary" : "outline"}
                      onClick={() => setShowAdjustPrices(!showAdjustPrices)}
                    >
                      {showAdjustPrices ? "Cancelar" : "Ajustar a Total"}
                    </Button>
                  </div>

                  {showAdjustPrices && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-amber-800">
                        Ingresa el total deseado y los precios de los productos se ajustarán proporcionalmente.
                      </p>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-sm">Total Deseado ($)</Label>
                          <Input
                            placeholder="Ej: 5000"
                            value={totalDeseado}
                            onChange={(e) => setTotalDeseado(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleAdjustPrices}>
                          Aplicar Ajuste
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botones de exportación */}
            <div className="flex justify-center gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => selectedOferta && exportApi.downloadPdf("ofertas-generales", selectedOferta.id)}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => selectedOferta && exportApi.downloadExcel("ofertas-generales", selectedOferta.id)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Descargar Excel
              </Button>
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
                <Label>Precio Unitario *</Label>
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
