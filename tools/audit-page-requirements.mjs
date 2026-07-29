#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const refresh = process.argv.includes('--refresh');
const requirementsUrl = pathToFileURL(resolve(projectRoot, 'src/lib/page-requirements.ts')).href;
const { flattenStudioRequirements } = await import(requirementsUrl);
const entries = flattenStudioRequirements();
const errors = [];

function sha256(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) return walk(absolute);
    return absolute.endsWith('.ts') || absolute.endsWith('.tsx') ? [absolute] : [];
  });
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const moduleIds = entries.map(({ module }) => module.id);
const debugIds = entries.map(({ module }) => module.debugId);
for (const duplicate of duplicateValues(moduleIds)) errors.push(`duplicate module id: ${duplicate}`);
for (const duplicate of duplicateValues(debugIds)) errors.push(`duplicate debug id: ${duplicate}`);

const moduleIdSet = new Set(moduleIds);
for (const { module } of entries) {
  if (module.parentId && !moduleIdSet.has(module.parentId)) {
    errors.push(`missing parent ${module.parentId} for ${module.id}`);
  }
}

const nextHashes = {};
for (const { module } of entries) {
  for (const ref of module.sourceRefs) {
    const key = `${ref.path}#${ref.symbol}`;
    const absolute = resolve(projectRoot, ref.path);
    if (!existsSync(absolute)) {
      errors.push(`missing source: ${key}`);
      continue;
    }
    const source = readFileSync(absolute, 'utf8');
    if (!new RegExp(`\\b${ref.symbol.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(source)) {
      errors.push(`missing symbol: ${key}`);
    }
    const actualHash = sha256(source);
    nextHashes[key] = actualHash;
    if (!refresh && ref.reviewedHash !== actualHash) {
      errors.push(`stale review: ${key}`);
    }
  }
}

const sourceFiles = walk(resolve(projectRoot, 'src'));
const implementedStudioIds = new Set();
for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/data-debug-id=["'](studio\.[^"']+)["']/g)) {
    implementedStudioIds.add(match[1]);
  }
}
for (const id of implementedStudioIds) {
  if (!new Set(debugIds).has(id)) {
    errors.push(`orphan Studio data-debug-id: ${id}`);
  }
}

if (refresh) {
  const outputPath = resolve(projectRoot, 'src/lib/page-requirement-hashes.json');
  const sorted = Object.fromEntries(Object.entries(nextHashes).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  console.log(`requirements:audit refreshed ${Object.keys(sorted).length} source fingerprints`);
} else if (errors.length === 0) {
  console.log(
    `requirements:audit PASS · ${entries.length} modules · ${Object.keys(nextHashes).length} source references · ${implementedStudioIds.size} DOM ids`,
  );
}

if (errors.length > 0) {
  console.error(`requirements:audit FAIL · ${errors.length} issue(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

// Keep output paths understandable when invoked outside npm.
if (process.env.DEBUG_REQUIREMENTS_AUDIT === '1') {
  console.log(`project: ${relative(process.cwd(), projectRoot) || '.'}`);
}
