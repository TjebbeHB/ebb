import { Platform } from 'react-native';
import { anyLabel } from './trackers';
import { normaliseData } from './storage';
import type { AppData, DayLog } from './types';

export function toJSON(data: AppData): string {
  return JSON.stringify({ app: 'Ebb', exportedAt: new Date().toISOString(), ...data, meals: (data.meals ?? []).map(({ photoFile: _photo, ...meal }) => meal), mealPhotosIncluded: false }, null, 2);
}

const CSV_COLUMNS: (keyof DayLog)[] = [
  'date', 'flow', 'symptoms', 'moods', 'pain', 'dailyImpact', 'energy', 'sleepHours', 'sleepQuality', 'mucus',
  'cervixPosition', 'cervixFirmness', 'cervixOpening', 'bbt', 'bbtDisturbed', 'lhTest',
  'pregnancyTest', 'sex', 'libido', 'pill', 'medications', 'water', 'exercise', 'weight',
  'tags', 'notes',
];

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.map((x) => anyLabel(String(x))).join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(data: AppData): string {
  const rows = [CSV_COLUMNS.join(',')];
  for (const date of Object.keys(data.logs).sort()) {
    const log = data.logs[date];
    if (!log) continue;
    rows.push(CSV_COLUMNS.map((c) => csvCell(log[c])).join(','));
  }
  return rows.join('\n');
}

export function parseImport(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Only Ebb JSON backups can be imported.');
  }
  return normaliseData(parsed);
}

export interface ExportResult {
  ok: boolean;
  message: string;
}

/** Writes the text to a file and opens the share sheet (native) or triggers a download (web). */
export async function exportText(filename: string, text: string, mimeType: string): Promise<ExportResult> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([text], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, message: `Downloaded ${filename}.` };
    } catch (e) {
      return { ok: false, message: `Could not download: ${(e as Error).message}` };
    }
  }
  try {
    const fs = await import('expo-file-system');
    const sharing = await import('expo-sharing');
    const file = new fs.File(fs.Paths.cache, filename);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (!(await sharing.isAvailableAsync())) {
      return { ok: false, message: 'Sharing is not available on this device.' };
    }
    await sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Save your Ebb data', UTI: mimeType === 'application/json' ? 'public.json' : mimeType === 'text/plain' ? 'public.plain-text' : 'public.comma-separated-values-text' });
    return { ok: true, message: 'Export ready.' };
  } catch (e) {
    return { ok: false, message: `Export failed: ${(e as Error).message}` };
  }
}

/** Lets the user pick a JSON backup and returns its text, or null if cancelled. */
export async function pickImportText(): Promise<string | null> {
  const picker = await import('expo-document-picker');
  const res = await picker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    const f = asset.file;
    if (f) return await f.text();
    const r = await fetch(asset.uri);
    return await r.text();
  }
  const fs = await import('expo-file-system');
  return await new fs.File(asset.uri).text();
}
