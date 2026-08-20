# WIZ-01｜来源、资产与草稿真源验证

## 范围

本分支实现 Wizard Recovery Draft V2、StudioStartSourceV1、官方模板精确
AssetRefV7、Community Legacy 版本映射和 Wizard → EditorDocV7 provenance
投影。EditorDoc schemaVersion 7、既有 create-only bridge 语义未改变。

Community `assetVersion` 被视为发布 bundle/source 版本，不直接等同
manifest version 或 renderer revision。已登记的特殊映射包括：

- `t_petal_veil_french / 1.0.0 → template-v2`
- `t_mercury_dew_concept → t_liquid_velvet_cat_eye / 1.0.0 → template-v1`

未登记的模板、shape、版本或 SHA 均 fail closed；应用前不写 Wizard。

## 实际验证

在分支 `codex/wizard-v0-7-2-01-provenance`、基线 `main@9cfd424` 执行：

- `npm run test:wizard-v0-7-2-provenance` — PASS
- `npm run test:pr05-wizard-draft` — PASS
- `npm run test:community-intent` — PASS
- `npm run test:community-studio-flow` — PASS
- `npm run test:wizard-v7-flow` — PASS
- `npm run test:editor-v7-creation-cutover` — PASS
- `npm run test:editor-v7-petal-pearl-bloom` — PASS
- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run build:integration` — PASS
- `git diff --check` — PASS

专项测试覆盖：真实 `consumeCommunityImportIntent` 的 exact success、wrong
assetVersion writer-zero 和 intent cleanup、严格 unknown key、enum/ref/SHA、V1→V2 纯迁移、confirmed
legacy 不恢复、迁移失败保留原 storage、精确资产 identity、Community
bundle version 到 renderer revision 的显式映射、版本不匹配阻断、重复
读取、字段交叉污染、属性重排、uppercase SHA 拒绝、缺失 AssetRef 的
Editor bridge fail-closed，以及 Community/Wizard provenance 进入 EditorDocV7 sourceRefs。

生产 `WizardPage` 在恢复失败时暂停自动 V2 写入，直到用户通过 fresh
入口显式放弃旧草稿；因此失败 raw envelope 不会被空白会话覆盖。

Community Legacy exact consume 通过一次模板应用 transition 同时写入
templateId、exact AssetRefV7 和完整 Community provenance；intent 只有在
该 transition 返回成功后才清理。专项测试记录第一次可见模板状态已包含
完整 provenance，并验证错误版本不会触发 transition。

## 证据边界与风险

- 当前证据为本地代码测试、typecheck 和 production/integration build；尚未
  完成浏览器 UI 走查或跨设备验证。
- `WizardPage` 的本地 recovery 写入现在使用 V2；旧 V1 仍通过兼容 reader
  读取。历史 V1 confirmed 数据保留在 storage，但只返回可见的
  `confirmed_legacy` 失败状态，不恢复为可编辑草稿。
- 本分支只处理 provenance/recovery；Canonical Community intent 迁出 Wizard
  和正式 Approval 闭环属于 WIZ-02/WIZ-03。
- 证据等级：`validated-on-branch / local prototype`（当前分支代码与测试）；
  尚未 fast-forward 到 main，因此不声明 `integrated`。视觉/制造/生产能力
  不由本验证声明。
