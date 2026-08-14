import * as THREE from 'three';
import createManifoldModule from 'manifold-3d';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolvePromotedGeometryV2 } from './registry-v2';
import { parseVerifiedPromotedGeometryV2 } from './promoted-geometry-parser';
import { resolveNailSurfaceFrameV1, surfaceFrameMatrixV1, type NailSurfaceFrameV1 } from './surface-frame';
import { fromBufferGeometry, inspectParityMesh } from './parity/mesh';
import type { GeometryParityMeshV1, GeometryParityOperationV1, GeometryParityTopologyV1 } from './parity/model';

type ManifoldModule = Awaited<ReturnType<typeof createManifoldModule>>;
let modulePromise: Promise<ManifoldModule> | undefined;

export const SURFACE_BOOLEAN_CONTRACT_V1 = 'nail-surface-boolean-v1' as const;
export const SURFACE_BOOLEAN_KERNEL_V1 = 'manifold-3d/3.5.1' as const;
export const SURFACE_BOOLEAN_TARGET_V1 = { u: 0.69, v: 0.68, embedDepthMm: 0.32 } as const;
export const SURFACE_BOOLEAN_ATTACHMENT_V1 = {
  assetId: 'petal-pearl-lavender-pearl',
  revision: '1.0.0-simulated',
  runtimeUrl: '/assets/glb/components/petal-pearl-bloom/lavender-pearl/lavender-pearl.web.glb',
  sha256: 'c46c39f9ee94cfbcb0f2947e92cce9e8cc9768fff644a31f5833cfaa524de5ca',
  byteLength: 24136,
  manufacturingValidated: false,
} as const;

export interface SurfaceBooleanInputsV1 {
  contract: typeof SURFACE_BOOLEAN_CONTRACT_V1;
  base: GeometryParityMeshV1;
  operand: GeometryParityMeshV1;
  frame: NailSurfaceFrameV1;
  placement: {
    method: 'uv_barycentric_surface_frame';
    embedDepthMm: number;
    matrix: number[];
    fixedZUsed: false;
  };
  evidence: {
    registryEntryId: string;
    baseRepresentationId: string;
    baseArtifactSha256: string;
    baseGeometryHash: string;
    attachmentAssetId: string;
    attachmentArtifactSha256: string;
    fidelity: 'approximate';
    manufacturingValidated: false;
  };
}

export interface SurfaceBooleanOperationResultV1 {
  operation: GeometryParityOperationV1;
  mesh: GeometryParityMeshV1;
  topology: GeometryParityTopologyV1;
  kernelId: typeof SURFACE_BOOLEAN_KERNEL_V1;
  attributes: { uv: 'degraded'; materialGroup: 'degraded'; faceProvenance: 'unavailable' };
}

export interface SurfaceBooleanBundleV1 {
  contract: typeof SURFACE_BOOLEAN_CONTRACT_V1;
  inputs: SurfaceBooleanInputsV1;
  inputTopology: { base: GeometryParityTopologyV1; operand: GeometryParityTopologyV1 };
  results: Record<GeometryParityOperationV1, SurfaceBooleanOperationResultV1>;
  deterministic: Record<GeometryParityOperationV1, boolean>;
  manufacturingValidated: false;
}

export interface SurfaceBooleanAssetReaderV1 {
  bytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

async function parseVerifiedAttachment(bytes: ArrayBuffer): Promise<THREE.BufferGeometry> {
  if (bytes.byteLength !== SURFACE_BOOLEAN_ATTACHMENT_V1.byteLength || await sha256Hex(bytes) !== SURFACE_BOOLEAN_ATTACHMENT_V1.sha256) {
    throw new Error('surface_boolean_attachment_integrity_failed');
  }
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  try {
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    if (meshes.length !== 1) throw new Error('surface_boolean_attachment_mesh_count_mismatch');
    const geometry = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
    if (!geometry.index || !geometry.getAttribute('position')) {
      geometry.dispose();
      throw new Error('surface_boolean_attachment_geometry_invalid');
    }
    return geometry;
  } finally {
    disposeScene(gltf.scene);
  }
}

export async function createSurfaceBooleanInputsFromBytesV1(
  baseBytes: ArrayBuffer,
  attachmentBytes: ArrayBuffer,
): Promise<SurfaceBooleanInputsV1> {
  const promotion = resolvePromotedGeometryV2({ shape: 'almond', length: 'medium', consumer: 'geometry_kernel_preview' });
  if (promotion.status !== 'promoted') throw new Error('surface_boolean_base_not_promoted');
  const baseGeometry = await parseVerifiedPromotedGeometryV2(baseBytes, promotion.delivery);
  const attachmentGeometry = await parseVerifiedAttachment(attachmentBytes);
  try {
    const frame = resolveNailSurfaceFrameV1(baseGeometry, SURFACE_BOOLEAN_TARGET_V1.u, SURFACE_BOOLEAN_TARGET_V1.v);
    if (!frame) throw new Error('surface_boolean_frame_unavailable');
    const placement = surfaceFrameMatrixV1(frame, SURFACE_BOOLEAN_TARGET_V1.embedDepthMm);
    attachmentGeometry.applyMatrix4(placement);
    attachmentGeometry.computeVertexNormals();
    return {
      contract: SURFACE_BOOLEAN_CONTRACT_V1,
      base: fromBufferGeometry(baseGeometry, {
        sourceId: promotion.entry.geometrySnapshotRef.id,
        revision: promotion.entry.geometrySnapshotRef.revision,
        sha256: promotion.entry.geometrySnapshotRef.sha256,
      }),
      operand: fromBufferGeometry(attachmentGeometry, {
        sourceId: SURFACE_BOOLEAN_ATTACHMENT_V1.assetId,
        revision: SURFACE_BOOLEAN_ATTACHMENT_V1.revision,
        sha256: SURFACE_BOOLEAN_ATTACHMENT_V1.sha256,
      }),
      frame,
      placement: {
        method: 'uv_barycentric_surface_frame',
        embedDepthMm: SURFACE_BOOLEAN_TARGET_V1.embedDepthMm,
        matrix: placement.toArray(),
        fixedZUsed: false,
      },
      evidence: {
        registryEntryId: promotion.entry.registryEntryId,
        baseRepresentationId: promotion.delivery.representationId,
        baseArtifactSha256: promotion.delivery.sha256,
        baseGeometryHash: promotion.entry.geometrySnapshotRef.sha256,
        attachmentAssetId: SURFACE_BOOLEAN_ATTACHMENT_V1.assetId,
        attachmentArtifactSha256: SURFACE_BOOLEAN_ATTACHMENT_V1.sha256,
        fidelity: 'approximate',
        manufacturingValidated: false,
      },
    };
  } finally {
    baseGeometry.dispose();
    attachmentGeometry.dispose();
  }
}

export function createBrowserSurfaceBooleanAssetReaderV1(): SurfaceBooleanAssetReaderV1 {
  return {
    async bytes(url, signal) {
      const response = await fetch(url, { cache: 'no-store', signal });
      if (!response.ok) throw new Error(`surface_boolean_fetch_failed:${response.status}`);
      return response.arrayBuffer();
    },
  };
}

export async function loadSurfaceBooleanInputsV1(
  reader: SurfaceBooleanAssetReaderV1,
  signal?: AbortSignal,
): Promise<SurfaceBooleanInputsV1> {
  const promotion = resolvePromotedGeometryV2({ shape: 'almond', length: 'medium', consumer: 'geometry_kernel_preview' });
  if (promotion.status !== 'promoted') throw new Error('surface_boolean_base_not_promoted');
  const [baseBytes, attachmentBytes] = await Promise.all([
    reader.bytes(promotion.delivery.runtimeUrl, signal),
    reader.bytes(SURFACE_BOOLEAN_ATTACHMENT_V1.runtimeUrl, signal),
  ]);
  return createSurfaceBooleanInputsFromBytesV1(baseBytes, attachmentBytes);
}

async function getModule(wasmUrl?: string): Promise<ManifoldModule> {
  modulePromise ??= createManifoldModule(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then((module) => {
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

async function evaluateOperation(
  module: ManifoldModule,
  inputs: SurfaceBooleanInputsV1,
  operation: GeometryParityOperationV1,
): Promise<SurfaceBooleanOperationResultV1> {
  const left = new module.Manifold(toManifoldMesh(module, inputs.base));
  const right = new module.Manifold(toManifoldMesh(module, inputs.operand));
  let result: ReturnType<InstanceType<ManifoldModule['Manifold']>['add']> | undefined;
  try {
    result = operation === 'union' ? left.add(right) : operation === 'subtract' ? left.subtract(right) : left.intersect(right);
    const output = result.getMesh();
    const positions: number[] = [];
    for (let vertex = 0; vertex < output.numVert; vertex += 1) positions.push(...Array.from(output.position(vertex), Number));
    const mesh: GeometryParityMeshV1 = {
      positions,
      indices: Array.from(output.triVerts, Number),
      provenance: {
        sourceId: `surface-boolean:${operation}`,
        revision: SURFACE_BOOLEAN_KERNEL_V1,
        sha256: inputs.evidence.baseGeometryHash,
      },
    };
    return {
      operation,
      mesh,
      topology: await inspectParityMesh(mesh),
      kernelId: SURFACE_BOOLEAN_KERNEL_V1,
      attributes: { uv: 'degraded', materialGroup: 'degraded', faceProvenance: 'unavailable' },
    };
  } finally {
    result?.delete();
    left.delete();
    right.delete();
  }
}

function assertClosedResult(label: string, topology: GeometryParityTopologyV1): void {
  if (topology.componentCount !== 1
    || topology.boundaryEdgeCount !== 0
    || topology.nonManifoldEdgeCount !== 0
    || topology.degenerateTriangleCount !== 0
    || !Number.isFinite(topology.signedVolumeMm3)
    || Math.abs(topology.signedVolumeMm3) <= 1e-6) {
    throw new Error(`${label}_topology_invalid`);
  }
}

export async function evaluateSurfaceBooleanV1(
  inputs: SurfaceBooleanInputsV1,
  options: { wasmUrl?: string } = {},
): Promise<SurfaceBooleanBundleV1> {
  const module = await getModule(options.wasmUrl);
  const [baseTopology, operandTopology] = await Promise.all([
    inspectParityMesh(inputs.base),
    inspectParityMesh(inputs.operand),
  ]);
  assertClosedResult('base', baseTopology);
  assertClosedResult('operand', operandTopology);
  const operations = ['union', 'subtract', 'intersect'] as const;
  const first = await Promise.all(operations.map((operation) => evaluateOperation(module, inputs, operation)));
  const repeat = await Promise.all(operations.map((operation) => evaluateOperation(module, inputs, operation)));
  const results = Object.fromEntries(first.map((result) => [result.operation, result])) as SurfaceBooleanBundleV1['results'];
  const deterministic = Object.fromEntries(operations.map((operation, index) => [
    operation,
    first[index].topology.geometryHash === repeat[index].topology.geometryHash
      && first[index].topology.triangleCount === repeat[index].topology.triangleCount,
  ])) as SurfaceBooleanBundleV1['deterministic'];
  for (const operation of operations) {
    assertClosedResult(operation, results[operation].topology);
    if (!deterministic[operation]) throw new Error(`${operation}_not_deterministic`);
    if (results[operation].topology.geometryHash === baseTopology.geometryHash) throw new Error(`${operation}_did_not_change_topology`);
  }
  const volume = (value: GeometryParityTopologyV1) => Math.abs(value.signedVolumeMm3);
  const overlap = volume(results.intersect.topology);
  const expectedUnion = volume(baseTopology) + volume(operandTopology) - overlap;
  const expectedSubtract = volume(baseTopology) - overlap;
  if (Math.abs(volume(results.union.topology) - expectedUnion) > Math.max(0.02, expectedUnion * 0.001)) throw new Error('union_volume_identity_failed');
  if (Math.abs(volume(results.subtract.topology) - expectedSubtract) > Math.max(0.02, expectedSubtract * 0.001)) throw new Error('subtract_volume_identity_failed');
  return {
    contract: SURFACE_BOOLEAN_CONTRACT_V1,
    inputs: structuredClone(inputs),
    inputTopology: { base: baseTopology, operand: operandTopology },
    results,
    deterministic,
    manufacturingValidated: false,
  };
}
