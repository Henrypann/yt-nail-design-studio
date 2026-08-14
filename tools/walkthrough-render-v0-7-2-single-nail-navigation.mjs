import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.RENDER_V072_URL ?? 'http://127.0.0.1:5238';
const evidenceDir = new URL('../evidence/pr-render-v0-7-2-01b-3-single-nail-navigation/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
const fingers = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];
const cameras = [
  ['surface', '正视'], ['oblique_left', '左斜'], ['oblique_right', '右斜'], ['side_profile', '侧面'], ['tip_grazing', '指尖'],
];
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
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
const resources = page.getByRole('dialog', { name: '资源与预设' });
if (await resources.count()) {
  await resources.getByRole('button', { name: '关闭资源' }).click();
  await resources.waitFor({ state: 'detached' });
}
await page.getByRole('button', { name: /^保存$/ }).click();
await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
await page.locator('[data-stage-id="customer"]').click();
const preview = page.locator('[data-testid="customer-preview-v7"]');
await preview.waitFor();
const storageBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
await page.getByRole('button', { name: '模拟 3D' }).click();
await page.locator('[data-testid="customer-ten-finger-map"] button[data-finger="L1"]').click();
const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
const host = page.locator('[data-testid="single-nail-pbr-canvas-host"]');

async function waitForFramedPbr(expectedFinger) {
  await page.waitForFunction((finger) => {
    const root = document.querySelector('[data-testid="customer-preview-v7"]');
    const runtime = document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]');
    const canvasHost = document.querySelector('[data-testid="single-nail-pbr-canvas-host"]');
    const canvas = canvasHost?.querySelector('canvas');
    return root?.getAttribute('data-selected-finger') === finger
      && runtime?.getAttribute('data-runtime-status') === 'ready'
      && canvasHost?.getAttribute('data-camera-framing-safe') === 'true'
      && Boolean(canvas && canvas.getAttribute('aria-label')?.startsWith(`${finger} `)
        && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0);
  }, expectedFinger);
  const metrics = await host.evaluate((element) => {
    const canvas = element.querySelector('canvas');
    const hostRect = element.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    return {
      fit: element.getAttribute('data-camera-fit'),
      coverage: Number(element.getAttribute('data-camera-coverage')),
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      canvasWidth: canvasRect?.width ?? 0,
      canvasHeight: canvasRect?.height ?? 0,
    };
  });
  if (metrics.fit !== 'bounds-aware' || !Number.isFinite(metrics.coverage) || metrics.coverage > 0.94) {
    throw new Error(`${expectedFinger}: unsafe camera framing ${JSON.stringify(metrics)}`);
  }
  if (metrics.hostWidth < 280 || metrics.hostHeight < 360 || Math.abs(metrics.canvasWidth - metrics.hostWidth) > 3 || Math.abs(metrics.canvasHeight - metrics.hostHeight) > 3) {
    throw new Error(`${expectedFinger}: invalid canvas geometry ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

await pbr.waitFor();
const cameraMetrics = {};
for (const [cameraId, label] of cameras) {
  await pbr.getByRole('button', { name: label }).click();
  await page.waitForFunction((id) => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-camera-id') === id, cameraId);
  await page.waitForTimeout(50);
  cameraMetrics[cameraId] = await waitForFramedPbr('L1');
}
await pbr.getByRole('button', { name: '正视' }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-camera-id') === 'surface');
const desktopMetrics = {};
for (const finger of fingers) {
  await page.locator(`[data-testid="customer-single-finger-switcher"] button[data-finger="${finger}"]`).click();
  desktopMetrics[finger] = await waitForFramedPbr(finger);
}
if (await page.locator('[data-testid="customer-single-finger-switcher"] button').count() !== 10) throw new Error('single finger switcher must expose ten fingers');
await page.screenshot({ path: fileURLToPath(new URL('01-1440-single-nail-ten-finger-switcher.png', screenshotDir)), fullPage: false });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(350);
await page.locator('[data-testid="customer-single-finger-switcher"] button[data-finger="L3"]').click();
const mobileMetrics = await waitForFramedPbr('L3');
const mobileLayout = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('[data-testid="customer-single-finger-switcher"] button')];
  return {
    bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    minimumTarget: Math.min(...buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
  };
});
if (mobileLayout.bodyOverflow > 1 || mobileLayout.minimumTarget < 44) throw new Error(`mobile layout failed ${JSON.stringify(mobileLayout)}`);
await page.screenshot({ path: fileURLToPath(new URL('02-390-single-nail-switcher.png', screenshotDir)), fullPage: false });

const storageAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
if (storageAfter !== storageBefore) throw new Error('single-nail navigation wrote Editor storage');
if (consoleErrors.length || pageErrors.length) throw new Error(`runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);

await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify({
  selectedFingers: fingers,
  cameraMetrics,
  desktopMetrics,
  mobileMetrics,
  mobileLayout,
  writerZero: storageAfter === storageBefore,
  consoleErrors,
  pageErrors,
}, null, 2)}\n`);
await context.close();
await browser.close();
console.log('walkthrough-render-v0-7-2-single-nail-navigation: PASS');
