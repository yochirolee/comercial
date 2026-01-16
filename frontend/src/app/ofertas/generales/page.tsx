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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileDown, Eye, FileSpreadsheet } from "lucide-react";
import { ofertasGeneralesApi, productosApi, exportApi } from "@/lib/api";
import type { OfertaGeneral, OfertaGeneralInput, Producto, ItemOfertaGeneralInput } from "@/lib/api";

export default function OfertasGeneralesPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaGeneral[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaGeneral | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OfertaGeneralInput>({
    numero: "",
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);

  // Item form
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemOfertaGeneralInput>({
    productoId: "",
    cantidad: 1,
    cantidadCajas: undefined,
    precioUnitario: 0,
  });

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

  function openNewDialog(): void {
    setEditingId(null);
    setFormData({
      numero: `OG-${Date.now().toString().slice(-6)}`,
      observaciones: "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await ofertasGeneralesApi.update(editingId, formData);
        toast.success("Oferta actualizada");
      } else {
        await ofertasGeneralesApi.create(formData);
        toast.success("Oferta creada");
      }
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
    setSelectedOferta(oferta);
    setDetailDialogOpen(true);
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta) return;

    try {
      await ofertasGeneralesApi.addItem(selectedOferta.id, itemForm);
      toast.success("Producto agregado");
      const updated = await ofertasGeneralesApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      setItemDialogOpen(false);
      setItemForm({ productoId: "", cantidad: 1, cantidadCajas: undefined, precioUnitario: 0 });
      loadData();
    } catch (error) {
      toast.error("Error al agregar producto");
      console.error(error);
    }
  }

  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedOferta) return;
    if (!confirm("¿Eliminar este producto de la oferta?")) return;

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

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  return (
    <div>
      <Header
        title="Lista de Precios"
        description="Ofertas generales sin cliente específico"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Lista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Lista" : "Nueva Lista de Precios"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, numero: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Input
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, observaciones: e.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
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
                ofertas.map((oferta) => (
                  <TableRow key={oferta.id}>
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell>{oferta.items.length} productos</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lista de Precios: {selectedOferta?.numero}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">
                Fecha: {selectedOferta && formatDate(selectedOferta.fecha)}
              </p>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Producto
                  </Button>
                </DialogTrigger>
                <DialogContent>
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
                          setItemForm({
                            productoId: value,
                            cantidad: 1,
                            cantidadCajas: undefined,
                            precioUnitario: prod?.precioBase || 0,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} ({p.unidadMedida.abreviatura}) - {formatCurrency(p.precioBase)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cajas/Sacos (opcional, informativo)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="Dejar vacío si no aplica"
                        value={itemForm.cantidadCajas || ''}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            cantidadCajas: e.target.value ? parseInt(e.target.value) : undefined,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cantidad (en {productos.find(p => p.id === itemForm.productoId)?.unidadMedida.abreviatura || 'UM'})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
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
                    <div className="space-y-2">
                      <Label>Precio por {productos.find(p => p.id === itemForm.productoId)?.unidadMedida.abreviatura || 'UM'}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={itemForm.precioUnitario || ""}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            precioUnitario: e.target.value === "" ? 0 : parseFloat(e.target.value),
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
                  <TableHead>UM</TableHead>
                  {selectedOferta?.items.some(i => i.cantidadCajas) && (
                    <TableHead className="text-right">Cajas/Sacos</TableHead>
                  )}
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
                      {selectedOferta?.items.some(i => i.cantidadCajas) && (
                        <TableCell className="text-right">
                          {item.cantidadCajas || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">{item.cantidad}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.precioUnitario)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.cantidad * item.precioUnitario)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

