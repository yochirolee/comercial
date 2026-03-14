import { NextRequest, NextResponse } from "next/server";

type WebhookNotification = {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      event?: string;
      delivery_status?: string;
      created_at?: string;
    };
  };
  included?: Array<{
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  }>;
};

function byType<T extends { type?: string }>(included: T[] | undefined, type: string): T | undefined {
  return included?.find((i) => i.type === type);
}

function allByType<T extends { type?: string }>(included: T[] | undefined, type: string): T[] {
  return included?.filter((i) => i.type === type) ?? [];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error("[Terminal49 webhook] Parse error", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const payload = body as WebhookNotification;

  // Log completo del payload para verificar
  console.log("[Terminal49 webhook] RAW payload:", JSON.stringify(payload, null, 2));

  if (!payload?.data?.attributes?.event) {
    console.warn("[Terminal49 webhook] Payload missing data.attributes.event");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const event = payload.data.attributes.event as string;
  const included = payload.included ?? [];

  const trackingRequest = byType(included, "tracking_request");
  const shipment = byType(included, "shipment");
  const containers = allByType(included, "container");
  const transportEvents = allByType(included, "transport_event");

  const billOfLading =
    (shipment?.attributes as { bill_of_lading_number?: string } | undefined)?.bill_of_lading_number ??
    (trackingRequest?.attributes as { request_number?: string } | undefined)?.request_number;
  const shippingLineName = (shipment?.attributes as { shipping_line_name?: string } | undefined)?.shipping_line_name;
  const portOfLading = (shipment?.attributes as { port_of_lading_name?: string } | undefined)?.port_of_lading_name;
  const containerNumbers = containers
    .map((c) => (c.attributes as { number?: string } | undefined)?.number)
    .filter(Boolean) as string[];

  console.log("[Terminal49 webhook] parsed", {
    event,
    bill_of_lading_number: billOfLading,
    shipping_line_name: shippingLineName,
    port_of_lading_name: portOfLading,
    container_numbers: containerNumbers,
    transport_events: transportEvents.map((e) => {
      const attrs = e.attributes as {
        event?: string;
        timestamp?: string;
        location_locode?: string;
        voyage_number?: string;
      } | undefined;
      return {
        event: attrs?.event,
        timestamp: attrs?.timestamp,
        location_locode: attrs?.location_locode,
        voyage_number: attrs?.voyage_number,
      };
    }),
  });

  // Reenviar al backend para que actualice el contenedor en la BD
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  const webhookUrl = `${apiUrl.replace(/\/$/, "")}/terminal49/webhook`;
  try {
    const backendRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!backendRes.ok) {
      console.warn("[Terminal49 webhook] backend responded", backendRes.status, await backendRes.text());
    }
  } catch (err) {
    console.error("[Terminal49 webhook] backend forward error", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
