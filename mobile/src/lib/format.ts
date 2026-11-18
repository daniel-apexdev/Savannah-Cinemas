import type { Num } from './types';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const toNumber = (n: Num | null | undefined): number => {
  const v = typeof n === 'string' ? parseFloat(n) : n ?? 0;
  return Number.isFinite(v) ? (v as number) : 0;
};

/** "GHS 60" or "GHS 62.50" */
export function money(amount: Num | null | undefined, currency = 'GHS') {
  const v = toNumber(amount);
  return `${currency} ${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 24h clock, e.g. 19:40 */
export function clock(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar key, e.g. 2026-11-16 */
export function dayKey(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayFromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const weekday = (d: Date) => DAYS[d.getDay()];
/** TUE 17 NOV */
export const shortDate = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function isToday(d: Date) {
  return dayKey(d) === dayKey(new Date());
}

/** "STARTS IN 34 MIN" / "STARTS IN 2 H 05" / "STARTED" */
export function startsIn(iso: string, now = Date.now()) {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'STARTING NOW';
  if (mins < 60) return `STARTS IN ${mins} MIN`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `STARTS IN ${h} H ${pad(m)}`;
}

export function runtime(min?: number | null) {
  return min ? `${min} MIN` : null;
}

export function year(date?: string | null) {
  if (!date) return null;
  const y = new Date(date).getFullYear();
  return Number.isFinite(y) ? String(y) : null;
}

/** The film's opening day as a local date (release dates are calendar days). */
export function releaseDay(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  return dayFromKey(date.slice(0, 10));
}

/** "OPENS FRI 20 NOV" while the release day is still ahead, otherwise null. */
export function opens(date?: string | null, now = new Date()) {
  const d = releaseDay(date);
  if (!d || dayKey(d) <= dayKey(now)) return null;
  return `OPENS ${shortDate(d)}`;
}

export function rating(r?: Num | null) {
  const v = toNumber(r ?? null);
  return v > 0 ? `★ ${v.toFixed(1)}` : null;
}

/** Join non-empty parts with a middle dot. */
export const dot = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

const KEEP_UPPER = new Set(['VIP', 'IMAX', '3D', '4DX', 'XL']);
export const titleCase = (s?: string | null) =>
  (s ?? '')
    .split(/(\s+|_|-)/)
    .map((w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w === '_' ? ' ' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
