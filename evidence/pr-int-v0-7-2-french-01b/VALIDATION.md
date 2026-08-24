# INT-v0.7.2-FRENCH-01B｜显式 Use → French UI/E2E 验证

- 验证日期：2026-08-24
- 父提交：`ae9075b07b4adcd1a829d62370079ae1f1318c5e`
- 状态：`READY (branch) / prototype`
- 物理/制造验证：`false`

## 本提交证明什么

- canonical Community Look 的 `discovery.techniqueIds` 明确包含 `technique:french` 时，Versioned Import 与 Editor 显示法式技法提示。
- 提示只提供“打开法式工具”动作；打开工具保持 writer-zero，只有用户明确选择 preset 与 scope 后才原子创建结构化 `french-edge@1.0.0`。
- 保存、刷新重开及顾客只读预览保留来源、十指 geometry 和结构化 recipe；顾客预览保持 writer-zero。
- Legacy `USE_LEGACY_APPROXIMATE` 路径只从受治理的 discovery 显示法式提示，不从标题、旧标签或画面猜测，也不创建 EditorDocV7 recipe。

## 浏览器验收

命令：

```bash
npm run test:int-v0-7-2-french-use:e2e
```

结果：PASS。

- canonical：390、768、1024、1280、1366、1440 px；移动端使用 touch，桌面端使用 pointer。
- Legacy：1280 px，`cc_petal_veil` → `USE_LEGACY_APPROXIMATE` → Wizard 显式法式提示。
- canonical 每个 viewport 均验证：preflight writer-zero、打开工具 writer-zero、明确创建恰好 `revision +1 / history +1`、recipe revision `1.0.0`、十指 geometry 不变、保存重开、顾客预览 writer-zero、无 console error、无整页横向溢出。
- 证据：`walkthrough-report.json` 与 `screenshots/`。

第一次从受限沙箱启动 Playwright Chromium 时，被 macOS Mach port 权限拒绝；在获授权的本地浏览器测试环境重跑后通过。该次失败属于执行环境，不是产品断言失败。

## 明确边界

- 不自动推断 preset、style、makeability 或 manufacturing 状态。
- 不修改 `EditorDocV7`、`schemaVersion: 7` 或 Community intent V1/V2 exact-key 合同。
- 不把 Legacy 近似路径升级为 canonical Versioned Use。
- 本证据属于软件原型集成与视觉走查，不代表实物、打印、制造、生产或 Nail Expert 独立签收。
