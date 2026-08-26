import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  COMMUNITY_LOOK_RECIPE_IDS,
  getCommunityRecipeForLookIdV1,
  parseCommunityLookRecipeRegistryV1,
  selectRegisteredCommunityLooksV1,
} from '../src/community/domain/recipes/community-look-registry-v1.ts';

const root = process.cwd();
const raw = JSON.parse(fs.readFileSync(path.join(root, 'material-library/recipes/community-look-registry-v1.json'), 'utf8'));
const registry = parseCommunityLookRecipeRegistryV1(raw);
assert.ok(registry);
assert.deepEqual(registry.recipes.map((recipe) => recipe.recipeId), COMMUNITY_LOOK_RECIPE_IDS);
assert.equal(registry.recipes.length, 7);
assert.deepEqual(registry.recipes.map((recipe) => recipe.completenessPriority).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(getCommunityRecipeForLookIdV1(registry, 'look.v7-1.petal-veil')?.recipeId, 'petal-veil-french');
assert.equal(getCommunityRecipeForLookIdV1(registry, 'cc_petal_veil')?.recipeId, 'petal-veil-french');
assert.equal(getCommunityRecipeForLookIdV1(registry, 'cc_creator_mock'), null);
assert.ok(registry.recipes.every((recipe) => recipe.manufacturingCommandAllowed === false));
for (const sourceRef of registry.recipes.flatMap((recipe) => recipe.sourceRefs)) {
  assert.ok(fs.existsSync(path.join(root, sourceRef)), `missing registry source: ${sourceRef}`);
}
const fourLookIds = ['leopard-gilded-nude', 'crimson-reliquary', 'ivory-lace-crystal', 'honey-petal-glass'];
for (const recipeId of fourLookIds) {
  const recipe = registry.recipes.find((entry) => entry.recipeId === recipeId);
  assert.ok(recipe?.sourceRefs.some((ref) => ref.endsWith('/recipe-spec.json')));
  assert.ok(recipe?.sourceRefs.some((ref) => ref.endsWith('/manifest.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, `assets/hero-recipes/${recipeId}/manifest.json`), 'utf8'));
  const spec = JSON.parse(fs.readFileSync(path.join(root, `assets/hero-recipes/${recipeId}/recipe-spec.json`), 'utf8'));
  assert.deepEqual(Object.keys(manifest.fingerAllocation).sort(), ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5']);
  assert.deepEqual(Object.keys(spec.fingers).sort(), ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5']);
  assert.equal(manifest.manufacturingValidated, false);
  assert.equal(spec.manufacturing.validated, false);
  assert.equal(recipe.manufacturingCommandAllowed, false);
}
const petalPearlManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/hero-recipes/petal-pearl-bloom/manifest.json'), 'utf8'));
const petalPearlSpec = JSON.parse(fs.readFileSync(path.join(root, 'assets/hero-recipes/petal-pearl-bloom/recipe-spec.json'), 'utf8'));
assert.equal(petalPearlManifest.asset_status, 'SIMULATED');
assert.equal(petalPearlManifest.canonical_renderer_output, false);
assert.equal(petalPearlManifest.production_validated, false);
assert.equal(petalPearlSpec.recipeRef.id, 'petal-pearl-bloom');
assert.equal(petalPearlSpec.manufacturing.validated, false);
const selected = selectRegisteredCommunityLooksV1(registry, [
  { lookId: 'look.v7-1.petal-veil' },
  { lookId: 'cc_petal_veil' },
  { lookId: 'cc_mercury_dew' },
  { lookId: 'cc_petal_tide' },
  { lookId: 'cc_pugc_luna_blush' },
]);
assert.deepEqual(selected.map((look) => look.lookId), ['look.v7-1.petal-veil', 'cc_mercury_dew']);
const invalid = structuredClone(raw);
invalid.recipes[0].manufacturingCommandAllowed = true;
assert.equal(parseCommunityLookRecipeRegistryV1(invalid), null);
console.log('test-community-look-recipe-registry-v1: PASS (7 identities, Petal Veil alias de-dupe, strict sources and manufacturing gate)');
