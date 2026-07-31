/**
 * Node-side material shim for Canonical Renderer fixture generation.
 *
 * Replaces Vite-only import.meta.glob in src/studio/editor/lib/material.ts.
 * getSilhouette reads the same silhouette true source on disk; pattern/decoration
 * return null because Mercury fixtures do not use them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SILHOUETTE_DIR = path.join(ROOT, 'material-library/shapes/silhouettes');

function silhouetteFileName(shape, length) {
  return `${shape}_${String(length).replace('-', '_')}.svg`;
}

/** @returns {{ viewBox: string, pathD: string } | null} */
export function getSilhouette(shape, length) {
  const file = path.join(SILHOUETTE_DIR, silhouetteFileName(shape, length));
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  // Same two regexes as material.ts getSilhouette
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
  const pathD = raw.match(/<path d="([^"]+)"/)?.[1];
  if (viewBox && pathD) return { viewBox, pathD };
  return null;
}

export function getPatternArtwork() {
  return null;
}

export function getDecorationInner() {
  return null;
}
