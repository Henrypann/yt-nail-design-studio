import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BIND_ERROR_CODES_V1,
  BIND_ERROR_FALLBACK_V1,
  mapBindErrorV1,
} from '../src/platform/devices/bind-error-codes.ts';
import {
  createTwoHopBindControllerV1,
  resolveHop1LocalBindV1,
} from '../src/platform/devices/two-hop-bind.ts';
import {
  createMockBindTransport,
  createWebBluetoothTransport,
  createWebUsbTransport,
  detectBindTransportCapabilityV1,
  mapBindTransportExceptionV1,
  selectBindTransportV1,
} from '../src/platform/devices/transport/index.ts';

const instantSleep = async () => {};

function assertDefinedCode(code) {
  assert.notEqual(code, 'UNMAPPED');
  assert.equal(BIND_ERROR_CODES_V1.includes(code), true, `expected frozen code, got ${code}`);
}

/* ── 能力探测：失败码按路径冻结，永不 UNMAPPED，不静默串路 ── */

const btMissing = detectBindTransportCapabilityV1('bluetooth', {
  hasBluetooth: false,
  hasUsb: true,
  isSecureContext: true,
});
assert.equal(btMissing.available, false);
assertDefinedCode(btMissing.unavailableCode);
assert.equal(btMissing.unavailableCode, 'BIND_BT_DISCOVER_FAILED');
assert.notEqual(btMissing.unavailableCode, 'BIND_USB_NOT_FOUND');
assert.notEqual(btMissing.unavailableCode, 'BIND_USB_DENIED');

const btInsecure = detectBindTransportCapabilityV1('bluetooth', {
  hasBluetooth: true,
  hasUsb: true,
  isSecureContext: false,
});
assert.equal(btInsecure.available, false);
assert.equal(btInsecure.unavailableCode, 'BIND_BT_DISCOVER_FAILED');

const btOk = detectBindTransportCapabilityV1('bluetooth', {
  hasBluetooth: true,
  hasUsb: false,
  isSecureContext: true,
});
assert.equal(btOk.available, true);

const usbMissing = detectBindTransportCapabilityV1('usb', {
  hasBluetooth: true,
  hasUsb: false,
  isSecureContext: true,
});
assert.equal(usbMissing.available, false);
assert.equal(usbMissing.unavailableCode, 'BIND_USB_NOT_FOUND');
assert.notEqual(usbMissing.unavailableCode, 'BIND_BT_DISCOVER_FAILED');

const usbDenied = detectBindTransportCapabilityV1('usb', {
  hasBluetooth: true,
  hasUsb: true,
  isSecureContext: false,
});
assert.equal(usbDenied.available, false);
assert.equal(usbDenied.unavailableCode, 'BIND_USB_DENIED');

const usbOk = detectBindTransportCapabilityV1('usb', {
  hasBluetooth: false,
  hasUsb: true,
  isSecureContext: true,
});
assert.equal(usbOk.available, true);

/* 真实端口在能力缺失时返回冻结码，不改走另一 kind */
const btReal = selectBindTransportV1('bluetooth', {
  env: { hasBluetooth: false, hasUsb: true, isSecureContext: true },
  allowMockWhenUnavailable: false,
});
assert.equal(btReal.usingMock, false);
assert.equal(btReal.port.kind, 'bluetooth');
const btFail = await btReal.port.discover();
assert.equal(btFail.ok, false);
assert.equal(btFail.code, 'BIND_BT_DISCOVER_FAILED');
assertDefinedCode(btFail.code);

const usbReal = selectBindTransportV1('usb', {
  env: { hasBluetooth: true, hasUsb: false, isSecureContext: true },
  allowMockWhenUnavailable: false,
});
assert.equal(usbReal.port.kind, 'usb');
const usbFail = await usbReal.port.discover();
assert.equal(usbFail.ok, false);
assert.equal(usbFail.code, 'BIND_USB_NOT_FOUND');

const usbInsecureReal = selectBindTransportV1('usb', {
  env: { hasBluetooth: true, hasUsb: true, isSecureContext: false },
  allowMockWhenUnavailable: false,
});
const usbInsecureFail = await usbInsecureReal.port.discover();
assert.equal(usbInsecureFail.ok, false);
assert.equal(usbInsecureFail.code, 'BIND_USB_DENIED');

/* 能力缺失 + allowMock：同路径 mock，不切换 kind */
const btMock = selectBindTransportV1('bluetooth', {
  env: { hasBluetooth: false, hasUsb: true, isSecureContext: true },
  allowMockWhenUnavailable: true,
});
assert.equal(btMock.usingMock, true);
assert.equal(btMock.port.kind, 'bluetooth');
assert.equal(btMock.capability.available, false);
assert.equal(btMock.capability.unavailableCode, 'BIND_BT_DISCOVER_FAILED');

const usbMock = selectBindTransportV1('usb', {
  env: { hasBluetooth: true, hasUsb: false, isSecureContext: true },
  allowMockWhenUnavailable: true,
});
assert.equal(usbMock.usingMock, true);
assert.equal(usbMock.port.kind, 'usb');

/* ── 异常映射：BT 不落到 USB 码，USB 不落到 BT 码；mapBindErrorV1 永不 UNMAPPED ── */

assert.equal(mapBindTransportExceptionV1('bluetooth', 'discover', { name: 'NotFoundError' }), 'BIND_BT_DISCOVER_FAILED');
assert.equal(mapBindTransportExceptionV1('bluetooth', 'pair', { name: 'NetworkError' }), 'BIND_BT_PAIR_FAILED');
assert.equal(mapBindTransportExceptionV1('bluetooth', 'wifi-handoff', { name: 'NotAllowedError' }), 'BIND_BT_WIFI_HANDOFF_FAILED');
assert.equal(mapBindTransportExceptionV1('usb', 'discover', { name: 'NotFoundError' }), 'BIND_USB_NOT_FOUND');
assert.equal(mapBindTransportExceptionV1('usb', 'discover', { name: 'NotAllowedError' }), 'BIND_USB_DENIED');
assert.equal(mapBindTransportExceptionV1('usb', 'discover', { name: 'SecurityError' }), 'BIND_USB_DENIED');
assert.equal(mapBindTransportExceptionV1('usb', 'pair', { name: 'NotAllowedError' }), 'BIND_USB_DENIED');
assert.notEqual(mapBindTransportExceptionV1('usb', 'discover', { name: 'NotAllowedError' }), 'BIND_BT_DISCOVER_FAILED');
assert.notEqual(mapBindTransportExceptionV1('bluetooth', 'discover', { name: 'NotAllowedError' }), 'BIND_USB_DENIED');

for (const input of [undefined, null, 'UNMAPPED', { code: 'UNMAPPED' }, { name: 'TotallyUnknown' }]) {
  const code = mapBindErrorV1(input);
  assert.notEqual(code, 'UNMAPPED');
  assert.equal(BIND_ERROR_CODES_V1.includes(code), true);
}
assert.equal(mapBindErrorV1('UNMAPPED'), BIND_ERROR_FALLBACK_V1);
assert.equal(mapBindErrorV1(mapBindTransportExceptionV1('bluetooth', 'discover', 'nope')), 'BIND_BT_DISCOVER_FAILED');

/* ── 注入真实适配器 ── */

const btInjected = createWebBluetoothTransport({
  readEnv: () => ({ hasBluetooth: true, hasUsb: false, isSecureContext: true }),
  getBluetooth: () => ({
    async requestDevice() {
      return { id: 'aabbcc-device', name: 'SN-FROM-BT' };
    },
  }),
});
const btFound = await btInjected.discover();
assert.equal(btFound.ok, true);
assert.equal(btFound.device.foundVia, 'bluetooth');
assert.equal(btFound.device.serialNumber, 'SN-FROM-BT');
assert.notEqual(btFound.device.serialNumber, btFound.device.deviceCode);

const btThrown = createWebBluetoothTransport({
  readEnv: () => ({ hasBluetooth: true, hasUsb: false, isSecureContext: true }),
  getBluetooth: () => ({
    async requestDevice() {
      const err = new Error('gone');
      err.name = 'NotFoundError';
      throw err;
    },
  }),
});
const btThrownResult = await btThrown.discover();
assert.equal(btThrownResult.ok, false);
assert.equal(btThrownResult.code, 'BIND_BT_DISCOVER_FAILED');

const usbInjected = createWebUsbTransport({
  readEnv: () => ({ hasBluetooth: false, hasUsb: true, isSecureContext: true }),
  getUsb: () => ({
    async requestDevice() {
      return {
        serialNumber: 'USB123',
        vendorId: 0x1234,
        productId: 0x5678,
        opened: false,
        async open() {},
      };
    },
  }),
});
const usbFound = await usbInjected.discover();
assert.equal(usbFound.ok, true);
assert.equal(usbFound.device.foundVia, 'usb');
assert.equal(usbFound.device.serialNumber, 'SN-USB123');
assert.notEqual(usbFound.device.serialNumber, usbFound.device.deviceCode);

const usbDeniedPort = createWebUsbTransport({
  readEnv: () => ({ hasBluetooth: false, hasUsb: true, isSecureContext: true }),
  getUsb: () => ({
    async requestDevice() {
      const err = new Error('denied');
      err.name = 'NotAllowedError';
      throw err;
    },
  }),
});
const usbDeniedResult = await usbDeniedPort.discover();
assert.equal(usbDeniedResult.ok, false);
assert.equal(usbDeniedResult.code, 'BIND_USB_DENIED');

/* ── 同路径 mock：USB 场景不影响蓝牙 ── */

const mockBt = createMockBindTransport({
  kind: 'bluetooth',
  sleep: instantSleep,
  scenarioFlags: { 'device.usbDenied': true, 'device.usbNotFound': true },
});
const mockBtFound = await mockBt.discover();
assert.equal(mockBtFound.ok, true);
assert.equal(mockBtFound.device.foundVia, 'bluetooth');
assert.notEqual(mockBtFound.device.serialNumber, mockBtFound.device.deviceCode);

const mockUsbDenied = createMockBindTransport({
  kind: 'usb',
  sleep: instantSleep,
  scenarioFlags: { 'device.usbDenied': true },
});
const mockUsbDeniedResult = await mockUsbDenied.discover();
assert.equal(mockUsbDeniedResult.ok, false);
assert.equal(mockUsbDeniedResult.code, 'BIND_USB_DENIED');

const mockPair = createMockBindTransport({
  kind: 'bluetooth',
  sleep: instantSleep,
  scenarioFlags: { 'device.btPairFailed': true },
});
const pairFail = await mockPair.pair(mockBtFound.device);
assert.equal(pairFail.ok, false);
assert.equal(pairFail.code, 'BIND_BT_PAIR_FAILED');

/* ── 两跳：CLOUD_REGISTER_FAILED 只增加 hop2 计数，不重跑 hop1 ── */

let persistCount = 0;
const hop = createTwoHopBindControllerV1();
const hop1 = hop.runHop1({
  incoming: { serialNumber: 'SN-1', storeId: 'store-a', deviceCode: 'NS-1' },
  existingDevices: [],
  persist: () => {
    persistCount += 1;
    return 'dev-1';
  },
});
assert.equal(hop1.ok, true);
assert.equal(persistCount, 1);
assert.equal(hop.state.hop1CallCount, 1);
assert.equal(hop.state.hop1Completed, true);

const hop2fail = await hop.runHop2({ serialNumber: 'SN-1', storeId: 'store-a', fail: true });
assert.equal(hop2fail.ok, false);
assert.equal(hop2fail.code, 'CLOUD_REGISTER_FAILED');
assert.equal(hop2fail.retryHop, 2);
assert.equal(hop.state.hop2CallCount, 1);

const hop2retry = await hop.runHop2({ serialNumber: 'SN-1', storeId: 'store-a', fail: true });
assert.equal(hop2retry.retryHop, 2);
assert.equal(hop.state.hop1CallCount, 1);
assert.equal(hop.state.hop2CallCount, 2);
assert.equal(persistCount, 1);

const hop1again = hop.runHop1({
  incoming: { serialNumber: 'SN-1', storeId: 'store-a', deviceCode: 'NS-1' },
  existingDevices: [],
  persist: () => {
    persistCount += 1;
    return 'dev-should-not';
  },
});
assert.equal(hop1again.ok, true);
assert.equal(hop1again.skippedAdd, true);
assert.equal(persistCount, 1);
assert.equal(hop.state.hop1CallCount, 1);

const restored = createTwoHopBindControllerV1({ hop1Completed: true, localDeviceId: 'dev-1' });
const restoredHop1 = restored.runHop1({
  incoming: { serialNumber: 'SN-1', storeId: 'store-a', deviceCode: 'NS-1' },
  existingDevices: [],
  persist: () => {
    throw new Error('restored hop1 must not persist');
  },
});
assert.equal(restoredHop1.ok, true);
assert.equal(restored.state.hop1CallCount, 0);
const restoredHop2 = await restored.runHop2({ serialNumber: 'SN-1', storeId: 'store-a', fail: false });
assert.equal(restoredHop2.ok, true);
assert.equal(restored.state.hop2CallCount, 1);

/* ── SN mismatch 双显；同店成功；异店拒绝且无强制绑定 ── */

const mismatch = resolveHop1LocalBindV1({
  incoming: { serialNumber: 'SN-ACTUAL-002', storeId: 'store-a', deviceCode: 'NS-1' },
  existingDevices: [],
  expectedSerialNumber: 'SN-EXPECT-001',
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.code, 'BIND_SN_MISMATCH');
assert.equal(mismatch.snMismatch.expectedSerialNumber, 'SN-EXPECT-001');
assert.equal(mismatch.snMismatch.actualSerialNumber, 'SN-ACTUAL-002');

const sameStore = resolveHop1LocalBindV1({
  incoming: { serialNumber: 'SN-KEEP', storeId: 'store-a', deviceCode: 'NS-2' },
  existingDevices: [
    { id: 'dev-keep', serialNumber: 'SN-KEEP', storeId: 'store-a', activationState: 'activated' },
  ],
});
assert.equal(sameStore.ok, true);
assert.equal(sameStore.sameStoreReuse, true);
assert.equal(sameStore.skippedAdd, true);
assert.equal(sameStore.deviceId, 'dev-keep');

const otherStore = resolveHop1LocalBindV1({
  incoming: { serialNumber: 'SN-KEEP', storeId: 'store-a', deviceCode: 'NS-2' },
  existingDevices: [
    { id: 'dev-other', serialNumber: 'SN-KEEP', storeId: 'store-b', activationState: 'activated' },
  ],
});
assert.equal(otherStore.ok, false);
assert.equal(otherStore.code, 'BIND_SN_ALREADY_BOUND');
assert.equal(otherStore.forceBind, false);

const emptySnDoesNotCollide = resolveHop1LocalBindV1({
  incoming: { serialNumber: '', storeId: 'store-a', deviceCode: 'NS-3' },
  existingDevices: [
    { id: 'legacy', serialNumber: '', storeId: 'store-b', activationState: 'not_activated' },
  ],
});
assert.equal(emptySnDoesNotCollide.ok, true);
assert.equal(emptySnDoesNotCollide.skippedAdd, false);

/* ── 源码合同：路径 4→2；无第二向导；mobile 不做发现/云注册 ── */

const typesSrc = fs.readFileSync('src/platform/devices/types.ts', 'utf8');
assert.match(typesSrc, /export type BindPath = 'bluetooth' \| 'usb';/);
assert.doesNotMatch(typesSrc, /export type BindPath =[\s\S]*'lan'/);

const wizardSrc = fs.readFileSync('src/platform/devices/BindWizard.tsx', 'utf8');
assert.match(wizardSrc, /data-surface=["']workstation-bind["']/);
assert.match(wizardSrc, /startPath\('bluetooth'\)/);
assert.match(wizardSrc, /startPath\('usb'\)/);
assert.doesNotMatch(wizardSrc, /startPath\('lan'\)/);
assert.doesNotMatch(wizardSrc, /startPath\('mobile'\)/);
assert.match(wizardSrc, /runHop2Only/);
assert.match(wizardSrc, /CLOUD_REGISTER_FAILED/);
assert.match(wizardSrc, /deviceBindSession|saveBindSession/);

const mobileSrc = fs.readFileSync('src/platform/devices/MobileBind.tsx', 'utf8');
assert.doesNotMatch(mobileSrc, /selectBindTransportV1|createTwoHopBindControllerV1|registerBoundDeviceCloudV1/);
assert.doesNotMatch(mobileSrc, /navigator\.(bluetooth|usb)/);
assert.match(mobileSrc, /device\.mobileWifiNotBindPath/);

const bindPage = fs.readFileSync('src/app/pages/devices/DeviceBindPage.tsx', 'utf8');
assert.match(bindPage, /BindWizard/);
assert.doesNotMatch(bindPage, /Routes\.deviceBindMobile/);

console.log('test-device-bind-transport: capability, no-UNMAPPED, no silent fallback, two-hop hop2-only retry PASS');
