import type {
  CanonicalGeometrySnapshotV1,
  GeometryEvaluationRecordV1,
  GeometryOperationGraphV1,
  GeometryTransformV1,
  NailSurfaceDefinitionV1,
} from './model';

const h = (digit: string): string => digit.repeat(64);

export const GOLDEN_ALMOND_SURFACE_V1: NailSurfaceDefinitionV1 = {
  schemaVersion: '1.0.0',
  surfaceDefinitionId: 'surface.reference.almond.medium.v1',
  revision: 'surface-reference-1',
  sha256: h('1'),
  sourceType: 'generated',
  sourceRefs: [{ id: 'silhouette.almond.medium', revision: 'signed-2d-v1', sha256: h('2') }],
  coordinateFrame: {
    contract: 'nail-surface-mm-rh-root-center-v1', unit: 'mm', handedness: 'right', origin: 'nail_root_center',
    xAxis: 'right', yAxis: 'root_to_tip_negative', zAxis: 'outward',
  },
  planform: {
    silhouetteRef: { id: 'silhouette.almond.medium', revision: 'signed-2d-v1', sha256: h('2') },
    widthMm: 11,
    lengthMm: 19.1,
    landmarks: [
      { id: 'tip', xMm: 0, yMm: -18, zMm: 0.45 },
      { id: 'root_center', xMm: 0, yMm: 1.1, zMm: 0.15 },
      { id: 'left_side', xMm: -5.5, yMm: -3.06, zMm: 0.4 },
      { id: 'right_side', xMm: 5.5, yMm: -3.06, zMm: 0.4 },
      { id: 'apex', xMm: 0, yMm: -5.5, zMm: 2.53 },
    ],
  },
  surfaceFrames: {
    classes: ['outer', 'inner', 'rim'],
    uvContract: 'nail-local-u-left-right-v-tip-root-v1',
    seam: 'root_center',
    tangentPolicy: 'right_handed_tangent_frame',
  },
  shapeDefinition: {
    cCurveStations: [
      { v: 0, widthMm: 2.3, crownRiseMm: 0.7, radiusMm: 2.3 },
      { v: 0.25, widthMm: 8.4, crownRiseMm: 1.55, radiusMm: 6.5 },
      { v: 0.55, widthMm: 11, crownRiseMm: 1.93, radiusMm: 8.8 },
      { v: 0.8, widthMm: 10.2, crownRiseMm: 1.65, radiusMm: 8.1 },
      { v: 1, widthMm: 9.57, crownRiseMm: 1.4, radiusMm: 7.5 },
    ],
    longitudinalStations: [
      { v: 0, outerZMm: 0.45, innerZMm: -0.15 },
      { v: 0.32, outerZMm: 1.6, innerZMm: 0.9 },
      { v: 0.66, outerZMm: 2.53, innerZMm: 1.78 },
      { v: 1, outerZMm: 0.15, innerZMm: -0.3 },
    ],
    cavityDepthMm: 1.48,
    thickness: {
      mode: 'normal',
      stations: [
        { v: 0, thicknessMm: 0.6 }, { v: 0.32, thicknessMm: 0.65 }, { v: 0.66, thicknessMm: 0.75 }, { v: 1, thicknessMm: 0.45 },
      ],
    },
  },
  evidence: {
    fidelity: 'approximate',
    manufacturingValidated: false,
    limitations: ['reference shell only', 'not scanned or fitted', 'not manufacturing validated'],
    validationRefs: [{ id: 'evidence.almond.architecture-golden', revision: 'rev-1', sha256: h('3') }],
  },
};

const canonicalFrame = structuredClone(GOLDEN_ALMOND_SURFACE_V1.coordinateFrame);
const attrs = { normal: 'preserved', uv: 'preserved', tangent: 'preserved', materialGroup: 'preserved', faceProvenance: 'preserved' } as const;

export const GOLDEN_ALMOND_SNAPSHOT_V1: CanonicalGeometrySnapshotV1 = {
  schemaVersion: '1.0.0',
  geometrySnapshotId: 'geometry.reference.almond.medium.v1',
  revision: 'canonical-geometry-1',
  geometryHash: h('4'),
  sourceDefinitions: [{ id: GOLDEN_ALMOND_SURFACE_V1.surfaceDefinitionId, revision: GOLDEN_ALMOND_SURFACE_V1.revision, sha256: GOLDEN_ALMOND_SURFACE_V1.sha256 }],
  coordinateFrame: canonicalFrame,
  topology: { vertexCount: 8292, triangleCount: 16580, componentCount: 1, boundaryEdgeCount: 0, nonManifoldEdgeCount: 0, degenerateTriangleCount: 0, windingErrorCount: 0, watertight: true },
  boundsMm: { min: [-5.5, -18, -0.3], max: [5.5, 1.1, 2.53] },
  volumeMm3: 83.5,
  surfaceAreaMm2: 476.2,
  regions: [{ regionId: 'outer', faceCount: 8128 }, { regionId: 'inner', faceCount: 8128 }, { regionId: 'rim', faceCount: 324 }],
  attributes: attrs,
  toolchain: { evaluatorId: 'architecture-golden-evaluator', evaluatorRevision: 'rev-1', buildSha256: h('5') },
  evidence: { fidelity: 'approximate', manufacturingValidated: false, limitations: ['numeric architecture fixture; not a production shell'] },
};

export const GOLDEN_RELIEF_SNAPSHOT_V1: CanonicalGeometrySnapshotV1 = {
  ...structuredClone(GOLDEN_ALMOND_SNAPSHOT_V1),
  geometrySnapshotId: 'geometry.fixture.relief.flower.v1', revision: 'canonical-relief-1', geometryHash: h('6'),
  topology: { vertexCount: 514, triangleCount: 1024, componentCount: 1, boundaryEdgeCount: 0, nonManifoldEdgeCount: 0, degenerateTriangleCount: 0, windingErrorCount: 0, watertight: true },
  boundsMm: { min: [-2, -8, 1.8], max: [2, -4, 2.4] }, volumeMm3: 4.2, surfaceAreaMm2: 21.4,
  regions: [{ regionId: 'relief_top', faceCount: 480 }, { regionId: 'relief_side', faceCount: 480 }, { regionId: 'relief_base', faceCount: 64 }],
};

export const GOLDEN_ATTACHMENT_SNAPSHOT_V1: CanonicalGeometrySnapshotV1 = {
  ...structuredClone(GOLDEN_ALMOND_SNAPSHOT_V1),
  geometrySnapshotId: 'geometry.fixture.attachment.pearl.v1', revision: 'canonical-attachment-1', geometryHash: h('7'),
  topology: { vertexCount: 642, triangleCount: 1280, componentCount: 1, boundaryEdgeCount: 0, nonManifoldEdgeCount: 0, degenerateTriangleCount: 0, windingErrorCount: 0, watertight: true },
  boundsMm: { min: [-1, -1, -1], max: [1, 1, 1] }, volumeMm3: 4.18, surfaceAreaMm2: 12.56,
  regions: [{ regionId: 'attachment_body', faceCount: 1180 }, { regionId: 'attachment_contact', faceCount: 50 }, { regionId: 'attachment_provenance', faceCount: 50 }],
};

const transform: GeometryTransformV1 = { translationMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] };
const preserve = { uv: 'preserve', materialGroup: 'preserve', faceProvenance: 'preserve' } as const;
const single = { empty: 'reject', minComponents: 1, maxComponents: 1, primaryComponentRequired: true } as const;

export const GOLDEN_OPERATION_GRAPH_V1: GeometryOperationGraphV1 = {
  schemaVersion: '1.0.0', graphId: 'graph.almond.relief.attachment.v1', revision: 'rev-1', sha256: h('8'), outputRef: 'validated-result',
  nodes: [
    { nodeId: 'shell', operation: 'shell_from_surface', inputRefs: [GOLDEN_ALMOND_SURFACE_V1.surfaceDefinitionId], outputRef: 'shell-solid', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'relief', operation: 'relief_from_outline', inputRefs: ['outline.flower.v1'], outputRef: 'relief-solid', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'subtract', operation: 'subtract', inputRefs: ['shell-solid', 'relief-solid'], outputRef: 'engraved-shell', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'attachment', operation: 'place_attachment', inputRefs: [GOLDEN_ATTACHMENT_SNAPSHOT_V1.geometrySnapshotId], outputRef: 'placed-attachment', transform: { translationMm: [1.2, -6, 2], rotationDeg: [0, 0, 0], scale: [1, 1, 1] }, toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'union', operation: 'union', inputRefs: ['engraved-shell', 'placed-attachment'], outputRef: 'combined-solid', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'intersect', operation: 'intersect', inputRefs: ['shell-solid', 'placed-attachment'], outputRef: 'contact-region', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: { empty: 'allow', minComponents: 0, maxComponents: 4, primaryComponentRequired: false }, attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
    { nodeId: 'validate', operation: 'validate', inputRefs: ['combined-solid'], outputRef: 'validated-result', transform: structuredClone(transform), toleranceMm: 0.01, componentPolicy: structuredClone(single), attributePolicy: structuredClone(preserve), evidenceExpectation: 'approximate' },
  ],
};

export const GOLDEN_EVALUATION_RECORD_V1: GeometryEvaluationRecordV1 = {
  schemaVersion: '1.0.0', evaluationId: 'evaluation.golden.almond.v1',
  graphRef: { id: GOLDEN_OPERATION_GRAPH_V1.graphId, revision: GOLDEN_OPERATION_GRAPH_V1.revision, sha256: GOLDEN_OPERATION_GRAPH_V1.sha256 },
  inputGeometryHashes: [GOLDEN_ALMOND_SNAPSHOT_V1.geometryHash, GOLDEN_RELIEF_SNAPSHOT_V1.geometryHash, GOLDEN_ATTACHMENT_SNAPSHOT_V1.geometryHash],
  kernel: { adapterId: 'architecture-golden-adapter', adapterRevision: 'rev-1', buildSha256: h('9') }, toleranceMm: 0.01,
  status: 'succeeded', outputGeometryHash: h('a'),
  outputMetrics: { ...GOLDEN_ALMOND_SNAPSHOT_V1.topology, vertexCount: 9321, triangleCount: 18622, volumeMm3: 86.1, surfaceAreaMm2: 501.4 },
  attributes: attrs, warnings: [], performance: { elapsedMs: 18.4, peakMemoryBytes: 4_194_304 },
  evidence: { fidelity: 'approximate', manufacturingValidated: false },
};

export const GEOMETRY_FAILURE_MATRIX_V1 = [
  { id: 'unknown-key', target: 'surface', mutate: (value: Record<string, unknown>) => { value.order = 1; }, expectedPath: '$.order' },
  { id: 'wrong-unit', target: 'surface', mutate: (value: Record<string, unknown>) => { (value.coordinateFrame as Record<string, unknown>).unit = 'cm'; }, expectedPath: '$.coordinateFrame' },
  { id: 'vertical-not-normal', target: 'surface', mutate: (value: Record<string, unknown>) => { (value.shapeDefinition as Record<string, unknown>).thickness = { mode: 'normal', stations: [{ v: 0, thicknessMm: 0.5 }, { v: 0, thicknessMm: 0.6 }] }; }, expectedPath: '$.shapeDefinition.thickness.stations[1].v' },
  { id: 'watertight-conflict', target: 'snapshot', mutate: (value: Record<string, unknown>) => { (value.topology as Record<string, unknown>).boundaryEdgeCount = 2; }, expectedPath: '$.topology' },
  { id: 'component-range', target: 'graph', mutate: (value: Record<string, unknown>) => { const node = (value.nodes as Array<Record<string, unknown>>)[0]; node.componentPolicy = { empty: 'reject', minComponents: 2, maxComponents: 1, primaryComponentRequired: true }; }, expectedPath: '$.nodes[0].componentPolicy' },
  { id: 'output-dangling', target: 'graph', mutate: (value: Record<string, unknown>) => { value.outputRef = 'missing-output'; }, expectedPath: '$.outputRef' },
  { id: 'success-without-output', target: 'evaluation', mutate: (value: Record<string, unknown>) => { delete value.outputGeometryHash; }, expectedPath: '$.outputGeometryHash' },
] as const;
