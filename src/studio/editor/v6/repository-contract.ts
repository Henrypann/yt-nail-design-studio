/**
 * Version-neutral EditorDocV6 repository boundary (PR-03).
 * Read/migrate is pure with respect to the provided storage map.
 */

import { migrateEditorDocV6, type EditorDocV6MigrationResult } from './migrate.ts';
import type { EditorDocV6 } from './model.ts';
import { parseEditorDocV6 } from './schema.ts';

export type EditorDocMap = Record<string, unknown>;

export type EditorDocV6SaveResult =
  | { status: 'ok'; doc: EditorDocV6 }
  | { status: 'invalid'; reason: string }
  | { status: 'rejected'; reason: string };

export type { EditorDocV6MigrationResult };

/** Pure load from an in-memory/raw map. Does not mutate `docs`. */
export function getEditorDocV6Result(
  docs: EditorDocMap,
  designId: string,
): EditorDocV6MigrationResult {
  if (!Object.prototype.hasOwnProperty.call(docs, designId)) {
    return { status: 'missing' };
  }
  const result = migrateEditorDocV6(docs[designId]);
  if (result.status === 'ok' && result.doc.designId !== designId) {
    return {
      status: 'invalid',
      reason: `storage key/designId mismatch: ${designId} != ${result.doc.designId}`,
    };
  }
  return result;
}

export function inspectEditorDocV6Raw(raw: unknown): {
  present: boolean;
  schemaVersion: number | null;
  kind: 'supported' | 'unsupported' | 'invalid' | 'unknown';
} {
  if (raw == null) {
    return { present: false, schemaVersion: null, kind: 'unknown' };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { present: true, schemaVersion: null, kind: 'invalid' };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isFinite(version) || !Number.isInteger(version)) {
    return { present: true, schemaVersion: null, kind: 'unknown' };
  }
  if (version >= 1 && version <= 6) {
    return { present: true, schemaVersion: version, kind: 'supported' };
  }
  if (version > 6) {
    return { present: true, schemaVersion: version, kind: 'unsupported' };
  }
  return { present: true, schemaVersion: version, kind: 'unknown' };
}

/**
 * Explicit save boundary: only schema-6 documents may be written.
 * Mutates `docs` only after validation succeeds.
 */
export function saveEditorDocV6ToMap(
  docs: EditorDocMap,
  candidate: unknown,
): EditorDocV6SaveResult {
  const parsed = parseEditorDocV6(candidate);
  if (!parsed.ok) {
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      'schemaVersion' in candidate &&
      (candidate as { schemaVersion?: unknown }).schemaVersion !== 6
    ) {
      return {
        status: 'rejected',
        reason: 'only schemaVersion 6 documents may be saved',
      };
    }
    return { status: 'invalid', reason: parsed.reason };
  }
  docs[parsed.doc.designId] = structuredClone(parsed.doc);
  return { status: 'ok', doc: parsed.doc };
}
