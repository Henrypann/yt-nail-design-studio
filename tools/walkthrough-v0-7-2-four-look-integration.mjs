#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.FOUR_LOOK_BASE_URL ?? 'http://127.0.0.1:5238';
const evidenceRoot = path.resolve(process.env.FOUR_LOOK_E2E_OUTPUT ?? 'evidence/pr-look-v0-7-2-four-sets-integration');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
const fortyFingerRoot = path.join(screenshotRoot, '40-finger');
await fs.mkdir(screenshotRoot, { recursive: true });
await fs.mkdir(fortyFingerRoot, { recursive: true });

const fingerCodes = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];

const cases = [
  { id: 'leopard-gilded-nude', title: 'Leopard Gilded Nude', width: 390, height: 844, touch: true, flat: 10, effect: 0, dimensional: 3 },
  { id: 'crimson-reliquary', title: 'Crimson Reliquary', width: 1280, height: 800, flat: 8, effect: 0, dimensional: 6 },
  { id: 'ivory-lace-crystal', title: 'Ivory Lace Crystal', width: 1440, height: 900, flat: 10, effect: 0, dimensional: 8 },
  { id: 'honey-petal-glass', title: 'Honey Petal Glass', width: 1024, height: 768, flat: 6, effect: 4, dimensional: 4 },
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = [];

for (const testCase of cases) {
  const context = await browser.newContext({
    viewport: { width: testCase.width, height: testCase.height },
    ...(testCase.touch ? { hasTouch: true, isMobile: true } : {}),
  });
  let page = await context.newPage();
  const errors = [];
  const attachErrors = (target) => {
    target.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    target.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  };
  attachErrors(page);

  const lookId = `look.v0-7-2.${testCase.id}`;
  await page.goto(`${baseURL}/look/${lookId}`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-use-versioned').waitFor();
  assert.match(await page.getByTestId('community-look-evidence').textContent() ?? '', /Canonical PublishedLookV1/);
  assert.match(await page.locator('body').textContent() ?? '', /概念效果/);
  assert.match(await page.getByTestId('community-look-evidence-missing').textContent() ?? '', /否（CONCEPT）/);
  assert.equal(await page.locator(`img[src="/assets/hero-recipes/${testCase.id}/look-cover-16x9-v1.png"]`).count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(screenshotRoot, `${testCase.id}-${testCase.width}-community.png`), fullPage: true });

  const communityPage = page;
  [page] = await Promise.all([context.waitForEvent('page'), communityPage.getByTestId('community-use-versioned').click()]);
  attachErrors(page);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(() => window.opener), null);
  assert.match(communityPage.url(), new RegExp(`/look/${lookId.replaceAll('.', '\\.')}$`));
  await page.getByTestId('versioned-intent-conflict').waitFor();
  await page.getByTestId('versioned-intent-new').click();
  await page.getByTestId('editor-remix-disclosure').waitFor({ timeout: 15_000 });
  assert.match(page.url(), /\/studio\/design\/canvas\?design=design\.remix\./);
  assert.match(await page.getByTestId('editor-remix-disclosure').textContent() ?? '', new RegExp(`dv\\.v0-7-2\\.${testCase.id}\\.1`));

  const stored = await page.evaluate(() => {
    const docsRaw = localStorage.getItem('nail-studio:editor.docs');
    const docs = docsRaw ? JSON.parse(docsRaw).data : {};
    const doc = Object.values(docs).find((candidate) => candidate?.schemaVersion === 7);
    if (!doc) return null;
    const count = (kind) => Object.values(doc.nails).reduce((total, nail) => total + nail.steps.filter((step) => step.kind === kind).length, 0);
    const perFinger = Object.fromEntries(Object.entries(doc.nails).map(([finger, nail]) => {
      const activeMiddle = nail.steps.slice(1, -1).filter((step) => step.visible && !step.skipped);
      const projectedLayerKinds = ['background'];
      if (activeMiddle.some((step) => step.kind === 'flat_design')) projectedLayerKinds.push('flat_design');
      if (activeMiddle.some((step) => step.kind === 'surface_effect')) projectedLayerKinds.push('surface_effect');
      const visibleDecorations = activeMiddle
        .filter((step) => step.kind === 'dimensional_decoration')
        .flatMap((step) => step.decorations)
        .filter((decoration) => decoration.visible).length;
      return [finger, {
        stepKinds: nail.steps.map((step) => step.kind),
        projectedLayerKinds,
        visibleDecorations,
      }];
    }));
    return { designId: doc.designId, title: doc.title, sourceRefs: doc.sourceRefs, nailCount: Object.keys(doc.nails).length,
      flat: count('flat_design'), effect: count('surface_effect'), dimensional: count('dimensional_decoration'), finish: count('surface_finish'), perFinger };
  });
  assert.ok(stored);
  assert.equal(stored.title, `${testCase.title} Remix`);
  assert.deepEqual(stored.sourceRefs, [{ domain: 'community', sourceId: lookId, revision: `dv.v0-7-2.${testCase.id}.1` }]);
  assert.deepEqual(
    { nails: stored.nailCount, flat: stored.flat, effect: stored.effect, dimensional: stored.dimensional, finish: stored.finish },
    { nails: 10, flat: testCase.flat, effect: testCase.effect, dimensional: testCase.dimensional, finish: 10 },
  );
  assert.equal(await page.getByLabel('设计名称').isEnabled(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(screenshotRoot, `${testCase.id}-${testCase.width}-editor.png`), fullPage: true });
  await page.getByRole('button', { name: /个性化设计/ }).click();
  await page.locator('button[data-lane="decorations"]').click();
  const dimensionalCanvas = page.getByTestId('v7-dimensional-decoration-canvas');
  await dimensionalCanvas.waitFor();
  assert.ok((await dimensionalCanvas.textContent())?.trim().length > 0, `${testCase.id} dimensional preview is visible`);
  await page.screenshot({ path: path.join(screenshotRoot, `${testCase.id}-${testCase.width}-editor-dimensional.png`), fullPage: true });

  // Stage 3: Customer Preview & 3D PBR View
  await page.locator('[data-stage-id="customer"]').click();
  const customerPreview = page.locator('[data-testid="customer-preview-v7"]');
  await customerPreview.waitFor();
  await page.screenshot({ path: path.join(screenshotRoot, `${testCase.id}-${testCase.width}-customer-overview.png`), fullPage: true });

  await page.getByRole('button', { name: '模拟 3D' }).click();
  await page.getByRole('button', { name: '单指聚焦' }).click();
  const pbr = page.locator('[data-testid="single-nail-pbr-v0-7-2"]');
  await pbr.waitFor();

  const switcher = page.locator('[data-testid="customer-single-finger-switcher"]');
  assert.equal(await switcher.locator('button[data-finger]').count(), 10, `${testCase.id} exposes all ten canonical fingers`);
  const pbrFingers = [];
  for (const finger of fingerCodes) {
    await switcher.locator(`button[data-finger="${finger}"]`).click();
    await page.waitForFunction((requestedFinger) => {
      const root = document.querySelector('[data-testid="customer-preview-v7"]');
      const runtime = document.querySelector('[data-testid="single-nail-pbr-v0-7-2"]');
      const host = document.querySelector('[data-testid="single-nail-pbr-canvas-host"]');
      const canvas = host?.querySelector('canvas');
      const finger = runtime?.getAttribute('data-finger');
      return finger === requestedFinger
        && root?.getAttribute('data-selected-finger') === requestedFinger
        && runtime?.getAttribute('data-runtime-status') === 'ready'
        && host?.getAttribute('data-camera-framing-safe') === 'true'
        && runtime?.getAttribute('data-render-bounds') === 'nail-and-visible-decorations'
        && Boolean(finger && canvas && canvas.getAttribute('aria-label')?.startsWith(`${finger} `)
          && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0);
    }, finger);
    const metrics = await pbr.evaluate((runtime) => ({
      finger: runtime.getAttribute('data-finger'),
      materialHash: runtime.getAttribute('data-material-hash'),
      projectedLayerKinds: (runtime.getAttribute('data-projected-layer-kinds') ?? '').split(',').filter(Boolean),
      textureAssetSet: runtime.getAttribute('data-texture-asset-set'),
      renderedDecorations: Number(runtime.getAttribute('data-decoration-rendered-count')),
      fallbackDecorations: Number(runtime.getAttribute('data-decoration-fallback-count')),
      renderBounds: runtime.getAttribute('data-render-bounds'),
    }));
    assert.equal(metrics.finger, finger);
    assert.equal(metrics.textureAssetSet, 'none', `${testCase.id}/${finger} must use its canonical per-finger projection`);
    assert.deepEqual(metrics.projectedLayerKinds, stored.perFinger[finger].projectedLayerKinds,
      `${testCase.id}/${finger} projected layers preserve the signed allocation`);
    assert.equal(metrics.renderedDecorations, stored.perFinger[finger].visibleDecorations,
      `${testCase.id}/${finger} renders every visible dimensional decoration`);
    assert.equal(metrics.fallbackDecorations, 0, `${testCase.id}/${finger} immutable mesh references resolve without degradation`);
    assert.equal(metrics.renderBounds, 'nail-and-visible-decorations');
    assert.ok(metrics.materialHash, `${testCase.id}/${finger} exposes a deterministic projection hash`);
    await pbr.screenshot({ path: path.join(fortyFingerRoot, `${testCase.id}-${testCase.width}-${finger}.png`) });
    pbrFingers.push({ ...stored.perFinger[finger], ...metrics, cameraFramingSafe: true });

    const targetFinger = testCase.id === 'crimson-reliquary' ? 'R3' : 'R4';
    if (finger === 'L1' || finger === targetFinger) {
      await page.screenshot({ path: path.join(screenshotRoot, `${testCase.id}-${testCase.width}-pbr-3d-${finger}.png`), fullPage: true });
    }
  }

  assert.deepEqual(errors, []);
  report.push({ lookId, viewport: `${testCase.width}x${testCase.height}`, canonical: stored, pbrFingers, errors });
  await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({ baseURL, report }, null, 2)}\n`);
  console.log(`[four-look-integration] PASS ${testCase.id} @ ${testCase.width}x${testCase.height}`);
  await context.close();
}

await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({ baseURL, report }, null, 2)}\n`);
assert.equal(report.flatMap((entry) => entry.pbrFingers).length, 40, 'all four complete ten-finger allocations are verified');
console.log('[walkthrough:look-v0-7-2-four-sets-integration] PASS');
await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 5_000)),
]);
