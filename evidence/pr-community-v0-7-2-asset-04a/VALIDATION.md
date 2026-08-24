# COMM-ASSET-04A｜Community Home 运营配置合同与诚实空态验证

状态：`READY (branch-code) / prototype`（Branch B 本地 checkpoint；未合入 main、未 push）

## 本 checkpoint 完成内容

- 新增 strict exact-key `COMM-v0.7.2-ASSET-04A` 配置合同，状态为 `AWAITING_INPUT / IN_REVIEW / PUBLISHED`。
- Banner、编辑精选 Look、集合、双语编辑理由、owner、review time 与 evidence refs 均为显式字段；unknown key、重复 Look/rank/collection、unsafe URL 与状态证据错配失败关闭。
- `PUBLISHED` 内容引用必须同时存在于治理后的公开 Look read model 与 ASSET-03 capability index；缺 Look、缺 capability 或版权不公开时整块不可用，不部分放宽。
- Community 编辑精选与 Studio Official Starter Shelf 在 UI 中明确为两个产品面；不复制 Quick Start 库。
- 当前 checked-in 配置诚实保持 `AWAITING_INPUT`：不虚构 Banner、编辑精选、集合、热门、个性化或编辑理由；完整五入口发现 Feed 继续可用。
- 配置加载/校验失败显示可见降级；Banner 未配置和图片加载失败均有独立 fallback。

## 当前结果与剩余边界

- 本 checkpoint 是 `ASSET-04A contract + truthful empty/failure UI`，不是完整 `ASSET-04` 运营内容交付。
- `ASSET-04B` 仍需 Marketing / Community owner 提供并签收 Banner、精选 Look ID/顺序、集合和双语编辑理由；没有这些输入不能把配置改为 `PUBLISHED`。
- 25/25 asset governance rights 仍为 `PENDING`、promotion 仍为 `BLOCKED`；本 PR 不开放 Official Starter Shelf。
- 不写 Wizard、Editor store 或 EditorDoc；不新增推荐模型、登录服务、论坛或制造能力。

## 浏览器证据

- 视口：390、768、1024、1280、1366、1440 px。
- 6/6 均显示 `AWAITING_INPUT` 诚实空态，15 条治理后公开 Feed 保持可浏览。
- 配置 HTTP 失败时显示可见错误，15 条 Feed 不被隐藏。
- 所有视口无整页横向溢出、无 console error、无 page error。
- Codex 已检查 390 / 1280 px 等待态与 1280 px 失败态截图，未发现阻断性布局问题；不替代 Marketing / Design owner 签收。

证据：

- `walkthrough-report.json`
- `screenshots/awaiting-input-390.png`
- `screenshots/awaiting-input-1280.png`
- `screenshots/config-failure-1280.png`

## 已执行门禁

```text
npm run test:community-home-merchandising
PASS（strict config、empty/review/published、governed Look/capability ref、fail closed）

npm run test:community-asset-capability
PASS（24/24）

npm run test:community-asset-capability-ui
PASS

npm run test:community-content-states
PASS

npm run test:community-tax-04-home-ui
PASS（49 passed，0 failed）

npm run test:community-v7-1-explore-search
PASS

npm run test:community-home-merchandising:e2e
PASS（6 viewports；truthful awaiting-input；config failure；feed preserved）

BASE_URL=http://127.0.0.1:5261 npm run test:community-content-states:e2e
PASS

npm run typecheck
PASS

npm run build
PASS（Vite chunk size warning 为既有提示）

npm run build:integration
PASS

git diff --check
PASS
```

## 合入裁决

- 当前代码 checkpoint 可提交到 Branch B。
- 不得把 `04A READY(branch-code)` 写成 `ASSET-04 fully delivered`、`PUBLISHED` 或 Marketing/Design 已签收。
- 在 ASSET-04B 输入到位前，下一步可继续构建 ASSET-05 的矩阵/回滚/Handoff 骨架，但最终 owner close 必须保持 `Unknown / blocked by owner input`。
