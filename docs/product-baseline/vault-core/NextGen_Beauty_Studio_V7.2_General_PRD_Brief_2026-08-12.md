---
title: NextGen Beauty Studio v0.7.2 General PRD Brief
type: prd
status: active
version: v0.7.2
created: 2026-08-12
updated: 2026-08-14
evidence: planned
aliases:
  - v0.7.2 General PRD Brief
  - Nail Decision Studio General PRD
tags:
  - nextgen-beauty
  - v7-2
  - community
  - studio
  - decision-ux
  - rendering
related:
  - "[[文档规则与索引]]"
  - "[[重要变更与PR基线记录]]"
  - "[[README_V7_系统架构总览与权威文档索引]]"
  - "[[NextGen_Beauty_产品需求池]]"
  - "[[Community_V7.2_Roadmap_2026-08-12]]"
  - "[[Studio_Editor_V7.2_Roadmap_2026-08-12]]"
  - "[[2026-08-12_设计决策工具与欧美女性社区竞品分析]]"
  - "[[V7_系统架构与领域合同]]"
  - "[[Studio_Editor_V7_工艺步骤与内容架构_PRD_2026-08-07]]"
  - "[[V7_版本治理与迁移矩阵]]"
  - "[[ADR-GEO-001_几何运行时与渲染制造边界]]"
  - "[[v0.7.2_甲面曲面组合与几何运行时合同]]"
  - "[[Community_标签与Studio_法式工具_PRD_2026-08-14]]"
  - "[[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]"
supersedes:
  - "[[NextGen_Beauty_Studio_V7.1_General_PRD_Brief_2026-08-11]]"
superseded_by: []
source_refs:
  - /Users/henry.macbook/.codex/attachments/9d3d6f28-ec96-4f77-a9ed-192e5e2b4f74/pasted-text.txt
  - /Users/henry.macbook/Desktop/nextGen-Beauty/NextGen_Beauty_Studio_V7.1_General_PRD_Brief_2026-08-11.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@5ae90852f748dfbc22e2aa1f06e6d93209b6d5f2
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@e717097c703b0b80ceca24c433d36bc89e5a619a
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@356cf939fbc8cfffe388dc9ac53c80f8ed904f25
---

# NextGen Beauty Studio v0.7.2｜General PRD Brief

> 战略升级：Community 从“灵感发现与设计分发层”进一步扩展为面向消费者的 **Nail Decision Studio**；Studio 继续作为专业创作、版本、渲染、确认和履约真源。  
> 当前代码核验：2026-08-14，`nextGen-beauty-tech/main @ 356cf93`。Publish/Approval/Governance、3D Foundation、Registry V2、材质/纹理投影和四套 Look 已进入本地 main，但仍是本地/原型/模拟边界；本次更新没有把 Roadmap、SVG / 2.5D / Three / Boolean/PBR 模拟升级为制造证据。  
> 文件名保留 `V7.2` 仅用于 WikiLink 稳定；正文当前基线统一为 `v0.7.2`。
> 研究边界：行业和竞品机制来自截至 2026-08-12 的官方/可靠来源；公司自报能力、用户量和商店描述不等于独立实测或 PMF，详见 [[2026-08-12_设计决策工具与欧美女性社区竞品分析]]。

## 1. 执行摘要

### 1.1 v0.7.2 的产品结论

NextGen 不是再做一个图片 Feed，也不是给消费者一套缩小版专业 Editor。v0.7.2 将两个体验分开：

```text
Consumer / Community
Discover → Compare → Combine → Decide

Professional / Studio
Create → Technique → Render → Approve → Fulfill
```

Community 帮助用户从“有很多喜欢的图”走到“明确选这一套，并知道保留了什么、改变了什么”；Studio 把这个意图确定性地转成合法的新 DesignVersion。

### 1.2 v0.7.2 的首个核心闭环

```text
Explore / Search
→ Save to private NailBoard
→ Add 2–4 Looks to Compare Tray
→ Keep / Change
→ Lock & Explore
→ Mix & Match
→ Studio validates, saves a controlled EditorDocV7 revision and releases a derived DesignVersion
→ Return fixed preview
→ Final choice + fixed preview
```

首个 Demo 只承诺三个新模块：

1. Variant Compare / Compare Tray。
2. Keep / Change + Lock & Explore。
3. Mix & Match → 新 DesignVersion。

Set Builder、Accent Planner、Pairwise Choice、Nail Brief、AR 和完整 3D 不阻塞首个闭环。

### 1.3 AI 裁决

AI 已适合进入“解释与辅助”技术 Beta，但不拥有设计真源：

```text
Reference Images
→ multimodal interpretation
→ NailBriefV1
→ schema / rule / capability validation
→ user confirmation
→ new DesignVersion
```

LLM 是 Interpreter，不是 Geometry Engine。精确坐标、图层合法性、十指组合、设计版本和制造参数由 Studio 与确定性工程合同负责。

## 2. 版本与文档关系

```text
Product / Architecture Baseline = v0.7.2
├── EditorDoc schemaVersion = 7
├── DesignVersion / PublishedLook / NailBoard = 独立版本
├── DecisionSession / DecisionIntent / NailBrief = v0.7.2 planned contracts
├── Scan / NailTwin = 独立 SemVer
├── Manufacturing / Artifact / Device = 独立 SemVer
└── Vendor Protocol = 厂商/程序独立版本
```

v0.7.2 是产品范围与 Roadmap 升级，不触发 `EditorDoc schemaVersion = 8`，也不把设备、制造或扫描合同机械改成 7.2。

v0.7.2 PRD 保留为历史权威快照；本页取代其 active General PRD 地位。v0.7.2 三份 PR 进展表继续记录原执行线，不机械重命名。

## 3. 用户与 Jobs to Be Done

### 3.1 Consumer / Client

当我为一次具体场景选择美甲时，我希望：

- 把分散灵感放进私密 Board，而不是在截图、相册和聊天之间丢失上下文；
- 看懂候选之间到底差在哪里；
- 表达“保留这个、改变那个”，而不用学专业图层；
- 从多个 Look 组合我真正想要的十指方案；
- 知道最终确认的是哪个固定版本，预览和实物结果各是什么证据。

### 3.2 Creator / Nail Tech

当我把顾客意图转成专业方案时，我希望：

- 直接获得结构化约束和来源，而不是重新解读聊天记录；
- 使用 canvas-first、参考图、快捷动作和非破坏图层快速创作；
- 使用当前已实现的 current / selected / mirror / all 操作十指并保留单指覆盖；持久 group 属于 planned；
- 派生、比较、恢复版本，不覆盖已确认或已发布作品；
- 以可解释 fidelity 输出 2D / 3D 预览，而不对实体效果过度承诺。

### 3.3 Salon / Operator

当我从咨询推进到服务和履约时，我希望：

- 看到顾客的最终选择、未决项、授权和固定版本；
- 将审批、服务、RealResult 与实际采用版本关联；
- 区分视觉预览、扫描/适配、制造验证和真实结果；
- 在公共发布、版权和客户隐私上有可审计门禁。

## 4. 当前 main 交叉验证

### 4.1 Git 与产品边界

| 项目 | 2026-08-14 核验事实 |
|---|---|
| 仓库 | `/Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech` |
| main | `356cf939fbc8cfffe388dc9ac53c80f8ed904f25` · `fix(render): preserve immutable per-finger look previews` |
| 状态 | 未 push、未配置 remote；工作树保留用户已有 `AGENTS.md` 修改及 `.obsidian/`、`docs/architecture/`、Vite timestamp 未跟踪项，不能写成 clean |
| Community 路由 | `/`、`/search`、`/official`、`/creators`、`/look/:lookId`、Boards、Profile；旧 `/community` 口径已过时 |
| Studio 路由 | `/studio` 下承载 Wizard、Templates、Editor 与 Preview；产品面与 Community 分离 |

本轮只读核验源码与已有 evidence，没有重新执行当前 HEAD 的测试。因此本页不新增“全部测试已复跑通过”的声明。

### 4.2 Community 能力矩阵

| 能力 | 当前事实 | 证据状态 | v0.7.2 裁决 |
|---|---|---|---|
| 独立产品面与路由 | Explore/Search/Look/Boards/Profile/Official/Creators 已路由 | `integrated prototype` | 保留 Community-first 产品边界 |
| Explore / Search | URL 状态、旧筛选、排序和查询已实现；仍是旧 taxonomy，French 为主风格，五入口/theme/technique/rights/makeability 未实现 | `integrated over fixtures` + `selected/planned` | C0.5 按合同→迁移→query→UI 顺序交付 |
| DesignVersion / PublishedLook / Remix | 严格合同、不可变引用与 publication gate 已有 | `architecture-golden` | 运行时发布写链仍需完成 |
| NailBoard | 新建、排序、重命名、visibility、token share/revoke、revision 已有；local identity + localStorage | `local prototype` | C0 身份/后端；C1 Shortlist/Compare |
| Use / Customize | canonical versioned intent 与 legacy approximate intent 可进 Studio；Community 不直接写 Editor store | `integrated local path` | 复用为 DecisionIntent 握手基础 |
| Publish | Studio release、PublishPackage、三步 PRIVATE/UNLISTED 发布与 PUBLIC gate 已形成 local application-service path | `integrated local prototype` | 真实远端 identity/repository/authority 仍缺 |
| Approval | ShareLink、ApprovalEvent、ConfirmedSnapshot 与免登录固定版本确认 UI 已进入 main | `integrated local prototype` | 真实远端不可变存储、身份、通知与服务闭环仍缺 |
| RealResult | 无类型、仓储或履约记录 | `not implemented` | C4，不得由 Preview 伪造 |
| Governance | Visibility、copyright/source/moderation、revision 绑定与 PUBLIC gate 已有；无真实运营审核队列/举报/申诉服务 | `integrated local domain gate` | PUBLIC UGC 生产化仍受 C0 门禁 |

### 4.3 Decision UX

当前源码未发现以下领域合同或产品流程：

- Variant Compare / Compare Tray。
- Keep / Change / Lock & Explore。
- Mix & Match / Nail Set Builder / Accent Finger Planner。
- Pairwise Choice / What Changed / Try One Nail。
- Nail Brief Composer / Style Passport / DecisionSession。

邻近能力不能冒充：

- RemixRelation 是完整来源 Look → 派生版本血缘，不是单指 Mix & Match。
- Studio 跨指复制/同步是专业 authoring，不是 C 端 Set Builder。
- Editor element `locked` 是防误操作，不是“锁定审美维度后探索”。
- Customer Preview 的 session-only 试色不是多 Look Variant Compare。

因此这些模块在 v0.7.2 均标为 `planned / research`。

### 4.4 Studio 与 Procreate-like 能力

| 能力 | 当前事实 | v0.7.2 裁决 |
|---|---|---|
| Canvas-first | DESIGN v1.1 已明确画布常驻、Panel 随空间收敛；Wizard 当前 HEAD 有响应式 evidence | `integrated layout`，继续加固 |
| 自由绘制 | V7 SVG 画布已有 brush、eraser、line/shape、mask、select/move 和 Pointer Events | `prototype authoring` |
| Procreate 深层体验 | 未发现 Reference Companion、QuickMenu、压力/倾角、多指手势、QuickShape/ColorDrop 或自定义 gesture | `planned`，拆成 S2 能力清单 |
| 历史与版本 | revision/history/undo/redo/autosave、immutable release core 已有 | 缺面向 Decision 的 branch/diff/restore 流程 |
| V7 Editor 渲染 | Background、Flat、Surface、Decoration、Finish 主要为 React/SVG 2D/2.5D | `integrated + simulated` |
| 结构化法式 | 当前只有 `widthRatio / curvature / color`，多处视图重复生成简化路径 | `selected / planned`；保持 schema 7，新旧合同与 canonical path 先行 |

### 4.5 3D 能力

| 能力 | 当前事实 | 证据边界 |
|---|---|---|
| Petal Veil | 使用 `THREE.WebGLRenderer`、`MeshPhysicalMaterial`、PMREM、ACES 与 shadow | 程序化几何的 `simulated prototype`，非 canonical GLB/扫描网格，制造未验证 |
| Mercury / Starfish adapters | 导入 Three，承担 revision/id/evidence 与 GLB 下载/校验边界 | 未创建通用 scene/mesh/renderer，不是完整 3D 渲染 |
| V7 Decoration GLB | 有 manifest、checksum 与 `SIMULATED` asset refs | Editor 仍以 2D/2.5D approximate 预览；非制造证明 |
| V7 单指 PBR | 顾客确认页单指 PBR、Registry V2、材质/纹理投影、逐指装饰和联合 bounds 已进入 main；四套 Look 40/40 | `integrated simulated`；cover 为 `APPROXIMATE / CONCEPT`，非实体/制造 |
| 通用 V7 3D | 尚无准确 EditorDocV7 → 曲面 scene compiler、十指 PBR、同光照 variant compare 或实体校准 | `planned` |
| 3D Geometry Spike | 隔离分支已证明受控 Boolean 与 watertight Almond candidate；C 弧、arch、厚度、UV/face provenance 和制造均未签收 | `simulated candidate / spike-only` |
| Geometry Runtime 合同 | ADR-GEO-001、Schema/Golden Fixture、kernel parity 与 Registry V2 已进入 main | `architecture-golden`；扫描贴合、物理/制造晋级仍未签收 |

v0.7.2 的准确表述是：**已有 NailSurface/Registry 架构合同、单指 Three/PBR 模拟、严格 GLB 资产校验、2D/2.5D V7 渲染和四套逐指 Look；尚未形成准确曲面映射、通用十指 PBR、物理材料校准或 Manufacturing Compiler。**

## 5. 行业与竞品交叉验证

### 5.1 设计工具启示

- Procreate 的 Reference Companion、QuickMenu、分层材质和 Lighting Studio 支持“参考常驻、快速动作、非破坏编辑和受控光照”；不支持直接照搬为几何/制造合同。
- Figma 的 properties、modes 和 branching 支持从 immutable 基线派生和比较候选；完整 branch/merge 心智对消费者过重。
- CLO Colorway 和 Simulation 支持变体、联动属性与速度/质量分档；布料物理不能迁移成甲片物理。
- Substance Smart Material 支持可复用材质栈；完整 bake 管线不适合直接进入 MVP。
- Shapr3D 支持参数历史、Visualization 和固定版本分享；完整 CAD 只应留在专业/制造侧。

### 5.2 社区启示

- Pinterest Boards/Collage 证明私密收藏、轻量组合、来源与 Remix 是成熟机制。
- Sephora 2026 年退出宽泛 Forum、保留 Gallery/Reviews/Q&A，是“优先任务型视觉社区、暂缓泛论坛”的强反例，但不是普遍因果证明。
- LTK、Fresha 将 Creator/Salon Profile 与服务/商业连接；v0.7.2 应先验证设计和服务转化，站内交易后置。
- YouCam Nails、Nailterest、NailAward、ArterSpace、Nudio 等公开产品说明表明“逐指设计、试戴、Board、专业作品、顾客咨询”正在趋同；其规模、准确度与 PMF 多为公司自报或弱信号。

### 5.3 差异化假设

```text
Attributed PublishedLook
→ Private NailBoard
→ DecisionSession
→ Deterministic Studio Materialization
→ Immutable DesignVersion
→ Approval Snapshot
→ RealResult / Salon / Manufacturing evidence
```

差异不在于“也有 Feed、AI、AR”，而在于从灵感到专业版本再到真实结果的可追溯链。该结论仍需真实漏斗验证。

## 6. 产品范围

### 6.1 v0.7.2 P0

#### Community / Decision

- C0：运行时 PublishedLook/Publish 真源、公共 visibility/governance、Approval schema/permission/idempotency 门禁、事件基线；Approval 产品流属于 C4/S4。
- C0.5：推荐/甲型/风格/场景/主题五入口；唯一 discovery metadata、稳定 ID/双语/alias/migration、French 技法、URL 恢复、版权与可制作性 fail closed。详见 [[Community_标签与Studio_法式工具_PRD_2026-08-14]]。
- Compare Tray：2–4 候选、十指同尺度、结构化差异。
- `DecisionSessionV1` 候选合同：私密、可过期、只保存引用/约束/动作。
- Keep / Change：shape、length、palette、finish、pattern/element、nail slots。
- Lock & Explore：只改变 unlocked dimensions，确定性、可解释。
- Mix & Match：全局属性或单指来源组合，生成新版本。
- 正确的 DesignVersion release lineage，以及独立 `CompositionRelationV1 + FingerSourceRefV1[]` 全量 provenance。

#### Studio

- `DecisionIntentV1 → DerivedDesignRecipeV1 → controlled EditorDocV7 revision → existing release service → DesignVersionV1` 的确定性握手。
- 结构化法式：在 `EditorDoc schemaVersion: 7` 内分离新旧模型，统一 canonical path；五预设、锚点/history/scope 和三视图逐项验收；准确三维贴合与实体厚度后置。
- Confirm/Cancel/Conflict/Asset/Capability 的原子状态与可解释失败。
- Variant branch、Diff、Restore-as-new-version 基础。
- current / selected / mirror / all 作用域一致性；持久 group 需另行签收数据模型。
- 现有 renderer / geometry / fidelity inventory 与证据标签。
- 基础非破坏 Finish Stack：color、roughness、metalness、pattern/decal、mask。
- Interactive / High Quality / Physical Validation 三层口径，其中第三层不是 renderer 档位。

#### Governance

- Board / DecisionSession 默认 PRIVATE。
- 手部图片、NailProfile、扫描/尺寸与公开 Look 分域。
- PUBLIC UGC 前置 copyright/source/moderation、Report/Block/Mute/Appeal 运营合同。
- AI、Remix、赞助、赠品、Affiliate 显著披露。

### 6.2 v0.7.2 P1

- Nail Set Builder、Accent Finger Planner、Try One Nail、What Changed。
- Reference Companion、Quick Actions、Mask、结构化 Pattern、模板 editable/locked properties。
- 统一 EditorDocV7 → PBR read model、十指 Viewer、2D fallback、camera/light presets。
- 2/4 宫格与 3D Variant Compare。
- Customer-ready Output、固定版本分享、Approval Snapshot、评论锚点。
- Nail Brief Composer 技术 Beta、Auto Tag、Style Summary、Ask This Look、Palette + 长文本检索。
- Creator/Nail Tech/Salon service profile、教程、外部预约与 RealResult。

### 6.3 P2 / Research

- Pairwise Choice、One Look Multiple Shapes 的用户/技术实验。
- Collaborative Board、Follow、Challenge、Creator Analytics。
- 用户手部 AR/VTO、ray tracing、实测材质校准、制造风险热区。
- Composition AI、RealResult similarity、capability-aware adaptation。
- 站内预约、支付、佣金、Creator Shop、品牌/材料/Affiliate。

### 6.4 Non-goals

- 泛 Forum、陌生人 DM、直播或群组优先开发。
- Community 第二套专业图层 Editor。
- 无约束 AI 生图作为 v0.7.2 主链。
- 图片或 LLM 直接写 Design。
- AI 生成最终制造参数。
- 把 AR/Preview/GLB/SVG/Three 输出宣传为 Fit、Approval、RealResult 或 Manufacturing Validation。
- 为 v0.7.2 机械升级 EditorDoc、Scan、Manufacturing、Device 或 Vendor schema。

## 7. 功能需求

### 7.1 Compare Tray / Variant Compare

**输入**：2–4 个满足 readiness 的 PublishedLook / DesignVersion refs。  
**展示**：十指、单指详情、shape、length、palette、finish、technique、source/evidence、unknown。  
**约束**：同尺度/顺序；3D 候选同 camera/light；不为缺失字段猜值。  
**动作**：移除、排序、Keep/Change、Open source、继续 Mix。  
**写入**：只写 DecisionSession；不写 EditorDoc 或来源版本。

### 7.2 Keep / Change + Lock & Explore

```text
KEEP = locked dimension
CHANGE = variable dimension
```

- 支持结构化 chips + 可选备注。
- 只有结构化约束进入 Studio；备注作为上下文，不拥有几何语义。
- 至少一个 variable 才能 Explore。
- 每个候选显示本次改变的维度与原因。
- 规则不合法或能力不足时明确说明，不静默替代。

### 7.3 Mix & Match

- 可选择全局 shape/length/palette/finish，或指定手指来源。
- Preview transaction 不写 canonical doc。
- 冲突按 geometry → asset → rights → capability → composition 顺序校验。
- Confirm 经受控 EditorDocV7 draft/revision + release 一次创建一个新版本；Cancel 创建 0 个 revision / version。
- 派生版本的 `parentVersionId` 继续表示同一 Design 的前一 release；planned CompositionRelation 独立记录全部外部来源版本、每指来源、规则版本和 fallback。

### 7.4 Set Builder / Accent / Try One Nail

- 十指 Slot 显示 `empty / ready / conflict / approximate / unavailable`。
- Accent Planner 是确定性规则模板，不是 AI 直接排布。
- Try One Nail 后必须显式选择是否 apply to selected / mirror / all；group 待分组合同签收。
- 单指 override 永远不因后续批量操作而静默丢失。

### 7.5 What Changed / Restore

- Diff 范围：design properties、elements、nailId、geometry refs、assets、finish/material、renderer config。
- Restore 旧版时创建 derived version，并保留 restore source。
- 已审批/发布版本永不原地修改。

## 8. 候选领域合同

以下是 PRD 级候选，不在 ADR/Schema 签收前宣称已实现。

### 8.1 DecisionSessionV1

```ts
type DecisionSessionV1 = {
  decisionSessionId: string;
  ownerIdentityId: string;
  visibility: 'PRIVATE';
  revision: number;
  rulesetVersion: string;
  candidateRefs: Array<{
    publishedLookId?: string;
    designVersionId: string;
    sourceType: 'OFFICIAL' | 'CREATOR' | 'SALON' | 'OWN_DESIGN';
  }>;
  constraints: {
    lockedDimensions: Array<{
      dimension: 'SHAPE' | 'LENGTH' | 'PALETTE' | 'FINISH' | 'PATTERN' | 'ELEMENT';
      valueRef: string;
    }>;
    variableDimensions: Array<'SHAPE' | 'LENGTH' | 'PALETTE' | 'FINISH' | 'PATTERN' | 'ELEMENT' | 'NAIL_SLOTS'>;
    fingerChoices: Array<{
      targetNailId: string;
      sourceDesignVersionId: string;
      sourceNailId: string;
    }>;
  };
  actions: Array<{
    actionId: string;
    kind: 'ADD_CANDIDATE' | 'REMOVE_CANDIDATE' | 'LOCK' | 'UNLOCK' | 'SET_FINGER_SOURCE' | 'SELECT_FINAL';
    createdAt: string;
  }>;
  selectedCandidateRef?: {
    designVersionId: string;
    publishedLookId?: string;
  };
  expiresAt?: string;
};
```

Roadmap 只引用本节作为候选合同真源；`revision` 支持乐观并发，`rulesetVersion` 与 typed constraints/finger choices 支持确定性校验。自由备注不进入这些几何/版本字段。

### 8.2 DecisionIntentV1

最少包含：session、candidate version refs、locks/variables、finger choices、source rights、asset versions、return target、TTL、ruleset version。

Studio 消费前重新校验身份、版本、资产、权限、geometry 和 capability；Community 的“ready”不是 Studio 的最终合法性证明。

确定性写入顺序固定为：

```text
DecisionIntentV1
→ preflight + DerivedDesignRecipeV1
→ isolated EditorDocV7 preview transaction
→ user confirm
→ saved EditorDocV7 revision
→ existing Studio release service
→ immutable DesignVersionV1
```

PRD 不新造绕过 `releaseSavedEditorDocV7` 的第二条版本 writer；具体 API 名与原子边界由 ADR/Schema 签收。

### 8.3 CompositionRelationV1 / FingerSourceRefV1

当前 `DesignVersionV1.parentVersionId` 是单值，`RemixRelationV1` 是单来源 → 单目标。v0.7.2 不直接改变既有 V1 字段语义。多来源 Mix 使用独立 planned relation：

- `targetDesignVersionId`；
- 可选 `baseSourceDesignVersionId`，仅表示本次组合的起始候选，不改变目标版本的 release lineage；
- `sourceDesignVersionRefs[]`；
- `fingerSourceRefs[]: { targetNailId, sourceDesignVersionId, sourceNailId, elementRefs, transform?, fallback? }`；
- source rights / attribution snapshot；
- materialization ruleset version 与 createdAt。

具体 schema、唯一性、删除/撤权后的再发布策略由 ADR 决定。

### 8.4 NailBriefV1

最少包含：

- shape / length / palette / finish / technique / occasion；
- global composition 与 per-finger suggestions；
- source image refs 与权利状态；
- 每字段 confidence、unknown、conflict；
- model/provider/version、生成时间、用户修改；
- `status = DRAFT | USER_CONFIRMED | REJECTED`。

NailBrief 不是 DesignVersion，不能进入制造链。

## 9. Studio 创作与 3D 体验

### 9.1 Procreate-inspired，不是 Procreate clone

验收能力：

- 画布常驻、Panel 按空间降级。
- Reference Companion：Board/图片只读参考与显式导入。
- 可发现的 Quick Actions：undo/redo、zoom/fit、吸色、临时工具、作用域。
- 图层/Mask/finish 非破坏编辑。
- Pattern 的 mirror/repeat/rotate/scale/spacing/offset/palette 参数。
- Web/鼠标/触控/键盘/触控笔替代入口；隐藏手势不是唯一入口。
- 390 / 768 / 1024 / 1280 / 1366 / 1440 关键视口主链可用。

压力、倾角、高级笔刷引擎、多指手势等只有真实硬件和 E2E 证据后才能标为支持。

### 9.2 3D 分阶段

```text
S0 renderer truth
→ ARCH NailSurface / OperationGraph / KernelPort contracts
→ GEO kernel parity + geometry registry V2
→ S3 unified PBR read model / viewer
→ S4 fixed-version compare/output
→ S5 AR / measured material / physical validation
```

统一 Viewer 需覆盖：

- canonical geometry / revision / checksum；
- PBR material binding 与 Finish Stack；
- camera、lighting、environment、tone mapping；
- GLB load/error/context lost；
- 2D fallback；
- device/GPU matrix、首帧、FPS、内存与 HQ 出图；
- fidelity 原因与制造证据分离。

首批产品入口冻结在 Editor 完成设计后的顾客确认/只读预览页。页面保留 `十指总览 / 单指聚焦` 与 `2D 设计 / 模拟 3D` 两组正交选择：十指总览的模拟 3D 继续沿用现有十指 SVG/2.5D/finish composite；只有“单指聚焦 + 模拟 3D”进入 v0.7.2 Geometry/PBR runtime。该入口只读且 writer-zero，不代表 Approval 已发生；WebGL、geometry 或 asset 不可用时必须留在当前指并回退可解释的 2D/2.5D。

Geometry Runtime 与 PBR Viewer 是两条相邻但独立的能力线：前者负责 outer/inner/rim、C 弧、arch、法向厚度、conform/Boolean 与属性血缘；后者负责材质、环境、灯光、相机、tone mapping 和视觉证据。Manifold 仅为 `GeometryKernelPort` 候选 Adapter，不能替代曲面合同或视觉系统。

## 10. Community 与 Studio Roadmap

### 10.1 Community Roadmap

| 阶段 | 目标 |
|---|---|
| C0 | PublishedLook/Publish、Approval 合同/权限门禁、Governance/Analytics truth |
| C0.5 | 五入口 Discovery Taxonomy、French 技法迁移、URL/filter、rights/makeability evidence |
| C1 | Compare Tray、Keep/Change、Lock & Explore |
| C2 | Mix & Match、Try One Nail、Set Builder、Accent Planner |
| C3 | What Changed、Pairwise 实验、Nail Brief 与轻 AI |
| C4 | Fixed approval 产品流、RealResult、Creator/Salon service loop |
| C5 | Collaborative/growth/commerce research |

详见 [[Community_V7.2_Roadmap_2026-08-12]]。

### 10.2 Studio Roadmap

| 阶段 | 目标 |
|---|---|
| S0 | Current authoring/rendering/fidelity truth |
| S1 | DecisionIntent deterministic materialization、version/diff/provenance |
| S2 | Procreate-inspired creation core、structured pattern/finish 与结构化法式工具 |
| S3 | Canonical real-time 3D、快/高质量预览、fallback/performance |
| S4 | Variant compare、customer output、fixed approval |
| S5 | AR、实测材质、制造约束与实体证据 |

详见 [[Studio_Editor_V7.2_Roadmap_2026-08-12]]。

### 10.3 跨域依赖

```text
C1 Compare / Constraints
    ↓ DecisionIntent
S1 Materialization / Version
    ↓ derived preview
C2 Decision completion
    ↓ approved DesignVersion
S4 Approval Snapshot / Output
    ↓ service / fulfillment evidence
C4 RealResult
```

Community 私密 Decision Beta 可与 C0 部分后端并行；Creator PUBLIC UGC 和真实 Approval 必须等待 C0 治理/身份/版本门禁。

## 11. 成功指标

### 11.1 决策漏斗

```text
look_view
→ save_to_board
→ compare_started
→ constraints_set
→ mix_started
→ decision_completed
→ open_in_studio
→ derived_design_created
→ approval_completed
→ real_result_published
```

### 11.2 核心指标

| 指标 | 定义 | v0.7.2 口径 |
|---|---|---|
| Decision Completion Rate | compare_started 中产生 final choice 的比例 | 先建真实基线，不凭附件设虚构目标 |
| Time to Decision | compare_started → decision_completed 中位时长 | Compare/Keep/Mix 分段看 |
| Reversal Rate | 24h 内撤回/重开 final choice | 防止只追求速度 |
| Studio Handoff Success | final choice → derived version 成功率 | 按 asset/geometry/rights/capability 分类失败 |
| Provenance Completeness | 派生版本 release lineage + CompositionRelation + 单指来源完整比例 | P0 = 100% |
| Writer Integrity | final materialization 前 EditorDoc 写入数 | P0 = 0；确认后仅一次受控 draft/revision + release |
| Approval Integrity | Approval 绑定 immutable DesignVersion 的比例 | P0 = 100% |
| RealResult Integrity | RealResult 绑定实际采用版本和证据类型的比例 | P0 = 100% |

### 11.3 AI Beta 指标

- 字段准确率与 unknown recall。
- 人工修改/拒绝率。
- schema 合法但语义错误率。
- 非法 geometry/material/manufacturing 建议率。
- 来源可追溯率。
- 延迟、成本与不同人群/风格覆盖。

不在建立评测集前承诺“Beta 8/10”“无需训练”或精确实物还原率。

AI C3 与 3D S3 的数值门禁采用“先基线、后签收阈值”：开发开始前分别以评测 ADR 和性能 ADR 固定样本/设备矩阵与阈值；未签收或未达到时阶段保持 `in progress`。AI 至少覆盖字段 precision/recall、unknown recall、非法建议率、人工修改/拒绝、P95 延迟与成本；3D 至少覆盖首帧、交互 FPS、P95 HQ 出图、峰值内存、context-loss 恢复与 fallback 成功率。

## 12. 验收门禁

### 12.1 Decision Beta

- 从私密 Board 加入 2–4 个可用候选。
- Compare 使用同十指顺序/尺度，缺值不猜测。
- Keep/Change 产生结构化 constraints。
- Lock & Explore 只改变 unlocked dimensions。
- Mix & Match 在 Studio preflight 后，Confirm 只执行一次受控 EditorDocV7 revision + release 并创建一个新版本；Cancel 创建 0 个 revision / version。
- DesignVersion release lineage、CompositionRelation、每指来源与 rulesetVersion 完整。
- 返回 Community 后 final preview 引用新 DesignVersion。
- 刷新/过期/无权限/资产缺失/版本过期均有可解释状态。

### 12.2 Studio UX

- 空白 0→1、参考→导入→编辑→派生→保存主链完整。
- current/selected/mirror/all 作用域清晰且可撤销；若引入 group，须另有已签收分组合同。
- 不可逆动作显式确认并有版本恢复。
- 390–1440 关键视口无阻断、无横向溢出；touch/focus/keyboard 基础可达。
- Reference Companion 不暗写设计；导入时保存来源/权利。

### 12.3 3D / Output

- 同一 DesignVersion 驱动 2D 和 3D read model。
- Editor 完成设计进入顾客确认页后，十指模拟组合保持现有实现；单指聚焦的“模拟 3D”是 v0.7.2 3D Foundation 唯一首批产品入口。
- 四态切换均保留当前设计、手指和确认上下文；只有单指模拟 3D 加载新 runtime，且所有切换 writer-zero。
- Interactive/HQ 使用同内容，差别仅在质量配置。
- WebGL/asset/context failure 有 2D fallback，不形成空白死路。
- Variant Compare 固定 camera/light/scale。
- 分享快照固定 renderer/camera/light/fidelity。
- UI 显著区分 simulated preview、approval、real result 与 manufacturing evidence。

### 12.4 Public / Governance

- PRIVATE 默认与权限回归。
- PUBLIC 内容必须通过身份、来源、版权、AI/Remix 披露与运营 moderation gate。
- Report/Block/Mute/Appeal、删除、导出、深链策略可演示/审计。
- 手部图片去 EXIF，不公开精确位置、预约和扫描/尺寸。

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Decision UX 变成第二个 Editor | C 端认知负担和双真源 | Community 只保存 intent/refs；专业编辑全部在 Studio |
| Mix 产生非法组合 | 视觉好看但无法表达/履约 | Studio deterministic preflight；显式 conflict；禁止静默 fallback |
| 3D 漂亮但不可信 | 误导顾客和门店 | 固定 fidelity；同光照比较；Preview/Physical/RealResult 分层 |
| AI 输出语义错误 | 错误材料、技术或几何进入设计 | Schema + rule + capability + user confirmation；无直接 writer |
| 公共 UGC 先于治理 | 版权、骚扰、隐私和运营风险 | C0 PUBLIC gate；P0 不开放陌生人 DM；最小数据留存 |
| Roadmap 挤压 v0.7.2 主链 | Approval/Publish 继续缺失 | C0 先收敛真源；私密 Decision Beta 才允许并行 |
| Procreate 模仿过度 | 引入无关复杂绘画能力 | 用任务与验收清单，不用品牌相似度当目标 |

## 14. 待决策项

1. `DecisionSessionV1` 的持久化、过期和跨设备策略。
2. Compare Tray 上限固定 4 还是按设备降为 2。
3. Keep/Change 的维度集合与自由文本进入 Studio 的边界。
4. 单指 Mix 是否允许跨 geometry，及哪些元素可重投影。
5. PUBLIC UGC 上线前的年龄策略与 Creator verification 方案。
6. Unified PBR viewer 首批覆盖哪些签收模板，Petal Veil 是否作为技术基线或独立实验。
7. Interactive/HQ 性能 SLO 和支持设备矩阵。
8. Nail Brief Beta 的模型/provider、评测集、预算和数据保留策略。
9. Approval 后修改、撤回与 RealResult 版本关系的 ADR。

## 15. 最终产品原则

1. 先帮助用户做决定，再帮助系统生成更多选择。
2. Community 表达意图；Studio 负责合法创作和版本。
3. AI 解释与排序；规则、Schema 和工程合同决定合法性。
4. 每个派生结果都可追溯、可比较、可恢复。
5. 2D、3D、Approval、Fit、Manufacturing、RealResult 永远分证据等级。
6. 公共社区先有隐私、版权、审核与申诉，再扩大互动和商业化。
7. v0.7.2 Roadmap 只有在代码、自动化、走查和对应证据完成后才升级为 implemented。
