# 智能美甲 Studio · 开发说明（FRONTEND_MOCK）

> 证据级前端原型：React 18 + TypeScript + Vite + Tailwind + React Router v6 + Zustand。
> 不接任何真实后端；全部数据落 localStorage（envelope 包装，键前缀 `nail-studio:`）。

## 启动

```bash
npm install
npm run dev                 # 默认 5173
npm run dev -- --port 7100  # 指定端口（参数透传 Vite）
```

其他命令：

```bash
npm run build        # tsc -b && vite build（含静态素材拷贝进 dist/）
npm run typecheck    # 仅类型检查
node tools/e2e-smoke.mjs http://localhost:5173   # 最小 e2e 冒烟（需先起 dev server；依赖 devDependency playwright）
```

## 功能清单

| 模块 | 路由 | 功能 |
| --- | --- | --- |
| 登录/注册 | `/login` `/register` | 邮箱 + Mock 验证码（**固定 123456**）；首次登录自动流转注册（门店名 2–30 字符）；已登录访问 /login 自动回 Dashboard |
| Dashboard | `/` | 概览统计 + 首次配置引导（设备/客户/设计） |
| 客户 | `/customers` `/customers/new` `/customers/:id` | 列表/搜索/完整建档（隐私同意弹窗必选）/详情/编辑/软删除；历史设计只读消费设计键 |
| 设备绑定（MOCK IOT） | `/devices` `/devices/bind` `/devices/bind/mobile/:token` | 配网向导（5 分钟 TTL 会话恢复）、并发绑定锁、手机辅助配网 Token |
| Studio Wizard | `/design/new` | 客户选择器（含快速建档）→ STEP 1 甲型/长度门禁 → STEP 2 三栏画布：模板库（甲型×风格三档排序）+ 十指预览（Back/Palm 双视图）+ 参数面板（底色/质感/逐指例外）；2s/3s 防抖自动保存 + 手动保存 + 失败重试 3 次；[顾客已确认] 手动标记 → 冻结只读；导出预览 PNG |
| Studio Editor | `/design/canvas` | `?bridge=<id>` 桥接（先弹不可逆警告）/ `?blank=1` 空白新建 / `?design=<id>` 继续编辑或只读查看；2D 自由画布（画笔/橡皮/模板图案/文字/导入图/附件）、十指编排（解锁单指/主指）、完整 Undo/Redo、3D 单甲检查（只读）、P0 风险界面「P0 RISK SCREEN · MOCK」、导出 PNG |
| 我的设计 | `/design` | 卡片列表 + 状态筛选 + 状态机操作：继续编辑 / 只读查看 / 基于已确认创建新版本 / 退回草稿 / 复制 / 删除 |

### Wizard → Editor 桥接（PRD §15）

- Wizard STEP 2 底部 [打开自由画布]：等待进行中的自动保存落地 → `openBridge(designId)`。
- 首次桥接：Wizard 数据转化为 EditorDoc（模板实例化为可编辑 pattern 元素，base 层锁定）→ 跳转 `?bridge=` → Editor 侧完整展示不可逆警告后才可进入。
- 已桥接（EditorDoc 存在）：按钮变为「返回自由画布」，直达 `?design=` 续编，**不会**用 Wizard 数据覆盖 Editor 修改；同时 Wizard 顶栏 [修改]（甲型/长度）置灰失效。
- 设计列表打开无 EditorDoc 的 Wizard 设计时，自动经 `openBridge` 完成转化。

## Mock 说明

- **验证码固定 123456**；不发送邮件、不保存密码（页面有 MOCK 标注）。
- **Mock 场景注入面板**：仅 DEV 模式显示，右下角悬浮「MOCK 场景注入面板」，可注入渲染失败/单指降级/保存失败/加载超时/设备十类异常/会话过期/验证码异常/P0 风险强制告警/导出失败等场景；开关持久化在 localStorage（键 `nail-studio:mock.scenarios`），刷新后可复现。
- Twin 三态（MOCK_VALID / MOCK_LOW_CONFIDENCE / NO_DATA）为展示级 Mock，界面标 MOCK。
- 数据存储：localStorage envelope（`{ v, updatedAt, tabId, data }`），注册键集中在 `src/lib/storage.ts` 的 `StorageKeys`；领域类型唯一权威为 `src/lib/types.ts`。

## 纪律红线（本原型范围内）

- FRONTEND_MOCK 证据级，不接真实后端。
- 顾客确认只有美甲师手动标记「顾客已确认」→ 冻结只读；无任何线上确认功能。
- 3D 视图为只读检查。
- 风险界面固定名「P0 RISK SCREEN · MOCK」。
- PNG 为唯一导出形态。

## 已知限制

- 构建产物单 chunk ≈ 510 kB（未做代码分割，仅警告不阻断）。
- Wizard 每次进入 `/design/new` 都是全新设计会话，不恢复未保存的旧草稿（旧草稿请从「我的设计」继续编辑）。
- 桥接跳转采用 `location.assign` 整页跳转（数据已落 localStorage，无状态损失，但非 SPA 内跳转）。
- 登录守卫为页面级 hook（无全局路由守卫）；直接刷新受保护路由会先渲染一帧再跳 /login。
- 设备绑定、提交生产（submitted 之后流程）为 Mock/Sprint 2+ 占位。
- e2e 冒烟脚本（`tools/e2e-smoke.mjs`）覆盖主链路：登录→注册→新建客户→Wizard→模板→十指预览→保存→桥接警告→Editor→列表；未覆盖设备绑定与异常场景矩阵。
