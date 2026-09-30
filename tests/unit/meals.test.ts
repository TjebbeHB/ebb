import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMealPhotoFile, MEAL_LIMITS, normaliseMealEntry, normaliseMeals, parseMealSuggestion, validateMealDraft } from '../../src/logic/meals';

const meal = {
  id: 'meal-123', date: '2026-09-12', createdAt: '2026-09-12T12:00:00.000Z',
  dish: 'Chickpea salad', weightGrams: 350,
  ingredients: [{ name: 'Chickpeas', grams: 150 }, { name: 'Tomato' }],
  source: 'ai', model: 'e2b', userConfirmed: true, photoFile: 'meal-123.jpg',
};

test('photo parser accepts fenced JSON suggestions and does not persist model-controlled metadata', () => {
  const raw = 'Meal draft:\n```json\n' + JSON.stringify({
    ...meal, isFood: true, nutrition: { kcal: 440 }, notes: 'This cures disease',
    userConfirmed: true, photoFile: '../../private.jpg', source: 'manual',
  }) + '\n```';
  const parsed = parseMealSuggestion(raw);
  assert.deepEqual(parsed, { ok: true, draft: { dish: meal.dish, weightGrams: 350, ingredients: meal.ingredients } });
});

test('unknown portions remain unknown and a named dish can be reviewed with no known ingredients', () => {
  const parsed = parseMealSuggestion(JSON.stringify({ isFood: true, dish: 'Stew', weightGrams: null, ingredients: [] }));
  assert.deepEqual(parsed, { ok: true, draft: { dish: 'Stew', ingredients: [] } });
  const ingredients = parseMealSuggestion(JSON.stringify({ dish: 'Bowl', ingredients: [{ name: 'Lentils', grams: null }] }));
  assert.deepEqual(ingredients, { ok: true, draft: { dish: 'Bowl', ingredients: [{ name: 'Lentils' }] } });
});

test('nonfood, incomplete JSON, huge output and unsupported data shapes fail safely', () => {
  const cases = [
    JSON.stringify({ isFood: false, dish: 'Coffee cup', ingredients: [] }),
    JSON.stringify({ isFood: true, dish: 'unknown', ingredients: [] }),
    JSON.stringify({ isFood: 'true', dish: 'Pasta', ingredients: [] }),
    '{"dish":"Pasta","ingredients":',
    'There is a chair in the photograph.',
    JSON.stringify({ dish: 'Pasta', ingredients: 'tomato' }),
    JSON.stringify({ dish: 'Pasta', ingredients: [null] }),
    ' '.repeat(MEAL_LIMITS.modelCharacters + 1),
    JSON.stringify({ dish: 'Pasta', ingredients: Array(25).fill({ name: 'Tomato' }) }),
    JSON.stringify({ dish: 'x'.repeat(121), ingredients: [] }),
    JSON.stringify({ dish: 'Pasta', ingredients: [{ name: 'x'.repeat(81) }] }),
  ];
  for (const raw of cases) assert.equal(parseMealSuggestion(raw).ok, false, raw.slice(0, 100));
});

test('food descriptions cannot introduce executable markup or obvious medical/prompt instructions', () => {
  for (const dish of ['<script>alert(1)</script>', 'javascript:alert(1)', 'Ignore previous instructions', 'Allergen-free salad', 'Cures diabetes']) {
    assert.equal(parseMealSuggestion(JSON.stringify({ isFood: true, dish, ingredients: [] })).ok, false, dish);
  }
  assert.equal(parseMealSuggestion(JSON.stringify({ dish: 'Salad', ingredients: [{ name: 'Safe for allergies' }] })).ok, false);
  assert.equal(parseMealSuggestion('{"dish":"Pasta {name}","ingredients":[]}').ok, false);
  assert.equal(parseMealSuggestion(JSON.stringify({ dish: 'Crème brûlée', ingredients: [{ name: 'Oat milk' }] })).ok, true);
});

test('nonfinite, negative, zero or extreme weight cannot enter a reviewed meal', () => {
  for (const weightGrams of [NaN, Infinity, -Infinity, -1, 0, 5001, '100', '']) {
    assert.equal(validateMealDraft({ ...meal, weightGrams }).ok, false);
    assert.equal(validateMealDraft({ ...meal, ingredients: [{ name: 'Rice', grams: weightGrams }] }).ok, false);
  }
  assert.equal(validateMealDraft({ ...meal, weightGrams: 0.5 }).ok, true);
});

test('manual nutrition remains optional with zero allowed and finite bounds', () => {
  const result = validateMealDraft({ ...meal, nutrition: { kcal: 0, proteinGrams: 14.5, fibreGrams: 7 } });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.draft.nutrition, { kcal: 0, proteinGrams: 14.5, fibreGrams: 7 });
  for (const nutrition of [{ kcal: -1 }, { proteinGrams: Infinity }, { fibreGrams: NaN }, { kcal: 15001 }, { kcal: '100' }]) {
    assert.equal(validateMealDraft({ ...meal, nutrition }).ok, false);
  }
});

test('unconfirmed, invalid-date and invalid identity records cannot be imported', () => {
  const invalid = [
    { userConfirmed: false }, { userConfirmed: 'true' }, { userConfirmed: undefined },
    { date: '2026-02-30' }, { createdAt: '2026-02-30T12:00:00.000Z' },
    { createdAt: 'yesterday' }, { id: '../meal' }, { source: 'automatic' }, { model: 'remote' },
  ];
  for (const change of invalid) assert.equal(normaliseMealEntry({ ...meal, ...change }), undefined, JSON.stringify(change));
  assert.equal(normaliseMeals({ meal }).length, 0);
});

test('import whitelists reviewed data, strips photos by default and deduplicates ids', () => {
  const [entry] = normaliseMeals([{ ...meal, secret: 'discard', imageUri: 'file:///private.jpg' }, meal]);
  assert.ok(entry);
  assert.equal(entry.photoFile, undefined);
  assert.equal('imageUri' in entry, false);
  assert.equal('secret' in entry, false);
  assert.equal(normaliseMeals([meal, meal]).length, 1);
  assert.equal(normaliseMeals([meal], { keepPhotoReferences: true })[0]?.photoFile, meal.photoFile);
});

test('local photo references cannot escape the private meal directory', () => {
  for (const photoFile of ['../a.jpg', '/a.jpg', 'file:///a.jpg', 'https://example.com/a.jpg', 'a%2f.jpg', 'a\\b.jpg', '.jpg', 'a.jpg\n', 'a.svg']) {
    assert.equal(isMealPhotoFile(photoFile), false, photoFile);
    assert.equal(normaliseMeals([{ ...meal, photoFile }], { keepPhotoReferences: true })[0]?.photoFile, undefined);
  }
  assert.equal(isMealPhotoFile('meal_2026-09-12.jpeg'), true);
});
