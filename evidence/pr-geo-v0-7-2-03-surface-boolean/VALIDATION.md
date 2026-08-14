# GEO-v0.7.2-03｜真实甲面 Boolean 验收

## 结论

基于 `GEO-v0.7.2-02` 已晋级的 almond medium visual-v3 GLB，重新实施
`union / subtract / intersection`。本轮不再从 SVG 生成平板，也不使用历史 Spike 的固定
Z 定位。淡紫珍珠操作数通过 canonical UV `(0.69, 0.68)` 命中真实外表面三角形，按
重心插值得到 position / normal / tangent frame，再沿真实 normal 嵌入 `0.32 mm`。

证据等级：`simulated + integrated + deterministic-browser-geometry`。不是穿戴贴合、法向
工程壁厚、材料、强度、打印、后处理、设备或制造验证。

## 输入与定位证据

- Registry entry：`geometry-registry.almond.medium.visual-v3`
- Base GLB SHA-256：`8055bcd115c13fa6a25d5e3e942966ef09ca3a652760579df02a0bc02305e016`
- Canonical triangle hash：`05d14797db2369e4864173bc4cee0f830e5fcd2370fab3aa85850d78beae26dc`
- Operand：`petal-pearl-lavender-pearl@1.0.0-simulated`
- Operand GLB SHA-256：`c46c39f9ee94cfbcb0f2947e92cce9e8cc9768fff644a31f5833cfaa524de5ca`
- 实际 surface position：`[1.6179, -11.8880, 2.4530] mm`
- 实际 surface normal：`[0.2254, -0.2754, 0.9345]`
- Placement：`uv_barycentric_surface_frame`
- `fixedZUsed: false`

基础 GLB 与附件 GLB 均在解析前校验 byte length 与 SHA-256；任一损坏立即 fail-closed，
不会回退旧平板、primitive 或未校验资产。

## 布尔结果

Kernel：`manifold-3d/3.5.1`，只在 DEV-only Worker 内执行。

| Operation | Triangles | Volume | Boundary | Components | Deterministic hash |
|---|---:|---:|---:|---:|---|
| union | 18,020 | 98.04061 mm³ | 0 | 1 | `7b6e62fc…ac8a05` |
| subtract | 17,172 | 93.23329 mm³ | 0 | 1 | `648e1d44…75f2de` |
| intersect | 600 | 0.36196 mm³ | 0 | 1 | `9501e601…3e9693` |

三种结果均 non-manifold edge=0、degenerate triangle=0，重复计算 triangle count/hash 一致；
union/subtract 与 intersection 的体积恒等式通过。结果 UV、材质组和 face provenance 明确
标为 degraded/unavailable，不能进入制造或产品导出。

## 自动门禁

- `npm run typecheck`：PASS
- `npm run build:integration`：PASS（仅既有大 chunk warning）
- `npm run test:geo-v0-7-2-surface-boolean`：PASS
- `npm run test:geo-v0-7-2-surface-boolean-bundle`：PASS
- `npm run test:geometry-v0-7-2-contract`：PASS
- `npm run test:geometry-v0-7-2-parity`：PASS
- `npm run test:geo-v0-7-2-almond-representation`：PASS
- `npm run test:geo-v0-7-2-registry-v2`：PASS
- `npm run test:render-v0-7-2-single-nail`：PASS
- `npm run test:render-v0-7-2-material-projection`：PASS
- `npm run test:render-v0-7-2-texture-assets`：PASS
- `npm run test:editor-v7-dimensional-decoration`：PASS
- `npm run test:editor-v7-finish-composite`：PASS
- `npm run test:pr06` / `test:pr06-bundle`：PASS
- `npm run validate-assets`：PASS
- `git diff --check`：PASS

生产构建共 305 个文件，内部 route、Worker、Manifold、WASM、STL 与内部证据文案均为 0。

## 浏览器走查

`npm run test:geo-v0-7-2-surface-boolean:e2e`：PASS。

- 1440：Canvas `850 × 739`；390：Canvas `372 × 523.27`，完整甲根与圆润指尖均在安全区内。
- 两个 immutable GLB 均 200；1440 / 390 的 frame position/normal 完全一致。
- union oblique、subtract side、intersect underside、before surface-frame 均有独立截图。
- 390 操作目标均不小于 44px；无页面横向溢出。
- Editor/storage 原始字符串前后一致；console error / pageerror 为 0。
- 报告：`walkthrough-report.json`
- 截图：`screenshots/1440-*.png`、`screenshots/390-*.png`

## 能力边界与下一步

- 当前是内部几何/视觉验收页，不接 EditorDoc、顾客预览、发布或设备链。
- 未实现布尔结果的 UV/material/face provenance 重建；不能冒充最终 PBR 产品合成。
- 未证明实际装饰安装、打印或结构强度；珍珠仍是 `SIMULATED` 资产。
- 若后续接入 Editor，必须把 step/element canonical transform 编译为 UV surface-frame
  request；禁止恢复 `1.52 / 0.55 / 1.57 / 1.3 / 3.2 + height` 等旧平板常量。
