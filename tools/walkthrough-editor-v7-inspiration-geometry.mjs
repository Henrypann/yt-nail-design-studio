import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5218';
const evidenceDir = new URL('../evidence/pr-editor-v7-15-inspiration-geometry/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const viewports = [
  { name: '390', width: 390, height: 844, layout: 'mobile' },
  { name: '768', width: 768, height: 900, layout: 'tablet' },
  { name: '1024', width: 1024, height: 900, layout: 'compact' },
  { name: '1280', width: 1280, height: 900, layout: 'wide' },
  { name: '1440', width: 1440, height: 900, layout: 'wide' },
];
const selectedViewports = process.env.V7_VIEWPORT
  ? viewports.filter((viewport) => viewport.name === process.env.V7_VIEWPORT)
  : viewports;

const capture = (page) => page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const state = editorV7Store.getState();
  return {
    doc: JSON.stringify(state.doc),
    revision: state.doc?.revision ?? null,
    history: state.history.length,
    future: state.future.length,
    pending: state.revisionState.pendingRevision,
    timer: state.autosaveTimer,
    storage: localStorage.getItem('nail-studio:editor.docs'),
  };
});

function equalInvariant(actual, expected, label) {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} changed`);
  }
}

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of selectedViewports) {
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
    const state = editorV7Store.getState();
    const finger = state.currentFinger;
    const result = state.addMissingPersonalStep(finger, 'flat_design');
    if (!result.ok) throw new Error(result.message);
    const flat = editorV7Store.getState().doc.nails[finger].steps.find((step) => step.kind === 'flat_design');
    editorV7Store.getState().selectStep(flat.id);
    const saved = await editorV7Store.getState().save();
    if (saved !== 'saved') throw new Error(`setup save: ${saved}`);
    return { finger, flatId: flat.id };
  });
  await page.locator('[data-testid="v7-flat-design-canvas"]').waitFor();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('[data-editor-schema="7"]');
    const visibleButtons = [...document.querySelectorAll('button')].filter((button) => button.getClientRects().length > 0);
    return {
      layout: root?.getAttribute('data-layout'),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      minButtonHeight: Math.min(...visibleButtons.map((button) => button.getBoundingClientRect().height)),
      undersizedButtons: visibleButtons
        .filter((button) => button.getBoundingClientRect().height < 43.5)
        .map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim(), height: button.getBoundingClientRect().height })),
    };
  });
  if (metrics.layout !== viewport.layout) throw new Error(`${viewport.name}: layout ${metrics.layout}`);
  if (metrics.scrollWidth > metrics.clientWidth + 1) throw new Error(`${viewport.name}: horizontal overflow`);
  if (viewport.width <= 768 && metrics.minButtonHeight < 43.5) throw new Error(`${viewport.name}: touch targets ${JSON.stringify(metrics.undersizedButtons)}`);

  const geometryStage = page.locator('[data-stage-id="geometry"]');
  const stageContext = page.locator('[data-testid="v7-stage-context"][data-stage-context="geometry"]');

  // Signed-off geometry is exact and Stage inspection is writer-zero.
  const exactBefore = await capture(page);
  await activate(geometryStage);
  await stageContext.waitFor();
  if (await stageContext.getAttribute('data-geometry-source') !== 'product') throw new Error(`${viewport.name}: exact source missing`);
  if (!await stageContext.getByText(/已签收/).count()) throw new Error(`${viewport.name}: exact evidence missing`);
  if (!await stageContext.getByText(/不代表逐指扫描、贴合、材料、物理或制造验证/).count()) throw new Error(`${viewport.name}: physical disclaimer missing`);
  equalInvariant(await capture(page), exactBefore, `${viewport.name} exact Stage`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-01-exact-geometry.png`, screenshotDir)) });
  await stageContext.getByRole('button', { name: '关闭阶段说明' }).click();
  await stageContext.waitFor({ state: 'detached' });
  if (!await geometryStage.evaluate((button) => document.activeElement === button)) throw new Error(`${viewport.name}: exact focus restore`);

  // Generated geometry is a real approximate SVG, never a product claim. A
  // blocked spatial tool explains the restriction without writing canonical data.
  await page.evaluate(async ({ finger }) => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const { PRODUCT_GEOMETRY_REVISION_V7 } = await import('/src/studio/editor/v7/geometry-registry.ts');
    const state = editorV7Store.getState();
    const doc = structuredClone(state.doc);
    doc.nails[finger].geometryRef = { assetId: `geometry.square.medium.${finger}`, revision: PRODUCT_GEOMETRY_REVISION_V7 };
    editorV7Store.setState({ doc });
  }, setup);
  const generatedBefore = await capture(page);
  await activate(geometryStage);
  await stageContext.waitFor();
  if (await stageContext.getAttribute('data-geometry-source') !== 'generated') throw new Error(`${viewport.name}: generated source missing`);
  if (!await stageContext.getByText(/已生成但尚未签收/).count()) throw new Error(`${viewport.name}: approximate disclosure missing`);
  equalInvariant(await capture(page), generatedBefore, `${viewport.name} generated Stage`);
  await stageContext.getByRole('button', { name: '关闭阶段说明' }).click();
  const brush = page.locator('[data-tool-id="brush"]:visible');
  if (await brush.getAttribute('data-tool-status') !== 'geometry_unavailable') throw new Error(`${viewport.name}: brush not gated`);
  // aria-disabled truthfully removes the control from Playwright's enabled
  // action path; invoke the retained explanatory click handler directly.
  await brush.evaluate((button) => button.click());
  const conflict = page.locator('[data-testid="v7-tool-conflict"]');
  await conflict.waitFor();
  if (await conflict.getAttribute('data-status') !== 'geometry_unavailable') throw new Error(`${viewport.name}: conflict reason missing`);
  equalInvariant(await capture(page), generatedBefore, `${viewport.name} generated blocked tool`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-02-generated-blocked.png`, screenshotDir)) });
  await conflict.getByRole('button', { name: '关闭工具提示' }).click();

  const crossFingerGate = page.locator('[data-testid="v7-cross-finger-geometry-gate"]:visible');
  if (!await crossFingerGate.count()) throw new Error(`${viewport.name}: cross-finger geometry gate missing`);

  if (viewport.width < 1280) {
    await page.getByRole('button', { name: '层级' }).click();
    const sidebar = page.locator('[data-testid="v7-workspace-sidebar"]');
    await sidebar.waitFor();
    if (!await sidebar.getByText(/新增或复制空间步骤需先绑定/).count()) throw new Error(`${viewport.name}: layer geometry gate missing`);
    const addFlat = sidebar.getByRole('button', { name: '平面', exact: true });
    if (await addFlat.isEnabled()) throw new Error(`${viewport.name}: layer add should be disabled`);
    await sidebar.getByRole('button', { name: '关闭工作区面板' }).click();
    await page.getByRole('button', { name: '属性' }).click();
    await sidebar.waitFor();
    if (!await sidebar.locator('[data-testid="v7-inspector-geometry-gate"]').count()) throw new Error(`${viewport.name}: inspector geometry gate missing`);
    await sidebar.getByRole('button', { name: '关闭工作区面板' }).click();
  } else {
    const sidebar = page.locator('[data-testid="v7-workspace-sidebar"]');
    if (!await sidebar.getByText(/新增或复制空间步骤需先绑定/).count()) throw new Error(`${viewport.name}: desktop layer geometry gate missing`);
    if (!await sidebar.locator('[data-testid="v7-inspector-geometry-gate"]').count()) throw new Error(`${viewport.name}: desktop inspector geometry gate missing`);
  }
  equalInvariant(await capture(page), generatedBefore, `${viewport.name} panel and cross-finger gates`);

  // Unknown/mismatched references retain their canonical value and use only a
  // generic visual fallback; inspection remains writer-zero.
  await page.evaluate(async ({ finger }) => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const doc = structuredClone(state.doc);
    doc.nails[finger].geometryRef = { assetId: `geometry.unknown.${finger}`, revision: 'unknown-1' };
    editorV7Store.setState({ doc });
  }, setup);
  const unavailableBefore = await capture(page);
  await activate(geometryStage);
  await stageContext.waitFor();
  if (await stageContext.getAttribute('data-geometry-source') !== 'generic') throw new Error(`${viewport.name}: generic fallback missing`);
  if (!await stageContext.getByText(/未注册引用/).count()) throw new Error(`${viewport.name}: unavailable reason missing`);
  if (!await stageContext.getByText(/原 geometryRef 不变/).count()) throw new Error(`${viewport.name}: no-bind disclosure missing`);
  equalInvariant(await capture(page), unavailableBefore, `${viewport.name} unavailable Stage`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-03-unavailable-fallback.png`, screenshotDir)) });

  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
  reports.push({ viewport, setup, metrics, exact: '已签收 2D 轮廓', generated: '生成轮廓（近似）', unavailable: '通用回退（未注册引用）', consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-inspiration-geometry-walkthrough] ${reports.length} viewports passed`);
