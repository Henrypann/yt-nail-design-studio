/**
 * ESM resolve hook: let Node load Vite-oriented Studio modules for fixture generation.
 * - Redirects ./material(.ts) → material-node-shim.mjs (fs silhouette reader)
 * - Maps @/* → src/*
 * - Appends .ts to bare relative imports (Vite-style extensionless)
 */

import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HOOK_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HOOK_DIR, '../..');
const SRC = path.join(ROOT, 'src');
const MATERIAL_SHIM = pathToFileURL(path.join(HOOK_DIR, 'material-node-shim.mjs')).href;

const HAS_EXT = /\.[cm]?[jt]sx?$/;
const HAS_JSON = /\.json$/;

function parentIsEditorLib(parentURL) {
  if (!parentURL) return false;
  try {
    const p = fileURLToPath(parentURL);
    return p.includes(`${path.sep}studio${path.sep}editor${path.sep}lib${path.sep}`);
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  // Redirect material module (Vite glob) to fs shim when imported from editor/lib
  if (
    (specifier === './material' || specifier === './material.ts') &&
    parentIsEditorLib(context.parentURL)
  ) {
    return { url: MATERIAL_SHIM, shortCircuit: true, format: 'module' };
  }

  // @/* → src/*
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const withExt = HAS_EXT.test(rel) || HAS_JSON.test(rel) ? rel : `${rel}.ts`;
    const abs = path.join(SRC, withExt);
    return nextResolve(pathToFileURL(abs).href, context);
  }

  // Extensionless relative imports → .ts (Vite bundler convention)
  if (specifier.startsWith('.') && !HAS_EXT.test(specifier) && !HAS_JSON.test(specifier) && !specifier.includes('?')) {
    return nextResolve(`${specifier}.ts`, context);
  }

  return nextResolve(specifier, context);
}
