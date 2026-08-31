/**
 * 产品路由合同。
 *
 * 单体部署阶段：Community 挂载在 `/`，Nail Design Studio 挂载在 `/studio`。
 * 独立部署阶段：product-navigation 会把 `/studio/*` 映射为 Studio origin 下的 `/*`，
 * 因此跨产品入口不得自行拼接 URL。
 */
export const Routes = {
  login: '/login',
  register: '/register',
  studio: '/studio',
  studioHome: '/studio',
  dashboard: '/studio/customers/dashboard',
  customers: '/studio/customers',
  customerNew: '/studio/customers/new',
  customerDetail: (id: string) => `/studio/customers/${id}`,
  customerDetailPath: '/studio/customers/:id',
  designs: '/studio/design',
  designNew: '/studio/design/new', // Studio Wizard（默认入口）
  designImport: '/studio/design/import', // Community canonical versioned import preflight
  designConfirmed: '/studio/design/confirmed', // Community-confirmed DesignVersion list
  designTemplates: '/studio/design/templates', // 选款页（甲型/长度确认后的模板选择）
  /** @deprecated 兼容旧链；replace → /official */
  designCommunity: '/studio/design/community',
  designCanvas: '/studio/design/canvas', // Studio Editor
  designCustomerPreview: '/studio/design/preview', // V7 顾客只读预览
  devices: '/studio/devices',
  deviceBind: '/studio/devices/bind',
  deviceBindMobile: (token: string) => `/studio/devices/bind/mobile/${token}`,
  deviceBindMobilePath: '/studio/devices/bind/mobile/:token',
  /** Nail Lover Community 公共产品域。 */
  community: '/',
  communitySearch: '/search',
  communityOfficial: '/official',
  communityCreators: '/creators',
  communityCreatorWorkspace: '/creator',
  communityClientShare: (token: string) => `/share/${token}`,
  communityClientSharePath: '/share/:token',
  communityGovernance: '/creator/governance',
  /**
   * @deprecated 兼容旧链（COMM-V7.1-01）：/community/content/:contentId 由
   * CommunityLegacyContentRedirect 以 replace 重定向到 canonical look 路由，
   * 完整保留 query params。产品链接请使用 Routes.communityLook。
   */
  communityContent: (contentId: string) => `/content/${contentId}`,
  communityContentPath: '/content/:contentId',
  /** Canonical 可分享详情路由（COMM-V7.1-01）。 */
  communityLook: (lookId: string) => `/look/${lookId}`,
  communityLookPath: '/look/:lookId',
  /** Nail Board（COMM-V7.1-03）：收藏参考集，owner 管理与匿名只读分享。 */
  communityBoards: '/boards',
  communityBoardDetail: (boardId: string) => `/board/${boardId}`,
  communityBoardDetailPath: '/board/:boardId',
  /** 分享链接只携带不可猜测的 token，绝不携带 owner/customer 身份。 */
  communityBoardShare: (token: string) => `/board/share/${token}`,
  communityBoardSharePath: '/board/share/:token',
  communityProfile: (handle: string) => `/profile/${handle}`,
  communityProfilePath: '/profile/:handle',
} as const;

export const LegacyRoutes = {
  communityRoot: '/community',
  communityContentPath: '/community/content/:contentId',
  communityWildcard: '/community/*',
  designCommunity: '/design/community',
  designWildcard: '/design/*',
  customersWildcard: '/customers/*',
  devicesWildcard: '/devices/*',
} as const;

/** Preserve a legacy deep link while moving it into the canonical Community surface. */
export function legacyCommunityPathTarget(pathname: string): string {
  if (pathname === '/community') return Routes.community;
  if (pathname.startsWith('/community/')) return pathname.slice('/community'.length) || Routes.community;
  return Routes.community;
}

/** Preserve a legacy Studio deep link while moving it beneath the Studio mount. */
export function legacyStudioPathTarget(pathname: string): string {
  if (pathname === '/design' || pathname.startsWith('/design/')) return `/studio${pathname}`;
  if (pathname === '/customers' || pathname.startsWith('/customers/')) return `/studio${pathname}`;
  if (pathname === '/devices' || pathname.startsWith('/devices/')) return `/studio${pathname}`;
  return Routes.studio;
}

/**
 * Legacy content route → canonical /look/:lookId
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

/** User-facing “New design” intent. Plain Studio design/new remains draft resume. */
export function designNewFresh(customerId?: string): string {
  const params = new URLSearchParams({ fresh: '1' });
  if (customerId) params.set('customerId', customerId);
  return `${Routes.designNew}?${params.toString()}`;
}
