# PR｜四套 v0.7.2 Look 集成修复验收

## 范围与结论

- Branch：`codex/look-v0-7-2-four-sets-integration`
- Baseline：local `main` / merge-base `4d38821b4de419c9638c92baf85946e6b96fb5bb`
- Reviewed parent：`899b97331219bd7cb8cb5ffbd660762d8656e6c6`
- Contract：`EditorDoc schemaVersion: 7`
- 结果：五项 merge blocker 已修复；4 套 × 10 指 = 40/40 逐项 E2E 通过；建议完整 fast-forward，不单独 cherry-pick。

## 五项修复的验证

| 风险 | 修复 | 验证 |
|---|---|---|
| 共享 decal 覆盖逐指设计 | 四套 look-level maps 标记 reference-only；运行时仅保留真正共享的 Aurora 中性材质集 | 40/40 `textureAssetSet=none`；每指 `projectedLayerKinds` 与 canonical steps 一致 |
| EditorDoc 资产被当前 manifest 静默替换 | 严格匹配 asset id / revision / SHA / MIME；cache key 为 `URL#SHA` | 精确引用成功；错 revision/SHA 返回 `immutable_asset_mismatch`；E2E 0 降级 |
| `RENDER_VERIFIED` 与概念证据冲突 | Community 改为 `CONCEPT`、`previewVerified=false` | 单测同时断言 `CONCEPT + APPROXIMATE + false` |
| 相机忽略装饰 | `Box3.setFromObject(renderRoot)` 覆盖甲面与已加载可见装饰 | 40/40 `renderBounds=nail-and-visible-decorations` 且 framing safe |
| 每套只抽两指 | E2E 遍历全部 L1–R5 | 40 张单指截图、40 条逐指结构与运行指标 |

## 四套完整 40 指分配表

缩写：`B` background，`F` flat_design，`E` surface_effect，`D` dimensional_decoration，`S` surface_finish。`装饰`是实际渲染数；所有行均为 `fallback=0`、`textureSet=none`、联合 bounds framing safe。

| Look | 指位 | Canonical steps | PBR 投影 | 装饰 |
|---|---|---|---|---:|
| Leopard | L1 | B→F→F→D→S | B+F | 1 |
| Leopard | L2 | B→F→S | B+F | 0 |
| Leopard | L3 | B→F→S | B+F | 0 |
| Leopard | L4 | B→F→S | B+F | 0 |
| Leopard | L5 | B→S | B | 0 |
| Leopard | R1 | B→F→S | B+F | 0 |
| Leopard | R2 | B→F→S | B+F | 0 |
| Leopard | R3 | B→F→S | B+F | 0 |
| Leopard | R4 | B→F→F→D→S | B+F | 1 |
| Leopard | R5 | B→D→S | B | 1 |
| Crimson | L1 | B→F→D→S | B+F | 1 |
| Crimson | L2 | B→F→S | B+F | 0 |
| Crimson | L3 | B→F→D→S | B+F | 1 |
| Crimson | L4 | B→F→S | B+F | 0 |
| Crimson | L5 | B→D→S | B | 1 |
| Crimson | R1 | B→F→S | B+F | 0 |
| Crimson | R2 | B→D→S | B | 1 |
| Crimson | R3 | B→F→D→S | B+F | 1 |
| Crimson | R4 | B→F→D→S | B+F | 1 |
| Crimson | R5 | B→F→S | B+F | 0 |
| Ivory | L1 | B→F→D→S | B+F | 1 |
| Ivory | L2 | B→F→D→S | B+F | 1 |
| Ivory | L3 | B→F→D→S | B+F | 1 |
| Ivory | L4 | B→F→D→S | B+F | 1 |
| Ivory | L5 | B→F→S | B+F | 0 |
| Ivory | R1 | B→F→S | B+F | 0 |
| Ivory | R2 | B→F→D→S | B+F | 1 |
| Ivory | R3 | B→F→D→S | B+F | 1 |
| Ivory | R4 | B→F→D→S | B+F | 1 |
| Ivory | R5 | B→F→D→S | B+F | 1 |
| Honey | L1 | B→D→E→S | B+E | 1 |
| Honey | L2 | B→F→S | B+F | 0 |
| Honey | L3 | B→E→S | B+E | 0 |
| Honey | L4 | B→F→D→S | B+F | 1 |
| Honey | L5 | B→F→S | B+F | 0 |
| Honey | R1 | B→F→S | B+F | 0 |
| Honey | R2 | B→F→S | B+F | 0 |
| Honey | R3 | B→D→E→S | B+E | 1 |
| Honey | R4 | B→F→D→S | B+F | 1 |
| Honey | R5 | B→E→S | B+E | 0 |

## 自动门禁

- `npm run typecheck`：PASS
- `npm run build`：PASS；仅既有大 chunk warning
- `npm run build:integration`：PASS；仅既有大 chunk warning
- `npm run generate:look-v0-7-2-four-sets`：PASS
- `npm run test:look-v0-7-2-four-sets`：PASS；生成器 byte-identical
- `npm run test:look-v0-7-2-four-sets-integration`：PASS
- `npm run test:render-v0-7-2-single-nail`：PASS
- `npm run test:render-v0-7-2-material-projection`：PASS
- `npm run test:render-v0-7-2-texture-assets`：PASS
- `npm run test:community-content`：PASS
- `npm run test:community-domain`：PASS
- `npm run test:community-v7-1-use-customize`：PASS
- `npm run test:editor-v7-dimensional-decoration`：PASS
- `npm run test:editor-v7-runtime`：PASS
- `npm run test:geo-v0-7-2-registry-v2`：PASS
- `npm run test:geo-v0-7-2-surface-boolean`：PASS
- `npm run test:geo-v0-7-2-surface-boolean-bundle`：PASS
- `npm run validate-assets`：PASS
- `FOUR_LOOK_BASE_URL=http://127.0.0.1:5240 node tools/walkthrough-v0-7-2-four-look-integration.mjs`：PASS，40/40
- `git diff --check`：PASS

## 人工视觉检查

检查了每套无装饰/有装饰、平面设计/表面效果的代表截图。确认共享 Look 图没有覆盖逐指差异；无设计的 Leopard L5 保持中性，Leopard R4、Crimson R3、Ivory R4、Honey R4 的当前装饰保持可见且未被裁切。自动化保存全部 40 指截图，便于逐张复核。

## 证据边界

- Community cover：AI 高保真概念图，`APPROXIMATE / CONCEPT`。
- EditorDoc：结构化十指设计真源。
- GLB/PBR/2.5D：模拟浏览器预览，不是制造证据。
- 未验证真实材料、贴合、固化、强度、打印、设备或量产。
