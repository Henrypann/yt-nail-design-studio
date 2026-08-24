# COMM-ASSET-03B｜Community 资产能力卡片与详情呈现验证

状态：`READY (branch) / prototype`（资产运营分支本地实现，尚未合入 main、未 push）

## 本 checkpoint 的边界

- Community 首页卡片与 Look 详情统一消费 `COMM-v0.7.2-ASSET-03A` 严格资产能力读模型。
- Use 状态只来自显式 `cta / capabilityState / permissions`；不再从 legacy `applicationLevel`、`verificationLevel` 或文案推断。
- 卡片可见区分 `版本化可编辑 / 旧版近似应用 / 资产不完整 / 当前不可用`；详情补充 DesignVersion、EditorDoc SHA、preview SHA 与诊断。
- 能力 fixture、taxonomy 或 migration 加载/校验失败时失败关闭：不显示 Use 动作，并提供可见不可用反馈。
- `EXACT` 仅表示版本与 SHA 身份链完整；preview 仍为 `APPROXIMATE`，当前可制作与制造验证均为无证据。
- 本 checkpoint 不生成新资产、不调整首页排序、不推广 Starter Shelf、不写 Wizard / EditorDoc，也不构成视觉、物理或制造签收。

## 浏览器走查

- 视口：390、768、1024、1280、1366、1440 px。
- 卡片与详情覆盖：`VERSIONED_READY`、`LEGACY_APPROXIMATE`、`ASSETS_INCOMPLETE`、`UNAVAILABLE`。
- 失败夹具覆盖：能力证据 HTTP 失败时，详情显示不可用且所有内容相关 Use 动作关闭。
- 所有视口：无整页横向溢出、无 console error、无 page error；版本化与旧版 Use CTA 高度均为 44 px。
- 默认公开 Feed 为 15 条；两条未通过公开治理门禁的记录仍被排除。
- Codex 已检查 390 / 1280 px 首页与详情证据，未发现阻断性布局或状态表达问题；这不替代 Product / Design owner 人工签收。

证据：

- `walkthrough-report.json`
- `screenshots/home-capability-390.png`
- `screenshots/home-capability-1280.png`
- `screenshots/versioned-390.png`
- `screenshots/versioned-1280.png`
- `screenshots/capability-failure-1280.png`

## 执行的验证

```text
npm run test:community-asset-capability
PASS（24/24；5 versioned、2 legacy、7 incomplete、10 unavailable；版权/能力/版本 SHA 失败关闭）

npm run test:community-asset-capability-ui
PASS（严格 browser loader；card/detail CTA 失败关闭；无 legacy 能力推断）

npm run test:community-content-states
PASS

npm run test:community-tax-04-home-ui
PASS（49 passed，0 failed）

npm run test:community-v7-1-explore-search
PASS

npm run test:community-v7-1-look-adapter
PASS

npm run test:community-v7-1-use-customize
PASS

npm run test:community-asset-capability-ui:e2e
PASS（6 viewports；strict card/detail capability；fail-closed fixture failure）

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

## 合入与后续门禁

- 03A + 03B 可作为 Branch B 本地 checkpoint；合入 main 仍需独立 diff 复核和用户授权。
- 资产 rights ledger 仍为 25/25 `PENDING`、promotion `BLOCKED`；本 UI 只展示 Community 现有内容能力，不开放 Official Starter Shelf。
- Petal Pearl 保持 `UNAVAILABLE`，等待甲型覆盖与资产路径签收。
- `COMM-ASSET-04` 仍依赖 Marketing / Banner / Editorial 明确输入；不得用现有概念资产代填正式首页运营位。
