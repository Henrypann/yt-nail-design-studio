import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.GEO_V072_URL ?? 'http://127.0.0.1:5251';
const evidenceDir = new URL('../evidence/pr-geo-v0-7-2-03-surface-boolean/', import.meta.url);
const screenshotDir = new URL('./screenshots/', evidenceDir);
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const reports = [];
console.log(`surface-boolean E2E: ${baseUrl}`);

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  console.log(`surface-boolean E2E: ${viewport.width} start`);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('surface-boolean-writer-zero', 'preserve-me');
    localStorage.setItem('nail-studio:editor.docs', '{"sentinel":"unchanged"}');
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const assetResponses = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (/almond-medium-v3\/shell\.web\.glb|lavender-pearl\.web\.glb/.test(response.url())) {
      assetResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] });
    }
  });
  await page.goto(`${baseUrl}/internal/surface-boolean-v072`, { waitUntil: 'domcontentloaded' });
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  await page.locator('[data-testid="surface-boolean-page"]').waitFor();
  await page.waitForFunction(() => Boolean(window.__SURFACE_BOOLEAN_V072__), null, { timeout: 30_000 });
  console.log(`surface-boolean E2E: ${viewport.width} geometry ready`);
  const evidence = await page.evaluate(() => window.__SURFACE_BOOLEAN_V072__);
  if (evidence.registryEntryId !== 'geometry-registry.almond.medium.visual-v3') throw new Error(`${viewport.width}: wrong registry entry`);
  if (evidence.placement.method !== 'uv_barycentric_surface_frame' || evidence.placement.fixedZUsed !== false) {
    throw new Error(`${viewport.width}: fixed-Z or wrong placement ${JSON.stringify(evidence.placement)}`);
  }
  if (!Object.values(evidence.deterministic).every(Boolean)) throw new Error(`${viewport.width}: nondeterministic result`);
  for (const operation of ['union', 'subtract', 'intersect']) {
    const topology = evidence.topology[operation];
    if (topology.componentCount !== 1 || topology.boundaryEdgeCount !== 0 || topology.nonManifoldEdgeCount !== 0) {
      throw new Error(`${viewport.width}: ${operation} topology invalid`);
    }
  }
  const stage = page.locator('.surface-boolean-stage');
  const shots = [
    { operation: 'union', camera: 'oblique', file: '01-union-oblique.png' },
    { operation: 'subtract', camera: 'side', file: '02-subtract-side.png' },
    { operation: 'intersect', camera: 'underside', file: '03-intersect-underside.png' },
  ];
  for (const shot of shots) {
    await page.getByRole('group', { name: '布尔操作' }).getByRole('button', { name: shot.operation, exact: true }).click();
    await page.getByRole('group', { name: '结果对比' }).getByRole('button', { name: 'after', exact: true }).click();
    await page.getByRole('group', { name: '相机视角' }).getByRole('button', { name: shot.camera, exact: true }).click();
    await page.waitForTimeout(200);
    await stage.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-${shot.file}`, screenshotDir)) });
  }
  await page.getByRole('group', { name: '结果对比' }).getByRole('button', { name: 'before', exact: true }).click();
  await page.getByRole('group', { name: '相机视角' }).getByRole('button', { name: 'oblique', exact: true }).click();
  await page.waitForTimeout(100);
  await stage.screenshot({ path: fileURLToPath(new URL(`${viewport.width}-04-before-surface-frame.png`, screenshotDir)) });
  const storageAfter = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    canvas: document.querySelector('[data-testid="surface-boolean-canvas"]')?.getBoundingClientRect().toJSON(),
    buttons: [...document.querySelectorAll('.surface-boolean-stage button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent, width: rect.width, height: rect.height };
    }),
  }));
  if (storageAfter !== storageBefore) throw new Error(`${viewport.width}: preview changed localStorage`);
  if (geometry.scrollWidth > geometry.clientWidth + 1) throw new Error(`${viewport.width}: horizontal overflow`);
  if (viewport.width < 800 && geometry.buttons.some((button) => button.width < 44 || button.height < 44)) {
    throw new Error(`${viewport.width}: touch target below 44px ${JSON.stringify(geometry.buttons)}`);
  }
  if (assetResponses.length !== 2 || assetResponses.some((response) => response.status !== 200)) {
    throw new Error(`${viewport.width}: immutable asset request mismatch ${JSON.stringify(assetResponses)}`);
  }
  if (consoleErrors.length || pageErrors.length) throw new Error(`${viewport.width}: runtime errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
  reports.push({ viewport, evidence, assetResponses, writerZero: true, geometry, consoleErrors, pageErrors });
  console.log(`surface-boolean E2E: ${viewport.width} evidence captured`);
  await context.close();
}

await browser.close();
await writeFile(new URL('walkthrough-report.json', evidenceDir), `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`);
console.log('walkthrough-geo-v0-7-2-surface-boolean: PASS (1440/390, real surface frame, three operations, writer-zero, no overflow/errors)');
