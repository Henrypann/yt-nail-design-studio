import fs from 'node:fs';
import path from 'node:path';
const file = path.join(process.cwd(), 'assets/golden-fixtures/mercury-dew/index.json');
const index = JSON.parse(fs.readFileSync(file, 'utf8'));
const expected = new Set(['almond-natural', 'almond-medium', 'oval-natural', 'oval-medium', 'coffin-natural', 'coffin-medium']);
if (index.fixtureType !== 'visual-signoff-pending') throw new Error('Fixtures must remain explicitly pending until manual signoff');
if (index.fixtures.length !== 6 || new Set(index.fixtures.map((f) => f.id)).size !== 6) throw new Error('必须覆盖 Almond/Oval/Coffin × natural/medium');
for (const fixture of index.fixtures) {
  if (!expected.has(fixture.id) || fixture.status !== 'pending_visual_signoff') throw new Error(`fixture 状态错误: ${fixture.id}`);
  if (fixture.recipeRef.id !== 'mercury-dew' || fixture.recipeRef.version !== '1.0.0') throw new Error(`recipeRef 错误: ${fixture.id}`);
}
console.log('validate-mercury-fixtures: PASS (6 pending canonical-renderer signoff fixtures)');
