import type { Phase } from './cycles';
import type { Goal } from './types';

export interface PhaseInfo {
  title: string;
  body: string;
}

/** Short, plain-language notes per phase. Educational only, not medical advice. */
export function phaseInfo(phase: Phase | undefined, goal: Goal, fertilityEnabled: boolean): PhaseInfo {
  if (!fertilityEnabled) return { title: 'Your bleeding pattern', body: 'Hormonal birth control can change bleeding and suppress ovulation. Cycle dates do not tell us your hormone levels. Use your symptoms and energy to guide your routine.' };
  switch (phase) {
    case 'period':
      return {
        title: 'Menstrual phase',
        body: 'You may notice cramps or fatigue during bleeding days, or feel much like yourself. Explore Food & movement for comfort ideas that fit how you feel.',
      };
    case 'follicular':
      return {
        title: 'Follicular phase',
        body: 'Oestrogen rises as an egg matures. How energy and mood change varies from person to person; the calendar does not measure your hormone levels.',
      };
    case 'fertile':
      return goal === 'conceive'
        ? { title: 'Fertile window', body: 'Sperm can survive up to five days, so these are the days when sex is most likely to lead to pregnancy. Peak days are the two days before ovulation and ovulation day itself.' }
        : { title: 'Fertile window', body: 'Ovulation is approaching. Discharge often becomes clearer and more slippery. This estimate is based on averages, so treat it as a guide, not a guarantee.' };
    case 'ovulation':
      return {
        title: 'Ovulation',
        body: fertilityEnabled
          ? 'The estimated day an egg is released. Some people feel a one-sided twinge, a slight temperature rise the day after, or a higher libido.'
          : 'Estimated mid-cycle.',
      };
    case 'luteal':
      return {
        title: 'Luteal phase',
        body: 'Progesterone rises and body temperature stays slightly higher. Energy may dip and appetite may increase toward the end of the phase.',
      };
    case 'pms':
      return {
        title: 'Premenstrual days',
        body: 'Hormones drop in the days before a period. Bloating, tender breasts, mood changes and cravings are common. Regular sleep and enjoyable movement may help some people with PMS symptoms.',
      };
    default:
      return { title: 'Get started', body: 'Log your last period to see your cycle day, phase and predictions.' };
  }
}

export const GOAL_LABELS: Record<Goal, string> = {
  track: 'Track my cycle',
  conceive: 'Trying to conceive',
  avoid: 'Avoid pregnancy',
  birthcontrol: 'On hormonal birth control',
};

export const GOAL_HINTS: Record<Goal, string> = {
  track: 'Periods, symptoms and patterns. Fertility shown lightly.',
  conceive: 'Fertile window, ovulation tests and temperature front and centre.',
  avoid: 'A wider, more cautious fertile window. Not a contraceptive.',
  birthcontrol: 'Predicts bleeds and tracks pill days. Ovulation is not estimated.',
};

export const BIRTH_CONTROL_LABELS: Record<string, string> = {
  none: 'None',
  pill: 'Pill',
  iud_hormonal: 'Hormonal IUD',
  iud_copper: 'Copper IUD',
  implant: 'Implant',
  injection: 'Injection',
  ring: 'Ring',
  patch: 'Patch',
  condoms: 'Condoms',
  other: 'Other',
};

export const DISCLAIMER = 'Ebb is not a medical device and does not diagnose, treat or prevent any condition. Predictions are estimates based on your logged dates and population averages. Do not rely on them as contraception. Talk to a healthcare professional about anything that worries you.';

export const PRIVACY = 'Everything you log stays on this device. Ebb has no account, no server, no analytics and no advertising. Optional AI model downloads contact Hugging Face and its file hosts; no diary data is sent. Source links open in your browser. Model files and saved meal photos stay in private storage excluded from phone backups. Photo recognition runs locally on Android. You review meal suggestions before saving and choose whether to keep the photo. Data-only entries remove Ebb’s photo copy; your original gallery photo is unchanged. JSON backups include meal details, but no photos or model files. Health imports are optional and read-only. You can remove imported data in Settings → Health. JSON backups include those imports and are files you choose to create and share.';
