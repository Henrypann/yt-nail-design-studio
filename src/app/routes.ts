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
  designCustomerPreview: '/design/preview', // V7 顾客只读预览
  devices: '/devices',
  deviceBind: '/devices/bind',
  deviceBindMobile: (token: string) => `/devices/bind/mobile/${token}`,
  deviceBindMobilePath: '/devices/bind/mobile/:token',
  /** Community 独立产品域 */
  community: '/community',
  /** Explore & Search（COMM-V7.1-02）：/community 为 Discover，/community/search 为 Search。 */
  communitySearch: '/community/search',
  communityOfficial: '/community/official',
  communityCreators: '/community/creators',
  /**
   * @deprecated 兼容旧链（COMM-V7.1-01）：/community/content/:contentId 由
   * CommunityLegacyContentRedirect 以 replace 重定向到 canonical look 路由，
   * 完整保留 query params。产品链接请使用 Routes.communityLook。
   */
  communityContent: (contentId: string) => `/community/content/${contentId}`,
  communityContentPath: '/community/content/:contentId',
  /** Canonical 可分享详情路由（COMM-V7.1-01）。 */
  communityLook: (lookId: string) => `/community/look/${lookId}`,
  communityLookPath: '/community/look/:lookId',
  communityProfile: (handle: string) => `/community/profile/${handle}`,
  communityProfilePath: '/community/profile/:handle',
} as const;

/**
 * Legacy /community/content/:contentId → canonical /community/look/:lookId
 * 重定向目标（保留 query params；replace 语义由调用组件负责）。
 * 纯函数：无副作用、可确定性测试。
 */
export function legacyContentRedirectTarget(
  contentId: string | undefined,
  params: URLSearchParams,
): string {
  if (!contentId) return Routes.communityOfficial;
  const target = Routes.communityLook(contentId);
  const query = params.toString();
  return query ? `${target}?${query}` : target;
}

/** User-facing “New design” intent. Plain /design/new remains draft resume. */
export function designNewFresh(customerId?: string): string {
  const params = new URLSearchParams({ fresh: '1' });
  if (customerId) params.set('customerId', customerId);
  return `${Routes.designNew}?${params.toString()}`;
}
