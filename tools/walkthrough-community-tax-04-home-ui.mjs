#!/usr/bin/env node
/**
 * walkthrough-community-tax-04-home-ui.mjs · COMM-v0.7.2-TAX-04
 * 六视口 Playwright 验收走查（首页主/次浏览导航 + 运行时筛选 + 卡片/详情 +
 * 显式空反馈 + 加载失败）。
 *
 * 覆盖（与 test-community-tax-04-home-ui.mjs 的静态契约互补，全部为真实
 * 浏览器断言，视口独立 context）：
 *
 *   1. 主浏览按钮精确顺序 recommended → shape → style → scene → theme，
 *      标签非空，恰好 5 个（browse-primary-*）。
 *   2. recommended 次行恰好 8 个可见频道（for-you, trending, new,
 *      editorial, makeable, dimensional, emerging-creator, collections），
 *      无 Following/关注新作、无 browse-topic-following。
 *   3. 全部主/次/来源/筛选动作目标 >=44px 高；代表性 icon-only 目标
 *      （remove-condition-*）宽高 >=44。
 *   4. 键盘可达性：focus Shape 主按钮 + Enter → URL browse=shape&
 *      topic=shape:almond、aria-pressed=true、焦点仍在按钮上
 *      （activeElement testid）；键盘 Enter 选择 shape topic；指针点击 Style。
 *   5. 会话记忆：shape:oval → style:minimal-clean → 切回 shape 恢复
 *      shape:oval → 切回 style 恢复 style:minimal-clean → 浏览器 Back
 *      恢复上一个可分享状态与计数。
 *   6. touch 视口用 locator.tap() 完成 Theme/次行切换并回到 recommended；
 *      桌面用 click（touch 仅 390/768，hasTouch=true）。
 *   7. 390 次行容器 clientWidth < scrollWidth（style 长维度）且程序化
 *      scrollLeft 增加，整页仍无横向溢出；其它视口仅断言容器不引起整页溢出。
 *   8. 兼容辅助筛选：#community-runtime-filter-panel 选择 length:short →
 *      selected-condition-length:short 可见 + URL 精确；单条移除只移除
 *      length；rights:original → clear-all 可见 → 点击 → 默认 URL/browse、
 *      chip 消失；结果数可见整数；默认状态无 no-op clear-all。
 *   9. 卡片：每卡 discovery tag pills <=6；style 浏览下任何含 style tag 的
 *      卡片首个 pill data-tag-id 以 style: 开头；每张卡有独立
 *      community-rights-badge/data-rights-status。不断言固定卡片数，仅
 *      fixture 支持的频道断言 >0。
 *  10. 详情：打开首卡 canonical 链接 → community-look-page +
 *      community-discovery-detail；结构化 group testid 按允许顺序
 *      STYLE,TECHNIQUE,SHAPE,SCENE,THEME,LENGTH 出现且每 group 至少一个
 *      data-tag-id；rights/makeability 徽章存在；page.goBack 返回。
 *
 * 反馈场景（1440 单次）：
 *  - F1 `/?color=red`：不兼容 + invalid-link 反馈 + count 0；community-feed-
 *    empty 内绝无 Clear filters/清除筛选 按钮；显式 remove-incompatible-color
 *    解决并恢复 count > 0。
 *  - F2 `/?rights=rights%3Apending`：rights-restricted 反馈 + count 0；
 *    兼容清除按钮解决并移除 rights。
 *  - F3 加载失败：fresh context route `**\/community/taxonomy-v2.json` → HTTP
 *    500 → community-feed-feedback-load-failed + Retry；route 仍失败时不点击
 *    Retry。
 *
 * 输出：EVIDENCE_DIR（默认 evidence/pr-community-v0-7-2-tax-04）下
 * screenshots/home-<width>.png、screenshots/detail-390|1440.png、失败
 * screenshots/failure-*.png，以及 walkthrough-report.json（每视口
 * scenarios/counts/overflow/touch/consoleErrors/pageErrors/截图路径，
 * 含 feedback 场景）。绝不读写 app/localStorage，绝不修改产品代码。
 *
 * Usage:
 *   node tools/walkthrough-community-tax-04-home-ui.mjs [baseUrl] [evidenceDir]
 *   BASE_URL=http://127.0.0.1:5244 EVIDENCE_DIR=evidence/pr-community-v0-7-2-tax-04 node tools/...
 *
 * Base URL: process.env.BASE_URL ?? argv[2] ?? http://127.0.0.1:5244
 * Evidence: process.env.EVIDENCE_DIR ?? argv[3] ?? evidence/pr-community-v0-7-2-tax-04
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.BASE_URL ?? process.argv[2] ?? 'http://127.0.0.1:5244';
const rootUrl = baseUrl.replace(/\/+$/, '');
const evidenceDir = process.env.EVIDENCE_DIR ?? process.argv[3] ?? 'evidence/pr-community-v0-7-2-tax-04';
const shotsDir = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(shotsDir, { recursive: true });

const TAG = 'tax-04-home-ui:e2e';

const VIEWPORTS = [
  { width: 390, height: 844, touch: true },
  { width: 768, height: 900, touch: true },
  { width: 1024, height: 900, touch: false },
  { width: 1280, height: 900, touch: false },
  { width: 1366, height: 900, touch: false },
  { width: 1440, height: 900, touch: false },
];

/** 主浏览精确顺序（PRIMARY_BROWSE_IDS，不含第六个法式主入口）。 */
const EXPECTED_PRIMARY = ['recommended', 'shape', 'style', 'scene', 'theme'];

/** recommended 次行可见频道顺序（following 被关系提供方过滤）。 */
const EXPECTED_RECOMMENDED_CHANNELS = [
  'for-you',
  'trending',
  'new',
  'editorial',
  'makeable',
  'dimensional',
  'emerging-creator',
  'collections',
];

/** 详情结构化 group 允许顺序（DISCOVERY_DETAIL_GROUP_ORDER，允许跳过空组）。 */
const DETAIL_GROUP_ORDER = ['STYLE', 'TECHNIQUE', 'SHAPE', 'SCENE', 'THEME', 'LENGTH'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function paramsOf(url) {
  return new URL(url).searchParams;
}

/**
 * 等待当前 URL 与 `expected` 逐 key 完全一致（exact getAll），且 `absent`
 * 中的 key 全部消失。例如 `{ length: ['length:short'] }` 证明没有第二个
 * length 出现、也没有逗号兄弟项残留。
 */
async function waitForSearchParams(page, expected, absent = []) {
  await page.waitForFunction(
    ([spec, absentKeys]) => {
      const params = new URL(window.location.href).searchParams;
      const matches = Object.entries(spec).every(([key, values]) => {
        const actual = params.getAll(key);
        return (
          actual.length === values.length &&
          actual.every((value, index) => value === values[index])
        );
      });
      return matches && absentKeys.every((key) => !params.has(key));
    },
    [expected, absent],
  );
}

/** 等待 URL 回到完全默认（无任何查询参数）。 */
async function waitForEmptySearch(page) {
  await page.waitForFunction(() => new URL(window.location.href).search === '');
}

/** Community feed ready：骨架/loading 被运行时筛选替换。 */
async function waitFeedReady(page) {
  await page.getByTestId('community-feed').waitFor();
  await page.getByTestId('community-discovery-runtime-filters').waitFor();
}

/** 解析可见结果数（纯整数，绝不依赖脆弱 fixture 总数）。 */
async function readCount(page) {
  const el = page.getByTestId('community-runtime-result-count');
  await el.waitFor();
  const text = (await el.textContent()) ?? '';
  const value = Number.parseInt(text, 10);
  assert(Number.isInteger(value), `result count is not an integer: ${JSON.stringify(text)}`);
  return value;
}

async function assertNoOverflow(page, width, tag) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    metrics.scrollWidth <= metrics.width + 1,
    `horizontal overflow ${JSON.stringify(metrics)} @ ${width} (${tag})`,
  );
}

async function screenshot(page, name) {
  const file = path.join(shotsDir, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** touch 视口用 tap，桌面用 click。 */
async function pressOrTap(page, locator, touch) {
  if (touch) await locator.tap();
  else await locator.click();
}

// ---------------------------------------------------------------------------
// 场景 1 · 主浏览精确顺序与标签
// ---------------------------------------------------------------------------
async function scenarioPrimaryOrder(page, vp) {
  const tag = 'primary-order';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  const buttons = page.getByTestId('community-browse-primary').locator('button');
  const count = await buttons.count();
  assert(count === 5, `${tag}: primary count ${count} != 5 @ ${vp.width}`);
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(await buttons.nth(i).getAttribute('data-testid'));
    const label = ((await buttons.nth(i).textContent()) ?? '').trim();
    assert(label !== '', `${tag}: empty label at index ${i} @ ${vp.width}`);
  }
  assert(
    JSON.stringify(ids) === JSON.stringify(EXPECTED_PRIMARY.map((id) => `browse-primary-${id}`)),
    `${tag}: order mismatch ${JSON.stringify(ids)} @ ${vp.width}`,
  );
  return { ids, labelCount: count };
}

// ---------------------------------------------------------------------------
// 场景 2 · recommended 次行恰好 8 个可见频道（无 Following / 关注新作）
// ---------------------------------------------------------------------------
async function scenarioRecommendedChannels(page, vp) {
  const tag = 'recommended-channels';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  const buttons = page.getByTestId('community-browse-secondary').locator('button');
  const count = await buttons.count();
  assert(count === 8, `${tag}: recommended secondary count ${count} != 8 @ ${vp.width}`);
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(await buttons.nth(i).getAttribute('data-testid'));
    const label = ((await buttons.nth(i).textContent()) ?? '').trim();
    assert(label !== '', `${tag}: empty channel label at index ${i} @ ${vp.width}`);
  }
  assert(
    JSON.stringify(ids) ===
      JSON.stringify(EXPECTED_RECOMMENDED_CHANNELS.map((id) => `browse-topic-${id}`)),
    `${tag}: channel order mismatch ${JSON.stringify(ids)} @ ${vp.width}`,
  );
  assert(
    (await page.getByTestId('browse-topic-following').count()) === 0,
    `${tag}: following topic present @ ${vp.width}`,
  );
  assert(
    (await page
      .getByTestId('community-browse-secondary')
      .getByRole('button', { name: /关注新作|Following/ })
      .count()) === 0,
    `${tag}: Following/关注新作 button present @ ${vp.width}`,
  );
  return { ids, channelCount: count };
}

// ---------------------------------------------------------------------------
// 场景 3 · 全部动作目标 >=44px；代表性 icon-only 目标宽高 >=44
// ---------------------------------------------------------------------------
async function scenarioTouchTargets(page, vp) {
  const tag = 'touch-targets';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  // 打开筛选抽屉，让面板内动作目标进入 DOM。
  await page.getByTestId('community-runtime-filter-toggle').click();
  await page.locator('#community-runtime-filter-panel').waitFor();
  // 选择 length:short，让 icon-only 的 chip 移除按钮存在。
  await page.getByTestId('runtime-filter-length:short').click();
  await waitForSearchParams(page, { length: ['length:short'] });
  await page.getByTestId('selected-condition-length:short').waitFor();

  const sizes = await page.evaluate(() => {
    const targets = [
      ...document.querySelectorAll('[data-testid^="browse-primary-"], [data-testid^="browse-topic-"]'),
      ...document.querySelectorAll('[data-testid="community-discovery-runtime-filters"] button'),
    ];
    return targets.map((el) => ({
      id:
        el.getAttribute('data-testid') ??
        ((el.textContent ?? '').trim().slice(0, 24) || 'unknown'),
      h: el.offsetHeight,
      w: el.offsetWidth,
    }));
  });
  assert(sizes.length >= 10, `${tag}: too few targets measured (${sizes.length}) @ ${vp.width}`);
  for (const target of sizes) {
    assert(target.h >= 44, `${tag}: ${target.id} height ${target.h} < 44 @ ${vp.width}`);
  }
  const remove = await page
    .getByTestId('remove-condition-length:short')
    .evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
  assert(
    remove.w >= 44 && remove.h >= 44,
    `${tag}: icon-only remove target ${JSON.stringify(remove)} < 44 @ ${vp.width}`,
  );

  // 清理：移除 chip 并关闭抽屉，回到默认状态。
  await page.getByTestId('remove-condition-length:short').click();
  await waitForSearchParams(page, {}, ['length']);
  await page.getByTestId('community-runtime-filter-toggle').click();
  await page.locator('#community-runtime-filter-panel').waitFor({ state: 'detached' });
  return { measured: sizes.length, iconOnlyRemove: remove };
}

// ---------------------------------------------------------------------------
// 场景 4 · 键盘可达性 + 指针点击 Style
// ---------------------------------------------------------------------------
async function scenarioKeyboardFocus(page, vp) {
  const tag = 'keyboard-focus';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);

  const shape = page.getByTestId('browse-primary-shape');
  await shape.focus();
  await page.keyboard.press('Enter');
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:almond'] });
  assert(
    (await shape.getAttribute('aria-pressed')) === 'true',
    `${tag}: shape primary not pressed after Enter @ ${vp.width}`,
  );
  const active = await page.evaluate(
    () => document.activeElement?.getAttribute('data-testid') ?? null,
  );
  assert(active === 'browse-primary-shape', `${tag}: focus lost after Enter (${active}) @ ${vp.width}`);

  // 键盘选择 shape topic（browse-topic-shape:oval）。
  const oval = page.getByTestId('browse-topic-shape:oval');
  await oval.focus();
  await page.keyboard.press('Enter');
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:oval'] });
  assert(
    (await oval.getAttribute('aria-pressed')) === 'true',
    `${tag}: shape:oval topic not pressed after Enter @ ${vp.width}`,
  );

  // 指针点击 Style。
  await page.getByTestId('browse-primary-style').click();
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });
  return { keyboardTopic: 'shape:oval', pointerBrowse: 'style' };
}

// ---------------------------------------------------------------------------
// 场景 5 · 会话记忆 + Back 恢复上一个可分享状态/计数
// ---------------------------------------------------------------------------
async function scenarioSessionMemory(page, vp) {
  const tag = 'session-memory';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);

  await page.getByTestId('browse-primary-shape').click();
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:almond'] });
  await page.getByTestId('browse-topic-shape:oval').click();
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:oval'] });
  const shapeOvalCount = await readCount(page);

  // 切到 style 并选择 style:minimal-clean。
  await page.getByTestId('browse-primary-style').click();
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });
  await page.getByTestId('browse-topic-style:minimal-clean').click();
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });

  // 切回 shape → 会话记忆恢复 shape:oval（不是默认 shape:almond）。
  await page.getByTestId('browse-primary-shape').click();
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:oval'] });
  assert(
    (await readCount(page)) === shapeOvalCount,
    `${tag}: shape:oval count changed (${shapeOvalCount}) after memory restore @ ${vp.width}`,
  );

  // 切回 style → 记忆恢复 style:minimal-clean。
  await page.getByTestId('browse-primary-style').click();
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });

  // 浏览器 Back 恢复上一个可分享状态（shape:oval）与计数。
  await page.goBack();
  await waitForSearchParams(page, { browse: ['shape'], topic: ['shape:oval'] });
  assert(
    (await readCount(page)) === shapeOvalCount,
    `${tag}: Back count mismatch (${shapeOvalCount}) @ ${vp.width}`,
  );
  await assertNoOverflow(page, vp.width, tag);
  return { shapeOvalCount, memoryRestored: true };
}

// ---------------------------------------------------------------------------
// 场景 6 · touch 用 tap / 桌面用 click 完成 Theme 次行切换并返回 recommended
// ---------------------------------------------------------------------------
async function scenarioThemeTransition(page, vp) {
  const tag = 'theme-transition';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);

  await pressOrTap(page, page.getByTestId('browse-primary-theme'), vp.touch);
  await waitForSearchParams(page, { browse: ['theme'], topic: ['theme:art-museum'] });
  await pressOrTap(page, page.getByTestId('browse-topic-theme:floral-plants'), vp.touch);
  await waitForSearchParams(page, { browse: ['theme'], topic: ['theme:floral-plants'] });
  await pressOrTap(page, page.getByTestId('browse-primary-recommended'), vp.touch);
  await waitForEmptySearch(page);
  return { method: vp.touch ? 'tap' : 'click' };
}

// ---------------------------------------------------------------------------
// 场景 7 · 390 次行滚动结构；其它视口整页无溢出
// ---------------------------------------------------------------------------
async function scenarioSecondaryOverflow(page, vp) {
  const tag = 'secondary-overflow';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  await pressOrTap(page, page.getByTestId('browse-primary-style'), vp.touch);
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });

  let before = null;
  let scrollLeftAfter = null;
  if (vp.width === 390) {
    before = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="community-browse-secondary"]');
      return el
        ? {
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            scrollLeft: el.scrollLeft,
          }
        : null;
    });
    assert(
      before && before.clientWidth < before.scrollWidth,
      `${tag}: secondary not overflowing @ 390 ${JSON.stringify(before)}`,
    );
    scrollLeftAfter = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="community-browse-secondary"]');
      el.scrollLeft = 300;
      return el.scrollLeft;
    });
    assert(
      scrollLeftAfter > before.scrollLeft,
      `${tag}: programmatic scrollLeft did not increase (${before.scrollLeft} -> ${scrollLeftAfter}) @ 390`,
    );
  }
  await assertNoOverflow(page, vp.width, tag);
  return {
    clientWidth: before?.clientWidth ?? null,
    scrollWidth: before?.scrollWidth ?? null,
    scrollLeft: scrollLeftAfter,
  };
}

// ---------------------------------------------------------------------------
// 场景 8 · 兼容辅助筛选（chip / 单条移除 / clear-all / 结果数 / 无 no-op）
// ---------------------------------------------------------------------------
async function scenarioAuxiliaryFilters(page, vp) {
  const tag = 'auxiliary-filters';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  const defaultCount = await readCount(page);
  assert(
    (await page.getByTestId('community-runtime-clear-all').count()) === 0,
    `${tag}: no-op clear-all visible at default @ ${vp.width}`,
  );

  // 打开抽屉，选择 length:short → chip 可见 + URL 精确（仅 length 参数）。
  await page.getByTestId('community-runtime-filter-toggle').click();
  await page.locator('#community-runtime-filter-panel').waitFor();
  await page.getByTestId('runtime-filter-length:short').click();
  await waitForSearchParams(page, { length: ['length:short'] });
  await page.getByTestId('selected-condition-length:short').waitFor();
  const afterLengthCount = await readCount(page);
  const keysAfterLength = [...paramsOf(page.url()).keys()];
  assert(
    keysAfterLength.length === 1 && keysAfterLength[0] === 'length',
    `${tag}: URL not exact after length:short ${JSON.stringify(keysAfterLength)} @ ${vp.width}`,
  );

  // 移除单条 chip → 只移除 length（URL 回默认）。
  await page.getByTestId('remove-condition-length:short').click();
  await waitForSearchParams(page, {}, ['length']);
  assert(
    (await page.getByTestId('selected-condition-length:short').count()) === 0,
    `${tag}: length chip still visible after remove @ ${vp.width}`,
  );
  assert(
    [...paramsOf(page.url()).keys()].length === 0,
    `${tag}: URL not default after chip remove @ ${vp.width}`,
  );

  // rights:original → clear-all 可见 → 点击 → 默认 URL/browse、chip 消失。
  await page.getByTestId('runtime-filter-rights:original').click();
  await waitForSearchParams(page, { rights: ['rights:original'] });
  await page.getByTestId('selected-condition-rights:original').waitFor();
  const clearAll = page.getByTestId('community-runtime-clear-all');
  assert(
    (await clearAll.count()) === 1,
    `${tag}: clear-all not visible with rights selected @ ${vp.width}`,
  );
  const afterRightsCount = await readCount(page);
  await clearAll.click();
  await waitForEmptySearch(page);
  assert(
    (await page.getByTestId('selected-condition-rights:original').count()) === 0,
    `${tag}: rights chip remains after clear-all @ ${vp.width}`,
  );
  assert(
    (await page.getByTestId('community-runtime-clear-all').count()) === 0,
    `${tag}: no-op clear-all visible after clear @ ${vp.width}`,
  );
  assert(
    (await page.getByTestId('browse-primary-recommended').getAttribute('aria-pressed')) === 'true',
    `${tag}: browse not back to recommended after clear-all @ ${vp.width}`,
  );
  assert(
    (await readCount(page)) === defaultCount,
    `${tag}: count not restored after clear-all (${defaultCount}) @ ${vp.width}`,
  );
  await assertNoOverflow(page, vp.width, tag);
  return { defaultCount, afterLengthCount, afterRightsCount };
}

// ---------------------------------------------------------------------------
// 场景 9 · 卡片不变量（pills<=6 / style 浏览首 pill / rights badge）
// ---------------------------------------------------------------------------
async function assertCardInvariants(page, width, tag, { styleBrowse }) {
  const cards = page.getByTestId('community-look-card');
  const n = await cards.count();
  for (let i = 0; i < n; i += 1) {
    const card = cards.nth(i);
    const pills = card.locator('[data-testid^="community-discovery-tag-"]');
    const pillCount = await pills.count();
    assert(pillCount <= 6, `${tag}: card ${i} has ${pillCount} pills > 6 @ ${width}`);
    if (styleBrowse) {
      // 任何含 style tag 的卡片，其首个 pill 必须是 style: 开头（browse 维度优先）。
      const hasStylePill =
        (await card.locator('[data-testid^="community-discovery-tag-"][data-tag-id^="style:"]').count()) > 0;
      if (hasStylePill) {
        const firstId = await pills.first().getAttribute('data-tag-id');
        assert(
          firstId !== null && firstId.startsWith('style:'),
          `${tag}: card ${i} first pill ${firstId} not style: on style browse @ ${width}`,
        );
      }
    }
    const badge = card.getByTestId('community-rights-badge');
    assert((await badge.count()) === 1, `${tag}: card ${i} missing rights badge @ ${width}`);
    const status = await badge.getAttribute('data-rights-status');
    assert(status !== null && status.length > 0, `${tag}: card ${i} empty rights status @ ${width}`);
  }
  return n;
}

async function scenarioCards(page, vp) {
  const tag = 'cards';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  const cardCount = await assertCardInvariants(page, vp.width, tag, { styleBrowse: false });
  assert(cardCount > 0, `${tag}: no cards on default home @ ${vp.width}`);

  await page.getByTestId('browse-primary-style').click();
  await waitForSearchParams(page, { browse: ['style'], topic: ['style:minimal-clean'] });
  const styleCardCount = await assertCardInvariants(page, vp.width, tag, { styleBrowse: true });
  assert(styleCardCount > 0, `${tag}: no cards on style:minimal-clean browse @ ${vp.width}`);
  return { cardCount, styleCardCount };
}

// ---------------------------------------------------------------------------
// 场景 10 · 详情：canonical 链接 → 结构化 group 顺序 / 徽章 → goBack
// ---------------------------------------------------------------------------
async function scenarioDetail(page, vp) {
  const tag = 'detail';
  await page.goto(`${rootUrl}/`);
  await waitFeedReady(page);
  const cards = page.getByTestId('community-look-card');
  assert((await cards.count()) > 0, `${tag}: no cards to open @ ${vp.width}`);

  // canonical 详情链接 = 卡片标题链接（h3 a）。
  await cards.first().locator('h3 a').click();
  await page.getByTestId('community-look-page').waitFor();
  await page.getByTestId('community-discovery-detail').waitFor();
  const lookUrl = page.url();

  const groupTestIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((el) => el.getAttribute('data-testid') ?? '')
      .filter((id) => /^community-discovery-group-[A-Z]+$/.test(id)),
  );
  const observed = groupTestIds.map((id) => id.replace('community-discovery-group-', ''));
  assert(observed.length > 0, `${tag}: no structured groups @ ${vp.width}`);
  for (const dim of observed) {
    assert(DETAIL_GROUP_ORDER.includes(dim), `${tag}: unexpected group ${dim} @ ${vp.width}`);
  }
  for (let i = 1; i < observed.length; i += 1) {
    assert(
      DETAIL_GROUP_ORDER.indexOf(observed[i]) > DETAIL_GROUP_ORDER.indexOf(observed[i - 1]),
      `${tag}: group order violation ${JSON.stringify(observed)} @ ${vp.width}`,
    );
  }
  for (const dim of observed) {
    const tagCount = await page
      .getByTestId(`community-discovery-group-${dim}`)
      .locator('[data-tag-id]')
      .count();
    assert(tagCount >= 1, `${tag}: group ${dim} has no tags @ ${vp.width}`);
  }
  const rights = page.getByTestId('community-rights-badge');
  assert((await rights.count()) === 1, `${tag}: detail rights badge missing @ ${vp.width}`);
  const rightsStatus = await rights.getAttribute('data-rights-status');
  assert(rightsStatus !== null && rightsStatus.length > 0, `${tag}: detail rights status empty @ ${vp.width}`);
  assert(
    (await page.getByTestId('community-makeability-badge').count()) === 1,
    `${tag}: detail makeability badge missing @ ${vp.width}`,
  );

  let shot = null;
  if (vp.width === 390 || vp.width === 1440) {
    shot = await screenshot(page, `detail-${vp.width}.png`);
  }

  await page.goBack();
  await waitFeedReady(page);
  await assertNoOverflow(page, vp.width, tag);
  return { groups: observed, lookUrl, screenshot: shot };
}

// ---------------------------------------------------------------------------
// 反馈场景（1440 单次）
// ---------------------------------------------------------------------------

/** F1 · `/?color=red`：不兼容 + invalid-link + count 0，绝无通用清除按钮。 */
async function feedbackInvalidLink(page, consoleErrors, pageErrors) {
  const tag = 'feedback-invalid-link';
  const detail = { name: tag, status: 'fail', counts: {}, consoleErrors: [], pageErrors: [] };
  try {
    await page.goto(`${rootUrl}/?color=red`);
    await waitFeedReady(page);
    await page.getByTestId('community-incompatible-filters').waitFor();
    await page.getByTestId('community-feed-feedback-invalid-link').waitFor();
    const before = await readCount(page);
    assert(before === 0, `${tag}: count ${before} != 0`);
    const clearButtons = await page
      .getByTestId('community-feed-empty')
      .getByRole('button', { name: /清除筛选|Clear filters/ })
      .count();
    assert(clearButtons === 0, `${tag}: Clear filters button inside empty state`);
    // 显式移除不兼容 color → 默认 URL，结果恢复。
    await page.getByTestId('remove-incompatible-color').click();
    await waitForSearchParams(page, {}, ['color']);
    const after = await readCount(page);
    assert(after > 0, `${tag}: count ${after} not > 0 after explicit removal`);
    detail.counts = { before, after };
    detail.status = 'pass';
  } catch (error) {
    detail.error = error.message;
    await page
      .screenshot({ path: path.join(shotsDir, 'failure-feedback-invalid-link.png'), fullPage: true })
      .catch(() => {});
  }
  detail.consoleErrors = [...consoleErrors];
  detail.pageErrors = [...pageErrors];
  return detail;
}

/** F2 · `/?rights=rights%3Apending`：rights-restricted + count 0，兼容清除解决。 */
async function feedbackRightsPending(page, consoleErrors, pageErrors) {
  const tag = 'feedback-rights-pending';
  const detail = { name: tag, status: 'fail', counts: {}, consoleErrors: [], pageErrors: [] };
  try {
    await page.goto(`${rootUrl}/?rights=rights%3Apending`);
    await waitFeedReady(page);
    const feedback = page.getByTestId('community-feed-feedback-rights-restricted');
    await feedback.waitFor();
    const before = await readCount(page);
    assert(before === 0, `${tag}: count ${before} != 0`);
    await page.getByTestId('selected-condition-rights:rights:pending').waitFor();
    const clearButton = feedback.getByRole('button', { name: /清除筛选|Clear filters/ });
    assert((await clearButton.count()) === 1, `${tag}: compatible clear button missing`);
    await clearButton.click();
    await waitForEmptySearch(page);
    assert(
      (await page.getByTestId('selected-condition-rights:rights:pending').count()) === 0,
      `${tag}: rights chip remains after clear @ 1440`,
    );
    const after = await readCount(page);
    assert(after > 0, `${tag}: count ${after} not > 0 after clear`);
    detail.counts = { before, after };
    detail.status = 'pass';
  } catch (error) {
    detail.error = error.message;
    await page
      .screenshot({ path: path.join(shotsDir, 'failure-feedback-rights-pending.png'), fullPage: true })
      .catch(() => {});
  }
  detail.consoleErrors = [...consoleErrors];
  detail.pageErrors = [...pageErrors];
  return detail;
}

/** F3 · taxonomy-v2 加载失败：fresh context route 500 → load-failed + Retry。 */
async function feedbackLoadFailure(context) {
  const tag = 'feedback-load-failure';
  const detail = { name: tag, status: 'fail', counts: {}, consoleErrors: [], pageErrors: [] };
  let page = null;
  try {
    await context.route('**/community/taxonomy-v2.json', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced-taxonomy-500' }),
      }),
    );
    page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') detail.consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => detail.pageErrors.push(error.message));
    await page.goto(`${rootUrl}/`);
    await page.getByTestId('community-feed-feedback-load-failed').waitFor();
    const retry = page.getByRole('button', { name: /重试|Retry/ });
    assert((await retry.count()) === 1, `${tag}: Retry button missing @ 1440`);
    // route 仍失败时绝不点击 Retry。
    detail.status = 'pass';
  } catch (error) {
    detail.error = error.message;
    if (page) {
      await page
        .screenshot({ path: path.join(shotsDir, 'failure-feedback-load-failure.png'), fullPage: true })
        .catch(() => {});
    }
  }
  return detail;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true });
console.log(`[${TAG}] browser launched, base=${rootUrl}`);
console.log(`[${TAG}] evidence dir=${evidenceDir}`);
const report = {
  meta: {
    tag: TAG,
    baseUrl: rootUrl,
    evidenceDir,
    ranAt: new Date().toISOString(),
    script: 'tools/walkthrough-community-tax-04-home-ui.mjs',
  },
  viewports: [],
  feedback: [],
};
let failed = false;

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
    });
    let page = null;
    const entry = {
      viewport: vp.width,
      touch: vp.touch,
      status: 'pass',
      scenarios: [],
      counts: {},
      overflow: 'ok',
      consoleErrors: [],
      pageErrors: [],
      screenshots: {},
    };
    try {
      page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error') entry.consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => entry.pageErrors.push(error.message));

      // 稳定默认首页 + 视口截图 + 默认计数。
      await page.goto(`${rootUrl}/`);
      await waitFeedReady(page);
      entry.screenshots.home = await screenshot(page, `home-${vp.width}.png`);
      const homeCount = await readCount(page);
      entry.counts.defaultHome = homeCount;
      assert(homeCount > 0, `default home has no cards @ ${vp.width}`);

      const runs = [
        ['primary-order', () => scenarioPrimaryOrder(page, vp)],
        ['recommended-channels', () => scenarioRecommendedChannels(page, vp)],
        ['touch-targets', () => scenarioTouchTargets(page, vp)],
        ['keyboard-focus', () => scenarioKeyboardFocus(page, vp)],
        ['session-memory', () => scenarioSessionMemory(page, vp)],
        ['theme-transition', () => scenarioThemeTransition(page, vp)],
        ['secondary-overflow', () => scenarioSecondaryOverflow(page, vp)],
        ['auxiliary-filters', () => scenarioAuxiliaryFilters(page, vp)],
        ['cards', () => scenarioCards(page, vp)],
        ['detail', () => scenarioDetail(page, vp)],
      ];
      for (const [name, fn] of runs) {
        try {
          const result = (await fn()) ?? {};
          entry.scenarios.push({ name, status: 'pass', ...result });
          if (result.screenshot) entry.screenshots.detail = result.screenshot;
          console.log(`[${TAG}] ${name} PASS @ ${vp.width}`);
        } catch (error) {
          failed = true;
          entry.status = 'fail';
          const shot = path.join(shotsDir, `failure-${vp.width}-${name}.png`);
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          entry.scenarios.push({ name, status: 'fail', error: error.message, screenshot: shot });
          console.error(`[${TAG}] ${name} FAILED @ ${vp.width} screenshot=${shot}\n    ${error.message}`);
        }
      }

      // 核心场景全部通过后才做整页溢出终检与运行时错误判定。
      if (entry.scenarios.every((s) => s.status === 'pass')) {
        await assertNoOverflow(page, vp.width, 'post-core');
      } else {
        entry.overflow = 'skipped-after-failure';
      }
      if (entry.pageErrors.length > 0) {
        failed = true;
        entry.status = 'fail';
        console.error(`[${TAG}] page errors @ ${vp.width}: ${JSON.stringify(entry.pageErrors)}`);
      }
      if (entry.consoleErrors.length > 0) {
        failed = true;
        entry.status = 'fail';
        console.error(`[${TAG}] console errors @ ${vp.width}: ${JSON.stringify(entry.consoleErrors)}`);
      }
      report.viewports.push(entry);
      console.log(`[${TAG}] completed ${vp.width} (${entry.status})`);
    } catch (error) {
      failed = true;
      entry.status = 'fail';
      const shot = path.join(shotsDir, `failure-${vp.width}-viewport.png`);
      if (page) await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      entry.screenshots.failure = shot;
      report.viewports.push(entry);
      console.error(`[${TAG}] failure @ ${vp.width} screenshot=${shot}\n    ${error.message}`);
    } finally {
      await context.close();
    }
  }

  // 反馈场景（1440-only，独立 context 避免状态串扰）。
  const feedbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    let feedbackPage = await feedbackContext.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    feedbackPage.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    feedbackPage.on('pageerror', (error) => pageErrors.push(error.message));
    report.feedback.push(await feedbackInvalidLink(feedbackPage, consoleErrors, pageErrors));
    report.feedback.push(await feedbackRightsPending(feedbackPage, consoleErrors, pageErrors));
    await feedbackPage.close();
  } finally {
    await feedbackContext.close();
  }

  const loadContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const result = await feedbackLoadFailure(loadContext);
    report.feedback.push(result);
    if (result.status !== 'pass') failed = true;
  } finally {
    await loadContext.close();
  }

  if (report.feedback.some((f) => f.status !== 'pass')) failed = true;
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(evidenceDir, 'walkthrough-report.json'),
  JSON.stringify(report, null, 2),
);
console.log(`[${TAG}] report written to ${path.join(evidenceDir, 'walkthrough-report.json')}`);

if (failed) {
  console.error(`[${TAG}] FAIL ${JSON.stringify(report)}`);
  process.exitCode = 1;
} else {
  console.log(`[${TAG}] PASS ${JSON.stringify(report)}`);
}
