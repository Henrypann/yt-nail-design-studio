/**
 * mirror + render-brush 冒烟测试（Node ESM）
 * npm run test:handdraw
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ── mirror logic (inline mirror of mirror.ts for node runtime) ──

function oppositeFinger(finger) {
  const num = finger.slice(1);
  const hand = finger[0] === 'L' ? 'R' : 'L';
  return `${hand}${num}`;
}

function mirrorTransform(t, finger) {
  let rotation = -t.rotation;
  if (finger.endsWith('1')) rotation += 180;
  return { x: -t.x, y: t.y, scale: t.scale, rotation };
}

function mirrorPoints(points) {
  return points.map((p) => ({ x: -p.x, y: p.y }));
}

assert(oppositeFinger('L4') === 'R4', 'L4 → R4');
assert(oppositeFinger('R2') === 'L2', 'R2 → L2');

const pts = mirrorPoints([{ x: 10, y: -50 }, { x: -5, y: -80 }]);
assert(pts[0].x === -10, 'mirror x');

const t = mirrorTransform({ x: 12, y: -90, scale: 1.2, rotation: 30 }, 'L4');
assert(t.x === -12 && t.rotation === -30, 'transform mirror');

const tThumb = mirrorTransform({ x: 0, y: 0, scale: 1, rotation: 0 }, 'L1');
assert(tThumb.rotation === 180, 'thumb +180');

// ── brand palette file ──
const palettePath = join(root, 'material-library/colors/brand-palette.json');
const palette = JSON.parse(readFileSync(palettePath, 'utf8'));
assert(palette.colors.length >= 120, 'brand palette >= 120 colors');
const brands = new Set(palette.colors.map((c) => c.brand));
assert(brands.has('OPI') && brands.has('CND') && brands.has('Essie'), 'three brands');

// ── render.ts includes brush polyline helper ──
const renderSrc = readFileSync(join(root, 'src/studio/editor/lib/render.ts'), 'utf8');
assert(renderSrc.includes('brushStroke'), 'render has brushStroke');
assert(renderSrc.includes('composeTiledSvg'), 'render has tiled export');

console.log('test:handdraw — all passed');
