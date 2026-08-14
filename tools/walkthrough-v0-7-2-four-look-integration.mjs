#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.FOUR_LOOK_BASE_URL ?? 'http://127.0.0.1:5238';
const evidenceRoot = path.resolve(process.env.FOUR_LOOK_E2E_OUTPUT ?? 'evidence/pr-look-v0-7-2-four-sets-integration');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
await fs.mkdir(screenshotRoot, { recursive: true });

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
    return { designId: doc.designId, title: doc.title, sourceRefs: doc.sourceRefs, nailCount: Object.keys(doc.nails).length,
      flat: count('flat_design'), effect: count('surface_effect'), dimensional: count('dimensional_decoration'), finish: count('surface_finish') };
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
  assert.deepEqual(errors, []);
  report.push({ lookId, viewport: `${testCase.width}x${testCase.height}`, canonical: stored, errors });
  await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({ baseURL, report }, null, 2)}\n`);
  console.log(`[four-look-integration] PASS ${testCase.id} @ ${testCase.width}x${testCase.height}`);
  await context.close();
}

await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({ baseURL, report }, null, 2)}\n`);
console.log('[walkthrough:look-v0-7-2-four-sets-integration] PASS');
await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 5_000)),
]);
