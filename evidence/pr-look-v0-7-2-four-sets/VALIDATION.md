# PR｜v0.7.2 四套十指 Look 资产包验收

## 范围

- Base：`d09da9b`（GEO-v0.7.2-03 Surface Boolean）。
- 分支：`codex/look-v0-7-2-four-sets-assets`。
- 只新增资产包、确定性生成器、资产测试与证据；不接 Community、Wizard、Editor store 或制造编译链。
- 参考图只用于层级和材料语言，不再分发原始参考图。

## 交付

| Look | 十指高保真图 | 贴图 | 独立 GLB | Kit GLB |
|---|---:|---:|---:|---:|
| Leopard Gilded Nude | 1 | 4 | 1 | 1 |
| Crimson Reliquary | 1 | 4 | 1 | 1 |
| Ivory Lace Crystal | 1 | 4 | 3 | 1 |
| Honey Petal Glass | 1 | 4 | 1 | 1 |
| 合计 | 4 | 16 | 6 | 4 |

四套均有 10 个完整指位定义，每指恰好一个 background、零至多个中间步骤、一个末位 gloss finish。十指分配详见 `assets/hero-recipes/v0-7-2-four-look-sets-ASSET_SPEC.md`。

## 视觉检查

- 4 张封面均为 1672×941、两排五枚、恰好十枚，未出现手、包装、文字、水印或游离装饰。
- Leopard：2 枚主视觉水晶金饰；豹纹、斜切与裸粉留白有明确节奏。
- Crimson：2 枚十字珠链主视觉；抽象曲线与酒红留白形成强弱层级。
- Ivory：水钻、浮雕花、蕾丝、珍珠星群与两枚留白分布清晰，没有把全部装饰堆在同一枚甲片。
- Honey：2 枚大透明花、2 枚小蜂蜜花、4 枚白法式、2 枚留白，透明材质在裸粉背景上可辨认。
- 封面属于 `AI_GENERATED_HIGH_FIDELITY_CONCEPT`，尚未完成美甲师/设计师试用签收，也不是 Canonical Renderer 的逐像素输出。

## 自动验收

| 命令 | 结果 |
|---|---|
| `npm run test:look-v0-7-2-four-sets` | PASS；4 Look、40 指位、16 maps、6 component GLB、4 kit GLB；SHA/尺寸/GLB 2.0/PBR/基数/重生成字节一致 |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 >500 kB chunk warning |
| `npm run validate-assets` | PASS |
| `npm run test:editor-v7-dimensional-decoration` | PASS |
| `npm run test:render-v0-7-2-texture-assets` | PASS |
| `npm run test:geo-v0-7-2-registry-v2` | PASS |
| `npm run test:geo-v0-7-2-surface-boolean` | PASS |
| `npm run test:geo-v0-7-2-surface-boolean-bundle` | PASS；生产 bundle 无内部 kernel/WASM/STL 泄漏 |
| `git diff --check` | PASS |

说明：第一次将 bundle test 与 build 并行启动时，bundle test 在 `dist/` 生成前得到 `ENOENT`；build 完成后顺序重跑为 PASS，不是产品或资产回归。

## v0.7.2 边界

- `manifest.json` 的结构化十指分配是本资产包设计真源；高保真封面、SVG、PNG 与 GLB 都是派生资产。
- 模拟 3D 只使用已经 Promotion 的 `geometry-registry.almond.medium.visual-v3` 作为预览基座，仍是 `promoted_simulated_preview`，不构成生产甲型。
- decal 使用 sRGB；normal/roughness/height 使用 linear；height 明确为 `visual_bump_not_geometry`。
- 装饰 GLB 有 PBR material，但没有真实材料测量、粘接/点胶/固化、佩戴贴合、强度、打印、后处理或设备验证。
- 本 PR 故意不生成装饰 STL。STL 属 CanonicalGeometry/制造 representation；将 Look 装饰直接输出 STL 会破坏 v0.7.2 边界。

## 结论

证据等级：`SIMULATED_LOOK_ASSET_PACK + AI_GENERATED_HIGH_FIDELITY_CONCEPT`。

建议：可作为后续 Community Look、Wizard 推荐和 Editor V7 materialization 的输入候选；在接入产品 UI 前应先完成用户对四套封面的人工签收，并单独验证逐指 placement/scale/rotation。
