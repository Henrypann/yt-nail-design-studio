# 美甲师 Web 手绘 · P1 Backlog

> 仅在 Day 5 Go 验证通过后启动。技术栈仍走 Editor SVG pipeline，不引入 Canvas 2D 重建。

| 优先级 | 功能 | 方案 | 依赖 |
|---|---|---|---|
| P1-1 | 法式边形状工具 | 预设 SVG path（弧线 / V 形 / 双线），参数：宽度、距甲尖、颜色 | H0 验证通过 |
| P1-2 | 参考图垫底描摹 | `ImageElement` 增加 `opacity` + `locked` + `sendToBack` | 已有 image 导入 |
| P1-3 | 压感笔刷 | `PointerEvent.pressure` 映射 stroke-width | 无新依赖 |
| P1-4 | 600 色全量 | 扩展 `brand-palette.json` + 搜索/收藏 | 120 色验证后 |
| P1-5 | Editor↔Wizard 渲染收敛 | 手绘缩略图回写设计列表；或共享 `FingerNailContent` | 双轨渲染专项 |
| P1-6 | 2D→3D 预览 | 美术交付 UV GLB + three.js 懒加载替换 MOCK | 独立 Sprint |
| P1-7 | potrace 喷绘路径 | 位图→矢量→生产 Pipeline | 生产链路 Sprint |

## 验证失败时的降级方向

1. **模板 + 参数微调**为主路径，手绘仅保留法式线形状工具（非自由笔刷）
2. **参考图导入 + 模板叠加**，不做自由 stroke
3. 维持 Wizard 首发白名单，Editor 手绘继续作为进阶模式

## 不在 P1 范围

- 自由 3D 浮雕手绘
- 动画 / 滤镜 / AR
- Konva / Fabric 等重型画布引擎
