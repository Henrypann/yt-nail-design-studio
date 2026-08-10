import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  createCustomerPreviewScenarioV7,
  deriveCustomerNailPreviewV7,
  deriveCustomerPreviewSetV7,
  setCustomerPreviewBackgroundV7,
  setCustomerPreviewFinishV7,
} from '../src/studio/editor/v7/customer-preview.ts';
import { readCustomerPreviewDocV7FromMap } from '../src/studio/editor/v7/customer-preview-repository.ts';
import {
  captureCustomerPreviewSessionV7,
  clearCustomerPreviewSessionV7,
  readCustomerPreviewSessionV7,
} from '../src/studio/editor/v7/customer-preview-session.ts';

const clone = (value) => structuredClone(value);
const color = { colorSpace: 'srgb', r: 12, g: 34, b: 56, a: 1 };

// Scenario updates are immutable, in-memory-only and never mutate EditorDocV7.
{
  const doc = createFullEditorDocV7Fixture();
  const before = clone(doc);
  const empty = createCustomerPreviewScenarioV7();
  const colored = setCustomerPreviewBackgroundV7(empty, 'L1', color);
  const finished = setCustomerPreviewFinishV7(colored, 'matte');
  assert.deepEqual(empty, { backgroundColors: {}, finishType: null });
  assert.deepEqual(colored.backgroundColors.L1, color);
  assert.equal(finished.finishType, 'matte');
  assert.deepEqual(doc, before);
  assert.deepEqual(setCustomerPreviewBackgroundV7(finished, 'L1', null).backgroundColors, {});
  assert.deepEqual(setCustomerPreviewFinishV7(finished, null).finishType, null);
  console.log('[v7-customer-preview] ephemeral scenario immutability: PASS');
}

// Ten-finger read model includes the whole set and explicitly reports deferred content.
{
  const doc = createFullEditorDocV7Fixture();
  const scenario = setCustomerPreviewFinishV7(createCustomerPreviewScenarioV7(), 'frosted');
  const models = deriveCustomerPreviewSetV7(doc, scenario);
  assert.equal(models.length, 10);
  assert.deepEqual(models.map((model) => model.finger), ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5']);
  const l1 = models[0];
  assert.equal(l1.finishType, 'frosted');
  assert.equal(l1.finishScenarioActive, true);
  assert.equal(l1.flatStepCount, 1);
  assert.ok(l1.flatElementCount > 0);
  assert.ok(l1.unsupportedFlatElementCount > 0);
  assert.ok(l1.deferredSurfaceEffectCount > 0);
  assert.ok(l1.deferredDecorationCount > 0);
  assert.equal(l1.fidelity, 'unavailable');
  assert.ok(l1.warnings.some((warning) => warning.includes('V7-10')));
  assert.ok(l1.warnings.some((warning) => warning.includes('V7-12')));
  assert.ok(l1.warnings.some((warning) => warning.includes('V7-13')));
  assert.equal(models[1].fidelity, 'approximate');
  console.log('[v7-customer-preview] ten-finger fidelity/deferred boundary: PASS');
}

// Hidden/skipped middle steps remain in the document but are not falsely rendered as active preview content.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = clone(doc.nails.L1);
  for (const step of nail.steps.slice(1, -1)) {
    step.visible = false;
    step.skipped = true;
  }
  const model = deriveCustomerNailPreviewV7(nail, createCustomerPreviewScenarioV7());
  assert.equal(model.flatStepCount, 0);
  assert.equal(model.flatElementCount, 0);
  assert.equal(model.deferredSurfaceEffectCount, 0);
  assert.equal(model.deferredDecorationCount, 0);
  assert.equal(model.fidelity, 'approximate');
  console.log('[v7-customer-preview] hidden/skipped preview semantics: PASS');
}

// Session hand-off returns defensive clones and can be discarded without persistence.
{
  const doc = createFullEditorDocV7Fixture();
  captureCustomerPreviewSessionV7(doc);
  const first = readCustomerPreviewSessionV7(doc.designId);
  assert.deepEqual(first, doc);
  first.title = 'mutated clone';
  assert.equal(readCustomerPreviewSessionV7(doc.designId).title, doc.title);
  assert.equal(readCustomerPreviewSessionV7('other-design'), null);
  clearCustomerPreviewSessionV7(doc.designId);
  assert.equal(readCustomerPreviewSessionV7(doc.designId), null);
  console.log('[v7-customer-preview] defensive in-memory hand-off: PASS');
}

// Repository exposes only read results and fails closed for missing/invalid/future documents.
{
  const doc = createMinimalEditorDocV7Fixture();
  const ready = readCustomerPreviewDocV7FromMap({ [doc.designId]: doc }, doc.designId);
  assert.equal(ready.status, 'ready');
  assert.deepEqual(ready.doc, doc);
  ready.doc.title = 'clone';
  assert.equal(doc.title, 'Minimal V7 Contract');
  assert.equal(readCustomerPreviewDocV7FromMap({}, 'missing').status, 'missing');
  assert.equal(readCustomerPreviewDocV7FromMap({ invalid: { schemaVersion: 7 } }, 'invalid').status, 'invalid');
  assert.equal(readCustomerPreviewDocV7FromMap({ future: { ...doc, designId: 'future', schemaVersion: 8 } }, 'future').status, 'unsupported');
  console.log('[v7-customer-preview] fail-closed read-only repository: PASS');
}

// Preview code cannot import canonical writers or persistence write helpers.
{
  const files = [
    'src/app/pages/design/CustomerPreviewPageV7.tsx',
    'src/studio/editor/components/CustomerPreviewShellV7.tsx',
    'src/studio/editor/components/CustomerNailPreviewV7.tsx',
    'src/studio/editor/v7/customer-preview.ts',
    'src/studio/editor/v7/customer-preview-repository.ts',
    'src/studio/editor/v7/customer-preview-session.ts',
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')))).join('\n');
  for (const forbidden of ['store-v7', '/commands', 'writeEnvelope', 'writeData', '.save(']) {
    assert.equal(source.includes(forbidden), false, `preview source must not expose ${forbidden}`);
  }
  const appSource = await readFile(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  const shellSource = await readFile(new URL('../src/studio/editor/components/EditorShellV7.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Routes\.designCustomerPreview/);
  assert.match(shellSource, /captureCustomerPreviewSessionV7/);
  assert.match(shellSource, /saveState === 'saved'/);
  console.log('[v7-customer-preview] writer-zero source boundary and route entry: PASS');
}

console.log('[v7-customer-preview] all checks passed');
