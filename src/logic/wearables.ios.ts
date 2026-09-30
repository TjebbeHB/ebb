import { Linking } from 'react-native';
import { addDays, fromISO, today } from './dates';
import { summariseHealth, type HealthData } from './healthData';
import type { WearableStatus } from './wearables';

async function sdk() { return import('@kingstinct/react-native-healthkit'); }
export async function wearableStatus(): Promise<WearableStatus> {
  try {
    const hk = await sdk();
    const available = await hk.isHealthDataAvailable();
    return { available, provider: 'Apple Health', message: available ? 'Import sleep and resting heart rate from Apple Watch or compatible wristbands that share with Apple Health.' : 'Apple Health is not available on this device.' };
  } catch {
    return { available: false, provider: 'Apple Health', message: 'Apple Health requires an installed Ebb build with health support. It is not available in Expo Go.' };
  }
}
export async function syncWearables(): Promise<HealthData> {
  const hk = await sdk();
  if (!hk.isHealthDataAvailable()) throw new Error('Apple Health is not available on this device.');
  await hk.requestAuthorization({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierRestingHeartRate'] });
  // HealthKit intentionally does not reveal whether read permission was denied.
  // A completed authorization request must never be labelled as a successful connection.
  const ref = today(), first = addDays(ref, -27);
  const begin = fromISO(addDays(first, -1)); begin.setHours(0, 0, 0, 0);
  const end = new Date();
  const options = { limit: 0, filter: { date: { startDate: begin, endDate: end } } };
  const sleep = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', options);
  const heart = await hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { ...options, unit: 'count/min' });
  return { provider: 'apple-health', syncedAt: end.toISOString(), days: summariseHealth(
    sleep.filter((s) => [1, 3, 4, 5].includes(s.value)).map((s) => ({ start: s.startDate.toISOString(), end: s.endDate.toISOString() })),
    heart.map((h) => ({ time: h.startDate.toISOString(), value: h.quantity })), first, ref,
  ) };
}
export async function openHealthSettings(): Promise<void> { await Linking.openURL('x-apple-health://'); }
