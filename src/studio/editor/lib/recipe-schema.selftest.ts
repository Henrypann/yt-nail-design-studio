import { strict as assert } from 'node:assert';
import { MERCURY_DEW_DEFINITION, RECIPE_REGISTRY, assertRecipeReference } from './recipe-registry.ts';
import { createMercuryInstance } from './recipe-model.ts';

assert.equal(MERCURY_DEW_DEFINITION.identity.id, 'mercury-dew');
assert.equal(MERCURY_DEW_DEFINITION.version, '1.0.0');
assert.deepEqual(MERCURY_DEW_DEFINITION.compatibility.lengthPresets, ['natural', 'short-extension', 'medium', 'long']);
assert.deepEqual(MERCURY_DEW_DEFINITION.compatibility.geometryLengths, ['short', 'medium', 'long', 'extra-long']);
assert.equal(RECIPE_REGISTRY.recipes[0]?.manufacturing_command_allowed, false);
const instance = createMercuryInstance('signature');
assertRecipeReference(instance);
assert.equal(instance.params.droplets.length, 4);
assert(instance.params.ribbonAnchors.every((p) => p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1));
console.log('recipe-schema.selftest: all passed');
