// Date helpers working on ISO calendar dates (YYYY-MM-DD) in local time.
// All cycle math is done on calendar days, never on timestamps.

export type ISODate = string;

const MS_DAY = 86_400_000;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function isValidISO(iso: unknown): iso is ISODate {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISO(iso);
  return toISO(d) === iso;
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Number of calendar days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const da = fromISO(a);
  const db = fromISO(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / MS_DAY);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function monthStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const dim = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(day, dim));
  return toISO(d);
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function formatLong(iso: ISODate): string {
  const d = fromISO(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatMedium(iso: ISODate): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShort(iso: ISODate): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatRelative(iso: ISODate, ref: ISODate): string {
  const n = diffDays(ref, iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
  return formatLong(iso);
}

export function range(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 5000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}
