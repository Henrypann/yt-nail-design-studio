# Week 0/1 合入评估：Origin Next 切片 → 本仓库（Vite 产品主干）

> 类型：**架构评估，不含实现**。本文不改 UI、不移植 Week 0 代码、不建议 merge。
> 评估分支：`cursor/week0-merge-eval-doc-179c`（自 `main` 切出，`main @ ee29736`；README 记录的代码基线为 `main @ 0df346f`，`ee29736` 仅为 README 提交）。
> 评估对象仓库：`https://github.com/Henrypann/yt-nail-design-studio`，即产品主干。
> `Henrypann/nextgen-beauty-tech` 为空 GitHub 占位仓库，按指令不作为合入目标，本文不再提及。
> 本文档变更范围：仅新增本文件，无任何代码或 UI diff。

---

## 0. 证据来源与缺口声明

### 0.1 本仓库侧：全部为一手代码事实

本文关于本仓库的每条判断都来自本次评估中实际读取的文件，路径与关键行号在正文标注。核对命令与结果：

| 核对项 | 命令 | 结果 |
|---|---|---|
| 远端与分支 | `git remote -v` / `git branch -a` | 单 remote `origin`，仅 `main` 一个分支 |
| 是否曾存在 Next 代码 | `git log --all --diff-filter=A --name-only -- 'next.config*' 'app/**' 'src/app/api/**'` | 零命中 |
| 是否有 Web 蓝牙 / USB 实现 | `rg -i 'navigator\.bluetooth\|navigator\.usb\|requestDevice\|WebUSB'` | 全仓零命中 |
| 技术栈 | `package.json` | Vite 5 + React 18 + `react-router-dom` 6 + Zustand 5；无 `next` 依赖 |
| 设备域体量 | `wc -l src/platform/devices/* src/app/pages/devices/*` | 9 文件，1272 行 |

### 0.2 Week 0/1 侧：合同依据，非代码依据（明确缺口）

**Week 0/1 的 Next.js App Router 代码不在本仓库，也不在本仓库任何可访问 remote 中。** 本次评估无法读取它的源文件。因此本文第 1 节与第 3 节中所有关于 Week 0 的内容，**唯一依据是任务 Prompt 中列出的冻结合同**（错误码集合、绑定路径、两跳绑定、Job fail-closed、iOS grouped 视觉规范）。

本文**不虚构** Week 0 的文件名、目录结构、行数、函数名或实现细节。凡涉及 Week 0 实现形态的判断，均标注为「按冻结合同推定」。这构成本评估的已知缺口：如需按文件粒度做移植清单，需要先把 Origin 切片以只读方式提供出来。

### 0.3 证据等级标注

| 结论 | 等级 |
|---|---|
| 本仓库现有设备绑定能力 | `prototype`（MOCK IOT，无任何真实传输） |
| 本仓库现有设计发布 / 顾客审批链路 | `integrated`（本地存储 + 合同校验 + 专项测试） |
| 本仓库现有 Job / 制造平面 | `planned`（零实现，仅两处休眠类型） |
| Week 0 冻结错误码与两跳绑定语义 | `architecture-golden`（合同已冻结，本仓库未实现） |
| 任何「可制造 / 生产可用」 | **不成立**，本文不做该等级断言 |

---

## 1. 为什么 Origin Next 提交不能以 git merge / cherry-pick 落到本 Vite 主干

结论：**不是「难以合并」，而是「不存在可合并的 git 关系，且即使强行接入也没有可编译的目标」。** 四层原因，按不可逾越程度排序。

### 1.1 无共同祖先：git 层面缺少合并所需的前提

本仓库 `git log --all` 只有一条 `main` 线，`origin` 只有 `main` 一个远端分支。Origin Next 切片是独立历史（Prompt 明确「different history — you cannot cherry-pick it」）。

`git merge` 需要可计算的 merge base；`git cherry-pick` 需要一个能应用到当前树的 patch。两者在这里都不成立：

- 无共同祖先 → 只能 `--allow-unrelated-histories`，那不是合并，是把两棵无关目录树叠在一起，冲突解决没有语义依据。
- Origin 切片的 patch 路径（App Router 目录布局）在本仓库不存在任何对应路径 → cherry-pick 只会产出「新增一整棵陌生目录」，而不是修改现有模块。

### 1.2 运行时与路由模型不兼容：目标位置根本不存在

| 维度 | 本仓库 | Week 0 Next 切片（按冻结合同推定） |
|---|---|---|
| 构建 | Vite 5（`vite.config.ts`，`tsc -b && vite build`） | Next 构建管线 |
| 路由 | 客户端 `createBrowserRouter`，路由表集中在 `src/app/routes.ts` + `src/app/App.tsx` | 文件系统路由（App Router） |
| 服务端 | 无：本仓库无任何服务端运行时，数据落 `localStorage` envelope（`src/lib/storage.ts`） | App Router 具备 server 侧能力 |
| 页面组件契约 | `export default function XxxPage()` + `<Route element={...}>` | 目录约定 + 布局约定 |

`src/app/routes.ts` 顶部的路由合同写明：独立部署阶段 `product-navigation` 会把 `/studio/*` 映射为 Studio origin 下的 `/*`，**跨产品入口不得自行拼接 URL**。Week 0 的 `/bind` 是顶层路径，直接落地会绕过这条合同（详见第 7 节非目标）。

### 1.3 依赖与样式基座不兼容

`package.json` 无 `next`。引入 Next 依赖以承载一个绑定页，会把整棵 Vite 产品主干拖进双构建体系。

样式侧同样不兼容：本仓库 Tailwind 的 `gray.*` 并非默认冷灰，而是映射到 `src/design-system/tokens.css` 的暖灰变量（`--gray-50: #fcfaf6`、`--gray-100: #f3ede3`、`--gray-900: #2e2620`），`--color-primary: #f04e7e`。Week 0 的 iOS grouped（`#F2F2F7` / `#007AFF`）是冷灰 + 系统蓝。直接搬运 Week 0 的样式代码，会在 token 语义层与本仓库整体视觉体系相撞（详见第 4 节）。

### 1.4 领域基座不同：Week 0 的上游真源在本仓库另有其名

Week 0 的 Job 链路以 `Artifact → RESIN_PRINT_JOB → Result` 表达。本仓库的设计意图真源链路已经存在且被测试覆盖，但命名与分层不同：

```
EditorDocV7
→ DesignVersionV1                （src/community/domain/v7_1/design-content-model.ts）
→ DesignReleaseRecordV1          （src/studio/versioning/design-release.ts）
→ PublishPackageV1 / ClientShareLinkV1（src/studio/publishing/, src/studio/approval/）
→ ApprovalEventV1 / ConfirmedDesignSnapshotV7（src/community/domain/v7_1/trust-contracts.ts）
```

也就是说：Week 0 的 Job 若要落到本仓库，它的上游引用必须改写为 `designVersionId` + `snapshotId`，这是**语义改写**，不是文本合并。cherry-pick 无法完成语义改写。

### 1.5 由此得出的合入形态

Week 0 的可复用资产是**合同**，不是**代码**：冻结错误码集合、SN/门店身份二分、两跳绑定顺序、Job fail-closed 规则、路径收敛决策。这些应当在本仓库以新 PR 重新实现（第 3 节），源码本身不移植。

---

## 2. 本仓库已有什么 vs Week 0 合同缺什么

### 2.1 已存在的设备域（9 文件 / 1272 行，全部 MOCK IOT）

| 文件 | 行数 | 职责 | 与 Week 0 的关系 |
|---|---:|---|---|
| `src/app/pages/devices/DeviceBindPage.tsx` | 6 | `/studio/devices/bind` 页壳，仅渲染 `<BindWizard />` | 可直接复用为落点 |
| `src/app/pages/devices/DeviceListPage.tsx` | 182 | 设备列表、三态状态、重连 / 解绑二次确认 | Week 0 未覆盖，保留 |
| `src/app/pages/devices/MobileBindPage.tsx` | 8 | 手机页壳 | 与冻结冲突，见第 5 节 |
| `src/platform/devices/BindWizard.tsx` | 646 | 六步向导、四条路径、九个 mock 异常场景 | **需原地改造，不可另建第二个向导** |
| `src/platform/devices/MobileBind.tsx` | 131 | 手机端 WiFi 凭据代填页，四种链接态 | 见第 5 节 |
| `src/platform/devices/device-store.ts` | 58 | Zustand + `StorageKeys.devices` envelope 持久化 | 可复用，需扩字段 |
| `src/platform/devices/bind-session.ts` | 64 | 会话 5 分钟 TTL 恢复 + 跨标签 `deviceCode` 互斥锁 | 可复用，本仓库独有资产 |
| `src/platform/devices/iot-mock.ts` | 78 | 计时常量、mock 发现、场景 key | 需保留为 demo 通道 |
| `src/platform/devices/mobile-tokens.ts` | 49 | 手机交接凭据 token（非设计 token） | 见第 5 节 |
| `src/platform/devices/types.ts` | 50 | `BindPath`、`BindStep`、`DiscoveredDevice`、`BindSession`、`BindLock` | 需收敛 `BindPath` |

配套已存在的支撑设施（这些是本仓库比 Week 0 更成熟的部分，应当保留而非被覆盖）：

- **跨标签并发绑定锁**：`acquireBindLock()` 以 `deviceCode` + `TAB_ID` 互斥，带 2 分钟死锁兜底（`bind-session.ts:50-58`）。这是真实机制，不是 mock。
- **WiFi 密码红线**：`BindSession` 类型注释与 `BindWizard.tsx:85` 明确密码 `type=password` 且永不写入会话。
- **会话恢复**：5 分钟 TTL，Step 4 刷新回退到 Step 3（`BindWizard.tsx:79-80`）。
- **Mock 注入面板**：`src/lib/mock-panel.tsx:38-46` 注册 9 个设备场景，与 `IOT_SCENARIOS` 一一对应。
- **i18n 双语已就位**：`device.*` 键在 `src/lib/i18n/platform-messages.ts` 中英各一份，覆盖全部向导与列表文案。
- **路由门禁**：`HardwareRegistrationGate`（`devices.length > 0`）保护 `/studio/customers/*` 与 `/studio/devices`，而 `/studio/devices/bind` 故意置于门禁之外（`App.tsx:146-152`），使新门店能激活硬件。

### 2.2 Week 0 冻结合同 vs 本仓库现状：逐项差异

#### A. 绑定传输：完全缺失

| Week 0 合同 | 本仓库现状 | 差异性质 |
|---|---|---|
| WebBluetooth 为主路径「搜索机器」 | 有 `bluetooth` 路径卡片，文案「浏览器蓝牙直连」，但 `rg` 全仓零 `navigator.bluetooth` 命中；实际由 `mockDiscoverDevice()` 随机产出 `NS-<6位hex>` | **文案已承诺、实现为零**。这是当前最需要修正的表述风险 |
| 同页 USB 回退「用数据线绑定」 | 有 `usb` 路径卡片，同样零 `navigator.usb` 实现；且是**并列的第四张卡**，不是主路径的同页回退 | 交互模型不同：并列选择 ≠ 主路径失败后的同页降级 |
| 两跳：先绑定，再云注册 | 单跳：Step 5 `finalizeBind()` 直接 `addDevice()` 落本地 store（`BindWizard.tsx:226-241`） | 缺 hop 2 与其独立重试语义 |

#### B. 错误码：**这是最大的合同缺口**

本仓库的绑定错误模型是一个**组件内部的私有 union**：

```ts
// src/platform/devices/BindWizard.tsx:52-58
type ErrorKind =
  | 'discoverTimeout' | 'wifiWrong' | 'joinTimeout'
  | 'alreadyBound' | 'concurrent' | 'tokenExpired';
```

它有四个结构性问题：

1. **不是稳定错误码**：定义在 UI 组件文件内，随 UI 重构漂移，不能出现在任何 API 边界。
2. **无穷尽性保证**：`ErrorKind` 直接被 `switch`/条件渲染消费，没有 `never` 兜底，也没有「任何未知输入必须映射到已知码」的约束 → 无法给出 Week 0 要求的「API/UI 中永不出现 UNMAPPED」保证。
3. **覆盖面只有 6 项**，Week 0 冻结 12 项。
4. **`alreadyBound` 语义与冻结相反**：本仓库文案是「此设备已在其他门店绑定。如需转移请联系客服」，唯一出口是「取消配网」（`BindWizard.tsx:526-534`）。Week 0 的 `BIND_SN_ALREADY_BOUND` 要求二分——**同店视为成功**，异店不允许强制绑定。本仓库把两种情况合并成一个死胡同。

逐条对照：

| Week 0 冻结错误码 | 本仓库对应物 | 状态 |
|---|---|---|
| `BIND_BT_DISCOVER_FAILED` | `discoverTimeout`（mock 15s 超时） | 部分：语义近似，非稳定码 |
| `BIND_BT_PAIR_FAILED` | 无 | **缺失**（无配对阶段） |
| `BIND_BT_WIFI_HANDOFF_FAILED` | `wifiWrong` / `joinTimeout` 勉强对应 | 部分：本仓库的 handoff 是手机代填，非 BT 交接 |
| `BIND_USB_NOT_FOUND` | 无 | **缺失** |
| `BIND_USB_DENIED` | 无 | **缺失**（无浏览器权限模型） |
| `BIND_SN_MISMATCH`（须双显 SN） | 无 | **缺失**（无 SN 概念，见 C） |
| `BIND_SN_ALREADY_BOUND` | `alreadyBound`，但无同店/异店二分 | **语义冲突** |
| `CLOUD_REGISTER_FAILED`（仅重试 hop 2） | 无 | **缺失**（无 hop 2） |
| `JOB_FALLBACK_LAN` | 无 | **缺失**（`lan` 在本仓库是绑定路径，不是 Job 传输回退） |
| `JOB_TRANSPORT_OFFLINE` | 无 | **缺失** |
| `DEVICE_NOT_ACTIVATED` | 无（`HardwareRegistrationGate` 只判「有无已绑设备」） | **缺失且有语义碰撞风险**，见第 6 节 |
| `JOB_REJECT_EMPTY_PATCH` | 无 | **缺失**（无 Job、无 patch） |

现成可复用的分层参照：`src/platform/backend/service-contract.ts` 已有后端中立错误码层 `SERVICE_ERROR_CODES_V1` 与 `mapDomainErrorCodeV1()`。绑定错误码应当作为**独立的领域码**存在，再向该中立层映射，**不合并进 `SERVICE_ERROR_CODES_V1`**。

#### C. 设备身份：缺 SN、缺门店、缺激活态

```ts
// src/lib/types.ts:91-102
export type DeviceType = 'scanner' | 'printer_3d' | 'uv_printer';
export type DeviceStatus = 'online' | 'offline' | 'busy';

export interface Device {
  id: string; alias: string; type: DeviceType; status: DeviceStatus;
  deviceCode: string;   // device_code 绑定
  boundAt: string; lastSeenAt?: string;
}
```

缺失：`serialNumber`（SN，`BIND_SN_MISMATCH` 双显 SN 的前提）、门店归属（`BIND_SN_ALREADY_BOUND` 同店/异店二分的前提）、激活态（`DEVICE_NOT_ACTIVATED` 的前提）、`nailProfileRef`（冻结要求机上 `NailProfileRef` 保持可空）。

注意 `deviceCode` 与 SN 是两个不同标识。**不得把 `deviceCode` 直接改名为 SN**——它已被 `bind-session.ts` 的并发锁、`mobile-tokens.ts` 的凭据记录、`device-store.ts` 的持久化 envelope 共同引用。正确做法是新增 SN 字段并明确两者关系。

#### D. Job / 履约平面：本仓库为零基线，且存在两处休眠种子

`rg` 在 `src/` 下对 `RESIN_PRINT`、`NailSurfacePatch`、`ArtifactManifest`、`ManufacturingDefinition`、`WorkOrder`、`DeviceTask` 的 TypeScript 定义搜索全部零命中。

两处休眠种子（**这是第 6 节「两个 Job 模型」风险的具体来源**）：

```ts
// src/lib/types.ts:255-259 —— 无生成器、无消费者
export interface ManufacturingPackage {
  kind: 'manufacturing';
  scanContextVersion: string;
  frozenSnapshot: DesignSet;
}
```

```ts
// src/lib/state-machine.ts:112 —— 已导出，全仓无任何 import
export function submitDesign(design: DesignSummary): DesignSummary { /* confirmed → submitted */ }
```

同文件的其他导出（`isReadOnly` / `confirmDesign` / `STATUS_LABEL` 等）在 7 个文件中被引用，`submitDesign` 一处都没有。`DesignStatus` 中的 `'submitted'` 因此是一个**可达状态定义、不可达状态转换**。

已存在的相邻护栏（应保留并扩展，而非重写）：`src/community/domain/v7_1/design-content-contract.ts` 的 `FORBIDDEN_DEVICE_MANUFACTURING_KEYS` 显式禁止 `workorder` / `devicetask` / `printjob` / `manufacturingdefinition` / `processroute` / `vendorjob` / `jobid` / `uvpower` / `curetime` 等键进入设计内容合同。

#### E. 扫描输出：只有 ref 占位

`NailProfileV1.nailTwinSnapshotRefs?: string[]`（`src/community/domain/v7_1/model.ts`）+ `src/platform/twin.ts`（72 行 mock，三态）。无 `NailSurfacePatch` 类型，也无 snapshot 结构体。冻结要求「扫描输出 = `NailSurfacePatch` ref 而非点云」——本仓库当前形态（只存 ref 字符串）与该方向一致，**没有需要拆除的点云实现**，这是一个有利条件。

---

## 3. 建议的移植顺序：本仓库上的新 PR

### 总原则

移植的是**合同**，落地方式是**原地改造现有 9 个设备文件**，不是新增一棵平行目录。任何「新建第二套绑定实现」的方案都会立刻触发第 6 节的双向导风险。

### PR1（第一个，唯一的第一个）：绑定错误码合同 + 设备身份扩展

**范围**

1. 新增 `src/platform/devices/bind-error-codes.ts`：
   - 冻结 12 个码为 `as const` 常量数组 + `BindErrorCodeV1` union。
   - `mapBindErrorV1(input: unknown): BindErrorCodeV1` —— 穷尽映射，任何未知输入落到一个**已定义**的兜底码，函数签名上不允许返回 `UNMAPPED`，编译期以 `never` 检查保证 union 全覆盖。
   - `resolveSnAlreadyBound({ incomingStoreId, boundStoreId })` 纯函数：同店 → 成功；异店 → 拒绝且不提供强制绑定出口。
2. 扩展 `Device`（`src/lib/types.ts`）：`serialNumber`、`storeId`、`activationState`、`nailProfileRef?: string | null`（保持可空）。同步升级 `StorageKeys.devices` envelope 版本并写迁移，旧记录不得丢失。
3. 把 `BindWizard.tsx` 现有 6 个 `ErrorKind` **重映射**到冻结码：`ErrorKind` 从组件私有 union 改为 `BindErrorCodeV1` 的子集别名，渲染分支继续用现有 `device.*` i18n 键。
4. 新增 `device.*` i18n 键仅覆盖新增错误码，中英同时补齐。
5. 新增 `tools/test-device-bind-error-codes.mjs` + `package.json` script：断言码全集与冻结一致、双语 catalog parity、`mapBindErrorV1` 无 UNMAPPED 输出、SN 双显字段齐备、同店/异店判定正确、envelope 迁移幂等。

**明确不做**：WebBluetooth / WebUSB、cloud-register、Job、任何视觉改动。

**为什么第一个**：三条理由，按权重排序。

1. **它是 PR2 的硬前置**。没有 SN 与门店归属，两跳绑定的 `BIND_SN_MISMATCH` 与 `BIND_SN_ALREADY_BOUND` 无处落地；先写传输层就一定要返工。
2. **它可以零视觉 diff 落地**。UI 只换错误标识来源，不换文案键、不换布局，走查成本最低，评审注意力可以完全集中在合同上。
3. **它是 Week 0 最不可逆的资产**。冻结错误码一旦被 API 与设备固件双向依赖就改不动了；越早在产品主干确立，后面越省。

**风险**：低。改动集中在类型 + 一个纯函数模块 + 一处 union 替换 + 一次 envelope 迁移。

### PR2（第二个）：workstation Chrome 两跳绑定 + 路径收敛 + 作用域化 iOS 外壳

**范围**

1. 新增 `src/platform/devices/transport/`：`BindTransportPortV1`（可替换端口）+ `web-bluetooth-transport.ts` + `web-usb-transport.ts`。能力探测失败 → 直接给 PR1 的冻结码，不静默降级。
2. **路径从 4 条收敛为 2 条**：「搜索机器」（WebBluetooth 主）+「用数据线绑定」（同页 USB 回退，非并列第五张卡）。
   - `lan` 从 `BindPath` 移除。**理由**：冻结把 LAN 定义为 Job 传输回退（`JOB_FALLBACK_LAN`，且不解绑云），本仓库当前把它当成绑定路径，这是分层错位。LAN 应在未来的 Job 平面出现，不在绑定向导里。
   - `mobile` 见第 5 节处置。
3. 两跳绑定：hop 1 本地绑定 → hop 2 云注册。`CLOUD_REGISTER_FAILED` **只重试 hop 2**，不重跑 hop 1（否则会产生重复本地绑定）。
4. 保留并适配本仓库既有资产：并发锁、会话 TTL 恢复、WiFi 密码不落盘红线、mock 注入面板（真实传输不可用时的 demo 通道）。
5. 视觉：仅在 `/studio/devices/bind` 子树引入作用域 CSS 变量层（如根节点 `data-surface="workstation-bind"` + `--ws-bind-*` 变量），**不修改 `src/design-system/tokens.css` 的任何全局值**。详见第 4 节。
6. 测试与走查：传输端口的能力探测单测；`390 / 768 / 1024 / 1280 / 1440` 响应式走查（工作站为主，但不得在窄屏破版）；Studio / Community 抽样页面视觉回归，证明作用域层没有泄漏。

**明确不做**：Job、Artifact、打印、Result。

**风险**：中。WebBluetooth 依赖浏览器权限与真实设备，CI 内不可完整验证 → 交付时证据等级最多标到 `prototype`（真实设备联调前）或 `integrated`（仅指代码集成），**不得标为 `physically-validated`**。

### PR3（不属于本次合入，须单独立项批准）：Job 平面

列出边界以防它被夹带进 PR1/PR2：

- 前置：PR1 + PR2 已合入，且 `NailSurfacePatch` 合同经人工签收。
- 新建独立模块（如 `src/manufacturing/`），**不扩展** `PublishPackageArtifactV1`，**不扩展** `Device` store。
- Job 的上游引用必须是 `designVersionId` + `snapshotId` + `patchRef`，不是 `EditorDoc`。
- fail-closed：本次到店无 `NailSurfacePatch` → 生产打印 Job 拒绝并给 `JOB_REJECT_EMPTY_PATCH`；demo 级降级必须显式标注为降级。
- **同一个 PR 内必须处置两处休眠种子**：`submitDesign()` 与 `ManufacturingPackage` 要么删除、要么改为向新 Job 平面委托。不允许并存。

### 永不复制的内容（never gets copied）

1. **任何 Next.js 运行时**：`app/` App Router 目录、server actions、route handlers、`next/*` import、`next` 依赖。
2. **Week 0 的 `/bind` 顶层路由**。落点必须是既有的 `Routes.deviceBind = '/studio/devices/bind'`（`src/app/routes.ts`），以遵守 `/studio/*` 映射合同。
3. **Week 0 的 iOS 全局配色**。`#F2F2F7` / `#007AFF` 不得进入 `tokens.css`，不得覆盖 `gray.*` / `primary`。
4. **Week 0 的 mock Result 与 demo 降级类**，不得作为产品结论或能力等级证据搬运。
5. **Week 0 中任何把 Community 内容直接作为履约输入的连线**（第 6 节风险 4）。
6. **Week 0 的任何编辑器代码**。本仓库 Editor V7（`src/studio/`，242 文件）是设计意图真源，不替换、不并存。
7. **Week 0 的技师手机主导绑定形态**（第 5 节）。

---

## 4. 视觉切分：`DESIGN.md` 与 iOS grouped 的边界

### 4.1 两套语言的准确定位

| 表面 | 视觉语言 | 依据 |
|---|---|---|
| Studio 全部页面、Community 全部页面 | `DESIGN.md` v1.1：明亮暖象牙 `#FAF6EF` + 明丽玫瑰 `#F04E7E` + 甲油色盘五辅助色，全暖灰，**明确禁止冷灰（`#F5F5F5` 类）** | 仓库根 `DESIGN.md` §2 / §7 Don'ts 第 6 条 |
| 仅 `/studio/devices/bind` 工作站绑定向导 | iOS grouped：`#F2F2F7` 分组底 + `#007AFF` 系统蓝 | Week 0 冻结绑定 UI 规范 |

**两套语言不合并、不折中、不互相污染。** 理由是心智不同：Studio/Community 是创作与内容浏览（画布优先、暖调、内容为主角）；工作站绑定是一次性系统配置流程（贴近操作系统设置面板的直白感，减少美学干扰）。

### 4.2 本仓库的具体约束（这条最容易被实现者踩错）

**本仓库的 `gray.*` 不是中性灰，是暖灰。** `tailwind.config.js` 把 Tailwind 的 `gray.50…950` 全部重定向到 `tokens.css` 的 `--gray-*`，而这些变量的值是 `#fcfaf6` / `#f3ede3` / `#2e2620` 等暖色。

由此产生两个必须遵守的结论：

1. **现有设备页面已经在 `DESIGN.md` 体系内**。`BindWizard.tsx` / `DeviceListPage.tsx` 里的 `bg-gray-50` / `text-gray-900` / `bg-primary` 当前渲染出的是象牙 + 玫瑰，不是 iOS 灰蓝。所谓「引入 iOS grouped」是**新增一层**，不是「改回默认灰」。
2. **绝不允许通过修改 `--gray-*` 或 `--color-primary` 来实现 iOS 外观**。那会一次性把 Studio 与 Community 全站变冷。

正确做法：在绑定向导根节点建立作用域 token 层，例如

```
[data-surface="workstation-bind"] { --ws-bind-group-bg: #F2F2F7; --ws-bind-accent: #007AFF; ... }
```

绑定向导内部只消费 `--ws-bind-*`，不消费 `gray.*` / `primary`。作用域外零影响，并以视觉回归证明无泄漏。

### 4.3 组件层的判断

`src/design-system` 的 `Button` / `Card` / `Input` / `Badge` / `Modal` / `Toast` 均已绑定 `DESIGN.md` token。iOS grouped 表面**不应**给这些组件加 `variant="ios"` —— 那会把第二套视觉语言注入共享设计系统，进而泄漏到 Studio 与 Community。工作站绑定表面应使用局部组件，只复用行为层（`Modal` 的焦点管理、`Toast` 的通道）而非视觉层。

### 4.4 命名提醒

`src/platform/devices/mobile-tokens.ts` 中的「token」指手机交接**凭据**，与设计 token 无关。新增 iOS 设计 token 时不要放在该文件附近，避免长期误读。

---

## 5. `MobileBind` 与冻结的关系

### 5.1 事实先说清楚：它不是「手机绑定设备」

`MobileBind`（131 行）+ `mobile-tokens.ts`（49 行）+ 路由 `/studio/devices/bind/mobile/:token`（`App.tsx:108`，注册在 Studio 布局之外）实际做的事：

1. 桌面向导 Step 3 发放一个 5 分钟 TTL 的一次性 token（`BindWizard.tsx:127-153`）。
2. 手机打开链接，**只填 WiFi 名称与密码**并提交（`MobileBind.tsx:37-50`）。
3. `consumeMobileToken()` 标记已用并暂存凭据；桌面端每 2 秒轮询，取到后由**桌面端**继续配网。

设备发现、绑定、命名、落库全部发生在桌面端。手机只是一个 WiFi 凭据输入代理。

### 5.2 与冻结的冲突点，以及不冲突的部分

冻结：「Bind path 是 workstation Chrome + WebBluetooth，不是技师手机，不是常驻 IoT app。USB 同页回退。」

- **冲突**：`mobile` 目前是 Step 1 四张路径卡片之一（`BindWizard.tsx:62-67`），在产品语义上被呈现为**一条并列的绑定路径**。这与「绑定路径只有工作站 BT 主 + USB 同页回退」直接矛盾。
- **不冲突**：它本身不是常驻 IoT app（无安装、无后台、无设备控制能力），也不是手机主导绑定（手机不发现、不绑定、不注册）。它是桌面流程内的一次性输入代理。

### 5.3 处置建议（明确意见）

**不删除文件、不删除路由，但从绑定路径中摘除。** 具体三条：

1. **PR2 中把 `mobile` 从 `BindPath` 的路径卡片移除**。Step 1 只留「搜索机器」与「用数据线绑定」。
2. **`MobileBind` 降级为可选的 WiFi 凭据代填工具**，仅可从绑定流程内部的次级入口进入（工作站键盘输入长 WiFi 密码确有不便，这个能力有真实价值），并在页面上显式标注它不是绑定路径。
3. **硬边界**：`MobileBind` 永不承载设备发现、SN 校验、cloud-register 或任何 Job 下发。它的能力上限就是提交一次 WiFi 凭据。

如果 Henry 更倾向零歧义，可选更严格的处置：PR2 把该路由与组件放到 feature flag 之后，默认关闭，保留代码但不出现在产品流程中。**我的建议是采用上面三条，而不是直接删除**——因为并发锁、会话 TTL 与凭据一次性语义是本仓库已验证的资产，删掉后如果将来需要重建成本更高。

---

## 6. 风险

### 风险 1：两个 Job 模型并存（高，且已有具体触发点）

本仓库有两处休眠种子：`ManufacturingPackage`（`src/lib/types.ts:255`，无生成器无消费者）与 `submitDesign()`（`src/lib/state-machine.ts:112`，全仓零 import，但 `DesignStatus` 已含 `'submitted'`）。

若 Week 0 的 `RESIN_PRINT_JOB` 以新模块落地而这两处不动，产品会同时存在两条「提交生产」语义：一条基于 `DesignSet` 冻结快照，一条基于 `DesignVersion` + `Snapshot` + `patchRef`。二者的 fail-closed 规则不同 → 必然出现「一条路径拒绝、另一条路径放行」的漏洞。

- 已有的部分缓解：`FORBIDDEN_DEVICE_MANUFACTURING_KEYS` 挡住了制造字段进入 Community 设计内容。
- 缓解不足之处：该护栏只作用于 Community 内容合同，**挡不住 Studio 内部**再长出第二个 Job 模型。
- 对策：Job 平面必须是独立 PR（PR3），且在同一 PR 内处置两处休眠种子。PR1 / PR2 一律不得引入任何 Job 类型。

### 风险 2：两个绑定向导并存（高）

`BindWizard.tsx` 有 646 行，并且**独占**三组 localStorage key 的所有权：`StorageKeys.deviceBindSession`、`deviceBindLock`、`deviceMobileTokens`（`src/lib/storage.ts:46-52`）。

如果 Week 0 形态以「新建一个 workstation 绑定组件」的方式落地，两个向导会同时读写同一把并发锁与同一份会话 → 跨标签互斥失效、会话互相覆盖、设备被重复绑定。

对策：PR2 **原地改造** `BindWizard`，不新建第二个向导；这三组 key 的 owner 始终只有一个。若确需并存过渡期，必须给新旧实现分配不同的 storage key 前缀，并在 PR 描述中写明过渡终止条件。

### 风险 3：替换编辑器（高影响，低概率但必须封死）

`src/studio/` 有 242 个文件，`EditorDocV7` 是设计意图真源，配套有 French 合同 / migration / golden fixture / runtime 等数十个专项测试脚本（见 `package.json` scripts）。Week 0 是一个绑定与 Job 的薄切片，其中任何编辑器相关代码都不具备替换资格。

对策：写入非目标（第 7 节），并在 PR1 / PR2 的 diff 审查中把「是否触碰 `src/studio/editor/`、`src/studio/geometry/`、`src/studio/render*`」作为硬性检查项。

### 风险 4：把 Community 拖进履约（中高）

Community 已有明确的单向边界：immutable `DesignVersion` + Intent/adapter 进入 Studio，不直写 Editor store；`RealResultV1.fulfillmentRef` 只是一个不透明引用字符串，不是 Job 实体；`CommunityLookCard` / `CommunityFeed` 已在 UI 上声明「预览 ≠ 可制造、履约记录不可用」。

风险形态是反向依赖：为了在社区展示「已制造」而让 Community 读取 Job 状态。

对策：Job 平面只能向 Community 暴露 `fulfillmentRef` 这一个不透明引用；Community 代码不得 import 任何制造模块。建议在 PR3 增加依赖方向断言测试（Community → Manufacturing 的 import 数必须为 0）。

### 风险 5：视觉双语言泄漏（中，第 4 节已详述）

最可能的踩坑方式是直接改 `tokens.css` 的 `--gray-*` 或给 `design-system` 组件加 iOS variant。对策：作用域 token 层 + Studio/Community 视觉回归。

### 风险 6：`DEVICE_NOT_ACTIVATED` 与 `HardwareRegistrationGate` 语义碰撞（中）

现有门禁只判「是否存在至少一台已绑定设备」（`devices.length > 0`），并据此放行 `/studio/customers/*`。引入激活态后，「已绑定」与「已激活」不再等价。

两个具体隐患：一是门禁若被改成判激活态，可能把已经在用的门店锁在外面；二是激活态门禁若误覆盖 `/studio/devices/bind`，新门店将无法完成首次激活（而现有设计**故意**把 bind 放在门禁之外，`App.tsx:146`）。

对策：PR1 引入 `activationState` 字段但**不改动门禁行为**；门禁语义调整作为独立决策，并显式保证 bind 入口永不被激活态门禁拦截。

### 风险 7：双设备标识（中）

`deviceCode` 已被并发锁、凭据记录、持久化 envelope 三处引用；新增 SN 后若两者关系不明确，会出现「按 `deviceCode` 加锁但按 SN 判重」的错配，从而绕过并发保护。对策：PR1 在类型注释中固化两者关系，并让并发锁与判重使用同一个标识来源。

### 风险 8：i18n 门禁回归（低但会阻塞合入）

`AGENTS.md` §9 要求所有用户可见文案走 typed key、`zh-CN` 与 `en-US` 同时补齐、禁止 source-copy 派生的超长 camelCase key、frozen legacy baseline 只能减少。新增 12 个错误码文案很容易违反。

对策：**错误码本身是稳定标识符，不是 i18n key**；码 → `device.*` 键的映射显式化，并在 PR1 的测试里加双语 parity 断言，同时跑既有 `npm run test:i18n` 与 `npm run audit:i18n:platform`。

---

## 7. 本次合入的显式非目标

1. 不对 Origin Next 历史做 merge / cherry-pick / rebase / 强推。
2. 不引入 `next` 或任何 Next.js 运行时依赖；不引入第二套构建体系。
3. 不新增顶层 `/bind` 路由；不改动 `/studio/*` 路由前缀合同。
4. 不修改 `src/design-system/tokens.css` 的全局 token 值；不给共享设计系统组件添加 iOS variant。
5. 不改动 `src/studio/editor/`、`src/studio/geometry/`、`src/studio/render*`、`src/studio/rendering/`；不替换 Editor V7。
6. 不新增任何 Community → 履约 / 制造方向的依赖边。
7. PR1 与 PR2 不引入任何 Job / Artifact / WorkOrder / DeviceTask 类型。
8. 不实现点云扫描输出；扫描侧维持 `NailSurfacePatch` ref 语义。
9. 不把技师手机作为绑定主路径；不构建常驻 IoT app、不引入 Matter、不做门店 MES UI、不做打印农场、不开 Device 产品线。
10. 不宣称任何「可制造 / 生产可用」；PR1 / PR2 的证据等级上限为 `integrated`（代码集成）与 `visually-signed-off`（人工走查后），真实设备与物理验证不在范围内。
11. 本次评估 PR 不含任何 UI diff，仅新增本文档。

---

## 8. 一屏建议（供 Henry 批准）

**结论：不 merge Origin Next 代码。移植合同，不移植源码。在本仓库开两个新 PR，第三个单独立项。**

| | 内容 | 关键交付物 | 视觉 diff | 风险 |
|---|---|---|---|---|
| **PR1** | 绑定错误码合同 + 设备身份扩展 | `src/platform/devices/bind-error-codes.ts`（12 个冻结码、穷尽映射、无 UNMAPPED）；`Device` 增 `serialNumber` / `storeId` / `activationState` / 可空 `nailProfileRef` + envelope 迁移；现有 6 个 `ErrorKind` 重映射；同店=成功 / 异店拒绝的纯函数；双语 i18n + 专项测试 | **零** | 低 |
| **PR2** | 工作站 Chrome 两跳绑定 + 路径收敛 + 作用域 iOS 外壳 | `BindTransportPortV1` + WebBluetooth / WebUSB 适配；路径 4→2（「搜索机器」+「用数据线绑定」同页回退）；hop1 绑定 → hop2 云注册，`CLOUD_REGISTER_FAILED` 仅重试 hop2；`data-surface="workstation-bind"` 作用域 token 层 | 仅 `/studio/devices/bind` | 中 |
| **PR3** | Job 平面（**不属于本次合入，须单独批准**） | 独立 `src/manufacturing/`；Job 引用 `designVersionId` + `snapshotId` + `patchRef`；空 patch → `JOB_REJECT_EMPTY_PATCH` fail-closed；同 PR 内清理 `submitDesign()` 与 `ManufacturingPackage` | 新增页面 | 高 |

**Do-not（一条都不例外）**

1. 不 merge / cherry-pick Origin Next 历史（无共同祖先，且无可编译落点）。
2. 不引入 Next 依赖或运行时。
3. 不新建第二个绑定向导 —— PR2 必须原地改造 `BindWizard.tsx`，`deviceBindSession` / `deviceBindLock` / `deviceMobileTokens` 三把 key 永远只有一个 owner。
4. 不改 `tokens.css` 全局 token 实现 iOS 外观（本仓库 `gray.*` 是暖灰，改了会让 Studio 与 Community 全站变冷）。
5. 不动 Editor V7 / 几何 / 渲染。
6. 不在 PR1 / PR2 引入任何 Job 类型；`submitDesign()` 与 `ManufacturingPackage` 保持休眠直到 PR3 一次性处置。
7. 不保留 `mobile` 作为绑定路径（降级为 WiFi 凭据代填工具，硬边界：永不做发现 / SN 校验 / 云注册 / Job）。
8. 不把 `lan` 当绑定路径（它属于 Job 传输回退 `JOB_FALLBACK_LAN`，在 PR3 出现）。

**执行顺序**：PR1 合入并通过 i18n 与错误码测试后，再开 PR2。PR3 需要 `NailSurfacePatch` 合同先经人工签收。
