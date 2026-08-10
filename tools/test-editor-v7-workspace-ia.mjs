import { strict as assert } from 'node:assert';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { editorV7Store } from '../src/studio/editor/store-v7.ts';
import {
  deriveEditorWorkspaceStagesV7,
  deriveEditorWorkspaceToolsV7,
  editorWorkspaceStageForStepV7,
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
  assert.equal(stages.find((stage) => stage.id === 'geometry').state, 'attention');
  assert.equal(stages.find((stage) => stage.id === 'customer').state, 'empty');
  assert.equal(stages.find((stage) => stage.id === 'finish').state, 'configured');
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
  assert.equal(editorWorkspaceStageForStepV7(selected), 'personalize');
  console.log('[v7-workspace-ia] hidden/skipped canonical middle steps remain represented: PASS');
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
  assert.equal(tools.find((tool) => tool.id === 'brush').enabled, false);
  assert.equal(tools.find((tool) => tool.id === 'text').enabled, false);
  assert.deepEqual(doc, before);
  console.log('[v7-workspace-ia] empty stage/tool gates do not create canonical content: PASS');
}

// Implemented tools target existing steps; future tools remain explicit and disabled.
{
  const doc = createFullEditorDocV7Fixture();
  const tools = deriveEditorWorkspaceToolsV7(doc.nails.L1);
  for (const id of ['select', 'background', 'brush', 'eraser', 'shape']) {
    assert.equal(tools.find((tool) => tool.id === id).enabled, true, `${id} should be enabled`);
  }
  for (const id of ['text', 'assets', 'effects', 'decorations']) {
    assert.equal(tools.find((tool) => tool.id === id).enabled, false, `${id} should remain unavailable`);
    assert.ok(tools.find((tool) => tool.id === id).reason);
  }
  console.log('[v7-workspace-ia] implemented/future tool boundary: PASS');
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
