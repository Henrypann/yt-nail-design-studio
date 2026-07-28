/**
 * Node test runner for NailSlot V2 math (no React).
 * Run: node --experimental-strip-types tools/slot-calibrator/test-slot-math.mjs
 * Fallback: node tools/slot-calibrator/test-slot-math.mjs (uses .mjs twin)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildTransform(rootLeft, rootRight, tipCenter) {
  const rootC = {
    x: (rootLeft.x + rootRight.x) / 2,
    y: (rootLeft.y + rootRight.y) / 2,
  };
  const U = { x: rootRight.x - rootLeft.x, y: rootRight.y - rootLeft.y };
  const V = { x: rootC.x - tipCenter.x, y: rootC.y - tipCenter.y };
  const T = { x: tipCenter.x - 0.5 * U.x, y: tipCenter.y - 0.5 * U.y };
  return [U.x, U.y, V.x, V.y, T.x, T.y];
}

function uvToStage(u, v, m) {
  const [a, b, c, d, tx, ty] = m;
  return { x: a * u + c * v + tx, y: b * u + d * v + ty };
}

function lengthScaleTowardTip(m, targetMm, baseMm = 18) {
  const s = targetMm / baseMm;
  const [a, b, c, d, tx, ty] = m;
  return [a, b, s * c, s * d, tx + (1 - s) * c, ty + (1 - s) * d];
}

function near(p, q, eps = 0.05) {
  assert.ok(Math.hypot(p.x - q.x, p.y - q.y) <= eps, `${JSON.stringify(p)} !~ ${JSON.stringify(q)}`);
}

// Landmarks
const rootLeft = { x: 0, y: 100 };
const rootRight = { x: 40, y: 100 };
const tip = { x: 20, y: 20 };
const m = buildTransform(rootLeft, rootRight, tip);

near(uvToStage(0.5, 1, m), { x: 20, y: 100 });
near(uvToStage(0.5, 0, m), tip);
near(uvToStage(0, 1, m), rootLeft);
near(uvToStage(1, 1, m), rootRight);

// Length: root fixed, tip moves farther along axis when longer
const m26 = lengthScaleTowardTip(m, 26, 18);
near(uvToStage(0.5, 1, m26), { x: 20, y: 100 });
near(uvToStage(0, 1, m26), rootLeft);
near(uvToStage(1, 1, m26), rootRight);
const tip18 = uvToStage(0.5, 0, m);
const tip26 = uvToStage(0.5, 0, m26);
assert.ok(tip26.y < tip18.y, "longer length must extend toward tip (smaller y)");

// JSON slots load + each transform maps UV corners
const slotsDoc = JSON.parse(
  readFileSync(join(__dirname, "../../assets/nail-slots/slots.back.v2.json"), "utf8"),
);
assert.equal(slotsDoc.slots.length, 10);
assert.equal(slotsDoc.plate.sourceWidth, 1200);
assert.equal(slotsDoc.plate.sourceHeight, 900);

for (const slot of slotsDoc.slots) {
  const tm = slot.transform;
  const rootC = uvToStage(0.5, 1, tm);
  const tipC = uvToStage(0.5, 0, tm);
  near(rootC, slot.center, 1.5);
  near(tipC, slot.tipCenter, 1.5);
  near(uvToStage(0, 1, tm), slot.rootLeft, 1.5);
  near(uvToStage(1, 1, tm), slot.rootRight, 1.5);
  assert.ok(slot.nailBedWidthPx > 10);
  assert.ok(slot.visibleLengthPx > 20);
  assert.ok(slot.clipPath.includes("M "));
  // thumbs more rotated than middle
  if (slot.fingerRole === "middle") assert.ok(Math.abs(slot.rotationDeg) < 5);
  if (slot.fingerRole === "thumb") assert.ok(Math.abs(slot.rotationDeg) > 15);
}

// Independence: left/right thumbs not identical (organic asymmetry allowed but codes differ)
const L1 = slotsDoc.slots.find((s) => s.fingerCode === "L1");
const R1 = slotsDoc.slots.find((s) => s.fingerCode === "R1");
assert.notEqual(L1.tipCenter.x, R1.tipCenter.x);

console.log("test-slot-math: ALL PASS");
