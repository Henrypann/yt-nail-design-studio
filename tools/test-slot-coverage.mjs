/**
 * Regression gate for NailSlot V2 length projection.
 *
 * The plate line art draws a bare natural nail. If `referenceLengthMm` is wrong
 * or missing, every length silently retracts the rendered nail inside the drawn
 * nail bed (or overshoots it), which looks like a rendering defect. This test
 * measures the drawn free edge straight off the approved plate and asserts the
 * rendered tip reaches it at every product length.
 *
 * Usage: npm run test:slot-coverage
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PLATE = path.join(ROOT, 'assets/visual-plates/back/back-line-art-approved-v1.png');
const SLOTS = path.join(ROOT, 'assets/nail-slots/slots.back.v2.json');

/** Per-finger slack for hand-placed landmarks vs hand-drawn line art. */
const TIP_GAP_TOLERANCE_PX = 6;
const INK = 200;

const slotsFile = JSON.parse(fs.readFileSync(SLOTS, 'utf8'));
const failures = [];

if (!slotsFile.referenceLengthMm) {
  failures.push('slots.back.v2.json 缺少 referenceLengthMm（线稿甲代表的物理长度必须显式标定）');
}
const referenceLengthMm = slotsFile.referenceLengthMm;
const LENGTHS = [14, 18, 22, 26];
if (referenceLengthMm && referenceLengthMm !== Math.min(...LENGTHS)) {
  failures.push(
    `referenceLengthMm=${referenceLengthMm}：线稿画的是裸甲，应等于最短档 ${Math.min(...LENGTHS)}mm，` +
      '否则最短档会缩进线稿甲床内',
  );
}

const W = slotsFile.plate.sourceWidth;
const H = slotsFile.plate.sourceHeight;
const plateDataUrl = `data:image/png;base64,${fs.readFileSync(PLATE).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.setContent('<canvas id="c"></canvas>');

const edges = await page.evaluate(
  async ({ dataUrl, slots, w, h, ink }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.getElementById('c');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    const lum = (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 255;
      const i = (yi * w + xi) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };
    return slots.map((s) => {
      const rc = { x: (s.rootLeft.x + s.rootRight.x) / 2, y: (s.rootLeft.y + s.rootRight.y) / 2 };
      const L = Math.hypot(s.tipCenter.x - rc.x, s.tipCenter.y - rc.y);
      const ux = (s.tipCenter.x - rc.x) / L;
      const uy = (s.tipCenter.y - rc.y) / L;
      let last = null;
      for (let t = 0.4; t <= 1.6; t += 0.005) {
        const x = rc.x + ux * (t * L);
        const y = rc.y + uy * (t * L);
        if (lum(x, y) < ink) last = t;
        else if (last !== null && t - last > 0.06) break;
      }
      return { finger: s.fingerCode, edgeT: last, lengthPx: L };
    });
  },
  { dataUrl: plateDataUrl, slots: slotsFile.slots, w: W, h: H, ink: INK },
);

await browser.close();

for (const e of edges) {
  if (e.edgeT == null) {
    failures.push(`${e.finger}: 线稿甲尖线未测到，无法校验覆盖`);
    continue;
  }
  for (const mm of LENGTHS) {
    const renderedTipT = mm / referenceLengthMm;
    const gapPx = (e.edgeT - renderedTipT) * e.lengthPx;
    if (gapPx > TIP_GAP_TOLERANCE_PX) {
      failures.push(
        `${e.finger} @ ${mm}mm: 甲尖短于线稿甲尖 ${gapPx.toFixed(1)}px（容差 ${TIP_GAP_TOLERANCE_PX}px）`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('test:slot-coverage FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const worst = Math.max(
  ...edges.flatMap((e) => LENGTHS.map((mm) => (e.edgeT - mm / referenceLengthMm) * e.lengthPx)),
);
console.log(
  `test:slot-coverage: PASS (10 fingers × ${LENGTHS.length} lengths, reference=${referenceLengthMm}mm, ` +
    `worst tip gap ${worst.toFixed(1)}px ≤ ${TIP_GAP_TOLERANCE_PX}px)`,
);
