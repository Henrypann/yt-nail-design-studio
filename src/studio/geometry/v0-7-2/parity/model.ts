import type { GeometryAttributeStateV1 } from '../model';

export const GEOMETRY_PARITY_CONTRACT_V1 = 'geometry-kernel-parity-v1' as const;
export type GeometryParityOperationV1 = 'union' | 'subtract' | 'intersect';
export type GeometryParityKernelIdV1 = 'three-bvh-csg/0.0.18' | 'manifold-3d/3.5.1';

export interface GeometryParityMeshV1 {
  positions: number[];
  indices: number[];
  uv?: number[];
  materialGroups?: number[];
  provenance: { sourceId: string; revision: string; sha256: string };
}

export interface GeometryParityCaseV1 {
  contract: typeof GEOMETRY_PARITY_CONTRACT_V1;
  caseId: string;
  operation: GeometryParityOperationV1;
  left: GeometryParityMeshV1;
  right: GeometryParityMeshV1;
  toleranceMm: number;
  attributePolicy: 'allow_degraded';
}

export interface GeometryParityTopologyV1 {
  vertexCount: number;
  triangleCount: number;
  componentCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  degenerateTriangleCount: number;
  boundsMm: { min: [number, number, number]; max: [number, number, number] };
  signedVolumeMm3: number;
  surfaceAreaMm2: number;
  geometryHash: string;
}

export interface GeometryParityKernelResultV1 {
  kernelId: GeometryParityKernelIdV1;
  operation: GeometryParityOperationV1;
  topology: GeometryParityTopologyV1;
  attributes: {
    uv: GeometryAttributeStateV1;
    materialGroup: GeometryAttributeStateV1;
    faceProvenance: GeometryAttributeStateV1;
  };
  elapsedMs: number;
}

export interface GeometryParityComparisonV1 {
  caseId: string;
  operation: GeometryParityOperationV1;
  current: GeometryParityKernelResultV1;
  candidate: GeometryParityKernelResultV1;
  comparison: {
    bothClosedSingleComponents: boolean;
    relativeVolumeDelta: number;
    maxBoundsDeltaMm: number;
    attributeConclusion: 'equivalent_degraded' | 'incompatible';
    decision: 'equivalent' | 'candidate_preferred' | 'inconclusive';
    accepted: boolean;
  };
}

export type GeometryParityWorkerRequestV1 =
  | { type: 'evaluate'; requestId: string; testCase: GeometryParityCaseV1 }
  | { type: 'cancel'; requestId: string };

export type GeometryParityWorkerResponseV1 =
  | { type: 'result'; requestId: string; result: GeometryParityComparisonV1 }
  | { type: 'error'; requestId: string; code: 'cancelled' | 'kernel_unavailable' | 'invalid_topology'; message: string };
