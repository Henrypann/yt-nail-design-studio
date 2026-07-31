/**
 * 确认 SVG 合成/export 路径包含 BrushElement（b1 验收）
 * node --experimental-strip-types src/studio/editor/lib/render-brush.selftest.ts
 */

import { nailContentSvg, composeTiledSvg } from './render';
import { getSilhouette } from './material';
import type { EditorDoc, FingerData } from './model';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const sil = getSilhouette('almond', 'medium');
assert(sil !== null, 'silhouette loaded');

const fingerData: FingerData = {
  baseColor: '#FBF5F0',
  pattern: [
    {
      id: 'b1',
      kind: 'brush',
      name: '手绘笔画',
      visible: true,
      locked: false,
      order: 0,
      points: [
        { x: 0, y: -50 },
        { x: 10, y: -80 },
        { x: -5, y: -100 },
      ],
      color: '#C2497A',
      size: 6,
      opacity: 1,
    },
  ],
  attachments: [],
};

const svg = nailContentSvg(
  { shape: 'almond', length: 'medium', data: fingerData, uid: 'test' },
  sil!,
);
assert(svg.includes('<polyline'), 'nailContentSvg renders brush polyline');
assert(svg.includes('#C2497A'), 'brush color preserved');

const doc: EditorDoc = {
  schemaVersion: 3,
  designId: 'test-design',
  shape: 'almond',
  length: 'medium',
  lengthPreset: 'short-extension',
  appearance: { baseCoverage: 'opaque', opticalEffect: 'none', topFinish: 'gloss' },
  baseColor: '#FBF5F0',
  pattern: fingerData.pattern,
  attachments: [],
  relief: [],
  fingerLocks: {},
  masterFinger: 'R4',
  updatedAt: new Date().toISOString(),
};

const tiled = composeTiledSvg(doc, { view: 'back', markBadges: true });
assert(tiled !== null, 'composeTiledSvg ok');
assert(tiled!.includes('<polyline'), 'tiled export includes brush strokes');

console.log('render-brush.selftest: all passed');
