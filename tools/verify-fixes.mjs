/**
 * 修复验证脚本（4 项）：
 * A. P0-1a 调试面板不再遮挡主 CTA（1280×633 elementFromPoint 实测）
 * B. P0-1b 新建客户提交按钮在 1280×633 折叠线内可点
 * C. P0-2 渲染失败 → 持久错误条常驻 + 重试恢复进 STEP 2
 * D. 流程-1 STEP1 改名 + 即时预览；流程-2 保存引导气泡 + 展示内标记已确认
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'dogfood-output/screenshots';
mkdirSync(OUT, { recursive: true });
const EMAIL = `fix_${Date.now()}@mock.local`;
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};
const shot = async (p, n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${n}.png` }); };

const browser = await chromium.launch();
/* 1280×633：走查中复现问题的精确视口 */
const page = await browser.newPage({ viewport: { width: 1280, height: 633 } });
page.setDefaultTimeout(15000);

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('邮箱').fill(EMAIL);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register');
  await page.getByLabel('门店名称').fill('修复验证店');
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/studio`);

  /* ── A. P0-1a：调试面板位置与遮挡 ── */
  await page.getByRole('link', { name: '新建客户' }).first().click();
  await page.waitForURL('**/studio/customers/new');
  const debugBtn = page.locator('[data-debug-id="app.debug-panel"]');
  const dbgBox = await debugBtn.boundingBox();
  check('A1 调试面板为左缘圆形收纳（≤56px 宽）', !!dbgBox && dbgBox.width <= 56 && dbgBox.x < 120, `x=${dbgBox?.x} w=${dbgBox?.width}`);

  /* ── B. P0-1b：提交按钮折叠线内可点 ── */
  await page.getByLabel('姓名 *').fill('验证客');
  const submitHit = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '提交');
    if (!b) return { found: false };
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { found: true, clickable: el === b || b.contains(el), centerY: r.y + r.height / 2, viewportH: window.innerHeight };
  });
  check('B1 提交按钮中心在视口内且直接可点（不滚动）', submitHit.clickable === true, `centerY=${submitHit.centerY} vh=${submitHit.viewportH}`);
  await shot(page, 'fix-b1-customer-sticky-cta');

  /* 完成建档（ sticky CTA 真实点击路径） */
  await page.getByRole('button', { name: '提交' }).click();
  await page.locator('text=客户隐私同意').waitFor({ timeout: 5000 });
  check('B2 吸底 CTA 真实点击 → 隐私弹窗', true);
  await page.locator('text=*（必选）').click();
  await page.getByRole('button', { name: '确认并创建' }).click();
  await page.waitForURL('**/studio/customers/**');

  /* ── D1. 流程-1：STEP1 改名 + 即时预览 ── */
  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /验证客/ }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  const ctaText = await page.getByRole('button', { name: /下一步：选风格|进入画布/ }).textContent();
  check('D1 STEP1 主按钮已改名', (ctaText ?? '').includes('下一步：选风格'), (ctaText ?? '').trim());
  /* 吸底 CTA：1280×633 短视口下不被顶出折叠线（elementFromPoint 直接命中） */
  await page.getByRole('button', { name: /Almond/ }).first().click();
  await page.getByRole('button', { name: '中', exact: true }).click();
  await page.waitForTimeout(600);
  const ctaHit = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('下一步：选风格'));
    if (!b) return { found: false };
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { found: true, clickable: el === b || b.contains(el), centerY: Math.round(r.y + r.height / 2), vh: window.innerHeight };
  });
  check('D1b STEP1 CTA 在 1280×633 折叠线内可点', ctaHit.clickable === true, `centerY=${ctaHit.centerY} vh=${ctaHit.vh}`);
  await page.waitForTimeout(800);
  const preview = page.locator('[data-debug-id="studio.wizard.step1.live-preview"]');
  const previewText = await preview.textContent();
  const previewHasNail = (await preview.locator('[data-finger-code="L3"]').count()) === 1;
  check('D2 即时预览随选择渲染（L3 单甲 + 名称标签）', previewHasNail && (previewText ?? '').includes('Almond'), (previewText ?? '').trim().slice(0, 40));
  /* 改长度 → 预览标签即时更新 */
  await page.getByRole('button', { name: '长', exact: true }).click();
  await page.waitForTimeout(800);
  const previewText2 = await preview.textContent();
  check('D3 改长度后预览即时更新', (previewText2 ?? '').includes('长'), (previewText2 ?? '').trim().slice(0, 40));
  await shot(page, 'fix-d2-step1-live-preview');

  /* ── C. P0-2：渲染失败持久错误条 + 重试恢复 ── */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '渲染全部失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.getByRole('button', { name: /下一步：选风格/ }).click();
  await page.getByText('为 Almond 推荐当下流行风格').waitFor();
  await page.getByRole('button', { name: '暂不选择，直接进入画布' }).click();
  await page.waitForTimeout(1500);
  const errBar = page.locator('[data-debug-id="studio.wizard.step1.apply-error"]');
  check('C1 失败后持久错误条出现', (await errBar.count()) === 1, (await errBar.textContent())?.slice(0, 40));
  await page.waitForTimeout(6000);
  check('C2 错误条 6s 后仍常驻（不消失）', (await errBar.count()) === 1);
  check('C3 仍停在 STEP 1 且选择保留', (await page.getByRole('button', { name: /进入画布/ }).count()) === 1);
  await shot(page, 'fix-c2-apply-error-persistent');
  /* 关闭场景 → 点错误条上的重试 → 应进入 STEP 2 */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '渲染全部失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  await errBar.getByRole('button', { name: '重试' }).click();
  await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 15000 });
  check('C4 关闭场景后点重试 → 进入 STEP 2', true);

  /* ── D4. 流程-2：保存引导气泡 + 展示内标记已确认 ── */
  await page.getByRole('button', { name: '应用此模板' }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  const nudge = page.locator('[data-debug-id="studio.wizard.present-nudge"]');
  await nudge.waitFor({ timeout: 5000 });
  check('D4 手动保存成功 → 「转给客人看看？」引导气泡', (await nudge.count()) === 1);
  await shot(page, 'fix-d4-present-nudge');
  await nudge.getByRole('button', { name: '打开顾客展示' }).click();
  await page.locator('[data-debug-id="studio.presentation"]').waitFor({ timeout: 5000 });
  const markBtn = page.locator('[data-debug-id="studio.presentation.mark-confirmed"]');
  check('D5 展示界面内有「顾客已确认」入口', (await markBtn.count()) === 1);
  await markBtn.click();
  await page.getByText('客人已当面确认？标记后设计冻结为只读。').waitFor({ timeout: 3000 });
  await shot(page, 'fix-d5-presentation-confirm-2step');
  await page.getByRole('button', { name: '确认标记' }).click();
  await page.getByText('顾客已确认 · 设计已冻结').waitFor({ timeout: 5000 });
  check('D6 两段式标记 → 展示内出现冻结 Badge', true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const saveBtnDisabled = await page.getByRole('button', { name: /^保存$/ }).isDisabled();
  check('D7 确认后 Wizard 冻结（保存按钮禁用）', saveBtnDisabled);
  /* 引导气泡每会话一次：不再出现 */
  check('D8 气泡已按会话消隐（sessionStorage 已记）', await page.evaluate(() => window.sessionStorage.getItem('ui.wizard-present-nudged') === '1'));

  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} 项通过 ===`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
} catch (err) {
  console.error('❌ 中断:', String(err).split('\n')[0]);
  console.error('URL:', page.url());
  await page.screenshot({ path: `${OUT}/fix-failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
