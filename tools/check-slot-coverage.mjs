/**
 * NailSlot V2 coverage harness.
 *
 * Composes the approved back plate + per-finger nail silhouettes with the SAME
 * transforms as BackPlatePreview (real slots modules, no duplicated math), then
 * measures how much of the plate's drawn nail line art is left uncovered.
 *
 * Outputs PNGs into dogfood-output/slot-coverage/ and prints a per-finger table.
 *
 * Usage:
 *   node --import ./tools/lib/register-node-vite.mjs --experimental-strip-types \
 *     tools/check-slot-coverage.mjs [shape]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dogfood-output/slot-coverage');
const PLATE = path.join(ROOT, 'assets/visual-plates/back/back-line-art-approved-v1.png');
const SLOTS = path.join(ROOT, 'assets/nail-slots/slots.back.v2.json');
const SIL_DIR = path.join(ROOT, 'material-library/shapes/silhouettes');

const shape = process.argv[2] ?? 'oval';
const LENGTH_IDS = { 14: 'short', 18: 'medium', 22: 'long', 26: 'extra-long' };

const slotsUrl = pathToFileURL(path.join(ROOT, 'src/studio/slots/index.ts')).href;
const slotsV2Url = pathToFileURL(path.join(ROOT, 'src/studio/render/slots-v2.ts')).href;
const { extendSlotToLengthMm } = await import(slotsUrl);
const { contentUvTransform } = await import(slotsV2Url);

const slotsFile = JSON.parse(fs.readFileSync(SLOTS, 'utf8'));
const shapeParams = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'material-library/shapes/shape-params.json'), 'utf8'),
);
const W = slotsFile.plate.sourceWidth;
const H = slotsFile.plate.sourceHeight;
const plateDataUrl = `data:image/png;base64,${fs.readFileSync(PLATE).toString('base64')}`;
const referenceLengthMm = slotsFile.referenceLengthMm;
if (!referenceLengthMm) throw new Error('slots.back.v2.json 缺少 referenceLengthMm');

function silhouetteD(shapeId, lengthId) {
  const file = path.join(SIL_DIR, `${shapeId}_${lengthId.replace('-', '_')}.svg`);
  const raw = fs.readFileSync(file, 'utf8');
  return raw.match(/<path d="([^"]+)"/)?.[1] ?? null;
}

function buildSvg(slots, d, widthMm, lengthMm, mode) {
  const uv = contentUvTransform(widthMm, lengthMm);
  const nails = slots
    .map(
      (s) =>
        `<g transform="matrix(${s.transform.join(' ')})"><g transform="${uv}">` +
        `<path d="${d}" fill="${mode === 'mask' ? '#000' : '#C9A2A2'}" ` +
        `stroke="${mode === 'mask' ? '#000' : '#6b5555'}" stroke-width="${mode === 'mask' ? 0 : 6}"/>` +
        `</g></g>`,
    )
    .join('');
  const plate =
    mode === 'mask'
      ? `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`
      : `<image href="${plateDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${plate}${nails}</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

async function rasterize(svg, outPath) {
  const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden}img{display:block;width:${W}px;height:${H}px}</style></head><body><img id="i" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"/></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const i = document.querySelector('#i');
    return i && i.complete && i.naturalWidth > 1;
  });
  if (outPath) await page.screenshot({ path: outPath });
  return page.evaluate(
    async ({ w, h }) => {
      const img = document.querySelector('#i');
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(0, 0, w, h).data);
    },
    { w: W, h: H },
  );
}

async function rasterizeTo(svg, outPath, w, h) {
  const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden}img{display:block;width:${w}px;height:${h}px}</style></head><body><img id="i" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"/></body></html>`;
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const i = document.querySelector('#i');
    return i && i.complete && i.naturalWidth > 1;
  });
  await page.screenshot({ path: outPath });
  await page.setViewportSize({ width: W, height: H });
}

const plateOnly = await rasterize(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><image href="${plateDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/></svg>`,
  path.join(OUT, 'plate-only.png'),
);

const lum = (data, x, y) => {
  const i = (y * W + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
};

/** Where the plate's drawn free edge sits, in units of the calibrated tip distance. */
function drawnFreeEdgeT(slot) {
  const rc = { x: (slot.rootLeft.x + slot.rootRight.x) / 2, y: (slot.rootLeft.y + slot.rootRight.y) / 2 };
  const L = Math.hypot(slot.tipCenter.x - rc.x, slot.tipCenter.y - rc.y);
  const ux = (slot.tipCenter.x - rc.x) / L;
  const uy = (slot.tipCenter.y - rc.y) / L;
  let last = null;
  for (let t = 0.4; t <= 1.6; t += 0.005) {
    const x = Math.round(rc.x + ux * (t * L));
    const y = Math.round(rc.y + uy * (t * L));
    if (x < 0 || y < 0 || x >= W || y >= H) break;
    if (lum(plateOnly, x, y) < 200) last = t;
    else if (last !== null && t - last > 0.06) break; // stroke ended
  }
  return { t: last, L };
}

const freeEdge = new Map(slotsFile.slots.map((s) => [s.fingerCode, drawnFreeEdgeT(s)]));

const exposedPixels = new Map();
const rows = [];
for (const mm of [14, 18, 22, 26]) {
  const lengthId = LENGTH_IDS[mm];
  const d = silhouetteD(shape, lengthId);
  if (!d) throw new Error(`missing silhouette ${shape}_${lengthId}`);
  const widthMm = shapeParams.lengths[lengthId].widthMm;
  const slots = slotsFile.slots.map((s) => extendSlotToLengthMm(s, mm, referenceLengthMm));

  await rasterize(buildSvg(slots, d, widthMm, mm, 'view'), path.join(OUT, `${shape}-${mm}mm-composite.png`));
  const mask = await rasterize(buildSvg(slots, d, widthMm, mm, 'mask'), null);

  for (const s of slots) {
    const rc = { x: (s.rootLeft.x + s.rootRight.x) / 2, y: (s.rootLeft.y + s.rootRight.y) / 2 };
    const orig = slotsFile.slots.find((o) => o.fingerCode === s.fingerCode);
    const ax = orig.tipCenter.x - rc.x;
    const ay = orig.tipCenter.y - rc.y;
    const L = Math.hypot(ax, ay);
    const ux = ax / L;
    const uy = ay / L;
    const nx = -uy;
    const ny = ux;
    const halfW = orig.nailBedWidthPx / 2;

    // Region of interest: inside the drawn nail bed only. Staying within the slot
    // half-width keeps the finger contour (which the nail must NOT cover) out.
    let inkTotal = 0;
    let inkExposed = 0;
    for (let t = 0.05; t <= 1.08; t += 0.01) {
      for (let r = -halfW * 0.9; r <= halfW * 0.9; r += 0.5) {
        const x = Math.round(rc.x + ux * (t * L) + nx * r);
        const y = Math.round(rc.y + uy * (t * L) + ny * r);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (lum(plateOnly, x, y) >= 200) continue; // not line art
        inkTotal += 1;
        if (lum(mask, x, y) >= 128) {
          inkExposed += 1; // still white ⇒ nail did not cover it
          if (!exposedPixels.has(mm)) exposedPixels.set(mm, []);
          exposedPixels.get(mm).push([x, y]);
        }
      }
    }
    // Tip gap: how far the drawn free edge sits beyond the rendered nail tip.
    // Positive = drawn outline left exposed past the nail.
    const fe = freeEdge.get(s.fingerCode);
    const renderedTipT = mm / referenceLengthMm;
    const tipGapPx = fe.t == null ? null : Number(((fe.t - renderedTipT) * fe.L).toFixed(1));

    rows.push({
      mm,
      finger: s.fingerCode,
      inkTotal,
      inkExposed,
      exposedPct: inkTotal ? Math.round((inkExposed / inkTotal) * 100) : 0,
      tipGapPx,
    });
  }
}

// Diagnostic: mark exposed line art in red, zoomed on the left-hand fingers.
for (const mm of [14, 18]) {
  const pts = exposedPixels.get(mm) ?? [];
  const dots = pts
    .filter((_, i) => i % 3 === 0)
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1.6" height="1.6" fill="#FF0000"/>`)
    .join('');
  const lengthId = LENGTH_IDS[mm];
  const d = silhouetteD(shape, lengthId);
  const widthMm = shapeParams.lengths[lengthId].widthMm;
  const slots = slotsFile.slots.map((s) => extendSlotToLengthMm(s, mm, referenceLengthMm));
  const base = buildSvg(slots, d, widthMm, mm, 'view').replace('</svg>', `${dots}</svg>`);
  // Zoom on L5..L2 (drawn nail beds) so single-pixel exposure is visible.
  const zoom = base.replace(`viewBox="0 0 ${W} ${H}"`, 'viewBox="110 90 380 230"').replace(
    `width="${W}" height="${H}" v`,
    `width="1140" height="690" v`,
  );
  await rasterizeTo(zoom, path.join(OUT, `${shape}-${mm}mm-exposed-zoom.png`), 1140, 690);
}

await browser.close();

const fingers = [...new Set(rows.map((r) => r.finger))];
console.log(`shape=${shape}  referenceLengthMm=${referenceLengthMm}`);
console.log(`\n=== Exposed drawn-nail line art, % of ink inside the nail bed ===`);
console.log(`len  ${fingers.map((f) => f.padStart(5)).join('')}   worst`);
for (const mm of [14, 18, 22, 26]) {
  const sub = fingers.map((f) => rows.find((r) => r.mm === mm && r.finger === f));
  const worst = Math.max(...sub.map((r) => r.exposedPct));
  console.log(
    `${String(mm).padStart(2)}mm ${sub.map((r) => `${String(r.exposedPct).padStart(4)}%`).join('')}   ${worst}%`,
  );
}
console.log(`\n=== Tip gap px (drawn free edge beyond rendered tip; >0 = outline exposed) ===`);
console.log(`len  ${fingers.map((f) => f.padStart(6)).join('')}   worst`);
for (const mm of [14, 18, 22, 26]) {
  const sub = fingers.map((f) => rows.find((r) => r.mm === mm && r.finger === f));
  const worst = Math.max(...sub.map((r) => r.tipGapPx ?? -999));
  console.log(
    `${String(mm).padStart(2)}mm ${sub.map((r) => String(r.tipGapPx ?? '--').padStart(6)).join('')}   ${worst.toFixed(1)}`,
  );
}

console.log(`\nPNGs → ${path.relative(ROOT, OUT)}/`);
