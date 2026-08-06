# PR-02 Community → Studio Intent 人工走查矩阵

Dev server: `http://127.0.0.1:5205`  
Date: 2026-08-06  
Branch: `cursor/pr-02-community-studio-intent`  
Base: `integration/community-first-v6@4457826`

| 场景 | 1280×720 | 1440×900 | 390×844 | 结果 |
|---|---|---|---|---|
| tryable `cc_mercury_dew` → CTA「在 Studio 中试用」 | PASS | PASS（入口同） | PASS | Intent 发布 → `/design/new?communityIntent=` |
| clean 应用（无冲突） | PASS | — | — | 自动 `applyTemplate`；query 清除 |
| wizard_draft 冲突 Modal | PASS | — | — | apply current / start new / cancel |
| cancel → allowlisted `returnTo` | PASS | — | — | 回到内容详情 |
| start new | PASS | — | — | `resetForNewDesign` 后 apply |
| editor_doc 冲突（raw v3 seed） | PASS | — | — | 禁止静默覆盖；可选新建设计 |
| forged / missing intent deep link | PASS | — | — | Toast「试用意图已过期或不存在」；非白屏 |
| inspiration-only | PASS | — | — | 「灵感参考 · 不可直接试用」 |
| APPROXIMATE 无 assetRef（`cc_pearl_tide`） | PASS | — | — | 「缺少可应用资产，暂不可试用」 |
| refresh 内容页 | — | — | PASS | 无白屏 |
| overflow | — | — | PASS | `scrollWidth == clientWidth == 390`（见 `overflow-390.json`） |

## 截图证据

- `1280x720-content-try-cta.png` / `1280x720-content-tryable-mercury.png`
- `1280x720-wizard-after-try-intent.png` / `1280x720-after-first-apply.png` / `1280x720-intent-clean-applied.png`
- `1280x720-intent-wizard-draft-conflict.png`
- `1280x720-intent-cancel-return.png`
- `1280x720-intent-editor-doc-conflict.png`
- `1280x720-intent-start-new.png`
- `1280x720-forged-intent-toast.png`
- `1280x720-inspiration-not-tryable.png`
- `1280x720-approx-no-asset.png`
- `1440x900-wizard-intent-entry.png` / `1440x900-intent-conflict-modal.png`（早期入口；冲突以 1280 SPA 矩阵为准）
- `390x844-content-tryable.png` / `390x844-content-refresh.png`

## Console / runtime

- 走查期间未见持续重复的严重 console error / unhandled rejection。
- 偶发 404 资源请求记录于 `console-errors.json`（非阻断）。
- Playwright 使用系统 Chrome channel（bundled Chromium 未安装）。

## 门禁摘要

| 检查 | 结果 |
|---|---|
| `typecheck` | PASS |
| `build:integration` | PASS |
| `test:community-*`（content/domain/taxonomy/official/intent/studio-flow） | PASS |
| `test:handdraw` / `validate-assets` / `validate-recipes` | PASS |
| `git diff --check` | PASS |
| `test:slots` | 已知 L3：`rotationDeg=5.81`（阈值 `<5`）；本 PR 不改 Slot V2 |

## 边界确认

- Community 仅写 intent envelope；不 import Wizard/Editor store。
- Wizard 为唯一消费者；editor probe 只读 raw，不调用 `getEditorDoc()`。
- 无 EditorDocV6 / 推荐策略 / AGENTS.md / Slot 数据改动。
