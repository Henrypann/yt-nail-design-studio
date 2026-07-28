# 美甲师 Web 手绘 · 文档 vs 代码库交叉验证

> H0 验证 Sprint · 2026-07-28  
> 对照：《美甲师手绘功能需求与技术方案收敛.md》 vs `nextGen-beauty-tech` 现状

## 结论摘要

| 维度 | 文档主张 | 代码库现状 | 收敛决策 |
|---|---|---|---|
| 2D 引擎 | 原生 Canvas 2D + 三层离屏 Canvas | Editor 已用 **SVG**（`NailCanvas` + `render.ts`） | **不重建**；扩展 SVG pipeline |
| Undo/Redo | 无限步 | 已实现，上限 50 步 → **扩至 200** | 微调 |
| 对称映射 | 2D→UV→十指曲面 | **未实现** | P0 核心：0.1mm 几何镜像 |
| 色板 | 600 色 OPI/CND/Essie | Wizard 8 色；Editor 无品牌色板 | P0：**120 色** brand-palette |
| 十指总览 | 10 指缩略 + 切换 | Wizard 三视图 + Editor `TiledPreview` | Editor polish |
| 2D→3D | Three.js + GLB UV | 无 three.js；`Nail3DCheck` 为 Canvas 2D MOCK | **两周剔除** |
| 手绘入口 | 独立 2D 画布 | Editor 画笔/橡皮已有；Wizard 无手绘 | **Editor-first**（桥接进入） |

## 技术栈差异

- **package.json**：无 `three.js`、无 `pressure.js`、无 Canvas 绘图库
- **渲染**：主路径 SVG；Canvas 仅 `export-png` / `svgToPngDataUrl` 栅格化
- **DEV-PLAN v1.2.0**：首发不开放自由手绘；本轮为假设验证 Sprint，不改 Wizard 白名单

## 已具备（禁止重复建设）

- `BrushElement` / `EraserElement` 数据模型（`model.ts`）
- 画笔/橡皮 pointer 采集（`NailCanvas.tsx`）
- Undo/Redo 历史栈（`store.ts`）
- 十指平铺预览 + PNG 导出（`TiledPreview` + `composeTiledSvg`）
- Wizard→Editor 桥接（`bridge/index.ts`）
- 甲型剪影 clipPath（0.1mm 坐标系）

## 本轮补齐（P0）

1. `brand-palette.json`（120 色）+ ToolPanel 异步 UI
2. 笔刷节流 + 细/标准/粗三档 + history 200
3. `mirror.ts` 对称映射 + FingerPanel 入口
4. TiledPreview / LayerPanel 语义 polish
5. Day 5 美甲师测试包 + session 轻量埋点
6. P1 backlog 文档化
