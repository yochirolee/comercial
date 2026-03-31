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
