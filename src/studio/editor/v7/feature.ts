export interface EditorDocVersionProbeV7 {
  present: boolean;
  schemaVersion?: number | null;
  kind?: 'supported' | 'unsupported' | 'invalid' | 'unknown';
}

export type EditorWriterRoute =
  | 'v6'
  | 'v7-edit'
  | 'v7-readonly'
  | 'recovery'
  | 'missing';

export function isEditorV7InternalEnabled(
  env: Pick<ImportMetaEnv, 'VITE_EDITOR_V7'> = import.meta.env,
): boolean {
  // V7 is the creation baseline. `0` is an explicit local recovery opt-out;
  // an absent flag must never make a newly created design silently become V6.
  return env.VITE_EDITOR_V7 !== '0';
}

/** Schema selects the writer. The flag only controls whether V7 is editable. */
export function resolveEditorWriterRoute(
  probe: EditorDocVersionProbeV7,
  v7Enabled: boolean,
): EditorWriterRoute {
  if (!probe.present) return 'missing';
  if (probe.schemaVersion === 7) return v7Enabled ? 'v7-edit' : 'v7-readonly';
  if (
    typeof probe.schemaVersion === 'number' &&
    Number.isInteger(probe.schemaVersion) &&
    probe.schemaVersion >= 1 &&
    probe.schemaVersion <= 6
  ) return 'v6';
  return 'recovery';
}
