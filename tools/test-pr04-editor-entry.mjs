/** PR-04 production entry boundary: EditorPage must reach only the V6 writable store. */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src/app/pages/design/EditorPage.tsx');
const visited = new Set();
const parents = new Map();

function resolveModule(fromFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function dependencyChain(file) {
  const chain = [file];
  let current = file;
  while (parents.has(current)) {
    current = parents.get(current);
    chain.unshift(current);
  }
  return chain.map((item) => path.relative(root, item)).join(' -> ');
}

function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  assert.notEqual(
    path.normalize(relative),
    path.normalize('src/studio/editor/store.ts'),
    `legacy writable store is reachable: ${dependencyChain(file)}`,
  );
  assert.ok(!/\buseEditorStore\b/.test(source), `legacy useEditorStore is reachable: ${dependencyChain(file)}`);

  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveModule(file, match[1]);
    if (!dependency) continue;
    if (!parents.has(dependency)) parents.set(dependency, file);
    visit(dependency);
  }
}

visit(entry);

const editorPage = fs.readFileSync(entry, 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/studio/editor/components/EditorShellV6.tsx'), 'utf8');
assert.match(editorPage, /EditorShellV6/);
assert.match(editorPage, /createBlankEditorDesignV6/);
assert.match(editorPage, /useEditorV6Store/);
assert.match(editorPage, /save_error/);
assert.match(editorPage, /unsupported/);
assert.match(shell, /data-editor-schema="6"/);
assert.match(shell, /LayerPanelV6/);
assert.match(shell, /FINGER_CODES\.map/);

console.log(`test-pr04-editor-entry: V6-only dependency boundary PASS (${visited.size} local modules)`);
