import type { Operation, OperationContainer } from "@/lib/api";
import { daysSinceArrivalCalendar, isEtaArrivalDayOnOrBeforeToday } from "@/lib/mariel-days";

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
    "En Aeropuerto de Cuba": "Aeropuerto Cuba",
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

export function getDisplayLocation(container: OperationContainer, operation: Operation): string {
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

export function getLastUpdateDashboard(container: OperationContainer): string {
  const raw =
    container.trackingLastEventAt ||
    container.trackingLastSyncAt ||
    (container.events && container.events.length > 0 ? container.events[0].eventDate : null) ||
    container.updatedAt;
  return formatDateShort(raw);
}

function formatTableDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatEtaArriboMarielDashboard(container: OperationContainer): string {
  const raw = container.etaActual || container.etaEstimated;
  return formatTableDate(raw ?? undefined);
}

export function etaArriboMarielIsGreenDashboard(container: OperationContainer): boolean {
  const raw = container.etaActual || container.etaEstimated;
  return isEtaArrivalDayOnOrBeforeToday(raw ?? null);
}

export function getDaysInMarielDisplayDashboard(container: OperationContainer): {
  text: string;
  danger: boolean;
} {
  const refRaw = container.etaActual || container.etaEstimated;
  const days = daysSinceArrivalCalendar(refRaw ?? null);
  if (days === null) {
    return { text: "—", danger: false };
  }
  return { text: String(days), danger: days > 10 };
}

/** Días en Mariel para ordenar; -1 = sin dato (van al final). */
export function daysInMarielSortKeyDashboard(container: OperationContainer): number {
  const refRaw = container.etaActual || container.etaEstimated;
  const days = daysSinceArrivalCalendar(refRaw ?? null);
  if (days === null) return -1;
  return days;
}
