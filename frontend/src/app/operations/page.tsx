"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Plus, Eye, Search, Package, Ship, Trash2, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MoreHorizontal, RefreshCw, Anchor, CalendarDays } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { operationsApi, ofertasClienteApi, importadorasApi } from "@/lib/api";
import type { Operation, OperationContainer, OfertaCliente, Importadora } from "@/lib/api";
import { operationRowLabel, operationTableDescription } from "@/lib/operation-display";
import {
  OPERATION_STATUSES,
  operationStatusBadgeClass,
  operationStatusLabelEs,
} from "@/lib/operation-status";
import { cn } from "@/lib/utils";

// Estados considerados como inactivos/completados
const INACTIVE_STATUSES = [
  "Completado",
  "Cancelado",
  "Delivered",
  "Closed",
  "Cancelled",
];

// Helper para obtener ubicación sugerida basada en estado
function getSuggestedLocation(status: string): string {
  const locationMap: Record<string, string> = {
    Pendiente: "En preparación",
    Cargando: "Carga / almacén",
    Sellado: "Sellado",
    "En puerto US": "Puerto EE. UU.",
    "En puerto Brazil": "Puerto Brasil",
    "En Tránsito al Puerto del Mariel": "En tránsito a Mariel",
    "En Transito al Puerto del Mariel": "En tránsito a Mariel",
    "En Puerto del Mariel": "Puerto Mariel",
    "En Aduana": "Aduana",
    "Retenido en Aduana": "Aduana (retenido)",
    "Liberado Aduana": "Aduana liberada",
    "Descargado en Puerto del Mariel": "Descargado Mariel",
    Completado: "Finalizado",
    Cancelado: "Cancelado",
    Draft: "En preparación",
    "Booking Confirmed": "En preparación",
    "Container Assigned": "En preparación",
    Loaded: "Almacén",
    "Gate In (Port)": "En puerto (origen)",
    "BL Final Issued": "En puerto (origen)",
    "Departed US": "En tránsito",
    "Departed Brazil": "En tránsito",
    "Arrived Cuba": "Puerto de destino",
    Customs: "Aduana",
    Released: "Liberado",
    Delivered: "Entregado",
    Closed: "Entregado",
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

function getLastUpdate(container: OperationContainer): string {
  const raw = container.trackingLastEventAt
    || container.trackingLastSyncAt
    || (container.events && container.events.length > 0 ? container.events[0].eventDate : null)
    || container.updatedAt;
  return formatDateShort(raw);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatTableDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatFechaEnvio(container: OperationContainer): string {
  const raw = container.etdActual || container.etdEstimated;
  return formatTableDate(raw ?? undefined);
}

/** ETA / Arribo Mariel: prioriza fecha real. */
function formatEtaArriboMariel(container: OperationContainer): string {
  const raw = container.etaActual || container.etaEstimated;
  return formatTableDate(raw ?? undefined);
}

/** Verde si la fecha de arribo es hoy o ya pasó (en Mariel o arribado). */
function etaArriboMarielIsGreen(container: OperationContainer): boolean {
  const raw = container.etaActual || container.etaEstimated;
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  const today = startOfLocalDay(new Date());
  const etaDay = startOfLocalDay(d);
  return etaDay.getTime() <= today.getTime();
}

/** Días desde ETA/arribo hasta hoy; null si aún no aplica. >10 → resaltar en rojo. */
function getDaysInMarielDisplay(container: OperationContainer): { text: string; danger: boolean } {
  const refRaw = container.etaActual || container.etaEstimated;
  if (!refRaw) {
    return { text: "—", danger: false };
  }
  const arr = new Date(refRaw);
  if (isNaN(arr.getTime())) {
    return { text: "—", danger: false };
  }
  const today = startOfLocalDay(new Date());
  const arrDay = startOfLocalDay(arr);
  const diffMs = today.getTime() - arrDay.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 0) {
    return { text: "—", danger: false };
  }
  return { text: String(days), danger: days > 10 };
}

/** Clave numérica para ordenar por «Días en Mariel»; -1 = sin dato (van al final en asc). */
function daysInMarielSortKey(container: OperationContainer): number {
  const refRaw = container.etaActual || container.etaEstimated;
  if (!refRaw) return -1;
  const arr = new Date(refRaw);
  if (isNaN(arr.getTime())) return -1;
  const today = startOfLocalDay(new Date());
  const arrDay = startOfLocalDay(arr);
  const diffMs = today.getTime() - arrDay.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 0) return -1;
  return days;
}

function clienteNombreCompania(operation: Operation): string {
  const c = operation.offerCustomer?.cliente;
  if (!c) return "—";
  const comp = c.nombreCompania?.trim();
  if (comp) return comp;
  return [c.nombre, c.apellidos].filter(Boolean).join(" ").trim() || "—";
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const;

/** Filtros y paginación leídos de la URL (persisten al ir al detalle y volver con Atrás). */
function parseOperationsListParams(sp: URLSearchParams): {
  filterType: "COMMERCIAL" | "PARCEL" | "all";
  filterStatus: string;
  searchTerm: string;
  showOnlyActive: boolean;
  currentPage: number;
  pageSize: number;
} {
  const typeRaw = sp.get("type");
  const filterType: "COMMERCIAL" | "PARCEL" | "all" =
    typeRaw === "COMMERCIAL" || typeRaw === "PARCEL" ? typeRaw : "all";

  const statusRaw = sp.get("status");
  const filterStatus = statusRaw && statusRaw !== "all" ? statusRaw : "all";

  const searchTerm = sp.get("search") ?? "";

  const showOnlyActive = sp.get("soloActivas") !== "0";

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const psRaw = parseInt(sp.get("pageSize") ?? "10", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(psRaw as (typeof PAGE_SIZE_OPTIONS)[number])
    ? psRaw
    : 10;

  return { filterType, filterStatus, searchTerm, showOnlyActive, currentPage: page, pageSize };
}

function OperationsPageContent(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { usuario } = useAuth();
  const isOperador = usuario?.rol?.toLowerCase() === "operador";
  const [operations, setOperations] = useState<Operation[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [loading, setLoading] = useState(true);

  const { filterType, filterStatus, searchTerm, showOnlyActive, currentPage, pageSize } =
    parseOperationsListParams(searchParams);

  /** Borrador del buscador: se sincroniza a la URL con debounce. */
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get("search") ?? "");

  useEffect(() => {
    setSearchDraft(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchDraft.trim();
      const cur = searchParams.get("search") ?? "";
      if (next === cur) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("search", next);
      else params.delete("search");
      params.delete("page");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, 450);
    return () => clearTimeout(t);
  }, [searchDraft, pathname, router, searchParams]);

  function patchListUrl(updates: Record<string, string | null>): void {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }
  
  // Sorting - column-based with direction
  type SortColumn =
    | "type"
    | "operation"
    | "description"
    | "container"
    | "booking"
    | "bl"
    | "etd"
    | "eta"
    | "status"
    | "fecha-oferta"
    | "fecha-contrato"
    | "days-mariel"
    | "origen-destino"
    | "seq"
    | "last-update"
    | "importadora"
    | "cliente"
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

        case "description": {
          comparison = operationTableDescription(a.operation).localeCompare(
            operationTableDescription(b.operation)
          );
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

        case "fecha-oferta": {
          const fa = a.operation.offerCustomer?.fecha;
          const fb = b.operation.offerCustomer?.fecha;
          if (fa && fb) {
            comparison = new Date(fa).getTime() - new Date(fb).getTime();
          } else if (fa && !fb) {
            comparison = -1;
          } else if (!fa && fb) {
            comparison = 1;
          } else {
            comparison = 0;
          }
          break;
        }

        case "fecha-contrato": {
          const ca = a.operation.offerCustomer?.fechaContratoImportadora;
          const cb = b.operation.offerCustomer?.fechaContratoImportadora;
          if (ca && cb) {
            comparison = new Date(ca).getTime() - new Date(cb).getTime();
          } else if (ca && !cb) {
            comparison = -1;
          } else if (!ca && cb) {
            comparison = 1;
          } else {
            comparison = 0;
          }
          break;
        }

        case "days-mariel": {
          const da = daysInMarielSortKey(a.container);
          const db = daysInMarielSortKey(b.container);
          const na = da === -1;
          const nb = db === -1;
          if (na && nb) comparison = 0;
          else if (na) comparison = 1;
          else if (nb) comparison = -1;
          else comparison = da - db;
          break;
        }

        case "origen-destino": {
          const originA = a.container.originPort || a.operation.originPort || "";
          const destA = a.container.destinationPort || a.operation.destinationPort || "";
          const originB = b.container.originPort || b.operation.originPort || "";
          const destB = b.container.destinationPort || b.operation.destinationPort || "";
          comparison = originA.localeCompare(originB) || destA.localeCompare(destB);
          break;
        }

        case "seq": {
          comparison = a.container.sequenceNo - b.container.sequenceNo;
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

        case "cliente": {
          comparison = clienteNombreCompania(a.operation).localeCompare(clienteNombreCompania(b.operation));
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

  const totalPages = Math.max(1, Math.ceil(sortedContainerRows.length / pageSize));
  const start = (currentPage - 1) * pageSize;
  const paginatedRows = sortedContainerRows.slice(start, start + pageSize);

  // Evitar página actual fuera de rango si cambian los datos o el tamaño de página
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(sortedContainerRows.length / pageSize));
    if (currentPage > tp) {
      const params = new URLSearchParams(searchParams.toString());
      if (tp > 1) params.set("page", String(tp));
      else params.delete("page");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [sortedContainerRows.length, pageSize, currentPage, searchParams, pathname, router]);

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
  }, [filterType, filterStatus, searchTerm, isOperador]);

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
    try {
      const params: Record<string, string> = {};
      if (filterType !== "all") params.type = filterType;
      if (filterStatus !== "all") params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      
      const data = await operationsApi.getAll(params);
      setOperations(data);
      
      const importadorasData = await importadorasApi.getAll();
      const ofertas = isOperador ? [] : await ofertasClienteApi.getAll();
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
        status: "Pendiente",
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
    const q = searchParams.toString();
    router.push(`/operations/${operationId}${q ? `?${q}` : ""}`);
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
                if (open && isOperador) {
                  setOperationType("PARCEL");
                }
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
                {!isOperador && (
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
                )}
                {isOperador && (
                  <p className="text-sm text-slate-600">
                    Nueva operación Parcel (importadora y referencia opcional).
                  </p>
                )}

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

                {!isOperador && operationType === "COMMERCIAL" ? (
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
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="h-10 w-full pl-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6 md:items-end md:gap-4 lg:grid-cols-12">
          <div className="min-w-0 sm:col-span-1 md:col-span-2 lg:col-span-3">
            <Label className="mb-2 block text-sm font-medium">Tipo</Label>
            <Select
              value={filterType}
              onValueChange={(value) => {
                const v = value as typeof filterType;
                patchListUrl({
                  type: v === "all" ? null : v,
                  page: null,
                });
              }}
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
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                patchListUrl({
                  status: value === "all" ? null : value,
                  page: null,
                });
              }}
            >
              <SelectTrigger className="h-10 w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,70vh)]">
                <SelectItem value="all">Todos</SelectItem>
                {OPERATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {operationStatusLabelEs(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center pt-1 sm:col-span-2 md:col-span-2 md:col-start-5 md:row-start-1 lg:col-span-3 lg:col-start-auto lg:justify-end lg:self-end lg:pb-0.5 sm:pt-2 md:pt-0">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <Checkbox
                checked={showOnlyActive}
                onCheckedChange={(checked) => {
                  patchListUrl({
                    soloActivas: checked === true ? null : "0",
                    page: null,
                  });
                }}
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
              <TableRow className="bg-slate-50 text-[12px]">
                <TableHead className="w-8"></TableHead>
                <TableHead
                  className="min-w-[56px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
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
                  className="min-w-[96px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
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
                <TableHead
                  className="min-w-[120px] max-w-[180px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("description")}
                >
                  <div className="flex items-center gap-1">
                    Descripción
                    {sortColumn === "description" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[200px] text-[12px] cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
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
                  className="min-w-[88px] text-[12px] whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("fecha-oferta")}
                >
                  <div className="flex items-center gap-1">
                    Fecha oferta
                    {sortColumn === "fecha-oferta" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[88px] text-[12px] whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("fecha-contrato")}
                >
                  <div className="flex items-center gap-1">
                    Fecha contrato
                    {sortColumn === "fecha-contrato" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[88px] text-[12px] cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                  onClick={() => handleSortClick("etd")}
                >
                  <div className="flex items-center gap-1">
                    Fecha envío
                    {sortColumn === "etd" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[100px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("eta")}
                >
                  <div className="flex flex-col gap-0.5 items-start">
                    <span className="flex items-center gap-1">
                      ETA / Arribo Mariel
                      {sortColumn === "eta" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ))}
                    </span>
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[72px] text-[12px] text-center cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("days-mariel")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Días en Mariel
                    {sortColumn === "days-mariel" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[120px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("origen-destino")}
                >
                  <div className="flex items-center gap-1">
                    Origen / Destino
                    {sortColumn === "origen-destino" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="w-10 text-center text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("seq")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Seq
                    {sortColumn === "seq" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[100px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("container")}
                >
                  <div className="flex items-center gap-1">
                    Nº contenedor
                    {sortColumn === "container" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[88px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
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
                  className="min-w-[110px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("cliente")}
                >
                  <div className="flex items-center gap-1">
                    Cliente
                    {sortColumn === "cliente" &&
                      (sortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[110px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
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
                  className="min-w-[88px] text-[12px] cursor-pointer hover:bg-slate-100 select-none"
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
                <TableCell colSpan={17} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : sortedContainerRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-8 text-slate-500">
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
                      className={`flex items-center gap-1 w-fit text-[12px] px-1.5 py-0.5 ${
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
                    <span className={`text-[12px] ${isFirstContainer ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                      {operationRowLabel(operation, container)}
                    </span>
                  </TableCell>

                  {/* Descripción (misma alineación vertical que fechas / ETA) */}
                  <TableCell className="py-1.5 align-middle max-w-[180px] whitespace-normal">
                    <span
                      className={`block text-[12px] leading-snug line-clamp-3 ${isFirstContainer ? "text-slate-700" : "text-slate-400"}`}
                      title={operationTableDescription(operation)}
                    >
                      {operationTableDescription(operation)}
                    </span>
                  </TableCell>

                  {/* Estado + nota (estado actual manual) */}
                  <TableCell className="py-1.5 align-top min-w-[200px]">
                    <div className="flex flex-col gap-1 min-w-0">
                      <Badge
                        className={cn(
                          operationStatusBadgeClass(container.status),
                          "border-0 text-[11px] font-medium shadow-none",
                          "inline-flex w-fit min-w-0 shrink items-center justify-start",
                          "whitespace-nowrap rounded-md px-2 py-1"
                        )}
                      >
                        {operationStatusLabelEs(container.status)}
                      </Badge>
                      {container.currentLocation?.trim() ? (
                        <span className="text-[10px] text-slate-600 leading-snug line-clamp-3 break-words">
                          {container.currentLocation.trim()}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Fecha oferta (Oferta a Cliente) */}
                  <TableCell className="py-1.5 whitespace-nowrap text-[12px] text-slate-700">
                    {formatTableDate(operation.offerCustomer?.fecha)}
                  </TableCell>

                  {/* Fecha contrato importadora */}
                  <TableCell className="py-1.5 whitespace-nowrap text-[12px] text-slate-700">
                    {formatTableDate(operation.offerCustomer?.fechaContratoImportadora)}
                  </TableCell>

                  {/* Fecha envío ETD */}
                  <TableCell className="py-1.5 whitespace-nowrap text-[12px] text-slate-700">
                    {formatFechaEnvio(container)}
                  </TableCell>

                  {/* ETA / Arribo Mariel */}
                  <TableCell className="py-1.5 whitespace-nowrap">
                    {formatEtaArriboMariel(container) !== "—" ? (
                      <span
                        className={cn(
                          "text-[12px] font-semibold tabular-nums",
                          etaArriboMarielIsGreen(container)
                            ? "text-green-800 bg-green-100 border border-green-400/80 rounded-md px-2 py-0.5 shadow-sm"
                            : "text-slate-900"
                        )}
                      >
                        {formatEtaArriboMariel(container)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-300">—</span>
                    )}
                  </TableCell>

                  {/* Días en Mariel */}
                  <TableCell className="py-1.5 text-center text-[12px]">
                    {(() => {
                      const d = getDaysInMarielDisplay(container);
                      if (d.text === "—") {
                        return <span className="text-slate-400">—</span>;
                      }
                      return (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center gap-1 tabular-nums",
                            d.danger ? "font-semibold text-red-600" : "text-slate-700"
                          )}
                        >
                          <CalendarDays
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden
                          />
                          {d.text}
                        </span>
                      );
                    })()}
                  </TableCell>

                  {/* Origen / Destino */}
                  <TableCell className="py-1.5">
                    <div className="flex flex-col leading-tight gap-0.5 max-w-[140px]">
                      <span className="flex items-center gap-1 truncate max-w-[130px] text-[12px] text-slate-700">
                        <Anchor className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {container.originPort || operation.originPort || "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 truncate max-w-[130px] text-[12px] text-slate-700">
                        <Ship className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {container.destinationPort || operation.destinationPort || "—"}
                        </span>
                      </span>
                    </div>
                  </TableCell>

                  {/* Seq */}
                  <TableCell className="py-1.5 text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[12px] font-medium">
                      {container.sequenceNo}
                    </span>
                  </TableCell>

                  {/* Contenedor */}
                  <TableCell className="py-1.5">
                    <span className="font-mono text-[12px] text-slate-800">
                      {container.containerNo || <span className="text-slate-400">—</span>}
                    </span>
                  </TableCell>

                  {/* BL */}
                  <TableCell className="py-1.5">
                    <span className="text-[12px] text-slate-700">
                      {container.blNo || <span className="text-slate-400">—</span>}
                    </span>
                  </TableCell>

                  {/* Cliente */}
                  <TableCell className="py-1.5">
                    <span
                      className={`text-[12px] truncate block max-w-[130px] ${isFirstContainer ? "text-slate-800" : "text-slate-400"}`}
                      title={clienteNombreCompania(operation)}
                    >
                      {clienteNombreCompania(operation)}
                    </span>
                  </TableCell>

                  {/* Importadora */}
                  <TableCell className="py-1.5">
                    <span className={`text-[12px] truncate block max-w-[120px] ${isFirstContainer ? "text-slate-700" : "text-slate-400"}`}>
                      {operation.importadora?.nombre ?? "—"}
                    </span>
                  </TableCell>

                  {/* Últ. Actualización */}
                  <TableCell className="py-1.5 text-[12px] text-slate-500 whitespace-nowrap">
                    {getLastUpdate(container)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && sortedContainerRows.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 sm:py-3 border-t bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-xs sm:text-sm text-slate-500">
                <span className="hidden sm:inline">Mostrando </span>
                {start + 1}-{Math.min(start + pageSize, sortedContainerRows.length)} de {sortedContainerRows.length}
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="ops-page-size" className="text-xs text-slate-500 whitespace-nowrap">
                  Por página
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    patchListUrl({
                      pageSize: v,
                      page: null,
                    });
                  }}
                >
                  <SelectTrigger id="ops-page-size" className="h-8 w-[4.5rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9"
                onClick={() => {
                  const p = Math.max(1, currentPage - 1);
                  patchListUrl({ page: p > 1 ? String(p) : null });
                }}
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
                onClick={() => {
                  const p = Math.min(totalPages, currentPage + 1);
                  patchListUrl({ page: p > 1 ? String(p) : null });
                }}
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

export default function OperationsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          Cargando operaciones…
        </div>
      }
    >
      <OperationsPageContent />
    </Suspense>
  );
}
