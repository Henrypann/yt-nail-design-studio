#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.PETAL_PEARL_URL ?? 'http://127.0.0.1:5201';
const evidenceRoot = path.resolve(process.env.PETAL_PEARL_OUTPUT ?? 'evidence/petal-pearl-bloom-v1');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
await fs.mkdir(screenshotRoot, { recursive: true });

const viewports = [
  { name: '390', width: 390, height: 844, touch: true },
  { name: '1280', width: 1280, height: 900 },
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const reports = [];

for (const viewport of viewports) {
  console.log(`[petal-pearl] ${viewport.name}: open Community Look`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ...(viewport.touch ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  await page.goto(`${baseURL}/look/cc_petal_pearl_bloom`, { waitUntil: 'networkidle' });
  await page.getByText('花瓣珍珠绽放', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(screenshotRoot, `${viewport.name}-community-look.png`), fullPage: true });
  console.log(`[petal-pearl] ${viewport.name}: enter Wizard`);
  await page.getByTestId('community-try-in-studio').click();
  await page.waitForTimeout(800);
  if (await page.getByTestId('community-intent-new').count()) await page.getByTestId('community-intent-new').click();
  try {
    await page.locator('[data-debug-id="studio.wizard.bridge"]').waitFor({ timeout: 8_000 });
  } catch (error) {
    const diagnostic = {
      url: page.url(),
      intent: await page.evaluate(() => localStorage.getItem('nail-studio:community.studio-import-intent')),
      body: (await page.locator('body').innerText()).slice(0, 1200),
    };
    throw new Error(`${viewport.name}: Wizard bridge unavailable: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  console.log(`[petal-pearl] ${viewport.name}: enter Editor`);
  await page.getByRole('button', { name: '进入 Editor' }).click();
  const bridgeConfirm = page.getByRole('button', { name: '我已了解，进入自由画布' });
  await bridgeConfirm.waitFor();
  await bridgeConfirm.click();
  console.log(`[petal-pearl] ${viewport.name}: waiting for V7 shell at ${page.url()}`);
  const shell = page.locator('[data-editor-schema="7"]');
  try {
    await shell.waitFor({ timeout: 12_000 });
  } catch (error) {
    throw new Error(`${viewport.name}: Editor V7 shell unavailable at ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 1200)}`, { cause: error });
  }
  console.log(`[petal-pearl] ${viewport.name}: V7 shell ready`);

  const canonical = await page.evaluate(() => {
    const raw = localStorage.getItem('nail-studio:editor.docs');
    const docs = raw ? JSON.parse(raw).data : {};
    const doc = Object.values(docs).find((candidate) => candidate?.schemaVersion === 7);
    if (!doc) return null;
    const count = (kind) => Object.values(doc.nails).reduce((total, nail) => total + nail.steps.filter((step) => step.kind === kind).length, 0);
    return { designId: doc.designId, title: doc.title, flat: count('flat_design'), effect: count('surface_effect'), dimensional: count('dimensional_decoration') };
  });
  assert.deepEqual(canonical && { title: canonical.title, flat: canonical.flat, effect: canonical.effect, dimensional: canonical.dimensional }, {
    title: 'Petal Pearl Bloom', flat: 2, effect: 2, dimensional: 10,
  });
  console.log(`[petal-pearl] ${viewport.name}: inspect flat outline`);

  await page.locator('button[data-finger="L3"]').click();
  await page.getByRole('button', { name: /个性化设计/ }).click();
  await page.locator('button[data-lane="flat"]').click();
  console.log(`[petal-pearl] ${viewport.name}: flat selection applied`);
  try {
    await page.getByTestId('v7-flat-design-canvas').waitFor({ timeout: 8_000 });
  } catch (error) {
    const selected = await page.evaluate(async () => {
      const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
      const state = editorV7Store.getState();
      return { finger: state.currentFinger, selectedStepId: state.selectedStepId, switching: state.switching, kinds: state.doc?.nails[state.currentFinger].steps.map((step) => step.kind) };
    });
    throw new Error(`${viewport.name}: flat canvas unavailable: ${JSON.stringify(selected)}`, { cause: error });
  }
  console.log(`[petal-pearl] ${viewport.name}: flat canvas ready`);
  try {
    await page.locator('[data-flat-content-status="bundled"]').waitFor({ timeout: 8_000 });
  } catch (error) {
    const status = await page.locator('[data-flat-content-status]').evaluateAll((nodes) => nodes.map((node) => ({ status: node.getAttribute('data-flat-content-status'), resolver: node.getAttribute('data-resolver-status') })));
    throw new Error(`${viewport.name}: bundled outline unavailable: ${JSON.stringify(status)}`, { cause: error });
  }
  await page.screenshot({ path: path.join(screenshotRoot, `${viewport.name}-flat-outline.png`), fullPage: true });

  console.log(`[petal-pearl] ${viewport.name}: inspect crystal composition`);
  await page.locator('button[data-finger="L2"]').click();
  await page.getByRole('button', { name: /个性化设计/ }).click();
  await page.locator('button[data-lane="decorations"]').click();
  await page.getByTestId('v7-dimensional-decoration-canvas').waitFor();
  const labels = await page.getByTestId('v7-dimensional-decoration-canvas').textContent();
  assert.match(labels ?? '', /透明水晶花/);
  assert.match(labels ?? '', /淡紫珍珠/);
  assert.match(labels ?? '', /酒红微珠/);
  await page.screenshot({ path: path.join(screenshotRoot, `${viewport.name}-crystal-flower.png`), fullPage: true });

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  assert.deepEqual(errors, []);
  reports.push({ viewport: viewport.name, canonical, bundledOutline: true, dimensionalLabels: true, errors });
  console.log(`[petal-pearl] ${viewport.name}: PASS`);
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({ baseURL, reports }, null, 2)}\n`);
console.log('[walkthrough:petal-pearl-bloom] PASS');
