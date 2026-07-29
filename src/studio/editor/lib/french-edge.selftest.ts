/**
 * french-edge 几何冒烟测试
 * node --experimental-strip-types src/studio/editor/lib/french-edge.selftest.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFrenchEdgePaths,
  defaultClassicControls,
  defaultFrenchParams,
  outlineIntersectionsAtY,
  silhouetteMetrics,
  updateClassicControlsForHandle,
} from './french-edge.ts';
import type { SilhouetteInfo } from './material.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../../../..');

function loadSilhouette(name: string): SilhouetteInfo | null {
  const raw = readFileSync(
    join(root, `material-library/shapes/silhouettes/${name}.svg`),
    'utf8',
  );
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
  const pathD = raw.match(/<path d="([^"]+)"/)?.[1];
  if (!viewBox || !pathD) return null;
  return { viewBox, pathD };
}

const sil = loadSilhouette('almond_medium');
assert(sil !== null, 'almond medium silhouette');

if (sil) {
  const m = silhouetteMetrics(sil);
  assert(m.nailLength > 100, 'nail length reasonable');
  assert(m.maxHalfWidth > 40, 'half width reasonable');

  const defaults = defaultFrenchParams(sil);
  assert(defaults.tipOffset >= 20 && defaults.tipOffset <= 80, 'default tipOffset range');
  assert(defaults.smileDepth > 0, 'default smileDepth positive');

  const arc = buildFrenchEdgePaths(sil, {
    variant: 'arc',
    tipOffset: defaults.tipOffset,
    smileDepth: defaults.smileDepth,
    classicControls: defaultClassicControls(sil),
  });
  assert(arc.fillD.length > 10, 'arc fill path');
  assert(arc.strokePaths.length === 1, 'arc one stroke');
  assert(arc.fillD.includes('C'), 'arc uses smooth cubic smile');
  assert(
    arc.centerY < Math.min(arc.leftWingY, arc.rightWingY),
    'classic center points toward nail tip',
  );

  const smileY = m.tipY + defaults.tipOffset;
  assert(arc.strokePaths[0].includes(smileY.toFixed(1)), 'smile at tipOffset');
  const leftIntersections = outlineIntersectionsAtY(m, arc.leftWingY);
  const rightIntersections = outlineIntersectionsAtY(m, arc.rightWingY);
  assert(
    Math.abs(arc.wingLeftX - leftIntersections.left) < 0.01 &&
      Math.abs(arc.wingRightX - rightIntersections.right) < 0.01,
    'smile wings land on actual silhouette',
  );
  assert(arc.wingLeftX < 0 && arc.wingRightX > 0, 'smile spans nail width');

  const vPaths = buildFrenchEdgePaths(sil, {
    variant: 'v',
    tipOffset: defaults.tipOffset,
    smileDepth: defaults.smileDepth,
  });
  assert(vPaths.strokePaths[0].includes('L'), 'v stroke uses lines');

  const dPaths = buildFrenchEdgePaths(sil, {
    variant: 'double',
    tipOffset: defaults.tipOffset,
    smileDepth: defaults.smileDepth,
    lineGap: 8,
  });
  assert(dPaths.strokePaths.length === 2, 'double two strokes');
}

const draggedCenter = updateClassicControlsForHandle(
  { leftWingOffset: 60, centerOffset: 32, rightWingOffset: 66 },
  'center',
  80,
  180,
);
assert(draggedCenter.centerOffset === 58, 'center drag stops before nearest wing');

const draggedLeft = updateClassicControlsForHandle(
  draggedCenter,
  'left',
  20,
  180,
);
assert(draggedLeft.leftWingOffset === 60, 'wing drag cannot cross center');

const draggedRight = updateClassicControlsForHandle(
  draggedLeft,
  'right',
  92,
  180,
);
assert(draggedRight.rightWingOffset === 92, 'right wing drags independently');

const shapes = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const lengths = ['short', 'medium', 'long', 'extra_long'];
for (const shape of shapes) {
  for (const length of lengths) {
    const s = loadSilhouette(`${shape}_${length}`);
    assert(s !== null, `${shape} ${length} silhouette`);
    if (s) {
      const defaults = defaultFrenchParams(s);
      const p = buildFrenchEdgePaths(s, {
        variant: 'arc',
        tipOffset: defaults.tipOffset,
        smileDepth: defaults.smileDepth,
        classicControls: defaultClassicControls(s),
      });
      const m = silhouetteMetrics(s);
      const leftIntersections = outlineIntersectionsAtY(m, p.leftWingY);
      const rightIntersections = outlineIntersectionsAtY(m, p.rightWingY);
      assert(p.fillD && p.strokePaths.length > 0, `${shape} ${length} arc paths`);
      assert(
        Math.abs(p.wingLeftX - leftIntersections.left) < 0.01 &&
          Math.abs(p.wingRightX - rightIntersections.right) < 0.01,
        `${shape} ${length} wings fit silhouette`,
      );
      assert(
        p.centerY < Math.min(p.leftWingY, p.rightWingY),
        `${shape} ${length} classic center points to tip`,
      );
    }
  }
}

if (sil) {
  const defaults = defaultFrenchParams(sil);
  const asymmetric = buildFrenchEdgePaths(sil, {
    variant: 'arc',
    tipOffset: defaults.tipOffset,
    smileDepth: defaults.smileDepth,
    classicControls: {
      leftWingOffset: 72,
      centerOffset: 30,
      rightWingOffset: 58,
    },
  });
  assert(asymmetric.leftWingY > asymmetric.rightWingY, 'left wing draggable independently');
  assert(
    asymmetric.centerY < asymmetric.rightWingY,
    'dragged center remains toward tip',
  );
}

console.log('french-edge.selftest — all passed');
