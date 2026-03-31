import type { Operation, OperationContainer } from "@/lib/api";

/** Etiqueta visible en tablas: Parcel prioriza contenedor/BL/booking de la fila, luego ref. manual, luego PKG. */
export function operationRowLabel(op: Operation, container: OperationContainer): string {
  if (op.operationType !== "PARCEL") return op.operationNo;
  const fromContainer =
    container.containerNo?.trim() ||
    container.blNo?.trim() ||
    container.bookingNo?.trim();
  if (fromContainer) return fromContainer;
  const ref = op.referenciaOperacion?.trim();
  if (ref) return ref;
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
