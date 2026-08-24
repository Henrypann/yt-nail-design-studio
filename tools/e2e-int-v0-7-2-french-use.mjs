#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = (process.env.BASE_URL ?? 'http://127.0.0.1:5216').replace(/\/+$/, '');
const evidenceRoot = path.resolve(process.env.INT_FRENCH_E2E_OUTPUT ?? 'evidence/pr-int-v0-7-2-french-01b');
const shots = path.join(evidenceRoot, 'screenshots');
await fs.mkdir(shots, { recursive: true });

const viewports = [
  { width: 390, height: 844, touch: true },
  { width: 768, height: 900, touch: true },
  { width: 1024, height: 900, touch: false },
  { width: 1280, height: 900, touch: false },
  { width: 1366, height: 900, touch: false },
  { width: 1440, height: 900, touch: false },
];

const browser = await chromium.launch({ headless: true });
const report = [];

async function editorState(page) {
  return page.evaluate(async () => {
    const { editorV7Store } = await import('/src/studio/editor/store-v7.ts');
    const state = editorV7Store.getState();
    const doc = state.doc;
    const french = doc ? Object.values(doc.recipeInstances).filter((item) => item.recipeId === 'french-edge') : [];
    return {
      docJson: JSON.stringify(doc),
      designId: doc?.designId ?? null,
      revision: doc?.revision ?? null,
      history: state.history.length,
      future: state.future.length,
      pendingRevision: state.revisionState.pendingRevision,
      saveState: state.saveState,
      recipeCount: french.length,
      recipeRevisions: french.map((item) => item.recipeRevision),
      sourceRefs: doc?.sourceRefs ?? [],
      geometryRefs: doc ? Object.fromEntries(Object.entries(doc.nails).map(([finger, nail]) => [finger, nail.geometryRef])) : {},
    };
  });
}

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    ...(viewport.width === 390 ? { isMobile: true } : {}),
  });
  const community = await context.newPage();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });
  };
  watch(community);
  const activate = (locator) => viewport.touch ? locator.tap() : locator.click();

  await community.goto(`${baseURL}/look/look.v7-1.petal-veil`, { waitUntil: 'networkidle' });
  await community.getByTestId('community-use-versioned').waitFor();
  const [page] = await Promise.all([
    context.waitForEvent('page'),
    activate(community.getByTestId('community-use-versioned')),
  ]);
  watch(page);
  await page.waitForLoadState('networkidle');
  const preflight = page.getByTestId('french-use-preflight');
  await preflight.waitFor();
  assert.equal(await preflight.getAttribute('data-french-use-status'), 'FRENCH_DECLARED');
  assert.match(await preflight.textContent() ?? '', /完整 Look Remix/);
  assert.match(await preflight.textContent() ?? '', /不会猜测或自动写入/);
  assert.equal(await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs')), null, 'preflight is writer-zero');
  if (viewport.width === 390 || viewport.width === 1280) {
    await page.screenshot({ path: path.join(shots, `${viewport.width}-preflight.png`), fullPage: true });
  }

  await activate(page.getByTestId('versioned-import-new'));
  await page.locator('[data-editor-schema="7"]').waitFor();
  const notice = page.getByTestId('french-use-context-notice');
  await notice.waitFor();
  assert.equal(await notice.getAttribute('data-french-use-status'), 'AVAILABLE');
  assert.match(page.url(), /frenchUseContext=french\.use\./);
  const beforeOpen = await editorState(page);
  assert.equal(beforeOpen.recipeCount, 0, 'Use never auto-creates French');
  assert.deepEqual(beforeOpen.sourceRefs, [{
    domain: 'community', sourceId: 'look.v7-1.petal-veil', revision: 'dv.v7-1.petal-veil.1',
  }]);

  await activate(page.getByTestId('french-use-open-tool'));
  await page.locator('[data-testid="v7-flat-vector-panel"]:visible').first().waitFor();
  const afterOpen = await editorState(page);
  for (const key of ['docJson', 'revision', 'history', 'future', 'pendingRevision', 'recipeCount']) {
    assert.deepEqual(afterOpen[key], beforeOpen[key], `open tool writer-zero: ${key}`);
  }

  await activate(page.getByRole('button', { name: '添加法式', exact: true }));
  const dialog = page.getByTestId('v7-managed-french-create-dialog');
  await dialog.waitFor();
  await activate(dialog.getByTestId('v7-managed-french-create-preset-soft'));
  await activate(dialog.getByTestId('v7-managed-french-create-scope-current'));
  await activate(page.getByTestId('v7-managed-french-create-confirm'));
  await dialog.waitFor({ state: 'detached' });
  const afterCreate = await editorState(page);
  assert.equal(afterCreate.recipeCount, 1);
  assert.deepEqual(afterCreate.recipeRevisions, ['1.0.0']);
  assert.equal(afterCreate.revision, beforeOpen.revision + 1, 'explicit preset creates one revision');
  assert.equal(afterCreate.history, beforeOpen.history + 1, 'explicit preset creates one history entry');
  assert.equal(await notice.count(), 0, 'hint disappears after explicit structured French creation');

  const save = page.getByRole('button', { name: /保存/ }).last();
  await activate(save);
  await page.waitForFunction(() => document.querySelector('[data-editor-schema="7"]')?.textContent?.includes('已保存'));
  const editorUrl = page.url();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-editor-schema="7"]').waitFor();
  const reopened = await editorState(page);
  assert.equal(reopened.recipeCount, 1, 'structured French survives save/reopen');
  assert.deepEqual(reopened.sourceRefs, beforeOpen.sourceRefs);
  assert.deepEqual(reopened.geometryRefs, beforeOpen.geometryRefs, 'Use/French never replaces target geometry');
  assert.equal(await page.getByTestId('french-use-context-notice').count(), 0, 'completed hint does not return after reopen');
  assert.equal(page.url(), editorUrl);
  if (viewport.width === 390 || viewport.width === 1280) {
    await page.screenshot({ path: path.join(shots, `${viewport.width}-structured-editor.png`), fullPage: false });
  }

  await activate(page.getByRole('button', { name: '打开顾客只读预览', exact: true }));
  await page.getByTestId('customer-preview-v7').waitFor();
  const previewBefore = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  await page.waitForTimeout(100);
  const previewAfter = await page.evaluate(() => localStorage.getItem('nail-studio:editor.docs'));
  assert.equal(previewAfter, previewBefore, 'customer preview is writer-zero');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  if (viewport.width === 390 || viewport.width === 1280) {
    await page.screenshot({ path: path.join(shots, `${viewport.width}-customer-preview.png`), fullPage: false });
  }
  assert.deepEqual(errors, []);
  report.push({
    viewport: viewport.width,
    interaction: viewport.touch ? 'touch' : 'pointer',
    preflight: 'FRENCH_DECLARED',
    openToolWriterZero: true,
    explicitRevisionDelta: 1,
    recipeRevision: '1.0.0',
    sourceRef: reopened.sourceRefs[0],
    geometryCount: Object.keys(reopened.geometryRefs).length,
    saveReopen: 'PASS',
    customerPreviewWriterZero: true,
    errors,
  });
  await context.close();
}

// Legacy compatibility remains a separate, approximate Wizard route. Verify
// that the governed discovery declaration is surfaced without constructing a
// French recipe or guessing a preset from the title, legacy tags, or artwork.
const legacyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const legacyCommunity = await legacyContext.newPage();
const legacyErrors = [];
legacyCommunity.on('pageerror', (error) => legacyErrors.push(`pageerror:${error.message}`));
legacyCommunity.on('console', (message) => {
  if (message.type() === 'error') legacyErrors.push(`console:${message.text()}`);
});
await legacyCommunity.goto(`${baseURL}/look/cc_petal_veil`, { waitUntil: 'networkidle' });
await legacyCommunity.getByTestId('community-try-in-studio').click();
await legacyCommunity.getByRole('dialog').waitFor();
const [legacyWizard] = await Promise.all([
  legacyContext.waitForEvent('page'),
  legacyCommunity.getByTestId('community-approx-confirm').click(),
]);
legacyWizard.on('pageerror', (error) => legacyErrors.push(`pageerror:${error.message}`));
legacyWizard.on('console', (message) => {
  if (message.type() === 'error') legacyErrors.push(`console:${message.text()}`);
});
await legacyWizard.waitForLoadState('networkidle');
await legacyWizard.getByTestId('wizard-legacy-source').waitFor();
const legacyHint = legacyWizard.getByTestId('wizard-french-technique-hint');
await legacyHint.waitFor();
assert.match(await legacyHint.textContent() ?? '', /完整 Look 的 Legacy 近似应用/);
assert.match(await legacyHint.textContent() ?? '', /不会自动创建结构化法式或选择 preset/);
assert.equal(
  await legacyWizard.evaluate(() => localStorage.getItem('nail-studio:editor.docs')),
  null,
  'legacy French hint is writer-zero for EditorDocV7',
);
assert.equal(
  await legacyWizard.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  true,
  'legacy Wizard has no whole-page horizontal overflow',
);
assert.deepEqual(legacyErrors, []);
await legacyWizard.screenshot({ path: path.join(shots, '1280-legacy-french-hint.png'), fullPage: false });
const legacyReport = {
  viewport: 1280,
  interaction: 'pointer',
  contentId: 'cc_petal_veil',
  route: 'USE_LEGACY_APPROXIMATE',
  preflight: 'FRENCH_DECLARED',
  editorDocWriterZero: true,
  presetInferred: false,
  manufacturingValidated: false,
  errors: legacyErrors,
};
await legacyContext.close();

await fs.writeFile(path.join(evidenceRoot, 'walkthrough-report.json'), `${JSON.stringify({
  schemaVersion: 1,
  contractRef: 'INT-v0.7.2-FRENCH-01B',
  baseURL,
  evidence: 'prototype',
  manufacturingValidated: false,
  report,
  legacyReport,
}, null, 2)}\n`);
await browser.close();
console.log('[e2e:int-v0.7.2-french-use] PASS (6 canonical viewports + governed Legacy hint; explicit Use → French → save/reopen → customer preview)');
