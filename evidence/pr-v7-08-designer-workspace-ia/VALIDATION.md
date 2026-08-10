# PR-V7-08｜Designer Workspace IA 验收

> 日期：2026-08-10
> Branch：`codex/pr-v7-08-designer-workspace-ia`
> Base：`23d695e5c750aa4e85a107f1792c6b1681cef73b`
> Evidence level：`production-ready code path` + `runtime walkthrough`

## 1. 范围与裁决

- `/design/canvas` 成为 Editor 专属沉浸式 route；V6/V7 仍共用 `EditorPage` reader/writer 路由裁决。
- 工作区固定为顶部保存区、派生阶段栏、左工具与资源、中间画布、右 canonical 层级/Inspector、底部十指。
- `>=1280` 常驻 Rail/右栏，资源抽屉可收起；`1024–1279` 使用互斥 overlay；`768–1023` 与 `<768` 使用底部 dock/sheet。
- StageBar 只从当前 nail、canonical `steps[]` 和既有 selection 派生；不创建 `guideState`，不写 localStorage，不增加 revision/history/autosave。
- 空 personalization 不暗建步骤；文字/素材、效果、立体装饰、顾客预览和最终组合预览继续显示明确后续版本门禁。
- `surface_finish` 只显示“表面封层”和已选择类型，不表达锁定或设计完成。
- DEV 调试浮钮在沉浸式 Editor route 隐藏，避免遮挡移动端 L1/L2；其他 route 保持不变。

## 2. 自动验证

| 命令 | 结果 |
|---|---|
| `git diff --check` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 bundle size warning |
| `npm run test:editor-v7-workspace-ia` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-background` | PASS |
| `npm run test:editor-v7-background-advanced` | PASS |
| `npm run test:editor-v7-flat-vector` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| V6 contract / migrate / runtime / store | PASS |
| Community content / taxonomy / official / domain / intent / studio-flow | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `npm run test:slots` | 已知基线 FAIL：`Math.abs(rotationDeg) < 5`；本 PR 未改 Slot/素材目录 |

## 3. 浏览器验收

详细度量见 `walkthrough-report.json`。

| 视口 | 验收结果 |
|---|---|
| 1440×900 | Rail、画布、右侧层级与 Inspector 常驻；flat canvas 唯一挂载；无横溢出 |
| 1280×900 | 资源抽屉 232px、右栏 340px，画布仍有 644px；无 overlay 与横溢出 |
| 1024×900 | 画布 960px；资源/右栏互斥；最多一个 dialog/overlay；Escape 关闭并恢复焦点 |
| 768×900 | 桌面 Rail 隐藏，底部 tool dock 唯一挂载；Inspector sheet 不推动 document |
| 390×844 | 单列 canvas-first；阶段/工具/十指独立横滚；Editor 内启用按钮均不小于 44×44；L1 可点击 |

补充：StageBar/ToolRail 方向键漫游通过；V6 空白设计在沉浸式 route 中真实创建并渲染；V6/V7 console error 均为 0。

截图：

- `screenshots/1440-wide-flat-workspace.png`
- `screenshots/1280-desktop-resource-drawer.png`
- `screenshots/1024-compact-layers-overlay.png`
- `screenshots/768-tablet.png`
- `screenshots/768-tablet-inspector-sheet.png`
- `screenshots/390-mobile.png`
- `screenshots/390-mobile-resource-sheet.png`

## 4. 外部只读审查

- Hermes Luna UI Reviewer：`PASS-WITH-RISKS`。Codex 复核后否决其阶段栏约 120px/P0 的估算；真实 390 截图约 58–64px。采纳“当前版本避免把封层文案等同最终预览”和无选择空态建议。
- Claude Code：`PASS`，P0=0、P1=0。其两个 P2（跨断点焦点残留、资源抽屉聚焦 selector 不一致）已修复。
- 外部审查只作建议；最终结论来自本分支真实源码、测试与浏览器证据。

## 5. 证据边界

- `production-ready code path`：V7 工作区 IA、派生阶段栏、工具门禁、响应式 overlay/sheet、selection 同源、V6/V7 沉浸式入口。
- `fixture/runtime verified`：本地 `design.v7.full`、V6 空白设计、五档 viewport、保存态和 console。
- `explicitly deferred`：顾客全屏预览 V7-09；文字/素材 V7-10；表面效果 V7-12；立体装饰 V7-13；最终组合预览 V7-14；Community InspirationPack V7-15。
- `unverified`：最终 3D 真实性、可制造性、设备协议与生产下发。
