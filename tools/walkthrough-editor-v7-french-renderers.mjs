import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5216';
const evidenceDir = new URL('../evidence/pr-render-v0-7-2-french-04/', import.meta.url);
const shots = new URL('./screenshots/', evidenceDir);
const viewports = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];

async function closeResourceDrawer(page) {
  const dialog = page.getByRole('dialog', { name: '当前层工具与参数' });
  if (await dialog.count()) await dialog.getByRole('button', { name: '关闭资源', exact: true }).click();
}

async function createStructuredFrench(page) {
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
  await page.getByRole('button', { name: '添加法式', exact: true }).click();
  const dialog = page.locator('[data-testid="v7-managed-french-create-dialog"]');
  await dialog.waitFor();
  await dialog.locator('[data-testid="v7-managed-french-create-preset-pointed"]').click();
  await dialog.locator('[data-testid="v7-managed-french-create-scope-current"]').click();
  await page.locator('[data-testid="v7-managed-french-create-confirm"]').click();
  await dialog.waitFor({ state: 'detached' });
  await closeResourceDrawer(page);
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
  await createStructuredFrench(page);

  const flat = page.locator('[data-testid="v7-flat-design-canvas"]');
  await flat.waitFor();
  if (await flat.getAttribute('data-french-fidelity') !== 'exact-source-derived') throw new Error(`${viewport.width}: editor flat consumer did not use structured adapter`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-editor-flat.png`, shots)), fullPage: false });

  const validDoc = await page.evaluate(() => structuredClone(window.__frenchEditorStore.getState().doc));
  await page.evaluate(() => {
    const store = window.__frenchEditorStore;
    const bad = structuredClone(store.getState().doc);
    const step = bad.nails.L1.steps.find((candidate) => candidate.recipeInstanceId);
    bad.recipeInstances[step.recipeInstanceId].recipeRevision = '9.9.9';
    store.setState({ doc: bad });
  });
  await page.waitForFunction(() => document.querySelector('[data-testid="v7-flat-design-canvas"]')?.getAttribute('data-french-fidelity') === 'unavailable');
  await page.locator('[data-testid="v7-french-render-unavailable"]').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-editor-unavailable.png`, shots)), fullPage: false });
  await page.evaluate((doc) => window.__frenchEditorStore.setState({ doc }), validDoc);
  await page.waitForFunction(() => document.querySelector('[data-testid="v7-flat-design-canvas"]')?.getAttribute('data-french-fidelity') === 'exact-source-derived');

  await page.evaluate(() => {
    const store = window.__frenchEditorStore;
    const finish = store.getState().doc.nails.L1.steps.find((candidate) => candidate.kind === 'surface_finish');
    store.getState().selectStep(finish.id);
  });
  const finish = page.locator('[data-testid="v7-finish-composite-canvas"]');
  await finish.waitFor();
  if (await finish.getAttribute('data-french-fidelity') !== 'exact-source-derived') throw new Error(`${viewport.width}: finish consumer did not use structured adapter`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-finish.png`, shots)), fullPage: false });

  const projection = await page.evaluate(async () => {
    const store = window.__frenchEditorStore;
    const doc = store.getState().doc;
    const { createCustomerPreviewScenarioV7, deriveCustomerNailPreviewV7 } = await import('/src/studio/editor/v7/customer-preview.ts');
    const { createSingleNailMaterialProjectionV1 } = await import('/src/studio/rendering/v0-7-2/material-projection.ts');
    const model = deriveCustomerNailPreviewV7(doc.nails.L1, createCustomerPreviewScenarioV7());
    const result = createSingleNailMaterialProjectionV1(doc.nails.L1, model, doc.recipeInstances, doc.nails);
    return { fidelity: result.fidelity, warnings: result.warnings, hash: result.projectionHash };
  });
  if (projection.fidelity === 'unavailable' || !projection.hash) throw new Error(`${viewport.width}: PBR material consumer unavailable`);

  await page.evaluate(async () => { const store = window.__frenchEditorStore; const saved = await store.getState().save(); if (!['saved', 'clean'].includes(saved)) throw new Error(`save ${saved}`); });
  const beforePreview = await page.evaluate(() => {
    const state = window.__frenchEditorStore.getState();
    return { doc: JSON.stringify(state.doc), revision: state.doc.revision, history: state.history.length, storage: JSON.stringify(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])) };
  });
  await page.getByRole('button', { name: '打开顾客只读预览', exact: true }).click();
  await page.locator('[data-testid="customer-preview-v7"]').waitFor();
  const customerL1 = page.locator('[data-testid="customer-nail-preview"][data-finger="L1"]').first();
  await customerL1.waitFor();
  if (await customerL1.getAttribute('data-french-fidelity') !== 'exact-source-derived') throw new Error(`${viewport.width}: customer consumer did not use structured adapter`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-customer-2d.png`, shots)), fullPage: false });

  await page.getByRole('button', { name: /单指聚焦/ }).click();
  await page.getByRole('button', { name: '模拟 3D', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"], [data-testid="single-nail-pbr-fallback"]'));
  const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
  let cameraChecks = 0;
  if (await pbr.count()) {
    if (await pbr.getAttribute('data-material-fidelity') === 'unavailable' || await pbr.getAttribute('data-evidence') !== 'simulated-not-manufacturing') throw new Error(`${viewport.width}: PBR evidence mismatch`);
    for (const label of ['正视', '左斜', '右斜', '侧面', '指尖']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      cameraChecks += 1;
    }
  }
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-pbr.png`, shots)), fullPage: false });

  const afterPreview = await page.evaluate(() => {
    const state = window.__frenchEditorStore.getState();
    return { doc: JSON.stringify(state.doc), revision: state.doc.revision, history: state.history.length, storage: JSON.stringify(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])) };
  });
  if (JSON.stringify(afterPreview) !== JSON.stringify(beforePreview)) throw new Error(`${viewport.width}: preview was not writer-zero`);
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.width}: runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
  reports.push({ viewport: viewport.width, status: 'passed', editorFlat: true, visibleUnavailable: true, finishComposite: true, customer2d: true, pbrMaterial: true, pbrRuntime: await pbr.count() ? 'ready' : 'fallback', cameraChecks, writerZero: true, consoleErrors: 0, pageErrors: 0 });
  await context.close();
}

await browser.close();
await writeFile(new URL('french-renderer-walkthrough-report.json', evidenceDir), `${JSON.stringify({ status: 'passed', reports }, null, 2)}\n`);
console.log(`[v7-french-renderers-walkthrough] ${reports.length} viewports passed`);
