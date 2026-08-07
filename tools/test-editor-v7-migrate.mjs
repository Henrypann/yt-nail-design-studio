import assert from 'node:assert/strict';
import * as repositoryContract from '../src/studio/editor/v7/repository-contract.ts';
import { migrateEditorDocV7 } from '../src/studio/editor/v7/migrate.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import { EDITOR_DOC_V7_FULL_FIXTURE } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { editorDocV6Fixture } from '../src/studio/editor/fixtures/editor-doc-v6.mjs';
import {
  legacyEditorDocFixtures,
} from '../src/studio/editor/fixtures/legacy/index.mjs';
import {
  EDITOR_DOC_V7_FUTURE_FIXTURE,
  EDITOR_DOC_V7_INVALID_FIXTURE,
  createEditorDocV6MigrationFixture,
  createEditorDocV6MissingBackgroundFixture,
  createEditorDocV6MissingFinishFixture,
  createEditorDocV6UnknownLayerFixture,
  createEditorDocV6UnknownRecipeFixture,
} from '../src/studio/editor/fixtures/editor-doc-v7-migration.mjs';

const SHA_A = 'a'.repeat(64);
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

const resolversWithAssets = {
  ...resolvers,
  resolveAsset: ({ category, sourceId }) => ({
    assetId: `asset.migrated.${category}.${sourceId}`,
    revision: 'registry-1',
    kind: category === 'attachment' ? 'mesh' : 'raster',
    mimeType: category === 'attachment' ? 'model/gltf-binary' : 'image/png',
    sha256: SHA_A,
    ...(category === 'attachment' ? {} : { colorSpace: 'srgb', alphaMode: 'straight' }),
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

function assertPureMigration(source, result) {
  const before = JSON.stringify(source);
  assert.equal(JSON.stringify(source), before);
  if (result.status !== 'missing') {
    assert.notEqual(result.original, source);
    assert.deepEqual(result.original, source);
  }
}

function assertCanonical(result) {
  assert.ok(result.status === 'migrated' || result.status === 'migrated_with_warnings');
  const parsed = parseEditorDocV7(result.doc);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.issues));
  assert.deepEqual(parsed.doc, result.doc);
  const serialized = JSON.stringify(result.doc);
  for (const forbidden of ['"order"', '"customerId"', 'data:image', ';base64,', '"dataUrl"']) {
    assert.equal(serialized.includes(forbidden), false, `canonical V7 must not contain ${forbidden}`);
  }
  const ids = [];
  for (const nail of Object.values(result.doc.nails)) {
    for (const step of nail.steps) {
      ids.push(step.id);
      for (const element of step.kind === 'flat_design' ? step.elements : step.kind === 'dimensional_decoration' ? step.decorations : []) ids.push(element.id);
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'all migrated step/element IDs must be globally unique');
}

/* missing / invalid / future */
assert.deepEqual(migrateEditorDocV7(undefined, resolvers), { status: 'missing' });
assert.deepEqual(repositoryContract.getEditorDocV7Result({}, 'missing', resolvers), { status: 'missing' });
{
  const source = clone(EDITOR_DOC_V7_INVALID_FIXTURE);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'invalid');
  assertPureMigration(source, result);
}
{
  const source = clone(EDITOR_DOC_V7_FUTURE_FIXTURE);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.version, 8);
  assertPureMigration(source, result);
}

/* v1-v5 use the existing V6 bridge and remain warning-visible. */
for (const fixture of legacyEditorDocFixtures) {
  const source = deepFreeze(clone(fixture));
  const before = JSON.stringify(source);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(JSON.stringify(source), before, `v${fixture.schemaVersion} input changed`);
  assert.equal(result.status, 'migrated_with_warnings', `v${fixture.schemaVersion} should keep diagnostics`);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'legacy_bridge'));
  assertPureMigration(source, result);
  assertCanonical(result);
  if (fixture.schemaVersion === 3) {
    assert.ok(JSON.stringify(result.legacyEvidence).includes('recipe_fixture'));
    assert.ok(JSON.stringify(result.legacyEvidence).includes('accent'));
  }
  if (fixture.schemaVersion === 5) {
    assert.ok(JSON.stringify(result.legacyEvidence).includes('data:image/png;base64,AA=='));
  }
}

/* Clean V6 resolves without warnings and preserves identity/timestamps/revision. */
{
  const source = deepFreeze(createEditorDocV6MigrationFixture());
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated');
  assert.equal(result.migrated, true);
  assert.equal(result.sourceVersion, 6);
  assert.equal(result.doc.customerRef, source.customerId);
  assert.equal(result.doc.outputIntent, source.outputIntent);
  assert.equal(result.doc.revision, source.revision);
  assert.equal(result.doc.createdAt, source.createdAt);
  assert.equal(result.doc.updatedAt, source.updatedAt);
  assert.equal(result.doc.nails.L1.geometryRef.assetId, 'geometry.almond.medium.L1');
  assertPureMigration(source, result);
  assertCanonical(result);
}

/* Valid V7 is a validation-only identity read. */
{
  const source = deepFreeze(clone(EDITOR_DOC_V7_FULL_FIXTURE));
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated');
  assert.equal(result.migrated, false);
  assert.deepEqual(result.doc, source);
  assertPureMigration(source, result);
  assertCanonical(result);
}

/* Missing/unknown finish becomes gloss with an explicit diagnostic. */
{
  const source = deepFreeze(createEditorDocV6MissingFinishFixture());
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated_with_warnings');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'finish_defaulted'));
  assert.equal(result.doc.nails.L1.steps.at(-1).finish.type, 'gloss');
  assertPureMigration(source, result);
  assertCanonical(result);
}

/* Unresolved geometry is unsupported, never silently substituted. */
{
  const source = deepFreeze(createEditorDocV6MigrationFixture());
  const result = migrateEditorDocV7(source, { ...resolvers, resolveGeometry: () => null });
  assert.equal(result.status, 'unsupported');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'geometry_unresolved'));
  assertPureMigration(source, result);
}

/* Unknown layer and recipe remain visible in warning/evidence sidecars. */
for (const [source, code] of [
  [createEditorDocV6UnknownLayerFixture(), 'unknown_layer_type'],
  [createEditorDocV6UnknownRecipeFixture(), 'recipe_preserved_with_warning'],
]) {
  deepFreeze(source);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated_with_warnings');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code));
  assert.ok(result.legacyEvidence.length > 0);
  if (code === 'unknown_layer_type') assert.ok(JSON.stringify(result.legacyEvidence).includes('vendor.legacy.visual'));
  if (code === 'recipe_preserved_with_warning') assert.ok(JSON.stringify(result.legacyEvidence).includes('opaqueLegacyBody'));
  assertPureMigration(source, result);
  assertCanonical(result);
}

/* Finish preset resolution is mandatory; no fabricated registry reference is allowed. */
{
  const source = deepFreeze(createEditorDocV6MigrationFixture());
  const result = migrateEditorDocV7(source, { ...resolvers, resolveFinishPreset: () => null });
  assert.equal(result.status, 'unsupported');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'finish_preset_unresolved'));
}

/* Invalid recipe resolver output falls back to warning-visible legacy identity. */
{
  const source = deepFreeze(createEditorDocV6UnknownRecipeFixture());
  const result = migrateEditorDocV7(source, {
    ...resolvers,
    resolveRecipe: () => ({
      recipeId: '',
      recipeRevision: '',
      parameterValues: { bad: { nested: true } },
    }),
  });
  assert.equal(result.status, 'migrated_with_warnings');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'recipe_resolver_rejected'));
  assertCanonical(result);
}

/* Inline communication evidence stays outside canonical V7 unless resolved to an asset. */
{
  const source = deepFreeze(clone(editorDocV6Fixture));
  const unresolved = migrateEditorDocV7(source, resolvers);
  assert.equal(unresolved.status, 'migrated_with_warnings');
  assert.ok(unresolved.diagnostics.some((diagnostic) => diagnostic.code === 'communication_asset_unresolved'));
  assert.ok(JSON.stringify(unresolved.legacyEvidence).includes('data:image/png;base64,AA=='));
  assert.equal(JSON.stringify(unresolved.doc).includes('data:image'), false);

  const resolved = migrateEditorDocV7(source, resolversWithAssets);
  assertCanonical(resolved);
  assert.equal(resolved.doc.communicationRefs.length, 1);
  assert.equal(resolved.doc.communicationRefs[0].asset.assetId, 'asset.migrated.communication.communication_fixture_01');
}

/* An unresolved inline image stays in evidence and never becomes a fake asset. */
{
  const source = createEditorDocV6MigrationFixture();
  source.nails.L1.layers.push({
    id: 'layer_v6_image_L1', name: 'Inline image', typeId: 'builtin.art_2d',
    visible: true, locked: false, order: 1,
    elements: [{
      id: 'element_v6_image_L1', domain: 'pattern', kind: 'image', visible: true,
      locked: false, order: 0, dataUrl: 'data:image/png;base64,AA==',
    }],
  });
  deepFreeze(source);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated_with_warnings');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'asset_unresolved'));
  assert.ok(JSON.stringify(result.legacyEvidence).includes('data:image/png;base64,AA=='));
  assertCanonical(result);
}

/* Missing background is structural invalidity, not a guessed default. */
{
  const source = deepFreeze(createEditorDocV6MissingBackgroundFixture());
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'invalid');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'background_cardinality'));
  assertPureMigration(source, result);
}

/* Diagnostics and evidence are bounded under hostile legacy volume. */
{
  const source = createEditorDocV6MigrationFixture();
  for (let index = 0; index < 220; index += 1) {
    source.nails.L1.layers.push({
      id: `layer_v6_unknown_${index}`,
      name: `Unknown ${index}`,
      typeId: `vendor.legacy.${index}`,
      visible: true,
      locked: false,
      order: index + 1,
      elements: [],
    });
  }
  deepFreeze(source);
  const result = migrateEditorDocV7(source, resolvers);
  assert.equal(result.status, 'migrated_with_warnings');
  assert.equal(result.diagnostics.length, 200);
  assert.equal(result.legacyEvidence.length, 200);
  assertCanonical(result);
}

/* Repository read is pure and detects key/designId mismatch. */
{
  const source = createEditorDocV6MigrationFixture();
  const docs = deepFreeze({ requested: source });
  const before = JSON.stringify(docs);
  const result = repositoryContract.getEditorDocV7Result(docs, 'requested', resolvers);
  assert.equal(result.status, 'invalid');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'storage_key_mismatch'));
  assert.equal(JSON.stringify(docs), before);
}

/* A later structural error displaces an earlier warning when the cap is full. */
{
  const source = createEditorDocV6MigrationFixture();
  for (let index = 0; index < 205; index += 1) {
    source.nails.L1.layers.push({
      id: `layer_v6_capped_${index}`,
      name: `Capped ${index}`,
      typeId: `vendor.capped.${index}`,
      visible: true,
      locked: false,
      order: index + 1,
      elements: [],
    });
  }
  source.nails.L2.layers = [];
  const result = migrateEditorDocV7(deepFreeze(source), resolvers);
  assert.equal(result.status, 'invalid');
  assert.equal(result.diagnostics.length, 200);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'background_cardinality' && diagnostic.severity === 'error'));
}

/* No V7 writer/save API is exposed by the PR-V7-02 repository boundary. */
/* Unsupported/invalid reads retain their primary status and surface raw key mismatch. */
for (const raw of [EDITOR_DOC_V7_FUTURE_FIXTURE, EDITOR_DOC_V7_INVALID_FIXTURE]) {
  const docs = deepFreeze({ requested: clone(raw) });
  const result = repositoryContract.getEditorDocV7Result(docs, 'requested', resolvers);
  assert.ok(result.status === 'unsupported' || result.status === 'invalid');
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'storage_key_mismatch'));
}

/* A dangling V6 recipe reference is rejected by the V6 bridge before V7 construction. */
{
  const source = createEditorDocV6MigrationFixture();
  source.nails.L1.layers[0].recipeInstanceId = 'recipe.missing';
  const result = migrateEditorDocV7(deepFreeze(source), resolvers);
  assert.equal(result.status, 'invalid');
}

assert.equal(Object.keys(repositoryContract).some((key) => /save|write|create/i.test(key)), false);

console.log('EditorDocV7 migration: v1-v7/future/invalid/missing matrix passed');
