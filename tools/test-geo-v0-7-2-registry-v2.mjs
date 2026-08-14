import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  GEOMETRY_REGISTRY_V2,
  parseGeometryRegistryV2,
  resolvePromotedGeometryV2,
  verifyNailSurfaceGeometryBundleV1,
} from '../src/studio/geometry/v0-7-2/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const registryUrl = new URL('../assets/geometry/registry-v2.json', import.meta.url);
const bundleUrl = new URL('../assets/geometry/representations/almond-medium-v3/canonical-bundle.json', import.meta.url);
const publicGlbUrl = new URL('../public/geometry-v0-7-2/almond-medium-v3/shell.web.glb', import.meta.url);
const sourceGlbUrl = new URL('../assets/glb/shells/almond/medium-candidate-v3/shell.web.glb', import.meta.url);
const generatorPath = fileURLToPath(new URL('./generate-geo-v0-7-2-registry-v2.mjs', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const registryBytes = await readFile(registryUrl);
const registry = JSON.parse(registryBytes);
const bundleBytes = await readFile(bundleUrl);
const bundle = JSON.parse(bundleBytes);
const parsed = parseGeometryRegistryV2(registry);
assert.equal(parsed.ok, true, JSON.stringify(!parsed.ok && parsed.issues));
assert.deepEqual(parsed.ok && parsed.value, registry);
assert.deepEqual(GEOMETRY_REGISTRY_V2, registry);

const entry = registry.entries[0];
assert.equal(entry.bundleRef.sha256, sha256(bundleBytes));
assert.equal(entry.bundleRef.id, bundle.bundleId);
assert.equal(entry.surfaceDefinitionRef.sha256, bundle.surfaceDefinition.sha256);
assert.equal(entry.geometrySnapshotRef.sha256, bundle.canonicalGeometry.geometryHash);
assert.equal(entry.representationSetRef.sha256, sha256(canonical(bundle.representationSet)));
assert.equal(entry.browserDelivery.sha256, sha256(await readFile(sourceGlbUrl)));
assert.equal(entry.browserDelivery.sha256, sha256(await readFile(publicGlbUrl)));
assert.equal((await stat(publicGlbUrl)).size, entry.browserDelivery.byteLength);
assert.equal(entry.browserDelivery.triangleCount, bundle.canonicalGeometry.topology.triangleCount);
assert.equal(entry.evidence.productVisualSignoff, 'PRODUCT_VISUAL_SIGNED_OFF');
assert.equal(entry.evidence.manufacturingValidated, false);
assert.equal(entry.policy.writerEffect, 'none');

for (const consumer of ['single_nail_pbr', 'geometry_kernel_preview']) {
  const result = resolvePromotedGeometryV2({ shape: 'almond', length: 'medium', consumer });
  assert.equal(result.status, 'promoted');
  assert.equal(result.status === 'promoted' && result.delivery.sha256, entry.browserDelivery.sha256);
  assert.equal(result.manufacturingValidated, false);
}
for (const consumer of ['manufacturing_compiler', 'device_job', 'production_export']) {
  assert.deepEqual(resolvePromotedGeometryV2({ shape: 'almond', length: 'medium', consumer }), {
    status: 'unavailable', reason: 'consumer_forbidden', manufacturingValidated: false,
  });
}
assert.deepEqual(resolvePromotedGeometryV2({ shape: 'almond', length: 'short', consumer: 'single_nail_pbr' }), {
  status: 'unavailable', reason: 'not_registered', manufacturingValidated: false,
});

const bundlePort = {
  readBytes: async (path) => new Uint8Array(await readFile(new URL(`../${path}`, import.meta.url))),
  sha256: async (bytes) => sha256(bytes),
};
assert.equal((await verifyNailSurfaceGeometryBundleV1(bundle, bundlePort)).ok, true);
let reads = 0;
const corrupted = await verifyNailSurfaceGeometryBundleV1(bundle, {
  ...bundlePort,
  readBytes: async (path) => {
    reads += 1;
    const bytes = await bundlePort.readBytes(path);
    bytes[0] ^= 0xff;
    return bytes;
  },
});
assert.deepEqual(corrupted, { ok: false, code: 'hash_mismatch', path: '$.representationSet.representations[0].artifact' });
assert.equal(reads, 1, 'integrity failure must stop before any fallback or consumer resolution');

const unknown = structuredClone(registry);
unknown.entries[0].order = 1;
assert.equal(parseGeometryRegistryV2(unknown).ok, false);
const duplicate = structuredClone(registry);
duplicate.entries.push(structuredClone(duplicate.entries[0]));
assert.equal(parseGeometryRegistryV2(duplicate).ok, false);
const dishonest = structuredClone(registry);
dishonest.entries[0].evidence.manufacturingValidated = true;
assert.equal(parseGeometryRegistryV2(dishonest).ok, false);
const invalidCalendar = structuredClone(registry);
invalidCalendar.entries[0].evidence.promotedAt = '2026-99-99T00:00:00.000Z';
assert.doesNotThrow(() => parseGeometryRegistryV2(invalidCalendar));
assert.equal(parseGeometryRegistryV2(invalidCalendar).ok, false);
const widened = structuredClone(registry);
widened.entries[0].policy.allowedConsumers.push('manufacturing_compiler');
assert.equal(parseGeometryRegistryV2(widened).ok, false);

await assert.rejects(access(new URL('../public/geometry-v0-7-2/almond-medium-v3/shell.stl', import.meta.url)),
  'STL must never be copied into the public delivery tree');
const runtime = await readFile(new URL('../src/studio/rendering/v0-7-2/SingleNailPbrPreviewV072.tsx', import.meta.url), 'utf8');
const loader = await readFile(new URL('../src/studio/rendering/v0-7-2/promoted-geometry-loader.ts', import.meta.url), 'utf8');
assert.match(runtime, /resolvePromotedGeometryV2/);
assert.match(runtime, /loadPromotedGeometryV2/);
assert.doesNotMatch(runtime, /createSingleNailPreviewSurfaceV1|3\.2 \+ decoration\.heightMm/);
assert.match(loader, /promoted_geometry_integrity_failed/);
assert.match(loader, /getAttribute\('normal'\).*getAttribute\('uv'\)/s);
assert.doesNotMatch(`${runtime}\n${loader}`, /STLLoader|\.stl|manufacturing_compiler|device_job/);

execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: 'ignore' });
assert.equal(sha256(await readFile(registryUrl)), sha256(registryBytes), 'registry generation must be byte deterministic');
assert.equal(sha256(await readFile(publicGlbUrl)), entry.browserDelivery.sha256, 'browser GLB delivery must remain immutable');

const jsonSchema = JSON.parse(await readFile(new URL('../src/studio/geometry/v0-7-2/registry-v2.schema.json', import.meta.url)));
assert.equal(jsonSchema.additionalProperties, false);
assert.equal(jsonSchema.$defs.entry.additionalProperties, false);
assert.equal(jsonSchema.$defs.entry.properties.browserDelivery.additionalProperties, false);

console.log('test-geo-v0-7-2-registry-v2: PASS (signed visual promotion, immutable GLB delivery, preview-only allowlist, manufacturing/STL fail-closed)');
