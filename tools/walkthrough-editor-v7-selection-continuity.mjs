import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5216';
const evidenceDir = new URL('../evidence/pr-editor-v7-14-3-selection-continuity/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const viewports = [
  { name: '390', width: 390, height: 844, expectedLayout: 'mobile' },
  { name: '768', width: 768, height: 900, expectedLayout: 'tablet' },
  { name: '1024', width: 1024, height: 900, expectedLayout: 'compact' },
  { name: '1280', width: 1280, height: 900, expectedLayout: 'wide' },
  { name: '1440', width: 1440, height: 900, expectedLayout: 'wide' },
];

const captureInvariant = (page) => page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const state = editorV7Store.getState();
  return {
    docJson: JSON.stringify(state.doc),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    future: state.future.length,
    pendingRevision: state.revisionState.pendingRevision,
    saveState: state.saveState,
    sourceToken: state.sourceToken,
    autosaveTimer: state.autosaveTimer,
    storageRaw: localStorage.getItem('nail-studio:editor.docs'),
  };
});

function assertInvariant(actual, expected, label) {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
}

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 768 });
  const page = await context.newPage();
  const activate = (locator) => viewport.width <= 768 ? locator.tap() : locator.click();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  const shell = page.locator('[data-editor-schema="7"]');
  await shell.waitFor();

  const setup = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const store = editorV7Store.getState();
    const color = { colorSpace: 'srgb', r: 205, g: 54, b: 102, a: 1 };
    const transform = { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 };
    const flat = (finger, ordinal) => ({
      id: `step.${finger}.continuity-flat.${ordinal}`,
      typeId: 'builtin.v7.flat_design',
      kind: 'flat_design',
      name: `平面设计 ${ordinal}`,
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      elements: [{
        id: `element.${finger}.continuity-brush.${ordinal}`,
        kind: 'brush_stroke',
        visible: true,
        locked: false,
        opacity: 1,
        transform,
        points: [{ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.8 }],
        color,
        widthMm: 0.4,
      }],
    });
    const effect = (finger, ordinal, flags = {}) => ({
      id: `step.${finger}.continuity-effect.${ordinal}`,
      typeId: 'builtin.v7.surface_effect',
      kind: 'surface_effect',
      name: `表面效果 ${ordinal}`,
      visible: flags.visible ?? true,
      locked: flags.locked ?? false,
      skipped: flags.skipped ?? false,
      materialRefs: [],
      effect: { effectType: 'mirror', tint: color, reflectance: 0.72, previewFidelity: 'approximate' },
      mask: { coordinateSpace: 'nail-local-v1', pathData: 'M0.1 0.1 L0.9 0.1 L0.9 0.9 Z', fillRule: 'nonzero', inverted: false },
    });
    const append = (finger, step) => {
      const current = editorV7Store.getState().doc.nails[finger].steps;
      const result = editorV7Store.getState().addStep(finger, step, current.length - 1);
      if (!result.ok) throw new Error(`${finger}/${step.id}: ${result.message}`);
    };
    append('R4', flat('R4', 1));
    append('R4', effect('R4', 1));
    append('R4', flat('R4', 2));
    append('R4', effect('R4', 2));
    append('R5', effect('R5', 1));
    append('R5', flat('R5', 1));
    append('R5', effect('R5', 2, { visible: false, locked: true, skipped: true }));
    append('R5', flat('R5', 2));
    append('L2', flat('L2', 1));
    const saved = await editorV7Store.getState().save();
    if (saved !== 'saved') throw new Error(`setup save failed: ${saved}`);
    editorV7Store.getState().selectStep('step.R4.continuity-flat.2');
    editorV7Store.getState().selectElement('element.R4.continuity-brush.2');
    const state = editorV7Store.getState();
    return {
      designId: state.doc.designId,
      revision: state.doc.revision,
      history: state.history.length,
      currentFinger: state.currentFinger,
      selectedStepId: state.selectedStepId,
    };
  });
  if (setup.currentFinger !== 'R4' || setup.selectedStepId !== 'step.R4.continuity-flat.2') {
    throw new Error(`${viewport.name}: setup selection failed ${JSON.stringify(setup)}`);
  }
  await page.locator('[data-testid="v7-guided-start"]').waitFor({ state: 'detached' });
  const editorLayout = await page.evaluate(() => {
    const root = document.querySelector('[data-editor-schema="7"]');
    const fingerButtons = [...document.querySelectorAll('[data-testid="v7-ten-finger-bar"] button[data-finger]')];
    return {
      layout: root?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      minFingerHeight: Math.min(...fingerButtons.map((button) => button.getBoundingClientRect().height)),
    };
  });
  if (editorLayout.layout !== viewport.expectedLayout) throw new Error(`${viewport.name}: expected ${viewport.expectedLayout}, got ${editorLayout.layout}`);
  if (editorLayout.bodyScrollWidth > editorLayout.bodyClientWidth + 1) throw new Error(`${viewport.name}: editor document overflow`);
  if (editorLayout.minFingerHeight < 43.5) throw new Error(`${viewport.name}: finger target below 44px`);

  // Geometry is a read-only, explainable Stage action. It must not rewrite the
  // geometryRef or any canonical/persistence state.
  const beforeGeometry = await captureInvariant(page);
  const geometryStage = page.locator('[data-stage-id="geometry"]');
  await activate(geometryStage);
  const stageContext = page.locator('[data-testid="v7-stage-context"]');
  await stageContext.waitFor();
  if (await stageContext.getAttribute('data-geometry-source') !== 'product') {
    throw new Error(`${viewport.name}: product geometry was not explained`);
  }
  if (!await stageContext.getByText(/结构化预览映射/).count()) throw new Error(`${viewport.name}: geometry disclaimer missing`);
  assertInvariant(await captureInvariant(page), beforeGeometry, `${viewport.name} product geometry Stage`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-geometry-context.png`, screenshotDir)), fullPage: false });
  if (viewport.width === 390) await stageContext.getByRole('button', { name: '关闭阶段说明' }).tap();
  else await page.keyboard.press('Escape');
  await stageContext.waitFor({ state: 'detached' });
  if (!await geometryStage.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: geometry focus not restored`);

  // Generic fallback remains visibly approximate and never binds/replaces the
  // original asset reference. This is test setup only, then restored exactly.
  const genericSetup = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const original = structuredClone(state.doc.nails[state.currentFinger].geometryRef);
    const doc = structuredClone(state.doc);
    doc.nails[state.currentFinger].geometryRef = { assetId: 'geometry.unresolved.custom.R4', revision: 'unresolved-1' };
    editorV7Store.setState({ doc });
    return original;
  });
  const beforeGenericContext = await captureInvariant(page);
  await activate(geometryStage);
  await stageContext.waitFor();
  if (await stageContext.getAttribute('data-geometry-source') !== 'generic') throw new Error(`${viewport.name}: generic geometry disclosure missing`);
  if (!await stageContext.getByText(/原 geometryRef 保持不变/).count()) throw new Error(`${viewport.name}: generic no-bind boundary missing`);
  assertInvariant(await captureInvariant(page), beforeGenericContext, `${viewport.name} generic geometry Stage`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-geometry-generic.png`, screenshotDir)), fullPage: false });
  await stageContext.getByRole('button', { name: '关闭阶段说明' }).click();
  await stageContext.waitFor({ state: 'detached' });
  if (!await geometryStage.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: generic geometry focus not restored`);
  await page.evaluate(async (original) => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const doc = structuredClone(state.doc);
    doc.nails[state.currentFinger].geometryRef = original;
    editorV7Store.setState({ doc });
  }, genericSetup);

  // Pointer switch preserves the exact flat_design ordinal, clears the nested
  // element selection and synchronizes Stage/Rail/Layer/Canvas without writes.
  const beforePointerSwitch = await captureInvariant(page);
  await activate(page.locator('button[data-finger="R5"]'));
  const exactSwitch = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    return {
      finger: state.currentFinger,
      stepId: state.selectedStepId,
      elementId: state.selectedElementId,
      stepCount: state.doc.nails.R5.steps.length,
    };
  });
  if (exactSwitch.finger !== 'R5' || exactSwitch.stepId !== 'step.R5.continuity-flat.2' || exactSwitch.elementId !== null) {
    throw new Error(`${viewport.name}: exact pointer continuity failed ${JSON.stringify(exactSwitch)}`);
  }
  assertInvariant(await captureInvariant(page), beforePointerSwitch, `${viewport.name} exact pointer switch`);
  await page.locator('[data-testid="v7-flat-design-canvas"]').waitFor();
  if (await page.locator('[data-stage-id="personalize"]').getAttribute('aria-current') !== 'step') throw new Error(`${viewport.name}: Stage did not follow flat selection`);
  if (await page.locator('[data-tool-id="brush"]:visible').getAttribute('data-tool-status') !== 'ready') throw new Error(`${viewport.name}: Rail did not follow flat selection`);
  if (viewport.width < 1280) {
    await page.getByRole('button', { name: '层级', exact: true }).click();
    const layerDialog = page.getByRole('dialog', { name: '层级面板' });
    await layerDialog.waitFor();
    if (await layerDialog.locator('[data-step-kind="flat_design"] button[aria-current="step"]').count() !== 1) throw new Error(`${viewport.name}: compact Layer did not follow selection`);
    await layerDialog.getByRole('button', { name: '关闭工作区面板' }).click();
  } else if (await page.locator('[data-testid="v7-layer-panel"] [data-step-kind="flat_design"] button[aria-current="step"]').count() !== 1) {
    throw new Error(`${viewport.name}: wide Layer did not follow selection`);
  }
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-exact-flat-continuity.png`, screenshotDir)), fullPage: false });

  // Missing exact ordinal falls back to background and makes the non-creation
  // decision visible; it never clamps to L2's first flat step.
  await activate(page.locator('button[data-finger="R4"]'));
  const beforeFallback = await captureInvariant(page);
  const l2CountBefore = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    return editorV7Store.getState().doc.nails.L2.steps.length;
  });
  await activate(page.locator('button[data-finger="L2"]'));
  const fallback = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    return {
      finger: state.currentFinger,
      selectedStepId: state.selectedStepId,
      backgroundId: state.doc.nails.L2.steps[0].id,
      stepCount: state.doc.nails.L2.steps.length,
    };
  });
  if (fallback.finger !== 'L2' || fallback.selectedStepId !== fallback.backgroundId || fallback.stepCount !== l2CountBefore) {
    throw new Error(`${viewport.name}: safe fallback failed ${JSON.stringify(fallback)}`);
  }
  assertInvariant(await captureInvariant(page), beforeFallback, `${viewport.name} missing ordinal fallback`);
  await page.locator('[data-testid="v7-background-canvas"]').waitFor();
  if (!await page.locator('[data-testid="v7-finger-selection-status"]').getByText(/未创建新步骤/).count()) throw new Error(`${viewport.name}: fallback explanation missing`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-missing-ordinal-fallback.png`, screenshotDir)), fullPage: false });

  // Keyboard current scope moves focus and current finger; selected scope moves
  // focus only, preserving its multi-select semantics.
  await page.getByRole('button', { name: '当前指', exact: true }).click();
  const l2Button = page.locator('button[data-finger="L2"]');
  await l2Button.focus();
  await page.keyboard.press('ArrowLeft');
  const currentKeyboard = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    return { finger: editorV7Store.getState().currentFinger, focused: document.activeElement?.getAttribute('data-finger') };
  });
  if (currentKeyboard.finger !== 'L1' || currentKeyboard.focused !== 'L1') throw new Error(`${viewport.name}: current-scope arrow navigation failed`);
  await page.keyboard.press('End');
  if (await page.locator('button[data-finger="R5"]').evaluate((button) => document.activeElement === button) === false) throw new Error(`${viewport.name}: End did not focus R5`);
  if (await page.evaluate(async () => (await import('/src/studio/editor/store-v7.ts')).editorV7Store.getState().currentFinger) !== 'R5') throw new Error(`${viewport.name}: End did not switch current scope`);
  await page.keyboard.press('Home');
  if (await page.locator('button[data-finger="L1"]').evaluate((button) => document.activeElement === button) === false) throw new Error(`${viewport.name}: Home did not focus L1`);
  if (await page.evaluate(async () => (await import('/src/studio/editor/store-v7.ts')).editorV7Store.getState().currentFinger) !== 'L1') throw new Error(`${viewport.name}: Home did not switch current scope`);
  await page.getByRole('button', { name: '已选指', exact: true }).click();
  await page.locator('[data-testid="v7-finger-selection-status"]').waitFor({ state: 'detached' });
  const l1Button = page.locator('button[data-finger="L1"]');
  await l1Button.focus();
  await page.keyboard.press('ArrowRight');
  const selectedKeyboard = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    return { finger: editorV7Store.getState().currentFinger, focused: document.activeElement?.getAttribute('data-finger') };
  });
  if (selectedKeyboard.finger !== 'L1' || selectedKeyboard.focused !== 'L2') throw new Error(`${viewport.name}: selected-scope arrow must be focus-only`);
  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  const selectedAfterSpace = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    return { currentFinger: state.currentFinger, selectedFingers: state.selectedFingers, focused: document.activeElement?.getAttribute('data-finger') };
  });
  if (selectedAfterSpace.currentFinger !== 'L1' || selectedAfterSpace.focused !== 'R5' || !selectedAfterSpace.selectedFingers.includes('R5')) {
    throw new Error(`${viewport.name}: selected-scope Space activation failed`);
  }
  await page.keyboard.press('Home');
  const l1WasSelected = await page.evaluate(async () => (await import('/src/studio/editor/store-v7.ts')).editorV7Store.getState().selectedFingers.includes('L1'));
  await page.keyboard.press('Enter');
  const selectedAfterEnter = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    return { currentFinger: state.currentFinger, selectedFingers: state.selectedFingers, focused: document.activeElement?.getAttribute('data-finger') };
  });
  if (selectedAfterEnter.currentFinger !== 'L1' || selectedAfterEnter.focused !== 'L1' || selectedAfterEnter.selectedFingers.includes('L1') === l1WasSelected) {
    throw new Error(`${viewport.name}: selected-scope Enter activation failed`);
  }

  // Use a non-default entry finger so the Customer Preview handoff cannot pass
  // accidentally through its historical L1 default.
  await page.getByRole('button', { name: '当前指', exact: true }).click();
  await activate(page.locator('button[data-finger="R3"]'));
  const previewEntryFinger = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    return editorV7Store.getState().currentFinger;
  });
  if (previewEntryFinger !== 'R3') throw new Error(`${viewport.name}: non-default preview entry setup failed`);

  // Dirty Customer Stage explains why preview is blocked without navigation or
  // a second write; once actually saved, the preview opens at the current nail.
  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const result = editorV7Store.getState().setTitle(`Selection continuity ${window.innerWidth}`);
    if (!result.ok) throw new Error(result.message);
    const timer = editorV7Store.getState().autosaveTimer;
    if (timer !== null) clearTimeout(timer);
    editorV7Store.setState({ autosaveTimer: null });
  });
  const dirtyBeforeStage = await captureInvariant(page);
  const customerStage = page.locator('[data-stage-id="customer"]');
  if (await customerStage.getAttribute('aria-disabled') !== 'false' || await customerStage.getAttribute('data-customer-preview-enabled') !== 'false') {
    throw new Error(`${viewport.name}: dirty Customer Stage must remain an actionable explanation entry`);
  }
  await activate(customerStage);
  await page.locator('[data-testid="v7-stage-context"][data-stage-context="customer"]').waitFor();
  if (!await stageContext.getByText(/请先保存当前更改/).count()) throw new Error(`${viewport.name}: dirty reason missing`);
  if (new URL(page.url()).pathname.includes('/preview')) throw new Error(`${viewport.name}: dirty Stage navigated unexpectedly`);
  assertInvariant(await captureInvariant(page), dirtyBeforeStage, `${viewport.name} dirty Customer explanation`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-customer-dirty.png`, screenshotDir)), fullPage: false });
  const saved = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    return editorV7Store.getState().save();
  });
  if (saved !== 'saved') throw new Error(`${viewport.name}: final save failed: ${saved}`);
  await stageContext.waitFor({ state: 'detached' });
  if (!await customerStage.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: saved transition did not close explanation and restore focus`);
  const savedBeforePreview = await captureInvariant(page);
  if (await customerStage.getAttribute('aria-disabled') !== 'false' || await customerStage.getAttribute('data-customer-preview-enabled') !== 'true') {
    throw new Error(`${viewport.name}: saved Customer Stage did not enable preview`);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-selection-continuity.png`, screenshotDir)), fullPage: false });
  await activate(customerStage);
  await page.locator('[data-testid="customer-preview-v7"]').waitFor();
  const previewUrl = new URL(page.url());
  if (previewUrl.pathname !== '/studio/design/preview' || previewUrl.searchParams.get('finger') !== previewEntryFinger) {
    throw new Error(`${viewport.name}: preview did not retain current finger ${page.url()}`);
  }
  if (await page.locator('[data-testid="customer-preview-v7"]').getAttribute('data-selected-finger') !== previewEntryFinger) throw new Error(`${viewport.name}: preview root finger mismatch`);
  if (await page.locator(`button[aria-label="聚焦 ${previewEntryFinger}"]`).getAttribute('aria-current') !== 'true') throw new Error(`${viewport.name}: preview set did not highlight entry finger`);
  assertInvariant(await captureInvariant(page), savedBeforePreview, `${viewport.name} saved Customer preview entry`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-customer-preview-entry.png`, screenshotDir)), fullPage: false });

  const invalidFingerUrl = new URL(page.url());
  invalidFingerUrl.searchParams.set('finger', 'INVALID');
  await page.goto(invalidFingerUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('[data-testid="customer-preview-v7"]').waitFor();
  if (await page.locator('[data-testid="customer-preview-v7"]').getAttribute('data-selected-finger') !== 'L1') {
    throw new Error(`${viewport.name}: invalid finger query did not fail closed to L1`);
  }

  const layout = await page.evaluate(() => {
    const preview = document.querySelector('[data-testid="customer-preview-v7"]');
    const targets = [...document.querySelectorAll('button:not([disabled])')].filter((button) => button.getClientRects().length > 0);
    return {
      previewMode: preview?.getAttribute('data-preview-mode'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      minButtonHeight: Math.min(...targets.map((button) => button.getBoundingClientRect().height)),
    };
  });
  if (layout.previewMode !== 'set') throw new Error(`${viewport.name}: preview must open in set mode`);
  if (layout.bodyScrollWidth > layout.bodyClientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (viewport.width <= 768 && layout.minButtonHeight < 43.5) throw new Error(`${viewport.name}: touch target below 44px (${layout.minButtonHeight})`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);

  reports.push({ viewport, setup, editorLayout, exactSwitch, fallback, currentKeyboard, selectedKeyboard, previewEntryFinger, invalidFingerFallback: 'L1', layout, consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-selection-continuity-walkthrough] ${reports.length} viewports passed`);
