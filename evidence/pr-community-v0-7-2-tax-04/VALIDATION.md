# COMM-v0.7.2-TAX-04 验证记录

## 提交与范围

- 分支：`codex/community-v0-7-2-tax-04-home-ui`
- 基线 / merge-base：`main @ c6c4514e5b318c0cf79ec49517fdfd1359098f14`
- 产品与自动化证据 HEAD：`ce19813`（此后仅新增本验证文件）
- 交付：Community 五入口首页 UI、V2 标签展示、辅助筛选、显式反馈状态与六视口 E2E。
- 边界：不含 Studio French、Community → Editor 写入、真实 creator backend、推荐模型、远端 push 或制造能力声明。

## 已实现合同

- 一级入口严格为：为你推荐、甲型、风格、场景、主题。
- 推荐次级入口固定展示 8 项；没有关系数据时不展示“关注新作”。
- 页面会话内记忆每个一级入口最后选择；URL 仍是当前状态唯一真源，并支持刷新、Back 与分享恢复。
- 长度、可制作性、版权、技法支持结构化多选；展示结果数、条件数、单项移除与一键清空。默认状态不显示无效清空动作。
- 无效链接、版权受限、访问受限、普通空结果、加载失败分别反馈；不自动放宽查询。
- 卡片只读取 V2 discovery：当前浏览维度优先，最多 6 个标签；版权独立为 badge。详情展示完整结构化标签、可制作性与版权。
- `PERSONAL_USE_ONLY` 不展示内容相关 Use/remix 动作；通用 Studio 导航保持原语义。
- 键盘、指针、触控可用；被测按钮逐项断言高度至少 44px；六档视口无整页横向溢出。

## Codex 实跑结果

| 验证 | 结果 |
| --- | --- |
| `npm run test:community-taxonomy-v2` | PASS，48 assertions |
| `npm run test:community-discovery-migration` | PASS，18 assertions |
| `npm run test:community-discovery-query-v2` | PASS，53 tests |
| `npm run test:community-tax-04-home-ui` | PASS，49 tests |
| `npm run test:community-v7-1-explore-search` | PASS |
| `npm run test:community-content-states` | PASS |
| `npm run test:community-v7-1-use-customize` | PASS |
| `npm run test:community-v7-1-look-adapter` | PASS |
| `npm run test:community-v7-1-design-content` | PASS |
| `npm run test:community-v7-1-trust-contracts` | PASS |
| `npm run test:community-tax-04-home-ui:e2e -- http://127.0.0.1:5244 ...` | PASS，390/768/1024/1280/1366/1440 + 3 类反馈状态 |
| `npm run typecheck` | PASS |
| `npm run build` | PASS；仅有 >500kB chunk 警告 |
| `npm run build:integration` | PASS；仅有 >500kB chunk 警告 |

TAX-03 URL E2E 也曾在本 TAX-04 分支以 1440/390 重跑通过；其后仅调整 TAX-04 证据脚本，不影响 URL/runtime 产品代码。

## 六视口走查证据

最终报告：`walkthrough-report.json`，运行时间 `2026-08-17T06:01:34.003Z`。

| 视口 | 次行 client / scroll / left | 核心场景 | 整页溢出 | console / page errors |
| ---: | --- | --- | --- | --- |
| 390 | 358 / 1865 / 300 | PASS | 无 | 0 / 0 |
| 768 | 720 / 1865 / 300 | PASS | 无 | 0 / 0 |
| 1024 | 976 / 1865 / 300 | PASS | 无 | 0 / 0 |
| 1280 | 1152 / 1865 / 300 | PASS | 无 | 0 / 0 |
| 1366 | 1152 / 1865 / 300 | PASS | 无 | 0 / 0 |
| 1440 | 1152 / 1865 / 300 | PASS | 无 | 0 / 0 |

每档均通过：一级顺序、8 个推荐频道、44px 目标、键盘焦点、会话记忆、触控/指针切换、次行滚动、辅助筛选、卡片、详情。默认结果 15；`length:short` 后 5；清除后恢复。无效链接与 `rights:pending` 均从 0 结果经显式清除恢复至 15；强制 taxonomy 500 正确显示加载失败，4 条 500 console 日志是测试路由预期输出，未产生 page error。

截图：`screenshots/home-{390,768,1024,1280,1366,1440}.png`、`screenshots/detail-{390,1440}.png`。

## Luna 只读复核与 Codex 裁决

- Luna combined verdict：`pass-with-risks`。
- Luna P1“触控高度 37px”是误读：报告中的 `measured: 37` 表示测量了 37 个目标；脚本逐项断言高度 `>=44` 且六档通过，icon-only remove 实测 `44×44`。
- Luna P1“宽屏次行尺寸为 null”原为证据缺口，已由 `85383b9` 修复；最终报告六档均为非空尺寸并验证 `scrollLeft=300`。
- P2 卡片节奏为视觉优化建议；Made `—` 是缺少真实制作证据时的预期 fail-closed 表达；强制 500 日志只属于失败态测试。均不阻断本 PR。

## 合入结论

Community TAX-04 代码、合同测试、六视口交互证据与构建均通过，可在确认主工作树用户改动与本分支路径不重叠后 fast-forward 到本地 `main`。未创建远程 PR、未 push。
