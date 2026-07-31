# Pearl Tide Shell｜液态贝壳海洋浮雕

**资产状态**：Editorial approved / Canonical pending / Production unvalidated  
**当前交付**：Asset Spec + 16:9 高保真封面  
**场景**：度假、夏季、内容传播  

## 视觉结构

```text
appearance
├── translucent opal / seafoam base
├── cat-eye or aurora optical layer
└── pearl gloss

relief
├── shell ridge fan
├── diagonal shell ridge
└── clear organic wave

attachment
├── micro pearl
└── optional micro star accent
```

## 推荐组合

- Medium Almond：有机脊线沿纵向展开。
- Medium Oval：最自然、适合柔和贝壳纹。
- Medium Coffin：宽甲面适合扇形脊线与中心构图。

## 参数建议

- Shell Ridge 数量：5 / 7 / 9 档。
- 预览高度：0.12–0.30mm。
- 脊线最小间距：0.45mm。
- 微珍珠：每个重音指 0–3 颗。
- 星形附件：整套最多 1 个，仅用于 Editorial 方向；生产前必须单独验证。

## 边界

- 当前封面是视觉概念，不是实时渲染结果。
- 贝壳脊线应建模为连续 Relief，不得烘焙为一张图片。
- Aurora、Cat-eye 与 Pearl Finish 必须是独立 Appearance 层。
- 生产路线涉及点胶连续性、固化收缩和珍珠固定，当前均未验证。

## 交付图片

- `editorial-cover-16x9-v1.png`
- 1672×941
- 正好 10 枚甲片
- SHA-256：`e5b4eae89bcd9fa532254995a9092a17229b0bc0a08ab83e5e6c1770d1509b5c`

## 下一步

1. 定义三种参数化 Shell Ridge Path。
2. 生成无附件的 Canonical 单甲基线。
3. 增加微珍珠 L3 组件与安全区。
4. 完成 Almond/Oval/Coffin 三甲型视觉回归。

