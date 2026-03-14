import { prisma } from './prisma.js';

/** Orden del flujo de estados: el índice más alto = más avanzado. */
const STATUS_ORDER = [
  'Draft',
  'Booking Confirmed',
  'Container Assigned',
  'Loaded',
  'Gate In (Port)',
  'BL Final Issued',
  'Departed US',
  'Arrived Cuba',
  'Customs',
  'Released',
  'Delivered',
  'Closed',
  'Cancelled',
] as const;

function statusIndex(s: string): number {
  const i = STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);
  return i >= 0 ? i : -1;
}

/**
 * Recalcula el resumen de la operación desde sus contenedores:
 * - status: el estado "más avanzado" entre todos los contenedores (por flujo de trabajo)
 * - originPort / destinationPort: primer valor no nulo entre contenedores (por sequenceNo)
 * Así con 2+ contenedores el resumen refleja el progreso real de la operación.
 */
export async function syncOperationSummaryFromContainers(operationId: string): Promise<void> {
  const containers = await prisma.operationContainer.findMany({
    where: { operationId },
    orderBy: { sequenceNo: 'asc' },
    select: {
      status: true,
      originPort: true,
      destinationPort: true,
      currentLocation: true,
    },
  });

  if (containers.length === 0) return;

  const mostAdvancedStatus = containers.reduce<string>((best, c) => {
    const idx = statusIndex(c.status);
    const bestIdx = statusIndex(best);
    return idx > bestIdx ? c.status : best;
  }, containers[0].status);

  const originPort = containers.map((c) => c.originPort).find(Boolean) ?? null;
  const destinationPort = containers.map((c) => c.destinationPort).find(Boolean) ?? null;
  const currentLocation = containers.map((c) => c.currentLocation).find(Boolean) ?? null;

  await prisma.operation.update({
    where: { id: operationId },
    data: {
      status: mostAdvancedStatus,
      ...(originPort != null && { originPort }),
      ...(destinationPort != null && { destinationPort }),
      ...(currentLocation != null && { currentLocation }),
    },
  });
}
