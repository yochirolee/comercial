import fetch from 'node-fetch';

const TERMINAL49_BASE = 'https://api.terminal49.com/v2';

/** Authorization: "Token YOUR_API_KEY". Env puede ser "Token xxx" o solo "xxx". */
function getAuthHeader(): string {
  const raw = process.env.TERMINAL49_API_KEY;
  if (!raw || !raw.trim()) {
    throw new Error('TERMINAL49_API_KEY debe estar configurado');
  }
  const token = raw.trim();
  return token.startsWith('Token ') ? token : `Token ${token}`;
}

/** Crear tracking request. request_type: bill_of_lading | booking_number. request_number: BL o booking. scac: 4 caracteres. */
export async function createTerminal49TrackingRequest(params: {
  request_type: 'bill_of_lading' | 'booking_number';
  request_number: string;
  scac: string;
}): Promise<string | null> {
  const scac = params.scac.trim().toUpperCase().slice(0, 4);
  if (scac.length !== 4) {
    console.error('[Terminal49] SCAC debe tener 4 caracteres:', params.scac);
    return null;
  }
  const request_number = params.request_number.trim();
  if (!request_number) return null;

  const body = {
    data: {
      type: 'tracking_request',
      attributes: {
        request_type: params.request_type,
        request_number,
        scac,
      },
    },
  };

  const resp = await fetch(`${TERMINAL49_BASE}/tracking_requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  const respText = await resp.text();
  console.log('[Terminal49] POST /tracking_requests response', resp.status, respText);
  const parsed = JSON.parse(respText) as {
    data?: { id?: string };
    errors?: Array<{ code?: string; meta?: { tracking_request_id?: string } }>;
  };

  if (resp.ok) {
    const id = parsed?.data?.id;
    return typeof id === 'string' ? id : null;
  }

  // 422 duplicate: Terminal49 devuelve el tracking_request_id existente en meta
  if (resp.status === 422 && Array.isArray(parsed.errors)) {
    const duplicate = parsed.errors.find((e) => e.code === 'duplicate');
    const existingId = duplicate?.meta?.tracking_request_id;
    if (typeof existingId === 'string') {
      return existingId;
    }
  }

  console.error('[Terminal49] POST /tracking_requests failed', resp.status, respText);
  return null;
}

/** Resultado normalizado para actualizar OperationContainer / Operation. */
export interface Terminal49TrackingResult {
  etaActual?: Date | null;
  statusText?: string | null;
  lastLocation?: string | null;
  /** GET: fecha de última actividad (line_tracking_last_succeeded_at / updated_at). No es el timestamp del evento como en el webhook. */
  lastEventAt?: Date | null;
  originPort?: string | null;
  destinationPort?: string | null;
  etdActual?: Date | null;
}

/** Obtener un tracking request por ID. Parsea included shipment para ETA, ubicación, etc. */
export async function getTerminal49TrackingRequest(
  requestId: string
): Promise<Terminal49TrackingResult | null> {
  const resp = await fetch(`${TERMINAL49_BASE}/tracking_requests/${requestId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: getAuthHeader(),
    },
  });

  const respText = await resp.text();
  console.log('[Terminal49] GET /tracking_requests/' + requestId + ' response', resp.status, respText);
  if (!resp.ok) {
    if (resp.status === 401) {
      console.warn('[Terminal49] GET no permitido con esta API key (solo creación). Se guarda el requestId; usa webhooks para actualizaciones.');
    } else {
      console.error('[Terminal49] GET /tracking_requests/' + requestId + ' failed', resp.status, respText);
    }
    return null;
  }

  const json = JSON.parse(respText) as {
    data?:
      | {
          id?: string;
          type?: string;
          attributes?: { status?: string; updated_at?: string };
          relationships?: { tracked_object?: { data?: { id: string; type: string } | null } };
        }
      | Array<{
          id?: string;
          type?: string;
          attributes?: {
            pod_eta_at?: string | null;
            pod_ata_at?: string | null;
            pol_etd_at?: string | null;
            pol_atd_at?: string | null;
            port_of_lading_name?: string | null;
            port_of_discharge_name?: string | null;
            destination_name?: string | null;
            destination_eta_at?: string | null;
            destination_ata_at?: string | null;
            updated_at?: string | null;
          };
        }>;
    included?: Array<{
      type: string;
      id: string;
      attributes?: {
        pod_eta_at?: string | null;
        pod_ata_at?: string | null;
        pol_etd_at?: string | null;
        pol_atd_at?: string | null;
        port_of_lading_name?: string | null;
        port_of_discharge_name?: string | null;
        destination_name?: string | null;
        destination_eta_at?: string | null;
        destination_ata_at?: string | null;
        updated_at?: string | null;
        line_tracking_last_succeeded_at?: string | null;
        line_tracking_stopped_at?: string | null;
      };
    }>;
  };

  const data = json?.data;
  if (!data) return null;

  type ShipmentAttrs = {
    pod_eta_at?: string | null;
    pod_ata_at?: string | null;
    pol_etd_at?: string | null;
    pol_atd_at?: string | null;
    port_of_lading_name?: string | null;
    port_of_discharge_name?: string | null;
    destination_name?: string | null;
    destination_eta_at?: string | null;
    destination_ata_at?: string | null;
    updated_at?: string | null;
    line_tracking_last_succeeded_at?: string | null;
    line_tracking_stopped_at?: string | null;
  };

  let attrs: ShipmentAttrs | undefined;
  let statusText: string | null = null;
  let trackingRequestUpdatedAt: string | undefined;

  if (Array.isArray(data) && data.length > 0 && data[0].type === 'shipment') {
    attrs = data[0].attributes;
  } else if (data && typeof data === 'object' && 'attributes' in data) {
    const tr = data as { attributes?: { status?: string; updated_at?: string }; relationships?: { tracked_object?: { data?: { id: string } | null } } };
    statusText = tr.attributes?.status ?? null;
    trackingRequestUpdatedAt = tr.attributes?.updated_at;
    const shipmentId = tr.relationships?.tracked_object?.data?.id;
    if (shipmentId && Array.isArray(json.included)) {
      const shipment = json.included.find((i: { type: string; id: string }) => i.type === 'shipment' && i.id === shipmentId);
      attrs = shipment?.attributes;
    }
  }

  let etaActual: Date | null = null;
  let etdActual: Date | null = null;
  let lastLocation: string | null = null;
  let lastEventAt: Date | null = null;
  let originPort: string | null = null;
  let destinationPort: string | null = null;

  if (attrs) {
    // ETA: llegada al POD (real o estimada)
    const etaStr =
      attrs.pod_ata_at ??
      attrs.pod_eta_at ??
      attrs.destination_ata_at ??
      attrs.destination_eta_at;
    if (etaStr) {
      const d = new Date(etaStr);
      if (!isNaN(d.getTime())) etaActual = d;
    }
    // ETD: salida del POL
    const etdStr = attrs.pol_atd_at ?? attrs.pol_etd_at;
    if (etdStr) {
      const d = new Date(etdStr);
      if (!isNaN(d.getTime())) etdActual = d;
    }
    lastLocation = attrs.port_of_discharge_name ?? attrs.destination_name ?? null;
    originPort = attrs.port_of_lading_name ?? null;
    destinationPort = attrs.port_of_discharge_name ?? null;
    // GET no trae transport_event.timestamp; usamos "última actividad" de Terminal49 (cuándo sincronizaron con la naviera).
    // Para la fecha real del evento usar webhook (transport_event.attributes.timestamp → trackingLastEventAt).
    const lastEventStr =
      attrs.line_tracking_stopped_at ??
      attrs.line_tracking_last_succeeded_at ??
      attrs.updated_at;
    if (lastEventStr) {
      const d = new Date(lastEventStr);
      if (!isNaN(d.getTime())) lastEventAt = d;
    }
  }
  if (!lastEventAt && trackingRequestUpdatedAt) {
    const d = new Date(trackingRequestUpdatedAt);
    if (!isNaN(d.getTime())) lastEventAt = d;
  }

  return {
    etaActual: etaActual ?? undefined,
    etdActual: etdActual ?? undefined,
    statusText,
    lastLocation: lastLocation ?? null,
    originPort: originPort ?? null,
    destinationPort: destinationPort ?? null,
    lastEventAt: lastEventAt ?? undefined,
  };
}

/**
 * Obtener o crear tracking en Terminal49 y devolver resultado.
 * Si existingRequestId existe, solo GET. Si no, crear con blNo o bookingNo + scac y luego GET.
 */
export async function fetchTerminal49Tracking(params: {
  blNo?: string | null;
  bookingNo?: string | null;
  scac: string;
  existingRequestId?: string | null;
}): Promise<{ requestId: string; result: Terminal49TrackingResult } | null> {
  const { scac, existingRequestId } = params;
  const blNo = params.blNo?.trim();
  const bookingNo = params.bookingNo?.trim();

  let requestId: string | null = existingRequestId ?? null;

  if (!requestId) {
    // Terminal49 recomienda usar BL primero; si hay BL usamos bill_of_lading, si no booking_number
    const request_number = blNo || bookingNo;
    const request_type = blNo ? 'bill_of_lading' : 'booking_number';
    if (!request_number) return null;
    requestId = await createTerminal49TrackingRequest({
      request_type,
      request_number,
      scac,
    });
    if (!requestId) return null;
  }

  const result = await getTerminal49TrackingRequest(requestId);
  // Si GET falla (ej. 401: la API key solo permite crear, no leer), igual devolvemos requestId
  // para guardarlo; así el contenedor queda vinculado y los webhooks podrán actualizar después.
  return { requestId, result: result ?? {} };
}
