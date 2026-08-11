/**
 * Etsy/IG 创作者专项走查：
 * A. 主指精修 → 一键镜像到对侧指（验证存在性与效果）
 * B. 模拟顾客文字改款「无名指换个颜色」→ 计时 30s 内能否完成调整 + 导出
 * C. 单甲款式存为模板/快速派生 —— 验证能力是否存在
 * 用法: node tools/review-creator-path.mjs [baseURL]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'dogfood-output/screenshots';
mkdirSync(OUT, { recursive: true });

const EMAIL = `creator_${Date.now()}@mock.local`;
const note = (m) => console.log(`▶ ${m}`);
const shot = async (p, n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(`📸 ${n}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);

try {
  /* 快速建档到 Editor（复用主链路，选 Almond+中，跳过风格） */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('邮箱').fill(EMAIL);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('验证码').fill('123456');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL('**/register');
  await page.getByLabel('门店名称').fill('创作者工作室');
  await page.getByRole('button', { name: '完成注册' }).click();
  await page.waitForURL(`${BASE}/studio`);
  await page.getByRole('link', { name: '新建客户' }).first().click();
  await page.getByLabel('姓名 *').fill('林小满');
  await page.getByRole('button', { name: '提交' }).click();
  await page.locator('text=客户隐私同意').waitFor({ timeout: 5000 });
  await page.locator('text=*（必选）').click();
  await page.getByRole('button', { name: '确认并创建' }).click();
  await page.waitForURL('**/studio/customers/**');
  await page.goto(`${BASE}/studio/design/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /林小满/ }).click();
  await page.getByRole('button', { name: '确认选择' }).click();
  await page.getByRole('button', { name: /Almond/ }).first().click();
  await page.getByRole('button', { name: '中', exact: true }).click();
  await page.getByRole('button', { name: '下一步：选风格' }).click();
  await page.getByText('为 Almond 推荐当下流行风格').waitFor();
  /* 跳过路径测试 */
  await page.getByRole('button', { name: '暂不选择，直接进入画布' }).click();
  await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 20000 });
  note('风格弹窗「跳过」路径 OK');
  /* 应用一个模板 → 保存 → 桥接 */
  await page.getByRole('button', { name: '应用此模板' }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /打开自由画布|返回自由画布/ }).click();
  await page.waitForURL('**/studio/design/canvas?bridge=**', { timeout: 15000 });
  await page.getByRole('button', { name: '我已了解，进入自由画布' }).click();
  await page.waitForURL('**/studio/design/canvas?design=**', { timeout: 10000 });
  await page.getByTestId('editor-inspector').waitFor();
  note('已进入 Editor（默认 R4）');

  /* ── A. 镜像测试：R4 法式 → 镜像到 L4 ───────────────── */
  await page.getByRole('button', { name: /常规法式/ }).click();
  await page.getByTestId('edit-french-curve').waitFor({ timeout: 5000 });
  await page.waitForTimeout(600);
  await shot(page, 'c01-editor-r4-french');
  const mirrorBtn = page.getByRole('button', { name: /^镜像$/, exact: true });
  const mirrorExists = await mirrorBtn.count();
  note(`逐指「镜像」按钮存在: ${mirrorExists > 0}`);
  if (mirrorExists) {
    await mirrorBtn.first().click();
    await page.waitForTimeout(800);
    await shot(page, 'c02-after-mirror');
    /* 验证 L4 是否出现解锁标记/覆写 */
    const unlockCount = await page.locator('span[title="已解锁独立编辑"]').count();
    note(`镜像后解锁标记数: ${unlockCount}`);
  }
  /* 整手镜像入口 */
  const handMirror = page.getByRole('button', { name: /左手.*右手|整手镜像|镜像整手/ });
  note(`整手镜像入口存在: ${(await handMirror.count()) > 0}`);
  /* 查 store 是否暴露 mirrorLeftHandToRight 到 UI */
  const allBtns = await page.getByTestId('editor-finger-strip').locator('button').allTextContents();
  note(`十指条按钮: ${allBtns.join(' | ')}`);

  /* ── B. 30 秒改款计时：顾客说「无名指换个颜色」───────── */
  note('开始 30s 改款计时…');
  const t0 = Date.now();
  /* 1. 确认当前指 R4（无名指）已在编辑；点击色板换色 */
  const inspector = page.getByTestId('editor-inspector');
  const colorSwatches = inspector.locator('section').filter({ hasText: /底色|颜色|色彩/ }).locator('button');
  const n = await colorSwatches.count();
  note(`Inspector 底色候选数=${n}`);
  if (n >= 3) {
    await colorSwatches.nth(2).dispatchEvent('click');
  } else {
    /* 退化：任意找色板按钮 */
    await inspector.locator('button[class*="rounded-full"], button[title]').nth(2).dispatchEvent('click');
  }
  await page.waitForTimeout(600);
  await shot(page, 'c03-recolor-r4');
  /* 2. 导出对比图（单甲 PNG） */
  await page.getByRole('button', { name: /导出 PNG/ }).first().click();
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.getByText('单甲 PNG（当前指）').click();
  const png = await dl;
  await png.saveAs(`${OUT}/export-creator-${png.suggestedFilename()}`);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  note(`改款+导出耗时: ${elapsed}s（目标 ≤30s）`);

  /* ── C. 模板保存/派生能力 ───────────────────────────── */
  const saveTemplateBtn = page.getByRole('button', { name: /存为模板|保存.*模板|加入模板|我的模板/ });
  note(`「单甲存为模板」入口存在: ${(await saveTemplateBtn.count()) > 0}`);
  /* 款式预设区内容 */
  const presetTexts = await page.getByTestId('editor-context-drawer').textContent();
  note(`左侧预设区文本: ${presetTexts.slice(0, 200)}`);

  /* ── D. 保存的设计数据结构（生产参数检查） ─────────── */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  const docInfo = await page.evaluate(() => {
    const envelope = JSON.parse(window.localStorage.getItem('nail-studio:editor.docs') ?? '{}');
    const docs = envelope.data ?? {};
    const doc = Object.values(docs).at(-1);
    if (!doc) return 'no doc';
    const r4 = doc.fingerLocks?.R4;
    return {
      shape: doc.shape,
      length: doc.length,
      appearance: doc.appearance,
      sharedPatternKinds: (doc.pattern ?? []).map((e) => e.kind),
      r4PatternKinds: (r4?.pattern ?? []).map((e) => e.kind),
      r4FrenchPoints: (r4?.pattern ?? []).find((e) => e.kind === 'french_edge')?.points?.length ?? null,
      attachmentCount: (doc.attachments ?? []).length,
      sampleLayerMeta: (doc.pattern ?? [])[0] ? { name: (doc.pattern ?? [])[0].name, hasTransform: !!(doc.pattern ?? [])[0].transform } : null,
    };
  });
  note(`设计数据结构: ${JSON.stringify(docInfo)}`);

  console.log('=== 创作者专项完成 ===');
} catch (err) {
  console.error('❌ 中断:', String(err).split('\n')[0]);
  console.error('URL:', page.url());
  await page.screenshot({ path: `${OUT}/c99-failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
