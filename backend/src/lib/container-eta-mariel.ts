import { prisma } from './prisma.js';
import {
  INACTIVE_CONTAINER_STATUSES,
  type OperationStatusValue,
  normalizeContainerStatus,
} from './operation-status.js';

const TRANSIT_MARIEL: OperationStatusValue = 'En Tránsito al Puerto del Mariel';
const MARIEL_PORT: OperationStatusValue = 'En Puerto del Mariel';

/** Comparación por día civil en UTC (alineado a fechas guardadas con mediodía UTC). */
function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * True si el día de arribo (ETA real o estimada) ya pasó (estrictamente anterior a hoy).
 * Se excluye el mismo día para evitar auto-promover un contenedor que puede llegar de noche.
 * El indicador visual «verde» en el frontend sigue usando <= hoy (isEtaArrivalDayOnOrBeforeToday).
 */
export function etaCalendarDayOnOrBeforeToday(
  etaEstimated: Date | null | undefined,
  etaActual: Date | null | undefined
): boolean {
  const eta = etaActual ?? etaEstimated;
  if (!eta || Number.isNaN(eta.getTime())) return false;
  const now = new Date();
  return utcDayStartMs(eta) < utcDayStartMs(now);
}

/** Auto-promoción solo desde tránsito hacia Mariel (incl. legacy normalizado). */
export function maybeMarielStatusFromEta(args: {
  status: string;
  etaEstimated: Date | null;
  etaActual: Date | null;
}): OperationStatusValue | null {
  if (INACTIVE_CONTAINER_STATUSES.includes(args.status)) return null;
  if (normalizeContainerStatus(args.status) !== TRANSIT_MARIEL) return null;
  if (!etaCalendarDayOnOrBeforeToday(args.etaEstimated, args.etaActual)) return null;
  return MARIEL_PORT;
}

/**
 * Tras actualizar ETA u otros campos vía sync/webhook: sube a Mariel si aplica.
 * No llama a syncOperationSummaryFromContainers; el caller debe hacerlo después.
 */
export async function applyTransitToMarielIfEtaReached(containerId: string): Promise<boolean> {
  const row = await prisma.operationContainer.findUnique({
    where: { id: containerId },
    select: { status: true, etaEstimated: true, etaActual: true },
  });
  if (!row) return false;

  const next = maybeMarielStatusFromEta({
    status: row.status,
    etaEstimated: row.etaEstimated,
    etaActual: row.etaActual,
  });
  if (!next) return false;

  await prisma.operationContainer.update({
    where: { id: containerId },
    data: { status: next },
  });

  await prisma.containerEvent.create({
    data: {
      operationContainerId: containerId,
      eventType: 'status_change',
      title: 'Cambio de Estado (automático)',
      description: `Estado cambiado de "${row.status}" a "${next}" (fecha de arribo alcanzada o superada)`,
      eventDate: new Date(),
      fromStatus: row.status,
      toStatus: next,
    },
  });

  return true;
}
