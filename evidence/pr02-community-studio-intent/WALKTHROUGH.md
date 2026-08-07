# PR-02 Community → Studio Intent 人工走查矩阵（review fix）

Dev server: `http://127.0.0.1:5205`
Date: 2026-08-06
Branch: `cursor/pr-02-community-studio-intent`
Base: `integration/community-first-v6@4457826`

| 场景 | 1280×720 | 1440×900 | 390×844 | 结果 |
|---|---|---|---|---|
| tryable 详情 CTA | PASS | PASS（petal） | PASS | `community-try-in-studio` 可见可点 |
| clean apply | PASS | PASS | — | 自动 apply，query 清除 |
| wizard_draft 冲突 Modal | PASS | — | — | current / new / cancel |
| cancel → returnTo | PASS | — | — | 回内容详情 |
| start new | PASS | — | — | reset 后 apply |
| EditorDoc v3 冲突 | PASS | — | — | 禁止静默覆盖；见 `editor-conflict-v3.json` |
| EditorDoc v4 冲突 | PASS | — | — | unsupported → editor_doc |
| EditorDoc v5 冲突 | PASS | — | — | unsupported → editor_doc；见 `editor-conflict-v5.json` |
| Modal 打开后 TTL 过期再点 current | PASS | — | — | 不改 Wizard；toast + 回 Community |
| malformed Intent deep link | PASS | — | — | 安全清除并恢复；`malformed-intent.json` |
| forged Intent deep link | PASS | — | — | toast「过期或不存在」类提示 |
| inspiration-only | PASS | — | — | 不可试用文案 |
| APPROXIMATE 无 assetRef | PASS | — | — | 缺少资产文案 |
| refresh | — | — | PASS | 无白屏 |
| 横向溢出 | — | — | PASS | `scrollWidth=clientWidth=390` |
| 异步素材加载失败 | 行为测试 PASS | — | — | UI route abort 受模块缓存影响；`test:community-studio-flow` case 10 覆盖无 unhandled rejection / 无部分写入 |

## 截图与旁证

- `1280x720-content-try-cta.png`
- `1280x720-clean-apply.png`
- `1280x720-intent-wizard-draft-conflict.png`
- `1280x720-intent-cancel-return.png`
- `1280x720-intent-start-new.png`
- `1280x720-intent-editor-v3-conflict.png` + `editor-conflict-v3.json`
- `1280x720-intent-editor-v4-conflict.png`
- `1280x720-intent-editor-v5-conflict.png` + `editor-conflict-v5.json`
- `1280x720-intent-ttl-revalidate-fail.png`
- `1280x720-forged-intent-toast.png`
- `1280x720-malformed-intent-recover.png` + `malformed-intent.json`
- `1280x720-inspiration-not-tryable.png`
- `1280x720-approx-no-asset.png`
- `1280x720-async-load-fail-recover.png` + `async-load-fail.json`
- `1440x900-content-try-cta.png`
- `1440x900-wizard-after-try.png`
- `390x844-content-tryable.png`
- `390x844-content-refresh.png`
- `overflow-390.json`
- `console-network-report.json`
- `network-404-investigation.json`

说明：v3/v4/v5 冲突 Modal 文案相同（均为 `editor_doc`）；以 sidecar JSON 记录 seed 的 `schemaVersion`，不以截图像素差作为版本证明。

## Console / network

- **pageerror / unhandled rejection**：走查期间 0。
- **console error**：曾出现 `favicon.ico` 404（浏览器默认请求）。已在 `index.html` 增加 data-URI icon，消除该请求。
- **failed network**：偶发 `fonts.gstatic.com` Inter woff2 `ERR_ABORTED`（外部字体，非产品资产路径；页面仍可用）。
- 详见 `network-404-investigation.json`、`console-network-report.json`。

## 门禁（本轮 review fix）

| 检查 | 结果 |
|---|---|
| `git diff --check`（工作区） | PASS（修复 trailing whitespace 后） |
| `typecheck` | PASS |
| `build:integration` | PASS |
| `test:community-*`（含 intent / studio-flow 行为） | PASS |
| `test:handdraw` / `validate-assets` / `validate-recipes` | PASS |
| `test:slots` | 已知基线 L3 `rotationDeg=5.81 > 5`；未改 Slot V2 |

## 边界确认

- Community 只写 Intent envelope；Wizard 消费前二次 `validateStudioImportIntent`。
- Editor probe 与 migrator 共享 `EDITOR_DOC_MIGRATABLE_MAX_VERSION=3`。
- 无 EditorDocV6 / 推荐策略 / Slot 数据 / AGENTS.md 改动。
