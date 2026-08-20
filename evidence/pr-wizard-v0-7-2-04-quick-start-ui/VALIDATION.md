# WIZ-04｜Quick Start UI 验证

日期：2026-08-20
分支：`codex/wizard-v0-7-2-04-quick-start-ui`
基线：`f8c3fa8`
证据等级：`LOCAL_PROTOTYPE` / `simulated`

## 结论

WIZ-04 的实现、静态回归、构建与本地浏览器 E2E 均通过。Luna 对完整 diff、Quick Start 六档证据、固定版本六档证据、Community Canonical 五档证据及 Legacy 增量证据完成两轮只读复核；结论为 `CONDITIONAL PASS`，条件仅涉及必须保留的证据边界，不存在可复现功能阻断。

## 已完成范围

- 用户可见 Wizard 收缩为“快速建稿”；保留客户上下文、甲型/长度、官方模板、底色/封层、逐指底色、草稿恢复、保存失败、Editor 预检与交接。
- 移除活动风格推荐、Wizard 内 Community 浏览入口、重复模板页、复杂装饰 writer、保存后确认引导及新的 `markConfirmed` 写入口。
- `/studio/design/templates` 显式迁移到 Quick Start 官方模板面板；危险的 `fresh/versionedIntent` 不透传。
- 历史 `DesignSummary.confirmation` 只读显示为“历史本地确认 · 非固定版本”；正式状态采用 authority-first `ApprovalEventV1 + ConfirmedDesignSnapshotV7` 投影，损坏 authority 不回退 legacy。
- Editor 顾客预览创建固定版本分享后，在十指总览与单指聚焦中都显示全局成功/失败状态；分享页使用 canonical `/share/:token`。
- Legacy live adapter 现在完整透传 `exactAsset + communitySourceRef`；此前浏览器路径会丢来源与 SHA 的缺陷已由新增 E2E 发现并修复。
- 顾客展示层补齐 portal、`aria-modal`、underlay inert、Esc、Tab/Shift+Tab trap、焦点恢复和 44px 关闭目标。

## 命令门禁

```text
npm run test:wizard-v0-7-2-provenance             PASS
npm run test:wizard-v0-7-2-import-routing         PASS
npm run test:wizard-v0-7-2-fixed-approval         PASS
npm run test:wizard-v0-7-2-quick-start            PASS
npm run test:wizard-v7-flow                       PASS
npm run test:wizard-canvas-first                  PASS
npm run test:product-surfaces                     PASS
npm run test:template-gallery-hq                  PASS
npm run test:pr05-recommendations                 PASS
npm run test:pr05-wizard-v6                       PASS
npm run test:community-studio-flow                PASS
npm run test:community-v7-1-use-customize         PASS
npm run test:community-v7-1-publish-creator       PASS
npm run test:studio-v7-1-client-approval          PASS
npm run test:editor-v7-customer-preview           PASS
npm run test:gen-v7-1-04-backend-ports            PASS
npm run requirements:refresh                      PASS（33 fingerprints）
npm run requirements:audit                        PASS（40 modules / 33 source refs / 36 DOM ids）
npm run typecheck                                 PASS
npm run build                                     PASS
npm run build:integration                         PASS
git diff --check                                  PASS
```

## 浏览器证据

- `combined-e2e/`：Quick Start 在 390、768、1024、1280、1366、1440px 全部通过；无整页横向溢出、无 console/page error，导航/抽屉完成焦点进入、Tab/Shift+Tab trap、恢复及 44px 触控目标验证。
- `fixed-approval-e2e/`：六档全部通过；每次读取 1 张十指封面 + 10 张逐指 PNG。390/1024/1280/1440 为 APPROVED 并创建 Snapshot；768/1366 为 CHANGE_REQUESTED 且不创建 Snapshot；Editor storage writer-zero。
- `community-import-e2e/`：Canonical Look → Import Preflight → 独立 Editor 在 390/768/1024/1280/1440px 通过；390/768 使用实际 `tap`，桌面使用 click；Current/Cancel 不产生误消费事件。
- `legacy-e2e/`：390/1280 有效 Legacy intent 进入 Quick Start，来源、assetVersion 及完整 `AssetRefV7`（revision/SHA/mimeType）保留；390 的 `assetVersion=9.9.9` 返回 `asset_mismatch` 且 `applied: false`。

## 证据边界

- Creator 的 publication/discovery/version/asset lineage 由 `test:community-v7-1-publish-creator` 与 `test:community-v7-1-use-customize` 合同覆盖；未宣称完整 Creator UI → Editor 浏览器 E2E。
- Canonical 过期、撤销、损坏、权限变化、版本/SHA 不一致主要由 WIZ-02/WIZ-03 专项矩阵覆盖；Legacy assetVersion mismatch 有浏览器证据，但不能表述为所有失败态都已浏览器复演。
- 当前分享只保证同源本地运行时；没有远端跨设备后端、正式权限、部署或运维证据。
- 预览与确认均为 `LOCAL_PROTOTYPE` / `simulated`，不证明物理样件、制造、生产、付款、履约或正式顾客签收。
