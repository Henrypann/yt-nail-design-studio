# INT-ASSET-05B｜Branch B Merge Readiness Review

审查实现基线：`f928d4edc68cd8fcc46e4efe7639ce48c6bc75ea`；本轮门禁当前 HEAD 为 `bb689b4e775e1449547f4e2477e3347411a38340`。

裁决：`READY FOR PRODUCT/OWNER REVIEW`，**尚不建议立即 merge**。

实际合入前按 `FAST_FORWARD_RUNBOOK.md` 重新核验；该 runbook 当前为 `DO NOT EXECUTE / owner-gated`。

## 已确认

- Branch B 是 `main @ 3f0fb9b` 的直接后代，完整 stack 为 27 个实现/证据提交；禁止只 cherry-pick 后段 03B/04A/05A 或 Handoff。
- 完整 diff 74 文件；source 只位于 Community、platform asset authority、Studio official-starter-shelf 三个授权范围。
- 未修改 EditorDoc model/schema、French recipe/compiler、Wizard、geometry registry 或 manufacturing contract。
- 与 Branch A 唯一文件交集为 `package.json`；以 `main @ 3f0fb9b`、Branch B `8ce6d19`、Branch A `a150040` 在临时 detached worktree 执行无提交三方合并，Git 可无冲突合并。组合态 typecheck、build、build:integration、French contract/compiler/conversion/commands/renderers、资产联合矩阵、Home 合同和带显式 `ASSET_HEAD` 的边界门均通过。随后 Branch B 增加 owner review 门，当前三方 package 门再次通过并可保留 16 条资产脚本与 12 条 French 脚本。实际吸收后仍须重跑双方门禁，不把演练等同正式 merge。
- 与 main 用户 dirty/untracked 路径无交集：`AGENTS.md`、`.obsidian/`、`docs/architecture/`、Vite timestamp 均未被 Branch B 修改。
- 全资产专项、Community 回归、typecheck、build、integration build、03B/04A 六视口均通过。
- 05A 联合矩阵已纳入 04B 的 15 条 owner candidates 与 `AWAITING_INPUT_FAIL_CLOSED`，真实 owner 字段仍为空。

## Worktree 状态勘误与复核

- 早先根目录出现 `dist 2/` 扫描异常，曾导致完整 `git status` 长时间无返回，因此当时按 fail-closed 记为 merge gate。
- 13:05 后重新以 `opendir`、`stat` 与完整 `git status` 复核：目录为空（size 64、links 2），没有 Git 可见未跟踪内容，完整状态立即返回 clean。
- 未删除、移动、忽略或改写该空目录；它当前不再阻止 Git 合入。若后续再次出现内容，必须重新进入 fail-closed 检查。

## 仍阻止“立即 merge”的门

1. Product/Design 尚未单独签收 04A Home 等待态；用户回复“1–6 通过”对应 Branch A French 关键截图，不归入 Asset/Home 证据。
2. Marketing/Community owner 尚未填写 04B Banner、精选、集合与双语理由；Home 当前保持 `AWAITING_INPUT`。
3. 25/25 rights 仍 `PENDING`，10/10 Starter candidates promotion 仍 `BLOCKED`。
4. Hermes/Claude 外部审查此前没有通过 usage/model fail-closed 校验，不能记为外审通过。
5. 主工作树已有用户文件；即使路径不冲突，也必须在实际 fast-forward 前再次核验，不 stash/reset/clean。

## 建议裁决顺序

1. Owner input 到位则进入 04B `IN_REVIEW`；未到位可以明确接受“合入诚实空态，但运营内容未完成”。
2. Codex 在最终 HEAD 上重跑 branch-boundary、全资产专项、两组 E2E、typecheck/build/integration。
3. 用户明确授权后，完整 fast-forward Branch B 到本地 main；不 push。
4. Branch A 吸收新 main；`package.json` 当前演练可自动合并，但仍重跑 French 与资产双方门禁。

## 当前可安全声称

- 资产 authority/governance/read-model/preflight/capability/Home empty state 与联合证据在 Branch B 为 `prototype / READY(branch-code)`。
- 不能声称 Starter Shelf 已公开、Home 精选已上线、rights 已获批、当前可制作、制造验证、部署或 production-ready。
