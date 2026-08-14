# RENDER-v0.7.2-01B.3｜单指完整取景与十指导航修复

## 问题

- v3 CanonicalGeometry 接入后，单指 PBR 仍使用固定世界坐标相机；部分视口只显示甲面的局部区域。
- 进入“单指聚焦”后没有十指切换入口，只能返回十指总览重新选指。

## 修复

- 相机根据已校验 GLB 的实际 `Box3` / bounding sphere、视口宽高比和当前观察方向重新计算距离、near/far 与 target。
- ResizeObserver 和观察角度切换统一复用 bounds-aware framing，不再复用旧平板的固定 Z/中心假设。
- 单指模式顶部新增十指切换条；L1–R5 可直接切换，当前指状态明确，窄屏内部横向滚动。
- 所有操作保持只读，不写 EditorDoc、revision、history 或浏览器持久化。

## 验收

- 1440×900：依次切换十指；每指 PBR canvas 完整装载；五个相机预设 coverage 为 `0.4975–0.8541 ≤ 0.94`。
- 390×844：单指完整可见；十指切换条内部滚动；触控目标不小于 44px；页面无水平溢出。
- Canvas 与宿主尺寸一致（仅保留 1px border 差异）。
- `writerZero=true`；console error / pageerror 均为 0。

## 门禁

- `npm run typecheck`：PASS
- `npm run test:render-v0-7-2-single-nail`：PASS
- `npm run test:editor-v7-customer-preview`：PASS
- `npm run test:render-v0-7-2-single-nail-navigation:e2e`：PASS
- `git diff --check`：PASS

## 外部复核状态

- 已按要求调用 Cursor Grok 4.6 review mode。
- Runner 返回空输出并以 exit 22 结束；调用前后 Git 状态一致，没有文件被外部 worker 修改。
- 本次调用不构成 Grok 批准；在获得有效 Grok 结论前，不把该外部审查项标为 PASS。

## 证据边界

本修复只解决产品预览的取景与导航。PBR、C 弧、vertical preview thickness 和材质投影仍为模拟预览，不构成佩戴、材料、制造或设备验证。
