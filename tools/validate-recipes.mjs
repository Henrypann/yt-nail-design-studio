import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const index = read('material-library/recipes/index.json');
const errors = [];
const semver = /^\d+\.\d+\.\d+$/;
if (!Array.isArray(index.recipes) || index.recipes.length === 0) errors.push('recipes index is empty');
for (const entry of index.recipes ?? []) {
  const definition = read(path.join('material-library/recipes', entry.definition));
  if (!semver.test(definition.version)) errors.push(`${entry.id}: definition version must be semver`);
  if (definition.identity?.id !== entry.id) errors.push(`${entry.id}: definition id mismatch`);
  if (definition.outputPolicy?.manufacturing_command_allowed !== false) errors.push(`${entry.id}: manufacturing commands must remain disabled`);
  if (definition.constraints?.safe_clearance_mm < 0.8) errors.push(`${entry.id}: safe clearance must be >= 0.8mm`);
  if (definition.constraints?.max_droplets > 6) errors.push(`${entry.id}: droplet count exceeds 6`);
  for (const component of definition.components ?? []) {
    if (!['magnetic_beam', 'chrome_ribbon', 'clear_droplet', 'milky_base', 'micro_french', 'relief_flower'].includes(component.id)) errors.push(`${entry.id}: unknown component ${component.id}`);
    if (!['L1', 'L2', 'L3'].includes(component.route)) errors.push(`${entry.id}: invalid route ${component.route}`);
  }
  for (const preset of definition.presets ?? []) if (!['subtle', 'signature', 'statement'].includes(preset.id)) errors.push(`${entry.id}: invalid preset ${preset.id}`);
}
const mercury = read('material-library/recipes/mercury-dew/recipe.json');
if (JSON.stringify(mercury.compatibility?.lengthPresets) !== JSON.stringify(['natural', 'short-extension', 'medium', 'long'])) errors.push('mercury compatibility.lengthPresets 枚举不完整');
if (JSON.stringify(mercury.compatibility?.geometryLengths) !== JSON.stringify(['short', 'medium', 'long', 'extra-long'])) errors.push('mercury compatibility.geometryLengths 枚举不完整');
for (const schema of ['recipe-definition.schema.json', 'recipe-instance.schema.json', 'uv.schema.json']) {
  if (!fs.existsSync(path.join(root, 'material-library/recipes/schema', schema))) errors.push(`missing schema ${schema}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`validate-recipes: PASS (${index.recipes.length} definitions, 3 schemas, manufacturing commands disabled)`);
