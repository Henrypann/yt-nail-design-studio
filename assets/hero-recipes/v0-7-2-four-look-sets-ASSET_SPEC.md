# v0.7.2｜四套十指 Look 资产规格

## 交付边界

- 设计真源：每套 `manifest.json` / `recipe-spec.json` 的十指分配与五类步骤顺序。
- 高保真图片：AI 生成的视觉概念候选，不是 Canonical Renderer 输出，也未完成设计师试用签收。
- 2D/材质：确定性 SVG 与 decal、normal、roughness、height maps；height 只用于视觉 bump。
- 3D：装饰组件与 dimensional kit GLB，均为 `SIMULATED_PREVIEW_REPRESENTATION`。
- 甲型：模拟 3D 预览只引用已 Promotion 的 `geometry-registry.almond.medium.visual-v3`；Look 图案本身使用 nail-local 坐标，可重排到兼容甲型。
- 明确不包含：装饰 STL、打印/点胶/粘接参数、材料/固化/强度/贴合或制造验证。

## 十指分配

### Leopard Gilded Nude｜鎏金豹纹裸粉

| 指位 | 中间步骤 |
|---|---|
| L1 | 斜切象牙色、局部豹纹、鎏金水晶簇 |
| L2 | 斜切象牙色 |
| L3 | 局部豹纹 |
| L4 | 金色细线 |
| L5 | 留白 |
| R1 | 局部豹纹 |
| R2 | 斜切象牙色 |
| R3 | 斜切象牙色 |
| R4 | 斜切象牙色、局部豹纹、鎏金水晶簇 |
| R5 | 金色微珠 |

十指统一透明裸粉背景与透明亮面封层。

### Crimson Reliquary｜绯红圣物

| 指位 | 中间步骤 |
|---|---|
| L1 | 抽象曲线、金色十字珠链 |
| L2 | 抽象曲线 |
| L3 | 抽象曲线、金色珠链弧 |
| L4 | 曲线细线 |
| L5 | 金色微珠 |
| R1 | 抽象曲线 |
| R2 | 金色微珠 |
| R3 | 抽象曲线、金色十字珠链 |
| R4 | 抽象曲线、金色珠链弧 |
| R5 | 曲线细线 |

十指统一酒红背景与透明亮面封层。

### Ivory Lace Crystal｜象牙蕾丝晶露

| 指位 | 中间步骤 |
|---|---|
| L1 | 乳白指尖渐变、水滴水钻珍珠簇 |
| L2 | 乳白指尖渐变、象牙蕾丝贴饰 |
| L3 | 乳白指尖渐变、珍珠水晶星群 |
| L4 | 乳白指尖渐变、象牙浮雕花 |
| L5 | 乳白指尖渐变 |
| R1 | 乳白指尖渐变 |
| R2 | 乳白指尖渐变、象牙浮雕花 |
| R3 | 乳白指尖渐变、象牙蕾丝贴饰 |
| R4 | 乳白指尖渐变、水滴水钻珍珠簇 |
| R5 | 乳白指尖渐变、珍珠水晶星群 |

十指统一透明裸粉背景与透明亮面封层。

### Honey Petal Glass｜蜂蜜玻璃花瓣

| 指位 | 中间步骤 |
|---|---|
| L1 | 透明花珍珠、蜂蜜胶花蕊 |
| L2 | 白色不对称法式 |
| L3 | 蜂蜜胶花蕊 |
| L4 | 白色不对称法式、珍珠点缀 |
| L5 | 白色细边 |
| R1 | 白色不对称法式 |
| R2 | 白色细边 |
| R3 | 透明花珍珠、蜂蜜胶花蕊 |
| R4 | 白色不对称法式、珍珠点缀 |
| R5 | 蜂蜜胶花蕊 |

十指统一透明裸粉背景与透明亮面封层。

## 文件结构

每套包含：

- `look-cover-16x9-v1.png`
- `manifest.json`
- `recipe-spec.json`
- `flat/design-reference.svg`
- `maps/*-decal.png`
- `maps/*-normal.png`
- `maps/*-roughness.png`
- `maps/*-height.png`
- `/assets/glb/components/v0-7-2-four-looks/<look-id>/dimensional-kit.web.glb`
- 一至三个可独立引用的装饰组件 GLB
