# RENDER-v0.7.2-01B.2｜Texture Maps 验收

## 结论

`ACCEPT — SIMULATED RENDER MAPS ONLY`

本 PR 在既有 `material-projection-v1` 上增加一组确定性 mock render assets：透明 decal/image、tangent-space normal、linear roughness、linear height。资产只在活动步骤包含精确 `material.magnetic-gel@1` 时解析；没有 materialRef 的设计不叠加 mock 贴图。

## 合同与真源边界

- 资产集：`render.texture-set.aurora-almond-v2@1.0.0-simulated`。
- UV：`nail-local-v1-tip-to-root`。
- decal：sRGB + straight alpha，合成进 EditorDoc 派生的 base-color CanvasTexture。
- normal：linear、tangent-space RGB、OpenGL +Y。
- roughness：linear R channel。
- height：linear R channel，`0.18 mm` 仅作为 Three `bumpMap` 的视觉尺度；不修改 mesh、不写 EditorDoc，也不构成制造高度。
- 四张 PNG 均由仓库脚本确定性生成，manifest 记录 SHA-256、尺寸、色彩空间与通道。运行时先校验 SHA-256，失败则 fail closed 回退 SVG 2.5D。
- Almond v3 仅带入 `PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED` 候选资产包，供下一阶段 representation 接线；本 PR 的 PBR 仍使用既有 simulated preview surface。

## 浏览器走查

- 1440：Canonical 2D → 单指 PBR 正视、左斜、侧面；decal、颜色、局部法线高光、粗糙度和 visual bump 可见。
- 390：强制 WebGL unavailable 后回退 SVG 2.5D。
- writer-zero：相机、2D/3D 切换和 fallback 前后 Editor storage 原始字符串一致。
- console error / pageerror：0。

证据：`walkthrough-report.json` 与 `screenshots/01..06`。

## 自动门禁

| 检查 | 结果 |
|---|---|
| `npm run test:render-v0-7-2-texture-assets` | PASS |
| `npm run test:render-v0-7-2-material-projection` | PASS |
| `npm run test:render-v0-7-2-texture-assets:e2e` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 chunk warning |
| `git diff --check` | PASS |

## 未覆盖 / 强制后续

- 没有真实材料测量、BRDF、固化、附着、扫描贴合或制造证据。
- 没有把 visual-signed Almond v3 提升为 Registry representation。
- 下一步必须先完成 `NailSurfaceDefinition → CanonicalGeometrySnapshot → STL/GLB Representation`，再执行 `GEO-v0.7.2-02 Registry V2 / Promotion`。
- Promotion 前禁止把该候选用于正式 union/subtract/intersection；后续 Boolean 必须基于 surface frame/raycast，不得复用旧平板 Z 常量。
