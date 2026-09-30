// Cycle engine: derives periods and cycles from daily logs, computes
// statistics, and predicts periods, ovulation and fertile windows.
//
// Method summary
// - Bleeding days (light/medium/heavy) that are at most 3 days apart form one
//   period. Spotting on its own never starts a period but is absorbed into an
//   adjacent one. A bleeding episode that starts less than 12 days after the
//   previous period start is treated as breakthrough bleeding, not a period.
// - Cycle length = days between consecutive period starts. Predictions use the
//   median of the last six valid cycles (outliers shorter than 15 or longer
//   than 60 days and user-excluded cycles are ignored). With fewer than two
//   valid cycles, the user's typical cycle length from onboarding is used.
// - Ovulation is estimated as (predicted cycle length - luteal length) days
//   into the cycle; the luteal length is 14 by default and becomes personal
//   after at least two temperature-supported estimates. LH and mucus signs
//   inform ovulation estimates but do not personalise luteal length. None
//   of these signs confirms ovulation or validates contraceptive use.
// - Fertile window = ovulation - 5 days to ovulation + 1 day, optionally widened
//   by two days on each side (cautious mode).

import { addDays, diffDays, type ISODate } from './dates';
import type { DayLog, Settings } from './types';

export interface Period {
  start: ISODate;
  end: ISODate;
  /** Every day with any bleeding (including spotting) inside the period. */
  days: ISODate[];
  length: number;
}

export type OvulationEvidence = 'bbt' | 'lh' | 'mucus';

export interface OvulationEstimate {
  date: ISODate;
  evidence: OvulationEvidence;
}

export interface Cycle {
  start: ISODate;
  /** Last day of the cycle. Undefined for the ongoing cycle. */
  end?: ISODate;
  /** Cycle length in days. Undefined for the ongoing cycle. */
  length?: number;
  periodLength: number;
  period: Period;
  ovulationEvidence?: OvulationEstimate;
  /** Days from ovulation to the next period start (excl. ovulation day). */
  lutealLength?: number;
  excluded: boolean;
  /** True when the length is outside the plausible range. */
  outlier: boolean;
}

export interface CycleStats {
  cycleCount: number;
  validCycleCount: number;
  averageLength?: number;
  medianLength?: number;
  minLength?: number;
  maxLength?: number;
  stdDev?: number;
  averagePeriodLength?: number;
  medianPeriodLength?: number;
  regularity: 'unknown' | 'regular' | 'somewhat' | 'irregular';
  personalLuteal?: number;
}

export type Phase = 'period' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'pms';

export interface PredictedCycle {
  start: ISODate;
  end: ISODate;
  periodEnd: ISODate;
  ovulation?: ISODate;
  fertileStart?: ISODate;
  fertileEnd?: ISODate;
  /** Whether this cycle is the ongoing one (true) or a future projection. */
  current: boolean;
  /** Logged sign supporting the estimate; never clinical confirmation. */
  ovulationEvidence?: OvulationEvidence;
  /** Originally predicted last day, before any extension because the period is late. */
  expectedEnd: ISODate;
}

export interface DayStatus {
  date: ISODate;
  cycleDay?: number;
  phase?: Phase;
  /** Bleeding actually logged. */
  logged: boolean;
  spotting: boolean;
  /** Part of a predicted (future) period. */
  predictedPeriod: boolean;
  fertile: boolean;
  ovulation: boolean;
  ovulationEvidence?: OvulationEvidence;
  pms: boolean;
  /** Days late relative to the predicted period start (only for today+). */
  late?: number;
}

export interface CycleModel {
  periods: Period[];
  cycles: Cycle[];
  stats: CycleStats;
  predictedCycleLength: number;
  predictedPeriodLength: number;
  lutealLength: number;
  fertilityEnabled: boolean;
  /** Ongoing cycle projection plus upcoming cycles. */
  predictions: PredictedCycle[];
  /** Predicted start of the next period (first future period start). */
  nextPeriodStart?: ISODate;
  nextPeriodRange?: { earliest: ISODate; latest: ISODate };
  /** Days the current period is overdue relative to the prediction (0 when not late). */
  lateDays: number;
  currentCycle?: Cycle;
  lastPeriod?: Period;
}

const MIN_CYCLE = 15;
const MAX_CYCLE = 60;
const PERIOD_GAP = 3; // max days between bleeding days within one period
const MIN_NEW_PERIOD_GAP = 12; // bleeding earlier than this after a start is not a new period
const STATS_WINDOW = 6;

export function isBleeding(log: DayLog | undefined): boolean {
  return !!log?.flow && log.flow !== 'spotting';
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number | undefined {
  if (values.length < 2) return undefined;
  const m = mean(values) ?? 0;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Groups bleeding days into periods. */
export function derivePeriods(logs: Record<ISODate, DayLog>): Period[] {
  const dates = Object.keys(logs)
    .filter((d) => !!logs[d]?.flow)
    .sort();
  if (dates.length === 0) return [];

  // 1. Group any bleeding (incl. spotting) that is close together.
  const groups: ISODate[][] = [];
  let current: ISODate[] = [];
  for (const d of dates) {
    const last = current[current.length - 1];
    if (last && diffDays(last, d) > PERIOD_GAP) {
      groups.push(current);
      current = [];
    }
    current.push(d);
  }
  if (current.length) groups.push(current);

  // 2. A group is a period only if it contains real bleeding. Its start is
  //    the first real bleeding day; leading spotting is kept as part of the
  //    period days but does not define the start.
  const periods: Period[] = [];
  for (const group of groups) {
    const firstReal = group.find((d) => isBleeding(logs[d]));
    if (!firstReal) continue;
    const lastReal = [...group].reverse().find((d) => isBleeding(logs[d])) ?? firstReal;
    const days = group.filter((d) => d >= firstReal && d <= lastReal);
    const prev = periods[periods.length - 1];
    if (prev && diffDays(prev.start, firstReal) < MIN_NEW_PERIOD_GAP) {
      // Breakthrough bleeding: extend the previous period's day list so it
      // still shows on the calendar, but do not start a new cycle.
      prev.days.push(...days);
      prev.end = lastReal > prev.end ? lastReal : prev.end;
      continue;
    }
    periods.push({
      start: firstReal,
      end: lastReal,
      days,
      length: diffDays(firstReal, lastReal) + 1,
    });
  }
  return periods;
}

/** Sensiplan-style temperature shift: three readings above the previous six,
 *  the third at least 0.2 °C above their maximum. Returns the estimated
 *  ovulation date (day before the first high reading). */
export function detectTemperatureShift(
  temps: { date: ISODate; value: number }[],
): ISODate | undefined {
  const sorted = temps.filter((t) => Number.isFinite(t.value) && t.value >= 34 && t.value <= 42).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 6; i + 2 < sorted.length; i += 1) {
    const baseline = Math.max(...sorted.slice(i - 6, i).map((t) => t.value));
    const a = sorted[i];
    const b = sorted[i + 1];
    const c = sorted[i + 2];
    if (!a || !b || !c) continue;
    // Require nine consecutive calendar days. Sparse or duplicate measurements
    // must not create a false thermal shift; disturbed readings are removed upstream.
    const window = sorted.slice(i - 6, i + 3);
    if (window.some((t, j) => j > 0 && diffDays(window[j - 1]!.date, t.date) !== 1)) continue;
    if (a.value > baseline && b.value > baseline && c.value >= baseline + 0.2) {
      return addDays(a.date, -1);
    }
  }
  return undefined;
}

function estimateOvulation(
  logs: Record<ISODate, DayLog>,
  start: ISODate,
  end: ISODate,
): OvulationEstimate | undefined {
  const days: ISODate[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 120) {
    days.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  const temps = days
    .map((d) => logs[d])
    .filter((l): l is DayLog => !!l && typeof l.bbt === 'number' && !l.bbtDisturbed)
    .map((l) => ({ date: l.date, value: l.bbt as number }));
  const shift = detectTemperatureShift(temps);
  if (shift && shift >= start) return { date: shift, evidence: 'bbt' };

  const lhPositive = days.find((d) => logs[d]?.lhTest === 'positive');
  if (lhPositive) {
    const ov = addDays(lhPositive, 1);
    if (ov <= end) return { date: ov, evidence: 'lh' };
  }

  // Mucus peak: last fertile-quality day followed by three non-fertile days.
  const fertileQuality = (d: ISODate) => {
    const m = logs[d]?.mucus;
    return m === 'eggwhite' || m === 'watery';
  };
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const d = days[i];
    if (!d || !fertileQuality(d)) continue;
    const after = days.slice(i + 1, i + 4);
    if (after.length === 3 && after.every((x) => logs[x]?.mucus && !fertileQuality(x))) {
      return { date: d, evidence: 'mucus' };
    }
    break;
  }
  return undefined;
}

export function deriveCycles(
  periods: Period[],
  logs: Record<ISODate, DayLog>,
  excluded: ISODate[],
  refDate: ISODate,
): Cycle[] {
  const cycles: Cycle[] = [];
  for (let i = 0; i < periods.length; i += 1) {
    const p = periods[i];
    if (!p) continue;
    const next = periods[i + 1];
    const end = next ? addDays(next.start, -1) : undefined;
    const length = next ? diffDays(p.start, next.start) : undefined;
    const searchEnd = end ?? refDate;
    const evidence = estimateOvulation(logs, p.start, searchEnd);
    const lutealLength = evidence?.evidence === 'bbt' && next ? diffDays(evidence.date, next.start) - 1 : undefined;
    cycles.push({
      start: p.start,
      end,
      length,
      periodLength: p.length,
      period: p,
      ovulationEvidence: evidence,
      lutealLength,
      excluded: excluded.includes(p.start),
      outlier: length !== undefined && (length < MIN_CYCLE || length > MAX_CYCLE),
    });
  }
  return cycles;
}

export function computeStats(cycles: Cycle[], settings: Settings): CycleStats {
  const completed = cycles.filter((c) => c.length !== undefined);
  const valid = completed.filter((c) => !c.excluded && !c.outlier);
  const recent = valid.slice(-STATS_WINDOW);
  const lengths = recent.map((c) => c.length as number);
  const periodLengths = cycles
    .filter((c) => !c.excluded)
    .slice(-STATS_WINDOW)
    .map((c) => c.periodLength)
    .filter((n) => n >= 1 && n <= 12);
  const luteals = valid
    .filter((c) => c.lutealLength !== undefined && c.lutealLength >= 8 && c.lutealLength <= 18)
    .slice(-STATS_WINDOW)
    .map((c) => c.lutealLength as number);
  const sd = stdDev(lengths);
  let regularity: CycleStats['regularity'] = 'unknown';
  if (lengths.length >= 3 && sd !== undefined) {
    regularity = sd <= 2.5 ? 'regular' : sd <= 5 ? 'somewhat' : 'irregular';
  }
  const personalLuteal = luteals.length >= 2 ? Math.round(median(luteals) ?? settings.lutealLength) : undefined;
  return {
    cycleCount: completed.length,
    validCycleCount: valid.length,
    averageLength: mean(lengths),
    medianLength: median(lengths),
    minLength: lengths.length ? Math.min(...lengths) : undefined,
    maxLength: lengths.length ? Math.max(...lengths) : undefined,
    stdDev: sd,
    averagePeriodLength: mean(periodLengths),
    medianPeriodLength: median(periodLengths),
    regularity,
    personalLuteal,
  };
}

export function fertilityEnabledFor(settings: Settings): boolean {
  if (settings.goal === 'birthcontrol') return false;
  const hormonal = ['pill', 'iud_hormonal', 'implant', 'injection', 'ring', 'patch'];
  return !hormonal.includes(settings.birthControl);
}

function projectCycle(
  start: ISODate,
  cycleLength: number,
  periodLength: number,
  luteal: number,
  fertility: boolean,
  cautious: boolean,
  current: boolean,
  evidence?: OvulationEstimate,
): PredictedCycle {
  let ovulation: ISODate | undefined;
  let end = addDays(start, cycleLength - 1);
  if (fertility) {
    if (evidence) {
      ovulation = evidence.date;
      if (evidence.evidence === 'bbt') end = addDays(ovulation, luteal);
    } else {
      const ovDay = Math.max(6, cycleLength - luteal); // cycle day of ovulation
      ovulation = addDays(start, ovDay - 1);
    }
  }
  const pad = cautious ? 2 : 0;
  return {
    start,
    end,
    periodEnd: addDays(start, Math.max(1, periodLength) - 1),
    ovulation,
    fertileStart: ovulation ? addDays(ovulation, -5 - pad) : undefined,
    fertileEnd: ovulation ? addDays(ovulation, 1 + pad) : undefined,
    current,
    ovulationEvidence: evidence?.evidence,
    expectedEnd: end,
  };
}

export function buildModel(
  logs: Record<ISODate, DayLog>,
  settings: Settings,
  refDate: ISODate,
  horizonCycles = 13,
): CycleModel {
  const periods = derivePeriods(Object.fromEntries(Object.entries(logs).filter(([d]) => d <= refDate)));
  const cycles = deriveCycles(periods, logs, settings.excludedCycles, refDate);
  const stats = computeStats(cycles, settings);
  const fertilityEnabled = fertilityEnabledFor(settings);

  const predictedCycleLength = Math.round(
    stats.validCycleCount >= 2 && stats.medianLength !== undefined
      ? stats.medianLength
      : settings.defaultCycleLength,
  );
  const predictedPeriodLength = Math.round(
    stats.medianPeriodLength !== undefined ? stats.medianPeriodLength : settings.defaultPeriodLength,
  );
  const lutealLength = stats.personalLuteal ?? settings.lutealLength;

  const predictions: PredictedCycle[] = [];
  const lastPeriod = periods[periods.length - 1];
  const currentCycle = cycles[cycles.length - 1];
  let nextPeriodStart: ISODate | undefined;
  let nextPeriodRange: CycleModel['nextPeriodRange'];
  let lateDays = 0;

  if (lastPeriod && currentCycle) {
    const first = projectCycle(
      lastPeriod.start,
      predictedCycleLength,
      predictedPeriodLength,
      lutealLength,
      fertilityEnabled,
      settings.cautiousFertileWindow,
      true,
      currentCycle.ovulationEvidence,
    );
    nextPeriodStart = addDays(first.expectedEnd, 1);
    // If the current cycle already exceeds its predicted length, the period is
    // late: the ongoing cycle stretches to today and future cycles move along.
    if (refDate > first.end) {
      lateDays = diffDays(first.end, refDate) - 1;
      first.end = refDate;
    }
    predictions.push(first);
    const spread = stats.stdDev !== undefined && stats.validCycleCount >= 3
      ? Math.max(1, Math.round(stats.stdDev))
      : 2;
    nextPeriodRange = {
      earliest: addDays(nextPeriodStart, -spread),
      latest: addDays(nextPeriodStart, spread),
    };
    let start = addDays(first.end, 1);
    for (let i = 0; i < horizonCycles; i += 1) {
      const p = projectCycle(
        start,
        predictedCycleLength,
        predictedPeriodLength,
        lutealLength,
        fertilityEnabled,
        settings.cautiousFertileWindow,
        false,
      );
      predictions.push(p);
      start = addDays(p.end, 1);
    }
  }

  return {
    periods,
    cycles,
    stats,
    predictedCycleLength,
    predictedPeriodLength,
    lutealLength,
    fertilityEnabled,
    predictions,
    nextPeriodStart,
    nextPeriodRange,
    lateDays,
    currentCycle,
    lastPeriod,
  };
}

/** Status of a single calendar day given the model. */
export function dayStatus(
  model: CycleModel,
  logs: Record<ISODate, DayLog>,
  date: ISODate,
  refDate: ISODate,
): DayStatus {
  const log = logs[date];
  const status: DayStatus = {
    date,
    logged: isBleeding(log),
    spotting: log?.flow === 'spotting',
    predictedPeriod: false,
    fertile: false,
    ovulation: false,
    pms: false,
  };

  // Which logged cycle does the date fall into?
  const cycle = [...model.cycles].reverse().find((c) => c.start <= date && (!c.end || date <= c.end));
  if (cycle && date <= refDate) {
    status.cycleDay = diffDays(cycle.start, date) + 1;
  }

  const inLoggedPeriod = model.periods.some((p) => p.days.includes(date));
  if (inLoggedPeriod) {
    status.phase = 'period';
  }

  // Find the prediction that covers this date.
  const pred = model.predictions.find((p) => p.start <= date && date <= p.end);

  if (pred) {
    if (!cycle || date > refDate) status.cycleDay = diffDays(pred.start, date) + 1;
    if (pred.current && date > pred.expectedEnd) {
      status.late = diffDays(pred.expectedEnd, date) - 1;
    }
    const isFuturePeriod = !pred.current && date <= pred.periodEnd;
    if (isFuturePeriod) {
      status.predictedPeriod = true;
      status.phase = status.phase ?? 'period';
    }
    if (pred.fertileStart && pred.fertileEnd && date >= pred.fertileStart && date <= pred.fertileEnd) {
      status.fertile = true;
      if (!status.phase) status.phase = 'fertile';
    }
    if (pred.ovulation === date) {
      status.ovulation = true;
      status.ovulationEvidence = pred.ovulationEvidence;
      if (status.phase !== 'period') status.phase = 'ovulation';
    }
    const pmsStart = addDays(pred.expectedEnd, -4);
    if (date >= pmsStart && date <= pred.end && !status.phase) {
      status.pms = true;
      status.phase = 'pms';
    }
    if (!status.phase) {
      if (pred.ovulation) {
        status.phase = date < pred.ovulation ? 'follicular' : 'luteal';
      } else {
        // Fertility hidden: split the cycle roughly in halves.
        const half = addDays(pred.start, Math.floor(diffDays(pred.start, pred.end) / 2));
        status.phase = date <= half ? 'follicular' : 'luteal';
      }
    }
  } else if (cycle && cycle.end && !status.phase) {
    // Historical cycle without a prediction: derive phases from what is known.
    const ov = cycle.ovulationEvidence?.date
      ?? addDays(cycle.start, Math.max(6, (cycle.length ?? model.predictedCycleLength) - model.lutealLength) - 1);
    if (model.fertilityEnabled) {
      const fs = addDays(ov, -5);
      const fe = addDays(ov, 1);
      if (date === ov) {
        status.ovulation = true;
        status.ovulationEvidence = cycle.ovulationEvidence?.evidence;
        status.phase = 'ovulation';
      } else if (date >= fs && date <= fe) {
        status.fertile = true;
        status.phase = 'fertile';
      }
    }
    if (!status.phase) {
      const pmsStart = addDays(cycle.end, -4);
      if (date >= pmsStart) {
        status.pms = true;
        status.phase = 'pms';
      } else {
        status.phase = date < ov ? 'follicular' : 'luteal';
      }
    }
  }

  if (date < refDate && status.predictedPeriod) {
    // Predictions never apply to the past.
    status.predictedPeriod = false;
  }
  return status;
}

export interface SymptomPattern {
  id: string;
  kind: 'symptom' | 'mood';
  /** Cycles (out of `of`) in which the item appeared in the window. */
  count: number;
  of: number;
}

/** Items that recur in the days before the period (PMS window) or during it. */
export function recurringPatterns(
  model: CycleModel,
  logs: Record<ISODate, DayLog>,
  window: 'pms' | 'period',
  maxCycles = 6,
): SymptomPattern[] {
  const completed = model.cycles.filter((c) => c.end && !c.excluded && !c.outlier).slice(-maxCycles);
  const result: SymptomPattern[] = [];
  for (const kind of ['symptom', 'mood'] as const) {
    const key = kind === 'symptom' ? 'symptoms' : 'moods';
    const observed = completed.map((c) => {
      const dates = window === 'pms' ? Array.from({ length: 5 }, (_, i) => addDays(c.end!, -i)) : c.period.days;
      return dates.map((d) => logs[d]?.[key]).filter((v): v is string[] => Array.isArray(v));
    }).filter((days) => days.length > 0);
    const counts = new Map<string, number>();
    for (const days of observed) for (const id of new Set(days.flat())) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) if (count >= 2 && count / observed.length >= 0.5) result.push({ id, kind, count, of: observed.length });
  }
  return result.sort((a, b) => b.count - a.count);
}

export interface PhaseFrequency {
  id: string;
  kind: 'symptom' | 'mood';
  byPhase: Record<Phase, number>;
  total: number;
}

/** Only explicit entries in the relevant category belong in its denominator. */
export function phaseFrequencies(model: CycleModel, logs: Record<ISODate, DayLog>, refDate: ISODate): PhaseFrequency[] {
  const phases: Phase[] = ['period', 'follicular', 'fertile', 'ovulation', 'luteal', 'pms'];
  const result: PhaseFrequency[] = [];
  for (const kind of ['symptom', 'mood'] as const) {
    const key = kind === 'symptom' ? 'symptoms' : 'moods';
    const denominators = Object.fromEntries(phases.map((p) => [p, 0])) as Record<Phase, number>;
    const counts = new Map<string, Record<Phase, number>>();
    for (const [date, log] of Object.entries(logs)) {
      if (date > refDate || !Array.isArray(log[key])) continue;
      const cycle = model.cycles.find((c) => c.start <= date && (!c.end || c.end >= date));
      if (!cycle || cycle.excluded || cycle.outlier) continue;
      const phase = dayStatus(model, logs, date, refDate).phase;
      if (!phase) continue;
      denominators[phase] += 1;
      for (const id of new Set(log[key])) {
        const per = counts.get(id) ?? Object.fromEntries(phases.map((p) => [p, 0])) as Record<Phase, number>;
        per[phase] += 1;
        counts.set(id, per);
      }
    }
    for (const [id, per] of counts) result.push({ id, kind, total: Object.values(per).reduce((a, b) => a + b, 0), byPhase: Object.fromEntries(phases.map((p) => [p, denominators[p] ? per[p] / denominators[p] : 0])) as Record<Phase, number> });
  }
  return result.sort((a, b) => b.total - a.total);
}

export function phaseLabel(phase: Phase | undefined): string {
  switch (phase) {
    case 'period': return 'Period';
    case 'follicular': return 'Follicular phase';
    case 'fertile': return 'Fertile window';
    case 'ovulation': return 'Ovulation';
    case 'luteal': return 'Luteal phase';
    case 'pms': return 'Premenstrual';
    default: return 'No cycle data';
  }
}

export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}
export function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}
export function kgToLb(kg: number): number {
  return kg * 2.2046226218;
}
export function lbToKg(lb: number): number {
  return lb / 2.2046226218;
}
