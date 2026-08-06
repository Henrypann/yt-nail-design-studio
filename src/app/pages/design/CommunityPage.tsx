/**
 * 旧 `/design/community` 兼容：replace 到独立 Community 官方页。
 * 不再挂载业务 UI / Wizard Store。
 */

import { Navigate, useSearchParams } from 'react-router-dom';
import { Routes } from '@/app/routes';

export default function CommunityPage() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return (
    <Navigate
      to={qs ? `${Routes.communityOfficial}?${qs}` : Routes.communityOfficial}
      replace
    />
  );
}
