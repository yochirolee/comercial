"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Save, Package, Ship, Clock, Trash2, ArrowUpDown } from "lucide-react";
import { operationsApi, importadorasApi } from "@/lib/api";
import type { Operation, OperationContainer, OperationEvent, ContainerEvent } from "@/lib/api";

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

function formatDateTime(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateString?: string): string {
  if (!dateString) return "-";
  // Usar solo la parte de fecha (YYYY-MM-DD) para evitar problemas de timezone
  // Formato: mm/dd/yyyy
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  return `${month}/${day}/${year}`;
}

export default function OperationDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const operationId = params.id as string;
  
  const [operation, setOperation] = useState<Operation | null>(null);
  const [loading, setLoading] = useState(true);
  const [importadoras, setImportadoras] = useState<Array<{ id: string; nombre: string }>>([]);
  
  // Estado para ordenamiento de timeline de contenedores (por contenedor)
  const [containerEventOrder, setContainerEventOrder] = useState<Record<string, 'asc' | 'desc'>>({});
  
  // Estado para ordenamiento del timeline de operación
  const [operationEventOrder, setOperationEventOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dialogs
  const [editOperationDialogOpen, setEditOperationDialogOpen] = useState(false);
  const [addContainerDialogOpen, setAddContainerDialogOpen] = useState(false);
  const [editContainerDialogOpen, setEditContainerDialogOpen] = useState(false);
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [addContainerEventDialogOpen, setAddContainerEventDialogOpen] = useState(false);
  
  // Selected
  const [selectedContainer, setSelectedContainer] = useState<OperationContainer | null>(null);
  
  // Forms
  const [operationForm, setOperationForm] = useState({
    status: "",
    currentLocation: "",
    originPort: "",
    destinationPort: "",
    notes: "",
    importadoraId: "",
  });
  
  const [containerForm, setContainerForm] = useState({
    containerNo: "",
    bookingNo: "",
    blNo: "",
    originPort: "",
    destinationPort: "",
    etdEstimated: "",
    etaEstimated: "",
    etdActual: "",
    etaActual: "",
    status: "",
    currentLocation: "",
  });
  
  const [eventForm, setEventForm] = useState({
    eventType: "manual",
    title: "",
    description: "",
    location: "",
    eventDate: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (operationId) {
      loadOperation();
      loadImportadoras();
    }
  }, [operationId]);

  async function loadImportadoras(): Promise<void> {
    try {
      const data = await importadorasApi.getAll();
      setImportadoras(data);
    } catch (error) {
      console.error("Error al cargar importadoras:", error);
    }
  }

  async function loadOperation(): Promise<void> {
    setLoading(true);
    try {
      const data = await operationsApi.getById(operationId);
      setOperation(data);
      setOperationForm({
        status: data.status,
        currentLocation: data.currentLocation || "",
        originPort: data.originPort || "",
        destinationPort: data.destinationPort || "MARIEL, Cuba",
        notes: data.notes || "",
        importadoraId: data.importadoraId || "",
      });
    } catch (error) {
      toast.error("Error al cargar operación");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateOperation(): Promise<void> {
    try {
      await operationsApi.update(operationId, operationForm);
      toast.success("Operación actualizada");
      setEditOperationDialogOpen(false);
      loadOperation();
    } catch (error) {
      toast.error("Error al actualizar");
      console.error(error);
    }
  }

  async function handleAddContainer(): Promise<void> {
    try {
      await operationsApi.addContainer(operationId, {
        ...containerForm,
        status: containerForm.status || "Draft",
      });
      toast.success("Contenedor agregado");
      setAddContainerDialogOpen(false);
      setContainerForm({
        containerNo: "",
        bookingNo: "",
        blNo: "",
        originPort: "",
        destinationPort: "",
        etdEstimated: "",
        etaEstimated: "",
        etdActual: "",
        etaActual: "",
        status: "Draft",
        currentLocation: "",
      });
      loadOperation();
    } catch (error) {
      toast.error("Error al agregar contenedor");
      console.error(error);
    }
  }

  async function handleUpdateContainer(): Promise<void> {
    if (!selectedContainer) return;
    
    try {
      await operationsApi.updateContainer(operationId, selectedContainer.id, containerForm);
      toast.success("Contenedor actualizado");
      setEditContainerDialogOpen(false);
      setSelectedContainer(null);
      loadOperation();
    } catch (error) {
      toast.error("Error al actualizar contenedor");
      console.error(error);
    }
  }

  async function handleDeleteContainer(containerId: string, containerNo: string): Promise<void> {
    const confirmMessage = containerNo
      ? `¿Estás seguro de eliminar el contenedor ${containerNo}?\n\nEsta acción no se puede deshacer. Se eliminará el contenedor y todos sus eventos asociados.`
      : "¿Estás seguro de eliminar este contenedor? Esta acción no se puede deshacer.";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      await operationsApi.deleteContainer(operationId, containerId);
      toast.success("Contenedor eliminado");
      loadOperation();
    } catch (error) {
      toast.error("Error al eliminar contenedor");
      console.error(error);
    }
  }

  function openEditContainer(container: OperationContainer): void {
    setSelectedContainer(container);
    setContainerForm({
      containerNo: container.containerNo || "",
      bookingNo: container.bookingNo || "",
      blNo: container.blNo || "",
      originPort: container.originPort || "",
      destinationPort: container.destinationPort || "",
      etdEstimated: container.etdEstimated ? container.etdEstimated.slice(0, 16) : "",
      etaEstimated: container.etaEstimated ? container.etaEstimated.slice(0, 16) : "",
      etdActual: container.etdActual ? container.etdActual.slice(0, 16) : "",
      etaActual: container.etaActual ? container.etaActual.slice(0, 16) : "",
      status: container.status,
      currentLocation: container.currentLocation || "",
    });
    setEditContainerDialogOpen(true);
  }

  async function handleAddEvent(): Promise<void> {
    try {
      await operationsApi.addEvent(operationId, {
        ...eventForm,
        eventDate: new Date(eventForm.eventDate).toISOString(),
      });
      toast.success("Evento agregado");
      setAddEventDialogOpen(false);
      setEventForm({
        eventType: "manual",
        title: "",
        description: "",
        location: "",
        eventDate: new Date().toISOString().slice(0, 16),
      });
      loadOperation();
    } catch (error) {
      toast.error("Error al agregar evento");
      console.error(error);
    }
  }

  async function handleAddContainerEvent(): Promise<void> {
    if (!selectedContainer) return;
    
    try {
      await operationsApi.addContainerEvent(operationId, selectedContainer.id, {
        eventType: eventForm.eventType,
        title: eventForm.title,
        description: eventForm.description,
        location: eventForm.location,
        eventDate: new Date(eventForm.eventDate).toISOString(),
      });
      toast.success("Evento agregado");
      setAddContainerEventDialogOpen(false);
      setEventForm({
        eventType: "manual",
        title: "",
        description: "",
        location: "",
        eventDate: new Date().toISOString().slice(0, 16),
      });
      loadOperation();
    } catch (error) {
      toast.error("Error al agregar evento");
      console.error(error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Operación no encontrada</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={`Operación: ${operation.operationNo}`}
        description={
          operation.operationType === "COMMERCIAL"
            ? `Desde: ${operation.offerCustomer?.numero || "N/A"}`
            : "Operación Parcel"
        }
        actions={
          <Button variant="outline" onClick={() => router.push("/operations")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        }
      />

      <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Operation Summary */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Resumen de Operación</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOperationDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-500">Tipo</Label>
                <Badge
                  variant={operation.operationType === "COMMERCIAL" ? "default" : "secondary"}
                  className="mt-1 flex items-center gap-1 w-fit"
                >
                  {operation.operationType === "COMMERCIAL" ? (
                    <Ship className="h-3 w-3" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                  {operation.operationType}
                </Badge>
              </div>
              <div>
                <Label className="text-slate-500">Estado</Label>
                <p className="font-medium mt-1">{operation.status}</p>
              </div>
              <div>
                <Label className="text-slate-500">Importadora</Label>
                <p className="font-medium mt-1">{operation.importadora?.nombre || "-"}</p>
              </div>
              <div>
                <Label className="text-slate-500">Ubicación Actual</Label>
                <p className="font-medium mt-1">{operation.currentLocation || "-"}</p>
              </div>
              <div>
                <Label className="text-slate-500">Puerto Origen → Destino</Label>
                <p className="font-medium mt-1">
                  {operation.originPort || "-"} → {operation.destinationPort || "-"}
                </p>
              </div>
              {operation.notes && (
                <div className="md:col-span-2 lg:col-span-4">
                  <Label className="text-slate-500">Notas</Label>
                  <p className="mt-1">{operation.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Containers */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle>Contenedores</CardTitle>
            <Button
              size="sm"
              onClick={() => setAddContainerDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Contenedor
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {operation.containers && operation.containers.length > 0 ? (
                operation.containers.map((container) => (
                  <div
                    key={container.id}
                    className="p-4 border rounded-lg space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>#{container.sequenceNo}</Badge>
                        <span className="font-medium truncate max-w-[200px] sm:max-w-none">
                          {container.containerNo || `Contenedor ${container.sequenceNo}`}
                        </span>
                        <Badge>{container.status}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditContainer(container)}
                          title="Editar contenedor"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContainer(container.id, container.containerNo || "")}
                          title="Eliminar contenedor"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="truncate">
                        <span className="text-slate-500">Booking:</span> <span className="truncate">{container.bookingNo || "-"}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">BL:</span> <span className="truncate">{container.blNo || "-"}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">ETD:</span>{" "}
                        <span className="truncate">{formatDateTime(container.etdEstimated || container.etdActual)}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">ETA:</span>{" "}
                        <span className="truncate">{formatDateTime(container.etaEstimated || container.etaActual)}</span>
                      </div>
                      <div className="sm:col-span-2 md:col-span-2 truncate">
                        <span className="text-slate-500">Ubicación:</span> <span className="truncate">{container.currentLocation || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-8">
                  No hay contenedores. Agrega uno para comenzar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Operation Timeline */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline de Operación
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOperationEventOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                }}
                title={operationEventOrder === 'asc' ? 'Cambiar a: Más reciente arriba' : 'Cambiar a: Más antiguo arriba'}
                className="w-full sm:w-auto"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{operationEventOrder === 'asc' ? 'Más antiguo' : 'Más reciente'}</span>
                <span className="sm:hidden">Ordenar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddEventDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Evento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operation.events && operation.events.length > 0 ? (
                [...operation.events].sort((a, b) => {
                  const timeA = new Date(a.eventDate).getTime();
                  const timeB = new Date(b.eventDate).getTime();
                  return operationEventOrder === 'desc' ? timeB - timeA : timeA - timeB;
                }).map((event) => (
                        <div key={event.id} className="flex gap-4 pb-3 border-b last:border-0">
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium break-words">{event.title}</p>
                                {event.description && (
                                  <p className="text-sm text-slate-600 mt-1 break-words">{event.description}</p>
                                )}
                                {event.fromStatus && event.toStatus && (
                                  <p className="text-xs text-slate-500 mt-1 break-words">
                                    {event.fromStatus} → {event.toStatus}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                                {event.eventType === 'commercial' ? formatDateOnly(event.eventDate) : formatDateTime(event.eventDate)}
                              </span>
                            </div>
                          </div>
                        </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-8">No hay eventos registrados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Container Timelines */}
        {operation.containers && operation.containers.length > 0 && (
          <div className="space-y-4">
            {operation.containers.map((container) => (
              <Card key={container.id}>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timeline Contenedor #{container.sequenceNo}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentOrder = containerEventOrder[container.id] || 'desc';
                        const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
                        setContainerEventOrder(prev => ({
                          ...prev,
                          [container.id]: newOrder,
                        }));
                      }}
                      title={containerEventOrder[container.id] === 'asc' ? 'Ordenar: Más reciente arriba' : 'Ordenar: Más antiguo arriba'}
                      className="w-full sm:w-auto"
                    >
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">{containerEventOrder[container.id] === 'asc' ? 'Más reciente' : 'Más antiguo'}</span>
                      <span className="sm:hidden">Ordenar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedContainer(container);
                        setAddContainerEventDialogOpen(true);
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Evento
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {container.events && container.events.length > 0 ? (
                      [...container.events].sort((a, b) => {
                        const order = containerEventOrder[container.id] || 'desc';
                        const timeA = new Date(a.eventDate).getTime();
                        const timeB = new Date(b.eventDate).getTime();
                        return order === 'desc' ? timeB - timeA : timeA - timeB;
                      }).map((event) => (
                        <div key={event.id} className="flex gap-4 pb-3 border-b last:border-0">
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium break-words">{event.title}</p>
                                {event.description && (
                                  <p className="text-sm text-slate-600 mt-1 break-words whitespace-pre-wrap">{event.description}</p>
                                )}
                                {event.location && (
                                  <p className="text-xs text-slate-500 mt-1 break-words">📍 {event.location}</p>
                                )}
                                {event.fromStatus && event.toStatus && (
                                  <p className="text-xs text-slate-500 mt-1 break-words">
                                    {event.fromStatus} → {event.toStatus}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                                {event.eventType === 'commercial' ? formatDateOnly(event.eventDate) : formatDateTime(event.eventDate)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-8">No hay eventos registrados</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Edit Operation Dialog */}
      <Dialog open={editOperationDialogOpen} onOpenChange={setEditOperationDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Operación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Importadora *</Label>
              <Select
                value={operationForm.importadoraId}
                onValueChange={(value) => setOperationForm((p) => ({ ...p, importadoraId: value }))}
              >
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
            <div>
              <Label>Estado</Label>
              <Select
                value={operationForm.status}
                onValueChange={(value) => setOperationForm((p) => ({ ...p, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ubicación Actual</Label>
              <Input
                value={operationForm.currentLocation}
                onChange={(e) => setOperationForm((p) => ({ ...p, currentLocation: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Puerto Origen</Label>
                <Input
                  value={operationForm.originPort}
                  onChange={(e) => setOperationForm((p) => ({ ...p, originPort: e.target.value }))}
                />
              </div>
              <div>
                <Label>Puerto Destino</Label>
                <Input
                  value={operationForm.destinationPort || "MARIEL, Cuba"}
                  onChange={(e) => setOperationForm((p) => ({ ...p, destinationPort: e.target.value }))}
                  placeholder="MARIEL, Cuba"
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Input
                value={operationForm.notes}
                onChange={(e) => setOperationForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button onClick={handleUpdateOperation} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Container Dialog */}
      <Dialog open={addContainerDialogOpen} onOpenChange={setAddContainerDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Contenedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Número de Contenedor</Label>
                <Input
                  value={containerForm.containerNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, containerNo: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={containerForm.status}
                  onValueChange={(value) => setContainerForm((p) => ({ ...p, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Booking No</Label>
                <Input
                  value={containerForm.bookingNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, bookingNo: e.target.value }))}
                />
              </div>
              <div>
                <Label>BL No</Label>
                <Input
                  value={containerForm.blNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, blNo: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Puerto Origen</Label>
                <Input
                  value={containerForm.originPort}
                  onChange={(e) => setContainerForm((p) => ({ ...p, originPort: e.target.value }))}
                />
              </div>
              <div>
                <Label>Puerto Destino</Label>
                <Input
                  value={containerForm.destinationPort}
                  onChange={(e) => setContainerForm((p) => ({ ...p, destinationPort: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ETD Estimado</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etdEstimated}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etdEstimated: e.target.value }))}
                />
              </div>
              <div>
                <Label>ETA Estimado</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etaEstimated}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etaEstimated: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Ubicación Actual</Label>
              <Input
                value={containerForm.currentLocation}
                onChange={(e) => setContainerForm((p) => ({ ...p, currentLocation: e.target.value }))}
              />
            </div>
            <Button onClick={handleAddContainer} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Container Dialog */}
      <Dialog open={editContainerDialogOpen} onOpenChange={setEditContainerDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Contenedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Número de Contenedor</Label>
                <Input
                  value={containerForm.containerNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, containerNo: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={containerForm.status}
                  onValueChange={(value) => setContainerForm((p) => ({ ...p, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Booking No</Label>
                <Input
                  value={containerForm.bookingNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, bookingNo: e.target.value }))}
                />
              </div>
              <div>
                <Label>BL No</Label>
                <Input
                  value={containerForm.blNo}
                  onChange={(e) => setContainerForm((p) => ({ ...p, blNo: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Puerto Origen</Label>
                <Input
                  value={containerForm.originPort}
                  onChange={(e) => setContainerForm((p) => ({ ...p, originPort: e.target.value }))}
                />
              </div>
              <div>
                <Label>Puerto Destino</Label>
                <Input
                  value={containerForm.destinationPort}
                  onChange={(e) => setContainerForm((p) => ({ ...p, destinationPort: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ETD Estimado</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etdEstimated}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etdEstimated: e.target.value }))}
                />
              </div>
              <div>
                <Label>ETA Estimado</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etaEstimated}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etaEstimated: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>ETD Real</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etdActual}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etdActual: e.target.value }))}
                />
              </div>
              <div>
                <Label>ETA Real</Label>
                <Input
                  type="datetime-local"
                  value={containerForm.etaActual}
                  onChange={(e) => setContainerForm((p) => ({ ...p, etaActual: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Ubicación Actual</Label>
              <Input
                value={containerForm.currentLocation}
                onChange={(e) => setContainerForm((p) => ({ ...p, currentLocation: e.target.value }))}
              />
            </div>
            <Button onClick={handleUpdateContainer} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Evento a Operación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={eventForm.description}
                onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Fecha y Hora</Label>
              <Input
                type="datetime-local"
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))}
              />
            </div>
            <Button onClick={handleAddEvent} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Container Event Dialog */}
      <Dialog open={addContainerEventDialogOpen} onOpenChange={setAddContainerEventDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Evento a Contenedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={eventForm.description}
                onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input
                value={eventForm.location}
                onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Fecha y Hora</Label>
              <Input
                type="datetime-local"
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))}
              />
            </div>
            <Button onClick={handleAddContainerEvent} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
