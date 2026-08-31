import { BindWizard } from '@/platform/devices/BindWizard';

/** `/devices/bind` 设备绑定向导：工作站外壳 restyle；传输仍为 MOCK。 */
export default function DeviceBindPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <BindWizard />
    </div>
  );
}
