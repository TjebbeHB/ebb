import type { HealthData } from './healthData';

export interface WearableStatus { available: boolean; provider: string; message: string }
export async function wearableStatus(): Promise<WearableStatus> {
  return { available: false, provider: 'Health connections', message: 'Open Ebb on an Android phone or iPhone to import sleep and resting heart rate from your health app. The browser preview cannot access wearable data.' };
}
export async function syncWearables(): Promise<HealthData> { throw new Error('Health connections are available in the installed mobile app.'); }
export async function openHealthSettings(): Promise<void> {}
