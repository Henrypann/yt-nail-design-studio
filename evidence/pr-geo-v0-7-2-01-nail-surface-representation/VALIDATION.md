# GEO-v0.7.2-01｜NailSurface / CanonicalGeometry / Representation 验收

## 结论

`ACCEPT — REPRESENTATION CONTRACT COMPLETE；NOT PROMOTED`

本 PR 把已完成产品视觉签收的 Almond v3 参数化壳体接入 v0.7.2 几何合同，不再使用 placeholder hash：

- `NailSurfaceDefinitionV1` 使用生成器实际输出的 landmark、C-curve station、longitudinal station、cavity 与 vertical preview thickness station。
- `CanonicalGeometrySnapshotV1.geometryHash` 绑定真实 canonical triangle SHA-256：`05d14797db2369e4864173bc4cee0f830e5fcd2370fab3aa85850d78beae26dc`。
- GLB 与 STL representation 引用真实 artifact SHA、byteLength、coordinate frame、attribute fidelity；两者指向同一个 canonical snapshot。
- representation 本身不含 Promotion 状态。生命周期由下一 PR `GEO-v0.7.2-02 Registry V2 / Promotion` 管理。

## 资产与证据边界

- GLB：`DEV_REVIEW_ONLY`，保留 UV/normal/material group。
- STL：`INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED`，无 runtime URL，不提供下载。
- thickness 模式明确为 `vertical_preview_thickness`，不是 normal-offset 工程壁厚。
- fidelity：`approximate`；`manufacturingValidated=false`。
- 不证明扫描贴合、材料、强度、打印、后处理或设备兼容。

机器合同：

- `assets/geometry/representations/almond-medium-v3/canonical-bundle.json`
- `geometry-contract-v1.schema.json` 的 representation / representationSet / bundle definitions
- `verifyNailSurfaceGeometryBundleV1` 对真实 bytes 做 fail-closed SHA/长度预检，不回退其他 mesh、不做隐式 Promotion

## 自动门禁

| 检查 | 结果 |
|---|---|
| `npm run generate:spike-almond-shell` | PASS |
| `npm run test:spike-almond-shell` | PASS |
| `npm run generate:geo-v0-7-2-almond-representation` | PASS |
| `npm run test:geo-v0-7-2-almond-representation` | PASS |
| `npm run test:geometry-v0-7-2-contract` | PASS |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS |

## 下一强制步骤

只有 `GEO-v0.7.2-02 Registry V2 / Promotion` 可以授权 resolver 将该 representation 用作模拟 3D/Boolean 输入。Promotion 前，正式 Editor GeometryRef 与生产路径不得解析到该资产。
