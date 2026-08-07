/** PR-08 behavior test: shared labels, compatibility and locale-neutral storage. */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NAIL_TAXONOMY_LABELS,
  NAIL_TAXONOMY_ALIASES,
  canonicalTaxonomyId,
  communityTaxonomyLabel,
  resolveTaxonomyEntry,
  taxonomyLabel,
  validateTaxonomyLabelEntries,
} from '../src/studio/shared/nail-taxonomy-labels.ts';
import { NAIL_SHAPE_IDS } from '../src/generated/shape-types.ts';
import {
  BASE_COVERAGE_IDS,
  DESIGN_LENGTH_PRESET_IDS,
  OPTICAL_EFFECT_IDS,
  TOP_FINISH_IDS,
} from '../src/studio/editor/lib/taxonomy-model.ts';
import { migrateEditorDocV6 } from '../src/studio/editor/v6/migrate.ts';
import { getEditorDocV6Result, saveEditorDocV6ToMap } from '../src/studio/editor/v6/repository-contract.ts';
import { editorDocV6Fixture } from '../src/studio/editor/fixtures/editor-doc-v6.mjs';
import { legacyEditorDocFixtures } from '../src/studio/editor/fixtures/legacy/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const community = JSON.parse(fs.readFileSync(path.join(root, 'public/community/taxonomy.json'), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

/* Registry uniqueness, ownership and enum coverage. */
assert.deepEqual(validateTaxonomyLabelEntries(NAIL_TAXONOMY_LABELS), []);
for (const id of NAIL_SHAPE_IDS) assert.ok(resolveTaxonomyEntry('shape', id), `shape label: ${id}`);
for (const id of DESIGN_LENGTH_PRESET_IDS) assert.ok(resolveTaxonomyEntry('design-length', id), `design length: ${id}`);
for (const id of BASE_COVERAGE_IDS) assert.ok(resolveTaxonomyEntry('base-coverage', id), `coverage: ${id}`);
for (const id of OPTICAL_EFFECT_IDS) assert.ok(resolveTaxonomyEntry('optical-effect', id), `optical: ${id}`);
for (const id of TOP_FINISH_IDS) assert.ok(resolveTaxonomyEntry('top-finish', id), `finish: ${id}`);
assert.ok(NAIL_TAXONOMY_LABELS.every((entry) => entry.owner));
assert.ok(NAIL_TAXONOMY_ALIASES.length >= 6);
assert.ok(NAIL_TAXONOMY_ALIASES.every((alias) => alias.deprecated === true));

const duplicateFixture = [
  { namespace: 'shape', id: 'almond', en: 'Almond', zh: 'Almond', owner: 'shape-registry' },
  { namespace: 'shape', id: 'almond', en: 'Duplicate', zh: 'Duplicate', owner: 'shape-registry' },
];
assert.match(validateTaxonomyLabelEntries(duplicateFixture)[0], /duplicate id/);
const duplicateAliasFixture = [
  { namespace: 'shape', id: 'one', en: 'One', zh: 'One', owner: 'shape-registry', aliases: ['old'] },
  { namespace: 'shape', id: 'two', en: 'Two', zh: 'Two', owner: 'shape-registry', aliases: ['old'] },
];
assert.match(validateTaxonomyLabelEntries(duplicateAliasFixture)[0], /duplicate alias/);

/* Both locales, namespace isolation, aliases and deterministic unknown fallback. */
assert.equal(taxonomyLabel('optical-effect', 'cat-eye', 'en'), 'Cat-Eye');
assert.equal(taxonomyLabel('optical-effect', 'cat-eye', 'zh'), '猫眼');
assert.equal(taxonomyLabel('layer', 'builtin.draw', 'en'), 'Hand Paint');
assert.equal(taxonomyLabel('layer', 'builtin.draw', 'zh'), '手绘');
assert.equal(taxonomyLabel('attachment', 'pearl', 'en'), 'Pearl');
assert.equal(taxonomyLabel('optical-effect', 'pearl', 'en'), 'Pearlescent');
for (const locale of ['zh', 'en']) {
  assert.equal(taxonomyLabel('community-effect', 'gloss', locale), taxonomyLabel('top-finish', 'gloss', locale));
  assert.equal(taxonomyLabel('wizard-finish', 'gloss', locale), taxonomyLabel('top-finish', 'gloss', locale));
  assert.equal(taxonomyLabel('community-effect', 'pearl', locale), taxonomyLabel('optical-effect', 'pearl', locale));
}
assert.equal(canonicalTaxonomyId('optical-effect', 'cat_eye'), 'cat-eye');
assert.equal(canonicalTaxonomyId('geometry-length', 'xlong'), 'extra-long');
assert.equal(canonicalTaxonomyId('shape', 'ballerina'), 'ballerina');
assert.equal(taxonomyLabel('shape', 'future-shape', 'en'), 'Unknown (future-shape)');
assert.equal(taxonomyLabel('shape', 'future-shape', 'zh'), '未知（future-shape）');
assert.equal(taxonomyLabel('shape', '', 'en'), 'Unknown (missing)');

/* Community fixtures use the same resolver and never expose undefined. */
const communityGroups = [
  ['community-style', community.mainStyles],
  ['community-occasion', community.occasions],
  ['community-mood', community.moods],
  ['community-effect', community.effects],
  ['community-color', community.colors],
  ['community-season', community.seasons],
  ['community-subject', community.subjects],
];
for (const [namespace, items] of communityGroups) {
  for (const item of items) {
    assert.ok(communityTaxonomyLabel(namespace, item, 'zh'));
    assert.ok(communityTaxonomyLabel(namespace, item, 'en'));
  }
}
for (const effect of community.effects) {
  assert.equal(
    communityTaxonomyLabel('community-effect', effect, 'en'),
    effect.labelEn,
    `Community effect label must match shared US terminology: ${effect.id}`,
  );
  assert.equal(communityTaxonomyLabel('community-effect', effect, 'zh'), effect.label);
}
assert.equal(
  communityTaxonomyLabel('community-style', { id: 'fixture-only', label: '仅夹具', labelEn: 'Fixture only' }, 'en'),
  'Fixture only',
);

/* Locale switching changes labels only, not Wizard-like selections. */
const wizardSelection = {
  shape: 'almond',
  length: 'extra-long',
  finish: 'pearl',
  fingerOverrides: { R4: { decorationId: 'pearl' } },
};
const wizardBefore = JSON.stringify(wizardSelection);
assert.notEqual(
  taxonomyLabel('geometry-length', wizardSelection.length, 'zh'),
  taxonomyLabel('geometry-length', wizardSelection.length, 'en'),
);
assert.notEqual(
  taxonomyLabel('wizard-finish', wizardSelection.finish, 'zh'),
  taxonomyLabel('wizard-finish', wizardSelection.finish, 'en'),
);
assert.equal(JSON.stringify(wizardSelection), wizardBefore);

/* V1-v5 migration preserves taxonomy IDs, recipes and layer IDs across locale reads. */
for (const fixture of legacyEditorDocFixtures) {
  const before = JSON.stringify(fixture);
  const result = migrateEditorDocV6(clone(fixture));
  assert.equal(result.status, 'ok', `legacy v${fixture.schemaVersion}`);
  const migratedBeforeLabels = JSON.stringify(result.doc);
  taxonomyLabel('shape', result.doc.defaultGeometry.shape, 'zh');
  taxonomyLabel('shape', result.doc.defaultGeometry.shape, 'en');
  taxonomyLabel('geometry-length', result.doc.defaultGeometry.length, 'zh');
  taxonomyLabel('geometry-length', result.doc.defaultGeometry.length, 'en');
  for (const nail of Object.values(result.doc.nails)) {
    for (const layer of nail.layers) {
      taxonomyLabel('layer', layer.typeId, 'zh');
      taxonomyLabel('layer', layer.typeId, 'en');
    }
  }
  assert.equal(JSON.stringify(result.doc), migratedBeforeLabels, `locale reads mutate v${fixture.schemaVersion}`);
  assert.equal(JSON.stringify(fixture), before, `migration mutates v${fixture.schemaVersion}`);
  if (fixture.schemaVersion === 3) assert.equal(Object.keys(result.doc.recipeInstances).length, 1);
}

/* V6 save/reload preserves locale-neutral recipes, layers and document IDs. */
const v6 = clone(editorDocV6Fixture);
const v6Before = JSON.stringify(v6);
taxonomyLabel('optical-effect', v6.appearance.opticalEffect, 'zh');
taxonomyLabel('optical-effect', v6.appearance.opticalEffect, 'en');
for (const nail of Object.values(v6.nails)) {
  for (const layer of nail.layers) {
    taxonomyLabel('layer', layer.typeId, 'zh');
    taxonomyLabel('layer', layer.typeId, 'en');
  }
}
assert.equal(JSON.stringify(v6), v6Before);
const map = {};
assert.equal(saveEditorDocV6ToMap(map, v6).status, 'ok');
const loaded = getEditorDocV6Result(map, v6.designId);
assert.equal(loaded.status, 'ok');
assert.deepEqual(loaded.doc, v6);
assert.deepEqual(loaded.doc.recipeInstances, v6.recipeInstances);
assert.deepEqual(
  Object.values(loaded.doc.nails).flatMap((nail) => nail.layers.map((layer) => layer.typeId)),
  Object.values(v6.nails).flatMap((nail) => nail.layers.map((layer) => layer.typeId)),
);

console.log('test-pr08-taxonomy: shared labels and locale-neutral persistence PASS');
