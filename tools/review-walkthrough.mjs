/**
 * 走查脚本：女性视角审美与交互审查 —— 全链路截图 + 关键交互
 * 用法: node tools/review-walkthrough.mjs [baseURL]
 * 输出: dogfood-output/screenshots/*.png + 控制台摘要
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'dogfood-output/screenshots';
mkdirSync(OUT, { recursive: true });

const EMAIL = `review_${Date.now()}@mock.local`;
const STORE = '月光美甲工作室';
const CUSTOMER = '陈思雨';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
};
const note = (msg) => console.log(`▶ ${msg}`);

try {
  /* 1. 登录 → 注册 */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot('01-login');
  await page.getByLabel('邮箱').fill(EMAIL);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register');
  await shot('02-register');
  await page.getByLabel('门店名称').fill(STORE);
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/studio`);
  await shot('03-dashboard-empty');
  note('登录/注册/Dashboard 完成');

  /* 2. 新建客户（完整建档 → 隐私弹窗） */
  await page.getByRole('link', { name: '新建客户' }).first().click();
  await page.waitForURL('**/studio/customers/new');
  await page.getByLabel('姓名 *').fill(CUSTOMER);
  await shot('04-customer-form');
  await page.getByRole('button', { name: '提交' }).click();
  const privacyModal = page.locator('text=客户隐私同意');
  await privacyModal.waitFor({ timeout: 5000 });
  await shot('05-privacy-modal');
  await page.locator('text=*（必选）').click();
  await page.getByRole('button', { name: '确认并创建' }).click();
  await page.waitForURL('**/studio/customers/**');
  await shot('06-customer-detail');
  note('客户建档 + 隐私弹窗 完成');

  /* 3. Wizard STEP 1 */
  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await shot('07-wizard-customer-picker');
  await page.getByRole('button', { name: new RegExp(CUSTOMER) }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  await page.getByText('下一步：选风格').waitFor();
  await shot('08-wizard-step1-shapes');
  await page.getByRole('button', { name: '更多甲型（10）' }).click();
  await shot('09-wizard-shapes-expanded');
  await page.getByRole('button', { name: '更多甲型（10）' }).click();
  await page.getByRole('button', { name: /Almond/ }).first().click();
  await page.getByRole('button', { name: '中', exact: true }).click();
  await shot('10-wizard-step1-selected');
  await page.getByRole('button', { name: '下一步：选风格' }).click();
  await page.getByText('为 Almond 推荐当下流行风格').waitFor();
  await shot('11-style-recommendation');
  note('Wizard STEP1 + 风格推荐弹窗 完成');

  /* 4. 选 TOP1 风格 → STEP 2 */
  await page.getByRole('button', { name: /选用此风格/ }).first().click();
  await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot('12-step2-canvas-default');
  note('进入 STEP 2 三栏画布（默认视图）');

  /* 4b. 三视图 */
  await page.getByRole('tab', { name: '十指平铺' }).click();
  await shot('13-step2-tiled');
  await page.getByRole('tab', { name: /整体搭配/ }).click();
  await page.waitForTimeout(800);
  await shot('14-step2-ensemble');
  await page.getByRole('tab', { name: '单指细节' }).click();
  await shot('15-step2-single-detail');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: /整体搭配/ }).click();

  /* 4c. 换底色（右栏色板） */
  const paletteSection = page.locator('section').filter({ hasText: '底色' }).first();
  const swatches = paletteSection.locator('button');
  const swatchCount = await swatches.count();
  note(`右栏底色色板色块数=${swatchCount}`);
  if (swatchCount > 5) {
    await swatches.nth(5).dispatchEvent('click');
    await page.waitForTimeout(600);
    await shot('16-step2-color-changed');
  }

  /* 4d. 质感控件检查 */
  const paramsText = await page.locator('aside, [class*="panel"], [class*="Panel"]').last().textContent().catch(() => '');
  note(`右栏参数面板文本片段: ${paramsText.slice(0, 300)}`);

  /* 4e. 逐指例外（整体搭配视图点中指） */
  const v2Svg = page.locator('svg[data-calibration="back-v2.1.0"]').first();
  await v2Svg.waitFor({ timeout: 10000 });
  await v2Svg.locator('path[fill="transparent"]').nth(2).click({ force: true });
  await page.getByText('左·中指 · 单独定制').waitFor({ timeout: 5000 });
  await shot('17-step2-finger-override-panel');
  const colorGrid = page.locator('section:has-text("单独定制") .grid.grid-cols-8 button');
  await colorGrid.nth(3).dispatchEvent('click');
  await page.getByRole('button', { name: /清除该指定制/ }).waitFor({ timeout: 5000 });
  await shot('18-step2-finger-override-applied');
  await page.getByRole('button', { name: '完成' }).dispatchEvent('click');
  note('逐指例外覆写完成');

  /* 4f. 顾客展示模式 */
  await page.getByRole('button', { name: /顾客展示/ }).click();
  await page.locator('[data-debug-id="studio.presentation"]').waitFor({ timeout: 5000 });
  await shot('19-presentation-mode');
  await page.keyboard.press('Escape');
  note('顾客展示模式 完成');

  /* 5. 保存 → 导出 PNG → 桥接 */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: '导出预览 PNG' }).dispatchEvent('click');
  const png = await downloadPromise;
  await png.saveAs(`${OUT}/export-wizard-${png.suggestedFilename()}`);
  note(`Wizard 导出 PNG: ${png.suggestedFilename()}`);
  await page.getByRole('button', { name: /打开自由画布|返回自由画布/ }).click();
  await page.waitForURL('**/studio/design/canvas?bridge=**', { timeout: 15000 });
  await page.getByText('你将无法再切换模板').waitFor();
  await shot('20-bridge-warning');
  await page.getByRole('button', { name: '我已了解，进入自由画布' }).click();
  await page.waitForURL('**/studio/design/canvas?design=**', { timeout: 10000 });
  await page.waitForTimeout(1800);
  await shot('21-editor-workspace');
  note('桥接进入 Editor');

  /* 6. Editor 工作区 */
  await page.getByTestId('editor-inspector').waitFor();
  await shot('22-editor-inspector');
  /* 工具: 画笔/橡皮/图案/文字 —— 截图工具面板 */
  const toolbarText = await page.getByTestId('editor-context-drawer').textContent().catch(() => '');
  note(`Editor 左侧工作区文本: ${toolbarText.slice(0, 400)}`);
  /* 法式入口 */
  await page.getByRole('button', { name: /常规法式/ }).click();
  await page.getByTestId('edit-french-curve').waitFor({ timeout: 5000 });
  await page.getByTestId('edit-french-curve').click();
  await page.waitForTimeout(500);
  await shot('23-editor-french-edge');
  /* 图层面板 */
  const layerPanel = page.getByTestId('layer-panel');
  await shot('24-editor-layers');
  /* 十指预览 */
  await page.getByRole('button', { name: '十指预览' }).click();
  await page.waitForTimeout(1000);
  await shot('25-editor-ten-finger');
  await page.getByRole('button', { name: '返回单甲' }).click();
  /* 顾客展示（Editor） */
  await page.getByRole('button', { name: '顾客展示' }).click();
  await page.getByText('顾客确认展示').waitFor({ timeout: 5000 });
  await shot('26-editor-presentation');
  await page.keyboard.press('Escape');
  /* 保存 */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  /* Editor 导出 PNG（下拉 → 十指平铺 PNG） */
  await page.getByRole('button', { name: /导出 PNG/ }).first().click();
  await page.getByText('十指平铺 PNG').waitFor({ timeout: 5000 });
  await shot('26b-editor-export-menu');
  const dl2 = page.waitForEvent('download', { timeout: 15000 });
  await page.getByText('十指平铺 PNG').click();
  const png2 = await dl2;
  await png2.saveAs(`${OUT}/export-editor-${png2.suggestedFilename()}`);
  note(`Editor 导出 PNG: ${png2.suggestedFilename()}`);

  /* 6b. Editor 顶栏「顾客已确认」→ 冻结只读 */
  await page.getByRole('button', { name: /顾客已确认/ }).click();
  await page.waitForTimeout(500);
  await shot('26c-confirm-modal');
  const confirmDialogBtn = page.getByRole('button', { name: /确认标记|标记为已确认|确认$/ }).last();
  if (await confirmDialogBtn.count()) await confirmDialogBtn.click();
  await page.waitForTimeout(1200);
  await shot('26d-editor-readonly-frozen');
  note('顾客已确认 → 冻结只读 完成');

  /* 7. 我的设计列表 + 状态机 */
  await page.goto(`${BASE}/studio/design`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('27-design-list');
  /* 已确认 tab → 基于已确认创建新版本 */
  const confirmedTab = page.getByRole('tab', { name: '已确认' });
  if (await confirmedTab.count()) {
    await confirmedTab.click();
    await page.waitForTimeout(500);
    await shot('28-design-list-confirmed-tab');
    const newVersionBtn = page.getByRole('button', { name: /基于已确认创建新版本/ });
    if (await newVersionBtn.count()) {
      await newVersionBtn.first().click();
      await page.waitForTimeout(800);
      await shot('29-new-version-created');
      note('基于已确认创建新版本 完成');
    }
  }
  /* 退回草稿（二次确认弹窗） */
  const revertBtn = page.getByRole('button', { name: /退回草稿/ });
  if (await revertBtn.count()) {
    await revertBtn.first().click();
    await page.waitForTimeout(400);
    await shot('30-revert-confirm-modal');
    const revertConfirm = page.getByRole('button', { name: /确认退回|退回$/ });
    if (await revertConfirm.count()) await revertConfirm.first().click();
    await page.waitForTimeout(600);
    note('退回草稿 完成');
  }

  /* 8. MOCK 异常场景: 保存失败 + 渲染失败（在 Wizard 页面注入） */
  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.waitForTimeout(400);
  await page.locator('label').filter({ hasText: '保存失败' }).first().click();
  await page.locator('label').filter({ hasText: '渲染全部失败' }).first().click();
  await shot('31-mock-armed');
  note('MOCK 场景已注入（保存失败+渲染全部失败）');

  /* 9. 窄视口检查 1280x720 */
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await shot('32-narrow-wizard-1280');
  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  note(`1280x720 横向滚动: ${hasHScroll}`);

  console.log('\n=== pageerrors ===');
  console.log(errors.length ? errors.slice(0, 5).join('\n') : '无');
  console.log('=== 走查完成 ===');
} catch (err) {
  console.error('❌ 流程中断:', String(err).split('\n')[0]);
  console.error('当前 URL:', page.url());
  await page.screenshot({ path: `${OUT}/99-failure.png`, fullPage: true }).catch(() => {});
  if (errors.length) console.error('[pageerror]', errors.slice(0, 5).join(' | '));
  process.exitCode = 1;
}
await browser.close();
