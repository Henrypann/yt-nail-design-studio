#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createBlankEditorDocV7, inspectWizardEditorV7Compatibility, wizardDesignToEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { createDimensionalDecorationV7, dimensionalDecorationArchetypeV7, dimensionalDecorationFidelityV7 } from '../src/studio/editor/v7/dimensional-decoration.ts';
import { PETAL_PEARL_BLOOM_FLAT_ASSET, PETAL_PEARL_BLOOM_LOOK_COMPOSITION, materializePetalPearlBloomV7 } from '../src/studio/editor/v7/petal-pearl-bloom.ts';
import { resolveBundledFlatAssetV7 } from '../src/studio/editor/v7/flat-content-assets.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/hero-recipes/petal-pearl-bloom/manifest.json'), 'utf8'));
assert.equal(manifest.asset_status, 'SIMULATED');
assert.equal(manifest.production_validated, false);
for (const asset of manifest.assets) {
  const assetPath = asset.path.startsWith('/') ? path.join(root, asset.path.slice(1)) : path.join(root, 'assets/hero-recipes/petal-pearl-bloom', asset.path);
  const bytes = fs.readFileSync(assetPath);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.asset_id);
}
assert.equal(resolveBundledFlatAssetV7(PETAL_PEARL_BLOOM_FLAT_ASSET)?.id, 'bundled.sticker.petal-pearl-outline');
console.log('[petal-pearl] look and layer asset checksums: PASS');

const archetypes = ['crystal_flower', 'lavender_pearl', 'silver_studs', 'ruby_microbeads'];
for (const archetype of archetypes) {
  const decoration = createDimensionalDecorationV7(archetype, `element.${archetype}`);
  assert.ok(decoration && decoration.kind === 'attachment_3d');
  assert.equal(dimensionalDecorationArchetypeV7(decoration), archetype);
  assert.equal(dimensionalDecorationFidelityV7(decoration), 'approximate');
}
console.log('[petal-pearl] four structured dimensional presets: PASS');

const blank = createBlankEditorDocV7({ designId: 'design.petal-pearl.test', shape: 'oval', length: 'medium', baseColor: '#F4DCE5' });
assert.equal(blank.ok, true);
const source = structuredClone(blank.doc);
const materialized = materializePetalPearlBloomV7(blank.doc);
assert.ok(materialized);
assert.deepEqual(blank.doc, source, 'materializer must not mutate source');
assert.equal(parseEditorDocV7(materialized).ok, true);
assert.deepEqual(Object.keys(PETAL_PEARL_BLOOM_LOOK_COMPOSITION).sort(), Object.keys(materialized.nails).sort());
const countKind = (kind) => Object.values(materialized.nails).reduce((count, nail) => count + nail.steps.filter((step) => step.kind === kind).length, 0);
assert.equal(countKind('background'), 10);
assert.equal(countKind('flat_design'), 2);
assert.equal(countKind('surface_effect'), 2);
assert.equal(countKind('dimensional_decoration'), 10);
assert.equal(countKind('surface_finish'), 10);
const decorations = Object.values(materialized.nails).flatMap((nail) => nail.steps.flatMap((step) => step.kind === 'dimensional_decoration' ? step.decorations : []));
assert.deepEqual(new Set(decorations.map(dimensionalDecorationArchetypeV7)), new Set(archetypes));
console.log('[petal-pearl] ten-finger canonical process model: PASS');

const summary = {
  id: 'design.petal-pearl.wizard', customerId: '', title: '花瓣珍珠绽放', shape: 'oval', length: 'medium',
  templateId: 't_petal_pearl_bloom_simulated', baseColor: '#F4DCE5', finish: 'gloss', status: 'draft', source: 'wizard', version: 1,
};
const preflight = inspectWizardEditorV7Compatibility(summary);
assert.equal(preflight.ok, false);
assert.equal(preflight.reason, 'template_asset_missing');
const created = wizardDesignToEditorDocV7(summary, '2026-08-12T03:00:00.000Z');
assert.equal(created.ok, false);
assert.equal(created.reason, 'template_asset_missing');
console.log('[petal-pearl] Wizard to Editor V7 blocks unregistered template asset: PASS');

console.log('[test:editor-v7-petal-pearl-bloom] PASS');
