import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const fingers = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];
const expectedLooks = ['leopard-gilded-nude', 'crimson-reliquary', 'ivory-lace-crystal', 'honey-petal-glass'];

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function json(path) { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
function pngSize(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}
function glbJson(bytes) {
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.subarray(16, 20).toString('ascii'), 'JSON');
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

const index = await json('assets/hero-recipes/v0-7-2-four-look-sets.json');
assert.equal(index.schemaVersion, 'look-asset-pack-index-v1');
assert.equal(index.architectureBaseline, 'v0.7.2');
assert.deepEqual(index.entries.map((entry) => entry.lookId), expectedLooks);

const coverHashes = new Set();
const kitHashes = new Set();
let componentCount = 0;
const generatedPaths = new Set(['assets/hero-recipes/v0-7-2-four-look-sets.json']);

for (const entry of index.entries) {
  const manifest = await json(entry.manifest);
  const recipe = await json(`assets/hero-recipes/${entry.lookId}/recipe-spec.json`);
  generatedPaths.add(entry.manifest);
  generatedPaths.add(`assets/hero-recipes/${entry.lookId}/recipe-spec.json`);
  assert.equal(manifest.schemaVersion, 'look-asset-pack-v0.7.2-v1');
  assert.equal(recipe.schemaVersion, 'look-set-definition-v0.7.2-v1');
  assert.equal(manifest.architectureBaseline, 'v0.7.2');
  assert.equal(manifest.lookId, entry.lookId);
  assert.equal(manifest.status, 'SIMULATED_LOOK_ASSET_PACK');
  assert.equal(manifest.visualSignoff, 'candidate_pending_designer_trial');
  assert.equal(manifest.manufacturingValidated, false);
  assert.equal(manifest.designTruth, 'structured_finger_allocation_and_layer_contract');
  assert.equal(manifest.previewGeometryRef.registryEntryId, 'geometry-registry.almond.medium.visual-v3');
  assert.equal(manifest.previewGeometryRef.promotionState, 'promoted_simulated_preview');
  assert.equal(manifest.geometryPolicy.exactShapeClaim, false);
  assert.deepEqual(Object.keys(manifest.fingerAllocation), fingers);
  assert.deepEqual(recipe.fingerOrder, fingers);

  const background = manifest.layerContract.find((row) => row.kind === 'background');
  const finish = manifest.layerContract.find((row) => row.kind === 'surface_finish');
  assert.equal(background.cardinality, 'exactly_one');
  assert.equal(finish.cardinality, 'exactly_one_last');
  assert.deepEqual(background.fingers, fingers);
  assert.deepEqual(finish.fingers, fingers);
  for (const finger of fingers) {
    const allocation = manifest.fingerAllocation[finger];
    assert.equal(typeof allocation.background.type, 'string');
    assert.equal(allocation.surfaceFinish.type, 'gloss');
    assert.ok(Array.isArray(allocation.middle));
    assert.deepEqual(recipe.fingers[finger], allocation);
  }

  const coverRef = manifest.assets.highFidelityCover;
  const cover = await readFile(resolve(root, 'assets/hero-recipes', entry.lookId, coverRef.path));
  assert.equal(sha(cover), coverRef.sha256);
  assert.equal(cover.length, coverRef.byteLength);
  assert.deepEqual(pngSize(cover), { width: 1672, height: 941, colorType: 2 });
  coverHashes.add(coverRef.sha256);

  const vectorRef = manifest.assets.flatVector;
  generatedPaths.add(`assets/hero-recipes/${entry.lookId}/${vectorRef.path}`);
  const vector = await readFile(resolve(root, 'assets/hero-recipes', entry.lookId, vectorRef.path));
  assert.equal(sha(vector), vectorRef.sha256);
  assert.match(vector.toString('utf8'), /viewBox="0 0 100 160"/);

  for (const [kind, mapRef] of Object.entries(manifest.assets.textureMaps)) {
    assert.ok(['decal', 'normal', 'roughness', 'height'].includes(kind));
    const bytes = await readFile(resolve(root, 'assets/hero-recipes', entry.lookId, mapRef.path));
    generatedPaths.add(`assets/hero-recipes/${entry.lookId}/${mapRef.path}`);
    assert.equal(sha(bytes), mapRef.sha256);
    assert.equal(bytes.length, mapRef.byteLength);
    assert.deepEqual(pngSize(bytes), { width: 384, height: 640, colorType: 6 });
    assert.equal(mapRef.runtimeUse, 'reference_only_not_shared_across_fingers');
    if (kind === 'height') assert.equal(mapRef.role, 'visual_bump_not_geometry');
  }

  for (const glbRef of manifest.assets.dimensionalAssets) {
    generatedPaths.add(glbRef.path);
    const bytes = await readFile(resolve(root, glbRef.path));
    assert.equal(sha(bytes), glbRef.sha256);
    assert.equal(bytes.length, glbRef.byteLength);
    assert.equal(glbRef.manufacturingValidated, false);
    const gltf = glbJson(bytes);
    assert.ok(gltf.meshes.length > 0);
    assert.ok(gltf.materials.length > 0);
    assert.ok(gltf.materials.every((material) => material.pbrMetallicRoughness));
    assert.ok(gltf.accessors.every((accessor) => Number.isInteger(accessor.count) && accessor.count > 0));
    componentCount += 1;
  }

  const kitRef = manifest.assets.dimensionalKit;
  generatedPaths.add(kitRef.path);
  const kit = await readFile(resolve(root, kitRef.path));
  assert.equal(sha(kit), kitRef.sha256);
  assert.equal(kit.length, kitRef.byteLength);
  assert.equal(kitRef.manufacturingValidated, false);
  const kitGltf = glbJson(kit);
  assert.ok(kitGltf.meshes.length >= manifest.assets.dimensionalAssets.length);
  assert.ok(kitGltf.materials.length > 0);
  kitHashes.add(kitRef.sha256);

  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /\.stl/i);
  assert.doesNotMatch(serialized, /manufacturingValidated":true/);
  assert.ok(manifest.limitations.some((row) => row.includes('STL is intentionally absent')));
}

assert.equal(coverHashes.size, 4);
assert.equal(kitHashes.size, 4);
assert.equal(componentCount, 6);
const before = new Map();
for (const path of generatedPaths) before.set(path, sha(await readFile(resolve(root, path))));
execFileSync('python3', ['tools/generate-v0-7-2-four-look-glb.py'], {
  cwd: root,
  env: { ...process.env, PYTHONPYCACHEPREFIX: '/tmp/nextgen-four-look-test-pycache' },
  stdio: 'pipe',
});
execFileSync(process.execPath, ['tools/generate-v0-7-2-four-look-assets.mjs'], { cwd: root, stdio: 'pipe' });
for (const [path, expected] of before) assert.equal(sha(await readFile(resolve(root, path))), expected, `${path} must regenerate byte-identically`);
console.log('PASS: four v0.7.2 ten-finger Look asset packs, 16 reference-only material maps, 6 component GLBs and 4 dimensional kits validated');
