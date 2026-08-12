#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:5200';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let page = await context.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

await page.addInitScript(() => {
  localStorage.setItem('nail-studio:session', JSON.stringify({
    v: 1,
    updatedAt: Date.now(),
    tabId: 'product-surface-e2e',
    data: { storeName: 'Product Boundary QA', userName: 'QA', email: 'qa@example.test' },
  }));
});

try {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await page.getByText('Nail Lover Community', { exact: true }).first().waitFor();
  assert.equal(await page.locator('[data-debug-id="community.layout"]').count(), 1);
  assert.equal(await page.locator('[data-debug-id="app.layout.sidebar"]').count(), 0);
  assert.equal(await page.getByTestId('community-enter-studio').getAttribute('href'), '/studio');
  assert.equal(await page.getByTestId('community-enter-studio').getAttribute('target'), '_blank');
  assert.equal(await page.getByTestId('community-enter-studio').getAttribute('rel'), 'noopener noreferrer');

  await page.evaluate(() => { window.__communityDocumentMarker = 'must-survive'; });
  const communityPage = page;
  const [studioPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByTestId('community-enter-studio').click(),
  ]);
  await studioPage.waitForLoadState('networkidle');
  page = studioPage;
  assert.equal(communityPage.url(), `${baseURL}/`);
  assert.equal(await communityPage.evaluate(() => window.__communityDocumentMarker), 'must-survive');
  assert.equal(await page.evaluate(() => window.opener), null);
  assert.equal(page.url(), `${baseURL}/studio`);
  await page.getByText('Nail Design Studio', { exact: true }).first().waitFor();
  assert.equal(await page.locator('[data-debug-id="community.layout"]').count(), 0);
  assert.equal(await page.locator('[data-debug-id="app.layout.sidebar"]').count(), 1);

  // Fresh salon: Studio + Community + Bind device are available; customer operations and device list are gated.
  await page.getByTestId('nav-group-studio').waitFor();
  await page.getByTestId('nav-group-community').waitFor();
  await page.getByTestId('nav-group-devices').waitFor();
  assert.equal(await page.getByTestId('nav-group-customers').count(), 0);
  await page.getByTestId('nav-group-devices').locator(`a[href="/studio/devices/bind"]`).waitFor();
  assert.equal(await page.getByTestId('nav-group-devices').locator(`a[href="/studio/devices"]`).count(), 0);

  await page.goto(`${baseURL}/studio/devices/bind`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio/devices/bind`);
  await page.locator('[data-debug-id="app.devices.bind-wizard"]').waitFor();

  await page.goto(`${baseURL}/studio/devices`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio`);
  await page.goto(`${baseURL}/studio/customers`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio`);

  // A completed binding unlocks Customers/Dashboard and My devices without changing the default Studio home.
  await page.evaluate(() => {
    localStorage.setItem('nail-studio:devices', JSON.stringify({
      v: 1,
      updatedAt: Date.now(),
      tabId: 'product-surface-e2e',
      data: [{
        id: 'device-e2e-1',
        alias: 'QA Printer',
        type: 'uv_printer',
        status: 'online',
        deviceCode: 'QA-UV-001',
        boundAt: new Date().toISOString(),
      }],
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('nav-group-customers').waitFor();
  await page.getByTestId('nav-group-customers').locator(`a[href="/studio/customers/dashboard"]`).waitFor();
  await page.getByTestId('nav-group-customers').locator(`a[href="/studio/customers"]`).waitFor();
  await page.getByTestId('nav-group-customers').locator(`a[href="/studio/customers/new"]`).waitFor();
  await page.getByTestId('nav-group-devices').locator(`a[href="/studio/devices/bind"]`).waitFor();
  await page.getByTestId('nav-group-devices').locator(`a[href="/studio/devices"]`).waitFor();

  await page.goto(`${baseURL}/studio/customers/dashboard`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio/customers/dashboard`);
  await page.goto(`${baseURL}/studio/devices`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio/devices`);

  await page.goto(`${baseURL}/community/official?style=ST-01`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/official?style=ST-01`);

  await page.goto(`${baseURL}/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${baseURL}/studio/design/canvas?blank=1`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    studioTargetHeight: document.querySelector('[data-testid="community-enter-studio"]')?.getBoundingClientRect().height ?? 0,
  }));
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, 'mobile Community must not overflow horizontally');
  assert.ok(metrics.studioTargetHeight >= 40, 'Studio product switch must remain touchable');
  assert.deepEqual(errors, []);

  console.log('[product-surfaces:e2e] Community home, Studio switch, hardware-gated nav/routes, legacy redirects, mobile shell: PASS');
} finally {
  await browser.close();
}
