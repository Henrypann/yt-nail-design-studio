import { useParams } from 'react-router-dom';
import { MobileBind } from '@/platform/devices/MobileBind';

/** `/devices/bind/mobile/:token` 手机端辅助配网页（跨设备交接流程，独立极简布局） */
export default function MobileBindPage() {
  const { token } = useParams();
  return <MobileBind token={token ?? ''} />;
}
