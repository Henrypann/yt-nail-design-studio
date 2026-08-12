import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5218';
const evidenceDir = new URL('../evidence/pr-editor-v7-16-customer-preview-confirmation/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const viewports = [
  { name: '390', width: 390, height: 844, expectedLayout: 'mobile', lane: 'effects', kind: 'surface_effect', tool: 'effects', confirm: '添加表面效果并继续', panel: 'v7-surface-effect-panel' },
  { name: '768', width: 768, height: 900, expectedLayout: 'tablet', lane: 'flat', kind: 'flat_design', tool: 'brush', confirm: '添加平面设计并继续', panel: 'v7-flat-vector-panel' },
  { name: '1024', width: 1024, height: 900, expectedLayout: 'compact', lane: 'decorations', kind: 'dimensional_decoration', tool: 'decorations', confirm: '添加立体装饰并继续', panel: 'v7-dimensional-decoration-panel' },
  { name: '1280', width: 1280, height: 900, expectedLayout: 'wide', lane: 'flat', kind: 'flat_design', tool: 'brush', confirm: '添加平面设计并继续', panel: 'v7-flat-vector-panel' },
  { name: '1440', width: 1440, height: 900, expectedLayout: 'wide', lane: 'effects', kind: 'surface_effect', tool: 'effects', confirm: '添加表面效果并继续', panel: 'v7-surface-effect-panel' },
];

const captureEditor = (page) => page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const state = editorV7Store.getState();
  return {
    docJson: JSON.stringify(state.doc),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    selectedStepId: state.selectedStepId,
    currentFinger: state.currentFinger,
    saveState: state.saveState,
  };
});

function assertSameEditor(actual, expected, label) {
  for (const key of ['docJson', 'revision', 'history']) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
}

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 768 });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const activate = (locator) => viewport.width <= 768 ? locator.tap() : locator.click();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`${message.text()} @ ${message.location().url}`); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  const shell = page.locator('[data-editor-schema="7"]');
  await shell.waitFor();
  const layout = await shell.getAttribute('data-layout');
  if (layout !== viewport.expectedLayout) throw new Error(`${viewport.name}: expected ${viewport.expectedLayout}, got ${layout}`);

  const guide = page.locator('[data-testid="v7-guided-start"]');
  await guide.waitFor();
  if (await guide.locator('[data-testid="v7-guided-flow"] li').count() !== 3) throw new Error(`${viewport.name}: 0→1 flow missing`);
  const initial = await captureEditor(page);

  const targetLane = page.locator(`[data-lane="${viewport.lane}"]`);
  if (await targetLane.getAttribute('data-lane-tool') !== viewport.tool || await targetLane.getAttribute('data-lane-state') !== 'empty') {
    throw new Error(`${viewport.name}: ${viewport.lane} lane mapping missing`);
  }
  await activate(targetLane);
  const notice = page.locator('[data-testid="v7-tool-conflict"]');
  await notice.waitFor();
  if (await notice.getAttribute('data-status') !== 'missing_step') throw new Error(`${viewport.name}: missing-step reason absent`);
  if (await notice.locator('[aria-label="工具与层级目标"]').count() !== 1) throw new Error(`${viewport.name}: conflict mapping disclosure absent`);
  assertSameEditor(await captureEditor(page), initial, `${viewport.name} first lane intent`);
  await activate(notice.getByRole('button', { name: viewport.confirm }));
  await guide.waitFor({ state: 'detached' });
  await page.locator(`[data-testid="${viewport.panel}"]:visible`).first().waitFor();
  let compactLayerDialog = null;
  if (viewport.width < 1280) {
    if (viewport.kind === 'flat_design') {
      const resourceDialog = page.getByRole('dialog', { name: '资源与预设' });
      await resourceDialog.waitFor();
      await resourceDialog.getByRole('button', { name: '关闭资源' }).click();
      await resourceDialog.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: '层级', exact: true }).click();
    } else {
      compactLayerDialog = page.getByRole('dialog', { name: '属性面板' });
      await compactLayerDialog.waitFor();
      await compactLayerDialog.getByRole('button', { name: '层级', exact: true }).click();
    }
    compactLayerDialog = page.getByRole('dialog', { name: '层级面板' });
    await compactLayerDialog.waitFor();
  }

  const mapped = await page.evaluate(async ({ kind, laneId, toolId }) => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const nail = state.doc.nails[state.currentFinger];
    const created = nail.steps.find((step) => step.kind === kind);
    const lane = document.querySelector(`[data-lane="${laneId}"]`);
    const tool = [...document.querySelectorAll(`[data-tool-id="${toolId}"]`)].find((node) => node.getClientRects().length > 0);
    const selectedLayer = document.querySelector(`[data-step-kind="${kind}"][data-step-selected="true"]`);
    const layerRect = selectedLayer?.getBoundingClientRect();
    return {
      revision: state.doc.revision,
      history: state.history.length,
      createdStepId: created?.id ?? null,
      selectedStepId: state.selectedStepId,
      laneActive: lane?.getAttribute('data-lane-active'),
      laneState: lane?.getAttribute('data-lane-state'),
      toolActive: tool?.getAttribute('aria-pressed'),
      toolStatus: tool?.getAttribute('data-tool-status'),
      layerSelected: Boolean(selectedLayer),
      layerVisible: Boolean(layerRect && layerRect.bottom > 0 && layerRect.top < window.innerHeight),
      finishLast: nail.steps.at(-1)?.kind === 'surface_finish',
    };
  }, { kind: viewport.kind, laneId: viewport.lane, toolId: viewport.tool });
  if (
    mapped.revision !== initial.revision + 1
    || mapped.history !== initial.history + 1
    || mapped.createdStepId !== mapped.selectedStepId
    || mapped.laneActive !== 'true'
    || mapped.laneState !== 'configured'
    || mapped.toolActive !== 'true'
    || mapped.toolStatus !== 'ready'
    || !mapped.layerSelected
    || !mapped.layerVisible
    || !mapped.finishLast
  ) throw new Error(`${viewport.name}: lane/tool/layer mapping failed ${JSON.stringify(mapped)}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-editor-${viewport.lane}-mapped.png`, screenshotDir)), fullPage: false });
  if (compactLayerDialog) {
    await compactLayerDialog.getByRole('button', { name: '关闭工作区面板' }).click();
    await compactLayerDialog.waitFor({ state: 'detached' });
  }

  // The same lane exposes sequential locked → skipped → hidden recovery.
  await page.evaluate(async ({ kind }) => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const step = state.doc.nails[state.currentFinger].steps.find((candidate) => candidate.kind === kind);
    if (!step) throw new Error('created step missing');
    for (const [flag, value] of [['visible', false], ['skipped', true], ['locked', true]]) {
      const result = editorV7Store.getState().setStepFlag(state.currentFinger, step.id, flag, value);
      if (!result.ok) throw new Error(result.message);
    }
  }, { kind: viewport.kind });
  await activate(targetLane);
  await notice.waitFor();
  if (await notice.getAttribute('data-status') !== 'locked') throw new Error(`${viewport.name}: locked recovery missing`);
  await activate(notice.getByRole('button', { name: '解锁并继续' }));
  if (await notice.getAttribute('data-status') !== 'skipped') throw new Error(`${viewport.name}: skipped recovery missing`);
  await activate(notice.getByRole('button', { name: '取消跳过并继续' }));
  if (await notice.getAttribute('data-status') !== 'hidden') throw new Error(`${viewport.name}: hidden recovery missing`);
  await activate(notice.getByRole('button', { name: '恢复显示并继续' }));
  await notice.waitFor({ state: 'detached' });
  const resourceAfterRecovery = page.getByRole('dialog', { name: '资源与预设' });
  if (await resourceAfterRecovery.count()) {
    await resourceAfterRecovery.getByRole('button', { name: '关闭资源' }).click();
    await resourceAfterRecovery.waitFor({ state: 'detached' });
  }
  const inspectorAfterRecovery = page.getByRole('dialog', { name: '属性面板' });
  if (await inspectorAfterRecovery.count()) {
    await inspectorAfterRecovery.getByRole('button', { name: '关闭工作区面板' }).click();
    await inspectorAfterRecovery.waitFor({ state: 'detached' });
  }

  const saveButton = page.getByRole('button', { name: /^保存$/ });
  await saveButton.click();
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
  const saved = await captureEditor(page);
  if (saved.saveState !== 'saved') throw new Error(`${viewport.name}: save did not settle`);

  await activate(page.locator('[data-stage-id="customer"]'));
  const preview = page.locator('[data-testid="customer-preview-v7"]');
  await preview.waitFor();
  if (await preview.getAttribute('data-preview-presentation') !== '2d') throw new Error(`${viewport.name}: preview must default to 2D`);
  const storageBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  const previewDocBefore = await page.evaluate(() => window.location.search);

  await activate(page.getByRole('button', { name: '模拟 3D' }));
  if (await preview.getAttribute('data-preview-presentation') !== 'composite') throw new Error(`${viewport.name}: composite toggle failed`);
  const selectedComposite = page.locator(`[data-testid="customer-nail-preview"][data-finger="${saved.currentFinger}"][data-presentation="composite"]`).first();
  await selectedComposite.waitFor();
  const compositeKinds = await selectedComposite.locator('[data-preview-step-kind]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-preview-step-kind')));
  if (!compositeKinds.includes(viewport.kind)) throw new Error(`${viewport.name}: ${viewport.kind} missing from composite`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-customer-composite.png`, screenshotDir)), fullPage: false });

  const scenarioToggle = page.locator('[data-testid="customer-scenario-toggle"]');
  if (await scenarioToggle.getAttribute('aria-expanded') === 'false') await activate(scenarioToggle);
  await activate(page.getByRole('button', { name: '关闭方案比较' }));
  if (!await scenarioToggle.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: scenario close focus not restored`);
  await activate(scenarioToggle);
  const designedFinish = page.getByRole('button', { name: /亮面 · 设计值/ });
  await activate(designedFinish);
  if (await preview.getAttribute('data-customer-confirmation-ready') !== 'true') throw new Error(`${viewport.name}: canonical finish became a false scenario`);
  await activate(page.getByRole('button', { name: '临时试色 柔雾玫瑰' }));
  if (await preview.getAttribute('data-customer-confirmation-ready') !== 'false') throw new Error(`${viewport.name}: temporary scenario did not block readiness`);
  await activate(page.getByRole('button', { name: '重置全部临时方案' }));
  if (await preview.getAttribute('data-customer-confirmation-ready') !== 'true') throw new Error(`${viewport.name}: reset did not restore readiness`);
  const confirmation = page.getByRole('button', { name: '预览就绪 · 确认待接入' });
  if (!await confirmation.isDisabled()) throw new Error(`${viewport.name}: STUDIO-04 boundary must remain disabled`);
  if (!await confirmation.getAttribute('title')?.then((value) => value?.includes('STUDIO-04'))) throw new Error(`${viewport.name}: confirmation ownership missing`);

  const storageAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  if (storageAfter !== storageBefore) throw new Error(`${viewport.name}: preview wrote editor storage`);
  const metrics = await page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll('button')].filter((button) => button.getClientRects().length > 0);
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      minButtonHeight: Math.min(...visibleButtons.map((button) => button.getBoundingClientRect().height)),
      smallButtons: visibleButtons.filter((button) => button.getBoundingClientRect().height < 43.5).map((button) => ({
        label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
        height: button.getBoundingClientRect().height,
      })),
    };
  });
  if (metrics.scrollWidth > metrics.clientWidth + 1) throw new Error(`${viewport.name}: horizontal overflow`);
  if (viewport.width <= 768 && metrics.minButtonHeight < 43.5) throw new Error(`${viewport.name}: touch target below 44px ${JSON.stringify(metrics.smallButtons)}`);
  if (consoleErrors.length > 0 || pageErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

  if (await scenarioToggle.getAttribute('aria-expanded') === 'true') {
    await activate(page.getByRole('button', { name: '关闭方案比较' }));
    await page.locator('[aria-label="关闭临时方案"]').waitFor({ state: 'detached' }).catch(() => {});
  }
  await activate(page.getByRole('button', { name: '返回设计' }));
  await shell.waitFor();
  const returned = await captureEditor(page);
  if (returned.currentFinger !== saved.currentFinger || returned.selectedStepId !== saved.selectedStepId) {
    throw new Error(`${viewport.name}: return continuity failed ${JSON.stringify({ saved, returned })}`);
  }
  if (await page.locator(`[data-lane="${viewport.lane}"]`).getAttribute('data-lane-active') !== 'true') throw new Error(`${viewport.name}: returned lane not active`);
  if (await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs')) !== storageBefore) throw new Error(`${viewport.name}: return changed editor storage`);
  await activate(page.locator('[data-stage-id="customer"]'));
  await preview.waitFor();
  if (await page.getByText(/项临时比较/).count()) throw new Error(`${viewport.name}: temporary scenario survived preview exit`);

  reports.push({
    viewport,
    initial: { revision: initial.revision, history: initial.history, currentFinger: initial.currentFinger },
    mapped,
    saved: { revision: saved.revision, history: saved.history, currentFinger: saved.currentFinger, saveState: saved.saveState },
    previewDocBefore,
    compositeKinds,
    returned: { currentFinger: returned.currentFinger, selectedStepId: returned.selectedStepId },
    metrics,
    storageWriterZero: true,
    consoleErrors,
    pageErrors,
  });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-16-customer-workflow] ${reports.length} viewports passed`);
