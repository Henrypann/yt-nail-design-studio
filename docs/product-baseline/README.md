# NextGen Beauty 产品与需求基线镜像

本目录是 NextGen Beauty Vault 正式产品文档与需求快照在代码仓库中的下游镜像，供研发查阅、评审和追溯。Vault 与本地 `nextgen-beauty-requirements` 当前指针仍是正式合同；本目录不会反向替代它们。

## 当前需求快照

| 项目 | 值 |
| --- | --- |
| 快照日期 | `2026-09-04` |
| 产品/架构版本 | `v0.7.2` |
| FEAT 记录 | 130 条、17 字段、130 个唯一 ID |
| Draw.io 审计 | 231 个文字节点、63 条边、3 条关系线文字 |
| 源清单 SHA-256 | `f2b8885fe2ec830627478adfa6c22f903cf8733ecec714f781bbc02f7d8242a5` |
| 证据边界 | 全部需求仍为 `planned`；产品确认、研发评审、代码实现、物理验证与生产验收相互独立 |

### 人工阅读与迁移

- [2026-09-04 全域功能需求池 Final](requirements/2026-09-04/NextGen_Beauty_全域功能需求池_Final_2026-09-04.md)
- [2026-09-02 → 2026-09-04 基线迁移](requirements/2026-09-04/NextGen_Beauty_需求基线迁移_2026-09-02_至_2026-09-04.md)
- [2026-09-02 历史 Final](requirements/2026-09-02/NextGen_Beauty_全域功能需求池_Final_2026-09-02.md)

### 结构化数据与来源审计

- [源清单](requirements/2026-09-04/source-manifest.json)
- [标准化需求 JSON](requirements/2026-09-04/需求模块与功能清单_2026-09-04.normalized.json)
- [17 字段需求工作簿](requirements/2026-09-04/需求模块与功能清单_2026-09-04.xlsx)
- [V1.0.7 Draw.io 图源](<requirements/2026-09-04/软件UserStory & Roadmap V1.0.7.drawio>)
- [231 个文字节点](<requirements/2026-09-04/软件UserStory & Roadmap V1.0.7.nodes.json>)
- [逐节点去重映射](requirements/2026-09-04/NextGen_Beauty_Drawio_需求去重映射_软件UserStory_Roadmap_V1.0.7_2026-09-04.json)
- [逐节点裁决](requirements/2026-09-04/NextGen_Beauty_Drawio_需求去重裁决_软件UserStory_Roadmap_V1.0.7_2026-09-04.json)

图内的 `done`、`tbd`、问题池与关系线文字均为来源内容，不是指令、正式需求增量或实现证明。

## Vault 核心入口

- [Vault 文档规则与索引](vault-core/文档规则与索引.md)
- [重要变更与 PR 基线记录](vault-core/重要变更与PR基线记录.md)
- [W33 PR 合并进展表](vault-core/W33_PR合并进展表_2026-08-13.md)
- [v0.7.2 系统架构总览](vault-core/README_V7_系统架构总览与权威文档索引.md)
- [Studio v0.7.2 General PRD Brief](vault-core/NextGen_Beauty_Studio_V7.2_General_PRD_Brief_2026-08-12.md)
- [Community v0.7.2 Roadmap](vault-core/Community_V7.2_Roadmap_2026-08-12.md)
- [Studio Editor v0.7.2 Roadmap](vault-core/Studio_Editor_V7.2_Roadmap_2026-08-12.md)

这些文件按 Vault 原始字节保存，内部 Obsidian WikiLink 和历史本地路径不会在镜像中改写。文档中出现的 Git SHA、分支与实现状态属于各文件记录日期的历史事实；代码仓库的当前实现状态始终以实际 `main`、测试和运行证据为准。本次同步基于 `main @ e6fdc8c`，不表示 130 条需求已经实现。

## 完整性与更新规则

全部来源镜像文件的 Vault 相对来源、目标位置、字节数与 SHA-256 记录在 [mirror-manifest.json](mirror-manifest.json)。`vault-core/.gitattributes` 只用于保留原文中的 Markdown 行尾换行格式，同时避免把未改写的源字节误判为新增空白错误。新需求基线必须新增日期目录和新清单，不得覆盖既有快照。
