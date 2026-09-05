# NextGen Beauty · Nail Design Studio

以内容社区连接并赋能消费者，以专业 3D Studio 服务美甲师与门店，目标是贯通灵感发现、个性化设计、效果预览、顾客确认与数字化制造。

软件定位：**消费内容社区 + 垂直行业设计工具 + 图形编辑器 + 数字化制造软件**。

> 当前产品与架构基线：`v0.7.2`。本仓库是已集成的前端软件原型，包含本地数据流程、模拟能力和验证材料，不代表生产系统或已通过物理制造验证。本文按 `main @ 0df346f` 的代码整理，更新于 2026-08-31。

## 面向谁

- **消费者**：发现款式、搜索与筛选灵感、收藏参考集、查看设计效果并参与方案确认。
- **美甲师与门店**：从模板或社区内容开始，进行逐指设计、法式参数编辑、二维与三维预览，以及顾客方案管理。
- **内容创作者与运营人员**：组织作品、模板与素材，管理版本、来源和可用能力，推动内容进入实际设计流程。

## 当前实现

以下均按本地原型能力理解，不等同于已上线的多用户服务。

| 模块 | 当前范围 |
| --- | --- |
| 内容社区 | 发现、搜索、官方内容、创作者、款式详情与参考收藏集（Nail Board）；分类、筛选与可分享路由 |
| Community → Studio | 显式使用内容、版本化导入、精确模板资产引用与导入预检；不由社区直接改写编辑器文档 |
| 快速建稿 | 模板起步、草稿恢复与旧入口兼容；承担设计起点，不作为第二个编辑器真源 |
| 专业编辑器 | 十指编排、逐指工艺步骤、二维图形编辑、法式参数与统一路径、撤销/重做、保存和版本管理 |
| 预览与顾客确认 | 二维预览、单指三维检查、基于物理的渲染（Physically Based Rendering，PBR）、固定版本只读分享与确认流程原型 |
| 素材与内容治理 | 资产来源、版本与能力标记、模板预检、首页配置和待负责人输入状态 |
| 双语界面 | `zh-CN` / `en-US` 类型化词条、语言切换与一致性检查 |
| 门店辅助流程 | 客户、设计列表、设备绑定等界面；设备与生产相关能力保留模拟边界 |

## 从内容到交付

```text
发现与收藏灵感 → 显式使用 / 导入预检 → Studio 个性化设计
→ 二维 / 三维预览 → 固定版本顾客确认
→ 制造编译与设备执行（后续联调和物理验证）
```

**设计完成 ≠ 顾客确认 ≠ 可制造 ≠ 已生产或质检通过。**

- 三维预览、导出图片与 GLB（GL Transmission Format Binary，二进制三维资产格式）不是制造证明。
- 程序曲面、布尔运算与材质预览不代表扫描贴合、真实壁厚、打印质量或材料安全已验证。
- 真实身份认证、跨设备数据同步、远程后端、生产权限与设备闭环不能从本地原型能力推定。
- 分享路由不等于跨浏览器、跨设备可用的生产分享服务；相关存储、身份与部署条件需要独立验证。
- 首页内容编排、版权与发布权限、专业美甲师视觉签收及物理制造门禁仍需各自验收。

## 本地启动

使用 Node.js 22.18+（22.x）与 npm。部分专项测试使用 Node 原生 TypeScript 类型剥离能力。

```bash
git clone https://github.com/Henrypann/yt-nail-design-studio.git
cd yt-nail-design-studio
npm ci
npm run dev -- --host 127.0.0.1
```

打开终端显示的地址，默认是 `http://localhost:5173`。仅在需要局域网演示且确认访问边界后，使用 `--host 0.0.0.0`。

| 入口 | 路径 |
| --- | --- |
| 内容社区 | `/` |
| 搜索 / 官方内容 / 创作者 | `/search`、`/official`、`/creators` |
| Studio 工作台 | `/studio` |
| 快速建稿 | `/studio/design/new` |
| 版本化导入 | `/studio/design/import` |
| 编辑器 | `/studio/design/canvas` |
| 顾客只读预览 | `/studio/design/preview` |

编辑器、导入和预览可能需要从上游流程取得有效草稿、版本或参数。登录与设备流程为原型用途，请勿录入真实顾客隐私数据或生产凭据。

## 检查与构建

```bash
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
```

常用专项检查：

```bash
npm run test:i18n
npm run test:community-taxonomy-v2
npm run test:wizard-v0-7-2-import-routing
npm run test:wizard-v0-7-2-fixed-approval
npm run test:geometry-v0-7-2-contract
```

完整脚本见 [package.json](package.json)。端到端测试（End-to-End Testing，E2E）按各脚本要求准备本地服务和 Playwright 浏览器；部分资产验证脚本另需 Python。列出命令不代表每项检查已在当前机器重新执行。

默认构建输出为 `dist/`，Vite 插件会拷贝允许发布的运行时素材。单页应用部署需要配置路由回退到 `index.html`；本 README 不代表部署已完成。

## 技术与结构

React 18 · TypeScript · Vite 5 · Tailwind CSS · React Router · Zustand · Three.js。几何实验另使用 Manifold 与布尔运算库，不因此获得制造能力保证。

```text
src/app/          页面、路由与产品布局
src/community/    社区内容、发现、收藏、分享与治理
src/studio/       建稿、编辑器、几何与预览
src/integration/  跨域衔接
src/platform/     后端接口与平台适配边界
src/lib/          共享能力、存储与国际化
src/design-system/  通用界面组件
assets/           几何、纹理及预览资产
material-library/ 模板与素材清单
tools/            校验、迁移、测试与走查脚本
evidence/         历史验证与交接材料
docs/             协议、架构与历史集成文档
```

核心约束：

- `EditorDocV7 / schemaVersion: 7` 是编辑器设计意图真源；产品版本与文档 Schema（数据结构协议）版本独立。
- 社区通过版本化内容和导入意图进入 Studio，不直接写入编辑器存储。
- 预览是派生结果，渲染失败不得修改设计文档；准确、近似与不可用状态须可区分。
- 制造定义、设备任务、执行证据与顾客确认分层管理，不混写进设计文档。

## 文档入口

- [协作与架构边界](AGENTS.md)
- [界面与交互设计规范](DESIGN.md)
- [产品与需求基线镜像](docs/product-baseline/README.md)：当前同步至 2026-09-04；需求仍为 planned，不代表代码已经实现
- [国际化协议](docs/architecture/I18N_PROTOCOL_V0_7_2.md)
- [素材库说明](material-library/README.md)
- [验证与交接材料](evidence/)
- [历史开发说明](README-dev.md)：保留早期原型记录，其中路由、确认流程等可能已过时，不作为当前功能清单。

历史 PR、证据文件与旧版设计文档保留原名；使用前应核对提交、日期和证据状态。项目代码、示例内容与第三方素材的使用权应分别核验；仓库可访问不表示素材可直接商用或再分发。
