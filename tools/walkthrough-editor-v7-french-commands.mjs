import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5216';
const evidenceDir = new URL('../evidence/pr-editor-v0-7-2-french-03/', import.meta.url);
const shots = new URL('./screenshots/', evidenceDir);
const viewports = [
  { width: 390, height: 844, full: true },
  { width: 768, height: 900, full: false },
  { width: 1024, height: 900, full: false },
  { width: 1280, height: 900, full: true },
  { width: 1366, height: 900, full: false },
  { width: 1440, height: 900, full: false },
];

const canonical = (page) => page.evaluate(() => {
  const state = window.__frenchEditorStore.getState();
  const storage = Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)]);
  return {
    docJson: JSON.stringify(state.doc),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    future: state.future.length,
    pendingRevision: state.revisionState.pendingRevision,
    storageJson: JSON.stringify(storage),
  };
});

function assertWriterZero(actual, expected, label) {
  for (const key of ['docJson', 'revision', 'history', 'future', 'pendingRevision', 'storageJson']) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
}

async function setInput(page, selector, value) {
  await page.locator(selector).evaluate((input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function openCompactInspector(page) {
  const resourceDialog = page.getByRole('dialog', { name: '当前层工具与参数' });
  if (await resourceDialog.count()) await resourceDialog.getByRole('button', { name: '关闭资源', exact: true }).click();
  await page.locator('button[aria-label="属性"]:visible').click();
  await page.getByRole('dialog', { name: '属性面板' }).waitFor();
}

await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 800 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();
  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    window.__frenchEditorStore = editorV7Store;
    editorV7Store.getState().setCurrentFinger('L1');
  });
  await page.locator('[data-start-kind="flat_design"]').click();
  const intent = page.locator('[data-testid="v7-tool-conflict"]');
  await intent.waitFor();
  await intent.getByRole('button', { name: '添加平面设计并继续', exact: true }).click();
  await page.locator('[data-tool="french"]:visible').click();
  await page.getByRole('button', { name: '添加法式', exact: true }).waitFor();

  const beforeDraft = await canonical(page);
  await page.getByRole('button', { name: '添加法式', exact: true }).click();
  const dialog = page.locator('[data-testid="v7-managed-french-create-dialog"]');
  await dialog.waitFor();
  await page.waitForTimeout(250);
  const focusState = await page.evaluate(() => ({
    activeTag: document.activeElement?.tagName ?? null,
    activeTestId: document.activeElement?.getAttribute('data-testid') ?? null,
    activeLabel: document.activeElement?.getAttribute('aria-label') ?? null,
    activeText: document.activeElement?.textContent?.trim() ?? null,
    classicCount: document.querySelectorAll('[data-testid="v7-managed-french-create-preset-classic"]').length,
  }));
  if (focusState.activeTestId !== 'v7-managed-french-create-preset-classic') throw new Error(`${viewport.width}: create dialog focus mismatch ${JSON.stringify(focusState)}`);
  const createTargets = dialog.locator('[data-testid^="v7-managed-french-create-preset-"], [data-testid^="v7-managed-french-create-scope-"]');
  const targetHeights = await createTargets.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  if (targetHeights.some((height) => height < 43.5)) throw new Error(`${viewport.width}: French create target below 44px`);
  await dialog.locator('[data-testid="v7-managed-french-create-preset-soft"]').click();
  await dialog.locator('[data-testid="v7-managed-french-create-scope-mirror"]').click();
  await setInput(page, '[data-testid="v7-managed-french-create-color"]', '#fef2f5');
  await setInput(page, '[data-testid="v7-managed-french-create-opacity"]', '86');
  assertWriterZero(await canonical(page), beforeDraft, `${viewport.width} create draft`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assertWriterZero(await canonical(page), beforeDraft, `${viewport.width} create cancel`);

  const basicLayout = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (basicLayout.scrollWidth > basicLayout.clientWidth + 1) throw new Error(`${viewport.width}: document overflow after cancel`);

  if (!viewport.full) {
    if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.width}: runtime errors`);
    reports.push({ viewport: viewport.width, mode: 'layout-focus-cancel', status: 'passed', minTargetHeight: Math.min(...targetHeights), overflow: false, consoleErrors: 0, pageErrors: 0 });
    await context.close();
    continue;
  }

  await page.getByRole('button', { name: '添加法式', exact: true }).click();
  await dialog.waitFor();
  await dialog.locator('[data-testid="v7-managed-french-create-preset-soft"]').click();
  await dialog.locator('[data-testid="v7-managed-french-create-scope-mirror"]').click();
  await setInput(page, '[data-testid="v7-managed-french-create-color"]', '#fef2f5');
  await setInput(page, '[data-testid="v7-managed-french-create-opacity"]', '86');
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-create-mirror.png`, shots)), fullPage: false });
  await page.locator('[data-testid="v7-managed-french-create-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });
  if (!await page.locator('[data-testid="v7-managed-french-panel"]:visible').count()) await openCompactInspector(page);
  await page.locator('[data-testid="v7-managed-french-panel"]').waitFor();

  const afterCreate = await page.evaluate(async () => {
    const state = window.__frenchEditorStore.getState();
    const { inspectFrenchRecipeProjectionV1 } = await import('/src/studio/editor/v7/french-conversion-v1.ts');
    const describe = (finger) => {
      const step = state.doc.nails[finger].steps.filter((candidate) => candidate.recipeInstanceId).at(-1);
      const recipe = step ? state.doc.recipeInstances[step.recipeInstanceId] : null;
      return {
        stepId: step?.id ?? null,
        recipeId: step?.recipeInstanceId ?? null,
        preset: recipe?.parameterValues.preset ?? null,
        fillColor: recipe?.parameterValues.fillColor ?? null,
        fillOpacity: recipe?.parameterValues.fillOpacity ?? null,
        projectionValid: step ? inspectFrenchRecipeProjectionV1(state.doc, finger, step.id).ok : false,
      };
    };
    return { revision: state.doc.revision, history: state.history.length, future: state.future.length, L1: describe('L1'), R1: describe('R1') };
  });
  if (afterCreate.revision !== beforeDraft.revision + 1 || afterCreate.history !== beforeDraft.history + 1 || afterCreate.future !== 0) throw new Error(`${viewport.width}: mirror create was not one transaction`);
  if (!afterCreate.L1.projectionValid || !afterCreate.R1.projectionValid || afterCreate.L1.recipeId === afterCreate.R1.recipeId || afterCreate.L1.stepId === afterCreate.R1.stepId) throw new Error(`${viewport.width}: mirror IDs/projection invalid`);
  if (afterCreate.L1.preset !== 'soft' || afterCreate.R1.preset !== 'soft' || afterCreate.L1.fillColor !== '#fef2f5' || afterCreate.L1.fillOpacity !== 0.86) throw new Error(`${viewport.width}: create parameters mismatch`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-mirror-result.png`, shots)), fullPage: false });

  const tip = page.locator('[data-testid="v7-managed-french-tip-width"]');
  const beforeTip = await canonical(page);
  await setInput(page, '[data-testid="v7-managed-french-tip-width"]', '0.46');
  await page.waitForTimeout(0);
  await tip.dispatchEvent('pointerup');
  await tip.blur();
  await page.waitForFunction((revision) => window.__frenchEditorStore.getState().doc.revision === revision + 1, beforeTip.revision);
  const afterTip = await canonical(page);
  if (afterTip.history !== beforeTip.history + 1) throw new Error(`${viewport.width}: pointerup/blur double committed`);

  const beforeOverride = await page.evaluate(() => {
    const state = window.__frenchEditorStore.getState();
    return { l1: JSON.stringify(state.doc.nails.L1), revision: state.doc.revision, history: state.history.length };
  });
  await page.evaluate(() => {
    const store = window.__frenchEditorStore;
    store.getState().setCurrentFinger('R1');
    const step = store.getState().doc.nails.R1.steps.filter((candidate) => candidate.recipeInstanceId).at(-1);
    store.getState().selectStep(step.id);
    store.getState().selectElement(step.elements[0].id);
  });
  await page.locator('[data-testid="v7-managed-french-panel"]').waitFor();
  await page.locator('[data-testid="v7-managed-french-scope-current"]').click();
  await page.locator('[data-testid="v7-managed-french-preset-deep"]').click();
  await page.waitForFunction((revision) => window.__frenchEditorStore.getState().doc.revision === revision + 1, beforeOverride.revision);
  const override = await page.evaluate((before) => {
    const state = window.__frenchEditorStore.getState();
    const step = state.doc.nails.R1.steps.filter((candidate) => candidate.recipeInstanceId).at(-1);
    return { l1Unchanged: JSON.stringify(state.doc.nails.L1) === before.l1, revision: state.doc.revision, history: state.history.length, preset: state.doc.recipeInstances[step.recipeInstanceId].parameterValues.preset };
  }, beforeOverride);
  if (!override.l1Unchanged || override.revision !== beforeOverride.revision + 1 || override.history !== beforeOverride.history + 1 || override.preset !== 'deep') throw new Error(`${viewport.width}: single-finger override mismatch`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-single-override.png`, shots)), fullPage: false });

  const persistence = await page.evaluate(async () => {
    const store = window.__frenchEditorStore;
    const saved = await store.getState().save();
    const reloaded = store.getState().reloadFromStorage();
    const { inspectFrenchRecipeProjectionV1 } = await import('/src/studio/editor/v7/french-conversion-v1.ts');
    const checks = ['L1', 'R1'].map((finger) => {
      const step = store.getState().doc.nails[finger].steps.filter((candidate) => candidate.recipeInstanceId).at(-1);
      return Boolean(step && inspectFrenchRecipeProjectionV1(store.getState().doc, finger, step.id).ok);
    });
    return { saved, reloaded, checks };
  });
  if (persistence.saved !== 'saved' || persistence.reloaded !== 'ok' || persistence.checks.some((value) => !value)) throw new Error(`${viewport.width}: save/reload failed`);

  const layout = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (layout.scrollWidth > layout.clientWidth + 1) throw new Error(`${viewport.width}: document overflow`);
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.width}: runtime errors`);
  reports.push({ viewport: viewport.width, mode: 'full-task', status: 'passed', minTargetHeight: Math.min(...targetHeights), mirrorOneTransaction: true, independentRecipeIds: true, projectionValid: true, pointerBlurOneTransaction: true, singleOverride: true, saveReload: true, overflow: false, consoleErrors: 0, pageErrors: 0 });
  await context.close();
}

await browser.close();
await writeFile(new URL('french-commands-walkthrough-report.json', evidenceDir), `${JSON.stringify({ status: 'passed', reports }, null, 2)}\n`);
console.log(`[v7-french-commands-walkthrough] ${reports.length} viewports passed`);
