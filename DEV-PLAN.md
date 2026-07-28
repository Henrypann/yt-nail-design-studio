# DEV-PLAN · 智能美甲 Studio 开发计划

> **版本：** 1.5.1
> **日期：** 2026-07-27
> **主要依据：** `Studio-PRD-0723.md`（基础平台 + Studio Wizard/Editor 双轨，证据级 FRONTEND_MOCK）
> **辅助依据：** `智能美甲-项目定义与Q3软件开发说明书.md`（I1–I5 排期、38 端点、M 端对齐节点）、`设计工作台交互方案终稿.md`、`智能美甲软件MVP需求清单 kimiClaw.md`、`模板库后端架构-风格映射与素材存储-0723.md`（甲型×风格映射 + 素材存储）、`Studio模板库_产品备忘录与行动方案_2026-07-24.md`（组件化配方架构 + Top 3 首发）、`Studio开发备忘录_2026-07-24.md`（UI 组件化 + NailSlot V2 标定）
> **视觉参考：** `ref-image-1.png`（Back 手背张手底图）、`ref-image-2.png`（Palm 掌心半握拳历史参考，MVP 不消费）、`ref-shapes/ref-3..6.png`（专业甲型图谱 ×4）
> **冲突仲裁：** 与本文档冲突时，优先级为 Studio-PRD-0723 > 设计工作台交互方案终稿 > 其他文档。
>
> **v1.5.1 修订（2026-07-27，可用性细节优化）：**
> 1. **侧栏收起/折叠**：AppLayout 侧栏 240px ⇄ 56px，收起后图标 + 二字标签 + tooltip，状态持久化 localStorage（`ui.sidebar-collapsed`）。
> 2. **Wizard 三栏宽度重分配**：STEP 2 由 `300/1fr/300` 调整为 `440/1fr/300`——左栏模板库（七类风格标签 + 图文卡片）加宽保证缩略图可读，中栏画布相应收敛。
> 3. **Mock 面板升级为调试面板（`src/lib/debug-panel.tsx`）**：tab①场景 Mock（原功能平移）；tab②**元素 ID**——关键页面/模块/弹窗标注 `data-debug-id`（全路由 20 处），面板实时扫描 + 一键复制，提需求直接引用唯一 id；tab③**需求说明**——按路由匹配当前页需求卡（`src/lib/page-requirements.ts`，**全 13 条路由 + 404 全覆盖**，agent & human friendly 写作约定），点击模块弹出「模块需求 / 交互说明 / 逻辑与红线」详情弹窗，所见即所得免查 PRD。
> 4. e2e 17/17 回归通过；视觉自检截图 ×3（三栏布局 / 元素 ID / 需求详情）。
>
> **v1.5.0 修订（2026-07-27）：**
> 1. **Top 2 正式 2D 资产落地**：新增独立模板 `t_liquid_velvet_cat_eye` 与 `t_petal_veil_french`，各含 6 甲型图案 SVG、manifest、960×720 模板缩略图；Liquid Velvet 同步替换 1280×720 推荐封面并由 MOCK 升为 REAL。模板库现为 **12 模板 × 6 甲型 = 72 图案 SVG**，`validate-assets.py` PASS。
> 2. **风格标签与推荐映射升级**：六类审美标签扩展为七类，新增「当下流行 trending」；Liquid Velvet 映射 `trending + luxe + minimal`，Petal Veil 映射 `trending + sweet + minimal`；Top 1 / Top 2 推荐入口分别指向新模板，不再降级到 `t_cat_eye_nude` / `t_french_white`。
> 3. **Recipe 契约扩充但不冒充渲染完成**：Petal Veil `v0.2.0` 保留六层配方；新增 Liquid Velvet `v0.1.0` 五层配方及底色、猫眼角度、金/银线、水滴开关编辑域。两份 Recipe 均保持 `status=data-contract-draft`；当前 Wizard/Editor 消费正式 SVG，参数化 Recipe 渲染器尚未消费。
> 4. **资产工具链升级**：`generate-template-patterns.py` 支持按 template id 单独生成，缺少可选 Pillow 时只跳过占位缩略图、不阻断 SVG/manifest；正式缩略图走独立视觉资产流程。入库校验基线同步至 12/72。
> 5. **前端实测与交互方向**：浏览器实测 Top 1 / Top 2 均能应用独立新模板；「当下流行」筛选同时展示两款且选中态正确。甲型×风格后续交互按 `甲型与风格前端交互建议_2026-07-27.md` 分 P0/P1/P2 推进：双向数量反馈、切换甲型/长度不静默丢失、Auto/Custom 可解释状态、按压预览与组合原因抽屉。
> 6. **Back-only 一致性收口**：同步修正文档中遗留的 Back/Palm 双视图表述；MVP 预览、Pipeline 输出与视觉回归基线均以签收 Back V2 为唯一视图，Palm legacy 资产继续 archived。
>
> **v1.4.1 修订（2026-07-27）：**
> 1. **Palm 掌心视图软删除（MVP 收敛决策，对 Studio-PRD §12.4「双视图切换」的显式偏离，Sprint 评审可追溯）**：穿戴甲设计验收视角只有 Back；Palm 是唯一的 legacy anchor 渲染路径且无签收线稿、短期排不进计划；甲片内弧贴合属扫描几何（ManufacturingPackage），不依赖 2D 掌心插画。
> 2. **软删除方式（可回滚）**：Wizard 砍掉 Back/Palm 切换器固定 Back；`TenFingerPreview` 移除 view prop 与 legacy 渲染分支；`nail-assets.ts` 退役 `loadHandView`/`nailScale`/`PX_PER_MM`/`HAND_VIEWBOX`（**nailScale 定位体系彻底废止**）；legacy 资产（`hand-{back,palm}.svg`、`slots.{back,palm}.json`、`assets/hands/manifest.json`）标注 `status=archived` 保留不删，Palm 未来复活须走 V2 标定流程。
> 3. e2e 17/17 回归通过（断言无需改动）；`validate-assets.py` PASS。
>
> **v1.4.0 修订（2026-07-27）：**
> 1. **NailSlot V2 标定人工签收（back-v2.1.0）**：cursor agent 旧标定 10/10 存在偏移且中轴不平行于指尖方向（L1/R1 偏移 40–60px，远超根/尖 ≤2px 红线），已按 4× 坐标网格人工读数重标定 10 指界标；`slots.back.v2.json`（status=approved）+ 逐指放大覆盖图 `calibration-back-v2-overlay.png` 已于 2026-07-27 签收冻结。
> 2. **新增共享渲染模块 `src/studio/render/`**：Wizard Back 视图切换到「签收线稿 plate + 界标仿射 matrix + 局部 UV」渲染路径，V2 坐标域内**废止 nailScale / PX_PER_MM / anchor 归一化**；Palm 无视图签收线稿，保留 legacy 路径并标注降级；两条路径共享 `FingerNailContent` 四层合成组件。Editor 画布渲染收敛为后续专项（见 §5.11）。
> 3. **契约层落地（§5.11）**：DesignSet / Override 差分语义 / 四模式状态机 / 三类状态分离 / 双输出（PreviewRender vs ManufacturingPackage）类型入 `src/lib/types.ts`；Petal Veil French 六层配方数据契约入 `material-library/recipes/`（纯数据契约，渲染器未消费，不声称已渲染）。
> 4. **e2e 扩展至 17/17**：新增 V2 渲染路径断言（`data-calibration="back-v2.1.0"` + plate image）与单指覆写流程（点指 → 单独换色 → 清除定制）。
>
> **v1.3.0 修订（2026-07-24）：**
> 1. **Wizard MVP 收敛至 almond 单甲型**：其余 5 甲型 STEP 1 置灰禁用（「即将推出」），先锁定 Wizard 流程框架再逐型扩展；开放新甲型 = 曲线签收 + 白名单加名。详见 §5.10。
> 2. **新增风格推荐弹窗**：选定甲型长度后、进入画布前，弹出与甲型匹配的流行风格 Top 3（16:9 封面大卡 + 最佳长度 + 理由），选用即自动应用映射模板；数据源 `assets/styles/manifest.json`，MOCK 封面强制角标。详见 §5.10。
> 3. **almond v3 cuticle-seat 已签收（2026-07-24，资产 v1.3.1）**：推翻「最宽处=甲根」；`shape-params.json` v3 + skill 双模型路由；almond 4 轮廓与相关图案 clip 已重出，`validate-assets.py` PASS。其余甲型仍为 v2 宽度剖面。
>
> **v1.2.1 修订（2026-07-24）：**
> 1. **甲型轮廓曲线模型升级 v2（宽度剖面驱动）。** v1「侧壁单段贝塞尔 + 甲尖帽拼接」弧度不饱满，已重做：`w(t)` 半宽剖面函数 + Catmull-Rom 贝塞尔链，侧弧连续饱满、甲尖圆润过渡。24 轮廓 + 60 图案 SVG 已按新几何全量重生成，`validate-assets.py` PASS。详见 §4.3。
> 2. **新增 `nails-shape-svg` skill 封装。** 甲型几何的单一事实源收敛为 skill 内脚本（`generate_nail_shapes.py`），项目 `tools/generate-nail-shapes.py` 降为薄封装；校准方法论、参数模型、参考图谱随 skill 分发。详见 §4.3。
>
> **v1.2.0 修订（2026-07-24，依据 0724 备忘录）：**
> 1. **模板库从「整图图案」演进为「组件 + 配方」架构**：新增 Component（surfaces/lines/relief/ornaments）、Design Recipe、Production Profile 三类对象；首发锁定 Top 3 款式（裸透猫眼金属流线 / Bridal 3D Floral French / Mermaid Shell Pearl）+ 12 个有效甲型长度组合。详见 §5.9。
> 2. **编辑边界收紧为白名单参数**：首发不开放自由手绘/任意上传/无限变换；Editor 自由画布降级为进阶模式。首发指标收紧为「3 分钟完成十指确认卡」。
> 3. **确认版本永久冻结**：confirmation 扩展 frozen_snapshot（recipe/asset/renderer 版本），模板更新不得影响已确认订单。详见 §6.2。
>
> **v1.1.0 修订（2026-07-23）：** ① 顾客确认 = 线下场景，砍掉全部线上确认功能（§6.2）；② Wizard 新增甲型×风格映射关系模型（§5）。

---

## 0. 本计划回答三个问题

1. **做什么**：Sprint 1–5 交付一个 FRONTEND_MOCK 证据级的 P 端 Web 应用（基础平台 + Studio Wizard + Studio Editor），并为后端 38 端点接入预留零改动接口层。
2. **怎么做得好看**：视觉与交互全面对标欧美主流创意设计类 SaaS（Figma / Canva / Framer / Linear / Procreate 的交互心智），见 §3 设计系统。
3. **视觉素材怎么来**：手部背景、甲型轮廓、十指坐标、模板组件、Mock STL 全部作为**独立资产管线**产出，与代码解耦，见 §4 资产管线；模板素材遵循 material-library 存储架构（§5.6）并向组件化配方演进（§5.9）。

---

## 1. 产品目标与北极星

**北极星指标：**

> 美甲师能否在 10 分钟内，从模板产生一套具有个人风格、且可以打印的十指设计。
> （v1.2.0 收紧：首发 Top 3 目标——**3 分钟内从模板完成一份十指确认卡**。）

**分解验收项：**

- Wizard 全流程（选客户 → 顾客线下确认 → 标记已确认）≤ 10 分钟（熟练 ≤ 5 分钟），3 步出单路径可走通；
- 参数级逐指例外（换装饰/换色）在 Wizard 内完成，不进 Editor；
- 甲型×风格映射生效：选甲型后模板按适配度三档排序，不建议项有可读原因且仍可选；
- Editor 基指同步下完成一套十指设计 + 1 个例外指，编辑次数 ≤ 3 次；
- 确认闭环可走通：draft → confirmed（手动标记，冻结只读）→ 基于已确认设计创建新版本；
- 桥接不可逆警告完整展示后才可进入 Editor；
- 十指预览单指失败时其余 9 指正常降级；
- P0 风险筛查文案红线不破（§9）。

**范围锚点：** 证据级 = FRONTEND_MOCK。无后端、无真实硬件、数据存 localStorage；PNG 为唯一导出形态；STL 仅 Mock 占位（§4.6）。凡「后端就绪后」能力均以 Mock 场景注入面板驱动，UI 零改动切换。

---

## 2. 技术选型与架构

### 2.1 技术栈（对标创意 SaaS 主流组合）

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | React 18 + TypeScript + Vite | 创意工具事实标准，生态与 three.js 最匹配 |
| UI 基座 | Tailwind CSS + shadcn/ui（Radix 原语） | 设计 token 化、可定制到 Figma/Linear 级质感 |
| 画布 | HTML Canvas 2D（自研轻量引擎） | 甲型轮廓裁剪 + 五层合成；不引入 Fabric/Konva 重依赖 |
| 3D 检查 | three.js（ArcballControls，非 OrbitControls） | 仅检查视图，不可编辑 |
| 状态 | Zustand + Immer | 轻量、支持时间旅行（Editor Undo/Redo 栈） |
| 路由 | React Router v6 | PRD §1.4 路由表直接映射 |
| 持久化 | localStorage（ProjectV3 envelope + 数据桥：写入画布键 + 2s 轮询回写 + 跨标签 rehydrate） | 沿用原型既有机制，零改动 |
| 测试 | Vitest（单元）+ Playwright（e2e） | 不破坏既有 37 条 e2e，新增能力配套 e2e |
| 资产 | SVG（矢量优先）+ PNG（仅缩略图/兜底）+ 脚本生成 STL | 见 §4、§5.6、§5.9 |
| 甲型几何 | `nails-shape-svg` skill（单一事实源） | 见 §4.3 |

### 2.2 架构分层

```
src/
├── platform/          # 第一部分：基础平台（登录/注册/客户/设备/Dashboard）
├── studio/
│   ├── wizard/        # Wizard：客户选择器 → STEP1 门禁 → STEP2 画布（含风格映射排序）
│   ├── editor/        # Editor：工具栏/画布/图层面板/十指编排/3D 检查（v1.2.0 降为进阶模式）
│   ├── bridge/        # Wizard → Editor 桥接（数据转化 + 不可逆警告）
│   ├── preview/       # Back V2 十指渲染器（签收 plate + 10 个 NailSlot，Wizard/Editor 共用）
│   └── pipeline/      # Pipeline 路由前置占位（P0 参数级检查、routeAttachment 桩）
├── design-system/     # §3 设计 token、组件、动效
├── mock/              # Mock 场景注入面板、Mock 数据、Mock STL 清单
└── lib/               # 数据桥、状态机、存储 envelope
material-library/      # §5.6 模板素材库 + §5.9 组件/配方/工艺档案
assets/                # §4 资产管线产物（手部底图 / NailSlot / Mock STL / 校准产物）
tools/                 # 资产生成脚本（甲型生成器为 nails-shape-svg skill 薄封装）
```

### 2.3 关键架构约束（锁定，不得破坏）

1. **画布形状 = 甲型轮廓**，不是矩形画布；绘制内容裁不出边界。
2. **五层底层结构不重构**（base/texture/pattern/decoration/finish），对用户呈现三层制造语义（底色/图案/附件 + 封层）。
3. **立体高度唯一通路**：附件层预制组件 + `heightMm` 参数；禁止连续高度图 displacement。高度按路由分流：uv25d ≤0.30mm（UV 喷绘阴影 P0 规避）；>0.3mm 的结构件（水滴/花瓣等）走 relief 路由，上限由 Production Profile 声明（§5.9）。
4. **3D 视图是检查工具，不可编辑**。
5. **MVP 仅提供 Back 视图**；若 Palm 后续复活，反向只能作用于显示层（`xPalm = 1 - xModel`），不得写入历史或影响 Copy/Mirror 业务语义。
6. **前后端共用 `shape-params.json` 统一参数源**（P0 风险：预览 ≠ 打印 的缓解措施）；几何实现单一事实源为 `nails-shape-svg` skill 脚本。
7. 预览渲染与资产解析走同一套 **NailSlot 动态坐标系统**（§4.4），Wizard 5×2 预览、Editor 平铺预览、客户详情 Twin 可视化共用。
8. **模板数据一律从 `material-library/index.json` 读取**，前端不硬编码模板清单、适配关系或色板。

---

## 3. 设计系统（对标欧美创意 SaaS）

### 3.1 对标对象与采纳点

| 产品 | 采纳的交互/视觉心智 |
|---|---|
| **Figma** | 画布优先的沉浸式布局；右侧上下文属性面板（选中什么显示什么）；顶部悬浮工具条；空格+拖拽平移、滚轮缩放；多选与跨对象操作 |
| **Canva** | Wizard 模板选择器心智：左侧模板库 + 中间即时预览 + 右侧少量参数；「选一个款 → 改几个参数 → 导出」的零学习成本路径 |
| **Linear** | 极致的排版密度与留白纪律；克制的色彩（中性灰 + 单一主色）；键盘优先（命令面板、快捷键全覆盖）；微动效 150–200ms |
| **Framer** | 页面过渡与面板展开动效；悬浮态的信息浮现（甲型卡片悬浮标签） |
| **Procreate** | Editor 工具栏的「画笔/橡皮/导入」极简工具组；图层语义直观 |

### 3.2 设计 Token（初版，落地为 `tokens.json` + Tailwind theme）

| Token 组 | 规范 |
|---|---|
| 主色 | 单一品牌主色（建议暖调玫瑰/浆果色系，候选 `#C2497A`），用于选中态、主按钮、焦点环 |
| 中性色 | 11 级灰阶（#FAFAFA → #0A0A0A），画布区浅灰底（#F4F4F5），面板白底 |
| 语义色 | 沿用 PRD Toast 规范：Success `#277A58` / Warning `#9A5A12` / Error `#B42318` / Info `#3F6678` |
| 字体 | UI：Inter（+ 系统中文字体栈）；数字/参数：tabular-nums |
| 圆角 | 面板 8px / 卡片 12px / 按钮 6px |
| 阴影 | 仅两级：悬浮面板（y=2 blur=8 8%黑）、模态（y=8 blur=24 12%黑） |
| 动效 | 淡出淡入 150–200ms ease-out；十指模板切换 150ms 出 + 200ms 入；骨架屏脉动 1.2s |
| 断点 | 桌面 Web，1179px 主断点；不做移动端（手机辅助配网页除外） |

### 3.3 全局交互规范

- **快捷键体系**（Editor 优先）：V 选择 / B 画笔 / E 橡皮 / ⌘Z ⌘⇧Z 历史 / 空格平移 / ⌘滚轮缩放 / Esc 退出当前模式；全部快捷键在命令面板（⌘K）可发现。
- **上下文属性面板**：右侧栏 = 选中对象驱动。禁止长期铺开全部参数。
- **空状态/骨架屏/Toast/404**：严格按 PRD §六、§七执行；空状态配定制插画（§4.7）。
- **Mock 标识纪律**：Twin 数据标 `MOCK`、配网标 `MOCK IOT`、风险页固定命名 `P0 RISK SCREEN · MOCK`。

---

## 4. 视觉资产与 SVG 资产管线（专项）

> **所有美甲视觉素材与 SVG 文件单独生成、单独验收、版本化管理**，代码只消费资产清单（manifest），不内嵌坐标或路径数据。

### 4.1 资产总览与目录

```
assets/
├── visual-plates/back/       # Back 唯一签收画布 plate + manifest（§4.2/§4.4）
├── nail-slots/               # slots.back.v2.json + 校准覆盖图；legacy slots archived
├── hands/                    # legacy hand-{back,palm}.svg + manifest，archived 保留不消费
├── decorations/              # 预制附件组件 SVG（爱心/珍珠/蝴蝶结/…）
├── illustrations/            # 空状态插画 ×4（客户/设备/设计/404）
├── shape-calibration/        # 甲型校准产物（§4.3：contact-sheet-v2.png）
└── stl/                      # Mock STL（§4.6）
material-library/             # §5.6 模板素材库 + §5.9 组件化配方架构
├── shapes/                   # 甲型轮廓（§4.3，nails-shape-svg skill 生成）
├── templates/                # 12 套模板 × 6 甲型 = 72 图案 SVG
├── components/               # v1.2.0：surfaces/lines/relief/ornaments（§5.9）
├── recipes/                  # Petal Veil + Liquid Velvet 数据契约已落地；Mermaid 待补
├── production-profiles/      # v1.2.0：工艺约束档案（§5.9）
├── colors/  finishes/        # 色板与质感定义
└── generated/                # 临时预览、确认版本、生产导出物、预计算缩略图
tools/                        # 资产生成脚本（甲型生成器 = skill 薄封装）
```

### 4.2 手部画布背景（MVP：Back 唯一签收视图）

MVP 使用已签收的中性女性双手 Back 线稿 plate（1200×900 PNG）作为模板浏览与未扫描预览画布；plate 与 NailSlot V2 共享原生像素坐标域并整体响应式缩放。旧 Back/Palm SVG 与 anchor slots 仅保留审计，不被运行时消费。

| 属性 | 规范 |
|---|---|
| 视图 | `assets/visual-plates/back/back-line-art-approved-v1.png`；Palm MVP 不提供，未来复活须重新生成 plate 并走 V2 标定与人工签收 |
| 风格 | 暖象牙纸感、中性双手线稿、极细深色轮廓、十个裸甲床完整可见；无皮肤填色与族裔暗示 |
| 肤色 | 不做独立皮肤填色；暖象牙底色已纳入签收 plate，避免与线稿抗锯齿边缘脱节 |
| 坐标域 | 双手完整入画，统一使用 plate 原生 1200×900 像素坐标；指甲区域**留空不画死**——指甲由 NailSlot V2 动态渲染（§4.4） |
| 交付物 | 1 张签收 PNG plate + `slots.back.v2.json`（10 指界标/仿射矩阵）+ manifest + 校准 overlay/review |

**验收：** 与参考图并排比对，姿态/比例一致；常用桌面宽度下 plate 清晰、整体等比缩放；10 指 overlay 均落在真实甲床内，中轴与手指方向一致，禁止对单个 NailSlot 再做独立视觉缩放补偿。

### 4.3 甲型轮廓：参数化生成 + nails-shape-svg skill 封装（v1.2.1 重做）

6 甲型（almond / coffin / squoval / round / square / stiletto）× 4 长度（short / medium / long / extra-long）的轮廓**由脚本从参数生成**，不做 24 张手绘静态 SVG。

**曲线模型 v2（宽度剖面驱动，2026-07-24 替换 v1 拼接模型）：**

- v1 模型（侧壁单段贝塞尔 + flat/semicircle/pointed 甲尖帽拼接）侧弧平直、尖部过渡生硬，**已废弃**；
- v2 模型：半宽剖面函数 `w(t)`（t：甲根 0 → 甲尖 1）驱动，剖面采样后 Catmull-Rom 转三次贝塞尔链（C1 连续，左右严格镜像）——侧弧天然连续饱满，无拼接感；
- 甲尖按 tipStyle 收口：flat = 圆角 + 顶线；semicircle = κ 近似四分之一椭圆穹顶（切线连续）；pointed = 剖面直接收到近零宽（顶点夹角解析可控）；
- 校准基准：`ref-shapes/ref-3..6.png` 四张专业甲型图谱——侧壁连续外凸的饱满弧线、甲尖圆润过渡、像真实甲片而非几何简笔画；
- 坐标约定不变：0.1mm 单位、原点 = 甲根中心、甲尖负 y、甲根浅弧 0.22W、`clipPath id="nail-clip"`、`outline_path_d()` 函数签名不变（下游 import 契约零破坏）。

**`nails-shape-svg` skill（几何单一事实源）：**

```
nails-shape-svg/  （托管 skills 目录，已打包 nails-shape-svg.skill）
├── SKILL.md                      # 触发场景 + 核心工作流（改参数→生成→看 contact sheet→validate）
├── scripts/generate_nail_shapes.py   # 几何单一事实源；自包含 CLI（--params --out --contact-sheet）
├── references/shape-spec.md      # 坐标约定 / 逐字段参数模型 / 6 甲型设计意图与基线 / 校准方法论
└── assets/                       # 4 张参考图谱 + 最终 contact-sheet.png
```

- 项目 `tools/generate-nail-shapes.py` 为 skill 脚本的**薄封装**（保持原 CLI 行为与输出路径，`generate-template-patterns.py` 的 import 契约不变）；禁止在项目内另写几何实现；
- 参数源仍为 `material-library/shapes/shape-params.json`（version 2 参数模型：tipStyle/tipW/λ/rootFullness/midFullness/fullnessPos 等），同一参数源驱动前端画布轮廓、NailSlot 占位、Mock STL、（后端就绪后）壳体 STL——**保证预览 = 打印**；
- **校准工作流**（改弧度/新增甲型时必走）：改 shape-params → 跑生成器（含 `--contact-sheet`）→ 查看 contact sheet 与参考图谱并排比对 → 迭代至达标 → 重跑 24 轮廓 + 72 图案（12 模板 × 6 甲型）→ `validate-assets.py` PASS → 前端 NailSlot 实际渲染过一眼；
- 当前校准结果：`assets/shape-calibration/contact-sheet-v2.png`（4 轮迭代达标版）；已知限制：甲根为约定浅弧（非真手半月根）；round 穹顶与侧壁为 C1 连续（肉眼不可辨，追求极致可升 G2）。

### 4.4 NailSlot V2 十指界标仿射系统（Back 唯一运行时坐标源）

**禁止**用归一化 anchor、`nailScale` 或 `PX_PER_MM` 对甲片做手调定位。Back V2 使用签收 plate 原生像素域中的三界标与仿射矩阵：

```
第一层 · NailSlot V2（Back 10 指，人工界标签收）
  slot = { fingerCode: "L1"…"R5",
           landmarks: { tip, rootCenter, midLeft, midRight },
           transform: [a, b, c, d, tx, ty],
           contourPath? }

第二层 · 运行时内容投影
  nailContent = matrix(slot.transform)
    · contentUvTransform(widthMm, lengthMm)
    · FingerNailContent
```

规则：

1. **定位锚定真实甲床界标。** 换甲型/换长度时，已签收界标不动；长度只沿 root→tip 轴变化，甲根保持固定。
2. **Back 单视图单一事实源**：运行时只读取 `assets/nail-slots/slots.back.v2.json`（`calibrationVersion=back-v2.1.0`）；`slots.back.json` / `slots.palm.json` 均为 archived legacy。
3. **校准工具**：`tools/slot-calibrator/recalibrate-v2.py` 以 plate 上的 tip / root-center / mid-width 界标生成 matrix；每次 plate 或界标变化后必须重新输出 overlay 并逐指人工签收。
4. **降级**：某指渲染失败 → 该指显示灰甲型 + ⚠️ 占位，其余 9 指不受影响。
5. 10 个 NailSlot 不进入项目历史（DUV0722），但 V2 界标文件、manifest、overlay 与签收记录必须入版本库。

### 4.5 附件组件库

- `decorations/`：预制附件组件 SVG（爱心/珍珠/蝴蝶结等），独立于模板，供 Wizard 参数级逐指例外（换爱心/珍珠/蝴蝶结）与 Editor 附件层复用；
- 每个组件带默认参数 `{ x, y, scale, rotation, heightMm }`；uv25d 路由 heightMm 参数域 0.05–0.30mm，relief 路由上限见 Production Profile（§5.9）。

### 4.6 STL Mock 策略

- **本阶段只 Mock**：`tools/generate-mock-stl.py` 生成参数化甲片壳体占位 STL（半椭球壳，吃 `shape-params.json` 同一参数源），用于跑通「导出清单 → 文件管理 → 工艺包字段占位」链路；
- `stl/manifest.json` 声明每套模板 / 每甲型的正式 STL 占位条目，状态标 `MOCK_PENDING_ALGO`；
- **正式 STL 由算法组（8/3 到岗）工艺映射引擎产出**，替换时只改 manifest 指向，UI 与导出链路零改动；
- 红线延续：原型期 PNG 仍是唯一用户可见导出形态，STL 不暴露给用户。

### 4.7 其他视觉素材

- 空状态插画 ×4（客户列表 / 设备列表 / 设计列表 / 404）：与手部底图同一线稿风格；
- 登录/注册页品牌视觉：单页极简，主色 + 手部线稿元素；
- 图标：lucide-react 为主，美甲专有图标（甲型、浮雕、法式线）自绘 SVG 补充。

### 4.8 资产验收 Definition of Done

每个资产包入库前须通过：

1. manifest / index.json 可被前端无硬编码消费（改资产不改代码）；
2. SVG 过 SVGO 压缩 + 设计 token 引用检查（无写死色值）；
3. NailSlot V2 渲染截图回归（24 甲型长度组合 × Back 唯一视图）；
4. 模板质量检查清单 6 项全过（§5.8）；
5. **甲型轮廓变更额外要求**：contact sheet 与参考图谱（ref-shapes/）并排比对通过 + 当前模板全集 72 图案同步重生成 + 前端 NailSlot 实际渲染抽查（v1.5.0 更新）；
6. 与参考图/设计走查比对通过。

---

## 5. 甲型 × 风格映射模型（Wizard，v1.1.0）

> 依据：`模板库后端架构-风格映射与素材存储-0723.md` §一。解决「10 套模板平铺列表无法表达专业建议」的问题——美甲师选完甲型后，系统应像资深美甲师一样告诉她「这款适合这个甲型，那款不建议，原因是…」。

### 5.1 核心数据模型（落在 `material-library/index.json`）

```json
{
  "id": "t_french_white",
  "name": "法式白边",
  "name_en": "French White Tip",
  "style_tags": ["minimal", "classic"],
  "default_base_color": "#F5E0D3",
  "default_finish": "gloss",
  "shape_compatibility": {
    "highly_compatible": ["almond", "squoval", "coffin"],
    "neutral": ["square", "round"],
    "not_recommended": {
      "stiletto": "极尖甲面上法式弧线比例失衡，白边视觉效果不理想"
    }
  },
  "sort_order": 1
}
```

### 5.2 风格标签体系（七类筛选，v1.5.0）

| 标签 | 含义 | 代表模板 |
|---|---|---|
| 当下流行 trending | 有明确时效、进入 Studio 近期主推与验证队列 | Liquid Velvet Cat-eye、Petal Veil French |
| 甜美 sweet | 柔和、少女感 | 裸粉渐变、3D 水滴 |
| 简约 minimal | 干净、日常 | 法式白边、经典高光 |
| 酷炫 cool | 个性、前卫 | Y2K 冰川、暗夜渐变 |
| 复古 retro | 经典图案 | 棋盘格 |
| 奢华 luxe | 高光泽、贵气 | 猫眼裸色、镜面铬 |
| 节日 holiday | 节庆限定 | 节日闪粉 |

Wizard STEP 2 模板选择器顶部为七个风格筛选标签（单选，默认「全部」）。「当下流行」是动态内容标签，可与甜美/简约/奢华等审美标签叠加；当前由 `material-library/index.json` 驱动，后续补 `valid_from / valid_until / evidence_note`，避免永久“流行”。

### 5.3 映射的两个方向

```
方向 A：Shape → Templates（前端纯排序规则，不调 API）
  用户在 STEP 1 选定甲型后，模板卡片按适配度三档排序：
    ① highly_compatible → 排最前 + 绿色「推荐」标签
    ② neutral            → 排中间，正常展示
    ③ not_recommended    → 排最后 + 饱和度降至 60%
                           + 底部提示「⚠ {reason}。仍可选择。」

方向 B：Template → Shapes（数据自带属性，卡片 badge）
  每张模板卡片展示最佳甲型小 badge：
    「★ almond」「✓ squoval, coffin」「⚠ stiletto」
```

### 5.4 12 套模板完整映射表（v1.5.0，落入 index.json）

| template_id | 风格 | 高度适配 | 不建议（附 reason） |
|:--|:--|------|------|
| `t_liquid_velvet_cat_eye` 裸透猫眼金属流线 | 当下流行、奢华、简约 | almond, coffin, squoval | square：宽平甲面使纵向磁光发散，侧弧流线难以连续拉长 |
| `t_petal_veil_french` 奶雾法式立体花 | 当下流行、甜美、简约 | almond, round, squoval | stiletto：极尖甲面压缩法式弧与低浮雕花的留白 |
| `t_french_white` 法式白边 | 简约 | almond, squoval, coffin | stiletto：极尖甲面法式弧线比例失衡 |
| `t_nude_gradient` 裸粉渐变 | 甜美 | almond, round, squoval | stiletto：渐变过渡在尖端被截断 |
| `t_cat_eye_nude` 猫眼裸色 | 奢华 | almond, coffin, squoval | square, stiletto：猫眼光带需要纵向弧面 |
| `t_y2k_ice` Y2K 冰川 | 酷炫 | coffin, almond, stiletto | round, square：短圆甲面气场不足 |
| `t_dark_gradient` 暗夜渐变 | 酷炫 | stiletto, coffin, almond | round, square：渐变需要长度支撑 |
| `t_chrome_mirror` 镜面铬 | 奢华 | stiletto, coffin | round, square：镜面效果在大平面上显廉价 |
| `t_checkerboard` 棋盘格 | 复古 | square, coffin | round, stiletto：格子在曲边上变形 |
| `t_3d_waterdrop` 3D 水滴 | 甜美 | almond, round | square, stiletto：水滴造型与直边/尖角冲突 |
| `t_classic_high_gloss` 经典高光 | 简约 | **全部 6 种** | — |
| `t_holiday_glitter` 节日闪粉 | 节日 | almond, coffin, round | stiletto：闪粉在尖端堆积过厚 |

> v1.5.0 注：原 10 套整图模板保留为**扩展池**，新增两套 Top 3 独立正式模板后总数为 12；首发验证闭环仍收敛为 §5.9 的 Top 3 配方款。兼容性三档继续使用 `highly_compatible / neutral / not_recommended`，其中不建议必须带 reason。

### 5.5 关键设计原则：不建议 ≠ 硬禁止

美甲店真实场景：客户可能坚持要「尖形法式」。硬禁止会逼美甲师用「尖形 + 纯色 + 手动 PS」绕过系统，比直接允许更糟。因此：

- `not_recommended` 卡片**仍可点击 [应用此模板]**；
- 每个不建议关系**必须附带 `not_recommended_reason` 人类可读解释**，没有原因的不建议关系不允许入库（JSON Schema 强制）；
- 视觉降级（60% 饱和度 + ⚠ 提示）传达专业建议，选择权留给美甲师。

### 5.6 素材库存储架构（material-library/，对齐后端架构文档 §二）

```
material-library/
├── templates/
│   ├── index.json                 ← 模板索引（§5.1 数据模型 + sort_order）
│   ├── t_french_white/
│   │   ├── manifest.json          ← 6 甲型 SVG 路径 + 缩略图 + uv_params
│   │   ├── patterns/              ← 每甲型一份独立图案 SVG（共 6 份）
│   │   └── thumbnails/            ← 模板卡片缩略图
│   └── ...（共 12 个模板 → 72 个图案 SVG）
├── shapes/
│   ├── silhouettes/               ← 6 甲型 × 4 长度 = 24 个轮廓 SVG（§4.3 skill 生成器产物）
│   └── shape-params.json          ← 统一参数源（v2 参数模型）
├── colors/palette.json            ← 8 色色板（名称 + hex）
└── finishes/finishes.json         ← gloss / matte / pearl 元数据
```

**为什么每模板 6 份 SVG 而非一份硬拉伸**：法式弧线在 almond 上刚好，拉伸到 square 上白边位置偏移 → 预览与实物不一致。每甲型独立适配，保证每个甲型上的视觉效果都是设计师意图。

`manifest.json` 含 `uv_params`（图案在甲片 UV 空间的锚点与缩放），Q3 仅记录，Q4 供工艺映射引擎消费。

### 5.7 后端预览 Pipeline（Henry 8/25 前搭骨架，前端 Mock 期本地渲染同构实现）

```
POST /api/preview/generate { shape, length, template_id, base_color, finish }
  → 加载甲型轮廓 SVG → 加载该甲型的模板图案 SVG
  → 合成（底色填充 + 图案叠加；质感 Q3 仅记录参数）
  → 十指排版（DUV0722 NailSlot，Q3 用标准尺寸）
  → 输出 Back 单视图（Palm 已于 v1.4.1 软删除）
缓存：key = hash(全部参数)，TTL 5 分钟（同参数切换 2s → 200ms）
技术：Cairo/resvg（SVG 渲染）+ Pillow（合成）；❌ 禁止 headless browser
API：GET /api/templates（支持 shape 排序/tag 筛选）、GET /api/templates/:id、
     POST /api/preview/generate、GET /api/preview/:id/status（>2s 异步轮询）
```

前端 Mock 期的本地渲染器与后端 Pipeline **同构**（同一套 silhouette + pattern SVG 合成逻辑），切换时仅替换数据源。v1.2.0 补充：**顾客确认卡与生产导出为后端权威渲染**（保证一致、留存可追溯）；前端只承担画布即时交互渲染。

### 5.8 模板质量检查清单（入库强制）

| # | 检查项 |
|---|---|
| 1 | 6 个 SVG 的 viewBox 一致 |
| 2 | 每个 SVG 路径在甲型轮廓内（不溢出），Pipeline 自动检查 |
| 3 | 缩略图存在且可加载 |
| 4 | manifest.json 引用文件全部存在 |
| 5 | shape_compatibility 不含不存在的甲型 ID；not_recommended 必有 reason |
| 6 | 6 甲型 × 4 长度预览全组合通过（自动化脚本） |

### 5.9 组件化配方架构（v1.2.0 演进方向，依据 0724 备忘录）

> Studio 不是「美甲图库」，而是以**可复用款式配方**为核心的设计与确认系统：顾客选款 → 美甲师有限编辑 → 十指确认 → 可制造输出。源资产为可编辑、可版本化的组件与配方；PNG 只是确认/生产时的导出结果。

**四类核心对象：**

| 对象 | 面向谁 | 作用 | 存放 |
|---|---|---|---|
| Template | 顾客、美甲师 | 被选择的款式卡与筛选标签 | `templates/` |
| Component | 设计师、Studio | 可复用视觉/结构元素 | `components/`（surfaces/lines/relief/ornaments） |
| Design Recipe | Studio、设计师 | 十指图层、锚点、颜色、可编辑范围 | `recipes/` |
| Production Profile | 生产、质检 | 材料、厚度、结构高度、贴合与打印约束 | `production-profiles/` |

**必须区分 Recipe 与 Production Profile**：前者决定「看起来怎样」，后者决定「能否稳定做出来」。

**首发 Top 3（锁定）：**

| 款式 | 角色 | 核心组件 | 优先甲型长度 | 制造约束（入 Production Profile） |
|---|---|---|---|---|
| 裸透猫眼金属流线 | 日常主模板/走量 | jelly 底、猫眼光带、金属曲线、水滴 | 短椭圆、短/中/长杏仁、棺材 | 水滴 ≤1mm（relief 路由）；金属线不跨越高摩擦切缘 |
| Bridal 3D Floral French | 常青复购 | 法式边、五瓣花、花心、金线、轻闪 | 短方圆、短椭圆、短/中杏仁 | 花瓣 ≤0.7mm（relief 路由）；花心避开摩擦区 |
| Mermaid Shell Pearl | 传播与品牌记忆 | 珠光渐变、贝壳、鱼鳞、气泡、半珠 | 短椭圆、短/中/长杏仁、中棺材 | 轻量化；避免尖锐和易勾发结构 |

**路由澄清（与 §2.3-3 一致）**：0.3mm 是 uv25d（UV 喷绘）路由的硬上限；水滴 1mm / 花瓣 0.7mm 为 relief（3D 打印结构件）路由，由 `routeAttachment()` 按 `heightSource + maxHeightMm` 自动分流，用户不感知。

**甲型×长度策略：12 个有效组合**（不做机械全组合矩阵）：

| 甲型 | 长度 |
|---|---|
| 方圆 squoval | 短、中 |
| 椭圆 oval | 短、中 |
| 杏仁 almond | 短、中、长 |
| 棺材 coffin | 中、长 |
| 长杏仁 long-almond | 中、长 |
| 尖形 stiletto | 中、长 |

- `shape-params.json` 增加 `valid_combinations` 白名单；UI 只呈现有效组合，其余组合保留生成但不进选择器；
- 每款 Recipe 只声明真正适合的 6–9 个组合，按 `recommended / available / not_recommended`（含 reason）记录；
- 注意「长杏仁」为独立甲型家族（区别于 almond×long），shape 家族扩展走 §4.3 skill 校准工作流。

**编辑白名单（首发只开放安全且可制造的参数）：**

- 底色、渐变、猫眼方向、金银线颜色；
- 法式边宽度；
- 水滴/花朵/珍珠的预设位置、密度（少/标准/丰富）、大小档位（S/M/L）；
- **首发不开放**：自由手绘、任意上传贴图、无限旋转/缩放。Editor 自由画布保留为「进阶模式」，不进首发验收路径。

**素材最小包（Phase 1 目标）：** 甲体 SVG ×12（每有效组合一份轮廓 + UV/锚点空间）· 表面材质 ×12（裸粉/奶白/海盐灰/海蓝/薰衣草/银灰 + jelly/pearl/chrome 效果，参数化 SVG 定义非位图）· 组件 ~20（金属线/法式边/水滴/五瓣花/花心/贝壳/鱼鳞/气泡/半珠等）· 款式配方 ×3 · 预计算缩略图 ~20–30（存 `generated/`，不是每指单独存图）。

**Phase 0 本周交付物：** `style-compatibility-matrix.json`（12 组合 × Top 3，每格有推荐等级和理由）· 四份 JSON Schema（Template/Component/Recipe/Production Profile）· `editing-policy.md`（每个可编辑参数的范围、默认值与风险提示）。

### 5.10 Wizard MVP 收敛：almond 单甲型 + 风格推荐弹窗（v1.3.0）

**决策：MVP 阶段 Wizard 收敛至 almond 单甲型，先把 Wizard 流程框架跑通并验收，再逐型扩展。**

**甲型门禁（STEP 1）：**

- 仅 **almond** 可点；coffin / squoval / round / square / stiletto 一律**置灰禁用**，卡片标注「即将推出」（hover title 说明 MVP 阶段仅开放杏仁形）；
- 置灰是 UI 层门禁（`ShapeLengthPicker.MVP_ENABLED_SHAPES`），素材库 6 甲型数据与渲染管线保持完整，开放新甲型 = 曲线签收 + 集合加名，不改代码结构；
- 开放顺序建议按 §5.9 12 有效组合白名单逐一签收（almond 签收中 → squoval/coffin 候选）。

**风格推荐弹窗（选定甲型长度后、进入画布前，每个设计一次）：**

- 时机：STEP 1 [应用 → 预览十指] → 先弹推荐弹窗，选用/跳过后才进入 STEP 2；
- 内容：与所选甲型匹配的当下流行风格 Top 3，**YouTube 封面式 16:9 大图卡**（1280×720）+ TOP 优先级角标 + 最佳长度区间 + 推荐理由；
- 数据：一律 fetch `/assets/styles/manifest.json`（按甲型分组），禁止硬编码；`cover_status=MOCK` 的占位封面强制角标（不得冒充正式图，入库红线）；
- 交互：卡片显示「适配当前长度」徽章（当前长度 ∈ 该风格最佳区间时）；[选用此风格] → 进入画布并自动应用映射模板（`template_id` → index.json 现有模板，映射失败不阻断）；[暂不选择，直接进入画布] / Esc / 关闭均视为跳过且本设计不再弹（`stylePrompted`）；
- almond 首发 3 款（与 §5.9 Top 3 对齐）：

| 优先级 | 风格 | 最佳长度 | 映射模板 | 封面 |
|---|---|---|---|---|
| 1 | Liquid Velvet Cat-eye｜裸透猫眼金属流线 | 14–26mm 全覆盖 | `t_liquid_velvet_cat_eye` | REAL（1280×720 正式视觉） |
| 2 | Petal Veil French｜奶雾法式立体花 | 14–22mm 优先 | `t_petal_veil_french` | REAL |
| 3 | Sea Glass Mermaid｜海玻璃果冻贝壳珠光 | 18–26mm 优先 | t_3d_waterdrop | MOCK |

- Wizard store 扩展：`styleId / styleName / stylePrompted`（仅会话态，不入 DesignSummary）。
- v1.5.0 浏览器验收：Top 1 / Top 2 点击后分别选中新模板；「当下流行」筛选展示两款且保持当前应用态；Liquid Velvet 卡片/推荐封面不再出现 MOCK 角标。

### 5.11 Studio 契约层与 NailSlot V2 渲染架构（v1.4.0，依据 0724 开发备忘录 §11）

**目标：UI 组件化 —— 设计文档、渲染模型、扫描上下文三类对象边界清晰，渲染路径唯一可解释。**

**① 四模式状态机（`StudioMode`）：** `browse`（浏览模板）→ `design`（设计）→ `scan-preview`（扫描预览，Sprint 2+）→ `confirm`（确认，只读）。单向流转；confirm 后任何编辑只能「基于已确认设计创建新版本」。

**② 三类状态分离（不得混存）：**

| 状态类 | 内容 | 持久化 |
|---|---|---|
| document | DesignSet / ProjectV3，可保存、可版本化 | ✅ localStorage envelope |
| scanContext | 扫描几何上下文，只读、带版本，永不编辑 | ✅ 独立键（Sprint 2+） |
| ui | 选中手指、弹窗、淡入淡出等瞬态 | ❌ |
| derived | RenderModel 等派生渲染态，由前三者计算 | ❌ 永不持久化 |

**③ DesignSet 与 Override 差分语义：** `DesignSet = { geometry:{shape,length}, recipeRef:{id,version}, defaults, overrides }`。overrides 只存与 defaults 的差分；「重置此指」= 删除该指覆写；`masterFinger` 只是编辑入口，不入文档。配方内容不落设计文档，只存 `recipeRef`（id + version），换版可追踪。

**④ 双输出契约：** `PreviewRender`（Plate + SlotMap + Geometry + Recipe，展示渲染，不保证物理厚度）与 `ManufacturingPackage`（扫描几何 + FrozenSnapshot，Sprint 2+）是两条独立输出管线，禁止用预览渲染冒充生产包。

**⑤ NailSlot V2 渲染路径（Back 视图唯一路径）：**

- 资产：签收线稿 plate（`assets/visual-plates/back/back-line-art-approved-v1.png`，1200×900）+ `slots.back.v2.json`（calibrationVersion=back-v2.1.0，2026-07-27 人工签收）；
- 投影：局部 UV（rootCenter(0.5,1) / tipCenter(0.5,0)）→ `matrix(slot.transform)` → stage px；设计内容（0.1mm 剪影坐标）经 `contentUvTransform(widthMm,lengthMm)` 归一化为 UV 后同矩阵投射；
- 长度规则：甲根（v=1）固定，长度只向甲尖方向伸缩（`extendSlotToLengthMm`），四档 14/18/22/26mm 共用同一组签收界标；
- **V2 坐标域内废止 `nailScale` / `PX_PER_MM` / anchor 归一化坐标**（slots 文件 `local_uv_contract.legacy` 红线）；
- 标定变更必须走 `tools/slot-calibrator/recalibrate-v2.py` + 覆盖图人工签收，签收前不得改 `calibration.status`。

**⑥ 渲染路径现状与收敛方向（v1.4.1 更新）：**

| 路径 | 状态 |
|---|---|
| Wizard Back 十指预览 | ✅ NailSlot V2（`src/studio/render/BackPlatePreview`），唯一视图 |
| ~~Wizard Palm 十指预览~~ | ❌ v1.4.1 软删除（MVP 收敛）；legacy 资产 archived，复活须走 V2 标定 |
| legacy anchor/nailScale 定位 | ❌ v1.4.1 彻底废止（`loadHandView`/`nailScale`/`PX_PER_MM`/`HAND_VIEWBOX` 退役） |
| Editor 画布/平铺 | 独立渲染器（`editor/lib/render.ts`），共享 `FingerNailContent` 前先在契约层对齐；收敛为后续专项 |
| 共享组件 | `FingerNailContent`（轮廓/底色/图案/附件四层，0.1mm 剪影坐标系），Wizard 预览复用 |

**⑦ 配方数据契约（`material-library/recipes/`）：** 层坐标一律 (u,v) 0..1 相对坐标（u=0.5 中轴、v=1 甲根、v=0 甲尖），尺寸相对甲片宽，**禁止存屏幕/像素坐标**；`status=data-contract-draft` 表示参数化 Recipe 渲染器未消费，不得声称已由 Recipe 渲染。正式 SVG 模板可先被 Wizard/Editor 消费，两种状态必须分开描述。

| Recipe | 版本 | 图层 | 可编辑参数 | 当前状态 |
|---|---:|---|---|---|
| `petal-veil-french` | 0.2.0 | base / french / petal / pearl / goldLine / finish | 底色、法式宽度、花朵数量、花心颜色、金线 | SVG 已接入；Recipe renderer 未接入 |
| `liquid-velvet-cat-eye` | 0.1.0 | base / catEye / metalLine / waterdrop / finish | 底色、猫眼角度、金/银线、单颗水滴开关 | SVG 已接入；Recipe renderer 未接入 |

Sea Glass Mermaid Recipe 尚未落地，仍映射 `t_3d_waterdrop` MOCK 能力，不得计入完成的 Top 3 参数化闭环。

---

## 6. 迭代排期（对齐 Q3 双周 I1–I5）

> 人员背景：Henry solo 至 8/25（后端骨架 API 与预览 Pipeline 骨架同步推进）；算法 8/3 到岗；前后端 8/25 到岗。本计划聚焦前端 Mock 应用 + 资产管线 + 素材数据。
> v1.2.0 排期注：Sprint 2 的「10 模板素材制作」优先级让位于 **Top 3 组件化配方**（备忘录 Phase 0/1）；10 套整图模板已完成的部分保留为扩展池，Top 3 有确认数据后再扩充（备忘录 Phase 3）。

### Sprint 1 · 7/27–8/7 — 基础平台 + 资产管线启动

| 工作 | 产出 | 验收 |
|---|---|---|
| 工程脚手架 + 设计系统落地 | Vite + TS + Tailwind + tokens；路由表全通 | 404/空状态/Toast 四型可见 |
| 登录/注册（两步，Mock 码 123456） | `/login` `/register` + 全部异常态 | e2e：注册→Dashboard 三引导卡 |
| 客户档案 | 列表/新建（隐私弹窗）/快速建档/详情内联编辑/软删除 | e2e 覆盖 PRD §5 全场景 |
| 设备绑定 | 四路径 6 步向导 + 设备列表 + 全部异常场景 | Mock 注入面板可触发全部 10 类异常 |
| **素材数据定稿（本周先行）** | `index.json`（含 §5 映射模型）+ `palette.json` + `finishes.json` | JSON Schema 校验通过；前端可直接消费 |
| **资产管线 P0** | Back 签收 plate + NailSlot V2（10 指）+ 校准 overlay + 甲型生成器（6 甲型 × 4 长度） | §4.8 DoD；Back V2 逐指 overlay 签收 + 24 甲型 contact sheet |
| **Phase 0（v1.2.0 新增，本周）** | `style-compatibility-matrix.json` + 四份 JSON Schema + `editing-policy.md` | 能描述任一 Top 3 款式的十指设计与工艺限制 |

> 进度注（2026-07-24）：Sprint 1 主体已提前完成（基础平台/设备/Wizard/Editor MVP 已实现并通过 12/12 e2e 冒烟）；甲型 v2 曲线与 nails-shape-svg skill 已交付（v1.2.1）。

### Sprint 2 · 8/10–8/21 — Wizard 完整流程（主路径）

| 工作 | 验收 |
|---|---|
| 客户选择器弹窗（搜索/骨架屏/快速建档内嵌） | 三入口均进入 STEP 1 |
| STEP 1 门禁：客户卡片（Twin 三态）+ 甲型卡片 + 长度按钮 + 应用按钮五态 | 甲型未选禁用；线稿随长度联动伸缩 |
| STEP 2：三栏布局 + 5×2 十指渲染器（Back V2 唯一视图） | 7 种预览状态全部由 Mock 注入面板可触发 |
| **模板选择器 + 风格映射模型**：七类风格筛选（含当下流行）+ 三档适配排序 + 不建议低饱和度与 reason 提示 + 最佳甲型 badge | e2e：选甲型后排序正确；不建议模板仍可应用；当下流行展示 Top 2 |
| 参数面板（8 色色板 + 质感下拉） | 改底色像素级即时替换 |
| 参数级逐指例外（换装饰/换色）+ `finger_overrides` 数据字段 | 无名指换爱心不出 Wizard |
| 保存体系（防抖自动保存/手动/失败重试/退出拦截）+ 导出 PNG | e2e：Wizard 全流程 ≤ 10 分钟 |
| **Top 3 组件化素材**：Liquid Velvet + Petal Veil 正式 SVG/缩略图/Recipe 已落地；补 Sea Glass Recipe + 12 材质 + ~20 组件 + Recipe renderer | 当前 12 模板/72 SVG 入库检查全过；最终三款在 ≥6 兼容组合正确渲染 |

### Sprint 3 · 8/24–9/4 — Editor + 桥接 + 线下确认闭环

| 工作 | 验收 |
|---|---|
| **线下确认状态机**（§6.2）：draft → confirmed（手动标记）→ 冻结只读；退回解冻；基于已确认稿创建新版本 | e2e 状态全流转；frozen_snapshot 完整落库 |
| Wizard 右栏 [顾客已确认] 按钮 + 二次确认弹窗（替代原 [发顾客确认]） | 标记后列表徽章变蓝、画布只读 |
| Editor 先行版接管：三栏布局 + 上下文属性面板改造 | 选中对象驱动，无全参数铺开 |
| 基指同步 + 逐指解锁 + 主视觉指 + 全部重置 | e2e：一套十指 + 1 例外指 ≤ 3 次编辑 |
| 三层制造语义标注 + decoration 层禁透明度改造 | 图层文案与制造步骤映射可见 |
| Wizard → Editor 桥接（数据转化 + 不可逆警告） | 警告未完整展示不可进入；进入后 Wizard [修改] 失效 |
| 3D 单甲检查：ArcballControls + 线框/实体切换 + 固定侧视机位（热力图/壁厚 Mock） | 3D 视图不可编辑（红线回归） |
| **编辑白名单落地（v1.2.0）**：Recipe editable_whitelist 驱动 Wizard 参数面板；生产规则校验提示（高度/边缘/密度） | 白名单外参数不可编辑；风险提示可读 |
| **后端**：预览 Pipeline 骨架（resvg + Pillow + 缓存）联调准备 | `GET /api/templates` 返回 index.json 内容 |

### Sprint 4 · 9/7–9/18 — 打磨 + 内容补齐 + 视觉回归

- L4 补齐（进阶模式）：图片导入/贴花、法式线工具、文字沿弧贴合；浮雕工具（参数化 2.5D + 剖面函数）；
- 预览加载骨架屏、单指失败降级走查；设计列表筛选与性能；
- 视觉回归测试全量（24 甲型长度轮廓 × Back 唯一视图 × 模板/配方截图基线）；
- 前端十指预览从本地 Mock 渲染切换至后端 Pipeline 演练（UI 零改动验证）；确认卡后端权威渲染同构验证；
- 既有 37 条 e2e 全绿 + 新增 e2e（状态机/Wizard 门禁/桥接警告/参数级例外/风格映射排序各 ≥1 条）。

### Sprint 5 · 9/21–9/30 — 异常验证 + 验收发布

- 异常场景走查（渲染失败/保存失败/并发冲突/Token 过期），错误文案符合「出了什么事 + 现在怎么办」；
- 指标实测：Wizard 全流程 ≤10 分钟 + Top 3 确认卡 ≤3 分钟（3 名内部用户走查计时）；
- P0 红线审查（§9 全表）；P0 Bug = 0，P1 < 5；
- `v1.0.0-mock` tag + Release Notes + 内部验收。

---

## 6.1 数据模型要点（localStorage envelope）

- **DesignSummary**：`status` 状态枚举（见 §6.2）、`finger_overrides`（Wizard 参数级逐指例外）；
- **ProjectV3 envelope 不动**：桥接仅提前 `customerId`/`appliedLookId` 填写时机；数据桥（画布键 + 2s 轮询 + 跨标签 rehydrate）不改；
- **Customer**：软删除（`deleted`）、隐私同意时间戳、Twin 三态 Mock；
- **Device**：`device_code` 绑定、三态在线状态；扫描仪永不同步 MES（后端语义，前端仅展示）。

## 6.2 确认状态机（线下场景简化版，v1.1.0 修订；v1.2.0 扩展冻结快照）

> **决策**：顾客确认发生在美甲店线下（顾客在场，看屏幕或导出图，口头确认）。线上确认功能（H5 确认页 / 确认链接 / 逐指留言 / 双通道）**全部砍掉**。

```
draft（草稿，编辑中）
  → confirmed（美甲师手动标记「顾客已确认」→ 冻结只读）   ← 唯一确认动作
  → submitted（提交生产，Sprint 2+ / 后端就绪后）
旁支：completed / exported / archived（沿用现有）
```

交互规则：

- Wizard STEP 2 右栏 [顾客已确认] 与 Editor 顶栏均有入口；点击 → 二次确认弹窗：「顾客已在店内确认该方案？确认后设计将冻结，不可再编辑。」→ [标记已确认] [取消]；
- `confirmed`：工程冻结，画布只读；改动需「基于已确认设计创建新版本」（生成副本 draft，原确认记录保留）；
- 顾客线下反悔 → [退回草稿] 解冻（列表页操作，留确认弹窗）；
- 数据模型（v1.2.0 扩展）：

```jsonc
confirmation: {
  confirmedAt, confirmedBy,
  frozen_snapshot: {                 // 确认时刻永久冻结，随订单可追溯
    recipe_id, recipe_version,
    asset_versions,                  // 各组件/材质版本
    shape_length, scan_profile,      // 或「标准尺寸」标记
    user_overrides,                  // 白名单参数覆盖值
    renderer_version
  }
}
```

- **模板或组件更新不得覆盖已确认订单的视觉与生产记录**——渲染已确认设计时使用 frozen_snapshot 锁定的资产版本；
- 列表页状态筛选与徽章：draft 灰 / confirmed 蓝 / submitted 深蓝；
- 导出 PNG 保留——它是线下确认的展示载体（给顾客看/打印），不是线上发送。

**明确砍掉（不再出现在任何 UI 与数据模型中）：** H5 确认页、确认链接生成、逐指留言、`pending_confirm` / `frozen` 状态、`channel: "png"|"h5"` 字段。

---

## 7. 接口层预留（后端就绪后零改动切换）

- 所有异步数据源（客户/设计/Twin/设备/模板/预览渲染）收敛到 `mock/` 注入面板后的 repository 接口；Mock 与真实 API 实现同一接口；
- 模板与预览优先切换：`GET /api/templates`（index.json 内容 + shape 排序/tag 筛选）→ `POST /api/preview/generate`（§5.7 Pipeline）；
- 对齐后端 38 端点域划分（认证 4/门店 4/店员 4/客户 5/Twin 3/设备 6/设计 6/冻结+M 端 7）；
- 能力匹配四级状态、P0 风险筛查为 Pipeline 前置占位，UI 位置在接真实 Pipeline 后不变；
- **Recipe + Production Profile 为 Studio 与打印系统的正式接口**（v1.2.0 确认），与后端 `ProductionRecipeBundle`（九类字段）对齐，冻结链路不变。

---

## 8. 测试策略

| 层 | 内容 |
|---|---|
| 单元（Vitest） | 状态机流转、桥接数据转化、NailSlot 变换计算、shape-params 生成器（v2 剖面模型）、风格映射排序规则（三档 + 缺 reason 拒绝入库） |
| e2e（Playwright） | 既有 37 条不破坏；新增：注册登录、客户 CRUD、配网异常、Wizard 全流程、风格映射排序与不建议仍可选、线下确认闭环（含 frozen_snapshot）、桥接警告、逐指例外、3D 检查只读 |
| 视觉回归 | 24 甲型长度轮廓 × Back 唯一视图 × 模板/配方渲染截图基线（资产变更必跑）；甲型几何变更另跑 §4.3 校准工作流（contact sheet 比对） |
| 素材入库 | §5.8 检查清单 6 项自动化（CI 强制） |
| 走查 | 十分钟/三分钟指标实测；文案红线审查；Mock 标识齐全 |

---

## 9. 风险与红线（每次评审必查）

| 项 | 规则 |
|---|---|
| 文案红线 | 风险界面固定 `P0 RISK SCREEN · MOCK`；UI 禁止出现 "Manufacturing passed / Ready to manufacture / Production approved" |
| 浮雕高度 | uv25d 路由硬限制 0.05–0.30mm（UV 喷绘阴影 P0 风险规避）；relief 路由上限由 Production Profile 声明（水滴 ≤1mm / 花瓣 ≤0.7mm），前端不暴露自由高度 |
| 预览=打印 | 前端轮廓/坐标/占位只认 `shape-params.json`；几何实现只认 `nails-shape-svg` skill 脚本；禁止第二参数源/第二几何实现 |
| 3D 只读 | 3D 视图任何编辑能力视为红线 Bug |
| 导出边界 | 原型期 PNG 唯一导出；STL 不暴露给用户 |
| 线下确认 | 不得复活任何线上确认功能（H5/链接/留言），除非用户明确改需求 |
| 确认快照冻结 | 已确认订单按 frozen_snapshot 渲染；模板/组件更新不得影响历史确认版本 |
| 不建议≠禁止 | not_recommended 模板必须可选；无 reason 的不建议关系禁止入库 |
| 编辑白名单 | 首发不开放自由手绘/任意上传/无限变换；白名单外参数不得出现在 Wizard 编辑面板 |
| 否决清单 | PRD §19 共 11 项（displacement 映射/多色 3MF/3D 手模/矩形画布/iPad 布局/门店信息管理等）一律不做 |
| 最大技术不确定性 | UV 喷绘 × 高浮雕阴影区 → 等算法组喷绘路径算法突破，前端不提前暴露自由高度 |

---

## 10. 里程碑对齐（P ↔ M ↔ 算法）

| 日期 | 节点 | 本计划对应 |
|---|---|---|
| 7/24 | 甲型 v2 曲线 + skill 交付 | nails-shape-svg skill 封装；24 轮廓 + 60 图案按新几何重生成（v1.2.1，✅ 已完成） |
| 7/27 | 素材数据定稿 + Phase 0 | index.json + palette + finishes；style-compatibility-matrix + 四份 Schema + editing-policy |
| 7/31 | Sprint 2 评审 | Sprint 1 基础平台 + 资产管线 P0 演示 |
| 8/7 | M-I1 建模工艺包 | Wizard 渲染器可用，DesignDocument Mock 样例就绪 |
| 8/21 | M-I2 LCD 设备 | Wizard 全流程（含风格映射 + Top 3 配方）可走通 |
| 9/4 | M-I3 喷绘/点胶 | Editor + 线下确认闭环 + 桥接完成；预览 Pipeline 骨架就绪 |
| 9/30 | M-I5 验收发布 | `v1.0.0-mock` 发布，十分钟/三分钟指标达成 |

---

## 附录 · 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| 1.0.0 | 2026-07-23 | 初版：以 Studio-PRD-0723 为主依据成稿；新增 §3 设计系统与 §4 视觉资产管线专项 |
| 1.1.0 | 2026-07-23 | ① 砍掉线上顾客确认，状态机简化为线下手动标记；② 新增 §5 甲型×风格映射模型与 material-library 素材存储、后端预览 Pipeline |
| 1.2.0 | 2026-07-24 | 依据 0724 备忘录：新增 §5.9 组件化配方架构（Component/Recipe/Production Profile + Top 3 首发 + 12 有效组合 + 编辑白名单）；确认快照 frozen_snapshot；确认卡后端权威渲染；指标收紧 3 分钟；Editor 降为进阶模式 |
| 1.2.1 | 2026-07-24 | ① §4.3 甲型曲线模型升级 v2（宽度剖面驱动 + Catmull-Rom，弧度饱满，对照 4 张专业图谱 4 轮校准）；② 新增 `nails-shape-svg` skill 封装为几何单一事实源（项目生成器降为薄封装）；③ §4.8/§8/§9 同步：contact sheet 校准工作流与「禁止第二几何实现」红线；24 轮廓 + 60 图案已按新几何重生成并 PASS |
| 1.3.0 | 2026-07-24 | ① Wizard MVP 收敛 almond 单甲型，其余 5 甲型置灰禁用（§5.10）；② 新增风格推荐弹窗（YouTube 封面大卡 × Top 3，manifest 驱动，选用自动应用映射模板，wizard-store 增 styleId/styleName/stylePrompted）；③ almond v3 曲线原型校准中（cuticle seat 分段 Bézier，未签收，不覆盖 v2 资产）；e2e 冒烟更新适配弹窗 |
| 1.4.0 | 2026-07-27 | ① NailSlot V2 重标定并人工签收（back-v2.1.0，修复旧标定 10/10 偏移 + 中轴不平行；覆盖图逐指放大验收）；② 新增共享渲染模块 `src/studio/render/`，Wizard Back 切换 V2 plate+仿射路径（V2 域废止 nailScale），Palm 保留 legacy 降级，双路径共享 FingerNailContent；③ 契约层落地（§5.11：DesignSet/四模式/状态分离/双输出类型 + Petal Veil 六层配方数据契约）；④ e2e 扩展至 17/17（V2 渲染断言 + 单指覆写流程） |
| 1.4.1 | 2026-07-27 | ① **Palm 掌心视图软删除**（MVP 收敛，对 PRD §12.4 双视图的显式偏离）：Wizard 砍切换器固定 Back，TenFingerPreview 移除 view prop 与 legacy 渲染分支；② `nailScale`/`PX_PER_MM`/`HAND_VIEWBOX`/`loadHandView` 彻底退役；③ legacy 资产（hand-{back,palm}.svg、slots.{back,palm}.json、hands/manifest.json）标注 archived 保留不删，Palm 复活须走 V2 标定；④ e2e 17/17 + validate PASS 回归 |
| 1.5.0 | 2026-07-27 | ① Liquid Velvet Cat-eye 与 Petal Veil French 独立正式模板落地（各 6 甲型 SVG + 缩略图，Liquid 推荐封面由 MOCK 升 REAL）；② 新增「当下流行」第七标签并完成 Top 1/2 新模板映射；③ Recipe 契约扩为 Petal v0.2.0 六层 + Liquid v0.1.0 五层及编辑域，明确 SVG 已消费而 Recipe renderer 未消费；④ 模板库升级为 12 模板/72 SVG，单模板生成与无 Pillow 降级可用，validate/build/browser 实测通过；⑤ Back-only 文档一致性收口与甲型×风格 P0/P1/P2 交互方向入计划 |
| 1.5.1 | 2026-07-27 | ① 侧栏收起/折叠（240⇄56px，持久化）；② Wizard STEP 2 三栏宽度重分配 300→440 左栏（风格标签 + 图文卡片可读性）；③ Mock 面板升级为调试面板：场景 Mock / 元素 ID（data-debug-id 全路由 20 处 + 一键复制）/ 需求说明（page-requirements.ts 全 13 条路由 + 404 覆盖，模块详情弹窗）三 tab；④ e2e 17/17 + 视觉自检 ×3 通过 |
