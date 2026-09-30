// Renders the app icon set from inline SVG using Playwright's Chromium.
// Usage: node scripts/generate_icons.mjs
import { chromium } from '@playwright/test';

const ACCENT = '#C64C0C';
const BG = '#FFF8E9';

// A soft crescent "ebb" mark: a ring with a tide-like inner arc.
function mark(fill, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(512 512)">
    <circle r="300" fill="none" stroke="${fill}" stroke-width="86"/>
    <path d="M -300 20 C -180 -140 -40 -140 60 -40 C 160 60 260 60 300 -20" fill="none" stroke="${fill}" stroke-width="86" stroke-linecap="round"/>
    <circle cx="0" cy="-300" r="70" fill="${fill}"/>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const targets = [
  ['icon.png', BG, ACCENT, 1024, false],
  ['android-icon-foreground.png', 'transparent', ACCENT, 1024, true],
  ['android-icon-monochrome.png', 'transparent', '#000000', 1024, true],
  ['notification-icon.png', 'transparent', '#FFFFFF', 96, true],
  ['favicon.png', BG, ACCENT, 64, false],
  ['splash-icon.png', 'transparent', ACCENT, 512, true],
];
for (const [name, background, fill, size, transparent] of targets) {
  await page.setViewportSize({ width: size, height: size });
  // Adaptive icon foregrounds must keep content inside the inner 66%: scale down.
  const scale = name.startsWith('android') ? 0.62 : name === 'notification-icon.png' ? 0.9 : 1;
  await page.setContent(`<html><body style="margin:0;background:${background};display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px"><div style="width:${size * scale}px;height:${size * scale}px">${mark(fill, size * scale)}</div></body></html>`);
  await page.screenshot({ path: `assets/${name}`, omitBackground: transparent });
  console.log('wrote', name);
}
await browser.close();
