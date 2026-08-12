# DESIGN.md — Nail Design Studio 设计系统

> 版本: v1.1（活泼亮色版配色）| 适用产品: Nail Design Studio（Wizard 十指平铺设计器 / Editor 专业编辑器 / Nail Lover Community 灵感社区）
> 参考基础: Figma（创作工具画布优先哲学）+ Pinterest（暖调内容浏览气质）
> 核心铁律: **Canvas 永远存在，Panel 按空间逐级消失。** Scale / Reflow first, Scroll last.

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

Nail Design Studio 是一个"穿戴甲创作工具 + 灵感社区"的复合产品。设计语言必须同时服务两种心智：

- **Studio 心智**：专业、克制、画布中心。工具属性向 Figma / Procreate 看齐——所有 chrome（导航、面板、工具条）都必须安静，让十指平铺设计区成为唯一的视觉主角。
- **Community 心智**：温暖、柔软、内容优先。向 Pinterest 看齐——暖奶油底色衬出美甲图片本身，不做任何喧宾夺主的装饰。

- **Community 心智**：明亮、活泼、内容优先。向 Pinterest 看齐但更轻快——明亮的暖奶油底色衬出美甲图片本身，点缀像甲油色盘一样的跳跃色彩，让人一眼感到"好玩、想试"。

**核心视觉特征关键词：**

1. **Bright Ivory（明亮暖象牙底）**——不用纯白冷灰，用明亮带温度的暖奶油色作为全局基底
2. **Vivid Rose（明丽玫瑰主色）**——高饱和亮玫瑰粉 `#F04E7E`，活泼有张力，只用于主操作与选中态
3. **Polish Palette（甲油色盘点缀）**——珊瑚 / 丁香紫 / 薄荷 / 奶黄 / 湖蓝五组跳跃辅助色，像一排甲油胶，用于分类标签、状态点缀、Community 氛围
4. **Canvas First（画布优先）**——工作区永远是页面最高优先级区域，面积最大、对比最安静
5. **Soft Depth（柔和层级）**——低透明度暖棕阴影，无硬投影，无霓虹光晕
6. **Quiet Chrome（安静外壳）**——面板/导航使用 1px 暖灰分隔线而非色块分区

**光影与质感倾向：** 纯扁平 + 单层柔和阴影。禁用毛玻璃滥用（仅 Drawer/Sheet 浮层允许 `backdrop-filter: blur(8px)`）。禁用渐变背景装饰；渐变只允许出现在美甲效果预览图内部。

---

## 2. Color Palette & Roles（调色板与角色）

### Primary Colors

| Token | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| Primary | `#F04E7E` | `--color-primary` | 主按钮、选中态、品牌标识、Tab 激活态 |
| Primary Hover | `#DB3A6A` | `--color-primary-hover` | 主按钮 hover / active |
| Primary Soft | `#FDE4EE` | `--color-primary-soft` | 选中项浅底、Tag 背景、选中描边内填充 |
| Primary Border | `#F7A8C6` | `--color-primary-border` | 选中卡片描边、focus ring 辅助 |

### Brand & Dark

| Token | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| Brand Deep | `#C23062` | `--color-brand-deep` | 深色强调、logo 深色变体、页脚文字 |
| Brand Dark Surface | `#362229` | `--color-dark-surface` | 深色浮层、深色模式预留 |

### Polish Palette（甲油色盘辅助色——活泼感来源，仅用于标签/分类/点缀，不做大面积铺色）

| Token | HEX | Soft 底色 | CSS 变量 | 使用场景 |
|---|---|---|---|---|
| Coral 珊瑚橘 | `#FF7E67` | `#FFE9E4` | `--color-coral` / `--color-coral-soft` | 热销/热门标签、活力点缀 |
| Lilac 丁香紫 | `#B58CE8` | `#F1E7FC` | `--color-lilac` / `--color-lilac-soft` | 风格分类（法式/渐变）、收藏态 |
| Mint 薄荷绿 | `#45CEA2` | `#DFF7EE` | `--color-mint` / `--color-mint-soft` | 新品标签、清新分类 |
| Butter 奶黄 | `#F5C445` | `#FDF3DA` | `--color-butter` / `--color-butter-soft` | 推荐标记、评分星级 |
| Aqua 湖蓝 | `#4FB8C9` | `#E0F5F8` | `--color-aqua` / `--color-aqua-soft` | 链接辅助、信息分类 |

### Neutral / Warm Gray Scale（暖灰体系，禁用冷灰）

| Token | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| Ink | `#2E2620` | `--color-ink` | 一级标题、强调文字 |
| Body | `#4F443A` | `--color-body` | 正文 |
| Mute | `#948677` | `--color-mute` | 辅助说明、placeholder、未选中 Tab |
| Faint | `#BDB1A2` | `--color-faint` | 禁用态文字、图标默认色 |
| Hairline | `#EDE6DA` | `--color-hairline` | 卡片边框、分隔线 |
| Hairline Soft | `#F3EDE3` | `--color-hairline-soft` | 次级分隔、表格行线 |

### Surface & Canvas

| Token | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| Canvas | `#FAF6EF` | `--color-canvas` | 全局页面背景（明亮暖象牙） |
| Workspace | `#F3EDE3` | `--color-workspace` | Studio 工作区画布底色（比页面深半度，衬托白色甲片卡） |
| Surface | `#FFFFFF` | `--color-surface` | 卡片、面板、弹窗、Nail Card |
| Surface Soft | `#FCFAF6` | `--color-surface-soft` | 输入框底、hover 浅底、次级区块 |

### Semantic Colors

| Token | HEX | CSS 变量 | 使用场景 |
|---|---|---|---|
| Success | `#2FA36B` | `--color-success` | 已确认、导出成功 |
| Success Soft | `#DFF3E8` | `--color-success-soft` | 成功提示底色 |
| Warning | `#E8920B` | `--color-warning` | 待处理、未保存提醒 |
| Warning Soft | `#FCF0DA` | `--color-warning-soft` | 警告提示底色 |
| Error | `#E04A38` | `--color-error` | 删除、校验失败 |
| Error Soft | `#FBE5E1` | `--color-error-soft` | 错误提示底色 |
| Info | `#4B85C9` | `--color-info` | 引导提示、版本标记 |
| Info Soft | `#E5EFFA` | `--color-info-soft` | 信息提示底色 |

### Shadow Colors

```css
--shadow-color: rgba(96, 60, 48, 0.08);   /* 暖棕基调阴影，禁用纯黑阴影 */
--shadow-color-strong: rgba(96, 60, 48, 0.14);
```

---

## 3. Typography Rules（排版规则）

### Font Family

```css
--font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
             "Inter", -apple-system, "Segoe UI", sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", "Menlo", monospace; /* 色号/HEX/尺寸标注 */
```

### Type Scale

| 层级 | Size | Weight | Line Height | Letter Spacing | 用途 |
|---|---|---|---|---|---|
| Display Hero | 40px / 2.5rem | 600 | 1.15 | -0.5px | Community 首页大标题 |
| Display | 32px / 2rem | 600 | 1.2 | -0.4px | 页面级标题 |
| H1 | 24px / 1.5rem | 600 | 1.3 | -0.2px | 区块标题、弹窗标题 |
| H2 | 20px / 1.25rem | 600 | 1.35 | 0 | 卡片组标题、面板标题 |
| H3 | 16px / 1rem | 600 | 1.4 | 0 | 卡片标题、分组标题 |
| Body | 14px / 0.875rem | 400 | 1.5 | 0 | 正文、表单、列表（**Studio 默认字号**） |
| Body Strong | 14px / 0.875rem | 600 | 1.5 | 0 | 强调正文、选中项文字 |
| Caption | 12px / 0.75rem | 400 | 1.4 | 0 | 辅助说明、甲片位号标签（R1–R5 / L1–L5） |
| Caption Strong | 12px / 0.75rem | 600 | 1.4 | 0.2px | Badge、状态标签 |
| Nano | 11px / 0.6875rem | 400 | 1.3 | 0.3px | 色号标注、版权、极次级信息 |

**设计哲学：** Studio 内部不做大字——最大不超过 16px，一切让位给画布；Community 允许 40px Display 营造杂志感。中文字重只用 400/600 两档，数字与色号用 `--font-mono` 保证等宽对齐（十指位号、HEX 色值必须等宽）。

---

## 4. Component Stylings（组件样式）

### Buttons

```css
/* Primary — 每屏最多 1 个 */
.btn-primary {
  background: var(--color-primary); color: #FFFFFF;
  border-radius: 8px; padding: 9px 20px;
  font-size: 14px; font-weight: 600;
}
.btn-primary:hover { background: var(--color-primary-hover); }
.btn-primary:active { transform: translateY(1px); }

/* Secondary — 白底描边 */
.btn-secondary {
  background: var(--color-surface); color: var(--color-ink);
  border: 1px solid var(--color-hairline);
  border-radius: 8px; padding: 9px 20px; font-size: 14px;
}
.btn-secondary:hover { background: var(--color-surface-soft); }

/* Ghost — 工具条、面板内 */
.btn-ghost {
  background: transparent; color: var(--color-body);
  border-radius: 6px; padding: 6px 12px; font-size: 14px;
}
.btn-ghost:hover { background: var(--color-hairline-soft); }

/* Danger */
.btn-danger {
  background: var(--color-surface); color: var(--color-error);
  border: 1px solid var(--color-error);
  border-radius: 8px; padding: 9px 20px; font-size: 14px;
}
```

### Cards

```css
.card { /* Community 灵感卡 / 素材库模板卡 */
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 12px; padding: 12px;
  box-shadow: 0 1px 2px var(--shadow-color);
}
.card:hover { box-shadow: 0 4px 16px var(--shadow-color); transform: translateY(-2px); }

.nail-card { /* 十指平铺甲片卡 —— 尺寸必须响应式，见 §8 */
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 16px; padding: 16px;
  width: clamp(72px, 8vw, 130px);
}
.nail-card.is-selected {
  border: 2px solid var(--color-primary);
  background: var(--color-primary-soft);
}
```

### Inputs

```css
.input {
  background: var(--color-surface-soft);
  border: 1px solid var(--color-hairline);
  border-radius: 8px; padding: 8px 12px; font-size: 14px;
}
.input::placeholder { color: var(--color-mute); }
.input:focus {
  outline: none; border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
```

### Navigation

```css
.nav-item { padding: 8px 12px; border-radius: 8px; color: var(--color-body); font-size: 14px; }
.nav-item:hover { background: var(--color-hairline-soft); }
.nav-item.is-active { background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; }
```

### Badges / Tags

```css
.badge { background: var(--color-primary-soft); color: var(--color-primary);
         border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
.badge-neutral { background: var(--color-hairline-soft); color: var(--color-mute); }
.badge-success { background: var(--color-success-soft); color: var(--color-success); }
```

### Modals / Dialogs / Drawer（侧栏折叠后的浮层形态）

```css
.modal-scrim { background: rgba(54, 34, 41, 0.4); }
.modal { background: var(--color-surface); border-radius: 16px;
         box-shadow: 0 16px 48px var(--shadow-color-strong); padding: 24px; }
.drawer { background: var(--color-surface);
          box-shadow: 0 0 32px var(--shadow-color-strong);
          backdrop-filter: blur(8px); /* 全系统唯一允许 blur 的位置 */ }
/* 动画：Drawer 滑入 240ms cubic-bezier(0.32, 0.72, 0, 1)；Modal 淡入+上移 200ms */
```

---

## 5. Layout Principles（布局原则）

### Spacing System

基数 **4px**：`4 / 8 / 12 / 16 / 24 / 32 / 48`。CSS 变量 `--space-1` 至 `--space-12`。Studio 内部紧凑档（8/12/16），Community 宽松档（16/24/48）。

### Studio 三栏布局（创作工具模型，非后台 SaaS 模型）

```css
.studio-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px; /* Library | Workspace | Inspector */
  height: 100vh;
}
.workspace {
  min-width: 0;        /* 关键：允许收缩，永不撑破父容器 */
  width: 100%;
  background: var(--color-workspace);
  /* 禁止 overflow-x: auto；禁止固定 min-width: 1000px+ */
}
```

- **十指平铺网格**：`display: grid; grid-template-columns: repeat(5, 1fr); gap: clamp(8px, 1vw, 20px);`
- **Container**：Community 内容区 `max-width: 1200px; margin: 0 auto; padding: 0 24px;`
- **Section Spacing**：Community 区块间距 48px；Studio 面板内区块间距 16px。

**留白哲学：** 留白只给两件事——画布里的甲片，社区里的图片。面板和导航不留装饰性空白。

---

## 6. Depth & Elevation（深度与层级）

### Shadow System

```css
--shadow-xs:  0 1px 2px rgba(96,60,48,0.06);
--shadow-sm:  0 1px 2px rgba(96,60,48,0.08);
--shadow-md:  0 4px 16px rgba(96,60,48,0.08);
--shadow-lg:  0 8px 24px rgba(96,60,48,0.10);
--shadow-xl:  0 16px 48px rgba(96,60,48,0.14);
--shadow-2xl: 0 24px 64px rgba(96,60,48,0.16);
```

### Surface Layers

`L0 canvas (#FAF6EF)` → `L1 workspace (#F3EDE3)` → `L2 surface 卡片/面板 (#FFF)` → `L3 elevated 弹窗/Drawer (#FFF + --shadow-xl)` → `L4 overlay 遮罩 (rgba(54,34,41,0.4))`

### Z-index Scale

| 层级 | 值 | 用途 |
|---|---|---|
| base | 0 | 画布内容 |
| sticky | 10 | 面板内吸顶标题 |
| header | 100 | 全局顶部导航 |
| drawer | 200 | Library / Inspector 浮层 |
| modal | 300 | 对话框 |
| toast | 400 | 全局提示 |

---

## 7. Do's and Don'ts（设计规范与禁忌）

### Do's

1. ✅ 工作区永远占据最大可用宽度，面板按断点逐级收窄、折叠、浮层化
2. ✅ 十指甲片尺寸用 `clamp()` + Grid 实现真实响应式缩放
3. ✅ 选中态统一使用 `--color-primary` + `--color-primary-soft` 双件套
4. ✅ 色号、HEX、甲片位号使用等宽字体，保证十指标签视觉对齐
5. ✅ 每屏只保留一个 Primary Button（当前阶段主操作，如"顾客已确认"）
6. ✅ 面板分区用 1px `--color-hairline` 分隔线，不用色块切割
7. ✅ 动效只做 200–240ms 的位移/透明度，功能优先

### Don'ts

1. ❌ **禁止**给中央十指区域设置固定 `min-width: 1000px+`
2. ❌ **禁止**用 `overflow-x: auto` 作为整体布局的响应式方案
3. ❌ **禁止**用 `overflow-x: hidden` 掩盖溢出——内容被裁掉比滚动条更糟
4. ❌ **禁止**用整体 `transform: scale()` 粗暴缩放 UI（控件文字会糊）
5. ❌ 禁止在小屏幕永久同时展示三个完整侧栏
6. ❌ 禁止冷灰色（#F5F5F5 类）——全局必须保持暖调
7. ❌ 禁止大面积渐变背景、毛玻璃卡片、发光描边
8. ❌ 禁止页面级横向滚动条出现在任何验收分辨率下

---

## 8. Responsive Behavior（响应式行为）

> 核心原则：**十指内容必须 fit into workspace，workspace 必须优先 fit into viewport。**
> Scale / Reflow first, Scroll last. 横向滚动只允许存在于真正的横向内容组件（如色板横滑条），绝不作为 Workspace 的响应式策略。

### Breakpoints

| 断点 | 模式 | 布局 |
|---|---|---|
| ≥ 1440px | Full | `Nav \| Library 280–320px \| WORKSPACE 1fr \| Inspector 300–340px` |
| 1100–1439px | Compact | `Nav \| Library 220–260px \| WORKSPACE 1fr \| Inspector 220–260px`，压缩卡片 padding/gap |
| 800–1099px | Focus | `Nav \| WORKSPACE 1fr \| Inspector 窄栏`，Library 折叠为 Drawer（按钮触发，宽度 320px，含 scrim） |
| < 800px | Demo / Tablet | `Nav \| WORKSPACE 全宽`，Library 与 Inspector 均为 Drawer / Sheet，顶部只保留必要操作入口 |

### 十指平铺缩放策略（Workspace 内部）

```css
.ten-nails-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)); /* 大屏恒为 5 × 2 */
  gap: clamp(8px, 1vw, 20px);
}
.nail { width: clamp(72px, 8vw, 130px); aspect-ratio: 3 / 4; }
```

- **大屏幕**：保持 5 × 2，甲片尽量放大，Workspace 成为视觉中心
- **中等屏幕**：仍保持 5 × 2，自动缩小甲片、间距、标签字号；整组十指必须完整可见
- **更窄屏幕**：5 × 2 影响可读性时降级为自适应 Grid（4+4+2 或 3/4 列 `auto-fit`），仍禁止横向滚动条
- 允许基于容器的 scale 计算：`scale = min(availableW/idealW, availableH/idealH, 1)`，但**只缩放甲片图形，不缩放 UI 控件与文字**
- 优先实现方式：CSS Grid + Container Query + `clamp()`，而非 JS 监听

### Touch Targets & Font Scaling

- 触摸目标最小 `44 × 44px`（< 800px 模式下强制执行）
- Compact 模式 Caption 可从 12px 降至 11px，Body 恒为 14px 不再缩小
- Drawer 打开时 Workspace 不位移，仅被 scrim 覆盖

### 验收视口

`1920×1080 / 1600×900 / 1440×900 / 1366×768 / 1280×800 / 1024×768` —— 每个视口必须：无页面级横向滚动条、十指完整可见、1366px 下仍保持可用于正式 Demo 的完整视觉效果。

---

## 9. Agent Prompt Guide（AI 代理提示指南）

### Quick Reference

```
底色: canvas #FAF6EF / workspace #F3EDE3 / surface #FFF
强调: primary #F04E7E (+ soft #FDE4EE 选中底)
点缀: 甲油色盘 coral #FF7E67 / lilac #B58CE8 / mint #45CEA2 / butter #F5C445 / aqua #4FB8C9
文字: ink #2B2622 / body #4A423B / mute #8A7F74（全暖灰）
字体: PingFang SC + Inter；色号用 mono；正文 14px，选中 600
圆角: 按钮 8 / 卡片 12 / 甲片卡 16 / 弹窗 16 / Badge 999
间距: 4px 基数；Studio 紧凑 8-16，Community 宽松 16-48
布局: Canvas First。min-width:0 + 1fr + clamp()；禁 overflow-x 布局方案
断点: ≥1440 三栏 / 1100 Compact / 800 Focus(Drawer) / <800 全 Drawer
```

### Component Prompts

1. "生成 Studio 三栏布局：grid-template-columns: 280px minmax(0,1fr) 320px，Workspace 底色 --color-workspace，任何断点下不产生横向滚动条"
2. "生成十指平铺组件：5×2 Grid，nail-card 白底 16px 圆角，尺寸 clamp(72px, 8vw, 130px)，选中态 2px --color-primary 描边 + --color-primary-soft 底，位号标签 R1–R5 用 mono 11px"
3. "生成 Community 灵感瀑布流卡片：白底 12px 圆角，1px --color-hairline 边框，hover 上移 2px + --shadow-md，底部保存/使用按钮用 Ghost 样式"
4. "生成 800–1099px 断点下的 Library Drawer：左侧滑入 320px，scrim rgba(54,34,41,0.4)，240ms cubic-bezier(0.32,0.72,0,1)，z-index 200"
5. "生成 Inspector 属性面板：白底，区块间 1px --color-hairline-soft 分隔，标题 H3 16px/600，控件 Ghost 按钮 + .input 输入框"

### Iteration Guide

1. 任何布局调整前先问：这会不会挤压 Workspace？会就改方案
2. 看到横向滚动条，先查固定宽度和 min-width，不要先加 overflow
3. 禁用 `overflow-x: hidden` 糊溢出——必须让内容真实 fit
4. 新组件先检查是否在 1366×768 下完整可用（Demo 基线视口）
5. 甲片尺寸永远 clamp()，间距永远 clamp()，不写死像素
6. 主强调色只有 #F04E7E 一个；活泼感用甲油色盘五色做小面积点缀，禁止再新增其他强调色
7. 侧栏新功能优先做成 Drawer 兼容形态，为 Focus 模式留后路
8. 文字缩小下限 11px；小于 11px 的需求改为图标 + tooltip
9. 面板内最多两层嵌套卡片，第三层用分隔线代替
10. 改动完成后必须跑一遍 6 个验收视口截图确认
