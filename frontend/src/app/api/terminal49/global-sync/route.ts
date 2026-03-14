import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const T49_BASE = "https://api.terminal49.com/v2";

function getAuthHeader(): string {
  const token = process.env.T49_API_KEY || process.env.TERMINAL49_API_KEY || "";
  const raw = token.trim();
  if (!raw) throw new Error("T49_API_KEY or TERMINAL49_API_KEY must be set");
  return raw.startsWith("Token ") ? raw : `Token ${raw}`;
}

function getLastSync(): string {
  const fromEnv = process.env.LAST_SYNC;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const fallback = new Date();
  fallback.setUTCHours(fallback.getUTCHours() - 24);
  return fallback.toISOString();
}

type TrackingRequestListItem = {
  id: string;
  type: string;
  attributes?: { updated_at?: string; status?: string; request_number?: string };
  relationships?: {
    tracked_object?: { data?: { id: string; type: string } | null };
  };
};

type TrackingRequestsResponse = {
  data?: TrackingRequestListItem[];
};

type ShipmentAttributes = {
  bill_of_lading_number?: string | null;
  port_of_lading_name?: string | null;
  port_of_discharge_name?: string | null;
  pol_atd_at?: string | null;
  pol_etd_at?: string | null;
  pod_ata_at?: string | null;
  pod_eta_at?: string | null;
  line_tracking_last_succeeded_at?: string | null;
  line_tracking_stopped_at?: string | null;
};

type IncludedItem = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
};

type TrackingRequestDetailResponse = {
  data?: {
    id: string;
    type: string;
    attributes?: { updated_at?: string; status?: string };
    relationships?: {
      tracked_object?: { data?: { id: string; type: string } | null };
    };
  };
  included?: IncludedItem[];
};

type GlobalSyncUpdate = {
  tracking_request_id: string;
  terminal49_status: string | null;
  bill_of_lading_number: string | null;
  shipment: ShipmentAttributes | null;
};

function extractShipmentAttrs(attrs: Record<string, unknown>): ShipmentAttributes {
  const str = (key: string): string | null =>
    typeof attrs[key] === "string" ? (attrs[key] as string) : null;
  return {
    bill_of_lading_number: str("bill_of_lading_number"),
    port_of_lading_name: str("port_of_lading_name"),
    port_of_discharge_name: str("port_of_discharge_name"),
    pol_atd_at: str("pol_atd_at"),
    pol_etd_at: str("pol_etd_at"),
    pod_ata_at: str("pod_ata_at"),
    pod_eta_at: str("pod_eta_at"),
    line_tracking_last_succeeded_at: str("line_tracking_last_succeeded_at"),
    line_tracking_stopped_at: str("line_tracking_stopped_at"),
  };
}

async function fetchT49<T>(url: string, auth: string, logLabel?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: auth, "Content-Type": "application/vnd.api+json" },
    });
  } catch (netErr) {
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    console.error("[terminal49/global-sync] Network error fetching", url, msg);
    throw new Error(`Network error fetching ${url}: ${msg}`);
  }
  const text = await res.text();
  if (!res.ok) {
    console.error("[terminal49/global-sync] HTTP error", res.status, url, text.slice(0, 300));
    throw new Error(`Terminal49 API error ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    console.error("[terminal49/global-sync] Parse error", url, text.slice(0, 300));
    throw new Error("Invalid JSON from Terminal49");
  }
  if (logLabel) {
    console.log(`[terminal49/global-sync] ${logLabel}`, JSON.stringify(data, null, 2));
  }
  return data;
}

export async function GET(): Promise<NextResponse> {
  let auth: string;
  try {
    auth = getAuthHeader();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Missing API key";
    console.error("[terminal49/global-sync]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  const lastSync = getLastSync();
  console.log("[terminal49/global-sync] LAST_SYNC filter:", lastSync);

  // Obtener IDs activos desde el backend para filtrar antes de llamar a Terminal49
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
  let activeRequestIds = new Set<string>();
  let activeBlNos = new Set<string>();
  try {
    const idsRes = await fetch(`${apiUrl}/terminal49/active-ids`, { cache: "no-store" });
    if (idsRes.ok) {
      const idsData = await idsRes.json() as { terminal49RequestIds: string[]; blNos: string[] };
      activeRequestIds = new Set(idsData.terminal49RequestIds);
      activeBlNos = new Set(idsData.blNos);
      console.log("[terminal49/global-sync] active containers:", {
        byRequestId: activeRequestIds.size,
        byBlNo: activeBlNos.size,
      });
    } else {
      console.warn("[terminal49/global-sync] could not fetch active-ids, will process all");
    }
  } catch (err) {
    console.warn("[terminal49/global-sync] active-ids fetch error, will process all:", err);
  }

  const hasActiveFilter = activeRequestIds.size > 0 || activeBlNos.size > 0;

  let processed = 0;
  let skipped = 0;
  let pageNumber = 1;
  const pageSize = 100;
  const updates: GlobalSyncUpdate[] = [];

  try {
    // Step 1 & 2: paginate all updated tracking_requests
    while (true) {
      const listUrl = new URL(`${T49_BASE}/tracking_requests`);
      listUrl.searchParams.set("filter[updated_at][start]", lastSync);
      listUrl.searchParams.set("page[number]", String(pageNumber));
      listUrl.searchParams.set("page[size]", String(pageSize));

      const list = await fetchT49<TrackingRequestsResponse>(
        listUrl.toString(),
        auth,
        `GET tracking_requests (page ${pageNumber}) response:`
      );
      const items = list.data ?? [];

      // Step 3: for each tracking_request, get detail and extract shipment
      for (const item of items) {
        const trackingId = item.id;

        // Filtrar: si tenemos IDs activos, saltamos los que no correspondan a ningún contenedor activo.
        // El BL puede estar en included del listado (como shipment.bill_of_lading_number) o en request_number.
        if (hasActiveFilter) {
          const blInList = (() => {
            // En algunos responses el listado trae included con shipments
            if (Array.isArray((item as unknown as { included?: unknown[] }).included)) {
              return null; // no aplica aquí
            }
            return null;
          })();
          const blGuess = item.attributes?.request_number ?? blInList;
          const matchById = activeRequestIds.has(trackingId);
          const matchByBl = typeof blGuess === "string" && activeBlNos.has(blGuess);
          if (!matchById && !matchByBl) {
            skipped++;
            console.log("[terminal49/global-sync] skip (not in active containers):", trackingId, blGuess);
            continue;
          }
        }

        try {
          const detail = await fetchT49<TrackingRequestDetailResponse>(
            `${T49_BASE}/tracking_requests/${trackingId}`,
            auth,
            `GET tracking_requests/${trackingId} response:`
          );

          if (!detail.data) {
            console.warn("[terminal49/global-sync] No data for tracking_request", trackingId);
            processed++;
            continue;
          }

          const terminal49Status = detail.data.attributes?.status ?? null;
          const updatedAt = detail.data.attributes?.updated_at ?? item.attributes?.updated_at ?? null;

          // Find shipment in included or from relationships
          let shipmentId: string | null = null;
          const tracked = detail.data.relationships?.tracked_object?.data;
          if (tracked?.type === "shipment" && tracked?.id) shipmentId = tracked.id;
          if (!shipmentId && Array.isArray(detail.included)) {
            const s = detail.included.find((i) => i.type === "shipment");
            if (s?.id) shipmentId = s.id;
          }

          // Extract shipment attributes already available from included
          let shipmentAttrs: ShipmentAttributes | null = null;
          if (Array.isArray(detail.included)) {
            const shipmentIncluded = detail.included.find((i) => i.type === "shipment");
            if (shipmentIncluded?.attributes) {
              shipmentAttrs = extractShipmentAttrs(shipmentIncluded.attributes);
            }
          }

          // Step 4: call GET /shipments/{id} only if we don't have attrs yet
          if (shipmentId && !shipmentAttrs) {
            const shipmentRes = await fetchT49<{ data?: { attributes?: Record<string, unknown> } }>(
              `${T49_BASE}/shipments/${shipmentId}`,
              auth,
              `GET shipments/${shipmentId} response:`
            );
            if (shipmentRes.data?.attributes) {
              shipmentAttrs = extractShipmentAttrs(shipmentRes.data.attributes);
            }
          }

          // Step 5: log summary
          const blNumber = shipmentAttrs?.bill_of_lading_number ??
            (typeof item.attributes?.request_number === "string"
              ? item.attributes.request_number
              : null);
          console.log("[terminal49/global-sync]", {
            tracking_id: trackingId,
            shipment_id: shipmentId,
            bl: blNumber,
            status: terminal49Status,
            updated_at: updatedAt,
          });

          updates.push({
            tracking_request_id: trackingId,
            terminal49_status: terminal49Status,
            bill_of_lading_number: blNumber,
            shipment: shipmentAttrs,
          });
          processed++;
        } catch (err) {
          console.error("[terminal49/global-sync] Error processing", trackingId, err);
        }
      }

      if (items.length < pageSize) break;
      pageNumber++;
    }

    // Step 6: send all collected data to backend for DB update
    let backendResult: { updated?: number } = {};
    if (updates.length > 0) {
      const backendUrl = `${apiUrl}/terminal49/global-sync-update`;
      try {
        const backendRes = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        if (backendRes.ok) {
          backendResult = (await backendRes.json()) as { updated?: number };
          console.log("[terminal49/global-sync] backend update result:", backendResult);
        } else {
          const errText = await backendRes.text();
          console.error("[terminal49/global-sync] backend update failed:", backendRes.status, errText);
        }
      } catch (err) {
        console.error("[terminal49/global-sync] backend call error:", err);
      }
    }

    console.log("[terminal49/global-sync] done:", { processed, skipped, updated: backendResult.updated ?? 0 });
    return NextResponse.json({
      success: true,
      processed,
      skipped,
      updated: backendResult.updated ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[terminal49/global-sync]", message);
    return NextResponse.json({ success: false, error: message, processed }, { status: 500 });
  }
}
