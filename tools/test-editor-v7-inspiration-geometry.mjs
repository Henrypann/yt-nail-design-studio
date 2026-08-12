#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { FINGER_CODES } from '../src/lib/types.ts';
import { createFullEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorDocV6MigrationFixture } from '../src/studio/editor/fixtures/editor-doc-v7-migration.mjs';
import { EDITOR_SHAPE_CAPABILITIES, SHAPE_CAPABILITIES_VERSION, SHAPE_PARAMS_VERSION } from '@/studio/editor/lib/material';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { readCustomerPreviewDocV7FromMap } from '../src/studio/editor/v7/customer-preview-repository.ts';
import { createCustomerPreviewScenarioV7, deriveCustomerNailPreviewV7 } from '../src/studio/editor/v7/customer-preview.ts';
import {
  PRODUCT_GEOMETRY_REVISION_V7,
  PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
  combineGeometryPreviewFidelityV7,
  isExactEditorGeometryV7,
  listEditorGeometryRegistryV7,
  resolveBackgroundSilhouetteV7,
  resolveEditorGeometryV7,
  resolveSignedProductGeometryRefV7,
} from '../src/studio/editor/v7/geometry-registry.ts';
import { materializeIndependentEditorDocV7 } from '../src/studio/editor/v7/materialize.ts';
import { EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS } from '../src/studio/editor/v7/migration-resolvers.ts';
import { migrateEditorDocV7 } from '../src/studio/editor/v7/migrate.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { materializeEditorV7NailScope } from '../src/studio/editor/v7/ten-finger-operations.ts';
import { deriveEditorWorkspaceStagesV7, deriveEditorWorkspaceToolsV7 } from '../src/studio/editor/v7/workspace-ia.ts';

const clone = (value) => structuredClone(value);
const root = process.cwd();

function canonicalIds(doc) {
  return [
    doc.designId,
    ...Object.keys(doc.recipeInstances),
    ...FINGER_CODES.flatMap((finger) => doc.nails[finger].steps.flatMap((step) => [
      step.id,
      ...(step.kind === 'flat_design' ? step.elements.map((element) => element.id) : []),
      ...(step.kind === 'dimensional_decoration' ? step.decorations.map((element) => element.id) : []),
    ])),
  ];
}

// Registry is built from material-library metadata; revision and evidence are
// fail-closed, while every preview remains explicitly non-manufacturing.
{
  assert.equal(PRODUCT_GEOMETRY_REVISION_V7, `geometry-v1-p${SHAPE_PARAMS_VERSION}-c${SHAPE_CAPABILITIES_VERSION}-${PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7}`);
  assert.equal(EDITOR_SHAPE_CAPABILITIES.length, 15);
  const registry = listEditorGeometryRegistryV7();
  assert.equal(registry.length, 15 * 4 * 10);
  assert.equal(registry.filter((entry) => entry.evidence === 'signed_off').length, 3 * 4 * 10);
  assert.equal(registry.filter((entry) => entry.evidence === 'generated').length, 4 * 4 * 10);
  assert.equal(registry.filter((entry) => entry.evidence === 'placeholder').length, 8 * 4 * 10);
  assert.equal(registry.filter((entry) => entry.silhouetteAvailable).length, 7 * 4 * 10);

  const exactRef = { assetId: 'geometry.almond.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 };
  const exact = resolveEditorGeometryV7(exactRef, 'L1');
  assert.equal(exact.status, 'resolved');
  assert.equal(exact.fidelity, 'exact');
  assert.equal(exact.evidence, 'signed_off');
  assert.equal(exact.manufacturingValidated, false);
  assert.equal(exact.registryAssetSetSha256, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(isExactEditorGeometryV7(exactRef, 'L1'), true);
  assert.equal(resolveBackgroundSilhouetteV7(exactRef, 'L1').source, 'product');

  const generatedRef = { assetId: 'geometry.square.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 };
  const generated = resolveEditorGeometryV7(generatedRef, 'L1');
  assert.equal(generated.status, 'resolved');
  assert.equal(generated.fidelity, 'approximate');
  assert.equal(generated.evidence, 'generated');
  assert.equal(generated.manufacturingValidated, false);
  assert.equal(resolveBackgroundSilhouetteV7(generatedRef, 'L1').source, 'generated');
  assert.equal(resolveSignedProductGeometryRefV7('square', 'medium', 'L1'), null);

  assert.equal(resolveEditorGeometryV7({ ...exactRef, revision: 'geometry-v0' }, 'L1').reason, 'revision_mismatch');
  assert.equal(resolveEditorGeometryV7(exactRef, 'R1').reason, 'finger_mismatch');
  assert.equal(resolveEditorGeometryV7({ assetId: 'geometry.scan.customer.L1', revision: 'scan-1' }, 'L1').reason, 'unknown_asset');
  assert.equal(resolveEditorGeometryV7({ assetId: 'geometry.arrowhead.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 }, 'L1').reason, 'capability_unavailable');
  assert.equal(combineGeometryPreviewFidelityV7('exact', 'exact'), 'exact');
  assert.equal(combineGeometryPreviewFidelityV7('approximate', 'exact'), 'approximate');
  assert.equal(combineGeometryPreviewFidelityV7('unavailable', 'approximate'), 'unavailable');
  assert.deepEqual(exactRef, { assetId: 'geometry.almond.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 });
  console.log('[v7-inspiration-geometry] strict registry and fidelity: PASS');
}

// Customer-facing fidelity includes geometry truth; a generic fallback can
// never inherit a reassuring label from otherwise renderable content.
{
  const created = createBlankEditorDocV7({ designId: 'design.v715.customer-fidelity', shape: 'almond', length: 'medium' });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error(created.reason);
  const scenario = createCustomerPreviewScenarioV7();
  assert.equal(deriveCustomerNailPreviewV7(created.doc.nails.L1, scenario).fidelity, 'approximate');
  created.doc.nails.L1.geometryRef = { assetId: 'geometry.unknown.L1', revision: 'unknown-1' };
  const unavailable = deriveCustomerNailPreviewV7(created.doc.nails.L1, scenario);
  assert.equal(unavailable.fidelity, 'unavailable');
  assert.ok(unavailable.warnings.some((warning) => warning.includes('通用边界')));
  console.log('[v7-inspiration-geometry] customer overall fidelity: PASS');
}

// The 28 bundled SVG silhouettes are an integrity-locked input. Any asset
// drift requires an explicit revision and test update, not silent promotion.
{
  const directory = path.join(root, 'material-library/shapes/silhouettes');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.svg')).sort();
  assert.equal(files.length, 28);
  const lines = [];
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    lines.push(`${file}:${createHash('sha256').update(bytes).digest('hex')}\n`);
  }
  assert.equal(
    createHash('sha256').update(lines.join('')).digest('hex'),
    PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
  );
  console.log('[v7-inspiration-geometry] 28 silhouette asset digests: PASS');
}

// New documents only bind signed-off geometry. Generated and placeholder
// shapes remain honest preview/read states rather than fake product geometry.
{
  assert.equal(createBlankEditorDocV7({ designId: 'design.v715.exact', shape: 'oval', length: 'long' }).ok, true);
  assert.equal(createBlankEditorDocV7({ designId: 'design.v715.generated', shape: 'square', length: 'medium' }).reason, 'geometry_unavailable');
  assert.equal(createBlankEditorDocV7({ designId: 'design.v715.placeholder', shape: 'arrowhead', length: 'medium' }).reason, 'geometry_unavailable');
  console.log('[v7-inspiration-geometry] creation geometry gate: PASS');
}

// Editor and Customer Preview share one production legacy resolver: signed-off
// geometry migrates, while generated geometry fails closed before replacement.
{
  const legacy = createEditorDocV6MigrationFixture();
  const migrated = migrateEditorDocV7(legacy, EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS);
  assert.ok(migrated.status === 'migrated' || migrated.status === 'migrated_with_warnings');
  for (const finger of FINGER_CODES) {
    assert.equal(migrated.doc.nails[finger].geometryRef.revision, PRODUCT_GEOMETRY_REVISION_V7);
    assert.equal(isExactEditorGeometryV7(migrated.doc.nails[finger].geometryRef, finger), true);
  }
  const preview = readCustomerPreviewDocV7FromMap({ [legacy.designId]: legacy }, legacy.designId);
  assert.equal(preview.status, 'ready');
  const generated = clone(legacy);
  generated.defaultGeometry.shape = 'square';
  assert.equal(migrateEditorDocV7(generated, EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS).status, 'unsupported');
  assert.equal(readCustomerPreviewDocV7FromMap({ [generated.designId]: generated }, generated.designId).status, 'unsupported');
  console.log('[v7-inspiration-geometry] shared production migration resolvers: PASS');
}

// The Community-neutral materializer creates an independent V7 canonical
// document, strips private/live linkage, remaps every canonical node, and never
// mutates the released source.
{
  const source = createFullEditorDocV7Fixture();
  const before = clone(source);
  let nextNode = 0;
  const result = materializeIndependentEditorDocV7(source, {
    sourceRef: { domain: 'community', sourceId: 'look.v715', revision: 'dv.v715.3' },
    title: 'V7.15 Independent Remix',
    now: '2026-08-11T12:00:00.000Z',
  }, {
    nextId: (scope) => scope === 'design' ? 'design.v715.remix' : `node.v715.${++nextNode}`,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.reason);
  assert.deepEqual(source, before);
  assert.equal(result.doc.designId, 'design.v715.remix');
  assert.equal(result.doc.customerRef, undefined);
  assert.equal(result.doc.compositionMeta, undefined);
  assert.deepEqual(result.doc.communicationRefs, []);
  assert.deepEqual(result.doc.sourceRefs, [{ domain: 'community', sourceId: 'look.v715', revision: 'dv.v715.3' }]);
  assert.equal(result.doc.revision, 1);
  for (const finger of FINGER_CODES) assert.equal(result.doc.nails[finger].compositionProvenance, undefined);
  const sourceIds = new Set(canonicalIds(source));
  const targetIds = canonicalIds(result.doc);
  assert.equal(new Set(targetIds).size, targetIds.length);
  assert.equal(targetIds.some((id) => sourceIds.has(id)), false);
  assert.notStrictEqual(result.doc.nails.L1, source.nails.L1);
  assert.notStrictEqual(result.doc.nails.L1.steps, source.nails.L1.steps);
  result.doc.nails.L1.steps[0].background.color.r = 1;
  assert.notEqual(source.nails.L1.steps[0].background.color.r, 1);

  assert.equal(materializeIndependentEditorDocV7({}, {
    sourceRef: { domain: 'manual', sourceId: 'invalid' }, title: 'Invalid', now: '2026-08-11T12:00:00.000Z',
  }, { nextId: () => 'id.valid' }).reason, 'invalid_source');
  assert.equal(materializeIndependentEditorDocV7(source, {
    sourceRef: { domain: 'manual', sourceId: 'invalid-time' }, title: 'Invalid', now: 'not-a-time',
  }, { nextId: () => 'id.valid' }).reason, 'invalid_time');
  assert.equal(materializeIndependentEditorDocV7(source, {
    sourceRef: { domain: 'manual', sourceId: 'collision' }, title: 'Collision', now: '2026-08-11T12:00:00.000Z',
  }, { nextId: () => source.designId }).reason, 'id_collision');
  assert.equal(materializeIndependentEditorDocV7(source, {
    sourceRef: { domain: 'manual', sourceId: 'dependency' }, title: 'Dependency', now: '2026-08-11T12:00:00.000Z',
  }, { nextId: () => { throw new Error('offline'); } }).reason, 'dependency');
  console.log('[v7-inspiration-geometry] neutral independent materializer: PASS');
}

class MemoryStorage {
  constructor(docs) { this.docs = clone(docs); }
  writes = 0;
  read = () => clone(this.docs);
  write = async (next) => { this.docs = clone(next); this.writes += 1; };
}

class FakeTimers {
  next = 1;
  tasks = new Map();
  setTimeout = (callback) => { const id = this.next++; this.tasks.set(id, callback); return id; };
  clearTimeout = (id) => { this.tasks.delete(id); };
}

// Approximate/unavailable geometry stays inspectable, but every spatial writer
// is rejected before ID generation/history/autosave. Background and finish are
// still editable because they do not claim spatial placement fidelity.
{
  const doc = createFullEditorDocV7Fixture();
  doc.nails.L1.geometryRef = { assetId: 'geometry.square.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 };
  const flat = doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.ok(flat);
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  let ids = 0;
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, { resolveGeometry: () => null, resolveFinishPreset: () => null }),
    idFactory: (scope) => `${scope}.v715.${++ids}`,
    now: () => '2026-08-11T12:30:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('L1');
  assert.equal(store.getState().setBackgroundOpacity('L1', 0.8).ok, true, 'background remains editable');
  const baseline = {
    doc: clone(store.getState().doc),
    revision: store.getState().doc.revision,
    history: store.getState().history.length,
    timerCount: timers.tasks.size,
    ids,
    writes: storage.writes,
  };
  assert.equal(store.getState().duplicateStep('L1', flat.id).reason, 'geometry_unavailable');
  assert.equal(store.getState().setFlatElementOpacity('L1', flat.id, flat.elements[0].id, 0.5).reason, 'geometry_unavailable');
  store.getState().setFingerScope('all');
  assert.equal(store.getState().copyFingerScope().reason, 'geometry_unavailable');
  assert.deepEqual(store.getState().doc, baseline.doc);
  assert.equal(store.getState().doc.revision, baseline.revision);
  assert.equal(store.getState().history.length, baseline.history);
  assert.equal(timers.tasks.size, baseline.timerCount);
  assert.equal(ids, baseline.ids);
  assert.equal(storage.writes, baseline.writes);

  let pureIds = 0;
  const pure = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1', scope: { kind: 'mirror', currentFinger: 'L1' }, mode: 'copy-detached',
  }, (scope) => `${scope}.pure.${++pureIds}`);
  assert.equal(pure.reason, 'geometry_unavailable');
  assert.equal(pureIds, 0);

  const tools = deriveEditorWorkspaceToolsV7(doc.nails.L1, { selectedStepId: flat.id });
  assert.equal(tools.find((tool) => tool.id === 'background').status, 'ready');
  assert.equal(tools.find((tool) => tool.id === 'select').status, 'ready');
  assert.equal(tools.find((tool) => tool.id === 'brush').status, 'geometry_unavailable');
  assert.equal(tools.find((tool) => tool.id === 'effects').status, 'geometry_unavailable');
  assert.equal(deriveEditorWorkspaceStagesV7(doc.nails.L1, flat.id)[0].state, 'attention');
  console.log('[v7-inspiration-geometry] spatial writer and UI gates: PASS');
}

console.log('[test:editor-v7-inspiration-geometry] PASS');
