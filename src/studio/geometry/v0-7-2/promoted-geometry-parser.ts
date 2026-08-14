import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GeometryBrowserDeliveryV2 } from './registry-v2';

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function disposeLoadedScene(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

/** Parse an immutable Registry V2 delivery after byte and GLB structure checks. */
export async function parseVerifiedPromotedGeometryV2(
  bytes: ArrayBuffer,
  delivery: GeometryBrowserDeliveryV2,
): Promise<THREE.BufferGeometry> {
  if (bytes.byteLength !== delivery.byteLength || await sha256Hex(bytes) !== delivery.sha256) {
    throw new Error('promoted_geometry_integrity_failed');
  }
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  try {
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    if (meshes.length !== 1) throw new Error('promoted_geometry_mesh_count_mismatch');
    const source = meshes[0].geometry;
    if (!source.index || !source.getAttribute('position') || !source.getAttribute('normal') || !source.getAttribute('uv')) {
      throw new Error('promoted_geometry_attributes_missing');
    }
    if (source.index.count / 3 !== delivery.triangleCount) throw new Error('promoted_geometry_triangle_count_mismatch');
    if (!meshes[0].matrixWorld.equals(new THREE.Matrix4())) throw new Error('promoted_geometry_transform_not_identity');
    return source.clone();
  } finally {
    disposeLoadedScene(gltf.scene);
  }
}
