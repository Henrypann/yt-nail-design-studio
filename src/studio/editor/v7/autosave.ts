export const EDITOR_V7_AUTOSAVE_DEBOUNCE_MS = 2000;

export interface EditorV7RevisionState {
  savedRevision: number;
  pendingRevision: number | null;
}

export function createEditorV7RevisionState(revision: number): EditorV7RevisionState {
  return { savedRevision: revision, pendingRevision: null };
}

export function markEditorV7RevisionPending(
  state: EditorV7RevisionState,
  revision: number,
): EditorV7RevisionState {
  return { ...state, pendingRevision: revision };
}

export function applyEditorV7SaveResult(
  state: EditorV7RevisionState,
  savedRevision: number,
): EditorV7RevisionState {
  if (savedRevision < state.savedRevision) return state;
  return {
    savedRevision,
    pendingRevision:
      state.pendingRevision !== null && state.pendingRevision > savedRevision
        ? state.pendingRevision
        : null,
  };
}
