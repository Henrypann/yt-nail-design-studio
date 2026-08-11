#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5214';
const output = path.resolve('evidence/pr-comm-v7-1-04-use-customize/screenshots');
await fs.mkdir(output, { recursive: true });

const viewports = [
  { name: '390', width: 390, height: 844, touch: true },
  { name: '768', width: 768, height: 1024, touch: true },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ...(viewport.touch ? { hasTouch: true, isMobile: viewport.width < 500 } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  await page.goto(`${baseURL}/community/look/look.v7-1.petal-veil`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-use-versioned').waitFor();
  const canonicalEvidence = await page.getByTestId('community-look-evidence').textContent();
  assert.match(canonicalEvidence ?? '', /Canonical PublishedLookV1/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(output, `${viewport.name}-look.png`), fullPage: true });

  await page.getByTestId('community-use-versioned').click();
  await page.getByTestId('versioned-intent-conflict').waitFor();
  await page.waitForTimeout(400); // measure after modal scale-in animation settles
  assert.match(page.url(), /\/design\/new\?versionedIntent=/);
  assert.equal(await page.locator('[role="dialog"]').count(), 1, 'versioned flow has one active dialog');
  assert.equal(await page.evaluate(() => localStorage.getItem('nail-studio:community.look-customize-events-v1')), null,
    'CTA click is not a successful customize event');
  const sizes = await page.locator('button[data-testid^="versioned-intent-"]').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height };
  }));
  assert.equal(sizes.every((size) => size.height >= 44 && size.width >= 44), true);
  await page.screenshot({ path: path.join(output, `${viewport.name}-choice.png`), fullPage: true });

  await page.getByTestId('versioned-intent-new').click();
  await page.getByTestId('editor-remix-disclosure').waitFor();
  await page.waitForTimeout(3500); // success toast must not obscure signed visual evidence
  assert.match(page.url(), /\/design\/canvas\?design=design\.remix\./);
  assert.match(await page.getByTestId('editor-remix-disclosure').textContent() ?? '', /dv\.v7-1\.petal-veil\.1/);
  assert.equal(await page.getByLabel('设计名称').isEnabled(), true, 'new Remix must be editable');
  assert.equal(await page.getByText('当前 V7 设计处于只读状态；选择与折叠仍可使用。').count(), 0);
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'immersive Editor must reset inherited SPA scroll');
  await page.getByRole('button', { name: /个性化设计/ }).click();
  await page.getByTestId('v7-flat-design-canvas').waitFor();
  const shellGeometry = await page.locator('[data-debug-id="studio.editor.shell-v7"]').evaluate((shell) => ({
    scrollLeft: shell.scrollLeft,
    headerLeft: shell.querySelector('header')?.getBoundingClientRect().left,
  }));
  assert.equal(shellGeometry.scrollLeft, 0, 'stage navigation must not scroll the whole Editor shell');
  assert.ok(Math.abs(shellGeometry.headerLeft ?? 999) < 1, 'Editor header must remain fully visible');
  const stored = await page.evaluate(() => {
    const docsRaw = localStorage.getItem('nail-studio:editor.docs');
    const eventsRaw = localStorage.getItem('nail-studio:community.look-customize-events-v1');
    const docs = docsRaw ? JSON.parse(docsRaw).data : {};
    const events = eventsRaw ? JSON.parse(eventsRaw).data : {};
    return { docs, events };
  });
  const doc = Object.values(stored.docs).find((candidate) => candidate?.schemaVersion === 7);
  assert.ok(doc);
  assert.deepEqual(doc.sourceRefs, [{ domain: 'community', sourceId: 'look.v7-1.petal-veil', revision: 'dv.v7-1.petal-veil.1' }]);
  assert.equal(Object.keys(stored.events).length, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(output, `${viewport.name}-editor.png`), fullPage: true });
  report.push({ viewport: viewport.name, errors, designId: doc.designId, eventCount: Object.keys(stored.events).length });
  assert.deepEqual(errors, []);
  await page.getByTestId('editor-return-source').click();
  await page.waitForURL(`${baseURL}/community/look/look.v7-1.petal-veil`);
  await context.close();
}

// current keeps the active Wizard session and emits no event.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/community/look/look.v7-1.petal-veil`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-use-versioned').click();
  const designId = await page.locator('[data-debug-id="studio.wizard.page"]').getAttribute('data-design-id');
  await page.getByTestId('versioned-intent-current').click();
  await page.locator('[data-debug-id="studio.wizard.page"]').waitFor();
  assert.equal(await page.locator('[data-debug-id="studio.wizard.page"]').getAttribute('data-design-id'), designId);
  assert.equal(await page.evaluate(() => localStorage.getItem('nail-studio:community.look-customize-events-v1')), null);
  await context.close();
}

// cancel returns to the exact canonical Look and emits no event.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${baseURL}/community/look/look.v7-1.petal-veil`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-use-versioned').click();
  await page.getByTestId('versioned-intent-cancel').click();
  await page.waitForURL(`${baseURL}/community/look/look.v7-1.petal-veil`);
  assert.equal(await page.evaluate(() => localStorage.getItem('nail-studio:community.look-customize-events-v1')), null);
  await context.close();
}

await fs.writeFile(
  path.resolve('evidence/pr-comm-v7-1-04-use-customize/walkthrough-report.json'),
  `${JSON.stringify({ baseURL, report, current: 'PASS', cancel: 'PASS' }, null, 2)}\n`,
);
await browser.close();
console.log('[e2e:community-v7-1-use-customize] PASS');
