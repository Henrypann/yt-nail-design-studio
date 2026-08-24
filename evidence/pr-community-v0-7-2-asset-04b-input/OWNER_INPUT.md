# COMM-ASSET-04B｜Marketing / Community Owner 输入单

状态：`AWAITING_OWNER_SELECTION`。本页是输入模板，不是 Agent 推荐、运营排期或签收记录。

## 可选候选

机器清单：`owner-input-pack-v1.json`。

- 仅列出当前 15 条治理后可公开 Look，按稳定 `contentId` 排序，不含算法分数、推荐顺序或 Agent 偏好。
- 每条保留 rights、capability、CTA、technical status、current-makeable 与 manufacturing 边界。
- `ASSETS_INCOMPLETE / UNAVAILABLE` 可以作为纯浏览内容被人工选择，但不能因此获得 Use 能力。

## Owner 需要填写

### 1. Banner（可留空）

- `bannerId`：
- `imageUrl`（仓库内 root-relative）：
- `href`：
- 中文标题 / 副标题：
- 英文标题 / 副标题：

留空时产品显示“本期未配置 Banner”，不会自动生成占位广告。

### 2. 编辑精选

逐项填写：

| Look ID | 顺序 rank | 中文编辑理由 | 英文编辑理由 |
|---|---:|---|---|
|  |  |  |  |

### 3. 集合（可留空）

| Collection ID | 中文/英文标题 | 中文/英文摘要 | Look IDs |
|---|---|---|---|
|  |  |  |  |

### 4. 审核证据

- owner stable ID：
- reviewedAt（ISO 8601）：
- evidence refs：
- Product/Design 表达签收：`UNKNOWN / PASS / REJECT`
- Rights/Legal 复核：`UNKNOWN / PASS / REJECT`

## 写入规则

1. 首次输入写为 `IN_REVIEW`，不得直接写 `PUBLISHED`。
2. 所有 Look 必须来自 owner input pack；未知 ID 失败关闭。
3. Product/Design 与 rights 证据齐全后才允许 `PUBLISHED`。
4. 不得把编辑精选称为“热门”“趋势”或“个性化推荐”。
5. 不得复制 Studio Official Starter Shelf 身份，也不得升级可制作/制造声明。
