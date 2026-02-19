"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { productosApi, unidadesApi, exportApi } from "@/lib/api";
import type { Producto, ProductoInput, UnidadMedida } from "@/lib/api";

const emptyProducto: ProductoInput = {
  codigo: "",
  nombre: "",
  descripcion: "",
  precioBase: 0,
  unidadMedidaId: "",
  codigoArancelario: "",
  cantidad: null,
  cantidadCajas: null,
  cantidadSacos: null,
  pesoNeto: null,
  pesoBruto: null,
  pesoXSaco: null,
  precioXSaco: null,
  pesoXCaja: null,
  precioXCaja: null,
  usoPrevisto: null,
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductoInput>(emptyProducto);
  const [precioString, setPrecioString] = useState(""); // Para permitir escribir decimales como "0.69"
  const [saving, setSaving] = useState(false);
  
  // Estados para campos informativos (como strings para evitar pérdida de foco)
  const [infoFields, setInfoFields] = useState({
    cantidad: "",
    cantidadCajas: "",
    cantidadSacos: "",
    pesoNeto: "",
    pesoBruto: "",
    pesoXSaco: "",
    precioXSaco: "",
    pesoXCaja: "",
    precioXCaja: "",
  });

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
    setPrecioString("");
    setInfoFields({
      cantidad: "",
      cantidadCajas: "",
      cantidadSacos: "",
      pesoNeto: "",
      pesoBruto: "",
      pesoXSaco: "",
      precioXSaco: "",
      pesoXCaja: "",
      precioXCaja: "",
    });
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
      codigoArancelario: producto.codigoArancelario || "",
      cantidad: producto.cantidad ?? null,
      cantidadCajas: producto.cantidadCajas ?? null,
      cantidadSacos: producto.cantidadSacos ?? null,
      pesoNeto: producto.pesoNeto ?? null,
      pesoBruto: producto.pesoBruto ?? null,
      pesoXSaco: producto.pesoXSaco ?? null,
      precioXSaco: producto.precioXSaco ?? null,
      pesoXCaja: producto.pesoXCaja ?? null,
      precioXCaja: producto.precioXCaja ?? null,
      usoPrevisto: producto.usoPrevisto ?? null,
    });
    setPrecioString(producto.precioBase.toString());
    setInfoFields({
      cantidad: producto.cantidad?.toString() || "",
      cantidadCajas: producto.cantidadCajas?.toString() || "",
      cantidadSacos: producto.cantidadSacos?.toString() || "",
      pesoNeto: producto.pesoNeto?.toString() || "",
      pesoBruto: producto.pesoBruto?.toString() || "",
      pesoXSaco: producto.pesoXSaco?.toString() || "",
      precioXSaco: producto.precioXSaco?.toString() || "",
      pesoXCaja: producto.pesoXCaja?.toString() || "",
      precioXCaja: producto.precioXCaja?.toString() || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    // Convertir precio string a número y campos informativos
    const dataToSend: ProductoInput = {
      codigo: formData.codigo,
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      precioBase: parseFloat(precioString) || 0,
      unidadMedidaId: formData.unidadMedidaId,
      codigoArancelario: formData.codigoArancelario,
      cantidad: infoFields.cantidad && infoFields.cantidad.trim() !== "" 
        ? parseFloat(infoFields.cantidad) 
        : null,
      cantidadCajas: infoFields.cantidadCajas && infoFields.cantidadCajas.trim() !== "" 
        ? parseFloat(infoFields.cantidadCajas) 
        : null,
      cantidadSacos: infoFields.cantidadSacos && infoFields.cantidadSacos.trim() !== "" 
        ? parseFloat(infoFields.cantidadSacos) 
        : null,
      pesoNeto: infoFields.pesoNeto && infoFields.pesoNeto.trim() !== "" 
        ? parseFloat(infoFields.pesoNeto) 
        : null,
      pesoBruto: infoFields.pesoBruto && infoFields.pesoBruto.trim() !== "" 
        ? parseFloat(infoFields.pesoBruto) 
        : null,
      pesoXSaco: infoFields.pesoXSaco && infoFields.pesoXSaco.trim() !== "" 
        ? parseFloat(infoFields.pesoXSaco) 
        : null,
      precioXSaco: infoFields.precioXSaco && infoFields.precioXSaco.trim() !== "" 
        ? parseFloat(infoFields.precioXSaco) 
        : null,
      pesoXCaja: infoFields.pesoXCaja && infoFields.pesoXCaja.trim() !== "" 
        ? parseFloat(infoFields.pesoXCaja) 
        : null,
      precioXCaja: infoFields.precioXCaja && infoFields.precioXCaja.trim() !== "" 
        ? parseFloat(infoFields.precioXCaja) 
        : null,
      usoPrevisto: formData.usoPrevisto && formData.usoPrevisto.trim() !== "" 
        ? formData.usoPrevisto 
        : null,
    };

    try {
      if (editingId) {
        await productosApi.update(editingId, dataToSend);
        toast.success("Producto actualizado");
      } else {
        await productosApi.create(dataToSend);
        toast.success("Producto creado");
      }
      setDialogOpen(false);
      setPrecioString("");
      setInfoFields({
        cantidad: "",
        cantidadCajas: "",
        cantidadSacos: "",
        pesoNeto: "",
        pesoBruto: "",
        pesoXSaco: "",
        precioXSaco: "",
        pesoXCaja: "",
        precioXCaja: "",
      });
      loadData();
    } catch (error) {
      toast.error("Error al guardar producto");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Estás seguro de eliminar este producto?\n\nSi tiene ofertas asociadas, solo se desactivará.")) return;

    try {
      await productosApi.delete(id);
      toast.success("Producto eliminado");
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

  return (
    <div>
      <Header
        title="Productos"
        description="Gestiona tus productos"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await exportApi.exportAllProductos(search);
                  toast.success("Productos exportados correctamente");
                } catch (error) {
                  toast.error("Error al exportar productos");
                  console.error(error);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Producto" : "Nuevo Producto"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="usoPrevisto">Uso Previsto</Label>
                    <Textarea
                      id="usoPrevisto"
                      name="usoPrevisto"
                      value={formData.usoPrevisto || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, usoPrevisto: e.target.value || null }))}
                      rows={4}
                      placeholder="Descripción del uso previsto del producto..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precioBase">Precio Base *</Label>
                    <Input
                      id="precioBase"
                      name="precioBase"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={precioString}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setPrecioString(val);
                        }
                      }}
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
                  <div className="space-y-2">
                    <Label htmlFor="codigoArancelario">Código Arancelario</Label>
                    <Input
                      id="codigoArancelario"
                      name="codigoArancelario"
                      value={formData.codigoArancelario || ""}
                      onChange={handleChange}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                
                {/* Campos informativos para precarga en ofertas */}
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Campos Informativos (para precarga en ofertas)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.cantidad}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, cantidad: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cant. Cajas</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.cantidadCajas}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, cantidadCajas: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cant. Sacos</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.cantidadSacos}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, cantidadSacos: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso Neto</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.pesoNeto}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, pesoNeto: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso Bruto</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.pesoBruto}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, pesoBruto: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso x Saco</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.pesoXSaco}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, pesoXSaco: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio x Saco</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.precioXSaco}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, precioXSaco: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso x Caja</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.pesoXCaja}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, pesoXCaja: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio x Caja</Label>
                      <Input
                        placeholder="-"
                        value={infoFields.precioXCaja}
                        onChange={(e) => setInfoFields((prev) => ({ ...prev, precioXCaja: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
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
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Vista móvil: Cards */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando...</div>
          ) : productos.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No hay productos</div>
          ) : (
            productos.map((producto) => (
              <div key={producto.id} className="bg-white rounded-lg border shadow-sm p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{producto.nombre}</p>
                    <p className="text-xs text-slate-500 font-mono">{producto.codigo || "Sin código"}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(producto)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {producto.activo && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(producto.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-green-600">{formatCurrency(producto.precioBase)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{producto.unidadMedida.abreviatura}</span>
                    <Badge variant={producto.activo ? "default" : "secondary"} className="text-xs">
                      {producto.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vista desktop: Tabla */}
        <div className="hidden sm:block bg-white rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Precio Base</TableHead>
                <TableHead className="hidden md:table-cell">Unidad</TableHead>
                <TableHead className="hidden lg:table-cell">Estado</TableHead>
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
                    <TableCell className="hidden md:table-cell">{producto.unidadMedida.abreviatura}</TableCell>
                    <TableCell className="hidden lg:table-cell">
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

