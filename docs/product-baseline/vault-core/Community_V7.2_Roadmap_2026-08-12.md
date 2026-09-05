---
title: Community v0.7.2 Roadmap
type: roadmap
status: active
version: v0.7.2
created: 2026-08-12
updated: 2026-08-17
evidence: mixed
aliases: [Community v0.7.2 Roadmap]
tags: [community, roadmap, decision-ux, v7-2]
related:
  - "[[文档规则与索引]]"
  - "[[NextGen_Beauty_产品需求池]]"
  - "[[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12]]"
  - "[[Studio_Editor_V7.2_Roadmap_2026-08-12]]"
  - "[[W33_PR合并进展表_2026-08-13]]"
  - "[[2026-08-12_设计决策工具与欧美女性社区竞品分析]]"
  - "[[Community_标签与Studio_法式工具_PRD_2026-08-14]]"
  - "[[W33_PR计划_v2_Community标签与Studio法式_2026-08-14]]"
supersedes: []
superseded_by: []
source_refs:
  - /Users/henry.macbook/.codex/attachments/9d3d6f28-ec96-4f77-a9ed-192e5e2b4f74/pasted-text.txt
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@5ae90852f748dfbc22e2aa1f06e6d93209b6d5f2
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@e717097c703b0b80ceca24c433d36bc89e5a619a
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@356cf939fbc8cfffe388dc9ac53c80f8ed904f25
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@7a5d806fceabd6de483a93b4207c5fea4e298624
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech@9cfd42429915e017af076e966ed51fcfb35a9d90
  - /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-tech/evidence/pr-community-v0-7-2-tax-04/VALIDATION.md
---

# Community v0.7.2 Roadmap

Community v0.7.2 的职责是把灵感转成可解释、可追溯的选择：

```text
Discover → Compare → Combine → Decide
```

它不负责专业图层编辑、3D 场景、制造参数或设备控制；这些由 [[Studio_Editor_V7.2_Roadmap_2026-08-12]] 承接。

> 本 Roadmap 是产品顺序，不是已实现清单，也不是日期承诺。实际代码起点以 [[重要变更与PR基线记录]] 为准，当前 PR 选择与依赖见 [[W33_PR合并进展表_2026-08-13]]；三份 V7.1 PR 表只保留于归档。文件名保留 `V7.2` 仅为 WikiLink 稳定。

## 1. 当前起点

`main @ 9cfd424` 已具备独立 Community 产品面、Explore/Search、Look、Profile、localStorage NailBoard、DesignVersion / PublishedLook / Remix、PRIVATE/UNLISTED Creator Publish、固定版本 Approval、治理审计、PUBLIC gate、四套 `APPROXIMATE / CONCEPT` Look 的显式 Studio 使用链，以及完成验收的 Discovery Taxonomy C0.5。数据、身份、资产和后端仍主要是本地原型；真实远端身份、服务、通知、关系数据、运营队列、RealResult 和生产级治理尚未完成。

Discovery Taxonomy 已完成：French 迁移为 `technique:french`，五入口、稳定 technique/theme/rights/makeability 合同、四类来源迁移、URL/query runtime 与六视口 UI 已进入 main。Compare Tray、Keep/Change、Lock & Explore、Mix & Match、Set Builder、Accent Planner、Pairwise、What Changed 与 Nail Brief 仍未在当前源码中实现。

## 2. Roadmap 总览

| 阶段 | 目标 | 主要交付 | 出口门禁 |
|---|---|---|---|
| C0 · Truth & Safety | 先固定公开内容、版本、权限和指标真源 | Canonical publish write path、PUBLIC gate、Approval contract、事件基线、隐私/治理 | 公共内容不依赖 fixture/local identity；Approval 绑定 immutable DesignVersion；治理门禁可审计 |
| C0.5 · Discovery Taxonomy | 让用户以稳定、可恢复、受治理的结构找到内容 | 五入口、稳定标签身份、French 技法迁移、URL/filter runtime、版权/可制作性门禁 | 旧深链可迁移；双语同一身份；无证据 fail closed；390–1440 可用 |
| C1 · Decision Shortlist | 从收藏进入可完成的比较与取舍 | Compare Tray、Variant Compare、DecisionSession、Keep/Change、Lock & Explore | 2–4 候选可比较；final choice 可解释；materialization 前 EditorDoc writer=0 |
| C2 · Deterministic Combine | 把多个喜欢点组合成一个合法新版本 | Mix & Match、Try One Nail、Set Builder、Accent Planner、finger provenance | 所有派生结果由 Studio 校验，经受控 EditorDoc revision + release 创建新 DesignVersion；来源完整率 100% |
| C3 · Decision Depth + Light AI | 降低描述和检索成本，不替代规则系统 | What Changed、Pairwise 实验、Nail Brief Beta、Auto Tag、Style Summary、Ask This Look | 模型输出可追溯、可编辑、可拒绝；无直接 Design writer；先签收评测协议/阈值且达到后才能退出 |
| C4 · Approval & Creator Loop | 在 C0 合同/门禁上交付可用的确认与服务产品流 | Fixed-version share/Approval UI、RealResult、Creator/Salon service profile、教程/精选 | Preview/Approval/RealResult 分离；公共供给和服务评价可审计 |
| C5 · Growth / Commerce Research | 在真实漏斗成立后扩展增长和交易 | Collaborative Board、Challenge、follow、外部预约→站内交易、advanced recommendation | 先证明 retention、服务转化和治理能力；逐项 ADR 决策 |

## 3. C0｜Truth & Safety

### 3.1 范围

- 让 `PublishedLookV1` 成为运行时发布真源，而不是主要依赖 legacy fixture 适配。
- Publish Package → PublishedLook repository 的真实写链与幂等性。
- PRIVATE / UNLISTED / PUBLIC 的身份、版权、来源和 moderation gate。
- V7 顾客确认的合同与安全门禁：ShareLink、ApprovalEvent、Request Change、immutable snapshot 的 schema/permission/idempotency；C4 再交付完整产品 UI、通知和服务闭环。
- Board/Decision/手部照片/扫描的隐私分域、删除、下载与深链失效策略。
- 事件 schema 和漏斗基线：`look_view → save → compare → open_studio → design_created → approval → real_result`。

### 3.2 并行边界

C1 的私密 Decision Beta 可以在 C0 公共发布后端完成前并行开发，但只能使用：

- 本人私密 Board；
- 已通过 canonical / asset readiness 的官方或签收 Look；
- 本地或 integration 环境；
- 明确的 `prototype` 标签。

任何 Creator PUBLIC UGC、陌生人互动或真实顾客审批均受 C0 门禁阻断。

### 3.3 Exit Gate

- PUBLIC 内容不能只靠客户端布尔字段声称已审核。
- Board 默认 PRIVATE；未登录/无权限不能读私密内容。
- Approval 只能绑定不可变版本；不能确认活 EditorDoc。
- 事件具备 `actor / subject / source / designVersionId / sessionId / timestamp`。

## 3-A. C0.5｜Discovery Taxonomy（已完成）

本阶段已由 `COMM-v0.7.2-TAX-01 → TAX-02 → TAX-03 → TAX-04` 顺序交付并进入 `main @ 9cfd424`（产品/验证 HEAD `7a5d806`，其后仅 Handoff）：

1. 冻结唯一 canonical discovery metadata、稳定 ID、双语显示名、频道/属性分离与版权/可制作性证据门禁。
2. 迁移 legacy index、canonical demo、四套 Look 与 creator read model；旧 French 改为 `technique:french`，整体风格缺失时明确待补，不运行时猜测。
3. 扩展 URL/query runtime；首页一级和当前入口二级单选，辅助筛选同维度 OR、跨维度 AND，空结果不自动放宽。
4. 交付五入口、二级导航、卡片标签、空/错/无权限/版权状态及 390–1440 响应式 UI。

退出门禁已通过：PRD 3.7 八项关闭，专项测试 48/18/53/49，TAX-03 URL E2E 与 TAX-04 六视口 E2E 通过；“当前可制作”缺少版本化 capability/asset/evidence 引用时 fail closed，`CONCEPT` 不自动晋级。证据见仓库四个 `evidence/pr-community-v0-7-2-tax-0*/VALIDATION.md`。

## 4. C1｜Decision Shortlist

### 4.1 核心切片

```text
Board Shortlist
→ Add 2–4 Looks to Compare Tray
→ Structured Variant Compare
→ Keep / Change
→ Lock & Explore
→ Final Choice
```

### 4.2 数据对象候选

`DecisionSessionV1` 在 ADR 前保持 planned；字段真源见 [[NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12#8.1 DecisionSessionV1]]。至少包含 identity/PRIVATE visibility、revision、rulesetVersion、candidate refs、typed locked/variable dimensions、typed finger choices、actions、selected candidate 与可选 expiry。

Community 只保存意图和引用，不复制完整 EditorDoc。

### 4.3 UX 验收

- 最多 4 个候选；不足 2 个不进入 Compare。
- 使用同样的十指顺序、尺度和已知属性；缺字段显示 Unknown，不猜测。
- Keep/Change 同时支持 chips 与简短备注；只有结构化约束进入 Studio 合同。
- Lock & Explore 每次只改变 unlocked 维度，显示“为什么变了”。
- 关闭/刷新后按隐私和过期策略恢复，不创建幽灵版本。

### 4.4 指标

- Compare start / completion。
- Time to final choice。
- Reversal / reopen rate。
- Keep/Change 各维度使用率。
- Compare → Open in Studio 转化。

## 5. C2｜Deterministic Combine

### 5.1 核心切片

```text
Selected candidates
→ Pick global property or specific fingers
→ Resolve conflicts
→ Studio validation / materialization
→ isolated EditorDocV7 draft / saved revision
→ Studio release service → Derived DesignVersion
→ Return preview to DecisionSession
```

### 5.2 交付

- Mix & Match：shape、length、palette、finish 与单指内容分层选择。
- Try One Nail：在一个手指上试 color/finish/effect，再显式扩到 selected / mirror / all；命名 group 待分组合同签收。
- Nail Set Builder：十指 Slot 从 Board/Look 选取，保留每指来源。
- Accent Planner：确定性 Balanced / Minimal / Statement / Alternating / Symmetric。
- 冲突说明：不兼容 geometry、缺资产、不可重投影、版权或 capability 不足时阻断。

### 5.3 Exit Gate

- Community 不直接写 EditorDoc。
- 现有 `DesignVersionV1.parentVersionId` 只保持同一 Design 的 release history（首个 release 可为空），不承载外部来源；planned `CompositionRelationV1 + FingerSourceRefV1[]` 保存全部 Mix 来源与逐指来源，完整率 100%。
- 同一输入 + 规则版本得到同一 materialization 结果。
- 取消返回时不产生 EditorDoc revision 或版本；确认只允许一次受控 draft/revision + release，并产生一次新版本。
- 来源 Look 后续删除不改变已合法派生版本的审计链，但依授权策略处理再发布。

## 6. C3｜Decision Depth + Light AI

### 6.1 非 AI 深度

- What Changed：属性、手指和渲染配置差异。
- Pairwise Choice：只作为候选很多时的实验，不默认替代 Compare Tray。
- One Look, Multiple Shapes：先做可迁移性探针；不可无损的内容必须阻断。

### 6.2 Nail Brief Beta

```text
3–8 images
→ multimodal interpretation
→ NailBriefV1 + confidence + unknowns + source refs
→ deterministic validation
→ user confirmation
→ Studio intent
```

Beta 必须先有离线评测集：字段准确率、未知项召回、人工修改率、非法建议率、延迟与成本。模型返回合法 JSON 不等于语义正确。

C3 开发开始前必须以独立评测 ADR 固定样本覆盖、字段级 precision/recall、unknown recall、非法 geometry/material/manufacturing 建议率、人工修改/拒绝率、P95 延迟与单次成本阈值；PRD 不在缺少目标人群基线时拍数值。未签收阈值或未达阈值均不能退出 C3。

### 6.3 轻 AI

- Auto Tag：建议、人工确认、可追溯。
- Style Summary：只总结可证字段。
- Ask This Look：不虚构材料、工艺、作者或可制造性。
- Palette + 长文本检索：优先真实 Look 检索，再考虑生成候选。
- Variant Recommendation：只在规则合法的候选中排序并解释理由。

### 6.4 不做

- 图片 → LLM → 直接 Design。
- AI 精确几何或制造参数。
- 无法关闭/解释的黑盒推荐。
- 未标记 AI 来源的公开内容。

## 7. C4｜Approval & Creator Loop

- 在 C0 已签收合同/权限门禁上，交付固定 DesignVersion 的只读分享、Approval / Request Change UI 与状态闭环。
- RealResult 绑定实际采用版本，Render 与实物结果显著区分。
- Creator / Nail Tech / Salon Profile：作品、技术、地点粒度、服务与外部预约。
- Verified service review 只由可核验的服务完成事件触发。
- Creator Analytics 优先 Save、Compare、Open in Studio、Approval、RealResult，而非单纯点赞。
- 教程、材料清单、官方精选和主题 Challenge 只有在版权/审核/申诉闭环后开放。

## 8. C5｜Growth / Commerce Research

候选项：Collaborative Board、Follow、Board-driven recommendation、站内预约、支付、佣金、Creator Shop、品牌/材料标签、Affiliate、Group/Live。

进入条件：

1. Decision 与 Approval 漏斗有真实留存和服务转化。
2. 公共供给的版权、审核、申诉和数据删除可运营。
3. 每个交易能力有独立履约、退款、披露和风控合同。

泛 Forum、陌生人 DM 与直播不作为 v0.7.2 默认目标。

## 9. 与 Studio 的握手

| Community 输出 | Studio 责任 | 返回 Community |
|---|---|---|
| `StudioImportIntentV1` | 校验 source version / assets / capability，进入 `/studio/design/new` 并创建/应用 EditorDocV7 draft | draft/current import + return link 或可解释失败；后续显式 release 才产生 DesignVersion |
| `StudioImportIntentV1` + `technique:french` | 只传来源、甲型和法式技法意图；用户明确 Use 后由 Studio preflight/写入 | French draft、来源与 return link；不自动选预设、不覆盖来源 Look、不推导可制作性 |
| `DecisionIntentV1` | 解析 locks/variables/finger choices，经 EditorDocV7 transaction + release 确定性物化 | 派生版本引用 + preview package |
| `NailBriefV1` | Schema/规则/权限复验，用户确认后建立 EditorDocV7 draft | draft reference 或需补充字段；后续显式 release 才产生 DesignVersion |
| Approval action | 固定 DesignVersion → immutable snapshot | ApprovalEvent / RequestChangeEvent |
| Service completion | 绑定实际版本与证据 | `RealResultV1` |

Community 不拥有 `EditorDocV7` writer；Studio 不拥有 Community 社交、Board 或治理状态。

## 10. 全程红线

- Preview ≠ Approval ≠ RealResult ≠ Manufacturing Evidence。
- Board、手部照片、NailProfile、扫描和位置采用最小公开原则。
- Remix、AI、赞助、赠品与 Affiliate 必须披露。
- Roadmap 状态不得被改写为 main 已实现或生产可用。
