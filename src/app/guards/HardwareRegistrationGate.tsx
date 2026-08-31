import { Navigate, Outlet } from 'react-router-dom';
import { Routes } from '@/app/routes';
import { useDevicesStore } from '@/platform/devices/device-store';

/**
 * Customer operations and registered-device management are hardware-enabled capabilities.
 * Device binding itself intentionally sits outside this gate so a new salon can activate hardware.
 * Software Studio / Look / confirmed DesignVersion / Job placeholder routes must stay outside
 * this gate so missing hardware never blocks those product surfaces.
 */
export function HardwareRegistrationGate() {
  const hasRegisteredHardware = useDevicesStore((state) => state.devices.length > 0);
  return hasRegisteredHardware ? <Outlet /> : <Navigate to={Routes.studio} replace />;
}
