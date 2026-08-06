/**
 * PR-05 self-test: partition styles, resolve template.
 * (v6 bridge requires Vite runtime for import.meta.glob — tested via build + typecheck)
 */

import { strict as assert } from 'node:assert';

/* ── 1. Partition styles ─────────────────────────────────── */

const partitionMod = await import('../src/studio/wizard/partition-styles.ts');
const { partitionStyles, MAX_CURATED, MAX_CONCEPT, MAX_RECOMMENDATIONS } = partitionMod;

{
  assert.equal(MAX_CURATED, 2);
  assert.equal(MAX_CONCEPT, 1);
  assert.equal(MAX_RECOMMENDATIONS, 3);

  // Empty input
  const empty = partitionStyles([]);
  assert.deepEqual(empty.primary, []);
  assert.deepEqual(empty.concept, []);

  // 3 curated + 2 concept → 2 curated + 1 concept
  const styles = [
    { id: 'a', priority: 3, cover_status: 'REAL' },
    { id: 'b', priority: 1, cover_status: 'REAL' },
    { id: 'c', priority: 2, cover_status: 'REAL' },
    { id: 'd', priority: 4, cover_status: 'CONCEPT' },
    { id: 'e', priority: 5, cover_status: 'CONCEPT' },
  ];
  const result = partitionStyles(styles);
  assert.equal(result.primary.length, 2);
  assert.equal(result.concept.length, 1);
  // Sorted by priority: b(1), c(2) are primary; d(4) is concept
  assert.equal(result.primary[0].id, 'b');
  assert.equal(result.primary[1].id, 'c');
  assert.equal(result.concept[0].id, 'd');

  // 1 curated + 0 concept
  const single = partitionStyles([{ id: 'x', priority: 1, cover_status: 'REAL' }]);
  assert.equal(single.primary.length, 1);
  assert.equal(single.concept.length, 0);

  console.log('[test:partition-styles] PASS');
}

/* ── 2. Resolve template ─────────────────────────────────── */

const resolveMod = await import('../src/studio/preview/resolve-template.ts');
const { resolveEffectiveTemplateId, resolveStyleRecommendation } = resolveMod;

{
  // Effective template ID
  const entry = { id: 't_abc', render_template_id: 't_abc_render' };
  assert.equal(resolveEffectiveTemplateId(entry), 't_abc_render');

  const entryNoRender = { id: 't_xyz' };
  assert.equal(resolveEffectiveTemplateId(entryNoRender), 't_xyz');

  // Resolve style recommendation
  const index = {
    templates: [
      { id: 't_abc', render_template_id: 't_abc_render' },
      { id: 't_xyz' },
    ],
  };

  const resolved = resolveStyleRecommendation({ template_id: 't_abc' }, index);
  assert.ok(resolved);
  assert.equal(resolved.entry.id, 't_abc');
  assert.equal(resolved.effectiveId, 't_abc_render');

  // Missing template_id
  const noId = resolveStyleRecommendation({ template_id: null }, index);
  assert.equal(noId, null);

  // Not in library
  const notFound = resolveStyleRecommendation({ template_id: 't_missing' }, index);
  assert.equal(notFound, null);

  console.log('[test:resolve-template] PASS');
}

/* ── 3. V6 bridge type contract ──────────────────────────── */
/* Verified via typecheck + build:integration (Vite import.meta.glob). */

console.log('[test:v6-bridge] SKIPPED (requires Vite runtime; covered by typecheck + build)');

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-pr05-wizard-v6: all assertions passed');
