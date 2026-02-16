"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Plus, Eye, Search, Package, Ship, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { operationsApi, ofertasClienteApi, importadorasApi } from "@/lib/api";
import type { Operation, OperationContainer, OfertaCliente, Importadora } from "@/lib/api";

// Status colors
const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  "Booking Confirmed": "bg-blue-100 text-blue-700",
  "Container Assigned": "bg-purple-100 text-purple-700",
  Loaded: "bg-yellow-100 text-yellow-700",
  "Gate In (Port)": "bg-orange-100 text-orange-700",
  "BL Final Issued": "bg-indigo-100 text-indigo-700",
  "Departed US": "bg-cyan-100 text-cyan-700",
  "Arrived Cuba": "bg-green-100 text-green-700",
  Customs: "bg-amber-100 text-amber-700",
  Released: "bg-emerald-100 text-emerald-700",
  Delivered: "bg-teal-100 text-teal-700",
  Closed: "bg-gray-100 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
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

function formatDate(dateString?: string): string {
  // Formato: mm/dd/yyyy
  if (!dateString) return "Pendiente";
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  return `${month}/${day}/${year}`;
}

function formatDateTime(dateString?: string): string {
  if (!dateString) return "Pendiente";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatETD(container: OperationContainer): string {
  const etd = container.etdEstimated || container.etdActual;
  return formatDate(etd);
}

function formatETA(container: OperationContainer): string {
  const eta = container.etaEstimated || container.etaActual;
  return formatDate(eta);
}

// Helper para obtener última actualización (del último evento o updatedAt)
function getLastUpdate(container: OperationContainer): string {
  if (container.events && container.events.length > 0) {
    // El backend ya ordena por eventDate desc y toma solo 1, así que el primero es el más reciente
    return formatDateTime(container.events[0].eventDate);
  }
  return formatDateTime(container.updatedAt);
}

export default function OperationsPage(): React.ReactElement {
  const router = useRouter();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [ofertasCliente, setOfertasCliente] = useState<OfertaCliente[]>([]);
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState<"COMMERCIAL" | "PARCEL" | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Sorting - column-based with direction
  type SortColumn = "operation" | "container" | "booking" | "bl" | "etd" | "eta" | "status" | "last-update" | null;
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>("eta");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOfertaId, setSelectedOfertaId] = useState("");
  const [selectedImportadoraId, setSelectedImportadoraId] = useState("");
  const [operationType, setOperationType] = useState<"COMMERCIAL" | "PARCEL">("COMMERCIAL");

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
        case "operation": {
          comparison = a.operation.operationNo.localeCompare(b.operation.operationNo);
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
          const lastUpdateA = a.container.events && a.container.events.length > 0
            ? new Date(a.container.events[0].eventDate).getTime()
            : new Date(a.container.updatedAt).getTime();
          const lastUpdateB = b.container.events && b.container.events.length > 0
            ? new Date(b.container.events[0].eventDate).getTime()
            : new Date(b.container.updatedAt).getTime();
          
          comparison = lastUpdateA - lastUpdateB; // Comparación base (ascendente: más antiguo primero)
          break;
        }

        default:
          return 0;
      }

      // Aplicar dirección
      return direction === "asc" ? comparison : -comparison;
    });
  }

  // Aplicar ordenamiento
  const sortedContainerRows = sortContainerRows(containerRows);

  useEffect(() => {
    loadData();
  }, [filterType, filterStatus, searchTerm]);

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const params: any = {};
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
      await operationsApi.createFromOffer(selectedOfertaId, selectedImportadoraId);
      toast.success("Operación creada");
      setCreateDialogOpen(false);
      setSelectedOfertaId("");
      loadData();
    } catch (error) {
      toast.error("Error al crear operación");
      console.error(error);
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
      });
      toast.success("Operación creada");
      setCreateDialogOpen(false);
      setOperationType("COMMERCIAL");
      loadData();
    } catch (error) {
      toast.error("Error al crear operación");
      console.error(error);
    }
  }

  function handleViewDetail(operationId: string): void {
    router.push(`/operations/${operationId}`);
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
        description="Tracking de operaciones comerciales y paquetería"
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                    onValueChange={(value) => setOperationType(value as "COMMERCIAL" | "PARCEL")}
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
                  <Button onClick={handleCreateManual} className="w-full">
                    Crear Operación Parcel
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 p-4 sm:p-6 bg-slate-50 rounded-lg">
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-medium mb-2 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Número de operación, ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>
        <div className="w-full sm:w-48 lg:w-56">
          <Label className="text-sm font-medium mb-2 block">Tipo</Label>
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as typeof filterType)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COMMERCIAL">Comercial</SelectItem>
              <SelectItem value="PARCEL">Parcel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48 lg:w-56">
          <Label className="text-sm font-medium mb-2 block">Estado</Label>
          <Select
            value={filterStatus}
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {OPERATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="min-w-[100px]">Tipo</TableHead>
                <TableHead 
                  className="min-w-[120px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("operation")}
                >
                  <div className="flex items-center gap-1">
                    Operación
                    {sortColumn === "operation" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="min-w-[150px]">Importadora</TableHead>
                <TableHead className="min-w-[60px] text-center">Seq</TableHead>
                <TableHead 
                  className="min-w-[140px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("container")}
                >
                  <div className="flex items-center gap-1">
                    Contenedor
                    {sortColumn === "container" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="min-w-[120px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("booking")}
                >
                  <div className="flex items-center gap-1">
                    Booking
                    {sortColumn === "booking" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="min-w-[120px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("bl")}
                >
                  <div className="flex items-center gap-1">
                    BL
                    {sortColumn === "bl" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="min-w-[200px]">Origen → Destino</TableHead>
                <TableHead 
                  className="min-w-[100px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("etd")}
                >
                  <div className="flex items-center gap-1">
                    ETD
                    {sortColumn === "etd" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="min-w-[100px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("eta")}
                >
                  <div className="flex items-center gap-1">
                    ETA
                    {sortColumn === "eta" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="min-w-[140px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("status")}
                >
                  <div className="flex items-center gap-1">
                    Estado
                    {sortColumn === "status" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="min-w-[140px]">Ubicación</TableHead>
                <TableHead 
                  className="min-w-[160px] cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => handleSortClick("last-update")}
                >
                  <div className="flex items-center gap-1">
                    Última Actualización
                    {sortColumn === "last-update" && (
                      sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="min-w-[100px] text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : sortedContainerRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-slate-500">
                  No hay contenedores para mostrar
                </TableCell>
              </TableRow>
            ) : (
              sortedContainerRows.map(({ operation, container, isFirstContainer }) => (
                <TableRow key={container.id} className="hover:bg-slate-50">
                  <TableCell className="py-3">
                    <Badge
                      className={`flex items-center gap-1.5 w-fit text-xs ${
                        operation.operationType === "COMMERCIAL"
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      {operation.operationType === "COMMERCIAL" ? (
                        <Ship className="h-3.5 w-3.5" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">{operation.operationType}</span>
                      <span className="sm:hidden">{operation.operationType === "COMMERCIAL" ? "COM" : "PKG"}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium py-3">
                    {isFirstContainer ? (
                      <span className="font-semibold text-slate-900">{operation.operationNo}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {isFirstContainer && operation.importadora ? (
                      <span className="text-sm text-slate-700 font-medium">
                        {operation.importadora.nombre}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                      {container.sequenceNo}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="font-mono text-sm">{container.containerNo || "Pendiente"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm">{container.bookingNo || "Pendiente"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm">{container.blNo || "Pendiente"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="truncate max-w-[85px] text-slate-700 font-medium">
                        {container.originPort || operation.originPort || "N/A"}
                      </span>
                      <span className="text-slate-400 flex-shrink-0">→</span>
                      <span className="truncate max-w-[85px] text-slate-700 font-medium">
                        {container.destinationPort || operation.destinationPort || "N/A"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm whitespace-nowrap">
                    <span className={container.etdEstimated || container.etdActual ? "text-slate-900" : "text-slate-400"}>
                      {formatETD(container)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm whitespace-nowrap">
                    <span className={container.etaEstimated || container.etaActual ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {formatETA(container)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge className={`${statusColors[container.status] || "bg-slate-100 text-slate-700"} text-xs whitespace-nowrap px-2 py-0.5`}>
                      {container.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm truncate block max-w-[140px]" title={getDisplayLocation(container, operation)}>
                      {getDisplayLocation(container, operation)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 whitespace-nowrap">
                    {getLastUpdate(container)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetail(operation.id)}
                        title="Ver detalles"
                        className="h-8 w-8"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isFirstContainer && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(operation.id)}
                          title="Eliminar operación"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
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
