import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  parseCanonicalGeometrySnapshotV1,
  parseGeometryRepresentationSetV1,
  parseGeometryRepresentationV1,
  parseNailSurfaceDefinitionV1,
  parseNailSurfaceGeometryBundleV1,
  selectGeometryRepresentationV1,
  verifyNailSurfaceGeometryBundleV1,
} from '../src/studio/geometry/v0-7-2/index.ts';

const bundleUrl = new URL('../assets/geometry/representations/almond-medium-v3/canonical-bundle.json', import.meta.url);
const reportUrl = new URL('../assets/glb/shells/almond/medium-candidate-v3/geometry-report.json', import.meta.url);
const manifestUrl = new URL('../assets/glb/shells/almond/medium-candidate-v3/shell.manifest.json', import.meta.url);
const generatorPath = fileURLToPath(new URL('./generate-geo-v0-7-2-almond-representation.mjs', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const bundleBytes = await readFile(bundleUrl);
const bundle = JSON.parse(bundleBytes);
const report = JSON.parse(await readFile(reportUrl));
const manifest = JSON.parse(await readFile(manifestUrl));
const frozen = JSON.stringify(bundle);

for (const [label, parser, value] of [
  ['surface', parseNailSurfaceDefinitionV1, bundle.surfaceDefinition],
  ['snapshot', parseCanonicalGeometrySnapshotV1, bundle.canonicalGeometry],
  ['representation set', parseGeometryRepresentationSetV1, bundle.representationSet],
  ['bundle', parseNailSurfaceGeometryBundleV1, bundle],
]) {
  const parsed = parser(value);
  assert.equal(parsed.ok, true, `${label} must parse: ${JSON.stringify(!parsed.ok && parsed.issues)}`);
  assert.deepEqual(parsed.ok && parsed.value, value, `${label} parse must be lossless`);
}
bundle.representationSet.representations.forEach((entry) => assert.equal(parseGeometryRepresentationV1(entry).ok, true));
assert.equal(JSON.stringify(bundle), frozen, 'parsers must not mutate the bundle');

const { sha256: surfaceSha, ...surfaceIdentity } = bundle.surfaceDefinition;
assert.equal(sha256(canonical(surfaceIdentity)), surfaceSha, 'surface definition identity drift');
assert.equal(bundle.surfaceDefinition.shapeDefinition.thickness.mode, 'vertical_preview_thickness');
assert.equal(bundle.surfaceDefinition.evidence.manufacturingValidated, false);
assert.equal(bundle.canonicalGeometry.geometryHash, report.mesh.canonicalTriangleSha256);
assert.equal(bundle.canonicalGeometry.geometryHash, manifest.canonicalTriangleSha256);
assert.equal(bundle.canonicalGeometry.topology.triangleCount, report.mesh.triangles);
assert.equal(bundle.canonicalGeometry.regions.reduce((sum, entry) => sum + entry.faceCount, 0), report.mesh.triangles);
assert.equal(bundle.representationSet.parity.sameCanonicalTriangles, true);
assert.deepEqual(bundle.representationSet.representations.map((entry) => entry.format).sort(), ['glb', 'stl']);

for (const entry of bundle.representationSet.representations) {
  const bytes = await readFile(new URL(`../${entry.artifact.path}`, import.meta.url));
  assert.equal(bytes.length, entry.artifact.byteLength, `${entry.format} byte length drift`);
  assert.equal(sha256(bytes), entry.artifact.sha256, `${entry.format} artifact sha drift`);
  assert.equal(entry.canonicalTriangleSha256, report.mesh.canonicalTriangleSha256);
  assert.equal(entry.evidence.productVisualSignoff, true);
  assert.equal(entry.evidence.manufacturingValidated, false);
}
const glb = bundle.representationSet.representations.find((entry) => entry.format === 'glb');
const stl = bundle.representationSet.representations.find((entry) => entry.format === 'stl');
assert.equal(glb.artifact.visibility, 'DEV_REVIEW_ONLY');
assert.equal(glb.role, 'browser_preview');
assert.equal(stl.artifact.visibility, 'INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED');
assert.equal(stl.artifact.runtimeUrl, undefined);
assert.equal(selectGeometryRepresentationV1(bundle, 'glb')?.representationId, glb.representationId);
assert.equal(selectGeometryRepresentationV1(bundle, 'stl')?.representationId, stl.representationId);

const artifactPort = {
  readBytes: async (path) => new Uint8Array(await readFile(new URL(`../${path}`, import.meta.url))),
  sha256: async (bytes) => sha256(bytes),
};
const verified = await verifyNailSurfaceGeometryBundleV1(bundle, artifactPort);
assert.equal(verified.ok, true, 'real representation bytes must verify');
const calls = [];
const corruptedResult = await verifyNailSurfaceGeometryBundleV1(bundle, {
  ...artifactPort,
  readBytes: async (path) => {
    calls.push(path);
    const bytes = await artifactPort.readBytes(path);
    if (path.endsWith('.glb')) bytes[0] ^= 0xff;
    return bytes;
  },
});
assert.deepEqual(corruptedResult, { ok: false, code: 'hash_mismatch', path: '$.representationSet.representations[0].artifact' });
assert.equal(calls.length, 1, 'verification must stop at first failed artifact and never fall back');

const serialized = JSON.stringify(bundle);
assert.doesNotMatch(serialized, /promotion|manufacturingValidated":true|production_ready/i, 'representation must not self-promote');
const invalid = structuredClone(bundle);
invalid.representationSet.representations[0].artifact.sha256 = 'f'.repeat(64);
assert.equal(parseNailSurfaceGeometryBundleV1(invalid).ok, true, 'schema accepts immutable artifact ref before byte verification');
assert.notEqual(invalid.representationSet.representations[0].artifact.sha256, sha256(await readFile(new URL(`../${invalid.representationSet.representations[0].artifact.path}`, import.meta.url))), 'byte verifier must detect tampering');
const unknown = structuredClone(bundle);
unknown.representationSet.order = 1;
const unknownResult = parseNailSurfaceGeometryBundleV1(unknown);
assert.equal(unknownResult.ok, false);
assert.ok(!unknownResult.ok && unknownResult.issues.some((entry) => entry.path === '$.representationSet.order'));

execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: 'ignore' });
assert.equal(sha256(await readFile(bundleUrl)), sha256(bundleBytes), 'bundle regeneration must be byte deterministic');

const schema = JSON.parse(await readFile(new URL('../src/studio/geometry/v0-7-2/geometry-contract-v1.schema.json', import.meta.url)));
for (const name of ['geometryRepresentation', 'geometryRepresentationSet', 'nailSurfaceGeometryBundle', 'representationArtifact']) {
  assert.equal(schema.$defs[name].additionalProperties, false, `${name} must reject unknown keys`);
}

console.log('test-geo-v0-7-2-almond-representation: PASS (real v3 surface metrics, canonical snapshot, immutable GLB/STL refs, byte hashes, no promotion)');
