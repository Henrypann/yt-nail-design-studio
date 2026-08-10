# PR-V7-11｜Ten-finger Operations 验收证据

日期：2026-08-10

分支：`codex/pr-v7-11-ten-finger-operations`

Base：`fd8d2ccbdd65ae046b4317402206da6040750ef0`

## 交付范围

- runtime-only `current / selected / mirror / all` 指位范围；不写入 EditorDocV7。
- 一次性复制、显式“同步当前快照”、解除同步。
- 每指继续持有独立 canonical `steps[]`、独立全局 ID；保留目标 `finger` 与 `geometryRef`。
- 一批十指操作只产生一次 revision、一次 history 和一个 autosave intent。
- 普通单指编辑会在同一事务把该指从 `linked` 改为 `detached`。
- 对侧镜像采用 nail-local `u' = 1-u`，方向 `180°-d`，旋转 `-r`；不沿用旧拇指 `+180°`。
- 镜像输出的 `u` canonical 到 5 位小数（与路径序列化精度一致），未变化的 `v` 保留原精度；canonical 输入双镜像可精确恢复。
- 390/768 使用跨指 bottom sheet；1024 双行；1280/1440 单行职责布局。

## 产品语义冻结

- “同步”是显式快照操作，不是实时双向联动，也不共享 mutable steps。
- `compositionMeta.revision` 表示 composition 来源/合同 revision，不是每次本地同步的内容 fingerprint；外部 `source` 是血缘信息，不声称当前像素与外部来源相等。
- `linked` 表示该指属于最近一次显式同步组；单指成功编辑立即 `detached`。
- 若当前范围外仍有 linked 成员，同步会在生成 ID 或改文档前拒绝，要求先解除它们或选择完整范围，避免暗中改写 scope 外指位。
- mirror scope 只允许一次性复制；不创建持续镜像 sync。
- 图片、文字与 3D mesh 本体保持正向，只镜像布局、旋转和 attachment anchor；这是 V7 当前合同下的明确近似，不宣称 exact body reflection。

## 已知合同边界

- RegionMask 的现有 runtime Schema 比 V7-07 nail-path adapter 更宽。遇到 adapter 无法解析的合法旧 mask，镜像会原子拒绝并返回 `invalid_value`，不会误报 ID 冲突或部分覆盖。Schema/adapter 统一留给后续合同 PR；本 PR 不静默改写未知路径。
- 不新增 `flipX`、共享 steps、跨指 node alias 或实时 observer。
- 本 PR 不实现表面效果/立体装饰的新 authoring UI，也不宣称物理制造真实性。

## 自动门禁

通过：

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:editor-v7-ten-finger`
- `npm run test:editor-v7-contract`
- `npm run test:editor-v7-migrate`
- `npm run test:editor-v7-runtime`
- `npm run test:editor-v7-workspace`
- `npm run test:editor-v7-workspace-ia`
- `npm run test:editor-v7-customer-preview`
- `npm run test:editor-v7-background`
- `npm run test:editor-v7-background-advanced`
- `npm run test:editor-v7-flat-vector`
- `npm run test:editor-v7-flat-content-assets`
- `npm run test:editor-v7-creation-cutover`
- `npm run test:editor-v6-contract`
- `npm run test:editor-v6-migrate`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- `git diff --check`

非阻塞已知基线：`npm run test:slots` 与 `main @ fd8d2cc` 同样在 `tools/slot-calibrator/test-slot-math.mjs:79` 的 `rotationDeg < 5` 断言失败；V7-11 未修改 Slot V2 数据或算法。

十指专项覆盖：5 对左右指、selected 去重与 canonical order、方向边界、双镜像稳定、所有 step/element/decorations fresh ID、target geometry 保留、锁与碰撞原子回滚、broad mask 明确降级、readOnly/switching、single-finger auto-detach、scope 外 linked 拒绝、undo/redo/save/reload、顾客预览 writer=0。

## 真实浏览器走查

命令：`node tools/walkthrough-editor-v7-ten-finger.mjs`

环境：本地 Vite，`VITE_EDITOR_V7=1`，隔离 Chromium context。

通过 viewport：390、768、1024、1280、1440。

- document 横向溢出：0
- 可见触控目标最小尺寸：44px
- selected source/targets 不混淆
- mirror sync 禁用，近似策略有可见说明
- sync/copy/detach 真实 affected fingers 二次确认
- sheet 与 alertdialog 打开移焦、Tab 闭环、Escape/取消恢复真实 trigger
- pageerror / console error：0

证据：`walkthrough-report.json` 与同目录 8 张 PNG。

## 审查记录

- 外部 Claude Code 网关：本轮因未取得私有代码出域授权而未调用；未绕过安全审查。
- 工作区内合同审查：首轮指出浮点漂移、scope 外副作用、mask adapter 诊断和测试缺口；整改后最终 `ACCEPT`，P0/P1=0。
- 工作区内 UI 审查：首轮指出 detach 范围披露、状态颜色唯一编码和 dialog focus；整改后最终 `ACCEPT`，P0/P1=0，并加入 Chromium 断言。

证据等级：`production-ready prototype path`。3D body reflection、制造可行性与设备输出仍为未验证。
