import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1,
  GOLDEN_RENDER_SCENE_SNAPSHOT_V1,
  parsePreviewAppearanceProfileV1,
  parseRenderSceneSnapshotV1,
} from '../src/studio/rendering/v0-7-2/index.ts';

const profile = structuredClone(GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1);
const scene = structuredClone(GOLDEN_RENDER_SCENE_SNAPSHOT_V1);
assert.deepEqual(parsePreviewAppearanceProfileV1(profile), { ok: true, value: profile });
assert.deepEqual(parseRenderSceneSnapshotV1(scene), { ok: true, value: scene });
assert.equal(profile.evidence.manufacturingValidated, false);
assert.equal(scene.evidence.writerZero, true);
assert.equal(scene.presentation, 'single_nail_focus_simulated_3d');

for (const mutate of [
  (value) => { value.extra = true; },
  (value) => { value.finishes.gloss.clearcoat = 2; },
  (value) => { value.cameraPresets[1].positionMm[0] = Number.NaN; },
  (value) => { value.cameraPresets[4].id = 'surface'; },
  (value) => { value.evidence.manufacturingValidated = true; },
]) {
  const invalid = structuredClone(profile);
  mutate(invalid);
  assert.equal(parsePreviewAppearanceProfileV1(invalid).ok, false);
}

for (const mutate of [
  (value) => { value.quality = 'production'; },
  (value) => { value.designRef.finger = 'R6'; },
  (value) => { value.geometryRef.geometryHash = 'bad'; },
  (value) => { value.evidence.writerZero = false; },
  (value) => { value.layerRefs[0].extra = true; },
]) {
  const invalid = structuredClone(scene);
  mutate(invalid);
  assert.equal(parseRenderSceneSnapshotV1(invalid).ok, false);
}

const schema = JSON.parse(await readFile(new URL('../src/studio/rendering/v0-7-2/render-contract-v1.schema.json', import.meta.url), 'utf8'));
assert.equal(schema.$defs.appearanceProfile.additionalProperties, false);
assert.equal(schema.$defs.renderScene.additionalProperties, false);
assert.equal(schema.$defs.finish.additionalProperties, false);
assert.equal(schema.$defs.renderScene.properties.evidence.properties.writerZero.const, true);
assert.equal(schema.$defs.appearanceProfile.properties.evidence.properties.manufacturingValidated.const, false);

console.log('test-render-contract-v0-7-2: PASS (appearance, scene, camera, evidence, strict unknown-key rejection)');
