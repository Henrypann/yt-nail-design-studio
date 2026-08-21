#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import {
  FRENCH_RECIPE_CUSTOM_PRESET_V1,
  FRENCH_RECIPE_DEFAULT_INSTANCE_ID_V1,
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_PARAMETER_KEYS_V1,
  FRENCH_RECIPE_PRESETS_V1,
  FRENCH_RECIPE_REVISION_V1,
  FRENCH_RECIPE_SPEC_V1,
  canonicalizeFrenchRecipeParametersV1,
  createDefaultFrenchRecipeParametersV1,
  createFrenchRecipeInstanceV1,
  isFrenchRecipeIdentityV1,
  isFrenchRecipeInstanceV1,
  parseFrenchRecipeInstanceV1,
  parseFrenchRecipeParametersV1,
  serializeFrenchRecipeParametersV1,
} from '../src/studio/editor/v7/french-recipe-v1.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';

function clone(value) {
  return structuredClone(value);
}

function assertDiagnostic(result, code, pathFragment) {
  assert.equal(result.ok, false, `expected failure for ${code}`);
  assert.ok(
    result.diagnostics.some((item) => item.code === code && (pathFragment == null || item.path.includes(pathFragment))),
    `expected ${code}${pathFragment ? ` at ${pathFragment}` : ''}: ${JSON.stringify(result.diagnostics)}`,
  );
}

assert.equal(FRENCH_RECIPE_SPEC_V1.recipeId, FRENCH_RECIPE_ID_V1);
assert.equal(FRENCH_RECIPE_SPEC_V1.recipeRevision, FRENCH_RECIPE_REVISION_V1);
assert.deepEqual([...FRENCH_RECIPE_SPEC_V1.parameterKeys], [...FRENCH_RECIPE_PARAMETER_KEYS_V1]);
assert.deepEqual(
  [...FRENCH_RECIPE_PARAMETER_KEYS_V1],
  [
    'preset',
    'variant',
    'leftWingV',
    'centerV',
    'rightWingV',
    'fillColor',
    'fillOpacity',
    'balanceLocked',
    'outlineEnabled',
    'outlineColor',
    'outlineWidthMm',
    'transitionMode',
  ],
);
assert.equal(FRENCH_RECIPE_PARAMETER_KEYS_V1.length, 12);
assert.equal(FRENCH_RECIPE_PARAMETER_KEYS_V1.includes('tipWidth'), false);
assert.deepEqual([...FRENCH_RECIPE_PRESETS_V1], ['classic', 'micro', 'soft', 'deep', 'pointed']);
assert.equal(FRENCH_RECIPE_PRESETS_V1.includes(FRENCH_RECIPE_CUSTOM_PRESET_V1), false);
assert.equal(isFrenchRecipeIdentityV1(FRENCH_RECIPE_ID_V1, FRENCH_RECIPE_REVISION_V1), true);
assert.equal(isFrenchRecipeIdentityV1('other-recipe', FRENCH_RECIPE_REVISION_V1), false);
assert.equal(isFrenchRecipeIdentityV1(FRENCH_RECIPE_ID_V1, '2.0.0'), false);

for (const preset of FRENCH_RECIPE_PRESETS_V1) {
  const defaults = createDefaultFrenchRecipeParametersV1(preset);
  const parsed = parseFrenchRecipeParametersV1(defaults);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.diagnostics));
  assert.equal(parsed.parameters.preset, preset);
  assert.equal(parsed.parameters.transitionMode, 'crisp');
  assert.equal(parsed.parameters.outlineEnabled, false);
  assert.equal(parsed.parameters.outlineWidthMm, 0);
  const created = createFrenchRecipeInstanceV1(`recipe.french-edge.${preset}`, preset);
  assert.equal(created.ok, true, created.ok ? '' : JSON.stringify(created.diagnostics));
  assert.equal(created.instance.recipeId, FRENCH_RECIPE_ID_V1);
  assert.equal(created.instance.recipeRevision, FRENCH_RECIPE_REVISION_V1);
  assert.deepEqual(created.instance.parameterValues, parsed.parameters);
  assert.equal(created.serialization, parsed.serialization);
  assert.equal(isFrenchRecipeInstanceV1(created.instance), true);
}
assert.equal(
  createFrenchRecipeInstanceV1('recipe.french-edge.custom-label', FRENCH_RECIPE_CUSTOM_PRESET_V1).ok,
  false,
  'createDefault / create-from-preset must not treat custom as a golden default',
);
console.log('[french-contract] presets parse and create: PASS');

{
  const source = createDefaultFrenchRecipeParametersV1('classic');
  source.fillColor = '#FFFDF9';
  source.leftWingV = 0.3400004;
  source.fillOpacity = 0.5;
  const before = clone(source);
  const parsed = parseFrenchRecipeParametersV1(source);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.diagnostics));
  assert.deepEqual(source, before, 'parser must not mutate input');
  assert.equal(parsed.parameters.fillColor, '#fffdf9');
  assert.equal(parsed.parameters.leftWingV, 0.34);
  assert.equal(parsed.parameters.fillOpacity, 0.5);
  assert.deepEqual(
    Object.keys(parsed.parameters),
    [...FRENCH_RECIPE_PARAMETER_KEYS_V1],
    'canonical key order is the frozen exact-key list',
  );
  const again = parseFrenchRecipeParametersV1(parsed.parameters);
  assert.equal(again.ok, true);
  assert.deepEqual(again.parameters, parsed.parameters);
  assert.equal(again.serialization, parsed.serialization);
  assert.equal(serializeFrenchRecipeParametersV1(parsed.parameters), parsed.serialization);
  assert.equal(
    serializeFrenchRecipeParametersV1(canonicalizeFrenchRecipeParametersV1(source)),
    parsed.serialization,
  );
}
console.log('[french-contract] exact-key canonicalization and round-trip: PASS');

{
  const classic = createDefaultFrenchRecipeParametersV1('classic');
  const customSource = { ...classic, preset: FRENCH_RECIPE_CUSTOM_PRESET_V1, leftWingV: 0.36, rightWingV: 0.36 };
  const custom = parseFrenchRecipeParametersV1(customSource);
  assert.equal(custom.ok, true, custom.ok ? '' : JSON.stringify(custom.diagnostics));
  assert.equal(custom.parameters.preset, 'custom');
  assert.equal(custom.parameters.leftWingV, 0.36);
  const customAgain = parseFrenchRecipeParametersV1(custom.parameters);
  assert.equal(customAgain.ok, true);
  assert.deepEqual(customAgain.parameters, custom.parameters);
  assert.equal(customAgain.serialization, custom.serialization);
  const customInstance = createFrenchRecipeInstanceV1('recipe.french-edge.custom', custom.parameters);
  assert.equal(customInstance.ok, true, customInstance.ok ? '' : JSON.stringify(customInstance.diagnostics));
  assert.equal(customInstance.parameters.preset, 'custom');
}
console.log('[french-contract] custom parses and round-trips: PASS');

{
  const classic = createDefaultFrenchRecipeParametersV1('classic');
  const extra = { ...classic, smileDepth: 12 };
  assertDiagnostic(parseFrenchRecipeParametersV1(extra), 'unknown_key', 'smileDepth');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, tipWidth: 0.22 }), 'unknown_key', 'tipWidth');

  const { leftWingV: _omitted, ...missing } = classic;
  assertDiagnostic(parseFrenchRecipeParametersV1(missing), 'missing_key', 'leftWingV');

  assertDiagnostic(parseFrenchRecipeParametersV1(null), 'not_an_object');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, leftWingV: '0.34' }), 'invalid_type', 'leftWingV');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, leftWingV: Number.NaN }), 'non_finite', 'leftWingV');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, centerV: Number.POSITIVE_INFINITY }), 'non_finite', 'centerV');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, outlineWidthMm: 2.1 }), 'out_of_range', 'outlineWidthMm');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, leftWingV: 0.01 }), 'out_of_range', 'leftWingV');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, preset: 'romantic' }), 'invalid_enum', 'preset');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, variant: 'arc' }), 'invalid_enum', 'variant');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, transitionMode: 'soft' }), 'invalid_enum', 'transitionMode');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, fillColor: 'fffdf9' }), 'invalid_enum', 'fillColor');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, fillColor: '#fff' }), 'invalid_enum', 'fillColor');
  assertDiagnostic(parseFrenchRecipeParametersV1({ ...classic, balanceLocked: 1 }), 'invalid_type', 'balanceLocked');
  assertDiagnostic(
    parseFrenchRecipeParametersV1({ ...classic, balanceLocked: true, rightWingV: 0.5 }),
    'cross_field_invalid',
    'leftWingV',
  );
  assertDiagnostic(
    parseFrenchRecipeParametersV1({ ...classic, centerV: 0.4 }),
    'cross_field_invalid',
    'centerV',
  );
  const pointed = createDefaultFrenchRecipeParametersV1('pointed');
  assertDiagnostic(
    parseFrenchRecipeParametersV1({ ...pointed, centerV: 0.2 }),
    'cross_field_invalid',
    'centerV',
  );
  assertDiagnostic(
    parseFrenchRecipeParametersV1({ ...classic, outlineEnabled: false, outlineWidthMm: 0.05 }),
    'cross_field_invalid',
    'outlineWidthMm',
  );
  assertDiagnostic(
    parseFrenchRecipeParametersV1({ ...classic, outlineEnabled: true, outlineWidthMm: 0 }),
    'cross_field_invalid',
    'outlineWidthMm',
  );
  const outlined = parseFrenchRecipeParametersV1({ ...classic, outlineEnabled: true, outlineWidthMm: 0.05 });
  assert.equal(outlined.ok, true, outlined.ok ? '' : JSON.stringify(outlined.diagnostics));
  assert.equal(outlined.parameters.outlineWidthMm, 0.05);
  const outlinedMax = parseFrenchRecipeParametersV1({ ...classic, outlineEnabled: true, outlineWidthMm: 2 });
  assert.equal(outlinedMax.ok, true, outlinedMax.ok ? '' : JSON.stringify(outlinedMax.diagnostics));
  assert.equal(outlinedMax.parameters.outlineWidthMm, 2);
}
console.log('[french-contract] unknown/missing/non-finite/range/cross-field fail closed: PASS');

{
  const created = createFrenchRecipeInstanceV1(FRENCH_RECIPE_DEFAULT_INSTANCE_ID_V1, 'classic');
  assert.equal(created.ok, true);
  const blank = createBlankEditorDocV7({
    designId: 'design.french-recipe.contract',
    shape: 'almond',
    length: 'medium',
  });
  assert.equal(blank.ok, true);
  const doc = structuredClone(blank.doc);
  doc.recipeInstances[created.instance.instanceId] = created.instance;
  doc.nails.R4.steps[0].recipeInstanceId = created.instance.instanceId;
  const parsedDoc = parseEditorDocV7(doc);
  assert.equal(parsedDoc.ok, true, parsedDoc.ok ? '' : JSON.stringify(parsedDoc.issues));
  assert.equal(parsedDoc.doc.schemaVersion, 7);
  assert.equal(parsedDoc.doc.recipeInstances[created.instance.instanceId].recipeId, FRENCH_RECIPE_ID_V1);

  assert.equal(isFrenchRecipeInstanceV1({ ...created.instance, extra: true }), false);
  assertDiagnostic(
    parseFrenchRecipeInstanceV1({ ...created.instance, recipeId: 'legacy-french' }),
    'recipe_identity_mismatch',
    'recipeId',
  );
  assertDiagnostic(createFrenchRecipeInstanceV1('bad id', 'classic'), 'invalid_id', 'instanceId');
  assert.equal(isFrenchRecipeInstanceV1({ recipeId: FRENCH_RECIPE_ID_V1, recipeRevision: FRENCH_RECIPE_REVISION_V1 }), false);
}
console.log('[french-contract] RecipeInstanceV7 identify/create/parse: PASS');

{
  const a = serializeFrenchRecipeParametersV1(createDefaultFrenchRecipeParametersV1('classic'));
  const b = serializeFrenchRecipeParametersV1(createDefaultFrenchRecipeParametersV1('classic'));
  const c = serializeFrenchRecipeParametersV1(createDefaultFrenchRecipeParametersV1('micro'));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^preset="classic"\|variant="smooth"\|leftWingV=/);
  assert.match(a, /\|outlineWidthMm=0\.000000\|transitionMode="crisp"$/);
  assert.equal(a.includes('tipWidth'), false);
  assert.equal(a.includes('leftOffset'), false);
  assert.equal(a.includes('outlineWidth='), false);
}
console.log('[french-contract] deterministic hash-input serialization: PASS');
