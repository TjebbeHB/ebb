import { dayStatus, mean, median, phaseLabel, type CycleModel, type Phase } from './cycles';
import { addDays, type ISODate } from './dates';
import { anyLabel } from './trackers';
import type { AppData, DayLog } from './types';
import type { HealthData } from './healthData';

/** Rolling-origin retrospective evaluation of the median cycle-length rule.
 * Each prediction uses only earlier completed cycles, never the target. */
export function predictionReview(model: CycleModel) {
  const valid = model.cycles.filter((c) => c.length !== undefined && !c.excluded && !c.outlier);
  const errors: number[] = [];
  for (let i = 2; i < valid.length; i++) {
    const predicted = Math.round(median(valid.slice(Math.max(0, i - 6), i).map((c) => c.length!))!);
    errors.push(Math.abs(predicted - valid[i]!.length!));
  }
  const recent = errors.slice(-6);
  return { count: recent.length, averageError: mean(recent), withinTwo: recent.filter((e) => e <= 2).length };
}

export interface WellbeingPattern {
  metric: string; unit: string; phase: Phase; average: number; otherAverage: number;
  days: number; cycles: number; otherDays: number;
}

export function wellbeingPatterns(model: CycleModel, logs: Record<ISODate, DayLog>, ref: ISODate, health?: HealthData): WellbeingPattern[] {
  if (!model.fertilityEnabled) return []; // Avoid assigning hormonal phases during contraception.
  const start = addDays(ref, -180);
  const dates = [...new Set([...Object.keys(logs), ...Object.keys(health?.days ?? {})])].sort();
  const result: WellbeingPattern[] = [];
  const metrics = [
    { name: 'Energy', unit: '/5', min: 1, max: 5, threshold: 0.5, value: (d: string) => logs[d]?.energy },
    { name: 'Sleep', unit: 'h', min: 0, max: 24, threshold: 0.5, value: (d: string) => logs[d]?.sleepHours ?? health?.days[d]?.sleepHours },
    { name: 'Pain', unit: '/10', min: 0, max: 10, threshold: 1, value: (d: string) => logs[d]?.pain },
    { name: 'Resting heart rate', unit: 'bpm', min: 20, max: 250, threshold: 3, value: (d: string) => health?.days[d]?.restingHeartRate },
  ];
  for (const metric of metrics) {
    const observations: { phase: Phase; value: number; cycle: string }[] = [];
    for (const date of dates) {
      if (date < start || date > ref) continue;
      const c = model.cycles.find((c) => c.start <= date && c.end && date <= c.end);
      if (!c || c.excluded || c.outlier) continue;
      const phase = dayStatus(model, logs, date, ref).phase;
      const value = metric.value(date);
      if (!phase || typeof value !== 'number' || !Number.isFinite(value) || value < metric.min || value > metric.max) continue;
      observations.push({ phase, value, cycle: c.start });
    }
    for (const phase of ['period', 'follicular', 'luteal', 'pms'] as Phase[]) {
      const inside = observations.filter((o) => o.phase === phase);
      const outside = observations.filter((o) => o.phase !== phase);
      const cycles = new Set(inside.map((o) => o.cycle)).size;
      if (inside.length < 5 || outside.length < 5 || cycles < 2 || new Set(outside.map((o) => o.cycle)).size < 2) continue;
      // Give each cycle equal weight so a heavily logged month does not dominate.
      const balanced = (items: typeof observations) => mean([...new Set(items.map((o) => o.cycle))].map((c) => mean(items.filter((o) => o.cycle === c).map((o) => o.value))!))!;
      const average = balanced(inside), otherAverage = balanced(outside);
      if (Math.abs(average - otherAverage) < metric.threshold) continue;
      result.push({ metric: metric.name, unit: metric.unit, phase, average, otherAverage, days: inside.length, cycles, otherDays: outside.length });
    }
  }
  return result.slice(0, 6);
}

export function appointmentSummary(data: AppData, model: CycleModel, ref: ISODate): string {
  const start = addDays(ref, -89);
  const logs = Object.values(data.logs).filter((l) => l.date >= start && l.date <= ref).sort((a, b) => a.date.localeCompare(b.date));
  const painful = logs.filter((l) => typeof l.pain === 'number' && Number.isFinite(l.pain));
  const lines = ['Ebb — appointment summary', `${start} to ${ref} (90 days)`, '',
    'Self-reported observations, not a diagnosis. Missing entries are unknown.',
    `Days with entries: ${logs.length}`, `Days with heavy flow logged: ${logs.filter((l) => l.flow === 'heavy').length}`,
    `Pain: ${painful.length} recorded days${painful.length ? `; average ${mean(painful.map((l) => l.pain!))!.toFixed(1)}/10; highest ${Math.max(...painful.map((l) => l.pain!))}/10` : ''}`,
    `Days with missed activities: ${logs.filter((l) => l.dailyImpact === 'missed_activities').length}`, '', 'Cycles starting in this window:'];
  for (const c of model.cycles.filter((c) => c.start >= start && c.start <= ref)) lines.push(`${c.start}: ${c.length ? `${c.length} days` : 'ongoing'}, ${c.period.days.length} bleeding days recorded${c.excluded ? ' (excluded from predictions)' : ''}`);
  lines.push('', 'Symptom counts (days recorded):');
  const counts = new Map<string, number>();
  for (const l of logs) for (const s of new Set(l.symptoms ?? [])) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const [id, count] of [...counts].sort((a, b) => b[1] - a[1])) lines.push(`${anyLabel(id)}: ${count}`);
  lines.push('', 'Pain and impact timeline:');
  for (const l of logs.filter((l) => l.pain !== undefined || l.dailyImpact)) lines.push(`${l.date}: pain ${l.pain ?? 'not recorded'}/10; impact ${l.dailyImpact?.replaceAll('_', ' ') ?? 'not recorded'}`);
  lines.push('', 'Private notes and sexual activity are omitted from this summary.');
  return lines.join('\n');
}

export function patternText(p: WellbeingPattern): string {
  return `${p.metric} averaged ${p.average.toFixed(1)} ${p.unit} during ${phaseLabel(p.phase).toLowerCase()}, compared with ${p.otherAverage.toFixed(1)} ${p.unit} on other logged days.`;
}
