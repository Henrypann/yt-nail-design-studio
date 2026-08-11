import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.V7_WALKTHROUGH_URL ?? 'http://127.0.0.1:5211';
const evidenceDir = new URL('../evidence/pr-v7-12-surface-effect-2d/', import.meta.url);
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
    await dialog.getByRole('button', { name: '效果', exact: true }).click();
    await dialog.getByRole('button', { name: '属性', exact: true }).click();
    const buttonTargets = await page.getByRole('dialog', { name: '属性面板' }).locator('button:visible').evaluateAll((buttons) => buttons.map((button) => ({
      label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
      height: button.getBoundingClientRect().height,
    })));
    compactInteractionMetrics = {
      initialFocusInside,
      trappedFocusInside,
      buttonTargets,
      minButtonHeight: Math.min(...buttonTargets.map((target) => target.height)),
    };
  } else {
    await page.locator('[data-testid="v7-layer-panel"]').getByRole('button', { name: '效果', exact: true }).click();
  }
  await page.locator('[data-testid="v7-surface-effect-panel"]').waitFor();
  await page.getByRole('button', { name: '局部闪粉', exact: true }).click();
  await page.getByRole('button', { name: '斜切', exact: true }).click();
  await page.locator('[data-testid="v7-surface-effect-canvas"][data-effect-type="glitter"]').waitFor();

  if (viewport.name === '390') await page.screenshot({ path: fileURLToPath(new URL('390-effect-inspector.png', evidenceDir)), fullPage: false });
  if (compact) {
    await page.getByRole('button', { name: '关闭工作区面板' }).last().click();
    compactInteractionMetrics.focusRestored = await page.getByRole('button', { name: '层级', exact: true }).evaluate((button) => document.activeElement === button);
    if (!compactInteractionMetrics.initialFocusInside || !compactInteractionMetrics.trappedFocusInside || !compactInteractionMetrics.focusRestored) throw new Error(`${viewport.name}: compact focus lifecycle failed`);
    if (compactInteractionMetrics.minButtonHeight < 43.5) throw new Error(`${viewport.name}: compact touch target below 44px ${JSON.stringify(compactInteractionMetrics.buttonTargets)}`);
  }

  await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const step = state.doc?.nails[state.currentFinger].steps.find((candidate) => candidate.kind === 'surface_effect');
    if (!step || step.kind !== 'surface_effect') throw new Error('surface effect step missing');
    const result = state.setSurfaceEffect(state.currentFinger, step.id, { ...step.effect, previewFidelity: 'unavailable' });
    if (!result.ok) throw new Error(result.message);
  });
  const canvas = page.locator('[data-testid="v7-surface-effect-canvas"]');
  await page.locator('[data-testid="v7-surface-effect-canvas"][data-preview-fidelity="unavailable"]').waitFor();
  await page.getByText('当前 adapter 无法表达此效果').waitFor();
  await page.getByText('不代表最终 3D、材料性能或物理可制造性').first().waitFor();

  const metrics = await page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const steps = state.doc?.nails[state.currentFinger].steps ?? [];
    const shell = document.querySelector('[data-editor-schema="7"]');
    const canvas = document.querySelector('[data-testid="v7-surface-effect-canvas"]');
    return {
      layout: shell?.getAttribute('data-layout'),
      bodyClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      fidelity: canvas?.getAttribute('data-preview-fidelity'),
      effectType: canvas?.getAttribute('data-effect-type'),
      finishCount: steps.filter((step) => step.kind === 'surface_finish').length,
      finishLast: steps.at(-1)?.kind === 'surface_finish',
    };
  });
  if (metrics.bodyScrollWidth > metrics.bodyClientWidth + 1) throw new Error(`${viewport.name}: document overflow`);
  if (metrics.canvasWidth <= 0) throw new Error(`${viewport.name}: effect canvas hidden`);
  if (metrics.fidelity !== 'unavailable') throw new Error(`${viewport.name}: unavailable fallback missing`);
  if (metrics.finishCount !== 1 || !metrics.finishLast) throw new Error(`${viewport.name}: canonical finish invariant failed`);
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`${viewport.name}: runtime errors ${JSON.stringify({ pageErrors, consoleErrors })}`);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.name}-surface-effect.png`, evidenceDir)), fullPage: false });
  reports.push({ viewport, metrics, compactInteractionMetrics, consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(reports, null, 2)}\n`);
console.log(`[v7-surface-effect-walkthrough] ${reports.length} viewports passed`);
