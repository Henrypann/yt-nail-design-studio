/** PR-05A behavior tests: recommendation partition, assets and mutation order. */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';

const {
  createRecommendationRequestGate,
  partitionStyles,
} = await import('../src/studio/wizard/partition-styles.ts');
const {
  applyValidatedStyleRecommendation,
  filterResolvableStyleRecommendations,
} = await import('../src/studio/preview/resolve-template.ts');

const style = (id, priority, cover_status = 'REAL', template_id = `t_${id}`) => ({
  id,
  name: id,
  name_en: id,
  priority,
  cover_status,
  template_id,
  best_lengths: ['medium'],
  best_length_label: 'Medium',
  reason: id,
  cover_url: `/${id}.png`,
});
const template = (id) => ({
  id,
  name: id,
  name_en: id,
  style_tags: [],
  default_base_color: '#ffffff',
  default_finish: 'gloss',
  shape_compatibility: { highly_compatible: [], neutral: [], not_recommended: {} },
  thumbnail_url: '/x.png',
  manifest_url: '/x.json',
  sort_order: 0,
});

for (const count of [0, 1, 2, 4]) {
  const result = partitionStyles(Array.from({ length: count }, (_, index) => style(`c${index}`, index)));
  assert.equal(result.primary.length, Math.min(count, 2));
  assert.equal(result.concept.length, 0);
}
const mixed = partitionStyles([
  style('z', 1), style('a', 1), style('later', 9),
  style('concept-z', 1, 'CONCEPT'), style('concept-a', 1, 'CONCEPT'),
]);
assert.deepEqual(mixed.primary.map((item) => item.id), ['a', 'z']);
assert.deepEqual(mixed.concept.map((item) => item.id), ['concept-a']);

const gate = createRecommendationRequestGate();
const first = gate.begin();
const second = gate.begin();
assert.equal(gate.isCurrent(first), false);
assert.equal(gate.isCurrent(second), true);
gate.invalidate(second);
assert.equal(gate.isCurrent(second), false);

const index = { templates: [template('t_curated')] };
const valid = filterResolvableStyleRecommendations([
  style('curated', 1, 'REAL', 't_curated'),
  style('missing-concept', 2, 'CONCEPT', 't_missing'),
], index);
assert.deepEqual(valid.map((item) => item.id), ['curated']);
assert.deepEqual(partitionStyles(valid).primary.map((item) => item.id), ['curated']);

async function runApplication(candidate, overrides = {}) {
  const calls = [];
  const result = await applyValidatedStyleRecommendation(candidate, {
    loadIndex: async () => index,
    applyAndEnter: async () => { calls.push('enter'); return true; },
    setStyle: () => calls.push('style'),
    applyTemplate: () => calls.push('template'),
    ...overrides,
  });
  return { calls, result };
}

const missing = await runApplication(style('missing', 1, 'REAL', 't_missing'));
assert.equal(missing.result.status, 'missing_template');
assert.deepEqual(missing.calls, []);

const loadFailed = await runApplication(style('curated', 1, 'REAL', 't_curated'), {
  loadIndex: async () => { throw new Error('offline'); },
});
assert.equal(loadFailed.result.status, 'load_failed');
assert.deepEqual(loadFailed.calls, []);

const enterFailed = await runApplication(style('curated', 1, 'REAL', 't_curated'), {
  applyAndEnter: async () => false,
});
assert.equal(enterFailed.result.status, 'enter_failed');
assert.deepEqual(enterFailed.calls, []);

const success = await runApplication(style('curated', 1, 'REAL', 't_curated'));
assert.equal(success.result.status, 'ok');
assert.deepEqual(success.calls, ['enter', 'style', 'template']);

const modalSource = fs.readFileSync(new URL('../src/studio/wizard/StyleRecommendModal.tsx', import.meta.url), 'utf8');
const stepSource = fs.readFileSync(new URL('../src/studio/wizard/StepOne.tsx', import.meta.url), 'utf8');
assert.match(modalSource, /partitionStyles\(valid\)/);
assert.match(modalSource, /filterResolvableStyleRecommendations/);
assert.match(modalSource, /overflow-y-auto/);
assert.match(modalSource, /onError=/);
assert.match(stepSource, /applyValidatedStyleRecommendation/);

console.log('test-pr05-recommendations: partition, asset validation and mutation order PASS');
