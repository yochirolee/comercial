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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { productosApi, unidadesApi } from "@/lib/api";
import type { Producto, ProductoInput, UnidadMedida } from "@/lib/api";

const emptyProducto: ProductoInput = {
  codigo: "",
  nombre: "",
  descripcion: "",
  precioBase: 0,
  unidadMedidaId: "",
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductoInput>(emptyProducto);
  const [saving, setSaving] = useState(false);

  async function loadData(): Promise<void> {
    try {
      const [productosData, unidadesData] = await Promise.all([
        productosApi.getAll(search),
        unidadesApi.getAll(),
      ]);
      setProductos(productosData);
      setUnidades(unidadesData);
    } catch (error) {
      toast.error("Error al cargar datos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? 0 : parseFloat(value)) : value,
    }));
  }

  async function openNewDialog(): Promise<void> {
    setEditingId(null);
    try {
      // Obtener siguiente código consecutivo
      const { codigo } = await productosApi.getNextCode();
      setFormData({
        ...emptyProducto,
        codigo,
        unidadMedidaId: unidades[0]?.id || "",
      });
    } catch (error) {
      setFormData({
        ...emptyProducto,
        unidadMedidaId: unidades[0]?.id || "",
      });
    }
    setDialogOpen(true);
  }

  function openEditDialog(producto: Producto): void {
    setEditingId(producto.id);
    setFormData({
      codigo: producto.codigo || "",
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      precioBase: producto.precioBase,
      unidadMedidaId: producto.unidadMedidaId,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await productosApi.update(editingId, formData);
        toast.success("Producto actualizado");
      } else {
        await productosApi.create(formData);
        toast.success("Producto creado");
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al guardar producto");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Estás seguro de desactivar este producto?")) return;

    try {
      await productosApi.delete(id);
      toast.success("Producto desactivado");
      loadData();
    } catch (error) {
      toast.error("Error al desactivar producto");
      console.error(error);
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  return (
    <div>
      <Header
        title="Productos"
        description="Gestiona tus productos"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Producto" : "Nuevo Producto"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      name="codigo"
                      value={formData.codigo}
                      onChange={handleChange}
                      placeholder="PROD-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precioBase">Precio Base *</Label>
                    <Input
                      id="precioBase"
                      name="precioBase"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.precioBase || ""}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad de Medida *</Label>
                    <Select
                      value={formData.unidadMedidaId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, unidadMedidaId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((unidad) => (
                          <SelectItem key={unidad.id} value={unidad.id}>
                            {unidad.nombre} ({unidad.abreviatura})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
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
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio Base</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : productos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No hay productos
                  </TableCell>
                </TableRow>
              ) : (
                productos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell className="font-mono text-sm">
                      {producto.codigo || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{producto.nombre}</TableCell>
                    <TableCell>{formatCurrency(producto.precioBase)}</TableCell>
                    <TableCell>{producto.unidadMedida.abreviatura}</TableCell>
                    <TableCell>
                      <Badge variant={producto.activo ? "default" : "secondary"}>
                        {producto.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(producto)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {producto.activo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(producto.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

