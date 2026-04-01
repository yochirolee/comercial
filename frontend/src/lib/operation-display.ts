import type { Operation, OperationContainer } from "@/lib/api";

/** Etiqueta visible en tablas.
 * Prioridad:
 *  - Si hay referencia visible (cualquier tipo): usarla
 *  - Parcel: contenedor/BL/booking de la fila
 *  - Resto: número interno de operación
 */
export function operationRowLabel(op: Operation, container: OperationContainer): string {
  const ref = op.referenciaOperacion?.trim();
  if (ref) return ref;
  if (op.operationType === "PARCEL") {
    const fromContainer =
      container.containerNo?.trim() ||
      container.blNo?.trim() ||
      container.bookingNo?.trim();
    if (fromContainer) return fromContainer;
  }
  return op.operationNo;
}

/** Título en cabecera de detalle (Parcel): primer contenedor con datos o referencia manual. */
const GIFT_PARCEL_DESCRIPTION = "Gift Parcel";

/** Resumen corto para fila de tabla: Parcel fijo; comercial con productos de la oferta. */
export function operationTableDescription(op: Operation): string {
  if (op.operationType === "PARCEL") {
    return GIFT_PARCEL_DESCRIPTION;
  }
  const items = op.offerCustomer?.items;
  if (!items?.length) {
    return "—";
  }
  const parts: string[] = [];
  for (const it of items) {
    const name =
      it.nombreProducto?.trim() ||
      it.producto?.nombre?.trim() ||
      it.descripcion?.trim();
    if (name) {
      parts.push(name);
    }
  }
  if (parts.length === 0) {
    return "—";
  }
  const text = parts.join(", ");
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

export function operationParcelDetailTitle(op: Operation): string {
  const containers = op.containers ?? [];
  for (const c of containers) {
    const t = c.containerNo?.trim() || c.blNo?.trim() || c.bookingNo?.trim();
    if (t) return t;
  }
  const ref = op.referenciaOperacion?.trim();
  if (ref) return ref;
  return "Parcel";
}
