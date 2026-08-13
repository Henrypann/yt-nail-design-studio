# RENDER-v0.7.2-01B｜单指聚焦 PBR 入口验收

## 产品裁决

- 顾客确认页的“十指总览 + 模拟 3D”继续使用既有 `v7-svg-composite`，本 PR 不替换十指路径。
- 只有“单指聚焦 + 模拟 3D”加载 `v0.7.2-single-nail-pbr`，这是 v0.7.2 新 3D 能力的唯一产品入口。
- “单指聚焦 + 2D 设计”继续使用既有结构化 2D/SVG reader。
- WebGL 或甲型解析不可用时留在当前设计、当前手指和当前页面，降级为 SVG 2.5D；不写 EditorDoc、history、repository 或 storage。

## 实施范围

- Three.js 运行时按单指 PBR 状态懒加载；十指与 2D 状态不加载该组件。
- 使用确定性闭合视觉外壳展示 C 弧、纵向拱高和侧面厚度，并提供正视、左右斜视、侧面和指尖五个固定相机。
- 使用 `MeshPhysicalMaterial`、linear-sRGB→sRGB、ACES tone mapping 和 gloss/matte/frosted profile。
- 立体装饰只做有限的 PBR 球体投影；平面、表面效果和完整附件资产投影仍待后续 RenderScene compiler。

## 证据边界

- Evidence：`simulated-not-manufacturing` / `approximate`。
- 视觉外壳的 C 弧、纵向拱高及 0.55mm 垂直厚度均为算法假设；不是 GEO-v0.7.2-02 canonical shell，也不是签收扫描/贴合结果。
- 本 PR 不生成或导出 STL/3MF，不证明工程壁厚、材料、固化、打印、强度、佩戴或设备兼容性。
- 当前甲型外观将在 GEO-v0.7.2-02 建立 versioned NailSurfaceRegistry 后替换；本 PR 不把临时程序曲面写回 EditorDoc。

## 自动与浏览器验收

- 确定性 mesh hash；无退化三角；每条边恰有两个 incident faces。
- PBR 组件无 storage/store/repository writer，无动画循环，卸载时释放 Three 资源。
- lazy product chunk 存在；Manifold、parity worker、three-bvh-csg 不进入产品构建。
- 1440：十指既有组合、单指侧面、单指正视、单指 2D。
- 390：WebGL unavailable 降级、当前指保持、writer-zero。
- `walkthrough-report.json`：console error、pageerror 均为 0。

截图：

- `screenshots/01-ten-finger-existing-composite.png`
- `screenshots/02-single-nail-pbr-side.png`
- `screenshots/03-single-nail-pbr-surface.png`
- `screenshots/04-single-nail-2d-unchanged.png`
- `screenshots/05-390-webgl-fallback.png`

## 验收命令

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:render-v0-7-2-contract`
- `npm run test:render-v0-7-2-single-nail`
- `RENDER_V072_URL=http://127.0.0.1:5244 npm run test:render-v0-7-2-single-nail:e2e`
- `npm run test:editor-v7-customer-preview`
- `npm run test:editor-v7-runtime`
- `npm run test:editor-v7-dimensional-decoration`
- `npm run test:editor-v7-finish-composite`
- `npm run test:product-surfaces`
- `git diff --check`
