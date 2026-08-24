# W34 Branch B → Branch A｜本地 Fast-forward Runbook

状态：`DO NOT EXECUTE / owner-gated`。本页只固定顺序与停止条件，不构成 merge 授权。

## 进入条件

1. 用户明确授权本地合入，并选择：
   - 先合入诚实 `AWAITING_INPUT` prototype，04B 运营内容继续开放；或
   - 等 Marketing/Community owner 提供 Banner、精选、集合、双语理由与 evidence 后再合。
2. Branch B HEAD 必须是已复核的 `3fa34d3c3d3c9b4e267a4c3fa2250116173d0af8` 或其后仅含已重新验证的证据提交。
3. `main` 仍从 `3f0fb9bc1f39793d300bd4216c637584e23161c9` 可 fast-forward 到 Branch B。
4. 主工作树既有 `AGENTS.md`、`.obsidian/`、`docs/architecture/` 与 Vite timestamp 原样保留；不 stash、reset、clean 或覆盖。
5. 任一 owner/rights/promotion 状态被自动升级、路径出现交集或完整 status 出现新的未知项，立即停止。

## 顺序

### 1. Branch B 最终复核

在 Branch B worktree 执行完整资产批次、`test:asset-ops-branch-boundary`、typecheck、build、build:integration 与 diff check。只允许整条 stack；禁止只 cherry-pick 03B、04A、05A 或证据提交。

### 2. 本地 main fast-forward Branch B

先只读核验 `main` HEAD/status/worktree list 与路径交集。只有用户明确授权且检查不变时，才在主 worktree 使用 `git merge --ff-only <Branch-B-HEAD>`；不 push。

### 3. Branch A 吸收更新后的 main

在 Studio French linked worktree 中合入更新后的 main，使 Branch B 成为最终 Branch A HEAD 的祖先。`package.json` 是唯一共同修改文件；当前三方演练可自动保留 16 条资产与 12 条 French scripts，但仍必须人工核对合并结果。

不得只 cherry-pick FRENCH-03/04 或证据提交。不得修改 EditorDoc schemaVersion 7、geometry registry、制造合同或 owner 状态来“解决”集成。

### 4. A+B combined 回归

至少重跑：

- French contract/migration/compiler/conversion/commands/renderers/golden；
- 资产 contract/inventory/governance/Starter/Community/Home/owner/combined；
- Community 与 French 相关 E2E；
- typecheck、build、build:integration、diff check；
- main 用户文件保护和 writer-zero。

### 5. 最终 fast-forward

只有 French 仍满足其 60/240、专业编辑细节与 owner 门，且 Combined Handoff 更新为实际 HEAD，才允许把本地 main fast-forward 到吸收后的 Branch A。仍不 push。

## 当前停止点

- Branch B：`READY(branch-code) / owner-gated`。
- Branch A：`READY(branch-code) / professional-signoff-gated`。
- 04B 真实运营输入、25/25 rights、10/10 promotion、French 60/240 专业门均未由自动测试关闭。
- 因此当前不执行任何 merge。
