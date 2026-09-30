import { isValidISO, toISO, type ISODate } from './dates';
import { median } from './cycles';

export interface HealthDay {
  date: ISODate;
  sleepHours?: number;
  restingHeartRate?: number;
}
export interface HealthData {
  provider: 'apple-health' | 'health-connect';
  syncedAt: string;
  days: Record<ISODate, HealthDay>;
}
export interface SleepInterval { start: string; end: string }
export interface HeartSample { time: string; value: number }

/** Union overlapping sleep intervals before counting, including records from
 * multiple devices. A sleep episode belongs to its local wake-up date. */
export function summariseHealth(sleep: SleepInterval[], heart: HeartSample[], firstDay: ISODate, lastDay: ISODate): Record<ISODate, HealthDay> {
  const intervals = sleep.map((s) => ({ start: Date.parse(s.start), end: Date.parse(s.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.end - s.start <= 24 * 3600000)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const s of intervals) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  // Group separated sleep stages into an episode (awake gaps <= 3 hours).
  const episodes: { end: number; duration: number }[] = [];
  for (const s of merged) {
    const last = episodes[episodes.length - 1];
    if (last && s.start - last.end <= 3 * 3600000) { last.end = s.end; last.duration += s.end - s.start; }
    else episodes.push({ end: s.end, duration: s.end - s.start });
  }
  const days: Record<ISODate, HealthDay> = {};
  for (const s of episodes) {
    const date = toISO(new Date(s.end));
    if (date < firstDay || date > lastDay) continue;
    const day = days[date] ?? { date };
    day.sleepHours = (day.sleepHours ?? 0) + s.duration / 3600000;
    days[date] = day;
  }
  const byDay = new Map<string, number[]>();
  for (const h of heart) {
    if (!Number.isFinite(h.value) || h.value < 20 || h.value > 250 || !Number.isFinite(Date.parse(h.time))) continue;
    const date = toISO(new Date(h.time));
    if (date < firstDay || date > lastDay) continue;
    byDay.set(date, [...(byDay.get(date) ?? []), h.value]);
  }
  for (const [date, values] of byDay) days[date] = { ...(days[date] ?? { date }), restingHeartRate: median(values) };
  for (const day of Object.values(days)) if (day.sleepHours !== undefined) {
    day.sleepHours = day.sleepHours <= 24 ? Math.round(day.sleepHours * 100) / 100 : undefined;
  }
  return days;
}

/** Import is deliberately separate from manually entered logs. */
export function normaliseHealth(raw: unknown): HealthData | undefined {
  if (!raw || typeof raw !== 'object') return;
  const h = raw as Partial<HealthData>;
  if (!['apple-health', 'health-connect'].includes(h.provider ?? '') || !h.syncedAt || !Number.isFinite(Date.parse(h.syncedAt)) || !h.days || typeof h.days !== 'object') return;
  const days: Record<ISODate, HealthDay> = {};
  for (const [date, value] of Object.entries(h.days)) {
    if (!isValidISO(date) || !value || typeof value !== 'object') continue;
    const day: HealthDay = { date };
    if (typeof value.sleepHours === 'number' && Number.isFinite(value.sleepHours) && value.sleepHours >= 0 && value.sleepHours <= 24) day.sleepHours = value.sleepHours;
    if (typeof value.restingHeartRate === 'number' && Number.isFinite(value.restingHeartRate) && value.restingHeartRate >= 20 && value.restingHeartRate <= 250) day.restingHeartRate = value.restingHeartRate;
    if (day.sleepHours !== undefined || day.restingHeartRate !== undefined) days[date] = day;
  }
  return { provider: h.provider!, syncedAt: h.syncedAt, days };
}
