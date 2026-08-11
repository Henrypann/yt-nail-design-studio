#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { designNewFresh } from '../src/app/routes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

assert.equal(designNewFresh(), '/design/new?fresh=1');
assert.equal(designNewFresh('customer 7'), '/design/new?fresh=1&customerId=customer+7');

const wizard = await read('src/app/pages/design/WizardPage.tsx');
assert.match(wizard, /searchParams\.get\('fresh'\) === '1'/);
assert.match(wizard, /clearWizardDraft\(\);\s*useWizardStore\.getState\(\)\.resetForNewDesign\(\)/);
assert.match(wizard, /SPA 内再次点击“新建设计”/);
assert.match(wizard, /activeDraft: explicitId \|\| fresh \? null : readWizardDraft\(\)/);

const newEntrySources = await Promise.all([
  'src/app/layouts/AppLayout.tsx',
  'src/app/pages/DashboardPage.tsx',
  'src/app/pages/design/DesignListPage.tsx',
  'src/app/pages/customers/CustomerListPage.tsx',
  'src/app/pages/customers/CustomerDetailPage.tsx',
].map(read));
newEntrySources.forEach((source) => assert.match(source, /designNewFresh/));

const stepTwo = await read('src/studio/wizard/StepTwo.tsx');
assert.match(stepTwo, />\s*进入 Editor\s*</);
assert.doesNotMatch(stepTwo, /\{bridged \? ['"]返回自由画布['"] : ['"]打开自由画布['"]\}/);
assert.match(stepTwo, /v7_content_not_supported/);

const manifestPath = path.join(root, 'assets/hero-recipes/mercury-dew/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(manifest.canonical_renderer_output, true);
assert.equal(manifest.production_validated, false);
for (const asset of manifest.assets) {
  const fullPath = path.resolve(path.dirname(manifestPath), asset.path);
  const digest = createHash('sha256').update(await readFile(fullPath)).digest('hex');
  assert.equal(digest, asset.sha256, `${asset.asset_id} hash drift`);
}

console.log('[wizard-v7-flow] fresh/resume split + stable Editor CTA + Mercury asset graph: PASS');
