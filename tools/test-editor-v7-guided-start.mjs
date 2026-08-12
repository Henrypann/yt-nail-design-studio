import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import {
  deriveEditorWorkspaceStagesV7,
  deriveEditorWorkspaceToolsV7,
} from '../src/studio/editor/v7/workspace-ia.ts';

const clone = (value) => structuredClone(value);
const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };

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
  clearTimeout = (id) => this.tasks.delete(id);
}

function runtime(doc, idCounter = { value: 0 }) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-11T14:20:00.000Z',
    idFactory: (prefix) => `${prefix}.guided.${++idCounter.value}`,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  return { idCounter, storage, timers, store };
}

function invariant(state) {
  return {
    doc: clone(state.doc),
    history: clone(state.history),
    future: clone(state.future),
    revisionState: clone(state.revisionState),
    saveState: state.saveState,
    selectedStepId: state.selectedStepId,
    selectedElementId: state.selectedElementId,
    autosaveTimer: state.autosaveTimer,
  };
}

function assertInvariant(state, before) {
  assert.deepEqual(invariant(state), before);
}

const cases = [
  { kind: 'flat_design', tool: 'brush', lane: 'flat' },
  { kind: 'surface_effect', tool: 'effects', lane: 'effects' },
  { kind: 'dimensional_decoration', tool: 'decorations', lane: 'decorations' },
];

// Each guided confirm materializes one canonical step in one transaction.
for (const testCase of cases) {
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = `design.guided.${testCase.kind}`;
  const otherNails = Object.fromEntries(Object.entries(doc.nails).filter(([finger]) => finger !== 'L1').map(([finger, nail]) => [finger, clone(nail)]));
  const { store, storage, timers } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('L1');
  const baseRevision = store.getState().doc.revision;
  const beforeConfirm = invariant(store.getState());
  const missingTool = deriveEditorWorkspaceToolsV7(store.getState().doc.nails.L1, {
    selectedStepId: store.getState().selectedStepId,
  }).find((tool) => tool.id === testCase.tool);
  assert.equal(missingTool.status, 'missing_step');
  assert.equal(missingTool.requiredStepKind, testCase.kind);
  assertInvariant(store.getState(), beforeConfirm);

  assert.deepEqual(store.getState().addMissingPersonalStep('L1', testCase.kind), { ok: true });
  const state = store.getState();
  const middle = state.doc.nails.L1.steps.filter((step) => !['background', 'surface_finish'].includes(step.kind));
  assert.equal(middle.length, 1);
  assert.equal(middle[0].kind, testCase.kind);
  assert.equal(state.selectedStepId, middle[0].id);
  assert.equal(state.selectedElementId, null);
  assert.equal(state.doc.revision, baseRevision + 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.future.length, 0);
  assert.equal(state.revisionState.pendingRevision, baseRevision + 1);
  assert.equal(timers.tasks.size, 1);
  assert.equal(storage.writes, 0);
  assert.equal(parseEditorDocV7(state.doc).ok, true);
  for (const [finger, nail] of Object.entries(otherNails)) assert.deepEqual(state.doc.nails[finger], nail);

  const stages = deriveEditorWorkspaceStagesV7(state.doc.nails.L1, state.selectedStepId);
  const personalization = stages.find((stage) => stage.id === 'personalize');
  assert.equal(personalization.active, true);
  assert.equal(personalization.count, 1);
  assert.equal(personalization.lanes.find((lane) => lane.id === testCase.lane).state, 'configured');
  assert.equal(personalization.lanes.find((lane) => lane.id === testCase.lane).active, true);
  const readyTool = deriveEditorWorkspaceToolsV7(state.doc.nails.L1, { selectedStepId: state.selectedStepId })
    .find((tool) => tool.id === testCase.tool);
  assert.equal(readyTool.status, 'ready');
  assert.equal(readyTool.targetStepId, middle[0].id);

  const beforeSecondConfirm = invariant(state);
  const timerCount = timers.tasks.size;
  const second = store.getState().addMissingPersonalStep('L1', testCase.kind);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'not_allowed');
  assertInvariant(store.getState(), beforeSecondConfirm);
  assert.equal(timers.tasks.size, timerCount);

  assert.equal(store.getState().undo().ok, true);
  const undone = store.getState();
  assert.equal(undone.doc.nails.L1.steps.length, 2);
  assert.equal(undone.doc.nails.L1.steps[0].kind, 'background');
  assert.equal(undone.doc.nails.L1.steps.at(-1).kind, 'surface_finish');
  assert.equal(undone.selectedStepId, undone.doc.nails.L1.steps[0].id);
  assert.equal(parseEditorDocV7(undone.doc).ok, true);
  console.log(`[v7-guided-start] ${testCase.kind} one-confirm transaction and undo: PASS`);
}

// Permission/transition gates run before ID allocation and keep all runtime state unchanged.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.guided.permissions';
  const counter = { value: 0 };
  const { store, timers, storage } = runtime(doc, counter);
  assert.equal(await store.getState().load(doc.designId, { readOnly: true }), 'ok');
  const beforeReadOnly = invariant(store.getState());
  assert.equal(store.getState().addMissingPersonalStep('L1', 'flat_design').reason, 'read_only');
  assertInvariant(store.getState(), beforeReadOnly);
  assert.equal(counter.value, 0);
  assert.equal(timers.tasks.size, 0);
  assert.equal(storage.writes, 0);

  store.setState({ readOnly: false, switching: true });
  const beforeSwitching = invariant(store.getState());
  assert.equal(store.getState().addMissingPersonalStep('L1', 'surface_effect').reason, 'busy');
  assertInvariant(store.getState(), beforeSwitching);
  assert.equal(counter.value, 0);
  assert.equal(timers.tasks.size, 0);
  assert.equal(storage.writes, 0);
  console.log('[v7-guided-start] permission gates are writer-zero before ID allocation: PASS');
}

// Hidden/skipped/locked authoring gates are canonical, not only disabled UI.
{
  const doc = createFullEditorDocV7Fixture();
  doc.designId = 'design.guided.inactive-gates';
  const { store, timers } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('L1');
  const nail = store.getState().doc.nails.L1;
  const background = nail.steps[0];
  const flat = nail.steps.find((step) => step.kind === 'flat_design');
  const flatElement = flat.elements.find((element) => !element.locked);
  const effect = nail.steps.find((step) => step.kind === 'surface_effect' && !step.skipped);
  const decorationStep = nail.steps.find((step) => step.kind === 'dimensional_decoration');
  const decoration = decorationStep.decorations.find((element) => !element.locked);

  assert.equal(store.getState().setStepFlag('L1', background.id, 'visible', false).ok, true);
  let beforeBlocked = invariant(store.getState());
  assert.equal(store.getState().setBackgroundOpacity('L1', 0.42).reason, 'not_allowed');
  assertInvariant(store.getState(), beforeBlocked);

  assert.equal(store.getState().setStepFlag('L1', flat.id, 'skipped', true).ok, true);
  beforeBlocked = invariant(store.getState());
  assert.equal(store.getState().removeElement('L1', flat.id, flatElement.id).reason, 'not_allowed');
  assertInvariant(store.getState(), beforeBlocked);

  assert.equal(store.getState().setStepFlag('L1', effect.id, 'visible', false).ok, true);
  beforeBlocked = invariant(store.getState());
  assert.equal(store.getState().setSurfaceEffect('L1', effect.id, clone(effect.effect)).reason, 'not_allowed');
  assertInvariant(store.getState(), beforeBlocked);

  assert.equal(store.getState().setStepFlag('L1', decorationStep.id, 'skipped', true).ok, true);
  beforeBlocked = invariant(store.getState());
  assert.equal(store.getState().replaceDimensionalDecoration('L1', decorationStep.id, decoration.id, clone(decoration)).reason, 'not_allowed');
  assertInvariant(store.getState(), beforeBlocked);

  assert.ok(timers.tasks.size > 0, 'flag recovery commands remain canonical writes');
  console.log('[v7-guided-start] inactive steps reject background, flat, effect and dimensional authoring: PASS');
}

// Recovery flag commands are idempotent; a stale/double confirmation cannot add history.
{
  const doc = createFullEditorDocV7Fixture();
  doc.designId = 'design.guided.flag-idempotency';
  const { store, timers } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  const flat = store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'locked', true).ok, true);
  const locked = invariant(store.getState());
  const timerCount = timers.tasks.size;
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'locked', true).reason, 'not_allowed');
  assertInvariant(store.getState(), locked);
  assert.equal(timers.tasks.size, timerCount);
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'locked', false).ok, true);
  const unlocked = invariant(store.getState());
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'locked', false).reason, 'not_allowed');
  assertInvariant(store.getState(), unlocked);
  console.log('[v7-guided-start] stale recovery confirmation is writer-zero: PASS');
}

// The blank-canvas UI exposes the same lane -> tool -> step mapping as the pure read model.
{
  const files = [
    'src/studio/editor/components/EditorGuidedStartV7.tsx',
    'src/studio/editor/components/EditorStageBarV7.tsx',
    'src/studio/editor/components/EditorToolRailV7.tsx',
    'src/studio/editor/components/EditorWorkspaceIntentNoticeV7.tsx',
    'src/studio/editor/components/LayerPanelV7.tsx',
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')))).join('\n');
  assert.match(source, /v7-guided-flow/);
  assert.match(source, /data-lane-tool/);
  assert.match(source, /data-target-step-id/);
  assert.match(source, /data-step-selected/);
  assert.match(source, /恢复后同步高亮/);
  console.log('[v7-guided-start] UI lane/tool/layer mapping contract: PASS');
}

console.log('[v7-guided-start] all checks passed');
