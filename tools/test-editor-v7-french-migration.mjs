#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createEditorDocV6MigrationFixture } from '../src/studio/editor/fixtures/editor-doc-v7-migration.mjs';
import { EDITOR_DOC_V7_FULL_FIXTURE } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  hasRichLegacyFrenchFieldsV1,
  previewFrenchLegacyConversionV1,
} from '../src/studio/editor/v7/french-migration-v1.ts';
import { FRENCH_RECIPE_ID_V1, FRENCH_RECIPE_REVISION_V1 } from '../src/studio/editor/v7/french-recipe-v1.ts';
import { migrateEditorDocV7 } from '../src/studio/editor/v7/migrate.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';

const resolvers = {
  resolveGeometry: ({ shape, length, finger }) => ({
    assetId: `geometry.${shape}.${length}.${finger}`,
    revision: 'registry-1',
  }),
  resolveFinishPreset: ({ finishType }) => ({
    id: `preset.finish.${finishType}`,
    revision: 'registry-1',
  }),
};

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const v7Simple = {
  id: 'element.v7.french',
  kind: 'french_edge',
  visible: true,
  locked: false,
  opacity: 1,
  transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
  widthRatio: 0.22,
  curvature: 0.3,
  color: { colorSpace: 'srgb', r: 255, g: 253, b: 249, a: 1 },
};

const richArc = {
  id: 'el_french_arc',
  kind: 'french_edge',
  variant: 'arc',
  fillColor: '#FFFDF9',
  outlineEnabled: false,
  strokeColor: '#E8D8D0',
  strokeWidth: 3,
  tipOffset: 48,
  smileDepth: 14,
  classicControls: { leftWingOffset: 48, centerOffset: 26, rightWingOffset: 48 },
  lineGap: 8,
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
};

const richV = {
  ...richArc,
  id: 'el_french_v',
  variant: 'v',
  classicControls: undefined,
};

const richDouble = {
  ...richArc,
  id: 'el_french_double',
  variant: 'double',
  lineGap: 10,
};

function assertNoMutation(source, run) {
  const frozen = deepFreeze(clone(source));
  const before = JSON.stringify(frozen);
  const first = run(frozen);
  const second = run(frozen);
  assert.equal(JSON.stringify(frozen), before, 'conversion must not mutate source');
  assert.deepEqual(first, second, 'conversion must be repeatable');
  assert.notEqual(first.source, frozen);
  assert.deepEqual(first.source, JSON.parse(before));
  return first;
}

{
  const preview = assertNoMutation(v7Simple, (value) => previewFrenchLegacyConversionV1(value, { path: '$.nails.R4' }));
  assert.equal(preview.family, 'v7_simple');
  assert.equal(preview.status, 'approximate');
  assert.equal(preview.parameters, null);
  assert.equal(preview.sourceIdentity.recipeId, FRENCH_RECIPE_ID_V1);
  assert.equal(preview.sourceIdentity.recipeRevision, FRENCH_RECIPE_REVISION_V1);
  assert.equal(preview.sourceIdentity.sourceId, 'element.v7.french');
  assert.ok(preview.limitations.some((item) => item.includes('Preset is not inferred')));
  assert.ok(preview.diagnostics.some((item) => item.code === 'curvature_has_no_three_point_mapping'));
  assert.equal(hasRichLegacyFrenchFieldsV1(v7Simple), false);
}
console.log('[french-migration] V7 simple legacy preview: PASS');

{
  const preview = assertNoMutation(richArc, (value) => previewFrenchLegacyConversionV1(value));
  assert.equal(preview.family, 'v3_v6_rich');
  assert.equal(preview.status, 'approximate');
  assert.equal(preview.parameters, null);
  assert.equal(preview.sourceIdentity.legacyVariant, 'arc');
  assert.ok(preview.limitations.some((item) => item.includes('0.1mm')));
  assert.ok(preview.diagnostics.some((item) => item.code === 'geometry_not_nail_local'));
  assert.ok(preview.diagnostics.some((item) => item.code === 'preset_not_inferred'));
  assert.equal(hasRichLegacyFrenchFieldsV1(richArc), true);
}

{
  const preview = previewFrenchLegacyConversionV1(richV);
  assert.equal(preview.family, 'v3_v6_rich');
  assert.equal(preview.status, 'approximate');
  assert.equal(preview.parameters, null);
  assert.ok(preview.limitations.some((item) => item.includes('variant=pointed') || item.includes('v is structurally related')));
}

{
  const preview = assertNoMutation(richDouble, (value) => previewFrenchLegacyConversionV1(value));
  assert.equal(preview.family, 'v3_v6_rich');
  assert.equal(preview.status, 'unavailable');
  assert.equal(preview.parameters, null);
  assert.deepEqual(preview.source, richDouble);
  assert.ok(preview.diagnostics.some((item) => item.code === 'unsupported_double_variant'));
  assert.ok(preview.limitations.some((item) => item.includes('double')));
}
console.log('[french-migration] rich V3/V6 families and double unavailable: PASS');

{
  const mixed = { ...richArc, widthRatio: 0.22, curvature: 0.3, color: '#FFFDF9' };
  const preview = assertNoMutation(mixed, (value) => previewFrenchLegacyConversionV1(value));
  assert.equal(preview.family, 'v3_v6_rich');
  assert.equal(hasRichLegacyFrenchFieldsV1(mixed), true);
  assert.ok(preview.diagnostics.some((item) => item.code === 'mixed_legacy_fields'));
  assert.equal(preview.parameters, null);
}

{
  const invalid = { kind: 'french_edge', widthRatio: 1.4, curvature: 0, color: '#fffdf9' };
  const preview = previewFrenchLegacyConversionV1(invalid);
  assert.equal(preview.family, 'v7_simple');
  assert.equal(preview.status, 'unavailable');
  assert.deepEqual(preview.source, invalid);
  assert.equal(preview.parameters, null);
}

{
  const unknown = { kind: 'brush', color: '#fff' };
  const preview = previewFrenchLegacyConversionV1(unknown);
  assert.equal(preview.family, 'unknown');
  assert.equal(preview.status, 'unavailable');
  assert.deepEqual(preview.source, unknown);
  assert.ok(preview.diagnostics.some((item) => item.code === 'not_french_edge'));
}
console.log('[french-migration] failed conversion preserves source: PASS');

function addPatternLayer(doc, finger, element) {
  doc.nails[finger].layers.push({
    id: `layer_v6_french_${finger}`,
    name: 'French',
    typeId: 'builtin.recipe',
    visible: true,
    locked: false,
    order: 1,
    elements: [{
      id: element.id,
      domain: 'pattern',
      kind: 'french_edge',
      visible: true,
      locked: false,
      order: 0,
      ...element,
    }],
  });
}

{
  const source = createEditorDocV6MigrationFixture();
  addPatternLayer(source, 'L1', {
    id: 'element_v6_simple_french',
    widthRatio: 0.22,
    curvature: 0.3,
    color: '#FFFDF9',
  });
  const frozen = deepFreeze(clone(source));
  const first = migrateEditorDocV7(frozen, resolvers);
  const second = migrateEditorDocV7(frozen, resolvers);
  assert.equal(first.status, 'migrated');
  assert.deepEqual(first.doc, second.doc);
  const parsed = parseEditorDocV7(first.doc);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.issues));
  const flat = first.doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.ok(flat);
  assert.equal(flat.elements.length, 1);
  assert.deepEqual(flat.elements[0], {
    id: flat.elements[0].id,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
    kind: 'french_edge',
    widthRatio: 0.22,
    curvature: 0.3,
    color: { colorSpace: 'srgb', r: 255, g: 253, b: 249, a: 1 },
  });
  assert.equal(first.diagnostics.some((item) => item.code === 'legacy_french_rich'), false);
}
console.log('[french-migration] V7 simple legacy migrate output: PASS');

{
  const source = createEditorDocV6MigrationFixture();
  addPatternLayer(source, 'L1', richArc);
  const frozen = deepFreeze(clone(source));
  const result = migrateEditorDocV7(frozen, resolvers);
  assert.ok(result.status === 'migrated' || result.status === 'migrated_with_warnings');
  const parsed = parseEditorDocV7(result.doc);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.issues));
  const flat = result.doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.ok(flat);
  assert.equal(flat.elements.length, 0, 'rich French must not flatten into V7 french_edge');
  assert.ok(result.diagnostics.some((item) => item.code === 'legacy_french_rich'));
  const evidence = result.legacyEvidence.find((item) => item.sourceId === 'el_french_arc');
  assert.ok(evidence);
  assert.equal(evidence.kind, 'element');
  assert.equal(evidence.value.variant, 'arc');
  assert.equal(evidence.value.tipOffset, 48);
  assert.deepEqual(evidence.value.classicControls, richArc.classicControls);
  assert.equal(JSON.stringify(frozen).includes('"variant":"arc"'), true);
}

{
  const mixedSource = createEditorDocV6MigrationFixture();
  addPatternLayer(mixedSource, 'R4', {
    ...richArc,
    id: 'element_mixed_french',
    widthRatio: 0.22,
    curvature: 0.3,
    color: '#FFFDF9',
  });
  const result = migrateEditorDocV7(deepFreeze(clone(mixedSource)), resolvers);
  const flat = result.doc.nails.R4.steps.find((step) => step.kind === 'flat_design');
  assert.equal(flat.elements.length, 0, 'mixed rich+simple French must not be flattened');
  assert.ok(result.diagnostics.some((item) => item.code === 'legacy_french_rich'));
  assert.ok(result.legacyEvidence.some((item) => item.sourceId === 'element_mixed_french' && item.value.variant === 'arc'));
}
console.log('[french-migration] rich payload retained as evidence, not flattened: PASS');

{
  const source = deepFreeze(clone(EDITOR_DOC_V7_FULL_FIXTURE));
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated');
  assert.equal(result.migrated, false);
  assert.deepEqual(result.doc, source);
  assert.equal(result.doc.schemaVersion, 7);
  const french = Object.values(source.nails)
    .flatMap((nail) => nail.steps.flatMap((step) => step.kind === 'flat_design' ? step.elements : []))
    .find((element) => element.kind === 'french_edge');
  assert.ok(french);
  assert.equal(Object.prototype.hasOwnProperty.call(french, 'widthRatio'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(french, 'variant'), false);
}
console.log('[french-migration] existing V7 identity migration regression: PASS');
