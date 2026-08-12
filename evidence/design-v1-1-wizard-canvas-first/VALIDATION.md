# Wizard Canvas-first 响应式验收

状态：六断点自动几何与交互门禁通过。

## 自动验收

```bash
npm run test:wizard-canvas-first
npm run test:wizard-canvas-first:e2e -- http://127.0.0.1:5236
```

E2E 会输出：

- `walkthrough-report.json`：六个断点的 Sidebar、Library、Preview、Inspector、Preflight 实际矩形和焦点生命周期。
- `screenshots/*-wizard-canvas-first.png`：1440、1366、1280、1024、768、390 的首屏证据。

## 阻塞门禁

| 视口 | 模式 | Preview 最小宽度 | 面板规则 |
|---:|---|---:|---|
| 1440×900 | Full | 720px | 280px Library、300px Inspector 常驻 |
| 1366×768 | Compact | 680px | 220px Library、220px Inspector 常驻 |
| 1280×800 | Compact | 680px | 220px Library、220px Inspector 常驻 |
| 1024×768 | Focus | 680px | Library Drawer、220px Inspector 常驻 |
| 768×1024 | Tablet | 640px | Library/Inspector 均为互斥浮层 |
| 390×844 | Tablet | 300px | Library/Inspector 均为互斥浮层 |

实测结果：

| 视口 | 模式 | Rail | Library | Preview | Inspector | Handoff |
|---:|---|---:|---:|---:|---:|---:|
| 1440×900 | Full | 56px | 280px | 732×612px | 300px | 70px |
| 1366×768 | Compact | 56px | 220px | 798×480px | 220px | 70px |
| 1280×800 | Compact | 56px | 220px | 712×512px | 220px | 70px |
| 1024×768 | Focus | 56px | Drawer | 688×480px | 220px | 70px |
| 768×1024 | Tablet | 56px | Drawer | 664×459.84px | Sheet | 70px |
| 390×844 | Tablet | 56px | Drawer | 310×558.25px | Sheet | 70px |

Studio Nav、Preflight、Library 和 Inspector Overlay 的 Preview 宽度变化实测均为 0px；Studio Nav Dialog 和各产品浮层的初始焦点、Tab/Shift+Tab 循环、Escape 关闭和 Trigger 焦点恢复均通过。

Overlay 挂载门禁：所有 Overlay 关闭时 DOM 内 `role="dialog"` 严格为 0；任何布局下 `studio.wizard.step2.params-panel` 最多 1 份。Full/Compact/Focus 的唯一实例归属常驻 Inspector；Tablet 打开 Inspector 并切到“参数”时唯一实例归属该 Overlay，关闭后重新归零。

Handoff 顺序实测：768px 为 Preview `y=150…609.84`、Handoff `y=621.84`；390px 为 Preview `y=210…768.25`、Handoff `y=774`。两个 Tablet 断点均先呈现 Canvas，再在底部呈现 sticky Handoff；1440/1366/1280/1024 的 Handoff 也全部位于 Preview 底边之后。

所有断点还必须满足：

- Wizard 路由将全局导航收为不超过 64px 的 Rail。
- 展开 Studio 导航时采用 Overlay，不改变 Preview 宽度；Escape 关闭并归还焦点。
- 展开 Studio 导航具有 `dialog`/modal/inert 语义，初始焦点位于导航内，Tab 与 Shift+Tab 均不可逃逸。
- 无页面级横向溢出；桌面无 document 级纵向滚动。
- 中央 Preview 宽于任一常驻支持栏的两倍。
- Drawer/Sheet 打开前后 Preview 宽度变化不超过 1px。
- Drawer/Sheet 初始焦点、Tab 循环、Escape 关闭、Trigger 焦点恢复全部通过。
- 768px 与 390px 的导航、浮层 Trigger、关闭按钮至少 44×44px。
- V7 预检收敛在 Handoff Bar：桌面不超过 72px、触控断点不超过 84px；兼容详情以 Overlay 打开且不推动 Canvas。
- 768px/390px 的 sticky Handoff 必须位于 Canvas 底边之后且不得覆盖 Canvas，不能以 `order-first` 抢占第一视觉；桌面 Handoff 同样位于 Canvas 下方。
- 关闭的 Overlay 必须从 DOM 卸载；禁止隐藏挂载导致 ParamsPanel、状态订阅或表单控件重复实例化。
- pageerror 和 console error 均为 0。

证据等级：UI/E2E 原型验收；不构成材料、制造或设备协议验证。

## 独立视觉复核

- Luna combined review 已按只读方式启动，但在限定等待时间内未形成最终 verdict，随后由主 agent 主动终止；不把该调用视为批准。
- Luna 中断前提出的可复现观察是：Tablet Handoff 原先位于 Canvas 之前，会削弱 Canvas-first 层级。生产代码已改为底部 sticky Handoff，并由 768/390 的顺序门禁和刷新截图闭环。
- 最终签收依据为独立测试 agent 的六断点 E2E、主 agent 对 1440/1024/768/390 截图的视觉复核、TypeScript/构建与关联业务回归。
