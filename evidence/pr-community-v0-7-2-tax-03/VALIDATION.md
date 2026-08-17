# COMM-v0.7.2-TAX-03 验证记录（VALIDATION）

## 1. 提交与分支信息

- 分支：`codex/community-v0-7-2-tax-03-filter-runtime`
- 基线：`main` / merge-base `3fd66dd044735d8bcc70a49e5a4cd827d3831d5b`
- 验证 HEAD：`4210fa9eac1ca13fa433f9897b5ac994f1582c9d`
- 工作树：本地分支，仅限本地，未 push；无远程 PR。

## 2. 任务范围

- 规范化的 browse/topic/length/makeability/rights/technique URL 合同。
- 显式旧别名（legacy aliases）兼容，含 `style=ST-02 -> technique:french` 标记。
- 严格的不兼容空结果（strict incompatible empty result）。
- 治理优先的执行器（governance-first executor）。
- 仅接受 V2 版本 `q` 参数。
- 确定性推荐回退（deterministic recommendation fallback）。
- 运行时辅助过滤器（runtime auxiliary filters）。
- URL 刷新 / 返回（Back）/ 分享。
- 锁定数据源（locked source）。
- 明确不含 TAX-04 的主五项 / 卡片改版（primary five-entry/card redesign）。

## 3. 测试与验证结果

### 3.1 自动化测试（全部通过）

- `test:community-taxonomy-v2` — PASS，48 条断言
- `test:community-discovery-migration` — PASS，18 条断言
- `test:community-discovery-query-v2` — PASS，53 个测试
- `test:community-v7-1-explore-search` — PASS，devLooks=17，prodLooks=10
- `test:community-discovery-query-v2:e2e` — PASS，于 1440x900 与 390x844 视口覆盖：
  - French 标记移除 + Back
  - 混合 CSV fail-closed / preserve / remove + Back
  - 兼容的 refresh / share / OR / AND / Back
  - 锁定数据源无累积（locked source no accumulation）
  - 零 console/page 错误，无页面溢出（no page overflow）

### 3.2 类型检查 / 构建（受基线阻断，非本任务引入）

`typecheck`、`build`、`build:integration` 仅被同五个既有几何诊断阻断：

- 缺失 `three-bvh-csg`；
- 缺失 `manifold-3d` 导入 x2；
- `current-kernel/manifold-kernel/surface-boolean` 中两个下游隐式 any 回调。

已核对：本次改动涉及的 Community 文件无任何诊断。以上三个门禁不判定为 PASS，仅记录阻断来源为既有基线问题、与本任务无关。

### 3.3 只读兼容性评审

- 修复前的 Claude 只读兼容性评审发现：P1 URL 累积问题、P2 标记/移除问题。
- 均已通过纯幂等辅助函数（pure idempotent helpers）+ 测试修复。
- 修复后评审：无剩余合并相关的 P0–P2。
- 已知非阻断缺口：topic 标记移除分支未经浏览器直接测试（not directly browser-tested）。

## 4. 完成边界

- 本地分支提交，未 push，无远程 PR。
- 不含 Studio French 改动。
- 不含 Community -> Editor 写入。
- 不含后端改动。
- 不含推荐模型改动。
- 不构成任何制造有效性声明。

## 5. 合入建议

TAX-03 代码与证据可接受本地 fast-forward 合入：任务范围内的全部测试与 E2E 通过；被阻断的构建诊断已证明为既有基线 / 范围外问题。合入时保留阻断披露（blocker disclosure）。

## 6. 变更文件清单

本分支相对 `main` 共七个 diff 路径：

1. `package.json`
2. `src/community/components/CommunityDiscoveryRuntimeFilters.tsx`
3. `src/community/components/CommunityFeed.tsx`
4. `src/community/domain/taxonomy-v2/discovery-query.ts`
5. `tools/test-community-discovery-query-v2.mjs`
6. `tools/test-community-v7-1-explore-search.mjs`
7. `tools/walkthrough-community-tax-03-filter-runtime.mjs`

外加本证据文件：

8. `evidence/pr-community-v0-7-2-tax-03/VALIDATION.md`

## 7. 证据等级

本记录基于实际执行的测试与 git 状态，证据等级：integrated（自动化测试 + E2E 走查）；构建门禁因基线诊断未判定 PASS，已如实披露。无截图、无伪造时间戳、无伪造构建成功记录。
