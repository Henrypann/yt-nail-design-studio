# RENDER-v0.7.2-01A｜Render Scene & Appearance Contract

## 冻结范围

- 新合同只服务 `single_nail_focus_simulated_3d`；十指整体模拟 3D 继续使用既有 SVG 2.5D composite。
- `PreviewAppearanceProfileV1` 冻结 linear-sRGB → sRGB、ACES Filmic、neutral studio environment、gloss/matte/frosted 模拟参数及五个可复现相机预设。
- `RenderSceneSnapshotV1` 只引用固定 design revision、finger、geometry hash、step layer fidelity 和 appearance profile；它不是 EditorDoc writer。
- 所有 PBR/灯光/封层结果固定为 simulated/approximate，`manufacturingValidated:false`。

## 门禁

| 命令 | 结果 |
|---|---|
| `npm run test:render-v0-7-2-contract` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:geometry-v0-7-2-contract` | PASS |
| `npm run test:geometry-v0-7-2-parity` | PASS |
| `git diff --check` | PASS |

此 PR 不含 Three UI、WebGL、材质真实性或制造输出。
