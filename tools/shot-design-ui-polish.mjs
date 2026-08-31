#!/usr/bin/env node
/**
 * DESIGN.md + workstation bind visual evidence.
 * Usage: node tools/shot-design-ui-polish.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const outDir = path.join(process.cwd(), 'evidence/pr-design-ui-polish');
fs.mkdirSync(outDir, { recursive: true });

const envelope = (data) =>
  JSON.stringify({ v: 1, updatedAt: Date.now(), tabId: 'design-ui-shot', data });

async function seed(page, { withDevice = false } = {}) {
  await page.addInitScript(({ session, devices, withDevice: includeDevice }) => {
    localStorage.setItem('nail-studio:session', session);
    if (includeDevice) localStorage.setItem('nail-studio:devices', devices);
  }, {
    session: envelope({
      storeName: '象牙工作室',
      userName: '美甲师',
      email: 'qa@example.test',
    }),
    devices: envelope([{
      id: 'device-shot-1',
      alias: '前台喷绘机',
      type: 'uv_printer',
      status: 'online',
      deviceCode: 'NS-SHOT01',
      boundAt: new Date().toISOString(),
    }]),
    withDevice,
  });
}

const browser = await chromium.launch({ headless: true });
const shots = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await seed(page, { withDevice: false });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('[data-debug-id="community.layout"]').waitFor();
  const community = path.join(outDir, 'community-home-1440.png');
  await page.screenshot({ path: community, fullPage: true });
  shots.push(community);

  await page.goto(`${base}/studio`, { waitUntil: 'networkidle' });
  await page.locator('[data-debug-id="studio.home"]').waitFor();
  const studio = path.join(outDir, 'studio-home-1440.png');
  await page.screenshot({ path: studio, fullPage: false });
  shots.push(studio);

  await page.goto(`${base}/studio/devices/bind`, { waitUntil: 'networkidle' });
  await page.locator('[data-debug-id="app.devices.bind-wizard"]').waitFor();
  const bind = path.join(outDir, 'bind-default-1440.png');
  await page.screenshot({ path: bind, fullPage: false });
  shots.push(bind);

  await context.close();

  const deviceContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const devicePage = await deviceContext.newPage();
  await seed(devicePage, { withDevice: true });
  await devicePage.goto(`${base}/studio/devices`, { waitUntil: 'networkidle' });
  await devicePage.locator('[data-debug-id="app.devices.list"]').waitFor();
  const devices = path.join(outDir, 'devices-list-1440.png');
  await devicePage.screenshot({ path: devices, fullPage: false });
  shots.push(devices);
  await deviceContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ outDir, shots }, null, 2));
