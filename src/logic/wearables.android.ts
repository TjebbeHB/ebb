import { addDays, fromISO, today } from './dates';
import { summariseHealth, type HealthData, type SleepInterval, type HeartSample } from './healthData';
import type { WearableStatus } from './wearables';
import type { RecordType, RecordResult } from 'react-native-health-connect';

async function sdk() { return import('react-native-health-connect'); }
export async function wearableStatus(): Promise<WearableStatus> {
  try {
    const hc = await sdk();
    const status = await hc.getSdkStatus();
    const available = status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
    return { available, provider: 'Health Connect', message: available ? 'Import sleep and resting heart rate shared by compatible watch and wristband apps. Enable sharing in your device’s companion app first.' : 'Health Connect needs to be installed or updated on a compatible Android phone. Then reopen Ebb.' };
  } catch {
    return { available: false, provider: 'Health Connect', message: 'Health Connect requires an installed Ebb build with health support. It is not available in Expo Go.' };
  }
}
export async function syncWearables(): Promise<HealthData> {
  const hc = await sdk();
  if (!(await hc.initialize())) throw new Error('Health Connect is not ready. Install or update it and try again.');
  await hc.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }, { accessType: 'read', recordType: 'RestingHeartRate' }]);
  const grants = await hc.getGrantedPermissions();
  const canRead = (type: string) => grants.some((g) => g.accessType === 'read' && g.recordType === type);
  if (!canRead('SleepSession') && !canRead('RestingHeartRate')) throw new Error('No read permissions granted. Your existing import has not changed.');
  const ref = today(), first = addDays(ref, -27);
  const begin = fromISO(addDays(first, -1)); begin.setHours(0, 0, 0, 0);
  const end = new Date();
  const timeRangeFilter = { operator: 'between' as const, startTime: begin.toISOString(), endTime: end.toISOString() };
  async function read<T extends RecordType>(type: T): Promise<RecordResult<T>[]> {
    const all: RecordResult<T>[] = [];
    let pageToken: string | undefined;
    do {
      const page = await hc.readRecords(type, { timeRangeFilter, pageSize: 1000, pageToken });
      all.push(...page.records);
      pageToken = page.pageToken || undefined;
    } while (pageToken);
    return all;
  }
  const sleep: SleepInterval[] = [];
  const heart: HeartSample[] = [];
  if (canRead('SleepSession')) {
    for (const session of await read('SleepSession')) {
      // Only actual sleep stages; a session with unknown stages is not a sleep-duration measurement.
      for (const s of session.stages ?? []) if ([2, 4, 5, 6].includes(s.stage)) sleep.push({ start: s.startTime, end: s.endTime });
    }
  }
  if (canRead('RestingHeartRate')) for (const h of await read('RestingHeartRate')) heart.push({ time: h.time, value: h.beatsPerMinute });
  return { provider: 'health-connect', syncedAt: end.toISOString(), days: summariseHealth(sleep, heart, first, ref) };
}
export async function openHealthSettings(): Promise<void> { (await sdk()).openHealthConnectSettings(); }
