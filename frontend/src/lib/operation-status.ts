/** Estados persistidos en BD (español). Orden = avance en el flujo. */
export const OPERATION_STATUSES = [
  "Pendiente",
  "Cargando",
  "Sellado",
  "En puerto US",
  "En puerto Brazil",
  "En Tránsito al Puerto del Mariel",
  "En Puerto del Mariel",
  "En Aduana",
  "Retenido en Aduana",
  "Liberado Aduana",
  "Descargado en Puerto del Mariel",
  "Completado",
  "Cancelado",
] as const;

/** Mapeo legacy (inglés) → etiqueta español actual. */
const LEGACY_TO_CANONICAL: Record<string, string> = {
  Draft: "Pendiente",
  "Booking Confirmed": "Sellado",
  "Container Assigned": "Sellado",
  Loaded: "Cargando",
  "Gate In (Port)": "En puerto US",
  "BL Final Issued": "En puerto US",
  "Departed US": "En Tránsito al Puerto del Mariel",
  "Departed Brazil": "En Tránsito al Puerto del Mariel",
  "En Transito al Puerto del Mariel": "En Tránsito al Puerto del Mariel",
  "Arrived Cuba": "En Puerto del Mariel",
  Customs: "En Aduana",
  Released: "Liberado Aduana",
  Delivered: "Completado",
  Closed: "Completado",
  Cancelled: "Cancelado",
};

/** Texto mostrado (español; traduce valores legacy hasta migrar BD). */
export function operationStatusLabelEs(status: string): string {
  return LEGACY_TO_CANONICAL[status] ?? status;
}

/**
 * Valor para `<Select value={...}>`: debe coincidir exactamente con un `SelectItem`
 * de OPERATION_STATUSES. Convierte legacy (inglés, etc.) al canónico en español.
 */
export function operationStatusSelectValue(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "Pendiente";
  const canonical = LEGACY_TO_CANONICAL[s] ?? s;
  const allowed = OPERATION_STATUSES as readonly string[];
  if (allowed.includes(canonical)) return canonical;
  return "Pendiente";
}

function canonicalForUi(status: string): string {
  return LEGACY_TO_CANONICAL[status] ?? status;
}

/** Clases Tailwind para badge de estado */
export const operationStatusBadgeClasses: Record<string, string> = {
  Pendiente: "bg-slate-100 text-slate-800",
  Cargando: "bg-amber-100 text-amber-900",
  Sellado: "bg-indigo-100 text-indigo-900",
  "En puerto US": "bg-blue-100 text-blue-900",
  "En puerto Brazil": "bg-cyan-100 text-cyan-900",
  "En Tránsito al Puerto del Mariel": "bg-sky-100 text-sky-900",
  "En Puerto del Mariel": "bg-emerald-100 text-emerald-900",
  "En Aduana": "bg-yellow-100 text-yellow-900",
  "Retenido en Aduana": "bg-orange-100 text-orange-900",
  "Liberado Aduana": "bg-lime-100 text-lime-900",
  "Descargado en Puerto del Mariel": "bg-teal-100 text-teal-900",
  Completado: "bg-green-600 text-white",
  Cancelado: "bg-red-500 text-white",
};

export function operationStatusBadgeClass(status: string): string {
  const key = canonicalForUi(status);
  return operationStatusBadgeClasses[key] ?? "bg-slate-100 text-slate-700";
}
