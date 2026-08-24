# ASSET-OPS-02｜治理清单与严格验证

状态：`READY (branch)`；本分支候选，尚未合入 main。

## 交付

- `material-library/asset-ops-governance-v1.json`：25 条确定性 ledger，21 个 material template + 4 个 simulated Look pack。
- `tools/generate-asset-ops-governance.mjs`：只读采集、路径安全、manifest/二进制引用和四套 Look 边界验证；输出无时间戳，重复生成 byte-stable。
- `tools/test-asset-ops-governance.mjs`：严格 exact-key parser 与 fail-closed fixture。

## 治理结论

| 项目 | 结果 |
|---|---:|
| ledger 记录 | 25/25 |
| rightsStatus=PENDING | 25 |
| promotionStatus=BLOCKED | 25 |
| template | 21 |
| Look pack | 4，均 SIMULATED、manufacturingValidated=false |
| 既有资产/manifest 修改 | 0 |

25/25 records 的 `completeness.manifest=PRESENT` 与 `completeness.binaries=PRESENT`，并与当前实际资产盘点一致；ledger parser 同时强制 21 个 template ID 与 4 个 Look ID 的 exact set，不允许未知、遗漏或跨类型记录。

ledger 保留当前 lifecycle、source/spec/manifest refs、结构与二进制完备性摘要、限制和证据层。
没有人工或来源证据的 rights、source ownership、commercial use、makeability、manufacturing
和 production 均未推断：rights 使用 `PENDING`，能力使用 `UNVERIFIED` 或 `CONCEPT_ONLY`，promotion 使用 `BLOCKED`，并记录 blocking codes。

## 验证命令

```text
npm run generate:asset-ops-governance                 PASS
npm run test:asset-ops-governance                    PASS
npm run test:asset-ops-inventory                     PASS
npm run test:asset-ops-contract                      PASS
npm run validate-assets                              PASS
npm run test:look-v0-7-2-four-sets                   PASS
npm run typecheck                                    PASS
npm run build                                        PASS（仅既有 chunk size warning）
npm run build:integration                            PASS
git diff --check                                     PASS
```

专项 fixture 覆盖：25/25、重复 ID、未知/遗漏 ID、跨类型/非法 lifecycle、非法 completeness 枚举、rights 无证据解锁、能力无证据升级、promotion 解锁、四套 Look 制造标志漂移、输入路径穿越、CLI `--output ../outside.json` 越界写入拒绝和重复生成稳定性。

## 仍需人工 owner 签收的 blocker

- rights/来源所有权/商业使用：每条记录仍是 `PENDING`，需要来源 owner 或法务证据。
- capability/makeability：没有资格能力证据，不能升级 `UNVERIFIED/CONCEPT_ONLY`。
- 视觉/产品 promotion：ledger 不替代设计师签收、canonical renderer 评审或版本发布授权。
- 四套 Look：保持模拟预览与非制造边界；不能作为物理适配、打印、装配或生产证据。
