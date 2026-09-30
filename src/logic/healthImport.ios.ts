// Reads cycle history that other apps (Flo, Clue, Apple's own Cycle Tracking)
// wrote to Apple Health, and turns it into Ebb day logs. Read-only.

import { addDays, diffDays, toISO, type ISODate } from './dates';
import { setDay, summarise, type ImportBundle } from './importMerge';
import type { DayLog } from './types';

import type { CategoryTypeIdentifier, ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit';

type HK = typeof import('@kingstinct/react-native-healthkit');

const SEVERITY_SYMPTOMS: Partial<Record<CategoryTypeIdentifier, string>> = {
  HKCategoryTypeIdentifierAbdominalCramps: 'cramps',
  HKCategoryTypeIdentifierBloating: 'bloating',
  HKCategoryTypeIdentifierBreastPain: 'breast_tenderness',
  HKCategoryTypeIdentifierHeadache: 'headache',
  HKCategoryTypeIdentifierFatigue: 'fatigue',
  HKCategoryTypeIdentifierAcne: 'acne',
  HKCategoryTypeIdentifierLowerBackPain: 'backache',
  HKCategoryTypeIdentifierPelvicPain: 'pelvic_pain',
  HKCategoryTypeIdentifierNausea: 'nausea',
  HKCategoryTypeIdentifierDiarrhea: 'diarrhea',
  HKCategoryTypeIdentifierConstipation: 'constipation',
  HKCategoryTypeIdentifierDizziness: 'dizziness',
  HKCategoryTypeIdentifierHotFlashes: 'hot_flashes',
  HKCategoryTypeIdentifierNightSweats: 'night_sweats',
  HKCategoryTypeIdentifierVaginalDryness: 'vaginal_dryness',
  HKCategoryTypeIdentifierDrySkin: 'dry_skin',
  HKCategoryTypeIdentifierHairLoss: 'hair_changes',
  HKCategoryTypeIdentifierFever: 'fever',
  HKCategoryTypeIdentifierMemoryLapse: 'brain_fog',
  HKCategoryTypeIdentifierGeneralizedBodyAche: 'joint_pain',
};

const CYCLE_TYPES = [
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKCategoryTypeIdentifierCervicalMucusQuality',
  'HKCategoryTypeIdentifierOvulationTestResult',
  'HKCategoryTypeIdentifierPregnancyTestResult',
  'HKCategoryTypeIdentifierSexualActivity',
  'HKCategoryTypeIdentifierMoodChanges',
  'HKCategoryTypeIdentifierAppetiteChanges',
  'HKCategoryTypeIdentifierSleepChanges',
  ...(Object.keys(SEVERITY_SYMPTOMS) as CategoryTypeIdentifier[]),
] as CategoryTypeIdentifier[];

async function sdk(): Promise<HK> {
  return import('@kingstinct/react-native-healthkit');
}

export async function healthImportAvailable(): Promise<boolean> {
  try {
    const hk = await sdk();
    return await hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

function eachDay(start: Date, end: Date): ISODate[] {
  const a = toISO(start);
  const b = toISO(end);
  const n = Math.min(10, Math.max(0, diffDays(a, b)));
  return Array.from({ length: n + 1 }, (_, i) => addDays(a, i));
}

export async function importFromAppleHealth(): Promise<ImportBundle> {
  const hk = await sdk();
  if (!(await hk.isHealthDataAvailable())) throw new Error('Apple Health is not available on this device.');
  const toRead: ObjectTypeIdentifier[] = [...CYCLE_TYPES, 'HKQuantityTypeIdentifierBasalBodyTemperature'];
  await hk.requestAuthorization({ toRead });

  const startDate = new Date(2000, 0, 1);
  const endDate = new Date();
  const options = { limit: 0, ascending: true, filter: { date: { startDate, endDate } } };
  const logs: Record<ISODate, DayLog> = {};
  const skipped: string[] = [];
  let events = 0;

  const query = async (id: CategoryTypeIdentifier) => {
    try {
      return await hk.queryCategorySamples(id, options);
    } catch {
      return [] as { value: number; startDate: Date; endDate: Date; metadata?: unknown }[];
    }
  };

  for (const s of await query('HKCategoryTypeIdentifierMenstrualFlow')) {
    const v = s.value as number;
    const flow = v === 2 ? 'light' : v === 3 ? 'medium' : v === 4 ? 'heavy' : v === 1 ? 'medium' : undefined;
    if (!flow) continue; // "none" samples mean an explicit no-bleeding day
    for (const d of eachDay(s.startDate, s.endDate)) setDay(logs, d, { flow });
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierIntermenstrualBleeding')) {
    for (const d of eachDay(s.startDate, s.endDate)) setDay(logs, d, { flow: 'spotting' });
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierCervicalMucusQuality')) {
    const v = s.value as number;
    const mucus = (['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const)[v - 1];
    if (!mucus) continue;
    setDay(logs, toISO(s.startDate), { mucus });
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierOvulationTestResult')) {
    const v = s.value as number;
    if (v === 1) setDay(logs, toISO(s.startDate), { lhTest: 'negative' });
    else if (v === 2) setDay(logs, toISO(s.startDate), { lhTest: 'positive' });
    else { skipped.push('Indeterminate or estrogen-surge ovulation tests'); continue; }
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierPregnancyTestResult')) {
    const v = s.value as number;
    if (v === 1) setDay(logs, toISO(s.startDate), { pregnancyTest: 'negative' });
    else if (v === 2) setDay(logs, toISO(s.startDate), { pregnancyTest: 'positive' });
    else { skipped.push('Indeterminate pregnancy tests'); continue; }
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierSexualActivity')) {
    const used = (s.metadata as { HKSexualActivityProtectionUsed?: boolean } | undefined)?.HKSexualActivityProtectionUsed;
    if (used === true) setDay(logs, toISO(s.startDate), { sex: ['protected'] });
    else if (used === false) setDay(logs, toISO(s.startDate), { sex: ['unprotected'] });
    else { skipped.push('Sexual activity without a protection answer'); continue; }
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierMoodChanges')) {
    if ((s.value as number) !== 0) continue;
    setDay(logs, toISO(s.startDate), { moods: ['mood_swings'] });
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierAppetiteChanges')) {
    const v = s.value as number;
    if (v === 2) setDay(logs, toISO(s.startDate), { symptoms: ['appetite_down'] });
    else if (v === 3) setDay(logs, toISO(s.startDate), { symptoms: ['appetite_up'] });
    else continue;
    events += 1;
  }
  for (const s of await query('HKCategoryTypeIdentifierSleepChanges')) {
    if ((s.value as number) !== 0) continue;
    setDay(logs, toISO(s.startDate), { symptoms: ['insomnia'] });
    events += 1;
  }
  for (const [id, symptom] of Object.entries(SEVERITY_SYMPTOMS)) {
    for (const s of await query(id as CategoryTypeIdentifier)) {
      if ((s.value as number) === 1) continue; // explicitly "not present"
      setDay(logs, toISO(s.startDate), { symptoms: [symptom] });
      events += 1;
    }
  }
  try {
    const temps = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBasalBodyTemperature', { ...options, unit: 'degC' });
    for (const t of temps) {
      if (t.quantity < 34 || t.quantity > 42) continue;
      setDay(logs, toISO(t.startDate), { bbt: Math.round(t.quantity * 100) / 100 });
      events += 1;
    }
  } catch {
    /* temperature not readable */
  }

  if (events === 0) {
    throw new Error('Apple Health returned no cycle data. Check that Ebb is allowed to read cycle tracking data in Settings → Health → Data Access & Devices → Ebb, and that Flo is set to share with Apple Health.');
  }
  return { logs, customSymptoms: [], summary: summarise('apple-health', logs, events, [], skipped) };
}
