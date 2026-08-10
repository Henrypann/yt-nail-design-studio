import { readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import type { EditorDocV7 } from './model';
import {
  getEditorDocV7Result,
  type EditorDocV7Map,
  type EditorDocV7MigrationResolvers,
  type EditorDocV7MigrationResult,
} from './repository-contract';
import { parseEditorDocV7 } from './schema';

export interface EditorDocV7Storage {
  read(): EditorDocV7Map;
  write(next: EditorDocV7Map): void | Promise<void>;
}

export type EditorDocV7SaveFailure =
  | 'invalid_document'
  | 'storage_key_mismatch'
  | 'source_not_editable'
  | 'stale_revision'
  | 'write_failed';

export type EditorDocV7SaveResult =
  | { ok: true; doc: EditorDocV7 }
  | { ok: false; reason: EditorDocV7SaveFailure; message: string };

export interface EditorDocV7SaveContext {
  sourceVersion: number;
  userEdited: boolean;
  expectedStoredRevision: number | null;
  expectedSourceToken: string;
}

export interface EditorDocV7Repository {
  load(designId: string): EditorDocV7MigrationResult;
  save(
    designId: string,
    doc: EditorDocV7,
    context: EditorDocV7SaveContext,
  ): Promise<EditorDocV7SaveResult>;
}

export function createLocalEditorDocV7Storage(): EditorDocV7Storage {
  return {
    read: () => readData<EditorDocV7Map>(StorageKeys.editorDocs) ?? {},
    write: (next) => {
      writeEnvelope(StorageKeys.editorDocs, next);
    },
  };
}

export function createEditorDocV7Repository(
  storage: EditorDocV7Storage,
  resolvers: EditorDocV7MigrationResolvers,
): EditorDocV7Repository {
  let writeQueue: Promise<void> = Promise.resolve();

  const saveSerialized = async (
    designId: string,
    doc: EditorDocV7,
    context: EditorDocV7SaveContext,
  ): Promise<EditorDocV7SaveResult> => {
    const parsed = parseEditorDocV7(doc);
    if (!parsed.ok) {
      return { ok: false, reason: 'invalid_document', message: parsed.reason };
    }
    if (parsed.doc.designId !== designId) {
      return {
        ok: false,
        reason: 'storage_key_mismatch',
        message: `storage key/designId mismatch: ${designId} != ${parsed.doc.designId}`,
      };
    }

    const current = storage.read();
    const raw = current[designId];
    if (raw === undefined) {
      return { ok: false, reason: 'source_not_editable', message: 'V7 runtime does not create blank documents' };
    }
    if (JSON.stringify(raw) !== context.expectedSourceToken) {
      return { ok: false, reason: 'stale_revision', message: 'stored source changed after it was loaded' };
    }
    const rawVersion =
      raw !== null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as { schemaVersion?: unknown }).schemaVersion
        : undefined;
    const replacingV7 = rawVersion === 7;
    const legacyRead = getEditorDocV7Result(current, designId, resolvers);
    const replacingMigratedLegacy =
      context.userEdited &&
      context.sourceVersion >= 1 &&
      context.sourceVersion <= 6 &&
      context.expectedStoredRevision === null &&
      (legacyRead.status === 'migrated' || legacyRead.status === 'migrated_with_warnings') &&
      legacyRead.migrated &&
      legacyRead.sourceVersion === context.sourceVersion;
    if (!replacingV7 && !replacingMigratedLegacy) {
      return { ok: false, reason: 'source_not_editable', message: 'source cannot be replaced by the V7 writer' };
    }
    if (replacingV7) {
      const currentParsed = parseEditorDocV7(raw);
      if (!currentParsed.ok) {
        return { ok: false, reason: 'source_not_editable', message: 'stored V7 source is invalid' };
      }
      if (
        context.expectedStoredRevision === null ||
        currentParsed.doc.revision !== context.expectedStoredRevision
      ) {
        return { ok: false, reason: 'stale_revision', message: 'stored revision changed after it was loaded' };
      }
      if (parsed.doc.revision < currentParsed.doc.revision) {
        return { ok: false, reason: 'stale_revision', message: 'a newer V7 revision is already stored' };
      }
      if (
        currentParsed.doc.revision === parsed.doc.revision &&
        JSON.stringify(currentParsed.doc) !== JSON.stringify(parsed.doc)
      ) {
        return { ok: false, reason: 'stale_revision', message: 'same revision has different content' };
      }
    }

    const next = structuredClone(current);
    next[designId] = structuredClone(parsed.doc);
    try {
      await storage.write(next);
    } catch (error) {
      return {
        ok: false,
        reason: 'write_failed',
        message: error instanceof Error ? error.message : 'storage write failed',
      };
    }
    return { ok: true, doc: structuredClone(parsed.doc) };
  };

  return {
    load: (designId) => getEditorDocV7Result(storage.read(), designId, resolvers),
    save: (designId, doc, context) => {
      const result = writeQueue.then(() => saveSerialized(designId, doc, context));
      writeQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
