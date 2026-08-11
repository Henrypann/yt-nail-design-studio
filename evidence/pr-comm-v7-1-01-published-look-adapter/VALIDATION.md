# COMM-V7.1-01 · Published Look Adapter (canonical /community/look/:lookId) — Validation

Date: 2026-08-11
Base: `28c0b4b` (merge: GEN-V7.1-02 versioned look and lineage contracts)
Branch: `codex/pr-comm-v7-1-01-published-look-adapter`
Evidence level: **route/adapter logic + legacy-fixture compatibility — production-ready
for the UI path; data remains simulated/static; manufacturing/device claims are
explicitly unverified.**

## Scope

Community 现有 `CommunityContentV1` 静态 fixtures 是 legacy 静态内容：缺少不可变
DesignVersion ID、EditorDoc hash、preview revision/hash 与公开出版门禁证据。
本 PR 不伪造这些事实——legacy 记录只允许以显式 `LEGACY_PARTIAL` 读模型渲染，
并声明缺失项；不得宣称其为完整有效的 `PublishedLookV1`。

EditorDocV7 仍为创作真源；Community 不 import Wizard/Editor store。Canonical
详情路由为 `/community/look/:lookId`；legacy `/community/content/:contentId`
以 replace 重定向（保留 query params）。Community 壳、静态仓储、
StudioImportIntent 行为、demo 可见性过滤与 missing/down 状态保持不变。

## Changed files

New:

- `src/community/domain/v7_1/published-look-read-model.ts` — 带判别
  `CANONICAL | LEGACY_PARTIAL` 的 `PublishedLookReadModelV1`；evidence 子契约
  （不可变设计版本 / preview revision+hash / 出版门禁 / 三态状态证据）。
  `LEGACY_PARTIAL.designVersionId` 被类型为 `undefined`，强制消费者区分变体。
- `src/community/domain/v7_1/published-look-adapter.ts` — 纯适配器
  `adaptLegacyContentToLook`（拒绝 draft/deprecated 为 `not_viewable`；拒绝
  畸形 essentials 为 `malformed`；确定性、无副作用、不伪造 hash/version/gate）
  与 `buildLookReadModels`（复用 `visibleCommunityContents` demo 过滤）。
- `src/community/data/look-repository.ts` — `loadLookReadModels` /
  `getLookReadModelById`：从现有 legacy 静态索引派生 canonical 读模型，
  无新增后端/网络 API。
- `src/community/pages/CommunityLookPage.tsx` — canonical 详情页：保留封面回退、
  分类、徽章、试用到 Studio、近似确认、资产清单、返回导航与 missing/down 状态；
  新增显式证据块（legacy 兼容状态 / 已验证 vs 不可用 / 预览通过≠可制造≠已下发生产 /
  来源与可见性 caveat）。
- `src/community/pages/CommunityLegacyContentRedirect.tsx` — legacy 路由
  replace 重定向，保留 query params（目标计算为纯函数）。
- `tools/test-community-v7-1-look-adapter.mjs` + package script
  `test:community-v7-1-look-adapter`。
- `evidence/pr-comm-v7-1-01-published-look-adapter/VALIDATION.md`（本文件）。

Modified:

- `src/app/routes.ts` — `Routes.communityLook` / `Routes.communityLookPath`；
  `Routes.communityContent` 标记 deprecated（兼容保留）；纯函数
  `legacyContentRedirectTarget`。
- `src/app/App.tsx` — `communityLookPath` → `CommunityLookPage`；
  `communityContentPath` → `CommunityLegacyContentRedirect`。
- `src/community/pages/CommunityContentPage.tsx` — 移除产品渲染，变为 deprecated
  redirect wrapper（原功能迁移至 CommunityLookPage，见文件头注释）。
- `src/community/components/CommunityContentCard.tsx`、
  `src/community/pages/CommunityProfilePage.tsx` — 详情链接改为 canonical look。
- `src/community/domain/studio-import-intent.ts` — fallback return 改为
  `Routes.communityLook(content.contentId)`。
- `src/app/pages/design/WizardPage.tsx` — intent 恢复/取消 fallback 改为
  `Routes.communityLook(...)`。
- `package.json` — 新增 `test:community-v7-1-look-adapter`。

## Acceptance mapping

1. `PublishedLookReadModelV1` 以 `readModelKind: 'CANONICAL' | 'LEGACY_PARTIAL'`
   判别；legacy 记录保留现有 UI 消费的原始内容（`sourceContent`）并带显式
   evidence/limitations；`lookId === contentId` 保持深链兼容；不创建伪造的
   `DesignVersionV1` / `PublishedLookV1`。
2. 纯适配器：`DRAFT` / `DEPRECATED` → `not_viewable`；畸形 essentials（缺失/空
   contentId、title、publisherId、cover、status、application/verification level、
   mainStyleId、publishedAt、schemaVersion≠1、错误枚举、非数组 taxonomy、畸形
   assetRef）→ `malformed`；保留 publisher/title/taxonomy/application/verification/
   asset refs；声明缺失的不可变设计版本、preview revision/hash 与公开出版门禁；
   预览保真度按既有验证级别诚实分类（CONCEPT→APPROXIMATE，
   RENDER/SAMPLE/PRODUCTION_VERIFIED→EXACT）；确定性输出（同输入深相等、
   JSON round-trip 一致、字段顺序稳定）且无副作用（输入不被修改）。
3. Look 仓储：`getLookReadModelById` 从当前 legacy 内容索引派生读模型并复用
   demo 可见性过滤（production 隐藏 demo PUGC；DRAFT 永不 viewable）。
4. `Routes.communityLook` / `communityLookPath` 新增；`Routes.communityContent`
   保留为 deprecated；卡片、profile、Studio intent fallback、Wizard fallback
   全部改用 canonical look URL；全仓无 `Routes.communityContent(` 调用点（除路由
   表定义与 legacy 路由注册本身）。
5. `CommunityLookPage` 保留原有详情行为（封面回退、分类徽章、试用、近似确认、
   资产清单、返回导航、missing/down），新增显式证据块：legacy 兼容状态、
   已验证 vs 不可用、预览通过≠可制造≠已下发生产三态区分、来源/可见性 caveat。
6. legacy `/community/content/:contentId` 由 `CommunityLegacyContentRedirect`
   replace 重定向到 `/community/look/:contentId`，query params 完整保留
   （`legacyContentRedirectTarget` 纯函数行为测试覆盖 entry/shape/length/return_to
   编码）；`CommunityContentPage` 不再渲染产品内容。
7. `tools/test-community-v7-1-look-adapter.mjs` 覆盖：纯适配器、无伪造
   hash/version ID、draft/deprecated 拒绝、确定性输出、canonical 路由、legacy
   重定向 query 保留、卡片/profile/intent/Wizard canonical 链接、必需证据标签。
   纯行为可测处均为行为测试；React 组件接线（redirect 组件、页面标签）为源码级
   校验并注明。
8. package script `test:community-v7-1-look-adapter` 已添加。
9. 本 VALIDATION.md 区分：路由/适配器逻辑（production-ready）、legacy fixture
   兼容（通过真实 fixtures 验证）、模拟/静态数据（静态 JSON，非实时后端）、
   制造/设备声明（未验证：`manufacturable` 与 `productionDispatched` 对 legacy
   均恒 false；旧 verification label 不替代制造合同或设备证据）。

## Automated gates

- `npm run typecheck` — PASS
- `npm run build:integration` — PASS
- `npm run test:community-v7-1-look-adapter` — PASS
  (viewable=11, malformed=17, prodLooks=4, devLooks=11)
- `npm run test:community-v7-1-design-content` — PASS (valid=7, invalid=71,
  schemaDefs=17, maxIssues=200)
- `npm run test:community-v7-1-identity` — PASS (valid=8, invalid=46,
  schemaDefs=15, maxIssues=200)
- `npm run test:community-domain` — PASS (published=11, multiFilter=1, creators=7)
- `npm run test:community-studio-flow` — PASS
- `npm run test:community-content` — PASS（既有 UI gate 已迁移为检查 canonical
  `CommunityLookPage` 的真实交互与封面回退实现，不依赖 legacy 注释 token）
- `npm run test:community-official` / `test:community-taxonomy` — PASS
- `git diff --check` — PASS

## Browser walkthrough

Local integration server: `http://127.0.0.1:5211`.

- 1440×900: Mercury Dew canonical详情、真实封面、能力徽章、Studio CTA 与证据块均可见；
  body/document 无横向溢出，详情与 evidence 宽度 768px，console error 0。
- 1280×800: legacy
  `/community/content/cc_pearl_tide?entry=legacy&shape=oval` 以 replace 到
  `/community/look/cc_pearl_tide?entry=legacy&shape=oval`；query 完整保留，页面宽度
  768px、无横向溢出。该 fixture 缺 assetRef，因此诚实显示“缺少可应用资产”，
  不提供虚假的试用 CTA。
- 390×844: 单列详情与证据块完整落在 343px 内容区，body/document 无横向溢出；
  header、封面、metadata、缺资产状态与证据 block 均可见。Community 壳既有部分
  小按钮仍低于 44px（非本 PR 新增，后续 IA/响应式 PR 统一处理）。
- Mercury Dew “在 Studio 中试用”真实点击后进入
  `/design/new?communityIntent=<intentId>`；未出现 page error / console error。
- `APPROXIMATE` 静态 fixtures 当前均缺 assetRef，故近似确认 modal 只能由源码与
  既有行为测试覆盖；本 PR 未伪造资产以制造可点击状态。

### Primary-agent review fixes

- 将过时 `test:community-intent` returnTo 期望更新为 canonical
  `/community/look/<id>`。
- legacy `SAMPLE_VERIFIED/PRODUCTION_VERIFIED` 不再推导可制造：旧标签缺少不可变
  制造合同与设备证据，`manufacturable` 统一为 false。
- 旧 `test:community-content` 改为检查 `CommunityLookPage` 的真实产品实现，移除
  依靠 legacy wrapper 注释 token 通过门禁的做法。

## Known limits

- `getLookReadModelById` / `loadLookReadModels` 为浏览器层（Vite
  `import.meta.env.MODE`）；其纯核心（`buildLookReadModels` + 适配器）已在 Node
  行为测试。仓储函数本身未在 Node 中执行（与既有 `content-repository.ts` 一致）。
- `CANONICAL` 变体为类型与 UI 分支预留；当前仓储仅产出 `LEGACY_PARTIAL`。
- 证据块标签（testid）为源码级校验；未做浏览器 DOM 走查（本任务无 UI/E2E 验收项）。
- 静态 JSON 数据非实时社区后端；制造/设备证据不存在且不被声称。
- `validate-community-content.mjs` 对 legacy 页的 token 断言由迁移文档注释满足
  （真实描述功能去向，非伪造）。

## Worktree

Working tree contains only the intended changes: `package.json` (one script),
new files under `src/community/domain/v7_1/`, `src/community/data/`,
`src/community/pages/`, `tools/`, and this evidence directory, plus the listed
edits. Nothing committed, pushed, or merged.
