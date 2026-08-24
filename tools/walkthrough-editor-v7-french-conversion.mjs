import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5216';
const evidenceDir = new URL('../evidence/pr-editor-v0-7-2-french-01/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const viewports = [
  { name: '390', width: 390, height: 844, compact: true },
  { name: '1280', width: 1280, height: 900, compact: false },
];

const canonical = (page) => page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const state = editorV7Store.getState();
  return {
    docJson: JSON.stringify(state.doc),
    l2Json: JSON.stringify(state.doc?.nails.L2),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    future: state.future.length,
    pendingRevision: state.revisionState.pendingRevision,
  };
});

function assertUnchanged(actual, expected, label) {
  for (const key of ['docJson', 'l2Json', 'revision', 'history', 'future', 'pendingRevision']) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
}

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.compact });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();
  await page.evaluate(async () => {
    const { createFullEditorDocV7Fixture } = await import('/src/studio/editor/fixtures/editor-doc-v7.mjs');
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const { createEditorV7RevisionState } = await import('/src/studio/editor/v7/autosave.ts');
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
      selectedStepId: 'step.L1.flat',
      selectedElementId: 'element.L1.french',
      history: [],
      future: [],
      saveState: 'saved',
      saveError: null,
      revisionState: createEditorV7RevisionState(doc.revision),
      switching: false,
    });
  });

  if (viewport.compact) {
    await page.getByRole('button', { name: '层级', exact: true }).click();
    const workspacePanel = page.getByRole('dialog', { name: '层级面板' });
    await workspacePanel.waitFor();
    await workspacePanel.getByRole('button', { name: '属性', exact: true }).click();
    await page.getByRole('dialog', { name: '属性面板' }).waitFor();
  }
  const notice = page.locator('[data-testid="v7-legacy-french-conversion-notice"]:visible');
  await notice.waitFor();
  const trigger = notice.locator('[data-testid="v7-legacy-french-convert"]');
  const triggerSize = await trigger.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  if (triggerSize.height < 43.5) throw new Error(`${viewport.name}: conversion trigger below 44px`);
  if (!await notice.getByText('旧版近似法式', { exact: true }).isVisible()) throw new Error(`${viewport.name}: legacy disclosure missing`);
  if (!await notice.getByText(/22%/).first().isVisible()) throw new Error(`${viewport.name}: legacy width evidence missing`);
  const before = await canonical(page);

  await trigger.click();
  const dialog = page.locator('[data-testid="v7-legacy-french-dialog"]');
  await dialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'v7-french-preset-classic');
  const choices = dialog.locator('[data-testid^="v7-french-preset-"]');
  if (await choices.count() !== 5) throw new Error(`${viewport.name}: expected five explicit presets`);
  const minChoiceHeight = Math.min(...await choices.evaluateAll((elements) => elements.map((element) => element.offsetHeight)));
  if (minChoiceHeight < 55.5) throw new Error(`${viewport.name}: preset target below 56px (${minChoiceHeight})`);
  await dialog.locator('[data-testid="v7-french-preset-classic"]').click();
  const confirm = page.locator('[data-testid="v7-french-conversion-confirm"]');
  if (await confirm.isDisabled()) throw new Error(`${viewport.name}: explicit preset did not enable confirmation`);
  assertUnchanged(await canonical(page), before, `${viewport.name} open/select intent`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-legacy-conversion-prompt.png`, screenshotDir)), fullPage: false });

  if (viewport.compact) await page.keyboard.press('Escape');
  else await page.locator('[data-testid="v7-french-conversion-cancel"]').click();
  await dialog.waitFor({ state: 'detached' });
  assertUnchanged(await canonical(page), before, `${viewport.name} cancel/escape`);
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'v7-legacy-french-convert');

  await trigger.click();
  await dialog.waitFor();
  await dialog.locator('[data-testid="v7-french-preset-soft"]').click();
  await dialog.locator('[data-testid="v7-french-conversion-color"]').evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, '#fef6f0');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assertUnchanged(await canonical(page), before, `${viewport.name} configured intent`);
  await page.locator('[data-testid="v7-french-conversion-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });

  const after = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const { inspectFrenchRecipeProjectionV1 } = await import('/src/studio/editor/v7/french-conversion-v1.ts');
    const state = editorV7Store.getState();
    const nail = state.doc.nails.L1;
    const source = nail.steps.find((step) => step.id === 'step.L1.flat');
    const legacy = source?.kind === 'flat_design' ? source.elements.find((element) => element.id === 'element.L1.french') : null;
    const recipe = Object.values(state.doc.recipeInstances).find((candidate) => candidate.recipeId === 'french-edge');
    const managed = nail.steps.find((step) => step.recipeInstanceId === recipe?.instanceId);
    return {
      revision: state.doc.revision,
      history: state.history.length,
      future: state.future.length,
      pendingRevision: state.revisionState.pendingRevision,
      l2Json: JSON.stringify(state.doc.nails.L2),
      legacyVisible: legacy?.visible,
      legacyLocked: legacy?.locked,
      legacyWidth: legacy?.kind === 'french_edge' ? legacy.widthRatio : null,
      recipePreset: recipe?.parameterValues.preset,
      recipeFillColor: recipe?.parameterValues.fillColor,
      managedStepId: managed?.id ?? null,
      managedLocked: managed?.locked,
      projectionLocked: managed?.kind === 'flat_design' ? managed.elements.every((element) => element.locked) : false,
      projectionValid: managed ? inspectFrenchRecipeProjectionV1(state.doc, 'L1', managed.id).ok : false,
      selectedStepId: state.selectedStepId,
      selectedElementId: state.selectedElementId,
    };
  });
  if (
    after.revision !== before.revision + 1
    || after.history !== before.history + 1
    || after.future !== 0
    || after.pendingRevision !== before.revision + 1
    || after.l2Json !== before.l2Json
    || after.legacyVisible !== false
    || after.legacyLocked !== true
    || after.legacyWidth !== 0.22
    || after.recipePreset !== 'soft'
    || after.recipeFillColor !== '#fef6f0'
    || !after.managedStepId
    || after.managedLocked !== true
    || after.projectionLocked !== true
    || after.projectionValid !== true
    || after.selectedStepId !== after.managedStepId
    || !after.selectedElementId
  ) throw new Error(`${viewport.name}: conversion transaction mismatch ${JSON.stringify(after)}`);
  if (await page.locator('[data-testid="v7-legacy-french-conversion-notice"]:visible').count() !== 0) throw new Error(`${viewport.name}: legacy notice remained selected after conversion`);

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
  }));
  if (layout.scrollWidth > layout.clientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-legacy-converted.png`, screenshotDir)), fullPage: false });
  reports.push({
    viewport,
    triggerSize,
    minChoiceHeight,
    before: { revision: before.revision, history: before.history },
    after: {
      revision: after.revision,
      history: after.history,
      future: after.future,
      pendingRevision: after.pendingRevision,
      otherFingerUnchanged: after.l2Json === before.l2Json,
      legacyVisible: after.legacyVisible,
      legacyLocked: after.legacyLocked,
      legacyWidth: after.legacyWidth,
      recipePreset: after.recipePreset,
      recipeFillColor: after.recipeFillColor,
      managedLocked: after.managedLocked,
      projectionLocked: after.projectionLocked,
      projectionValid: after.projectionValid,
      selectedManagedStep: after.selectedStepId === after.managedStepId,
      selectedManagedElement: Boolean(after.selectedElementId),
    },
    layout,
    consoleErrors,
    pageErrors,
  });
  await context.close();
}

await browser.close();
await writeFile(new URL('legacy-conversion-walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-french-conversion-walkthrough] ${reports.length} viewports passed`);
