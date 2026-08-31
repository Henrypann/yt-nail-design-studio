#!/usr/bin/env node
/**
 * Community Look confirm modal: overlay stays opaque above page content for
 * the whole open animation; background is inert / not focusable.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = (process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
const evidenceDir = process.env.EVIDENCE_DIR ?? process.argv[3] ?? 'evidence/pr-look-confirm-modal';
const shotsDir = path.join(evidenceDir, 'screenshots');
await mkdir(shotsDir, { recursive: true });

const lookPath = '/look/look.v0-7-2.honey-petal-glass';
const browser = await chromium.launch({ headless: true });
const report = { lookPath, checks: [], failure: null };

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${baseURL}${lookPath}`, { waitUntil: 'networkidle' });
  await page.getByTestId('community-look-page').waitFor();
  const trigger = page.getByTestId('community-confirm-look');
  await trigger.waitFor();

  const animationSamples = page.evaluate(() => new Promise((resolve) => {
    const samples = [];
    const start = performance.now();
    const tick = () => {
      const root = document.querySelector('[data-testid="modal-root"]');
      const scrim = document.querySelector('[data-testid="modal-scrim"]');
      if (root && scrim) {
        const rootStyle = getComputedStyle(root);
        const scrimStyle = getComputedStyle(scrim);
        samples.push({
          t: Math.round(performance.now() - start),
          rootOpacity: rootStyle.opacity,
          scrimOpacity: scrimStyle.opacity,
          rootZ: rootStyle.zIndex,
        });
      }
      if (performance.now() - start < 220) requestAnimationFrame(tick);
      else resolve(samples);
    };
    requestAnimationFrame(tick);
  }));

  await trigger.click();
  const dialog = page.getByTestId('community-confirm-look-dialog');
  await dialog.waitFor();
  const samples = await animationSamples;
  assert.ok(samples.length > 0, 'open animation produced overlay samples');
  for (const sample of samples) {
    assert.equal(sample.rootOpacity, '1', `overlay root opacity must stay 1 at t=${sample.t}ms`);
    assert.equal(sample.scrimOpacity, '1', `scrim opacity must stay 1 at t=${sample.t}ms`);
    assert.ok(Number.parseInt(sample.rootZ, 10) >= 50, `overlay z-index must sit above page content at t=${sample.t}ms`);
  }

  const coverage = await page.evaluate(() => {
    const scrim = document.querySelector('[data-testid="modal-scrim"]');
    const btn = document.querySelector('[data-testid="community-confirm-look"]');
    const dialogEl = document.querySelector('[data-testid="community-confirm-look-dialog"]');
    if (!scrim || !btn || !dialogEl) return null;
    const s = scrim.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const hit = document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2)
      .map((el) => el.getAttribute('data-testid') || el.tagName);
    return {
      coversButton: s.top <= b.top && s.left <= b.left && s.bottom >= b.bottom && s.right >= b.right,
      hit,
      rootInert: document.getElementById('root')?.hasAttribute('inert') === true,
      rootAriaHidden: document.getElementById('root')?.getAttribute('aria-hidden') === 'true',
      focusInsideDialog: dialogEl.contains(document.activeElement),
      triggerInA11yTree: btn.closest('[inert], [aria-hidden="true"]') != null,
    };
  });
  assert.ok(coverage, 'coverage snapshot is available');
  assert.equal(coverage.coversButton, true, 'opaque scrim must cover the page confirm button');
  assert.equal(coverage.rootInert, true, '#root must be inert while the modal is open');
  assert.equal(coverage.rootAriaHidden, true, '#root must be aria-hidden while the modal is open');
  assert.equal(coverage.focusInsideDialog, true, 'initial focus must land inside the dialog');
  assert.equal(coverage.triggerInA11yTree, true, 'page confirm button must sit under inert/aria-hidden');
  assert.equal(hitIsOverlay(coverage.hit), true, `stack at trigger must be overlay, got ${coverage.hit.join(' > ')}`);

  const focusableCount = await dialog.locator('button:not([disabled]), a[href]').count();
  assert.ok(focusableCount >= 2, 'dialog exposes at least close + actions');
  for (let i = 0; i < focusableCount + 2; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const dialogEl = document.querySelector('[data-testid="community-confirm-look-dialog"]');
      return dialogEl?.contains(document.activeElement) === true;
    });
    assert.equal(inside, true, `Tab ${i + 1} must stay inside the dialog`);
  }

  await page.keyboard.press('Shift+Tab');
  const shiftInside = await page.evaluate(() => {
    const dialogEl = document.querySelector('[data-testid="community-confirm-look-dialog"]');
    return dialogEl?.contains(document.activeElement) === true;
  });
  assert.equal(shiftInside, true, 'Shift+Tab must stay inside the dialog');

  await page.screenshot({ path: path.join(shotsDir, 'confirm-modal-open-1280.png') });

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  const restored = await page.evaluate(() => ({
    rootInert: document.getElementById('root')?.hasAttribute('inert') === true,
    focusTestId: document.activeElement instanceof HTMLElement
      ? document.activeElement.getAttribute('data-testid')
      : null,
  }));
  assert.equal(restored.rootInert, false, 'closing must clear inert on #root');
  assert.equal(restored.focusTestId, 'community-confirm-look', 'closing must restore focus to the trigger');
  assert.deepEqual(errors, []);

  report.checks = [
    { name: 'opaque-overlay-during-open', samples: samples.length },
    { name: 'background-inert', ok: true },
    { name: 'focus-trap', ok: true },
    { name: 'focus-restore', ok: true },
  ];
  await writeFile(path.join(evidenceDir, 'walkthrough-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('[look-confirm-modal:e2e] opaque overlay + inert background + focus trap: PASS');
} catch (error) {
  report.failure = String(error);
  await writeFile(path.join(evidenceDir, 'walkthrough-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

function hitIsOverlay(hit) {
  if (!Array.isArray(hit) || hit.length === 0) return false;
  return hit.some((id) => id === 'modal-scrim' || id === 'modal-root' || id === 'community-confirm-look-dialog')
    && hit[0] !== 'community-confirm-look';
}
