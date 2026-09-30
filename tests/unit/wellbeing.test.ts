import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, detectTemperatureShift, phaseFrequencies, recurringPatterns, dayStatus } from '../../src/logic/cycles';
import { addDays } from '../../src/logic/dates';
import { defaultSettings, isEmptyLog, type DayLog } from '../../src/logic/types';
import { summariseHealth, normaliseHealth } from '../../src/logic/healthData';
import { appointmentSummary, predictionReview, wellbeingPatterns } from '../../src/logic/wellbeing';
const settings = defaultSettings('2026-01-01');
function diary(lengths = [28, 28, 28, 28, 28]) {
  const logs: Record<string, DayLog> = {};
  let start = '2026-01-01';
  const starts = [start];
  for (const length of lengths) { start = addDays(start, length); starts.push(start); }
  for (const s of starts) for (let i = 0; i < 5; i++) { const d = addDays(s, i); logs[d] = { date: d, flow: 'medium' }; }
  return { logs, starts, ref: addDays(start, 5) };
}
test('rolling estimates do not see the target cycle or future cycles', () => {
  const { logs, ref } = diary([28, 28, 40, 28, 28]);
  const r = predictionReview(buildModel(logs, settings, ref));
  assert.equal(r.count, 3); assert.equal(r.averageError, 4); assert.equal(r.withinTwo, 2);
});
test('missing symptoms and excluded cycles do not dilute category frequencies', () => {
  const { logs, starts, ref } = diary([28, 28]);
  logs[starts[0]!]!.symptoms = ['cramps'];
  logs[starts[1]!]!.symptoms = [];
  const model = buildModel(logs, settings, ref);
  assert.equal(phaseFrequencies(model, logs, ref)[0]!.byPhase.period, 0.5);
  const excluded = buildModel(logs, { ...settings, excludedCycles: [starts[1]!] }, ref);
  assert.equal(phaseFrequencies(excluded, logs, ref)[0]!.byPhase.period, 1);
  assert.equal(isEmptyLog({ date: ref, symptoms: [] }), false);
});
test('recurrence denominator only counts cycles with category observations and retains custom IDs', () => {
  const { logs, starts, ref } = diary();
  for (const s of starts.slice(1, 3)) logs[addDays(s, -1)] = { date: addDays(s, -1), symptoms: ['custom:pain'] };
  const r = recurringPatterns(buildModel(logs, settings, ref), logs, 'pms');
  assert.deepEqual(r, [{ id: 'custom:pain', kind: 'symptom', count: 2, of: 2 }]);
});
test('sparse and duplicate temperatures cannot manufacture a shift', () => {
  const values = [36.4,36.4,36.4,36.4,36.4,36.4,36.7,36.7,36.8];
  const spaced = values.map((value, i) => ({ value, date: addDays('2026-01-01', i < 6 ? i * 2 : 20 + i) }));
  assert.equal(detectTemperatureShift(spaced), undefined);
  const dup = values.map((value, i) => ({ value, date: addDays('2026-01-01', Math.floor(i / 2)) }));
  assert.equal(detectTemperatureShift(dup), undefined);
});
test('temperature-supported estimates can still personalise the luteal phase', () => {
  const { logs, starts, ref } = diary([28,28]);
  for (const s of starts.slice(0,2)) [36.4,36.4,36.4,36.4,36.4,36.4,36.7,36.7,36.8].forEach((bbt,i) => { const d=addDays(s,i+7); logs[d]={ date:d, bbt }; });
  const m = buildModel(logs, settings, ref);
  assert.equal(m.stats.personalLuteal, 15);
});
test('future logs do not enter predictions and projected cycle day resets', () => {
  const { logs, ref } = diary([28,28]);
  logs['2027-01-01'] = { date: '2027-01-01', flow: 'heavy' };
  const m = buildModel(logs, settings, ref);
  assert.notEqual(m.lastPeriod?.start, '2027-01-01');
  assert.equal(dayStatus(m, logs, m.nextPeriodStart!, ref).cycleDay, 1);
});
test('overlapping stages are deduplicated and a night belongs to the wake date', () => {
  const d = summariseHealth([
    {start:'2026-09-10T23:00:00',end:'2026-09-11T03:00:00'},
    {start:'2026-09-11T02:00:00',end:'2026-09-11T06:00:00'},
    {start:'2026-09-11T06:30:00',end:'2026-09-11T07:30:00'},
  ], [{time:'2026-09-11T08:00:00',value:60},{time:'2026-09-11T09:00:00',value:64},{time:'bad',value:70}], '2026-09-01','2026-09-11');
  assert.equal(d['2026-09-11']?.sleepHours, 8);
  assert.equal(d['2026-09-11']?.restingHeartRate, 62);
  assert.equal(Object.keys(d).length,1);
});
test('invalid imports, dates, NaN and out of range values are removed', () => {
  assert.equal(normaliseHealth({provider:'other'}),undefined);
  const d=normaliseHealth({provider:'apple-health',syncedAt:'2026-09-11T12:00:00Z',days:{'2026-09-11':{sleepHours:NaN,restingHeartRate:60},'bad':{sleepHours:8},'2026-09-10':{sleepHours:80}}});
  assert.deepEqual(d?.days, {'2026-09-11': {date:'2026-09-11',restingHeartRate:60}});
});
test('patterns require repeated observations, keep zero pain and use manual sleep first', () => {
  const { logs, starts, ref }=diary([28,28]);
  const health={ provider:'apple-health' as const,syncedAt:'2026-09-11T12:00:00Z',days:{} as Record<string,{date:string;sleepHours:number}>};
  for(const s of starts.slice(0,2)) for(let i=0;i<12;i++) {
    const d=addDays(s,i); logs[d]={...logs[d],date:d,pain:i<5?5:0,sleepHours:i<5?6:8}; health.days[d]={date:d,sleepHours:10};
  }
  const m=buildModel(logs,settings,ref),p=wellbeingPatterns(m,logs,ref,health);
  assert.equal(p.find((p)=>p.metric==='Sleep'&&p.phase==='period')?.average,6);
  assert.equal(p.find((p)=>p.metric==='Pain'&&p.phase==='period')?.otherAverage,0);
  assert.equal(wellbeingPatterns(buildModel(logs,{...settings,goal:'birthcontrol'},ref),logs,ref,health).length,0);
});
test('appointment summary respects its window and omits private notes and sex', () => {
  const {logs,ref}=diary(); logs[ref]={date:ref,pain:0,dailyImpact:'none',notes:'PRIVATE SECRET',sex:['protected']};
  const m=buildModel(logs,settings,ref);
  const report=appointmentSummary({version:1,settings,logs},m,ref);
  assert.ok(report.includes('highest 0/10')); assert.ok(!report.includes('PRIVATE SECRET')); assert.ok(!report.includes('protected')); assert.ok(!report.includes('2026-01-01:'));
});
