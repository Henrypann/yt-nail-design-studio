/**
 * Measure the drawn nail geometry on the approved back line-art plate.
 * Reports, per slot: ink strokes along the root→tip axis (cuticle + free edge)
 * and lateral half-width of the drawn bed at several v positions.
 *
 * Diagnostic only; writes nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PLATE = path.join(ROOT, 'assets/visual-plates/back/back-line-art-approved-v1.png');
const SLOTS = path.join(ROOT, 'assets/nail-slots/slots.back.v2.json');

const slotsFile = JSON.parse(fs.readFileSync(SLOTS, 'utf8'));
const plateDataUrl = `data:image/png;base64,${fs.readFileSync(PLATE).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

const result = await page.evaluate(
  async ({ dataUrl, slots, W, H }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.getElementById('c');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;

    // Perceptual luminance; the plate is light with dark line art.
    const lum = (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 255;
      const i = (yi * W + xi) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    // Background is a soft gradient, so use a local threshold rather than absolute.
    const INK = 200;

    const out = [];
    for (const s of slots) {
      const rc = { x: (s.rootLeft.x + s.rootRight.x) / 2, y: (s.rootLeft.y + s.rootRight.y) / 2 };
      const ax = s.tipCenter.x - rc.x;
      const ay = s.tipCenter.y - rc.y;
      const L = Math.hypot(ax, ay);
      const ux = ax / L;
      const uy = ay / L; // root → tip unit
      const nx = -uy;
      const ny = ux; // lateral unit

      // Walk the axis from behind the root out to 2.2x the calibrated length.
      const axis = [];
      for (let t = -0.35; t <= 2.2; t += 0.005) {
        const d = t * L;
        axis.push({ t, v: lum(rc.x + ux * d, rc.y + uy * d) });
      }
      // Group contiguous ink runs into strokes.
      const strokes = [];
      let run = null;
      for (const p of axis) {
        if (p.v < INK) {
          if (!run) run = { from: p.t, to: p.t, min: p.v };
          else {
            run.to = p.t;
            run.min = Math.min(run.min, p.v);
          }
        } else if (run) {
          strokes.push(run);
          run = null;
        }
      }
      if (run) strokes.push(run);

      // Lateral half-width of drawn ink at a few v positions along the nail.
      const lateral = {};
      for (const t of [0.15, 0.3, 0.5, 0.7, 0.85, 1.0]) {
        const px = rc.x + ux * (t * L);
        const py = rc.y + uy * (t * L);
        const scan = (sign) => {
          for (let r = 1; r <= 60; r += 0.5) {
            if (lum(px + nx * sign * r, py + ny * sign * r) < INK) return r;
          }
          return null;
        };
        lateral[t] = { left: scan(-1), right: scan(1) };
      }

      out.push({
        id: s.fingerCode,
        calibratedLengthPx: Number(L.toFixed(2)),
        nailBedWidthPx: s.nailBedWidthPx,
        slotHalfWidthPx: Number((s.nailBedWidthPx / 2).toFixed(2)),
        axisStrokes: strokes
          .filter((r) => r.to > 0.15)
          .map((r) => ({
            centerT: Number(((r.from + r.to) / 2).toFixed(3)),
            fromT: Number(r.from.toFixed(3)),
            toT: Number(r.to.toFixed(3)),
            darkest: Math.round(r.min),
          })),
        lateral,
      });
    }
    return out;
  },
  { dataUrl: plateDataUrl, slots: slotsFile.slots, W: slotsFile.plate.sourceWidth, H: slotsFile.plate.sourceHeight },
);

await browser.close();

console.log('=== Axis ink strokes (t in units of calibrated visibleLengthPx from root) ===');
for (const r of result) {
  const st = r.axisStrokes.map((s) => `t=${s.centerT}[${s.fromT}..${s.toT}] L${s.darkest}`).join('  ');
  console.log(`${r.id.padEnd(3)} L=${String(r.calibratedLengthPx).padStart(6)}px  ${st}`);
}

console.log('\n=== Lateral drawn half-width vs slot half-width (px) ===');
for (const r of result) {
  const cells = Object.entries(r.lateral)
    .map(([t, v]) => {
      const l = v.left == null ? '--' : v.left.toFixed(1);
      const rr = v.right == null ? '--' : v.right.toFixed(1);
      return `t${t}:${l}/${rr}`;
    })
    .join(' ');
  console.log(`${r.id.padEnd(3)} slotHalf=${String(r.slotHalfWidthPx).padStart(5)}  ${cells}`);
}

console.log('\n=== Rendered tip position t at each product length (reference=18) ===');
for (const mm of [14, 18, 22, 26]) {
  console.log(`  ${mm}mm → t = ${(mm / 18).toFixed(3)}`);
}
