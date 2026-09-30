// Shared shapes for importing history from other apps (Flo, Apple Health)
// and merging it into the local diary without overwriting manual entries.

import { isValidISO, type ISODate } from './dates';
import { isEmptyLog, type AppData, type DayLog } from './types';

export type ImportSource = 'flo' | 'apple-health';

export interface ImportSummary {
  source: ImportSource;
  /** Days that received at least one imported value. */
  days: number;
  /** Days with bleeding (period or spotting). */
  bleedingDays: number;
  /** Individual records or events that were understood. */
  events: number;
  firstDate?: ISODate;
  lastDate?: ISODate;
  /** Categories or sub-categories that were kept as custom symptoms. */
  unmapped: string[];
  /** Things that were deliberately ignored, for transparency. */
  skipped: string[];
}

export interface ImportBundle {
  logs: Record<ISODate, DayLog>;
  /** Custom symptom names introduced by the import. */
  customSymptoms: string[];
  summary: ImportSummary;
}

const LIST_KEYS: (keyof DayLog)[] = ['symptoms', 'moods', 'sex', 'medications', 'exercise', 'tags'];

/** Builds a summary from a set of logs. */
export function summarise(source: ImportSource, logs: Record<ISODate, DayLog>, events: number, unmapped: string[], skipped: string[]): ImportSummary {
  const dates = Object.keys(logs).sort();
  return {
    source,
    days: dates.length,
    bleedingDays: dates.filter((d) => !!logs[d]?.flow).length,
    events,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    unmapped: [...new Set(unmapped)].sort(),
    skipped: [...new Set(skipped)].sort(),
  };
}

/** Adds a value to a day log inside an import bundle in progress. */
export function setDay(logs: Record<ISODate, DayLog>, date: ISODate, patch: Partial<DayLog>): void {
  if (!isValidISO(date)) return;
  const cur = logs[date] ?? { date };
  const next: DayLog = { ...cur, date };
  for (const [k, v] of Object.entries(patch)) {
    const key = k as keyof DayLog;
    if (v === undefined) continue;
    if (LIST_KEYS.includes(key) && Array.isArray(v)) {
      const existing = (cur[key] as string[] | undefined) ?? [];
      (next as unknown as Record<string, unknown>)[key] = [...new Set([...existing, ...(v as string[])])];
    } else if (key === 'notes' && typeof v === 'string') {
      next.notes = cur.notes ? `${cur.notes}\n${v}` : v;
    } else if (key === 'flow' && cur.flow && cur.flow !== 'spotting' && v === 'spotting') {
      // Never downgrade a real bleeding day to spotting.
    } else {
      (next as unknown as Record<string, unknown>)[key] = v;
    }
  }
  logs[date] = next;
}

/**
 * Merges imported logs into existing data. Manual entries win: list fields are
 * unioned, scalar fields are only filled when the day has no value yet.
 */
export function mergeImport(data: AppData, bundle: ImportBundle): AppData {
  const logs: Record<ISODate, DayLog> = { ...data.logs };
  for (const [date, imported] of Object.entries(bundle.logs)) {
    if (!isValidISO(date)) continue;
    const cur = logs[date];
    if (!cur) {
      if (!isEmptyLog(imported)) logs[date] = { ...imported, date };
      continue;
    }
    const next: DayLog = { ...cur };
    for (const [k, v] of Object.entries(imported)) {
      const key = k as keyof DayLog;
      if (key === 'date' || v === undefined) continue;
      if (LIST_KEYS.includes(key) && Array.isArray(v)) {
        const existing = (cur[key] as string[] | undefined) ?? [];
        (next as unknown as Record<string, unknown>)[key] = [...new Set([...existing, ...(v as string[])])];
      } else if (cur[key] === undefined || (key === 'flow' && cur.flow === 'spotting' && v !== 'spotting')) {
        (next as unknown as Record<string, unknown>)[key] = v;
      }
    }
    if (!isEmptyLog(next)) logs[date] = next;
  }
  const customSymptoms = [...new Set([...data.settings.customSymptoms, ...bundle.customSymptoms])];
  return { ...data, logs, settings: { ...data.settings, customSymptoms } };
}

/** Normalises free text into a stable custom symptom label. */
export function titleCase(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
