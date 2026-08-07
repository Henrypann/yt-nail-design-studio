/** PR-06 build-output gate. Run after build:integration. */

import { strict as assert } from 'node:assert';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    if ((await stat(absolute)).isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const files = await walk(distPath);
const relative = files.map((file) => path.relative(distPath, file).split(path.sep).join('/'));
assert.ok(relative.includes('assets/glb/manifest.v1.json'), 'versioned web manifest must ship');
assert.ok(!relative.some((file) => file.endsWith('.raw.glb')), 'raw GLBs must not ship');
assert.ok(!relative.some((file) => file.endsWith('.stl')), 'internal STL inputs must not ship');
assert.ok(!relative.some((file) => file.endsWith('.bak')), 'backup files must not ship');
assert.ok(!relative.some((file) => file.startsWith('assets/golden-fixtures/')), 'golden review fixtures must not ship');
assert.ok(!relative.some((file) => file.startsWith('assets/shape-calibration/')), 'calibration inputs must not ship');

const html = await readFile(new URL('index.html', dist), 'utf8');
const initialScripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1].replace(/^\//, ''));
assert.ok(initialScripts.length > 0, 'build must have an entry script');
const initialCode = (await Promise.all(initialScripts.map((file) => readFile(new URL(file, dist), 'utf8')))).join('\n');
assert.ok(!initialCode.includes('RoomEnvironment'), 'Three.js renderer implementation must not be in the initial route chunk');

const jsFiles = relative.filter((file) => file.endsWith('.js'));
assert.ok(jsFiles.some((file) => file.startsWith('assets/three-renderer-')), 'design-specific Three renderer must be a lazy chunk');
const lazyThreeCode = (await Promise.all(jsFiles.filter((file) => !initialScripts.includes(file)).map((file) => readFile(new URL(file, dist), 'utf8')))).join('\n');
assert.ok(lazyThreeCode.includes('RoomEnvironment'), 'lazy chunks must contain the Three renderer implementation');

console.log(`test-pr06-bundle: PASS (${initialScripts.length} initial JS, ${jsFiles.length - initialScripts.length} lazy/shared JS)`);
