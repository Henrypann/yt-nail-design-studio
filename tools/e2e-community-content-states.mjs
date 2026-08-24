#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5200';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(
    await page.getByTestId('community-look-card').count(),
    15,
    'public governance gate must keep the two blocked records out of the default feed',
  );

  const ready = page.locator('[data-look-id="cc_mercury_dew"]');
  await ready.getByTestId('look-card-use').waitFor();
  assert.equal(await ready.getByTestId('look-card-use').getAttribute('data-use-state'), 'LEGACY_APPROXIMATE');

  const incomplete = page.locator('[data-look-id="cc_liquid_chrome_statement"]');
  const disabledUse = incomplete.getByTestId('look-card-use-disabled');
  await disabledUse.waitFor();
  assert.equal(await disabledUse.isDisabled(), true);
  assert.equal(await disabledUse.getAttribute('data-use-state'), 'ASSETS_INCOMPLETE');
  const before = page.url();
  await disabledUse.click({ force: true });
  assert.equal(page.url(), before, 'disabled Use must not navigate');

  await incomplete.getByText('液态铬光宣言', { exact: true }).click();
  await page.waitForURL(`${baseURL}/look/cc_liquid_chrome_statement`);
  const detailUse = page.getByTestId('community-use-disabled');
  await detailUse.waitFor();
  assert.equal(await detailUse.isDisabled(), true);
  assert.equal(await detailUse.getAttribute('data-use-state'), 'ASSETS_INCOMPLETE');
  assert.match(await page.getByTestId('community-missing-asset').textContent() ?? '', /素材尚未补齐/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  assert.deepEqual(errors, []);
  console.log('[community-content-states:e2e] ready + disabled incomplete assets + responsive layout: PASS');
} finally {
  await browser.close();
}
