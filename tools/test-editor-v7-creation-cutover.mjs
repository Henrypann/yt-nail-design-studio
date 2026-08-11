#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FINGER_CODES } from '../src/lib/types.ts';
import { createMercuryInstance } from '../src/studio/editor/lib/recipe-model.ts';
import { openBridgeForWriterWithDeps, openBridgeV7WithDeps } from '../src/studio/bridge/index.ts';
import {
  EDITOR_DOC_KNOWN_MAX_VERSION,
  EDITOR_DOC_MIGRATABLE_MAX_VERSION,
  classifyEditorDocSchemaVersion,
} from '../src/studio/editor/lib/editor-doc-schema-version.ts';
import {
  createBlankEditorDocV7,
  wizardDesignToEditorDocV7,
} from '../src/studio/editor/v7/create.ts';
import {
  OFFICIAL_TEMPLATE_PATTERN_ASSET_COUNT_V7,
  identifyOfficialTemplatePatternV7,
} from '../src/studio/editor/v7/official-template-assets.ts';
import { createEditorDocV7InMap } from '../src/studio/editor/v7/repository.ts';
import { resolveBackgroundSilhouetteV7 } from '../src/studio/editor/v7/background.ts';
import { isEditorV7InternalEnabled } from '../src/studio/editor/v7/feature.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await readFile(path.join(root, 'material-library/template-pattern-assets.v7.json'), 'utf8'));

function summary(overrides = {}) {
  return {
    id: 'design.wizard.cutover',
    customerId: 'customer.7',
    title: 'V7 Wizard Cutover',
    shape: 'almond',
    length: 'medium',
    templateId: 't_petal_veil_french',
    baseColor: '#E9B7C8',
    finish: 'gloss',
    fingerOverrides: { R2: { baseColor: '#112233' } },
    status: 'draft',
    source: 'wizard',
    version: 3,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

// Generated official asset registry is complete and every hash is real.
assert.equal(OFFICIAL_TEMPLATE_PATTERN_ASSET_COUNT_V7, registry.assets.length);
assert.equal(registry.assets.length, 84);
for (const asset of registry.assets) {
  const manifestPath = path.join(root, 'material-library/templates', asset.templateId, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const svgPath = path.join(root, 'material-library/templates', asset.templateId, manifest.patterns[asset.shape]);
  const sha256 = createHash('sha256').update(await readFile(svgPath)).digest('hex');
  assert.equal(asset.sha256, sha256, `${asset.templateId}/${asset.shape} hash drift`);
  assert.equal(asset.revision, `template-v${manifest.version}`);
}

// Blank creation is canonical V7 and binds every nail to product geometry.
const blank = createBlankEditorDocV7({
  designId: 'design.blank.v7',
  shape: 'oval',
  length: 'long',
  now: '2026-08-10T01:00:00.000Z',
});
assert.equal(blank.ok, true);
assert.equal(blank.doc.schemaVersion, 7);
assert.equal(Object.keys(blank.doc.nails).length, 10);
for (const finger of FINGER_CODES) {
  assert.equal(blank.doc.nails[finger].geometryRef.assetId, `geometry.oval.long.${finger}`);
  assert.equal(resolveBackgroundSilhouetteV7(blank.doc.nails[finger].geometryRef).source, 'product');
}

// Representable Wizard content becomes V7 without losing template or per-finger color.
const wizard = wizardDesignToEditorDocV7(summary(), '2026-08-10T02:00:00.000Z');
assert.equal(wizard.ok, true);
assert.equal(wizard.doc.schemaVersion, 7);
assert.equal(wizard.doc.customerRef, 'customer.7');
assert.equal(wizard.doc.nails.R2.steps[0].background.color.r, 17);
const allIds = [];
for (const finger of FINGER_CODES) {
  const nail = wizard.doc.nails[finger];
  assert.equal(resolveBackgroundSilhouetteV7(nail.geometryRef).source, 'product');
  const flat = nail.steps.find((step) => step.kind === 'flat_design');
  assert.ok(flat);
  assert.equal(flat.elements.length, 1);
  assert.equal(flat.elements[0].kind, 'image_2d');
  assert.deepEqual(identifyOfficialTemplatePatternV7(flat.elements[0].asset), {
    templateId: 't_petal_veil_french',
    shape: 'almond',
  });
  allIds.push(...nail.steps.map((step) => step.id), ...flat.elements.map((element) => element.id));
}
assert.equal(new Set(allIds).size, allIds.length, 'step/element ids must be globally unique');

// Unsupported semantic content never silently materializes into a lossy V7 doc.
assert.deepEqual(wizardDesignToEditorDocV7(summary({ finish: 'pearl' })).reason, 'unsupported_finish');
const mercury = wizardDesignToEditorDocV7(summary({
  templateId: 't_liquid_velvet_cat_eye',
  recipe: createMercuryInstance(),
}));
assert.equal(mercury.ok, true);
assert.equal(mercury.doc.schemaVersion, 7);
assert.equal(Object.keys(mercury.doc.recipeInstances).length, 1);
for (const finger of FINGER_CODES) {
  const nail = mercury.doc.nails[finger];
  assert.equal(nail.steps[0].kind, 'background');
  assert.equal(nail.steps[0].background.mode, 'cat_eye');
  const relief = nail.steps.find((step) => step.kind === 'dimensional_decoration');
  assert.ok(relief);
  assert.equal(relief.decorations.length, 5);
  assert.equal(relief.previewFidelity, undefined);
  assert.equal(nail.steps.at(-1).kind, 'surface_finish');
}
assert.deepEqual(
  wizardDesignToEditorDocV7(summary({ fingerOverrides: { L1: { decorationId: 'deco.star' } } })).reason,
  'unsupported_decoration',
);

// Create-only persistence rejects overwrite and leaves maps unchanged on invalid input.
const docs = {};
assert.equal(createEditorDocV7InMap(docs, blank.doc).ok, true);
const firstStored = structuredClone(docs);
assert.equal(createEditorDocV7InMap(docs, blank.doc).reason, 'already_exists');
assert.deepEqual(docs, firstStored);
assert.equal(createEditorDocV7InMap(docs, { schemaVersion: 7 }).reason, 'invalid_document');
assert.deepEqual(docs, firstStored);

function bridgeDeps({ probe = { present: false }, convert = wizard, create = { ok: true, doc: wizard.doc } } = {}) {
  const calls = { create: 0, navigate: [] };
  return {
    calls,
    deps: {
      getDesign: () => summary(),
      inspectEditorDoc: () => probe,
      convertDesign: () => convert,
      createEditorDoc: () => { calls.create += 1; return create; },
      navigate: (url) => calls.navigate.push(url),
    },
  };
}

const fresh = bridgeDeps();
assert.deepEqual(openBridgeV7WithDeps(summary().id, fresh.deps), { ok: true, mode: 'created' });
assert.equal(fresh.calls.create, 1);
assert.deepEqual(fresh.calls.navigate, [`/design/canvas?bridge=${summary().id}`]);

for (let version = 1; version <= 7; version += 1) {
  const existing = bridgeDeps({ probe: { present: true, schemaVersion: version } });
  assert.deepEqual(openBridgeV7WithDeps(summary().id, existing.deps), {
    ok: true,
    mode: 'existing',
    writer: version === 7 ? 'v7' : 'v6',
  });
  assert.equal(existing.calls.create, 0, `schema ${version} must not be overwritten`);
}
assert.equal(openBridgeV7WithDeps(summary().id, bridgeDeps({ probe: { present: true, schemaVersion: 8 } }).deps).reason, 'editor_doc_unsupported');
assert.equal(openBridgeV7WithDeps(summary().id, bridgeDeps({ probe: { present: true, schemaVersion: null } }).deps).reason, 'editor_doc_invalid');
const blocked = bridgeDeps({ convert: { ok: false, reason: 'unsupported_recipe', message: 'recipe' } });
assert.equal(openBridgeV7WithDeps(summary().id, blocked.deps).reason, 'v7_content_not_supported');
assert.equal(blocked.calls.create, 0);

let raceProbeCount = 0;
const race = bridgeDeps({ create: { ok: false, reason: 'already_exists', message: 'raced' } });
race.deps.inspectEditorDoc = () => (++raceProbeCount === 1 ? { present: false } : { present: true, schemaVersion: 7 });
assert.deepEqual(openBridgeV7WithDeps(summary().id, race.deps), { ok: true, mode: 'existing', writer: 'v7' });
assert.equal(race.calls.create, 1);

// V7 is default-on; unsupported new content is blocked instead of silently creating V6.
assert.equal(isEditorV7InternalEnabled({}), true);
assert.equal(isEditorV7InternalEnabled({ VITE_EDITOR_V7: '1' }), true);
assert.equal(isEditorV7InternalEnabled({ VITE_EDITOR_V7: '0' }), false);
const v6Calls = { save: 0, navigate: [] };
const v6Deps = {
  getDesign: () => summary({ recipe: createMercuryInstance() }),
  getEditorDoc: () => ({ status: 'missing' }),
  saveEditorDoc: (doc) => { v6Calls.save += 1; return { status: 'ok', doc }; },
  navigate: (url) => v6Calls.navigate.push(url),
};
const unsupportedV7 = bridgeDeps({ convert: { ok: false, reason: 'unsupported_recipe', message: 'recipe preserved in V6' } });
const blockedWithoutFallback = openBridgeForWriterWithDeps(summary().id, true, v6Deps, unsupportedV7.deps);
assert.equal(blockedWithoutFallback.ok, false);
assert.equal(blockedWithoutFallback.reason, 'v7_content_not_supported');
assert.equal(v6Calls.save, 0);

let v7Touched = false;
const disabledV7 = { ...unsupportedV7.deps, getDesign: () => { v7Touched = true; return summary(); } };
const disabled = openBridgeForWriterWithDeps('design.feature.off', false, {
  ...v6Deps,
  getDesign: () => summary({ id: 'design.feature.off', recipe: undefined }),
}, disabledV7);
assert.equal(disabled.ok, true);
assert.equal(v7Touched, false);

assert.equal(EDITOR_DOC_MIGRATABLE_MAX_VERSION, 6);
assert.equal(EDITOR_DOC_KNOWN_MAX_VERSION, 7);
assert.equal(classifyEditorDocSchemaVersion(7).kind, 'supported');
assert.equal(classifyEditorDocSchemaVersion(8).kind, 'unsupported');

const editorPageSource = await readFile(path.join(root, 'src/app/pages/design/EditorPage.tsx'), 'utf8');
const bridgeSource = await readFile(path.join(root, 'src/studio/bridge/index.ts'), 'utf8');
const flatCanvasSource = await readFile(path.join(root, 'src/studio/editor/components/V7FlatDesignCanvas.tsx'), 'utf8');
const flatArtworkSource = await readFile(path.join(root, 'src/studio/editor/components/FlatContentArtworkV7.tsx'), 'utf8');
assert.match(editorPageSource, /if \(v7Enabled\)[\s\S]*createBlankEditorDesignV7/);
assert.match(editorPageSource, /setParams\(\{ design: designId \}/);
assert.doesNotMatch(editorPageSource, /acknowledgeBridge[\s\S]{0,250}loadV6/);
assert.match(bridgeSource, /openBridgeV7WithDeps/);
assert.doesNotMatch(bridgeSource, /v7_content_not_supported[\s\S]{0,300}fallback/);
assert.match(flatCanvasSource, /FlatContentArtworkV7/);
assert.match(flatArtworkSource, /OfficialTemplatePatternV7/);

console.log('[editor-v7-creation-cutover] 84 assets + V7-only creation + Mercury recipe + legacy compatibility: PASS');
