# EDITOR‑V7‑15｜Inspiration & Geometry Binding 验收

## 范围与基线

- Branch：`codex/pr-editor-v7-15-inspiration-geometry`
- Base：`main @ 45dd57de867a73a2b722d95774d969866e25fa90`
- 本 PR 交付 Editor 中立的独立 V7 materializer、严格 Geometry Registry、生产迁移 resolver、空间编辑门禁与可解释 fidelity；不新增 Community 内容合同，不声明逐指扫描、贴合或制造验证。
- 旧 `codex/pr-v7-13-inspiration-geometry` 无可摘取实现提交；本 PR 未复用其不存在的代码。

## 已冻结合同

- `GeometryRefV7` 的 revision 同时绑定 shape params 版本、capability/evidence 版本和 28 个 SVG 的集合 SHA‑256。
- `signed_off` 仅表示已签收 2D 甲型轮廓，映射为 `exact`；`generated/in_review` 为 `approximate`；未知引用、revision/指位不匹配、缺失资产或能力未开放为 `unavailable`，只读使用通用轮廓。
- 所有结果固定 `manufacturingValidated:false`。
- 空白新建、Wizard 创建和 Community `new Remix` 均在 ID 分配及写入前检查十指 exact geometry；`current/cancel` 不创建文档。
- 图案、局部表面效果、立体装饰以及跨指 copy/sync 需要 exact geometry；背景和封层仍可调整。
- materializer 深拷贝十指 canonical 内容、重建 design/recipe/step/element/decoration ID，并移除 customer、communication 与 live composition linkage；`steps[]` 仍是每指唯一真源。
- Customer、Surface Effect、Dimensional Decoration 与 Finish Composite 的 overall fidelity 均不得高于 geometry fidelity。
- V1–V6 兼容读取通过同一组 fail‑closed 生产 resolver：已签收甲型可迁移，generated/placeholder 不伪装为可编辑产品几何。

## 自动验证

| 检查 | 结果 |
|---|---|
| app / node TypeScript（临时 tsbuildinfo） | PASS |
| `npm run build:integration` | PASS；仅既有 >500 kB chunk warning |
| `test:editor-v7-inspiration-geometry` | PASS；registry、28 SVG digest、overall fidelity、creation、migration、materializer、writer/UI gates |
| Editor V7 contract / migrate / runtime / workspace / IA / selection / guided start | PASS |
| Background / advanced / flat vector / flat assets / ten-finger / surface / dimensional / finish / customer preview / creation cutover | PASS |
| Studio design-release / publish-package / versioned-import | PASS |
| Community identity / content / adapter / search / Nail Board / use-customize | PASS |
| V6 contract / migrate / runtime / store | PASS |
| handdraw / assets / recipes | PASS |
| `git diff --check` | PASS |
| `test:slots` | 仅 main 同样存在的基线失败：L3 `rotationDeg=5.81`，断言要求 `<5`；本 PR 未改 Slot V2 |

## E2E 与视觉证据

- Geometry walkthrough：390 / 768 / 1024 / 1280 / 1440 全部 PASS；每档覆盖 exact、generated blocked、unavailable generic fallback，共 15 张截图。
- 每档验证 Stage、Layer、Inspector、TenFinger 的一致门禁，blocked 操作保持 doc/revision/history/autosave/storage writer‑zero。
- 390 / 768 所有可见按钮高度 ≥44px；五档 `scrollWidth === clientWidth`；console/pageerror 均为 0。
- Community 真实链路：Petal Veil Look → Wizard 冲突选择 → `new` → 独立可编辑 V7 Remix，在五档均 PASS；另验证 `current/cancel` 不产生 customize event。
- 报告：`walkthrough-report.json`、`community-flow/walkthrough-report.json`；截图位于同目录下 `screenshots/`。

## 独立审查

- Hermes Luna UI Reviewer：`PASS WITH RISKS`。其 2 个 P1 经 Codex 复核均不阻塞：Remix 顶栏已有来源版本与返回来源 Look；桌面 32px 鼠标工具栏不属于本 PR 的移动触控门禁，390/768 已 ≥44px。Community 卡片视觉层级为范围外 P2。
- 内部只读 contract / asset / UX agents：最终复核无 P0/P1；geometry identity、生产 migration resolver、checksum、materializer 原子性与 UI gate 已闭环。
- Claude Code 最终审查按项目授权发起，但被 Codex 账户 usage limit 拒绝，未产生模型输出，也未将失败视为批准。
- Hermes DSF 初始 worker 仅完成探索，未产生代码修改；最终实现、修复、验证与裁决由 Codex 完成。

## 证据等级与边界

- `architecture-golden`：Geometry Registry、revision identity、materializer 与 fail‑closed resolver。
- `production-ready code path`：V7 新建/Remix preflight、Editor/Customer preview 读取与空间 writer gate。
- `simulated`：SVG 2D / 2.5D / finish composite 预览。
- `unverified`：逐指扫描贴合、真实材料外观、UV/LED 固化、设备协议与物理可制造性。

## 回滚

本 PR 不修改 EditorDoc schemaVersion、storage key 或设备协议。回滚本提交即可恢复旧 resolver 与 UI 行为；既有 V1–V7 文档不被批量重写。
