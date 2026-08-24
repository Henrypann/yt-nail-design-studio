#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5261').replace(/\/+$/, '');
const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence/pr-community-v0-7-2-asset-04a';
const screenshotsDir = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });
const viewports = [390, 768, 1024, 1280, 1366, 1440].map((width) => ({ width, height: width === 390 ? 844 : 900 }));
const browser = await chromium.launch({ headless: true });
const report = { schemaVersion: 1, contractRef: 'COMM-v0.7.2-ASSET-04A', viewports: [], failure: null };

async function assertNoOverflow(page, label) {
  const value = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert.equal(value, true, `${label}: horizontal overflow`);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 768 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const awaiting = page.getByTestId('community-home-merchandising-awaiting-input');
    await awaiting.waitFor();
    assert.equal(await awaiting.getAttribute('data-merchandising-status'), 'AWAITING_INPUT');
    assert.match(await awaiting.textContent() ?? '', /编辑精选正在准备中/);
    assert.match(await awaiting.textContent() ?? '', /不会伪造热门或个性化结果/);
    assert.match(await awaiting.textContent() ?? '', /Studio 官方起稿/);
    assert.equal(await page.getByTestId('community-look-card').count(), 15, 'discovery feed remains available');
    await assertNoOverflow(page, `awaiting-${viewport.width}`);
    const screenshot = viewport.width === 390 || viewport.width === 1280
      ? path.join(screenshotsDir, `awaiting-input-${viewport.width}.png`)
      : null;
    if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
    assert.deepEqual(errors, [], `browser errors @ ${viewport.width}`);
    report.viewports.push({ ...viewport, screenshot, feedCount: 15, noOverflow: true, errors });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/community/home-merchandising-v1.json', (route) => route.fulfill({ status: 500, body: '' }));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const unavailable = page.getByTestId('community-home-merchandising-unavailable');
  await unavailable.waitFor();
  assert.match(await unavailable.textContent() ?? '', /不会以热门、个性化推荐或 Studio 官方模板自动代填/);
  assert.equal(await page.getByTestId('community-look-card').count(), 15, 'config failure does not hide governed discovery feed');
  await assertNoOverflow(page, 'failure-1280');
  const screenshot = path.join(screenshotsDir, 'config-failure-1280.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  report.failure = { visible: true, feedCount: 15, screenshot };
  await context.close();

  fs.writeFileSync(path.join(evidenceDir, 'walkthrough-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('walkthrough-community-home-merchandising: PASS (6 viewports; truthful awaiting-input + fail-closed config failure; feed preserved)');
} finally {
  await browser.close();
}
