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
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, X, Pencil, Save, Download, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { ofertasClienteApi, ofertasGeneralesApi, clientesApi, productosApi, exportApi, unidadesApi } from "@/lib/api";
import type { OfertaCliente, OfertaGeneral, Cliente, Producto, ItemOfertaClienteInput, UnidadMedida } from "@/lib/api";

const PAGE_SIZE = 10;

interface ItemTemp extends ItemOfertaClienteInput {
  tempId: string;
  producto?: Producto;
}

interface ExtraFieldForm {
  id: string;
  label: string;
  value: string;
}

export default function OfertasClientePage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaCliente[]>([]);
  const [ofertasGenerales, setOfertasGenerales] = useState<OfertaGeneral[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaCliente | null>(null);
  const [saving, setSaving] = useState(false);

  // Texto por defecto para bloques de documento (mismo contenido que el PDF/Excel)
  const defaultTerminosTexto =
    [
      "Validez de la Oferta: 15 días.",
      "Puerto Destino: Mariel, Cuba.",
      "Puerto de Embarque: ",
      "Origen: Estados Unidos.",
      "Términos de Entrega: Máximo 15 días posteriores al pago.",
      "Pago: 100% del valor a la firma del contrato.",
      "Moneda: Dólar Americano (USD).",
      "Métodos de Pago: Transferencia bancaria o cheques del banco pagador.",
      "ZAS BY JMC CORP no se hace responsable por retrasos ocasionados por la naviera, puertos u otros factores externos considerados de FUERZA MAYOR que puedan provocar demoras en los embarques. En estos casos, la empresa proveerá evidencias y mantendrá informado al cliente.",
      "El cliente tiene la responsabilidad de devolver el o los contenedores en un plazo máximo de 72 horas después de haber sido extraídos del puerto en destino.",
      "Condición de pago original: PAGO 100% ANTES DEL EMBARQUE",
    ].join("\n");

  const defaultMetodoPagoTexto =
    [
      "Banco: Truist Bank",
      "Titular: ZAS BY JMC CORP",
      "Número de Cuenta: 1100035647757",
      "Número de Ruta (transferencias dentro de USA): 263191387",
      "Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166",
    ].join("\n");

  // Form state para nueva oferta
  const [formData, setFormData] = useState({
    numero: "",
    fecha: "",
    clienteId: "",
    observaciones: "",
    campoExtra1: "OFERTA VALIDA POR 30 DIAS",
    terminosDocumentoTexto: defaultTerminosTexto,
    metodoPagoDocumentoTexto: defaultMetodoPagoTexto,
  });
  const [itemsTemp, setItemsTemp] = useState<ItemTemp[]>([]);

  // Form para agregar item temporal - usando strings para evitar pérdida de foco
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemModoLibre, setItemModoLibre] = useState(false);
  const [editItemModoLibre, setEditItemModoLibre] = useState(false);
  const [itemFormStrings, setItemFormStrings] = useState({
    productoId: "",
    nombreProducto: "",
    codigoProducto: "",
    unidadMedidaId: "",
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
  const [extraFields, setExtraFields] = useState<ExtraFieldForm[]>([]);
  /** Al crear oferta: edición de un ítem temporal antes de guardar la oferta */
  const [editingTempId, setEditingTempId] = useState<string | null>(null);

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
    nombreProducto: "",
    codigoProducto: "",
    unidadMedidaId: "",
  });
  const [editExtraFields, setEditExtraFields] = useState<ExtraFieldForm[]>([]);

  // Estado para ajustar precios por total deseado
  const [showAdjustPrices, setShowAdjustPrices] = useState(false);
  const [totalDeseado, setTotalDeseado] = useState("");
  
  // Estado para diálogo de exportación con rango de fechas
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const searchLower = search.trim().toLowerCase();
  const filteredOfertas = searchLower
    ? ofertas.filter(
        (o) =>
          (o.numero ?? "").toLowerCase().includes(searchLower) ||
          `${o.cliente?.nombre ?? ""} ${o.cliente?.apellidos ?? ""} ${o.cliente?.nombreCompania ?? ""}`.trim().toLowerCase().includes(searchLower) ||
          (o.estado ?? "").toLowerCase().includes(searchLower) ||
          o.items?.some((it) => (it.producto?.nombre ?? "").toLowerCase().includes(searchLower))
      )
    : ofertas;

  // Ordenar por número desc (Z26024, Z26023, Z26022-2, etc.)
  const sortedOfertas = [...filteredOfertas].sort((a, b) =>
    (b.numero ?? "").localeCompare(a.numero ?? "")
  );

  const totalPages = Math.max(1, Math.ceil(sortedOfertas.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedOfertas = sortedOfertas.slice(start, start + PAGE_SIZE);

  async function loadData(): Promise<void> {
    try {
      setCurrentPage(1);
      const [ofertasData, ofertasGeneralesData, clientesData, productosData, unidadesData] = await Promise.all([
        ofertasClienteApi.getAll(),
        ofertasGeneralesApi.getAll(),
        clientesApi.getAll(),
        productosApi.getAll(),
        unidadesApi.getAll(),
      ]);
      setOfertas(ofertasData);
      setOfertasGenerales(ofertasGeneralesData);
      setClientes(clientesData);
      setProductos(productosData.filter((p) => p.activo));
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
        terminosDocumentoTexto: defaultTerminosTexto,
        metodoPagoDocumentoTexto: defaultMetodoPagoTexto,
      });
      setItemsTemp([]);
      setShowAddItem(false);
      resetItemForm();
      setDialogOpen(true);
    } catch (error) {
      toast.error("Error al obtener número de oferta");
      console.error(error);
    }
  }

  function resetItemForm(): void {
    setEditingTempId(null);
    setItemModoLibre(false);
    setExtraFields([]);
    setItemFormStrings({
      productoId: "",
      nombreProducto: "",
      codigoProducto: "",
      unidadMedidaId: "",
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

  function umAbbrForTempItem(item: ItemTemp): string {
    if (item.producto?.unidadMedida?.abreviatura) return item.producto.unidadMedida.abreviatura;
    if (item.unidadMedidaId) {
      const u = unidades.find((x) => x.id === item.unidadMedidaId);
      return u?.abreviatura ?? "—";
    }
    return "—";
  }

  function openEditTempItem(item: ItemTemp): void {
    setEditingTempId(item.tempId);
    setItemModoLibre(!item.productoId);
    setItemFormStrings({
      productoId: item.productoId || "",
      nombreProducto: item.nombreProducto || "",
      codigoProducto: item.codigoProducto || "",
      unidadMedidaId: item.unidadMedidaId || "",
      cantidad: item.cantidad != null ? String(item.cantidad) : "",
      precioUnitario: item.precioUnitario != null ? String(item.precioUnitario) : "",
      cantidadCajas: item.cantidadCajas != null ? String(item.cantidadCajas) : "",
      cantidadSacos: item.cantidadSacos != null ? String(item.cantidadSacos) : "",
      pesoXSaco: item.pesoXSaco != null ? String(item.pesoXSaco) : "",
      precioXSaco: item.precioXSaco != null ? String(item.precioXSaco) : "",
      pesoXCaja: item.pesoXCaja != null ? String(item.pesoXCaja) : "",
      precioXCaja: item.precioXCaja != null ? String(item.precioXCaja) : "",
      codigoArancelario: item.codigoArancelario || "",
    });
    setExtraFields(
      (item.camposOpcionales || []).map((c, idx) => ({
        id: `extra-edit-${item.tempId}-${idx}`,
        label: c.label,
        value: (c.value ?? "").toString(),
      })),
    );
    setShowAddItem(true);
  }

  function handleSelectProduct(productoId: string): void {
    const prod = productos.find((p) => p.id === productoId);
    
    // Siempre cargar los valores del producto seleccionado
    // Prioridad: Producto (valores por defecto del catálogo)
    // NO usar Oferta General para evitar confusión con valores de otras ofertas
    setItemFormStrings({
      productoId,
      nombreProducto: "",
      codigoProducto: "",
      unidadMedidaId: "",
      cantidad: prod?.cantidad?.toString() || "",
      precioUnitario: prod?.precioBase?.toString() || "",
      cantidadSacos: prod?.cantidadSacos?.toString() || "",
      pesoXSaco: prod?.pesoXSaco?.toString() || "",
      precioXSaco: prod?.precioXSaco?.toString() || "",
      cantidadCajas: prod?.cantidadCajas?.toString() || "",
      pesoXCaja: prod?.pesoXCaja?.toString() || "",
      precioXCaja: prod?.precioXCaja?.toString() || "",
      codigoArancelario: prod?.codigoArancelario || "",
    });
  }

  // Convierte el formulario de strings a números para enviar al API
  function getItemFormAsNumbers(): ItemOfertaClienteInput {
    const cleanedExtra =
      extraFields
        .map((f) => ({
          label: f.label.trim(),
          value: f.value.trim() || null,
        }))
        .filter((f) => f.label) || [];

    return {
      productoId: itemModoLibre ? null : (itemFormStrings.productoId || null),
      nombreProducto: itemModoLibre ? (itemFormStrings.nombreProducto.trim() || null) : null,
      codigoProducto: itemModoLibre ? (itemFormStrings.codigoProducto.trim() || null) : null,
      unidadMedidaId: itemModoLibre ? (itemFormStrings.unidadMedidaId || null) : null,
      cantidad: parseFloat(itemFormStrings.cantidad) || 0,
      precioUnitario: parseFloat(itemFormStrings.precioUnitario) || 0,
      cantidadCajas: itemFormStrings.cantidadCajas ? parseInt(itemFormStrings.cantidadCajas) : undefined,
      cantidadSacos: itemFormStrings.cantidadSacos ? parseInt(itemFormStrings.cantidadSacos) : undefined,
      pesoXSaco: itemFormStrings.pesoXSaco ? parseFloat(itemFormStrings.pesoXSaco) : undefined,
      precioXSaco: itemFormStrings.precioXSaco ? parseFloat(itemFormStrings.precioXSaco) : undefined,
      pesoXCaja: itemFormStrings.pesoXCaja ? parseFloat(itemFormStrings.pesoXCaja) : undefined,
      precioXCaja: itemFormStrings.precioXCaja ? parseFloat(itemFormStrings.precioXCaja) : undefined,
      codigoArancelario: itemFormStrings.codigoArancelario?.trim() || undefined,
      camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : undefined,
    };
  }

  function addItemToList(): void {
    const itemData = getItemFormAsNumbers();
    if (itemModoLibre && !itemData.nombreProducto) {
      toast.error("Escribe el nombre del producto");
      return;
    }
    if (!itemModoLibre && !itemData.productoId) {
      toast.error("Selecciona un producto");
      return;
    }
    if (itemData.cantidad <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }
    
    const prod = itemModoLibre ? undefined : productos.find((p) => p.id === itemData.productoId);

    if (editingTempId) {
      setItemsTemp((prev) =>
        prev.map((it) =>
          it.tempId === editingTempId
            ? { ...itemData, tempId: editingTempId, producto: prod }
            : it,
        ),
      );
      toast.success("Ítem actualizado");
    } else {
      const newItem: ItemTemp = {
        ...itemData,
        tempId: `temp-${Date.now()}`,
        producto: prod,
      };
      setItemsTemp((prev) => [...prev, newItem]);
      toast.success("Producto agregado");
    }

    resetItemForm();
    setShowAddItem(false);
  }

  function removeItemFromList(tempId: string): void {
    setItemsTemp((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  function addExtraField(): void {
    setExtraFields((prev) => [
      ...prev,
      { id: `extra-${Date.now()}-${prev.length}`, label: "", value: "" },
    ]);
  }

  function updateExtraField(id: string, key: "label" | "value", value: string): void {
    setExtraFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    );
  }

  function removeExtraField(id: string): void {
    setExtraFields((prev) => prev.filter((f) => f.id !== id));
  }

  function addEditExtraField(): void {
    setEditExtraFields((prev) => [
      ...prev,
      { id: `edit-extra-${Date.now()}-${prev.length}`, label: "", value: "" },
    ]);
  }

  function updateEditExtraField(id: string, key: "label" | "value", value: string): void {
    setEditExtraFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    );
  }

  function removeEditExtraField(id: string): void {
    setEditExtraFields((prev) => prev.filter((f) => f.id !== id));
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
    estado: "pendiente",
    terminosDocumentoTexto: "",
    metodoPagoDocumentoTexto: "",
  });

  async function openDetailDialog(oferta: OfertaCliente): Promise<void> {
    const updated = await ofertasClienteApi.getById(oferta.id);
    setSelectedOferta(updated);
    setShowAdjustPrices(false);
    setTotalDeseado("");
    setEditFormData({
      numero: updated.numero || "",
      fecha: updated.fecha ? updated.fecha.split("T")[0] : "",
      observaciones: updated.observaciones || "",
      campoExtra1: updated.campoExtra1 || "OFERTA VALIDA POR 30 DIAS",
      estado: updated.estado || "pendiente",
      terminosDocumentoTexto: updated.terminosDocumentoTexto || defaultTerminosTexto,
      metodoPagoDocumentoTexto: updated.metodoPagoDocumentoTexto || defaultMetodoPagoTexto,
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
    const esLibre = !item.productoId;
    setEditItemModoLibre(esLibre);
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
      nombreProducto: item.nombreProducto || "",
      codigoProducto: item.codigoProducto || "",
      unidadMedidaId: item.unidadMedidaId || "",
    });
    setEditExtraFields(
      (item.camposOpcionales || []).map((c, idx) => ({
        id: `${c.label}-${idx}`,
        label: c.label,
        value: (c.value ?? "").toString(),
      })),
    );
    setEditItemDialogOpen(true);
  }

  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      // Siempre enviar todos los campos opcionales, incluso si están vacíos (como null para limpiar)
      const cleanedExtra =
        editExtraFields
          .map((f) => ({
            label: f.label.trim(),
            value: f.value.trim() || null,
          }))
          .filter((f) => f.label) || [];

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
        camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : null,
        ...(editItemModoLibre ? {
          nombreProducto: editItemFormStrings.nombreProducto.trim() || null,
          codigoProducto: editItemFormStrings.codigoProducto.trim() || null,
          unidadMedidaId: editItemFormStrings.unidadMedidaId || null,
        } : {}),
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

  function formatProductos(items: OfertaCliente["items"]): string {
    if (!items || items.length === 0) return "Sin productos";
    const primerosDos = items.slice(0, 2);
    const nombres = primerosDos.map(item => item.producto?.nombre ?? item.nombreProducto ?? "—").join(", ");
    if (items.length > 2) {
      return `${nombres} (+${items.length - 2} más)`;
    }
    return nombres;
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
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Oferta
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número, cliente, producto, estado..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : sortedOfertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    {ofertas.length === 0 ? "No hay ofertas" : "No hay resultados para la búsqueda"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOfertas.map((oferta) => (
                  <TableRow
                    key={oferta.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => void openDetailDialog(oferta)}
                  >
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>{oferta.cliente?.nombre ?? ""} {oferta.cliente?.apellidos ?? ""}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm text-slate-700 truncate" title={formatProductos(oferta.items)}>
                        {formatProductos(oferta.items)}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(oferta.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoColors[oferta.estado]}>{oferta.estado}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => void openDetailDialog(oferta)}>
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
          {!loading && sortedOfertas.length > 0 && (
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-t bg-slate-50/50">
              <p className="text-xs sm:text-sm text-slate-500">
                <span className="hidden sm:inline">Mostrando </span>
                {start + 1}-{Math.min(start + PAGE_SIZE, sortedOfertas.length)} de {sortedOfertas.length}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="hidden sm:inline text-xs sm:text-sm text-slate-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog - Todo en un paso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[92vw] sm:w-[90vw] max-w-[900px] max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6 [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-base sm:text-lg">Nueva Oferta a Cliente</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md text-slate-500 hover:text-slate-700"
                onClick={() => setDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Información básica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-slate-500 text-xs sm:text-sm">Número *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                  placeholder="Ej: Z26001"
                  required
                  className="mt-1 h-9 sm:h-10 text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-slate-500 text-xs sm:text-sm">Cliente *</Label>
                <Select
                  value={formData.clienteId}
                  onValueChange={(value) => setFormData((p) => ({ ...p, clienteId: value }))}
                >
                  <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm max-w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombreCompania || `${c.nombre ?? ""} ${c.apellidos ?? ""}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-500 text-xs sm:text-sm">Fecha</Label>
                <Input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))}
                  className="mt-1 h-9 sm:h-10 text-sm"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Label className="text-slate-500 text-xs sm:text-sm">Observaciones</Label>
                <Input
                  value={formData.observaciones}
                  onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))}
                  className="mt-1 h-9 sm:h-10 text-sm"
                />
              </div>
            </div>

            {/* Sección de productos */}
            <div className="min-w-0 space-y-2 sm:space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h4 className="font-medium text-sm sm:text-base">Productos</h4>
                <Button
                  type="button"
                  size="sm"
                  variant={showAddItem ? "secondary" : "default"}
                  onClick={() => {
                    if (showAddItem) {
                      resetItemForm();
                      setShowAddItem(false);
                    } else {
                      resetItemForm();
                      setShowAddItem(true);
                    }
                  }}
                  className="flex items-center gap-2 w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                >
                  {showAddItem ? <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                  {showAddItem ? "Cancelar" : "Agregar"}
                </Button>
              </div>

              {/* Form para agregar item */}
              {showAddItem && (
                <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-3 sm:p-4 space-y-4">
                  {editingTempId && (
                    <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      Editando un producto de la lista — guarda los cambios o cancela.
                    </p>
                  )}
                  {/* Toggle catálogo / libre */}
                  <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
                    <span className="text-xs text-slate-500 w-full sm:w-auto sm:mr-1">Origen:</span>
                    <button type="button" onClick={() => setItemModoLibre(false)}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${!itemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300"}`}>
                      Del catálogo
                    </button>
                    <button type="button" onClick={() => setItemModoLibre(true)}
                      className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${itemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300"}`}>
                      Producto libre
                    </button>
                  </div>

                  {!itemModoLibre ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs sm:text-sm">Producto *</Label>
                      <Select value={itemFormStrings.productoId} onValueChange={handleSelectProduct}>
                        <SelectTrigger className="h-10 w-full text-sm">
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
                      <p className="text-xs text-slate-500">
                        Para cerrar el listado: Esc o clic fuera del listado.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs sm:text-sm">Nombre del producto *</Label>
                          <Input
                            placeholder="Ej: Aceite de cocina"
                            value={itemFormStrings.nombreProducto}
                            onChange={(e) => setItemFormStrings((prev) => ({ ...prev, nombreProducto: e.target.value }))}
                            className="h-10 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm">Código (opcional)</Label>
                            <Input
                              placeholder="Código interno"
                              value={itemFormStrings.codigoProducto}
                              onChange={(e) => setItemFormStrings((prev) => ({ ...prev, codigoProducto: e.target.value }))}
                              className="h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm">Unidad de medida</Label>
                            <Select value={itemFormStrings.unidadMedidaId} onValueChange={(v) => setItemFormStrings((prev) => ({ ...prev, unidadMedidaId: v }))}>
                              <SelectTrigger className="h-10 text-sm w-full">
                                <SelectValue placeholder="Seleccionar UM" />
                              </SelectTrigger>
                              <SelectContent>
                                {unidades.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nombre} ({u.abreviatura})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs sm:text-sm">Cantidad *</Label>
                      <Input
                        placeholder="0"
                        value={itemFormStrings.cantidad}
                        onChange={(e) => setItemFormStrings((prev) => ({ ...prev, cantidad: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs sm:text-sm">Precio unitario *</Label>
                      <Input
                        placeholder="0.00"
                        value={itemFormStrings.precioUnitario}
                        onChange={(e) => setItemFormStrings((prev) => ({ ...prev, precioUnitario: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                  </div>

                  {/* Campos informativos opcionales fijos */}
                  <div className="border-t border-slate-200 pt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">Campos opcionales (fijos)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
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

                    {/* Campos opcionales dinámicos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-600">Campos extra (label / valor)</p>
                        <Button type="button" variant="outline" size="sm" onClick={addExtraField} className="shrink-0">
                          <Plus className="h-4 w-4" />
                          Agregar campo
                        </Button>
                      </div>
                      {extraFields.length > 0 && (
                        <div className="space-y-2">
                          {extraFields.map((field) => (
                            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                              <Input
                                placeholder="Etiqueta (ej: Cant. x contenedor)"
                                value={field.label}
                                onChange={(e) => updateExtraField(field.id, "label", e.target.value)}
                                className="h-9 text-xs sm:text-sm"
                              />
                              <Input
                                placeholder="Valor"
                                value={field.value}
                                onChange={(e) => updateExtraField(field.id, "value", e.target.value)}
                                className="h-9 text-xs sm:text-sm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExtraField(field.id)}
                                className="h-9 w-9 shrink-0 justify-self-end sm:justify-self-center"
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                    <Button type="button" onClick={addItemToList} className="w-full sm:w-auto">
                      {editingTempId ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {editingTempId ? "Guardar cambios" : "Agregar a la lista"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de items temporales */}
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>UM</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsTemp.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-slate-500">
                        No hay productos agregados
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsTemp.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell>
                          {item.producto?.nombre ?? item.nombreProducto ?? "—"}
                          {!item.productoId && <span className="ml-1 text-[10px] text-orange-500">(libre)</span>}
                        </TableCell>
                        <TableCell>{umAbbrForTempItem(item)}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.cantidad * item.precioUnitario)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditTempItem(item)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeItemFromList(item.tempId)}
                              title="Eliminar"
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

              {itemsTemp.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-sm sm:text-base font-semibold text-slate-800">
                    Total: {formatCurrency(totalTemp)}
                  </div>
                </div>
              )}
            </div>

            {/* Términos y método de pago para el documento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                <Label className="text-xs sm:text-sm">
                  Términos y condiciones (documento)
                </Label>
                <textarea
                  className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                  value={formData.terminosDocumentoTexto}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, terminosDocumentoTexto: e.target.value }))
                  }
                />
              </div>
              <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                <Label className="text-xs sm:text-sm">
                  Método de pago (documento)
                </Label>
                <textarea
                  className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                  value={formData.metodoPagoDocumentoTexto}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, metodoPagoDocumentoTexto: e.target.value }))
                  }
                />
              </div>
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
        <DialogContent className="flex w-[94vw] max-w-[1320px] max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[min(92dvh,900px)] flex-col overflow-hidden p-3 sm:p-6 [&>button]:hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <DialogTitle className="flex items-center gap-2 flex-wrap text-left">
              <Users className="h-5 w-5 shrink-0" />
              Oferta: {selectedOferta?.numero}
            </DialogTitle>
            <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap lg:items-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadPdf("ofertas-cliente", selectedOferta.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadExcel("ofertas-cliente", selectedOferta.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button onClick={() => handleUpdateOferta(true)} size="sm" className="gap-2 flex-1 sm:flex-initial">
                <Save className="h-4 w-4" />
                Guardar y Cerrar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md text-slate-500 hover:text-slate-700"
                onClick={() => setDetailDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 overflow-x-hidden pb-4 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="space-y-3 sm:space-y-4 min-w-0">
              {/* Info básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Cliente</Label>
                  <p className="font-medium text-xs sm:text-sm mt-1">
                    {selectedOferta?.cliente?.nombreCompania || `${selectedOferta?.cliente?.nombre || ""} ${selectedOferta?.cliente?.apellidos || ""}`.trim()}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Número</Label>
                  <Input
                    value={editFormData.numero}
                    onChange={(e) => setEditFormData((p) => ({ ...p, numero: e.target.value }))}
                    className="mt-1 h-9 sm:h-10 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Fecha</Label>
                  <Input
                    type="date"
                    value={editFormData.fecha}
                    onChange={(e) => setEditFormData((p) => ({ ...p, fecha: e.target.value }))}
                    className="mt-1 h-9 sm:h-10 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Estado</Label>
                  <Select
                    value={editFormData.estado}
                    onValueChange={(value) => setEditFormData((p) => ({ ...p, estado: value }))}
                  >
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="aceptada">Aceptada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Label className="text-slate-500 text-xs sm:text-sm">Observaciones</Label>
                  <Input
                    value={editFormData.observaciones}
                    onChange={(e) => setEditFormData((p) => ({ ...p, observaciones: e.target.value }))}
                    className="mt-1 h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Productos */}
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
                  <h4 className="font-medium text-sm sm:text-base">Productos</h4>
                  <Dialog
                    open={itemDialogOpen}
                    onOpenChange={(open) => {
                      setItemDialogOpen(open);
                      if (open) {
                        resetItemForm();
                      }
                    }}
                  >
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setItemDialogOpen(true)}
                      className="flex items-center gap-2 w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Agregar Producto
                    </Button>
                    <DialogContent className="w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Agregar Producto</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddItem} className="space-y-4">
                        {/* Toggle catálogo / libre */}
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <button type="button" onClick={() => setItemModoLibre(false)}
                            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${!itemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                            Del catálogo
                          </button>
                          <button type="button" onClick={() => setItemModoLibre(true)}
                            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${itemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                            Producto libre
                          </button>
                        </div>
                        {!itemModoLibre ? (
                          <div className="space-y-2">
                            <Label>Producto *</Label>
                            <Select value={itemFormStrings.productoId} onValueChange={handleSelectProduct}>
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
                            <p className="text-xs text-slate-500">
                              Para cerrar el listado: Esc o clic fuera del listado.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Nombre del producto *</Label>
                              <Input placeholder="Ej: Aceite de cocina"
                                value={itemFormStrings.nombreProducto}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, nombreProducto: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Código (opcional)</Label>
                              <Input placeholder="Código"
                                value={itemFormStrings.codigoProducto}
                                onChange={(e) => setItemFormStrings((prev) => ({ ...prev, codigoProducto: e.target.value }))} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Unidad de medida</Label>
                              <Select value={itemFormStrings.unidadMedidaId} onValueChange={(v) => setItemFormStrings((prev) => ({ ...prev, unidadMedidaId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar UM" /></SelectTrigger>
                                <SelectContent>
                                  {unidades.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
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
                        {/* Campos opcionales dinámicos (misma experiencia que al crear oferta) */}
                        <div className="border-t pt-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="text-sm font-medium text-slate-600">Campos extra (label / valor)</p>
                            <Button type="button" variant="outline" size="sm" onClick={addExtraField} className="shrink-0 w-full sm:w-auto">
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar campo
                            </Button>
                          </div>
                          {extraFields.length > 0 && (
                            <div className="space-y-2">
                              {extraFields.map((field) => (
                                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                  <Input
                                    placeholder="Etiqueta"
                                    value={field.label}
                                    onChange={(e) => updateExtraField(field.id, "label", e.target.value)}
                                    className="h-9 text-sm"
                                  />
                                  <Input
                                    placeholder="Valor"
                                    value={field.value}
                                    onChange={(e) => updateExtraField(field.id, "value", e.target.value)}
                                    className="h-9 text-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => removeExtraField(field.id)}
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
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
                        <TableCell>
                          {item.producto?.nombre ?? item.nombreProducto ?? "—"}
                          {!item.productoId && <span className="ml-1 text-[10px] text-orange-500 font-medium">(libre)</span>}
                        </TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell>
                          {item.unidadMedida?.abreviatura
                            ?? item.producto?.unidadMedida?.abreviatura
                            ?? (item.unidadMedidaId
                              ? unidades.find((u) => u.id === item.unidadMedidaId)?.abreviatura
                              : undefined)
                            ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

              {/* Ajuste por total (estilo original) */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg sm:text-2xl font-bold">
                    Total Actual: {formatCurrency(selectedOferta?.total || 0)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdjustPrices((prev) => !prev)}
                  >
                    {showAdjustPrices ? "Cancelar" : "Ajustar a Total"}
                  </Button>
                </div>

                {showAdjustPrices && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 space-y-2">
                    <p className="text-xs sm:text-sm text-amber-900">
                      Ingresa el total deseado y los precios de los productos se ajustaran proporcionalmente.
                    </p>
                    <Label className="text-xs sm:text-sm font-medium">Total Deseado ($)</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        className="flex-1 h-9 sm:h-10 text-sm bg-white"
                        placeholder="Ej: 5000"
                        value={totalDeseado}
                        onChange={(e) => setTotalDeseado(e.target.value)}
                      />
                      <Button
                        onClick={() => void handleAdjustPrices()}
                        disabled={!totalDeseado || parseFloat(totalDeseado) <= 0}
                        className="w-full sm:w-auto h-9 sm:h-10 text-sm bg-amber-400 hover:bg-amber-500 text-slate-900"
                      >
                        Aplicar Ajuste
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Términos y método de pago para el documento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                  <Label className="text-xs sm:text-sm">
                    Términos y condiciones (documento)
                  </Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                    value={editFormData.terminosDocumentoTexto}
                    onChange={(e) =>
                      setEditFormData((p) => ({
                        ...p,
                        terminosDocumentoTexto: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                  <Label className="text-xs sm:text-sm">
                    Método de pago (documento)
                  </Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                    value={editFormData.metodoPagoDocumentoTexto}
                    onChange={(e) =>
                      setEditFormData((p) => ({
                        ...p,
                        metodoPagoDocumentoTexto: e.target.value,
                      }))
                    }
                  />
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
            {editItemModoLibre && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b pb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del producto</Label>
                  <Input placeholder="Nombre"
                    value={editItemFormStrings.nombreProducto}
                    onChange={(e) => setEditItemFormStrings((prev) => ({ ...prev, nombreProducto: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unidad de medida</Label>
                  <Select value={editItemFormStrings.unidadMedidaId} onValueChange={(v) => setEditItemFormStrings((prev) => ({ ...prev, unidadMedidaId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar UM" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
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
            <div className="border-t pt-4 space-y-3">
              <div>
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

              {/* Campos opcionales dinámicos en edición */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">Campos extra (label / valor)</p>
                  <Button type="button" variant="outline" size="sm" onClick={addEditExtraField} className="shrink-0">
                    <Plus className="h-4 w-4" />
                    Agregar campo
                  </Button>
                </div>
                {editExtraFields.length > 0 && (
                  <div className="space-y-1">
                    {editExtraFields.map((field) => (
                      <div key={field.id} className="grid grid-cols-7 gap-1 items-center">
                        <Input
                          placeholder="Label"
                          value={field.label}
                          onChange={(e) => updateEditExtraField(field.id, "label", e.target.value)}
                          className="col-span-3 h-8 text-[11px] px-2"
                        />
                        <Input
                          placeholder="Valor"
                          value={field.value}
                          onChange={(e) => updateEditExtraField(field.id, "value", e.target.value)}
                          className="col-span-3 h-8 text-[11px] px-2"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEditExtraField(field.id)}
                          className="h-8 w-8"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Diálogo para exportar con rango de fechas */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Ofertas a Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecciona un rango de fechas para filtrar las ofertas (opcional). Si no seleccionas fechas, se exportarán todas las ofertas.
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
                    await exportApi.exportAllOfertasCliente(
                      fechaDesde || undefined,
                      fechaHasta || undefined
                    );
                    toast.success("Ofertas exportadas correctamente");
                    setExportDialogOpen(false);
                    setFechaDesde("");
                    setFechaHasta("");
                  } catch (error) {
                    toast.error("Error al exportar ofertas");
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
