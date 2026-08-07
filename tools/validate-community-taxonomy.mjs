#!/usr/bin/env node
/**
 * validate-community-taxonomy.mjs · Community taxonomy contract（PR-01）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'public/community/taxonomy.json'), 'utf8'));
assert.equal(taxonomy.schemaVersion, 1);
assert.equal(taxonomy.mainStyles.length, 10);
const styleIds = new Set(taxonomy.mainStyles.map((s) => s.id));
for (let i = 1; i <= 10; i += 1) {
  assert.ok(styleIds.has(`ST-${String(i).padStart(2, '0')}`), `missing ST-${i}`);
}
for (const key of ['mainStyles', 'occasions', 'moods', 'effects', 'colors', 'seasons', 'subjects']) {
  assert.ok(Array.isArray(taxonomy[key]) && taxonomy[key].length > 0, key);
  const ids = taxonomy[key].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, `${key} unique`);
  for (const item of taxonomy[key]) {
    assert.equal(typeof item.label, 'string');
    assert.ok(item.label.length > 0, `${key}.${item.id} label`);
    assert.equal(typeof item.labelEn, 'string', `${key}.${item.id} labelEn`);
    assert.ok(item.labelEn.length > 0, `${key}.${item.id} labelEn empty`);
  }
}

const contentIndex = JSON.parse(
  fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'),
);
for (const c of contentIndex.contents) {
  assert.ok(styleIds.has(c.mainStyleId), `content ${c.contentId} unknown style ${c.mainStyleId}`);
}

console.log('[test:community-taxonomy] PASS');
