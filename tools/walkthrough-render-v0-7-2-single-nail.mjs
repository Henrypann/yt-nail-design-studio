import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.RENDER_V072_URL ?? 'http://127.0.0.1:5242';
const evidenceDir = new URL('../evidence/pr-render-v0-7-2-01b-single-nail-pbr/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
await page.getByRole('button', { name: /^保存$/ }).click();
await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
const designId = await page.evaluate(async () => {
  const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
  return editorV7Store.getState().doc.designId;
});
await page.locator('[data-stage-id="customer"]').click();
const preview = page.locator('[data-testid="customer-preview-v7"]');
await preview.waitFor();
const storageBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));

// Ten-finger 3D stays on the existing SVG 2.5D composite.
await page.getByRole('button', { name: '模拟 3D' }).click();
if (await preview.getAttribute('data-preview-runtime') !== 'v7-svg-composite') throw new Error('ten-finger composite runtime changed');
if (await page.locator('[data-testid="single-nail-pbr-v0-7-2"]').count()) throw new Error('PBR loaded in ten-finger mode');
await page.screenshot({ path: fileURLToPath(new URL('01-ten-finger-existing-composite.png', screenshotDir)), fullPage: false });

// Single-nail + simulated 3D is the only new runtime entrance.
await page.locator('[data-testid="customer-ten-finger-map"] button[data-finger="L1"]').click();
if (await preview.getAttribute('data-preview-runtime') !== 'v0.7.2-single-nail-pbr') throw new Error('single-nail PBR route not selected');
const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
await pbr.waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-runtime-status') === 'ready');
if (await pbr.locator('canvas').count() !== 1) throw new Error('single-nail PBR canvas missing');
if (await pbr.getAttribute('data-evidence') !== 'simulated-not-manufacturing') throw new Error('PBR evidence label missing');
await pbr.getByRole('button', { name: '侧面' }).click();
await page.waitForTimeout(300);
const sideCamera = await pbr.getAttribute('data-camera-id');
if (sideCamera !== 'side_profile') throw new Error(`side camera state did not settle: ${sideCamera}`);
await page.screenshot({ path: fileURLToPath(new URL('02-single-nail-pbr-side.png', screenshotDir)), fullPage: false });
await pbr.getByRole('button', { name: '正视' }).click();
await page.waitForTimeout(300);
if (await pbr.getAttribute('data-camera-id') !== 'surface') throw new Error('surface camera state did not settle');
await page.screenshot({ path: fileURLToPath(new URL('03-single-nail-pbr-surface.png', screenshotDir)), fullPage: false });

// 2D is unchanged and unloads the PBR runtime.
await page.getByRole('button', { name: '2D 设计' }).click();
await pbr.waitFor({ state: 'detached' });
if (await preview.getAttribute('data-preview-runtime') !== 'v7-svg-composite') throw new Error('single-nail 2D runtime drift');
await page.screenshot({ path: fileURLToPath(new URL('04-single-nail-2d-unchanged.png', screenshotDir)), fullPage: false });
const storageAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
if (storageAfter !== storageBefore) throw new Error('preview interaction wrote Editor storage');
if (consoleErrors.length || pageErrors.length) throw new Error(`runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

// WebGL unavailable: same finger, same route, deterministic SVG 2.5D fallback, zero writes.
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
await fallbackPage.goto(`${baseUrl}/studio/design/preview?design=${encodeURIComponent(designId)}&finger=L1`, { waitUntil: 'networkidle' });
const fallbackPreview = fallbackPage.locator('[data-testid="customer-preview-v7"]');
await fallbackPreview.waitFor();
await fallbackPage.getByRole('button', { name: '单指聚焦' }).click();
await fallbackPage.getByRole('button', { name: '模拟 3D' }).click();
await fallbackPage.locator('[data-testid="single-nail-pbr-fallback"]').waitFor();
if (await fallbackPreview.getAttribute('data-selected-finger') !== 'L1') throw new Error('fallback changed finger');
if (new URL(fallbackPage.url()).pathname !== '/studio/design/preview') throw new Error('fallback navigated away');
if (await fallbackPage.evaluate(() => localStorage.getItem('nail-studio:editor.docs')) !== storageBefore) throw new Error('fallback wrote Editor storage');
if (fallbackConsoleErrors.length || fallbackPageErrors.length) throw new Error(`fallback runtime errors ${JSON.stringify({ fallbackConsoleErrors, fallbackPageErrors })}`);
await fallbackPage.screenshot({ path: fileURLToPath(new URL('05-390-webgl-fallback.png', screenshotDir)), fullPage: false });

const report = {
  designId,
  states: {
    tenFingerComposite: 'v7-svg-composite',
    singleFingerPbr: 'ready',
    singleFinger2d: 'v7-svg-composite',
    webglFallback: 'single-nail-svg-2.5d',
  },
  writerZero: storageAfter === storageBefore,
  selectedFingerPreservedOnFallback: true,
  consoleErrors,
  pageErrors,
  fallbackConsoleErrors,
  fallbackPageErrors,
};
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify(report, null, 2)}\n`);
await fallbackContext.close();
await context.close();
await browser.close();
console.log('walkthrough-render-v0-7-2-single-nail: PASS');
