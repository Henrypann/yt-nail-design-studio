# NailSlot 校准流程（DEV-PLAN §4.4）

NailSlot 采用**两层模型**：本目录的 slots JSON 是第一层（每视图 10 个静态锚点）；
第二层「运行时指甲占位」由渲染器按 `nailTransform = f(slot, shape, length, shapeParams)`
实时计算，**坐标只锚定手指、不锚定指甲**——换甲型/换长度时锚点不动。

## 字段约定

| 字段 | 含义 |
|---|---|
| `fingerCode` | `L1`–`L5` / `R1`–`R5`（1=拇指 … 5=小指） |
| `view` | `back` / `palm` |
| `anchor` | 归一化坐标（0–1），**甲根中心**在手部底图上的位置；像素 = `(x*1200, y*900)` |
| `rotationDeg` | 指甲生长轴相对 12 点方向的顺时针角度 |
| `fingerWidthMm` | 该指物理指宽基准：拇指 15 > 中指 12.5 > 食指 12 > 无名指 11.5 > 小指 9.5 |

左右手约定（与参考图一致，详见各 JSON 的 `handedness` 字段）：

- **back**：图左 = 左手（L 组），图右 = 右手（R 组）；拇指均朝向画面中缝。
- **palm**：图左 = 右手（R 组），图右 = 左手（L 组）；拇指斜向中指。
  Palm 显示层反向规则 `xPalm = 1 - xModel` 由渲染器统一处理，
  slots.palm.json 记录的是图像内的真实锚点，不做预翻转。

## 缩放规则（第二层，渲染器实现）

```
scale = shape-params.lengths[length].widthMm / slot.fingerWidthMm
nailTransform = translate(anchor) · rotate(rotationDeg) · scale(scale)
轮廓 = material-library/shapes/silhouettes/{shape}_{length}.svg 的 path
```

## 重新校准流程（手部底图重绘后，目标 10 分钟内完成）

1. 打开校准器（`tools/slot-calibrator` 开发态页面，Sprint 1 由前端代理落地）；
   在校准器就绪前，可用任意 SVG 查看器按 `anchor*1200/900` 手工核对像素点。
2. 加载 `assets/hands/hand-back.svg` / `hand-palm.svg`。
3. 逐指拖拽锚点到「甲根中心」：自然甲近端（靠近指根一侧）宽度的中点；
   旋转手柄对齐指甲生长轴（指尖方向）。
4. 导出 JSON 覆盖本目录对应文件（保持字段结构不变）。
5. 跑 `python3 tools/validate-assets.py` 确认 20 个锚点结构合法。
6. 跑 NailSlot 渲染截图回归（24 甲型组合 × 2 视图，DEV-PLAN §4.8-3）。

## 红线

- 禁止把「某甲型在某手指上的位置」写死成静态坐标表（§4.4）。
- 20 个 NailSlot 不进入项目历史（DUV0722），但锚点文件本身入版本库。
- 某指渲染失败 → 该指灰甲型 + ⚠️ 占位，其余 9 指不受影响（前端实现）。
