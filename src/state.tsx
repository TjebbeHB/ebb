import { normaliseMealEntry, MEAL_LIMITS, type MealEntry } from './logic/meals';
import { clearMealPhotos, cleanMealPhotoDrafts, pruneMealPhotos } from './logic/mealPhotos';
import { clearModelDownloads } from './logic/modelDownloads';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState, useRef,
} from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import type { HealthData } from './logic/healthData';
import { mergeImport, type ImportBundle } from './logic/importMerge';
import { buildModel, type CycleModel } from './logic/cycles';
import { today, type ISODate } from './logic/dates';
import { configureHandler, rescheduleAll } from './logic/notifications';
import { clearData, loadData, saveData } from './logic/storage';
import { emptyData, isEmptyLog, type AppData, type DayLog, type Settings } from './logic/types';
import { usePalette, type Palette } from './theme';

export type ListKey = 'symptoms' | 'moods' | 'sex' | 'medications' | 'exercise' | 'tags';

export interface AppStore {
  ready: boolean;
  loadError: string | null;
  retryLoad: () => void;
  data: AppData;
  settings: Settings;
  logs: Record<ISODate, DayLog>;
  model: CycleModel;
  today: ISODate;
  palette: Palette;
  locked: boolean;
  setLocked: (v: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateLog: (date: ISODate, patch: Partial<DayLog>) => void;
  toggleListItem: (date: ISODate, key: ListKey, id: string) => void;
  setFlowForDays: (changes: { date: ISODate; flow: DayLog['flow'] | undefined }[]) => void;
  replaceData: (data: AppData) => void;
  resetAll: () => Promise<void>;
  saveMeal: (meal: MealEntry) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  setHealth: (health: HealthData | undefined) => void;
  /** Merges history imported from Flo or Apple Health; manual entries win. */
  importBundle: (bundle: ImportBundle) => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => emptyData(today()));
  const dataRef = useRef(data);
  const setData = useCallback((value: AppData | ((d: AppData) => AppData)) => {
    const next = typeof value === 'function' ? value(dataRef.current) : value;
    dataRef.current = next;
    setDataState(next);
  }, []);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);
  const [day, setDay] = useState<ISODate>(today());
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    (async () => {
      try {
      const loaded = await loadData();
      await cleanMealPhotoDrafts().catch(() => {});
      await pruneMealPhotos((loaded.meals ?? []).flatMap((m) => m.photoFile ? [m.photoFile] : [])).catch(() => {});
      if (!alive) return;
      setData(loaded);
      setLocked(loaded.settings.lockEnabled && Platform.OS !== 'web');
      setReady(true);
      void configureHandler();
      } catch (e) { if (alive) setLoadError(e instanceof Error ? e.message : 'Could not read your diary. Your saved data has been kept.'); }
    })();
    return () => {
      alive = false;
    };
  }, [loadAttempt]);

  // Refresh "today" when the app comes back to the foreground or the day changes.
  useEffect(() => {
    const tick = () => setDay((d) => (d === today() ? d : today()));
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    const id = setInterval(tick, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  const persisted = useRef<AppData | null>(null);

  // Persist immediately on every change; the payload is small and losing a
  // just-logged entry because the app was killed would be worse than the cost.
  useEffect(() => {
    if (!ready || persisted.current === data) return;
    // Never queue an old render after a meal save already committed a newer value.
    if (data !== dataRef.current) return;
    persisted.current = data;
    saveData(data).catch((e) => console.warn('save failed', e));
  }, [data, ready]);

  const model = useMemo(() => buildModel(data.logs, data.settings, day), [data.logs, data.settings, day]);

  // Keep local reminders in sync with predictions (native only, no-op on web).
  useEffect(() => {
    if (!ready || !data.settings.onboarded) return;
    const t = setTimeout(() => {
      void rescheduleAll(model, data.settings);
    }, 800);
    return () => clearTimeout(t);
  }, [model, data.settings, ready]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const updateLog = useCallback((date: ISODate, patch: Partial<DayLog>) => {
    setData((d) => {
      const next = { ...(d.logs[date] ?? { date }), ...patch, date };
      const logs = { ...d.logs };
      if (isEmptyLog(next)) delete logs[date];
      else logs[date] = next;
      return { ...d, logs };
    });
  }, []);

  const toggleListItem = useCallback((date: ISODate, key: ListKey, id: string) => {
    setData((d) => {
      const cur = d.logs[date] ?? { date };
      const list = cur[key] ?? [];
      const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      const next: DayLog = { ...cur, [key]: nextList };
      const logs = { ...d.logs };
      if (isEmptyLog(next)) delete logs[date];
      else logs[date] = next;
      return { ...d, logs };
    });
  }, []);

  const setFlowForDays = useCallback((changes: { date: ISODate; flow: DayLog['flow'] | undefined }[]) => {
    setData((d) => {
      const logs = { ...d.logs };
      for (const c of changes) {
        const next: DayLog = { ...(logs[c.date] ?? { date: c.date }), flow: c.flow };
        if (c.flow === undefined) delete next.flow;
        if (isEmptyLog(next)) delete logs[c.date];
        else logs[c.date] = next;
      }
      return { ...d, logs };
    });
  }, []);

  const setHealth = useCallback((health: HealthData | undefined) => {
    setData((d) => ({ ...d, health }));
  }, []);

  const importBundle = useCallback((bundle: ImportBundle) => {
    setData((d) => mergeImport(d, bundle));
  }, []);

  const replaceData = useCallback((next: AppData) => {
    setData({ ...next, settings: { ...next.settings, onboarded: true } });
  }, []);

  const saveMeal = useCallback(async (meal: MealEntry) => {
    const valid = normaliseMealEntry(meal, { keepPhotoReferences: true });
    if (!valid) throw new Error('Please check the meal details before saving.');
    const previous = dataRef.current.meals?.find((m) => m.id === meal.id);
    if (!previous && (dataRef.current.meals?.length ?? 0) >= MEAL_LIMITS.storedMeals) throw new Error('This diary has reached 10,000 meals. Export a backup and remove older meals before adding more.');
    const next = { ...dataRef.current, meals: [...(dataRef.current.meals ?? []).filter((m) => m.id !== meal.id), valid] };
    setData(next);
    persisted.current = next;
    try { await saveData(next); }
    catch (error) {
      const rollback = { ...dataRef.current, meals: [...(dataRef.current.meals ?? []).filter((m) => m.id !== meal.id), ...(previous ? [previous] : [])] };
      setData(rollback); persisted.current = rollback;
      await saveData(rollback).catch(() => {});
      throw error;
    }
  }, [setData]);
  const removeMeal = useCallback(async (id: string) => {
    const previous = dataRef.current.meals?.find((m) => m.id === id);
    const next = { ...dataRef.current, meals: (dataRef.current.meals ?? []).filter((m) => m.id !== id) };
    setData(next);
    persisted.current = next;
    try { await saveData(next); }
    catch (error) {
      const rollback = { ...dataRef.current, meals: [...(dataRef.current.meals ?? []).filter((m) => m.id !== id), ...(previous ? [previous] : [])] };
      setData(rollback); persisted.current = rollback;
      await saveData(rollback).catch(() => {});
      throw error;
    }
  }, [setData]);

  const resetAll = useCallback(async () => {
    await clearModelDownloads();
    await clearMealPhotos();
    await clearData();
    setData(emptyData(today()));
    setLocked(false);
  }, []);

  const palette = usePalette(data.settings.theme);

  const value = useMemo<AppStore>(() => ({
    ready, loadError, retryLoad,
    data,
    settings: data.settings,
    logs: data.logs,
    model,
    today: day,
    palette,
    locked,
    setLocked,
    updateSettings,
    updateLog,
    toggleListItem,
    setFlowForDays,
    replaceData,
    resetAll,
    saveMeal, removeMeal,
    setHealth,
    importBundle,
  }), [ready, loadError, retryLoad, data, model, day, palette, locked, updateSettings, updateLog, toggleListItem, setFlowForDays, replaceData, resetAll, saveMeal, removeMeal, setHealth, importBundle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside AppProvider');
  return v;
}
