import { expect, test, type Page } from '@playwright/test';

// The web preview shares the native code paths for everything except
// notifications, app lock and file sharing (which are guarded per platform).

const TODAY = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d;
};

async function goToMonth(page: Page, target: Date) {
  // Navigate month view backwards until the target day button exists.
  for (let i = 0; i < 24; i += 1) {
    if (await page.getByTestId(`day-${iso(target)}`).count()) return;
    await page.getByTestId('month-prev').click();
  }
  throw new Error('Could not reach month');
}

async function onboard(page: Page, lastStartDaysAgo = 24) {
  await page.goto('/');
  await page.getByTestId('onboarding-start').click();
  await page.getByTestId('goal-track').click();
  await page.getByTestId('onboarding-next-1').click();
  await page.getByTestId('onboarding-next-2').click();
  const start = daysAgo(lastStartDaysAgo);
  await goToMonth(page, start);
  await page.getByTestId(`day-${iso(start)}`).click();
  await page.getByTestId('onboarding-finish').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
}

test('onboarding leads to a Today screen with cycle day and prediction', async ({ page }) => {
  await onboard(page, 24);
  await expect(page.getByTestId('today-cycle-day')).toHaveText('25');
  await expect(page.getByTestId('today-headline')).toHaveText('Period in 4 days');
  await expect(page.getByTestId('today-phase')).toHaveText('Premenstrual');
  await expect(page.getByTestId('next-period')).toBeVisible();
});

test('data survives a reload', async ({ page }) => {
  await onboard(page, 10);
  await expect(page.getByTestId('today-cycle-day')).toHaveText('11');
  await page.reload();
  await expect(page.getByTestId('today-cycle-day')).toHaveText('11');
  await expect(page.getByTestId('today-phase')).toHaveText('Fertile window');
});

test('logging symptoms shows up on Today and in the calendar', async ({ page }) => {
  await onboard(page, 20);
  await page.getByTestId('log-today').click();
  await expect(page.getByTestId('log-sheet')).toBeVisible();
  await page.getByTestId('symptom-cramps').click();
  await page.getByTestId('mood-irritable').click();
  await page.getByTestId('energy-2').click();
  await page.getByTestId('notes-input').fill('Long day');
  await page.getByTestId('log-done').click();
  await expect(page.getByTestId('today-summary')).toContainText('Cramps');
  await expect(page.getByTestId('today-summary')).toContainText('Irritable');
  await expect(page.getByTestId('today-summary')).toContainText('Note: Long day');
  await page.getByTestId('tab-calendar').click();
  await page.getByTestId(`day-${iso(TODAY)}`).click();
  await expect(page.getByTestId('calendar-day-card')).toContainText('Symptoms: Cramps');
  await expect(page.getByTestId('calendar-day-card')).toContainText('Energy: Low');
});

test('period started button starts a new cycle and stats update', async ({ page }) => {
  await onboard(page, 27);
  await expect(page.getByTestId('today-cycle-day')).toHaveText('28');
  await page.getByTestId('period-start').click();
  await expect(page.getByTestId('today-headline')).toHaveText('Period day 1');
  await expect(page.getByTestId('today-cycle-day')).toHaveText('1');
  await page.getByTestId('tab-insights').click();
  await expect(page.getByTestId('stat-count')).toHaveText('1');
  await expect(page.getByTestId('stat-cycle')).toHaveText('27 d');
  await page.getByTestId('tab-today').click();
  await page.getByTestId('period-end').click();
  await expect(page.getByTestId('today-headline')).not.toHaveText('Period day 1');
});

test('period days can be edited on the calendar', async ({ page }) => {
  await onboard(page, 5);
  await page.getByTestId('tab-calendar').click();
  await page.getByTestId('edit-period').click();
  // Unmark the first two logged days so the period starts later.
  const first = daysAgo(5);
  const second = daysAgo(4);
  await goToMonth(page, first);
  await page.getByTestId(`day-${iso(first)}`).click();
  await goToMonth(page, second);
  await page.getByTestId(`day-${iso(second)}`).click();
  await page.getByTestId('edit-save').click();
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('today-cycle-day')).toHaveText('4');
  // Future days cannot be marked.
  await page.getByTestId('tab-calendar').click();
  await page.getByTestId('edit-period').click();
  const tomorrow = new Date(TODAY);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getMonth() === TODAY.getMonth()) {
    await page.getByTestId(`day-${iso(tomorrow)}`).click();
  }
  await page.getByTestId('edit-save').click();
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('today-cycle-day')).toHaveText('4');
});

test('hormonal birth control hides fertility predictions', async ({ page }) => {
  await onboard(page, 12);
  await expect(page.getByTestId('today-phase')).toHaveText('Fertile window');
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-goal-birthcontrol').click();
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('today-phase')).toHaveText('Follicular phase');
  await expect(page.getByTestId('today-headline')).toHaveText('Period in 16 days');
});

test('trackers can be hidden and custom tags added', async ({ page }) => {
  await onboard(page, 3);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-trackers').click();
  await page.getByTestId('tracker-moods').click();
  await page.getByTestId('tracker-tags').click();
  await page.getByTestId('tab-today').click();
  await page.getByTestId('log-today').click();
  await expect(page.getByTestId('log-section-moods')).toHaveCount(0);
  await page.getByTestId('new-tag').fill('Migraine trigger');
  await page.getByTestId('add-tag').click();
  await expect(page.getByTestId('tag-Migraine trigger')).toBeVisible();
  await page.getByTestId('log-done').click();
  await expect(page.getByTestId('today-summary')).toBeVisible();
});

test('basal temperature is stored and unit conversion works', async ({ page }) => {
  await onboard(page, 8);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-trackers').click();
  await page.getByTestId('tracker-bbt').click();
  await page.getByTestId('tab-today').click();
  await page.getByTestId('log-today').click();
  await page.getByTestId('bbt-input').fill('36.65');
  await page.getByTestId('bbt-save').click();
  await expect(page.getByTestId('bbt-saved')).toContainText('36.65 °C');
  await page.getByTestId('log-done').click();
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-cycle').click();
  await page.getByTestId('theme-dark').click();
  await page.getByText('°F').click();
  await page.getByTestId('tab-today').click();
  await page.getByTestId('log-today').click();
  await expect(page.getByTestId('bbt-saved')).toContainText('97.97 °F');
});

test('export produces a JSON backup and delete wipes everything', async ({ page }) => {
  await onboard(page, 2);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-data').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^ebb-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const json = JSON.parse(await fs.readFile(path as string, 'utf8'));
  expect(json.app).toBe('Ebb');
  expect(Object.keys(json.logs).length).toBeGreaterThan(0);
  page.on('dialog', (d) => d.accept());
  await page.getByTestId('delete-all').click();
  await expect(page.getByTestId('onboarding-start')).toBeVisible();
});

test('pain, impact and explicit symptom-free days persist and appear in the appointment export', async ({ page }) => {
  await onboard(page, 21);
  await page.getByTestId('log-today').click();
  await page.getByTestId('symptom-none').click();
  await page.getByTestId('pain-7').click();
  await page.getByTestId('impact-missed_activities').click();
  await page.getByTestId('log-done').click();
  await page.reload();
  await expect(page.getByTestId('today-summary')).toContainText('Pain: 7/10');
  await page.getByTestId('log-today').click();
  await expect(page.getByTestId('symptom-none')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('pain-7')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('log-done').click();
  await page.getByTestId('tab-insights').click();
  await page.getByTestId('report-preview').click();
  await expect(page.getByTestId('appointment-summary')).toContainText('Days with missed activities: 1');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('report-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^ebb-appointment-.*\.txt$/);
  const fs = await import('node:fs/promises');
  const text = await fs.readFile((await download.path())!, 'utf8');
  expect(text).toContain('highest 7/10');
});

test('web health screen truthfully disables native sync and explains device support', async ({ page }) => {
  await onboard(page, 21);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-health').click();
  await expect(page.getByTestId('health-sync')).toBeDisabled();
  await expect(page.getByTestId('health-connections')).toContainText('browser preview cannot access');
  await expect(page.getByTestId('health-connections')).toContainText('Wear OS');
});

test('phone and tablet layouts retain reachable actions without horizontal overflow', async ({ page }) => {
  await onboard(page, 21);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByTestId('log-today')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByTestId('log-today').click();
    await expect(page.getByTestId('log-done')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByTestId('log-done').click();
  }
});

test('a health snapshot survives reload, is backed up, and can be removed without altering manual logs', async ({ page }) => {
  await onboard(page, 21);
  // Synthetic fixture in the isolated test browser only; no real health data.
  await page.evaluate((date) => {
    const data = JSON.parse(localStorage.getItem('ebb.data.v1')!);
    data.logs[date] = { date, sleepHours: 6, notes: 'Keep my diary' };
    data.health = { provider: 'apple-health', syncedAt: new Date().toISOString(), days: { [date]: { date, sleepHours: 8, restingHeartRate: 62 } } };
    localStorage.setItem('ebb.data.v1', JSON.stringify(data));
  }, iso(TODAY));
  await page.reload();
  await expect(page.getByTestId('today-health')).toContainText('8.0 h');
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-data').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const fs = await import('node:fs/promises');
  const backup = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  expect(backup.health.days[iso(TODAY)].restingHeartRate).toBe(62);
  expect(backup.logs[iso(TODAY)].sleepHours).toBe(6);
  await page.getByTestId('settings-tab-health').click();
  await page.getByTestId('health-remove').click();
  await page.reload();
  await expect(page.getByTestId('today-health')).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ebb.data.v1')!));
  expect(stored.health).toBeUndefined();
  expect(stored.logs[iso(TODAY)].notes).toBe('Keep my diary');
});

test('food and movement guidance explores the month and responds to today’s energy', async ({ page }) => {
  await onboard(page, 1);
  await page.getByTestId('open-cycle-care').click();
  await expect(page.getByTestId('care-guide-title')).toHaveText('Comfort & nourishment');
  for (const [stage, title] of [['follicular', 'Build a rhythm that fits'], ['ovulation', 'Stay with your own pace'], ['luteal', 'Make room for what you need'], ['everyday', 'Nourish your everyday']]) {
    await page.getByTestId(`care-stage-${stage}`).click();
    await expect(page.getByTestId('care-guide-title')).toHaveText(title!);
  }
  await page.getByTestId('cycle-care-sheet-done').click();
  await page.getByTestId('log-today').click();
  await page.getByTestId('energy-2').click();
  await page.getByTestId('log-done').click();
  await expect(page.getByTestId('care-today-movement')).toContainText('An easier option today');
  await page.reload();
  await expect(page.getByTestId('care-today-movement')).toContainText('An easier option today');
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-food-ai').click();
  await expect(page.getByTestId('models-native-only')).toBeVisible();
  await expect(page.getByTestId('model-e2b')).toContainText('2.59 GB');
  await expect(page.getByTestId('model-e4b')).toContainText('3.66 GB');
  await expect(page.getByTestId('download-e2b')).toBeDisabled();
  await expect(page.getByTestId('download-e4b')).toBeDisabled();
});

test('meal review requires confirmation, keeps estimates editable and persists optional nutrition', async ({ page }) => {
  await onboard(page, 12);
  await page.getByTestId('tab-food').click();
  await page.getByTestId('meal-show-calories').click();
  await page.getByTestId('meal-manual').click();
  await expect(page.getByTestId('meal-save')).toBeDisabled();
  await page.getByTestId('meal-dish').fill('Chickpea curry with rice');
  await page.getByTestId('meal-weight').fill('450');
  await page.getByTestId('meal-add-ingredient').click();
  await page.getByTestId('meal-ingredient-0').fill('Chickpeas');
  await page.getByTestId('meal-ingredient-grams-0').fill('150');
  await page.getByTestId('meal-nutrition-toggle').click();
  await page.getByTestId('meal-protein').fill('18');
  await page.getByTestId('meal-kcal').fill('520');
  await page.getByTestId('meal-confirmed').click();
  await page.getByTestId('meal-weight').fill('-10');
  await expect(page.getByTestId('meal-confirmed')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('meal-save')).toBeDisabled();
  await page.getByTestId('meal-weight').fill('425');
  await page.getByTestId('meal-confirmed').click();
  await page.getByTestId('meal-save').click();
  await expect(page.getByTestId('meal-sheet')).not.toBeVisible();
  await expect(page.getByTestId('food-screen')).toContainText('Approximately 425 g');
  await expect(page.getByTestId('meal-calories')).toHaveText('Calories · 520 kcal');
  await page.getByTestId('meal-show-calories').click();
  await expect(page.getByTestId('meal-calories')).toHaveCount(0);
  await page.reload();
  await page.getByTestId('tab-food').click();
  await expect(page.getByTestId('food-screen')).toContainText('Chickpea curry with rice');
  await expect(page.getByTestId('food-screen')).toContainText('Protein · 18 g');
  await expect(page.getByTestId('meal-calories')).toHaveCount(0);
  const meals = await page.evaluate(() => JSON.parse(localStorage.getItem('ebb.data.v1')!).meals);
  expect(meals).toHaveLength(1);
  expect(meals[0].userConfirmed).toBe(true);
  expect(meals[0].photoFile).toBeUndefined();
  await page.getByTestId(`meal-edit-${meals[0].id}`).click();
  await page.getByTestId('meal-dish').fill('Homemade curry');
  await page.getByTestId('meal-confirmed').click();
  await page.getByTestId('meal-save').click();
  await expect(page.getByTestId('food-screen')).toContainText('Homemade curry');
  await page.getByTestId('food-prev-day').click();
  await expect(page.getByTestId('food-screen')).not.toContainText('Homemade curry');
  await page.getByTestId('food-next-day').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId(`meal-delete-${meals[0].id}`).click();
  await expect(page.getByTestId(`meal-entry-${meals[0].id}`)).toHaveCount(0);
});

test('retained meal photos can switch to data only and meal backup excludes photos', async ({ page }) => {
  await onboard(page, 12);
  await page.evaluate(({ date }) => {
    const data = JSON.parse(localStorage.getItem('ebb.data.v1')!);
    data.meals = [{ id: 'meal-retention-test', date, createdAt: new Date().toISOString(), dish: 'Soup', ingredients: [{ name: 'Lentils' }], userConfirmed: true, source: 'ai', model: 'e2b', photoFile: 'meal-soup.jpg' }];
    localStorage.setItem('ebb.data.v1', JSON.stringify(data));
  }, { date: iso(TODAY) });
  await page.reload();
  await page.getByTestId('tab-food').click();
  await page.getByTestId('meal-edit-meal-retention-test').click();
  await expect(page.getByTestId('meal-keep-photo')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('meal-sheet')).toContainText('Uses extra phone storage');
  await page.getByTestId('meal-data-only').click();
  await page.getByTestId('meal-confirmed').click();
  await page.getByTestId('meal-save').click();
  await expect(page.getByTestId('food-screen')).toContainText('Data only');
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-data').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-json').click();
  const file = await download;
  const stream = await file.createReadStream();
  let raw = '';
  for await (const chunk of stream!) raw += chunk.toString();
  const backup = JSON.parse(raw);
  expect(backup.meals).toHaveLength(1);
  expect(backup.meals[0].dish).toBe('Soup');
  expect(backup.meals[0].photoFile).toBeUndefined();
  expect(backup.mealPhotosIncluded).toBe(false);
});

test('an unreadable saved diary is preserved instead of reset', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('ebb.data.v1', '{broken-json'));
  await page.reload();
  await expect(page.getByTestId('diary-load-error')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ebb.data.v1'))).toBe('{broken-json');
  await page.getByTestId('diary-retry').click();
  await expect(page.getByTestId('diary-load-error')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ebb.data.v1'))).toBe('{broken-json');
});

test('a Flo export can be imported during onboarding and drives predictions', async ({ page }) => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const template = await fs.readFile(path.join(__dirname, '..', 'fixtures', 'flo-export.json'), 'utf8');
  // Three 28-day cycles ending 12 days ago, so today is cycle day 13.
  const c3 = daysAgo(12);
  const c2 = daysAgo(40);
  const c1 = daysAgo(68);
  const end = (d: Date) => { const e = new Date(d); e.setDate(e.getDate() + 4); return e; };
  const e1 = daysAgo(14);
  const e2 = daysAgo(26);
  const json = template
    .replace('__C1__', iso(c1)).replace('__C1E__', iso(end(c1)))
    .replace('__C2__', iso(c2)).replace('__C2E__', iso(end(c2)))
    .replace('__C3__', iso(c3)).replace('__C3E__', iso(end(c3)))
    .replaceAll('__E1__', iso(e1)).replaceAll('__E2__', iso(e2));

  await page.goto('/');
  await page.getByTestId('onboarding-import').click();
  await expect(page.getByTestId('import-sheet')).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('import-flo-file').click(),
  ]);
  await chooser.setFiles({ name: 'flo.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.getByTestId('import-preview')).toBeVisible();
  await expect(page.getByTestId('import-preview')).toContainText('15');
  await expect(page.getByTestId('import-preview')).toContainText('Sparkly toes');
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('onboarding-imported')).toContainText('15 with bleeding');
  await page.getByTestId('goal-track').click();
  await page.getByTestId('onboarding-next-1').click();
  // With imported periods the last-period step is skipped.
  await page.getByTestId('onboarding-next-2').click();
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await expect(page.getByTestId('today-cycle-day')).toHaveText('13');
  await page.getByTestId('tab-insights').click();
  await expect(page.getByTestId('stat-count')).toHaveText('2');
  await expect(page.getByTestId('stat-cycle')).toHaveText('28 d');
  await page.getByTestId('tab-calendar').click();
  await page.getByTestId(`day-${iso(e1)}`).click();
  await expect(page.getByTestId('calendar-day-card')).toContainText('Symptoms: Cramps');
  await expect(page.getByTestId('calendar-day-card')).toContainText('Mood: Irritable');
});

test('import is also reachable from Settings and merges with existing entries', async ({ page }) => {
  await onboard(page, 3);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('settings-tab-data').click();
  await page.getByTestId('open-import').click();
  await expect(page.getByTestId('import-sheet')).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('import-flo-file').click(),
  ]);
  await chooser.setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some text') });
  await expect(page.getByTestId('import-error')).toContainText('does not look like a Flo export');
});
