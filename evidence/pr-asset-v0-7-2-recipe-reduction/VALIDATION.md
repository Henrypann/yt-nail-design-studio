# Asset reduction / Recipe registry validation

日期：2026-08-25
分支：`codex/asset-v0-7-2-recipe-reduction`
基线：`f8cc096`

## 交付边界

- Quick Start 只展示 `t_french_white`，显示为“经典法式 / Classic French”。该模板对 7 个甲型均从 `template-pattern-assets.v7.json` 取得精确 `AssetRefV7`；不改变其它模板和历史源文件的可读性。
- 经典法式图案重新生成：裸粉底 + 白色尖端 + 微笑线；缩略图重新生成。pattern SHA 已同步到 V7 注册表。
- Official Starter Shelf 收敛为 1 个候选，仍严格保留 `rights=PENDING`、`promotion=BLOCKED`、`usageScope=LOCAL_CONCEPT_DRAFT_ONLY`、`manufacturingValidated=false`。
- Community 使用独立 `Community Look Recipe Registry V1`，注册 7 个 identity：Mercury Dew、Petal Veil、Leopard Gilded Nude、Crimson Reliquary、Ivory Lace Crystal、Honey Petal Glass、Petal Pearl Bloom。
- Repository 聚合后按 recipe 注册表过滤并按 recipe 去重；Petal Veil 优先 canonical `look.v7-1.petal-veil`，无 canonical 时可回退 legacy `cc_petal_veil`。未注册官方概念、Creator mock、internal draft 不进入公开 Look read model。源 fixture 和素材不删除。
- 注册不提升能力等级；四套 Look 与 Petal Pearl 仍为概念/模拟证据，制造命令始终禁用。

## 实际验证

通过：

- `npm run typecheck`
- `npm run validate-recipes`
- `npm run validate-assets`
- `npm run test:studio-official-starter-shelf`
- `npm run test:studio-official-starter-preflight`
- `npm run test:asset-ops-combined-handoff`
- `node --import ./tools/lib/register-node-vite.mjs --experimental-strip-types tools/test-template-gallery-hq.mjs`
- `node --import ./tools/lib/register-node-vite.mjs --experimental-strip-types tools/test-community-look-recipe-registry-v1.mjs`
- `npm run test:community-domain`
- `npm run test:community-v7-1-look-adapter`
- `npm run test:community-content-states`
- `npm run test:community-studio-flow`
- `npm run test:wizard-v0-7-2-quick-start`
- `git diff --check`

## Sol 独立浏览器走查（2026-08-25）

- Quick Start 仅显示 1 张官方模板卡：`经典法式 / Classic French`。
- 走查的实现路径：
  - `src/studio/wizard/TemplateGallery.tsx`
  - `src/studio/preview/material-library.ts`
  - `material-library/index.json`
  - `material-library/template-pattern-assets.v7.json`
- 浏览器实际验证：官方模板卡唯一、`img src=/material-library/templates/t_french_white/thumbnails/default.png`、点击应用、页面显示“Editor V7 资产预检通过 · 5/5”。本次未点击进入 Editor；7 甲型 registry、草稿恢复和 Editor 引用一致性来自专项测试，不作为浏览器走查证据。
- Community 实际公开 read-model 保留 7 个 Look ID：
  - `cc_mercury_dew`
  - `look.v7-1.petal-veil`
  - `look.v0-7-2.leopard-gilded-nude`
  - `look.v0-7-2.crimson-reliquary`
  - `look.v0-7-2.ivory-lace-crystal`
  - `look.v0-7-2.honey-petal-glass`
  - `cc_petal_pearl_bloom`
- 仓储过滤路径：`src/community/data/look-repository.ts`；Recipe 真源：`material-library/recipes/community-look-registry-v1.json`。

## 扩展回归

通过：

- `npm run test:gen-v7-1-backend-ports`
- `npm run test:community-home-merchandising`
- `npm run test:community-v7-1-explore-search`

已知基线冲突：`npm run test:community-content` 当前未通过。旧 validator 要求 `CommunityLookCard.tsx` 出现 `resolveStudioUseAvailabilityV1`，而较新的 `test-community-v7-1-explore-search` 明确禁止该旧 availability 推断入口。相关 Community UI 文件本分支未修改；该冲突不记录为本次 Recipe/资产减法通过项，也不伪造为已通过。

## 仍未签收

- rights 仍为 `PENDING`，promotion 仍为 `BLOCKED`；本地原型不代表公开商业授权。
- 视觉证据为 simulated / architecture-golden；没有制造验证、设备下发或生产能力声明。
- 经典法式缩略图已生成并通过文件存在/尺寸校验；桌面与移动端人工视觉签收仍需由产品/UI reviewer 完成。
