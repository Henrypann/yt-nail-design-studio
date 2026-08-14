import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SURFACE_BOOLEAN_ATTACHMENT_V1,
  SURFACE_BOOLEAN_KERNEL_V1,
  SURFACE_BOOLEAN_TARGET_V1,
  createSurfaceBooleanInputsFromBytesV1,
  evaluateSurfaceBooleanV1,
} from '../src/studio/geometry/v0-7-2/surface-boolean.ts';

const baseUrl = new URL('../public/geometry-v0-7-2/almond-medium-v3/shell.web.glb', import.meta.url);
const attachmentUrl = new URL('../assets/glb/components/petal-pearl-bloom/lavender-pearl/lavender-pearl.web.glb', import.meta.url);
const baseBytes = await readFile(baseUrl);
const attachmentBytes = await readFile(attachmentUrl);
const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const inputs = await createSurfaceBooleanInputsFromBytesV1(toArrayBuffer(baseBytes), toArrayBuffer(attachmentBytes));
assert.equal(inputs.contract, 'nail-surface-boolean-v1');
assert.equal(inputs.evidence.registryEntryId, 'geometry-registry.almond.medium.visual-v3');
assert.equal(inputs.evidence.attachmentAssetId, SURFACE_BOOLEAN_ATTACHMENT_V1.assetId);
assert.equal(inputs.evidence.fidelity, 'approximate');
assert.equal(inputs.evidence.manufacturingValidated, false);
assert.deepEqual(inputs.frame.uv, [SURFACE_BOOLEAN_TARGET_V1.u, SURFACE_BOOLEAN_TARGET_V1.v]);
assert.equal(inputs.frame.source, 'uv_barycentric_outer_surface');
assert.equal(inputs.placement.method, 'uv_barycentric_surface_frame');
assert.equal(inputs.placement.fixedZUsed, false);

const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const length = (value) => Math.sqrt(dot(value, value));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
for (const vector of [inputs.frame.positionMm, inputs.frame.normal, inputs.frame.tangentU, inputs.frame.tangentV]) {
  assert.ok(vector.every(Number.isFinite));
}
assert.ok(Math.abs(length(inputs.frame.normal) - 1) < 1e-5);
assert.ok(Math.abs(length(inputs.frame.tangentU) - 1) < 1e-5);
assert.ok(Math.abs(length(inputs.frame.tangentV) - 1) < 1e-5);
assert.ok(Math.abs(dot(inputs.frame.normal, inputs.frame.tangentU)) < 1e-5);
assert.ok(Math.abs(dot(inputs.frame.normal, inputs.frame.tangentV)) < 1e-5);
assert.ok(dot(cross(inputs.frame.tangentU, inputs.frame.tangentV), inputs.frame.normal) > 0.999);
const translation = inputs.placement.matrix.slice(12, 15);
for (let index = 0; index < 3; index += 1) {
  const expected = inputs.frame.positionMm[index]
    - inputs.frame.normal[index] * SURFACE_BOOLEAN_TARGET_V1.embedDepthMm;
  assert.ok(Math.abs(translation[index] - expected) < 1e-7);
}

const first = await evaluateSurfaceBooleanV1(inputs);
const repeat = await evaluateSurfaceBooleanV1(inputs);
assert.equal(first.manufacturingValidated, false);
for (const operation of ['union', 'subtract', 'intersect']) {
  const result = first.results[operation];
  assert.equal(result.kernelId, SURFACE_BOOLEAN_KERNEL_V1);
  assert.equal(result.topology.componentCount, 1);
  assert.equal(result.topology.boundaryEdgeCount, 0);
  assert.equal(result.topology.nonManifoldEdgeCount, 0);
  assert.equal(result.topology.degenerateTriangleCount, 0);
  assert.ok(Math.abs(result.topology.signedVolumeMm3) > 1e-6);
  assert.equal(first.deterministic[operation], true);
  assert.equal(result.topology.geometryHash, repeat.results[operation].topology.geometryHash);
  assert.equal(result.topology.triangleCount, repeat.results[operation].topology.triangleCount);
  assert.notEqual(result.topology.geometryHash, first.inputTopology.base.geometryHash);
}

const volume = (topology) => Math.abs(topology.signedVolumeMm3);
const overlap = volume(first.results.intersect.topology);
assert.ok(overlap > 0.01, 'surface-frame placement must create real overlap');
assert.ok(Math.abs(volume(first.results.union.topology)
  - (volume(first.inputTopology.base) + volume(first.inputTopology.operand) - overlap)) < 0.05);
assert.ok(Math.abs(volume(first.results.subtract.topology)
  - (volume(first.inputTopology.base) - overlap)) < 0.05);

const corruptBase = new Uint8Array(baseBytes);
corruptBase[24] ^= 0xff;
await assert.rejects(
  createSurfaceBooleanInputsFromBytesV1(toArrayBuffer(corruptBase), toArrayBuffer(attachmentBytes)),
  /promoted_geometry_integrity_failed/,
);
const corruptAttachment = new Uint8Array(attachmentBytes);
corruptAttachment[24] ^= 0xff;
await assert.rejects(
  createSurfaceBooleanInputsFromBytesV1(toArrayBuffer(baseBytes), toArrayBuffer(corruptAttachment)),
  /surface_boolean_attachment_integrity_failed/,
);

const source = await readFile(new URL('../src/studio/geometry/v0-7-2/surface-boolean.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /(?:translate|setPosition)\([^\n]*(?:1\.52|0\.55|1\.57|1\.3)|3\.2\s*\+/,
  'promoted operations must not reuse the retired flat-slab Z constants');
assert.match(source, /surfaceFrameMatrixV1/);
assert.doesNotMatch(source, /localStorage|EditorDoc|useEditorStore|createJSONStorage/);

console.log('test-geo-v0-7-2-surface-boolean: PASS', {
  framePositionMm: inputs.frame.positionMm.map((value) => Number(value.toFixed(4))),
  frameNormal: inputs.frame.normal.map((value) => Number(value.toFixed(4))),
  baseTriangles: first.inputTopology.base.triangleCount,
  operandTriangles: first.inputTopology.operand.triangleCount,
  results: Object.fromEntries(Object.entries(first.results).map(([operation, result]) => [operation, {
    triangles: result.topology.triangleCount,
    volumeMm3: Math.abs(result.topology.signedVolumeMm3),
    hash: result.topology.geometryHash,
  }])),
});
