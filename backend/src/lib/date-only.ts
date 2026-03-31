/**
 * Fechas tipo calendario (input HTML date = YYYY-MM-DD) sin hora de negocio.
 * Evita desplazamientos al usar new Date("YYYY-MM-DD") + toLocaleDateString en otro huso.
 */

/** Desde input YYYY-MM-DD → instancia estable (mediodía UTC = mismo día civil en cualquier TZ). */
export function parseDateOnlyToStored(iso: string | undefined | null): Date | null {
  if (iso == null || String(iso).trim() === '') return null;
  const s = String(iso).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, day, 12, 0, 0, 0));
}

/** Mostrar día civil tal como se guardó (partes UTC). Formato d/m/aaaa como en el reporte. */
export function formatStoredDateOnlyEs(d: Date | string | null | undefined): string {
  if (d == null) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
