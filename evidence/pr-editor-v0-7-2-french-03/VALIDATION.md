# EDITOR-v0.7.2-FRENCH-03 Validation

状态：`prototype / READY(branch-code)`

本 checkpoint 落地结构化 French 的创建、调整与删除闭环。current、selected、mirror、all 均通过同一纯命令进入 Store 一次事务；每个目标指保存独立 recipe instance、managed flat step 与 fill/outline projection。Mirror 交换 `leftWingV/rightWingV`，再以目标指的 exact geometry 重新编译，不复制缓存路径。

## 已实现边界

- 五个预设：classic、micro、soft、deep、pointed；创建弹窗内的预设、范围、颜色和透明度在确认前均为 writer-zero 草稿。
- managed inspector：预设、颜色、透明度、balance lock、甲尖宽度与 left/center/right anchors；几何手调写回 `custom`，颜色和透明度不会错误改写 preset。
- current / selected / mirror / all：同一次命令完成目标解析、逐指 exact geometry、参数投影、唯一 ID、严格解析和一次 revision/history/autosave；失败不部分写入。
- 每个目标指独立 recipe/step/element ID；mirror 只交换左右翼语义，保留逐指 geometry binding。
- managed projection 保持 locked；通用 vector command 不可形成 recipe/path 双真源。
- 严格拒绝 unknown/malformed French revision、悬空或共享 recipe、重复/跨域 ID、投影漂移、空 selected、ID factory 异常和非 exact geometry。
- 同一指多条 French 按 source step + ordinal 定位；目标缺同 ordinal 时显式创建 detached recipe，不误更新第一条。
- 创建弹窗首选项自动获得焦点；关闭后恢复到触发按钮。法式主要交互目标最小高度为 44px。

## 自动验证

- `npm run test:editor-v7-french-commands`：五预设、current/selected/mirror/all、独立 ID、mirror 翼交换、source-step/ordinal、missing-ordinal detached create、update/delete、writer-zero、undo/redo/save/reload 和 locked generic edit 均通过。
- `npm run test:editor-v7-french-commands:e2e`：390、768、1024、1280、1366、1440px 全部通过；报告见 `french-commands-walkthrough-report.json`。
  - 390/1280 完整执行：添加 → soft + mirror → 调整甲尖宽度 → R1 deep 单指覆盖 → 保存/重载。
  - 验证 mirror 一次事务、L1/R1 独立 IDs、projection parity、pointerup+blur 单提交、逐指覆盖不修改 L1、无整页溢出、无 console/page error。
  - 六视口均验证弹窗焦点、Escape writer-zero、44px target；截图位于 `screenshots/`。
- `npm run test:editor-v7-ten-finger`：通过，确认既有 sync-linked 行为未被 French scope detach 回归。
- `npm run test:editor-v7-french-contract`：通过。
- `npm run test:editor-v7-french-compiler`：通过，含 60 canonical / 600 binding、registry/SHA/contour trust boundary 和 golden check。
- `npm run test:editor-v7-french-conversion`：通过。
- `npm run test:editor-v7-french-migration`：通过。
- `npm run test:editor-v7-contract`、`test:editor-v7-migrate`、`test:editor-v7-flat-vector`、`test:handdraw`：通过。
- `npm run typecheck`：通过。
- `npm run build -- --outDir /tmp/nextgen-french03-final-build --emptyOutDir`：通过；仅既有 large-chunk warning。
- `npm run build:integration`：通过；仅既有 large-chunk warning。
- `git diff --check`：通过。

## 未关闭门

- D6：balance unlock、三锚点和预设切换语义仍需 Product / Design / Nail Expert 人工签收；自动测试与 Codex 截图复核不替代 owner sign-off。
- outline topology 的 1↔2 元素变更在本期 UI 未开放；命令遇到既有投影元素数量漂移时 fail closed。
- FRENCH-04 四消费者统一 renderer/PBR adapter 尚未纳入本 checkpoint。
- 本证据等级为 `prototype`；PBR 后续结果仍只能标记 `simulated/approximate`，`manufacturingValidated=false`。
