import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCare } from '../../src/logic/guidance';
const base = { date: '2026-09-12', hasCycle: true, fertilityEnabled: true, phase: 'period' as const };
test('energy allows usual movement during period; pain takes precedence', () => {
  assert.match(dailyCare({ ...base, log: { date: base.date, energy: 5 } }).movement, /usual workout/);
  const severe = dailyCare({ ...base, log: { date: base.date, energy: 5, pain: 8 } });
  assert.match(severe.movement, /avoid pushing through pain/);
  assert.ok(severe.caution);
});
test('only same-day observations can change daily movement', () => {
  assert.match(dailyCare({ ...base, log: { date: base.date, energy: 2 } }).movement, /easier option/);
  assert.equal(dailyCare({ ...base, log: { date: '2026-09-11', energy: 2 } }).movement, dailyCare(base).movement);
  assert.equal(dailyCare({ ...base, log: { date: '2026-09-13', pain: 9 } }).caution, undefined);
});
test('hormonal, missing and uncertain cycles use everyday guidance', () => {
  for (const patch of [{ fertilityEnabled: false }, { hasCycle: false }, { phaseUncertain: true }]) {
    assert.equal(dailyCare({ ...base, ...patch }).stage, 'everyday');
  }
  assert.equal(dailyCare({ ...base, phase: 'pms' }).stage, 'luteal');
  assert.equal(dailyCare({ ...base, phase: 'fertile' }).stage, 'ovulation');
});
test('positive pregnancy entry does not get phase or high-energy workout advice', () => {
  const care = dailyCare({ ...base, log: { date: base.date, pregnancyTest: 'positive', energy: 5 } });
  assert.equal(care.stage, 'everyday'); assert.match(care.movement, /maternity care team/);
});
test('explicit zero pain and good sleep do not prompt unnecessary rest', () => {
  assert.equal(dailyCare({ ...base, log: { date: base.date, pain: 0, sleepQuality: 'good', symptoms: [] } }).movement, dailyCare(base).movement);
  assert.match(dailyCare({ ...base, log: { date: base.date, sleepQuality: 'poor' } }).movement, /easier option/);
});
