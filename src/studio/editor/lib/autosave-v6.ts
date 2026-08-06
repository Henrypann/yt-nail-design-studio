/**
 * V6 autosave debounce + revision guard (PR-04).
 * Prevents stale writes from overwriting newer in-memory state.
 */

export const AUTOSAVE_DEBOUNCE_MS = 2000;

export interface AutosaveRevisionState {
  /** Monotonically increasing edit counter. */
  revision: number;
  /** Last revision that was successfully persisted. */
  lastSavedRevision: number;
  /** Revision waiting to be flushed, or null if clean. */
  pendingRevision: number | null;
}

export function createRevisionState(): AutosaveRevisionState {
  return { revision: 0, lastSavedRevision: 0, pendingRevision: null };
}

/** Bump the revision counter on every commit. Returns the new revision. */
export function bumpRevision(state: AutosaveRevisionState): number {
  state.revision += 1;
  state.pendingRevision = state.revision;
  return state.revision;
}

/**
 * Mark a revision as the target for the next flush.
 * The actual flush is scheduled externally (setTimeout).
 */
export function scheduleAutosave(
  state: AutosaveRevisionState,
  revision: number,
): { shouldFlush: boolean; flushRevision: number | null } {
  state.pendingRevision = revision;
  return { shouldFlush: false, flushRevision: null };
}

/** Return the pending revision to flush, or null if already clean. */
export function flushAutosave(state: AutosaveRevisionState): number | null {
  if (state.pendingRevision === null) return null;
  const rev = state.pendingRevision;
  state.pendingRevision = null;
  return rev;
}

/**
 * After a successful save, advance the lastSavedRevision.
 * Returns null if the saved revision is stale (already superseded).
 */
export function applySaveResult(
  state: AutosaveRevisionState,
  savedRevision: number,
): boolean {
  if (savedRevision <= state.lastSavedRevision) {
    return false;
  }
  state.lastSavedRevision = savedRevision;
  return true;
}
