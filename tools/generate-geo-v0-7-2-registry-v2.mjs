import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bundlePath = resolve(root, 'assets/geometry/representations/almond-medium-v3/canonical-bundle.json');
const registryPath = resolve(root, 'assets/geometry/registry-v2.json');
const publicPath = resolve(root, 'public/geometry-v0-7-2/almond-medium-v3/shell.web.glb');
const bundleBytes = await readFile(bundlePath);
const bundle = JSON.parse(bundleBytes);
const glb = bundle.representationSet.representations.find((entry) => entry.format === 'glb');
const stl = bundle.representationSet.representations.find((entry) => entry.format === 'stl');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

if (!glb || !stl) throw new Error('promotion requires GLB/STL representation parity');
if (glb.evidence.productVisualSignoff !== true || glb.evidence.manufacturingValidated !== false) throw new Error('promotion evidence mismatch');
if (bundle.surfaceDefinition.evidence.fidelity !== 'approximate' || bundle.surfaceDefinition.shapeDefinition.thickness.mode !== 'vertical_preview_thickness') throw new Error('candidate truth boundary mismatch');
if (bundle.canonicalGeometry.geometryHash !== glb.canonicalTriangleSha256 || glb.canonicalTriangleSha256 !== stl.canonicalTriangleSha256) throw new Error('canonical triangle identity mismatch');
const sourceGlbPath = resolve(root, glb.artifact.path);
const glbBytes = await readFile(sourceGlbPath);
if (sha256(glbBytes) !== glb.artifact.sha256 || glbBytes.byteLength !== glb.artifact.byteLength) throw new Error('GLB artifact integrity failed before promotion');

const surfaceRef = {
  id: bundle.surfaceDefinition.surfaceDefinitionId,
  revision: bundle.surfaceDefinition.revision,
  sha256: bundle.surfaceDefinition.sha256,
};
const geometryRef = {
  id: bundle.canonicalGeometry.geometrySnapshotId,
  revision: bundle.canonicalGeometry.revision,
  sha256: bundle.canonicalGeometry.geometryHash,
};
const representationSetRef = {
  id: bundle.representationSet.representationSetId,
  revision: bundle.representationSet.revision,
  sha256: sha256(canonical(bundle.representationSet)),
};
const registry = {
  schemaVersion: '2.0.0',
  registryId: 'nextgen-beauty.geometry-registry-v2',
  revision: 'registry-v2-2026-08-14-almond-medium-v3',
  geometryContractVersion: bundle.schemaVersion,
  entries: [{
    registryEntryId: 'geometry-registry.almond.medium.visual-v3',
    revision: 'promotion-2026-08-14.1',
    shape: 'almond',
    length: 'medium',
    promotionState: 'promoted_simulated_preview',
    promotionClass: 'simulated_preview_geometry_kernel',
    bundleRef: {
      id: bundle.bundleId,
      revision: bundle.revision,
      sha256: sha256(bundleBytes),
      path: 'assets/geometry/representations/almond-medium-v3/canonical-bundle.json',
    },
    surfaceDefinitionRef: surfaceRef,
    geometrySnapshotRef: geometryRef,
    representationSetRef,
    browserDelivery: {
      representationId: glb.representationId,
      revision: glb.revision,
      runtimeUrl: '/geometry-v0-7-2/almond-medium-v3/shell.web.glb',
      mimeType: 'model/gltf-binary',
      sha256: glb.artifact.sha256,
      byteLength: glb.artifact.byteLength,
      triangleCount: bundle.canonicalGeometry.topology.triangleCount,
    },
    policy: {
      fidelity: 'approximate',
      allowedConsumers: ['single_nail_pbr', 'geometry_kernel_preview'],
      forbiddenConsumers: ['manufacturing_compiler', 'device_job', 'production_export'],
      writerEffect: 'none',
    },
    evidence: {
      productVisualSignoff: 'PRODUCT_VISUAL_SIGNED_OFF',
      representationParityVerified: true,
      bundleIntegrityVerified: true,
      manufacturingValidated: false,
      promotedAt: '2026-08-14T00:00:00.000Z',
      validationRefs: [
        'assets/glb/shells/almond/medium-candidate-v3/SIGNOFF.md',
        'evidence/pr-geo-v0-7-2-01-nail-surface-representation/VALIDATION.md',
      ],
      limitations: [
        'promotion authorizes simulated single-nail PBR and geometry-kernel preview only',
        'vertical preview thickness is not normal-offset engineering wall thickness',
        'not fitted to scan, not physically validated, not manufacturable or device-ready',
        'STL remains internal and is never served or exported',
      ],
    },
  }],
};

await mkdir(resolve(registryPath, '..'), { recursive: true });
await mkdir(resolve(publicPath, '..'), { recursive: true });
await copyFile(sourceGlbPath, publicPath);
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(JSON.stringify({ registryId: registry.registryId, entry: registry.entries[0].registryEntryId, geometryHash: geometryRef.sha256, glbSha256: glb.artifact.sha256 }, null, 2));
