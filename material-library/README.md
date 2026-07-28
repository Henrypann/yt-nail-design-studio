# material-library · 模板素材库（消费约定）

> 规范来源：DEV-PLAN §2.3-8、§4.3、§5.1–§5.8；后端架构文档 §二。
> 前端**一律从本目录的 JSON 清单读取**模板/甲型/色板/质感数据，禁止硬编码。

## 目录与文件

```
material-library/
├── index.json                    ← 模板索引（10 套，§5.1 模型 + §5.4 映射表 + 六类风格标签 legend）
├── templates/
│   └── t_*/                      ← 每套模板：manifest.json + patterns/（6 甲型 SVG）+ thumbnails/
├── shapes/
│   ├── shape-params.json         ← 前后端唯一参数源（红线：禁止第二参数源）
│   └── silhouettes/              ← 6 甲型 × 4 长度 = 24 轮廓 SVG（脚本生成，勿手改）
├── colors/palette.json           ← 8 色色板
└── finishes/finishes.json        ← gloss / matte / pearl 元数据（原型期仅参数记录）
```

## 关键约定

| 约定 | 值 |
|---|---|
| 甲型 ID | `almond` `coffin` `squoval` `round` `square` `stiletto` |
| 长度 ID | `short` `medium` `long` `extra-long`（轮廓文件名中 `-` → `_`） |
| 坐标系 | 0.1mm 单位；原点 = 甲根中心；甲尖在负 y；`rotationDeg` = 生长轴相对 12 点顺时针角度 |
| 轮廓 SVG | viewBox 随长度变化；内含 `<clipPath id="nail-clip">` + `stroke="currentColor"` 可见轮廓 |
| 图案 SVG | viewBox 全库统一 `-60 -200 120 220`（按 medium 基准设计）；artwork 在 `clip-path="url(#nail-clip)"` 组内，天然不溢出 |
| 合成方式 | 底色填充（clip 内）→ 图案 SVG 叠加 → 质感（Q3 仅记录参数）；与后端 Pipeline 同构 |
| 适配排序 | `shape_compatibility`：`highly_compatible` → `neutral` → `not_recommended`（后者必带 reason，仍可应用） |
| 路径 | `index.json` 内 `thumbnail_url` / `manifest_url` 均相对仓库根目录；`manifest.json` 内路径相对模板目录 |
| `uv_params` | Q3 仅记录，Q4 供工艺映射引擎消费 |

## 十指渲染（NailSlot）

```
锚点：assets/nail-slots/slots.{back,palm}.json（归一化坐标 × 1200×900）
nailTransform = translate(anchor) · rotate(rotationDeg) · scale(widthMm(length) / fingerWidthMm)
底图：assets/hands/hand-{back,palm}.svg（viewBox 1200×900，肤色 token --skin-base）
back：图左=左手；palm：图左=右手（Palm 显示层反向 xPalm=1-xModel 由渲染器处理）
```

## 变更流程

改 `shape-params.json` 或图案设计后，按序重跑：

```bash
python3 tools/generate-nail-shapes.py       # 24 轮廓
python3 tools/generate-template-patterns.py # 60 图案 + manifest + 缩略图
python3 tools/generate-mock-stl.py          # Mock STL + 占位清单
python3 tools/validate-assets.py            # §5.8 六项 + §4.8 检查（入库强制）
```
