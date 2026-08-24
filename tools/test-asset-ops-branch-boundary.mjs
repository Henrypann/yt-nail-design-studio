#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.ASSET_BRANCH_BASE ?? '3f0fb9bc1f39793d300bd4216c637584e23161c9';
const assetHead = process.env.ASSET_HEAD ?? 'HEAD';
const frenchHead = process.env.FRENCH_HEAD ?? 'a1500407a73073bb93b27ae426f9f379904fd76a';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (value) => value ? value.split('\n').filter(Boolean).sort() : [];

assert.doesNotThrow(() => git('merge-base', '--is-ancestor', base, assetHead), 'Branch B must remain a descendant of main');
const assetFiles = lines(git('diff', '--name-only', `${base}..${assetHead}`));
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

const mergeDir = mkdtempSync(join(tmpdir(), 'asset-french-boundary-'));
try {
  const basePackage = git('show', `${base}:package.json`);
  const assetPackage = git('show', `${assetHead}:package.json`);
  const frenchPackage = git('show', `${frenchHead}:package.json`);
  const basePath = join(mergeDir, 'base.json');
  const assetPath = join(mergeDir, 'asset.json');
  const frenchPath = join(mergeDir, 'french.json');
  writeFileSync(basePath, `${basePackage}\n`);
  writeFileSync(assetPath, `${assetPackage}\n`);
  writeFileSync(frenchPath, `${frenchPackage}\n`);

  const mergedText = execFileSync('git', ['merge-file', '-p', assetPath, basePath, frenchPath], { encoding: 'utf8' });
  assert.ok(!mergedText.includes('<<<<<<<'), 'package.json three-way merge must remain conflict-free');
  const merged = JSON.parse(mergedText);
  const asset = JSON.parse(assetPackage);
  const french = JSON.parse(frenchPackage);
  for (const [name, command] of Object.entries(asset.scripts)) {
    assert.equal(merged.scripts[name], command, `merged package must preserve Branch B script ${name}`);
  }
  for (const [name, command] of Object.entries(french.scripts)) {
    assert.equal(merged.scripts[name], command, `merged package must preserve Branch A script ${name}`);
  }
} finally {
  rmSync(mergeDir, { recursive: true, force: true });
}

const sourceFiles = assetFiles.filter((file) => file.startsWith('src/'));
assert.ok(sourceFiles.every((file) => (
  file.startsWith('src/community/')
  || file.startsWith('src/platform/backend/')
  || file.startsWith('src/studio/assets/official-starter-shelf/')
)), `unexpected source scope: ${sourceFiles.join(',')}`);

console.log(`test-asset-ops-branch-boundary: PASS (${assetFiles.length} files; main ancestor; package.json three-way merge clean; no Editor/French ownership crossing)`);
