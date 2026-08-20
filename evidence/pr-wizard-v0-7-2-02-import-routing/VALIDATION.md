# WIZ-02｜Canonical Import Routing

状态：`validated-on-branch` / `local prototype`

## 交付边界

- Canonical `VersionedStudioImportIntentV2` 进入独立 `/studio/design/import` Import Preflight。
- `/studio/design/new?versionedIntent=...` 在 `WizardPage` 挂载前 replace 到新路由，并保留完整 query/hash。
- Import Preflight 不依赖 Wizard store/draft；`current` 与 `cancel` 仅清除 intent，`new` 由既有 versioned-import consumer 创建独立 `EditorDocV7`。
- 失败状态（过期、权限变化、版本/SHA、资产、十指 geometry、依赖）可见且 fail closed。
- Import adapter/storage 异常可见为可重试错误；Look creatorProfileId 与 intent sourceCreatorProfileId 不一致时清理意图并阻断。
- 失败/无效页的“返回 Community”先安全清除 intent，清除失败不导航并保留可重试状态；来源展示始终使用 intent 的 sourceCreatorProfileId。
- Legacy `communityIntent` 仍由 Quick Start `/studio/design/new` 处理，本 PR 不收缩 Quick Start UI。

## 验证命令

```text
npm run test:wizard-v0-7-2-import-routing  PASS
npm run test:studio-v7-1-versioned-import  PASS (creator lineage mismatch included)
npm run test:community-v7-1-use-customize  PASS
npm run typecheck                          PASS
npm run build                              PASS
npm run build:integration                  PASS
COMMUNITY_V7_E2E_OUTPUT=evidence/pr-wizard-v0-7-2-02-import-routing/e2e node tools/e2e-community-v7-1-use-customize.mjs  PASS (390/768/1024/1280/1440)
git diff --check                           PASS
```

## 证据与边界

- 已实现并以专项脚本覆盖 route/page 边界、Wizard 零依赖、old-link redirect、三动作、来源字段和严格失败文案。
- 真实浏览器 combined E2E 已输出至 `evidence/pr-wizard-v0-7-2-02-import-routing/e2e/`，覆盖 390、768、1024、1280、1440px，结果 PASS。
- `VersionedStudioImportIntentV2`、`PublishedLookV1`、`DesignVersionV1`、`EditorDocV7/schemaVersion: 7` 未修改。
- 这是本地原型集成证据，不代表远端跨设备分享、生产权限、制造确认或部署完成。
- 本验证记录不等同于用户签收。
