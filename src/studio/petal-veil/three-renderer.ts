import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FingerCode } from '@/lib/types';
import { fingerDisplayRatio, fingerDisplayScale } from '@/studio/finger-display';
import type { NailAppearanceModel } from './appearance';

export type PetalVeilSceneMode = 'single' | 'tiled' | 'presentation';

const FINGER_POSITIONS: Record<FingerCode, [number, number]> = {
  L1: [-4.4, 1.65], L2: [-2.25, 1.65], L3: [0, 1.65], L4: [2.25, 1.65], L5: [4.4, 1.65],
  R1: [-4.4, -1.65], R2: [-2.25, -1.65], R3: [0, -1.65], R4: [2.25, -1.65], R5: [4.4, -1.65],
};

function buildNailGeometry(vStart = 0, vEnd = 1, zOffset = 0): THREE.BufferGeometry {
  const xSegments = 28;
  const ySegments = Math.max(4, Math.round(44 * (vEnd - vStart)));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= ySegments; iy += 1) {
    const localV = iy / ySegments;
    const v = vStart + (vEnd - vStart) * localV;
    const halfWidth = 0.49 * (0.18 + 0.82 * Math.sin(Math.PI * (0.05 + 0.75 * v)));
    for (let ix = 0; ix <= xSegments; ix += 1) {
      const u = ix / xSegments;
      const nx = u * 2 - 1;
      const x = nx * halfWidth;
      const y = 1.45 - v * 2.9;
      const dome = 0.3 * Math.max(0, 1 - nx * nx) * (0.72 + 0.28 * Math.sin(Math.PI * v));
      positions.push(x, y, dome + zOffset);
      uvs.push(u, v);
    }
  }
  const row = xSegments + 1;
  for (let iy = 0; iy < ySegments; iy += 1) {
    for (let ix = 0; ix < xSegments; ix += 1) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row + 1;
      const d = a + row;
      indices.push(a, d, b, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const NAIL_GEOMETRY = buildNailGeometry();

function createFrenchMaskTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('法式 UV mask 初始化失败');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#FFFFFF';
  context.beginPath();
  context.moveTo(0, 0);
  for (let x = 0; x <= canvas.width; x += 2) {
    const u = x / canvas.width;
    const nx = u * 2 - 1;
    // Signature 三点微笑线：中心 v=.10，两侧 v=.34。
    const boundaryV = 0.1 + 0.24 * Math.pow(Math.abs(nx), 1.8);
    context.lineTo(x, boundaryV * canvas.height);
  }
  context.lineTo(canvas.width, 0);
  context.closePath();
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeFlower(model: NailAppearanceModel): THREE.Group | null {
  const flower = model.relief[0];
  if (!flower) return null;
  const group = new THREE.Group();
  const petalGeometry = new THREE.SphereGeometry(0.19, 28, 18);
  const petalMaterial = new THREE.MeshPhysicalMaterial({
    color: flower.color,
    roughness: 0.28,
    clearcoat: 0.82,
    clearcoatRoughness: 0.2,
  });
  for (let index = 0; index < flower.petals; index += 1) {
    const angle = THREE.MathUtils.degToRad(flower.rotationDeg + index * (360 / flower.petals));
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.scale.set(0.7, 1.25, 0.34);
    petal.position.set(Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0.04);
    petal.rotation.z = angle - Math.PI / 2;
    petal.castShadow = true;
    petal.receiveShadow = true;
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 24, 16),
    new THREE.MeshPhysicalMaterial({
      color: flower.centerColor,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  center.scale.z = 0.6;
  center.position.z = 0.08;
  center.castShadow = true;
  group.add(center);

  const u = flower.uv.u;
  const v = flower.uv.v;
  const halfWidth = 0.49 * (0.18 + 0.82 * Math.sin(Math.PI * (0.05 + 0.75 * v)));
  const nx = u * 2 - 1;
  group.position.set(nx * halfWidth, 1.45 - v * 2.9, 0.3 * Math.max(0, 1 - nx * nx) + 0.11);
  group.scale.setScalar(0.9);
  return group;
}

function makeNail(model: NailAppearanceModel): THREE.Group {
  const group = new THREE.Group();
  const nailMaterial = new THREE.MeshPhysicalMaterial({
    color: model.base.color,
    transparent: true,
    opacity: model.base.opacity,
    roughness: model.material.roughness,
    clearcoat: model.material.clearcoat,
    clearcoatRoughness: model.material.clearcoatRoughness,
    transmission: model.material.transmission,
    thickness: 0.16,
    side: THREE.DoubleSide,
  });
  const nail = new THREE.Mesh(NAIL_GEOMETRY.clone(), nailMaterial);
  nail.castShadow = true;
  nail.receiveShadow = true;
  group.add(nail);
  const thinEdge = new THREE.Mesh(
    NAIL_GEOMETRY.clone(),
    new THREE.MeshPhysicalMaterial({
      color: '#BFA79C',
      roughness: 0.46,
      clearcoat: 0.4,
      side: THREE.BackSide,
    }),
  );
  thinEdge.position.z = -0.045;
  thinEdge.scale.set(1.018, 1.012, 1);
  thinEdge.receiveShadow = true;
  group.add(thinEdge);

  const frenchMask = createFrenchMaskTexture();
  const french = new THREE.Mesh(
    NAIL_GEOMETRY.clone(),
    new THREE.MeshPhysicalMaterial({
      color: model.french.color,
      transparent: true,
      opacity: model.french.opacity,
      alphaMap: frenchMask,
      alphaTest: 0.02,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  french.position.z = 0.018;
  french.castShadow = true;
  group.add(french);

  const flower = makeFlower(model);
  if (flower) group.add(flower);
  group.userData = {
    finger: model.finger,
    appearanceChecksum: model.appearanceChecksum,
    rendererId: model.rendererId,
  };
  return group;
}

function configureRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export class PetalVeilRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 50);
  private readonly mode: PetalVeilSceneMode;

  constructor(canvas: HTMLCanvasElement, models: NailAppearanceModel[], mode: PetalVeilSceneMode) {
    this.mode = mode;
    this.renderer = configureRenderer(canvas);
    this.scene.background = new THREE.Color('#D8D0CA');
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment).texture;
    this.scene.environmentIntensity = 0.55;
    environment.dispose();
    pmrem.dispose();

    const key = new THREE.DirectionalLight('#FFF8EE', 1.6);
    key.position.set(-4, 6, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#EBD9D2', 0.5);
    fill.position.set(5, -2, 5);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight('#FFF9F0', '#BCA9A2', 0.6));

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({ color: '#D8D0CA' }),
    );
    floor.position.z = -0.35;
    floor.receiveShadow = true;
    this.scene.add(floor);

    if (mode === 'single') {
      const model = models[0];
      const nail = makeNail(model);
      nail.scale.setScalar(1.72);
      nail.rotation.x = -0.12;
      nail.rotation.y = -0.08;
      this.scene.add(nail);
      this.camera.left = -2;
      this.camera.right = 2;
      this.camera.top = 3.15;
      this.camera.bottom = -3.15;
    } else {
      models.forEach((model) => {
        const nail = makeNail(model);
        const [x, y] = FINGER_POSITIONS[model.finger];
        const scale = 0.88 * fingerDisplayScale(model.finger);
        nail.position.set(x, y, 0);
        nail.scale.set(scale * fingerDisplayRatio(model.finger), scale, scale);
        nail.rotation.x = -0.08;
        nail.rotation.y = x * -0.012;
        this.scene.add(nail);
      });
      if (mode === 'presentation') {
        this.camera.left = -6.4;
        this.camera.right = 6.4;
        this.camera.top = 4.15;
        this.camera.bottom = -4.15;
      }
    }
    this.camera.position.set(0, -2.1, 12);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(safeWidth, safeHeight, false);
    const aspect = safeWidth / safeHeight;
    const vertical = this.mode === 'single' ? 3.15 : this.mode === 'presentation' ? 4.35 : 4;
    this.camera.left = -vertical * aspect;
    this.camera.right = vertical * aspect;
    this.camera.top = vertical;
    this.camera.bottom = -vertical;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  async renderPng(width = 2400, height = 1600): Promise<Blob> {
    const target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
    });
    const previousTarget = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene, this.camera);
      const pixels = new Uint8Array(width * height * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const flipped = new Uint8ClampedArray(pixels.length);
      const stride = width * 4;
      for (let y = 0; y < height; y += 1) {
        flipped.set(pixels.subarray(y * stride, (y + 1) * stride), (height - y - 1) * stride);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('HQ PNG 画布初始化失败');
      context.putImageData(new ImageData(flipped, width, height), 0, 0);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('HQ PNG 编码失败'))),
          'image/png',
        );
      });
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      target.dispose();
      this.render();
    }
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if ('alphaMap' in material) material.alphaMap?.dispose();
          material.dispose();
        });
      }
    });
    this.renderer.dispose();
  }
}

export function supportsPetalVeilWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
