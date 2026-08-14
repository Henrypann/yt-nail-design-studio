import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'assets/glb/shells/almond/medium-candidate-v3');
const outputPath = resolve(root, 'assets/geometry/representations/almond-medium-v3/canonical-bundle.json');
const reportBytes = await readFile(resolve(sourceDir, 'geometry-report.json'));
const manifestBytes = await readFile(resolve(sourceDir, 'shell.manifest.json'));
const report = JSON.parse(reportBytes);
const manifest = JSON.parse(manifestBytes);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

if (manifest.status !== 'SIMULATED_CANDIDATE_NOT_PROMOTED') throw new Error('representation input must remain unpromoted');
if (manifest.source.productVisualCandidate.evidence !== 'PRODUCT_VISUAL_SIGNED_OFF_NOT_PROMOTED') throw new Error('product visual sign-off missing');
if (!report.artifactParity.sameCanonicalTriangles || report.artifactParity.glbTriangleSha256 !== report.artifactParity.stlTriangleSha256) throw new Error('GLB/STL canonical triangle parity failed');

const coordinateFrame = {
  contract: 'nail-surface-mm-rh-root-center-v1', unit: 'mm', handedness: 'right', origin: 'nail_root_center',
  xAxis: 'right', yAxis: 'root_to_tip_negative', zAxis: 'outward',
};
const profileRef = {
  id: report.source.productVisualCandidate.profileId,
  revision: 'visual-signoff-2026-08-14',
  sha256: report.source.productVisualCandidate.sha256,
};
const signedSilhouetteRef = {
  id: 'silhouette.almond.medium',
  revision: `shape-params-v${report.source.shapeParams.version}`,
  sha256: report.source.signed2dSilhouette.sha256,
};
const generatorRef = {
  id: report.source.generator.contract,
  revision: report.revision,
  sha256: report.source.generator.sha256,
};
const reportRef = {
  id: 'geometry-report.almond.medium.v3',
  revision: report.revision,
  sha256: sha256(reportBytes),
};
const surfaceIdentity = {
  schemaVersion: '1.0.0',
  surfaceDefinitionId: 'surface.almond.medium.visual-v3',
  revision: report.revision,
  sourceType: 'generated',
  sourceRefs: [profileRef, signedSilhouetteRef, generatorRef],
  coordinateFrame,
  planform: {
    silhouetteRef: profileRef,
    widthMm: report.shapeMetrics.maxWidthMm,
    lengthMm: report.shapeMetrics.envelopeLengthMm,
    landmarks: report.shapeMetrics.landmarks,
  },
  surfaceFrames: {
    classes: ['outer', 'inner', 'rim'],
    uvContract: 'nail-local-u-left-right-v-tip-root-v1',
    seam: 'root_center',
    tangentPolicy: 'right_handed_tangent_frame',
  },
  shapeDefinition: {
    cCurveStations: report.shapeMetrics.cCurveStations,
    longitudinalStations: report.shapeMetrics.longitudinalStations,
    cavityDepthMm: report.shapeMetrics.undersideCavityDepthMm,
    thickness: { mode: 'vertical_preview_thickness', stations: report.shapeMetrics.thicknessStations },
  },
  evidence: {
    fidelity: 'approximate',
    manufacturingValidated: false,
    limitations: report.assumptions.limitations,
    validationRefs: [reportRef],
  },
};
const surfaceDefinition = { ...surfaceIdentity, sha256: sha256(canonical(surfaceIdentity)) };
const surfaceRef = { id: surfaceDefinition.surfaceDefinitionId, revision: surfaceDefinition.revision, sha256: surfaceDefinition.sha256 };
const geometryHash = report.mesh.canonicalTriangleSha256;
const canonicalGeometry = {
  schemaVersion: '1.0.0',
  geometrySnapshotId: 'geometry.almond.medium.visual-v3',
  revision: report.revision,
  geometryHash,
  sourceDefinitions: [surfaceRef],
  coordinateFrame,
  topology: {
    vertexCount: report.mesh.vertices,
    triangleCount: report.mesh.triangles,
    componentCount: report.mesh.connectedComponents,
    boundaryEdgeCount: report.mesh.boundaryEdges,
    nonManifoldEdgeCount: report.mesh.nonManifoldEdges,
    degenerateTriangleCount: report.mesh.degenerateTriangles,
    windingErrorCount: report.mesh.inconsistentWindingEdges,
    watertight: report.mesh.watertight,
  },
  boundsMm: report.mesh.boundsMm,
  volumeMm3: report.mesh.volumeMm3,
  surfaceAreaMm2: report.mesh.surfaceAreaMm2,
  regions: Object.entries(report.shapeMetrics.regionFaceCounts).map(([regionId, faceCount]) => ({ regionId, faceCount })),
  attributes: { normal: 'preserved', uv: 'preserved', tangent: 'unavailable', materialGroup: 'preserved', faceProvenance: 'unavailable' },
  toolchain: { evaluatorId: report.source.generator.contract, evaluatorRevision: report.revision, buildSha256: report.source.generator.sha256 },
  evidence: { fidelity: 'approximate', manufacturingValidated: false, limitations: report.assumptions.limitations },
};
const geometrySnapshotRef = { id: canonicalGeometry.geometrySnapshotId, revision: canonicalGeometry.revision, sha256: geometryHash };

const representation = (format, role, artifact, attributes) => ({
  schemaVersion: '1.0.0',
  representationId: `representation.almond.medium.visual-v3.${format}`,
  revision: report.revision,
  format,
  role,
  geometrySnapshotRef,
  coordinateFrame,
  canonicalTriangleSha256: geometryHash,
  artifact: {
    path: artifact.path,
    ...(artifact.runtimeUrl ? { runtimeUrl: artifact.runtimeUrl } : {}),
    mimeType: artifact.mime,
    sha256: artifact.sha256,
    byteLength: artifact.bytes,
    visibility: artifact.visibility,
  },
  attributes,
  evidence: {
    fidelity: 'approximate',
    productVisualSignoff: true,
    manufacturingValidated: false,
    limitations: report.assumptions.limitations,
  },
});

const representationSet = {
  schemaVersion: '1.0.0',
  representationSetId: 'representation-set.almond.medium.visual-v3',
  revision: report.revision,
  geometrySnapshotRef,
  representations: [
    representation('glb', 'browser_preview', report.artifacts.glb, { normal: 'preserved', uv: 'preserved', materialGroup: 'preserved' }),
    representation('stl', 'internal_geometry_interchange', report.artifacts.stl, { normal: 'degraded', uv: 'unavailable', materialGroup: 'unavailable' }),
  ],
  parity: { canonicalTriangleSha256: geometryHash, sameCanonicalTriangles: true, boundsToleranceMm: report.artifactParity.boundsToleranceMm },
};
const bundle = {
  schemaVersion: '1.0.0',
  bundleId: 'nail-surface-bundle.almond.medium.visual-v3',
  revision: report.revision,
  surfaceDefinition,
  canonicalGeometry,
  representationSet,
};

await mkdir(resolve(outputPath, '..'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(JSON.stringify({ bundleId: bundle.bundleId, surfaceSha256: surfaceDefinition.sha256, geometryHash, representations: representationSet.representations.map((entry) => entry.format) }, null, 2));
