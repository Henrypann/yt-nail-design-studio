#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = process.env.ASSET_BRANCH_BASE ?? 'main';
const frenchHead = process.env.FRENCH_HEAD ?? 'a1500407a73073bb93b27ae426f9f379904fd76a';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (value) => value ? value.split('\n').filter(Boolean).sort() : [];

assert.doesNotThrow(() => git('merge-base', '--is-ancestor', base, 'HEAD'), 'Branch B must remain a descendant of main');
const assetFiles = lines(git('diff', '--name-only', base));
const frenchFiles = lines(git('diff', '--name-only', `${base}..${frenchHead}`));
assert.ok(assetFiles.length > 0, 'Branch B diff must not be empty');

const forbidden = [
  'src/studio/editor/',
  'src/studio/wizard/',
  'src/integration/community-studio/',
  'src/studio/editor/v7/model.ts',
  'src/studio/editor/v7/schema.ts',
  'src/studio/editor/v7/editor-doc-v7.schema.json',
];
for (const file of assetFiles) {
  assert.ok(!forbidden.some((prefix) => file === prefix || file.startsWith(prefix)), `${file}: Branch B crosses Editor/French ownership`);
}
const overlap = assetFiles.filter((file) => frenchFiles.includes(file));
assert.deepEqual(overlap, ['package.json'], 'only package scripts may overlap Branch A before absorption/rebase');

const sourceFiles = assetFiles.filter((file) => file.startsWith('src/'));
assert.ok(sourceFiles.every((file) => (
  file.startsWith('src/community/')
  || file.startsWith('src/platform/backend/')
  || file.startsWith('src/studio/assets/official-starter-shelf/')
)), `unexpected source scope: ${sourceFiles.join(',')}`);

console.log(`test-asset-ops-branch-boundary: PASS (${assetFiles.length} files; main ancestor; only Branch A overlap=package.json; no Editor/French ownership crossing)`);
