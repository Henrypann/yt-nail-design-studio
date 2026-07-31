import { strict as assert } from 'node:assert';
import { createMercuryInstance } from './recipe-model.ts';
import { recipeDefinitionChecksum } from './recipe-checksum.ts';

const recipe = createMercuryInstance('signature');
assert.equal(recipe.recipeRef.id, 'mercury-dew');
assert.equal(recipe.params.droplets.length, 4);
assert.equal(recipeDefinitionChecksum('mercury-dew'), recipeDefinitionChecksum('mercury-dew'));
assert.match(recipeDefinitionChecksum('mercury-dew'), /^fnv1a:/);
console.log('recipe-output.selftest: deterministic snapshot checksum passed');
