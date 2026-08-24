# INT-ASSET-05B｜Branch Boundary Review Validation

状态：`READY (branch review) / merge pending product-owner gates`。

```text
node tools/test-asset-ops-branch-boundary.mjs
PASS（main ancestor；Branch A 唯一交集 package.json；三方合并无冲突并保留双方 scripts；无 Editor/French ownership crossing）

完整资产专项批次
PASS（contract/inventory/governance/validate-assets/starter/capability/Home/combined/owner-input/TAX/UI/typecheck）

npm run build
PASS

npm run build:integration
PASS

git diff --check
PASS
```

本 review 只证明分支代码/范围门，不替代 Product、Design、Marketing、Rights、Nail Expert 或 Manufacturing owner 签收。

Worktree 补充：13:05 后复核 `dist 2/` 为空目录，完整 `git status --short --branch` 立即返回 clean；未删除或隐藏目录。该临时扫描异常已解除，不再作为 Git merge gate。

人工证据补充：用户于 2026-08-24 回复“1–6 通过”；仅记为所展示六张证据的快速视觉签收，不替代运营 owner、rights、制造或发布签收。

## A+B 无提交组合演练

临时 detached worktree：Branch B `8ce6d19` + Branch A `a150040`，`git merge --no-commit --no-ff` 自动合并成功；最终边界脚本在 Branch B `16f5b9e` 增加显式 `ASSET_HEAD` 后可在组合态复核原始 B 范围。

```text
npm run typecheck                         PASS
npm run build                             PASS
npm run build:integration                 PASS
French contract/compiler/conversion       PASS
French commands/renderers                 PASS
Asset combined handoff/Home contract      PASS
ASSET_HEAD=16f5b9e node tools/test-asset-ops-branch-boundary.mjs
PASS
```

该演练没有创建 merge commit，主工作树已核对恢复为原 `main @ 3f0fb9b` 与原有 dirty/untracked 状态；它不替代正式吸收后的 E2E 与 owner 门。

后续 `5841b95` 新增 `test:community-home-owner-review`：当前 `AWAITING_INPUT` 必须完全空白，只允许 input pack 的 15 条候选，unknown ref 失败关闭，不推导 `PUBLISHED`；`c3a6856` 再把该门纳入 05A 联合矩阵。更新后的 package 三方门、typecheck 与 `build:integration` 均通过。

## 最终 HEAD 批次

在 `18df2da` 上再次执行 asset contract/inventory/governance、validate-assets、Starter Shelf/read preflight、Community capability/UI、Home、owner input check/review、combined handoff、branch boundary、typecheck、build、build:integration 与 diff check，全部 PASS；仅保留既有 Vite chunk-size warning。完整 `git status` clean。

Boundary test 默认 base 已固定为本轮真实 `3f0fb9b`，避免本地 `main` 后续 fast-forward 后改变审查集合；仍可用 `ASSET_BRANCH_BASE` 显式覆盖。
