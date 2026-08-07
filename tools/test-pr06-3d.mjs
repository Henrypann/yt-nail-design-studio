/** PR-06 behavioral gate: manifest, GLB integrity, V6 selection, lazy fallback. */

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

const {
  selectLod,
  validateAssetManifest,
  validateComponentEntry,
} = await import('../src/studio/preview/asset-manifest.ts');
const {
  inspectGlb,
  rendererRequestFromV6Recipe,
  resolveRenderer,
} = await import('../src/studio/preview/renderer-adapter.ts');

const fixture = JSON.parse(await readFile(new URL('../assets/glb/manifest.v1.json', import.meta.url), 'utf8'));
const petalPreviewSource = await readFile(new URL('../src/studio/petal-veil/PetalVeilPreview.tsx', import.meta.url), 'utf8');
assert.ok(!petalPreviewSource.includes('2D 预览降级'), '3D error card must not claim that it is rendering 2D content');
assert.match(petalPreviewSource, /当前区域没有渲染 2D 内容/);
assert.match(petalPreviewSource, /重试模拟 3D/);
const fixtureResult = validateAssetManifest(fixture);
assert.equal(fixtureResult.ok, true, fixtureResult.ok ? '' : fixtureResult.errors.join('\n'));
assert.equal(fixture.rendererAdapters.length, 2, 'both reference recipes need data-driven adapter descriptors');
assert.ok(fixture.assets.every((asset) => asset.evidence === 'MISSING'));
assert.ok(fixture.assets.every((asset) => asset.manufacturingValidated === false));

function clone(value) {
  return structuredClone(value);
}

function invalidManifest(mutator) {
  const candidate = clone(fixture);
  mutator(candidate);
  const result = validateAssetManifest(candidate);
  assert.equal(result.ok, false);
  return result.errors.join('; ');
}

assert.match(invalidManifest((manifest) => manifest.assets.push(clone(manifest.assets[0]))), /unique/);
assert.match(invalidManifest((manifest) => manifest.rendererAdapters[0].requiredAssetIds.push('does-not-exist')), /missing asset/);
assert.match(invalidManifest((manifest) => { manifest.coordinateContract.unit = 'cm'; }), /millimetre/);
assert.match(invalidManifest((manifest) => { manifest.assets[0].manufacturingValidated = true; }), /must be false/);

const simulatedAsset = {
  id: 'shell-ready',
  revision: '1.0.0',
  category: 'shell',
  evidence: 'SIMULATED',
  renderSuitability: 'simulated_preview',
  manufacturingValidated: false,
  lods: [
    {
      level: 0,
      minScreenCoveragePx: 700,
      path: '/assets/glb/fixtures/shell-l0.web.glb',
      sizeBytes: 24,
      sha256: 'a'.repeat(64),
      boundsMm: { min: [-6, -20, 0], max: [6, 0, 3] },
    },
    {
      level: 1,
      minScreenCoveragePx: 0,
      path: '/assets/glb/fixtures/shell-l1.web.glb',
      sizeBytes: 24,
      sha256: 'b'.repeat(64),
      boundsMm: { min: [-6, -20, 0], max: [6, 0, 3] },
    },
  ],
};
assert.equal(validateComponentEntry(simulatedAsset), null);
assert.equal(selectLod(simulatedAsset, 900)?.level, 0);
assert.equal(selectLod(simulatedAsset, 390)?.level, 1);

const badPath = clone(simulatedAsset);
badPath.lods[0].path = '../../private.raw.glb';
assert.match(validateComponentEntry(badPath), /browser \.web\.glb/);
const badHash = clone(simulatedAsset);
badHash.lods[0].sha256 = 'not-a-hash';
assert.match(validateComponentEntry(badHash), /SHA-256/);
const badBounds = clone(simulatedAsset);
badBounds.lods[0].boundsMm.max[0] = -8;
assert.match(validateComponentEntry(badBounds), /lower than max/);
const duplicateLod = clone(simulatedAsset);
duplicateLod.lods[1].level = 0;
assert.match(validateComponentEntry(duplicateLod), /unique/);

function validGlb() {
  const buffer = new ArrayBuffer(24);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, 24, true);
  view.setUint32(12, 4, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).set([0x7b, 0x7d, 0x20, 0x20]);
  return buffer;
}
assert.equal(inspectGlb(validGlb()), null);
const corruptGlb = validGlb();
new DataView(corruptGlb).setUint32(0, 0, true);
assert.match(inspectGlb(corruptGlb), /magic/);

const v6Recipe = {
  id: 'recipe-instance-1',
  recipeId: 'mercury-dew',
  recipe: { recipeRef: { id: 'mercury-dew', version: '1.0.0' } },
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
};
assert.deepEqual(rendererRequestFromV6Recipe(v6Recipe, 800), {
  recipeRef: { id: 'mercury-dew', version: '1.0.0' },
  screenCoveragePx: 800,
});
assert.equal(rendererRequestFromV6Recipe({ ...v6Recipe, recipeId: 'other' }, 800), null);

let moduleLoads = 0;
const neverLoad = {
  'three-pbr/mercury-dew-1': async () => {
    moduleLoads += 1;
    return { rendererId: 'three-pbr/mercury-dew-1', engine: 'three', evidence: 'SIMULATED' };
  },
};
const missing = await resolveRenderer(fixture, { recipeRef: { id: 'mercury-dew', version: '1.0.0' }, screenCoveragePx: 800 }, { moduleLoaders: neverLoad });
assert.equal(missing.kind, 'fallback_2d');
assert.equal(missing.reason, 'missing_asset');
assert.equal(missing.rendererId, 'svg-2.5d/mercury-1');
assert.equal(moduleLoads, 0, 'missing assets must short-circuit before renderer import');

const starfishMissing = await resolveRenderer(fixture, { recipeRef: { id: 'starfish-bloom-elegance', version: '1.0.0' }, screenCoveragePx: 800 });
assert.equal(starfishMissing.kind, 'fallback_2d');
assert.equal(starfishMissing.reason, 'missing_asset');
const unsupported = await resolveRenderer(fixture, { recipeRef: { id: 'unknown', version: '1.0.0' }, screenCoveragePx: 800 });
assert.equal(unsupported.kind, 'fallback_2d');
assert.equal(unsupported.reason, 'unsupported_recipe');
const invalid = await resolveRenderer({ schemaVersion: 99 }, { recipeRef: { id: 'mercury-dew', version: '1.0.0' }, screenCoveragePx: 800 });
assert.equal(invalid.kind, 'fallback_2d');
assert.equal(invalid.reason, 'invalid_manifest');

const readyManifest = clone(fixture);
readyManifest.assets = [simulatedAsset];
readyManifest.rendererAdapters = [{
  id: 'three-pbr/mercury-dew-1',
  recipeRef: { id: 'mercury-dew', version: '1.0.0' },
  requiredAssetIds: ['shell-ready'],
  fallbackRendererId: 'svg-2.5d/mercury-1',
  evidence: 'SIMULATED',
}];
const request = { recipeRef: { id: 'mercury-dew', version: '1.0.0' }, screenCoveragePx: 900 };

const networkMissing = await resolveRenderer(readyManifest, request, {
  fetchBytes: async () => { throw new Error('404'); },
  digestSha256: async () => 'a'.repeat(64),
  moduleLoaders: neverLoad,
});
assert.equal(networkMissing.kind, 'fallback_2d');
assert.equal(networkMissing.reason, 'missing_asset');
assert.equal(moduleLoads, 0);

const corrupt = await resolveRenderer(readyManifest, request, {
  fetchBytes: async () => new ArrayBuffer(24),
  digestSha256: async () => 'a'.repeat(64),
  moduleLoaders: neverLoad,
});
assert.equal(corrupt.kind, 'fallback_2d');
assert.equal(corrupt.reason, 'corrupt_asset');
assert.equal(moduleLoads, 0);

const incompatible = await resolveRenderer(readyManifest, request, {
  fetchBytes: async () => validGlb(),
  digestSha256: async () => { throw new Error('WebCrypto unavailable'); },
  moduleLoaders: neverLoad,
});
assert.equal(incompatible.kind, 'fallback_2d');
assert.equal(incompatible.reason, 'incompatible_asset');
assert.equal(moduleLoads, 0);

const loaded = await resolveRenderer(readyManifest, request, {
  fetchBytes: async () => validGlb(),
  digestSha256: async () => 'a'.repeat(64),
  moduleLoaders: neverLoad,
});
assert.equal(loaded.kind, 'adapter_loaded');
assert.equal(loaded.evidence, 'SIMULATED');
assert.equal(loaded.assets[0].lod.level, 0);
assert.equal(moduleLoads, 1, 'renderer imports only after manifest and GLB integrity pass');

const wrongModule = await resolveRenderer(readyManifest, request, {
  fetchBytes: async () => validGlb(),
  digestSha256: async () => 'a'.repeat(64),
  moduleLoaders: { 'three-pbr/mercury-dew-1': async () => ({ rendererId: 'wrong', engine: 'three', evidence: 'SIMULATED' }) },
});
assert.equal(wrongModule.kind, 'fallback_2d');
assert.equal(wrongModule.reason, 'renderer_load_failed');

console.log('test-pr06-3d-foundation: PASS');
