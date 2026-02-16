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
import { Plus, Trash2, FileDown, Eye, FileSpreadsheet, Ship, ArrowRight, Pencil, Save, Download } from "lucide-react";
import { 
  ofertasImportadoraApi, 
  ofertasClienteApi, 
  clientesApi, 
  productosApi, 
  exportApi,
  importadorasApi
} from "@/lib/api";
import type { 
  OfertaImportadora, 
  OfertaCliente, 
  Cliente, 
  Producto,
  Importadora
} from "@/lib/api";

export default function OfertasImportadoraPage(): React.ReactElement {
  const [ofertas, setOfertas] = useState<OfertaImportadora[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [saving, setSaving] = useState(false);
  
  // Estado para diálogo de exportación con rango de fechas
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Estado para ajustar precios en edición
  const [totalDeseadoEdit, setTotalDeseadoEdit] = useState("");

  // Estado para editar item existente
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [editItemForm, setEditItemForm] = useState({
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

  // Estado para items editables en creación
  const [itemsEditables, setItemsEditables] = useState<Array<{
    id: string; // id temporal para React keys
    productoId: string;
    producto: Producto;
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
  }>>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  async function loadData(): Promise<void> {
    try {
      const [ofertasData, ofertasClienteData, clientesData, importadorasData, productosData] = await Promise.all([
        ofertasImportadoraApi.getAll(),
        ofertasClienteApi.getAll(),
        clientesApi.getAll(),
        importadorasApi.getAll(),
        productosApi.getAll(),
      ]);
      setOfertas(ofertasData);
      // Filtrar ofertas cliente que no estén rechazadas ni vencidas
      setOfertasCliente(ofertasClienteData.filter(o => o.estado !== 'rechazada' && o.estado !== 'vencida'));
      setClientes(clientesData);
      setImportadoras(importadorasData);
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
    
    // Cargar items de la oferta cliente para edición
    if (oferta && oferta.items) {
      const itemsCargados = oferta.items.map((item, index) => ({
        id: `temp-${index}-${Date.now()}`,
        productoId: item.productoId,
        producto: item.producto,
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

    setSaving(true);

    try {
      const cifDeseado = parseFloat(totalCifDeseado);
      
      // Preparar items para enviar (convertir a formato del API)
      const itemsParaEnviar = itemsEditables.map(item => {
        // Validar que cantidad y precios sean válidos
        if (item.cantidad <= 0) {
          throw new Error(`La cantidad del producto ${item.producto.nombre} debe ser mayor a 0`);
        }
        if (item.precioUnitario <= 0) {
          throw new Error(`El precio unitario del producto ${item.producto.nombre} debe ser mayor a 0`);
        }
        if (item.precioAjustado <= 0) {
          throw new Error(`El precio ajustado del producto ${item.producto.nombre} debe ser mayor a 0`);
        }
        
        return {
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario, // Precio original
          precioAjustado: item.precioAjustado, // Precio ajustado (puede ser diferente)
          cantidadCajas: item.cantidadCajas ?? null,
          cantidadSacos: item.cantidadSacos ?? null,
          pesoNeto: item.pesoNeto ?? null,
          pesoBruto: item.pesoBruto ?? null,
          pesoXSaco: item.pesoXSaco ?? null,
          precioXSaco: item.precioXSaco ?? null,
          pesoXCaja: item.pesoXCaja ?? null,
          precioXCaja: item.precioXCaja ?? null,
          codigoArancelario: item.codigoArancelario ?? null,
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
    setEditingItemIndex(null); // Asegurar que no estamos en modo creación
    setIsAddingNewItem(false);
    setEditItemForm({
      productoId: item.productoId,
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
    setEditItemDialogOpen(true);
  }

  function openAddItemDialog(): void {
    setEditingItemId(null);
    setEditingItemIndex(null);
    setIsAddingNewItem(true);
    setEditItemForm({
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
    setEditItemDialogOpen(true);
  }

  // Guardar cambios de item
  async function handleUpdateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedOferta || !editingItemId) return;

    try {
      const itemData = {
        cantidad: editItemForm.cantidad ? parseFloat(editItemForm.cantidad) : undefined,
        // Enviar precio ajustado si fue modificado
        precioAjustado: editItemForm.precioUnitario ? parseFloat(editItemForm.precioUnitario) : undefined,
        cantidadCajas: editItemForm.cantidadCajas ? parseInt(editItemForm.cantidadCajas) : undefined,
        cantidadSacos: editItemForm.cantidadSacos ? parseInt(editItemForm.cantidadSacos) : undefined,
        pesoXSaco: editItemForm.pesoXSaco ? parseFloat(editItemForm.pesoXSaco) : undefined,
        precioXSaco: editItemForm.precioXSaco ? parseFloat(editItemForm.precioXSaco) : undefined,
        pesoXCaja: editItemForm.pesoXCaja ? parseFloat(editItemForm.pesoXCaja) : undefined,
        precioXCaja: editItemForm.precioXCaja ? parseFloat(editItemForm.precioXCaja) : undefined,
        codigoArancelario: editItemForm.codigoArancelario || undefined,
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
    if (!selectedOferta || !editItemForm.productoId || !editItemForm.cantidad || !editItemForm.precioUnitario) {
      toast.error("Completa los campos requeridos: Producto, Cantidad y Precio");
      return;
    }

    try {
      const productoSeleccionado = productos.find(p => p.id === editItemForm.productoId);
      if (!productoSeleccionado) {
        toast.error("Producto no encontrado");
        return;
      }

      const itemData = {
        productoId: editItemForm.productoId,
        cantidad: parseFloat(editItemForm.cantidad),
        precioUnitario: parseFloat(editItemForm.precioUnitario),
        cantidadCajas: editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== '' ? parseInt(editItemForm.cantidadCajas) : undefined,
        cantidadSacos: editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== '' ? parseInt(editItemForm.cantidadSacos) : undefined,
        pesoXSaco: editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== '' ? parseFloat(editItemForm.pesoXSaco) : undefined,
        precioXSaco: editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== '' ? parseFloat(editItemForm.precioXSaco) : undefined,
        pesoXCaja: editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== '' ? parseFloat(editItemForm.pesoXCaja) : undefined,
        precioXCaja: editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== '' ? parseFloat(editItemForm.precioXCaja) : undefined,
        codigoArancelario: editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== '' ? editItemForm.codigoArancelario : (productoSeleccionado.codigoArancelario || undefined),
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
    const nombres = primerosDos.map(item => item.producto.nombre).join(", ");
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
    setEditItemForm({
      productoId: item.productoId,
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
    setEditItemDialogOpen(true);
  }

  function handleUpdateItemCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (editingItemIndex === null) return Promise.resolve();

    const updatedItems = [...itemsEditables];
    const item = updatedItems[editingItemIndex];
    
    const cantidad = parseFloat(editItemForm.cantidad) || item.cantidad;
    const precioAjustado = parseFloat(editItemForm.precioUnitario) || item.precioAjustado;
    
    updatedItems[editingItemIndex] = {
      ...item,
      cantidad,
      precioAjustado, // Precio ajustado puede ser diferente al original
      cantidadCajas: editItemForm.cantidadCajas && editItemForm.cantidadCajas.trim() !== '' ? parseInt(editItemForm.cantidadCajas) : null,
      cantidadSacos: editItemForm.cantidadSacos && editItemForm.cantidadSacos.trim() !== '' ? parseInt(editItemForm.cantidadSacos) : null,
      pesoNeto: cantidad !== item.cantidad ? cantidad : item.pesoNeto,
      pesoXSaco: editItemForm.pesoXSaco && editItemForm.pesoXSaco.trim() !== '' ? parseFloat(editItemForm.pesoXSaco) : null,
      precioXSaco: editItemForm.precioXSaco && editItemForm.precioXSaco.trim() !== '' ? parseFloat(editItemForm.precioXSaco) : null,
      pesoXCaja: editItemForm.pesoXCaja && editItemForm.pesoXCaja.trim() !== '' ? parseFloat(editItemForm.pesoXCaja) : null,
      precioXCaja: editItemForm.precioXCaja && editItemForm.precioXCaja.trim() !== '' ? parseFloat(editItemForm.precioXCaja) : null,
      codigoArancelario: editItemForm.codigoArancelario && editItemForm.codigoArancelario.trim() !== '' ? editItemForm.codigoArancelario : null,
    };
    
    setItemsEditables(updatedItems);
    setEditItemDialogOpen(false);
    setEditingItemIndex(null);
    setEditItemForm({
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
            <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-[1400px] max-h-[90vh] flex flex-col overflow-hidden p-3 sm:p-4 md:p-6">
              <DialogHeader className="flex-shrink-0 pb-2 sm:pb-3">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Ship className="h-4 w-4 sm:h-5 sm:w-5" />
                  Nueva Oferta a Importadora
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-2 sm:space-y-3 pr-2">
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
                            {o.numero} - {o.cliente.nombre} ({formatCurrency(o.total)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleccionar importadora */}
                  <div className="space-y-1 sm:space-y-1.5">
                    <Label className="text-xs sm:text-sm">Importadora *</Label>
                    <Select
                      value={selectedImportadoraId}
                      onValueChange={setSelectedImportadoraId}
                    >
                      <SelectTrigger className="text-sm h-9 sm:h-10">
                        <SelectValue placeholder="Seleccionar importadora" />
                      </SelectTrigger>
                      <SelectContent>
                        {importadoras.map((imp) => (
                          <SelectItem key={imp.id} value={imp.id} className="text-sm">
                            {imp.nombre}
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
                        <div className="font-medium">{selectedOfertaCliente.cliente.nombre}</div>
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

                  {/* Términos */}
                  {selectedOfertaCliente && (
                    <div className="p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border space-y-2 sm:space-y-3">
                      <h4 className="font-medium text-slate-700 text-xs sm:text-sm">Términos</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Puerto de Embarque</Label>
                          <Input
                            value={puertoEmbarque}
                            onChange={(e) => setPuertoEmbarque(e.target.value)}
                            placeholder="NEW ORLEANS, LA"
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Origen</Label>
                          <Input
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            placeholder="ESTADOS UNIDOS"
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Moneda</Label>
                          <Input
                            value={moneda}
                            onChange={(e) => setMoneda(e.target.value)}
                            placeholder="USD"
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs sm:text-sm">Términos de Pago</Label>
                          <Input
                            value={terminosPago}
                            onChange={(e) => setTerminosPago(e.target.value)}
                            placeholder="100% antes del embarque"
                            className="h-9 sm:h-10 text-sm"
                          />
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
                  {selectedOfertaCliente && itemsEditables.length > 0 && (
                    <div className="p-2 sm:p-3 md:p-4 bg-white rounded-lg border border-slate-200">
                      <h4 className="font-medium mb-2 sm:mb-3 text-slate-700 text-xs sm:text-sm">📦 Productos</h4>
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
                                      {item.producto.nombre}
                                    </div>
                                    {item.codigoArancelario && (
                                      <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                        ({item.codigoArancelario})
                                      </div>
                                    )}
                                    {/* Mostrar precio en móvil dentro de la celda de producto */}
                                    <div className="sm:hidden text-xs text-slate-600 mt-1">
                                      {formatCurrencyUnitPrice(item.precioAjustado)} c/u
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right whitespace-nowrap text-xs sm:text-sm md:text-base py-2 sm:py-3">
                                    {cantidadParaCalculo.toLocaleString()} {item.producto.unidadMedida.abreviatura}
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
              ) : ofertas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-slate-500">
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
                    <TableCell>
                      {`${oferta.cliente.nombre || ""} ${oferta.cliente.apellidos || ""}`.trim()}
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

      {/* Diálogo de detalle/edición */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Ship className="h-5 w-5" />
              Oferta: {selectedOferta?.numero}
              {selectedOferta?.ofertaCliente && (
                <Badge variant="outline" className="ml-2">
                  Desde: {selectedOferta.ofertaCliente.numero}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3 sm:space-y-4 pr-2">
              {/* Info básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Cliente</Label>
                  <p className="font-medium text-xs sm:text-sm mt-1">
                    {`${selectedOferta?.cliente.nombre || ""} ${selectedOferta?.cliente.apellidos || ""}`.trim()}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs sm:text-sm">Importadora *</Label>
                  <Select
                    value={selectedOferta?.importadoraId || ""}
                    onValueChange={(value) => setSelectedOferta(prev => prev ? { ...prev, importadoraId: value } : null)}
                  >
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue placeholder="Seleccionar importadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {importadoras.map((imp) => (
                        <SelectItem key={imp.id} value={imp.id} className="text-sm">
                          {imp.nombre}
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

              {/* Flete, Seguro y Ajuste */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                {/* Costos de envío */}
                <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 sm:space-y-3">
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

                {/* Ajustar al total */}
                <div className="p-3 sm:p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2 sm:space-y-3">
                  <h4 className="font-medium text-emerald-800 text-sm sm:text-base">Ajustar al Total CIF</h4>
                  <p className="text-xs text-slate-600">
                    Si quieres que el CIF sea un valor específico, escríbelo aquí. Los precios de los productos se ajustarán.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      className="flex-1 h-9 sm:h-10 text-sm"
                      placeholder={`Actual: ${formatCurrency(selectedOferta?.precioCIF || 0)}`}
                      value={totalDeseadoEdit}
                      onChange={(e) => setTotalDeseadoEdit(e.target.value)}
                    />
                    <Button 
                      onClick={handleAdjustPrices}
                      disabled={!totalDeseadoEdit || parseFloat(totalDeseadoEdit) <= 0}
                      className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                    >
                      Ajustar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Términos */}
              <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border space-y-2 sm:space-y-3">
                <h4 className="font-medium text-slate-700 text-sm sm:text-base">Términos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">Puerto Embarque</Label>
                    <Input
                      className="mt-1 h-9 sm:h-10 text-sm"
                      value={selectedOferta?.puertoEmbarque || ""}
                      onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, puertoEmbarque: e.target.value } : null)}
                      placeholder="NEW ORLEANS, LA"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Origen</Label>
                    <Input
                      className="mt-1 h-9 sm:h-10 text-sm"
                      value={selectedOferta?.origen || ""}
                      onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, origen: e.target.value } : null)}
                      placeholder="ESTADOS UNIDOS"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Moneda</Label>
                    <Input
                      className="mt-1 h-9 sm:h-10 text-sm"
                      value={selectedOferta?.moneda || ""}
                      onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, moneda: e.target.value } : null)}
                      placeholder="USD"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Términos de Pago</Label>
                    <Input
                      className="mt-1 h-9 sm:h-10 text-sm"
                      value={selectedOferta?.terminosPago || ""}
                      onChange={(e) => setSelectedOferta(prev => prev ? { ...prev, terminosPago: e.target.value } : null)}
                      placeholder="100% antes del embarque"
                    />
                  </div>
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

            <Separator />

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
                    <div className="overflow-x-auto">
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

              {/* Resumen totales */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 space-y-2 text-xs sm:text-sm p-3 sm:p-4 bg-emerald-50 rounded-lg">
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
                <div className="flex justify-between text-base sm:text-lg font-bold text-emerald-700">
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
        <DialogContent className="w-full max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>{isAddingNewItem ? "Agregar Producto" : "Editar Producto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={isAddingNewItem ? handleAddItem : (editingItemIndex !== null ? handleUpdateItemCreate : handleUpdateItem)} className="space-y-4 w-full overflow-hidden">
            {/* Selector de Producto (solo al agregar) */}
            {isAddingNewItem && (
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
                    <SelectValue 
                      placeholder="Selecciona un producto" 
                      className="truncate block"
                    />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {productos.filter(p => p.activo).map((producto) => (
                      <SelectItem 
                        key={producto.id} 
                        value={producto.id}
                        className="truncate max-w-full"
                      >
                        <span className="truncate block">{producto.nombre}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
