import { normaliseMeals } from './meals';
import { normaliseHealth } from './healthData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isValidISO, today } from './dates';
import {
  ALL_CATEGORIES, DEFAULT_REMINDERS, defaultSettings, emptyData, isEmptyLog,
  type AppData, type DayLog, type Settings,
} from './types';

const DATA_KEY = 'ebb.data.v1';
const PIN_KEY = 'ebb.pin.v1';

/** Validates and normalises unknown JSON into AppData. Throws on garbage. */
export function normaliseData(raw: unknown, local = false): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Not an Ebb data file.');
  const obj = raw as Partial<AppData> & { logs?: unknown; settings?: unknown };
  const base = emptyData(today());
  const s = (obj.settings && typeof obj.settings === 'object' ? obj.settings : {}) as Partial<Settings>;
  const settings: Settings = {
    ...base.settings,
    ...s,
    mealPhotoRetention: s.mealPhotoRetention === 'keep-photo' ? 'keep-photo' : 'data-only',
    showMealCalories: s.showMealCalories === true,
    foodModelId: s.foodModelId === 'e4b' ? 'e4b' : 'e2b',
    reminders: { ...DEFAULT_REMINDERS, ...(s.reminders ?? {}) },
    enabledCategories: Array.isArray(s.enabledCategories)
      ? s.enabledCategories.filter((c): c is string => typeof c === 'string' && ALL_CATEGORIES.includes(c))
      : base.settings.enabledCategories,
    customTags: Array.isArray(s.customTags) ? s.customTags.filter((t): t is string => typeof t === 'string') : [],
    customSymptoms: Array.isArray(s.customSymptoms) ? s.customSymptoms.filter((t): t is string => typeof t === 'string') : [],
    excludedCycles: Array.isArray(s.excludedCycles) ? s.excludedCycles.filter(isValidISO) : [],
    defaultCycleLength: clampInt(s.defaultCycleLength, 15, 60, 28),
    defaultPeriodLength: clampInt(s.defaultPeriodLength, 1, 12, 5),
    lutealLength: clampInt(s.lutealLength, 8, 18, 14),
    createdAt: isValidISO(s.createdAt) ? s.createdAt : today(),
  };
  const logs: Record<string, DayLog> = {};
  if (obj.logs && typeof obj.logs === 'object') {
    for (const [date, value] of Object.entries(obj.logs as Record<string, unknown>)) {
      if (!isValidISO(date) || !value || typeof value !== 'object') continue;
      const log = { ...(value as DayLog), date };
      if (!isEmptyLog(log)) logs[date] = log;
    }
  }
  if (Object.keys(logs).length === 0 && !obj.settings) throw new Error('No data found in file.');
  return { version: 1, settings, logs, meals: normaliseMeals(obj.meals, { keepPhotoReferences: local }), health: normaliseHealth(obj.health) };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    if (!raw) return emptyData(today());
    return normaliseData(JSON.parse(raw), true);
  } catch (e) {
    throw new Error('Your saved diary could not be read. Ebb has kept it and your photos untouched. Check available storage and try again.');
  }
}

let writeQueue: Promise<void> = Promise.resolve();
export function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  const write = writeQueue.catch(() => {}).then(() => AsyncStorage.setItem(DATA_KEY, json));
  writeQueue = write;
  return write;
}

export async function clearData(): Promise<void> {
  await writeQueue.catch(() => {});
  await AsyncStorage.removeItem(DATA_KEY);
  await clearPin();
}

// --- PIN (kept out of the main data blob; on native it lives in the keychain)

async function secureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export async function pinAvailable(): Promise<boolean> {
  return (await secureStore()) !== null;
}

export async function getPin(): Promise<string | null> {
  const store = await secureStore();
  if (!store) return null;
  try {
    return await store.getItemAsync(PIN_KEY);
  } catch {
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  const store = await secureStore();
  if (!store) throw new Error('Secure storage is not available on this platform.');
  await store.setItemAsync(PIN_KEY, pin);
}

export async function clearPin(): Promise<void> {
  const store = await secureStore();
  if (!store) return;
  try {
    await store.deleteItemAsync(PIN_KEY);
  } catch {
    /* ignore */
  }
}

export { defaultSettings };
