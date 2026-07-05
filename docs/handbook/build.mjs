// BloomPro Studio User Handbook build: HTML -> Chromium PDF (two-pass for TOC page numbers).
// Usage: node docs/handbook/build.mjs [--pass2]
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const p1 = fs.readFileSync(path.join(dir, 'handbook-part1.html'), 'utf8');
const p2 = fs.readFileSync(path.join(dir, 'handbook-part2.html'), 'utf8');
let html = p1.replace('</body></html>', '') + p2 + '\n</body></html>';

// Pass 2: substitute TOC page-number tokens discovered by postprocess.py
const pagesFile = path.join(dir, 'chapter-pages.json');
if (fs.existsSync(pagesFile)) {
  const pages = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
  for (const [id, pg] of Object.entries(pages)) html = html.replaceAll(`§${id}§`, String(pg));
}
html = html.replace(/§ch\d+§/g, '·'); // any unresolved tokens (pass 1)

fs.writeFileSync(path.join(dir, 'handbook.html'), html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(dir, 'handbook.html').replace(/\\/g, '/'));
await page.waitForTimeout(1200); // let images settle

// Cover: full-bleed, no running header/footer.
await page.pdf({
  path: path.join(dir, 'cover.pdf'),
  format: 'Letter', printBackground: true, pageRanges: '1',
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});
// Body: pages 2+ with running header/footer (absolute page numbers preserved).
await page.pdf({
  path: path.join(dir, 'body.pdf'),
  format: 'Letter', printBackground: true, pageRanges: '2-1000',
  displayHeaderFooter: true,
  margin: { top: '0.55in', bottom: '0.6in', left: '0', right: '0' },
  headerTemplate: `<div style="width:100%;font-size:7.5px;color:#8a9a8e;font-family:'Segoe UI',Arial,sans-serif;padding:14px 0.85in 0;display:flex;justify-content:space-between;">
      <span>BLOOMPRO STUDIO</span><span>USER HANDBOOK · 2026 EDITION</span></div>`,
  footerTemplate: `<div style="width:100%;font-size:7.5px;color:#8a9a8e;font-family:'Segoe UI',Arial,sans-serif;padding:0 0.85in 12px;display:flex;justify-content:space-between;">
      <span>© 2026 AF Strategic Technologies LLC</span><span class="pageNumber"></span></div>`,
});
await browser.close();
console.log('cover + body rendered.');
