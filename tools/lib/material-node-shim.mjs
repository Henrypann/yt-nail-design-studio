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
const templateIndex = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'material-library/index.json'), 'utf8'),
);
const decorationManifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/decorations/manifest.json'), 'utf8'),
);
const shapeParams = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'material-library/shapes/shape-params.json'), 'utf8'),
);
const shapeCapabilities = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'material-library/shapes/shape-capabilities.json'), 'utf8'),
);

export const TEMPLATES = templateIndex.templates ?? [];
export const DECORATIONS = decorationManifest.decorations ?? [];
export const SHAPE_PARAMS_VERSION = Number.isInteger(shapeParams.version) ? shapeParams.version : 0;
export const SHAPE_CAPABILITIES_VERSION = Number.isInteger(shapeCapabilities.version) ? shapeCapabilities.version : 0;
export const EDITOR_SHAPE_CAPABILITIES = shapeCapabilities.shapes ?? [];

export function editorShapeCapability(shape) {
  return EDITOR_SHAPE_CAPABILITIES.find((entry) => entry.id === shape) ?? null;
}

export function templateById(id) {
  return TEMPLATES.find((template) => template.id === id);
}

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
