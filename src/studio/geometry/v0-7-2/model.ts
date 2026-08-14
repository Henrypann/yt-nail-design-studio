export const GEOMETRY_CONTRACT_VERSION_V072 = '1.0.0' as const;
export const NAIL_SURFACE_COORDINATE_CONTRACT_V1 = 'nail-surface-mm-rh-root-center-v1' as const;

export type GeometryEvidenceClassV1 = 'designed' | 'generated' | 'scanned' | 'fitted';
export type GeometryFidelityV1 = 'exact' | 'approximate' | 'unavailable';
export type GeometryAttributeStateV1 = 'preserved' | 'degraded' | 'unavailable';
export type GeometryStableErrorCodeV1 =
  | 'invalid_contract'
  | 'revision_mismatch'
  | 'hash_mismatch'
  | 'coordinate_mismatch'
  | 'invalid_operation_graph'
  | 'invalid_topology'
  | 'component_policy_failed'
  | 'attribute_policy_failed'
  | 'kernel_unavailable'
  | 'cancelled'
  | 'timeout'
  | 'resource_limit';

export interface GeometryVersionedRefV1 {
  id: string;
  revision: string;
  sha256: string;
}

export interface NailSurfaceCoordinateFrameV1 {
  contract: typeof NAIL_SURFACE_COORDINATE_CONTRACT_V1;
  unit: 'mm';
  handedness: 'right';
  origin: 'nail_root_center';
  xAxis: 'right';
  yAxis: 'root_to_tip_negative';
  zAxis: 'outward';
}

export interface NailSurfaceLandmarkV1 {
  id: 'tip' | 'root_center' | 'left_side' | 'right_side' | 'apex';
  xMm: number;
  yMm: number;
  zMm: number;
}

export interface CCurveStationV1 {
  v: number;
  widthMm: number;
  crownRiseMm: number;
  radiusMm: number;
}

export interface LongitudinalStationV1 {
  v: number;
  outerZMm: number;
  innerZMm: number;
}

export interface ThicknessStationV1 {
  v: number;
  thicknessMm: number;
}

export interface NailSurfaceDefinitionV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  surfaceDefinitionId: string;
  revision: string;
  sha256: string;
  sourceType: GeometryEvidenceClassV1;
  sourceRefs: GeometryVersionedRefV1[];
  coordinateFrame: NailSurfaceCoordinateFrameV1;
  planform: {
    silhouetteRef: GeometryVersionedRefV1;
    widthMm: number;
    lengthMm: number;
    landmarks: NailSurfaceLandmarkV1[];
  };
  surfaceFrames: {
    classes: ['outer', 'inner', 'rim'];
    uvContract: 'nail-local-u-left-right-v-tip-root-v1';
    seam: 'root_center';
    tangentPolicy: 'right_handed_tangent_frame';
  };
  shapeDefinition: {
    cCurveStations: CCurveStationV1[];
    longitudinalStations: LongitudinalStationV1[];
    cavityDepthMm: number;
    thickness: {
      mode: 'normal' | 'vertical_preview_thickness';
      stations: ThicknessStationV1[];
    };
  };
  evidence: {
    fidelity: GeometryFidelityV1;
    manufacturingValidated: false;
    limitations: string[];
    validationRefs: GeometryVersionedRefV1[];
  };
}

export interface CanonicalGeometrySnapshotV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  geometrySnapshotId: string;
  revision: string;
  geometryHash: string;
  sourceDefinitions: GeometryVersionedRefV1[];
  coordinateFrame: NailSurfaceCoordinateFrameV1;
  topology: {
    vertexCount: number;
    triangleCount: number;
    componentCount: number;
    boundaryEdgeCount: number;
    nonManifoldEdgeCount: number;
    degenerateTriangleCount: number;
    windingErrorCount: number;
    watertight: boolean;
  };
  boundsMm: { min: [number, number, number]; max: [number, number, number] };
  volumeMm3: number;
  surfaceAreaMm2: number;
  regions: Array<{ regionId: 'outer' | 'inner' | 'rim' | string; faceCount: number }>;
  attributes: {
    normal: GeometryAttributeStateV1;
    uv: GeometryAttributeStateV1;
    tangent: GeometryAttributeStateV1;
    materialGroup: GeometryAttributeStateV1;
    faceProvenance: GeometryAttributeStateV1;
  };
  toolchain: { evaluatorId: string; evaluatorRevision: string; buildSha256: string };
  evidence: { fidelity: GeometryFidelityV1; manufacturingValidated: false; limitations: string[] };
}

export type GeometryRepresentationFormatV1 = 'glb' | 'stl';
export type GeometryRepresentationRoleV1 = 'browser_preview' | 'internal_geometry_interchange';

export interface GeometryRepresentationArtifactV1 {
  path: string;
  runtimeUrl?: string;
  mimeType: 'model/gltf-binary' | 'model/stl';
  sha256: string;
  byteLength: number;
  visibility: 'DEV_REVIEW_ONLY' | 'BROWSER_PREVIEW' | 'INTERNAL_ONLY_NOT_SERVED_NOT_EXPORTED';
}

/**
 * Immutable encoding of one CanonicalGeometrySnapshot. Promotion is deliberately
 * absent: Registry V2 owns lifecycle, while this record only proves artifact identity.
 */
export interface GeometryRepresentationV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  representationId: string;
  revision: string;
  format: GeometryRepresentationFormatV1;
  role: GeometryRepresentationRoleV1;
  geometrySnapshotRef: GeometryVersionedRefV1;
  coordinateFrame: NailSurfaceCoordinateFrameV1;
  canonicalTriangleSha256: string;
  artifact: GeometryRepresentationArtifactV1;
  attributes: {
    normal: GeometryAttributeStateV1;
    uv: GeometryAttributeStateV1;
    materialGroup: GeometryAttributeStateV1;
  };
  evidence: {
    fidelity: GeometryFidelityV1;
    productVisualSignoff: boolean;
    manufacturingValidated: false;
    limitations: string[];
  };
}

export interface GeometryRepresentationSetV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  representationSetId: string;
  revision: string;
  geometrySnapshotRef: GeometryVersionedRefV1;
  representations: GeometryRepresentationV1[];
  parity: {
    canonicalTriangleSha256: string;
    sameCanonicalTriangles: boolean;
    boundsToleranceMm: number;
  };
}

export interface NailSurfaceGeometryBundleV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  bundleId: string;
  revision: string;
  surfaceDefinition: NailSurfaceDefinitionV1;
  canonicalGeometry: CanonicalGeometrySnapshotV1;
  representationSet: GeometryRepresentationSetV1;
}

export type GeometryOperationTypeV1 =
  | 'shell_from_surface'
  | 'project_or_conform'
  | 'relief_from_outline'
  | 'place_attachment'
  | 'union'
  | 'subtract'
  | 'intersect'
  | 'validate';

export interface GeometryComponentPolicyV1 {
  empty: 'allow' | 'reject';
  minComponents: number;
  maxComponents: number;
  primaryComponentRequired: boolean;
}

export interface GeometryAttributePolicyV1 {
  uv: 'preserve' | 'allow_degraded' | 'ignore';
  materialGroup: 'preserve' | 'allow_degraded' | 'ignore';
  faceProvenance: 'preserve' | 'allow_degraded' | 'ignore';
}

export interface GeometryTransformV1 {
  translationMm: [number, number, number];
  rotationDeg: [number, number, number];
  scale: [number, number, number];
}

export interface GeometryOperationNodeV1 {
  nodeId: string;
  operation: GeometryOperationTypeV1;
  inputRefs: string[];
  outputRef: string;
  transform: GeometryTransformV1;
  toleranceMm: number;
  componentPolicy: GeometryComponentPolicyV1;
  attributePolicy: GeometryAttributePolicyV1;
  evidenceExpectation: GeometryFidelityV1;
}

export interface GeometryOperationGraphV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  graphId: string;
  revision: string;
  sha256: string;
  nodes: GeometryOperationNodeV1[];
  outputRef: string;
}

export interface GeometryIssueV1 {
  path: string;
  code: GeometryStableErrorCodeV1;
  message: string;
}

export interface GeometryEvaluationRecordV1 {
  schemaVersion: typeof GEOMETRY_CONTRACT_VERSION_V072;
  evaluationId: string;
  graphRef: GeometryVersionedRefV1;
  inputGeometryHashes: string[];
  kernel: { adapterId: string; adapterRevision: string; buildSha256: string };
  toleranceMm: number;
  status: 'succeeded' | 'degraded' | 'failed' | 'cancelled';
  outputGeometryHash?: string;
  outputMetrics?: CanonicalGeometrySnapshotV1['topology'] & {
    volumeMm3: number;
    surfaceAreaMm2: number;
  };
  attributes: CanonicalGeometrySnapshotV1['attributes'];
  warnings: GeometryIssueV1[];
  error?: { code: GeometryStableErrorCodeV1; issues: GeometryIssueV1[] };
  performance: { elapsedMs: number; peakMemoryBytes: number };
  evidence: { fidelity: GeometryFidelityV1; manufacturingValidated: false };
}

export interface GeometryKernelEvaluationOptionsV1 {
  timeoutMs: number;
  memoryLimitBytes: number;
  signal?: AbortSignal;
}

export type GeometryKernelEvaluationResultV1 =
  | { ok: true; output: CanonicalGeometrySnapshotV1; record: GeometryEvaluationRecordV1 }
  | { ok: false; code: GeometryStableErrorCodeV1; record: GeometryEvaluationRecordV1 };

export interface GeometryKernelPortV1 {
  readonly adapterId: string;
  readonly adapterRevision: string;
  evaluate(
    graph: GeometryOperationGraphV1,
    snapshots: readonly CanonicalGeometrySnapshotV1[],
    options: GeometryKernelEvaluationOptionsV1,
  ): Promise<GeometryKernelEvaluationResultV1>;
  dispose(): Promise<void>;
}
