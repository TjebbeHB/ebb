import type { MealEntry } from './meals';
import type { FoodModelId } from './modelCatalog';
import type { HealthData } from './healthData';
import type { ISODate } from './dates';

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';
export type Mucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' | 'atypical';
export type CervixPosition = 'low' | 'mid' | 'high';
export type CervixFirmness = 'firm' | 'medium' | 'soft';
export type CervixOpening = 'closed' | 'medium' | 'open';
export type LhResult = 'negative' | 'positive';
export type PregnancyResult = 'negative' | 'faint' | 'positive';
export type Libido = 'low' | 'normal' | 'high';
export type SleepQuality = 'poor' | 'fair' | 'good' | 'great';
export type PillStatus = 'taken' | 'missed';

export interface DayLog {
  date: ISODate;
  flow?: Flow;
  symptoms?: string[];
  moods?: string[];
  energy?: 1 | 2 | 3 | 4 | 5;
  pain?: number;
  dailyImpact?: 'none' | 'some' | 'missed_activities';
  sleepHours?: number;
  sleepQuality?: SleepQuality;
  mucus?: Mucus;
  cervixPosition?: CervixPosition;
  cervixFirmness?: CervixFirmness;
  cervixOpening?: CervixOpening;
  /** Basal body temperature, always stored in °C. */
  bbt?: number;
  bbtDisturbed?: boolean;
  lhTest?: LhResult;
  pregnancyTest?: PregnancyResult;
  sex?: string[];
  libido?: Libido;
  pill?: PillStatus;
  medications?: string[];
  water?: number;
  exercise?: string[];
  /** Weight, always stored in kg. */
  weight?: number;
  tags?: string[];
  notes?: string;
}

export type Goal = 'track' | 'conceive' | 'avoid' | 'birthcontrol';
export type BirthControl =
  | 'none'
  | 'pill'
  | 'iud_hormonal'
  | 'iud_copper'
  | 'implant'
  | 'injection'
  | 'ring'
  | 'patch'
  | 'condoms'
  | 'other';

export interface ReminderTime {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface Reminders {
  periodBefore: ReminderTime & { daysBefore: number };
  periodStart: ReminderTime;
  fertileStart: ReminderTime;
  ovulation: ReminderTime;
  periodLate: ReminderTime;
  dailyLog: ReminderTime;
  pill: ReminderTime;
  bbt: ReminderTime;
}

export interface Settings {
  mealPhotoRetention?: 'data-only' | 'keep-photo';
  showMealCalories?: boolean;
  foodModelId?: FoodModelId;
  onboarded: boolean;
  goal: Goal;
  birthControl: BirthControl;
  defaultCycleLength: number;
  defaultPeriodLength: number;
  lutealLength: number;
  /** Adds two days on each side of the fertile window. */
  cautiousFertileWindow: boolean;
  tempUnit: 'c' | 'f';
  weightUnit: 'kg' | 'lb';
  firstDayOfWeek: 0 | 1;
  theme: 'system' | 'light' | 'dark';
  /** Category ids shown in the log screen. */
  enabledCategories: string[];
  customTags: string[];
  customSymptoms: string[];
  reminders: Reminders;
  lockEnabled: boolean;
  lockBiometrics: boolean;
  /** Cycle start dates the user excluded from statistics. */
  excludedCycles: ISODate[];
  /** Date after which the user opted in to notifications (informational). */
  createdAt: ISODate;
}

export interface AppData {
  meals?: MealEntry[];
  version: 1;
  health?: HealthData;
  settings: Settings;
  logs: Record<ISODate, DayLog>;
}

export const DEFAULT_REMINDERS: Reminders = {
  periodBefore: { enabled: false, daysBefore: 2, hour: 9, minute: 0 },
  periodStart: { enabled: false, hour: 9, minute: 0 },
  fertileStart: { enabled: false, hour: 9, minute: 0 },
  ovulation: { enabled: false, hour: 9, minute: 0 },
  periodLate: { enabled: false, hour: 9, minute: 0 },
  dailyLog: { enabled: false, hour: 20, minute: 30 },
  pill: { enabled: false, hour: 8, minute: 0 },
  bbt: { enabled: false, hour: 6, minute: 30 },
};

export const DEFAULT_CATEGORIES = [
  'flow', 'symptoms', 'moods', 'pain', 'energy', 'sleep', 'sex', 'discharge', 'notes',
];

export const ALL_CATEGORIES = [
  'flow', 'symptoms', 'moods', 'pain', 'energy', 'sleep', 'sex', 'discharge', 'cervix',
  'bbt', 'tests', 'pill', 'medications', 'water', 'exercise', 'weight', 'tags', 'notes',
];

export function defaultSettings(createdAt: ISODate): Settings {
  return {
    mealPhotoRetention: 'data-only',
    showMealCalories: false,
    foodModelId: 'e2b',
    onboarded: false,
    goal: 'track',
    birthControl: 'none',
    defaultCycleLength: 28,
    defaultPeriodLength: 5,
    lutealLength: 14,
    cautiousFertileWindow: false,
    tempUnit: 'c',
    weightUnit: 'kg',
    firstDayOfWeek: 1,
    theme: 'light',
    enabledCategories: [...DEFAULT_CATEGORIES],
    customTags: [],
    customSymptoms: [],
    reminders: { ...DEFAULT_REMINDERS },
    lockEnabled: false,
    lockBiometrics: false,
    excludedCycles: [],
    createdAt,
  };
}

export function emptyData(createdAt: ISODate): AppData {
  return { version: 1, settings: defaultSettings(createdAt), logs: {} };
}

/** True when the log carries no information and can be dropped. */
export function isEmptyLog(log: DayLog): boolean {
  const { date: _d, ...rest } = log;
  return Object.entries(rest).every(([key, v]) => {
    if (v === undefined || v === null) return true;
    if (Array.isArray(v)) return key === 'symptoms' || key === 'moods' ? false : v.length === 0;
    if (typeof v === 'string') return v.trim().length === 0;
    if (typeof v === 'boolean') return v === false;
    return false;
  });
}
