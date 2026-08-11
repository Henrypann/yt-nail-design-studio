/**
 * `/community/content/:contentId` legacy 路由重定向（COMM-V7.1-01）。
 *
 * Legacy 深链 /community/content/:contentId 以 replace 重定向到 canonical
 * /look/:lookId（lookId = contentId），并完整保留 query params
 * （entry / return_to / shape / length / 筛选参数等）。
 */

import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { legacyContentRedirectTarget } from '@/app/routes';

export default function CommunityLegacyContentRedirect() {
  const { contentId } = useParams<{ contentId: string }>();
  const [searchParams] = useSearchParams();

  const target = legacyContentRedirectTarget(contentId, searchParams);
  return <Navigate to={target} replace />;
}

/** 供页面复用的重定向目标（纯函数，见 @/app/routes）。 */
export { legacyContentRedirectTarget };
