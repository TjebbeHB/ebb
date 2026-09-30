// Captures phone-sized screenshots of the web preview for the GitHub Pages site.
// Uses synthetic diary data only. Start the preview first: npm run web -- --port 8081
//   node scripts/capture_site_screenshots.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.EBB_URL ?? 'http://localhost:8081';
const OUT = 'docs/images';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

function syntheticData() {
  const logs = {};
  const put = (date, patch) => { logs[date] = { ...(logs[date] ?? { date }), ...patch, date }; };
  // Six past cycles of 27–29 days; today is cycle day 18.
  const starts = [17, 45, 74, 101, 130, 158];
  const flows = ['heavy', 'medium', 'medium', 'light', 'light'];
  starts.forEach((s, i) => {
    flows.forEach((flow, k) => put(ago(s - k), { flow }));
    put(ago(s), { symptoms: ['cramps', 'fatigue'], pain: 6, energy: 2, moods: ['sensitive'] });
    put(ago(s - 1), { symptoms: ['cramps'], pain: 4, energy: 3 });
    const prev = starts[i - 1];
    if (prev !== undefined) {
      put(ago(prev + 2), { symptoms: ['bloating', 'breast_tenderness'], moods: ['irritable'], energy: 3 });
      put(ago(prev + 1), { symptoms: ['bloating', 'cravings'], moods: ['tearful'] });
    }
  });
  for (let n = 1; n < 17; n += 1) {
    if (n % 3 === 0) put(ago(n), { energy: n > 6 ? 4 : 3, sleepHours: 7 + (n % 2) * 0.5, sleepQuality: 'good' });
  }
  put(ago(4), { mucus: 'eggwhite', moods: ['energetic', 'confident'] });
  put(ago(2), { exercise: ['running'], moods: ['happy'] });
  put(ago(0), { moods: ['calm'], energy: 4, sleepHours: 7.5, sleepQuality: 'good', notes: 'Good run this morning.' });
  return {
    version: 1,
    logs,
    settings: {
      onboarded: true, goal: 'track', birthControl: 'none', theme: 'light',
      defaultCycleLength: 28, defaultPeriodLength: 5, lutealLength: 14,
      enabledCategories: ['flow', 'symptoms', 'moods', 'pain', 'energy', 'sleep', 'sex', 'discharge', 'notes'],
    },
  };
}

const browser = await chromium.launch();
async function shoot(theme, steps) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  const data = syntheticData();
  data.settings.theme = theme;
  await page.addInitScript((json) => { if (!localStorage.getItem('ebb.data.v1')) localStorage.setItem('ebb.data.v1', json); }, JSON.stringify(data));
  await page.goto(BASE);
  await page.getByTestId('today-screen').waitFor();
  await page.waitForTimeout(800);
  for (const [name, action] of steps) {
    await action(page);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('wrote', name);
  }
  await ctx.close();
}

await shoot('light', [
  ['screen-today', async () => {}],
  ['screen-calendar', async (p) => { await p.getByTestId('tab-calendar').click(); }],
  ['screen-insights', async (p) => { await p.getByTestId('tab-insights').click(); }],
  ['screen-log', async (p) => { await p.getByTestId('tab-today').click(); await p.getByTestId('log-today').click(); await p.getByTestId('log-sheet').waitFor(); }],
]);
await shoot('dark', [['screen-today-dark', async () => {}]]);
await browser.close();
