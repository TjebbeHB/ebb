// Renders docs/images/og.png (1200×630), the link preview for the project site.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const shot = readFileSync('docs/images/screen-today.png').toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">
<style>
body{margin:0;width:1200px;height:630px;background:#FFF8E9;font-family:'DM Sans',sans-serif;color:#35291F;overflow:hidden;position:relative}
.ring{position:absolute;right:-60px;top:-40px;width:720px;height:720px;border-radius:50%;border:34px solid #F4E5D1}
.arc{position:absolute;right:-60px;top:-40px;width:720px;height:720px;border-radius:50%;border:34px solid transparent;border-top-color:#C64C0C;transform:rotate(20deg)}
.phone{position:absolute;right:150px;top:70px;width:270px;height:584px;border-radius:44px;padding:10px;background:linear-gradient(145deg,#3a2e25,#16110d);box-shadow:0 30px 70px rgba(53,41,31,.25)}
.phone img{width:100%;height:100%;border-radius:34px;object-fit:cover;object-position:top}
.copy{position:absolute;left:80px;top:120px;width:560px}
.mark{font:400 64px/1 'DM Serif Display';color:#C64C0C;letter-spacing:-3px}
h1{font:400 76px/1.02 'DM Serif Display';margin:28px 0 22px;letter-spacing:-1.5px}
h1 em{color:#C64C0C}
p{font-size:26px;color:#786550;margin:0;line-height:1.4}
.tags{display:flex;gap:10px;margin-top:34px}
.tags span{padding:10px 18px;border-radius:999px;border:1px solid #DDC8AE;background:#FCF0DF;font-weight:600;font-size:18px}
</style></head><body>
<div class="ring"></div><div class="arc"></div>
<div class="phone"><img src="data:image/png;base64,${shot}"></div>
<div class="copy"><div class="mark">ebb</div><h1>Your cycle,<br><em>on your terms.</em></h1><p>A free, open-source cycle tracker.<br>Your diary stays on your phone.</p>
<div class="tags"><span>No account</span><span>No ads</span><span>MIT licensed</span></div></div>
</body></html>`, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'docs/images/og.png' });
await browser.close();
console.log('wrote docs/images/og.png');
