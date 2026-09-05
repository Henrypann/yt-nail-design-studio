---
title: Studio Editor v0.7.2 Roadmap
type: roadmap
status: active
version: v0.7.2
created: 2026-08-12
updated: 2026-08-24
evidence: mixed
aliases: [Studio Editor v0.7.2 Roadmap]
tags: [studio, editor-v7, roadmap, procreate, quick-start, approval, 3d, rendering]
related:
  - "[[文档规则与索引]]"
  - "[[NextGen_Beauty_产品需求池]]"
  - "[[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]]"
  - "[[Community_V7.2_Roadmap_2026-08-12]]"
  - "[[W33_PR合并进展表_2026-08-13]]"
  - "[[2026-08-12_设计决策工具与欧美女性社区竞品分析]]"
  - "[[ADR-GEO-001_几何运行时与渲染制造边界]]"
  - "[[v0.7.2_甲面曲面组合与几何运行时合同]]"
  - "[[Community_标签与Studio_法式工具_PRD_2026-08-14]]"
  - "[[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]"
  - "[[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]]"
  - "[[2026-08-20_工作记录]]"
supersedes: []
superseded_by: []
source_refs:
  - /Users/henry.macbook/.codex/attachments/9d3d6f28-ec96-4f77-a9ed-192e5e2b4f74/pasted-text.txt
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@5ae90852f748dfbc22e2aa1f06e6d93209b6d5f2
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@4d38821b4de419c9638c92baf85946e6b96fb5bb
  - /Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-v0-7-2-3d-foundation@5e78a6d21298254811df00d4d371133ed5a00f1a
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@356cf939fbc8cfffe388dc9ac53c80f8ed904f25
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@ef3d45ec364e9f40186bdd9344861c2b8f697f55
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@d75e4eaff25d4b053540d1a305f40822c30fb6a5
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@3f0fb9bc1f39793d300bd4216c637584e23161c9
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@bcc11f0651938ef5c4299a5802161271d3d787f6
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@7d33293fce8b3eda1c5e6270a898e7646cbfdc99
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@be6b2cea521c41a0b75b0e5571d1326698042d27
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-wizard-v0-7-2-quick-start-integration/HANDOFF_2026-08-20.md
---

# Studio / Editor v0.7.2 Roadmap

Studio v0.7.2 的职责是把意图变成合法、可编辑、可渲染、可确认、未来可制造的版本：

```text
Create → Technique → Render → Approve → Fulfill
```

“Procreate 体验”在本 Roadmap 中被拆成可验收的画布、参考、快捷操作、图层/Mask、结构化 Pattern、十指作用域和版本能力；“3D 渲染”被拆成当前原型、统一 Viewer、材质、光照、性能和证据等级。

> 本 Roadmap 不把 Three.js 依赖、GLB 文件或 SVG 2.5D 自动升级为生产级 3D，也不把视觉验收升级为实体或制造证明。

## 1. 当前起点

截至 `main @ be6b2ce`，3D / Look、Community TAX-01～04、Wizard → Quick Start、Asset Ops、Structured French 与 Explicit Use 已顺序进入本地 main，未 push（文件名保留 `V7.2` 仅为 WikiLink 稳定）：

- `EditorDocV7`、十指编辑、DesignVersion/release、素材、Surface、Decoration、Finish、Geometry 与顾客只读预览已有基础；用户面 Wizard 已收缩为“快速建稿”。
- Quick Start 负责空白/客户、甲型/长度、受治理官方模板、简单颜色、草稿恢复与 Editor 预检；Canonical Community Look 已迁到独立 Import Preflight，不再初始化 Wizard Store。
- Fixed Approval 已复用 `DesignReleaseV1 → PublishPackageV1 → ClientShareLinkV1 → ApprovalEventV1 / ConfirmedDesignSnapshotV7`；新分享固定准确 EditorDoc revision 并使用 1 张十指封面 + 10 张逐指本地预览资产。
- V7 画布支持基础 Pointer brush/eraser/shape/move，当前 DESIGN v1.1 已形成 canvas-first 与响应式产品布局。
- V7 Editor 主渲染仍是 React/SVG 的 Background、Flat、Surface、Decoration 2.5D 与 Finish 组合。
- Petal Veil 有真实 `THREE.WebGLRenderer + MeshPhysicalMaterial` 程序化 PBR 模拟原型；Mercury/Starfish adapter 与 GLB 校验并不等于通用场景渲染器。
- 未形成 Reference Companion、QuickMenu、压力/倾角笔刷、多指手势、QuickShape/ColorDrop、统一 EditorDocV7 → PBR scene compiler 或跨版本视觉 Diff UI。
- Decision UX 的 Mix/Lock/Set Builder/Brief 尚无领域合同与产品流程。
- 隔离 3D Spike 已证明受控 Boolean 与 watertight Almond candidate，但其 C 弧、纵向 arch、Z 向 preview thickness、UV/material/face provenance 与制造均未签收，不能进入产品 geometryRef。
- 3D / Look 链已交付 ARCH 合同、current/Manifold Worker parity、PreviewAppearanceProfile / RenderSceneSnapshot、顾客确认页单指 PBR、Registry V2、材质/纹理投影和四套逐指 Look；其中 current intersection 的开放边差异被保留为 finding，程序曲面与 GLB/PBR 仍只是 simulated preview。
- 本地 main 已包含结构化法式与显式 Use：recipe/compiler、旧版显式转换、五预设 managed inspector、十指四 scope、四消费者统一 adapter 与 INT-FRENCH-01A/01B 已进入 `be6b2ce`。60/600/240、A+B 回归、六档 canonical + Legacy E2E 通过；PBR 仍为 simulated，不是准确曲面或制造能力。

## 2. Roadmap 总览

| 阶段 | 目标 | 主要交付 | 出口门禁 |
|---|---|---|---|
| S0 · Baseline Truth | 固定现有 authoring / rendering / fidelity 真相 | Renderer inventory、DesignVersion/Publish/Geometry gate、DESIGN v1.1 响应式基线 | 每条路径可解释 implemented/prototype/simulated；不误报 3D/制造 |
| S1 · Decision Materialization | 接住 Community 结构化决策并确定性派生 | DecisionIntent、locks/variables、finger provenance、variant branch、Diff/Restore | Community 零写入；确认一次创建一个新版本；同输入同结果 |
| S2 · Procreate-inspired Creation Core | 让 Nail Tech 在轻画布中快速而不破坏地编辑 | Reference Companion、Quick Actions、图层/Mask、Pattern、结构化法式、作用域、模板约束 | 触控/鼠标/键盘可达；不可逆动作显式；主流程 390–1440 可用 |
| S3 · Geometry + Canonical 3D | 先冻结甲面/求值/内核合同，再以顾客确认页单指聚焦为 3D 产品入口 | NailSurface/OperationGraph/KernelPort、parity、单指 PBR viewer、Finish Stack、camera/light、fallback | 十指模拟组合保持现状；只有单指聚焦进入新 runtime；同一 DesignVersion；几何/视觉/制造 fidelity 分开 |
| S4 · Output / Compare / Approval | 把版本和渲染交付给顾客与 Community | 2/4 宫格、3D variant compare、固定分享、Customer-ready output、Approval snapshot | 分享配置固定；Approval 不写活文档；输出与版本一致 |
| S5 · Physical Handoff & Advanced Rendering | 用实体和设备证据推进 AR、材料校准，并完成向制造/设备域的交接 | hand VTO、实测材质、风险热区、ConfirmedDesignSnapshot handoff；Compiler/HIL 为跨域依赖 | Studio 只产设计/确认快照和展示证据；制造/设备域分别签收 Compiler、route/device、HIL/物理样本 |

## 3. S0｜Baseline Truth

### 3.1 Renderer Inventory

为每条模板/内容记录：

- canonical source / designVersionId；
- renderer type：SVG 2D、SVG 2.5D、Three procedural、GLB adapter、PBR viewer；
- geometry source / revision / checksum；
- asset readiness；
- fidelity：exact / approximate / unavailable；
- fallback；
- `manufacturingValidated` 与真实物理证据引用。

### 3.2 Exit Gate

- Petal Veil 明确为程序化 Three/PBR `simulated prototype`。
- Mercury/Starfish 的模块/GLB 完整性 adapter 不被称为已渲染场景。
- V7 Editor SVG 2D/2.5D 不被称为通用 PBR。
- `Preview ≠ Approval ≠ Fit ≠ Manufacturing ≠ RealResult` 写入产品与 QA 合同。

## 4. S1｜Decision Materialization

### 4.1 候选合同

- `DecisionIntentV1`：候选、锁定/可变维度、单指选择、来源和规则版本。
- `DerivedDesignRecipeV1`：经 Studio 校验后的确定性物化计划。
- `FingerSourceRefV1`：每指来源 DesignVersion、nailId、element refs 与变换。
- `CompositionRelationV1`：target DesignVersion 与全部 source/finger refs、权利快照和 fallback 的独立多来源关系。
- `VariantSpecV1`：parent version、参数差异、preview configuration。

上述名称在 ADR 签收前均为 planned，不自动写入当前 schema。

现有 `DesignVersionV1.parentVersionId` 继续保持同一 Design 的 release history，现有 `RemixRelationV1` 继续保持单来源语义；Mix & Match 不把外部来源或来源数组塞进这两个 V1 字段。

### 4.2 Authoring 行为

- Mix & Match、Set Builder、Try One Nail 先建立 preview transaction。
- geometry / asset / rights / capability 逐项 preflight。
- 确认后创建/保存一个受控 `EditorDocV7` draft/revision，再复用 Studio release service 创建一个新 `DesignVersionV1`；取消不写入。
- Restore 旧版时派生新版本，不篡改历史。
- What Changed 精确到 property、element、nailId 和 renderer config。

### 4.3 Exit Gate

- Writer integrity：materialization 前 EditorDoc 写入 0；确认后只有一次受控 draft/revision + release 流程。
- Provenance completeness：全局与单指来源 100%。
- Determinism：同源版本 + 同 intent + 同规则版本输出一致。
- Partial failure 不得静默丢指、替换素材或降级为 V6。

## 5. S2｜Procreate-inspired Creation Core

### 5.1 Canvas-first 与 Reference Companion

- 画布始终是主任务；Panel 按空间逐级隐藏，关键动作保持可达。
- Board、Look、客户图片可固定为只读参考；可缩放/移动但不混入设计真源。
- 参考图保留来源、授权与导入状态；显式“导入素材”后才进入资产系统。

### 5.2 Quick Actions 与输入

- 常驻：brush/eraser/select、undo/redo、zoom/fit、current nail / selection scope。
- 候选：吸色、长按临时工具、可配置 6 个 Quick Actions、连续撤销。
- Web/鼠标/触控/键盘/触控笔具有可发现替代入口；隐藏手势不能成为唯一入口。
- 44px touch target、focus lifecycle、pointer capture、误触取消和设备矩阵进入 E2E。

### 5.3 非破坏图层与 Pattern

- 分离 color、pattern/decal、mask、finish parameters；单指可 override。
- 结构化 Pattern：Mirror、Repeat、Rotate、Scale、Spacing、Offset、Palette。
- 模板显式声明 editable properties 与 locked constraints。
- Merge/flatten/rasterize 等不可逆动作必须显式确认并保留前一版本。

### 5.4 十指作用域

- 已实现范围统一命名为 `current / selected / mirror / all`，操作前明确显示；任意命名 group 需先定义持久分组模型，属于 planned。
- 批量操作保留每指 override；同步/解除同步可撤销。
- Accent Planner 与 Try One Nail 复用同一作用域合同，不另造一套编辑状态。

### 5.5 Quick Start（已集成）

- 只保留空白/客户新建、甲型/长度、官方模板、底色/封层/简单逐指强调、草稿恢复和 Editor 预检。
- 官方模板按甲型适配度排序，必须解析完整 `AssetRefV7`；不出现 Community 推荐、Creator、热门或趋势语义。
- `WizardRecoveryDraftV1` 只读兼容并纯迁移到 V2，失败不覆盖 storage；历史确认不得恢复为可编辑态或映射为正式 Approval。
- Quick Start 可做十指草稿预览和单指检查，不提供正式顾客确认；正式状态读 `ApprovalEvent / Confirmed Snapshot`。

### 5.6 Structured French Tool（当前已选择）

法式属于 S2 的结构化平面图形工具，不属于新的制造步骤，也不因读取 signed 2D contour 自动升级为 S3 几何或实体能力。当前计划按以下顺序推进：

```text
FRENCH-01 recipe 合同、旧版读取与显式转换
→ FRENCH-02 canonical compiler / 60 golden + 600 逐指 binding
→ FRENCH-03 五预设编辑、锚点、history、十指 scope
→ FRENCH-04 编辑画布/十指设计总览/顾客预览/PBR adapter 统一读取
```

- `EditorDoc schemaVersion: 7` 保持不变；新法式复用现有 `RecipeInstanceV7 + flat_design` 扩展点，旧两参数法式冻结读取，未确认转换不改历史外观。
- 2026-08-24 状态：FRENCH-01～04 与 INT-FRENCH-01A/01B 已整体 fast-forward 进入 `main @ be6b2ce`。`f3c556b` 记录 Product owner 软件原型集成门，`ae9075b / 7d33293` 分别完成 Use contract/preflight 与 UI/E2E；独立 Nail Expert、物理/制造签收仍开放。
- 首批仅签收 `almond / oval / coffin` 的四档长度和经典、微、柔和、深、尖角五预设；其余甲型 fail closed。
- 统一路径为 2D 设计真源。模拟 3D 无法准确映射时显示 `APPROXIMATE / unsupported mapping`，不能反写或损坏二维设计。
- 完成门禁为 60/60 canonical compiler case、600/600 逐指 geometry binding、240/240 四消费者对照单元和 current/selected/mirror/all 十指逐项验收；原 `180` 口径漏计 PBR material consumer，现按四消费者修正。PBR 五角度仍是 simulated adapter，自动测试不能替代设计与美甲专业签收。

详细范围见 [[Community_标签与Studio_法式工具_PRD_2026-08-14]] 与 [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]]；W33 计划保留为 Community + French 历史总计划。

### 5.7 Exit Gate

- 空白 0→1、参考→素材→十指编辑→保存/派生主链可演示。
- 390 / 768 / 1024 / 1280 / 1366 / 1440 关键视口无阻断。
- Pointer/keyboard/touch 基本路径通过；压力/倾角只有真实硬件证据后才宣称支持。
- 模板和 Pattern 仍是结构化数据，不以大量静态图片/硬编码替代。

## 6. S3｜Geometry Runtime + Canonical Real-time 3D

### 6.0 先合同，后实现

S3 不从“换一个 Boolean 库”开始。必须先签收 [[ADR-GEO-001_几何运行时与渲染制造边界]] 与 [[v0.7.2_甲面曲面组合与几何运行时合同]]，再按以下顺序推进：

```text
NailSurfaceDefinition + Golden Fixture
→ GeometryOperationGraph + GeometryKernelPort
→ current/Manifold candidate parity
→ Geometry Registry V2 / Representation Set
→ PreviewAppearanceProfile + RenderSceneSnapshot
→ 统一 PBR Viewer
```

当前 Almond/Boolean 分支只属于 `SIMULATED_CANDIDATE / spike-only`；watertight 不等于真实 C 弧、法向厚度、扫描贴合或可制造。

### 6.1 单指 PBR Viewer 与产品入口

- `EditorDocV7 / DesignVersionV1 → NailSurface/GeometrySnapshot → render scene` 的单向 compiler/read model。
- 首批入口固定在 Editor 完成设计后的顾客确认/只读预览页，交互为 `十指总览 / 单指聚焦` 与 `2D 设计 / 模拟 3D` 两组正交切换。
- 十指总览的“模拟 3D”继续使用现有 SVG/2.5D/finish composite，不因 S3 替换为十路 WebGL 场景，也不加载 Geometry Kernel。
- 只有“单指聚焦 + 模拟 3D”消费当前指的 canonical geometry、material binding、camera、lighting、environment 与 color management，作为 v0.7.2 3D Foundation 的首批产品入口。
- GLTF/GLB 加载、checksum、资源错误、WebGL context lost 与 2D fallback。
- 同一版本的 2D/3D 读模型不得各自成为真源。
- 模式/手指/相机/灯光切换均为 writer-zero；不创建 EditorDoc revision、ApprovalEvent、ConfirmedSnapshot 或 Manufacturing candidate。
- geometry/asset/runtime 不可用时保留当前单指身份与确认上下文，原位解释 fidelity/reason 并回退单指 2D/2.5D；不得空白、跳回 Editor 或污染十指总览。

当前实现状态（`main @ be6b2ce`；相关 3D 功能树源自 `356cf93`）：

- 四态产品边界已经落地：十指 2D、十指既有 SVG 2.5D、单指 2D、单指 PBR；只有最后一态懒加载 Three.js PBR 组件。
- 单指 PBR 已有五个固定相机、ACES、gloss/matte/frosted profile、WebGL unavailable 原位 fallback、resource dispose 与 storage writer-zero E2E。
- Registry V2、Almond promoted representation、canonical background/flat/surface material projection、deterministic texture asset 校验、逐指装饰和联合相机 bounds 已进入 main；四套 Look 为 40/40 逐指通过。
- 当前使用的闭合程序曲面、GLB 装饰和 PBR 仍用于模拟展示；四套 cover 为 `APPROXIMATE / CONCEPT`。Registry/投影完成不等于准确曲面贴合、真实材料或制造验证，S3 长线仍未完成。

### 6.2 Lightweight Finish Stack

最小通道：

```text
baseColor
roughness
metalness
pattern/decal
mask
```

按能力逐步开放 normal/height、clearcoat、transmission、flake/cat-eye 参数；每个参数都要有默认值、范围、fallback 和 fidelity 说明。

### 6.3 快 / 高质量双档

| 档位 | 目标 | 允许的取舍 |
|---|---|---|
| Interactive | 顾客确认页单指聚焦的实时 orbit、视角与灯光切换 | 简化采样/阴影/后处理；不是 Editor authoring renderer，不得改变设计内容 |
| High Quality | 同一单指场景的顾客确认、比较和输出 | 可延迟或排队；固定相机、环境和渲染版本；不替换十指模拟组合 |
| Physical Validation | 实体/设备签收 | 不是 renderer 档位；必须引用物料、工艺、设备和样本证据 |

### 6.4 灯光与镜头

- Salon、Daylight、Product Shot、Social 受控预设。
- 最多允许的灯光、曝光、相机、焦距、背景和 tone mapping 版本化。
- Variant Compare 使用同镜头、同光照、同尺度，避免视觉操纵。

### 6.5 性能与 fallback

- 设备/GPU/WebGL capability matrix 与显存预算。
- 首帧、交互 FPS、HQ 出图时长、内存、context loss 恢复指标。
- WebGL 不可用时回到同版本的 2D/2.5D 可解释预览，不出现空白死路。
- 四态 E2E：十指 2D、十指模拟组合、单指 2D、单指 PBR；断言仅最后一态加载新 runtime，切换前后 canonical doc/history/revision/storage deep-equal。

S3 开发开始前必须先通过 Geometry 合同/Golden Fixture 与性能 ADR：前者固定坐标、outer/inner/rim、C 弧、arch、法向厚度、Operation component policy、UV/material/face provenance；后者固定设备/GPU/浏览器矩阵及首帧、FPS、HQ 出图、内存、context-loss 与 fallback 阈值。任一未签收均不能宣称 S3 完成。

## 7. S4｜Output / Compare / Approval

- 2/4 宫格 Variant Compare、before/after、十指和单指详情。
- 分享快照固定 `designVersionId + rendererVersion + camera + lighting + fidelity`。
- Customer-ready Output 与 Community PublishedLook 使用同一版本引用，不维护两套图像真源。
- 评论/请求修改锚定 `designVersionId + nailId + view`。
- Approve 创建 immutable snapshot；继续修改必须派生新版本并失效/保留旧审批状态按 ADR 处理。
- Process Replay 与 AI provenance 为 P1/P2 可选，不阻塞顾客输出。

当前已集成的本地固定版本确认只保证同源运行时与 `LOCAL_PROTOTYPE / simulated` 证据。链接过期、撤销、损坏、资产缺失和 stale 版本均 fail closed；不声明远程跨设备、生产权限、制造或正式商业顾客签收。

## 8. S5｜Physical & Advanced Rendering

### 8.1 AR / Hand VTO

- 手部照片单独授权、去 EXIF、保存期、删除与端侧/服务端边界。
- 人群、肤色、姿态、光照、遮挡、设备性能和 failure state 评测。
- 输出只标 `PreviewEvidence`，不升级为扫描、适配或审批。

### 8.2 实测材质与风险热区

- 材质库由实体样本、受控灯光、相机和测量流程校准。
- 可制造性热区需引用最小线宽、边缘、厚度、材料和设备能力合同。
- Ray tracing 只有在对审批/销售的增益与设备成本可证后进入交付。

### 8.3 向制造与设备域交接

```text
ConfirmedDesignSnapshot + NailTwinSnapshot
→ deterministic Manufacturing Compiler
→ versioned artifacts / route / device task
```

AI 可辅助解释和候选，但不能生成未经确定性验证的最终制造参数。

Ownership 固定为：

- Studio / Editor：输出 versioned `ConfirmedDesignSnapshot`、设计侧约束与可解释预览。
- Manufacturing Compilation 域：拥有 deterministic Compiler、Artifact 与 ProcessRoute。
- Production / Device 域：拥有 WorkOrder、DeviceTask、Gateway、Adapter 与 HIL/FAT/SAT。

因此 Compiler、route、device task 和 HIL 是 S5 的跨域依赖与 handoff gate，不是 Studio / Editor 自己的实现范围。

## 9. 与 Community 的握手

| Studio 输入 | Studio 输出 | Community 使用方式 |
|---|---|---|
| `VersionedStudioImportIntentV2` | `/studio/design/import` 的 Canonical Import Preflight；验证后新建独立 Remix `EditorDocV7`，取消/返回不写当前草稿 | Canonical Look 不进 Wizard；旧 `/studio/design/new?versionedIntent=` 保参重定向 |
| Legacy `communityIntent` | Quick Start 的“Legacy 近似应用”或可解释阻断 | 显示来源/能力等级；`templateId + assetVersion + shape + AssetRefV7` 必须严格匹配 |
| `DecisionIntentV1` | EditorDocV7 transaction + release → Derived DesignVersion + provenance | 更新 DecisionSession 候选，不复制 EditorDoc |
| `NailBriefV1` | 用户确认后的结构化 EditorDocV7 draft；后续显式 release 才有版本 | 展示摘要与继续编辑入口 |
| publish request | PublishPackage + PublishedLook 写入结果 | Explore/Board/Creator Profile |
| fixed approval action | `ApprovalEventV1 / ConfirmedDesignSnapshotV7` | APPROVED 才创建 Snapshot；CHANGE_REQUESTED 只写事件/备注；不写活 EditorDoc revision |

## 10. 顺序裁决

1. S0 truth 与 S1 deterministic materialization 优先于 AI 生成。
2. S2 先完善轻画布和非破坏数据模型，再增加高级笔刷/手势。
3. S3 的 NailSurface/OperationGraph/KernelPort、Golden Fixture、parity、Registry V2、材质/纹理投影与首个单指 PBR 入口已进入 main；后续仍不得把临时程序曲面或模拟 Look 直接晋级 canonical manufacturing geometry。
4. S4 固定版本输出与审批优先于 AR、ray tracing 和过程视频。
5. S5 每项都需隐私、实体、设备或运营证据，不由 v0.7.2 文档自动签收。
