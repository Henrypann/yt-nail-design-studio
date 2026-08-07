/** 路由表常量（PRD §1.4 + Community 独立域）：页面模块统一引用，禁止散落硬编码路径 */
export const Routes = {
  login: '/login',
  register: '/register',
  dashboard: '/',
  customers: '/customers',
  customerNew: '/customers/new',
  customerDetail: (id: string) => `/customers/${id}`,
  customerDetailPath: '/customers/:id',
  designs: '/design',
  designNew: '/design/new', // Studio Wizard（默认入口）
  designTemplates: '/design/templates', // 选款页（甲型/长度确认后的模板选择，社区demo入口）
  /** @deprecated 兼容旧链；replace → /community/official */
  designCommunity: '/design/community',
  designCanvas: '/design/canvas', // Studio Editor
  devices: '/devices',
  deviceBind: '/devices/bind',
  deviceBindMobile: (token: string) => `/devices/bind/mobile/${token}`,
  deviceBindMobilePath: '/devices/bind/mobile/:token',
  /** Community 独立产品域 */
  community: '/community',
  communityOfficial: '/community/official',
  communityCreators: '/community/creators',
  communityContent: (contentId: string) => `/community/content/${contentId}`,
  communityContentPath: '/community/content/:contentId',
  communityProfile: (handle: string) => `/community/profile/${handle}`,
  communityProfilePath: '/community/profile/:handle',
} as const;
