#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(root, 'material-library', 'templates');
const output = path.join(root, 'material-library', 'template-pattern-assets.v7.json');
const templateIds = (await readdir(templatesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const assets = [];
for (const templateId of templateIds) {
  const manifest = JSON.parse(await readFile(path.join(templatesRoot, templateId, 'manifest.json'), 'utf8'));
  const patterns = manifest.patterns && typeof manifest.patterns === 'object' ? manifest.patterns : {};
  for (const [shape, relativePath] of Object.entries(patterns).sort(([a], [b]) => a.localeCompare(b))) {
    const bytes = await readFile(path.join(templatesRoot, templateId, String(relativePath)));
    assets.push({
      templateId,
      shape,
      assetId: `asset.template-pattern.${templateId}.${shape}`,
      revision: `template-v${manifest.version}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
}

await writeFile(output, `${JSON.stringify({ version: 1, assets }, null, 2)}\n`);
console.log(`[v7-template-assets] wrote ${assets.length} verified SVG refs`);
