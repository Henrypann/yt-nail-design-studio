# Starfish Bloom Elegance｜海星绽放优雅

**资产状态**：Editorial approved / Canonical pending / Production unvalidated
**当前交付**：Asset Spec + 16:9 / 4:5 高保真封面 + Recipe Spec + Manifest
**场景**：度假、热带婚礼、夏季内容传播、Short Almond 日常轻奢

## 视觉结构

```text
appearance
├── translucent nude-pink jelly base
├── pastel baby-blue ombré (select nails)
├── buttercream yellow French block (select nails)
└── pearl / iridescent high-gloss topcoat

relief
├── sculpted five-point starfish (pearlescent white)
├── plumeria five-petal flower (pink → yellow gradient)
├── scallop shell ridge emboss (iridescent cream)
└── subtle dotted trail (optional accent)

attachment
├── micro white pearls (0.8–2.0 mm)
├── metallic gold ball studs
└── flat gold star charm (≤ 1 per set, accent only)
```

## 推荐组合

- **Short Almond**：参考图主组合；海星与鸡蛋花沿中轴排列，比例轻盈。
- **Medium Almond / Oval**：可展开 ombré 与贝壳脊线纵向空间。
- **Medium Coffin**：宽甲面适合扇形贝壳纹；附件须限制在 1–2 个重音指。

## 参数建议

- Starfish 浮雕预览高度：0.18–0.28 mm；每套最多 2 指。
- Plumeria 花瓣厚度：0.15–0.22 mm；每套最多 2 指。
- Shell ridge 脊线间距：≥ 0.45 mm。
- 微珍珠：每重音指 0–4 颗；金珠：0–3 颗。
- 金星星附件：整套 ≤ 1 个；生产前须单独验证勾挂风险。

## L1 组件清单（Canonical 待建）

| 组件 | 路由 | GLB 路径 | 状态 |
|------|------|----------|------|
| `starfish-relief` | L2 | `assets/glb/components/starfish-bloom-elegance/starfish/` | preview GLB 已生成 |
| `plumeria-flower` | L2 | `assets/glb/components/starfish-bloom-elegance/plumeria/` | preview GLB 已生成 |
| `shell-ridge-fan` | L2 | `assets/glb/components/starfish-bloom-elegance/shell-ridge/` | preview GLB 已生成 |
| `micro-pearl` | L3 | `assets/glb/components/starfish-bloom-elegance/micro-pearl/` | Ø 0.8 / 1.2 / 2.0 mm |
| `gold-star-charm` | L3 | `assets/glb/components/starfish-bloom-elegance/gold-star/` | preview GLB 已生成 |
| `gold-ball-stud` | L3 | `assets/glb/components/starfish-bloom-elegance/gold-stud/` | preview GLB 已生成 |

汇总清单：`assets/glb/starfish-bloom-elegance/artifact-manifest.json`
生成命令：`npm run generate:starfish-bloom-components`
校验命令：`npm run test:starfish-bloom-glb`

## 边界

- 当前封面为 Editorial Concept，不是 Canonical Renderer 输出。
- 3D 海星 / 鸡蛋花 / 贝壳纹须建模为独立 Relief，不得烘焙为单张贴图。
- Ombré、珠光与 French 色块必须是独立 Appearance 层。
- 生产路线涉及连续点胶、珠光粉分布与附件固定，当前均未验证。

## 交付图片

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `editorial-cover-4x5-v1.png` | 688×912 | 原始参考方向（Short Almond 产品图） |
| `editorial-cover-16x9-v1.png` | 1621×912 | Editorial 横版概念 |
| `cover-16x9-1280x720-v1.png` | 1280×720 | Wizard / Gallery 标准封面 |

- 甲片数量：10 枚（上 5 + 下 5）
- 参考图 SHA-256（4:5 原图）：`85ca13c4757a02085de0bdec7df643448591370c0a6b677dd061cac34868e089`

## 下一步

1. 参数化 Starfish / Plumeria / Shell Ridge L2 路径。
2. 注册 micro-pearl 与 gold-star L3 组件 + 安全区。
3. 生成 Almond Short/Medium Canonical 单甲基线。
4. 完成三甲型视觉回归与人工签收。
