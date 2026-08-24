# COMM-ASSET-03A｜Community Look 能力与血缘只读合同验证

状态：`READY (branch) / prototype`（当前资产运营分支本地实现，尚未合入 main）

## 本 checkpoint 的边界

- 新增 `COMM-v0.7.2-ASSET-03A` 严格 exact-key 合同，把 Community 的 24 条迁移主体投影为“版本化可编辑 / 旧版近似 / 资产不完整 / 不可用”。
- `VERSIONED_READY + EXACT` 只表示 DesignVersion、EditorDoc SHA-256 与 preview SHA-256 的不可变身份血缘完整；现有 preview 仍为 `APPROXIMATE`，不表示视觉、物理或制造 exact。
- 版权、可制作性、推荐甲型和来源类别全部与 TAX-02 migration manifest 逐项比对；任何漂移、缺失、重复或额外记录均失败关闭。
- `PENDING` 或 `PUBLIC_BLOCKED` 不可公开使用；`PERSONAL_USE_ONLY` 可公开查看，但商用和改编动作保持关闭。
- 本 checkpoint 不接入 Community UI，不写 EditorDoc，不改变现有 Use 路由，不推广资产，也不产生制造声明。

## 24 条受控结果

| 能力状态 | 数量 | 用户动作 |
|---|---:|---|
| `VERSIONED_READY` | 5 | `USE_VERSIONED` |
| `LEGACY_APPROXIMATE` | 2 | `USE_LEGACY_APPROXIMATE` |
| `ASSETS_INCOMPLETE` | 7 | `VIEW_ONLY` |
| `UNAVAILABLE` | 10 | `UNAVAILABLE` |
| 当前可制作 | 0 | 全部仍为 `CONCEPT_ONLY` |
| 制造验证 | 0 | 全部 `manufacturingValidated=false` |

完整 ID 分组见 `asset-capability-report-v1.json`。

## 执行的验证

```text
npm run test:community-asset-capability
PASS（24/24；5 versioned、2 legacy、7 incomplete、10 unavailable；版权/能力/来源/甲型/版本 SHA 失败关闭）

npm run test:community-taxonomy-v2
PASS

npm run test:community-discovery-migration
PASS

npm run test:community-v7-1-look-adapter
PASS

npm run test:community-v7-1-use-customize
PASS

npm run typecheck
PASS

npm run build
PASS（Vite chunk size warning 仅为既有提示）

npm run build:integration
PASS

git diff --check
PASS
```

## 合入与后续门禁

- 本 checkpoint 可以作为 Branch B 的代码提交；不能据此开放 Official Starter Shelf 或宣称 ASSET-03 全部完成。
- `COMM-ASSET-03B` 若要接入 UI，必须继续消费本读模型，不得根据 `applicationLevel` / `verificationLevel` 猜能力，也不得自动把 `ASSETS_INCOMPLETE` 放宽成可编辑。
- 资产 rights ledger 仍是 25/25 `PENDING`、promotion `BLOCKED`；该治理阻断未被本 checkpoint 改写。
- Petal Pearl 保持 `UNAVAILABLE`，等待独立的形状覆盖/资产路径决策。
