# ASSET-GEN-02｜资产 metadata migration 验证

状态：`READY (branch)`（当前分支本地实现，尚未合入 main）

## 本 PR 的边界

这是生命周期与映射元数据迁移：

- 11 个正式模板显式补齐 `asset_status: REAL`，不改变模板 ID、排序、UI 身份或既有二进制。
- 7 个候选模板保持 `CONCEPT`，3 个模拟模板保持 `SIMULATED`。
- 修复 Sunset Aura、Liquid Chrome 的基础模板 manifest 映射；Petal Pearl 的 template manifest 与 hero recipe manifest 分离。
- `validate-assets.py` 不再把缺省状态静默当作 `REAL`。

本 PR 不代表 rights clearance、product promotion、设计师视觉签收、真实材料/装配验证、扫描适配、打印或制造签收。

## 结果

| 项目 | 结果 |
|---|---:|
| 模板 | 21 |
| `already_valid_legacy` | 11 |
| `metadata_migration_required` | 0 |
| `candidate_only` | 7 |
| `already_valid_simulated_pack` | 7（3 个模板 + 4 套 Look） |
| `mapping_mismatch` | 0 |
| `missing_binary` | 0 |
| 四套 Look | 4，均 `SIMULATED_LOOK_ASSET_PACK`、10 指、`manufacturingValidated=false` |

## 执行的验证

```text
node tools/test-asset-ops-inventory.mjs
PASS（包含缺 asset_status、错误 fallback mapping、SHA/byteLength、制造标记和 texture/reference 缺失 fixture）

node tools/generate-asset-ops-inventory.mjs --output evidence/pr-asset-gen-02/asset-ops-inventory-v1-post-migration.json
PASS

npm run validate-assets
PASS

npm run test:look-v0-7-2-four-sets
PASS（四套十指 Look、16 张 reference-only maps、6 个 component GLB、4 个 dimensional kit）

npm run typecheck
PASS

npm run build
PASS（Vite chunk size warning，仅提示，不影响构建退出码）

npm run build:integration
PASS
```

## 证据限制

生成器输出是 deterministic inventory/gap report；四套 Look 仍为模拟预览资产，不能升级为制造资产或产品可制造声明。
