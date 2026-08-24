# COMM-ASSET-04B-INPUT｜Owner 输入包验证

状态：`READY (branch evidence) / awaiting owner input`。不是 ASSET-04B 产品完成。

## 结果

- 从 TAX migration + ASSET-03 capability authority 确定性生成 15 条公开候选。
- 仅按稳定 `contentId` 排序；不生成排名、推荐分、趋势分或个性化分。
- 5 versioned、2 legacy approximate、7 assets incomplete、1 unavailable。
- 15/15 current-makeable=false、manufacturingValidated=false。
- owner 的 Banner、精选顺序、集合、双语理由与审核证据全部保持空值。

## 门禁

```text
npm run generate:community-home-owner-input:update
UPDATED（15 unranked candidates）

npm run generate:community-home-owner-input
CHECK PASS（byte-stable）

npm run test:community-home-owner-input
PASS

npm run test:community-home-owner-review
PASS（AWAITING_INPUT 保持空白；仅允许 15 条治理候选；unknown ref fail closed；不推导发布）

git diff --check
PASS
```

该输入包用于缩短沟通，不替代 Marketing / Community / Product / Design / Rights owner 的选择与签收。
