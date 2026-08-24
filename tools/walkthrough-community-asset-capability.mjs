#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5261').replace(/\/+$/, '');
const evidenceDir = process.env.EVIDENCE_DIR ?? process.argv[3] ?? 'evidence/pr-community-v0-7-2-asset-03b';
const screenshotsDir = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
];

async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll <= sizes.client + 1, `${label}: horizontal overflow ${JSON.stringify(sizes)}`);
}

async function openLook(page, id, state, cta) {
  await page.goto(`${baseUrl}/look/${id}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('community-look-page').waitFor();
  const section = page.getByTestId('community-asset-capability');
  await section.waitFor();
  assert.equal(await section.getAttribute('data-capability-state'), state, id);
  assert.equal(await section.getAttribute('data-capability-cta'), cta, id);
  assert.equal(await page.getByTestId('community-asset-capability-badge').count(), 1, id);
  await noOverflow(page, id);
  return section;
}

async function verifyHomeCards(page, viewportWidth) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-look-grid').waitFor();

  const legacy = page.locator('[data-look-id="cc_mercury_dew"]');
  assert.equal(
    await legacy.getByTestId('look-card-use').getAttribute('data-use-state'),
    'LEGACY_APPROXIMATE',
    `legacy card @ ${viewportWidth}`,
  );
  assert.equal(await legacy.getByTestId('community-asset-capability-badge').count(), 1);

  const incomplete = page.locator('[data-look-id="cc_liquid_chrome_statement"]');
  assert.equal(
    await incomplete.getByTestId('look-card-use-disabled').getAttribute('data-use-state'),
    'ASSETS_INCOMPLETE',
    `incomplete card @ ${viewportWidth}`,
  );

  const unavailable = page.locator('[data-look-id="cc_petal_pearl_bloom"]');
  assert.equal(
    await unavailable.getByTestId('look-card-use-disabled').getAttribute('data-use-state'),
    'UNAVAILABLE',
    `unavailable card @ ${viewportWidth}`,
  );
  await noOverflow(page, `home-${viewportWidth}`);
  const screenshot = viewportWidth === 390 || viewportWidth === 1280
    ? path.join(screenshotsDir, `home-capability-${viewportWidth}.png`)
    : null;
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  return screenshot;
}

const browser = await chromium.launch({ headless: true });
const report = { schemaVersion: 1, contractRef: 'COMM-v0.7.2-ASSET-03B', viewports: [], failure: null };

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 768 });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const homeScreenshot = await verifyHomeCards(page, viewport.width);
    await openLook(page, 'cc_mercury_dew', 'LEGACY_APPROXIMATE', 'USE_LEGACY_APPROXIMATE');
    const beforeStorage = await page.evaluate(() => JSON.stringify(localStorage));
    const legacyUse = page.getByTestId('community-try-in-studio');
    await legacyUse.waitFor();
    const legacyHeight = await legacyUse.evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(legacyHeight >= 44, `legacy CTA height ${legacyHeight} < 44 @ ${viewport.width}`);
    await legacyUse.click();
    await page.getByText('近似应用说明', { exact: true }).waitFor();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), beforeStorage, `legacy preview/cancel writer-zero @ ${viewport.width}`);

    await openLook(page, 'cc_liquid_chrome_statement', 'ASSETS_INCOMPLETE', 'VIEW_ONLY');
    const incompleteUse = page.getByTestId('community-use-disabled');
    assert.equal(await incompleteUse.isDisabled(), true);
    assert.equal(await incompleteUse.getAttribute('data-use-state'), 'ASSETS_INCOMPLETE');
    assert.match(await page.getByTestId('community-asset-capability-diagnostics').textContent() ?? '', /未找到显式可编辑资产血缘/);

    await openLook(page, 'cc_petal_pearl_bloom', 'UNAVAILABLE', 'UNAVAILABLE');
    assert.equal(await page.getByTestId('community-use-versioned').count(), 0);
    assert.equal(await page.getByTestId('community-try-in-studio').count(), 0);
    assert.match(await page.getByTestId('community-asset-capability-diagnostics').textContent() ?? '', /甲型覆盖与资产路径尚未签收/);

    await openLook(page, 'look.v7-1.petal-veil', 'VERSIONED_READY', 'USE_VERSIONED');
    const versionedUse = page.getByTestId('community-use-versioned');
    await versionedUse.waitFor();
    assert.match(await page.getByTestId('community-asset-capability-diagnostics').textContent() ?? '', /EXACT 仅指版本与 SHA 身份链完整/);
    assert.match(await page.getByTestId('community-asset-capability').textContent() ?? '', /当前预览仍为 APPROXIMATE/);
    assert.match(await page.getByTestId('community-asset-capability').textContent() ?? '', /制造验证.*无证据/s);
    const versionedHeight = await versionedUse.evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(versionedHeight >= 44, `versioned CTA height ${versionedHeight} < 44 @ ${viewport.width}`);

    const screenshot = viewport.width === 390 || viewport.width === 1280
      ? path.join(screenshotsDir, `versioned-${viewport.width}.png`)
      : null;
    if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
    assert.deepEqual(consoleErrors, [], `console errors @ ${viewport.width}`);
    assert.deepEqual(pageErrors, [], `page errors @ ${viewport.width}`);
    report.viewports.push({ ...viewport, legacyHeight, versionedHeight, homeScreenshot, screenshot, consoleErrors, pageErrors, noOverflow: true });
    await context.close();
  }

  const failureContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await failureContext.route('**/community/asset-capability-evidence-v1.json', (route) => route.fulfill({ status: 500, body: '' }));
  const failurePage = await failureContext.newPage();
  await failurePage.goto(`${baseUrl}/look/cc_mercury_dew`, { waitUntil: 'domcontentloaded' });
  await failurePage.getByTestId('community-asset-capability-unavailable').waitFor();
  await failurePage.getByTestId('community-asset-capability-action-restricted').waitFor();
  assert.equal(await failurePage.getByTestId('community-try-in-studio').count(), 0);
  assert.equal(await failurePage.getByTestId('community-use-versioned').count(), 0);
  await noOverflow(failurePage, 'capability-failure');
  const failureScreenshot = path.join(screenshotsDir, 'capability-failure-1280.png');
  await failurePage.screenshot({ path: failureScreenshot, fullPage: true });
  report.failure = { visible: true, actionRestricted: true, screenshot: failureScreenshot };
  await failureContext.close();

  fs.writeFileSync(path.join(evidenceDir, 'walkthrough-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('walkthrough-community-asset-capability: PASS (6 viewports; strict card/detail capability + fail-closed fixture failure)');
} finally {
  await browser.close();
}
