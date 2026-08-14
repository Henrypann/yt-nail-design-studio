import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createFullEditorDocV7Fixture, createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  AURORA_ALMOND_TEXTURE_ASSET_SET_V1,
  resolveRenderTextureAssetSetV1,
} from '../src/studio/rendering/v0-7-2/index.ts';

const root = new URL('../', import.meta.url);
const manifestUrl = new URL('../public/render-v0-7-2/aurora-almond-v2/manifest.json', import.meta.url);
const generatorPath = fileURLToPath(new URL('./generate-render-v0-7-2-texture-assets.mjs', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const beforeManifest = await readFile(manifestUrl);
const before = JSON.parse(beforeManifest);
assert.equal(before.schemaVersion, 'render-texture-asset-set-v1');
assert.equal(before.status, 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED');
assert.deepEqual(before.materialRef, { materialId: 'material.magnetic-gel', revision: '1' });
assert.equal(before.uvContract, 'nail-local-v1-tip-to-root');
assert.equal(before.maps.normal.convention, 'OpenGL +Y');
assert.equal(before.maps.height.heightScaleMm, 0.18);
assert.ok(before.limitations.some((entry) => entry.includes('manufacturing')));

for (const kind of ['decal', 'normal', 'roughness', 'height']) {
  const ref = before.maps[kind];
  const bytes = await readFile(new URL(`../${ref.path}`, import.meta.url));
  assert.equal(sha256(bytes), ref.sha256, `${kind} sha256 drift`);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 256);
  assert.equal(bytes.readUInt32BE(20), 410);
  const runtimeRef = AURORA_ALMOND_TEXTURE_ASSET_SET_V1.maps[kind];
  for (const field of ['assetId', 'revision', 'runtimeUrl', 'mimeType', 'widthPx', 'heightPx', 'sha256', 'colorSpace', 'alphaMode', 'channel']) {
    assert.equal(runtimeRef[field], ref[field], `${kind}.${field} runtime/manifest drift`);
  }
}

execFileSync(process.execPath, [generatorPath], { cwd: fileURLToPath(root), stdio: 'ignore' });
const regeneratedManifest = await readFile(manifestUrl);
assert.equal(sha256(regeneratedManifest), sha256(beforeManifest), 'manifest regeneration must be byte deterministic');
for (const kind of ['decal', 'normal', 'roughness', 'height']) {
  const ref = before.maps[kind];
  assert.equal(sha256(await readFile(new URL(`../${ref.path}`, import.meta.url))), ref.sha256, `${kind} regeneration drift`);
}

const full = createFullEditorDocV7Fixture();
const frozen = JSON.stringify(full);
const resolved = resolveRenderTextureAssetSetV1(full.nails.L1);
assert.equal(resolved?.assetSetId, before.assetSetId);
assert.equal(resolved?.revision, before.revision);
assert.equal(JSON.stringify(full), frozen, 'texture asset resolution must be writer-zero');

const minimal = createMinimalEditorDocV7Fixture();
assert.equal(resolveRenderTextureAssetSetV1(minimal.nails.L1), null, 'no material ref must not receive mock maps');
const inactive = structuredClone(full.nails.L1);
inactive.steps.forEach((step) => {
  if (step.materialRefs.some((ref) => ref.materialId === 'material.magnetic-gel')) step.skipped = true;
});
assert.equal(resolveRenderTextureAssetSetV1(inactive), null, 'skipped material step must not project maps');

const { FOUR_LOOK_SET_AUTHORITIES_V0_7_2 } = await import('../src/integration/community-studio/v0-7-2-four-look-sets.ts');
for (const authority of FOUR_LOOK_SET_AUTHORITIES_V0_7_2) {
  for (const nail of Object.values(authority.doc.nails)) {
    assert.equal(
      resolveRenderTextureAssetSetV1(nail),
      null,
      `${authority.definition.id}/${nail.finger} must use its canonical per-finger projection, not a shared Look decal`,
    );
  }
}

const runtime = await readFile(new URL('../src/studio/rendering/v0-7-2/SingleNailPbrPreviewV072.tsx', import.meta.url), 'utf8');
assert.match(runtime, /render_texture_integrity_failed/);
assert.match(runtime, /normalMap:/);
assert.match(runtime, /roughnessMap:/);
assert.match(runtime, /bumpMap:/);
assert.match(runtime, /bumpScale:/);
assert.match(runtime, /data-texture-asset-set/);
assert.doesNotMatch(runtime, /displacementMap|localStorage|sessionStorage|saveEditor|repository/);

console.log('test-render-v0-7-2-texture-assets: PASS (Aurora maps gated; four Looks use canonical per-finger projection; writer-zero)');
