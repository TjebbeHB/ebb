import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floDate, parseFloExport } from '../../src/logic/floImport';
import { mergeImport } from '../../src/logic/importMerge';
import { emptyData } from '../../src/logic/types';

const floJson = JSON.stringify({
  operationalData: {
    cycles: [
      { period_start_date: '2026-06-02 00:00:00', period_end_date: '2026-06-06 00:00:00', pregnant: false },
      { period_start_date: '2026-06-30', period_end_date: '2026-07-04', pregnant: false },
      { period_start_date: '2026-03-01', period_end_date: '2026-03-05', pregnant: true },
    ],
    point_events_manual_v2: [
      { date: '2026-06-16 00:00:00', category: 'Fluid', subcategory: 'Eggwhite' },
      { date: '2026-06-28', category: 'Symptoms', subcategory: 'Cramps' },
      { date: '2026-06-28', category: 'Symptoms', subcategory: 'Bloating' },
      { date: '2026-06-28', category: 'Mood', subcategory: 'Mood swings' },
      { date: '2026-06-20', category: 'Sex', subcategory: 'Unprotected sex' },
      { date: '2026-06-20', category: 'Sex', subcategory: 'High sex drive' },
      { date: '2026-06-17', category: 'Ovulation', subcategory: 'Test positive' },
      { date: '2026-06-12', category: 'Water', subcategory: 'Water', additional_fields: { value: 1500 } },
      { date: '2026-06-12', category: 'Weight', subcategory: 'Weight', additional_fields: { value: 61.4 } },
      { date: '2026-06-12', category: 'Basal temperature', subcategory: 'Temperature', additional_fields: { value: 36.55 } },
      { date: '2026-06-12', category: 'Physical activity', subcategory: 'Yoga' },
      { date: '2026-06-25', category: 'Symptoms', subcategory: 'Feeling guilty' },
      { date: '2026-06-25', category: 'Symptoms', subcategory: 'Sparkly toes' },
      { date: '2026-06-03', category: 'Menstrual flow', subcategory: 'Heavy' },
      { date: '2026-05-20', category: 'Menstrual flow', subcategory: 'Spotting' },
      { date: '2026-06-27', category: 'Notes', subcategory: 'Note', additional_fields: { text: 'Long day at work' } },
      { date: '2026-06-01', category: 'Ovulation', subcategory: 'ML prediction', additional_fields: { predicted: true } },
    ],
  },
});

test('parses a Flo JSON export into diary days', () => {
  const b = parseFloExport(floJson);
  const l = b.logs;
  // Cycles become bleeding days, pregnancy cycles are skipped.
  assert.equal(l['2026-06-02']?.flow, 'medium');
  assert.equal(l['2026-06-06']?.flow, 'medium');
  assert.equal(l['2026-06-07']?.flow, undefined);
  assert.equal(l['2026-03-01'], undefined);
  assert.ok(b.summary.skipped.includes('Pregnancy cycles'));
  // Flow intensity overrides the generic medium.
  assert.equal(l['2026-06-03']?.flow, 'heavy');
  assert.equal(l['2026-05-20']?.flow, 'spotting');
  // Events.
  assert.equal(l['2026-06-16']?.mucus, 'eggwhite');
  assert.deepEqual(l['2026-06-28']?.symptoms, ['cramps', 'bloating']);
  assert.deepEqual(l['2026-06-28']?.moods, ['mood_swings']);
  assert.deepEqual(l['2026-06-20']?.sex, ['unprotected']);
  assert.equal(l['2026-06-20']?.libido, 'high');
  assert.equal(l['2026-06-17']?.lhTest, 'positive');
  assert.equal(l['2026-06-12']?.water, 6);
  assert.equal(l['2026-06-12']?.weight, 61.4);
  assert.equal(l['2026-06-12']?.bbt, 36.55);
  assert.deepEqual(l['2026-06-12']?.exercise, ['yoga']);
  assert.equal(l['2026-06-27']?.notes, 'Long day at work');
  // Known-but-unlisted vocabulary maps by keyword; unknown becomes a custom symptom.
  assert.ok(l['2026-06-25']?.moods?.includes('sensitive'));
  assert.deepEqual(l['2026-06-25']?.symptoms, ['Sparkly toes']);
  assert.deepEqual(b.customSymptoms, ['Sparkly toes']);
  // Predictions are ignored.
  assert.equal(l['2026-06-01'], undefined);
  assert.equal(b.summary.source, 'flo');
  assert.equal(b.summary.firstDate, '2026-05-20');
  assert.equal(b.summary.bleedingDays, 11);
});

test('parses the Flo text export', () => {
  const txt = [
    'cycle 1', 'Period start date: 2026-06-02', 'Period end date: 2026-06-05', 'Pregnant: False', '---------------',
    'cycle 2', 'Period start date: 2026-06-30', 'Period end date: 2026-07-03', 'Pregnant: False', '---------------',
    'manual events',
    '1 - 2026-06-16 00:00:00 - Fluid - Eggwhite - manual',
    '2 - 2026-06-28 00:00:00 - Symptoms - Headache - manual',
  ].join('\n');
  const b = parseFloExport(txt);
  assert.equal(b.logs['2026-06-02']?.flow, 'medium');
  assert.equal(b.logs['2026-06-05']?.flow, 'medium');
  assert.equal(b.logs['2026-06-16']?.mucus, 'eggwhite');
  assert.deepEqual(b.logs['2026-06-28']?.symptoms, ['headache']);
  assert.equal(b.summary.bleedingDays, 8);
});

test('rejects files that are not Flo exports', () => {
  assert.throws(() => parseFloExport('hello'), /does not look like a Flo export/);
  assert.throws(() => parseFloExport('{"foo": 1}'), /does not look like a Flo export/);
  assert.equal(floDate('2026-01-02T10:00:00Z'), '2026-01-02');
  assert.equal(floDate('nope'), undefined);
});

test('merging keeps manual entries and unions lists', () => {
  const data = emptyData('2026-01-01');
  data.logs['2026-06-28'] = { date: '2026-06-28', symptoms: ['headache'], flow: 'light', notes: 'mine' };
  data.settings.customSymptoms = ['Existing'];
  const b = parseFloExport(floJson);
  const merged = mergeImport(data, b);
  assert.deepEqual(merged.logs['2026-06-28']?.symptoms, ['headache', 'cramps', 'bloating']);
  assert.equal(merged.logs['2026-06-28']?.flow, 'light');
  assert.equal(merged.logs['2026-06-28']?.notes, 'mine');
  assert.equal(merged.logs['2026-06-02']?.flow, 'medium');
  assert.deepEqual(merged.settings.customSymptoms, ['Existing', 'Sparkly toes']);
  assert.equal(merged.settings.onboarded, false);
  // Original data is untouched.
  assert.deepEqual(data.logs['2026-06-28']?.symptoms, ['headache']);
});
