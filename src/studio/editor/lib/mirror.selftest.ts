/**
 * mirror.ts 冒烟断言（node --experimental-strip-types src/studio/editor/lib/mirror.selftest.ts）
 */

import type { FingerCode } from '@/lib/types';
import type { FingerData } from './model.ts';
import {
  LEFT_FINGERS,
  mirrorFingerData,
  mirrorPoints,
  mirrorTransform,
  oppositeFinger,
} from './mirror.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// oppositeFinger
assert(oppositeFinger('L4') === 'R4', 'L4 → R4');
assert(oppositeFinger('R2') === 'L2', 'R2 → L2');
assert(oppositeFinger('L1') === 'R1', 'L1 → R1');

// mirrorPoints
const pts = mirrorPoints([
  { x: 10, y: -50 },
  { x: -5, y: -80 },
]);
assert(pts[0].x === -10 && pts[0].y === -50, 'point x mirrored');
assert(pts[1].x === 5 && pts[1].y === -80, 'point x mirrored 2');

// mirrorTransform non-thumb
const t = mirrorTransform({ x: 12, y: -90, scale: 1.2, rotation: 30 }, 'L4');
assert(t.x === -12 && t.y === -90 && t.rotation === -30, 'transform mirrored L4');

// mirrorTransform thumb +180
const tThumb = mirrorTransform({ x: 0, y: 0, scale: 1, rotation: 0 }, 'L1');
assert(tThumb.rotation === 180, 'thumb rotation +180');

// mirrorFingerData brush
const source: FingerData = {
  baseColor: '#FF0000',
  pattern: [
    {
      id: 'b1',
      kind: 'brush',
      points: [{ x: 5, y: -100 }],
      color: '#000',
      size: 6,
      opacity: 1,
    },
  ],
  attachments: [],
};

const mirrored = mirrorFingerData(source, 'R4' as FingerCode, 'include-base', '#FFF');
assert(mirrored.baseColor === '#FF0000', 'include-base copies color');
assert(mirrored.pattern[0].kind === 'brush', 'brush preserved');
if (mirrored.pattern[0].kind === 'brush') {
  assert(mirrored.pattern[0].points[0].x === -5, 'brush points mirrored');
}

const patternOnly = mirrorFingerData(source, 'R4' as FingerCode, 'pattern-only', '#CCCCCC');
assert(patternOnly.baseColor === '#CCCCCC', 'pattern-only keeps fallback base');

// left hand list
assert(LEFT_FINGERS.length === 5, '5 left fingers');

console.log('mirror.selftest: all passed');
