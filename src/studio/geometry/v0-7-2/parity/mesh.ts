import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GeometryParityMeshV1, GeometryParityTopologyV1 } from './model';

const QUANTIZATION = 100_000;
const quantized = (value: number) => Math.round(value * QUANTIZATION) / QUANTIZATION;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function toPositionOnlyGeometry(mesh: GeometryParityMeshV1): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setIndex(mesh.indices);
  const welded = mergeVertices(geometry, 1 / QUANTIZATION);
  geometry.dispose();
  welded.computeVertexNormals();
  return welded;
}

export function fromBufferGeometry(
  source: THREE.BufferGeometry,
  provenance: GeometryParityMeshV1['provenance'],
): GeometryParityMeshV1 {
  const positionOnly = new THREE.BufferGeometry();
  positionOnly.setAttribute('position', source.getAttribute('position').clone());
  if (source.index) positionOnly.setIndex(source.index.clone());
  const geometry = mergeVertices(positionOnly, 1 / QUANTIZATION);
  positionOnly.dispose();
  const position = geometry.getAttribute('position');
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, index) => index);
  const positions = Array.from({ length: position.count }, (_, index) => [
    position.getX(index), position.getY(index), position.getZ(index),
  ]).flat();
  geometry.dispose();
  return { positions, indices, provenance };
}

export async function inspectParityMesh(mesh: GeometryParityMeshV1): Promise<GeometryParityTopologyV1> {
  const geometry = toPositionOnlyGeometry(mesh);
  const position = geometry.getAttribute('position');
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, index) => index);
  const edges = new Map<string, Array<{ triangle: number }>>();
  const adjacency = Array.from({ length: indices.length / 3 }, () => [] as number[]);
  const triangleKeys: string[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();
  const volumeCross = new THREE.Vector3();
  let signedVolumeMm3 = 0;
  let surfaceAreaMm2 = 0;
  let degenerateTriangleCount = 0;
  const vertexKey = (index: number) => [position.getX(index), position.getY(index), position.getZ(index)]
    .map(quantized).join(',');

  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = offset / 3;
    const raw = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const keys = raw.map(vertexKey);
    triangleKeys.push([...keys].sort().join('|'));
    a.fromBufferAttribute(position, raw[0]);
    b.fromBufferAttribute(position, raw[1]);
    c.fromBufferAttribute(position, raw[2]);
    cross.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const doubleArea = cross.length();
    if (!Number.isFinite(doubleArea) || doubleArea <= 1e-10) degenerateTriangleCount += 1;
    surfaceAreaMm2 += doubleArea / 2;
    signedVolumeMm3 += a.dot(volumeCross.crossVectors(b, c)) / 6;
    for (const [left, right] of [[keys[0], keys[1]], [keys[1], keys[2]], [keys[2], keys[0]]]) {
      const key = left < right ? `${left}|${right}` : `${right}|${left}`;
      const incidents = edges.get(key) ?? [];
      for (const incident of incidents) {
        adjacency[triangle].push(incident.triangle);
        adjacency[incident.triangle].push(triangle);
      }
      incidents.push({ triangle });
      edges.set(key, incidents);
    }
  }

  let componentCount = 0;
  const visited = new Set<number>();
  for (let start = 0; start < adjacency.length; start += 1) {
    if (visited.has(start)) continue;
    componentCount += 1;
    const pending = [start];
    visited.add(start);
    while (pending.length) {
      const current = pending.pop()!;
      for (const next of adjacency[current]) if (!visited.has(next)) {
        visited.add(next);
        pending.push(next);
      }
    }
  }

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error('mesh has no finite bounds');
  const output: GeometryParityTopologyV1 = {
    vertexCount: position.count,
    triangleCount: indices.length / 3,
    componentCount,
    boundaryEdgeCount: [...edges.values()].filter((incidents) => incidents.length === 1).length,
    nonManifoldEdgeCount: [...edges.values()].filter((incidents) => incidents.length > 2).length,
    degenerateTriangleCount,
    boundsMm: {
      min: [quantized(bounds.min.x), quantized(bounds.min.y), quantized(bounds.min.z)],
      max: [quantized(bounds.max.x), quantized(bounds.max.y), quantized(bounds.max.z)],
    },
    signedVolumeMm3: quantized(signedVolumeMm3),
    surfaceAreaMm2: quantized(surfaceAreaMm2),
    geometryHash: await sha256([...triangleKeys].sort().join('\n')),
  };
  geometry.dispose();
  return output;
}

export function createParityFixture(operation: 'union' | 'subtract' | 'intersect') {
  const leftGeometry = new THREE.BoxGeometry(10, 18, 3);
  leftGeometry.translate(0, -8, 0);
  const rightGeometry = new THREE.SphereGeometry(3.2, 32, 20);
  rightGeometry.translate(2.2, -7, 0.8);
  const left = fromBufferGeometry(leftGeometry, {
    sourceId: 'parity-base-closed-box', revision: '1', sha256: 'a'.repeat(64),
  });
  const right = fromBufferGeometry(rightGeometry, {
    sourceId: 'parity-attachment-closed-sphere', revision: '1', sha256: 'b'.repeat(64),
  });
  leftGeometry.dispose();
  rightGeometry.dispose();
  return {
    contract: 'geometry-kernel-parity-v1' as const,
    caseId: `closed-overlap-${operation}-v1`, operation, left, right,
    toleranceMm: 0.02, attributePolicy: 'allow_degraded' as const,
  };
}
