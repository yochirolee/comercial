import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { syncOperationSummaryFromContainers } from '../lib/operation-summary.js';
import { INACTIVE_CONTAINER_STATUSES } from '../lib/operation-status.js';
import { createContainerEvent } from './operation.controller.js';

type WebhookPayload = {
  data?: {
    id?: string;
    type?: string;
    attributes?: { event?: string; delivery_status?: string; created_at?: string };
  };
  included?: Array<{
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  }>;
};

function byType(included: WebhookPayload['included'], type: string) {
  return included?.find((i) => i.type === type);
}

function allByType(included: WebhookPayload['included'], type: string) {
  return included?.filter((i) => i.type === type) ?? [];
}

/** Parsea timestamp del webhook (ej. "2026-03-12 06:57:00 UTC") como UTC para evitar cambios de día por timezone. */
function parseWebhookTimestamp(ts: string): Date | null {
  if (!ts || typeof ts !== 'string') return null;
  const normalized = ts.trim().replace(' UTC', 'Z').replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Mapeo evento de transporte Terminal49 → estado nuestro (español). */
const TRANSPORT_EVENT_TO_STATUS: Record<string, string> = {
  'container.transport.full_in': 'Cargando',
  'container.transport.vessel_loaded': 'Cargando',
  'container.transport.vessel_departed': 'En Tránsito al Puerto del Mariel',
  'container.transport.rail_departed': 'En Tránsito al Puerto del Mariel',
  'container.transport.vessel_arrived': 'En Puerto del Mariel',
  'container.transport.vessel_discharged': 'Descargado en Puerto del Mariel',
  'container.transport.feeder_departed': 'En Tránsito al Puerto del Mariel',
  'container.transport.feeder_arrived': 'En Puerto del Mariel',
  'container.transport.feeder_discharged': 'Descargado en Puerto del Mariel',
  'container.transport.transshipment_departed': 'En Tránsito al Puerto del Mariel',
  'container.transport.transshipment_arrived': 'En Puerto del Mariel',
  'container.transport.transshipment_discharged': 'Descargado en Puerto del Mariel',
  'container.transport.available': 'Liberado Aduana',
  'container.transport.arrived_at_inland_destination': 'Completado',
  'container.transport.empty_in': 'Completado',
};

/** Evento webhook (ej. tracking_request.succeeded) → terminal49Status. */
function eventToTerminal49Status(event: string): string | null {
  if (event === 'tracking_request.succeeded') return 'succeeded';
  if (event === 'tracking_request.failed') return 'failed';
  if (event === 'tracking_request.tracking_stopped') return 'tracking_stopped';
  if (event === 'tracking_request.awaiting_manifest') return 'awaiting_manifest';
  return null;
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body as WebhookPayload;
    const event = payload?.data?.attributes?.event;
    const included = payload?.included ?? [];

    console.log('[Terminal49 webhook backend] received', {
      event,
      tracking_request_id: payload?.data?.id,
      included_types: included.map((i) => i.type),
    });

    if (!event) {
      res.status(200).json({ received: true });
      return;
    }

    const trackingRequest = byType(included, 'tracking_request');
    const shipment = byType(included, 'shipment');
    const containersIncluded = allByType(included, 'container');
    const transportEvents = allByType(included, 'transport_event');

    const trackingRequestId = trackingRequest?.id ?? payload?.data?.id;
    const billOfLading = (shipment?.attributes as { bill_of_lading_number?: string })?.bill_of_lading_number;
    const portOfLading = (shipment?.attributes as { port_of_lading_name?: string })?.port_of_lading_name;
    const portOfDischarge = (shipment?.attributes as { port_of_discharge_name?: string })?.port_of_discharge_name;
    const lastTransportEvent = transportEvents[transportEvents.length - 1];
    // Fecha real del evento (ej. vessel_loaded); el GET de Terminal49 no trae esto, solo line_tracking_last_succeeded_at.
    const eventTimestamp = lastTransportEvent?.attributes
      ? (lastTransportEvent.attributes as { timestamp?: string }).timestamp
      : null;
    const eventLocation = lastTransportEvent?.attributes
      ? (lastTransportEvent.attributes as { location_locode?: string }).location_locode
      : null;
    const firstContainerNumber = containersIncluded[0]
      ? (containersIncluded[0].attributes as { number?: string })?.number
      : null;

    let container: { id: string; operationId: string } | null = null;
    if (trackingRequestId) {
      container = await prisma.operationContainer.findFirst({
        where: { terminal49RequestId: trackingRequestId },
        select: { id: true, operationId: true },
      });
    }
    if (!container && billOfLading) {
      container = await prisma.operationContainer.findFirst({
        where: { blNo: billOfLading },
        select: { id: true, operationId: true },
      });
    }

    if (container) {
      const updateData: Record<string, unknown> = { trackingLastSyncAt: new Date() };
      if (portOfLading) updateData.originPort = portOfLading;
      if (portOfDischarge) updateData.destinationPort = portOfDischarge;
      if (eventLocation) updateData.currentLocation = eventLocation;
      if (firstContainerNumber) updateData.containerNo = firstContainerNumber;

      const t49Status = eventToTerminal49Status(event);
      if (t49Status) updateData.terminal49Status = t49Status;

      const transportEventType = lastTransportEvent?.attributes
        ? (lastTransportEvent.attributes as { event?: string }).event
        : null;

      const isEstimatedEvent = transportEventType?.includes('.estimated.') ||
        event === 'shipment.estimated.arrival';

      if (eventTimestamp) {
        const d = parseWebhookTimestamp(eventTimestamp);
        if (d) {
          if (isEstimatedEvent) {
            // Eventos estimated.*: el timestamp es la nueva ETA/ETD estimada
            if (
              transportEventType === 'container.transport.estimated.vessel_arrived' ||
              event === 'shipment.estimated.arrival'
            ) {
              updateData.etaActual = d;
              console.log('[Terminal49 webhook backend] ETA updated to', d);
            } else if (transportEventType === 'container.transport.estimated.vessel_departed') {
              updateData.etdActual = d;
              console.log('[Terminal49 webhook backend] ETD updated to', d);
            }
            // Para estimated events no actualizar trackingLastEventAt (no es un evento real)
          } else {
            // Eventos reales: actualizar trackingLastEventAt
            updateData.trackingLastEventAt = d;
          }
        }
      }

      // Solo cambiar status con eventos de transporte reales (no estimated)
      if (!isEstimatedEvent && transportEventType && TRANSPORT_EVENT_TO_STATUS[transportEventType]) {
        updateData.status = TRANSPORT_EVENT_TO_STATUS[transportEventType];
      }

      await prisma.operationContainer.update({
        where: { id: container.id },
        data: updateData as any,
      });
      await syncOperationSummaryFromContainers(container.operationId);

      // Log en el timeline del contenedor
      const eventDate = eventTimestamp ? (parseWebhookTimestamp(eventTimestamp) ?? new Date()) : new Date();
      const logParts: string[] = [`Evento: ${event}`];
      if (isEstimatedEvent) {
        if (updateData.etaActual) logParts.push(`Nueva ETA: ${new Date(updateData.etaActual as Date).toLocaleDateString('es-ES')}`);
        if (updateData.etdActual) logParts.push(`Nueva ETD: ${new Date(updateData.etdActual as Date).toLocaleDateString('es-ES')}`);
      } else {
        if (updateData.status) logParts.push(`Estado: ${updateData.status as string}`);
        if (portOfLading) logParts.push(`Origen: ${portOfLading}`);
        if (portOfDischarge) logParts.push(`Destino: ${portOfDischarge}`);
      }
      await createContainerEvent(
        container.id,
        'tracking',
        isEstimatedEvent ? 'Webhook: Cambio de ETA/ETD' : 'Webhook: Evento de transporte',
        logParts.join(' · '),
        eventDate,
        eventLocation ?? undefined
      );

      console.log('[Terminal49 webhook backend] updated container', container.id, updateData);
    } else {
      console.log('[Terminal49 webhook backend] no container found for', { trackingRequestId, billOfLading });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Terminal49 webhook backend] error', err);
    res.status(200).json({ received: true });
  }
}

const INACTIVE_STATUSES = [...INACTIVE_CONTAINER_STATUSES];

/** Devuelve los terminal49RequestId y blNo de contenedores activos para que el global-sync filtre antes de llamar a la API. */
export async function handleGetActiveIds(req: import('express').Request, res: import('express').Response): Promise<void> {
  const containers = await prisma.operationContainer.findMany({
    where: { status: { notIn: INACTIVE_STATUSES } },
    select: { terminal49RequestId: true, blNo: true },
  });

  const terminal49RequestIds = containers
    .map((c) => c.terminal49RequestId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const blNos = containers
    .map((c) => c.blNo)
    .filter((bl): bl is string => typeof bl === 'string' && bl.length > 0);

  res.json({ terminal49RequestIds, blNos });
}

type GlobalSyncShipment = {
  port_of_lading_name?: string | null;
  port_of_discharge_name?: string | null;
  pol_atd_at?: string | null;
  pol_etd_at?: string | null;
  pod_ata_at?: string | null;
  pod_eta_at?: string | null;
  line_tracking_last_succeeded_at?: string | null;
  line_tracking_stopped_at?: string | null;
};

type GlobalSyncUpdate = {
  tracking_request_id: string;
  terminal49_status: string | null;
  bill_of_lading_number: string | null;
  shipment: GlobalSyncShipment | null;
};

type GlobalSyncBody = {
  updates: GlobalSyncUpdate[];
};

export async function handleGlobalSyncUpdate(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as GlobalSyncBody;
    const updates = body.updates ?? [];
    let updatedCount = 0;

    for (const item of updates) {
      try {
        let container: { id: string; operationId: string } | null = null;

        if (item.tracking_request_id) {
          container = await prisma.operationContainer.findFirst({
            where: { terminal49RequestId: item.tracking_request_id },
            select: { id: true, operationId: true },
          });
        }
        if (!container && item.bill_of_lading_number) {
          container = await prisma.operationContainer.findFirst({
            where: { blNo: item.bill_of_lading_number },
            select: { id: true, operationId: true },
          });
        }

        if (!container) {
          console.log('[Terminal49 global-sync] no container for', {
            tracking_request_id: item.tracking_request_id,
            bl: item.bill_of_lading_number,
          });
          continue;
        }

        // No actualizar contenedores ya entregados/cerrados/cancelados
        const currentStatus = await prisma.operationContainer.findUnique({
          where: { id: container.id },
          select: { status: true },
        });
        if (currentStatus?.status && INACTIVE_STATUSES.includes(currentStatus.status)) {
          console.log('[Terminal49 global-sync] skipping inactive container', container.id, currentStatus.status);
          continue;
        }

        const updateData: Record<string, unknown> = {
          trackingLastSyncAt: new Date(),
          terminal49RequestId: item.tracking_request_id,
        };

        if (item.terminal49_status) updateData.terminal49Status = item.terminal49_status;

        const s = item.shipment;
        if (s) {
          if (s.port_of_lading_name) updateData.originPort = s.port_of_lading_name;
          if (s.port_of_discharge_name) updateData.destinationPort = s.port_of_discharge_name;

          const etaStr = s.pod_ata_at ?? s.pod_eta_at;
          if (etaStr) {
            const d = new Date(etaStr);
            if (!isNaN(d.getTime())) updateData.etaActual = d;
          }

          const etdStr = s.pol_atd_at ?? s.pol_etd_at;
          if (etdStr) {
            const d = new Date(etdStr);
            if (!isNaN(d.getTime())) updateData.etdActual = d;
          }

          const lastActivityStr = s.line_tracking_stopped_at ?? s.line_tracking_last_succeeded_at;
          if (lastActivityStr) {
            const d = new Date(lastActivityStr);
            if (!isNaN(d.getTime())) {
              const current = await prisma.operationContainer.findUnique({
                where: { id: container.id },
                select: { trackingLastEventAt: true },
              });
              if (!current?.trackingLastEventAt) updateData.trackingLastEventAt = d;
            }
          }
        }

        await prisma.operationContainer.update({
          where: { id: container.id },
          data: updateData as Parameters<typeof prisma.operationContainer.update>[0]['data'],
        });
        await syncOperationSummaryFromContainers(container.operationId);

        // Log en el timeline del contenedor
        const syncParts: string[] = [];
        if (item.terminal49_status) syncParts.push(`Estado T49: ${item.terminal49_status}`);
        if (updateData.originPort) syncParts.push(`Origen: ${updateData.originPort as string}`);
        if (updateData.destinationPort) syncParts.push(`Destino: ${updateData.destinationPort as string}`);
        if (updateData.etaActual) syncParts.push(`ETA: ${new Date(updateData.etaActual as Date).toLocaleDateString('es-ES')}`);
        if (updateData.etdActual) syncParts.push(`ETD: ${new Date(updateData.etdActual as Date).toLocaleDateString('es-ES')}`);
        await createContainerEvent(
          container.id,
          'tracking',
          'Sync Global Terminal49',
          syncParts.length > 0 ? syncParts.join(' · ') : 'Datos actualizados desde Terminal49',
          new Date()
        );

        console.log('[Terminal49 global-sync] updated container', container.id, {
          tracking_request_id: item.tracking_request_id,
          bl: item.bill_of_lading_number,
          terminal49_status: item.terminal49_status,
        });
        updatedCount++;
      } catch (err) {
        console.error('[Terminal49 global-sync] error processing', item.tracking_request_id, err);
      }
    }

    res.json({ success: true, processed: updates.length, updated: updatedCount });
  } catch (err) {
    console.error('[Terminal49 global-sync] handler error', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
}
