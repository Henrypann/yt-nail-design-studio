# Coffin v4 几何签收

- 签收日期：2026-07-29
- 签收人：产品负责人（人工视觉签收）
- 对照范围：Coffin × short / medium / long / extra-long
- 参考依据：实物甲片参考图与人工红线标注

## 签收结论

Coffin v4 通过签收并成为正式甲型。侧壁从宽肩到甲尖使用
`single-convex` 单一凸曲率，不允许中段外扩后再次收缩形成 S 形；
甲尖保持平直结构与柔和圆角。

## 固化参数

- `sidewallProfile`: `single-convex`
- `sidewallPower`: `1.8`
- `tipWidthRatio`: `0.60`
- `cornerRadiusMm`: `0.90`

正式参数唯一来源为 `material-library/shapes/shape-params.json`。Wizard、
Editor、模板 clipPath、预览和导出必须复用同一生成链。
