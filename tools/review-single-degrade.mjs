/** 单指失败降级专项：注入后进入 STEP2 观察灰甲+⚠️ */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'dogfood-output/screenshots';
mkdirSync(OUT, { recursive: true });
const EMAIL = `mock4_${Date.now()}@mock.local`;
const shot = async (p, n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(`📸 ${n}`); };
const note = (m) => console.log(`▶ ${m}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);

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

await page.getByRole('button', { name: '调试面板' }).click();
await page.locator('label').filter({ hasText: '单指失败降级' }).first().click();
await page.getByRole('button', { name: '调试面板' }).click();
note('已注入单指失败降级');

await page.goto(`${BASE}/design/new`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /测试客/ }).click();
await page.getByRole('button', { name: '确认选择' }).click();
await page.getByRole('button', { name: /Almond/ }).first().click();
await page.getByRole('button', { name: '中', exact: true }).click();
await page.getByRole('button', { name: '下一步：选风格' }).click();
await page.getByText('为 Almond 推荐当下流行风格').waitFor();
await page.getByRole('button', { name: '暂不选择，直接进入画布' }).click();
await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 25000 });
await page.getByRole('button', { name: '应用此模板' }).first().click();
await page.waitForTimeout(2500);
await shot(page, 'm08-single-degrade-step2');
const warn = await page.getByText(/⚠️|重新渲染|失败/).count();
note(`降级提示元素数: ${warn}`);
await page.getByRole('tab', { name: '十指平铺' }).click();
await page.waitForTimeout(1500);
await shot(page, 'm09-single-degrade-tiled');
await browser.close();
console.log('=== 完成 ===');
