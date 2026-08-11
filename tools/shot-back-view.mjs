/**
 * Capture the Wizard Back-view canvas at a given nail length, once with the old
 * referenceLengthMm and once with the new one, so the difference is visible.
 *
 * Usage: node tools/shot-back-view.mjs [baseURL] [shapeLabel] [lengthLabel]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5180';
const SHAPE = process.argv[3] ?? 'Oval';
const LENGTH = process.argv[4] ?? '短';
const OUT = 'dogfood-output/back-view';
const SLOTS = 'assets/nail-slots/slots.back.v2.json';

fs.mkdirSync(OUT, { recursive: true });

function setReference(mm) {
  const raw = fs.readFileSync(SLOTS, 'utf8');
  const patched = raw.replace(/"referenceLengthMm":\s*\d+/, `"referenceLengthMm": ${mm}`);
  if (!/"referenceLengthMm":\s*\d+/.test(raw)) throw new Error('referenceLengthMm not found in slots json');
  fs.writeFileSync(SLOTS, patched);
}

async function reachBackView(page) {
  const email = `shot_${Date.now()}@mock.local`;
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('邮箱').fill(email);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register', { timeout: 15000 });
  await page.getByLabel('门店名称').fill('截图门店');
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/studio`, { timeout: 15000 });

  await page.goto(`${BASE}/studio/customers/new`, { waitUntil: 'networkidle' });
  await page.getByLabel('姓名 *').fill('截图客户');
  const consent = page.locator('text=客户已阅读并同意隐私政策').first();
  if (await consent.isVisible().catch(() => false)) await consent.click();
  await page.getByRole('button', { name: /^(创建客户|提交)$/ }).click();
  const modal = page.locator('text=客户隐私同意');
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('text=*（必选）').click();
    await page.getByRole('button', { name: '确认并创建' }).click();
  }
  await page.waitForURL('**/studio/customers**', { timeout: 15000 });

  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /截图客户/ }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  await page.getByText('下一步：选风格').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: new RegExp(SHAPE) }).first().click();
  await page.getByRole('button', { name: LENGTH, exact: true }).click();
  await page.getByRole('button', { name: '下一步：选风格' }).click();

  const pick = page.getByRole('button', { name: /选用此风格|应用近似基础方案|暂不选择/ }).first();
  if (await pick.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pick.click();
  }
  await page.waitForTimeout(2500);
  const tab = page.locator('button', { hasText: '整体搭配' }).first();
  if (await tab.isVisible().catch(() => false)) await tab.click();
  await page.locator('svg[data-calibration]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function shot(mm, label) {
  setReference(mm);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('ui.wizard-viewmode', 'ensemble');
    } catch {
      /* ignore */
    }
  });
  try {
    await reachBackView(page);
  } catch (err) {
    await page.screenshot({ path: path.join(OUT, `debug-${label}.png`), fullPage: true });
    console.log('stuck at', page.url());
    console.log((await page.locator('body').innerText()).slice(0, 1500));
    throw err;
  }

  const svg = page.locator('svg[data-calibration]').first();
  await svg.screenshot({ path: path.join(OUT, `${label}-canvas.png`) });
  await page.screenshot({ path: path.join(OUT, `${label}-full.png`) });
  const calib = await svg.getAttribute('data-calibration');
  console.log(`${label}: referenceLengthMm=${mm} calibration=${calib}`);
  await browser.close();
}

const original = JSON.parse(fs.readFileSync(SLOTS, 'utf8')).referenceLengthMm;
try {
  await shot(18, `before-${SHAPE}-${LENGTH}`);
  await shot(14, `after-${SHAPE}-${LENGTH}`);
} finally {
  setReference(original);
  console.log(`restored referenceLengthMm=${original}`);
}
console.log(`→ ${OUT}/`);
