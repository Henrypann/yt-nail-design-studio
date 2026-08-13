# GEO-v0.7.2-01｜Geometry Kernel Parity

## 结论

- 同一封闭 box/sphere 网格分别由 `three-bvh-csg@0.0.18` 与 `manifold-3d@3.5.1` 执行 union、subtract、intersect。
- union/subtract 的封闭性、单组件、体积与 bounds 等价；两边三角化不同，因此不使用跨内核 hash 相等作为门禁。
- current intersect 产生 58 条开放边，体积相对差约 9.36%；Manifold 输出封闭单组件，因此该操作裁决为 `candidate_preferred`，不放宽阈值。
- UV、material group 与 face provenance 当前仅为降级/不可用；此 PR 不宣称属性保真，也不进入 EditorDoc 或生产编译器。

## Worker / 取消 / 资源边界

- parity 通过独立 module Worker 入口执行；client 提供 AbortSignal、timeout 和 terminate。
- parity 模块没有被产品入口引用。integration build 后检查 dist：无 Manifold、three-bvh-csg 或 parity-worker chunk。
- 所有结果为算法比较证据，不构成 C 弧、佩戴贴合、壁厚、材料、打印或制造验证。

## 验收

| 命令 | 结果 |
|---|---|
| `npm run test:geometry-v0-7-2-contract` | PASS |
| `npm run test:geometry-v0-7-2-parity` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 chunk warning |
| `git diff --check` | PASS |

详细数值见 `PARITY_REPORT.json`。
