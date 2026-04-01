import { prisma } from './prisma.js';
import { statusOrderIndex } from './operation-status.js';

/**
 * Recalcula el resumen de la operación desde sus contenedores:
 * - status: el estado "más avanzado" entre todos los contenedores (por flujo de trabajo)
 * - originPort / destinationPort: primer valor no nulo entre contenedores (por sequenceNo)
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
    const idx = statusOrderIndex(c.status);
    const bestIdx = statusOrderIndex(best);
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
