import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  PROCESS_STEP_REGISTRY_V7,
  PROCESS_STEP_TYPE_IDS_V7,
} from '../src/studio/editor/v7/registry.ts';
import {
  isEditorV7InternalEnabled,
  resolveEditorWriterRoute,
} from '../src/studio/editor/v7/feature.ts';
import { editorV7Store } from '../src/studio/editor/store-v7.ts';
import {
  getProcessStepWorkspacePolicyV7,
  hasCanonicalProcessStepOrderV7,
} from '../src/studio/editor/v7/workspace.ts';

assert.equal(isEditorV7InternalEnabled({ VITE_EDITOR_V7: '1' }), true);
assert.equal(isEditorV7InternalEnabled({ VITE_EDITOR_V7: 'true' }), true);
assert.equal(isEditorV7InternalEnabled({}), true);
assert.equal(isEditorV7InternalEnabled({ VITE_EDITOR_V7: '0' }), false);
assert.equal(resolveEditorWriterRoute({ present: true, schemaVersion: 7 }, true), 'v7-edit');
assert.equal(resolveEditorWriterRoute({ present: true, schemaVersion: 7 }, false), 'v7-readonly');
assert.equal(resolveEditorWriterRoute({ present: true, schemaVersion: 6 }, true), 'v6');
assert.equal(resolveEditorWriterRoute({ present: true, schemaVersion: 8 }, true), 'recovery');
assert.equal(resolveEditorWriterRoute({ present: true, schemaVersion: null, kind: 'invalid' }, true), 'recovery');
assert.equal(resolveEditorWriterRoute({ present: false }, true), 'missing');
console.log('[v7-workspace] schema-selected writer and explicit flag: PASS');

const expectedTools = {
  background: ['background_fill', 'color_picker', 'gradient', 'cat_eye', 'glitter'],
  flat_design: ['select', 'brush', 'eraser', 'shape', 'french', 'text', 'import_2d', 'mask'],
  surface_effect: ['select', 'mask', 'cat_eye', 'glitter', 'mirror', 'ink_bloom'],
  dimensional_decoration: ['select', 'relief', 'attachment'],
  surface_finish: ['finish_picker', 'preview_3d'],
};
for (const definition of Object.values(PROCESS_STEP_REGISTRY_V7)) {
  assert.deepEqual(definition.allowedTools, expectedTools[definition.kind]);
  assert.ok(definition.allowedTools.length > 0);
}
assert.equal(PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.background].position, 'first');
assert.equal(PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.background].deletable, false);
assert.equal(PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.surface_finish].position, 'last');
assert.equal(PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.surface_finish].movable, false);
assert.equal(PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.surface_finish].skippable, false);
console.log('[v7-workspace] registry is the tool and structural gate: PASS');

const doc = createFullEditorDocV7Fixture();
editorV7Store.setState({
  designId: doc.designId,
  doc,
  sourceVersion: 7,
  sourceToken: JSON.stringify(doc),
  migrated: false,
  diagnostics: [],
  readOnly: false,
  currentFinger: 'L1',
  selectedStepId: doc.nails.L1.steps[0].id,
  selectedElementId: null,
  history: [],
  future: [],
  saveState: 'saved',
  saveError: null,
  revisionState: { savedRevision: doc.revision, pendingRevision: null },
  autosaveTimer: null,
  generation: 1,
});

const revisionBeforeSelection = editorV7Store.getState().doc.revision;
editorV7Store.getState().selectStep(doc.nails.L1.steps[1].id);
editorV7Store.getState().setCurrentFinger('R2');
assert.equal(editorV7Store.getState().doc.revision, revisionBeforeSelection);
editorV7Store.getState().setCurrentFinger('L1');
const flat = editorV7Store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
assert.equal(editorV7Store.getState().setStepFlag('L1', flat.id, 'visible', false).ok, true);
assert.equal(editorV7Store.getState().doc.revision, revisionBeforeSelection + 1);
clearTimeout(editorV7Store.getState().autosaveTimer);
editorV7Store.setState({
  autosaveTimer: null,
  readOnly: true,
  revisionState: {
    savedRevision: editorV7Store.getState().doc.revision,
    pendingRevision: null,
  },
  saveState: 'saved',
});
console.log('[v7-workspace] UI-only selection and one-revision document action: PASS');

const steps = editorV7Store.getState().doc.nails.L1.steps;
assert.equal(hasCanonicalProcessStepOrderV7(steps), true);
assert.deepEqual(getProcessStepWorkspacePolicyV7(steps, 0), {
  canMoveUp: false, canMoveDown: false, canDelete: false,
  canDuplicate: false, canSkip: false, canHide: true,
});
assert.deepEqual(getProcessStepWorkspacePolicyV7(steps, steps.length - 1), {
  canMoveUp: false, canMoveDown: false, canDelete: false,
  canDuplicate: false, canSkip: false, canHide: false,
});
const middleIndex = steps.findIndex((step) => step.kind === 'flat_design');
assert.equal(getProcessStepWorkspacePolicyV7(steps, middleIndex).canDelete, true);
assert.equal(getProcessStepWorkspacePolicyV7(steps, middleIndex).canDuplicate, true);
console.log('[v7-workspace] canonical presentation policies: PASS');

console.log('[v7-workspace] all checks passed');
