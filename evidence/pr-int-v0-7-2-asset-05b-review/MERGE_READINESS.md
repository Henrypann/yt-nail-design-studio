# INT-ASSET-05B｜Branch B Merge Readiness Review

审查实现基线：`f928d4edc68cd8fcc46e4efe7639ce48c6bc75ea`；本轮门禁最终 HEAD 为 `16f5b9eb341248325841bb3d35bafe16a1cdf403`。

裁决：`READY FOR PRODUCT/OWNER REVIEW`，**尚不建议立即 merge**。

## 已确认

- Branch B 是 `main @ 3f0fb9b` 的直接后代，完整 stack 为 12 个实现/证据提交；禁止只 cherry-pick 后段 03B/04A/05A。
- 实现 diff 69 文件；source 只位于 Community、platform asset authority、Studio official-starter-shelf 三个授权范围。
- 未修改 EditorDoc model/schema、French recipe/compiler、Wizard、geometry registry 或 manufacturing contract。
- 与 Branch A 唯一文件交集为 `package.json`；以 `main @ 3f0fb9b`、Branch B `8ce6d19`、Branch A `a150040` 在临时 detached worktree 执行无提交三方合并，Git 可无冲突合并且保留 15 条资产脚本与 12 条 French 脚本。组合态 typecheck、build、build:integration、French contract/compiler/conversion/commands/renderers、资产联合矩阵、Home 合同和带显式 `ASSET_HEAD` 的边界门均通过。实际吸收后仍须重跑双方门禁，不把演练等同正式 merge。
- 与 main 用户 dirty/untracked 路径无交集：`AGENTS.md`、`.obsidian/`、`docs/architecture/`、Vite timestamp 均未被 Branch B 修改。
- 全资产专项、Community 回归、typecheck、build、integration build、03B/04A 六视口均通过。

## Worktree 状态勘误

- tracked state 为 clean（`git status --untracked-files=no`）。
- worktree 根目录存在未跟踪 `dist 2/`；创建于 12:35、修改于 12:47，约 65,535 个目录项，完整 `git status` 会长时间扫描。
- 该目录不在 Branch B commit，也未被 `.gitignore` 的 `dist` 规则覆盖。当前未删除、移动、忽略或改写，因为尚未完成内容/归属确认。
- 因此在处理该副产物前，不得把 worktree 写成“完整 clean”，也不得进入 fast-forward。

## 仍阻止“立即 merge”的门

1. 用户已于 2026-08-24 明确回复“1–6 通过”，可记录为本轮所展示六张可见证据的快速视觉签收；它不替代 Marketing/Community owner 的内容选择，也不升级为发布签收。
2. Marketing/Community owner 尚未填写 04B Banner、精选、集合与双语理由；Home 当前保持 `AWAITING_INPUT`。
3. 25/25 rights 仍 `PENDING`，10/10 Starter candidates promotion 仍 `BLOCKED`。
4. Hermes/Claude 外部审查此前没有通过 usage/model fail-closed 校验，不能记为外审通过。
5. 主工作树已有用户文件；即使路径不冲突，也必须在实际 fast-forward 前再次核验，不 stash/reset/clean。
6. Branch B worktree 的未跟踪 `dist 2/` 必须先由用户确认清理/保留策略；不得静默删除。

## 建议裁决顺序

1. Owner input 到位则进入 04B `IN_REVIEW`；未到位可以明确接受“合入诚实空态，但运营内容未完成”。
2. Codex 在最终 HEAD 上重跑 branch-boundary、全资产专项、两组 E2E、typecheck/build/integration。
3. 用户明确授权后，完整 fast-forward Branch B 到本地 main；不 push。
4. Branch A 吸收新 main；`package.json` 当前演练可自动合并，但仍重跑 French 与资产双方门禁。

## 当前可安全声称

- 资产 authority/governance/read-model/preflight/capability/Home empty state 与联合证据在 Branch B 为 `prototype / READY(branch-code)`。
- 不能声称 Starter Shelf 已公开、Home 精选已上线、rights 已获批、当前可制作、制造验证、部署或 production-ready。
