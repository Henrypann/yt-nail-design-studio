import createManifoldModule from 'manifold-3d';
import type { GeometryParityCaseV1, GeometryParityKernelResultV1, GeometryParityMeshV1 } from './model';
import { inspectParityMesh } from './mesh';

type ManifoldModule = Awaited<ReturnType<typeof createManifoldModule>>;
let modulePromise: Promise<ManifoldModule> | undefined;

async function getModule(): Promise<ManifoldModule> {
  modulePromise ??= createManifoldModule().then((module) => {
    module.setup();
    return module;
  });
  return modulePromise;
}

function toManifoldMesh(module: ManifoldModule, mesh: GeometryParityMeshV1) {
  return new module.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(mesh.positions),
    triVerts: new Uint32Array(mesh.indices),
    tolerance: 1e-5,
  });
}

export async function evaluateManifoldKernelParity(
  testCase: GeometryParityCaseV1,
): Promise<GeometryParityKernelResultV1> {
  const started = performance.now();
  const module = await getModule();
  const left = new module.Manifold(toManifoldMesh(module, testCase.left));
  const right = new module.Manifold(toManifoldMesh(module, testCase.right));
  let result: ReturnType<InstanceType<ManifoldModule['Manifold']>['add']> | undefined;
  try {
    result = testCase.operation === 'union'
      ? left.add(right)
      : testCase.operation === 'subtract'
        ? left.subtract(right)
        : left.intersect(right);
    const output = result.getMesh();
    const positions: number[] = [];
    for (let vertex = 0; vertex < output.numVert; vertex += 1) {
      positions.push(...Array.from(output.position(vertex), Number));
    }
    const mesh: GeometryParityMeshV1 = {
      positions,
      indices: Array.from(output.triVerts, Number),
      provenance: {
        sourceId: `manifold-3d:${testCase.caseId}`,
        revision: '3.5.1',
        sha256: 'd'.repeat(64),
      },
    };
    return {
      kernelId: 'manifold-3d/3.5.1',
      operation: testCase.operation,
      topology: await inspectParityMesh(mesh),
      attributes: { uv: 'degraded', materialGroup: 'degraded', faceProvenance: 'unavailable' },
      elapsedMs: performance.now() - started,
    };
  } finally {
    result?.delete();
    left.delete();
    right.delete();
  }
}
