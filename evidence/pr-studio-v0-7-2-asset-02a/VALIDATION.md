# STUDIO-v0.7.2-ASSET-02A｜Governance-aware Starter Shelf Read Model

## 状态

- `READY(branch) / prototype`：实现位于 Branch B `codex/w34-asset-ops-track`，尚未 fast-forward 到 `main`。
- 本 PR 只新增浏览器安全的严格解析合同和只读 read model，不修改 TemplateGallery、Wizard Store、EditorDoc、Community 或资产源文件。
- 10 条 candidate dataset 均保持 `rights=PENDING`、`promotion=BLOCKED`；`petalVeilEnabled=false` 时可见 9 条，开启时可见 10 条。

## 证据

| 检查 | 结果 |
|---|---|
| governance ledger 唯一 parser、25 IDs exact set、strict keys | PASS |
| Starter Shelf candidate dataset / deterministic order / 9-or-10 flag | PASS |
| feature flag visible-ID exact set、条目乱序拒绝 | PASS |
| unknown、missing、duplicate、lifecycle drift、rights/promotion unlock fail closed | PASS |
| four Look packs excluded from Starter Shelf | PASS |
| rights/capability/production owner signoff | PENDING；本 PR 不生成授权或制造证据 |

## 实际验证命令

以下命令均在 Branch B worktree 执行并通过：

```text
npm run test:studio-official-starter-shelf
npm run test:asset-ops-governance
npm run generate:asset-ops-governance
npm run test:asset-ops-inventory
npm run test:asset-ops-contract
python3 tools/validate-assets.py
npm run test:look-v0-7-2-four-sets
npm run test:look-v0-7-2-four-sets-integration
npm run typecheck
npm run build
npm run build:integration
git diff --check
```

`build` 和 `build:integration` 均输出既有 Vite chunk-size warning（主 bundle 大于 500 kB）；未引入新的构建错误。

Starter Shelf 以 `material-library/index.json` 的显式 `sort_order` 为排序真源；输出按 `sortOrder` 升序，再以 `assetId` 作为相同排序值的稳定 tie-break。非有限值 fail closed；本 fixture 的既有 sort_order 为负小数，保持源值，不改写资产 index。

## 边界

Read model 是 `prototype`/`READY(branch)` 级合同投影；不等同于 Official、Ready to use、Makeable、Commercially cleared 或 Manufacturing validated。
