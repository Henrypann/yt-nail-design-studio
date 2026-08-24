# ASSET-GEN-01｜资产盘点生成器验证

状态：`READY (branch)`（当前分支本地实现，尚未合入 main）

## 范围

- 只读读取 `material-library/index.json`、模板 manifest/pattern/thumbnail 引用、四套 Look 资产索引与 manifest；对 Look 的封面、flat vector、四张 texture map、全部 component GLB、dimensional kit 和 recipe-spec 做存在性、SHA-256 与 byteLength 校验。
- 输出 `asset-ops-inventory-v1`，不修改既有资产或索引，不推断可制造性。
- 结果按稳定模板/Look ID 排序，未包含生成时间等非确定字段。

## 结果

| 项目 | 结果 |
|---|---:|
| 模板 | 21 |
| 缺少 `asset_status` 的正式模板（metadata gap） | 11 |
| `CONCEPT` 候选模板 | 7 |
| 已核验模拟模板 + 四套模拟 Look | 7（3 + 4） |
| 缺失二进制/引用文件 | 0 |
| 显式映射语义不一致 | 2 |
| 四套 Look | 4，均 `SIMULATED_LOOK_ASSET_PACK`、10 指、`manufacturingValidated=false` |

`t_sunset_aura_glaze_concept` 明确记录 `render_template_id=t_nude_gradient` 与
`manifest.template_id=t_liquid_velvet_cat_eye` 不一致；另有 `t_liquid_chrome_statement_concept`
同类不一致。两者仍保留 `candidate_only` 生命周期，同时增加 `mapping_mismatch` gap，不能静默当作可用映射。

## 执行的验证

```text
npm run test:asset-ops-inventory
PASS（21 templates, 4 four-look packs, mapping/gap fail-closed, byte-stable）

npm run generate:asset-ops-inventory
PASS

npm run typecheck
PASS

npm run build
PASS（仅既有 >500 kB chunk warning）

npm run build:integration
PASS（仅既有 >500 kB chunk warning）
```

专项测试还覆盖：重复运行 JSON byte-stable、缺失 thumbnail 引用 fail closed、未知
`render_template_id` fail closed、四套 Look manifest revision/Look ID、十指分配、封面
SHA-256/byteLength、制造标记、texture/reference 缺失和非制造证据边界。

## 限制

- `already_valid_legacy` 当前为 0；11 个历史正式模板的 manifest/pattern 文件存在，但索引缺少显式 `asset_status`，因此不能把默认 REAL 当成已治理元数据。
- 该盘点器只验证文件存在、manifest 映射和声明状态；不替代设计师视觉签收、真实材料/装配、扫描适配、打印或生产验证。
- 生成的四套 Look 仍属于模拟预览资产，不能升级为制造资产。
