# WIZ-03｜固定版本顾客确认闭环

状态：`validated-on-branch` / `LOCAL_PROTOTYPE` / `simulated`

分支：`codex/wizard-v0-7-2-03-fixed-approval`

## 已实现

- `StudioApprovalApplicationServiceV1.createFixedVersionShare({ designId, expectedRevision })` 严格读取已持久化 `EditorDocV7`，以 revision 门禁，不写回 EditorDoc。
- 复用 `DesignReleaseV1 → PublishPackageV1 → READY authority → ClientShareLinkV1 → ApprovalEventV1 / ConfirmedDesignSnapshotV7` 既有合同。
- 固定 renderer revision 生成 cover + 十指 detail 共 11 项真实资产；资产读取校验 revision/SHA/mime，并用稳定 data locator 展示。
- 2D renderer 从准确快照读取逐指背景、flat step 数量与 finish，证据仍标记 `APPROXIMATE`。
- 版本化本地 receipt 保留同一 raw token，刷新重试复用同一分享；receipt、authority、资产不一致时 fail closed。
- 分享创建采用 `PENDING → COMMITTED` receipt 两阶段恢复：receipt 写失败时 approval writer-zero；share 写失败时保留 receipt，重试复用同一 token/shareId 恢复。
- Client Share 读取固定资产 read model；APPROVED 才生成 Snapshot，CHANGE_REQUESTED 不生成 Snapshot。
- 固定预览 read model 位于 `platform/backend/fixed-preview-contract.ts`，保持 backend-neutral；Studio 应用服务只实现生成与完整性校验。
- Customer Preview 仅在无临时试色、无 unavailable 内容时显示创建固定版本确认。

## 验证

| 检查 | 结果 |
|---|---|
| `npm run test:wizard-v0-7-2-fixed-approval` | PASS（真实 release/package/authority/asset/receipt 行为、两阶段 receipt 写失败/approval replace 重试恢复、COVER 十指/DETAIL 单指 renderer、revision/receipt/metadata 与实际 bytes/顺序/approve/change/expired/revoked 矩阵、client 决定写入前 preview gate + UI 资产引用检查） |
| `git diff --check` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS（存在既有 chunk size warning） |
| `npm run build:integration` | PASS |
| `test:studio-v7-1-design-release` | PASS |
| `test:studio-v7-1-publish-package` | PASS |
| `test:studio-v7-1-client-approval` | PASS |
| `test:gen-v7-1-backend-ports` | PASS |
| `test:editor-v7-customer-preview` | PASS |

## 边界

- 证据仅为本地原型/模拟渲染；不表示跨设备远端分享、生产权限、制造确认、付款或交付。
- 浏览器运行时使用同源 `data:` 资产 locator；不提供远端 CDN 或跨设备资产服务。
