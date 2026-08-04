/**
 * TypeScript-side smoke asserts for NailSlot V2 math (mirrors tools/slot-calibrator tests).
 * Runnable via: npx --yes tsx src/studio/slots/affine.selftest.ts
 * Primary CI path: npm run test:slots (plain node on slot-math.mjs).
 */
import assert from 'node:assert/strict';
import {
  affineFromLandmarks,
  applyAffine,
  extendSlotToLengthMm,
  buildNailSlotV2,
  midpoint,
} from './index.ts';

const rl = { x: 100, y: 200 };
const rr = { x: 140, y: 204 };
const tip = { x: 118, y: 140 };
const m = affineFromLandmarks(rl, rr, tip);
assert.ok(Math.abs(applyAffine(m, { x: 0, y: 1 }).x - rl.x) < 1e-6);
assert.ok(Math.abs(applyAffine(m, { x: 1, y: 1 }).x - rr.x) < 1e-6);
assert.ok(Math.abs(applyAffine(m, { x: 0.5, y: 0 }).y - tip.y) < 1e-6);

const slot = buildNailSlotV2({
  fingerCode: 'L3',
  rootLeft: rl,
  rootRight: rr,
  tipCenter: tip,
});
const ext = extendSlotToLengthMm(slot, 26, 14);
assert.deepEqual(ext.rootLeft, slot.rootLeft);
assert.ok(ext.visibleLengthPx > slot.visibleLengthPx);
assert.deepEqual(ext.center, midpoint(rl, rr));

// The plate line art is the shortest length: at 14mm the tip must land on the
// calibrated tip, so the drawn free edge is fully covered rather than exposed.
const atReference = extendSlotToLengthMm(slot, 14, 14);
assert.ok(Math.abs(atReference.tipCenter.x - tip.x) < 1e-9);
assert.ok(Math.abs(atReference.tipCenter.y - tip.y) < 1e-9);
assert.ok(Math.abs(atReference.visibleLengthPx - slot.visibleLengthPx) < 1e-9);

// Longer lengths only extend tip-ward; the root stays pinned to the cuticle.
for (const mm of [18, 22, 26] as const) {
  const s = extendSlotToLengthMm(slot, mm, 14);
  assert.deepEqual(s.rootLeft, slot.rootLeft);
  assert.deepEqual(s.rootRight, slot.rootRight);
  assert.ok(s.visibleLengthPx > slot.visibleLengthPx, `${mm}mm must extend past the drawn nail`);
}

console.log('OK — TS selftest passed');
