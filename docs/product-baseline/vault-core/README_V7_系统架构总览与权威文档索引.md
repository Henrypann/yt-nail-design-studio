---
title: NextGen Beauty v0.7.2 系统架构总览与权威文档索引
type: index
status: active
version: v0.7.2
created: 2026-08-07
updated: 2026-08-21
evidence: mixed
aliases: [V7 系统架构总览, V7 权威文档索引]
tags: [architecture, index, v7-2]
related:
  - "[[文档规则与索引]]"
  - "[[重要变更与PR基线记录]]"
  - "[[NextGen_Beauty_产品需求池]]"
  - "[[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]]"
  - "[[Community_V7.2_Roadmap_2026-08-12]]"
  - "[[Studio_Editor_V7.2_Roadmap_2026-08-12]]"
  - "[[ADR-GEO-001_几何运行时与渲染制造边界]]"
  - "[[v0.7.2_甲面曲面组合与几何运行时合同]]"
  - "[[Community_标签与Studio_法式工具_PRD_2026-08-14]]"
  - "[[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]"
  - "[[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]]"
  - "[[W34_双分支开发计划_v1_Studio法式与资产运营_2026-08-21]]"
  - "[[W34_0821扫描设计全流程审查报告_v2_2026-08-21]]"
supersedes: []
superseded_by: []
source_refs:
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@5ae90852f748dfbc22e2aa1f06e6d93209b6d5f2
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@4d38821b4de419c9638c92baf85946e6b96fb5bb
  - /Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-v0-7-2-3d-foundation@5e78a6d21298254811df00d4d371133ed5a00f1a
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@356cf939fbc8cfffe388dc9ac53c80f8ed904f25
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech
  - "git-commit: 3f0fb9bc1f39793d300bd4216c637584e23161c9"
---

# NextGen Beauty v0.7.2｜系统架构总览与权威文档索引

> 文档版本：v0.7.2
> 创建日期：2026-08-07；更新日期：2026-08-21
> 产品代码基线：`main @ 3f0fb9b`；已包含 3D/四套 Look、Community TAX-01～04 与 Wizard WIZ-01～04 的本地提交链，未 push；主工作树既有修改与未跟踪项保持不动
> 状态：Architecture baseline / contract review
> 适用范围：C 端 Community、Salon SaaS、Studio、Editor、顾客确认、扫描、制造编译、生产执行、设备接入与质量追溯
> 文件名中的 `V7` / `V7.2` 保留，用于维持 WikiLink 与历史引用稳定；正文中的当前产品/架构版本统一写作 `v0.7.2`。

## 1. 本索引的作用

本索引是 v0.7.2 处理产品、架构、端到端链路和设备协议问题的第一入口。v0.7.2 继承 V7/V7.1 的十域架构、EditorDocV7 与制造边界，并将 Community 扩展为面向 Consumer 的 Nail Decision Studio；Studio 继续是专业设计与版本真源，也是渲染及履约编排入口，但不覆盖 Geometry、Manufacturing、Artifact 或 Device 的分域真源。

V7 不是把旧文档中的所有 `schemaVersion` 机械改成 7。需要区分：

```text
Architecture Baseline v0.7.2
├── EditorDoc schemaVersion = 7
├── Scan Contract = 1.x（独立 SemVer）
├── Canonical Manufacturing Contract = 1.x（独立 SemVer）
├── Device Message Contract = nextgen.beauty.device.v1
├── Artifact / Renderer Manifest = 各自独立版本
└── Vendor Protocol = 按厂商与程序独立版本
```

统一对齐的方式是在 active 文档和兼容矩阵中声明 `architectureBaseline: v0.7.2`，不是破坏性地把所有合同改成 0.7.2。历史文件名、PR ID 和既有快照不机械改写。

## 2. v0.7.2 权威上下文顺序

处理系统架构、Editor 到制造、设备协议或端到端问题时，按以下顺序阅读：

1. **本文件**：范围、事实状态、阅读顺序和版本关系。
2. [产品需求池](./NextGen_Beauty_产品需求池.md)：跨 Community / Studio 的需求真源、状态和证据边界。
3. [v0.7.2 General PRD Brief](./NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12.md)：Decision UX、Procreate-like、3D、AI 与成功指标。
4. [Community v0.7.2 Roadmap](./Community_V7.2_Roadmap_2026-08-12.md) 与 [Studio / Editor v0.7.2 Roadmap](./Studio_Editor_V7.2_Roadmap_2026-08-12.md)：分域顺序和跨域握手。
5. [Community 标签与 Studio 法式专项 PRD](./工作记录_2026-W33_08-10至08-16/Community_标签与Studio_法式工具_PRD_2026-08-14.md)、[W33 历史总计划](./工作记录_2026-W33_08-10至08-16/W33_PR计划_v2_Community标签与Studio法式_2026-08-14.md) 与 [W34 Studio French 执行计划 v2](./工作记录_2026-W34_08-17至08-23/W34_PR计划_v2_Studio法式与显式Use_2026-08-21.md)：Community 已完成；剩余 4 个 French + 2 个 Explicit Use PR 的当前兼容架构、门禁和全量矩阵以 W34 v2 为准。
6. [V7 系统架构与领域合同](./工作记录_2026-08-07/V7_系统架构/V7_系统架构与领域合同.md)：十个业务域、五个横切合同和端到端真源边界。
7. [ADR-GEO-001](./工作记录_2026-08-07/V7_系统架构/ADR-GEO-001_几何运行时与渲染制造边界.md) 与 [v0.7.2 甲面曲面组合合同](./工作记录_2026-08-07/V7_系统架构/v0.7.2_甲面曲面组合与几何运行时合同.md)：Nail Surface、Geometry Kernel、PBR Preview 与 Manufacturing Compiler 的真源/Adapter 边界。
8. [Studio Editor V7 PRD](./工作记录_2026-08-07/V7_系统架构/Studio_Editor_V7_工艺步骤与内容架构_PRD_2026-08-07.md)：五类制作步骤、2D/3D 双渲染和 Community 导入边界。
9. [2026-W33 PR 合并进展表](./W33_PR合并进展表_2026-08-13.md)：当前唯一 PR 执行入口；3D/Look、Community 标签与 Wizard Quick Start 已收口，Studio 法式为下一条已选 P0 能力线。
10. [V7.1 历史 PR 执行表](./归档/PR执行表_2026-W33前/README.md)：General / Community / Studio 原表已归档；PR 编号、commit 与退出门禁仅保留作历史证据。
11. [设备协议与 Vendor Adapter 架构](./工作记录_2026-08-07/V7_系统架构/V7_设备协议与Vendor_Adapter架构.md)：Canonical 消息、Artifact Transfer、设备状态、资源锁与维护边界。
12. [端到端开发计划](./工作记录_2026-08-07/V7_系统架构/V7_端到端开发计划_Studio至硬件联调.md)：从 Community / Studio 到 Geometry Runtime、Compiler、Adapter、HIL、FAT/SAT 和试产的长线。
13. [版本治理与迁移矩阵](./工作记录_2026-08-07/V7_系统架构/V7_版本治理与迁移矩阵.md)：EditorDocV7 与各领域对象的独立版本关系。
14. [行业与竞品证据](./工作记录_2026-W33_08-10至08-16/2026-08-12_设计决策工具与欧美女性社区竞品分析.md)：设计工具、欧美女性社区和美甲产品的当前证据与限制。
15. 已落地的机器合同与 Golden Fixtures：[G0 Scan Contracts](../nailExp/工作记录_2026-07-27/G0_scan-domain-contracts/README.md)、[P0 Canonical Contract Pack](../nailExp/工作记录_2026-07-27/P0_canonical-contract-pack/README.md)、[G1 Scan Simulator](../nailExp/工作记录_2026-07-27/G1_scan-simulator/README.md)；在迁入产品仓库前仍属于 architecture-golden reference。
16. [W34 0821 扫描设计全流程审查报告 v2](./工作记录_2026-W34_08-17至08-23/W34_0821扫描设计全流程审查报告_v2_2026-08-21.md)：交叉验证 PNGE/Fable 外部输入、W34 v1 与红队复核，给出 Scan → Nail Twin → Fit/Form → Studio → PBR/3MF 的对象复用、试验门禁与 PR DAG；当前是 `planned / pending-human-owner-signoff` 提案，不替代已签收 ADR。[v1](./工作记录_2026-W34_08-17至08-23/W34_0821扫描设计全流程审查报告_2026-08-21.md) 与 [红队复核](./工作记录_2026-W34_08-17至08-23/W34_0821扫描设计全流程审查报告_红队复核_2026-08-21.md) 保留为历史证据。
17. [W34 十指 PBR/Boolean 架构审查](./工作记录_2026-W34_08-17至08-23/W34_十指PBR与Boolean产品化_架构审查报告_2026-08-21.md) 与 [PR 计划](./工作记录_2026-W34_08-17至08-23/W34_十指PBR与Boolean产品化_PR进展与实施计划_2026-08-21.md)：3D Render/Boolean 子线及其与扫描拟合线的 join。
18. [W34 French / Asset Ops 双分支计划](./工作记录_2026-W34_08-17至08-23/W34_双分支开发计划_v1_Studio法式与资产运营_2026-08-21.md)：限定 A/B 文件所有权、多模态资产治理、先 B 后 A+INT 的合入顺序和 combined 完成门。

发生冲突时先区分“目标合同”与“当前实现”，不能用 planned PRD 覆盖代码事实：

```text
目标合同权威：人工签收的 ADR / Schema / Golden Fixture
             > v0.7.2 PRD / Roadmap / 架构文档中的 planned target

当前实现权威：实际 current main + 当前复跑证据
             > 历史提交/验收快照

历史来源层：V3.1 > V3 > V2 / V1 > 0729 非正式设备草案
```

若目标合同与实际代码不同，二者并列记录；实现状态只由 current main 与当前证据决定，目标合同只约束后续设计和验收。

## 3. 当前事实快照

| 层级 | 当前事实 | 证据等级 |
|---|---|---|
| 产品仓库 | `/Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech` | 已核对 |
| main | `3f0fb9b docs(studio): finalize quick start handoff`；已包含 Community / Studio、Editor V7、Publish/Approval/Governance、GEN-04、完整 3D/Look 13 提交链、Community TAX-01～04 与 Wizard WIZ-01～04；未 push，工作树保留用户既有修改/未跟踪项 | 2026-08-21 已核对 |
| 3D / Look chain | `c9c8f62..356cf93` 已进入 main；Foundation、Registry V2、材质/纹理投影、surface Boolean、四套 Look 与 40/40 修复验收完成 | `architecture-golden` + `APPROXIMATE / CONCEPT / simulated` |
| Community v0.7.2 来源线 | `integration/community-v7-1 @ 9d1a225` 与已验收后继已进入本地 main；继续作为来源审计 | `integrated` 原型 / architecture-golden |
| Editor effects capability | `integration/editor-v7-effects-preview @ 9a2a375` 已通过 merge commit `6cd57f2` 进入本地 main；未 push | `simulated` + `visually-signed-off` |
| Community | 独立产品域、静态内容合同、URL 筛选、详情、Intent 与 Studio 入口已进入 main | `integrated` 原型 |
| Community 运行能力 | Explore/Search/Look/Profile 已存在；NailBoard 为 localStorage/local identity 原型；PublishedLook 运行数据仍主要适配静态内容 | `integrated` local/static prototype |
| Community 结构化发现 | TAX-01～04 已进入 main：taxonomy/discovery 合同、存量迁移、URL/query runtime 与五入口首页 UI 已形成 local/static prototype | `integrated` 原型；非真实后端或生产能力 |
| Community 长线缺口 | 真实身份/远端 creator backend、RealResult、申诉、Analytics 与线上治理运维仍未完成 | `planned` |
| Decision UX | Compare Tray、Keep/Change、Lock & Explore、Mix & Match、Set Builder、Accent Planner、NailBrief 尚未进入源码 | `v0.7.2 planned` |
| Customer | 客户 CRUD、授权状态、偏好/过敏信息和历史设计关联已进入 main | 原型实现 |
| Editor V7 | schema、migration、repository/store、工作区、背景、平面编辑、顾客预览、十指操作、Wizard V7 创建链与 WIZ-01～04 Quick Start 收口、Mercury、Surface / Decoration / Finish Composite、14.1～14.3、V7-15 Geometry 与 V7-16 Guided Customer Preview 均已进入 main | `integrated` 原型 + `simulated` capability |
| 顾客确认 | ShareLink、ApprovalEvent、ConfirmedSnapshot 与免登录确认已在 main 形成 local prototype；真实服务、远端身份与不可变存储仍缺 | `integrated local prototype` |
| Studio 法式 | 当前 V7 仍是 `widthRatio / curvature / color` 两参数；编辑、Finish、顾客预览和 PBR projection 分别生成近似路径 | `selected / planned`；新旧合同、canonical path、五预设与统一视图未实现 |
| 2D/3D | V7 主链仍以结构化 SVG 2D/2.5D 为主；“单指聚焦 + 模拟 3D”懒加载 PBR，Registry/材质/纹理/装饰已接入；程序曲面、cover、GLB/PBR 仍为 simulated/concept | `integrated simulated`；非物理/制造证明 |
| 设备 UI | 本地 Zustand + MOCK IOT 绑定流程 | 原型 |
| 设备 Gateway | 当前产品仓库没有 MQTT Gateway、真实 Adapter 或生产执行服务 | 未实现 |
| G0 Scan Contract | 10 schema、3 fixtures、103 entities，本次验证通过 | architecture-golden |
| P0 Canonical Pack | 1 schema bundle、1 protobuf、3 fixtures、114 entities，本次验证通过 | architecture-golden |
| G1 Scan Simulator | 6 tests，本次验证通过 | software simulator |
| 真实硬件/工艺 | 未有 Vendor 协议、物理 Coupon、HIL/FAT/SAT 证据 | 未签收 |

## 4. v0.7.2 端到端主链

```text
Explore / Search / NailBoard
→ PublishedLookV1 / DesignVersionV1
→ DecisionSessionV1 / Compare / Keep-Change / Mix
├─ existing StudioImportIntentV1 → Wizard Draft / EditorDocV7 import
└─ planned DecisionIntentV1 → deterministic EditorDocV7 transaction
                           → Studio release service
                           → derived DesignVersionV1
→ Client Share / Approval
→ ConfirmedDesignSnapshotV7
→ ManufacturingDefinition
→ Manufacturing Compiler
→ Canonical ArtifactManifest
→ ProcessRoute / WorkOrder / Operation
→ DeviceTask / TaskAttempt
→ Gateway / Vendor Adapter
→ Scanner / LCD / UV Print / Dispense / Cure / Inspect
→ QualityResult / Traceability
→ RealResultV1
→ Community
```

扫描链独立产生：

```text
ScanOrder
→ ScanSession / CaptureGroup / FingerObservation
→ ReconstructionJob
→ NailSurfaceModel / MeasurementSet / QualityReport
→ immutable NailTwinSnapshot
```

`ConfirmedDesignSnapshotV7 + NailTwinSnapshot` 是制造定义的重要输入，但两者不能互相覆盖。

## 5. v0.7.2 的十个业务域

1. Content & Community。
2. Customer & Service Lifecycle。
3. Design & Manufacturing Definition。
4. Nail Geometry Acquisition & Twin。
5. Artifact & Manufacturing Compilation。
6. Resource & Workcell Digital Twin。
7. Validated Process & Calibration。
8. Production Planning & Execution。
9. Device Connectivity & Vendor Adapters。
10. Quality, Traceability, Maintenance & Safety。

五个横切合同保持不变：

- Identity & Authorization。
- Artifact Transfer。
- Schema & Versioning。
- Reliability & Observability。
- Data Governance & Privacy。

## 6. v0.7.2 最重要的边界

### 6.1 EditorDocV7 是设计真源，不是设备任务

EditorDocV7 保存五类结构化制作步骤；它不保存机器槽位、喷头波形、曝光、运动轨迹或厂商 Job。

### 6.2 2D、Three.js 与 GLB 都是派生视图或资产

- SVG：当前 V7 Editor 的主要持续编辑、2D/2.5D 预览和降级路径。
- Three.js：当前仅有局部程序化 PBR 模拟原型；依赖或 adapter 存在不等于通用 3D renderer 已实现。
- GLB：可作为版本化几何/资产输入；文件与 checksum 存在不等于已渲染、已适配或已制造验证。
- 2D、Three.js、GLB 与未来统一 Viewer 都不自动成为 Manufacturing Artifact。

### 6.3 最终封层与 UV 喷绘不是同一个概念

`surface_finish` 是亮面、哑光或磨砂的最终封层。其后的 UV 光照属于固化工序；`UV_INKJET_PRINT` 是彩色/白墨/光油喷绘程序。V7 协议必须使用不同 Operation/Program 表达，禁止统称为“UV”。

### 6.4 设计步骤不能直接一对一映射设备

同一个 `surface_effect` 可能由 UV、点胶、结构打印或组合工艺实现。只有 Compiler 在读取签收的 Recipe、Nail Twin、Process Profile 和 Workcell Snapshot 后才能生成生产路线。

### 6.5 Community 对象不是新的 Editor 真源

- PublishedLook 引用 immutable DesignVersion 和派生预览，不复制可写 EditorDoc。
- NailBoard 整理用户意图，不直接生成制造参数。
- Remix 克隆指定 DesignVersion 并记录 lineage，导入后新 EditorDocV7 成为唯一设计真源。
- DecisionSession / NailBrief 只表达候选、约束和来源；Studio 重新校验，经 EditorDocV7 revision 与既有 release service 后才能创建新的 DesignVersion。
- RealResult 需要真实履约关联，不能由 Preview、Like 或 Demo 数据生成。

## 7. 旧文档定位

以下文档保留为历史决策证据，不再作为首要入口：

- `README_系统架构总览与文档索引.md`：V3.1 旧索引。
- `2026-07-30_V3.1长期兼容性审查_扫描与十指几何补充.md`：八域架构来源。
- `2026-07-30_端到端开发计划_G0至硬件联调.md`：旧阶段计划。
- `2026-07-29_3D与设备对接架构优先级报告_V3.md`：设备消息与 Adapter 来源。
- `2026-08-03_2D3D体验差距与制造协议映射评估报告.md`：预览/制造边界来源。
- `2026-08-05_Editor重构开发计划与优先级.md`：旧 V4 阶段复用参考。

旧文档中的架构原则继续有效，但版本状态、Editor 模型、Community 域、Decision UX、最终封层规则和开发优先级以 v0.7.2 文档为准。

## 8. 文档维护规则

1. 架构变化先新增或更新 ADR，再修改权威文档。
2. 文档必须标明 `已实现 / architecture-golden / simulated / planned / blocked / physically validated`。
3. EditorDoc、扫描、制造、设备消息分别版本化。
4. Schema 破坏性变化提升自己的 major，不跟随架构文档版本机械升级。
5. Golden Fixture 变化保留旧版本并提供 migration/compatibility 测试。
6. Vendor 原始字段和错误码只通过 Adapter 暴露。
7. 未经物理 Coupon、HIL、FAT/SAT 的能力不得标记生产可用。
8. Agent 生成的建议只有在人工签收并进入本索引后才成为采用决策。

## 9. 当前下一步

1. 以 `main @ 3f0fb9b` 为当前代码核验起点；不得清理主工作树的用户已有修改或未跟踪项。
2. Community `TAX-01 → TAX-04` 与 Wizard `WIZ-01 → WIZ-04` 已进入本地 main；后续不得把已完成能力重新记为 planned，线上身份、后端与生产能力仍单列。
3. Studio 法式仍按 `FRENCH-01 → FRENCH-04 → INT-FRENCH-01A → INT-FRENCH-01B` 推进；新法式复用现有 recipe/flat 扩展点，保持 `EditorDocV7 / schemaVersion: 7` 与旧版冻结读取，详见 [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]]。
4. 扫描设计全流程候选提案见 [[W34_0821扫描设计全流程审查报告_v2_2026-08-21]]；其 D0 优先级/Owner 门与 `ARCH-v0.7.2-SCAN-GEO-01` 尚待 Leader、Product、Engineering 与 Manufacturing 人工签收。签收前不改变 Studio 法式已选 P0，不启动扫描产品分支；版本候选结论仍是保持 EditorDocV7，不升级 V8。
5. 十指 PBR/Boolean 保持独立 3D 子线，并通过 `STUDIO-FIT-01` 接入 fitted geometry；Boolean 不阻塞基础扫描驱动 PBR。
6. 3MF conformance 只证明格式与数字结构；真实 Scanner/Printer Adapter 等待厂商协议、样例、标定和 HIL（Hardware-in-the-Loop，硬件在环）证据，物理与生产口径继续 fail closed。
7. Decision Beta、Reference Companion、Output/RealResult 和其他 Roadmap 候选继续保留，不插入扫描/3D 的首条合同关键路径。
