# Mercury Dew Recipe · Cursor Handoff

更新时间：2026-07-31  
工作区：`/Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-cursor`  
分支：`exp/cursor-studio-mvp`  
当前 HEAD：`a355d82 fix(recipe): align taxonomy enums and wizard outputs`

## 1. 接管目标

继续完成 Mercury Dew Recipe 的 M4 视觉签收，不要把概念封面或近似模板冒充 Golden Output，也不要在没有人工签收前把 Gallery 状态升级为 `SIMULATED`。

最终真源链路必须保持：

```text
Recipe Definition
→ Recipe Instance
→ FingerRenderModel
→ Single / Tiled / Present / PNG
```

## 2. 已完成范围

### M0 · Contract Pack

- Recipe Registry、Mercury Dew `1.0.0` Definition、JSON Schema 已存在。
- EditorDoc v3、ProjectV4 与 v1/v2 → v3 迁移已完成。
- Recipe 校验脚本和 selftest 已接入。

主要文件：

- `material-library/recipes/index.json`
- `material-library/recipes/mercury-dew/recipe.json`
- `material-library/recipes/schema/`
- `src/studio/editor/lib/recipe-model.ts`
- `src/studio/editor/lib/recipe-registry.ts`
- `src/studio/editor/lib/migrate.ts`

### M1 · Canonical SVG Renderer

- Surface Mapper 已支持 Almond / Oval / Coffin 与四档几何长度。
- 已实现：Cat-eye、Chrome Ribbon、Clear Droplet。
- Renderer 输出仍是 2.5D 模拟效果，不生成生产命令。

主要文件：

- `src/studio/editor/lib/surface-mapper-core.ts`
- `src/studio/editor/lib/surface-mapper.ts`
- `src/studio/editor/lib/mercury-renderer.ts`

### M2 · Editor Recipe 工作区

- Recipe Inspector：Subtle / Signature / Statement。
- Cat-eye 参数、Ribbon 参数、Droplet 密度与添加/删除。
- Ribbon 三点拖拽。
- 全局 / 单指编辑范围、Undo/Redo、镜像、保存恢复已保留。
- LayerPanel 显示虚拟 Recipe 图层组。

### M3 · Wizard 与输出闭环

最近补齐的关键问题：Mercury 之前只在 Editor 生效，Wizard 画面没有继续传递 Recipe。现在已接入：

- Wizard 十指平铺
- Wizard 手背预览
- Wizard 单指详情
- 顾客展示模式
- 顾客展示底部搭配条
- PNG / 缩略图隐藏导出实例
- Editor 单指、十指和导出路径

关键文件：

- `src/studio/wizard/StepTwo.tsx`
- `src/studio/wizard/FingerDetailPanel.tsx`
- `src/studio/wizard/PresentationMode.tsx`
- `src/studio/preview/TenFingerPreview.tsx`
- `src/studio/preview/TiledNailsPreview.tsx`
- `src/studio/preview/SingleNailView.tsx`
- `src/studio/render/BackPlatePreview.tsx`
- `src/studio/render/FingerNailContent.tsx`

## 3. 已修正的枚举契约

七组产品枚举已集中到：

`src/studio/editor/lib/taxonomy-model.ts`

- 风格方向：4
- 款式预设：12
- 产品长度：`natural | short-extension | medium | long`
- 色彩预设：5
- 表面预设：5
- 装饰：5
- 场合：5

长度必须保持两层语义：

```text
lengthPreset   = 产品侧长度
geometryLength = 轮廓文件长度：short | medium | long | extra-long
```

Recipe Definition 已使用：

```json
{
  "lengthPresets": ["natural", "short-extension", "medium", "long"],
  "geometryLengths": ["short", "medium", "long", "extra-long"]
}
```

不要重新引入含糊的 `compatibility.lengths`。

## 4. M4 当前状态

当前目录：

`assets/golden-fixtures/mercury-dew/`

已有：

- `index.json`：六项签收矩阵，全部为 `pending_visual_signoff`
- `SIGNOFF_TEMPLATE.md`：人工签收清单

六项组合：

| Fixture | shape | lengthPreset | geometryLength |
|---|---|---|---|
| almond-natural | almond | natural | short |
| almond-medium | almond | medium | long |
| oval-natural | oval | natural | short |
| oval-medium | oval | medium | long |
| coffin-natural | coffin | natural | short |
| coffin-medium | coffin | medium | long |

当前**还没有**以下文件：

- 六组单甲 SVG
- 六组十指 SVG
- 六组 PNG
- 参数快照
- Renderer checksum

因此不要修改：

- `material-library/index.json` 中 Mercury 的 `asset_status: CONCEPT`
- Fixture 状态 `pending_visual_signoff`

## 5. Cursor 下一步任务

### M4-A · 生成真实 Fixture 输出

使用当前 Canonical Renderer 和真实轮廓资产生成六组 fixture，不能生成 1×1 占位图或静态伪造图。

每组至少包含：

```text
fixtures/<fixture-id>/recipe.json
fixtures/<fixture-id>/single.svg
fixtures/<fixture-id>/tiled.svg
fixtures/<fixture-id>/preview.png
fixtures/<fixture-id>/snapshot.json
```

要求：

- 输出必须来自当前 Recipe Instance。
- 轮廓必须来自当前 shape SVG 真源。
- 屏幕 SVG 与 PNG 使用同一构图。
- 每组记录 renderer checksum。
- 输出中明确 `renderer: svg-2.5d/mercury-1`。
- 仍然标记制造状态为 `unvalidated`，不得输出生产命令。

### M4-B · 人工视觉签收

逐组检查：

- Cat-eye 光带方向和宽度
- Chrome Ribbon 是否贴合甲型且不越界
- Droplet 是否具备透明主体、边缘暗部、折射高光和接触阴影
- Almond / Oval / Coffin 的比例是否自然
- 十指重音指是否明显但不过载
- 单甲、十指、顾客展示、PNG 是否一致
- `lengthPreset` 与 `geometryLength` 是否正确映射

人工签收后再把对应 Fixture 改为 `approved`。六项全部通过后，才允许：

```text
Gallery: CONCEPT → SIMULATED
```

并保留 Liquid Velvet fallback 一个版本周期。

## 6. 验证命令

```bash
cd /Users/henry.macbook/Documents/kimi/Workspaces/nextGen-beauty-cursor

npm run typecheck
npm run build
npm run validate-assets
npm run validate-recipes
npm run test:taxonomy-enums
npm run test:recipe-schema
npm run test:recipe-migrate
npm run test:surface-mapper
npm run test:recipe-output
npm run test:mercury-fixtures
npm run test:handdraw
git diff --check
```

`npm run requirements:audit` 当前会报告历史 `reviewedHash` 过期；这是需求审计基线未刷新，不是 Mercury 构建失败。不要未经人工审查直接执行刷新并掩盖差异。

## 7. 红线

- 不引入 Three.js / WebGL / AR。
- 不生成 STL / 3MF / 点胶路径 / 设备命令。
- 不把 2.5D 模拟效果描述为生产可制造结果。
- 不修改 Slot V2、甲型几何真源或法式控制点。
- 不把概念封面当成 Golden Fixture。
- 不因为自动化测试通过而跳过人工视觉签收。
- 不修改已确认设计的 Recipe 版本引用。

## 8. 交接提示词

> 你正在接管 NextGen Beauty Studio Cursor worktree 的 Mercury Dew Recipe。请先阅读本 handoff，再检查 `git status` 和当前 HEAD。当前 M0-M3 已完成，M4 只有签收矩阵，尚未生成六组真实 SVG/PNG。请严格执行 M4-A 生成真实 fixture，再逐组人工视觉签收；在六项签收完成前，保持 Gallery 为 `CONCEPT`、Fixture 为 `pending_visual_signoff`。所有输出必须走 Recipe Definition → Recipe Instance → FingerRenderModel → Single/Tiled/Present/PNG 真源，不得用占位图，不得把模拟效果写成生产能力。完成后报告每组文件路径、checksum、视觉问题和验证命令结果。
