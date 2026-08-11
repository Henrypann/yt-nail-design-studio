import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5212';
const evidenceDir = new URL('../evidence/pr-v7-13-dimensional-decoration-2d/', import.meta.url);
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
  await page.goto(`${baseUrl}/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();

  const compact = viewport.width < 1280;
  let compactInteractionMetrics = null;
  if (compact) {
    const layerTrigger = page.getByRole('button', { name: '层级', exact: true });
    await layerTrigger.click();
    const dialog = page.getByRole('dialog', { name: '层级面板' });
    const initialFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const trappedFocusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    await dialog.getByRole('button', { name: '立体', exact: true }).click();
    await dialog.getByRole('button', { name: '属性', exact: true }).click();
    compactInteractionMetrics = { initialFocusInside, trappedFocusInside };
  } else {
    await page.locator('[data-testid="v7-layer-panel"]').getByRole('button', { name: '立体', exact: true }).click();
  }
  const panel = page.locator('[data-testid="v7-dimensional-decoration-panel"]');
  await panel.waitFor();
  await panel.getByRole('button', { name: '+ 浮雕花', exact: true }).click();
  await panel.getByRole('button', { name: '+ 透明液滴', exact: true }).click();
  await panel.getByRole('button', { name: '+ 金属饰品', exact: true }).click();
  const height = panel.getByRole('slider', { name: '高度' });
  await height.focus();
  await page.keyboard.press('ArrowRight');
  await height.blur();
  await page.locator('[data-testid="v7-dimensional-decoration-canvas"]').waitFor();

  if (compact) {
    const dialog = page.getByRole('dialog', { name: '属性面板' });
    const buttonTargets = await dialog.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '', height: button.getBoundingClientRect().height })));
    compactInteractionMetrics.buttonTargets = buttonTargets;
    compactInteractionMetrics.minButtonHeight = Math.min(...buttonTargets.map((target) => target.height));
    if (viewport.name === '390') await page.screenshot({ path: fileURLToPath(new URL('390-decoration-inspector.png', evidenceDir)), fullPage: false });
    await page.getByRole('button', { name: '关闭工作区面板' }).last().click();
    compactInteractionMetrics.focusRestored = await page.getByRole('button', { name: '层级', exact: true }).evaluate((button) => document.activeElement === button);
    if (!compactInteractionMetrics.initialFocusInside || !compactInteractionMetrics.trappedFocusInside || !compactInteractionMetrics.focusRestored) throw new Error(`${viewport.name}: compact focus lifecycle failed`);
    if (compactInteractionMetrics.minButtonHeight < 43.5) throw new Error(`${viewport.name}: compact touch target below 44px ${JSON.stringify(buttonTargets)}`);
  }

  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const step = state.doc?.nails[state.currentFinger].steps.find((item) => item.kind === 'dimensional_decoration');
    const attachment = step?.kind === 'dimensional_decoration' ? step.decorations.find((item) => item.kind === 'attachment_3d') : null;
    if (!step || step.kind !== 'dimensional_decoration' || !attachment || attachment.kind !== 'attachment_3d') throw new Error('attachment missing');
    const result = state.replaceDimensionalDecoration(state.currentFinger, step.id, attachment.id, { ...attachment, asset: { ...attachment.asset, sha256: '0'.repeat(64) } });
    if (!result.ok) throw new Error(result.message);
  });
  const canvas = page.locator('[data-testid="v7-dimensional-decoration-canvas"][data-preview-fidelity="unavailable"]');
  await canvas.waitFor();
  await canvas.getByText('Mesh 不可用 · 保留 2D').waitFor();
  await canvas.getByText('不代表物理结构、装配或可制造性').waitFor();

  const metrics = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const steps = state.doc?.nails[state.currentFinger].steps ?? [];
    const dimensional = steps.find((item) => item.kind === 'dimensional_decoration');
    const attachment = dimensional?.kind === 'dimensional_decoration' ? dimensional.decorations.find((item) => item.kind === 'attachment_3d') : null;
    const shell = document.querySelector('[data-editor-schema="7"]');
    const canvas = document.querySelector('[data-testid="v7-dimensional-decoration-canvas"]');
    return {
      layout: shell?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      fidelity: canvas?.getAttribute('data-preview-fidelity'),
      unavailableCount: Number(canvas?.getAttribute('data-unavailable-count') ?? 0),
      decorationCount: dimensional?.kind === 'dimensional_decoration' ? dimensional.decorations.length : 0,
      assetRefRetained: attachment?.kind === 'attachment_3d' && attachment.asset.sha256 === '0'.repeat(64),
      finishCount: steps.filter((item) => item.kind === 'surface_finish').length,
      finishLast: steps.at(-1)?.kind === 'surface_finish',
    };
  });
  if (metrics.bodyScrollWidth > metrics.bodyClientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (metrics.canvasWidth <= 0 || metrics.decorationCount !== 3) throw new Error(`${viewport.name}: decoration canvas/data missing`);
  if (metrics.fidelity !== 'unavailable' || metrics.unavailableCount !== 1 || !metrics.assetRefRetained) throw new Error(`${viewport.name}: mesh fallback did not preserve the ref`);
  if (metrics.finishCount !== 1 || !metrics.finishLast) throw new Error(`${viewport.name}: canonical finish invariant failed`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-dimensional-decoration.png`, evidenceDir)), fullPage: false });
  reports.push({ viewport, metrics, compactInteractionMetrics, consoleErrors, pageErrors });
  await context.close();
}
await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-dimensional-walkthrough] ${reports.length} viewports passed`);
