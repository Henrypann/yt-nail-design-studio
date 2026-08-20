import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
const step = await readFile(new URL('../src/studio/wizard/StepOne.tsx', import.meta.url), 'utf8');
assert.match(step, /快速建稿/);
assert.doesNotMatch(step, /StyleRecommendModal|applyValidatedStyleRecommendation/);
console.log('test:pr05-wizard-v6 compatibility surface PASS');
