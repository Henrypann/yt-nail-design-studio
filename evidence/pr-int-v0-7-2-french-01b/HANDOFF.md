# INT-v0.7.2-FRENCH-01A/01B｜Handoff

- 日期：2026-08-24
- 依赖主线：`main @ bcc11f0651938ef5c4299a5802161271d3d787f6`
- Branch A 吸收主线提交：`211774abf6bd91cae272f08a1ade4aa6122b2f63`
- French owner gate：`f3c556b`
- 01A：`ae9075b`
- 01B：以本文件所在提交为准

## 当前状态

- Branch B 已整体 fast-forward 到本地 `main`；未 cherry-pick，未 push。
- Branch A 已吸收该 `main`，A+B 静态、构建及浏览器回归通过。
- INT-FRENCH-01A 完成严格 French Use Context、TTL、来源/geometry 复核与 sessionStorage handoff。
- INT-FRENCH-01B 完成 canonical/Legacy 显式提示、打开既有法式工具、用户明确创建、保存重开与顾客预览 E2E。

## 下一动作

1. Codex 对本提交做最终 diff 与全门禁复跑。
2. 保持 Branch A clean 后，等待明确授权再把完整 Branch A stack `--ff-only` 合入本地 `main`。
3. 合入前再次确认主工作树的 `AGENTS.md`、`.obsidian/`、`docs/architecture/` 与 Vite timestamp 未被覆盖。

禁止只 cherry-pick 01A/01B；它们依赖 FRENCH-01～04、Branch A 的 A+B merge commit 与 Branch B 主线。
