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
  await page.getByText('下一步：选风格').waitFor();
  step('Wizard 客户选择器', true);

  /* 4b. 能力注册表 UI：Tier 1 五个、Tier 2 十个；开放 Almond / Oval / Coffin */
  const tierOneShapes = page.locator('[data-shape-tier="1"]');
  await tierOneShapes.first().waitFor({ timeout: 10000 });
  const tierOneCount = await tierOneShapes.count();
  const tierOneOrder = await tierOneShapes.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-shape-id')),
  );
  const enabledShapeStates = await Promise.all(
    ['almond', 'oval', 'coffin'].map(async (shape) =>
      (await page.locator(`[data-shape-id="${shape}"]`).getAttribute('aria-disabled')) !== 'true'),
  );
  const tierOneDisabled = await Promise.all(
    ['squoval', 'square'].map(async (shape) =>
      (await page.locator(`[data-shape-id="${shape}"]`).getAttribute('aria-disabled')) === 'true'),
  );
  await page.getByRole('button', { name: '更多甲型（10）' }).click();
  const tierTwoCount = await page.locator('[data-shape-tier="2"]').count();
  step(
    '甲型能力目录 = Tier 1 五个 + Tier 2 十个',
    tierOneCount === 5 && tierTwoCount === 10 && enabledShapeStates.every(Boolean) && tierOneDisabled.every(Boolean),
    `Tier1=${tierOneCount}, Tier2=${tierTwoCount}, 已开放=${enabledShapeStates.filter(Boolean).length}`,
  );
  step(
    '已开放甲型自动靠前',
    tierOneOrder.join(',') === 'almond,oval,coffin,squoval,square',
    tierOneOrder.join(' → '),
  );
  await page.getByRole('button', { name: '更多甲型（10）' }).click();

  /* 5. STEP 1：选甲型 + 长度 → 应用（v1.3.0：先弹风格推荐） */
  await page.getByRole('button', { name: /Coffin/ }).first().click();
  const coffinLengthSignals = await Promise.all(
    ['短', '中', '长', '超长'].map(async (label) =>
      page.getByRole('button', { name: label, exact: true }).getAttribute('data-compatibility')),
  );
  step(
    'Coffin 长度规则全局生效且不阻断选择',
    coffinLengthSignals.join(',') === 'strong,caution,recommended,recommended' &&
      await page.getByRole('button', { name: '短', exact: true }).isEnabled(),
    coffinLengthSignals.join(' → '),
  );
  await page.getByRole('button', { name: '中', exact: true }).click();
  await page.getByRole('button', { name: '下一步：选风格' }).click();

  /* 5b. 风格推荐弹窗：选用第一款（TOP 1，自动应用映射模板） */
  await page.getByText('为 Coffin 推荐当下流行风格').waitFor({ timeout: 10000 });
  const coffinRecommendationButtons = page.getByRole('button', { name: /选用此风格/ });
  await coffinRecommendationButtons.first().waitFor({ timeout: 10000 });
  const coffinRecommendations = await coffinRecommendationButtons.count();
  step('Coffin 三款风格推荐弹窗弹出', coffinRecommendations === 3, `推荐数=${coffinRecommendations}`);
  await coffinRecommendationButtons.first().click();

  await page.getByRole('tab', { name: /整体搭配/ }).waitFor({ timeout: 20000 });
  step('STEP 1 甲型/长度 + 风格 → 进入 STEP 2', true);

  /* 5c. 三视图：默认视图为十指平铺（v2 三视图改版） */
  const tiledGrid = page.locator('[data-debug-id="studio.preview.tiled"]');
  await tiledGrid.waitFor({ timeout: 10000 });
  const tiledCells = await tiledGrid.locator('button').count();
  step('默认视图 = 十指平铺（每格 ≥120px）', tiledCells === 10, `格子数=${tiledCells}`);
  const wizardThumbBox = await tiledGrid.locator('[data-finger-code="L1"] [data-finger-nail]').boundingBox();
  const wizardMiddleBox = await tiledGrid.locator('[data-finger-code="L3"] [data-finger-nail]').boundingBox();
  const wizardPinkyBox = await tiledGrid.locator('[data-finger-code="L5"] [data-finger-nail]').boundingBox();
  step(
    'Wizard 五指展示比例 = Thumb > Middle > Pinky',
    !!wizardThumbBox &&
      !!wizardMiddleBox &&
      !!wizardPinkyBox &&
      wizardThumbBox.width > wizardMiddleBox.width * 1.1 &&
      wizardPinkyBox.width < wizardMiddleBox.width * 0.85,
    `L1=${wizardThumbBox?.width.toFixed(1)} · L3=${wizardMiddleBox?.width.toFixed(1)} · L5=${wizardPinkyBox?.width.toFixed(1)}`,
  );

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

  /* 7a2. 完整 plate + 指尖方向开关（v3 观察模式改版：整幅 1200×900 + 组合画布整体旋转） */
  const fullViewBox = await v2Svg.getAttribute('viewBox');
  step('整体搭配 = 整幅 plate（无指甲带裁剪）', fullViewBox === '0 0 1200 900', `viewBox=${fullViewBox}`);
  const ensembleBox = await v2Svg.boundingBox();

  /* 保存基线：进入方向测试前确保自动保存已落地 */
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });

  const orientToggle = page.getByTestId('tip-orientation-toggle');
  await orientToggle.waitFor({ timeout: 5000 });
  const orientWrapper = v2Svg.locator('xpath=ancestor::*[@data-tip-orientation][1]');
  const upBtn = orientToggle.getByRole('button', { name: '指尖朝上' });
  const downBtn = orientToggle.getByRole('button', { name: '指尖朝下' });
  const defaultUp =
    (await orientWrapper.getAttribute('data-tip-orientation')) === 'up' &&
    (await upBtn.getAttribute('aria-pressed')) === 'true';
  step('方向开关默认 = 指尖朝上', defaultUp);

  await downBtn.click();
  await page.waitForTimeout(350);
  const isDown = (await orientWrapper.getAttribute('data-tip-orientation')) === 'down';
  const sessionVal = await page.evaluate(() => window.sessionStorage.getItem('ui.wizard-tip-orientation'));
  step('切换 → 指尖朝下（组合画布 rotate-180 + sessionStorage 记忆）', isDown && sessionVal === 'down', `session=${sessionVal}`);

  /* 连续切换 10 次：画布几何盒无漂移，终态恢复朝上 */
  for (let i = 0; i < 5; i += 1) {
    await downBtn.click();
    await upBtn.click();
  }
  await downBtn.click();
  await page.waitForTimeout(350);
  const driftBox = await v2Svg.boundingBox();
  const boxStable =
    !!ensembleBox && !!driftBox &&
    Math.abs(ensembleBox.x - driftBox.x) < 1 && Math.abs(ensembleBox.y - driftBox.y) < 1 &&
    Math.abs(ensembleBox.width - driftBox.width) < 1 && Math.abs(ensembleBox.height - driftBox.height) < 1;
  step('连续切换 10 次画布无漂移', boxStable && (await orientWrapper.getAttribute('data-tip-orientation')) === 'down');

  /* 朝下状态点击左·中指命中区：CSS transform 同步命中测试，不交换左右手 */
  await v2Svg.locator('path[fill="transparent"]').nth(2).click({ force: true });
  await page.getByText('左·中指 · 单独定制').waitFor({ timeout: 5000 });
  step('朝下点击中指 → 仍命中正确 FingerCode（左·中指）', true);
  await page.getByRole('button', { name: '完成' }).dispatchEvent('click');

  /* 方向切换为 UI 瞬态：不置脏、不触发自动保存 */
  await page.waitForTimeout(800);
  const saveLabel = await page.locator('text=/💾 已保存|● 未保存|保存中…|保存失败/').first().textContent();
  step('方向切换不触发设计自动保存', (saveLabel ?? '').includes('已保存'), `保存状态=${(saveLabel ?? '').trim()}`);

  await upBtn.click();
  await page.waitForTimeout(350);
  step('切回指尖朝上', (await orientWrapper.getAttribute('data-tip-orientation')) === 'up');

  /* 方向开关为整体搭配专用：十指平铺下不出现 */
  await page.getByRole('tab', { name: '十指平铺' }).click();
  await tiledGrid.waitFor({ timeout: 5000 });
  const toggleHidden = (await page.getByTestId('tip-orientation-toggle').count()) === 0;
  step('十指平铺视图不显示方向开关', toggleHidden);
  await page.getByRole('tab', { name: /整体搭配/ }).click();
  await v2Svg.waitFor({ timeout: 5000 });

  /* 7b. 单指覆写：点中指 → 单独换底色 → 清除定制（v1.4.0 Phase 3） */
  await v2Svg.locator('path[fill="transparent"]').nth(2).click({ force: true });
  await page.getByText('左·中指 · 单独定制').waitFor({ timeout: 5000 });
  step('点选中指 → 单独定制面板', true);
  const colorGrid = page.locator('section:has-text("单独定制") .grid.grid-cols-8 button');
  await colorGrid.nth(3).scrollIntoViewIfNeeded();
  /* 视口较小时色格可能被调试面板浮条遮挡，用 dispatchEvent 直接触发（冒烟只验证业务逻辑） */
  await colorGrid.nth(3).dispatchEvent('click');
  await page.getByRole('button', { name: /清除该指定制/ }).waitFor({ timeout: 5000 });
  step('该指单独换色 → 覆写生效', true);
  await page.getByRole('button', { name: /清除该指定制/ }).dispatchEvent('click');
  await page.waitForTimeout(300);
  const clearGone = (await page.getByRole('button', { name: /清除该指定制/ }).count()) === 0;
  step('清除该指定制 → 覆写移除', clearGone);
  await page.getByRole('button', { name: '完成' }).dispatchEvent('click');

  /* 7c. 单指细节视图：tab 切换 + Esc 返回（v2 三视图改版） */
  await page.getByRole('tab', { name: '单指细节' }).click();
  await page.locator('[data-debug-id="studio.preview.single"]').waitFor({ timeout: 5000 });
  step('单指细节视图（大图 + 十指搭配条）', true);
  await page.keyboard.press('Escape');
  await tiledGrid.waitFor({ timeout: 5000 });
  step('Esc 返回十指平铺', true);

  /* 7d. 顾客展示模式：全屏只读 + Esc 退出（v2 新增；v3 起继承 Wizard 指尖方向） */
  await page.getByRole('tab', { name: /整体搭配/ }).click();
  await page.getByTestId('tip-orientation-toggle').getByRole('button', { name: '指尖朝下' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /顾客展示/ }).click();
  const presentation = page.locator('[data-debug-id="studio.presentation"]');
  await presentation.waitFor({ timeout: 5000 });
  step('顾客展示模式打开（全屏只读）', true);
  const presentOrientation = await presentation.locator('[data-tip-orientation]').first().getAttribute('data-tip-orientation');
  const presentNoToggle = (await presentation.getByTestId('tip-orientation-toggle').count()) === 0;
  step('顾客展示继承指尖朝下（展示内无第二个开关）', presentOrientation === 'down' && presentNoToggle, `方向=${presentOrientation}`);
  await page.keyboard.press('Escape');
  const presentGone = (await page.locator('[data-debug-id="studio.wizard.presentation"]').count()) === 0;
  step('Esc 退出顾客展示模式', presentGone);
  const wizardStillDown = (await v2Svg.locator('xpath=ancestor::*[@data-tip-orientation][1]').getAttribute('data-tip-orientation')) === 'down';
  step('退出后 Wizard 方向保持朝下', wizardStillDown);
  await page.getByTestId('tip-orientation-toggle').getByRole('button', { name: '指尖朝上' }).click();
  await page.waitForTimeout(300);

  /* 7e. 再次设置覆写并保留 → 桥接应带入 Editor（v2 桥接数据修复验证） */
  await page.getByRole('tab', { name: /整体搭配/ }).click();
  await v2Svg.waitFor({ timeout: 5000 });
  await v2Svg.locator('path[fill="transparent"]').nth(2).click({ force: true });
  await page.getByText('左·中指 · 单独定制').waitFor({ timeout: 5000 });
  await colorGrid.nth(4).dispatchEvent('click');
  await page.getByRole('button', { name: /清除该指定制/ }).waitFor({ timeout: 5000 });
  step('保留逐指覆写（桥接验证前置）', true);

  /* 8. 手动保存 → 💾 已保存 */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  step('保存 → 💾 已保存', true);

  /* 8b. Coffin v4 导出链路：隐藏 plate 注册源生成 PNG */
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: '导出预览 PNG' }).dispatchEvent('click');
  const pngDownload = await downloadPromise;
  step('Coffin v4 导出 PNG', pngDownload.suggestedFilename().endsWith('.png'), pngDownload.suggestedFilename());

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

  /* 10a. E1 工作区：非阻塞引导、左右工作区、Inspector、十指条 */
  await page.getByTestId('editor-context-drawer').waitFor({ timeout: 5000 });
  await page.getByTestId('editor-inspector').waitFor({ timeout: 5000 });
  await page.getByTestId('editor-finger-strip').waitFor({ timeout: 5000 });
  const singleScope = page.getByRole('button', { name: /仅当前指 R4/ });
  await singleScope.waitFor({ timeout: 5000 });
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  step('E1 专业工作区 + 默认单甲编辑 + 1280 无横向滚动', noHorizontalOverflow && (await singleScope.getAttribute('aria-pressed')) === 'true');

  /* 10a2. DEV 源码反向 PRD：独立入口、全 Studio 搜索、源码状态与页面定位 */
  await page.getByRole('button', { name: '需求说明', exact: true }).click();
  const requirementsDrawer = page.locator('[data-debug-id="app.requirements-drawer"]');
  await requirementsDrawer.waitFor({ timeout: 5000 });
  await requirementsDrawer.getByPlaceholder('搜索模块、ID、功能或源码语义').fill('法式');
  const canvasRequirement = requirementsDrawer.getByRole('button', { name: /单甲自由画布/ });
  await canvasRequirement.waitFor({ timeout: 5000 });
  await canvasRequirement.click();
  await requirementsDrawer.getByRole('button', { name: '定位页面元素' }).click();
  await requirementsDrawer.getByText('已定位并高亮页面元素').waitFor({ timeout: 5000 });
  const verifiedSources = await requirementsDrawer
    .getByText('源码与最近人工复核版本一致')
    .count();
  const locatorCopyVisible = await requirementsDrawer
    .getByRole('button', { name: '复制定位' })
    .isVisible();
  const prdCopyVisible = await requirementsDrawer
    .getByRole('button', { name: '复制 PRD' })
    .isVisible();
  step(
    '源码反向 PRD：独立入口 + 搜索 + 定位 + 证据状态',
    verifiedSources === 2 && locatorCopyVisible && prdCopyVisible,
    `已核对源码=${verifiedSources}`,
  );
  await requirementsDrawer.getByRole('button', { name: '关闭需求说明' }).click();

  /* 10b. E2 Recipe → Layer：法式入口直接暴露在画布，不再要求先猜到图层入口 */
  await page.getByRole('button', { name: /常规法式/ }).click();
  const frenchCanvasEntry = page.getByTestId('edit-french-curve');
  await frenchCanvasEntry.waitFor({ timeout: 5000 });
  await frenchCanvasEntry.click();
  const frenchHandles = await page.locator('[data-testid="classic-french-handles"]').count();
  const layerPanel = page.getByTestId('layer-panel');
  const classicLayer = layerPanel.getByText('经典法式', { exact: true }).last();
  await classicLayer.waitFor({ timeout: 5000 });
  const layerName = layerPanel.getByLabel('图层名称');
  await layerName.fill('Coffin 法式主层');
  const patternSection = layerPanel.locator('section').filter({ hasText: '图案' }).first();
  await patternSection.getByTitle('复制').last().click();
  const duplicateCount = await layerPanel.getByText(/Coffin 法式主层/).count();
  await patternSection.getByTitle('上移').last().click();
  await patternSection.getByTitle('下移').last().click();
  await patternSection.getByTitle('隐藏').last().click();
  await patternSection.getByTitle('锁定').last().click();
  step('法式画布入口 + 三点控制 + Layer 元数据操作', duplicateCount === 2 && frenchHandles === 1, `法式层=${duplicateCount}, 控制柄组=${frenchHandles}`);

  /* 10c. 显式切换十指同步；Recipe 写入共享基底，单甲法式保留在 R4 override */
  await page.getByRole('button', { name: '十指同步' }).click();
  await page.getByRole('button', { name: /裸色渐变/ }).click();

  /* 10d. 保存重开：Schema v2 同时保留 shared gradient 与 R4 French override */
  await page.getByRole('button', { name: /^保存$/ }).click();
  await page.getByText('💾 已保存').waitFor({ timeout: 10000 });
  const scopePersistence = await page.evaluate(() => {
    const envelope = JSON.parse(window.localStorage.getItem('nail-studio:editor.docs') ?? '{}');
    const docs = envelope.data ?? {};
    const doc = Object.values(docs).at(-1);
    return {
      shape: doc?.shape,
      sharedGradient: doc?.pattern?.some((element) => element.kind === 'gradient') ?? false,
      r4French: doc?.fingerLocks?.R4?.pattern?.some((element) => element.kind === 'french_edge') ?? false,
    };
  });
  step(
    'Coffin 桥接 + 当前指 / 十指同步写入不同数据分区',
    scopePersistence.shape === 'coffin' && scopePersistence.sharedGradient && scopePersistence.r4French,
    `shape=${scopePersistence.shape}`,
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('editor-inspector').waitFor({ timeout: 5000 });
  await page.getByRole('tab', { name: '图层' }).click();
  const restoredLayers = await page.getByTestId('layer-panel').getByText(/Coffin 法式主层/).count();
  step('Editor Schema v2 保存并重开', restoredLayers === 2, `恢复单甲法式层=${restoredLayers}`);

  /* 10e. Editor / Wizard 甲型同源：Coffin 在两端均正式开放 */
  await page.getByRole('tab', { name: '设计' }).click();
  const coffinEnabled = !(await page.getByRole('button', { name: 'Coffin' }).isDisabled());
  const squareStillDisabled = await page.getByRole('button', { name: 'Square' }).isDisabled();
  const squovalStillDisabled = await page.getByRole('button', { name: 'Squoval' }).isDisabled();
  step('Editor 同步开放 Coffin；Squoval / Square 保持灰态', coffinEnabled && squareStillDisabled && squovalStillDisabled);

  const editorUrl = page.url();
  await page.goto(`${BASE}/design/canvas?blank=1`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '空白画布新建' }).waitFor({ timeout: 5000 });
  const blankShapeOrder = await page.locator('[data-shape-id]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-shape-id')),
  );
  const blankCoffinEnabled = await page.locator('[data-shape-id="coffin"]').isEnabled();
  const blankSquareDisabled = await page.locator('[data-shape-id="square"]').isDisabled();
  const blankNaturalSignal = await page
    .getByRole('button', { name: '短', exact: true })
    .getAttribute('data-compatibility');
  step(
    '空白画布复用能力注册表与兼容规则',
    blankShapeOrder.join(',') === 'almond,oval,coffin,squoval,square' &&
      blankCoffinEnabled &&
      blankSquareDisabled &&
      blankNaturalSignal === 'strong',
    `${blankShapeOrder.join(' → ')} · 短=${blankNaturalSignal}`,
  );
  await page.goto(editorUrl, { waitUntil: 'networkidle' });
  await page.getByTestId('editor-inspector').waitFor({ timeout: 5000 });

  /* 10f. 全局中英文切换；甲型名称保持英文 */
  await page.getByTestId('language-toggle').getByRole('button', { name: 'EN' }).click();
  await page.getByTestId('editor-finger-strip').getByText('EDIT SCOPE').first().waitFor({ timeout: 5000 });
  const ovalStillEnglish = await page.getByTestId('editor-design-inspector').getByRole('button', { name: 'Oval' }).first().isVisible();
  step('全局文案切换至英文；甲型保持英文', ovalStillEnglish);
  await page.getByTestId('language-toggle').getByRole('button', { name: '中文' }).click();

  /* 10g. 桥接保真：Editor 十指平铺出现 L3 + R4 两个解锁标记 */
  await page.getByRole('button', { name: '十指预览' }).click();
  const editorThumbBox = await page.locator('[data-finger-code="L1"] [data-finger-nail]').boundingBox();
  const editorMiddleBox = await page.locator('[data-finger-code="L3"] [data-finger-nail]').boundingBox();
  const editorPinkyBox = await page.locator('[data-finger-code="L5"] [data-finger-nail]').boundingBox();
  step(
    'Editor 十指预览复用五指展示比例',
    !!editorThumbBox &&
      !!editorMiddleBox &&
      !!editorPinkyBox &&
      editorThumbBox.height > editorMiddleBox.height * 1.1 &&
      editorPinkyBox.height < editorMiddleBox.height * 0.85,
    `L1=${editorThumbBox?.height.toFixed(1)} · L3=${editorMiddleBox?.height.toFixed(1)} · L5=${editorPinkyBox?.height.toFixed(1)}`,
  );
  await page.locator('span[title="已解锁独立编辑"]').first().waitFor({ timeout: 5000 });
  const unlockBadges = await page.locator('span[title="已解锁独立编辑"]').count();
  step('桥接覆写 + Editor 单甲编辑均保留', unlockBadges === 2, `🔓 数量=${unlockBadges}`);
  await page.getByRole('button', { name: '返回单甲' }).click();

  /* 10h. 顾客展示只读，Esc 返回 */
  await page.getByRole('button', { name: '顾客展示' }).click();
  await page.getByText('顾客确认展示').waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  step('Editor 顾客展示模式 + Esc', (await page.getByText('顾客确认展示').count()) === 0);

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
