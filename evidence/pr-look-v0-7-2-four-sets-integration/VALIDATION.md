# PR｜四套 v0.7.2 Look 的 Community → Editor V7 接入验收

## Git 与范围

- Branch: `codex/look-v0-7-2-four-sets-integration`
- Base: `307608a3f302fe13980fddee4436d1efa10c2faf`
- 架构基线：`v0.7.2`
- 文档合同：`EditorDoc schemaVersion: 7`
- 范围：把四套已生成 Look 资产注册为 Community PublishedLook/DesignRelease，并通过 Versioned Intent 新建独立 EditorDocV7 Remix。

## 端到端结果

| Look | 视口 | 十指 | 平面 | 表面效果 | 立体 | 封层 |
|---|---:|---:|---:|---:|---:|---:|
| 鎏金豹纹裸粉 | 390×844 | 10 | 10 | 0 | 3 | 10 |
| 绯红圣物 | 1280×800 | 10 | 8 | 0 | 6 | 10 |
| 象牙蕾丝晶露 | 1440×900 | 10 | 10 | 0 | 8 | 10 |
| 蜂蜜玻璃花瓣 | 1024×768 | 10 | 6 | 4 | 4 | 10 |

每个用例均验证：Community 详情页、真实新标签 Studio handoff、Versioned Intent、选择“新建设计”、Editor V7 打开、十指 canonical 数据、Community source provenance、立体工具与元素标签。`walkthrough-report.json` 中四条 `errors` 均为空。

## 自动门禁

- `npm run typecheck`：PASS
- `npm run build:integration`：PASS；仅既有大 chunk warning
- `npm run test:look-v0-7-2-four-sets`：PASS；生成器 byte-identical
- `npm run test:look-v0-7-2-four-sets-integration`：PASS
- `npm run test:community-content`：PASS
- `npm run test:community-domain`：PASS
- `npm run test:community-v7-1-use-customize`：PASS
- `npm run test:editor-v7-dimensional-decoration`：PASS
- `npm run test:editor-v7-runtime`：PASS
- `npm run validate-assets`：PASS
- `npm run test:render-v0-7-2-texture-assets`：PASS
- `npm run test:geo-v0-7-2-registry-v2`：PASS
- `npm run test:geo-v0-7-2-surface-boolean`：PASS
- `npm run test:geo-v0-7-2-surface-boolean-bundle`：PASS
- `git diff --check`：PASS
- `npm run walkthrough:look-v0-7-2-four-sets-integration`：PASS

## 证据边界

- Community 封面：AI 生成的高保真视觉候选，用于 Look 识别和设计师试用。
- Editor：结构化、可编辑、可持久化的 EditorDocV7；不是把封面图当作设计真源。
- GLB 与 2.5D：`SIMULATED_PREVIEW_REPRESENTATION` / `APPROXIMATE`，只证明浏览器预览和图层映射。
- 当前不证明真实材质、佩戴贴合、制造工艺、设备协议或可生产性。
- STL 不进入四套 Look 的 Community/Editor 交付，也没有制造或下载入口。

## 人工走查证据

- 报告：`walkthrough-report.json`
- 截图：`screenshots/`，每套包含 Community 详情、Editor 背景/平面入口与立体装饰入口。
