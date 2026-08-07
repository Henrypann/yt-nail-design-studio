/**
 * ESM resolve hook: let Node load Vite-oriented Studio modules for fixture generation.
 * - Redirects ./material(.ts) → material-node-shim.mjs (fs silhouette reader)
 * - Maps @/* → src/*
 * - Appends .ts to bare relative imports (Vite-style extensionless)
 */

import fs from 'node:fs';
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
    specifier === '@/studio/editor/lib/material' ||
    ((specifier === './material' || specifier === './material.ts') &&
      parentIsEditorLib(context.parentURL))
  ) {
    return { url: MATERIAL_SHIM, shortCircuit: true, format: 'module' };
  }

  // Vite resolves a bare path to <p>.ts / <p>.tsx or <p>/index.ts(x)
  const withTsOrIndex = (abs) => {
    if (HAS_EXT.test(abs) || HAS_JSON.test(abs)) return abs;
    try {
      if (fs.statSync(abs).isDirectory()) {
        for (const name of ['index.ts', 'index.tsx']) {
          const candidate = path.join(abs, name);
          if (fs.existsSync(candidate)) return candidate;
        }
        return path.join(abs, 'index.ts');
      }
    } catch {
      /* not a directory */
    }
    for (const ext of ['.ts', '.tsx']) {
      if (fs.existsSync(`${abs}${ext}`)) return `${abs}${ext}`;
    }
    return `${abs}.ts`;
  };

  // @/* → src/*
  if (specifier.startsWith('@/')) {
    const abs = withTsOrIndex(path.join(SRC, specifier.slice(2)));
    return nextResolve(pathToFileURL(abs).href, context);
  }

  // Extensionless relative imports (Vite bundler convention)
  if (specifier.startsWith('.') && !HAS_EXT.test(specifier) && !HAS_JSON.test(specifier) && !specifier.includes('?')) {
    if (context.parentURL?.startsWith('file:')) {
      const abs = withTsOrIndex(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      return nextResolve(pathToFileURL(abs).href, context);
    }
    return nextResolve(`${specifier}.ts`, context);
  }

  return nextResolve(specifier, context);
}
