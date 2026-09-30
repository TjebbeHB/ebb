// Importer for Flo's data export.
//
// Flo sends the export on request (Flo → profile → Help → "Contact us",
// ask for a data export) as a password-protected zip with either a JSON file
// or a plain-text file. The JSON has the shape
//   { operationalData: { cycles: [{ period_start_date, period_end_date,
//     pregnant, ... }], point_events_manual_v2: [{ date, category,
//     subcategory, additional_fields? }] } }
// and the text file lists "cycle N / Period start date: … / Period end date: …"
// blocks followed by a "manual events" section with one event per line.
// Flo's tracker vocabulary is matched by keyword so that renamed or new
// symptoms still land somewhere sensible; anything unknown becomes a custom
// symptom so no logged day is lost.

import { addDays, diffDays, isValidISO, toISO, type ISODate } from './dates';
import { setDay, summarise, titleCase, type ImportBundle } from './importMerge';
import type { DayLog, Flow, Mucus } from './types';

interface RawEvent {
  date: ISODate;
  category: string;
  subcategory: string;
  fields?: Record<string, unknown>;
  text?: string;
}

interface RawCycle {
  start: ISODate;
  end: ISODate;
  pregnant: boolean;
}

/** Accepts "2024-03-05", "2024-03-05 00:00:00", ISO timestamps or epoch seconds/millis. */
export function floDate(raw: unknown): ISODate | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    return toISO(new Date(ms));
  }
  if (typeof raw !== 'string') return undefined;
  const head = raw.trim().slice(0, 10);
  if (isValidISO(head)) return head;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? toISO(new Date(t)) : undefined;
}

type Action =
  | { kind: 'symptom'; id: string }
  | { kind: 'mood'; id: string }
  | { kind: 'flow'; flow: Flow }
  | { kind: 'mucus'; mucus: Mucus }
  | { kind: 'sex'; id: string }
  | { kind: 'libido'; libido: DayLog['libido'] }
  | { kind: 'energy'; energy: DayLog['energy'] }
  | { kind: 'lh'; result: DayLog['lhTest'] }
  | { kind: 'pregnancy'; result: DayLog['pregnancyTest'] }
  | { kind: 'pill'; pill: DayLog['pill'] }
  | { kind: 'exercise'; id: string }
  | { kind: 'medication'; id: string }
  | { kind: 'water' }
  | { kind: 'weight' }
  | { kind: 'bbt' }
  | { kind: 'sleep' }
  | { kind: 'notes' }
  | { kind: 'skip'; reason: string };

/** Ordered keyword rules; the first match wins. Tested against "category / subcategory". */
const RULES: [RegExp, Action][] = [
  // Bleeding
  [/spotting/, { kind: 'flow', flow: 'spotting' }],
  [/(flow|bleed|menstru|period).*(heavy)|heavy.*(flow|bleed)/, { kind: 'flow', flow: 'heavy' }],
  [/(flow|bleed|menstru|period).*(medium|moderate)|(medium|moderate).*(flow|bleed)/, { kind: 'flow', flow: 'medium' }],
  [/(flow|bleed|menstru|period).*(light)|light.*(flow|bleed)/, { kind: 'flow', flow: 'light' }],
  [/blood clots|clots/, { kind: 'flow', flow: 'heavy' }],
  // Discharge / fluid
  [/(fluid|discharge|mucus).*(egg ?white|eggwhite)|egg ?white/, { kind: 'mucus', mucus: 'eggwhite' }],
  [/(fluid|discharge|mucus).*(watery)|watery/, { kind: 'mucus', mucus: 'watery' }],
  [/(fluid|discharge|mucus).*(creamy)|creamy/, { kind: 'mucus', mucus: 'creamy' }],
  [/(fluid|discharge|mucus).*(sticky)|sticky/, { kind: 'mucus', mucus: 'sticky' }],
  [/(fluid|discharge|mucus).*(dry)|^dry$/, { kind: 'mucus', mucus: 'dry' }],
  [/(fluid|discharge|mucus).*(unusual|atypical|abnormal|grey|gray|clumpy|smell)/, { kind: 'mucus', mucus: 'atypical' }],
  // Tests
  [/(ovulation|lh).*(test).*(positive)|(ovulation|lh).*positive/, { kind: 'lh', result: 'positive' }],
  [/(ovulation|lh).*(test).*(negative)|(ovulation|lh).*negative/, { kind: 'lh', result: 'negative' }],
  [/pregnan.*(test).*(faint)|faint line/, { kind: 'pregnancy', result: 'faint' }],
  [/pregnan.*(test).*(positive)/, { kind: 'pregnancy', result: 'positive' }],
  [/pregnan.*(test).*(negative)/, { kind: 'pregnancy', result: 'negative' }],
  // Sex and drive
  [/masturbat|solo/, { kind: 'sex', id: 'solo' }],
  [/unprotected/, { kind: 'sex', id: 'unprotected' }],
  [/protected|condom/, { kind: 'sex', id: 'protected' }],
  [/withdrawal|pull ?out/, { kind: 'sex', id: 'withdrawal' }],
  [/(high|strong).*(sex drive|libido|desire)|frisky|horny/, { kind: 'libido', libido: 'high' }],
  [/(low|no).*(sex drive|libido|desire)/, { kind: 'libido', libido: 'low' }],
  [/(neutral|normal|medium).*(sex drive|libido|desire)/, { kind: 'libido', libido: 'normal' }],
  // Pill / contraception
  [/(pill|contracept).*(missed|forgot|skipped)/, { kind: 'pill', pill: 'missed' }],
  [/(pill|contracept).*(taken|took)|^pills? ?\/ ?taken/, { kind: 'pill', pill: 'taken' }],
  // Numeric trackers
  [/basal|bbt|temperature/, { kind: 'bbt' }],
  [/water|hydration/, { kind: 'water' }],
  [/weight/, { kind: 'weight' }],
  [/sleep/, { kind: 'sleep' }],
  [/^notes?|\/ ?notes?/, { kind: 'notes' }],
  // Exercise
  [/no exercise|rest day/, { kind: 'skip', reason: 'No exercise' }],
  [/walk/, { kind: 'exercise', id: 'walking' }],
  [/run|jog/, { kind: 'exercise', id: 'running' }],
  [/cycl|bike|biking/, { kind: 'exercise', id: 'cycling' }],
  [/yoga|pilates|stretch/, { kind: 'exercise', id: 'yoga' }],
  [/gym|strength|weights|lifting/, { kind: 'exercise', id: 'strength' }],
  [/swim/, { kind: 'exercise', id: 'swimming' }],
  [/hiit|interval|cardio/, { kind: 'exercise', id: 'hiit' }],
  [/team|football|soccer|basketball|volleyball|hockey|tennis|padel/, { kind: 'exercise', id: 'team_sport' }],
  [/(physical activity|exercise|sport|workout|dancing|aerobics)/, { kind: 'exercise', id: 'other_exercise' }],
  // Medication
  [/pain ?(killer|relief|medication)|ibuprofen|paracetamol|acetaminophen|naproxen/, { kind: 'medication', id: 'pain_relief' }],
  [/antihistamine|allergy medication/, { kind: 'medication', id: 'antihistamine' }],
  [/antibiotic/, { kind: 'medication', id: 'antibiotics' }],
  [/iron/, { kind: 'medication', id: 'iron' }],
  [/vitamin|supplement/, { kind: 'medication', id: 'vitamins' }],
  [/magnesium/, { kind: 'medication', id: 'magnesium' }],
  [/folic/, { kind: 'medication', id: 'folic_acid' }],
  [/emergency contracept|morning after/, { kind: 'medication', id: 'emergency_contraception' }],
  [/antidepress/, { kind: 'medication', id: 'antidepressant' }],
  [/hormone (therapy|replacement)|hrt/, { kind: 'medication', id: 'hormone_therapy' }],
  [/medication|medicine|drug/, { kind: 'medication', id: 'other_medication' }],
  // Energy
  [/(energy|feeling).*(exhausted)|exhausted/, { kind: 'energy', energy: 1 }],
  [/low energy|(energy).*(low)/, { kind: 'energy', energy: 2 }],
  [/high energy|(energy).*(high)|energetic/, { kind: 'mood', id: 'energetic' }],
  // Symptoms
  [/cramp/, { kind: 'symptom', id: 'cramps' }],
  [/migraine/, { kind: 'symptom', id: 'migraine' }],
  [/headache/, { kind: 'symptom', id: 'headache' }],
  [/back ?(ache|pain)|lower back/, { kind: 'symptom', id: 'backache' }],
  [/tender breast|breast (tenderness|pain|sore)|sore breast/, { kind: 'symptom', id: 'breast_tenderness' }],
  [/bloat/, { kind: 'symptom', id: 'bloating' }],
  [/acne|pimple|breakout/, { kind: 'symptom', id: 'acne' }],
  [/fatigue|tired/, { kind: 'symptom', id: 'fatigue' }],
  [/nausea/, { kind: 'symptom', id: 'nausea' }],
  [/insomnia|trouble sleeping|couldn.t sleep/, { kind: 'symptom', id: 'insomnia' }],
  [/craving/, { kind: 'symptom', id: 'cravings' }],
  [/(increased|high).*appetite|appetite.*(increase|high)/, { kind: 'symptom', id: 'appetite_up' }],
  [/(low|decreased|no).*appetite|appetite.*(low|decrease)/, { kind: 'symptom', id: 'appetite_down' }],
  [/hot flash|hot flush/, { kind: 'symptom', id: 'hot_flashes' }],
  [/night sweat/, { kind: 'symptom', id: 'night_sweats' }],
  [/dizz|vertigo|light ?headed/, { kind: 'symptom', id: 'dizziness' }],
  [/joint/, { kind: 'symptom', id: 'joint_pain' }],
  [/ovulation pain|mittelschmerz/, { kind: 'symptom', id: 'ovulation_pain' }],
  [/pelvic|abdominal pain|stomach ?ache/, { kind: 'symptom', id: 'pelvic_pain' }],
  [/constipat/, { kind: 'symptom', id: 'constipation' }],
  [/diarrh/, { kind: 'symptom', id: 'diarrhea' }],
  [/gas|flatul/, { kind: 'symptom', id: 'gas' }],
  [/brain fog|forgetful|confus/, { kind: 'symptom', id: 'brain_fog' }],
  [/oily skin/, { kind: 'symptom', id: 'oily_skin' }],
  [/dry skin/, { kind: 'symptom', id: 'dry_skin' }],
  [/hair/, { kind: 'symptom', id: 'hair_changes' }],
  [/vaginal dryness|dryness/, { kind: 'symptom', id: 'vaginal_dryness' }],
  [/itch|irritation|burning/, { kind: 'symptom', id: 'itching' }],
  [/cold|flu|sore throat|cough/, { kind: 'symptom', id: 'cold_flu' }],
  [/fever/, { kind: 'symptom', id: 'fever' }],
  [/allerg/, { kind: 'symptom', id: 'allergy' }],
  // Moods
  [/happy|great|good mood/, { kind: 'mood', id: 'happy' }],
  [/calm|relaxed|peaceful/, { kind: 'mood', id: 'calm' }],
  [/confident/, { kind: 'mood', id: 'confident' }],
  [/motivat(ed|ion)$|^motivated/, { kind: 'mood', id: 'motivated' }],
  [/unmotivated|apathetic|apathy|indifferent/, { kind: 'mood', id: 'unmotivated' }],
  [/focus|productive/, { kind: 'mood', id: 'focused' }],
  [/social|sociable|playful/, { kind: 'mood', id: 'sociable' }],
  [/sensitive|self.critical|guilty|guilt/, { kind: 'mood', id: 'sensitive' }],
  [/sad|depress|low mood|down/, { kind: 'mood', id: 'sad' }],
  [/anxi|worried|panic|obsessive/, { kind: 'mood', id: 'anxious' }],
  [/irritat|irritable|angry|frustrat|annoyed/, { kind: 'mood', id: 'irritable' }],
  [/mood swing|swings/, { kind: 'mood', id: 'mood_swings' }],
  [/stress/, { kind: 'mood', id: 'stressed' }],
  [/distract|scattered/, { kind: 'mood', id: 'distracted' }],
  [/withdrawn|lonely|numb/, { kind: 'mood', id: 'withdrawn' }],
  [/tearful|crying|weepy|emotional/, { kind: 'mood', id: 'tearful' }],
  [/neutral|fine|okay|meh/, { kind: 'skip', reason: 'Neutral mood' }],
  // Things Flo logs that have no home in a diary day
  [/predict|estimate|reminder|virtual|assistant|chat|article|quiz|survey|subscription|ml_/, { kind: 'skip', reason: 'Flo internal or predicted data' }],
];

function firstNumber(fields: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!fields) return undefined;
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return parseFloat(v.replace(',', '.'));
  }
  for (const v of Object.values(fields)) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

function applyEvent(logs: Record<ISODate, DayLog>, e: RawEvent, unmapped: string[], skipped: string[]): boolean {
  const key = `${e.category} / ${e.subcategory}`.toLowerCase().replace(/[_-]+/g, ' ').trim();
  const rule = RULES.find(([re]) => re.test(key));
  if (!rule) {
    // Unknown vocabulary: keep it as a custom symptom, so nothing is lost.
    const label = titleCase(e.subcategory || e.category);
    if (!label) return false;
    unmapped.push(label);
    setDay(logs, e.date, { symptoms: [label] });
    return true;
  }
  const a = rule[1];
  switch (a.kind) {
    case 'symptom': setDay(logs, e.date, { symptoms: [a.id] }); return true;
    case 'mood': setDay(logs, e.date, { moods: [a.id] }); return true;
    case 'flow': setDay(logs, e.date, { flow: a.flow }); return true;
    case 'mucus': setDay(logs, e.date, { mucus: a.mucus }); return true;
    case 'sex': setDay(logs, e.date, { sex: [a.id] }); return true;
    case 'libido': setDay(logs, e.date, { libido: a.libido }); return true;
    case 'energy': setDay(logs, e.date, { energy: a.energy }); return true;
    case 'lh': setDay(logs, e.date, { lhTest: a.result }); return true;
    case 'pregnancy': setDay(logs, e.date, { pregnancyTest: a.result }); return true;
    case 'pill': setDay(logs, e.date, { pill: a.pill }); return true;
    case 'exercise': setDay(logs, e.date, { exercise: [a.id] }); return true;
    case 'medication': setDay(logs, e.date, { medications: [a.id] }); return true;
    case 'water': {
      const n = firstNumber(e.fields, 'value', 'amount', 'glasses', 'cups', 'volume', 'ml');
      if (n === undefined) return false;
      // Flo stores water in millilitres or glasses; anything above 30 is ml.
      const glasses = n > 30 ? Math.round(n / 250) : Math.round(n);
      if (glasses > 0) setDay(logs, e.date, { water: Math.min(20, glasses) });
      return glasses > 0;
    }
    case 'weight': {
      const n = firstNumber(e.fields, 'value', 'weight', 'kg');
      if (n === undefined || n < 20 || n > 400) return false;
      setDay(logs, e.date, { weight: Math.round(n * 10) / 10 });
      return true;
    }
    case 'bbt': {
      const n = firstNumber(e.fields, 'value', 'temperature', 'temp');
      if (n === undefined) return false;
      const c = n > 45 ? (n - 32) * 5 / 9 : n;
      if (c < 34 || c > 42) return false;
      setDay(logs, e.date, { bbt: Math.round(c * 100) / 100 });
      return true;
    }
    case 'sleep': {
      const n = firstNumber(e.fields, 'value', 'hours', 'duration', 'minutes');
      if (n === undefined) return false;
      const hours = n > 24 ? n / 60 : n;
      if (hours <= 0 || hours > 16) return false;
      setDay(logs, e.date, { sleepHours: Math.round(hours * 2) / 2 });
      return true;
    }
    case 'notes': {
      const text = e.text ?? (typeof e.fields?.text === 'string' ? e.fields.text : typeof e.fields?.note === 'string' ? e.fields.note : undefined);
      if (!text?.trim()) return false;
      setDay(logs, e.date, { notes: text.trim() });
      return true;
    }
    case 'skip': skipped.push(a.reason); return false;
    default: return false;
  }
}

function eventFromJson(raw: unknown): RawEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const date = floDate(o.date ?? o.day ?? o.timestamp ?? o.created_at);
  if (!date) return undefined;
  const category = String(o.category ?? o.type ?? o.group ?? '');
  const subcategory = String(o.subcategory ?? o.name ?? o.value ?? o.event ?? '');
  if (!category && !subcategory) return undefined;
  const fields = o.additional_fields && typeof o.additional_fields === 'object' ? (o.additional_fields as Record<string, unknown>) : undefined;
  const text = typeof o.text === 'string' ? o.text : typeof o.note === 'string' ? o.note : undefined;
  return { date, category, subcategory, fields, text };
}

function cycleFromJson(raw: unknown): RawCycle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const start = floDate(o.period_start_date ?? o.start_date ?? o.periodStartDate);
  const end = floDate(o.period_end_date ?? o.end_date ?? o.periodEndDate) ?? start;
  if (!start || !end) return undefined;
  return { start, end, pregnant: o.pregnant === true || o.pregnant === 'True' };
}

function parseTxt(text: string): { cycles: RawCycle[]; events: RawEvent[] } {
  const manualIdx = text.search(/\n\s*manual events/i);
  const cycleSection = manualIdx === -1 ? text : text.slice(0, manualIdx);
  const manualSection = manualIdx === -1 ? '' : text.slice(manualIdx);
  const cycles: RawCycle[] = [];
  for (const block of cycleSection.split(/-{5,}/)) {
    const start = block.match(/Period start date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const end = block.match(/Period end date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const pregnant = /Pregnant:\s*True/i.test(block);
    if (start && isValidISO(start)) cycles.push({ start, end: end && isValidISO(end) ? end : start, pregnant });
  }
  const events: RawEvent[] = [];
  for (const line of manualSection.split('\n')) {
    const parts = line.split(' - ').map((s) => s.trim());
    if (parts.length < 3) continue;
    const dateIdx = parts.findIndex((p) => /^\d{4}-\d{2}-\d{2}/.test(p));
    if (dateIdx === -1) continue;
    const date = floDate(parts[dateIdx]);
    if (!date) continue;
    const category = parts[dateIdx + 1] ?? '';
    const subcategory = parts[dateIdx + 2] ?? '';
    if (!category) continue;
    events.push({ date, category, subcategory });
  }
  return { cycles, events };
}

function parseJson(text: string): { cycles: RawCycle[]; events: RawEvent[] } | undefined {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!root || typeof root !== 'object') return undefined;
  const r = root as Record<string, unknown>;
  const op = (r.operationalData ?? r.operational_data ?? r.data ?? r) as Record<string, unknown>;
  if (!op || typeof op !== 'object') return undefined;
  const cyclesRaw = Array.isArray(op.cycles) ? op.cycles : Array.isArray(r.cycles) ? r.cycles : [];
  const eventLists = Object.entries(op)
    .filter(([k, v]) => /event/i.test(k) && Array.isArray(v))
    .flatMap(([, v]) => v as unknown[]);
  const cycles = cyclesRaw.map(cycleFromJson).filter((c): c is RawCycle => !!c);
  const events = eventLists.map(eventFromJson).filter((e): e is RawEvent => !!e);
  if (cycles.length === 0 && events.length === 0) return undefined;
  return { cycles, events };
}

/** Parses a Flo JSON or text export into an import bundle. Throws on unrecognised input. */
export function parseFloExport(text: string): ImportBundle {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('The file is empty.');
  let parsed = trimmed.startsWith('{') || trimmed.startsWith('[') ? parseJson(trimmed) : undefined;
  if (!parsed && /Period start date:/i.test(trimmed)) parsed = parseTxt(trimmed);
  if (!parsed) throw new Error('This does not look like a Flo export. Ask Flo for your data in JSON format (profile → Help → Contact us) and pick the file from the unzipped download.');

  const logs: Record<ISODate, DayLog> = {};
  const unmapped: string[] = [];
  const skipped: string[] = [];
  let events = 0;

  for (const c of parsed.cycles) {
    if (c.pregnant) {
      skipped.push('Pregnancy cycles');
      continue;
    }
    const len = diffDays(c.start, c.end);
    if (len < 0 || len > 14) continue;
    for (let i = 0; i <= len; i += 1) {
      const d = addDays(c.start, i);
      const existing = logs[d]?.flow;
      if (!existing || existing === 'spotting') setDay(logs, d, { flow: 'medium' });
    }
    events += 1;
  }
  for (const e of parsed.events) {
    if (applyEvent(logs, e, unmapped, skipped)) events += 1;
  }
  const customSymptoms = [...new Set(unmapped)];
  return { logs, customSymptoms, summary: summarise('flo', logs, events, unmapped, skipped) };
}
