/**
 * 源码反向 PRD 数据（DEV-only 需求说明面板）。
 *
 * 这里记录的是“已经从源码核对过的当前产品行为”，不是未来愿望清单。
 * sourceRefs 把产品文字与实现证据绑定；源码变化后只标记待复核，不自动改写产品语义。
 */

import reviewedHashes from './page-requirement-hashes.json' with { type: 'json' };

export type RequirementStatus = 'implemented' | 'partial' | 'mock' | 'gated' | 'deprecated';
export type SourceRole = 'entry' | 'ui' | 'state' | 'renderer' | 'data' | 'test';

export interface SourceRef {
  path: string;
  symbol: string;
  role: SourceRole;
  /** sha256:<hex>；由 requirements:audit --refresh 在人工复核后更新 */
  reviewedHash: string;
}

export interface ModuleRequirement {
  id: string;
  parentId?: string;
  debugId: string;
  name: string;
  summary: string;
  userValue: string[];
  requirements: string[];
  interactions: string[];
  states: string[];
  dataFlow: string[];
  errors: string[];
  constraints: string[];
  acceptance: string[];
  status: RequirementStatus;
  sourceRefs: SourceRef[];
  reviewedAt: string;
}

export interface PageRequirement {
  match: string;
  pageId: string;
  title: string;
  goal: string;
  entry: string[];
  exit: string[];
  refs: string[];
  modules: ModuleRequirement[];
}

const REVIEWED_AT = '2026-07-29';
const UNREVIEWED = 'pending';

function source(path: string, symbol: string, role: SourceRole): SourceRef {
  const key = `${path}#${symbol}`;
  const hash = (reviewedHashes as Record<string, string>)[key] ?? UNREVIEWED;
  return { path, symbol, role, reviewedHash: hash };
}

type ModuleInput = Pick<ModuleRequirement, 'id' | 'debugId' | 'name' | 'summary'> &
  Partial<Omit<ModuleRequirement, 'id' | 'debugId' | 'name' | 'summary'>>;

function module(input: ModuleInput): ModuleRequirement {
  return {
    id: input.id,
    parentId: input.parentId,
    debugId: input.debugId,
    name: input.name,
    summary: input.summary,
    userValue: input.userValue ?? [],
    requirements: input.requirements ?? [],
    interactions: input.interactions ?? [],
    states: input.states ?? [],
    dataFlow: input.dataFlow ?? [],
    errors: input.errors ?? [],
    constraints: input.constraints ?? [],
    acceptance: input.acceptance ?? [],
    status: input.status ?? 'implemented',
    sourceRefs: input.sourceRefs ?? [],
    reviewedAt: input.reviewedAt ?? REVIEWED_AT,
  };
}

const wizardModules: ModuleRequirement[] = [
  module({
    id: 'studio.wizard.page',
    debugId: 'studio.wizard.page',
    name: 'Wizard 页面与阶段状态',
    summary: '承载从客户与基础规格到十指方案确认的快速设计流程。',
    userValue: ['让美甲师在不进入自由画布的情况下完成可展示、可保存的十指方案。'],
    requirements: ['Step 1 选择客户、甲型和长度；Step 2 完成模板、参数、逐指例外、展示和确认。'],
    interactions: ['已保存设计可从列表重新打开；页面刷新后从草稿恢复。'],
    states: ['加载中、Step 1、Step 2、保存失败、只读冻结。'],
    dataFlow: ['Wizard store 维护编辑态，design-repository 持久化摘要和完整草稿。'],
    errors: ['设计不存在或恢复失败时回到安全入口并给出提示。'],
    constraints: ['确认后的设计不可继续编辑。'],
    acceptance: ['新建、保存、重开、确认和导出链路可闭环。'],
    sourceRefs: [
      source('src/app/pages/design/WizardPage.tsx', 'WizardPage', 'entry'),
      source('src/studio/wizard/wizard-store.ts', 'useWizardStore', 'state'),
    ],
  }),
  module({
    id: 'studio.wizard.step1',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step1',
    name: 'STEP 1 · 基础方案',
    summary: '在进入视觉设计前收敛客户、甲型和长度。',
    requirements: ['同屏展示客户摘要和甲型长度选择；输入完整后才允许生成预览。'],
    interactions: ['应用基础方案后触发一次风格推荐并进入 Step 2。'],
    states: ['未完成、可应用、生成中、生成失败。'],
    constraints: ['不得因 Editor 支持某甲型而绕过 Wizard 能力门禁。'],
    acceptance: ['生成失败留在当前步骤且可重试。'],
    sourceRefs: [source('src/studio/wizard/StepOne.tsx', 'StepOne', 'ui')],
  }),
  module({
    id: 'studio.wizard.step1.live-preview',
    parentId: 'studio.wizard.step1',
    debugId: 'studio.wizard.step1.live-preview',
    name: 'STEP 1 即时单甲预览',
    summary: '在应用基础方案前即时展示当前甲型与长度，降低规格选择的不确定感。',
    requirements: ['选中甲型和长度后渲染代表指甲，并显示 FingerCode、甲型、长度和毫米值。'],
    interactions: ['甲型或长度变化后预览立即同步，不需要进入 Step 2。'],
    states: ['未完整选择、加载、已渲染、资源降级。'],
    constraints: ['仅用于规格确认，不得冒充顾客扫描后的真实贴合预览。'],
    acceptance: ['切换甲型或长度后，标签和单甲轮廓在当前页面更新。'],
    sourceRefs: [source('src/studio/wizard/StepOne.tsx', 'StepOne', 'ui')],
  }),
  module({
    id: 'studio.wizard.step1.apply-error',
    parentId: 'studio.wizard.step1',
    debugId: 'studio.wizard.step1.apply-error',
    name: 'STEP 1 应用失败恢复',
    summary: '基础方案生成失败时保留选择并提供持久、可操作的错误反馈。',
    requirements: ['错误条不自动消失；说明选择已保留；提供明确重试入口。'],
    interactions: ['点击重试后重新应用当前甲型和长度，成功后继续进入 Step 2。'],
    states: ['无错误、生成失败、重试中、恢复成功。'],
    errors: ['渲染或设计初始化失败不得清空客户、甲型和长度。'],
    acceptance: ['错误持续六秒以上仍可见；关闭故障场景后可从原选择恢复。'],
    sourceRefs: [
      source('src/studio/wizard/StepOne.tsx', 'StepOne', 'ui'),
      source('src/studio/wizard/wizard-store.ts', 'useWizardStore', 'state'),
    ],
  }),
  module({
    id: 'studio.wizard.customer',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step1.customer-card',
    name: '客户与 Nail Twin 摘要',
    summary: '显示当前关联客户，并允许在 Wizard 内更换或快速创建客户。',
    userValue: ['把设计与顾客档案关联，同时允许美甲师快速开始。'],
    requirements: ['展示客户姓名、历史设计数与 Twin 摘要。', '支持客户选择和快速建档。'],
    interactions: ['点击更换客户打开选择器；确认后替换当前设计的客户引用。'],
    states: ['已关联客户、匿名草稿、无客户可选、快速创建。'],
    dataFlow: ['CustomerPickerModal 返回 Customer，由 Wizard store 更新 customerId。'],
    errors: ['客户数据读取失败不应破坏当前草稿。'],
    constraints: ['Twin 状态是派生展示，不得冒充真实扫描结果。'],
    acceptance: ['更换客户后摘要即时更新且草稿内容不丢失。'],
    sourceRefs: [
      source('src/studio/wizard/StepOne.tsx', 'StepOne', 'ui'),
      source('src/studio/wizard/CustomerPickerModal.tsx', 'CustomerPickerModal', 'ui'),
    ],
  }),
  module({
    id: 'studio.wizard.shape-length',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step1.shape-length-picker',
    name: '甲型与长度选择',
    summary: '分别选择甲型与长度，并以推荐和警告表达组合适配性。',
    userValue: ['保留真实门店中的自由组合，同时减少明显不协调的选择。'],
    requirements: ['Tier 1 五甲型平铺、Tier 2 折叠。', '当前开放 Almond、Oval、Coffin；其余按能力状态置灰。', '长度为独立变量，不推荐组合只提示、不硬阻断。'],
    interactions: ['选择甲型后更新长度推荐状态；选择完整后应用并生成预览。'],
    states: ['已开放、规划中、几何待签收、模板待适配、推荐、警告。'],
    dataFlow: ['shape-capabilities 控制开放状态；compatibility-rules 提供软提示。'],
    errors: ['轮廓或能力配置读取失败时甲型保持不可用并显示原因。'],
    constraints: ['SVG 存在不等于 Wizard 可用；必须经过能力注册表门禁。'],
    acceptance: ['Wizard 与 Editor 的甲型顺序、开放状态和兼容提示一致。'],
    sourceRefs: [
      source('src/studio/wizard/ShapeLengthPicker.tsx', 'ShapeLengthPicker', 'ui'),
      source('src/studio/compatibility.ts', 'getShapeLengthCompatibility', 'data'),
    ],
  }),
  module({
    id: 'studio.wizard.style-recommend',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.style-recommend-modal',
    name: '风格推荐',
    summary: '根据所选甲型和长度推荐少量可直接应用的款式。',
    userValue: ['帮助美甲师从空白选择快速进入可展示方案。'],
    requirements: ['展示 Top 3 推荐、封面、推荐理由、最佳长度与素材状态。', '概念封面必须同时说明当前画布采用的近似基础模板。'],
    interactions: ['选用后应用映射模板；概念方案应用后提示预览保真边界；跳过、关闭或 Esc 均继续进入画布。'],
    states: ['加载、REAL 素材、CONCEPT 高保真概念、MOCK 素材、空推荐、映射失败。'],
    dataFlow: ['从 styles manifest 读取推荐，再通过 template_id 应用模板。'],
    errors: ['推荐或模板映射失败不阻断进入 Step 2。'],
    constraints: ['CONCEPT 与 MOCK 封面必须明确标识；不得把概念图写成当前画布或可制造结果。'],
    acceptance: ['选择推荐后模板正确应用；概念方案显示近似预览提示；跳过后本设计不重复弹出。'],
    sourceRefs: [source('src/studio/wizard/StyleRecommendModal.tsx', 'StyleRecommendModal', 'ui')],
  }),
  module({
    id: 'studio.wizard.template-gallery',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step2.template-gallery',
    name: '模板库',
    summary: '浏览、筛选并把结构化模板应用到当前十指方案。',
    userValue: ['以精选款式替代从空白画布开始，提高出单速度。'],
    requirements: ['展示模板封面、标签、适配等级与应用入口。', '按推荐、一般、不建议排序，但不硬禁止。', 'Concept 卡必须列出已支持与待实现能力。'],
    interactions: ['标签筛选；点击应用模板；Concept 卡应用已签收的近似基础层；失败后允许重试。'],
    states: ['加载、就绪、REAL 模板、CONCEPT 概念卡、素材缺失、应用中、已选中。'],
    dataFlow: ['material-library index 与对应 shape pattern SVG 共同组成模板。'],
    errors: ['模板索引或图案缺失时显示明确错误，不用纯色静默冒充成功。'],
    constraints: ['模板清单不得散落硬编码。', 'Concept 不得冒充完整可编辑模板或生产结果，必须声明 render_template_id。'],
    acceptance: ['切换正式模板后三视图、单指详情和导出使用同一模板。', 'Mercury Dew Concept 独立出现，应用后保留其名称并提示近似基础层边界。'],
    sourceRefs: [source('src/studio/wizard/TemplateGallery.tsx', 'TemplateGallery', 'ui')],
  }),
  module({
    id: 'studio.wizard.preview-workspace',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step2.preview',
    name: '三视图预览工作区',
    summary: '通过整体搭配、十指平铺和单指细节分别检查组合、层级与细节。',
    userValue: ['让设计结果成为视觉中心，并覆盖美甲师和顾客的不同观察尺度。'],
    requirements: ['整体搭配显示完整手背画布；十指平铺使用五指尺寸层级；单指细节提供大图。'],
    interactions: ['切换三视图；点击手指选择；双击进入单指；整体搭配可切换指尖朝向。'],
    states: ['ensemble、tiled、single、选中指、单指失败、全部失败。'],
    dataFlow: ['三视图共享 shape、template、finish 和 fingerOverrides。'],
    errors: ['单指失败只降级该指；全部失败提供重试。'],
    constraints: ['方向切换和视图模式属于 UI 瞬态，不写入设计文档；不得修改 Slot V2。'],
    acceptance: ['三个视图呈现同一设计；点击热区不受视觉缩放影响。'],
    sourceRefs: [
      source('src/studio/wizard/StepTwo.tsx', 'StepTwo', 'ui'),
      source('src/studio/preview/TenFingerPreview.tsx', 'TenFingerPreview', 'renderer'),
      source('src/studio/preview/TiledNailsPreview.tsx', 'TiledNailsPreview', 'renderer'),
      source('src/studio/preview/SingleNailView.tsx', 'SingleNailView', 'renderer'),
    ],
  }),
  module({
    id: 'studio.preview.ensemble',
    parentId: 'studio.wizard.preview-workspace',
    debugId: 'studio.preview.ensemble',
    name: '整体搭配视图',
    summary: '在完整手背底图上查看十指整体协调和指尖方向。',
    requirements: ['完整显示画布，不裁掉手背背景；支持指尖朝上或朝下。'],
    interactions: ['点击指甲选中；方向按钮对最外层视觉容器旋转 180°。'],
    states: ['指尖朝上、指尖朝下、选中指、只读。'],
    constraints: ['只改变观察方向，不修改设计、甲型或 Slot 坐标。'],
    acceptance: ['方向切换后点击命中仍与视觉一致。'],
    sourceRefs: [source('src/studio/preview/TenFingerPreview.tsx', 'TenFingerPreview', 'renderer')],
  }),
  module({
    id: 'studio.preview.tiled',
    parentId: 'studio.wizard.preview-workspace',
    debugId: 'studio.preview.tiled',
    name: '十指平铺视图',
    summary: '用统一卡片网格和真实感五指层级检查每一指的款式。',
    requirements: ['左右手各五指；Thumb、Index、Middle、Ring、Pinky 使用共享展示比例。'],
    interactions: ['单击选中；双击或明确入口进入单指详情。'],
    states: ['默认、选中、失败、只读。'],
    constraints: ['只缩放内部甲片，不改变卡片、点击热区或几何。'],
    acceptance: ['拇指明显大于中指，小指明显小于中指；导出保持同一层级。'],
    sourceRefs: [
      source('src/studio/preview/TiledNailsPreview.tsx', 'TiledNailsPreview', 'renderer'),
      source('src/studio/finger-display.ts', 'FINGER_DISPLAY_SCALE', 'data'),
    ],
  }),
  module({
    id: 'studio.preview.single',
    parentId: 'studio.wizard.preview-workspace',
    debugId: 'studio.preview.single',
    name: '单指细节视图',
    summary: '以大尺寸检查选中指的颜色、图案、附件和表面效果。',
    requirements: ['单指主体大图、上一指/下一指、十指搭配条。'],
    interactions: ['左右切换手指；选择搭配条；退出回十指平铺。'],
    states: ['当前指、失败重试、只读。'],
    acceptance: ['切换手指不改变设计，只改变观察目标。'],
    sourceRefs: [source('src/studio/preview/SingleNailView.tsx', 'SingleNailView', 'renderer')],
  }),
  module({
    id: 'studio.wizard.finger-detail',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step2.finger-detail',
    name: '常驻单指详情',
    summary: '在不离开主工作区的情况下持续展示当前选中指。',
    requirements: ['未选中时给出操作提示；选中后显示大图、手指标识和覆写摘要。'],
    interactions: ['放大查看进入单指视图。'],
    states: ['未选择、已选择、单独定制、渲染失败。'],
    acceptance: ['选中任一指后详情区同步更新。'],
    sourceRefs: [source('src/studio/wizard/FingerDetailPanel.tsx', 'FingerDetailPanel', 'ui')],
  }),
  module({
    id: 'studio.wizard.params',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step2.params-panel',
    name: '参数与逐指例外',
    summary: '编辑全局底色和表面，或为当前手指设置差分颜色与附件。',
    userValue: ['同时满足快速整套设计和重音指定制。'],
    requirements: ['底色、表面预设、逐指附件、逐指颜色、清除例外、导出和确认。'],
    interactions: ['未选中手指时编辑整套；选中后进入该指单独定制。'],
    states: ['全局、单指、保存中、保存失败、确认弹窗、只读。'],
    dataFlow: ['fingerOverrides 只保存相对全局设计的差分。'],
    errors: ['导出或保存失败显示可重试反馈。'],
    constraints: ['确认后所有编辑控件冻结。'],
    acceptance: ['逐指覆写在保存重开和桥接 Editor 后完整保留。'],
    sourceRefs: [
      source('src/studio/wizard/ParamsPanel.tsx', 'ParamsPanel', 'ui'),
      source('src/studio/wizard/wizard-store.ts', 'useWizardStore', 'state'),
    ],
  }),
  module({
    id: 'studio.presentation',
    parentId: 'studio.wizard.page',
    debugId: 'studio.presentation',
    name: '顾客展示模式',
    summary: '提供全屏只读的大图、重点单指、搭配条和方案信息。',
    userValue: ['作为美甲师面向顾客讲解并确认方案的专用载体。'],
    requirements: ['零编辑控件；显示状态、甲型、长度、底色、质感和重点指。'],
    interactions: ['点击搭配条切换重点指；Esc 或关闭按钮退出。'],
    states: ['草稿展示、已确认冻结、重点指切换。'],
    constraints: ['不得改变设计数据；确认状态必须可见。'],
    acceptance: ['非技术观察者能识别十指搭配和重点细节。'],
    sourceRefs: [source('src/studio/wizard/PresentationMode.tsx', 'PresentationMode', 'ui')],
  }),
  module({
    id: 'studio.wizard.step2.apply-error',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.step2.apply-error',
    name: 'STEP 2 操作失败恢复',
    summary: '在设计画布内统一承载模板、保存或渲染操作失败，并保留当前设计状态。',
    requirements: ['显示持久错误说明和重试入口；不得因错误清空已完成设计。'],
    interactions: ['用户可在原工作区重试失败操作。'],
    states: ['无错误、失败、重试中、恢复。'],
    acceptance: ['错误可见、可重试且不会破坏当前十指方案。'],
    sourceRefs: [
      source('src/studio/wizard/StepTwo.tsx', 'StepTwo', 'ui'),
      source('src/studio/wizard/wizard-store.ts', 'useWizardStore', 'state'),
    ],
  }),
  module({
    id: 'studio.wizard.present-nudge',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.present-nudge',
    name: '保存后的顾客展示引导',
    summary: '首次手动保存成功后，以轻量气泡提醒美甲师把方案转给顾客查看。',
    requirements: ['只在成功保存后出现；每个浏览器会话最多提示一次。'],
    interactions: ['打开顾客展示或关闭提示；关闭后不阻断继续编辑。'],
    states: ['未触发、已显示、会话内已消隐。'],
    constraints: ['普通自动保存不得反复触发；不得使用阻塞式 Modal。'],
    acceptance: ['手动保存后出现一次，进入展示或关闭后本会话不再重复。'],
    sourceRefs: [source('src/studio/wizard/StepTwo.tsx', 'StepTwo', 'ui')],
  }),
  module({
    id: 'studio.presentation.mark-confirmed',
    parentId: 'studio.presentation',
    debugId: 'studio.presentation.mark-confirmed',
    name: '顾客当面确认与冻结',
    summary: '让美甲师在顾客展示界面内明确记录当面确认，并冻结最终设计。',
    userValue: ['把“给顾客看”和“顾客已经确认”变成两个清晰、可追溯的产品状态。'],
    requirements: ['展示界面提供确认入口；二次确认说明冻结后果；完成后显示冻结 Badge。'],
    interactions: ['点击顾客已确认，再通过二次确认完成冻结。'],
    states: ['草稿展示、等待二次确认、已确认冻结。'],
    errors: ['冻结失败时保留展示状态并给出失败反馈。'],
    constraints: ['确认是显式用户动作；不得因打开展示或导出图片自动确认。'],
    acceptance: ['完成两段式确认后保存与编辑入口禁用，展示中可见冻结状态。'],
    sourceRefs: [source('src/studio/wizard/PresentationMode.tsx', 'PresentationMode', 'ui')],
  }),
  module({
    id: 'studio.bridge.wizard-editor',
    parentId: 'studio.wizard.page',
    debugId: 'studio.wizard.bridge',
    name: 'Wizard → Editor 桥接',
    summary: '把快速设计文档转换为可自由编辑的 EditorDoc。',
    requirements: ['等待自动保存完成；首次进入显示不可逆边界；再次进入续开既有 Editor 文档。'],
    interactions: ['点击打开自由画布；保存失败时留在 Wizard。'],
    states: ['未桥接、桥接中、已桥接、保存失败、只读禁止。'],
    dataFlow: ['全局参数和 fingerOverrides 转换为 Editor master/finger 数据与附件。'],
    errors: ['设计不存在或保存失败时阻断跳转并显示原因。'],
    constraints: ['桥接必须幂等；不得静默丢失逐指颜色和附件。'],
    acceptance: ['桥接后重音指、颜色、附件、甲型和长度保持一致。'],
    sourceRefs: [
      source('src/studio/bridge/index.ts', 'openBridge', 'data'),
      source('src/studio/wizard/StepTwo.tsx', 'StepTwo', 'ui'),
    ],
  }),
];

const editorModules: ModuleRequirement[] = [
  module({
    id: 'studio.editor.shell',
    debugId: 'studio.editor.shell',
    name: 'Editor 专业工作区',
    summary: '以单甲画布为中心，组合工具轨道、上下文抽屉、Inspector 和十指条。',
    userValue: ['让熟手自由探索，也让首次使用者沿三步引导完成首个结果。'],
    requirements: ['顶部操作栏、56px 工具轨道、260px 抽屉、中央画布、320px Inspector、底部十指条。'],
    interactions: ['可跳过引导；快捷键 ⌘Z/⌘⇧Z、B、E；未保存离开拦截。'],
    states: ['可编辑、只读冻结、引导展开、抽屉收起、预览/展示/风险弹层。'],
    dataFlow: ['Editor store 是工作区状态源；repo 负责保存和恢复。'],
    errors: ['未保存或保存失败时离开需要二次确认。'],
    constraints: ['1280px 不出现整页横向滚动；只读态不得修改文档。'],
    acceptance: ['熟手可不经过引导直接操作，新用户可沿引导完成首个方案。'],
    sourceRefs: [
      source('src/studio/editor/components/EditorShell.tsx', 'EditorShell', 'entry'),
      source('src/studio/editor/store.ts', 'useEditorStore', 'state'),
    ],
  }),
  module({
    id: 'studio.editor.topbar',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.topbar',
    name: 'Editor 顶部操作栏',
    summary: '集中处理返回、保存状态、撤销重做、帮助、预览、展示、导出和确认。',
    requirements: ['保存状态可见；单指与十指 PNG 导出；确认冻结；打开预览和顾客展示。'],
    interactions: ['撤销/重做；手动保存；导出菜单；未保存离开确认。'],
    states: ['saved、dirty、saving、error、readOnly。'],
    constraints: ['PNG 是当前唯一导出格式；确认后进入只读。'],
    acceptance: ['保存失败可重试；屏幕与导出构图一致。'],
    sourceRefs: [source('src/studio/editor/components/EditorTopBar.tsx', 'EditorTopBar', 'ui')],
  }),
  module({
    id: 'studio.editor.tool-rail',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.tool-rail',
    name: '工具轨道',
    summary: '用四类入口组织款式、绘制、组件和导入。',
    requirements: ['固定窄轨道；当前类别高亮；控制上下文抽屉展开和切换。'],
    interactions: ['点击类别切换抽屉内容；再次点击已选类别重新展开抽屉。'],
    states: ['looks、draw、components、import、drawer closed。'],
    acceptance: ['切换工具不改变当前设计或当前手指。'],
    sourceRefs: [source('src/studio/editor/components/EditorToolRail.tsx', 'EditorToolRail', 'ui')],
  }),
  module({
    id: 'studio.editor.context-drawer',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.context-drawer',
    name: '上下文抽屉与混合引导',
    summary: '显示当前工具的预设和参数，并承载可跳过的首次使用引导。',
    requirements: ['三步引导、Recipe 入口、画笔预设、品牌色、附件和导入入口。'],
    interactions: ['可关闭、跳过、完成后不自动重复；顶栏帮助可重新打开。'],
    states: ['引导、款式、绘制、组件、导入。'],
    constraints: ['引导期间画布和工具始终可操作；普通操作不使用阻塞 Modal。'],
    acceptance: ['首次保存或导出后引导折叠；重新打开不重置设计。'],
    sourceRefs: [source('src/studio/editor/components/EditorContextDrawer.tsx', 'EditorContextDrawer', 'ui')],
  }),
  module({
    id: 'studio.editor.canvas',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.canvas',
    name: '单甲自由画布',
    summary: '在当前甲型轮廓内编辑底色、图案、附件和经典法式。',
    requirements: ['甲型裁剪、画笔、橡皮、元素选择与变换、经典法式三点拖拽。'],
    interactions: ['选择元素；拖拽法式左右翼点和中心点；画布适配；B/E 切换工具。'],
    states: ['单指编辑、整套同步、选择、绘制、擦除、只读。'],
    dataFlow: ['根据 editScope 编辑 master 数据或当前指独立数据。'],
    errors: ['素材或轮廓缺失时不得静默保存错误结果。'],
    constraints: ['法式控制点受甲型边界约束；画布坐标不得反写甲型几何。'],
    acceptance: ['单指模式只改变当前指；整套模式同步十指；法式控制点可凭视觉发现。'],
    sourceRefs: [
      source('src/studio/editor/components/NailCanvas.tsx', 'NailCanvas', 'renderer'),
      source('src/studio/editor/lib/french-edge.ts', 'buildFrenchEdgePaths', 'renderer'),
    ],
  }),
  module({
    id: 'studio.editor.inspector.design',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.inspector.design',
    name: '设计 Inspector',
    summary: '编辑整套甲型、长度、颜色和表面，并显示兼容提示。',
    requirements: ['甲型能力门禁；四档长度；颜色预设；表面预设。'],
    interactions: ['甲型和长度整套生效；颜色遵循底部编辑范围。'],
    states: ['可用、待签收、推荐、警告、E3 gated。'],
    constraints: ['不推荐组合只软提示；未实现 Shader 不得用静态假效果冒充。'],
    acceptance: ['Almond、Oval、Coffin 可用；兼容提示与 Wizard 一致。'],
    sourceRefs: [source('src/studio/editor/components/EditorInspector.tsx', 'DesignInspector', 'ui')],
  }),
  module({
    id: 'studio.editor.layers',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.layers',
    name: 'Layer Inspector',
    summary: '按制造语义管理底色、图案、附件和封层，而非任意图层栈。',
    requirements: ['图案和附件可命名、显示、锁定、复制、删除和分区内排序。', '选中法式后显示参数和定位入口。'],
    interactions: ['点击图层选中画布元素；上下移动；隐藏/锁定；复制；删除。'],
    states: ['空层、选中、隐藏、锁定、单指数据、共享数据。'],
    dataFlow: ['schema v2 保存 name/visible/locked/order。'],
    constraints: ['附件不能拖到底色以下；固定层不可移动。'],
    acceptance: ['排序和状态在撤销重做、镜像、保存重开后保留。'],
    sourceRefs: [source('src/studio/editor/components/LayerPanel.tsx', 'LayerPanel', 'ui')],
  }),
  module({
    id: 'studio.editor.inspector.check',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.inspector.check',
    name: '检查 Inspector',
    summary: '展示二维风险筛查和未来能力边界。',
    requirements: ['检查附件数量、高度参数和边缘距离；明确标记 MOCK。'],
    interactions: ['打开风险检查详情。'],
    states: ['无风险、警告、阻断提示、MOCK。'],
    constraints: ['结果不等于生产可行；不得宣称已完成制造校验。'],
    acceptance: ['界面明确区分视觉模拟与生产验证。'],
    sourceRefs: [
      source('src/studio/editor/components/EditorInspector.tsx', 'EditorInspector', 'ui'),
      source('src/studio/editor/components/RiskScreen.tsx', 'RiskScreen', 'ui'),
    ],
  }),
  module({
    id: 'studio.editor.risk-screen',
    parentId: 'studio.editor.inspector.check',
    debugId: 'studio.editor.risk-screen',
    name: '风险检查详情',
    summary: '列出当前原型规则发现的附件数量、高度和边缘风险。',
    requirements: ['按严重度展示问题类型、影响手指和修正建议。'],
    interactions: ['从检查 Inspector 打开；关闭后回到当前编辑状态。'],
    states: ['无问题、警告列表、强制 Mock 问题。'],
    constraints: ['不得把原型规则描述为生产验证。'],
    acceptance: ['打开和关闭不修改 EditorDoc。'],
    sourceRefs: [source('src/studio/editor/components/RiskScreen.tsx', 'RiskScreen', 'ui')],
  }),
  module({
    id: 'studio.editor.finger-strip',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.finger-strip',
    name: '编辑范围与十指条',
    summary: '明确区分当前单指编辑和整套同步，并提供十指导航与镜像。',
    userValue: ['避免一次编辑意外覆盖十指，同时支持高效批量设计。'],
    requirements: ['单指/整套开关、当前指、主视觉指、独立指状态、镜像、清除例外。'],
    interactions: ['选择手指；切换编辑范围；设为主视觉指；镜像到对侧；恢复共享设计。'],
    states: ['single、all、master、unlocked、readOnly。'],
    constraints: ['切换当前指不自动修改内容；整套编辑必须有明确持续提示。'],
    acceptance: ['单指编辑只改变当前指；切到整套后变更同步十指。'],
    sourceRefs: [source('src/studio/editor/components/FingerStrip.tsx', 'FingerStrip', 'ui')],
  }),
  module({
    id: 'studio.editor.preview',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.preview',
    name: 'Editor 十指预览与顾客展示',
    summary: '在编辑器内检查十指结果或以只读形式向顾客展示。',
    requirements: ['十指平铺、五指尺寸层级、只读展示、PNG 导出一致性。'],
    interactions: ['从顶栏打开和关闭；预览中选择目标指。'],
    states: ['普通预览、presentation、只读。'],
    constraints: ['预览不得改变 EditorDoc。'],
    acceptance: ['屏幕预览与十指 PNG 使用相同构图和比例。'],
    sourceRefs: [
      source('src/studio/editor/components/TiledPreview.tsx', 'TiledPreview', 'renderer'),
      source('src/studio/editor/lib/render.ts', 'composeTiledSvg', 'renderer'),
    ],
  }),
  module({
    id: 'studio.editor.persistence',
    parentId: 'studio.editor.shell',
    debugId: 'studio.editor.persistence',
    name: 'Editor 保存、恢复与迁移',
    summary: '保存 EditorDoc、恢复历史设计并迁移旧 schema。',
    requirements: ['自动/手动保存、错误重试、v1→v2 迁移、确认冻结。'],
    states: ['saved、dirty、saving、error、readOnly。'],
    dataFlow: ['repo 读写文档；migrate 在加载时补齐 schema v2。'],
    errors: ['配额或写入失败保留 dirty/error 状态，不伪装已保存。'],
    constraints: ['旧长度和 finish 映射必须确定且可测试。'],
    acceptance: ['保存重开后设计、排序、可见、锁定与逐指数据一致。'],
    sourceRefs: [
      source('src/studio/editor/lib/repo.ts', 'saveEditorDoc', 'data'),
      source('src/studio/editor/lib/migrate.ts', 'migrateEditorDoc', 'data'),
    ],
  }),
];

const designListModules: ModuleRequirement[] = [
  module({
    id: 'studio.design-list',
    debugId: 'studio.design-list',
    name: '设计资产列表',
    summary: '集中展示 Wizard 和 Editor 设计，并提供打开、展示、确认、版本复制与删除。',
    userValue: ['让门店可以复用历史作品并管理确认状态。'],
    requirements: ['卡片展示缩略图、甲型、长度、状态和更新时间。', '按设计来源进入 Wizard 或 Editor。'],
    interactions: ['打开设计、顾客展示、确认、复制新版本、删除。'],
    states: ['draft、confirmed、submitted、completed、exported、archived、空列表。'],
    dataFlow: ['DesignSummary 决定列表信息；Wizard/Editor repository 保存完整文档。'],
    errors: ['文档缺失或桥接失败时不跳转并提示。'],
    constraints: ['确认设计冻结；修改必须复制新版本。'],
    acceptance: ['Wizard 和 Editor 来源能回到正确入口；保存后的缩略图可见。'],
    sourceRefs: [source('src/app/pages/design/DesignListPage.tsx', 'DesignListPage', 'entry')],
  }),
];

function legacyModule(
  id: string,
  debugId: string,
  name: string,
  summary: string,
  requirements: string[],
): ModuleRequirement {
  return module({ id, debugId, name, summary, requirements, status: 'partial' });
}

export const PAGE_REQUIREMENTS: readonly PageRequirement[] = [
  {
    match: '/design/new',
    pageId: 'studio.wizard',
    title: 'Studio Wizard · 新建设计',
    goal: '从客户与基础规格开始，快速产出可保存、可展示、可确认并可桥接 Editor 的十指方案。',
    entry: ['设计列表新建入口', '重新打开 Wizard 来源草稿'],
    exit: ['保存草稿', '顾客确认冻结', '导出 PNG', '桥接自由画布'],
    refs: ['Studio 源码反向审查 2026-07-29', 'shape-capabilities', 'compatibility-rules'],
    modules: wizardModules,
  },
  {
    match: '/design/canvas',
    pageId: 'studio.editor',
    title: 'Studio Editor · 自由画布',
    goal: '在单甲画布中进行结构化自由设计，并同步检查十指、展示、保存与导出结果。',
    entry: ['Wizard 桥接', '设计列表打开 Editor 来源设计', '空白画布新建'],
    exit: ['保存', '确认冻结', '导出单指或十指 PNG', '返回设计列表'],
    refs: ['Editor E0/E1/E2 源码反向审查 2026-07-29'],
    modules: editorModules,
  },
  {
    match: '/design',
    pageId: 'studio.design-list',
    title: '我的设计',
    goal: '管理门店设计资产、状态、版本和后续编辑入口。',
    entry: ['主导航设计入口'],
    exit: ['新建设计', '打开 Wizard/Editor', '顾客展示'],
    refs: ['DesignListPage 源码反向审查 2026-07-29'],
    modules: designListModules,
  },
  {
    match: '/customers/new',
    pageId: 'app.customers.new',
    title: '新建客户',
    goal: '以姓名和隐私同意完成最快建档。',
    entry: ['客户列表', 'Wizard 快速建档'],
    exit: ['客户详情', '返回来源页面'],
    refs: ['Studio-PRD §5'],
    modules: [legacyModule('app.customers.new', 'app.customers.new', '建档表单', '创建客户档案。', ['姓名与隐私同意必填；其余资料可后补。'])],
  },
  {
    match: '/customers/',
    pageId: 'app.customers.detail',
    title: '客户详情',
    goal: '查看和维护客户档案及历史设计。',
    entry: ['客户列表'],
    exit: ['保存后返回客户列表'],
    refs: ['Studio-PRD §5'],
    modules: [legacyModule('app.customers.detail', 'app.customers.detail', '档案详情', '维护单客户资料。', ['支持内联编辑、历史设计与软删除。'])],
  },
  {
    match: '/customers',
    pageId: 'app.customers',
    title: '客户管理',
    goal: '管理客户档案与设计关联。',
    entry: ['主导航客户入口'],
    exit: ['客户详情', '新建客户'],
    refs: ['Studio-PRD §5'],
    modules: [legacyModule('app.customers.list', 'app.customers.list', '客户列表', '浏览和检索客户。', ['展示基础资料、Twin 摘要和历史设计数。'])],
  },
  {
    match: '/devices/bind/mobile',
    pageId: 'app.devices.mobile-bind',
    title: '手机辅助配网',
    goal: '通过一次性链接辅助设备配网。',
    entry: ['电脑端二维码'],
    exit: ['提交后回电脑继续'],
    refs: ['Studio-PRD §9'],
    modules: [legacyModule('app.devices.mobile-bind', 'app.devices.mobile-bind', '移动端配网', '提交 WiFi 信息。', ['Token 一次性且有有效期。'])],
  },
  {
    match: '/devices/bind',
    pageId: 'app.devices.bind-wizard',
    title: '设备配网向导',
    goal: '通过 Mock 流程完成设备绑定演示。',
    entry: ['设备列表'],
    exit: ['绑定完成返回列表'],
    refs: ['Studio-PRD §6–§9'],
    modules: [legacyModule('app.devices.bind-wizard', 'app.devices.bind-wizard', '配网向导', '完成设备发现、网络配置和命名。', ['当前能力为 MOCK IOT。'])],
  },
  {
    match: '/devices',
    pageId: 'app.devices',
    title: '设备管理',
    goal: '查看和绑定门店设备。',
    entry: ['主导航设备入口'],
    exit: ['设备绑定'],
    refs: ['Studio-PRD §6–§10'],
    modules: [legacyModule('app.devices.list', 'app.devices.list', '设备列表', '展示设备状态。', ['展示在线、离线和忙碌状态。'])],
  },
  {
    match: '/login',
    pageId: 'app.auth.login',
    title: '登录',
    goal: '通过邮箱和 Mock 验证码进入门店。',
    entry: ['未认证访问'],
    exit: ['Dashboard', '注册'],
    refs: ['Studio-PRD §2'],
    modules: [legacyModule('app.auth.login', 'app.auth.login', '登录表单', '完成两步登录。', ['Mock 验证码固定为 123456。'])],
  },
  {
    match: '/register',
    pageId: 'app.auth.register',
    title: '注册',
    goal: '创建账号与门店。',
    entry: ['未注册邮箱登录'],
    exit: ['Dashboard'],
    refs: ['Studio-PRD §2'],
    modules: [legacyModule('app.auth.register', 'app.auth.register', '注册向导', '完成邮箱验证和门店初始化。', ['门店名称必填。'])],
  },
  {
    match: '/',
    pageId: 'app.dashboard',
    title: 'Dashboard',
    goal: '提供客户、设计和设备三类核心入口。',
    entry: ['登录或注册完成'],
    exit: ['客户', '设计', '设备'],
    refs: ['Studio-PRD §4'],
    modules: [legacyModule('app.dashboard', 'app.dashboard', '首页引导', '进入核心业务流程。', ['展示三类入口和门店摘要。'])],
  },
  {
    match: '*',
    pageId: 'app.not-found',
    title: '404 页面未找到',
    goal: '未知路由统一兜底。',
    entry: ['未知路由'],
    exit: ['返回首页'],
    refs: ['路由兜底'],
    modules: [legacyModule('app.not-found', 'app.not-found', '404 空状态', '提示页面不存在。', ['提供返回首页入口。'])],
  },
];

export const STUDIO_PAGE_REQUIREMENTS = PAGE_REQUIREMENTS.filter((page) =>
  page.pageId.startsWith('studio.'),
);

export function flattenStudioRequirements(): Array<{
  page: PageRequirement;
  module: ModuleRequirement;
}> {
  return STUDIO_PAGE_REQUIREMENTS.flatMap((page) =>
    page.modules.map((item) => ({ page, module: item })),
  );
}

/** 路由 → 页面需求（最长前缀匹配；无匹配时回退 '*'） */
export function resolvePageRequirement(pathname: string): PageRequirement | null {
  let best: PageRequirement | null = null;
  let fallback: PageRequirement | null = null;
  for (const page of PAGE_REQUIREMENTS) {
    if (page.match === '*') {
      fallback = page;
      continue;
    }
    const matches =
      pathname === page.match ||
      pathname.startsWith(page.match.endsWith('/') ? page.match : `${page.match}/`) ||
      (page.match === '/' && pathname === '/');
    if (matches && (!best || page.match.length > best.match.length)) best = page;
  }
  return best ?? fallback;
}

export function requirementLocator(page: PageRequirement, item: ModuleRequirement): string {
  const primary = item.sourceRefs[0];
  return [
    `module: ${item.id}`,
    `route: ${page.match}`,
    `debugId: ${item.debugId}`,
    `source: ${primary ? `${primary.path}#${primary.symbol}` : 'not-mapped'}`,
  ].join('\n');
}

export function requirementMarkdown(page: PageRequirement, item: ModuleRequirement): string {
  const section = (title: string, values: string[]) =>
    values.length ? `\n## ${title}\n${values.map((value) => `- ${value}`).join('\n')}\n` : '';
  return [
    `# ${item.name}`,
    '',
    `- Module: \`${item.id}\``,
    `- Route: \`${page.match}\``,
    `- Debug ID: \`${item.debugId}\``,
    `- Status: \`${item.status}\``,
    `- Reviewed: ${item.reviewedAt}`,
    '',
    item.summary,
    section('用户价值', item.userValue),
    section('功能需求', item.requirements),
    section('交互说明', item.interactions),
    section('状态', item.states),
    section('数据流', item.dataFlow),
    section('异常与降级', item.errors),
    section('约束与红线', item.constraints),
    section('验收标准', item.acceptance),
    item.sourceRefs.length
      ? `\n## 源码证据\n${item.sourceRefs.map((ref) => `- \`${ref.path}#${ref.symbol}\` (${ref.role})`).join('\n')}\n`
      : '',
  ].join('\n');
}
