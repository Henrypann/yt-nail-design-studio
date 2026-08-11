import { strict as assert } from 'node:assert';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { editorV7Store } from '../src/studio/editor/store-v7.ts';
import {
  deriveEditorWorkspaceStagesV7,
  deriveEditorWorkspaceStepLanesV7,
  deriveEditorWorkspaceToolsV7,
  editorWorkspaceStageForStepV7,
  repairEditorWorkspaceSelectionV7,
} from '../src/studio/editor/v7/workspace-ia.ts';

const clone = (value) => structuredClone(value);

// StageBar is a deterministic read model over canonical nail data and selection.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const before = clone(nail);
  const background = nail.steps[0];
  const stages = deriveEditorWorkspaceStagesV7(nail, background.id);
  assert.deepEqual(deriveEditorWorkspaceStagesV7(nail, background.id), stages);
  assert.deepEqual(nail, before);
  assert.deepEqual(stages.map(({ id, active }) => [id, active]), [
    ['geometry', false],
    ['background', true],
    ['personalize', false],
    ['finish', false],
    ['customer', false],
  ]);
  assert.equal(stages.find((stage) => stage.id === 'geometry').state, 'configured');
  assert.match(stages.find((stage) => stage.id === 'geometry').description, /产品轮廓/);
  assert.equal(stages.find((stage) => stage.id === 'customer').state, 'empty');
  assert.equal(stages.find((stage) => stage.id === 'finish').state, 'configured');
  assert.deepEqual(stages.find((stage) => stage.id === 'personalize').lanes.map((lane) => lane.id), [
    'flat',
    'effects',
    'decorations',
  ]);
  console.log('[v7-workspace-ia] deterministic five-stage read model: PASS');
}

// Personalization summarizes the complete canonical middle sequence, including hidden/skipped steps.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const middle = nail.steps.filter((step) => !['background', 'surface_finish'].includes(step.kind));
  const hidden = middle[0];
  hidden.visible = false;
  const selected = middle.find((step) => step.skipped) ?? middle[0];
  const stages = deriveEditorWorkspaceStagesV7(nail, selected.id);
  const personal = stages.find((stage) => stage.id === 'personalize');
  assert.equal(personal.count, middle.length);
  assert.equal(personal.active, true);
  assert.match(personal.description, new RegExp(`${middle.length} 个步骤`));
  assert.match(personal.description, /跳过/);
  assert.match(personal.description, /隐藏/);
  assert.equal(personal.state, 'attention');
  assert.equal(editorWorkspaceStageForStepV7(selected), 'personalize');
  const lanes = deriveEditorWorkspaceStepLanesV7(nail, selected.id);
  assert.equal(lanes.find((lane) => lane.kind === selected.kind).active, true);
  assert.equal(lanes.reduce((sum, lane) => sum + lane.count, 0), middle.length);
  assert.equal(lanes.find((lane) => lane.kind === hidden.kind).state, 'attention');
  console.log('[v7-workspace-ia] hidden/skipped canonical middle steps remain represented: PASS');
}

// A mixed or fully inactive lane is attention, never a false configured check.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const middle = nail.steps.filter((step) => !['background', 'surface_finish'].includes(step.kind));
  for (const step of middle) step.visible = false;
  const stages = deriveEditorWorkspaceStagesV7(nail, nail.steps[0].id);
  const personal = stages.find((stage) => stage.id === 'personalize');
  assert.equal(personal.state, 'attention');
  assert.ok(personal.lanes.every((lane) => lane.count === 0 || lane.state === 'attention'));
  console.log('[v7-workspace-ia] inactive personalization is attention, not configured: PASS');
}

// Minimal documents keep personalization empty without silently creating a step.
{
  const doc = createMinimalEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const before = clone(doc);
  const stages = deriveEditorWorkspaceStagesV7(nail, nail.steps[0].id);
  const personal = stages.find((stage) => stage.id === 'personalize');
  assert.equal(personal.state, 'empty');
  assert.equal(personal.targetStepId, null);
  const tools = deriveEditorWorkspaceToolsV7(nail);
  for (const id of ['brush', 'text', 'effects', 'decorations']) {
    assert.equal(tools.find((tool) => tool.id === id).enabled, false);
    assert.equal(tools.find((tool) => tool.id === id).status, 'missing_step');
    assert.ok(tools.find((tool) => tool.id === id).reason);
  }
  assert.deepEqual(personal.lanes.map(({ id, state, count }) => ({ id, state, count })), [
    { id: 'flat', state: 'empty', count: 0 },
    { id: 'effects', state: 'empty', count: 0 },
    { id: 'decorations', state: 'empty', count: 0 },
  ]);
  assert.deepEqual(doc, before);
  console.log('[v7-workspace-ia] empty stage/tool gates do not create canonical content: PASS');
}

// Every delivered capability targets the selected compatible step before another repeated step.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const effects = nail.steps.filter((step) => step.kind === 'surface_effect');
  assert.ok(effects.length > 2);
  const selectedEffect = effects[2];
  const tools = deriveEditorWorkspaceToolsV7(nail, { selectedStepId: selectedEffect.id });
  for (const id of ['select', 'background', 'brush', 'eraser', 'shape', 'text', 'assets', 'effects', 'decorations']) {
    assert.equal(tools.find((tool) => tool.id === id).enabled, true, `${id} should be enabled`);
    assert.equal(tools.find((tool) => tool.id === id).status, 'ready');
  }
  assert.equal(tools.find((tool) => tool.id === 'effects').targetStepId, selectedEffect.id);
  assert.equal(tools.find((tool) => tool.id === 'select').targetStepId, selectedEffect.id);
  console.log('[v7-workspace-ia] delivered tools and repeated-kind selection routing: PASS');
}

// Without a compatible selection, a ready repeated step wins over an earlier locked sibling.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const effects = nail.steps.filter((step) => step.kind === 'surface_effect' && !step.skipped);
  assert.ok(effects.length > 1);
  effects[0].locked = true;
  const tools = deriveEditorWorkspaceToolsV7(nail, { selectedStepId: nail.steps[0].id });
  assert.equal(tools.find((tool) => tool.id === 'effects').status, 'ready');
  assert.equal(tools.find((tool) => tool.id === 'effects').targetStepId, effects[1].id);
  console.log('[v7-workspace-ia] ready repeated step is not masked by locked sibling: PASS');
}

// Tool conflict status is deterministic and prioritizes transition/permission before step state.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const effect = nail.steps.find((step) => step.kind === 'surface_effect' && !step.skipped);
  effect.locked = true;
  effect.skipped = true;
  effect.visible = false;
  const selected = { selectedStepId: effect.id };
  assert.equal(deriveEditorWorkspaceToolsV7(nail, selected).find((tool) => tool.id === 'effects').status, 'locked');
  assert.equal(deriveEditorWorkspaceToolsV7(nail, { ...selected, readOnly: true }).find((tool) => tool.id === 'effects').status, 'read_only');
  assert.equal(deriveEditorWorkspaceToolsV7(nail, { ...selected, readOnly: true, switching: true }).find((tool) => tool.id === 'effects').status, 'switching');
  effect.locked = false;
  assert.equal(deriveEditorWorkspaceToolsV7(nail, selected).find((tool) => tool.id === 'effects').status, 'skipped');
  effect.skipped = false;
  assert.equal(deriveEditorWorkspaceToolsV7(nail, selected).find((tool) => tool.id === 'effects').status, 'hidden');
  console.log('[v7-workspace-ia] explicit tool conflict priority: PASS');
}

// Selection repair is pure and never leaves a dangling step or nested element.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const before = clone(nail);
  const flat = nail.steps.find((step) => step.kind === 'flat_design');
  const element = flat.elements[0];
  assert.deepEqual(repairEditorWorkspaceSelectionV7(nail, flat.id, element.id), {
    selectedStepId: flat.id,
    selectedElementId: element.id,
  });
  assert.deepEqual(repairEditorWorkspaceSelectionV7(nail, 'missing-step', element.id), {
    selectedStepId: nail.steps[0].id,
    selectedElementId: null,
  });
  assert.deepEqual(repairEditorWorkspaceSelectionV7(nail, flat.id, 'missing-element'), {
    selectedStepId: flat.id,
    selectedElementId: null,
  });
  assert.deepEqual(nail, before);
  console.log('[v7-workspace-ia] pure step/element selection repair: PASS');
}

// Navigation, selection and tool changes are UI-only: no doc/history/revision/autosave mutation.
{
  const doc = createFullEditorDocV7Fixture();
  const background = doc.nails.L1.steps[0];
  const flat = doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  editorV7Store.setState({
    designId: doc.designId,
    doc,
    sourceVersion: 7,
    sourceToken: JSON.stringify(doc),
    migrated: false,
    diagnostics: [],
    readOnly: false,
    currentFinger: 'L1',
    selectedStepId: background.id,
    selectedElementId: null,
    activeFlatTool: 'select',
    history: [],
    future: [],
    saveState: 'saved',
    saveError: null,
    revisionState: { savedRevision: doc.revision, pendingRevision: null },
    autosaveTimer: null,
    generation: 1,
  });
  const before = editorV7Store.getState();
  const invariant = {
    doc: clone(before.doc),
    history: clone(before.history),
    future: clone(before.future),
    saveState: before.saveState,
    revisionState: clone(before.revisionState),
    autosaveTimer: before.autosaveTimer,
  };
  editorV7Store.getState().selectStep(flat.id);
  editorV7Store.getState().setActiveFlatTool('brush');
  editorV7Store.getState().setCurrentFinger('R2');
  editorV7Store.getState().setCurrentFinger('L1');
  assert.deepEqual(editorV7Store.getState().doc, invariant.doc);
  assert.deepEqual(editorV7Store.getState().history, invariant.history);
  assert.deepEqual(editorV7Store.getState().future, invariant.future);
  assert.equal(editorV7Store.getState().saveState, invariant.saveState);
  assert.deepEqual(editorV7Store.getState().revisionState, invariant.revisionState);
  assert.equal(editorV7Store.getState().autosaveTimer, invariant.autosaveTimer);
  console.log('[v7-workspace-ia] UI-only navigation preserves persistence state: PASS');
}

console.log('[v7-workspace-ia] all checks passed');
