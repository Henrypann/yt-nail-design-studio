#!/usr/bin/env node
/**
 * PR-01 manual evidence capture (Playwright).
 * Usage: node tools/shot-pr01-community.mjs [baseUrl]
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5204';
const outDir = path.join(process.cwd(), 'evidence/pr01-community');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

const consoleErrors = [];

async function seedSession(page) {
  await page.addInitScript(() => {
    const envelope = (data) =>
      JSON.stringify({ v: 1, updatedAt: Date.now(), tabId: 'pr01-shot', data });
    localStorage.setItem(
      'nail-studio:session',
      envelope({
        storeName: 'PR01 Demo Store',
        userName: 'QA Artist',
        email: 'pr01@example.com',
      }),
    );
  });
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
}

const report = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[${vp.name}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => consoleErrors.push(`[${vp.name}] pageerror ${err.message}`));
    await seedSession(page);

    const steps = [
      { id: 'dashboard', url: `${base}/`, wait: 'text=欢迎回来' },
      { id: 'community-discover', url: `${base}/community`, wait: 'text=Discover' },
      { id: 'community-official', url: `${base}/community/official`, wait: 'text=官方灵感库' },
      { id: 'community-creators', url: `${base}/community/creators`, wait: 'text=认证创作者' },
      { id: 'community-content', url: `${base}/community/content/cc_mercury_dew`, wait: 'text=Mercury Dew' },
      { id: 'community-missing', url: `${base}/community/content/cc_does_not_exist`, wait: 'text=内容不存在' },
      { id: 'community-draft-leak', url: `${base}/community/content/cc_draft_internal_gate`, wait: 'text=内容不存在' },
      { id: 'legacy-redirect', url: `${base}/design/community`, wait: 'text=官方灵感库' },
      { id: 'wizard', url: `${base}/design/new?fresh=1`, wait: 'text=Community' },
      { id: 'editor', url: `${base}/design/canvas?blank=1`, wait: 'text=Studio Editor' },
    ];

    for (const step of steps) {
      await page.goto(step.url, { waitUntil: 'networkidle' });
      await page.getByText(step.wait.replace('text=', ''), { exact: false }).first().waitFor({ timeout: 15000 });
      const overflowOk = await noHorizontalOverflow(page);
      const file = await shot(page, `${vp.name}-${step.id}`);
      report.push({ viewport: vp.name, step: step.id, file, overflowOk, url: page.url() });
      if (!overflowOk) throw new Error(`horizontal overflow at ${vp.name} ${step.id}`);
    }

    // Dashboard → Community via card
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.getByTestId('dashboard-community-entry').getByRole('link').click();
    await page.getByTestId('community-discover-page').waitFor({ timeout: 10000 });
    await shot(page, `${vp.name}-nav-dashboard-to-community`);

    // Community → Studio / Dashboard
    await page.getByTestId('community-enter-studio').click();
    await page.waitForURL(/\/design/, { timeout: 10000 });
    await shot(page, `${vp.name}-nav-community-to-studio`);
    await page.goto(`${base}/community`, { waitUntil: 'networkidle' });
    await page.getByTestId('community-enter-dashboard').click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
    await shot(page, `${vp.name}-nav-community-to-dashboard`);

    // refresh / back / forward
    await page.goto(`${base}/community/official?style=ST-01`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('官方灵感库').waitFor();
    await shot(page, `${vp.name}-refresh-official`);
    await page.goto(`${base}/community`, { waitUntil: 'networkidle' });
    await page.goto(`${base}/community/creators`, { waitUntil: 'networkidle' });
    await page.goBack();
    await page.getByTestId('community-discover-page').waitFor();
    await page.goForward();
    await page.getByTestId('community-creators-page').waitFor();
    await shot(page, `${vp.name}-history-forward-creators`);

    // collapsed nav tooltip (desktop only)
    if (vp.width >= 1280) {
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.getByLabel('收起导航').click();
      const tip = await page.getByTestId('nav-community').getAttribute('title');
      report.push({ viewport: vp.name, step: 'collapsed-nav', title: tip });
      await shot(page, `${vp.name}-collapsed-nav`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const summary = {
  base,
  generatedAt: new Date().toISOString(),
  consoleErrors,
  report,
};
fs.writeFileSync(path.join(outDir, 'walkthrough-report.json'), JSON.stringify(summary, null, 2));
console.log(`[shot-pr01-community] PASS · shots=${report.length} consoleErrors=${consoleErrors.length}`);
console.log(path.join(outDir, 'walkthrough-report.json'));
if (consoleErrors.length) {
  console.error(consoleErrors.slice(0, 20).join('\n'));
  process.exitCode = 2;
}
