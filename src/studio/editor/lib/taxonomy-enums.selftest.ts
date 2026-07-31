import { strict as assert } from 'node:assert';
import taxonomy from '../../../../material-library/taxonomy/nail-design-taxonomy.json' with { type: 'json' };
import {
  COLOR_PRESET_IDS,
  DECORATION_IDS,
  DESIGN_LENGTH_PRESET_IDS,
  LOOK_PRESET_IDS,
  OCCASION_IDS,
  STYLE_DIRECTION_IDS,
  SURFACE_PRESET_IDS,
} from './taxonomy-model.ts';

const ids = <T extends { id: string }>(items: T[]) => items.map((item) => item.id);
assert.deepEqual(taxonomy.style_directions.map((item) => item.id), STYLE_DIRECTION_IDS);
assert.deepEqual(ids(taxonomy.look_presets), LOOK_PRESET_IDS);
assert.deepEqual(ids(taxonomy.length_presets), DESIGN_LENGTH_PRESET_IDS);
assert.deepEqual(ids(taxonomy.color_presets), COLOR_PRESET_IDS);
assert.deepEqual(ids(taxonomy.surface_presets), SURFACE_PRESET_IDS);
assert.deepEqual(ids(taxonomy.decorations), DECORATION_IDS);
assert.deepEqual(ids(taxonomy.occasions), OCCASION_IDS);
assert.equal(new Set(LOOK_PRESET_IDS).size, 12);
assert.equal(new Set(COLOR_PRESET_IDS).size, 5);
assert.equal(new Set(SURFACE_PRESET_IDS).size, 5);
for (const preset of taxonomy.look_presets) assert(STYLE_DIRECTION_IDS.includes(preset.direction as never));
for (const occasion of taxonomy.occasions) for (const look of occasion.recommended_looks) assert(LOOK_PRESET_IDS.includes(look as never));
console.log('taxonomy-enums.selftest: 7 enum groups aligned');
