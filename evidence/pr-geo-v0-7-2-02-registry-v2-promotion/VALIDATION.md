# GEO-v0.7.2-02｜Registry V2 / Promotion 验收

## 结论

`almond medium visual-v3` 已从“产品视觉签收、未提升候选”提升为
`simulated_preview_geometry_kernel`。本次 Promotion 只授权：

- 单指 `SIMULATED PBR` 读取；
- 后续 Geometry Kernel 预研读取。

仍明确禁止 Manufacturing Compiler、Device Job、Production Export。STL 继续保持
`INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED`，没有进入 `public/` 或产品导出路径。

证据等级：`product-visual-signed-off + simulated + integrated`。不是扫描贴合、工程壁厚、
材料、强度、打印、后处理、设备或制造验证。

## 权威身份

- Registry：`nextgen-beauty.geometry-registry-v2@registry-v2-2026-08-14-almond-medium-v3`
- Entry：`geometry-registry.almond.medium.visual-v3@promotion-2026-08-14.1`
- NailSurface：`surface.almond.medium.visual-v3@3.0.0-simulated-candidate`
- CanonicalGeometry：`geometry.almond.medium.visual-v3`
- Canonical triangle SHA-256：`05d14797db2369e4864173bc4cee0f830e5fcd2370fab3aa85850d78beae26dc`
- Browser GLB SHA-256：`8055bcd115c13fa6a25d5e3e942966ef09ca3a652760579df02a0bc02305e016`
- GLB / STL 仍由同一个 CanonicalGeometry snapshot 派生；Promotion 不改 immutable representation。

## 产品接入

- 单指 PBR 不再调用 `createSingleNailPreviewSurfaceV1()` 生成旧程序化平板曲面。
- 只在 Editor 2D 几何解析为 `almond / medium` 且 Registry V2 允许
  `single_nail_pbr` 时加载公开 GLB。
- 浏览器在解析 GLB 前检查 byte length 与 SHA-256，并要求单 Mesh、indexed
  POSITION/NORMAL/UV、identity transform 和 triangle count 一致。
- 加载、完整性或能力失败时回退 SVG；禁止悄悄回退旧 3D 曲面。
- 本 PR 不渲染旧 fixed-Z 立体装饰占位。立体装饰等待下一 PR 按真实 surface frame
  重新实施 union/subtract/intersection。
- 所有预览操作 writer-zero。

## 自动门禁

- `npm run typecheck`：PASS
- `npm run build:integration`：PASS（仅既有大 chunk warning）
- `npm run test:geo-v0-7-2-registry-v2`：PASS
- `npm run test:geo-v0-7-2-almond-representation`：PASS
- `npm run test:render-v0-7-2-single-nail`：PASS
- `npm run test:render-v0-7-2-material-projection`：PASS
- `npm run test:render-v0-7-2-texture-assets`：PASS
- `npm run test:pr06-bundle`：PASS
- `npm run validate-assets`：PASS
- `git diff --check`：PASS

## 浏览器走查

`npm run test:geo-v0-7-2-registry-v2:e2e`：PASS。

- 1440 / 390：GLB 200 且每个上下文只请求一次；Registry entry、representation 和
  CanonicalGeometry hash 均可从 DOM 证据读取。
- 正视 / 侧视：真实 v3 C 弧和纵向 arch 可见；未使用旧平板 Z 常量。
- Editor storage 前后原始字符串一致；无横向溢出；console error / pageerror 为 0。
- 报告：`walkthrough-report.json`
- 截图：`screenshots/1440-*.png`、`screenshots/390-*.png`

## 后续强制顺序

下一 PR 才允许基于已提升 GLB 重新实施 `union / subtract / intersection`。所有操作数必须
由 UV/barycentric/raycast 解析真实 surface frame；禁止复用旧 Spike 的平板 Z 常量、固定
`1.52 / 0.55 / 1.57 / 3.2` 定位或 primitive 冒充真实资产。
