/** MOCK 异常场景实测：保存失败 / 渲染全部失败 / 单指失败降级 的用户反馈 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'dogfood-output/screenshots';
mkdirSync(OUT, { recursive: true });
const EMAIL = `mock_${Date.now()}@mock.local`;
const note = (m) => console.log(`▶ ${m}`);
const shot = async (p, n) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(`📸 ${n}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('邮箱').fill(EMAIL);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register');
  await page.getByLabel('门店名称').fill('异常测试店');
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.getByRole('link', { name: '新建客户' }).first().click();
  await page.getByLabel('姓名 *').fill('测试客');
  await page.getByRole('button', { name: '提交' }).click();
  await page.locator('text=客户隐私同意').waitFor({ timeout: 5000 });
  await page.locator('text=*（必选）').click();
  await page.getByRole('button', { name: '确认并创建' }).click();
  await page.waitForURL('**/customers/**');
  await page.goto(`${BASE}/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /测试客/ }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  await page.getByRole('button', { name: /Almond/ }).first().click();
  await page.getByRole('button', { name: '中', exact: true }).click();
  await page.getByRole('button', { name: '下一步：选风格' }).click();
  await page.getByText('为 Almond 推荐当下流行风格').waitFor();
  await page.getByRole('button', { name: '暂不选择，直接进入画布' }).click();
  await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: '应用此模板' }).first().click();
  await page.waitForTimeout(800);

  /* 场景1: 保存失败 */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.waitForTimeout(300);
  await page.locator('label').filter({ hasText: '保存失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click(); /* 收起 */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'm01-save-fail-feedback');
  const saveErrVisible = await page.getByText(/保存失败|重试保存/).count();
  note(`保存失败反馈可见元素数: ${saveErrVisible}`);
  /* 重试恢复 */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '保存失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  const retryBtn = page.getByRole('button', { name: /重试保存/ });
  if (await retryBtn.count()) { await retryBtn.first().click(); await page.waitForTimeout(1500); }
  note(`重试后已保存: ${(await page.getByText('💾 已保存').count()) > 0}`);

  /* 场景2: 渲染全部失败 */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '渲染全部失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot(page, 'm02-render-fail-all');
  const renderErr = await page.getByText(/刷新|渲染失败|异常/).count();
  note(`渲染失败反馈元素数: ${renderErr}`);
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '渲染全部失败' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  /* 场景3: 单指失败降级 */
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.locator('label').filter({ hasText: '单指失败降级' }).first().click();
  await page.getByRole('button', { name: '调试面板' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot(page, 'm03-render-fail-single');
  note('三个异常场景截图完成');

  console.log('=== MOCK 场景实测完成 ===');
} catch (err) {
  console.error('❌ 中断:', String(err).split('\n')[0]);
  console.error('URL:', page.url());
  await page.screenshot({ path: `${OUT}/m99-failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
