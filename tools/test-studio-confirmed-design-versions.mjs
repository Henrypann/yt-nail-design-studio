#!/usr/bin/env node
/**
 * S-STUDIO: Studio 可见/打开已确认 DesignVersion。
 * Evidence: prototype software. 无设备、无 Job、打开只走既有版本化导入。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}

globalThis.localStorage = new MemoryStorage();
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const fixture = await import('../src/integration/community-studio/canonical-use-demo.ts');
const domain = await import('../src/community/domain/v7_1/look-confirm.ts');
const runtime = await import('../src/integration/community-studio/look-confirm-runtime.ts');
const { readData, StorageKeys } = await import('../src/lib/storage.ts');
const { Routes } = await import('../src/app/routes.ts');

localStorage.clear();
const confirmed = runtime.confirmCanonicalLookAsDesignVersionV1(
  fixture.CANONICAL_USE_DEMO_READ_MODEL_V1,
  { snapshotId: 'snap.studio.1', now: '2026-08-31T13:00:00.000Z' },
);
assert.equal(confirmed.ok, true);
if (!confirmed.ok) throw new Error(confirmed.message);

const listed = runtime.readConfirmedLookDesignVersionsV1();
assert.equal(listed.ok, true);
if (!listed.ok) throw new Error(listed.message);
assert.equal(listed.records.length, 1);
assert.equal(listed.records[0].designVersionId, fixture.CANONICAL_USE_DEMO_VERSION_ID);

const designVersion = fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion;
const matched = domain.matchConfirmedLookToReleaseV1(
  confirmed.record,
  fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1,
  designVersion,
);
assert.equal(matched.ok, true);

const mismatchedLook = structuredClone(fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1);
mismatchedLook.designVersionId = 'dv.other.1';
assert.equal(
  domain.matchConfirmedLookToReleaseV1(confirmed.record, mismatchedLook, designVersion).reason,
  'version_mismatch',
);

assert.equal(readData(StorageKeys.editorDocs), null);
assert.equal(readData(StorageKeys.devices), null, 'Studio open path does not require registered hardware');

const opened = runtime.prepareConfirmedLookStudioOpenV1(
  confirmed.record,
  fixture.CANONICAL_USE_DEMO_READ_MODEL_V1,
);
assert.equal(opened.ok, true);
if (!opened.ok) throw new Error(opened.reason);
assert.equal(opened.href.startsWith(`${Routes.designImport}?`), true);
assert.match(opened.href, /versionedIntent=/);
assert.equal(readData(StorageKeys.editorDocs), null, 'open prepares import intent only; EditorDoc stays untouched');
assert.ok(readData(StorageKeys.versionedStudioImportIntents), 'existing versioned import intent is written');

const appSource = fs.readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const confirmedIndex = appSource.indexOf('path={Routes.designConfirmed}');
const gateIndex = appSource.indexOf('<Route element={<HardwareRegistrationGate />}');
assert.ok(confirmedIndex > 0 && gateIndex > confirmedIndex, 'confirmed DesignVersion route stays outside HardwareRegistrationGate');
const gateChildren = appSource.slice(gateIndex, gateIndex + 700);
assert.equal(gateChildren.includes('designConfirmed'), false);
assert.equal(gateChildren.includes('Routes.dashboard'), true);
assert.equal(gateChildren.includes('Routes.devices'), true);

const pageSource = fs.readFileSync(new URL('../src/app/pages/design/ConfirmedDesignVersionPage.tsx', import.meta.url), 'utf8');
assert.equal(pageSource.includes('submitDesign'), false);
assert.equal(pageSource.includes('ManufacturingPackage'), false);
assert.equal(pageSource.includes('WebBluetooth'), false);
assert.equal(pageSource.includes('prepareConfirmedLookStudioOpenV1'), true);

const homeSource = fs.readFileSync(new URL('../src/app/pages/StudioHomePage.tsx', import.meta.url), 'utf8');
assert.equal(homeSource.includes('Routes.designConfirmed'), true);
assert.equal(homeSource.includes('submitDesign'), false);

console.log('[S-STUDIO] confirmed DesignVersion visible/openable without device/Job: PASS');
