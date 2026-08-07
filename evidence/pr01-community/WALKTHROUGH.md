# PR-01 Community 人工走查矩阵

Dev server: `http://127.0.0.1:5204`
Date: 2026-08-06

| 路径 | 1280×720 | 1440×900 | 390×844 | 结果 |
|---|---|---|---|---|
| Dashboard → Community | PASS | PASS（同布局） | PASS（卡片/侧栏） | 入口卡 + 侧栏可用 |
| Wizard Step1 → Community | PASS | — | — | 顶栏 Community + 侧栏；客户弹窗不阻塞侧栏导航意图 |
| Wizard Step2 → Community | PASS（同顶栏） | — | — | 与 Step1 共用 WizardPage 顶栏入口 |
| Editor → Community | PASS | PASS | — | 侧栏 + EditorTopBar Community |
| Community → Dashboard | PASS | — | PASS | `community-enter-dashboard` |
| Community → Studio | PASS | — | PASS | `return_to` 为 Studio 路径时回 Wizard；Dashboard return 不会误进 Studio 按钮 |
| 直接深链 `/community` | PASS | PASS | PASS | 独立壳渲染 |
| `/community/content/:id` | PASS | — | — | Mercury Dew 详情 |
| 无效/草稿深链 | PASS | — | — | `community-content-missing`；草稿不泄漏 |
| 刷新 / 后退 / 前进 | PASS | — | — | 无白屏 |
| collapsed nav tooltip | PASS | — | N/A | 侧栏收起后 title 保留 |

## 截图证据

- `evidence/pr01-community/1280x720-dashboard.png`
- `evidence/pr01-community/390x844-dashboard.png`
- `evidence/pr01-community/1280x720-community-discover.png`
- `evidence/pr01-community/1280x720-content-mercury.png`
- `evidence/pr01-community/1280x720-draft-missing.png`
- `evidence/pr01-community/1280x720-wizard.png`
- `evidence/pr01-community/1440x900-editor-community-entry.png`
- `evidence/pr01-community/390x844-community-discover.png`
- `evidence/pr01-community/DEEP_LINKS.md`

## Console / runtime

- 未观察到持续重复的严重 console error 或 unhandled rejection（浏览器 QA 期间）。
- Playwright 全量截图脚本因 Chromium 下载卡住未完成；本地浏览器走查已覆盖主路径。

## 检查项

- 无水平溢出：1280 / 390 实测 `scrollWidth <= clientWidth`
- 主 CTA 可见：Dashboard / 进入 Studio / Community 入口
- 移动端菜单与进入 Studio 可操作
- 新交互具备键盘焦点样式（content card `focus-visible`）

## Review follow-up

- `build:integration` 产物预览 `/community/creators`：7 张认证创作者 Demo 卡片。
- Wizard 上下文进入 Community，切换 Official 后仍保留 `entry`、`return_to`、`shape`、`length`。
- 上述场景点击“进入 Studio”返回 `/design/new?fresh=1`。
- Dashboard 1280×720：`scrollWidth = clientWidth = 1280`。
- Dashboard 390×844：`scrollWidth = clientWidth = 390`，Community 入口可见。
