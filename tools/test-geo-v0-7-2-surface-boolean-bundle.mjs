import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    if ((await stat(absolute)).isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}
const files = await walk(dist);
const relative = files.map((file) => path.relative(dist, file).split(path.sep).join('/'));
assert.ok(!relative.some((file) => /surface-boolean|manifold|\.wasm$/i.test(file)),
  `production output contains internal kernel artifacts: ${relative.filter((file) => /surface-boolean|manifold|\.wasm$/i.test(file)).join(', ')}`);
const js = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(file, 'utf8')))).join('\n');
for (const forbidden of [
  '/internal/surface-boolean-v072',
  'nail-surface-boolean-v1',
  'surface_boolean_worker_timeout',
  'manifold-3d/3.5.1',
  'Registry V2 + UV surface frame',
]) assert.ok(!js.includes(forbidden), `production JS leaked internal Boolean marker: ${forbidden}`);
assert.ok(!relative.some((file) => file.endsWith('.stl')), 'production output must remain STL-free');
console.log(`test-geo-v0-7-2-surface-boolean-bundle: PASS (${relative.length} files, zero internal route/kernel/WASM/STL leakage)`);
