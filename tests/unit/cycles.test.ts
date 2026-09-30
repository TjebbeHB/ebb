import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModel, dayStatus, derivePeriods, detectTemperatureShift, recurringPatterns,
} from '../../src/logic/cycles';
import { addDays, diffDays } from '../../src/logic/dates';
import { defaultSettings, type DayLog } from '../../src/logic/types';

function logsFromPeriods(starts: string[], length = 5, extra: DayLog[] = []): Record<string, DayLog> {
  const logs: Record<string, DayLog> = {};
  for (const s of starts) {
    for (let i = 0; i < length; i += 1) {
      const d = addDays(s, i);
      logs[d] = { date: d, flow: i === 0 ? 'heavy' : i === length - 1 ? 'light' : 'medium' };
    }
  }
  for (const e of extra) logs[e.date] = { ...(logs[e.date] ?? { date: e.date }), ...e };
  return logs;
}

test('groups bleeding days into periods and ignores lone spotting', () => {
  const logs = logsFromPeriods(['2026-01-05', '2026-02-02'], 5, [
    { date: '2026-01-20', flow: 'spotting' },
    { date: '2026-02-01', flow: 'spotting' },
  ]);
  const periods = derivePeriods(logs);
  assert.equal(periods.length, 2);
  assert.equal(periods[0]?.start, '2026-01-05');
  assert.equal(periods[0]?.length, 5);
  assert.equal(periods[1]?.start, '2026-02-02');
  // Spotting the day before a period belongs to it but does not shift the start.
  assert.equal(periods[1]?.days.includes('2026-02-01'), false);
});

test('breakthrough bleeding shortly after a period does not start a new cycle', () => {
  const logs = logsFromPeriods(['2026-01-05'], 5, [{ date: '2026-01-13', flow: 'light' }]);
  const periods = derivePeriods(logs);
  assert.equal(periods.length, 1);
  assert.equal(periods[0]?.days.includes('2026-01-13'), true);
});

test('predicts next period from the median of recent cycles', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-02-27', '2026-03-27', '2026-04-25'];
  const logs = logsFromPeriods(starts);
  const model = buildModel(logs, defaultSettings('2026-01-01'), '2026-05-01');
  assert.equal(model.cycles.length, 5);
  assert.equal(model.stats.cycleCount, 4);
  assert.equal(model.stats.medianLength, 28.5);
  assert.equal(model.stats.regularity, 'regular');
  assert.equal(model.predictedCycleLength, 29);
  assert.equal(model.nextPeriodStart, addDays('2026-04-25', 29));
  const first = model.predictions[0]!;
  assert.equal(first.current, true);
  // Ovulation on cycle day 29 - 14 = 15.
  assert.equal(first.ovulation, addDays('2026-04-25', 14));
  assert.equal(first.fertileStart, addDays(first.ovulation!, -5));
  assert.equal(first.fertileEnd, addDays(first.ovulation!, 1));
});

test('falls back to onboarding defaults with a single period', () => {
  const logs = logsFromPeriods(['2026-03-10'], 4);
  const s = { ...defaultSettings('2026-03-10'), defaultCycleLength: 31 };
  const model = buildModel(logs, s, '2026-03-20');
  assert.equal(model.predictedCycleLength, 31);
  assert.equal(model.predictedPeriodLength, 4);
  assert.equal(model.nextPeriodStart, addDays('2026-03-10', 31));
  const st = dayStatus(model, logs, '2026-03-20', '2026-03-20');
  assert.equal(st.cycleDay, 11);
  assert.equal(st.phase, 'follicular');
});

test('excluded and outlier cycles are ignored in statistics', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-04-10', '2026-05-08', '2026-06-05'];
  const logs = logsFromPeriods(starts);
  const model = buildModel(logs, defaultSettings('2026-01-01'), '2026-06-10');
  // 2026-01-29 -> 2026-04-10 is 71 days: outlier.
  assert.equal(model.cycles[1]?.outlier, true);
  assert.equal(model.stats.validCycleCount, 3);
  assert.equal(model.predictedCycleLength, 28);
});

test('late period is reported and predictions never mark the past', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-02-26'];
  const logs = logsFromPeriods(starts);
  const ref = '2026-03-30'; // predicted 03-26
  const model = buildModel(logs, defaultSettings('2026-01-01'), ref);
  const st = dayStatus(model, logs, ref, ref);
  assert.equal(model.nextPeriodStart, '2026-03-26');
  assert.equal(st.late, 4);
  assert.equal(st.predictedPeriod, false);
  const past = dayStatus(model, logs, '2026-03-27', ref);
  assert.equal(past.predictedPeriod, false);
});

test('temperature shift detection follows the three-over-six rule', () => {
  const base = '2026-05-01';
  const temps = [36.4, 36.5, 36.45, 36.4, 36.5, 36.45, 36.7, 36.75, 36.8, 36.8]
    .map((value, i) => ({ date: addDays(base, i), value }));
  assert.equal(detectTemperatureShift(temps), addDays(base, 5));
  const flat = temps.map((t) => ({ ...t, value: 36.5 }));
  assert.equal(detectTemperatureShift(flat), undefined);
});

test('LH evidence stays an estimate and does not teach a luteal length', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-02-26'];
  const extra: DayLog[] = [];
  // Cycle 2 has an LH positive on day 12 -> ovulation day 13, next period day 29 -> luteal 15.
  extra.push({ date: addDays('2026-01-29', 11), lhTest: 'positive' });
  extra.push({ date: addDays('2026-01-01', 11), lhTest: 'positive' });
  // Current cycle: LH positive on day 10 -> ovulation day 11.
  extra.push({ date: addDays('2026-02-26', 9), lhTest: 'positive' });
  const logs = logsFromPeriods(starts, 5, extra);
  const model = buildModel(logs, defaultSettings('2026-01-01'), '2026-03-10');
  assert.equal(model.cycles[1]?.ovulationEvidence?.evidence, 'lh');
  assert.equal(model.cycles[1]?.lutealLength, undefined);
  assert.equal(model.lutealLength, 14);
  const cur = model.predictions[0]!;
  assert.equal(cur.ovulation, addDays('2026-02-26', 10));
  assert.equal(cur.ovulationEvidence, 'lh');
  assert.equal(model.nextPeriodStart, '2026-03-26');
});

test('fertility predictions are hidden on hormonal birth control', () => {
  const logs = logsFromPeriods(['2026-01-01', '2026-01-29']);
  const s = { ...defaultSettings('2026-01-01'), goal: 'birthcontrol' as const, birthControl: 'pill' as const };
  const model = buildModel(logs, s, '2026-02-05');
  assert.equal(model.fertilityEnabled, false);
  assert.equal(model.predictions[0]?.ovulation, undefined);
  const st = dayStatus(model, logs, '2026-02-12', '2026-02-05');
  assert.equal(st.fertile, false);
});

test('recurring premenstrual symptoms are detected', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
  const extra: DayLog[] = [];
  for (const s of starts.slice(1)) {
    extra.push({ date: addDays(s, -2), symptoms: ['cramps', 'bloating'], moods: ['irritable'] });
    extra.push({ date: addDays(s, -1), symptoms: ['cramps'] });
  }
  extra.push({ date: addDays('2026-01-29', -3), symptoms: ['headache'] });
  const logs = logsFromPeriods(starts, 5, extra);
  const model = buildModel(logs, defaultSettings('2026-01-01'), '2026-04-01');
  const patterns = recurringPatterns(model, logs, 'pms');
  assert.equal(patterns[0]?.id, 'cramps');
  assert.equal(patterns[0]?.count, 3);
  assert.ok(patterns.some((p) => p.id === 'irritable' && p.kind === 'mood'));
  assert.ok(!patterns.some((p) => p.id === 'headache'));
});
