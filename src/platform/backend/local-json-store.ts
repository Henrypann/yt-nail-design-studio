import { isServiceIdV1, serviceErrorV1, type ServiceResultV1 } from './service-contract';

export interface JsonDocumentStorageV1 {
  read(): unknown | null;
  write(value: unknown): void;
}

export interface IdempotencyLedgerEntryV1 { fingerprint: string; resultEtag: string; }
export interface RepositorySnapshotV1<T> { value: T; etag: string; }
export interface RepositoryReplaceV1<T> { value: T; expectedEtag: string; idempotencyKey: string; correlationId: string; }
export interface VersionedJsonRepositoryV1<T> {
  readonly adapterKind: 'LOCAL_PROTOTYPE';
  read(): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
  replace(command: RepositoryReplaceV1<T>): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
}

interface AtomicRepositoryEnvelopeV1<T> {
  schemaVersion: 1;
  value: T;
  ledger: Record<string, IdempotencyLedgerEntryV1>;
}

function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const visit = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === 'object') {
      if (seen.has(current)) throw new TypeError('cyclic value');
      seen.add(current);
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(current).sort()) result[key] = visit((current as Record<string, unknown>)[key]);
      seen.delete(current); return result;
    }
    if (typeof current === 'bigint' || typeof current === 'symbol' || typeof current === 'function') throw new TypeError('unsupported value');
    return current;
  };
  return JSON.stringify(visit(value));
}

/** Stable opaque concurrency token. It is not a content-integrity digest. */
export function localEtagV1(value: unknown): string {
  const data = canonicalJson(value); let a = 0x811c9dc5; let b = 0x9e3779b9;
  for (let index = 0; index < data.length; index += 1) {
    const code = data.charCodeAt(index); a = Math.imul(a ^ code, 0x01000193) >>> 0; b = Math.imul(b ^ code, 0x85ebca6b) >>> 0;
  }
  return `etag.v1.${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

function parseLedger(value: unknown): Record<string, IdempotencyLedgerEntryV1> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output: Record<string, IdempotencyLedgerEntryV1> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isServiceIdV1(key) || !entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const raw = entry as Record<string, unknown>;
    if (Object.keys(raw).some((field) => !['fingerprint', 'resultEtag'].includes(field))
      || typeof raw.fingerprint !== 'string' || !/^fp\.v1\.[0-9a-f]{16}$/.test(raw.fingerprint)
      || typeof raw.resultEtag !== 'string' || !/^etag\.v1\.[0-9a-f]{16}$/.test(raw.resultEtag)) return null;
    output[key] = { fingerprint: raw.fingerprint, resultEtag: raw.resultEtag };
  }
  return output;
}

export function createVersionedJsonRepositoryV1<T>(input: {
  /** One localStorage value containing document + ledger: one atomic setItem. */
  storage: JsonDocumentStorageV1;
  /** Read-through / best-effort mirror for pre-GEN04 local payloads. */
  legacy?: JsonDocumentStorageV1;
  empty(): T;
  parse(value: unknown): T | null;
  invalidReason: string;
}): VersionedJsonRepositoryV1<T> {
  const readAtomic = (): ServiceResultV1<AtomicRepositoryEnvelopeV1<T>> => {
    try {
      const raw = input.storage.read();
      if (raw === null) {
        const legacyRaw = input.legacy?.read() ?? null;
        if (legacyRaw !== null) {
          const legacy = input.parse(legacyRaw);
          if (!legacy) return serviceErrorV1('DATA_CORRUPTED', input.invalidReason);
          return { ok: true, value: { schemaVersion: 1, value: legacy, ledger: {} }, changed: false };
        }
        return { ok: true, value: { schemaVersion: 1, value: input.empty(), ledger: {} }, changed: false };
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return serviceErrorV1('DATA_CORRUPTED', input.invalidReason);
      const envelope = raw as Record<string, unknown>;
      if (Object.keys(envelope).some((key) => !['schemaVersion', 'value', 'ledger'].includes(key)) || envelope.schemaVersion !== 1) {
        return serviceErrorV1('DATA_CORRUPTED', input.invalidReason);
      }
      const value = input.parse(envelope.value); const ledger = parseLedger(envelope.ledger);
      if (!value || !ledger) return serviceErrorV1('DATA_CORRUPTED', input.invalidReason);
      return { ok: true, value: { schemaVersion: 1, value, ledger }, changed: false };
    } catch { return serviceErrorV1('UNAVAILABLE', 'repository.local_read_failed', true); }
  };
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async read() {
      const current = readAtomic();
      return current.ok
        ? { ok: true, value: { value: current.value.value, etag: localEtagV1(current.value.value) }, changed: false }
        : current;
    },
    async replace(command) {
      if (!isServiceIdV1(command.idempotencyKey) || !isServiceIdV1(command.correlationId)
        || !/^etag\.v1\.[0-9a-f]{16}$/.test(command.expectedEtag)) {
        return serviceErrorV1('INVALID', 'repository.invalid_command', false, command.correlationId);
      }
      const parsed = input.parse(command.value);
      if (!parsed) return serviceErrorV1('INVALID', input.invalidReason, false, command.correlationId);
      const current = readAtomic(); if (!current.ok) return current;
      const currentEtag = localEtagV1(current.value.value);
      const fingerprint = localEtagV1({ expectedEtag: command.expectedEtag, value: parsed }).replace('etag.', 'fp.');
      const replay = current.value.ledger[command.idempotencyKey];
      if (replay) {
        if (replay.fingerprint !== fingerprint) return serviceErrorV1('CONFLICT', 'repository.idempotency_key_reused', false, command.correlationId);
        if (currentEtag !== replay.resultEtag) return serviceErrorV1('CONFLICT', 'repository.idempotency_result_superseded', false, command.correlationId);
        return { ok: true, value: { value: current.value.value, etag: currentEtag }, changed: false };
      }
      if (currentEtag !== command.expectedEtag) return serviceErrorV1('CONFLICT', 'repository.etag_mismatch', false, command.correlationId);
      const nextEtag = localEtagV1(parsed);
      const atomic: AtomicRepositoryEnvelopeV1<T> = {
        schemaVersion: 1,
        value: parsed,
        ledger: { ...current.value.ledger, [command.idempotencyKey]: { fingerprint, resultEtag: nextEtag } },
      };
      try { input.storage.write(atomic); }
      catch { return serviceErrorV1('UNAVAILABLE', 'repository.local_write_failed', true, command.correlationId); }
      // Compatibility mirror is not authoritative and cannot turn an atomic
      // commit into a reported failure. Pre-GEN04 readers may be stale if it
      // is unavailable; GEN04 application services always read the authority.
      try { input.legacy?.write(parsed); } catch { /* non-authoritative mirror */ }
      return { ok: true, value: { value: parsed, etag: nextEtag }, changed: nextEtag !== currentEtag };
    },
  };
}
