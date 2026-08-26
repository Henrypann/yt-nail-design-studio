#!/usr/bin/env node
/**
 * Public HTTPS regression for Community → Studio versioned import.
 *
 * This is deliberately separate from the local walkthrough: a localhost or
 * HTTP target can hide the Web Crypto requirement and is not valid evidence
 * for the deployed demo.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const rawBaseURL = process.env.BASE_URL;
assert.ok(rawBaseURL, 'BASE_URL is required (use the deployed HTTPS demo URL)');
const baseURL = rawBaseURL.replace(/\/+$/, '');
const target = new URL(baseURL);
assert.equal(target.protocol, 'https:', 'public regression requires an HTTPS BASE_URL');
assert.ok(!['localhost', '127.0.0.1', '::1'].includes(target.hostname), 'public regression rejects localhost/loopback BASE_URL');
const lookId = process.env.LOOK_ID ?? 'look.v0-7-2.honey-petal-glass';
assert.match(lookId, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, 'LOOK_ID must be a valid public Look id');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  await page.goto(`${baseURL}/look/${encodeURIComponent(lookId)}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('community-use-versioned').waitFor();
  const runtime = await page.evaluate(() => ({
    origin: window.location.origin,
    protocol: window.location.protocol,
    isSecureContext: window.isSecureContext,
    hasSubtleDigest: typeof window.crypto?.subtle?.digest === 'function',
  }));
  assert.equal(runtime.protocol, 'https:');
  assert.equal(runtime.isSecureContext, true, 'deployed target must be a secure context');
  assert.equal(runtime.hasSubtleDigest, true, 'deployed target must expose Web Crypto SHA-256');

  const [importPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByTestId('community-use-versioned').click(),
  ]);
  importPage.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  importPage.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await importPage.waitForLoadState('domcontentloaded');
  await importPage.getByTestId('versioned-import-page').waitFor();
  assert.equal(await importPage.getByTestId('versioned-import-secure-context-warning').count(), 0);
  assert.equal(await importPage.getByTestId('versioned-import-new').isEnabled(), true);
  await importPage.getByTestId('versioned-import-new').click();
  await importPage.getByTestId('editor-remix-disclosure').waitFor();
  assert.match(importPage.url(), /\/studio\/design\/canvas\?design=design\.remix\./);
  assert.equal(await importPage.getByLabel('设计名称').isEnabled(), true, 'new Remix must be editable');
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`[e2e:community-v7-1-use-customize-https] PASS ${runtime.origin}`);
} finally {
  await browser.close();
}
