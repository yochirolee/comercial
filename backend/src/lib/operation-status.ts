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

/**
 * Valores en BD que deben coincidir al filtrar por un estado de la UI (canónico en español o legacy).
 * Ej.: filtro "Pendiente" → ["Pendiente", "Draft"].
 */
export function statusFilterValuesForQuery(filterLabel: string): string[] {
  const f = filterLabel.trim();
  if (!f) return [];

  const out = new Set<string>();

  if ((STATUS_ORDER as readonly string[]).includes(f)) {
    out.add(f);
    for (const [legacy, canon] of Object.entries(LEGACY_STATUS_TO_CANONICAL)) {
      if (canon === f) out.add(legacy);
    }
    return [...out];
  }

  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_TO_CANONICAL, f)) {
    const canon = LEGACY_STATUS_TO_CANONICAL[f as keyof typeof LEGACY_STATUS_TO_CANONICAL];
    out.add(f);
    out.add(canon);
    return [...out];
  }

  out.add(f);
  return [...out];
}

export function statusOrderIndex(status: string): number {
  const n = normalizeContainerStatus(status);
  const i = STATUS_ORDER.indexOf(n as OperationStatusValue);
  return i >= 0 ? i : 0;
}
