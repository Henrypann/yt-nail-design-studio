/**
 * Collision-resistant editor IDs and deterministic migration IDs (PR-03).
 * New IDs must not rely on Date.now() alone.
 */

let counter = 0;

function randomChunk(bytes = 8): string {
  const buffer = new Uint8Array(bytes);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Runtime / edit-time ID generator. Safe across rapid repeated calls. */
export function generateEditorId(prefix: string): string {
  counter += 1;
  return `${prefix}_${randomChunk(8)}_${counter.toString(36)}_${randomChunk(4)}`;
}

/** Deterministic migration ID from stable source parts. */
export function migrateDeterministicId(
  parts: Array<string | number | null | undefined>,
): string {
  const normalized = parts
    .map((part) => {
      if (part == null) return '_';
      return String(part).replace(/[^A-Za-z0-9_-]+/g, '_');
    })
    .join('__');
  return `mig_${normalized}`;
}
