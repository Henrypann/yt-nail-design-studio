import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5213';
const evidenceDir = new URL('../evidence/pr-v7-14-finish-composite-preview/', import.meta.url);
const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 900 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1440', width: 1440, height: 900 },
];

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();

  const baseline = await page.evaluate(async () => {
    const [{ editorV7Store }, { PROCESS_STEP_TYPE_IDS_V7 }, effectHelpers, dimensionalHelpers] = await Promise.all([
      import('/src/studio/editor/store-v7.ts'),
      import('/src/studio/editor/v7/registry.ts'),
      import('/src/studio/editor/v7/surface-effect.ts'),
      import('/src/studio/editor/v7/dimensional-decoration.ts'),
    ]);
    const state = editorV7Store.getState();
    const finger = state.currentFinger;
    const add = (step) => {
      const result = editorV7Store.getState().addStep(finger, step, editorV7Store.getState().doc.nails[finger].steps.length - 1);
      if (!result.ok) throw new Error(result.message);
    };
    add({ id: 'step.walk.flat', typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: '组合平面', visible: true, locked: false, skipped: false, materialRefs: [], elements: [{ id: 'element.walk.vector', kind: 'vector_shape', visible: true, locked: false, opacity: 1, transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 }, pathData: 'M0.2 0.35 L0.8 0.35 L0.7 0.65 L0.3 0.65 Z', fill: { colorSpace: 'srgb', r: 214, g: 75, b: 131, a: 0.72 } }] });
    add({ id: 'step.walk.effect', typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect, kind: 'surface_effect', name: '组合效果', visible: true, locked: false, skipped: false, materialRefs: [], effect: effectHelpers.createDefaultSurfaceEffectPayloadV7('glitter', 'finish-walk'), mask: effectHelpers.createSurfaceEffectMaskV7('diagonal') });
    const accessory = dimensionalHelpers.createDimensionalDecorationV7('accessory', 'element.walk.accessory');
    if (!accessory || accessory.kind !== 'attachment_3d') throw new Error('manifest accessory unavailable');
    accessory.asset.sha256 = '0'.repeat(64);
    add({ id: 'step.walk.dimension', typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration, kind: 'dimensional_decoration', name: '组合立体', visible: true, locked: false, skipped: false, materialRefs: [], decorations: [accessory] });
    const finish = editorV7Store.getState().doc.nails[finger].steps.at(-1);
    editorV7Store.getState().selectStep(finish.id);
    const current = editorV7Store.getState();
    return { canonical: finish.finish.type, revision: current.doc.revision, history: current.history.length, pending: current.revisionState.pendingRevision, docJson: JSON.stringify(current.doc) };
  });

  const compact = viewport.width < 1280;
  let compactInteractionMetrics = null;
  if (compact) {
    const trigger = page.getByRole('button', { name: '属性', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '属性面板' });
    const initialFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const trappedFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    compactInteractionMetrics = { initialFocusInside, trappedFocusInside };
  }
  const panel = page.locator('[data-testid="v7-finish-composite-panel"]');
  await panel.waitFor();
  const target = baseline.canonical === 'matte' ? 'frosted' : 'matte';
  const targetLabel = target === 'matte' ? '哑光' : '磨砂';
  await panel.getByRole('button', { name: new RegExp(`^${targetLabel}`) }).click();
  const previewCanvas = page.locator(`[data-testid="v7-finish-composite-canvas"][data-preview-finish="${target}"][data-preview-only="true"]`);
  await previewCanvas.waitFor();
  const previewMetrics = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    return { revision: state.doc.revision, history: state.history.length, pending: state.revisionState.pendingRevision, docJson: JSON.stringify(state.doc), previewFinishType: state.previewFinishType };
  });
  if (previewMetrics.revision !== baseline.revision || previewMetrics.history !== baseline.history || previewMetrics.pending !== baseline.pending || previewMetrics.docJson !== baseline.docJson || previewMetrics.previewFinishType !== target) throw new Error(`${viewport.name}: preview selection wrote canonical state`);

  if (compact) {
    const dialog = page.getByRole('dialog', { name: '属性面板' });
    const buttonTargets = await dialog.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '', height: button.getBoundingClientRect().height })));
    compactInteractionMetrics.buttonTargets = buttonTargets;
    compactInteractionMetrics.minButtonHeight = Math.min(...buttonTargets.map((item) => item.height));
    if (viewport.name === '390') await page.screenshot({ path: fileURLToPath(new URL('390-finish-inspector.png', evidenceDir)), fullPage: false });
    if (compactInteractionMetrics.minButtonHeight < 43.5) throw new Error(`${viewport.name}: compact touch target below 44px ${JSON.stringify(buttonTargets)}`);
  }
  await panel.getByRole('button', { name: '应用为最终封层', exact: true }).click();
  const finalCanvas = page.locator(`[data-testid="v7-finish-composite-canvas"][data-canonical-finish="${target}"][data-preview-only="false"]`);
  await finalCanvas.waitFor();
  const afterApply = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const finger = state.currentFinger;
    const colorResult = state.setBackgroundColor(finger, { colorSpace: 'srgb', r: 117, g: 88, b: 143, a: 1 });
    if (!colorResult.ok) throw new Error(colorResult.message);
    const current = editorV7Store.getState();
    const steps = current.doc.nails[finger].steps;
    return {
      revision: current.doc.revision,
      history: current.history.length,
      readOnly: current.readOnly,
      finishType: steps.at(-1)?.kind === 'surface_finish' ? steps.at(-1).finish.type : null,
      finishCount: steps.filter((step) => step.kind === 'surface_finish').length,
      finishLast: steps.at(-1)?.kind === 'surface_finish',
      stepKinds: steps.map((step) => step.kind),
    };
  });
  if (afterApply.revision !== baseline.revision + 2 || afterApply.history !== baseline.history + 2 || afterApply.readOnly || afterApply.finishType !== target || afterApply.finishCount !== 1 || !afterApply.finishLast) throw new Error(`${viewport.name}: apply/continued-edit invariant failed ${JSON.stringify(afterApply)}`);
  await finalCanvas.getByText('未证明真实 3D、材料外观、UV/LED 固化状态或物理可制造性').waitFor();

  if (compact) {
    await page.getByRole('button', { name: '关闭工作区面板' }).last().click();
    compactInteractionMetrics.focusRestored = await page.getByRole('button', { name: '属性', exact: true }).evaluate((button) => document.activeElement === button);
    if (!compactInteractionMetrics.initialFocusInside || !compactInteractionMetrics.trappedFocusInside || !compactInteractionMetrics.focusRestored) throw new Error(`${viewport.name}: compact focus lifecycle failed`);
  }
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-editor-schema="7"]');
    const canvas = document.querySelector('[data-testid="v7-finish-composite-canvas"]');
    return {
      layout: shell?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      fidelity: canvas?.getAttribute('data-preview-fidelity'),
      activeStepCount: Number(canvas?.getAttribute('data-active-step-count') ?? 0),
      renderedStepKinds: [...document.querySelectorAll('[data-composite-step-kind]')].map((node) => node.getAttribute('data-composite-step-kind')),
    };
  });
  if (metrics.bodyScrollWidth > metrics.bodyClientWidth + 1 || metrics.canvasWidth <= 0) throw new Error(`${viewport.name}: responsive canvas failed`);
  if (metrics.fidelity !== 'unavailable' || metrics.activeStepCount !== 5 || !['flat_design', 'surface_effect', 'dimensional_decoration'].every((kind) => metrics.renderedStepKinds.includes(kind))) throw new Error(`${viewport.name}: composite pipeline missing ${JSON.stringify(metrics)}`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-finish-composite.png`, evidenceDir)), fullPage: false });
  reports.push({ viewport, baseline: { canonical: baseline.canonical, revision: baseline.revision, history: baseline.history }, previewMetrics: { revision: previewMetrics.revision, history: previewMetrics.history, pending: previewMetrics.pending, previewFinishType: previewMetrics.previewFinishType }, afterApply, metrics, compactInteractionMetrics, consoleErrors, pageErrors });
  await context.close();
}
await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-finish-composite-walkthrough] ${reports.length} viewports passed`);
