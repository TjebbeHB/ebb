import type { Phase } from './cycles';
import type { DayLog } from './types';

export type CareStage = 'everyday' | 'period' | 'follicular' | 'ovulation' | 'luteal';
export interface CareGuide {
  label: string; title: string; context: string; food: string; meals: string[];
  movement: string; recovery: string;
}

// Editorial guidance, not model-generated prescriptions. Stages are browsing
// categories; the same foods and activities can be useful throughout the month.
export const CARE_GUIDES: Record<CareStage, CareGuide> = {
  everyday: {
    label: 'All month', title: 'Nourish your everyday',
    context: 'Regular meals, enough food and enjoyable movement are useful throughout your cycle. There is no required menu or workout for a particular phase.',
    food: 'Build a satisfying meal with a carbohydrate, a protein food, vegetables or fruit, and a source of fat. Eat more if you are still hungry.',
    meals: ['Oats with yoghurt or fortified soya yoghurt, berries and nuts.', 'A rice bowl with tofu or chicken, vegetables and olive oil.', 'Wholegrain toast with hummus and tomatoes.'],
    movement: 'Choose movement you enjoy and a level that fits how you feel today. A familiar strength session, a walk or a rest day can all fit.',
    recovery: 'Keep meals and sleep regular where possible. Adapt the examples to your appetite, allergies, access and dietary needs.',
  },
  period: {
    label: 'Period', title: 'Comfort & nourishment',
    context: 'Bleeding days can feel different from month to month. You may want comfort and easier meals, or feel ready for your usual routine.',
    food: 'Include iron-containing foods across the month. Beans or lentils with peppers, tomatoes or citrus pair plant iron with vitamin C, which helps absorption.',
    meals: ['Lentil and tomato soup with bread.', 'Bean chilli with peppers and rice.', 'Tofu or lean beef stir-fry with broccoli and noodles.'],
    movement: 'If you feel well, you can keep your usual routine. If cramps are uncomfortable, try gentle walking, cycling or stretching, or choose rest.',
    recovery: 'A warm bath or a wrapped heat pad may ease cramps. Food is not a treatment for heavy bleeding or iron deficiency; discuss ongoing concerns with a clinician.',
  },
  follicular: {
    label: 'Follicular', title: 'Build a rhythm that fits',
    context: 'This part of the cycle leads up to ovulation; bleeding is also part of the follicular phase. Energy changes vary between people.',
    food: 'Keep balanced meals consistent. If you are more active or hungry, make room for an extra meal or snack rather than following a cycle-based restriction.',
    meals: ['A chickpea or chicken wrap with salad.', 'Porridge with fruit and peanut butter.', 'Pasta with beans, vegetables and a tomato sauce.'],
    movement: 'Feeling good? Follow your usual plan and progress at your own pace. A predicted phase alone is not a reason to increase intensity.',
    recovery: 'Notice how a session feels and log your energy. Your own repeat patterns are more useful than a universal cycle schedule.',
  },
  ovulation: {
    label: 'Around ovulation', title: 'Stay with your own pace',
    context: 'The fertile window and ovulation day are estimates. They do not measure your hormones, fitness or readiness to train.',
    food: 'No special ovulation food is required. Keep regular meals, include a protein food, and have water available when active.',
    meals: ['A couscous bowl with chickpeas, cucumber and olive oil.', 'An egg or tofu sandwich with fruit.', 'Rice with fish or beans and vegetables.'],
    movement: 'Choose your usual workout if you feel ready. There is no need to schedule a personal best because the calendar predicts ovulation.',
    recovery: 'Check in with comfort, energy and recovery rather than trying to match an ideal phase.',
  },
  luteal: {
    label: 'Luteal / PMS', title: 'Make room for what you need',
    context: 'Between ovulation and the next period, some people notice appetite or premenstrual symptoms changing. Others feel much the same.',
    food: 'If you feel hungrier, a satisfying snack is an option. Wholegrains, beans and calcium-containing foods can be part of your regular meals, including on PMS days.',
    meals: ['Wholegrain toast with peanut butter and a banana.', 'Yoghurt or calcium-fortified soya yoghurt with oats and fruit.', 'A baked potato with beans and vegetables.'],
    movement: 'Keep enjoyable movement in your routine if it feels comfortable. On tiring days, shorten a session or choose an easy walk or rest.',
    recovery: 'Make space for sleep and relaxation. If symptoms regularly disrupt daily life, bring your symptom log to a healthcare professional.',
  },
};

export const CARE_SOURCES = [
  { title: 'ACOG · Premenstrual syndrome', url: 'https://www.acog.org/womens-health/faqs/premenstrual-syndrome' },
  { title: 'NIH · Iron in foods', url: 'https://ods.od.nih.gov/factsheets/Iron-Consumer/' },
  { title: 'NHS · Period pain', url: 'https://www.nhs.uk/symptoms/period-pain/' },
  { title: 'Research · Cycle phase and exercise performance', url: 'https://pubmed.ncbi.nlm.nih.gov/32661839/' },
];

export function careStage(phase?: Phase): CareStage {
  if (phase === 'fertile' || phase === 'ovulation') return 'ovulation';
  if (phase === 'pms' || phase === 'luteal') return 'luteal';
  return phase ?? 'everyday';
}

export interface DailyCareInput {
  date: string; phase?: Phase; fertilityEnabled: boolean;
  hasCycle: boolean; phaseUncertain?: boolean; log?: DayLog;
}
export function dailyCare(input: DailyCareInput) {
  // A stale import or another day's log must never become today's readiness.
  const log = input.log?.date === input.date ? input.log : undefined;
  const pregnancy = log?.pregnancyTest === 'positive';
  const usePhase = input.hasCycle && input.fertilityEnabled && !input.phaseUncertain && !pregnancy;
  const stage = usePhase ? careStage(input.phase) : 'everyday';
  const guide = CARE_GUIDES[stage];
  let reason = usePhase ? 'Based on your estimated phase. How you feel comes first.'
    : !input.fertilityEnabled ? 'Everyday guidance · hormonal settings do not tell us your natural phase.'
    : 'Everyday guidance · your current phase is uncertain.';
  let movement = guide.movement;
  let caution: string | undefined;
  if (pregnancy) {
    reason = 'You logged a positive pregnancy test today. Cycle-based suggestions are paused for today.';
    movement = 'Ask your maternity care team about activity that fits your health and pregnancy. This guide does not provide pregnancy-specific advice.';
  } else if ((log?.pain ?? 0) >= 7 || log?.dailyImpact === 'missed_activities') {
    reason = 'Adapted to the pain or disruption you logged today.';
    movement = 'Give yourself permission to rest and avoid pushing through pain. Choose only movement that feels comfortable.';
    caution = 'Pain that stops daily activities deserves medical advice. Seek urgent help if pelvic or period pain is severe or worse than usual and painkillers have not helped.';
  } else if ((log?.energy !== undefined && log.energy <= 2) || log?.symptoms?.includes('fatigue') || (log?.pain ?? 0) >= 4 || log?.sleepQuality === 'poor') {
    reason = 'Adapted to today’s energy, symptoms or sleep entry.';
    movement = 'An easier option today: a short comfortable walk, gentle mobility, or rest. Reassess how you feel before a harder session.';
  } else if (log?.energy !== undefined && log.energy >= 4) {
    reason = 'You logged good energy today. Let comfort guide the effort.';
    movement = 'If you feel comfortable and recovered, your usual workout is an option, including during your period. Adjust or stop if symptoms change.';
  }
  return { stage, guide, reason, movement, caution };
}
