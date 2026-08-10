/**
 * EditorDoc 可读 schema 版本（与 migrate / v6 契约对齐 · PR-03）。
 * v1–v7 为已知可读家族；v1–v6 可进入 V6 migrator，V7 由精确 writer 读取。
 */

/** 当前 v6 migrator 可读取并规范化的最高 schemaVersion。 */
export const EDITOR_DOC_MIGRATABLE_MAX_VERSION = 6;

/** 当前应用知道且必须保留的最高 schemaVersion。 */
export const EDITOR_DOC_KNOWN_MAX_VERSION = 7;

/** 遗留 v3 运行时路径仍仅直接规范化到 schema 3。 */
export const EDITOR_DOC_LEGACY_RUNTIME_MAX_VERSION = 3;

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
  if (version >= 1 && version <= EDITOR_DOC_KNOWN_MAX_VERSION) {
    return { schemaVersion: version, kind: 'supported' };
  }
  if (version > EDITOR_DOC_KNOWN_MAX_VERSION) {
    return { schemaVersion: version, kind: 'unsupported' };
  }
  return { schemaVersion: version, kind: 'unknown' };
}
