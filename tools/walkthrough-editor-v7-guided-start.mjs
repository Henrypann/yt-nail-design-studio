import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5215';
const evidenceDir = new URL('../evidence/pr-editor-v7-14-2-guided-start/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const viewports = [
  { name: '390', width: 390, height: 844, expectedLayout: 'mobile' },
  { name: '768', width: 768, height: 900, expectedLayout: 'tablet' },
  { name: '1024', width: 1024, height: 900, expectedLayout: 'compact' },
  { name: '1280', width: 1280, height: 900, expectedLayout: 'wide' },
  { name: '1440', width: 1440, height: 900, expectedLayout: 'wide' },
];

const captureCanonical = (page) => page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const state = editorV7Store.getState();
  return {
    docJson: JSON.stringify(state.doc),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    future: state.future.length,
    pendingRevision: state.revisionState.pendingRevision,
    saveState: state.saveState,
  };
});

const assertCanonicalEqual = (actual, expected, label) => {
  for (const key of ['docJson', 'revision', 'history', 'future', 'pendingRevision', 'saveState']) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
};

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
  const guide = page.locator('[data-testid="v7-guided-start"]');
  await guide.waitFor();
  const initial = await captureCanonical(page);

  const guideTargets = await guide.locator('button').evaluateAll((buttons) => buttons.map((button) => ({
    label: button.textContent?.trim() ?? '',
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
  })));
  if (Math.min(...guideTargets.map((target) => target.height)) < 43.5) throw new Error(`${viewport.name}: guided touch target below 44px`);
  const blankLayout = await page.evaluate(() => {
    const options = document.querySelector('[data-testid="v7-guided-options"]');
    const canvas = document.querySelector('[data-testid="v7-background-canvas"]');
    const rect = canvas?.getBoundingClientRect();
    return {
      optionsOverflow: options ? options.scrollWidth > options.clientWidth + 1 : false,
      canvasVisiblePixels: rect ? Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) : 0,
    };
  });
  if (viewport.width === 390 && (!blankLayout.optionsOverflow || blankLayout.canvasVisiblePixels < 40)) {
    throw new Error(`${viewport.name}: mobile guide must scroll locally and leave the nail canvas visible ${JSON.stringify(blankLayout)}`);
  }
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-blank-guided-start.png`, screenshotDir)), fullPage: false });

  // Preview/dismiss and stage re-entry are session-only state.
  await activate(guide.getByRole('button', { name: /暂不添加/ }));
  await guide.waitFor({ state: 'detached' });
  assertCanonicalEqual(await captureCanonical(page), initial, `${viewport.name} preview finish`);
  const finishStage = page.locator('[data-stage-id="finish"]');
  if (!await finishStage.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: finish stage did not receive focus`);
  await activate(page.locator('[data-stage-id="personalize"]'));
  await guide.waitFor();
  const firstCard = guide.locator('[data-start-kind="flat_design"]');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-start-kind') === 'flat_design');
  if (!await firstCard.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: guide re-entry focus missing`);
  assertCanonicalEqual(await captureCanonical(page), initial, `${viewport.name} guide re-entry`);

  // First click is intent only; second explicit confirmation is the sole writer.
  await activate(firstCard);
  const notice = page.locator('[data-testid="v7-tool-conflict"]');
  await notice.waitFor();
  if (await notice.getAttribute('data-status') !== 'missing_step') throw new Error(`${viewport.name}: missing-step notice absent`);
  const confirm = notice.getByRole('button', { name: '添加平面设计并继续' });
  if (!await confirm.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: confirmation focus missing`);
  assertCanonicalEqual(await captureCanonical(page), initial, `${viewport.name} first intent`);
  await activate(confirm);
  await guide.waitFor({ state: 'detached' });
  await page.locator('[data-testid="v7-flat-design-canvas"]').waitFor();
  await page.locator('[data-testid="v7-flat-vector-panel"]').first().waitFor();

  const afterCreate = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const nail = state.doc.nails[state.currentFinger];
    const middle = nail.steps.filter((step) => !['background', 'surface_finish'].includes(step.kind));
    const focusPanel = document.activeElement?.closest('[data-testid="v7-flat-vector-panel"]');
    return {
      revision: state.doc.revision,
      history: state.history.length,
      middleKinds: middle.map((step) => step.kind),
      selectedStepId: state.selectedStepId,
      createdStepId: middle[0]?.id ?? null,
      focusedInToolPanel: Boolean(focusPanel),
      finishLast: nail.steps.at(-1)?.kind === 'surface_finish',
    };
  });
  if (
    afterCreate.revision !== initial.revision + 1
    || afterCreate.history !== initial.history + 1
    || JSON.stringify(afterCreate.middleKinds) !== JSON.stringify(['flat_design'])
    || afterCreate.selectedStepId !== afterCreate.createdStepId
    || !afterCreate.focusedInToolPanel
    || !afterCreate.finishLast
  ) throw new Error(`${viewport.name}: guided creation transaction/focus failed ${JSON.stringify(afterCreate)}`);
  let compactResourceFocus = null;
  if (viewport.width < 1280) {
    const resourceDialog = page.getByRole('dialog', { name: '资源与预设' });
    compactResourceFocus = {
      initial: await resourceDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
    };
    await page.keyboard.press('Shift+Tab');
    compactResourceFocus.afterReverseTab = await resourceDialog.evaluate((dialog) => dialog.contains(document.activeElement));
    await page.keyboard.press('Tab');
    compactResourceFocus.afterForwardTab = await resourceDialog.evaluate((dialog) => dialog.contains(document.activeElement));
    if (!compactResourceFocus.initial || !compactResourceFocus.afterReverseTab || !compactResourceFocus.afterForwardTab) {
      throw new Error(`${viewport.name}: compact resource focus escaped`);
    }
    await resourceDialog.getByRole('button', { name: '关闭资源' }).click();
    await resourceDialog.waitFor({ state: 'detached' });
  }
  const brush = page.locator('[data-tool-id="brush"]:visible');
  if (viewport.width < 1280) {
    compactResourceFocus.restoredToReadyTool = await brush.evaluate((button) => document.activeElement === button);
    if (!compactResourceFocus.restoredToReadyTool) throw new Error(`${viewport.name}: compact resource close did not restore focus`);
  }
  if (await brush.getAttribute('data-tool-status') !== 'ready' || await brush.getAttribute('aria-disabled') !== 'false' || await brush.getAttribute('aria-pressed') !== 'true') {
    throw new Error(`${viewport.name}: Rail did not synchronize to ready brush`);
  }
  const flatLane = page.locator('[data-lane="flat"]');
  if (await flatLane.getAttribute('data-lane-state') !== 'configured' || await flatLane.getAttribute('data-lane-active') !== 'true') {
    throw new Error(`${viewport.name}: Stage lane did not synchronize`);
  }

  // Recovery is explicit and sequential: locked -> skipped -> hidden -> ready.
  const flagged = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const finger = state.currentFinger;
    const step = state.doc.nails[finger].steps.find((candidate) => candidate.kind === 'flat_design');
    if (!step) throw new Error('flat step missing');
    for (const [flag, value] of [['visible', false], ['skipped', true], ['locked', true]]) {
      const result = editorV7Store.getState().setStepFlag(finger, step.id, flag, value);
      if (!result.ok) throw new Error(result.message);
    }
    const next = editorV7Store.getState();
    return { revision: next.doc.revision, history: next.history.length };
  });
  if (flagged.revision !== afterCreate.revision + 3 || flagged.history !== afterCreate.history + 3) throw new Error(`${viewport.name}: flag setup transaction mismatch`);
  if (await brush.getAttribute('data-tool-status') !== 'locked') throw new Error(`${viewport.name}: locked state not reflected in Rail`);
  await brush.focus();
  await page.keyboard.press('Enter');
  await notice.waitFor();
  if (await notice.getAttribute('data-status') !== 'locked') throw new Error(`${viewport.name}: locked notice missing`);
  if (viewport.name === '390') await page.screenshot({ path: fileURLToPath(new URL('390-locked-tool-recovery.png', screenshotDir)), fullPage: false });
  await notice.getByRole('button', { name: '解锁并继续' }).click();
  if (await notice.getAttribute('data-status') !== 'skipped') throw new Error(`${viewport.name}: skipped recovery step was bypassed`);
  await notice.getByRole('button', { name: '取消跳过并继续' }).click();
  if (await notice.getAttribute('data-status') !== 'hidden') throw new Error(`${viewport.name}: hidden recovery step was bypassed`);
  await notice.getByRole('button', { name: '恢复显示并继续' }).click();
  await notice.waitFor({ state: 'detached' });
  if (await brush.getAttribute('data-tool-status') !== 'ready') throw new Error(`${viewport.name}: recovered tool not ready`);
  if (viewport.width < 1280) {
    const recoveredResourceDialog = page.getByRole('dialog', { name: '资源与预设' });
    await recoveredResourceDialog.waitFor();
    await recoveredResourceDialog.getByRole('button', { name: '关闭资源' }).click();
    await recoveredResourceDialog.waitFor({ state: 'detached' });
  }

  // A different missing tool can be inspected and dismissed with Escape without writing.
  const beforeEscape = await captureCanonical(page);
  const effects = page.locator('[data-tool-id="effects"]:visible');
  if (await effects.getAttribute('data-tool-status') !== 'missing_step') throw new Error(`${viewport.name}: effect missing state absent`);
  await effects.focus();
  await page.keyboard.press('Enter');
  await notice.waitFor();
  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    editorV7Store.setState({ switching: true });
  });
  await page.locator('[data-testid="v7-tool-conflict"][data-status="switching"]').waitFor();
  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    editorV7Store.setState({ switching: false });
  });
  await page.locator('[data-testid="v7-tool-conflict"][data-status="missing_step"]').waitFor();
  await page.keyboard.press('Escape');
  await notice.waitFor({ state: 'detached' });
  assertCanonicalEqual(await captureCanonical(page), beforeEscape, `${viewport.name} Escape dismiss`);
  if (!await effects.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: Escape did not restore tool focus`);

  // Layer selection is the same canonical step in wide and compact layouts.
  let layerSelected = false;
  if (viewport.width < 1280) {
    await page.getByRole('button', { name: '层级', exact: true }).click();
    const layerDialog = page.getByRole('dialog', { name: '层级面板' });
    await layerDialog.waitFor();
    layerSelected = await layerDialog.locator('[data-step-kind="flat_design"] button[aria-current="step"]').count() === 1;
    await layerDialog.getByRole('button', { name: '关闭工作区面板' }).click();
  } else {
    layerSelected = await page.locator('[data-testid="v7-layer-panel"] [data-step-kind="flat_design"] button[aria-current="step"]').count() === 1;
  }
  if (!layerSelected) throw new Error(`${viewport.name}: Layer selection did not synchronize`);

  const final = await page.evaluate(() => {
    const activeTool = document.querySelector('[data-tool-status="ready"][aria-pressed="true"]');
    const buttons = [...document.querySelectorAll('[data-testid^="v7-tool-rail"] button')].filter((button) => button.getClientRects().length > 0);
    return {
      layout: document.querySelector('[data-editor-schema="7"]')?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      minToolButtonHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
      activeTool: activeTool?.getAttribute('data-tool-id') ?? null,
    };
  });
  if (final.layout !== viewport.expectedLayout) throw new Error(`${viewport.name}: expected ${viewport.expectedLayout}, got ${final.layout}`);
  if (final.bodyScrollWidth > final.bodyClientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (viewport.width <= 1024 && final.minToolButtonHeight < 43.5) throw new Error(`${viewport.name}: tool touch target below 44px (${final.minToolButtonHeight})`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-guided-created.png`, screenshotDir)), fullPage: false });
  reports.push({ viewport, initial: { revision: initial.revision, history: initial.history }, afterCreate, flagged, final, blankLayout, compactResourceFocus, guideTargets, consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-guided-start-walkthrough] ${reports.length} viewports passed`);
