/** 路由表常量（PRD §1.4，全 13 条）：页面模块统一引用，禁止散落硬编码路径 */
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
  designCommunity: '/design/community', // 社区页（基础 mock，未接真实数据）
  designCanvas: '/design/canvas', // Studio Editor
  devices: '/devices',
  deviceBind: '/devices/bind',
  deviceBindMobile: (token: string) => `/devices/bind/mobile/${token}`,
  deviceBindMobilePath: '/devices/bind/mobile/:token',
} as const;
