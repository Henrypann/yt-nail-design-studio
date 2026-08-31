import { BindWizard } from '@/platform/devices/BindWizard';

/** `/devices/bind` 工作站两跳绑定：主路径搜索机器，同页数据线回退。 */
export default function DeviceBindPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <BindWizard />
    </div>
  );
}
