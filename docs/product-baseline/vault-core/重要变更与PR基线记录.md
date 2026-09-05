---
title: NextGen Beauty 重要变更与 PR 基线记录
type: index
status: active
version: v0.7.2
created: 2026-08-10
updated: 2026-08-26
evidence: integrated
aliases: [PR 基线记录, 当前开发基线]
tags: [git, baseline, editor-v7, community, wizard, quick-start, approval, i18n]
related:
  - "[[文档规则与索引]]"
  - "[[NextGen_Beauty_产品需求池]]"
  - "[[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]]"
  - "[[Community_V7.2_Roadmap_2026-08-12]]"
  - "[[Studio_Editor_V7.2_Roadmap_2026-08-12]]"
  - "[[README_V7_系统架构总览与权威文档索引]]"
  - "[[W33_PR合并进展表_2026-08-13]]"
  - "[[Studio_Editor_V7_PR进展表_2026-08-10]]"
  - "[[2026-08-11_工作记录]]"
  - "[[2026-08-12_工作记录]]"
  - "[[2026-08-13_工作记录]]"
  - "[[2026-08-14_工作记录]]"
  - "[[ADR-GEO-001_几何运行时与渲染制造边界]]"
  - "[[v0.7.2_甲面曲面组合与几何运行时合同]]"
  - "[[2026-08-10_工作记录]]"
  - "[[Community_标签与Studio_法式工具_PRD_2026-08-14]]"
  - "[[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]"
  - "[[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]]"
  - "[[W34_双分支开发计划_v1_Studio法式与资产运营_2026-08-21]]"
  - "[[2026-08-20_工作记录]]"
  - "[[I18N_PROTOCOL_V0_7_2]]"
  - "[[2026-08-26_工作记录]]"
supersedes: []
superseded_by: []
source_refs:
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/wizard-v7-creation-flow/VALIDATION.md
  - /Users/henry.macbook/Desktop/nextGen-Beauty/NextGen_Beauty_Studio_V7.1_General_PRD_Brief_2026-08-11.md
  - /Users/henry.macbook/Desktop/nextGen-Beauty/NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@5ae90852f748dfbc22e2aa1f06e6d93209b6d5f2
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@9a2a3756f5e70b57a8e577be3b62ba897a12a7f4
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-v7-12-surface-effect-2d/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-v7-13-dimensional-decoration-2d/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-v7-14-finish-composite-preview/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@de2ba3b2fac4e7dc026a353e7b373bb727e999d4
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-editor-v7-14-2-guided-start/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@45dd57de867a73a2b722d95774d969866e25fa90
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-editor-v7-14-3-selection-continuity/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@30cec94474552047896df6e84fca9f101e3cbd63
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@4d38821b4de419c9638c92baf85946e6b96fb5bb
  - /Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-v0-7-2-3d-foundation@5e78a6d21298254811df00d4d371133ed5a00f1a
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-editor-v7-15-inspiration-geometry/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@356cf939fbc8cfffe388dc9ac53c80f8ed904f25
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@7a5d806fceabd6de483a93b4207c5fea4e298624
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@9cfd42429915e017af076e966ed51fcfb35a9d90
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@ef3d45ec364e9f40186bdd9344861c2b8f697f55
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@3f0fb9bc1f39793d300bd4216c637584e23161c9
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@a1500407a73073bb93b27ae426f9f379904fd76a
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-asset-ops-track@bcc11f0651938ef5c4299a5802161271d3d787f6
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@bcc11f0651938ef5c4299a5802161271d3d787f6
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@7d33293fce8b3eda1c5e6270a898e7646cbfdc99
  - /Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track@be6b2cea521c41a0b75b0e5571d1326698042d27
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@be6b2cea521c41a0b75b0e5571d1326698042d27
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@0df346f7ef978f0f6f780846d6c2235fdb22da7d
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-i18n-v0-7-2-system/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-wizard-v0-7-2-quick-start-integration/HANDOFF_2026-08-20.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-community-v0-7-2-tax-04/VALIDATION.md
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-community-v0-7-2-tax-04/HANDOFF_2026-08-17.md
  - /Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-look-v0-7-2-four-sets-integration/evidence/pr-look-v0-7-2-four-sets-integration/VALIDATION.md
---

# NextGen Beauty 重要变更与 PR 基线记录

本页只记录会影响后续分支起点、兼容策略或产品主链的变更。v0.7.2 产品范围见 [[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]]，需求真源见 [[NextGen_Beauty_产品需求池]]，当前执行队列见 [[W33_PR合并进展表_2026-08-13]]。三份 V7.1 PR 表已归档并保留历史提交语义；0810 表同样只保留历史证据。

## 一、当前权威 Git 快照

核验时间：2026-08-26。

| 层级 | 分支 / Commit | 路径 | 状态 | 裁决 |
|---|---|---|---|---|
| 本地 main | `main @ 0df346f` | `/Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech` | Branch A/B、精确模板资产引用、资产/Recipe 减法与 i18n system 已通过专用 integration merge 进入本地主线；保留原始提交链，未 push | Asset、French、Explicit Use 与 i18n 已 `integrated` 为本地 prototype；Home owner、rights/promotion、独立 Nail Expert、公开 HTTPS、实体与制造门仍开放。 |
| 后续代码基线 | `main @ 0df346f` | 同上 | `.obsidian/`、5 个 `docs/architecture/` 文件与 Vite timestamp 未跟踪项原样保留；`AGENTS.md` 已纳入 integration | 后续分支从 current main 重新核验；不得清理、stash、reset 或覆盖用户文件。 |
| Studio French Branch A | `codex/w34-studio-french-track @ be6b2ce` | `/Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-studio-french-track` | worktree clean；完整 stack 已 `MERGED(main)`，无 cherry-pick、未 push | Product owner 软件原型集成门、60/600/240、六档 canonical + Legacy E2E 和 A+B 回归均已入 main；不等于独立 Nail Expert、物理/制造验证。 |
| Asset Ops Branch B | `codex/w34-asset-ops-track @ bcc11f0` | `/Users/henry.macbook/Desktop/nextGen-Beauty/.staging/nextGen-beauty-asset-ops-track` | 完整 status clean；已整体 `MERGED(main)`，无 merge commit、无 cherry-pick、未 push | 自动与浏览器证据已进入 main；`AWAITING_INPUT` 仍表示真实 Home 内容/排序尚待 owner，不是系统报错或自动发布。 |
| GEN-v0.7.2-04 backend ports | `codex/gen-v7-1-04-backend-ports @ 4d38821` | `/Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-gen-v7-1-04` | `MERGED(main)`；分支/worktree 保留，未 push | backend-neutral/local prototype ports 与 authority hardening 已验收；真实 remote auth/backend、跨存储事务和 source ownership 仍未实现。 |
| v0.7.2 3D Foundation 来源分支 | `integration/v0-7-2-3d-foundation @ 5e78a6d` | `/Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-v0-7-2-3d-foundation` | 已被 `main @ 356cf93` 包含；来源 worktree 保留 | 合同、Kernel parity、RenderScene/Appearance 与顾客确认单指 PBR 已进入 main；程序曲面不晋级 manufacturing geometry。 |
| v0.7.2 3D / Look 完整链 | `c9c8f62..356cf93` | main + `codex/look-v0-7-2-four-sets-integration` 来源 worktree | `MERGED(main)`；40/40 逐指、完整 fast-forward、未 push | Registry V2、材质/纹理、逐指 canonical projection、immutable asset SHA/revision、联合 bounds 与可见降级通过；cover/GLB/PBR 仍为 `APPROXIMATE / CONCEPT / simulated`。 |
| 3D Boolean Spike | `codex/spike-3d-boolean-preview @ 43b5982` | `/Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-spike-3d-boolean` | spike-only、worktree clean；未 merge/push | 证明受控 Boolean/拓扑/production-boundary；不是产品 renderer、制造 kernel 或 STL 输出。 |
| Almond base candidate | `codex/spike-3d-almond-base-asset @ 43b5982 + WIP` | `/Users/henry.macbook/Desktop/nextGen Beauty/.staging/nextGen-beauty-spike-almond-base` | 工作树含未提交资产/生成器/evidence | 网格门禁通过但 C 弧、arch、Z 向 preview thickness 与制造均未签收；冻结为 `SIMULATED_CANDIDATE`。 |
| Community / Studio 来源 integration | `integration/community-v7-1 @ 9d1a225` | 历史 worktree 已移除；commit 可由当前主仓库审计 | 已被 main 包含 | 不再是 main 之外的待合集成，也不把已删除路径写成当前 clean worktree。 |
| Editor 效果来源 integration | `integration/editor-v7-effects-preview @ 9a2a3756f5e70b57a8e577be3b62ba897a12a7f4` | 历史 worktree 已移除；commit 与 evidence 已在当前主仓库 | 已被 main 包含 | V7-12、V7-13、V7-14 通过 merge commit `6cd57f2` 进入 main。 |
| v0.7.2 产品与架构 | [[NextGen_Beauty_产品需求池]] · [[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]] · [[README_V7_系统架构总览与权威文档索引]] | Vault 根目录 | active authority；代码事实与规划分栏 | Consumer 主链升级为 Discover→Compare→Combine→Decide，Studio 独立负责创作/渲染/履约；Decision UX、Nail Brief 与通用 3D Roadmap 不因文档升级自动实现。 |
| v0.7.2 Geometry Runtime | [[ADR-GEO-001_几何运行时与渲染制造边界]] · [[v0.7.2_甲面曲面组合与几何运行时合同]] | Vault 架构目录 + `main @ 356cf93` | accepted boundary；Schema/Golden Fixture/parity/Registry V2 已进入 main | current intersection 开放边差异已暴露；Manifold 保持候选 Adapter；准确曲面、扫描贴合与制造仍未签收。 |
| 当前已选择需求 | [[Community_标签与Studio_法式工具_PRD_2026-08-14]] · [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]] · [[I18N_PROTOCOL_V0_7_2]] | Vault 当周目录 + 根目录协议 | `MERGED(main) / integrated prototype @ 0df346f`；Community、Asset Ops、FRENCH-01～04、INT-FRENCH-01A/01B、资产减法与 i18n system 均已进入本地 main | 不改 `EditorDoc schemaVersion: 7`，不把 prototype/视觉证据写成实体或制造验证；i18n 文案 CRUD 仍是本地原型。 |
| Wizard → Quick Start 能力线 | `ee49210 → 571fd24 → f8c3fa8 → ef3d45e` | 四个独立 linked worktree；canonical 证据见 Quick Start Handoff | `MERGED(main)`；来源/资产/草稿真源、Canonical Import 迁出、固定版本确认、Quick Start UI 收缩完成 | Creator 仅有 lineage 合同测试，非完整 Creator UI E2E；过期/撤销/损坏等多数失败态由专项矩阵而非全部浏览器回放覆盖。 |

## 二、当前 PR 基线

| PR | 状态 | 基线 / HEAD | 关键交付 |
|---|---|---|---|
| V7-01～V7-09 | `MERGED` | `main @ f82f2af` | V7 合同、迁移、runtime、workspace、背景、flat vector、设计师 IA 与顾客只读预览。 |
| V7-09.1 | `MERGED` | `f82f2af → 28e3880 → main` | 空白与可表达 Wizard/Community 内容切换到 V7；十指产品 Geometry；官方模板 checksum asset；复杂内容安全回退 V6。 |
| V7-10 | `MERGED` | `28e3880 → fd8d2cc → main` | 文字、贴纸、印章、安全 PNG/SVG 导入与 relink；独立资产仓储；Editor/顾客预览共享 reader。 |
| V7-11 | `MERGED` | `fd8d2cc → fa11a20 → 0189410` | 十指 current/selected/mirror/all、一次性复制、显式快照同步、解除同步；独立 canonical steps 与原子事务。 |
| 高保真模板图库 | `MERGED` | `fa11a20 → f474240 → 0189410` | 五套高保真模板资产、Gallery 展示、Manifest 与资产验证进入 main。 |
| Wizard V7 创建链与 Mercury 素材 | `MERGED` | `0189410 → 379ad0b → e50704b` | Wizard 创建切换到 Editor V7，补 Mercury Dew GLB/manifest 与验证；修复分支和 main tracked tree 均 clean，未 push。 |
| STUDIO-V7.1-03 Publish Package | `MERGED` | `ab3d85e → 9d1a225 → main 6cd57f2` | 生成可解释 fidelity 的确定性 Publish Package；本地合入，未 push。 |
| V7-12 Surface Effect 2D | `MERGED` | `c189aae → 7272d86 → main 6cd57f2` | 局部表面效果的 2D 派生、交互和 fidelity。 |
| V7-13 Dimensional Decoration | `MERGED` | `7272d86 → 1f0cae0 → main 6cd57f2` | 立体装饰 SVG 2.5D 与 fallback；不构成 WebGL/PBR 或制造证明。 |
| V7-14 Finish Composite Preview | `MERGED` | `1f0cae0 → 9a2a375 → main 6cd57f2` | 最终组合预览与唯一末位 finish；预览零写入、应用一次 canonical transaction。 |
| Community 产品表面与 image-first Boards | `MERGED` | `7efd07f → 039a5a4 → f11e858 → main` | Community 作为默认产品面，Studio 为独立页面；素材不完整时 Use 禁用；Nail Boards 首屏以图片收藏为主。 |
| EDITOR-V7-14.1 Workspace Intent | `MERGED` | `f11e858 → f460c4b → main` | ready sibling、select 语义、Stage lane 和跨指 selection 一致性加固。 |
| EDITOR-V7-14.2 Guided Start | `MERGED` | `f460c4b → de2ba3b → main` | 空白画布 0→1 非阻塞引导、显式冲突恢复、hidden/skipped 内容写入门禁与五档 E2E。 |
| EDITOR-V7-14.3 Selection Continuity | `MERGED` | `de2ba3b → 45dd57d → main` | 跨指同类同序步骤连续性、缺层安全回背景、Geometry/Customer 可解释 Stage、非默认 R3 顾客预览交接与五档 E2E。 |
| EDITOR-V7-15 Inspiration & Geometry | `MERGED` | `45dd57d → 30cec94 → main` | 签收 Geometry Registry、不可变 revision、独立 V7 materializer、十指 exact preflight、统一 fidelity 与 authoring/copy/sync gate。 |
| EDITOR-V7-16 Customer Preview & Confirmation | `MERGED` | `30cec94 → 421618c → main` | 空白 0→1 引导、阶段/工具/层级映射、顾客 2D/模拟组合、临时 scenario 与 writer-zero readiness；Approval/Snapshot 延后 STUDIO-04。 |
| Petal Pearl V7 Look | `IN MAIN` | `421618c → d408f8d → main` | 新增 Petal Pearl V7 Look 与试用链修复；资产/预览仍按自身 simulated / manufacturing gate 解释。 |
| DESIGN v1.1 / Product Boundary / Responsive Workspace | `IN MAIN` | `d408f8d → 9e2dbc8 → 5ae9085` | 设计权威、亮暖 token、产品边界导航、语义排版/间距、UI 验收合同与 Wizard canvas-first 响应式恢复进入 main。 |
| v0.7.2 Publish / Approval / Governance 顺序能力线 | `MERGED(main)` | `main 5ae9085 → d9ed3b5 → 4cd16f4 → 28e1347 → 405d2ca → 3bf67af → 0d4349f → e717097` | 可重复 integration build、三步 PRIVATE/UNLISTED 发布、公共信任合同、固定版本分享/确认、免登录确认 UI、治理处置与内容修订绑定 PUBLIC 门禁已进入本地 main；未 push，仍为 localStorage/demo prototype。 |
| v0.7.2 Decision + 双 Roadmap | `PLANNED / PARTIAL` | [[Community_V7.2_Roadmap_2026-08-12]] · [[Studio_Editor_V7.2_Roadmap_2026-08-12]] | Compare Tray、Keep/Change、Lock & Explore、Mix & Match、Set Builder、Nail Brief 仍未实现；单指 PBR、Registry V2、材质/纹理投影已进入 main。 |
| v0.7.2 当前 PR 队列 | `MERGED(main) / closed for code integration` | [[W33_PR合并进展表_2026-08-13]] · [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]] · [[I18N_PROTOCOL_V0_7_2]] | Branch B、完整 Branch A、资产/Recipe 减法与 i18n integration 已进入 `main @ 0df346f`；下一队列应另行裁决，不再从 French 尾部继续追加。 |
| v0.7.2 3D 产品入口与四套 Look | `MERGED(main)` · `356cf93` | [[W33_PR合并进展表_2026-08-13]] · [[Studio_Editor_V7.2_Roadmap_2026-08-12]] | 四态与 40/40 逐指 Look 已落地；只有单指聚焦模拟 3D 懒加载 PBR；WebGL/asset 失败原位降级，writer-zero。当前曲面、cover、GLB/PBR 仍为 simulated/concept。 |
| WIZ-01～04 Wizard → Quick Start | `MERGED(main)` · `ef3d45e` | `ee49210 → 571fd24 → f8c3fa8 → ef3d45e` | 新增 `StudioStartSourceV1`、`WizardRecoveryDraftV2`、`StudioApprovalApplicationServiceV1` 与后端中立固定预览 read model；Canonical Import 迁出 Wizard，固定版本确认复用既有 release/share/approval/snapshot 合同，Quick Start 不新写历史本地确认。 |
| Community 标签 + Studio 法式 | `MERGED(main) / integrated prototype` · `be6b2ce`；current main `0df346f` | [[Community_标签与Studio_法式工具_PRD_2026-08-14]] · [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]] | Community、Asset Ops、FRENCH-01～04、专业门记录与 INT-FRENCH-01A/01B 已整体进入本地 main；后续资产/i18n integration 未改变其历史功能提交，未 push。 |

## 三、兼容性裁决

1. 空白/客户/官方模板由 Quick Start 创建 `EditorDocV7`；Canonical Community Look 通过独立 Import Preflight 创建 Remix `EditorDocV7`，不初始化或修改 Wizard Store。
2. 已存在的 schema 1–6 文档继续由 V6 兼容 writer 打开，schema 7 由 V7 打开；不从 DesignSummary 重建或覆盖。
3. 无法无损 materialize 到 V7 的新内容必须显式阻断并说明缺口，禁止静默创建新 V6 文档。
4. Mercury Dew 的 recipe/effect/dimensional 所需 V7 materialization 与资产已纳入创建链回归；其他模板仍按逐项可表达性验收。
5. V7 新建设计使用 `geometry.<shape>.<length>.<finger>`；通用轮廓只能是明确标注的 fallback。
6. 官方模板 SVG 通过稳定 asset ref、revision 与 SHA-256 绑定；2D 渲染不构成制造证明。
7. v0.7.2 是产品与架构基线；EditorDoc 继续使用 `schemaVersion: 7`，不得机械升级为 7.2 或 8。
8. Community 静态 fixture、localStorage Intent 和顾客只读 Preview 不等于真实后端、RealResult 或制造履约；本地 Fixed Approval 只签收固定 DesignVersion 的本地事件/Snapshot 语义。
9. `surface_finish` 在 V7 canonical 中始终唯一且位于末位；选择或预览 finish 不锁定后续设计。
10. V7-12～V7-14 当前只提供模拟 2D / SVG 2.5D / 组合预览；WebGL/PBR、真实材质、UV 固化、设备与制造验证仍是独立能力和证据门禁。
11. Petal Veil 的程序化 Three/PBR 是 `simulated prototype`；Mercury/Starfish adapter 与 GLB 完整性不等于通用 EditorDocV7 → PBR renderer。
12. Community DecisionSession/NailBrief 只表达意图与来源；Studio 重新校验，经受控 EditorDocV7 revision 与既有 release service 后才能创建新的 immutable DesignVersion，Community 不直接写 EditorDoc。
13. Community 标签身份与显示名分离；中英文、改名、停用和合并不复用或静默改变 `tagId`。旧 French 主风格只通过显式 alias/migration 转为 `technique:french`，不猜整体风格。
14. 新法式在 `EditorDoc schemaVersion: 7` 内独立版本化；旧两参数对象冻结读取并保留 legacy renderer，只有用户确认转换后才写新模型，失败保留旧对象与诊断。
15. `WizardRecoveryDraftV1` 只读并纯迁移到 V2；失败不覆盖 storage，已确认 V1 不得恢复为可编辑草稿。历史 `DesignSummary.confirmation` 仅显示“历史本地确认，非固定版本”。
16. 官方模板与 Legacy Community 应用必须验证 `assetId + revision + SHA-256 + mimeType`；Legacy 近似应用保留来源和能力等级，版本/SHA/十指 geometry 不符时可见阻断。
17. Quick Start 仅承担客户上下文、甲型/长度、官方模板、简单颜色与草稿恢复；正式确认必须基于固定 EditorDoc revision 走 DesignVersion/Release/Share/Approval/Snapshot 链。

## 四、重要变更时间线

| 日期 | 变更 | 结果 |
|---|---|---|
| 2026-08-07 | Community-first 与 EditorDocV6 repaired integration 合入本地 main | `main @ 60a1a26`，形成 V6 稳定历史基线。 |
| 2026-08-10 | V7-01～V7-09 完成组合、设计师工作台与顾客预览 | 本地 `main @ f82f2af`。 |
| 2026-08-10 | PR-V7-09.1 Creation Cutover & Geometry Binding 验收提交 | `28e3880`，未合 main，成为后续强制基线。 |
| 2026-08-10 | PR-V7-09.1 与 PR-V7-10 快进合入本地 main | `main @ fd8d2cc`；V7-11 强制基线同步到该 HEAD，未 push。 |
| 2026-08-10 | PR-V7-11 Ten-finger Operations 验收提交 | `fa11a20`；未合 main、未 push；成为 V7-12 直接基线。 |
| 2026-08-10 | 工作记录治理改为自然周目录 | 同周新增每日 Markdown，不再新增单日目录。 |
| 2026-08-11 | V7-11 与高保真模板图库合入本地 main | `main @ 0189410`；`fa11a20` 与 `f474240` 均进入主线。 |
| 2026-08-11 | Wizard V7 创建链与 Mercury 素材合入本地 main | 功能提交 `379ad0b`，merge commit `e50704b`；typecheck、Wizard/V7 cutover、PR06 与 integration build 验收通过；未 push。 |
| 2026-08-11 | Community MVP 纳入 v0.7.2 产品与架构基线 | 新增 General PRD Brief，同步 V7 文档集；已实现原型、规划对象、顾客确认、RealResult 与制造证据保持分离。 |
| 2026-08-11 | 两份 v0.7.2 权威入口移动到 Vault 根目录 | General PRD Brief 与 v0.7.2 权威文档索引成为第一屏入口；同步修复相对链接并新增 [[2026-08-11_工作记录]]。 |
| 2026-08-11 | STUDIO-V7.1-03 Publish Package 验收进入 Community / Studio integration | 功能提交 `ab3d85e`，integration 更新为 `9d1a225`；未合 main、未 push。 |
| 2026-08-11 | Editor V7-12～V7-14 并行能力线完成 | `7272d86` → `1f0cae0` → `9a2a375`；integration 为 `integration/editor-v7-effects-preview @ 9a2a375`，三个 PR 与 integration worktree 均 clean，未合 main、未 push。 |
| 2026-08-11 | Community / Studio 与 Editor capability 分支统一合入本地 main | `integration/community-v7-1 @ 9d1a225` 先 fast-forward；Editor integration 随后以 merge commit `6cd57f2` 合入；12 个域测试、typecheck 与 integration build 通过，未 push。 |
| 2026-08-11 | Community / Studio 产品表面分离与 Boards 图片化 | `7efd07f` → `039a5a4` → `f11e858` 顺序进入 main；包括 Community 默认首页、Studio 独立产品面、asset readiness 和 image-first Nail Boards。 |
| 2026-08-11 | Editor v0.7.2 工作区 14.1/14.2 验收合入 | `f460c4b` 修复工具/选择意图；`de2ba3b` 交付空白画布引导与 inactive writer gate；五档 E2E 和 V7/V6 回归通过，未 push。 |
| 2026-08-11 | Editor v0.7.2 工作区 14.3 验收合入 | `45dd57d` 交付跨指 selection continuity、Geometry/Customer 解释入口、R3 预览交接；三路内部终审 ACCEPT、Luna 无 P0/P1、五档 E2E 与 V7/V6 回归通过，未 push。 |
| 2026-08-12 | Editor V7-15 Inspiration & Geometry 验收合入 | `30cec94` 绑定签收 geometry identity、十指 exact preflight、独立 materializer 与 geometry-aware fidelity/gates；内部终审 P0/P1=0，五档 Editor 与 Community E2E 通过，未 push。 |
| 2026-08-12 | Editor V7-16 Customer Preview & Confirmation 验收合入 | `421618c`；五档覆盖平面/效果/立体 0→1、冲突恢复、顾客只读组合与返回连续性；未 push。 |
| 2026-08-12 | Petal Pearl 与 DESIGN v1.1 / 产品边界 / 响应式工作区进入 main | `d408f8d → 5ae9085`；当前 main 以 canvas-first 设计权威和响应式 Wizard 为最新代码起点；未配置 remote。 |
| 2026-08-12 | v0.7.2 Publish / Approval / Governance 顺序能力线合入本地 main | `integration/v7-2-publish-approval @ e717097` 与 `main @ e717097` 已对齐；七个提交按推荐依赖顺序进入本地 main，integration build 连续两次通过，Creator/Public Review 1440/390 E2E 通过；未 push。 |
| 2026-08-12 | v0.7.2 Nail Decision Studio 战略签收 | 新建长期需求池、v0.7.2 General PRD 与 Community / Studio 双 Roadmap；Consumer 为 Discover→Compare→Combine→Decide，Studio 为 Create→Technique→Render→Approve→Fulfill；Roadmap 不等于代码实现。 |
| 2026-08-13 | GEN-v0.7.2-04 合入本地 main | `main @ 4d38821`；五个 backend ports/authority commits 已进入 main，未 push；仍严格标记为 local prototype。 |
| 2026-08-13 | v0.7.2 3D Foundation 完成至单指 PBR 入口 | `c9c8f62 → 2af730f → 3f03807 → 5e78a6d`；ARCH/GEO-01/RENDER-01A/01B 在独立 integration 验收。十指组合不变；单指 PBR、WebGL fallback、writer-zero 与 production kernel 隔离通过；尚未合 main。 |
| 2026-08-14 | v0.7.2 3D / Look 完整链 fast-forward 进入本地 main | `c9c8f62 → … → 899b973 → 356cf93` 共 13 提交整体进入 `main @ 356cf93`；未只 cherry-pick `899b973`。不可变逐指资产、SHA/revision cache、证据标签、联合 bounds 与 4 套×10 指=40/40 验收通过；未 push。 |
| 2026-08-14 | Community 标签与 Studio 法式进入 W33 v2 规划 | 新增专项 PRD 回链和 [[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]；当前为 9 个 `SELECTED / PLANNED` PR，尚未创建实现分支或改产品代码。 |
| 2026-08-17 | Community TAX-01～04 顺序验收并进入本地 main | `356cf93 → 2925622 → 3fd66dd → c6c4514 → 7a5d806 → 9cfd424(Handoff)`；合同 48、迁移 18、query 53、UI 49 项通过，TAX-04 六视口 E2E、截图/Luna、typecheck/build/integration build 通过；PRD 3.7 八项关闭，未 push。Studio French 与最终 Use 未开始。 |
| 2026-08-20 | Wizard → Quick Start WIZ-01～04 顺序验收并进入本地 main | `9cfd424 → ee49210 → 571fd24 → f8c3fa8 → ef3d45e → 3f0fb9b(Handoff 文档闭环)`；四个独立 worktree、专项/回归、typecheck/build/integration build、六视口 combined E2E 与 Luna 只读复核完成，未 push。canonical 证据只引用 `evidence/pr-wizard-v0-7-2-quick-start-integration/HANDOFF_2026-08-20.md`。 |
| 2026-08-21 | Studio French / Explicit Use 执行计划升级为 W34 v2 | [[W34_PR计划_v2_Studio法式与显式Use_2026-08-21]] 以 `main @ 3f0fb9b` 为文档核验基线；采用现有 recipe/flat 扩展点，不扩充 legacy `french_edge`，并把 Explicit Use 拆为 01A 合同/预检与 01B UI/E2E。此行为计划升级当时快照：French `0/4`、Integration `0/2 PLANNED`；同日后续实现状态由下方“双分支完成本轮收窄 checkpoint”记录 supersede。 |
| 2026-08-21 | French 与资产运营拆为两个并行 track | [[W34_双分支开发计划_v1_Studio法式与资产运营_2026-08-21]] 固定文件所有权：A 先做 FRENCH-01～04，B 做 7 个资产/生成/运营 checkpoint；B 先合入，A 再吸收 main 并完成 INT-01A/01B。文档生成不表示分支或代码已创建。 |
| 2026-08-21 | 双分支完成本轮收窄 checkpoint | Branch A `bafd28f`：FRENCH-02 代码门禁与红队 P0 修复完成，仍为 `prototype / visualSignoff=false`；Branch B `5b2b725`：治理货架 read model 与 strict preflight 完成，仍为 `LOCAL_CONCEPT_DRAFT_ONLY`。两 worktree clean，`main @ 3f0fb9b` 未变，未 merge/push；Claude rotation 无有效 finding，owner 签收未完成。 |
| 2026-08-24 | Studio French FRENCH-01 软件门补齐 | Branch A `bafd28f → 6aa8863`：新增显式 legacy→recipe 转换、current-doc exact geometry rebind、locked recipe projection 与 projection inspector；writer-zero、undo/redo/save/reopen、release/remix/materialize/generic scope no-dangling 和完整 build 门通过。Cursor 首次 bounded run 超时零 diff，随后单一 Luna writer 实现、Codex 独立复核；worktree clean，`main @ 3f0fb9b` 与 Branch B 未变，未 merge/push。 |
| 2026-08-24 | Studio French FRENCH-01 可见转换提示补齐 | Branch A `6aa8863 → f793141`：旧版检查器新增近似证据披露、五预设显式选择、颜色确认和迁移边界；移动端 Modal 层级/Esc 焦点修复后，390/1280 的取消/Esc writer-zero、单事务确认、锁定 projection、无横向溢出与前后截图均通过。按速度优先由 Codex 直接完成，未调用 subagent；worktree clean，`main @ 3f0fb9b` 与 Branch B 未变，未 merge/push。 |
| 2026-08-24 | Studio French FRENCH-03 代码 checkpoint | Branch A `f793141 → d86926e`：五预设与 managed inspector、current/selected/mirror/all 原子命令、独立 recipe/step/element ID、mirror 重编译、save/reopen 与六视口 E2E 通过；D6 owner 签收仍开放，未 merge/push。 |
| 2026-08-24 | Studio French FRENCH-04 代码 checkpoint | Branch A `d86926e → d75e4ea`：四个命名消费者统一只读 adapter，60×4=240 自动矩阵、可见 unavailable、390/1280 实际 PBR ready、10 次相机切换、preview writer-zero、typecheck/build/integration 通过；V1 240/240 owner 人工签收仍开放，`manufacturingValidated=false`，未 merge/push。 |
| 2026-08-24 | Studio French 关键截图快速签收 | 用户确认关键截图 1–6 通过，Branch A `d75e4ea → a150040` 只更新证据：legacy 转换、create/mirror、Flat/unavailable/PBR 的 Product 方向签收已记录；不替代 60/60 compiler golden、240/240 多消费者与 Design/Nail Expert 逐项验收。未 merge/push。 |
| 2026-08-24 | Community Asset capability 03A checkpoint | Branch B `5b2b725 → 3d5b455`：新增 24/24 Look capability/lineage 严格合同与报告，真实 PublishedLook DesignVersion/EditorDoc SHA/preview SHA 绑定，PENDING/PERSONAL_USE_ONLY fail-closed；专项、Community 回归、typecheck/build/integration 通过。仍为 branch prototype，UI/上架/制造均未开放。 |
| 2026-08-24 | Community Asset capability 03B UI checkpoint | Branch B `3d5b455 → 76a0124`：Community 首页卡片与详情统一消费 03A 真源，显示版本/SHA、近似与不可用诊断，旧 application/verification 仅保留兼容证据；六视口、fixture failure、typecheck/build/integration 通过。仍为 branch prototype，未 merge/push；Starter Shelf promotion 与制造能力未开放。 |
| 2026-08-24 | Community Home merchandising 04A checkpoint | Branch B `76a0124 → f56c328`：新增 strict `AWAITING_INPUT/IN_REVIEW/PUBLISHED` 配置、Community/Starter 身份分离、无 Banner/失效/权限失败降级；当前不伪造精选内容，六视口与 build 门通过。04B owner 内容仍缺。 |
| 2026-08-24 | Asset Ops 05A 联合 Handoff checkpoint | Branch B `f56c328 → af24983`：联合重算 21+4 inventory、25/25 governance、Starter 63/7、Community 24、03B/04A 各六视口；owner Unknown 与 rollback 明示。ASSET-05 仍因 04B/owner/main 未关闭。 |
| 2026-08-24 | Community Home 04B owner 输入包 | Branch B `af24983 → f928d4e`：确定性列出 15 条公开候选及能力边界，稳定 ID 排序且无推荐/趋势/个性化/制造推断；Banner、精选顺序、集合、双语理由和 evidence 全部留空等待 owner。 |
| 2026-08-24 | Asset Ops 合并边界（后续签收归属已勘误） | Branch B `f928d4e → 8ce6d19`：三方演练确认 Branch A/B 仅 `package.json` 重叠；当时把“1–6 通过”误归入 Asset，现由 `0028b33` 明确撤回。该签收只属于 Branch A French。 |
| 2026-08-24 | Asset Ops A+B 组合回归 | Branch B `8ce6d19 → bd77bd2`：边界脚本支持显式 `ASSET_HEAD`；临时 detached worktree 无提交组合 Branch A `a150040` 后，typecheck、build、integration build、French contract/compiler/conversion/commands/renderers、资产 combined/Home 与边界门均通过。临时 worktree 已移除，main 恢复原状态；未 merge/push。 |
| 2026-08-24 | Asset Ops 临时目录门复核 | Branch B `bd77bd2 → df31595`：早先 `dist 2/` 扫描异常按 fail-closed 阻断；13:05 后确认目录为空、完整 git status clean。未删除/隐藏该目录，当前不再构成 Git merge gate；若再次出现内容需重新审计。 |
| 2026-08-24 | Community Home 04B owner review gate | Branch B `df31595 → 5841b95 → c90ba8c`：新增当前空态 exact check、15 条候选 allowlist 与 unknown ref fail-closed；不得由输入包顺序推导精选或 `PUBLISHED`。package 三方门及 integration build 再次通过，真实 owner 输入仍为空。 |
| 2026-08-24 | Asset Ops 联合矩阵纳入 owner gate | Branch B `c90ba8c → c3a6856 → 18df2da`：05A matrix/Handoff 现在从 04B input pack 重算 15 条候选与 `AWAITING_INPUT_FAIL_CLOSED`；combined、boundary、typecheck 通过。owner Unknown 未被自动关闭。 |
| 2026-08-24 | Asset Ops 最终全批次 | Branch B `18df2da → 83bc2b5`：contract/inventory/governance、validate-assets、Starter、Community capability/UI、Home、owner input/review、combined/boundary、typecheck、build、integration 与 diff check 全部 PASS；仅既有 chunk warning，完整 status clean。 |
| 2026-08-24 | Asset Ops 审查基线固定 | Branch B `83bc2b5 → 3fa34d3`：boundary test 默认 base 从可漂移 `main` 改为真实 `3f0fb9b`，合入后仍可复跑；环境变量仍可显式覆盖。两种调用均 PASS。 |
| 2026-08-24 | Asset Ops gated fast-forward runbook | Branch B `3fa34d3 → 5c656bf`：固定 Branch B 整体合入→Branch A 吸收→combined 回归→main fast-forward 顺序；当前明确 `DO NOT EXECUTE`，禁止 cherry-pick、stash/reset/clean 与 push。 |
| 2026-08-24 | Asset Ops 签收归属勘误 | Branch B `5c656bf → 0028b33`：撤回把用户“1–6 通过”计入 Asset/Home 的错误；保持 Branch A French `a150040` 签收有效，Asset Product/Design 门继续开放。 |
| 2026-08-24 | Asset Ops Community 横向回归 | Branch B `0028b33 → bb689b4`：TAX-04 Home 49/49、Explore/Search、content states、Taxonomy V1/V2 与 discovery migration PASS；两个不存在的 alias 已用真实脚本名复跑，不记为产品失败。 |
| 2026-08-24 | Branch B 整体 fast-forward | `main 3f0fb9b → bcc11f0`，按 `--ff-only` 合入 29 commits / 74 files；无 merge commit、无 cherry-pick、未 push，主工作树既有 dirty/untracked 文件原样保留。 |
| 2026-08-24 | Branch A 吸收 main 与 French 软件集成门 | `211774a` 吸收 `main @ bcc11f0`；`f3c556b` 记录 A+B 全回归与 Product owner 软件原型集成门。该门不等于独立 Nail Expert、物理或制造签收。 |
| 2026-08-24 | INT-FRENCH-01A/01B 完成 | `ae9075b → 7d33293`：strict French Use Context、canonical/Legacy fail-closed preflight、显式打开工具、明确 preset 写入、保存重开与顾客预览完成；六档 canonical + Legacy E2E、typecheck/build/integration 通过，Branch A 待整体 fast-forward。 |
| 2026-08-24 | Branch A 整体 fast-forward | `main bcc11f0 → be6b2ce`，完整 16 提交 stack 按 `--ff-only` 进入本地主线；无新 merge commit、无 cherry-pick、未 push，主工作树既有 dirty/untracked 文件原样保留。 |
| 2026-08-26 | 资产减法与 i18n integration 合入本地 main | `be6b2ce → eccceca → 0df346f`；保留精确 `templateAssetRef`、资产/Recipe 减法与 i18n 原始提交 `f8cc096 → c7d5125 → 80e0384`。24/24 专项、2,077 个中英文键、138 个生产 TSX 审计 0 findings、typecheck/build/integration build 与 5 视口本地 E2E 通过；未 push，公开 HTTPS E2E 仍待部署 URL。 |

## 五、已知非阻塞基线

- `npm run test:slots` 在 2026-08-10 的 `main @ f82f2af` 与 PR-V7-09.1 同样失败于 L3 `abs(rotationDeg) < 5`；它不在 2026-08-11 的五项合并验收列表内，当前记录不把它改写为已修复。
- V7-09.1 的 Claude Code 两次只读调用均达到固定预算上限，未形成可用 finding；不能把这两次调用记为独立审查通过。
- V7-10 的 Luna 结论为 `pass-with-risks`，范围内 P1 已修复；Claude Code 结论为 `PASS`、P0/P1=0。SVG BOM hash 一致性 P2 已修复并回归。
- v0.7.2 PRD 交付前 Claude Code 成功审阅附件 PRD，但因只读工具无法枚举通配目录，没有完成 docs/code 全量读取；Visibility、事件指标与 DesignVersion 边界建议经本地源码和文档独立核验后采纳，不能写成“Claude 全量审查通过”。
- V7-12～V7-14 的 Claude Code 只读复核均已按技能尝试，但 Packy 返回 HTTP 400，当前令牌分组不覆盖 Anthropic/Opus 4.6；没有可用 Claude finding，不能记为 Claude 审查通过。
- 2026-08-21 的 French/资产并行架构 Hermes Claude rotation 依固定顺序尝试 5 个模型，但全部被 usage fail-closed 校验拒绝；没有可用 Claude finding，不能记为外部红队通过，后续资产分支仍需补有效只读审查。
- V7-12～V7-14 的 SVG 2.5D 与 2D mask 组合属于模拟能力；其视觉验收通过不等于真实 WebGL 材质、UV 固化或制造效果得到验证。
- EDITOR-V7-14.2 的 Claude 只读调用仍因 Packy HTTP 400（令牌分组不覆盖 Anthropic/Opus 4.6）无可用输出；Luna 初审风险已修，最终内部独立复核 `ACCEPT`。
- EDITOR-V7-14.3 的 Claude 只读调用同样因 Packy HTTP 400 无可用输出；Luna 初审两项可读性 P1 已修，短复核无 P0/P1；三路内部最终裁决均 `ACCEPT`。
- EDITOR-V7-15 的 Claude 交付前复核因账户调用额度限制未获得可用输出；内部合同/资产/UX 三路最终 `ACCEPT`，Luna 为 `PASS-WITH-RISKS`，范围内风险经 Codex 复核为非阻塞。
- `test:slots` 最近一次有记录的基线仍失败于 L3 `rotationDeg = 5.81` 与旧 `< 5` 阈值；本次 Wizard → Quick Start 收口未在 `main @ 3f0fb9b` 重跑该测试，不能把旧失败改写为当前已修复或重新确认失败。
- 当前没有 remote；所有 `MERGED` 均描述本地状态。`main @ 0df346f` 的 `AGENTS.md` 已纳入 integration；`.obsidian/`、5 个 `docs/architecture/` 文件与 Vite timestamp 未跟踪项继续原样保留，未纳入本次文档工作。
- v0.7.2 Compare / Keep-Change / Mix 与 NailBrief 当前仍为 Roadmap。单指 PBR、canonical Registry、材质/纹理与四套 Look 已进入 `main @ 356cf93`；统一准确曲面映射、HQ 输出、实体材料与制造仍未完成。
- Community 五入口/新 taxonomy 与 Studio 结构化法式均已进入本地 main；其 Product/Design/Nail Expert、实体与制造门仍按各自证据开放，不能把 integrated prototype 提升为物理或生产能力。
- i18n 中英文合同、typed key、审计和本地文案 CRUD 原型已进入 `main @ 0df346f`；公开 HTTPS E2E、多语言内容治理和生产级远端文案服务仍未签收。
- WIZ-04 Luna 总体为 `CONDITIONAL PASS`，无可复现功能阻断；条件是不将 Creator lineage 合同测试、专项失败矩阵或本地同源分享扩大声称为完整 Creator UI E2E、全失败态浏览器验收、跨设备服务或 production-ready。
- 用户在 2026-08-17 对本任务重新授予 `claude-code-subagent` 的兼容边界只读审查权限；TAX-03 使用该授权完成全局兼容复核。该权限不自动扩展到后续任务，外部结论仍须 Codex 独立核验。

## 六、更新规则

发生以下任一事件时更新本页：

- 本地 main HEAD 改变。
- 新 PR 被标记为 `ACCEPTED` 或 `MERGED`。
- 后续强制基线改变。
- schema、writer 选择、迁移或回退策略改变。
- 既有测试基线被正式修复或重新签收。

普通开发过程、工具日志和逐文件修改不写入本页，放入对应 [[文档规则与索引#二、工作记录目录规则|周工作记录]]。
