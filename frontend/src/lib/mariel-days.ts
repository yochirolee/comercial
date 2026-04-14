/**
 * Misma lógica que backend/src/lib/mariel-days.ts (calendario Miami).
 */

export const OPERATIONS_CALENDAR_TIMEZONE = 'America/New_York';

export function calendarDateKeyInOperationsTz(
  d: Date,
  timeZone: string = OPERATIONS_CALENDAR_TIMEZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function isEtaArrivalDayOnOrBeforeToday(
  eta: Date | string | null | undefined,
  now: Date = new Date(),
  timeZone: string = OPERATIONS_CALENDAR_TIMEZONE
): boolean {
  if (eta == null) return false;
  const inst = typeof eta === 'string' ? new Date(eta) : eta;
  if (Number.isNaN(inst.getTime())) return false;
  const a = calendarDateKeyInOperationsTz(inst, timeZone);
  const b = calendarDateKeyInOperationsTz(now, timeZone);
  return a <= b;
}

export function daysSinceArrivalCalendar(
  eta: Date | string | null | undefined,
  now: Date = new Date(),
  timeZone: string = OPERATIONS_CALENDAR_TIMEZONE
): number | null {
  if (eta == null) return null;
  const inst = typeof eta === 'string' ? new Date(eta) : eta;
  if (Number.isNaN(inst.getTime())) return null;
  const a = calendarDateKeyInOperationsTz(inst, timeZone);
  const b = calendarDateKeyInOperationsTz(now, timeZone);
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const t0 = Date.UTC(ya, ma - 1, da);
  const t1 = Date.UTC(yb, mb - 1, db);
  const days = Math.floor((t1 - t0) / 86400000);
  if (days < 0) return null;
  return days;
}
