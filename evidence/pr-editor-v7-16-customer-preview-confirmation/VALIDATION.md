# EDITOR-V7-16｜Customer Preview & Confirmation 验收

## 范围

- Base：`main @ 30cec94`
- Branch：`codex/pr-editor-v7-16-customer-preview-confirmation`
- 交付边界：顾客只读预览、结构化 2D / SVG 2.5D 模拟组合、临时试色/封层比较、确认 readiness；真正的不可变 Approval / Snapshot 仍由 `STUDIO-V7.1-04` 负责。
- 同步补强：空白画布 0→1 引导，以及 `个性化阶段 → 平面/效果/立体 lane → Rail 工具 → canonical step → Layer/Inspector/Canvas` 的显式映射。

## 产品与架构裁决

1. Stage lane 是 EditorDoc 与 UI selection 的纯派生状态，不保存 guide state，也不形成第二真源。
2. 第一次点击缺失能力只展示冲突原因；第二次明确确认才新增一个步骤，恰好一次 revision / history / autosave。
3. locked → skipped → hidden 按顺序逐项恢复；任何提示中的第一击、取消和 Escape 均为 writer-zero。
4. 顾客预览仅使用 defensive snapshot/read model；临时试色、封层比较、2D/模拟组合切换均不写 EditorDoc 或 storage。
5. 模拟组合按 canonical middle `steps[]` 顺序渲染平面、表面效果与立体装饰；finish 永远最后覆盖。
6. `fidelityByLayer` 分别披露 geometry/background/flat/effect/deco/finish，整体 fidelity 不高于最弱一层；模拟 SVG 2.5D 不构成材料、固化、制造或设备证明。
7. `可进入确认` 只是 readiness；按钮保持禁用并明确标注 `STUDIO-04` 接管，不伪造 Approval / Snapshot。

## 自动验收

| 检查 | 结果 |
|---|---|
| app / node TypeScript（tsbuildinfo 写 `/tmp`） | PASS |
| `npm run build:integration` | PASS；仅既有 >500 kB chunk warning |
| `test:editor-v7-workspace-ia` | PASS |
| `test:editor-v7-guided-start` | PASS |
| `test:editor-v7-customer-preview` | PASS |
| V7 contract/runtime/workspace/selection | PASS |
| V7 surface/dimensional/finish/geometry | PASS |
| V6 contract/migrate/runtime/store | PASS |
| `validate-assets` / `validate-recipes` | PASS |
| `test:slots` | 已知 main 基线失败：rotation 绝对值超过 5；本 PR 未修改 Slot 数据/算法 |
| `git diff --check` | PASS |

## 五档 E2E

`npm run test:editor-v7-customer-preview:e2e` 覆盖 390 / 768 / 1024 / 1280 / 1440：

- fresh blank V7 → 效果 lane 第一次点击 writer-zero → 明确确认新增一个 surface step；
- Stage lane、Rail tool、Layer selection、Inspector/Canvas 目标一致；
- 保存后进入顾客预览，默认 2D，可切换模拟组合；
- active surface effect 进入组合渲染；
- 临时试色使 readiness 变 false，重置后恢复；
- preview 前后 `nail-studio:editor.docs` 原始值完全一致；
- 390 / 768 可见按钮不低于 44px；五档无 document 横向溢出；
- `consoleErrors=[]`、`pageErrors=[]`。

证据：

- `walkthrough-report.json`
- `screenshots/*-editor-{flat|effects|decorations}-mapped.png`
- `screenshots/*-customer-composite.png`

## 人工视觉复核

- 390：Layer sheet 清晰显示当前 `局部表面效果` 高亮；关闭路径可见。
- 1440：阶段条中 `效果 1`、左 Rail 效果工具、右层级和 Inspector 同步；画布仍为主要视觉区域。
- 顾客预览：十指图像优先，2D/模拟组合与临时方案入口可见；证据级与非制造免责声明未被弱化。
- 走查期间补修：移动端保存图标缺少 accessible name；确认 readiness 按钮高度仅 32px。两项均已修复并重跑五档。
- Luna 最终结论 `PASS-WITH-RISKS`；其两项 P1（“预览封层”误导文案、触控端 disabled confirmation 原因不可见）均已在最终 diff 修复。内部 reviewer 的层级滚入、同值封层假场景、方案关闭焦点及 E2E 覆盖缺口亦全部关闭。

## 证据等级与未交付边界

- `architecture-golden`：Stage/lane/tool/step 映射、writer-zero preview、canonical order。
- `ui-e2e-validated`：五档响应式、触控尺寸、焦点/入口与无溢出。
- `simulated`：SVG 2.5D 表面效果、立体装饰 fallback、finish 组合。
- `not implemented`：不可变 Approval、Snapshot、分享审批、真实 WebGL/PBR 材质、物理固化、可制造性与设备输出。

## 高频工作流后续建议

1. 把“保存 + 进入顾客预览”升级为单一主动作：自动安全保存后进入预览；保留独立保存作为次级动作，减少一次高频点击。
2. 在 Stage lane 上提供悬停/长按摘要（步骤数、隐藏/跳过/锁定数），避免设计师必须打开 Layer 才理解 attention 状态。
3. 对平面/效果/立体最近使用的工具或 preset 做 session-only 记忆；不写 EditorDoc，减少重复选工具。
4. 顾客预览返回 Editor 时恢复原指位、step、panel 与滚动位置；当前已保留 finger，但可进一步保存完整 UI session snapshot。
5. STUDIO-04 接入时将 readiness 按钮改为“创建确认快照”，确认前集中展示 unavailable/approximate 清单，避免在多个页面重复解释。
