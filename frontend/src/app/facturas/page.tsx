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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, Receipt } from "lucide-react";
import {
  facturasApi,
  clientesApi,
  productosApi,
  ofertasClienteApi,
  ofertasImportadoraApi,
  exportApi,
} from "@/lib/api";
import type {
  Factura,
  FacturaInput,
  Cliente,
  Producto,
  ItemFacturaInput,
  OfertaCliente,
  OfertaImportadora,
} from "@/lib/api";

export default function FacturasPage(): JSX.Element {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [ofertasImportadora, setOfertasImportadora] = useState<OfertaImportadora[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);

  const [createMode, setCreateMode] = useState<"manual" | "fromOferta">("manual");
  const [formData, setFormData] = useState<FacturaInput>({
    numero: "",
    clienteId: "",
    observaciones: "",
  });
  const [fromOfertaData, setFromOfertaData] = useState({
    tipoOferta: "cliente" as "cliente" | "importadora",
    ofertaId: "",
    numeroFactura: "",
  });
  const [saving, setSaving] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFacturaInput>({
    productoId: "",
    cantidad: 1,
    precioUnitario: 0,
  });

  async function loadData(): Promise<void> {
    try {
      const [facturasData, clientesData, productosData, ocData, oiData] = await Promise.all([
        facturasApi.getAll(),
        clientesApi.getAll(),
        productosApi.getAll(),
        ofertasClienteApi.getAll(),
        ofertasImportadoraApi.getAll(),
      ]);
      setFacturas(facturasData);
      setClientes(clientesData);
      setProductos(productosData.filter((p) => p.activo));
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

  function openNewDialog(): void {
    setFormData({
      numero: `FAC-${Date.now().toString().slice(-6)}`,
      clienteId: clientes[0]?.id || "",
      observaciones: "",
    });
    setFromOfertaData({
      tipoOferta: "cliente",
      ofertaId: "",
      numeroFactura: `FAC-${Date.now().toString().slice(-6)}`,
    });
    setCreateMode("manual");
    setDialogOpen(true);
  }

  async function handleSubmitManual(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      await facturasApi.create(formData);
      toast.success("Factura creada");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al crear factura");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitFromOferta(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      await facturasApi.createFromOferta(fromOfertaData);
      toast.success("Factura creada desde oferta");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error("Error al crear factura");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Eliminar esta factura?")) return;

    try {
      await facturasApi.delete(id);
      toast.success("Factura eliminada");
      loadData();
    } catch (error) {
      toast.error("Error");
      console.error(error);
    }
  }

  async function handleUpdateEstado(id: string, estado: string): Promise<void> {
    try {
      await facturasApi.updateEstado(id, estado);
      toast.success("Estado actualizado");
      loadData();
      if (selectedFactura?.id === id) {
        const updated = await facturasApi.getById(id);
        setSelectedFactura(updated);
      }
    } catch (error) {
      toast.error("Error");
      console.error(error);
    }
  }

  async function openDetailDialog(factura: Factura): Promise<void> {
    setSelectedFactura(factura);
    setDetailDialogOpen(true);
  }

  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedFactura) return;

    try {
      await facturasApi.addItem(selectedFactura.id, itemForm);
      toast.success("Producto agregado");
      const updated = await facturasApi.getById(selectedFactura.id);
      setSelectedFactura(updated);
      setItemDialogOpen(false);
      setItemForm({ productoId: "", cantidad: 1, precioUnitario: 0 });
      loadData();
    } catch (error) {
      toast.error("Error");
      console.error(error);
    }
  }

  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedFactura || !confirm("¿Eliminar?")) return;

    try {
      await facturasApi.removeItem(selectedFactura.id, itemId);
      const updated = await facturasApi.getById(selectedFactura.id);
      setSelectedFactura(updated);
      loadData();
    } catch (error) {
      toast.error("Error");
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
    pagada: "default",
    vencida: "destructive",
    cancelada: "secondary",
  };

  function getOfertasForSelect(): Array<{ id: string; label: string }> {
    switch (fromOfertaData.tipoOferta) {
      case "cliente":
        return ofertasCliente.map((o) => ({
          id: o.id,
          label: `${o.numero} - ${o.cliente.nombre} (${formatCurrency(o.total)})`,
        }));
      case "importadora":
        return ofertasImportadora.map((o) => ({
          id: o.id,
          label: `${o.numero} - ${o.cliente.nombre} (${formatCurrency(o.precioCIF)})`,
        }));
      default:
        return [];
    }
  }

  return (
    <div>
      <Header
        title="Facturas"
        description="Gestiona tus facturas"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Factura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Nueva Factura
                </DialogTitle>
              </DialogHeader>

              <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as "manual" | "fromOferta")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                  <TabsTrigger value="fromOferta">Desde Oferta</TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                  <form onSubmit={handleSubmitManual} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Número *</Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cliente *</Label>
                      <Select
                        value={formData.clienteId}
                        onValueChange={(value) => setFormData((p) => ({ ...p, clienteId: value }))}
                      >
                        <SelectTrigger>
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
                    <div className="space-y-2">
                      <Label>Observaciones</Label>
                      <Input
                        value={formData.observaciones}
                        onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Creando..." : "Crear"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="fromOferta">
                  <form onSubmit={handleSubmitFromOferta} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Número de Factura *</Label>
                      <Input
                        value={fromOfertaData.numeroFactura}
                        onChange={(e) =>
                          setFromOfertaData((p) => ({ ...p, numeroFactura: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Oferta</Label>
                      <Select
                        value={fromOfertaData.tipoOferta}
                        onValueChange={(value) =>
                          setFromOfertaData((p) => ({
                            ...p,
                            tipoOferta: value as "cliente" | "importadora",
                            ofertaId: "",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cliente">Oferta a Cliente</SelectItem>
                          <SelectItem value="importadora">Oferta a Importadora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Oferta *</Label>
                      <Select
                        value={fromOfertaData.ofertaId}
                        onValueChange={(value) => setFromOfertaData((p) => ({ ...p, ofertaId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar oferta" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOfertasForSelect().map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saving || !fromOfertaData.ofertaId}>
                        {saving ? "Creando..." : "Crear desde Oferta"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
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
                <TableHead className="w-48">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No hay facturas
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">{factura.numero}</TableCell>
                    <TableCell>{factura.cliente.nombre} {factura.cliente.apellidos}</TableCell>
                    <TableCell>{formatDate(factura.fecha)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(factura.total)}</TableCell>
                    <TableCell>
                      <Select
                        value={factura.estado}
                        onValueChange={(value) => handleUpdateEstado(factura.id, value)}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <Badge variant={estadoColors[factura.estado]}>{factura.estado}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="pagada">Pagada</SelectItem>
                          <SelectItem value="vencida">Vencida</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factura: {selectedFactura?.numero}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Cliente:</span>
                <p className="font-medium">
                  {selectedFactura?.cliente.nombre} {selectedFactura?.cliente.apellidos}
                </p>
                {selectedFactura?.cliente.nit && (
                  <p className="text-slate-500">NIT: {selectedFactura.cliente.nit}</p>
                )}
              </div>
              <div>
                <span className="text-slate-500">Fecha:</span>
                <p>{selectedFactura && formatDate(selectedFactura.fecha)}</p>
              </div>
              <div>
                <span className="text-slate-500">Estado:</span>
                <p>
                  <Badge variant={estadoColors[selectedFactura?.estado || "pendiente"]}>
                    {selectedFactura?.estado}
                  </Badge>
                </p>
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
                          setItemForm((prev) => ({
                            ...prev,
                            productoId: value,
                            precioUnitario: prod?.precioBase || 0,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} ({formatCurrency(p.precioBase)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={itemForm.cantidad}
                          onChange={(e) =>
                            setItemForm((prev) => ({ ...prev, cantidad: parseFloat(e.target.value) || 0 }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Precio Unitario</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={itemForm.precioUnitario}
                          onChange={(e) =>
                            setItemForm((prev) => ({
                              ...prev,
                              precioUnitario: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
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
                {selectedFactura?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.descripcion || item.producto.nombre}</TableCell>
                    <TableCell className="text-right">{item.cantidad}</TableCell>
                    <TableCell>{item.producto.unidadMedida.abreviatura}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span>{formatCurrency(selectedFactura?.subtotal || 0)}</span>
                </div>
                {(selectedFactura?.impuestos || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Impuestos:</span>
                    <span>{formatCurrency(selectedFactura?.impuestos || 0)}</span>
                  </div>
                )}
                {(selectedFactura?.descuento || 0) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(selectedFactura?.descuento || 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(selectedFactura?.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
