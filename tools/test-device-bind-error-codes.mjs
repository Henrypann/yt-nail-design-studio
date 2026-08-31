import assert from 'node:assert/strict';
import {
  BIND_ERROR_CODES_V1,
  BIND_ERROR_FALLBACK_V1,
  bindErrorMessageKeyV1,
  bindSnMismatchDisplayV1,
  mapBindErrorV1,
  resolveSnAlreadyBound,
  WIZARD_BIND_ERROR_ALIASES_V1,
} from '../src/platform/devices/bind-error-codes.ts';
import {
  DEVICES_ENVELOPE_VERSION,
  migrateDeviceRecordV1,
  migrateDevicesEnvelope,
} from '../src/platform/devices/device-envelope.ts';
import { CATALOGS } from '../src/lib/i18n/messages.ts';

const FROZEN_CODES = [
  'BIND_BT_DISCOVER_FAILED',
  'BIND_BT_PAIR_FAILED',
  'BIND_BT_WIFI_HANDOFF_FAILED',
  'BIND_USB_NOT_FOUND',
  'BIND_USB_DENIED',
  'BIND_SN_MISMATCH',
  'BIND_SN_ALREADY_BOUND',
  'CLOUD_REGISTER_FAILED',
  'JOB_FALLBACK_LAN',
  'JOB_TRANSPORT_OFFLINE',
  'DEVICE_NOT_ACTIVATED',
  'JOB_REJECT_EMPTY_PATCH',
];

assert.equal(BIND_ERROR_CODES_V1.length, 12, 'freeze is exactly 12 codes');
assert.deepEqual([...BIND_ERROR_CODES_V1], FROZEN_CODES, 'codes must match the Week 0 freeze order');
assert.equal(Object.isFrozen(BIND_ERROR_CODES_V1), true, 'code table must be frozen');
assert.equal(
  BIND_ERROR_CODES_V1.includes('UNMAPPED'),
  false,
  'UNMAPPED must never enter the union',
);
assert.equal(
  FROZEN_CODES.includes(BIND_ERROR_FALLBACK_V1),
  true,
  'fallback must be a defined freeze code',
);

const zh = CATALOGS['zh-CN'].messages;
const en = CATALOGS['en-US'].messages;
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();

for (const code of BIND_ERROR_CODES_V1) {
  const key = bindErrorMessageKeyV1(code);
  assert.equal(key.startsWith('device.'), true, `${code} must map to a device.* key`);
  assert.equal(typeof zh[key], 'string', `zh-CN missing ${key} for ${code}`);
  assert.equal(typeof en[key], 'string', `en-US missing ${key} for ${code}`);
  assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), `placeholder parity failed for ${key}`);
}

const snKey = bindErrorMessageKeyV1('BIND_SN_MISMATCH');
assert.deepEqual(placeholders(zh[snKey]).sort(), ['actualSerialNumber', 'expectedSerialNumber']);
assert.deepEqual(placeholders(en[snKey]).sort(), ['actualSerialNumber', 'expectedSerialNumber']);

const mapped = [];
const unknownInputs = [
  undefined,
  null,
  0,
  '',
  'UNMAPPED',
  'not-a-code',
  { code: 'UNMAPPED' },
  { code: 12 },
  Symbol('x'),
];
for (const input of unknownInputs) {
  const code = mapBindErrorV1(input);
  mapped.push(code);
  assert.notEqual(code, 'UNMAPPED', 'mapBindErrorV1 must never return UNMAPPED');
  assert.equal(BIND_ERROR_CODES_V1.includes(code), true, `unknown input must land on a defined code: ${String(input)}`);
  assert.equal(code, BIND_ERROR_FALLBACK_V1);
}
for (const code of BIND_ERROR_CODES_V1) {
  assert.equal(mapBindErrorV1(code), code, `identity map failed for ${code}`);
  assert.equal(mapBindErrorV1({ code }), code, `object.code map failed for ${code}`);
}
for (const [alias, expected] of Object.entries(WIZARD_BIND_ERROR_ALIASES_V1)) {
  assert.equal(mapBindErrorV1(alias), expected, `wizard alias ${alias} must map to ${expected}`);
}

const snFields = bindSnMismatchDisplayV1({
  expectedSerialNumber: 'SN-EXPECT-001',
  actualSerialNumber: 'SN-ACTUAL-002',
});
assert.equal(Object.hasOwn(snFields, 'expectedSerialNumber'), true);
assert.equal(Object.hasOwn(snFields, 'actualSerialNumber'), true);
assert.equal(snFields.expectedSerialNumber, 'SN-EXPECT-001');
assert.equal(snFields.actualSerialNumber, 'SN-ACTUAL-002');

const sameStore = resolveSnAlreadyBound({ incomingStoreId: 'store-a', boundStoreId: 'store-a' });
assert.equal(sameStore.outcome, 'success');
assert.equal(sameStore.sameStore, true);
assert.equal(Object.hasOwn(sameStore, 'forceBind'), false, 'same store must not expose a force-bind exit');

const otherStore = resolveSnAlreadyBound({ incomingStoreId: 'store-a', boundStoreId: 'store-b' });
assert.equal(otherStore.outcome, 'reject');
assert.equal(otherStore.code, 'BIND_SN_ALREADY_BOUND');
assert.equal(otherStore.sameStore, false);
assert.equal(otherStore.forceBind, false, 'other store must reject with no force-bind');

const emptyStore = resolveSnAlreadyBound({ incomingStoreId: '', boundStoreId: '' });
assert.equal(emptyStore.outcome, 'reject');
assert.equal(emptyStore.forceBind, false);

const v1Device = {
  id: 'dev-1',
  alias: '前台扫描',
  type: 'scanner',
  status: 'online',
  deviceCode: 'NS-ABCDEF',
  boundAt: '2026-08-01T00:00:00.000Z',
  lastSeenAt: '2026-08-02T00:00:00.000Z',
};
const v1Envelope = {
  v: 1,
  updatedAt: 1,
  tabId: 'tab-test',
  data: [v1Device],
};
const first = migrateDevicesEnvelope(v1Envelope);
assert.equal(first.changed, true);
assert.equal(first.version, DEVICES_ENVELOPE_VERSION);
assert.equal(first.devices.length, 1, 'old records must not be dropped');
assert.equal(first.devices[0].id, 'dev-1');
assert.equal(first.devices[0].deviceCode, 'NS-ABCDEF');
assert.equal(first.devices[0].alias, '前台扫描');
assert.equal(first.devices[0].serialNumber, '');
assert.equal(first.devices[0].storeId, '');
assert.equal(first.devices[0].activationState, 'not_activated');
assert.equal(first.devices[0].nailProfileRef, null);
assert.equal(first.devices[0].lastSeenAt, '2026-08-02T00:00:00.000Z');
assert.notEqual(first.devices[0].serialNumber, first.devices[0].deviceCode, 'SN must not be copied from deviceCode');

const second = migrateDevicesEnvelope({
  v: DEVICES_ENVELOPE_VERSION,
  updatedAt: 2,
  tabId: 'tab-test',
  data: first.devices,
});
assert.equal(second.changed, false, 'v2 migrate must be idempotent (changed=false)');
assert.deepEqual(second.devices, first.devices);

const third = migrateDevicesEnvelope({
  v: DEVICES_ENVELOPE_VERSION,
  updatedAt: 3,
  tabId: 'tab-test',
  data: second.devices,
});
assert.deepEqual(third.devices, second.devices);
assert.equal(third.changed, false);

const alreadyV2 = migrateDeviceRecordV1({
  ...first.devices[0],
  serialNumber: 'SN-KEEP',
  storeId: 'store-keep',
  activationState: 'activated',
  nailProfileRef: 'profile-1',
});
assert.equal(alreadyV2.serialNumber, 'SN-KEEP');
assert.equal(alreadyV2.storeId, 'store-keep');
assert.equal(alreadyV2.activationState, 'activated');
assert.equal(alreadyV2.nailProfileRef, 'profile-1');

const twoOld = migrateDevicesEnvelope({
  v: 1,
  updatedAt: 1,
  tabId: 'tab-test',
  data: [v1Device, { ...v1Device, id: 'dev-2', deviceCode: 'NS-222222', alias: '喷绘' }],
});
assert.equal(twoOld.devices.length, 2, 'every valid v1 record must survive');

console.log('test-device-bind-error-codes: freeze, i18n parity, mapBindErrorV1, SN fields, store split, envelope migrate PASS');
