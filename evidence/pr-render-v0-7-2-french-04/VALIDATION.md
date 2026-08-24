# RENDER-v0.7.2-FRENCH-04 Validation

状态：`prototype / READY(branch-code)`；制造验证：`false`；合入状态：`未合入 main`。

本 candidate 新增只读 `french-render-adapter-v1`。结构化 French 必须经过 strict recipe parse、recipe map key/instance identity、全十指引用完整性、精确 geometry + registry SHA、compiler 与存储 projection parity；任何 revision/SHA/参数/projection/reference drift 返回可见 `unavailable`，不回退到 legacy `widthRatio/curvature`。缺失 recipe 同样 fail closed。无 recipe 的普通 flat step与 legacy French 保持 passthrough。

四个命名消费者统一读取同一 adapter：Editor Flat、Finish Composite、Customer Preview 与 PBR Material Projection。成功结果保留原始 step/element ID，并披露 `exact-source-derived`；PBR 始终标记 `simulated-not-manufacturing`，不代表实物、Boolean、制造或生产验证。

已通过：

- `npm run test:editor-v7-french-renderers`：60 canonical structured cases × 4 个命名消费者，共 240 次 adapter 调用；覆盖十指 identity/projection、普通与 legacy passthrough、revision/projection/recipe/reference/geometry drift、EditorDoc runtime parity 与五相机投影稳定性。
- `npm run test:editor-v7-french-renderers:e2e`：390px 与 1280px 真实产品链路通过；两档均覆盖 Editor Flat、可见 unavailable、Finish Composite、Customer 2D、PBR ready 与五相机切换，共 10 次 camera check；Doc/revision/history/localStorage writer-zero；console/page error 均为 0。
- `npm run typecheck`
- `npm run test:editor-v7-french-commands`
- `npm run test:editor-v7-ten-finger`
- `npm run test:editor-v7-customer-preview`
- `npm run test:render-v0-7-2-material-projection`
- `npm run test:render-v0-7-2-single-nail`
- `npm run test:render-v0-7-2-texture-assets`
- French contract/compiler/conversion/migration tests
- `npm run build -- --outDir /tmp/nextgen-french04-final-build --emptyOutDir`
- `npm run build:integration`
- `git diff --check`

浏览器证据：

- `french-renderer-walkthrough-report.json`
- `screenshots/390-*.png`
- `screenshots/1280-*.png`

未关闭：

- 用户已对 `1280-editor-flat.png`、`1280-editor-unavailable.png` 与 `1280-pbr.png` 完成 Product 快速方向签收；Editor structured path、可见 fail-closed 降级和顾客 PBR simulated 表达通过本轮抽查。
- 60 × 4 consumer 的 Design / Nail Expert 全量人工视觉签收仍开放；Product 的三张关键截图签收、240 次自动 adapter 调用和两档浏览器证据不能代替 240 项专业视觉验收。
- FRENCH-03 D6 与 FRENCH-04 V1 owner signoff 仍开放，因此本 checkpoint 尚不建议合入 main。
- 真实 PBR、十指真实 3D、Boolean、物理材料/制造验证仍不属于本 PR。

签收来源：2026-08-24 用户对本任务展示的 1–6 关键截图明确回复“1-6通过”。本记录不改变 `prototype / READY(branch-code)`、`未合入 main` 与 `manufacturingValidated=false`。
