/**
 * PR-08 self-test: taxonomy IDs, labels, aliases, migrations.
 */

import { strict as assert } from 'node:assert';

const taxonomyMod = await import('../src/lib/taxonomy.ts');
const {
  NAIL_TAXONOMY,
  resolveTaxonomyElement,
  getTaxonomyLabel,
  migrateLegacyId,
  isValidTaxonomyId,
} = taxonomyMod;

/* ── 1. Taxonomy completeness ────────────────────────────── */

{
  // All shapes present
  const shapes = NAIL_TAXONOMY.filter((e) => e.category === 'shape');
  assert.ok(shapes.length >= 5, `expected ≥5 shapes, got ${shapes.length}`);
  const shapeIds = shapes.map((s) => s.id);
  assert.ok(shapeIds.includes('almond'));
  assert.ok(shapeIds.includes('oval'));
  assert.ok(shapeIds.includes('coffin'));
  assert.ok(shapeIds.includes('squoval'));
  assert.ok(shapeIds.includes('square'));

  // All lengths present
  const lengths = NAIL_TAXONOMY.filter((e) => e.category === 'length');
  assert.ok(lengths.length >= 4);

  // All layer types present
  const layers = NAIL_TAXONOMY.filter((e) => e.category === 'layer');
  assert.ok(layers.length >= 6);

  console.log('[test:taxonomy-completeness] PASS');
}

/* ── 2. Label resolution ─────────────────────────────────── */

{
  assert.equal(getTaxonomyLabel('almond', 'en'), 'Almond');
  assert.equal(getTaxonomyLabel('almond', 'zh'), '杏仁形');
  assert.equal(getTaxonomyLabel('gloss', 'en'), 'Gloss');
  assert.equal(getTaxonomyLabel('builtin.draw', 'zh'), '手绘');

  // Unknown ID returns itself
  assert.equal(getTaxonomyLabel('nonexistent'), 'nonexistent');

  console.log('[test:taxonomy-labels] PASS');
}

/* ── 3. Alias migration ──────────────────────────────────── */

{
  // cat_eye → cat-eye
  assert.equal(migrateLegacyId('cat_eye'), 'cat-eye');
  assert.equal(migrateLegacyId('cateye'), 'cat-eye');
  assert.equal(migrateLegacyId('xlong'), 'extra-long');

  // Canonical ID unchanged
  assert.equal(migrateLegacyId('almond'), 'almond');
  assert.equal(migrateLegacyId('cat-eye'), 'cat-eye');

  console.log('[test:taxonomy-aliases] PASS');
}

/* ── 4. Validation ───────────────────────────────────────── */

{
  assert.ok(isValidTaxonomyId('almond'));
  assert.ok(isValidTaxonomyId('cat_eye')); // alias
  assert.ok(!isValidTaxonomyId('nonexistent'));
  assert.ok(!isValidTaxonomyId(''));

  console.log('[test:taxonomy-validation] PASS');
}

/* ── 5. Unique IDs ───────────────────────────────────────── */

{
  const ids = NAIL_TAXONOMY.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'taxonomy IDs must be unique');

  console.log('[test:taxonomy-unique-ids] PASS');
}

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-pr08-taxonomy: all assertions passed');
