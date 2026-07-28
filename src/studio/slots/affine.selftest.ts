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
} from './index';

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
const ext = extendSlotToLengthMm(slot, 26, 18);
assert.deepEqual(ext.rootLeft, slot.rootLeft);
assert.ok(ext.visibleLengthPx > slot.visibleLengthPx);
assert.deepEqual(ext.center, midpoint(rl, rr));

console.log('OK — TS selftest passed');
