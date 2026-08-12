import { isServiceIdV1, serviceErrorV1, type ServiceResultV1 } from './service-contract';

export interface JsonDocumentStorageV1 {
  read(): unknown | null;
  write(value: unknown): void;
}

export interface IdempotencyLedgerEntryV1 {
  fingerprint: string;
  resultEtag: string;
}

export interface IdempotencyLedgerStorageV1 {
  read(): unknown | null;
  write(value: Record<string, IdempotencyLedgerEntryV1>): void;
}

export interface RepositorySnapshotV1<T> {
  value: T;
  etag: string;
}

export interface RepositoryReplaceV1<T> {
  value: T;
  expectedEtag: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface VersionedJsonRepositoryV1<T> {
  readonly adapterKind: 'LOCAL_PROTOTYPE';
  read(): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
  replace(command: RepositoryReplaceV1<T>): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
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
      seen.delete(current);
      return result;
    }
    if (typeof current === 'bigint' || typeof current === 'symbol' || typeof current === 'function') throw new TypeError('unsupported value');
    return current;
  };
  return JSON.stringify(visit(value));
}

/** Stable opaque concurrency token. It is not a content-integrity digest. */
export function localEtagV1(value: unknown): string {
  const input = canonicalJson(value);
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x85ebca6b) >>> 0;
  }
  return `etag.v1.${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

function parseLedger(value: unknown): Record<string, IdempotencyLedgerEntryV1> | null {
  if (value === null) return {};
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
  storage: JsonDocumentStorageV1;
  ledger: IdempotencyLedgerStorageV1;
  empty(): T;
  parse(value: unknown): T | null;
  invalidReason: string;
}): VersionedJsonRepositoryV1<T> {
  const readSnapshot = (): ServiceResultV1<RepositorySnapshotV1<T>> => {
    try {
      const raw = input.storage.read();
      if (raw === null) {
        const value = input.empty();
        return { ok: true, value: { value, etag: localEtagV1(value) }, changed: false };
      }
      const parsed = input.parse(raw);
      if (!parsed) return serviceErrorV1('DATA_CORRUPTED', input.invalidReason);
      return { ok: true, value: { value: parsed, etag: localEtagV1(parsed) }, changed: false };
    } catch {
      return serviceErrorV1('UNAVAILABLE', 'repository.local_read_failed', true);
    }
  };

  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async read() { return readSnapshot(); },
    async replace(command) {
      if (!isServiceIdV1(command.idempotencyKey) || !isServiceIdV1(command.correlationId)
        || !/^etag\.v1\.[0-9a-f]{16}$/.test(command.expectedEtag)) {
        return serviceErrorV1('INVALID', 'repository.invalid_command', false, command.correlationId);
      }
      const parsed = input.parse(command.value);
      if (!parsed) return serviceErrorV1('INVALID', input.invalidReason, false, command.correlationId);
      const current = readSnapshot();
      if (!current.ok) return current;
      let ledger: Record<string, IdempotencyLedgerEntryV1>;
      try {
        const parsedLedger = parseLedger(input.ledger.read());
        if (!parsedLedger) return serviceErrorV1('DATA_CORRUPTED', 'repository.idempotency_ledger_corrupted', false, command.correlationId);
        ledger = parsedLedger;
      } catch {
        return serviceErrorV1('UNAVAILABLE', 'repository.idempotency_read_failed', true, command.correlationId);
      }
      const fingerprint = localEtagV1({ expectedEtag: command.expectedEtag, value: parsed }).replace('etag.', 'fp.');
      const replay = ledger[command.idempotencyKey];
      if (replay) {
        if (replay.fingerprint !== fingerprint) {
          return serviceErrorV1('CONFLICT', 'repository.idempotency_key_reused', false, command.correlationId);
        }
        if (current.value.etag !== replay.resultEtag) {
          return serviceErrorV1('CONFLICT', 'repository.idempotency_result_superseded', false, command.correlationId);
        }
        return { ok: true, value: current.value, changed: false };
      }
      if (current.value.etag !== command.expectedEtag) {
        return serviceErrorV1('CONFLICT', 'repository.etag_mismatch', false, command.correlationId);
      }
      const next = { value: parsed, etag: localEtagV1(parsed) };
      try {
        input.storage.write(parsed);
        // Local prototype: separate localStorage envelopes are not a backend
        // transaction. Domain idempotency still guards irreversible events.
        input.ledger.write({ ...ledger, [command.idempotencyKey]: { fingerprint, resultEtag: next.etag } });
      } catch {
        return serviceErrorV1('UNAVAILABLE', 'repository.local_write_failed', true, command.correlationId);
      }
      return { ok: true, value: next, changed: next.etag !== current.value.etag };
    },
  };
}
