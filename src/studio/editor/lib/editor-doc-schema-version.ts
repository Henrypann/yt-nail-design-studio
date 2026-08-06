/**
 * EditorDoc 可读 schema 版本（与 migrateEditorDoc 对齐 · PR-02）。
 * 当前 migrator 仅支持 v1–v3；更高版本一律 unsupported，禁止静默覆盖。
 */

/** 当前 migrator 可读取并规范化的最高 schemaVersion。 */
export const EDITOR_DOC_MIGRATABLE_MAX_VERSION = 3;

export type EditorDocSchemaKind = 'supported' | 'unsupported' | 'invalid' | 'unknown';

export function classifyEditorDocSchemaVersion(version: unknown): {
  schemaVersion: number | null;
  kind: EditorDocSchemaKind;
} {
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return { schemaVersion: null, kind: 'unknown' };
  }
  if (!Number.isInteger(version)) {
    return { schemaVersion: version, kind: 'unknown' };
  }
  if (version >= 1 && version <= EDITOR_DOC_MIGRATABLE_MAX_VERSION) {
    return { schemaVersion: version, kind: 'supported' };
  }
  if (version > EDITOR_DOC_MIGRATABLE_MAX_VERSION) {
    return { schemaVersion: version, kind: 'unsupported' };
  }
  return { schemaVersion: version, kind: 'unknown' };
}
