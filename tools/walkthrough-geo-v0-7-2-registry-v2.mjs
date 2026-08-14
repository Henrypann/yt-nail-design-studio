import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.GEO_V072_URL ?? 'http://127.0.0.1:5250';
const evidenceDir = new URL('../evidence/pr-geo-v0-7-2-02-registry-v2-promotion/', import.meta.url);
const screenshots = new URL('./screenshots/', evidenceDir);
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const glbResponses = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/geometry-v0-7-2/almond-medium-v3/shell.web.glb')) {
      glbResponses.push({ status: response.status(), contentType: response.headers()['content-type'] });
    }
  });
  await page.goto(`${baseUrl}/studio/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '创建空白画布' }).click();
  await page.locator('[data-editor-schema="7"]').waitFor();
  const storageBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  await page.locator('[data-stage-id="customer"]').click();
  await page.locator('[data-testid="customer-preview-v7"]').waitFor();
  await page.locator('[data-testid="customer-ten-finger-map"] button[data-finger="L1"]').click();
  await page.getByRole('button', { name: '模拟 3D' }).click();
  const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
  await pbr.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]')?.getAttribute('data-runtime-status') === 'ready');
  const state = await pbr.evaluate((element) => ({
    registryEntry: element.getAttribute('data-geometry-registry-entry'),
    representation: element.getAttribute('data-geometry-representation'),
    surfaceHash: element.getAttribute('data-surface-hash'),
    evidence: element.getAttribute('data-evidence'),
    width: element.getBoundingClientRect().width,
  }));
  if (state.registryEntry !== 'geometry-registry.almond.medium.visual-v3') throw new Error(`registry entry missing: ${JSON.stringify(state)}`);
  if (state.representation !== 'representation.almond.medium.visual-v3.glb') throw new Error(`promoted GLB missing: ${JSON.stringify(state)}`);
  if (state.surfaceHash !== '05d14797db2369e4864173bc4cee0f830e5fcd2370fab3aa85850d78beae26dc') throw new Error(`canonical geometry hash missing: ${JSON.stringify(state)}`);
  if (glbResponses.length !== 1 || glbResponses[0].status !== 200) throw new Error(`GLB request mismatch: ${JSON.stringify(glbResponses)}`);
  await pbr.getByRole('button', { name: '正视' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-01-promoted-surface.png`, screenshots)) });
  await pbr.getByRole('button', { name: '侧面' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-02-promoted-side.png`, screenshots)) });
  const storageAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  const pageWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (storageAfter !== storageBefore) throw new Error(`${viewport.width}: preview wrote Editor storage`);
  if (pageWidth.scroll > pageWidth.client + 1) throw new Error(`${viewport.width}: horizontal overflow ${JSON.stringify(pageWidth)}`);
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.width}: runtime error ${JSON.stringify({ consoleErrors, pageErrors })}`);
  reports.push({ viewport, state, glbResponses, writerZero: true, pageWidth, consoleErrors, pageErrors });
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
console.log(`walkthrough-geo-v0-7-2-registry-v2: PASS (${reports.map((row) => `${row.viewport.width} promoted GLB`).join(', ')}, writer-zero, no overflow/errors)`);
