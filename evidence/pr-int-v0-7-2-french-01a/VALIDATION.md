# INT-v0.7.2-FRENCH-01A｜Use Contract & Preflight Validation

状态：`READY(branch-code) / prototype`；父 checkpoint：`f3c556b`；未合入 `main`，未 push。

## 实现

- 新增 strict exact-key `FrenchUseContextV1`，TTL 15 分钟，只存于独立 `sessionStorage` port；不扩展 `VersionedStudioImportIntentV2`、`StudioImportIntentV1`、`EditorDocV7` 或 schemaVersion 7。
- context 只从 `CommunityDiscoveryMetadataV1.techniqueIds` 的精确 `technique:french` 派生；discovery 缺失时 fail closed，标题、旧 tags、画面、application/verification 均不参与推断。
- Canonical V2 成功创建独立 Remix 后才可保存 context；完整 Look import 失败、取消、继续当前草稿、非 French 来源均不创建 context。
- context 重新检查十指 exact/signed geometry 与 French 首批 allowlist；来源 shape/length 与目标不一致时只给 `SOURCE_TARGET_MISMATCH` 诊断，不替换 geometry。
- 固定 claims：`presetInferred=false`、`makeabilityInferred=false`、`manufacturingValidated=false`。context 不携带 preset，也不能创建 recipe 或修改 EditorDoc。
- Import Preflight 可见区分 French declared / not French / discovery unavailable；French 只说明“进入 Editor 后提示打开工具”，不自动添加五种 preset。

## 验证

- `test:int-v0-7-2-french-use-context`：PASS；覆盖 canonical/legacy、non-French、discovery unavailable、shape mismatch、geometry unavailable、strict parser、unknown key、TTL、target lineage、EditorDoc writer-zero 与 V2 exact-key unchanged。
- `test:studio-v7-1-versioned-import`：PASS；expired/permission/release/SHA/asset/geometry/idempotency/cleanup 路由保持原合同。
- `test:community-intent`、`test:community-studio-flow`：PASS；Legacy V1 兼容链未被 V2/French context 改写。
- `test:community-v7-1-use-customize`、Starter preflight、EditorDocV7 contract：PASS。
- `typecheck`、`build`、`build:integration`、`git diff --check`：PASS；仅既有 Vite chunk-size warning。

## 边界

- 本 PR 不自动打开 Editor 工具、不自动新增 French recipe，不改变当前草稿、发布、Approval、rights 或 capability。
- 01B 才负责 Editor 可见提示、定位工具、六视口完整任务流、save/reopen 与 customer preview。
- 所有结果仍为软件原型；无实体、制造或生产声明。
