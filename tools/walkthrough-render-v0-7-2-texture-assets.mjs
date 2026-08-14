import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.RENDER_V072_URL ?? 'http://127.0.0.1:5245';
const evidenceDir = new URL('../evidence/pr-render-v0-7-2-01b-2-texture-maps/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '创建空白画布' }).click();
await page.locator('[data-editor-schema="7"]').waitFor();
await page.locator('[data-lane="flat"]').click();
const conflict = page.locator('[data-testid="v7-tool-conflict"]');
await conflict.waitFor();
await conflict.getByRole('button', { name: '添加平面设计并继续' }).click();
const resourceDialog = page.getByRole('dialog', { name: '资源与预设' });
if (await resourceDialog.count()) {
  await resourceDialog.getByRole('button', { name: '关闭资源' }).click();
  await resourceDialog.waitFor({ state: 'detached' });
}

const authoring = await page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  const { AURORA_ALMOND_MATERIAL_ASSET_SET_V1: assets } = await import('/src/studio/rendering/v0-7-2/material-projection-fixtures.ts');
  const results = [];
  results.push(editorV7Store.getState().setAdvancedBackgroundMode('L1', assets.background.mode));
  results.push(editorV7Store.getState().setGradientStops('L1', assets.background.stops));
  results.push(editorV7Store.getState().setGradientDirection('L1', assets.background.directionDeg));
  let flat = editorV7Store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  if (!flat) {
    results.push(editorV7Store.getState().addMissingPersonalStep('L1', 'flat_design'));
    flat = editorV7Store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  }
  if (!flat || flat.kind !== 'flat_design') throw new Error('flat step missing');
  assets.flatElements.forEach((element) => results.push(editorV7Store.getState().addElement('L1', flat.id, structuredClone(element))));
  results.push(editorV7Store.getState().addMissingPersonalStep('L1', 'surface_effect'));
  const effectStep = editorV7Store.getState().doc.nails.L1.steps.find((step) => step.kind === 'surface_effect');
  if (!effectStep || effectStep.kind !== 'surface_effect') throw new Error('surface effect step missing');
  results.push(editorV7Store.getState().setSurfaceEffect('L1', effectStep.id, structuredClone(assets.surfaceEffect)));
  results.push(editorV7Store.getState().setSurfaceEffectMask('L1', effectStep.id, structuredClone(assets.surfaceMask)));
  const failures = results.filter((result) => !result.ok);
  if (failures.length) throw new Error(`authoring failed ${JSON.stringify(failures)}`);
  const doc = structuredClone(editorV7Store.getState().doc);
  const materialStep = doc.nails.L1.steps.find((step) => step.id === effectStep.id);
  if (!materialStep) throw new Error('material target step missing');
  materialStep.materialRefs = [{ materialId: 'material.magnetic-gel', revision: '1' }];
  editorV7Store.setState({ doc });
  return { designId: doc.designId, revision: doc.revision, assetSetId: assets.assetSetId, assetRevision: assets.revision };
});

await page.getByRole('button', { name: /^保存$/ }).click();
await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
await page.locator('[data-stage-id="customer"]').click();
const preview = page.locator('[data-testid="customer-preview-v7"]');
await preview.waitFor();
await page.locator('[data-testid="customer-ten-finger-map"] button[data-finger="L1"]').click();
await page.screenshot({ path: fileURLToPath(new URL('01-canonical-2d-source.png', screenshotDir)), fullPage: false });
const storageBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));

await page.getByRole('button', { name: '模拟 3D' }).click();
const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
await pbr.waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-runtime-status') === 'ready');
await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-surface-hash') !== 'pending');
const materialState = await pbr.evaluate((element) => ({
  projection: element.getAttribute('data-material-projection'),
  hash: element.getAttribute('data-material-hash'),
  mode: element.getAttribute('data-material-mode'),
  fidelity: element.getAttribute('data-material-fidelity'),
  uv: element.getAttribute('data-uv-contract'),
  evidence: element.getAttribute('data-evidence'),
  surfaceHash: element.getAttribute('data-surface-hash'),
  textureAssetSet: element.getAttribute('data-texture-asset-set'),
  textureAssetRevision: element.getAttribute('data-texture-asset-revision'),
}));
if (materialState.projection !== 'material-projection-v1') throw new Error(`wrong projection ${JSON.stringify(materialState)}`);
if (materialState.mode !== 'gradient') throw new Error(`gradient not projected ${JSON.stringify(materialState)}`);
if (materialState.uv !== 'nail-local-v1-tip-to-root') throw new Error(`UV contract missing ${JSON.stringify(materialState)}`);
if (!materialState.hash || materialState.hash.length !== 16) throw new Error(`material identity missing ${JSON.stringify(materialState)}`);
if (materialState.textureAssetSet !== 'render.texture-set.aurora-almond-v2') throw new Error(`texture map set missing ${JSON.stringify(materialState)}`);
if (materialState.textureAssetRevision !== '1.0.0-simulated') throw new Error(`texture map revision missing ${JSON.stringify(materialState)}`);
await pbr.getByRole('button', { name: '正视' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: fileURLToPath(new URL('02-pbr-material-surface.png', screenshotDir)), fullPage: false });
await pbr.getByRole('button', { name: '左斜' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: fileURLToPath(new URL('03-pbr-material-oblique.png', screenshotDir)), fullPage: false });
await pbr.getByRole('button', { name: '侧面' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: fileURLToPath(new URL('04-pbr-material-side.png', screenshotDir)), fullPage: false });
await page.getByRole('button', { name: '十指总览' }).click();
await page.locator('[data-testid="customer-ten-finger-map"] button[data-finger="L2"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="customer-preview-v7"]')?.getAttribute('data-selected-finger') === 'L2');
const neutralPbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-runtime-status') === 'ready');
await neutralPbr.getByRole('button', { name: '正视' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: fileURLToPath(new URL('05-neutral-rounded-tip.png', screenshotDir)), fullPage: false });
const storageAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
if (storageAfter !== storageBefore) throw new Error('PBR projection interaction wrote Editor storage');
if (consoleErrors.length || pageErrors.length) throw new Error(`runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
await fallbackContext.addInitScript(({ raw }) => {
  localStorage.clear();
  if (raw) localStorage.setItem('nail-studio:editor.docs', raw);
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
    return original.call(this, type, ...args);
  };
}, { raw: storageBefore });
const fallbackPage = await fallbackContext.newPage();
const fallbackConsoleErrors = [];
const fallbackPageErrors = [];
fallbackPage.on('console', (message) => { if (message.type() === 'error') fallbackConsoleErrors.push(message.text()); });
fallbackPage.on('pageerror', (error) => fallbackPageErrors.push(error.message));
await fallbackPage.goto(`${baseUrl}/studio/design/preview?design=${encodeURIComponent(authoring.designId)}&finger=L1`, { waitUntil: 'networkidle' });
await fallbackPage.getByRole('button', { name: '单指聚焦' }).click();
await fallbackPage.getByRole('button', { name: '模拟 3D' }).click();
await fallbackPage.locator('[data-testid="single-nail-pbr-fallback"]').waitFor();
if (await fallbackPage.evaluate(() => localStorage.getItem('nail-studio:editor.docs')) !== storageBefore) throw new Error('fallback wrote Editor storage');
if (fallbackConsoleErrors.length || fallbackPageErrors.length) throw new Error(`fallback errors ${JSON.stringify({ fallbackConsoleErrors, fallbackPageErrors })}`);
await fallbackPage.screenshot({ path: fileURLToPath(new URL('06-390-material-fallback.png', screenshotDir)), fullPage: false });

const report = {
  designId: authoring.designId,
  authoredRevision: authoring.revision,
  assetSet: { id: authoring.assetSetId, revision: authoring.assetRevision },
  materialState,
  projectedContent: ['gradient background', 'brush stroke', 'vector shape', 'french edge', 'masked ink bloom', 'decal image', 'normal map', 'roughness map', 'visual height map'],
  writerZero: storageAfter === storageBefore,
  fallbackWriterZero: true,
  consoleErrors,
  pageErrors,
  fallbackConsoleErrors,
  fallbackPageErrors,
};
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(report, null, 2)}\n`);
await fallbackContext.close();
await context.close();
await browser.close();
console.log('walkthrough-render-v0-7-2-texture-assets: PASS');
