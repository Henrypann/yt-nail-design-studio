import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const index = read('material-library/recipes/index.json');
const definition = read('material-library/recipes/mercury-dew/recipe.json');
const errors = [];
const semver = /^\d+\.\d+\.\d+$/;
if (!Array.isArray(index.recipes) || index.recipes.length === 0) errors.push('recipes index is empty');
if (!semver.test(definition.version)) errors.push('definition version must be semver');
if (definition.identity?.id !== 'mercury-dew') errors.push('mercury definition id mismatch');
if (JSON.stringify(definition.compatibility?.lengthPresets) !== JSON.stringify(['natural', 'short-extension', 'medium', 'long'])) errors.push('compatibility.lengthPresets 枚举不完整');
if (JSON.stringify(definition.compatibility?.geometryLengths) !== JSON.stringify(['short', 'medium', 'long', 'extra-long'])) errors.push('compatibility.geometryLengths 枚举不完整');
if (definition.outputPolicy?.manufacturing_command_allowed !== false) errors.push('manufacturing commands must remain disabled');
if (definition.constraints?.safe_clearance_mm < 0.8) errors.push('safe clearance must be >= 0.8mm');
if (definition.constraints?.max_droplets > 6) errors.push('droplet count exceeds 6');
for (const component of definition.components ?? []) {
  if (!['magnetic_beam', 'chrome_ribbon', 'clear_droplet'].includes(component.id)) errors.push(`unknown component ${component.id}`);
  if (!['L1', 'L2', 'L3'].includes(component.route)) errors.push(`invalid route ${component.route}`);
}
for (const preset of definition.presets ?? []) if (!['subtle', 'signature', 'statement'].includes(preset.id)) errors.push(`invalid preset ${preset.id}`);
for (const schema of ['recipe-definition.schema.json', 'recipe-instance.schema.json', 'uv.schema.json']) {
  if (!fs.existsSync(path.join(root, 'material-library/recipes/schema', schema))) errors.push(`missing schema ${schema}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('validate-recipes: PASS (1 definition, 3 schemas, manufacturing commands disabled)');
