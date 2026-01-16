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
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet } from "lucide-react";
import { ofertasClienteApi, clientesApi, productosApi, exportApi } from "@/lib/api";
import type { OfertaCliente, OfertaClienteInput, Cliente, Producto, ItemOfertaClienteInput } from "@/lib/api";

export default function OfertasClientePage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaCliente | null>(null);
  const [formData, setFormData] = useState<OfertaClienteInput>({
    numero: "",
    clienteId: "",
    observaciones: "",
    puertoEmbarque: "NEW ORLEANS, LA",
    origen: "ESTADOS UNIDOS",
    moneda: "USD",
    terminosPago: "PAGO 100% ANTES DEL EMBARQUE",
    incluyeFirmaCliente: false,
  });
  const [saving, setSaving] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemOfertaClienteInput>({
    productoId: "",
    cantidad: 1,
    cantidadCajas: undefined,
    precioUnitario: 0,
  });

  async function loadData(): Promise<void> {
    try {
      const [ofertasData, clientesData, productosData] = await Promise.all([
        ofertasClienteApi.getAll(),
        clientesApi.getAll(),
        productosApi.getAll(),
      ]);
      setOfertas(ofertasData);
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
      // Obtener el siguiente número consecutivo
      const { numero } = await ofertasClienteApi.getNextNumber();
      setFormData({
        numero,
        clienteId: clientes[0]?.id || "",
        observaciones: "",
        puertoEmbarque: "NEW ORLEANS, LA",
        origen: "ESTADOS UNIDOS",
        moneda: "USD",
        terminosPago: "PAGO 100% ANTES DEL EMBARQUE",
        incluyeFirmaCliente: false,
      });
      setDialogOpen(true);
    } catch (error) {
      toast.error("Error al obtener número de oferta");
      console.error(error);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      await ofertasClienteApi.create(formData);
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

  async function openDetailDialog(oferta: OfertaCliente): Promise<void> {
    setSelectedOferta(oferta);
    setDetailDialogOpen(true);
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta) return;

    try {
      await ofertasClienteApi.addItem(selectedOferta.id, itemForm);
      toast.success("Producto agregado");
      const updated = await ofertasClienteApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      setItemDialogOpen(false);
      setItemForm({ productoId: "", cantidad: 1, precioUnitario: 0 });
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

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("es-ES");
  }

  const estadoColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pendiente: "outline",
    aceptada: "default",
    rechazada: "destructive",
    vencida: "secondary",
  };

  return (
    <div>
      <Header
        title="Ofertas a Clientes"
        description="Ofertas con precios específicos para cada cliente"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Oferta
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva Oferta a Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Número de Oferta *</Label>
                  <Input
                    value={formData.numero}
                    onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                    placeholder="Ej: Z26001"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Formato: Z26XXX (puedes modificarlo si necesitas empezar desde otro número)</p>
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(value) => setFormData((p) => ({ ...p, clienteId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente" />
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
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Input
                    value={formData.observaciones}
                    onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
                  />
                </div>

                {/* Sección de Términos y Condiciones */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Términos y Condiciones</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Puerto de Embarque</Label>
                      <Input
                        value={formData.puertoEmbarque || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, puertoEmbarque: e.target.value }))}
                        placeholder="NEW ORLEANS, LA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Origen</Label>
                      <Input
                        value={formData.origen || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, origen: e.target.value }))}
                        placeholder="ESTADOS UNIDOS"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Moneda</Label>
                      <Input
                        value={formData.moneda || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, moneda: e.target.value }))}
                        placeholder="USD"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Términos de Pago</Label>
                      <Input
                        value={formData.terminosPago || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, terminosPago: e.target.value }))}
                        placeholder="PAGO 100% ANTES DEL EMBARQUE"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="incluyeFirmaCliente"
                      checked={formData.incluyeFirmaCliente || false}
                      onChange={(e) => setFormData((p) => ({ ...p, incluyeFirmaCliente: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="incluyeFirmaCliente" className="cursor-pointer">
                      Incluir firma del cliente en la oferta
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando..." : "Crear Oferta"}
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Oferta: {selectedOferta?.numero}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Cliente:</span>{" "}
                <strong>{selectedOferta?.cliente.nombre} {selectedOferta?.cliente.apellidos}</strong>
              </div>
              <div>
                <span className="text-slate-500">Fecha:</span>{" "}
                {selectedOferta && formatDate(selectedOferta.fecha)}
              </div>
            </div>

            <div className="flex justify-end">
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
                            precioUnitario: prod?.precioBase || 0,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
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
                          min="0.01"
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
                      <Label>Precio x LB</Label>
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
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedOferta?.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

