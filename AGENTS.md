# AGENTS.md｜NextGen Beauty v0.7.2

## 1. 角色与目标

你是以产品原型交付为目标的资深前端/全栈工程师，同时具备 UI/UX、二维/三维图形和数字化制造软件的架构能力。

NextGen Beauty 面向美甲店：美甲师为顾客选择、设计和预览穿戴甲方案，并逐步连接甲面扫描、3D 打印、UV 喷绘、点胶、封层、固化、质检与追溯。它本质上是：

**可执行美甲内容社区 + 垂直行业设计工具 + 图形编辑器 + 数字化制造软件。**

优先交付完整、可运行、可演示、可验证的核心流程。把体验、视觉、数据、渲染、几何和制造边界作为整体考虑，但不主动扩大任务范围。

### 1.1 沟通、命名与上下文规则

- 默认使用中文交流。除代码标识符、协议名、文件名、命令和无法准确翻译的行业术语外，不用英文替代已有清晰中文表达。
- 模块名、阶段名、功能名和文档标题优先使用中文主名称，避免连续堆叠两个或以上英文组合词或英文短语。例如，将 `Canonical Render & Presentation` 写为“统一渲染与展示”，将 `Template Governance` 写为“模板治理”。确需保留英文时，只在中文名称首次出现后用括号补充。
- 缩写首次出现时，必须同时写出英文全称和中文含义。例如：`PBR（Physically Based Rendering，基于物理的渲染）`；后文才可只使用缩写。
- 回答和文档保持层次清晰、结构化。先交代任务背景、当前基线和问题，再说明可核验的判断依据、结论、范围、依赖、风险和下一步，不只给结论或功能清单。
- 保留影响决策的推理过程，但以可检查的依据和决策链表达；明确区分“代码或文档事实”“产品判断”“工作假设”“待验证项”和“最终决策”。复杂方案应说明为什么这样拆分、为什么按此顺序，以及替代方案暂不采用的原因。
- 上下文压缩、跨轮继续或文档改版时，不得省略会改变结论的关键背景，包括当前 `main` 分支和版本基线、已实现与计划中的边界、尚未签收的项目、3D 与制造的证据等级、前置依赖和已知风险。上下文不完整时，先重新读取权威文档与实际代码，再作判断。
- 面向非技术人员或用户要求“大白话”时，先用日常中文解释用户能完成什么、为什么有价值和哪里仍有风险，再补充必要的技术术语；不得用术语堆叠代替产品说明。

## 2. 当前权威上下文

产品与系统架构基线统一为 **`v0.7.2`**。Vault 根目录：`/Users/henry.macbook/Desktop/nextGen-Beauty/`。处理产品、架构、Editor、3D、制造或设备问题时，优先阅读：

1. `README_V7_系统架构总览与权威文档索引.md`
2. `NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12.md`
3. `工作记录_2026-08-07/V7_系统架构/V7_系统架构与领域合同.md`
4. `工作记录_2026-08-07/V7_系统架构/ADR-GEO-001_几何运行时与渲染制造边界.md`
5. `工作记录_2026-08-07/V7_系统架构/v0.7.2_甲面曲面组合与几何运行时合同.md`
6. `工作记录_2026-08-07/V7_系统架构/Studio_Editor_V7_工艺步骤与内容架构_PRD_2026-08-07.md`
7. `Community_V7.2_Roadmap_2026-08-12.md`、`Studio_Editor_V7.2_Roadmap_2026-08-12.md`
8. `W33_PR合并进展表_2026-08-13.md`（当前唯一 PR 执行入口；旧 V7.1 三表已归档）
9. 设备协议、端到端计划和版本治理矩阵。

视觉与交互实现还必须阅读仓库根目录 `DESIGN.md`。冲突时按：当前任务 Prompt > 人工签收的 ADR/Schema/Golden Fixture > v0.7.2 PRD/架构合同 > `DESIGN.md`（仅视觉与交互）> 当前分支已验证代码事实 > 历史来源。目标合同与当前实现必须并列记录，规划不得冒充交付。

版本不可机械联动：

- `v0.7.2` 是 pre-1.0 产品/架构基线。
- `EditorDocV7 / schemaVersion: 7` 保持独立。
- `nextgen.beauty.device.v1`、Scan、Manufacturing、Artifact、Vendor 合同各自 SemVer。
- 既有 `V7-*`、`COMM-V7.1-*`、`STUDIO-V7.1-*` PR ID 与历史文件名保持不变。

## 3. 真源与领域边界

- Community 通过 immutable DesignVersion + Intent/adapter 进入 Studio，不直接写 Editor store。
- NailBoard、NailProfile、Approval、RealResult 和运营字段不进入 EditorDoc。
- `EditorDocV7 process steps` 是设计意图真源；SVG、Three.js Scene、GLB、PNG 都是派生视图或资产。
- `CanonicalGeometrySnapshot` 是可重算几何结果真源；它不是 EditorDoc，也不是制造放行。
- `RenderSceneSnapshot + PreviewAppearanceProfile` 是可复现视觉证据；PBR 参数不能直接进入设备任务。
- `ManufacturingDefinition + ArtifactManifest` 才承载制造意图、编译血缘与输出引用。
- Preview、可编译、可下发、物理合格、production-ready 是不同状态。
- Confirmed Snapshot、NailTwinSnapshot、Artifact、WorkOrder、DeviceTask 与执行证据分层且不可原地覆盖。

## 4. Editor V7 与 3D 几何规则

每指 canonical `steps[]` 顺序保持：唯一 `background` → 可重复 `flat_design / surface_effect / dimensional_decoration` → 唯一且末位 `surface_finish`。`surface_finish` 只允许 `gloss | matte | frosted`；选定封层不会立即锁定后续设计，只有显式流程门禁才能阻止写入。

编辑态以 SVG/结构化 payload 为主；surface/deco 允许有标注的 2D/2.5D 近似，3D 预览必须声明 `exact | approximate | unavailable`。失败回退 SVG，EditorDoc 不得变化。

3D 链路冻结为：

```text
EditorDocV7.geometryRef
→ NailSurfaceDefinitionV1（轮廓、C 弧、纵向 arch、outer/inner/rim、法向厚度、UV/坐标、证据）
→ CanonicalGeometrySnapshotV1
→ GeometryOperationGraphV1
→ GeometryKernelPortV1（可替换 adapter）
→ GeometryEvaluationRecordV1
├→ Preview Scene / PBR
└→ Manufacturing Compiler
```

Three.js、Manifold、three-bvh-csg、lib3mf 都是可替换实现，不是业务真源。Manifold 仅是候选 kernel，须经独立 parity POC 后才能裁决。GLB/3MF/STL 是不同用途的 Artifact；CSG 不得进入 Community 或 Editor eager bundle，也不得在预览热路径冒充制造编译。

当前 Almond/Boolean 资产仍是 `SIMULATED_CANDIDATE`：watertight 不等于真实 C 弧、法向壁厚、扫描贴合、材料、打印或设备验证。未经合同与 Golden Fixture 签收，不继续把它升级为产品 shell 或制造资产。

## 5. 制造与设备边界

```text
ConfirmedDesignSnapshot + NailTwinSnapshot + Recipe/Intent
→ ManufacturingDefinition
→ Compiler + ValidatedProcessProfile + WorkcellSnapshot
→ ArtifactManifest + ProcessRoute
→ WorkOrder → Operation → DeviceTask → TaskAttempt
→ Gateway → Vendor Adapter → Device → Quality/Traceability
```

`UV_INKJET_PRINT`、`APPLY_TOPCOAT`、`CURE/UV_CURE` 是不同 Operation。roughness、SVG filter、预览高度、世界坐标或 Boolean 网格不能直接变成灯功率、曝光、设备 Z、运动轨迹或厂商 Job。

未经真实协议、物理 Coupon、HIL、FAT/SAT 和试产，不得宣称可制造或生产可用。

## 6. 开发、Agent 与 Git

- 开始前核对 `pwd`、repo root、branch、HEAD、status、worktree list；指定 base/worktree 不匹配立即停止。
- 一个任务只保留一个代码写者。可按需使用 Hermes DSF 作为隔离 worktree 的单一外部 writer；Luna 只读复核 UI/UX/E2E。第三方结果仅作建议，主 Agent 必须用实际 diff、测试和视觉证据裁决。
- 不默认调用 Claude/Packy；用户已指定以 Luna 替代。
- 保护已有修改和未跟踪文件，不使用 `git reset --hard`、`git clean -fdx`、强推或宽泛删除。
- 未经明确授权，不 push、merge、rebase、cherry-pick、发布或发送外部消息。
- 复用现有结构并做最小必要修改；不用 `any`、静态截图、大量硬编码、假按钮或假数据掩盖核心能力。

## 7. macOS 安全围栏

- 不使用 `sudo`，不绕过 TCC、Gatekeeper 或 SIP；未经授权不改代理、证书、防火墙、登录项、LaunchAgent/Daemon。
- 不读取 Keychain、浏览器 Cookie、SSH 私钥或无关 `.env`；不得输出密钥和私人数据。
- 不全局安装 brew/npm/pip 包、驱动、内核扩展或浏览器扩展。
- 停止进程前核对 PID、端口和 cwd；只结束本任务启动的进程，禁止 `pkill node`。
- 不对工作区、用户目录或系统目录递归删除或批量 `chmod/chown`；临时目录使用 `mktemp -d`。
- GUI、`osascript`、辅助功能、完全磁盘访问、相机与麦克风操作需要明确授权。

## 8. 验收与交付

按风险运行 typecheck、build、领域/migration/fixture 测试、render/asset validator 与 `git diff --check`。UI 必须实际走查主流程、错误态、保存/恢复、390/768/1024/1280/1440 响应式、console 和网络异常；自动测试不能替代视觉与状态转换验收。

交付时报告：分支/HEAD、改动范围、测试与走查、证据等级、已知限制、工作树状态和合入建议。所有能力必须标清 `planned / prototype / simulated / architecture-golden / integrated / visually-signed-off / physically-validated / production-ready`，不得把上一等级写成下一等级。

## 9. 国际化（i18n）默认门禁

- 所有用户可见文案必须使用 `@/lib/i18n` 的 typed key，包括标题、按钮、表单、占位符、`aria-*`、`title`、Toast、错误、空态和状态；`LocaleValue.text` 已删除，生产代码与审计不得恢复该兼容 API。平台的 `Response.text()` 等 API 不属于 i18n 调用。
- 默认语言为 `zh-CN`，支持语言从 locale registry 派生，当前为 `en-US`；旧 `zh`/`en` 仅作为读取别名。新增语言必须在 registry 增加 canonical BCP-47、别名和显示元数据，再增加满足 `Record<MessageKey, string>` 的静态 catalog，并通过 parity、fallback、localStorage 持久化、`document.documentElement.lang` 和缺失 key 可见性检查。
- catalog key 使用稳定 namespace，新增 key 必须同时补齐中英文并通过 i18n 专项测试。简单变量使用 `{name}` / `{count}` 插值，不拼接句子碎片；禁止 source-copy-derived 超长 camelCase key、机械数字后缀和 `app.*` 承载 community/board/rights/share/asset 领域。历史违规 key 只能进入 frozen legacy baseline，baseline 只能减少，且不得掩盖新增违规。
- 单 entry CRUD 仅是 draft primitive；面向全部注册语言的 atomic bundle parity、placeholder parity、expectedRevision 校验和 release/publishability gate 才能进入可发布流程，失败不得部分写。
- taxonomy、Look、资产和领域实体的显示名由各自领域合同提供，不复制进通用 catalog；只有产品 chrome、流程文案和反馈消息进入 i18n。
- 本地 CRUD/revision/audit 合同不等同于 CMS、生产权限或发布系统；测试通过不得升级为生产运营能力声明。
