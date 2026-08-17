#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-03 · URL runtime browser acceptance — filter history semantics.
 *
 * Verifies, at 1440x900 and 390x844 independently, that user-initiated
 * community discovery changes (q/tab/sort/source/filter/marker removal and
 * incompatible-condition removal) PUSH into browser history so Back restores
 * the prior shareable result, while the URL remains the only truth:
 *
 *   A. Legacy deep link `/?style=ST-02` renders the removable
 *      `compatibility-marker-compat-style-french` (技法：法式 / Technique:
 *      French); removing it drops both the style and technique conditions;
 *      browser Back restores the old link and the marker.
 *   B. Mixed CSV `/?length=length%3Ashort%2Cultra-long` shows the
 *      incompatible banner with exactly 0 results and the empty state;
 *      toggling source Official keeps the raw `length` param as exactly one
 *      `length:short,ultra-long` occurrence (no accumulation) and the
 *      banner/0 remain; reload restores the same; the explicit
 *      remove-incompatible-length button removes only `ultra-long` (canonical
 *      `length:short` remains), the banner disappears, and Back restores the
 *      mixed raw condition/banner/0.
 *   C. Compatible filter refresh/share/Back: `/` → toggle
 *      `runtime-filter-length:short`; capture URL + count; reload restores
 *      both; a fresh page with the shared URL shows the same count and the
 *      pressed filter; adding `runtime-filter-length:medium` produces a
 *      single same-dimension OR `length` param containing both ids with
 *      count >= short-only; adding `runtime-filter-rights:original` is a
 *      cross-dimension AND with count <= OR; Back restores the OR
 *      URL/count, another Back restores the short-only URL/count.
 *   D. Locked source `/official?source=bogus`: banner + 0 results; an
 *      ordinary interaction (sort → new) keeps `source` raw getAll exactly
 *      ['bogus'] (no canonical official + bogus accumulation), the banner
 *      remains, and nothing widens.
 *
 * Count assertions are limited to required zero / invariant / monotonic
 * comparisons (no brittle fixture totals). Screenshots are taken only on
 * failure (into os.tmpdir()).
 *
 * Usage:
 *   node tools/walkthrough-community-tax-03-filter-runtime.mjs [baseUrl]
 *   BASE_URL=http://127.0.0.1:5243 node tools/walkthrough-...mjs
 *
 * Base URL resolution: process.env.BASE_URL ?? argv[2] ?? http://127.0.0.1:5243
 */

import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';

const baseUrl = process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5243';
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const TAG = 'tax-03-filter-runtime:e2e';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function paramsOf(url) {
  return new URL(url).searchParams;
}

/** Sorted, trimmed, non-empty CSV items across every occurrence of `key`. */
function csvItems(params, key) {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .sort();
}

/**
 * Wait until the current URL matches `expected` (per-key exact getAll) and
 * every key in `absent` is gone. Keys in `expected` must match exactly, so
 * e.g. `{ length: ['length:short'] }` proves no second `length` occurrence
 * and no comma-sibling survived.
 */
async function waitForSearchParams(page, expected, absent = []) {
  await page.waitForFunction(
    ([spec, absentKeys]) => {
      const params = new URL(window.location.href).searchParams;
      const matches = Object.entries(spec).every(([key, values]) => {
        const actual = params.getAll(key);
        return (
          actual.length === values.length &&
          actual.every((value, index) => value === values[index])
        );
      });
      return matches && absentKeys.every((key) => !params.has(key));
    },
    [expected, absent],
  );
}

/** Community feed ready: skeleton/loading replaced by runtime filters. */
async function waitFeedReady(page) {
  await page.getByTestId('community-feed').waitFor();
  await page.getByTestId('community-discovery-runtime-filters').waitFor();
}

/** Parse the visible result count (pure integer, never brittle totals). */
async function readCount(page) {
  const el = page.getByTestId('community-runtime-result-count');
  await el.waitFor();
  const text = (await el.textContent()) ?? '';
  const value = Number.parseInt(text, 10);
  assert(Number.isInteger(value), `result count is not an integer: ${JSON.stringify(text)}`);
  return value;
}

async function assertNoOverflow(page, width, tag) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    metrics.scrollWidth <= metrics.width + 1,
    `horizontal overflow ${JSON.stringify(metrics)} @ ${width} (${tag})`,
  );
}

/** Scenario A — legacy `style=ST-02` marker: removal + Back restores. */
async function scenarioLegacyFrenchMarker(page, width) {
  const tag = 'A:legacy-french-marker';
  await page.goto(`${baseUrl}/?style=ST-02`);
  await waitFeedReady(page);

  const marker = page.getByTestId('compatibility-marker-compat-style-french');
  await marker.waitFor();
  const label = (await marker.textContent()) ?? '';
  assert(
    /技法：法式|Technique: French/.test(label),
    `${tag}: marker label mismatch ${JSON.stringify(label)} @ ${width}`,
  );
  assert(
    paramsOf(page.url()).get('style') === 'ST-02',
    `${tag}: initial style param lost @ ${width}`,
  );

  // Removing the marker must drop BOTH the legacy style key and the
  // canonical technique condition, via a push entry.
  await marker.getByRole('button').click();
  await waitForSearchParams(page, {}, ['style', 'technique']);
  assert(
    (await page.getByTestId('compatibility-marker-compat-style-french').count()) === 0,
    `${tag}: marker still visible after removal @ ${width}`,
  );

  // Back restores the old link and the marker (push semantics).
  await page.goBack();
  await waitForSearchParams(page, { style: ['ST-02'] });
  await marker.waitFor();
  const restoredLabel = (await marker.textContent()) ?? '';
  assert(
    /技法：法式|Technique: French/.test(restoredLabel),
    `${tag}: marker label mismatch after Back ${JSON.stringify(restoredLabel)} @ ${width}`,
  );
  await assertNoOverflow(page, width, tag);
  console.log(`[${TAG}] ${tag} PASS @ ${width}`);
  return tag;
}

/** Scenario B — mixed CSV `length=length:short,ultra-long` lifecycle. */
async function scenarioMixedCsvIncompatible(page, width) {
  const tag = 'B:mixed-csv-incompatible';
  const mixed = 'length:short,ultra-long';
  await page.goto(`${baseUrl}/?length=${encodeURIComponent(mixed)}`);
  await waitFeedReady(page);

  // Incompatible banner visible, exactly 0 results, empty state visible.
  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: initial count != 0 @ ${width}`);
  await page.getByTestId('community-feed-empty').waitFor();
  assert(
    csvItems(paramsOf(page.url()), 'length').join(',') === 'length:short,ultra-long',
    `${tag}: raw length items changed @ ${width}`,
  );

  // Toggle source Official from within the runtime filters: the raw length
  // param must stay exactly one `length:short,ultra-long` occurrence (the
  // merge glue must not accumulate duplicates) and the banner/0 remain.
  await page
    .getByTestId('community-discovery-runtime-filters')
    .getByRole('button', { name: /官方|Official/ })
    .click();
  await waitForSearchParams(page, { source: ['official'], length: [mixed] });
  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: count != 0 after source toggle @ ${width}`);
  await page.getByTestId('community-feed-empty').waitFor();

  // Reload restores the same URL state (banner/0/raw occurrence).
  await page.reload();
  await waitFeedReady(page);
  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: count != 0 after reload @ ${width}`);
  assert(
    paramsOf(page.url()).get('source') === 'official',
    `${tag}: source lost after reload @ ${width}`,
  );
  assert(
    paramsOf(page.url()).getAll('length').join(',') === mixed,
    `${tag}: raw length occurrence lost after reload @ ${width}`,
  );

  // Explicit remove-incompatible-length: removes ONLY ultra-long, keeps the
  // canonical length:short, banner disappears, no incompatibility remains.
  await page.getByTestId('remove-incompatible-length').click();
  await waitForSearchParams(page, { length: ['length:short'] });
  assert(
    (await page.getByTestId('community-incompatible-filters').count()) === 0,
    `${tag}: banner still visible after explicit removal @ ${width}`,
  );
  const postRemoveCount = await readCount(page);
  console.log(`[${TAG}] ${tag} post-removal count=${postRemoveCount} @ ${width}`);

  // Back restores the mixed raw condition / banner / count 0.
  await page.goBack();
  await waitForSearchParams(page, { source: ['official'], length: [mixed] });
  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: count != 0 after Back @ ${width}`);
  await page.getByTestId('community-feed-empty').waitFor();
  await assertNoOverflow(page, width, tag);
  console.log(`[${TAG}] ${tag} PASS @ ${width}`);
  return tag;
}

/** Scenario C — compatible filter refresh/share/Back history semantics. */
async function scenarioCompatibleHistory(page, context, width) {
  const tag = 'C:compatible-history';
  await page.goto(`${baseUrl}/`);
  await waitFeedReady(page);

  // Open the runtime filter drawer and select length:short.
  await page.getByTestId('community-runtime-filter-toggle').click();
  await page.getByTestId('community-runtime-filter-panel').waitFor();
  await page.getByTestId('runtime-filter-length:short').click();
  await waitForSearchParams(page, { length: ['length:short'] });
  const shortUrl = page.url();
  const shortCount = await readCount(page);

  // Reload restores the same URL and count.
  await page.reload();
  await waitFeedReady(page);
  assert(
    paramsOf(page.url()).getAll('length').join(',') === 'length:short',
    `${tag}: length lost after reload @ ${width}`,
  );
  assert(
    (await readCount(page)) === shortCount,
    `${tag}: count changed after reload (${shortCount}) @ ${width}`,
  );

  // A fresh page opened with the shared URL shows the same count and the
  // pressed filter.
  const shared = await context.newPage();
  try {
    await shared.goto(shortUrl);
    await waitFeedReady(shared);
    assert(
      (await readCount(shared)) === shortCount,
      `${tag}: shared URL count mismatch (${shortCount}) @ ${width}`,
    );
    // The fresh shared page loads with the auxiliary filter drawer closed,
    // so open it before reading the pressed state of the length filter.
    await shared.getByTestId('community-runtime-filter-toggle').click();
    await shared.getByTestId('community-runtime-filter-panel').waitFor();
    const pressed = await shared
      .getByTestId('runtime-filter-length:short')
      .getAttribute('aria-pressed');
    assert(pressed === 'true', `${tag}: shared URL filter not pressed (${pressed}) @ ${width}`);
  } finally {
    await shared.close();
  }

  // Same-dimension OR: add length:medium → one length param with both ids,
  // count >= short-only count.
  await page.getByTestId('community-runtime-filter-toggle').click();
  await page.getByTestId('community-runtime-filter-panel').waitFor();
  await page.getByTestId('runtime-filter-length:medium').click();
  await waitForSearchParams(page, { length: ['length:medium,length:short'] });
  const orCount = await readCount(page);
  assert(orCount >= shortCount, `${tag}: OR count ${orCount} < short-only ${shortCount} @ ${width}`);

  // Cross-dimension AND: add rights:original → count <= OR count.
  await page.getByTestId('runtime-filter-rights:original').click();
  await waitForSearchParams(page, {
    length: ['length:medium,length:short'],
    rights: ['rights:original'],
  });
  const andCount = await readCount(page);
  assert(andCount <= orCount, `${tag}: AND count ${andCount} > OR count ${orCount} @ ${width}`);

  // Back restores the OR URL/count, another Back the short-only URL/count.
  await page.goBack();
  await waitForSearchParams(page, { length: ['length:medium,length:short'] }, ['rights']);
  assert((await readCount(page)) === orCount, `${tag}: Back did not restore OR count @ ${width}`);

  await page.goBack();
  await waitForSearchParams(page, { length: ['length:short'] }, ['rights']);
  assert(
    (await readCount(page)) === shortCount,
    `${tag}: second Back did not restore short-only count @ ${width}`,
  );
  await assertNoOverflow(page, width, tag);
  console.log(`[${TAG}] ${tag} PASS @ ${width} (short=${shortCount} or=${orCount} and=${andCount})`);
  return tag;
}

/** Scenario D — locked source `/official?source=bogus` never widens. */
async function scenarioLockedSource(page, width) {
  const tag = 'D:locked-source';
  await page.goto(`${baseUrl}/official?source=bogus`);
  await waitFeedReady(page);

  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: initial count != 0 @ ${width}`);

  // An ordinary interaction (sort → new) must keep the raw source param as
  // exactly ['bogus'] — no canonical official + bogus accumulation — with
  // the banner remaining and nothing widened.
  await page.getByTestId('sort-new').click();
  await waitForSearchParams(page, { sort: ['new'], source: ['bogus'] });
  await page.getByTestId('community-incompatible-filters').waitFor();
  assert((await readCount(page)) === 0, `${tag}: count != 0 after sort @ ${width}`);
  await assertNoOverflow(page, width, tag);
  console.log(`[${TAG}] ${tag} PASS @ ${width}`);
  return tag;
}

const browser = await chromium.launch({ headless: true });
console.log(`[${TAG}] browser launched, base=${baseUrl}`);
const results = [];
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    let page = null;
    try {
      page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const scenarios = [];
      scenarios.push(await scenarioLegacyFrenchMarker(page, viewport.width));
      scenarios.push(await scenarioMixedCsvIncompatible(page, viewport.width));
      scenarios.push(await scenarioCompatibleHistory(page, context, viewport.width));
      scenarios.push(await scenarioLockedSource(page, viewport.width));

      if (consoleErrors.length || pageErrors.length) {
        throw new Error(
          `runtime errors @ ${viewport.width} ${JSON.stringify({ consoleErrors, pageErrors })}`,
        );
      }
      results.push({
        viewport: viewport.width,
        scenarios,
        overflow: 'ok',
        consoleErrors,
        pageErrors,
      });
      console.log(`[${TAG}] completed ${viewport.width}`);
    } catch (error) {
      const shot = path.join(
        os.tmpdir(),
        `tax-03-filter-runtime-${viewport.width}-failure.png`,
      );
      if (page) await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.error(`[${TAG}] failure @ ${viewport.width} screenshot=${shot}`);
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`[${TAG}] PASS ${JSON.stringify(results)}`);
