import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFrenchEdgePaths } from './french-edge.ts';
import type { SilhouetteInfo } from './material.ts';
import { buildRecipePattern } from './recipes.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const shapes = ['almond', 'oval', 'coffin'] as const;
const lengths = ['short', 'long'] as const;

function loadSilhouette(shape: string, length: string): SilhouetteInfo {
  const raw = readFileSync(
    join(root, `material-library/shapes/silhouettes/${shape}_${length}.svg`),
    'utf8',
  );
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
  const pathD = raw.match(/<path d="([^"]+)"/)?.[1];
  assert(viewBox && pathD, `${shape}/${length} silhouette exists`);
  return { viewBox: viewBox!, pathD: pathD! };
}

for (const shape of shapes) {
  for (const length of lengths) {
    const silhouette = loadSilhouette(shape, length);
    assert(buildRecipePattern('solid', silhouette).length === 0, `${shape}/${length} solid`);

    const gradient = buildRecipePattern('gradient', silhouette);
    assert(gradient[0]?.kind === 'gradient', `${shape}/${length} gradient`);
    assert(gradient[0]?.source === 'recipe', `${shape}/${length} gradient source`);

    const french = buildRecipePattern('french', silhouette);
    const edge = french[0];
    assert(edge?.kind === 'french_edge', `${shape}/${length} french`);
    if (edge?.kind === 'french_edge') {
      const paths = buildFrenchEdgePaths(silhouette, edge);
      assert(paths.fillD.length > 10, `${shape}/${length} french fill`);
      assert(
        paths.centerY < Math.min(paths.leftWingY, paths.rightWingY),
        `${shape}/${length} smile center points to tip`,
      );
    }
  }
}

console.log('recipes.selftest — E2 matrix passed');
