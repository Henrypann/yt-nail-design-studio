/**
 * 最小 e2e 冒烟（FRONTEND_MOCK）：
 * 登录(123456) → 注册门店 → Dashboard → 新建客户 → Wizard 选甲型长度 →
 * 应用模板 → 十指预览 → 保存 → 桥接警告弹窗 → 设计列表可见。
 * 运行：node tools/e2e-smoke.mjs [baseURL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const EMAIL = `e2e_${Date.now()}@mock.local`;
const STORE = 'E2E 冒烟门店';
const CUSTOMER = '冒烟测试客户';

const results = [];
function step(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

try {
  /* 1. 登录（Mock 验证码 123456） */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('邮箱').fill(EMAIL);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register', { timeout: 10000 });
  step('登录（验证码 123456）→ 自动流转注册', true);

  /* 2. 注册 Step 2：门店名称 */
  await page.getByLabel('门店名称').fill(STORE);
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  await page.getByText(`欢迎回来，${STORE}`).waitFor();
  step('注册门店 → Dashboard', true);

  /* 3. 新建客户 */
  await page.getByRole('link', { name: '新建客户' }).first().click();
  await page.waitForURL('**/customers/new');
  await page.getByLabel('姓名 *').fill(CUSTOMER);
  // quick 模式：勾选隐私同意 → 创建客户；full 模式：提交 → 隐私弹窗
  const quickConsent = page.locator('text=客户已阅读并同意隐私政策').first();
  if (await quickConsent.isVisible().catch(() => false)) {
    await quickConsent.click();
  }
  await page.getByRole('button', { name: /^(创建客户|提交)$/ }).click();
  const privacyModal = page.locator('text=客户隐私同意');
  if (await privacyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('text=*（必选）').click();
    await page.getByRole('button', { name: '确认并创建' }).click();
  }
  await page.waitForURL('**/customers**', { timeout: 10000 });
  await page.getByText(CUSTOMER).first().waitFor();
  step('新建客户', true, page.url());

  /* 4. 进入 Wizard：客户选择器 → 选中客户 */
  await page.goto(`${BASE}/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: new RegExp(CUSTOMER) }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  await page.getByText('应用 → 预览十指').waitFor();
  step('Wizard 客户选择器', true);

  /* 5. STEP 1：选甲型 + 长度 → 应用（v1.3.0：先弹风格推荐） */
  await page.getByRole('button', { name: /杏仁形/ }).first().click();
  await page.getByRole('button', { name: /^中/ }).first().click();
  await page.getByRole('button', { name: '应用 → 预览十指' }).click();

  /* 5b. 风格推荐弹窗：选用第一款（TOP 1，自动应用映射模板） */
  await page.getByText('为杏仁形推荐当下流行风格').waitFor({ timeout: 10000 });
  step('风格推荐弹窗弹出', true);
  await page.getByRole('button', { name: /选用此风格/ }).first().click();

  await page.getByText('Back · 手背').waitFor({ timeout: 20000 });
  step('STEP 1 甲型/长度 + 风格 → 进入 STEP 2', true);

  /* 5c. 三视图：默认视图为十指平铺（v2 三视图改版） */
  const tiledGrid = page.locator('[data-debug-id="studio.wizard.step2.tiled-view"]');
  await tiledGrid.waitFor({ timeout: 10000 });
  const tiledCells = await tiledGrid.locator('button').count();
  step('默认视图 = 十指平铺（每格 ≥120px）', tiledCells === 10, `格子数=${tiledCells}`);

  /* 6. 应用第一个模板 */
  await page.getByRole('button', { name: '应用此模板' }).first().click();
  await page.waitForTimeout(500);
  step('应用模板', true);

  /* 7. 十指预览出现（平铺 10 格 + plate 实例，svg 节点充足） */
  await page.waitForTimeout(1500);
  const nailCount = await page.locator('svg').count();
  step('十指预览渲染', nailCount >= 10, `svg 节点数=${nailCount}`);

  /* 7a. NailSlot V2 渲染路径：切到「整体搭配」视图后断言签收 plate（v2 三视图改版） */
  await page.getByRole('tab', { name: /整体搭配/ }).click();
  const v2Svg = page.locator('svg[data-calibration="back-v2.1.0"]').first();
  await v2Svg.waitFor({ timeout: 10000 });
  const v2Images = await v2Svg.locator('image').count();
  step('Back 视图走 NailSlot V2（plate 内联 + back-v2.1.0）', v2Images >= 1, `image 节点=${v2Images}`);

  /* 7b. 单指覆写：点中指 → 单独换底色 → 清除定制（v1.4.0 Phase 3） */
  await v2Svg.locator('path[fill="transparent"]').nth(2).click({ force: true });
  await page.getByText('左·中指 · 单独定制').waitFor({ timeout: 5000 });
  step('点选中指 → 单独定制面板', true);
  const colorGrid = page.locator('section:has-text("单独定制") .grid.grid-cols-8 button');
  await colorGrid.nth(3).click();
  await page.getByRole('button', { name: /清除该指定制/ }).waitFor({ timeout: 5000 });
  step('该指单独换色 → 覆写生效', true);
  await page.getByRole('button', { name: /清除该指定制/ }).click();
  await page.waitForTimeout(300);
  const clearGone = (await page.getByRole('button', { name: /清除该指定制/ }).count()) === 0;
  step('清除该指定制 → 覆写移除', clearGone);
  await page.getByRole('button', { name: '完成' }).click();

  /* 7c. 单指细节视图：tab 切换 + Esc 返回（v2 三视图改版） */
  await page.getByRole('tab', { name: '单指细节' }).click();
  await page.locator('[data-debug-id="studio.wizard.step2.single-view"]').waitFor({ timeout: 5000 });
  step('单指细节视图（大图 + 十指搭配条）', true);
  await page.keyboard.press('Escape');
  await tiledGrid.waitFor({ timeout: 5000 });
  step('Esc 返回十指平铺', true);

  /* 8. 手动保存 → 💾 已保存 */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  step('保存 → 💾 已保存', true);

  /* 9. [打开自由画布] 桥接：不可逆警告弹窗 */
  await page.getByRole('button', { name: /打开自由画布|返回自由画布/ }).click();
  await page.waitForURL('**/design/canvas?bridge=**', { timeout: 15000 });
  await page.getByText('你将无法再切换模板').waitFor({ timeout: 10000 });
  step('桥接 → 不可逆警告弹窗', true);

  /* 10. 确认进入 Editor 画布 */
  await page.getByRole('button', { name: '我已了解，进入自由画布' }).click();
  await page.waitForURL('**/design/canvas?design=**', { timeout: 10000 });
  await page.waitForTimeout(1500);
  step('进入 Editor 画布', !page.url().includes('bridge='), page.url());

  /* 11. 设计列表可见 */
  await page.goto(`${BASE}/design`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const cards = await page.locator('text=/个历史设计|v1/').count();
  const listHtml = await page.content();
  const hasCard = listHtml.includes('草稿');
  step('设计列表可见（草稿卡）', hasCard, `命中=${cards}`);

  /* 12. 控制台严重错误 */
  step('无 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (err) {
  step('流程中断', false, String(err).split('\n')[0]);
  if (errors.length > 0) console.log('[pageerror 收集]', errors.slice(0, 5).join(' | '));
  await page.screenshot({ path: 'tools/e2e-failure.png', fullPage: true }).catch(() => {});
  console.log('截图已保存：tools/e2e-failure.png，当前 URL：', page.url());
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 步通过 ===`);
process.exit(failed.length > 0 ? 1 : 0);
