/**
 * Community Look → DesignVersion 显式确认（S-LOOK）。
 *
 * 确认只写入 DesignVersion 身份钉：id + revision + EditorDoc SHA-256，以及
 * 等价的 snapshotId。Community 不得改写 EditorDoc / Wizard / 版本化导入意图。
 * 不是 Feed、不是制造放行、不是顾客 ApprovalEvent。
 *
 * DesignVersionV1 仍是发布身份真源；本记录只引用它，不复制文档。
 */

import type { DesignVersionV1, PublishedLookV1 } from './design-content-model';
import { parseDesignVersionV1 } from './design-content-parse';

export const LOOK_CONFIRM_STORE_KIND = 'COMMUNITY_LOOK_DESIGN_VERSION_CONFIRM_STORE' as const;
export const LOOK_CONFIRM_STORE_SCHEMA_VERSION = 1 as const;

export interface ConfirmedLookDesignVersionRefV1 {
  schemaVersion: 1;
  /** 本次确认身份；等价于既有 ConfirmedDesignSnapshotV7.snapshotId。 */
  snapshotId: string;
  lookId: string;
  designVersionId: string;
  designId: string;
  /** DesignVersionV1.version（发布序号）。 */
  version: number;
  /** DesignVersionV1.revision（被发布的 EditorDoc revision）。 */
  revision: number;
  /** DesignVersionV1.editorDocRef.sha256 */
  editorDocSha256: string;
  confirmedAt: string;
  confirmedByIdentityRef?: string;
}

export interface LookConfirmStoreV1 {
  schemaVersion: 1;
  kind: typeof LOOK_CONFIRM_STORE_KIND;
  records: ConfirmedLookDesignVersionRefV1[];
}

export type LookConfirmReasonV1 =
  | 'legacy_missing_design_version'
  | 'look_unavailable'
  | 'version_mismatch'
  | 'invalid_release'
  | 'corrupted_store'
  | 'dependency';

export type LookConfirmResultV1 =
  | { ok: true; created: boolean; record: ConfirmedLookDesignVersionRefV1; store: LookConfirmStoreV1 }
  | { ok: false; reason: LookConfirmReasonV1; message: string };

export interface LookConfirmStorageV1 {
  read(): unknown;
  write(next: LookConfirmStoreV1): void;
}

export interface LookConfirmDependenciesV1 {
  storage: LookConfirmStorageV1;
  nextSnapshotId(): string;
  now(): string;
}

type UnknownRecord = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA = /^[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RECORD_KEYS = [
  'schemaVersion',
  'snapshotId',
  'lookId',
  'designVersionId',
  'designId',
  'version',
  'revision',
  'editorDocSha256',
  'confirmedAt',
  'confirmedByIdentityRef',
] as const;
const STORE_KEYS = ['schemaVersion', 'kind', 'records'] as const;
const FORBIDDEN_EMBEDDED_KEYS = ['editorDoc', 'editorDocument', 'editorDocEmbedded', 'nails', 'steps'];

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function exactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && ISO.test(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

export function emptyLookConfirmStoreV1(): LookConfirmStoreV1 {
  return {
    schemaVersion: LOOK_CONFIRM_STORE_SCHEMA_VERSION,
    kind: LOOK_CONFIRM_STORE_KIND,
    records: [],
  };
}

export function parseConfirmedLookDesignVersionRefV1(
  value: unknown,
): ConfirmedLookDesignVersionRefV1 | null {
  const raw = record(value);
  if (!raw || !exactKeys(raw, RECORD_KEYS) || raw.schemaVersion !== 1) return null;
  if (FORBIDDEN_EMBEDDED_KEYS.some((key) => key in raw)) return null;
  if (!isId(raw.snapshotId) || !isId(raw.lookId) || !isId(raw.designVersionId) || !isId(raw.designId)) {
    return null;
  }
  if (!isPositiveInt(raw.version) || !isPositiveInt(raw.revision)) return null;
  if (typeof raw.editorDocSha256 !== 'string' || !SHA.test(raw.editorDocSha256)) return null;
  if (!isTime(raw.confirmedAt)) return null;
  if (raw.confirmedByIdentityRef !== undefined && !isId(raw.confirmedByIdentityRef)) return null;
  return structuredClone(raw) as unknown as ConfirmedLookDesignVersionRefV1;
}

export function parseLookConfirmStoreV1(value: unknown): LookConfirmStoreV1 | null {
  const raw = record(value);
  if (!raw || !exactKeys(raw, STORE_KEYS)) return null;
  if (raw.schemaVersion !== LOOK_CONFIRM_STORE_SCHEMA_VERSION || raw.kind !== LOOK_CONFIRM_STORE_KIND) {
    return null;
  }
  if (!Array.isArray(raw.records)) return null;
  const records: ConfirmedLookDesignVersionRefV1[] = [];
  const seenSnapshot = new Set<string>();
  const seenLookVersion = new Set<string>();
  for (const item of raw.records) {
    const parsed = parseConfirmedLookDesignVersionRefV1(item);
    if (!parsed) return null;
    const lookVersionKey = `${parsed.lookId}#${parsed.designVersionId}`;
    if (seenSnapshot.has(parsed.snapshotId) || seenLookVersion.has(lookVersionKey)) return null;
    seenSnapshot.add(parsed.snapshotId);
    seenLookVersion.add(lookVersionKey);
    records.push(parsed);
  }
  return { schemaVersion: 1, kind: LOOK_CONFIRM_STORE_KIND, records };
}

function readStore(storage: LookConfirmStorageV1): LookConfirmResultV1 | { ok: true; store: LookConfirmStoreV1 } {
  let raw: unknown;
  try {
    raw = storage.read();
  } catch {
    return { ok: false, reason: 'dependency', message: 'look confirm storage unavailable' };
  }
  if (raw === null || raw === undefined) return { ok: true, store: emptyLookConfirmStoreV1() };
  const parsed = parseLookConfirmStoreV1(raw);
  if (!parsed) return { ok: false, reason: 'corrupted_store', message: 'look confirm store is corrupted; writes blocked' };
  return { ok: true, store: parsed };
}

function sameIdentity(
  record: ConfirmedLookDesignVersionRefV1,
  lookId: string,
  designVersion: DesignVersionV1,
): boolean {
  return (
    record.lookId === lookId
    && record.designVersionId === designVersion.designVersionId
    && record.designId === designVersion.designId
    && record.version === designVersion.version
    && record.revision === designVersion.revision
    && record.editorDocSha256 === designVersion.editorDocRef.sha256
  );
}

/**
 * 显式确认一条已发布 Look 所引用的不可变 DesignVersion。
 * 成功时只追加（或幂等返回）身份钉，绝不写入 EditorDoc。
 */
export function confirmLookAsDesignVersionV1(
  input: { look: PublishedLookV1; designVersion: DesignVersionV1; confirmedByIdentityRef?: string },
  deps: LookConfirmDependenciesV1,
): LookConfirmResultV1 {
  const { look, designVersion } = input;
  const parsedVersion = parseDesignVersionV1(designVersion);
  if (!parsedVersion.ok) {
    return { ok: false, reason: 'invalid_release', message: 'DesignVersion failed its public contract' };
  }
  const version = parsedVersion.value;
  if (look.status !== 'PUBLISHED') {
    return { ok: false, reason: 'look_unavailable', message: 'look is not published' };
  }
  if (!look.designVersionId) {
    return { ok: false, reason: 'legacy_missing_design_version', message: 'look has no immutable DesignVersion' };
  }
  if (
    look.designVersionId !== version.designVersionId
    || version.revision !== version.editorDocRef.revision
    || version.designId !== version.editorDocRef.designId
  ) {
    return { ok: false, reason: 'version_mismatch', message: 'look does not pin this DesignVersion identity' };
  }

  const loaded = readStore(deps.storage);
  if (!loaded.ok) return loaded;
  const existing = loaded.store.records.find((record) => record.lookId === look.lookId && record.designVersionId === version.designVersionId);
  if (existing) {
    if (!sameIdentity(existing, look.lookId, version)) {
      return { ok: false, reason: 'version_mismatch', message: 'existing confirmation pins a different revision or hash' };
    }
    return { ok: true, created: false, record: structuredClone(existing), store: loaded.store };
  }

  let snapshotId: string;
  let confirmedAt: string;
  try {
    snapshotId = deps.nextSnapshotId();
    confirmedAt = deps.now();
  } catch {
    return { ok: false, reason: 'dependency', message: 'look confirm identity clock unavailable' };
  }
  if (!isId(snapshotId) || loaded.store.records.some((record) => record.snapshotId === snapshotId)) {
    return { ok: false, reason: 'dependency', message: 'look confirm snapshot id is unusable' };
  }
  if (!isTime(confirmedAt)) {
    return { ok: false, reason: 'dependency', message: 'look confirm timestamp is invalid' };
  }
  if (input.confirmedByIdentityRef !== undefined && !isId(input.confirmedByIdentityRef)) {
    return { ok: false, reason: 'dependency', message: 'look confirm actor ref is invalid' };
  }

  const nextRecord: ConfirmedLookDesignVersionRefV1 = {
    schemaVersion: 1,
    snapshotId,
    lookId: look.lookId,
    designVersionId: version.designVersionId,
    designId: version.designId,
    version: version.version,
    revision: version.revision,
    editorDocSha256: version.editorDocRef.sha256,
    confirmedAt,
    ...(input.confirmedByIdentityRef ? { confirmedByIdentityRef: input.confirmedByIdentityRef } : {}),
  };
  const parsedRecord = parseConfirmedLookDesignVersionRefV1(nextRecord);
  if (!parsedRecord) {
    return { ok: false, reason: 'dependency', message: 'generated look confirm failed its contract' };
  }
  const nextStore: LookConfirmStoreV1 = {
    schemaVersion: 1,
    kind: LOOK_CONFIRM_STORE_KIND,
    records: [...loaded.store.records, parsedRecord],
  };
  try {
    deps.storage.write(nextStore);
  } catch {
    return { ok: false, reason: 'dependency', message: 'look confirm could not be persisted' };
  }
  return { ok: true, created: true, record: structuredClone(parsedRecord), store: nextStore };
}

export function listConfirmedLookDesignVersionsV1(
  storage: LookConfirmStorageV1,
): { ok: true; records: ConfirmedLookDesignVersionRefV1[] } | { ok: false; reason: LookConfirmReasonV1; message: string } {
  const loaded = readStore(storage);
  if (!loaded.ok) return loaded;
  return { ok: true, records: structuredClone(loaded.store.records) };
}
