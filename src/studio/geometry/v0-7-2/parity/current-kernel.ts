import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import type { GeometryParityCaseV1, GeometryParityKernelResultV1 } from './model';
import { fromBufferGeometry, inspectParityMesh, toPositionOnlyGeometry } from './mesh';

const OPERATION = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION } as const;

export async function evaluateCurrentKernelParity(
  testCase: GeometryParityCaseV1,
): Promise<GeometryParityKernelResultV1> {
  const started = performance.now();
  const left = new Brush(toPositionOnlyGeometry(testCase.left));
  const right = new Brush(toPositionOnlyGeometry(testCase.right));
  left.updateMatrixWorld(true);
  right.updateMatrixWorld(true);
  const evaluator = new Evaluator();
  evaluator.attributes = ['position'];
  evaluator.useGroups = false;
  (evaluator as Evaluator & { useCDTClipping: boolean }).useCDTClipping = true;
  let result: Brush | undefined;
  try {
    result = evaluator.evaluate(left, right, OPERATION[testCase.operation]);
    const mesh = fromBufferGeometry(result.geometry, {
      sourceId: `three-bvh-csg:${testCase.caseId}`,
      revision: '0.0.18',
      sha256: 'c'.repeat(64),
    });
    return {
      kernelId: 'three-bvh-csg/0.0.18',
      operation: testCase.operation,
      topology: await inspectParityMesh(mesh),
      attributes: { uv: 'degraded', materialGroup: 'degraded', faceProvenance: 'unavailable' },
      elapsedMs: performance.now() - started,
    };
  } finally {
    result?.geometry.dispose();
    left.geometry.dispose();
    right.geometry.dispose();
  }
}
