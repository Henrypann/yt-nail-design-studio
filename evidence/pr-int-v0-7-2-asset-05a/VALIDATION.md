# INT-ASSET-05A｜联合矩阵与 Handoff 验证

状态：`READY (branch-code) / prototype`；ASSET-05 整体仍未完成。

## 验证范围

- 从实际 inventory、governance ledger、Starter Shelf preflight、Community capability report、03B/04A browser report 重算联合矩阵。
- 验证 21+4、25/25、63/7、24 subjects、两组 6 viewport 证据及 writer-zero 源码边界。
- owner 门全部保留 `UNKNOWN_INPUT_REQUIRED / NOT_VALIDATED`；rollback 与完整分支合入顺序可审计。

## 执行门禁

```text
npm run test:asset-ops-combined-handoff
PASS（21+4 inventory、25/25 governance、63/7 shelf、24 capability、6+6 viewport evidence、owner Unknowns）

npm run test:studio-official-starter-shelf
PASS

npm run test:studio-official-starter-preflight
PASS

npm run test:community-asset-capability
PASS

npm run test:community-home-merchandising
PASS

npm run typecheck
PASS

npm run build
PASS（仅既有 chunk warning）

npm run build:integration
PASS

git diff --check
PASS
```

## 裁决

- 当前可提交 `INT-ASSET-05A` 证据/Handoff checkpoint。
- 不得标记 ASSET-05 complete：ASSET-04B、owner close 与 main 合入均未完成。
- 不得只 cherry-pick 本提交；联合矩阵依赖此前完整 Branch B stack。
