# Mercury Dew｜液态金属波光水滴

**资产状态**：Editorial approved / Canonical pending / Production unvalidated  
**定位**：首个完整 3D Hero Recipe 概念资产包  
**场景**：轻奢、趋势、日常重音指  

## 1. 视觉定义

Mercury Dew 由三层构成：

1. **Appearance**：半透明裸粉 Jelly Base + 纵向 Velvet Cat-eye 光带。
2. **Relief**：低浮雕液态银/香槟金属流线。
3. **Accent**：少量透明 Builder Gel 水滴，只使用在 2–3 根重音指。

关键词：

```text
quiet luxury
translucent blush jelly
velvet cat-eye
liquid silver
champagne chrome
clear water droplets
low-profile relief
```

## 2. 推荐组合

| 甲型 | 长度 | 建议 |
|---|---|---|
| Almond | short / medium | 首选；流线沿连续侧弧延伸 |
| Oval | medium | 可用；降低金属线密度 |
| Coffin | medium | 首选；宽甲面适合水滴重音指 |

不推荐把每根指甲都做成高密度水滴。默认编排：

- R4 / L4：水滴 + 金属流线。
- R3 / L3：单条金属流线。
- 其他手指：Cat-eye Base 或局部细线。

## 3. 数据分层建议

```text
appearance
├── baseCoverage: translucent
├── baseColor: #D9B5AB
├── opticalEffect: cat-eye
├── catEyeDirectionDeg: 8
├── catEyeWidth: standard
└── topFinish: gloss

relief
├── chromeRibbon
│   ├── material: silver | champagne
│   ├── heightMm: 0.18
│   ├── widthMm: 0.35–0.70
│   └── path: normalized nail coordinates
└── clearDroplet
    ├── diameterMm: 0.8 | 1.2 | 1.8
    ├── previewHeightMm: 0.15 | 0.22 | 0.30
    └── placement: safe-zone constrained

attachment
└── none
```

上述高度是原型预览目标，不代表正式点胶参数。正式参数需要材料流变、固化收缩和刮手测试。

## 4. 工艺意图

```text
L1: translucent base + cat-eye / UV optical layer
L2: dispensed clear or chrome-ready relief
post-process: chrome powder or UV metallic surface treatment
L3: none
```

潜在设备顺序：

1. 底胶/基础色。
2. Cat-eye 或 UV 光学层。
3. 低浮雕路径点胶。
4. 固化。
5. Chrome 表面处理。
6. 透明水滴点胶与终固化。

当前仅是 `process_intent`，不得直接生成生产命令。

## 5. 安全与约束

- 流线距离侧壁建议 ≥ 0.8mm。
- 水滴不得跨越甲片边缘。
- 最大预览高度暂不超过 0.30mm。
- 单指水滴数量建议 ≤ 6。
- 拇指可放大水滴；小指减少为 0–2 个。
- 顾客作品图隐藏高度和工艺信息；专业检查页可展开。

## 6. 交付图片

| 文件 | 用途 | 尺寸 | 状态 |
|---|---|---:|---|
| `editorial-cover-16x9-v1.png` | 风格推荐、宽屏 Hero | 1672×941 | approved concept |
| `editorial-cover-4x5-v1.png` | 顾客展示、社媒构图参考 | 1122×1402 | approved concept |
| `material-progression-1x1-v1.png` | Appearance → Relief → Accent 材质说明 | 1254×1254 | approved concept |

## 7. Canonical Renderer 验收

- 不使用本包 PNG 直接贴到甲面。
- Cat-eye、Chrome Ribbon 和 Droplet 必须是独立可开关层。
- 三甲型共用 normalized path/placement 语义，不复制硬编码坐标。
- 单甲、十指、顾客展示和作品图消费同一 Recipe。
- 关闭 Relief 后必须退化为可用的 Cat-eye 基础款。
- 视觉回归与本包保持材质方向一致，但无需像素复刻生成图片。

