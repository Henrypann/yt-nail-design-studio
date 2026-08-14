import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  createSingleNailPreviewSurfaceV1,
  hashPreviewSurfaceMeshV1,
} from '../src/studio/rendering/v0-7-2/index.ts';

const first = createSingleNailPreviewSurfaceV1();
const second = createSingleNailPreviewSurfaceV1();
assert.deepEqual(first, second);
assert.equal(await hashPreviewSurfaceMeshV1(first), await hashPreviewSurfaceMeshV1(second));
assert.ok(first.metrics.transverseCrownRiseMm >= 1.5, 'visual surface must visibly express a C-curve');
assert.ok(first.metrics.longitudinalArchRiseMm >= 0.8, 'visual surface must visibly express longitudinal arch');
assert.equal(first.metrics.visualThicknessMm, 0.55, 'preview thickness must remain an explicit visual assumption');
assert.equal(first.metrics.tipRadiusMm, 1.15, 'preview planform must use the accepted medium Almond tip radius');
assert.ok(first.metrics.tipCapDepthMm > 0.54 && first.metrics.tipCapDepthMm < 0.56,
  'accepted cubic tip region must close the almond without a needle apex');
assert.equal(first.metrics.tipCrownRiseMm, 0.72, 'terminal C-curve must relax into the rounded cap');
assert.equal(first.metrics.tipCapExponent, 2, 'free edge must use an elliptical rounded-cap profile');
assert.equal(first.metrics.tipCapBlendStartRatio, 0.85, 'tip boundary must continue the accepted cubic sidewall');
assert.ok(first.positions.every(Number.isFinite));
assert.equal(first.uvs.length, (first.positions.length / 3) * 2);
assert.ok(first.uvs.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
assert.ok(first.indices.every(Number.isSafeInteger));
assert.equal(first.indices.length % 3, 0);

const edgeIncidence = new Map();
let degenerateTriangles = 0;
for (let offset = 0; offset < first.indices.length; offset += 3) {
  const triangle = first.indices.slice(offset, offset + 3);
  const points = triangle.map((index) => first.positions.slice(index * 3, index * 3 + 3));
  const ab = points[1].map((value, axis) => value - points[0][axis]);
  const ac = points[2].map((value, axis) => value - points[0][axis]);
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  if (Math.hypot(...cross) <= 1e-8) degenerateTriangles += 1;
  for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edgeIncidence.set(key, (edgeIncidence.get(key) ?? 0) + 1);
  }
}
assert.equal(degenerateTriangles, 0, 'visual shell must not contain degenerate triangles');
assert.equal([...edgeIncidence.values()].filter((count) => count !== 2).length, 0,
  'visual shell must be closed and two-manifold for legible side/underside preview');

const shell = await readFile(new URL('../src/studio/editor/components/CustomerPreviewShellV7.tsx', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../src/studio/rendering/v0-7-2/SingleNailPbrPreviewV072.tsx', import.meta.url), 'utf8');
assert.match(shell, /lazy\(\(\) => import\('@\/studio\/rendering\/v0-7-2\/SingleNailPbrPreviewV072'\)\)/);
assert.match(shell, /presentation === 'composite'/);
assert.match(shell, /mode === 'single' && presentation === 'composite'/);
assert.match(shell, /v7-svg-composite/);
assert.match(shell, /data-testid="customer-single-finger-switcher"/);
assert.match(shell, /FINGER_CODES\.map\(\(finger\)/);
assert.match(shell, /aria-label={`切换到\$\{fingerDisplayNameV7\(finger\)\} \$\{finger\}`}/);
assert.match(runtime, /ACESFilmicToneMapping/);
assert.match(runtime, /MeshPhysicalMaterial/);
assert.match(runtime, /CanvasTexture/);
assert.match(runtime, /SRGBColorSpace/);
assert.match(runtime, /loadPromotedGeometryV2/);
assert.match(runtime, /resolvePromotedGeometryV2/);
assert.match(runtime, /data-geometry-registry-entry/);
assert.match(runtime, /fitCameraToPromotedNailV072/);
assert.match(runtime, /data-testid="single-nail-pbr-canvas-host"/);
assert.match(runtime, /cameraFramingSafe/);
assert.match(runtime, /new THREE\.Box3\(\)\.setFromObject\(renderRoot\)/,
  'camera framing must include the nail and every visible decoration');
assert.match(runtime, /data-render-bounds="nail-and-visible-decorations"/);
assert.match(runtime, /single-nail-decoration-fallback/);
assert.match(runtime, /cacheKey = `\$\{url\}#\$\{expectedSha256\}`/,
  'GLB cache identity must include the immutable EditorDoc SHA');
assert.match(runtime, /Math\.min\(verticalFov, horizontalFov\)/);
assert.doesNotMatch(runtime, /createSingleNailPreviewSurfaceV1|3\.2 \+ decoration\.heightMm/,
  'promoted runtime must not reuse the procedural slab or fixed-Z decoration placement');
assert.match(runtime, /single-nail-pbr-fallback/);
assert.match(runtime, /renderer\?\.dispose\(\)/);
assert.doesNotMatch(runtime, /localStorage|sessionStorage|editorV7Store|setEditor|saveEditor|repository/);
assert.doesNotMatch(runtime, /setAnimationLoop|requestAnimationFrame/);

let distFiles = [];
try { distFiles = await readdir(new URL('../dist/assets/', import.meta.url)); } catch {}
assert.ok(distFiles.some((file) => /SingleNailPbrPreviewV072/.test(file)), 'single-nail PBR must be a lazy production chunk');
const singleNailChunk = distFiles.find((file) => /SingleNailPbrPreviewV072/.test(file));
const singleNailChunkSource = await readFile(new URL(`../dist/assets/${singleNailChunk}`, import.meta.url), 'utf8');
assert.doesNotMatch(singleNailChunkSource, /manifold|parity-worker|three-bvh-csg/i,
  'single-nail PBR lazy chunk must not import experimental boolean kernels');

console.log('test-render-v0-7-2-single-nail-entry: PASS (curved preview surface, lazy four-state boundary, PBR, fallback, writer-zero)');
