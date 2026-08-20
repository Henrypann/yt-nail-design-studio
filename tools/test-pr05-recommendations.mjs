import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
const step = await readFile(new URL('../src/studio/wizard/StepOne.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(step, /StyleRecommendModal|applyValidatedStyleRecommendation/);
assert.doesNotMatch(await readFile(new URL('../src/studio/wizard/StepTwo.tsx', import.meta.url), 'utf8'), /style-recommend|markConfirmed/);
console.log('test-pr05-recommendations: deprecated recommendation path is absent from active Quick Start PASS');
