/**
 * Estados de operación / contenedor (español, valor persistido en BD).
 * Orden = avance en el flujo (para syncOperationSummaryFromContainers).
 */
export const STATUS_ORDER = [
  'Pendiente',
  'Cargando',
  'Sellado',
  'En puerto US',
  'En puerto Brazil',
  'En Tránsito al Puerto del Mariel',
  'En Puerto del Mariel',
  'En Aduana',
  'Retenido en Aduana',
  'Liberado Aduana',
  'Descargado en Puerto del Mariel',
  'Completado',
  'Cancelado',
] as const;

export type OperationStatusValue = (typeof STATUS_ORDER)[number];

export const DEFAULT_OPERATION_STATUS: OperationStatusValue = 'Pendiente';

/** Contenedores que no cuentan como “activos” en filtros / export. Incluye equivalentes legacy en inglés. */
export const INACTIVE_CONTAINER_STATUSES: string[] = [
  'Completado',
  'Cancelado',
  'Delivered',
  'Closed',
  'Cancelled',
];

/** Mapeo legacy (inglés u otros) → estado actual para orden y métricas. */
export const LEGACY_STATUS_TO_CANONICAL: Record<string, OperationStatusValue> = {
  Draft: 'Pendiente',
  'Booking Confirmed': 'Sellado',
  'Container Assigned': 'Sellado',
  Loaded: 'Cargando',
  'Gate In (Port)': 'En puerto US',
  'BL Final Issued': 'En puerto US',
  'Departed US': 'En Tránsito al Puerto del Mariel',
  'Departed Brazil': 'En Tránsito al Puerto del Mariel',
  'En Transito al Puerto del Mariel': 'En Tránsito al Puerto del Mariel',
  'Arrived Cuba': 'En Puerto del Mariel',
  Customs: 'En Aduana',
  Released: 'Liberado Aduana',
  Delivered: 'Completado',
  Closed: 'Completado',
  Cancelled: 'Cancelado',
};

export function normalizeContainerStatus(status: string): string {
  const c = LEGACY_STATUS_TO_CANONICAL[status];
  return c ?? status;
}

export function statusOrderIndex(status: string): number {
  const n = normalizeContainerStatus(status);
  const i = STATUS_ORDER.indexOf(n as OperationStatusValue);
  return i >= 0 ? i : 0;
}
