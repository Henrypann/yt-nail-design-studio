import { strict as assert } from 'node:assert';
import { createMapperFromSilhouette } from './surface-mapper-core.ts';

for (const shape of ['almond', 'oval', 'coffin'] as const) {
  for (const length of ['short', 'medium', 'long', 'extra-long'] as const) {
    const mapper = createMapperFromSilhouette(`M 0 0 C -40 20 -44 80 -30 140 L 30 140 C 44 80 40 20 0 0 Z`);
    assert(mapper, `${shape}/${length} mapper exists`);
    const result = mapper!.safePoint({ u: 0.02, v: 0.42 }, 0.8, 1.2);
    assert(Number.isFinite(result.point.x) && Number.isFinite(result.point.y));
    const path = mapper!.path([{ u: 0.2, v: 0.7 }, { u: 0.5, v: 0.45 }, { u: 0.8, v: 0.2 }], 0.8);
    assert.equal(path.points.length, 3);
  }
}
console.log('surface-mapper.selftest: all passed');
