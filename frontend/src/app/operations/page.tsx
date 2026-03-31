"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Eye, Search, Package, Ship, Trash2, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MoreHorizontal, RefreshCw, Anchor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { operationsApi, ofertasClienteApi, importadorasApi } from "@/lib/api";
import type { Operation, OperationContainer, OfertaCliente, Importadora } from "@/lib/api";
import { operationRowLabel } from "@/lib/operation-display";

// Estados considerados como inactivos/completados
const INACTIVE_STATUSES = ["Delivered", "Closed", "Cancelled"];

// Status colors — colores más distinguibles por fase
const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "Booking Confirmed": "bg-blue-100 text-blue-700",
  "Container Assigned": "bg-violet-100 text-violet-700",
  Loaded: "bg-amber-200 text-amber-800",
  "Gate In (Port)": "bg-orange-200 text-orange-800",
  "BL Final Issued": "bg-indigo-200 text-indigo-800",
  "Departed US": "bg-sky-200 text-sky-800",
  "Departed Brazil": "bg-sky-200 text-sky-800",
  "Arrived Cuba": "bg-green-200 text-green-800",
  Customs: "bg-yellow-200 text-yellow-800",
  Released: "bg-emerald-200 text-emerald-800",
  Delivered: "bg-green-600 text-white",
  Closed: "bg-gray-400 text-white",
  Cancelled: "bg-red-500 text-white",
};

// Helper para obtener ubicación sugerida basada en estado
function getSuggestedLocation(status: string): string {
  const locationMap: Record<string, string> = {
    "Draft": "En preparación",
    "Booking Confirmed": "En preparación",
    "Container Assigned": "En preparación",
    "Loaded": "Almacén",
    "Gate In (Port)": "En puerto (origen)",
    "BL Final Issued": "En puerto (origen)",
    "Departed US": "En tránsito",
    "Departed Brazil": "En tránsito",
    "Arrived Cuba": "Puerto de destino",
    "Customs": "Aduana",
    "Released": "Liberado",
    "Delivered": "Entregado",
    "Closed": "Entregado",
    "Cancelled": "Cancelado",
  };
  return locationMap[status] || "Sin ubicación";
}

// Helper para obtener ubicación a mostrar (sugerida si no hay definida)
function getDisplayLocation(container: OperationContainer, operation: Operation): string {
  if (container.currentLocation && container.currentLocation.trim() !== "") {
    return container.currentLocation;
  }
  if (operation.currentLocation && operation.currentLocation.trim() !== "") {
    return operation.currentLocation;
  }
  return getSuggestedLocation(container.status);
}

function formatDateShort(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");
}

function formatDateFull(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}

function formatETD(container: OperationContainer): string {
  return formatDateShort(container.etdEstimated || container.etdActual);
}

function formatETA(container: OperationContainer): string {
  return formatDateFull(container.etaEstimated || container.etaActual);
}

function getLastUpdate(container: OperationContainer): string {
  const raw = container.trackingLastEventAt
    || container.trackingLastSyncAt
    || (container.events && container.events.length > 0 ? container.events[0].eventDate : null)
    || container.updatedAt;
  return formatDateShort(raw);
}

export default function OperationsPage(): React.ReactElement {
  const router = useRouter();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterType, setFilterType] = useState<"COMMERCIAL" | "PARCEL" | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true); // Por defecto solo activas
  
  // Sorting - column-based with direction
  type SortColumn =
    | "type"
    | "operation"
    | "container"
    | "booking"
    | "bl"
    | "etd"
    | "eta"
    | "status"
    | "last-update"
    | "importadora"
    | null;
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>("eta");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOfertaId, setSelectedOfertaId] = useState("");
  const [selectedImportadoraId, setSelectedImportadoraId] = useState("");
  const [operationType, setOperationType] = useState<"COMMERCIAL" | "PARCEL">("COMMERCIAL");
  /** Referencia visible al crear Parcel (BL, booking, nota) antes de cargar contenedor */
  const [parcelReferencia, setParcelReferencia] = useState("");
  
  // Auto-refresh (cada 30 segundos)
  const AUTO_REFRESH_INTERVAL = 30000;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten containers for table display
  const containerRows: Array<{
    operation: Operation;
    container: OperationContainer;
    isFirstContainer: boolean; // Para mostrar botón de eliminar solo en el primer contenedor
  }> = operations.flatMap((op) =>
    (op.containers || []).map((container, index) => ({
      operation: op,
      container,
      isFirstContainer: index === 0,
    }))
  );

  // Función para manejar clic en header de columna
  function handleSortClick(column: SortColumn): void {
    if (sortColumn === column) {
      // Si es la misma columna, cambiar dirección
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        // Tercer clic: volver a default (ETA asc)
        setSortColumn("eta");
        setSortDirection("asc");
      }
    } else {
      // Nueva columna: empezar con ascendente
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  // Función de ordenamiento
  function sortContainerRows(rows: typeof containerRows): typeof containerRows {
    if (!sortColumn) {
      // Default: ETA ascendente
      return sortByColumn(rows, "eta", "asc");
    }
    return sortByColumn(rows, sortColumn, sortDirection);
  }

  // Función auxiliar para ordenar por columna y dirección
  function sortByColumn(
    rows: typeof containerRows,
    column: SortColumn,
    direction: SortDirection
  ): typeof containerRows {
    return [...rows].sort((a, b) => {
      let comparison = 0;

      switch (column) {
        case "type": {
          comparison = a.operation.operationType.localeCompare(b.operation.operationType);
          break;
        }

        case "operation": {
          const labelA = operationRowLabel(a.operation, a.container);
          const labelB = operationRowLabel(b.operation, b.container);
          comparison = labelA.localeCompare(labelB);
          break;
        }

        case "container": {
          const containerA = a.container.containerNo || "";
          const containerB = b.container.containerNo || "";
          comparison = containerA.localeCompare(containerB);
          break;
        }

        case "booking": {
          const bookingA = a.container.bookingNo || "";
          const bookingB = b.container.bookingNo || "";
          comparison = bookingA.localeCompare(bookingB);
          break;
        }

        case "bl": {
          const blA = a.container.blNo || "";
          const blB = b.container.blNo || "";
          comparison = blA.localeCompare(blB);
          break;
        }

        case "etd": {
          const etdA = a.container.etdEstimated || a.container.etdActual;
          const etdB = b.container.etdEstimated || b.container.etdActual;
          
          // Si ambos tienen ETD, comparar
          if (etdA && etdB) {
            comparison = new Date(etdA).getTime() - new Date(etdB).getTime();
          } else if (etdA && !etdB) {
            comparison = -1; // A va primero
          } else if (!etdA && etdB) {
            comparison = 1; // B va primero
          } else {
            comparison = 0; // Ambos nulos, mantener orden
          }
          break;
        }

        case "eta": {
          const etaA = a.container.etaEstimated || a.container.etaActual;
          const etaB = b.container.etaEstimated || b.container.etaActual;
          
          // Si ambos tienen ETA, comparar
          if (etaA && etaB) {
            comparison = new Date(etaA).getTime() - new Date(etaB).getTime();
          } else if (etaA && !etaB) {
            comparison = -1; // A va primero
          } else if (!etaA && etaB) {
            comparison = 1; // B va primero
          } else {
            comparison = 0; // Ambos nulos, mantener orden
          }
          break;
        }

        case "status": {
          comparison = a.container.status.localeCompare(b.container.status);
          break;
        }

        case "last-update": {
          const lastUpdateA = a.container.trackingLastSyncAt
            ? new Date(a.container.trackingLastSyncAt).getTime()
            : a.container.events && a.container.events.length > 0
              ? new Date(a.container.events[0].eventDate).getTime()
              : new Date(a.container.updatedAt).getTime();
          const lastUpdateB = b.container.trackingLastSyncAt
            ? new Date(b.container.trackingLastSyncAt).getTime()
            : b.container.events && b.container.events.length > 0
              ? new Date(b.container.events[0].eventDate).getTime()
              : new Date(b.container.updatedAt).getTime();
          comparison = lastUpdateA - lastUpdateB;
          break;
        }

        case "importadora": {
          const importadoraA = a.operation.importadora?.nombre || "";
          const importadoraB = b.operation.importadora?.nombre || "";
          comparison = importadoraA.localeCompare(importadoraB);
          break;
        }

        default:
          return 0;
      }

      // Aplicar dirección
      return direction === "asc" ? comparison : -comparison;
    });
  }

  // Filtrar por estado activo/inactivo
  const filteredContainerRows = showOnlyActive
    ? containerRows.filter(({ container }) => !INACTIVE_STATUSES.includes(container.status))
    : containerRows;

  // Aplicar ordenamiento
  const sortedContainerRows = sortContainerRows(filteredContainerRows);

  const totalPages = Math.max(1, Math.ceil(sortedContainerRows.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = sortedContainerRows.slice(start, start + PAGE_SIZE);

  // Función para refrescar solo operaciones (para auto-refresh)
  const refreshOperations = useCallback(async (): Promise<void> => {
    try {
      const params: Record<string, string> = {};
      if (filterType !== "all") params.type = filterType;
      if (filterStatus !== "all") params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      
      const data = await operationsApi.getAll(params);
      setOperations(data);
    } catch (error) {
      console.error("Error al refrescar operaciones:", error);
    }
  }, [filterType, filterStatus, searchTerm]);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [filterType, filterStatus, searchTerm]);

  // Resetear página al cambiar filtro "Solo activas"
  useEffect(() => {
    setCurrentPage(1);
  }, [showOnlyActive]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refreshOperations();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshOperations]);

  async function loadData(): Promise<void> {
    setLoading(true);
    setCurrentPage(1);
    try {
      const params: Record<string, string> = {};
      if (filterType !== "all") params.type = filterType;
      if (filterStatus !== "all") params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      
      const data = await operationsApi.getAll(params);
      setOperations(data);
      
      // Load ofertas and importadoras for creation dialog
      const [ofertas, importadorasData] = await Promise.all([
        ofertasClienteApi.getAll(),
        importadorasApi.getAll(),
      ]);
      setOfertasCliente(ofertas);
      setImportadoras(importadorasData);
      if (importadorasData.length > 0 && !selectedImportadoraId) {
        setSelectedImportadoraId(importadorasData[0].id);
      }
    } catch (error) {
      toast.error("Error al cargar operaciones");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFromOffer(): Promise<void> {
    if (!selectedOfertaId) {
      toast.error("Selecciona una oferta");
      return;
    }
    
    if (!selectedImportadoraId) {
      toast.error("Selecciona una importadora");
      return;
    }
    
    try {
      const op = await operationsApi.createFromOffer(selectedOfertaId, selectedImportadoraId);
      toast.success("Operación creada");
      setCreateDialogOpen(false);
      setSelectedOfertaId("");
      loadData();
      router.push(`/operations/${op.id}`);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("Ya existe una operación para esta oferta")) {
        toast.error("Ya existe una operación creada para esta oferta. Te llevo a ella.");
        // Buscar esa operación en la tabla actual si está cargada
        const existing = containerRows.find(
          (row) => row.operation.offerCustomerId === selectedOfertaId
        );
        if (existing) {
          setCreateDialogOpen(false);
          router.push(`/operations/${existing.operation.id}`);
        }
      } else {
        toast.error(message || "Error al crear operación");
        console.error(error);
      }
    }
  }

  async function handleCreateManual(): Promise<void> {
    if (!selectedImportadoraId) {
      toast.error("Selecciona una importadora");
      return;
    }
    
    try {
      await operationsApi.create({
        operationType,
        importadoraId: selectedImportadoraId,
        status: "Draft",
        ...(operationType === "PARCEL" && parcelReferencia.trim()
          ? { referenciaOperacion: parcelReferencia.trim() }
          : {}),
      });
      toast.success("Operación creada");
      setCreateDialogOpen(false);
      setParcelReferencia("");
      setOperationType("COMMERCIAL");
      loadData();
    } catch (error) {
      toast.error("Error al crear operación");
      console.error(error);
    }
  }

  function handleViewDetail(operationId: string): void {
    const qp = new URLSearchParams();
    // Pasar contexto de filtros para navegación prev/next en detalle
    if (!showOnlyActive) qp.append("soloActivas", "0");
    if (filterType !== "all") qp.append("type", filterType);
    if (filterStatus !== "all") qp.append("status", filterStatus);
    const query = qp.toString();
    router.push(`/operations/${operationId}${query ? `?${query}` : ""}`);
  }

  function handleTracking(operation: Operation, container: OperationContainer): void {
    if (!container.containerNo) {
      toast.error("El contenedor no tiene número asignado.");
      return;
    }

    if (!operation.carrier || !operation.carrier.trackingUrlTemplate) {
      toast.error("La operación no tiene carrier configurado con URL de tracking.");
      return;
    }

    const template = operation.carrier.trackingUrlTemplate;
    const url = template.replace(
      "{container}",
      encodeURIComponent(container.containerNo)
    );

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const [syncingTerminal49, setSyncingTerminal49] = useState(false);
  const [syncingGlobal, setSyncingGlobal] = useState(false);

  async function handleGlobalSync(): Promise<void> {
    setSyncingGlobal(true);
    try {
      const res = await fetch("/api/terminal49/global-sync");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Error en sync global");
        return;
      }
      toast.success(
        data.processed != null
          ? `Sync global: ${data.processed} procesados, ${data.skipped ?? 0} omitidos, ${data.updated ?? 0} contenedores actualizados`
          : "Sync global completado"
      );
      await loadData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error en sync global");
    } finally {
      setSyncingGlobal(false);
    }
  }

  async function handleSyncTerminal49(operationId: string): Promise<void> {
    setSyncingTerminal49(true);
    try {
      const result = await operationsApi.syncTerminal49(operationId);
      toast.success(
        `Sincronizado: ${result.containersUpdated}/${result.containersProcessed} contenedores`
      );
      await loadData();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error al sincronizar con Terminal49"
      );
    } finally {
      setSyncingTerminal49(false);
    }
  }

  async function handleDeleteClick(operationId: string): Promise<void> {
    const operation = operations.find(op => op.id === operationId);
    const confirmMessage = operation
      ? `¿Estás seguro de eliminar la operación ${operation.operationNo}?\n\nEsta acción no se puede deshacer. Se eliminará la operación y todos sus contenedores y eventos asociados.`
      : "¿Estás seguro de eliminar esta operación? Esta acción no se puede deshacer.";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      await operationsApi.delete(operationId);
      toast.success("Operación eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar operación");
      console.error(error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1920px]">
      <Header
        title="Operations Board"
        description="Tracking de operaciones (comercial y Parcel)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleGlobalSync}
              disabled={syncingGlobal}
              title="Sincronización global con Terminal49 (tracking requests actualizados desde LAST_SYNC)"
            >
              <Ship className="h-4 w-4 mr-2" />
              {syncingGlobal ? "Sincronizando…" : "Tracking global"}
            </Button>
            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open);
                if (!open) setParcelReferencia("");
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Operación
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nueva Operación</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Operación</Label>
                  <Select
                    value={operationType}
                    onValueChange={(value) => {
                      setOperationType(value as "COMMERCIAL" | "PARCEL");
                      if (value === "COMMERCIAL") setParcelReferencia("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMMERCIAL">Comercial (desde Oferta)</SelectItem>
                      <SelectItem value="PARCEL">Parcel (Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Importadora *</Label>
                  <Select value={selectedImportadoraId} onValueChange={setSelectedImportadoraId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar importadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {importadoras.map((imp) => (
                        <SelectItem key={imp.id} value={imp.id}>
                          {imp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {operationType === "COMMERCIAL" ? (
                  <div>
                    <Label>Oferta a Cliente *</Label>
                    <Select value={selectedOfertaId} onValueChange={setSelectedOfertaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar oferta" />
                      </SelectTrigger>
                      <SelectContent>
                        {ofertasCliente.map((oferta) => (
                          <SelectItem key={oferta.id} value={oferta.id}>
                            {oferta.numero} - {oferta.cliente.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleCreateFromOffer} className="mt-4 w-full">
                      Crear desde Oferta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label>Referencia (opcional)</Label>
                      <Input
                        value={parcelReferencia}
                        onChange={(e) => setParcelReferencia(e.target.value)}
                        placeholder="Ej. BL, booking o nota hasta tener contenedor"
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        El número interno PKG se sigue generando; aquí defines lo que quieres ver en Operación.
                      </p>
                    </div>
                    <Button onClick={handleCreateManual} className="w-full">
                      Crear Operación Parcel
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Filters — apilado en móvil; grid en tablet; fila flexible en desktop */}
      <div className="mb-6 space-y-4 rounded-lg bg-slate-50 p-4 sm:p-5 md:p-6">
        <div className="w-full min-w-0">
          <Label className="mb-2 block text-sm font-medium">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Operación, BL, contenedor, importadora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full pl-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 md:items-end md:gap-4 lg:grid-cols-12">
          <div className="min-w-0 sm:col-span-1 md:col-span-2 lg:col-span-3">
            <Label className="mb-2 block text-sm font-medium">Tipo</Label>
            <Select
              value={filterType}
              onValueChange={(value) => setFilterType(value as typeof filterType)}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="COMMERCIAL">Comercial</SelectItem>
                <SelectItem value="PARCEL">Parcel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:col-span-1 md:col-span-2 lg:col-span-4">
            <Label className="mb-2 block text-sm font-medium">Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-10 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,70vh)]">
                <SelectItem value="all">Todos</SelectItem>
                {OPERATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center pt-1 sm:col-span-2 md:col-span-2 md:col-start-5 md:row-start-1 lg:col-span-3 lg:col-start-auto lg:justify-end lg:self-end lg:pb-0.5 sm:pt-2 md:pt-0">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <Checkbox
                checked={showOnlyActive}
                onCheckedChange={(checked) => setShowOnlyActive(checked === true)}
                className="h-5 w-5 shrink-0"
              />
              <span className="text-sm font-medium leading-snug text-slate-700">
                Solo activas
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 text-[13px]">
                <TableHead className="w-8"></TableHead>
                <TableHead
                  className="min-w-[60px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("type")}
                >
                  <div className="flex items-center gap-1">
                    Tipo
                    {sortColumn === "type" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[100px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("operation")}
                >
                  <div className="flex items-center gap-1">
                    Operación
                    {sortColumn === "operation" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="w-10 text-center text-[13px]">Seq</TableHead>
                <TableHead
                  className="min-w-[110px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("container")}
                >
                  <div className="flex items-center gap-1">
                    Contenedor
                    {sortColumn === "container" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[100px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("bl")}
                >
                  <div className="flex items-center gap-1">
                    BL
                    {sortColumn === "bl" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[110px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("status")}
                >
                  <div className="flex items-center gap-1">
                    Estado
                    {sortColumn === "status" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[80px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("eta")}
                >
                  <div className="flex items-center gap-1">
                    ETA
                    {sortColumn === "eta" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="min-w-[140px] text-[13px]">Origen / Destino</TableHead>
                <TableHead
                  className="min-w-[120px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("importadora")}
                >
                  <div className="flex items-center gap-1">
                    Importadora
                    {sortColumn === "importadora" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[100px] text-[13px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("last-update")}
                >
                  <div className="flex items-center gap-1">
                    Actualización
                    {sortColumn === "last-update" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : sortedContainerRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                  No hay contenedores para mostrar
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map(({ operation, container, isFirstContainer }) => (
                <TableRow
                  key={container.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleViewDetail(operation.id)}
                >
                  {/* Acciones — stopPropagation para no navegar al hacer clic en el menú */}
                  <TableCell className="py-2 w-10" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-800">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuItem onClick={() => handleViewDetail(operation.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTracking(operation, container)}>
                          <Ship className="h-4 w-4 mr-2" />
                          Tracking carrier
                        </DropdownMenuItem>
                        {isFirstContainer && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(operation.id)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Tipo */}
                  <TableCell className="py-1.5">
                    <Badge
                      className={`flex items-center gap-1 w-fit text-[13px] px-1.5 py-0.5 ${
                        operation.operationType === "COMMERCIAL"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {operation.operationType === "COMMERCIAL" ? (
                        <Ship className="h-3.5 w-3.5" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {operation.operationType === "COMMERCIAL" ? "COM" : "PKG"}
                      </span>
                    </Badge>
                  </TableCell>

                  {/* Operación */}
                  <TableCell className="py-1.5">
                    <span className={`text-[13px] ${isFirstContainer ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                      {operationRowLabel(operation, container)}
                    </span>
                  </TableCell>

                  {/* Seq */}
                  <TableCell className="py-1.5 text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[13px] font-medium">
                      {container.sequenceNo}
                    </span>
                  </TableCell>

                  {/* Contenedor */}
                  <TableCell className="py-1.5">
                    <span className="font-mono text-[13px] text-slate-800">
                      {container.containerNo || <span className="text-slate-400">—</span>}
                    </span>
                  </TableCell>

                  {/* BL */}
                  <TableCell className="py-1.5">
                    <span className="text-[13px] text-slate-700">
                      {container.blNo || <span className="text-slate-400">—</span>}
                    </span>
                  </TableCell>

                  {/* Estado */}
                  <TableCell className="py-1.5">
                    <Badge className={`${statusColors[container.status] || "bg-slate-100 text-slate-700"} text-[13px] whitespace-nowrap px-2 py-0.5`}>
                      {container.status}
                    </Badge>
                  </TableCell>

                  {/* ETA */}
                  <TableCell className="py-1.5 whitespace-nowrap">
                    {formatETA(container) ? (
                      <span className="text-[13px] text-slate-900 font-medium">{formatETA(container)}</span>
                    ) : (
                      <span className="text-[13px] text-slate-300">—</span>
                    )}
                  </TableCell>

                  {/* Origen / Destino */}
                  <TableCell className="py-1.5">
                    <div className="flex flex-col leading-tight gap-0.5 max-w-[170px]">
                      <span className="flex items-center gap-1 truncate max-w-[140px] text-[13px] text-slate-700">
                        <Anchor className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {container.originPort || operation.originPort || "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 truncate max-w-[140px] text-[13px] text-slate-700">
                        <Ship className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {container.destinationPort || operation.destinationPort || "—"}
                        </span>
                      </span>
                    </div>
                  </TableCell>

                  {/* Importadora */}
                  <TableCell className="py-1.5">
                    <span className={`text-[13px] truncate block max-w-[140px] ${isFirstContainer ? "text-slate-700" : "text-slate-400"}`}>
                      {operation.importadora?.nombre ?? "—"}
                    </span>
                  </TableCell>

                  {/* Últ. Actualización */}
                  <TableCell className="py-1.5 text-[13px] text-slate-500 whitespace-nowrap">
                    {getLastUpdate(container)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && sortedContainerRows.length > 0 && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-t bg-slate-50/50">
            <p className="text-xs sm:text-sm text-slate-500">
              <span className="hidden sm:inline">Mostrando </span>
              {start + 1}-{Math.min(start + PAGE_SIZE, sortedContainerRows.length)} de {sortedContainerRows.length}
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
    </div>
  );
}

const OPERATION_STATUSES = [
  "Draft",
  "Booking Confirmed",
  "Container Assigned",
  "Loaded",
  "Gate In (Port)",
  "BL Final Issued",
  "Departed US",
  "Arrived Cuba",
  "Customs",
  "Released",
  "Delivered",
  "Closed",
  "Cancelled",
] as const;
