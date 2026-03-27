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
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, Ship, ArrowRight, Pencil, Save, Download, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { 
  ofertasImportadoraApi, 
  ofertasClienteApi, 
  clientesApi, 
  productosApi, 
  exportApi,
  importadorasApi,
  unidadesApi
} from "@/lib/api";
import type {
  OfertaImportadora,
  OfertaCliente,
  Cliente,
  Producto,
  Importadora,
  UnidadMedida,
  ItemOfertaImportadora,
} from "@/lib/api";

const PAGE_SIZE = 10;

/** UM en tabla: catálogo (producto.unidadMedida) o producto libre (item.unidadMedida / unidadMedidaId) */
function umAbbrImportadoraItem(
  item: Pick<ItemOfertaImportadora, "producto" | "unidadMedida" | "unidadMedidaId">,
  unidades: UnidadMedida[],
): string {
  return (
    item.unidadMedida?.abreviatura
    ?? item.producto?.unidadMedida?.abreviatura
    ?? (item.unidadMedidaId ? unidades.find((u) => u.id === item.unidadMedidaId)?.abreviatura : undefined)
    ?? "—"
  );
}

interface ExtraFieldForm {
  id: string;
  label: string;
  value: string;
}

// Texto por defecto para bloques de documento (mismo contenido que en oferta a cliente)
const defaultTerminosDocumentoTexto = [
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

const defaultMetodoPagoDocumentoTexto = [
  "Banco: Truist Bank",
  "Titular: ZAS BY JMC CORP",
  "Número de Cuenta: 1100035647757",
  "Número de Ruta (transferencias dentro de USA): 263191387",
  "Dirección de la Empresa: 7081 NW 82 AVE MIAMI FL 33166",
].join("\n");

export default function OfertasImportadoraPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaImportadora[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOferta, setSelectedOferta] = useState<OfertaImportadora | null>(null);
  
  // Form para crear desde oferta cliente
  const [selectedOfertaClienteId, setSelectedOfertaClienteId] = useState("");
  const [selectedOfertaCliente, setSelectedOfertaCliente] = useState<OfertaCliente | null>(null);
  const [selectedImportadoraId, setSelectedImportadoraId] = useState("");
  const [numeroOferta, setNumeroOferta] = useState("");
  const [fechaOferta, setFechaOferta] = useState("");
  const [flete, setFlete] = useState("");
  const [seguro, setSeguro] = useState("");
  const [tieneSeguro, setTieneSeguro] = useState(false);
  const [incluyeFirmaCliente, setIncluyeFirmaCliente] = useState(true);
  const [totalCifDeseado, setTotalCifDeseado] = useState("");
  const [puertoEmbarque, setPuertoEmbarque] = useState("");
  const [origen, setOrigen] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [terminosPago, setTerminosPago] = useState("");
  const [terminosDocumentoTexto, setTerminosDocumentoTexto] = useState("");
  const [metodoPagoDocumentoTexto, setMetodoPagoDocumentoTexto] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Estado para diálogo de exportación con rango de fechas
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Estado para ajustar precios en edición
  const [showAdjustPricesEdit, setShowAdjustPricesEdit] = useState(false);
  const [totalDeseadoEdit, setTotalDeseadoEdit] = useState("");

  // Estado para editar item existente
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [editItemModoLibre, setEditItemModoLibre] = useState(false);
  const [editItemForm, setEditItemForm] = useState({
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
  const [editExtraFields, setEditExtraFields] = useState<ExtraFieldForm[]>([]);

  // Estado para items editables en creación
  const [itemsEditables, setItemsEditables] = useState<Array<{
    id: string;
    productoId?: string | null;
    producto?: Producto | null;
    nombreProducto?: string | null;
    codigoProducto?: string | null;
    unidadMedidaId?: string | null;
    cantidad: number;
    precioUnitario: number;
    precioAjustado: number;
    cantidadCajas?: number | null;
    cantidadSacos?: number | null;
    pesoNeto?: number | null;
    pesoBruto?: number | null;
    pesoXSaco?: number | null;
    precioXSaco?: number | null;
    pesoXCaja?: number | null;
    precioXCaja?: number | null;
    codigoArancelario?: string | null;
    camposOpcionales?: { label: string; value?: string | null }[] | null;
  }>>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const searchLower = search.trim().toLowerCase();
  const filteredOfertas = searchLower
    ? ofertas.filter(
        (o) =>
          (o.numero ?? "").toLowerCase().includes(searchLower) ||
          (o.ofertaCliente?.numero ?? "").toLowerCase().includes(searchLower) ||
          `${o.cliente?.nombre ?? ""} ${o.cliente?.apellidos ?? ""}`.trim().toLowerCase().includes(searchLower) ||
          (o.importadora?.nombre ?? "").toLowerCase().includes(searchLower) ||
          (o.estado ?? "").toLowerCase().includes(searchLower) ||
          o.items?.some((it) => (it.producto?.nombre ?? "").toLowerCase().includes(searchLower))
      )
    : ofertas;

  // Ordenar por número desc (Z26024, luego Z26023, luego Z26022-2, etc.)
  const sortedOfertas = [...filteredOfertas].sort((a, b) =>
    (b.numero ?? "").localeCompare(a.numero ?? "")
  );

  const totalPages = Math.max(1, Math.ceil(sortedOfertas.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedOfertas = sortedOfertas.slice(start, start + PAGE_SIZE);

  async function loadData(): Promise<void> {
    try {
      setCurrentPage(1);
      const [ofertasData, ofertasClienteData, clientesData, importadorasData, productosData, unidadesData] = await Promise.all([
        ofertasImportadoraApi.getAll(),
        ofertasClienteApi.getAll(),
        clientesApi.getAll(),
        importadorasApi.getAll(),
        productosApi.getAll(),
        unidadesApi.getAll(),
      ]);
      setOfertas(ofertasData);
      setOfertasCliente(
        ofertasClienteData
          .filter((o) => o.estado !== "rechazada" && o.estado !== "vencida")
          .sort((a, b) => (b.numero ?? "").localeCompare(a.numero ?? ""))
      );
      setClientes(clientesData);
      setImportadoras(importadorasData);
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

  // Reset form al abrir diálogo de crear
  function openNewDialog(): void {
    const primeraOferta = ofertasCliente[0];
    setSelectedOfertaClienteId(primeraOferta?.id || "");
    setSelectedOfertaCliente(primeraOferta || null);
    setSelectedImportadoraId(importadoras[0]?.id || "");
    setNumeroOferta(primeraOferta?.numero || "");
    setFechaOferta("");
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
    setTerminosDocumentoTexto(
      primeraOferta?.terminosDocumentoTexto && primeraOferta.terminosDocumentoTexto.trim() !== ""
        ? primeraOferta.terminosDocumentoTexto
        : defaultTerminosDocumentoTexto
    );
    setMetodoPagoDocumentoTexto(
      primeraOferta?.metodoPagoDocumentoTexto &&
      primeraOferta.metodoPagoDocumentoTexto.trim() !== ""
        ? primeraOferta.metodoPagoDocumentoTexto
        : defaultMetodoPagoDocumentoTexto
    );
    setItemsEditables([]);
    setEditingItemIndex(null);
    setDialogOpen(true);
    
    // Si hay una primera oferta, cargar sus items
    if (primeraOferta && primeraOferta.items) {
      handleSelectOfertaCliente(primeraOferta.id);
    }
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
    setTerminosDocumentoTexto(
      oferta?.terminosDocumentoTexto && oferta.terminosDocumentoTexto.trim() !== ""
        ? oferta.terminosDocumentoTexto
        : defaultTerminosDocumentoTexto
    );
    setMetodoPagoDocumentoTexto(
      oferta?.metodoPagoDocumentoTexto && oferta.metodoPagoDocumentoTexto.trim() !== ""
        ? oferta.metodoPagoDocumentoTexto
        : defaultMetodoPagoDocumentoTexto
    );
    
    // Cargar items de la oferta cliente para edición (incl. campos dinámicos)
    if (oferta && oferta.items) {
      const itemsCargados = oferta.items.map((item, index) => ({
        id: `temp-${index}-${Date.now()}`,
        productoId: item.productoId ?? null,
        producto: item.producto ?? undefined,
        nombreProducto: item.nombreProducto ?? null,
        codigoProducto: item.codigoProducto ?? null,
        unidadMedidaId: item.unidadMedidaId ?? null,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        precioAjustado: item.precioUnitario, // Inicialmente igual al precio original
        cantidadCajas: item.cantidadCajas || null,
        cantidadSacos: item.cantidadSacos || null,
        pesoNeto: item.pesoNeto || null,
        pesoBruto: item.pesoBruto || null,
        pesoXSaco: item.pesoXSaco || null,
        precioXSaco: item.precioXSaco || null,
        pesoXCaja: item.pesoXCaja || null,
        precioXCaja: item.precioXCaja || null,
        codigoArancelario: item.codigoArancelario || null,
        camposOpcionales: item.camposOpcionales ?? null,
      }));
      setItemsEditables(itemsCargados);
    } else {
      setItemsEditables([]);
    }
  }

  // Calcular CIF desde items editables
  const fleteNum = parseFloat(flete) || 0;
  const seguroNum = tieneSeguro ? (parseFloat(seguro) || 0) : 0;
  const subtotalProductos = itemsEditables.reduce((acc, item) => {
    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
    const subtotal = item.precioAjustado * cantidadParaCalculo;
    return acc + subtotal;
  }, 0);
  const cifCalculado = subtotalProductos + fleteNum + seguroNum;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    
    if (!selectedOfertaClienteId) {
      toast.error("Selecciona una oferta al cliente");
      return;
    }

    if (itemsEditables.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setSaving(true);

    try {
      const cifDeseado = parseFloat(totalCifDeseado);
      
      // Preparar items para enviar (convertir a formato del API)
      const itemsParaEnviar = itemsEditables.map(item => {
        // Validar que cantidad y precios sean válidos
        if (item.cantidad <= 0) {
          throw new Error(`La cantidad del producto ${item.producto?.nombre ?? item.nombreProducto ?? ''} debe ser mayor a 0`);
        }
        if (item.precioUnitario <= 0) {
          throw new Error(`El precio unitario del producto ${item.producto?.nombre ?? item.nombreProducto ?? ''} debe ser mayor a 0`);
        }
        if (item.precioAjustado <= 0) {
          throw new Error(`El precio ajustado del producto ${item.producto?.nombre ?? item.nombreProducto ?? ''} debe ser mayor a 0`);
        }
        
        return {
          productoId: item.productoId ?? null,
          nombreProducto: item.nombreProducto ?? null,
          codigoProducto: item.codigoProducto ?? null,
          unidadMedidaId: item.unidadMedidaId ?? null,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          precioAjustado: item.precioAjustado,
          cantidadCajas: item.cantidadCajas ?? null,
          cantidadSacos: item.cantidadSacos ?? null,
          pesoNeto: item.pesoNeto ?? null,
          pesoBruto: item.pesoBruto ?? null,
          pesoXSaco: item.pesoXSaco ?? null,
          precioXSaco: item.precioXSaco ?? null,
          pesoXCaja: item.pesoXCaja ?? null,
          precioXCaja: item.precioXCaja ?? null,
          codigoArancelario: item.codigoArancelario ?? null,
          camposOpcionales: item.camposOpcionales ?? null,
        };
      });
      
      if (!selectedImportadoraId) {
        toast.error("Selecciona una importadora");
        return;
      }

      await ofertasImportadoraApi.createFromOfertaCliente({
        ofertaClienteId: selectedOfertaClienteId,
        importadoraId: selectedImportadoraId,
        numero: numeroOferta,
        fecha: fechaOferta || undefined,
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
        terminosDocumentoTexto: terminosDocumentoTexto || undefined,
        metodoPagoDocumentoTexto: metodoPagoDocumentoTexto || undefined,
        // Enviar items editados
        items: itemsParaEnviar,
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
    setShowAdjustPricesEdit(false);
    setTotalDeseadoEdit("");
    setDetailDialogOpen(true);
  }

  // Guardar cambios generales de la oferta y cerrar
  async function handleSaveChanges(): Promise<void> {
    if (!selectedOferta) return;

    if (!selectedOferta.importadoraId) {
      toast.error("Selecciona una importadora");
      return;
    }

    try {
      await ofertasImportadoraApi.update(selectedOferta.id, {
        numero: selectedOferta.numero,
        fecha: selectedOferta.fecha,
        importadoraId: selectedOferta.importadoraId,
        flete: selectedOferta.flete,
        seguro: selectedOferta.seguro,
        tieneSeguro: selectedOferta.tieneSeguro,
        puertoEmbarque: selectedOferta.puertoEmbarque,
        origen: selectedOferta.origen,
        moneda: selectedOferta.moneda,
        terminosPago: selectedOferta.terminosPago,
        terminosDocumentoTexto: selectedOferta.terminosDocumentoTexto,
        metodoPagoDocumentoTexto: selectedOferta.metodoPagoDocumentoTexto,
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
    setEditingItemIndex(null);
    setIsAddingNewItem(false);
    setEditItemModoLibre(!item.productoId);
    setEditItemForm({
      productoId: item.productoId ?? "",
      nombreProducto: (item as any).nombreProducto ?? "",
      codigoProducto: (item as any).codigoProducto ?? "",
      unidadMedidaId: (item as any).unidadMedidaId ?? "",
      cantidad: (item.pesoNeto || item.cantidad)?.toString() || "",
      precioUnitario: item.precioAjustado?.toString() || "", // Mostrar precio ajustado actual
      cantidadCajas: item.cantidadCajas?.toString() || "",
      cantidadSacos: item.cantidadSacos?.toString() || "",
      pesoXSaco: item.pesoXSaco?.toString() || "",
      precioXSaco: item.precioXSaco?.toString() || "",
      pesoXCaja: item.pesoXCaja?.toString() || "",
      precioXCaja: item.precioXCaja?.toString() || "",
      codigoArancelario: item.codigoArancelario || "",
    });
    setEditExtraFields(
      (item.camposOpcionales || []).map((c, idx) => ({
        id: `edit-${c.label}-${idx}`,
        label: c.label,
        value: (c.value ?? "").toString(),
      }))
    );
    setEditItemDialogOpen(true);
  }

  function openAddItemDialog(): void {
    setEditingItemId(null);
    setEditingItemIndex(null);
    setIsAddingNewItem(true);
    setEditItemModoLibre(false);
    setEditItemForm({
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
    setEditExtraFields([]);
    setEditItemDialogOpen(true);
  }

  function addEditExtraField(): void {
    setEditExtraFields((prev) => [
      ...prev,
      { id: `edit-extra-${Date.now()}-${prev.length}`, label: "", value: "" },
    ]);
  }
  function updateEditExtraField(id: string, key: "label" | "value", value: string): void {
    setEditExtraFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  }
  function removeEditExtraField(id: string): void {
    setEditExtraFields((prev) => prev.filter((f) => f.id !== id));
  }

  // Guardar cambios de item
  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      const cleanedExtra = editExtraFields
        .map((f) => ({ label: f.label.trim(), value: f.value.trim() || null }))
        .filter((f) => f.label);
      const itemData = {
        cantidad: editItemForm.cantidad ? parseFloat(editItemForm.cantidad) : undefined,
        precioAjustado: editItemForm.precioUnitario ? parseFloat(editItemForm.precioUnitario) : undefined,
        cantidadCajas: editItemForm.cantidadCajas ? parseInt(editItemForm.cantidadCajas) : undefined,
        cantidadSacos: editItemForm.cantidadSacos ? parseInt(editItemForm.cantidadSacos) : undefined,
        pesoXSaco: editItemForm.pesoXSaco ? parseFloat(editItemForm.pesoXSaco) : undefined,
        precioXSaco: editItemForm.precioXSaco ? parseFloat(editItemForm.precioXSaco) : undefined,
        pesoXCaja: editItemForm.pesoXCaja ? parseFloat(editItemForm.pesoXCaja) : undefined,
        precioXCaja: editItemForm.precioXCaja ? parseFloat(editItemForm.precioXCaja) : undefined,
        codigoArancelario: editItemForm.codigoArancelario || undefined,
        camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : null,
        ...(editItemModoLibre ? {
          nombreProducto: editItemForm.nombreProducto.trim() || null,
          codigoProducto: editItemForm.codigoProducto.trim() || null,
          unidadMedidaId: editItemForm.unidadMedidaId || null,
        } : {}),
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

  // Eliminar item
  async function handleRemoveItem(itemId: string): Promise<void> {
    if (!selectedOferta || !confirm("¿Eliminar este producto?")) return;

    try {
      await ofertasImportadoraApi.removeItem(selectedOferta.id, itemId);
      toast.success("Producto eliminado");
      const updated = await ofertasImportadoraApi.getById(selectedOferta.id);
      setSelectedOferta(updated);
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
      console.error(error);
    }
  }

  // Agregar nuevo item
  async function handleAddItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta) return;

    const cantidadStr = String(editItemForm.cantidad ?? "").trim();
    const precioStr = String(editItemForm.precioUnitario ?? "").trim();
    if (!cantidadStr || !precioStr) {
      toast.error("Completa cantidad y precio");
      return;
    }

    if (!editItemModoLibre && !editItemForm.productoId) {
      toast.error("Selecciona un producto del catálogo o elige «Producto libre» e indica el nombre");
      return;
    }
    if (editItemModoLibre && !editItemForm.nombreProducto.trim()) {
      toast.error("Escribe el nombre del producto libre");
      return;
    }

    try {
      if (!editItemModoLibre) {
        const productoSeleccionado = productos.find(p => p.id === editItemForm.productoId);
        if (!productoSeleccionado) {
          toast.error("Producto no encontrado");
          return;
        }
      }

      const productoSeleccionado = editItemModoLibre ? null : productos.find(p => p.id === editItemForm.productoId);
      const cleanedExtra = editExtraFields
        .map((f) => ({ label: f.label.trim(), value: f.value.trim() || null }))
        .filter((f) => f.label);
      const itemData = {
        productoId: editItemModoLibre ? null : (editItemForm.productoId || null),
        nombreProducto: editItemModoLibre ? (editItemForm.nombreProducto.trim() || null) : null,
        codigoProducto: editItemModoLibre ? (editItemForm.codigoProducto.trim() || null) : null,
        unidadMedidaId: editItemModoLibre ? (editItemForm.unidadMedidaId || null) : null,
        cantidad: parseFloat(editItemForm.cantidad),
        precioUnitario: parseFloat(editItemForm.precioUnitario),
        cantidadCajas: editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== '' ? parseInt(editItemForm.cantidadCajas) : undefined,
        cantidadSacos: editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== '' ? parseInt(editItemForm.cantidadSacos) : undefined,
        pesoXSaco: editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== '' ? parseFloat(editItemForm.pesoXSaco) : undefined,
        precioXSaco: editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== '' ? parseFloat(editItemForm.precioXSaco) : undefined,
        pesoXCaja: editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== '' ? parseFloat(editItemForm.pesoXCaja) : undefined,
        precioXCaja: editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== '' ? parseFloat(editItemForm.precioXCaja) : undefined,
        codigoArancelario: editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== '' ? editItemForm.codigoArancelario : (productoSeleccionado?.codigoArancelario || undefined),
        camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : undefined,
      };

      const updated = await ofertasImportadoraApi.addItem(selectedOferta.id, itemData);
      setSelectedOferta(updated);
      setEditItemDialogOpen(false);
      setIsAddingNewItem(false);
      toast.success("Producto agregado");
      loadData();
    } catch (error) {
      toast.error("Error al agregar producto");
      console.error(error);
    }
  }

  /** Agregar ítem a la lista local al crear oferta (sin `selectedOferta` en servidor). */
  function handleAddItemCreate(e: React.FormEvent): void {
    e.preventDefault();

    const cantidadStr = String(editItemForm.cantidad ?? "").trim();
    const precioStr = String(editItemForm.precioUnitario ?? "").trim();
    if (!cantidadStr || !precioStr) {
      toast.error("Completa cantidad y precio");
      return;
    }

    if (!editItemModoLibre && !editItemForm.productoId) {
      toast.error("Selecciona un producto del catálogo o elige «Producto libre» e indica el nombre");
      return;
    }
    if (editItemModoLibre && !editItemForm.nombreProducto.trim()) {
      toast.error("Escribe el nombre del producto libre");
      return;
    }

    if (!editItemModoLibre) {
      const p = productos.find((x) => x.id === editItemForm.productoId);
      if (!p) {
        toast.error("Producto no encontrado");
        return;
      }
    }

    const productoSeleccionado = editItemModoLibre ? null : productos.find((p) => p.id === editItemForm.productoId);
    const cleanedExtra = editExtraFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() || null }))
      .filter((f) => f.label);

    const cantidad = parseFloat(editItemForm.cantidad);
    const precioUnitario = parseFloat(editItemForm.precioUnitario);
    const precioAjustado = precioUnitario;

    const newItem = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      productoId: editItemModoLibre ? null : (editItemForm.productoId || null),
      producto: productoSeleccionado ?? undefined,
      nombreProducto: editItemModoLibre ? (editItemForm.nombreProducto.trim() || null) : null,
      codigoProducto: editItemModoLibre ? (editItemForm.codigoProducto.trim() || null) : null,
      unidadMedidaId: editItemModoLibre ? (editItemForm.unidadMedidaId || null) : null,
      cantidad,
      precioUnitario,
      precioAjustado,
      cantidadCajas:
        editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== ""
          ? parseInt(editItemForm.cantidadCajas, 10)
          : null,
      cantidadSacos:
        editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== ""
          ? parseInt(editItemForm.cantidadSacos, 10)
          : null,
      pesoNeto: cantidad,
      pesoBruto: null,
      pesoXSaco:
        editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== ""
          ? parseFloat(editItemForm.pesoXSaco)
          : null,
      precioXSaco:
        editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== ""
          ? parseFloat(editItemForm.precioXSaco)
          : null,
      pesoXCaja:
        editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== ""
          ? parseFloat(editItemForm.pesoXCaja)
          : null,
      precioXCaja:
        editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== ""
          ? parseFloat(editItemForm.precioXCaja)
          : null,
      codigoArancelario:
        editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== ""
          ? editItemForm.codigoArancelario
          : (productoSeleccionado?.codigoArancelario || null),
      camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : null,
    };

    setItemsEditables((prev) => [...prev, newItem]);
    setEditItemDialogOpen(false);
    setIsAddingNewItem(false);
    setEditExtraFields([]);
    setEditItemModoLibre(false);
    setEditItemForm({
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
    toast.success("Producto agregado");
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
  }

  function formatCurrencyUnitPrice(value: number): string {
    return new Intl.NumberFormat("es-ES", { 
      style: "currency", 
      currency: "USD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(value);
  }

  function formatDate(date: string): string {
    // Usar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de timezone
    // Formato: mm/dd/yyyy
    if (!date) return "";
    const dateOnly = date.split("T")[0];
    const [year, month, day] = dateOnly.split("-");
    return `${month}/${day}/${year}`;
  }

  function formatProductos(items: OfertaImportadora["items"]): string {
    if (!items || items.length === 0) return "Sin productos";
    const primerosDos = items.slice(0, 2);
    const nombres = primerosDos.map(item => item.producto?.nombre ?? (item as any).nombreProducto ?? "—").join(", ");
    if (items.length > 2) {
      return `${nombres} (+${items.length - 2} más)`;
    }
    return nombres;
  }

  // Funciones para editar items en creación
  function openEditItemDialogCreate(index: number): void {
    setEditingItemIndex(index);
    setEditingItemId(null); // Asegurar que no estamos en modo edición de item existente
    setIsAddingNewItem(false);
    const item = itemsEditables[index];
    setEditItemModoLibre(!item.productoId);
    setEditItemForm({
      productoId: item.productoId ?? "",
      nombreProducto: item.nombreProducto ?? "",
      codigoProducto: item.codigoProducto ?? "",
      unidadMedidaId: item.unidadMedidaId ?? "",
      cantidad: (item.pesoNeto || item.cantidad)?.toString() || "",
      precioUnitario: item.precioAjustado.toString(), // Mostrar precio ajustado actual
      cantidadCajas: item.cantidadCajas?.toString() || "",
      cantidadSacos: item.cantidadSacos?.toString() || "",
      pesoXSaco: item.pesoXSaco?.toString() || "",
      precioXSaco: item.precioXSaco?.toString() || "",
      pesoXCaja: item.pesoXCaja?.toString() || "",
      precioXCaja: item.precioXCaja?.toString() || "",
      codigoArancelario: item.codigoArancelario || "",
    });
    setEditExtraFields(
      (item.camposOpcionales || []).map((c, idx) => ({
        id: `create-${c.label}-${idx}`,
        label: c.label,
        value: (c.value ?? "").toString(),
      }))
    );
    setEditItemDialogOpen(true);
  }

  function handleUpdateItemCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (editingItemIndex === null) return Promise.resolve();

    const updatedItems = [...itemsEditables];
    const item = updatedItems[editingItemIndex];
    
    const cantidad = parseFloat(editItemForm.cantidad) || item.cantidad;
    const precioAjustado = parseFloat(editItemForm.precioUnitario) || item.precioAjustado;
    
    const cleanedExtra = editExtraFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() || null }))
      .filter((f) => f.label);
    updatedItems[editingItemIndex] = {
      ...item,
      cantidad,
      precioAjustado,
      ...(editItemModoLibre ? {
        nombreProducto: editItemForm.nombreProducto.trim() || null,
        codigoProducto: editItemForm.codigoProducto.trim() || null,
        unidadMedidaId: editItemForm.unidadMedidaId || null,
      } : {}),
      cantidadCajas: editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== '' ? parseInt(editItemForm.cantidadCajas) : null,
      cantidadSacos: editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== '' ? parseInt(editItemForm.cantidadSacos) : null,
      pesoNeto: cantidad !== item.cantidad ? cantidad : item.pesoNeto,
      pesoXSaco: editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== '' ? parseFloat(editItemForm.pesoXSaco) : null,
      precioXSaco: editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== '' ? parseFloat(editItemForm.precioXSaco) : null,
      pesoXCaja: editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== '' ? parseFloat(editItemForm.pesoXCaja) : null,
      precioXCaja: editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== '' ? parseFloat(editItemForm.precioXCaja) : null,
      codigoArancelario: editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== '' ? editItemForm.codigoArancelario : null,
      camposOpcionales: cleanedExtra.length > 0 ? cleanedExtra : null,
    };
    
    setItemsEditables(updatedItems);
    setEditItemDialogOpen(false);
    setEditingItemIndex(null);
    setEditExtraFields([]);
    setEditItemModoLibre(false);
    setEditItemForm({
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
    toast.success("Producto actualizado");
    return Promise.resolve();
  }

  return (
    <div>
      <Header
        title="Ofertas a Importadora"
        description="Crear ofertas CIF desde ofertas al cliente."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs md:text-sm whitespace-nowrap"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
                setExportDialogOpen(true);
              }}
            >
              <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Descargar Excel</span>
              <span className="md:hidden">Excel</span>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog} size="sm" className="text-xs md:text-sm whitespace-nowrap">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">Nueva desde Oferta Cliente</span>
                  <span className="md:hidden">Nueva</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-[1400px] max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[90vh] flex flex-col overflow-hidden overflow-x-hidden p-3 sm:p-4 md:p-6 [&>button]:hidden">
              <DialogHeader className="flex-shrink-0 pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Ship className="h-4 w-4 sm:h-5 sm:w-5" />
                  Nueva Oferta a Importadora
                </DialogTitle>
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
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-y-contain pb-4 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="space-y-2 sm:space-y-3 pr-2 min-w-0 max-w-full">
                  {/* Seleccionar oferta cliente */}
                  <div className="space-y-1 sm:space-y-1.5">
                    <Label className="text-xs sm:text-sm">Oferta al Cliente *</Label>
                    <Select
                      value={selectedOfertaClienteId}
                      onValueChange={handleSelectOfertaCliente}
                    >
                      <SelectTrigger className="text-sm h-9 sm:h-10">
                        <SelectValue placeholder="Seleccionar oferta" />
                      </SelectTrigger>
                      <SelectContent>
                        {ofertasCliente.map((o) => (
                          <SelectItem key={o.id} value={o.id} className="text-sm">
                            {o.numero} - {(o.cliente?.nombreCompania || `${o.cliente?.nombre ?? ""} ${o.cliente?.apellidos ?? ""}`.trim())} ({formatCurrency(o.total)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleccionar importadora */}
                  <div className="space-y-1 sm:space-y-1.5 min-w-0">
                    <Label className="text-xs sm:text-sm">Importadora *</Label>
                    <Select
                      value={selectedImportadoraId}
                      onValueChange={setSelectedImportadoraId}
                    >
                      <SelectTrigger className="text-sm h-9 sm:h-10 max-w-full">
                        <SelectValue placeholder="Seleccionar importadora" className="truncate" />
                      </SelectTrigger>
                      <SelectContent>
                        {importadoras.map((imp) => (
                          <SelectItem key={imp.id} value={imp.id} className="text-sm max-w-[300px]">
                            <span className="truncate block">{imp.nombre}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Info de la oferta seleccionada */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 bg-slate-50 rounded-lg border">
                      <h4 className="font-medium mb-1.5 sm:mb-2 text-xs sm:text-sm">📋 Datos de la Oferta Cliente</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <div className="text-slate-600">Cliente:</div>
                        <div className="font-medium">
                          {selectedOfertaCliente?.cliente?.nombreCompania || `${selectedOfertaCliente?.cliente?.nombre ?? ""} ${selectedOfertaCliente?.cliente?.apellidos ?? ""}`.trim()}
                        </div>
                        <div className="text-slate-600">Productos:</div>
                        <div className="font-medium">{selectedOfertaCliente.items.length} items</div>
                        <div className="text-slate-600">Total acordado:</div>
                        <div className="font-bold text-slate-700">{formatCurrency(selectedOfertaCliente.total)}</div>
                      </div>
                    </div>
                  )}

                  {/* Número de oferta */}
                  <div className="space-y-1 sm:space-y-1.5">
                    <Label className="text-xs sm:text-sm">Número de Oferta</Label>
                    <Input
                      value={numeroOferta}
                      onChange={(e) => setNumeroOferta(e.target.value)}
                      placeholder="Ej: Z26001"
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>

                  {/* Fecha */}
                  <div className="space-y-1 sm:space-y-1.5">
                    <Label className="text-xs sm:text-sm">Fecha</Label>
                    <Input
                      type="date"
                      value={fechaOferta}
                      onChange={(e) => setFechaOferta(e.target.value)}
                      className="text-sm h-9 sm:h-10"
                    />
                  </div>

                  {/* Flete y Seguro */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 sm:space-y-3">
                      <h4 className="font-medium text-slate-700 text-xs sm:text-sm">Costos de Envío</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div className="space-y-1 sm:space-y-1.5">
                          <Label className="text-xs sm:text-sm">Flete ($)</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={flete}
                            onChange={(e) => setFlete(e.target.value)}
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1 sm:space-y-1.5">
                          <Label className="text-xs sm:text-sm flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={tieneSeguro}
                              onChange={(e) => setTieneSeguro(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            Seguro ($)
                          </Label>
                          {tieneSeguro && (
                            <Input
                              inputMode="decimal"
                              placeholder="0.00"
                              value={seguro}
                              onChange={(e) => setSeguro(e.target.value)}
                              className="h-9 sm:h-10 text-sm"
                            />
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Firma Cliente */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 md:p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="incluyeFirma"
                          checked={incluyeFirmaCliente}
                          onChange={(e) => setIncluyeFirmaCliente(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="incluyeFirma" className="cursor-pointer font-medium text-amber-800 text-xs sm:text-sm">
                          Incluir firma del cliente en la plantilla
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Tabla de productos editables */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border border-slate-200">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                        <h4 className="font-medium text-slate-700 text-xs sm:text-sm">📦 Productos</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto shrink-0 gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                          onClick={openAddItemDialog}
                        >
                          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Agregar producto
                        </Button>
                      </div>
                      {itemsEditables.length === 0 ? (
                        <p className="text-sm text-slate-500 py-2">
                          No hay productos en la lista. Pulsa «Agregar producto» para incluir ítems del catálogo o libres.
                        </p>
                      ) : (
                        <>
                          <div className="overflow-x-auto -mx-1 sm:-mx-2 md:mx-0">
                            <div className="inline-block min-w-full align-middle px-1 sm:px-2 md:px-0">
                              <Table className="min-w-full">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[150px] sm:min-w-[200px] md:min-w-[250px] text-xs sm:text-sm">Producto</TableHead>
                                    <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Cantidad</TableHead>
                                    <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">Precio Unit.</TableHead>
                                    <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Subtotal</TableHead>
                                    <TableHead className="w-12 sm:w-16 md:w-20 text-center text-xs sm:text-sm">Acción</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {itemsEditables.map((item, index) => {
                                    const cantidadParaCalculo = item.pesoNeto || item.cantidad;
                                    const subtotal = item.precioAjustado * cantidadParaCalculo;
                                    return (
                                      <TableRow key={item.id}>
                                        <TableCell className="font-medium py-2 sm:py-3">
                                          <div className="text-xs sm:text-sm md:text-base">
                                            {item.producto?.nombre ?? (item as any).nombreProducto ?? "—"}
                                            {!(item as any).productoId && <span className="ml-1 text-[10px] text-orange-500">(libre)</span>}
                                          </div>
                                          {item.codigoArancelario && (
                                            <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                              ({item.codigoArancelario})
                                            </div>
                                          )}
                                          <div className="sm:hidden text-xs text-slate-600 mt-1">
                                            {formatCurrencyUnitPrice(item.precioAjustado)} c/u
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm md:text-base py-2 sm:py-3">
                                          {cantidadParaCalculo.toLocaleString()} {umAbbrImportadoraItem(item, unidades)}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm md:text-base py-2 sm:py-3 hidden sm:table-cell">
                                          {formatCurrencyUnitPrice(item.precioAjustado)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium whitespace-nowrap text-xs sm:text-sm md:text-base py-2 sm:py-3">
                                          {formatCurrency(subtotal)}
                                        </TableCell>
                                        <TableCell className="text-center py-2 sm:py-3">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
                                            onClick={() => openEditItemDialogCreate(index)}
                                          >
                                            <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t text-xs sm:text-sm md:text-base">
                            <div className="flex justify-between font-medium">
                              <span>Subtotal Productos (FOB):</span>
                              <span className="text-xs sm:text-sm md:text-base">{formatCurrency(subtotalProductos)}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Resumen CIF y ajuste */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 md:p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2 sm:space-y-3">
                      <h4 className="font-medium text-emerald-800 text-xs sm:text-sm">Resumen CIF</h4>
                      
                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
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
                        <div className="flex justify-between font-bold text-emerald-700 text-sm sm:text-base">
                          <span>= CIF Total:</span>
                          <span>{formatCurrency(cifCalculado)}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label className="font-medium text-xs sm:text-sm">Ajustar Total CIF</Label>
                        <Input
                          placeholder={`Dejar vacío para ${formatCurrency(cifCalculado)}`}
                          value={totalCifDeseado}
                          onChange={(e) => setTotalCifDeseado(e.target.value)}
                          className="h-9 sm:h-10 text-sm"
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
                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 sm:pt-3 flex-shrink-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={saving || !selectedOfertaClienteId}
                      className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                    >
                      {saving ? "Creando..." : "Crear Oferta"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {/* Tabla de ofertas */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número, cliente, importadora, estado..."
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
                <TableHead>Desde Oferta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Importadora</TableHead>
                <TableHead>Productos</TableHead>
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
                  <TableCell colSpan={12} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : filteredOfertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                    {ofertas.length === 0 ? "No hay ofertas. Crea una desde una oferta al cliente." : "No hay resultados para la búsqueda"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOfertas.map((oferta) => (
                  <TableRow
                    key={oferta.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => openDetailDialog(oferta)}
                  >
                    <TableCell className="font-medium">{oferta.numero}</TableCell>
                    <TableCell>
                      {oferta.ofertaCliente ? (
                        <Badge variant="secondary" className="font-mono">
                          {oferta.ofertaCliente.numero}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {`${oferta.cliente?.nombre ?? ""} ${oferta.cliente?.apellidos ?? ""}`.trim()}
                    </TableCell>
                    <TableCell>
                      {oferta.importadora?.nombre || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm text-slate-700 truncate" title={formatProductos(oferta.items)}>
                        {formatProductos(oferta.items)}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(oferta.fecha)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(oferta.subtotalProductos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(oferta.flete)}</TableCell>
                    <TableCell className="text-right">{oferta.tieneSeguro ? formatCurrency(oferta.seguro) : '-'}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {formatCurrency(oferta.precioCIF)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={oferta.estado === "aceptada" ? "default" : "outline"}>
                        {oferta.estado}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
          {!loading && filteredOfertas.length > 0 && (
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-t bg-slate-50/50">
              <p className="text-xs sm:text-sm text-slate-500">
                <span className="hidden sm:inline">Mostrando </span>
                {start + 1}-{Math.min(start + PAGE_SIZE, filteredOfertas.length)} de {filteredOfertas.length}
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

      {/* Diálogo de detalle/edición */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="flex w-[94vw] max-w-[1320px] max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[min(92dvh,900px)] flex-col overflow-hidden overflow-x-hidden p-3 sm:p-6 [&>button]:hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <Ship className="h-5 w-5" />
                Oferta: {selectedOferta?.numero}
                {selectedOferta?.ofertaCliente && (
                  <Badge variant="outline" className="ml-2">
                    Desde: {selectedOferta?.ofertaCliente?.numero ?? "-"}
                  </Badge>
                )}
              </DialogTitle>
            <div className="flex flex-wrap justify-end gap-2 lg:flex-nowrap lg:items-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadPdf("ofertas-importadora", selectedOferta.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedOferta && exportApi.downloadExcel("ofertas-importadora", selectedOferta.id)}
                className="flex-1 sm:flex-initial"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button onClick={handleSaveChanges} size="sm" className="gap-2 flex-1 sm:flex-initial">
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

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-y-contain pb-4 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="space-y-3 sm:space-y-4 pr-2 min-w-0 max-w-full">
              {/* Info básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Cliente</Label>
                  <p className="font-medium text-xs sm:text-sm mt-1">
                    {selectedOferta?.cliente?.nombreCompania || `${selectedOferta?.cliente?.nombre || ""} ${selectedOferta?.cliente?.apellidos || ""}`.trim()}
                  </p>
                </div>
                <div className="min-w-0">
                  <Label className="text-slate-500 text-xs sm:text-sm">Importadora *</Label>
                  <Select
                    value={selectedOferta?.importadoraId || ""}
                    onValueChange={(value) => setSelectedOferta(prev => prev ? { ...prev, importadoraId: value } : null)}
                  >
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm max-w-full">
                      <SelectValue placeholder="Seleccionar importadora" className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      {importadoras.map((imp) => (
                        <SelectItem key={imp.id} value={imp.id} className="text-sm max-w-[300px]">
                          <span className="truncate block">{imp.nombre}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Número</Label>
                  <Input
                    className="mt-1 h-9 sm:h-10 text-sm"
                    value={selectedOferta?.numero || ""}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, numero: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Fecha</Label>
                  <Input
                    type="date"
                    className="mt-1 h-9 sm:h-10 text-sm"
                    value={selectedOferta?.fecha ? new Date(selectedOferta.fecha).toISOString().split('T')[0] : ""}
                    onChange={(e) => {
                      const fechaValue = e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString();
                      setSelectedOferta(prev => prev ? { ...prev, fecha: fechaValue } : null);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Estado</Label>
                  <Select
                    value={selectedOferta?.estado || "pendiente"}
                    onValueChange={(value) => setSelectedOferta(prev => prev ? { ...prev, estado: value } : null)}
                  >
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
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

              {/* Tabla de productos */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
                  <h4 className="font-medium text-sm sm:text-base">Productos</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={openAddItemDialog}
                    className="flex items-center gap-2 w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Agregar Producto
                  </Button>
                </div>
                {(() => {
                  const items = selectedOferta?.items || [];
                  const hasCantidadCajas = items.some(i => i.cantidadCajas);
                  const hasCantidadSacos = items.some(i => i.cantidadSacos);
                  const hasPesoXSaco = items.some(i => i.pesoXSaco);
                  const hasPrecioXSaco = items.some(i => i.precioXSaco);
                  const hasPesoXCaja = items.some(i => i.pesoXCaja);
                  const hasPrecioXCaja = items.some(i => i.precioXCaja);
                  
                  return (
                    <div className="min-w-0 max-w-full max-sm:[&_[data-slot=table-container]]:overscroll-x-contain">
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
                          <TableCell>{item.producto?.nombre ?? (item as any).nombreProducto ?? "—"}</TableCell>
                          <TableCell className="text-right">{item.pesoNeto || item.cantidad}</TableCell>
                          <TableCell>{umAbbrImportadoraItem(item, unidades)}</TableCell>
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
                            {formatCurrencyUnitPrice(item.precioAjustado)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {(() => {
                              const cantidad = item.pesoNeto || item.cantidad;
                              const precioRedondeado = Math.round(item.precioAjustado * 1000) / 1000;
                              const cantidadRedondeada = Math.round(cantidad * 100) / 100;
                              return formatCurrency(precioRedondeado * cantidadRedondeada);
                            })()}
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
                      ))}
                    </TableBody>
                  </Table>
                    </div>
                  );
                })()}
              </div>

              {/* Costos y Subtotal */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                {/* Costos de envío */}
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 sm:space-y-3 h-full">
                  <h4 className="font-medium text-slate-700 text-sm sm:text-base">Costos de Envío</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <Label className="text-xs sm:text-sm">Flete ($)</Label>
                      <Input
                        inputMode="decimal"
                        className="mt-1 h-9 sm:h-10 text-sm"
                        value={selectedOferta?.flete || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSelectedOferta(prev => prev ? { ...prev, flete: val } : null);
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedOferta?.tieneSeguro || false}
                          onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, tieneSeguro: e.target.checked } : null)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Seguro ($)
                      </Label>
                      {selectedOferta?.tieneSeguro && (
                        <Input
                          inputMode="decimal"
                          className="mt-1 h-9 sm:h-10 text-sm"
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

                {/* Resumen total */}
                <div className="w-full space-y-2 text-xs p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg h-full">
                  <div className="flex justify-between">
                    <span>FOB (productos):</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (selectedOferta?.items || []).reduce((sum, item) => {
                          const cantidad = item.pesoNeto || item.cantidad;
                          const precioRedondeado = Math.round(item.precioAjustado * 1000) / 1000;
                          const cantidadRedondeada = Math.round(cantidad * 100) / 100;
                          return sum + (precioRedondeado * cantidadRedondeada);
                        }, 0)
                      )}
                    </span>
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
                  <div className="flex justify-between text-sm sm:text-base font-bold text-emerald-700">
                    <span>= CIF Total:</span>
                    <span>
                      {formatCurrency(
                        (selectedOferta?.items || []).reduce((sum, item) => {
                          const cantidad = item.pesoNeto || item.cantidad;
                          const precioRedondeado = Math.round(item.precioAjustado * 1000) / 1000;
                          const cantidadRedondeada = Math.round(cantidad * 100) / 100;
                          return sum + (precioRedondeado * cantidadRedondeada);
                        }, 0) + (selectedOferta?.flete || 0) + (selectedOferta?.tieneSeguro ? (selectedOferta?.seguro || 0) : 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ajustar a total (solo debajo de subtotal) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3">
                <div className="hidden lg:block" />
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdjustPricesEdit((prev) => !prev)}
                    >
                      {showAdjustPricesEdit ? "Cancelar" : "Ajustar a Total"}
                    </Button>
                  </div>

                  {showAdjustPricesEdit && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 space-y-2">
                      <p className="text-xs sm:text-sm text-slate-600">
                        Ingresa el total deseado y los precios de los productos se ajustaran proporcionalmente.
                      </p>
                      <Label className="text-xs sm:text-sm font-medium">Total Deseado ($)</Label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          className="flex-1 h-9 sm:h-10 text-sm bg-white"
                          placeholder="Ej: 5000"
                          value={totalDeseadoEdit}
                          onChange={(e) => setTotalDeseadoEdit(e.target.value)}
                        />
                        <Button
                          onClick={handleAdjustPrices}
                          disabled={!totalDeseadoEdit || parseFloat(totalDeseadoEdit) <= 0}
                          className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                        >
                          Aplicar Ajuste
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Términos y método de pago para el documento (solo cuando hay oferta cliente y aún no estamos editando una oferta creada) */}
              {selectedOfertaCliente && !selectedOferta && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border space-y-2">
                    <h4 className="font-medium text-slate-700 text-xs sm:text-sm">
                      Términos y condiciones (documento)
                    </h4>
                    <textarea
                      className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                      value={terminosDocumentoTexto}
                      onChange={(e) => setTerminosDocumentoTexto(e.target.value)}
                    />
                  </div>
                  <div className="p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border space-y-2">
                    <h4 className="font-medium text-slate-700 text-xs sm:text-sm">
                      Método de pago (documento)
                    </h4>
                    <textarea
                      className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                      value={metodoPagoDocumentoTexto}
                      onChange={(e) => setMetodoPagoDocumentoTexto(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Términos y método de pago para el documento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                  <Label className="text-xs sm:text-sm">
                    Términos y condiciones (documento)
                  </Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                    value={
                      selectedOferta?.terminosDocumentoTexto && selectedOferta.terminosDocumentoTexto.trim() !== ""
                        ? selectedOferta.terminosDocumentoTexto
                        : defaultTerminosDocumentoTexto
                    }
                    onChange={(e) =>
                      setSelectedOferta(prev =>
                        prev ? { ...prev, terminosDocumentoTexto: e.target.value } : null
                      )
                    }
                  />
                </div>
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2">
                  <Label className="text-xs sm:text-sm">
                    Método de pago (documento)
                  </Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-xs sm:text-sm min-h-[140px] resize-y"
                    value={
                      selectedOferta?.metodoPagoDocumentoTexto && selectedOferta.metodoPagoDocumentoTexto.trim() !== ""
                        ? selectedOferta.metodoPagoDocumentoTexto
                        : defaultMetodoPagoDocumentoTexto
                    }
                    onChange={(e) =>
                      setSelectedOferta(prev =>
                        prev ? { ...prev, metodoPagoDocumentoTexto: e.target.value } : null
                      )
                    }
                  />
                </div>
              </div>

              {/* Firma Cliente */}
              <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIncluyeFirmaImportadora"
                    checked={selectedOferta?.incluyeFirmaCliente !== false}
                    onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, incluyeFirmaCliente: e.target.checked } : null)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="editIncluyeFirmaImportadora" className="cursor-pointer font-medium text-amber-800 text-xs sm:text-sm">
                    Incluir firma del cliente en la plantilla
                  </Label>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para editar/agregar item */}
      <Dialog open={editItemDialogOpen} onOpenChange={(open) => {
        setEditItemDialogOpen(open);
        if (!open) {
          setIsAddingNewItem(false);
          setEditingItemIndex(null);
        }
      }}>
        <DialogContent className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom)-1rem)] sm:max-h-[min(90dvh,800px)] w-[95vw] max-w-lg flex-col gap-4 overflow-y-auto overscroll-contain pr-2">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle>{isAddingNewItem ? "Agregar Producto" : "Editar Producto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={isAddingNewItem ? handleAddItem : (editingItemIndex !== null ? handleUpdateItemCreate : handleUpdateItem)} className="space-y-4 w-full min-h-0 pb-1">
            {/* Toggle catálogo / libre */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <button type="button" onClick={() => setEditItemModoLibre(false)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${!editItemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                Del catálogo
              </button>
              <button type="button" onClick={() => setEditItemModoLibre(true)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${editItemModoLibre ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                Producto libre
              </button>
            </div>
            {/* Selector de Producto o campos libres */}
            {!editItemModoLibre ? (
              <div className="space-y-2 w-full">
                <Label>Producto *</Label>
                <Select
                  value={editItemForm.productoId}
                  onValueChange={(value) => {
                    const producto = productos.find(p => p.id === value);
                    setEditItemForm(prev => ({
                      ...prev,
                      productoId: value,
                      precioUnitario: producto?.precioBase?.toString() || "",
                      codigoArancelario: producto?.codigoArancelario || "",
                    }));
                  }}
                >
                  <SelectTrigger className="w-full max-w-full overflow-hidden text-left">
                    <SelectValue placeholder="Selecciona un producto" className="truncate block" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {productos.filter(p => p.activo).map((producto) => (
                      <SelectItem key={producto.id} value={producto.id} className="truncate max-w-full">
                        <span className="truncate block">{producto.nombre}</span>
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
                    value={editItemForm.nombreProducto}
                    onChange={(e) => setEditItemForm(prev => ({ ...prev, nombreProducto: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Unidad de medida</Label>
                  <Select value={editItemForm.unidadMedidaId} onValueChange={(v) => setEditItemForm(prev => ({ ...prev, unidadMedidaId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar UM" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {/* Cantidad y Precio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div className="space-y-2 w-full min-w-0">
                <Label>Cantidad (LBS/KG) {isAddingNewItem && "*"}</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.cantidad}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidad: e.target.value }))}
                  placeholder="0"
                  required={isAddingNewItem}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label>{isAddingNewItem ? "Precio Unitario *" : "Precio Ajustado"}</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioUnitario}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioUnitario: e.target.value }))}
                  placeholder="0.00"
                  required={isAddingNewItem}
                  className="w-full"
                />
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-medium text-slate-500">Campos Informativos</Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">Cant. Cajas</Label>
                <Input
                  inputMode="numeric"
                  value={editItemForm.cantidadCajas}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidadCajas: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">Cant. Sacos</Label>
                <Input
                  inputMode="numeric"
                  value={editItemForm.cantidadSacos}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, cantidadSacos: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">Peso/Saco</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.pesoXSaco}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, pesoXSaco: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">$/Saco</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioXSaco}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioXSaco: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">Peso/Caja</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.pesoXCaja}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, pesoXCaja: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-sm">$/Caja</Label>
                <Input
                  inputMode="decimal"
                  value={editItemForm.precioXCaja}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, precioXCaja: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 col-span-2 w-full min-w-0">
                <Label className="text-sm">Código Arancelario</Label>
                <Input
                  value={editItemForm.codigoArancelario}
                  onChange={(e) => setEditItemForm(prev => ({ ...prev, codigoArancelario: e.target.value }))}
                  placeholder="Ej: M1500CIULB"
                  className="w-full"
                />
              </div>
            </div>

            {/* Campos opcionales dinámicos */}
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
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input
                        placeholder="Label (ej: Cant. x Contenedor)"
                        value={field.label}
                        onChange={(e) => updateEditExtraField(field.id, "label", e.target.value)}
                        className="h-8 text-sm px-2"
                      />
                      <Input
                        placeholder="Valor"
                        value={field.value}
                        onChange={(e) => updateEditExtraField(field.id, "value", e.target.value)}
                        className="h-8 text-sm px-2"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEditExtraField(field.id)}
                        className="h-8 w-8 shrink-0"
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEditItemDialogOpen(false);
                  setIsAddingNewItem(false);
                  setEditingItemIndex(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {isAddingNewItem ? "Agregar" : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para exportar con rango de fechas */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Ofertas a Importadora</DialogTitle>
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
                    await exportApi.exportAllOfertasImportadora(
                      fechaDesde || undefined,
                      fechaHasta || undefined
                    );
                    toast.success("Ofertas a importadora exportadas correctamente");
                    setExportDialogOpen(false);
                    setFechaDesde("");
                    setFechaHasta("");
                  } catch (error) {
                    toast.error("Error al exportar ofertas a importadora");
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
