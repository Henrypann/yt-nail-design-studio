# EDITOR-V7-14.3｜High-frequency Selection Continuity 验收

## 状态与范围

- Branch：`codex/pr-editor-v7-14-3-selection-continuity`
- Base：`de2ba3b2fac4e7dc026a353e7b373bb727e999d4`
- Verdict：`ACCEPTED`；P0 = 0，P1 = 0。
- 交付范围：跨指步骤选择连续性、十指键盘导航、Geometry Stage 只读说明、Customer Stage 保存状态解释与当前指位预览交接。
- 不包含：EditorDocV7/JSON Schema/storage schema 变更、元素跨指猜测映射、甲型写入/替换、ConfirmationSnapshot、ShareLink、制造或扫描证明。

## 已冻结产品合同

1. 切换手指按当前步骤的 `kind + 同类相对序号` 精确映射，不按全局数组位置映射。
2. 目标缺少精确同序步骤时回到其 background；不 clamp 到第一个或最后一个同类步骤，不暗建层，并显示“未创建新步骤”。
3. hidden / skipped / locked 的精确对应项仍可被选中，由既有恢复提示解释；不暗跳到其他可编辑层。
4. 同指重复激活是 no-op；真正跨指时清除 element selection，避免把全局唯一且互不对应的元素 ID 当成同一对象。
5. `selected` 范围中方向键只移动焦点；其他范围中方向键同时切换当前指。Home/End 与 Left/Right 均支持。
6. Geometry Stage 只解释当前 `geometryRef` 与 product/generic 派生结果；generic 不提供绑定或替换动作，原引用不变。
7. Customer Stage 在 dirty/saving/error/switching 时仍是可聚焦、可触控的状态说明入口，但不会打开预览；saved 时进入只读预览并携带当前 `finger`。

## 实施摘要

- `workspace-ia.ts`：新增纯函数 `resolveSelectionContinuityV7`。
- `store-v7.ts`：`setCurrentFinger` 返回 UI-only outcome；`reloadFromStorage` 修复悬空 selection。
- `TenFingerBarV7.tsx`：连续性状态提示、Left/Right/Home/End、selected scope focus-only 语义。
- `EditorStageBarV7.tsx` / `EditorStageContextNoticeV7.tsx`：Geometry 与 Customer 可解释 Stage 行为、焦点恢复和注意状态。
- `EditorShellV7.tsx`：统一 Customer preview availability；预览 URL 携带 current finger。
- `CustomerPreviewPageV7.tsx` / `CustomerPreviewShellV7.tsx`：校验并高亮入口 finger；保持十指总览模式；平板返回按钮触控目标 44px。
- 新增独立合同测试和五档 Chromium walkthrough。

## 自动门禁

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 >500 kB chunk warning |
| `npm run test:editor-v7-selection-continuity` | PASS |
| `npm run test:editor-v7-selection-continuity:e2e` | PASS，5 viewports |
| `test:editor-v7-workspace(-ia)` | PASS |
| `test:editor-v7-guided-start` | PASS |
| `test:editor-v7-customer-preview` | PASS |
| `test:editor-v7-runtime` / `test:editor-v7-ten-finger` | PASS |
| `test:editor-v7-contract` / `test:editor-v7-migrate` | PASS |
| `test:editor-v7-surface-effect` / `dimensional-decoration` / `finish-composite` | PASS |
| `test:editor-v7-creation-cutover` | PASS |
| V6 contract / migrate / runtime / store | PASS |
| `test:handdraw` / `validate-assets` / `validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | 已知基线 FAIL：L3 `rotationDeg=5.81`，旧断言要求 `abs < 5`；`main @ de2ba3b` 同失败，本 PR 未改 Slot V2 |

## 浏览器验收

`390 / 768 / 1024 / 1280 / 1440` 全部通过：

- product 与 generic Geometry 说明均可打开；关闭/Escape 后焦点回 Stage；操作前后 doc、revision、history、autosave、source token、localStorage 原文完全一致。
- R4 第 2 个 flat → R5 第 2 个 flat 精确映射；element selection 清空；Stage/Rail/Layer/Canvas 同步。
- R4 第 2 个 flat → 只有一个 flat 的 L2 回到 background；步骤数量不变，出现“未创建新步骤”。
- current scope 方向键切换当前指；selected scope 方向键只移动焦点。
- dirty Customer Stage 只显示保存原因；真实保存后从非默认 R3 进入 `?design=...&finger=R3`，仍为十指总览并高亮 R3；非法 finger query fail-closed 到 L1。
- Editor 与 Customer Preview 均无 document 横向溢出；十指按钮及 390/768 可操作预览按钮均为 44px；console error / pageerror 为 0。

证据：

- `walkthrough-report.json`
- `screenshots/*-geometry-context.png`
- `screenshots/*-geometry-generic.png`
- `screenshots/*-exact-flat-continuity.png`
- `screenshots/*-missing-ordinal-fallback.png`
- `screenshots/*-customer-dirty.png`
- `screenshots/*-selection-continuity.png`
- `screenshots/*-customer-preview-entry.png`

## 编排与审查记录

- Hermes DSF 作为单 writer 启动；在探索阶段运行过久后由 Codex 按技能规则终止整个进程组（exit 130），保留并独立复核其两个有价值的局部实现：pure resolver 与 store 接线。
- 后续 UI、测试、E2E、修复、验收由 Codex 完成。
- 独立内部合同终审：初审指出默认 L1 可能伪通过；修为非默认 R3 + 非法 query 回落后复核 `ACCEPT`，P0/P1 = 0。
- 独立 UX/a11y 终审：修复 dirty→saved 说明竞态、scope 旧提示、`aria-controls`、Home/End/Enter/Space 证据后复核 `ACCEPT`，P0/P1/P2 = 0。
- 独立测试终审：`ACCEPT`，P0/P1 = 0；P2 仅为 saving/error/switching 未逐项浏览器模拟，以及 generic fixture 由 runtime 注入（证据等级已明确为 deterministic simulation）。
- Hermes Luna UI Reviewer：首次 `pass-with-risks`，指出移动端状态文字和 Stage 单行截断；修为 11px 完整换行与 10px 两行摘要并重生成 35 张截图。短复核确认 P0/P1 = 0，唯一 P2 是其未逐张查看 1440 图片；Codex 已人工检查最终 1440 截图，摘要清晰、无溢出。
- Claude Code：按项目授权调用 `main` 终审；Packy HTTP 400，当前令牌分组未覆盖 Anthropic / Opus 4.6。没有获得 Claude 输出，也未把失败视为批准；不自动重试。

## 证据等级与回滚

- 证据等级：`product-ui / runtime-contract / deterministic-browser-simulation`。
- Geometry product mapping 只证明 registry 轮廓解析；不证明扫描、贴合、物理、材料或制造正确性。
- Customer Preview 是只读沟通视图；本 PR 不生成确认、分享或发布证据。
- 回滚：回退本 PR 单一 commit；无存储迁移、无 schema 写入、既有 V1–V6/V7 文档不需回滚数据。
