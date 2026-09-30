// Tracker definitions: what can be logged per day, modelled on the deepest
// category sets of Clue, Flo, Apple Health Cycle Tracking and drip.

export interface Option {
  id: string;
  label: string;
}

export interface Category {
  id: string;
  label: string;
  hint?: string;
  /** Shown only when the category is relevant to the goal/birth-control mode. */
  fertilityRelated?: boolean;
}

export const FLOW_OPTIONS: Option[] = [
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
];

export const SYMPTOM_OPTIONS: Option[] = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'migraine', label: 'Migraine' },
  { id: 'backache', label: 'Back pain' },
  { id: 'breast_tenderness', label: 'Tender breasts' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'acne', label: 'Acne' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'nausea', label: 'Nausea' },
  { id: 'insomnia', label: 'Insomnia' },
  { id: 'cravings', label: 'Cravings' },
  { id: 'appetite_up', label: 'Increased appetite' },
  { id: 'appetite_down', label: 'Low appetite' },
  { id: 'hot_flashes', label: 'Hot flashes' },
  { id: 'night_sweats', label: 'Night sweats' },
  { id: 'dizziness', label: 'Dizziness' },
  { id: 'joint_pain', label: 'Joint pain' },
  { id: 'ovulation_pain', label: 'Ovulation pain' },
  { id: 'pelvic_pain', label: 'Pelvic pain' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'diarrhea', label: 'Diarrhea' },
  { id: 'gas', label: 'Gas' },
  { id: 'brain_fog', label: 'Brain fog' },
  { id: 'oily_skin', label: 'Oily skin' },
  { id: 'dry_skin', label: 'Dry skin' },
  { id: 'hair_changes', label: 'Hair changes' },
  { id: 'vaginal_dryness', label: 'Vaginal dryness' },
  { id: 'itching', label: 'Itching or irritation' },
  { id: 'cold_flu', label: 'Cold or flu' },
  { id: 'fever', label: 'Fever' },
  { id: 'allergy', label: 'Allergy' },
];

export const MOOD_OPTIONS: Option[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'confident', label: 'Confident' },
  { id: 'motivated', label: 'Motivated' },
  { id: 'focused', label: 'Focused' },
  { id: 'sociable', label: 'Sociable' },
  { id: 'sensitive', label: 'Sensitive' },
  { id: 'sad', label: 'Sad' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'irritable', label: 'Irritable' },
  { id: 'mood_swings', label: 'Mood swings' },
  { id: 'stressed', label: 'Stressed' },
  { id: 'unmotivated', label: 'Unmotivated' },
  { id: 'distracted', label: 'Distracted' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'tearful', label: 'Tearful' },
];

export const ENERGY_OPTIONS: Option[] = [
  { id: '1', label: 'Exhausted' },
  { id: '2', label: 'Low' },
  { id: '3', label: 'Okay' },
  { id: '4', label: 'High' },
  { id: '5', label: 'Energised' },
];

export const SLEEP_QUALITY_OPTIONS: Option[] = [
  { id: 'poor', label: 'Poor' },
  { id: 'fair', label: 'Fair' },
  { id: 'good', label: 'Good' },
  { id: 'great', label: 'Great' },
];

export const MUCUS_OPTIONS: Option[] = [
  { id: 'dry', label: 'Dry' },
  { id: 'sticky', label: 'Sticky' },
  { id: 'creamy', label: 'Creamy' },
  { id: 'watery', label: 'Watery' },
  { id: 'eggwhite', label: 'Egg white' },
  { id: 'atypical', label: 'Unusual' },
];

export const CERVIX_POSITION_OPTIONS: Option[] = [
  { id: 'low', label: 'Low' },
  { id: 'mid', label: 'Medium' },
  { id: 'high', label: 'High' },
];
export const CERVIX_FIRMNESS_OPTIONS: Option[] = [
  { id: 'firm', label: 'Firm' },
  { id: 'medium', label: 'Medium' },
  { id: 'soft', label: 'Soft' },
];
export const CERVIX_OPENING_OPTIONS: Option[] = [
  { id: 'closed', label: 'Closed' },
  { id: 'medium', label: 'Slightly open' },
  { id: 'open', label: 'Open' },
];

export const LH_OPTIONS: Option[] = [
  { id: 'negative', label: 'Negative' },
  { id: 'positive', label: 'Positive' },
];
export const PREGNANCY_OPTIONS: Option[] = [
  { id: 'negative', label: 'Negative' },
  { id: 'faint', label: 'Faint line' },
  { id: 'positive', label: 'Positive' },
];

export const SEX_OPTIONS: Option[] = [
  { id: 'protected', label: 'Protected' },
  { id: 'unprotected', label: 'Unprotected' },
  { id: 'withdrawal', label: 'Withdrawal' },
  { id: 'solo', label: 'Solo' },
];
export const LIBIDO_OPTIONS: Option[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
];

export const PILL_OPTIONS: Option[] = [
  { id: 'taken', label: 'Taken' },
  { id: 'missed', label: 'Missed' },
];

export const MEDICATION_OPTIONS: Option[] = [
  { id: 'pain_relief', label: 'Pain relief' },
  { id: 'antihistamine', label: 'Antihistamine' },
  { id: 'antibiotics', label: 'Antibiotics' },
  { id: 'iron', label: 'Iron' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'magnesium', label: 'Magnesium' },
  { id: 'folic_acid', label: 'Folic acid' },
  { id: 'hormone_therapy', label: 'Hormone therapy' },
  { id: 'antidepressant', label: 'Antidepressant' },
  { id: 'emergency_contraception', label: 'Emergency contraception' },
  { id: 'other_medication', label: 'Other' },
];

export const EXERCISE_OPTIONS: Option[] = [
  { id: 'walking', label: 'Walking' },
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'strength', label: 'Strength' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'team_sport', label: 'Team sport' },
  { id: 'other_exercise', label: 'Other' },
];

export const CATEGORIES: Category[] = [
  { id: 'pain', label: 'Pain & daily impact', hint: 'Notice what affects your everyday life.' },
  { id: 'flow', label: 'Bleeding', hint: 'Spotting does not start a new period.' },
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'moods', label: 'Mood' },
  { id: 'energy', label: 'Energy' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'sex', label: 'Sex and libido' },
  { id: 'discharge', label: 'Discharge', hint: 'Cervical mucus, used to estimate ovulation.', fertilityRelated: true },
  { id: 'cervix', label: 'Cervix', hint: 'Position, firmness and opening.', fertilityRelated: true },
  { id: 'bbt', label: 'Basal temperature', hint: 'Measure before getting up, at the same time each day.', fertilityRelated: true },
  { id: 'tests', label: 'Tests', hint: 'Ovulation (LH) and pregnancy tests.', fertilityRelated: true },
  { id: 'pill', label: 'Pill', hint: 'Daily contraceptive pill.' },
  { id: 'medications', label: 'Medication and supplements' },
  { id: 'water', label: 'Water' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'weight', label: 'Weight' },
  { id: 'tags', label: 'Custom tags', hint: 'Track anything else, like a migraine trigger or a habit.' },
  { id: 'notes', label: 'Notes' },
];

export function labelFor(options: Option[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

const ALL_OPTION_LISTS = [
  FLOW_OPTIONS, SYMPTOM_OPTIONS, MOOD_OPTIONS, ENERGY_OPTIONS, SLEEP_QUALITY_OPTIONS,
  MUCUS_OPTIONS, CERVIX_POSITION_OPTIONS, CERVIX_FIRMNESS_OPTIONS, CERVIX_OPENING_OPTIONS,
  LH_OPTIONS, PREGNANCY_OPTIONS, SEX_OPTIONS, LIBIDO_OPTIONS, PILL_OPTIONS,
  MEDICATION_OPTIONS, EXERCISE_OPTIONS,
];

export function anyLabel(id: string): string {
  for (const list of ALL_OPTION_LISTS) {
    const found = list.find((o) => o.id === id);
    if (found) return found.label;
  }
  return id;
}
