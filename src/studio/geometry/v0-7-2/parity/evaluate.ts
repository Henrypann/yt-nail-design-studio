import type { GeometryParityCaseV1, GeometryParityComparisonV1 } from './model';
import { evaluateCurrentKernelParity } from './current-kernel';
import { evaluateManifoldKernelParity } from './manifold-kernel';

const relativeDelta = (left: number, right: number) => Math.abs(left - right)
  / Math.max(Math.abs(left), Math.abs(right), Number.EPSILON);

function maxBoundsDelta(
  left: GeometryParityComparisonV1['current']['topology']['boundsMm'],
  right: GeometryParityComparisonV1['current']['topology']['boundsMm'],
): number {
  return Math.max(
    ...left.min.map((value, index) => Math.abs(value - right.min[index])),
    ...left.max.map((value, index) => Math.abs(value - right.max[index])),
  );
}

function validClosedSingle(result: GeometryParityComparisonV1['current']): boolean {
  return result.topology.componentCount === 1
    && result.topology.boundaryEdgeCount === 0
    && result.topology.nonManifoldEdgeCount === 0
    && result.topology.degenerateTriangleCount === 0
    && Math.abs(result.topology.signedVolumeMm3) > 0;
}

export async function evaluateGeometryKernelParityV1(
  testCase: GeometryParityCaseV1,
): Promise<GeometryParityComparisonV1> {
  const [current, candidate] = await Promise.all([
    evaluateCurrentKernelParity(testCase),
    evaluateManifoldKernelParity(testCase),
  ]);
  const bothClosedSingleComponents = validClosedSingle(current) && validClosedSingle(candidate);
  const relativeVolumeDelta = relativeDelta(
    Math.abs(current.topology.signedVolumeMm3),
    Math.abs(candidate.topology.signedVolumeMm3),
  );
  const boundsDelta = maxBoundsDelta(current.topology.boundsMm, candidate.topology.boundsMm);
  const attributeConclusion = JSON.stringify(current.attributes) === JSON.stringify(candidate.attributes)
    ? 'equivalent_degraded' as const
    : 'incompatible' as const;
  const currentValid = validClosedSingle(current);
  const candidateValid = validClosedSingle(candidate);
  const withinTolerance = relativeVolumeDelta <= 0.01 && boundsDelta <= testCase.toleranceMm;
  const decision = currentValid && candidateValid && withinTolerance
    ? 'equivalent' as const
    : !currentValid && candidateValid
      ? 'candidate_preferred' as const
      : 'inconclusive' as const;
  return {
    caseId: testCase.caseId,
    operation: testCase.operation,
    current,
    candidate,
    comparison: {
      bothClosedSingleComponents,
      relativeVolumeDelta,
      maxBoundsDeltaMm: boundsDelta,
      attributeConclusion,
      decision,
      accepted: decision === 'equivalent'
        && attributeConclusion === 'equivalent_degraded',
    },
  };
}
