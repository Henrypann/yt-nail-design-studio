# RENDER-v0.7.2-01B.1｜Material Projection 验收

## 结论

`ACCEPT — MATERIAL PROJECTION / SIMULATED PREVIEW ONLY`

本 PR 把 EditorDocV7 的背景、平面内容、遮罩和表面效果确定性投影为单甲 PBR 的 sRGB `CanvasTexture`。它解决“只有无色网格、像 STL”的预览问题，但不生成或验证生产 STL，也不升级制造证据。

## 合同与范围

- UV：`nail-local-v1`，`u=0→1` 左到右，`v=0→1` 指尖到甲根；外表面与内表面共享同一 UV 语义。
- 色彩：结构化 sRGB/RGBA → SVG material projection → CanvasTexture；Three 输出保持 sRGB 与 ACES tone mapping。
- 已投影：solid/translucent/gradient/cat-eye/glitter 背景、brush/vector/French、step/eraser/region mask、局部 cat-eye/glitter/mirror/ink-bloom。
- 明确降级：text 与 image_2d 暂不投影，返回 `unavailable` 与可见警告，不用代表色冒充。
- writer-zero：预览、切换相机和 WebGL fallback 均不修改 EditorDoc、history、revision 或 storage。
- 新 mock assets：`render.v0.7.2.aurora-almond-materials@1`，包含渐变、画笔、矢量星、French、masked ink-bloom 与 gloss；是结构化 V7 payload，不是截图或制造配方。

## Rounded Almond 视觉修复

- 去除“所有横截面收敛到孤立 apex”的针状外观。
- 最后自由缘使用已签收 medium Almond 2D silhouette 的 cubic Bézier tip region；terminal boundary 由 25 个弧线顶点组成。
- 最大宽度、侧墙、收尖和 rounded point 为一条连续轮廓；没有“细脖子 + 单独圆头”。
- medium 2D tip radius 参考值为 `1.15 mm`；预览 mesh 保持 closed/two-manifold、0 degenerate triangle。
- 仅 2D planform 有签收来源；C 弧、纵向拱高和 `0.55 mm` 视觉厚度仍是 `SIMULATED` 算法假设。

## 自动门禁

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS；仅既有 chunk size warning |
| `npm run test:render-v0-7-2-contract` | PASS |
| `npm run test:render-v0-7-2-single-nail` | PASS |
| `npm run test:render-v0-7-2-material-projection` | PASS |
| `npm run test:editor-v7-customer-preview` | PASS |
| `npm run test:editor-v7-background-advanced` | PASS |
| `npm run test:editor-v7-flat-vector` | PASS |
| `npm run test:editor-v7-surface-effect` | PASS |
| `npm run test:editor-v7-finish-composite` | PASS |
| `npm run test:pr06-bundle` | PASS；PBR 保持 lazy chunk |
| `npm run test:product-surfaces` | PASS |
| `git diff --check` | PASS |

## 浏览器走查

命令：`npm run test:render-v0-7-2-material-projection:e2e -- http://127.0.0.1:5245`

- Canonical 2D → PBR surface/oblique/side 显示同一组 Aurora assets。
- neutral L2 正视用于隔离检查 rounded almond tip。
- 390px 强制 WebGL fallback，保持当前指与 writer-zero。
- `surfaceHash=62fd40109fc426e50644d0db02405f8cd3ac181cf63eefcdf333d8a820cff821` 与最终源码一致。
- console errors = 0；page errors = 0。

截图：

1. `screenshots/01-canonical-2d-source.png`
2. `screenshots/02-pbr-material-surface.png`
3. `screenshots/03-pbr-material-oblique.png`
4. `screenshots/04-pbr-material-side.png`
5. `screenshots/05-neutral-rounded-tip.png`
6. `screenshots/06-390-material-fallback.png`

结构化报告：`walkthrough-report.json`

## 未覆盖 / 下一步

- 未绑定真实 signed GeometryRef 的 STL/GLB；当前是程序化 simulated preview shell。
- 未生成 normal/roughness/height map，局部厚度与光学参数不是材料测量。
- text、image_2d 和真实 GLB attachment 仍需后续 material/decal/asset projection。
- union/subtract/intersection 必须等 canonical NailSurface + Geometry Kernel 合同，不在本 PR 中继续用硬编码位置调参。
- 本证据不证明佩戴贴合、工程壁厚、材料、固化、打印、后处理、设备兼容或制造可行性。
