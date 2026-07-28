# Oval 几何签收记录

- 日期：2026-07-28
- 参数源：`material-library/shapes/shape-params.json`
- 对照板：`oval-almond-round-comparison.svg`
- 对照范围：Almond / Oval / Round × short / medium / long / extra-long
- 坐标与生成链：0.1mm，复用 `nails-shape-svg` 的 `cuticle-seat` 几何实现

## 签收结论

通过阶段 2 几何签收。

- Oval 从甲身最大宽处开始连续收窄，甲尖保持圆钝，不出现 width-profile 半圆帽的肩部折感。
- 相对 Almond：Oval 的分长度 `tipRadiusMmByLength` 明显更大，四档长度均不形成软尖。
- 相对 Round：Oval 侧壁更早、持续地收窄；Round 保持宽直侧壁与短圆帽，短甲下也可辨。
- 四档轮廓均闭合，包含 `nail-clip`，沿用相同 viewBox 规则和生成坐标系。
- 未修改 NailSlot V2 坐标；新增甲型继续通过 shape-neutral Slot 投影。

## 阶段边界

本记录只证明 Oval 几何就绪。Oval 模板图案与风格推荐尚未完成，因此
`shape-capabilities.json` 中 Wizard 状态保持 `disabled`，界面显示“模板适配中”。
