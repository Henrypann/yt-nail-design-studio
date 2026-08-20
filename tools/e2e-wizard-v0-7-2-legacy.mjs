#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.LEGACY_QUICK_START_URL ?? 'http://127.0.0.1:5204';
const evidenceDir = resolve(process.env.LEGACY_QUICK_START_OUTPUT ?? 'evidence/pr-wizard-v0-7-2-04-quick-start-ui/legacy-e2e');
const screenshotDir = resolve(evidenceDir, 'screenshots');
await mkdir(screenshotDir, { recursive: true });

async function createLegacyIntent(page) {
  return page.evaluate(async () => {
    const { createStudioImportIntent } = await import('/src/community/domain/studio-import-intent.ts');
    const index = await fetch('/community/content-index.json').then((response) => response.json());
    const content = index.contents.find((item) => item.contentId === 'cc_mercury_dew');
    if (!content) throw new Error('legacy fixture missing');
    const created = createStudioImportIntent({
      content,
      returnTo: `/look/${content.contentId}`,
      suggestedContext: { shape: content.recommendedShapes[0], length: content.supportedLengths[0] },
    });
    if (!created.ok) throw new Error(`legacy intent creation failed: ${created.reason}`);
    return created;
  });
}

const browser = await chromium.launch({ headless: true });
const report = [];
const viewports = [{ name: '390', width: 390, height: 844, hasTouch: true }, { name: '1280', width: 1280, height: 900, hasTouch: false }]
  .filter((viewport) => !process.env.LEGACY_QUICK_START_VIEWPORT || viewport.name === process.env.LEGACY_QUICK_START_VIEWPORT);

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.hasTouch });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const created = await createLegacyIntent(page);
  await page.goto(new URL(created.href, baseUrl).toString(), { waitUntil: 'networkidle' });
  const source = page.getByTestId('wizard-legacy-source');
  try {
    await source.waitFor({ timeout: 5_000 });
  } catch {
    const debug = await page.evaluate(async () => {
      const { useWizardStore } = await import('/src/studio/wizard/wizard-store.ts');
      const value = useWizardStore.getState();
      return { url: location.href, body: document.body.innerText, keys: Object.keys(localStorage), source: value.communitySourceRef, templateId: value.templateId, asset: value.templateAssetRef };
    });
    throw new Error(`${viewport.name}: legacy source not visible ${JSON.stringify(debug)}`);
  }
  const sourceText = await source.innerText();
  assert.match(sourceText, /Legacy 近似应用/);
  assert.match(sourceText, /cc_mercury_dew/);
  assert.match(sourceText, /t_mercury_dew_concept/);
  assert.match(sourceText, /1\.0\.0/);
  const state = await page.evaluate(() => {
    const draftEnvelope = JSON.parse(localStorage.getItem('nail-studio:wizard.active-draft'));
    const value = draftEnvelope?.data ?? {};
    return {
      source: value.communitySourceRef,
      asset: value.templateAssetRef ?? value.source?.asset,
      step: value.step,
      hasIntentParam: new URL(location.href).searchParams.has('communityIntent'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  assert.ok(state.step === 1 || state.step === 2, 'legacy import must stay inside Quick Start');
  assert.equal(state.hasIntentParam, false);
  assert.equal(state.overflow, false);
  assert.equal(state.source?.assetVersion, '1.0.0');
  assert.match(state.asset?.sha256 ?? '', /^[0-9a-f]{64}$/);
  assert.ok(state.asset?.revision);
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.screenshot({ path: resolve(screenshotDir, `${viewport.name}-legacy-quick-start.png`), fullPage: true });
  report.push({ viewport: viewport.name, status: 'PASS', source: state.source, asset: state.asset, noOverflow: true, errors });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const created = await createLegacyIntent(page);
  await page.evaluate((intentId) => {
    const key = 'nail-studio:community.studio-import-intent';
    const envelope = JSON.parse(localStorage.getItem(key));
    envelope.data[intentId].assetRef.assetVersion = '9.9.9';
    localStorage.setItem(key, JSON.stringify(envelope));
  }, created.intentId);
  await page.goto(new URL(created.href, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.getByText('Community 资产已更新，请重新试用。').waitFor();
  await page.waitForURL(/\/look\/cc_mercury_dew$/);
  assert.equal(await page.getByTestId('wizard-legacy-source').count(), 0);
  report.push({ viewport: '390', mismatch: 'PASS', reason: 'asset_mismatch', applied: false });
  await context.close();
}

await writeFile(resolve(evidenceDir, 'walkthrough-report.json'), `${JSON.stringify({ baseUrl, report }, null, 2)}\n`);
await browser.close();
console.log('[e2e:wizard-v0-7-2-legacy] PASS');
