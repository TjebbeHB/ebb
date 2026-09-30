import { Platform } from 'react-native';
import { addDays, fromISO, today, type ISODate } from './dates';
import type { CycleModel } from './cycles';
import type { ReminderTime, Settings } from './types';

const CHANNEL = 'ebb-reminders';

type NotificationsModule = typeof import('expo-notifications');

async function mod(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function notificationsSupported(): Promise<boolean> {
  return (await mod()) !== null;
}

export async function ensurePermission(): Promise<boolean> {
  const N = await mod();
  if (!N) return false;
  try {
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await N.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

function anyEnabled(r: Settings['reminders']): boolean {
  return Object.values(r).some((x) => (x as ReminderTime).enabled);
}

function atTime(date: ISODate, t: ReminderTime): Date {
  const d = fromISO(date);
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

/** Discreet wording: notifications should not reveal details on a lock screen. */
const TEXT = {
  periodBefore: (n: number) => ({ title: 'Ebb', body: n === 1 ? 'Heads-up: tomorrow could be day one.' : `Heads-up: about ${n} days to go.` }),
  periodStart: { title: 'Ebb', body: 'Today could be day one. Log how it goes.' },
  fertileStart: { title: 'Ebb', body: 'Your window opens today.' },
  ovulation: { title: 'Ebb', body: 'Estimated peak day.' },
  periodLate: { title: 'Ebb', body: 'Running a little late? Open the app to update.' },
  dailyLog: { title: 'Ebb', body: 'How was today? Takes ten seconds.' },
  pill: { title: 'Ebb', body: 'Daily reminder.' },
  bbt: { title: 'Ebb', body: 'Time to take your temperature.' },
};

/** Cancels everything and schedules the reminders implied by the model. Safe to call often. */
export async function rescheduleAll(model: CycleModel, settings: Settings): Promise<void> {
  const N = await mod();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    const r = settings.reminders;
    if (!anyEnabled(r)) return;
    if (!(await ensurePermission())) return;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, {
        name: 'Reminders',
        importance: N.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150],
        lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      });
    }
    const now = new Date();
    const schedule = async (content: { title: string; body: string }, when: Date) => {
      if (when.getTime() <= now.getTime()) return;
      await N.scheduleNotificationAsync({
        content: { ...content, sound: false },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    };
    const daily = async (content: { title: string; body: string }, t: ReminderTime) => {
      await N.scheduleNotificationAsync({
        content: { ...content, sound: false },
        trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, channelId: CHANNEL },
      });
    };

    // Event-based reminders for the next few predicted cycles.
    const upcoming = model.predictions.slice(0, 4);
    for (const p of upcoming) {
      const start = p.current ? model.nextPeriodStart : p.start;
      if (r.periodBefore.enabled && start) {
        await schedule(TEXT.periodBefore(r.periodBefore.daysBefore), atTime(addDays(start, -r.periodBefore.daysBefore), r.periodBefore));
      }
      if (r.periodStart.enabled && start) await schedule(TEXT.periodStart, atTime(start, r.periodStart));
      if (r.periodLate.enabled && start) await schedule(TEXT.periodLate, atTime(addDays(start, 2), r.periodLate));
      if (model.fertilityEnabled) {
        if (r.fertileStart.enabled && p.fertileStart) await schedule(TEXT.fertileStart, atTime(p.fertileStart, r.fertileStart));
        if (r.ovulation.enabled && p.ovulation) await schedule(TEXT.ovulation, atTime(p.ovulation, r.ovulation));
      }
    }
    if (r.dailyLog.enabled) await daily(TEXT.dailyLog, r.dailyLog);
    if (r.pill.enabled) await daily(TEXT.pill, r.pill);
    if (r.bbt.enabled) await daily(TEXT.bbt, r.bbt);
  } catch (e) {
    console.warn('Could not schedule reminders', e);
  }
}

export async function configureHandler(): Promise<void> {
  const N = await mod();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function nowISO(): ISODate {
  return today();
}
