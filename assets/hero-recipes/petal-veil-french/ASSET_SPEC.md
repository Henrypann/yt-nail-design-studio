# Petal Veil French｜奶雾法式立体花

**资产状态**：Concept / Canonical pending / Production blocked and unvalidated  
**固定规格**：Almond × Medium  
**渲染器**：`three-pbr/petal-veil-1`

## Signature

- 十指统一奶雾底：`#F2E4DA`，opacity `0.92`。
- 十指统一柔边微法式：`#FBF7F2`，opacity `0.75`。
- 仅 R4 有一朵五瓣低浮雕花：UV `[0.62, 0.56]`、scale `0.18`、rotation `18°`、height `0.18mm`。
- 其他九指无 relief；禁用珠点、金线、多花和逐指换色。
- P0 不开放底色、质感或附件枚举。

## 图像资产边界

本目录 PNG 由 OpenAI 内置 ImageGen 生成，只用于 Gallery、视觉方向和人工对照，不作为甲面贴图，不是 Canonical Renderer 输出，也不是制造证据。

| 文件 | 用途 | 状态 |
|---|---|---|
| `cover-16x9-1280x720-v1.png` | Gallery / Hero | CONCEPT |
| `editorial-cover-16x9-v1.png` | 宽屏视觉方向 | CONCEPT |
| `editorial-cover-4x5-v1.png` | 竖版视觉方向 | CONCEPT |
| `material-progression-1x1-v1.png` | 奶雾、法式、浮雕材质对照 | CONCEPT |

## Canonical 门禁

单指、十指平铺和 Presentation 必须消费同一个 `NailAppearanceModel`，R4 appearance checksum 必须一致。WebGL 或资源失败时阻塞，不得回退旧 2D 并继续声称 HQ。

人工签收前 Gallery 保持 `CONCEPT`。人工确认 Canonical Fixture 后可升级为 `SIMULATED`；该状态仍不表示工艺、材料或生产可用。
