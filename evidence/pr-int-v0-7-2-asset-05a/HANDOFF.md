# INT-ASSET-05A｜Asset Ops 联合验证与 Handoff

状态：`PARTIAL READY (branch) / prototype`。本文件不声称 ASSET-04B、owner 签收、main 合入、push、部署或制造完成。

## 1. 当前可交接结果

| 域 | 当前证据 | 裁决 |
|---|---:|---|
| Inventory | 21 templates + 4 ten-finger simulated Look packs | 二进制/metadata 盘点完整；四套 Look 仍非制造 |
| Governance | 25/25 records | rights 25 PENDING；promotion 25 BLOCKED |
| Studio Starter Shelf | 10 candidates × 7 shapes | 63 EXACT identity，7 Petal Pearl UNAVAILABLE；全部仅 `LOCAL_CONCEPT_DRAFT_ONLY` |
| Community capability | 24 subjects | 5 versioned、2 legacy approximate、7 incomplete、10 unavailable；current-makeable=0 |
| Community UI | 03B 六视口 | Canonical/Legacy/Incomplete/Unavailable 与失败关闭可见 |
| Home merchandising | 04A 六视口 | `AWAITING_INPUT`；无虚构 Banner/精选/集合；15 条治理 Feed 保留 |

唯一机器可审计摘要为 `asset-ops-combined-matrix-v1.json`，专项测试从实际 inventory、ledger、preflight、capability 与两份浏览器报告重算上述数字。

## 2. 产品面边界

```text
共享二进制与 revision/SHA authority
├─ Studio Official Starter Shelf
│  └─ 起稿候选；当前 rights PENDING / promotion BLOCKED
└─ Community Look / Home merchandising
   └─ 发现、详情、收藏与显式 Use 条件；不复制 Quick Start 库
```

`EXACT` 在 Starter Shelf 只表示 registry asset identity/revision/SHA 完整；在 Community 只表示 DesignVersion/EditorDoc/preview identity lineage 完整。两者都不表示视觉、物理或制造 exact。

## 3. Owner 门与 Unknown

- Rights/Legal owner：25/25 来源所有权、商业使用证据未提供，保持 `UNKNOWN_INPUT_REQUIRED`。
- Product/Design owner：Starter Shelf promotion 未签收，10/10 保持 `BLOCKED`。
- Marketing/Community owner：Banner、精选 Look ID/顺序、集合与双语编辑理由未提供，Home 保持 `AWAITING_INPUT`。
- Nail Expert/Manufacturing owner：无实体、fit、print、process、workcell 证据，保持 `NOT_VALIDATED`。

这些 Unknown 不是测试失败，也不能被自动推断关闭。

## 4. 回滚

- Home：保留/恢复 `home-merchandising-v1.json` 的 `AWAITING_INPUT` revision；下方治理 Feed 不受影响。
- Community UI：如 03B 表达被拒绝，可单独 revert presentation commit，03A capability authority 不变。
- Starter Shelf：保持 promotion `BLOCKED`，`petalVeilEnabled=false`；不会公开任何 candidate。
- 整分支：未获合入授权时不 fast-forward，`main @ 3f0fb9b` 保持不变。

禁止 stash/reset/clean 主工作树现有 `AGENTS.md`、`.obsidian/`、`docs/architecture/` 与 Vite timestamp。

## 5. 后续顺序

1. `ASSET-04B`：owner 提供并签收运营内容，更新配置到 `IN_REVIEW`；只有完整 evidence 后才能 `PUBLISHED`。
2. 独立复核 Branch B 完整 diff 和所有 VALIDATION；确认不把 PENDING/BLOCKED 升级。
3. 用户明确授权后，才考虑完整 Branch B fast-forward；不只 cherry-pick 03B、04A 或本 Handoff。
4. Branch A 再吸收更新后的 main，重跑 French 回归，之后才进入 INT-FRENCH-01A/01B。

## 6. 明确未完成

- `ASSET-04 fully delivered`：否，04B owner 内容缺失。
- `ASSET-05 complete`：否，owner close 与 main 合入未完成；当前仅 05A 联合证据/Handoff checkpoint。
- remote push / deployment / production：否。
- current makeable / physical / manufacturing validation：否。
