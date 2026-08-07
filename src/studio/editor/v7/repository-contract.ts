/** Pure, read-only V7 repository boundary. No save API is exposed in PR-V7-02. */

import {
  migrateEditorDocV7,
  type EditorDocV7MigrationDiagnostic,
  type EditorDocV7MigrationResolvers,
  type EditorDocV7MigrationResult,
} from './migrate.ts';

export type EditorDocV7Map = Record<string, unknown>;

function appendDiagnostic(
  diagnostics: EditorDocV7MigrationDiagnostic[],
  diagnostic: EditorDocV7MigrationDiagnostic,
): EditorDocV7MigrationDiagnostic[] {
  const next = [...diagnostics];
  if (next.length < 200) {
    next.push(diagnostic);
    return next;
  }
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index].severity === 'warning') {
      next[index] = diagnostic;
      return next;
    }
  }
  next[next.length - 1] = diagnostic;
  return next;
}

export function getEditorDocV7Result(
  docs: EditorDocV7Map,
  designId: string,
  resolvers: EditorDocV7MigrationResolvers,
): EditorDocV7MigrationResult {
  if (!Object.prototype.hasOwnProperty.call(docs, designId)) return { status: 'missing' };
  const raw = docs[designId];
  const result = migrateEditorDocV7(raw, resolvers);
  const rawDesignId =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as { designId?: unknown }).designId
      : undefined;
  const mismatched = typeof rawDesignId === 'string' && rawDesignId !== designId;
  if (
    (result.status === 'migrated' || result.status === 'migrated_with_warnings') &&
    (result.doc.designId !== designId || mismatched)
  ) {
    const diagnostic: EditorDocV7MigrationDiagnostic = {
      code: 'storage_key_mismatch',
      path: '$.designId',
      severity: 'error',
      message: `storage key/designId mismatch: ${designId} != ${result.doc.designId}`,
    };
    return {
      status: 'invalid',
      sourceVersion: result.sourceVersion,
      reason: diagnostic.message,
      original: structuredClone(result.original),
      diagnostics: appendDiagnostic(result.diagnostics, diagnostic),
      legacyEvidence: structuredClone(result.legacyEvidence),
    };
  }
  if (mismatched && (result.status === 'invalid' || result.status === 'unsupported')) {
    return {
      ...result,
      diagnostics: appendDiagnostic(result.diagnostics, {
        code: 'storage_key_mismatch',
        path: '$.designId',
        severity: 'error',
        message: `storage key/designId mismatch: ${designId} != ${rawDesignId}`,
      }),
    };
  }
  return result;
}

export type { EditorDocV7MigrationResolvers, EditorDocV7MigrationResult };
