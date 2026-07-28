/**
 * 页面需求描述数据（调试面板 · 需求说明 tab，v1.5.1）
 *
 * 目的：所见即所得 —— 在当前页面直接查阅该页/模块的需求、交互与逻辑，
 * 不必切换 PRD/DEV-PLAN 原文。写作约定（agent & human friendly）：
 * - 每条一句话、可执行、可验收；先「做什么」再「怎么用」再「约束/红线」
 * - modules[].debugId 与页面上的 data-debug-id 一一对应（元素 ID tab 可复制）
 * - refs 指向权威文档章节；冲突时以 DEV-PLAN 冲突仲裁规则为准
 * 新增页面/模块时在此追加条目，调试面板自动渲染。
 */

export interface ModuleRequirement {
  /** 对应页面上的 data-debug-id（缺省 = 页面级说明） */
  debugId?: string;
  name: string;
  /** 模块需求：做什么 */
  requirements: string[];
  /** 交互说明：怎么用 */
  interactions: string[];
  /** 逻辑与红线：约束、状态机、禁止项 */
  logic: string[];
}

export interface PageRequirement {
  /** 路由前缀（取最长匹配，如 /design/new 先于 /design） */
  match: string;
  pageId: string;
  title: string;
  /** 一句话目标 */
  goal: string;
  refs: string[];
  modules: ModuleRequirement[];
}

export const PAGE_REQUIREMENTS: readonly PageRequirement[] = [
  {
    match: '/design/new',
    pageId: 'studio.wizard',
    title: 'Studio Wizard · 新建设计',
    goal: '3 步出单：选客户 → 甲型/长度（+ 风格推荐）→ 三栏画布确认，产出可保存的十指设计。',
    refs: ['Studio-PRD §12.4', 'DEV-PLAN §5.10 / §5.11'],
    modules: [
      {
        debugId: 'studio.wizard.step1.customer-card',
        name: '客户卡片（STEP 1）',
        requirements: ['展示当前客户姓名、历史设计数、Nail Twin 三态提示', '支持不离开 Wizard 更换客户'],
        interactions: ['[更换客户] 打开客户选择器弹窗，确认后替换当前客户'],
        logic: ['Twin 三态为 MOCK 值，展示必须标 MOCK', '客户为必填前置：无客户不得进入 STEP 1'],
      },
      {
        debugId: 'studio.wizard.step1.shape-length-picker',
        name: '甲型 + 长度选择（STEP 1）',
        requirements: ['Tier 1 五甲型平铺、Tier 2 十甲型折叠 × 四档长度（14/18/22/26mm）', '能力未就绪甲型按规划中/校准中/模板适配中置灰'],
        interactions: ['[应用 → 预览十指] 触发风格推荐弹窗（每个设计一次），选用/跳过后进入 STEP 2'],
        logic: ['置灰门禁读取 shape-capabilities；开放甲型必须同时满足几何签收、模板完整、风格完整与 Wizard enabled', '未选满甲型+长度时按钮禁用'],
      },
      {
        debugId: 'studio.wizard.style-recommend-modal',
        name: '风格推荐弹窗',
        requirements: ['按当前甲型展示流行风格 Top 3：16:9 封面大卡 + 优先级 + 最佳长度 + 理由'],
        interactions: ['[选用此风格] 自动应用映射模板并进入画布；[暂不选择]/Esc/关闭 = 跳过且本设计不再弹'],
        logic: ['数据一律 fetch assets/styles/manifest.json，禁止硬编码', 'cover_status=MOCK 强制角标，不得冒充正式图', 'template_id 映射失败不阻断进画布'],
      },
      {
        debugId: 'studio.wizard.step2.template-gallery',
        name: '模板库（左栏）',
        requirements: ['12 模板图文卡片 + 七类风格标签筛选（全部/当下流行/甜美/简约/酷炫/复古/奢华/节日）', '按当前甲型三档排序：推荐 → 一般 → 不建议（仍可选）'],
        interactions: ['[应用此模板] 预览淡出 150ms → 新图案淡入 200ms；再次点击同一模板 = 重新应用'],
        logic: ['数据来自 material-library/index.json + patterns/*.svg', '不建议项饱和度 60% + 可读原因，不建议 ≠ 禁止'],
      },
      {
        debugId: 'studio.wizard.step2.preview',
        name: '十指预览（中栏 · Back 单视图）',
        requirements: ['NailSlot V2 标定线稿渲染十指（back-v2.1.0），甲根固定、长度向甲尖伸缩', '单指失败灰甲型 + ⚠️ 降级，其余 9 指正常；全部失败可刷新重试'],
        interactions: ['点击某指 → 右栏进入该指单独定制；再点一次取消选中'],
        logic: ['V2 坐标域废止 nailScale/PX_PER_MM（v1.4.1 Palm 已软删除）', '预览 svg 注册供导出 PNG / 列表缩略图'],
      },
      {
        debugId: 'studio.wizard.step2.params-panel',
        name: '参数面板（右栏）',
        requirements: ['底色（8 色色板）+ 封层质感 + 逐指例外（换色/换附件）+ 保存与确认操作'],
        interactions: ['选中手指后可单独换底色/附件；[清除该指定制] = 删除该指差分覆写'],
        logic: ['覆写只存差分（DesignSet 契约 §5.11）', '防抖自动保存 + 失败重试；confirmed 后整页只读'],
      },
    ],
  },
  {
    match: '/design/canvas',
    pageId: 'studio.editor',
    title: 'Studio Editor · 自由画布',
    goal: '进阶模式：在甲型轮廓内做 2D 自由创作与十指编排（不进首发验收路径）。',
    refs: ['Studio-PRD §13', 'DEV-PLAN §5.11⑥'],
    modules: [
      {
        debugId: 'studio.editor.shell',
        name: 'Editor 画布壳',
        requirements: ['单甲画布 + 图层（底色/图案/附件）+ 撤销重做 + 十指平铺预览 + P0 风险筛查'],
        interactions: ['快捷键 ⌘Z/⌘⇧Z 撤销重做；B 画笔 / E 橡皮', 'confirmed 设计进入即只读冻结横幅'],
        logic: ['从 Wizard 桥接进入有不可逆警告（不能再切模板）', '渲染器独立，收敛共享组件为后续专项（§5.11⑥）'],
      },
    ],
  },
  {
    match: '/design',
    pageId: 'studio.design-list',
    title: '我的设计',
    goal: '设计资产列表：缩略图、状态、版本链与确认闭环入口。',
    refs: ['Studio-PRD §14', 'DEV-PLAN §6.2'],
    modules: [
      {
        debugId: 'studio.design-list',
        name: '设计列表',
        requirements: ['卡片展示缩略图/甲型/长度/状态/版本；支持删除与「基于已确认设计创建新版本」'],
        interactions: ['点卡片进入对应来源（wizard / editor）；[顾客已确认] 手动标记 → 冻结只读'],
        logic: ['确认 = 线下场景，无线上发送动作', '状态机六值：draft/confirmed/submitted/completed/exported/archived'],
      },
    ],
  },
  {
    match: '/customers',
    pageId: 'app.customers',
    title: '客户管理',
    goal: '客户档案：列表、新建（隐私同意）、详情内联编辑、软删除。',
    refs: ['Studio-PRD §5'],
    modules: [
      {
        debugId: 'app.customers.list',
        name: '客户列表',
        requirements: ['姓名/联系方式/过敏与偏好备注/Twin 状态展示；新建与快速建档'],
        interactions: ['新建必填隐私政策同意（弹窗 * 必选）', '软删除后从列表移除、历史设计保留'],
        logic: ['同门店 email 唯一', '隐私同意时间戳入库强制'],
      },
    ],
  },
  {
    match: '/devices',
    pageId: 'app.devices',
    title: '设备管理',
    goal: '扫描仪/3D 打印/UV 打印设备的绑定与状态管理（MOCK IOT）。',
    refs: ['Studio-PRD §6–§10'],
    modules: [
      {
        name: '设备绑定 + 列表',
        requirements: ['四路径 6 步绑定向导；设备列表展示在线/离线/忙碌'],
        interactions: ['十类异常（发现超时/WiFi 错误/已绑定等）可由调试面板 · 场景 Mock 注入复现'],
        logic: ['device_code 绑定；并发绑定跨标签互斥锁', '手机交接 Token 一次性 + 过期'],
      },
    ],
  },
  {
    match: '/',
    pageId: 'app.dashboard',
    title: 'Dashboard · 首页',
    goal: '门店工作台入口：三引导卡 + 关键数据一览。',
    refs: ['Studio-PRD §4'],
    modules: [
      {
        debugId: 'app.dashboard',
        name: '首页引导',
        requirements: ['新建客户 / 新建设计 / 设备绑定三入口卡', '展示门店名与待办提示'],
        interactions: ['卡片点击直达对应流程'],
        logic: ['数据均来自 localStorage envelope（FRONTEND_MOCK 证据级）'],
      },
    ],
  },
  {
    match: '/login',
    pageId: 'app.auth.login',
    title: '登录',
    goal: '邮箱 + Mock 验证码登录，未注册账号自动流转注册。',
    refs: ['Studio-PRD §2', 'DEV-PLAN §6 Sprint 1'],
    modules: [
      {
        debugId: 'app.auth.login',
        name: '登录表单',
        requirements: ['邮箱 + 验证码两步登录', '未注册邮箱登录后自动进入注册流程'],
        interactions: ['[获取验证码] Mock 验证码固定 123456，冷却 60s', '验证码错误次数超限锁定（调试面板可注入发送失败/立即过期）'],
        logic: ['FRONTEND_MOCK：账号注册表存 localStorage（auth.accounts）', 'Token 过期强制登出 → 跳回 /login（session.expired 场景）'],
      },
    ],
  },
  {
    match: '/register',
    pageId: 'app.auth.register',
    title: '注册（两步）',
    goal: '邮箱验证码 → 门店名称，两步完成门店初始化并进入 Dashboard。',
    refs: ['Studio-PRD §2'],
    modules: [
      {
        debugId: 'app.auth.register',
        name: '注册向导',
        requirements: ['Step 1 邮箱 + 验证码；Step 2 门店名称（2–30 字符）', '完成后写入 session 并跳转 Dashboard'],
        interactions: ['已登录会话访问 /register 直接重定向首页'],
        logic: ['门店名为顶栏唯一展示文本，无门店设置页', '三引导卡（新建客户/新建设计/设备绑定）为注册后首屏'],
      },
    ],
  },
  {
    match: '/customers/new',
    pageId: 'app.customers.new',
    title: '新建客户',
    goal: '最快路径建档：姓名 + 隐私同意即可创建，其余信息可后补。',
    refs: ['Studio-PRD §5'],
    modules: [
      {
        debugId: 'app.customers.new',
        name: '建档表单',
        requirements: ['姓名（2–60 字符）必填；email 同门店唯一；过敏/偏好备注 ≤500 字符', '隐私政策同意为创建前置（必选）'],
        interactions: ['quick 模式：勾选同意 → 直接创建；full 模式：提交 → 隐私弹窗确认'],
        logic: ['隐私同意时间戳（privacyConsentAt）入库强制', 'Twin 数据保存同意（twinConsent）为可选项'],
      },
    ],
  },
  {
    match: '/customers/',
    pageId: 'app.customers.detail',
    title: '客户详情',
    goal: '单客户档案：信息内联编辑、历史设计入口、软删除。',
    refs: ['Studio-PRD §5'],
    modules: [
      {
        debugId: 'app.customers.detail',
        name: '档案详情',
        requirements: ['基础信息/过敏与偏好备注内联编辑即时保存', '展示 Twin 状态与历史设计数'],
        interactions: ['软删除需确认；删除后从列表移除、历史设计保留'],
        logic: ['email 唯一性校验在编辑保存时同样生效', '软删除 ≠ 物理删除（deleted 标记）'],
      },
    ],
  },
  {
    match: '/devices/bind/mobile',
    pageId: 'app.devices.mobile-bind',
    title: '手机辅助配网（移动端）',
    goal: '手机扫码打开一次性链接，辅助完成设备 WiFi 配网信息提交。',
    refs: ['Studio-PRD §9'],
    modules: [
      {
        debugId: 'app.devices.mobile-bind',
        name: '移动端配网提交',
        requirements: ['免登录极简页：品牌头 + WiFi 信息表单 + 提交状态'],
        interactions: ['提交成功提示回电脑继续；链接过期/已用显示对应失效态'],
        logic: ['Token 一次性 + 有效期（tokenReused/tokenExpired 场景可注入）', '独立路由不带侧栏布局'],
      },
    ],
  },
  {
    match: '/devices/bind',
    pageId: 'app.devices.bind-wizard',
    title: '设备配网向导（6 步）',
    goal: '四条 Mock 路径（扫码/热点/手机辅助/手动）完成扫描仪、3D 打印、UV 打印设备绑定。',
    refs: ['Studio-PRD §6–§9'],
    modules: [
      {
        debugId: 'app.devices.bind-wizard',
        name: '配网向导',
        requirements: ['设备类型选择 → 路径选择 → 发现/配网 → 命名 → 完成，全程标注 MOCK IOT', '向导会话 5 分钟 TTL，刷新可恢复进度'],
        interactions: ['十类异常（发现超时/WiFi 错误/已绑定/Token 过期等）由调试面板 · 场景 Mock 注入'],
        logic: ['device_code 绑定；并发绑定跨标签互斥锁（device.bind-lock）', '绑定成功写入设备列表（在线/离线/忙碌三态）'],
      },
    ],
  },
  {
    match: '*',
    pageId: 'app.not-found',
    title: '404 页面未找到',
    goal: '未知路由的统一兜底，提供返回首页出口。',
    refs: ['Studio-PRD §6.3'],
    modules: [
      {
        debugId: 'app.not-found',
        name: '404 空状态',
        requirements: ['空状态插画 + 「页面未找到」说明 + [返回首页]'],
        interactions: ['点击返回首页（/）'],
        logic: ['通配路由 * 捕获；不记录错误、不跳转登录'],
      },
    ],
  },
];

/** 路由 → 页面需求（最长前缀匹配；无匹配时回退 '*' 兜底条目） */
export function resolvePageRequirement(pathname: string): PageRequirement | null {
  let best: PageRequirement | null = null;
  let fallback: PageRequirement | null = null;
  for (const p of PAGE_REQUIREMENTS) {
    if (p.match === '*') {
      fallback = p;
      continue;
    }
    if (pathname === p.match || pathname.startsWith(p.match.endsWith('/') ? p.match : `${p.match}/`) || (p.match === '/' && pathname === '/')) {
      if (!best || p.match.length > best.match.length) best = p;
    }
  }
  return best ?? fallback;
}
