# French 专业门｜Owner Acceptance & A+B Regression

状态：`CLOSED for software prototype integration`；证据等级：`prototype / visually-signed-off by product owner`；`manufacturingValidated=false`。

## Owner 决策

- 2026-08-24，用户先对 1–6 关键截图明确回复“1-6通过”，覆盖 legacy 转换、五预设/create + mirror、Editor Flat、可见 unavailable 与单甲 PBR simulated 的产品方向。
- 2026-08-24，在 Branch B 已 fast-forward、Branch A 已吸收新 `main` 且 A+B 联合回归通过后，用户明确要求“再关闭 French 专业门，进入 INT-FRENCH-01A/01B”。
- 因此本轮关闭 D5/D6/V1 的**软件原型集成阻断门**：接受当前 3 甲型 × 4 长度 × 5 预设、三点参数/平衡/镜像/十指 scope，以及 60 × 4 命名消费者作为 INT 开发基线。

## 关闭范围与保留边界

- 关闭：Product owner 对当前软件视觉、交互和结构化编辑方向的集成许可。
- 保留：`golden-manifest.json` 的 machine evidence 继续保持 `visualSignoff=false`，因为生成器禁止把人工审批写进自动产物；本文件是独立 human acceptance record。
- 不声称：独立 Nail Expert 身份复核、实体样甲、物理 fit、曲面制造精度、Boolean、3MF、打印、设备或生产验证。
- PBR 仍为 `simulated-not-manufacturing`；60/600/240 是软件合同和渲染证据，不升级为制造证明。

## 新 main 与 A+B 联合回归

- `main`：`bcc11f0651938ef5c4299a5802161271d3d787f6`（Branch B 29 commits 完整 fast-forward，无 cherry-pick）。
- Branch A 吸收提交：`211774abf6bd91cae272f08a1ade4aa6122b2f63`；`package.json` 同时保留 12 条 French 与 17 条 Asset/Home 相关脚本。
- French：contract、migration、compiler、60 golden check、conversion、commands、renderers 60×4=240、EditorDocV7 contract 全部 PASS。
- Asset/Community：contract、inventory、governance、Starter、capability、Home、owner fail-closed、combined、TAX 与 discovery 回归全部 PASS。
- Browser：French conversion 2 viewports、commands 6 viewports、renderers 2 viewports；Community capability 6、Home 6、content states、TAX-04 六档全部 PASS。
- `typecheck`、`build`、`build:integration`、`git diff --check` PASS；仅保留既有 Vite chunk-size warning。
