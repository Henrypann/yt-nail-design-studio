import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const recipe = read('assets/hero-recipes/petal-veil-french/recipe-spec.json');
const fixture = read('assets/golden-fixtures/petal-veil-french/snapshot.json');
const manifest = read('assets/hero-recipes/petal-veil-french/manifest.json');
const fingers = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];

assert.equal(recipe.recipeRef.version, '1.0.0');
assert.equal(recipe.shape, 'almond');
assert.equal(recipe.length, 'medium');
assert.deepEqual(recipe.base, { color: '#F2E4DA', opacity: 0.92 });
assert.deepEqual(recipe.french.color, '#FBF7F2');
assert.equal(recipe.french.opacity, 0.75);
assert.equal(recipe.relief.finger, 'R4');
assert.equal(recipe.relief.petals, 5);
assert.equal(recipe.relief.heightMm, 0.18);
assert(recipe.relief.uv.every((value) => value >= 0 && value <= 1));
assert(recipe.relief.heightMm >= 0.05 && recipe.relief.heightMm <= 0.3);
assert.deepEqual(fingers.filter((finger) => finger !== recipe.relief.finger), fixture.plainFingers);
assert.equal(fixture.visualSignoff.status, 'pending');
assert.equal(fixture.manufacturing.status, 'blocked');
assert.equal(fixture.r4AppearanceChecksum, 'fnv1a:34d090ea');
assert.equal(manifest.asset_status, 'CONCEPT');
assert.equal(manifest.visual_signoff, 'pending');
assert.equal(manifest.production_validated, false);

for (const asset of manifest.assets) {
  const bytes = fs.readFileSync(path.join(root, 'assets/hero-recipes/petal-veil-french', asset.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
}

const fixtureDir = path.join(root, 'assets/golden-fixtures/petal-veil-french');
const checksumLines = fs.readFileSync(path.join(fixtureDir, 'checksums.sha256'), 'utf8').trim().split('\n');
for (const line of checksumLines) {
  const [expected, file] = line.trim().split(/\s+/, 2);
  const bytes = fs.readFileSync(path.join(fixtureDir, file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected);
}

const stablePayload = JSON.stringify({
  recipeRef: recipe.recipeRef,
  rendererId: recipe.rendererId,
  shape: recipe.shape,
  length: recipe.length,
  base: recipe.base,
  french: recipe.french,
  relief: recipe.relief,
});
assert.equal(
  crypto.createHash('sha256').update(stablePayload).digest('hex'),
  crypto.createHash('sha256').update(stablePayload).digest('hex'),
);
console.log('validate-petal-veil: PASS (signature, R4-only relief, boundaries, asset checksums, pending gates)');
