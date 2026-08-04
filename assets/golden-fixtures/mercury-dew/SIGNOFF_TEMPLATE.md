# Mercury Dew · M4 视觉签收

这些 fixture 只记录 Canonical Renderer 的签收矩阵，不把概念封面或占位图当作 Golden Output。
`lengthPreset` 是产品侧长度枚举；`geometryLength` 是轮廓文件枚举，二者必须通过映射关联，不能互换。

## 签收矩阵

签收人：Henry MacBook（workspace owner） · 日期：2026-07-31 · 方式：`manual-visual`

- [x] Almond × natural：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐
- [x] Almond × medium：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐
- [x] Oval × natural：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐
- [x] Oval × medium：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐
- [x] Coffin × natural：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐
- [x] Coffin × medium：Cat-eye 光带方向 / Ribbon 贴合 / Droplet 透明感 / PNG 对齐

六项已全部 `approved`，`index.json` 的 `fixtureType` 为 `visual-signoff-approved`，每项记录了签收人、日期与被审阅产物的 checksum。

## 签收后的约束

- Gallery `CONCEPT → SIMULATED` 现已解锁，但尚未执行：`asset_status` 类型目前只允许 `REAL | CONCEPT`，且 `tools/validate-assets.py` 硬编码了 12 REAL + 1 CONCEPT 的计数，需要单独任务同步。
- 仍是 2.5D 模拟效果，制造状态保持 `unvalidated`；不得输出生产命令。
- 重新运行 `npm run generate:mercury-fixtures` 会作废本次签收并重置为 `pending_visual_signoff`。

## 记录/复核命令

```bash
node tools/signoff-mercury-fixtures.mjs --by "<name>" [--fixture <id>]
npm run test:mercury-fixtures
```
