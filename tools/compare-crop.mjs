/**
 * Build a zoomed before/after comparison sheet from the two canvas screenshots.
 * Usage: node tools/compare-crop.mjs <before.png> <after.png> <out.png>
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [beforePath, afterPath, outPath] = process.argv.slice(2);
const toDataUrl = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

/* Nail band of the 578x574 canvas capture, zoomed so the free edge is readable. */
const CROP = { x: 40, y: 100, w: 500, h: 215 };
const ZOOM = 2.4;

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; background:#111; font:600 20px/1.4 -apple-system,'PingFang SC',sans-serif; color:#fff; }
  .row { padding:10px 14px 16px; }
  .tag { margin-bottom:8px; }
  .bad { color:#ff6b6b; }
  .good { color:#5dd39e; }
  .win { width:${CROP.w * ZOOM}px; height:${CROP.h * ZOOM}px; overflow:hidden; position:relative; border-radius:8px; }
  .win img { position:absolute; left:${-CROP.x * ZOOM}px; top:${-CROP.y * ZOOM}px;
             width:${578 * ZOOM}px; image-rendering:auto; }
</style>
<div class="row"><div class="tag bad">修复前 referenceLengthMm=18 —— 甲片缩到线稿甲床的 78%，甲尖轮廓露在外面</div>
  <div class="win"><img src="${toDataUrl(beforePath)}"></div></div>
<div class="row"><div class="tag good">修复后 referenceLengthMm=14 —— 甲片盖满线稿，甲尖对齐自由缘</div>
  <div class="win"><img src="${toDataUrl(afterPath)}"></div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.round(CROP.w * ZOOM) + 28, height: 200 }, deviceScaleFactor: 1 });
await page.setContent(html);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);
