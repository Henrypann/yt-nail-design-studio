import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { EditorDocV7, NailDesignV7, ProcessStepV7, RecipeInstanceV7 } from '@/studio/editor/v7/model';
import type { CustomerNailPreviewReadModelV7 } from '@/studio/editor/v7/customer-preview';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import { resolvePromotedGeometryV2 } from '@/studio/geometry/v0-7-2/registry-v2';
import { resolveNailSurfaceFrameV1, surfaceFrameMatrixV1 } from '@/studio/geometry/v0-7-2/surface-frame';
import { GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1 } from './fixtures';
import { resolveDimensionalGlbSourceV072 } from './dimensional-glb';
import { createSingleNailMaterialProjectionV1, type SingleNailMaterialProjectionV1 } from './material-projection';
import { loadPromotedGeometryV2 } from './promoted-geometry-loader';
import {
  resolveRenderTextureAssetSetV1,
  type RenderTextureMapRefV1,
} from './texture-map-assets';

const CAMERA_LABEL = {
  surface: 'render.camera.surface', oblique_left: 'render.camera.obliqueLeft', oblique_right: 'render.camera.obliqueRight', side_profile: 'render.camera.sideProfile', tip_grazing: 'render.camera.tipGrazing',
} as const;
type CameraId = keyof typeof CAMERA_LABEL;

interface SingleNailPbrRuntimeV072 {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bounds: THREE.Box3;
  host: HTMLDivElement;
}

interface DimensionalRenderResultV072 {
  root: THREE.Group;
  renderedCount: number;
  fallbackAssetIds: string[];
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function loadVerifiedImage(ref: RenderTextureMapRefV1): Promise<HTMLImageElement> {
  const response = await fetch(ref.runtimeUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`render_texture_fetch_failed:${ref.assetId}`);
  const bytes = await response.arrayBuffer();
  if (await sha256Hex(bytes) !== ref.sha256) throw new Error(`render_texture_integrity_failed:${ref.assetId}`);
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: ref.mimeType }));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`render_texture_decode_failed:${ref.assetId}`));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return image;
}

async function createMaterialTexture(
  projection: SingleNailMaterialProjectionV1,
  decal: RenderTextureMapRefV1 | null,
): Promise<THREE.CanvasTexture> {
  const image = new Image();
  const objectUrl = URL.createObjectURL(new Blob([projection.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('material_projection_decode_failed'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  const canvas = document.createElement('canvas');
  canvas.width = projection.widthPx;
  canvas.height = projection.heightPx;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('material_projection_canvas_unavailable');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (decal) context.drawImage(await loadVerifiedImage(decal), 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = projection.projectionHash;
  texture.colorSpace = THREE.SRGBColorSpace;
  // The projection canvas already stores canonical v=0 at the nail tip.
  // Disabling upload flip keeps the generated surface UV and source rows aligned.
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

async function createVerifiedLinearTexture(ref: RenderTextureMapRefV1): Promise<THREE.CanvasTexture> {
  const image = await loadVerifiedImage(ref);
  const canvas = document.createElement('canvas');
  canvas.width = ref.widthPx;
  canvas.height = ref.heightPx;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`render_texture_canvas_unavailable:${ref.assetId}`);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `${ref.assetId}@${ref.revision}`;
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

const glbBufferCache = new Map<string, ArrayBuffer>();

async function fetchVerifiedGlbBytes(url: string, expectedSha256: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const cacheKey = `${url}#${expectedSha256}`;
  const cached = glbBufferCache.get(cacheKey);
  if (cached) return cached;
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`render_glb_fetch_failed:${url}`);
  const bytes = await response.arrayBuffer();
  const hash = await sha256Hex(bytes);
  if (hash !== expectedSha256) {
    throw new Error(`render_glb_integrity_failed:${url}`);
  }
  glbBufferCache.set(cacheKey, bytes);
  return bytes;
}

async function renderDimensionalDecorationsV072(
  nail: NailDesignV7,
  geometry: THREE.BufferGeometry,
  signal?: AbortSignal,
): Promise<DimensionalRenderResultV072> {
  const dimensionalSteps = nail.steps.filter(
    (step): step is Extract<ProcessStepV7, { kind: 'dimensional_decoration' }> =>
      step.kind === 'dimensional_decoration' && step.visible && !step.skipped,
  );

  const gltfLoader = new GLTFLoader();
  const root = new THREE.Group();
  root.name = `decorations.${nail.finger}`;
  let renderedCount = 0;
  const fallbackAssetIds: string[] = [];

  for (const step of dimensionalSteps) {
    for (const decoration of step.decorations) {
      if (!decoration.visible) continue;

      if (decoration.kind === 'attachment_3d') {
        const anchorU = decoration.anchor?.u ?? decoration.transform.position.u;
        const anchorV = decoration.anchor?.v ?? decoration.transform.position.v;
        const frame = resolveNailSurfaceFrameV1(geometry, anchorU, anchorV);
        if (!frame) continue;

        const source = resolveDimensionalGlbSourceV072(decoration.asset);
        if (!source.ok) {
          fallbackAssetIds.push(`${decoration.asset.assetId}:${source.reason}`);
          continue;
        }

        try {
          const bytes = await fetchVerifiedGlbBytes(source.url, source.sha256, signal);
          const gltf = await gltfLoader.parseAsync(bytes.slice(0), '');
          signal?.throwIfAborted();
          const container = new THREE.Group();
          const placement = surfaceFrameMatrixV1(frame, 0.02);
          container.applyMatrix4(placement);

          const rotRad = THREE.MathUtils.degToRad(decoration.transform.rotationDeg || 0);
          const scaleX = decoration.transform.scaleX || 1;
          const scaleY = decoration.transform.scaleY || 1;
          const scaleZ = Math.max(0.5, (scaleX + scaleY) / 2);

          const model = gltf.scene;
          model.rotation.z = rotRad;
          model.scale.set(scaleX, scaleY, scaleZ);
          container.add(model);
          root.add(container);
          renderedCount += 1;
        } catch (error) {
          if (signal?.aborted) throw error;
          fallbackAssetIds.push(`${decoration.asset.assetId}:load_failed`);
          console.warn('Failed to load attachment_3d:', decoration.asset.assetId, error);
        }
      } else if (decoration.kind === 'relief_2_5d') {
        const u = decoration.transform.position.u;
        const v = decoration.transform.position.v;
        const frame = resolveNailSurfaceFrameV1(geometry, u, v);
        if (!frame) continue;

        const placement = surfaceFrameMatrixV1(frame, 0.01);
        const container = new THREE.Group();
        container.applyMatrix4(placement);

        const isGold = decoration.materialRef?.materialId?.includes('gold');
        const isPearl = decoration.materialRef?.materialId?.includes('pearl');

        const beadGeom = new THREE.SphereGeometry(0.32, 16, 16);
        const beadMat = new THREE.MeshPhysicalMaterial({
          color: isGold ? 0xe9ad2e : isPearl ? 0xfff8ee : 0xf0f0f0,
          metalness: isGold ? 0.94 : isPearl ? 0.12 : 0.05,
          roughness: isGold ? 0.12 : isPearl ? 0.1 : 0.2,
          clearcoat: 0.5,
          clearcoatRoughness: 0.1,
        });

        const beadMesh = new THREE.Mesh(beadGeom, beadMat);
        const scaleX = decoration.transform.scaleX || 1;
        const scaleY = decoration.transform.scaleY || 1;
        const scaleZ = Math.max(0.4, (scaleX + scaleY) / 2);
        beadMesh.scale.set(scaleX * 0.8, scaleY * 0.8, scaleZ * (decoration.heightMm || 0.3));
        beadMesh.rotation.z = THREE.MathUtils.degToRad(decoration.transform.rotationDeg || 0);

        container.add(beadMesh);
        root.add(container);
        renderedCount += 1;
      }
    }
  }
  return { root, renderedCount, fallbackAssetIds };
}

function cameraPreset(id: CameraId) {
  return GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.cameraPresets.find((preset) => preset.id === id)
    ?? GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.cameraPresets[0];
}

function fitCameraToPromotedNailV072(runtime: SingleNailPbrRuntimeV072, id: CameraId): void {
  const preset = cameraPreset(id);
  const width = Math.max(1, runtime.host.clientWidth);
  const height = Math.max(1, runtime.host.clientHeight);
  const aspect = width / height;
  const center = runtime.bounds.getCenter(new THREE.Vector3());
  const sphere = runtime.bounds.getBoundingSphere(new THREE.Sphere());
  const direction = new THREE.Vector3(...preset.positionMm)
    .sub(new THREE.Vector3(...preset.targetMm))
    .normalize();
  const verticalFov = THREE.MathUtils.degToRad(preset.verticalFovDeg);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const limitingFov = Math.max(THREE.MathUtils.degToRad(8), Math.min(verticalFov, horizontalFov));
  const distance = (sphere.radius / Math.sin(limitingFov / 2)) * 1.16;

  runtime.camera.aspect = aspect;
  runtime.camera.fov = preset.verticalFovDeg;
  runtime.camera.near = Math.max(0.01, distance - sphere.radius * 2.2);
  runtime.camera.far = distance + sphere.radius * 4;
  runtime.camera.up.set(...preset.up);
  runtime.camera.position.copy(center).addScaledVector(direction, distance);
  runtime.camera.lookAt(center);
  runtime.camera.updateProjectionMatrix();
  runtime.camera.updateMatrixWorld(true);

  const minimum = runtime.bounds.min;
  const maximum = runtime.bounds.max;
  const corners = [
    [minimum.x, minimum.y, minimum.z], [minimum.x, minimum.y, maximum.z],
    [minimum.x, maximum.y, minimum.z], [minimum.x, maximum.y, maximum.z],
    [maximum.x, minimum.y, minimum.z], [maximum.x, minimum.y, maximum.z],
    [maximum.x, maximum.y, minimum.z], [maximum.x, maximum.y, maximum.z],
  ];
  const coverage = corners.reduce((largest, point) => {
    const projected = new THREE.Vector3(...point).project(runtime.camera);
    return Math.max(largest, Math.abs(projected.x), Math.abs(projected.y));
  }, 0);
  runtime.host.dataset.cameraFit = 'bounds-aware';
  runtime.host.dataset.cameraCoverage = coverage.toFixed(4);
  runtime.host.dataset.cameraFramingSafe = String(Number.isFinite(coverage) && coverage <= 0.94);
  runtime.renderer.setSize(width, height, false);
  runtime.renderer.render(runtime.scene, runtime.camera);
}

export default function SingleNailPbrPreviewV072({
  nail,
  readModel,
  fallback,
  recipeInstances = {},
  allNails,
}: {
  nail: NailDesignV7;
  readModel: CustomerNailPreviewReadModelV7;
  fallback: ReactNode;
  recipeInstances?: Record<string, RecipeInstanceV7>;
  allNails?: EditorDocV7['nails'];
}) {
  const { t } = useLocale();
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SingleNailPbrRuntimeV072 | null>(null);
  const cameraIdRef = useRef<CameraId>('oblique_left');
  const [cameraId, setCameraId] = useState<CameraId>('oblique_left');
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [surfaceHash, setSurfaceHash] = useState('pending');
  const [dimensionalResult, setDimensionalResult] = useState({ renderedCount: 0, fallbackAssetIds: [] as string[] });
  const resolution = useMemo(() => resolveEditorGeometryV7(nail.geometryRef, nail.finger), [nail.finger, nail.geometryRef]);
  const promotion = useMemo(() => resolution.status === 'resolved'
    ? resolvePromotedGeometryV2({ shape: resolution.shape, length: resolution.length, consumer: 'single_nail_pbr' })
    : { status: 'unavailable' as const, reason: 'not_registered' as const, manufacturingValidated: false as const }, [resolution]);
  const projection = useMemo(() => createSingleNailMaterialProjectionV1(nail, readModel, recipeInstances, allNails), [allNails, nail, readModel, recipeInstances]);
  const textureAssetSet = useMemo(() => resolveRenderTextureAssetSetV1(nail), [nail]);

  useEffect(() => {
    setSurfaceHash(promotion.status === 'promoted' ? promotion.entry.geometrySnapshotRef.sha256 : 'unavailable');
  }, [promotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || resolution.status !== 'resolved' || promotion.status !== 'promoted') { setStatus('fallback'); return; }
    setStatus('loading');
    setDimensionalResult({ renderedCount: 0, fallbackAssetIds: [] });
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) { setStatus('fallback'); return; }
    const loseContext = context.getExtension('WEBGL_lose_context');
    loseContext?.loseContext();
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let observer: ResizeObserver | null = null;
    const controller = new AbortController();
    const pendingTextures: THREE.Texture[] = [];
    let pendingGeometry: THREE.BufferGeometry | null = null;
    void (async () => {
      const geometry = await loadPromotedGeometryV2(promotion.delivery, controller.signal);
      pendingGeometry = geometry;
      const texture = await createMaterialTexture(projection, textureAssetSet?.maps.decal ?? null);
      pendingTextures.push(texture);
      const normalMap = textureAssetSet ? await createVerifiedLinearTexture(textureAssetSet.maps.normal) : null;
      if (normalMap) pendingTextures.push(normalMap);
      const roughnessMap = textureAssetSet ? await createVerifiedLinearTexture(textureAssetSet.maps.roughness) : null;
      if (roughnessMap) pendingTextures.push(roughnessMap);
      const heightMap = textureAssetSet ? await createVerifiedLinearTexture(textureAssetSet.maps.height) : null;
      if (heightMap) pendingTextures.push(heightMap);
      if (disposed) {
        geometry.dispose();
        pendingTextures.splice(0).forEach((entry) => entry.dispose());
        return;
      }
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.colorManagement.exposure;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.setAttribute('aria-label', `${nail.finger} 单指模拟 3D PBR 材质投影`);
      renderer.domElement.setAttribute('role', 'img');
      host.replaceChildren(renderer.domElement);

      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
      const finish = GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.finishes[readModel.finishType];
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture,
        normalMap: normalMap ?? undefined,
        normalScale: normalMap ? new THREE.Vector2(0.55, 0.55) : undefined,
        roughnessMap: roughnessMap ?? undefined,
        bumpMap: heightMap ?? undefined,
        bumpScale: textureAssetSet?.maps.height.heightScaleMm ?? 0,
        roughness: finish.baseRoughness,
        metalness: 0,
        clearcoat: finish.clearcoat,
        clearcoatRoughness: finish.clearcoatRoughness,
        transmission: finish.transmission,
        thickness: 0.25,
        transparent: projection.hasTransparency,
        depthWrite: !projection.hasTransparency,
        side: THREE.DoubleSide,
      });
      pendingTextures.length = 0;
      const mesh = new THREE.Mesh(geometry, material);
      pendingGeometry = null;
      const renderRoot = new THREE.Group();
      renderRoot.name = `single-nail.${nail.finger}`;
      renderRoot.add(mesh);
      scene.add(renderRoot);
      scene.add(new THREE.HemisphereLight(0xfff8f5, 0x5e5260, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.35);
      key.position.set(-12, -5, 28);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffb7d0, 1.15);
      rim.position.set(18, -2, 10);
      scene.add(rim);

      const decorations = await renderDimensionalDecorationsV072(nail, geometry, controller.signal);
      controller.signal.throwIfAborted();
      if (disposed) return;
      renderRoot.add(decorations.root);
      renderRoot.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(renderRoot);
      if (!bounds || bounds.isEmpty()) throw new Error('promoted_geometry_bounds_unavailable');
      runtimeRef.current = { renderer, scene, camera, bounds, host };
      setDimensionalResult({ renderedCount: decorations.renderedCount, fallbackAssetIds: decorations.fallbackAssetIds });
      const resize = () => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        fitCameraToPromotedNailV072(runtime, cameraIdRef.current);
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      setStatus('ready');
    })().catch(() => {
      pendingGeometry?.dispose();
      pendingGeometry = null;
      pendingTextures.splice(0).forEach((entry) => entry.dispose());
      if (!disposed) setStatus('fallback');
    });
    return () => {
      disposed = true;
      controller.abort();
      observer?.disconnect();
      runtimeRef.current = null;
      scene?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((entry) => {
          entry.map?.dispose();
          entry.normalMap?.dispose();
          entry.roughnessMap?.dispose();
          entry.bumpMap?.dispose();
          entry.dispose();
        });
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [nail, projection, promotion, readModel, resolution.status, textureAssetSet]);

  useEffect(() => {
    cameraIdRef.current = cameraId;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    fitCameraToPromotedNailV072(runtime, cameraId);
  }, [cameraId, status]);

  if (status === 'fallback') {
    return <div data-testid="single-nail-pbr-fallback" className="space-y-3">{fallback}<p className="mx-auto max-w-sm rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-nano text-warning">{t('render.fallback')}</p></div>;
  }

  return (
    <figure className="mx-auto w-full max-w-[520px]" data-testid="single-nail-pbr-v0-7-2" data-finger={nail.finger} data-runtime-status={status} data-camera-id={cameraId} data-surface-hash={surfaceHash} data-geometry-registry-entry={promotion.status === 'promoted' ? promotion.entry.registryEntryId : 'unavailable'} data-geometry-representation={promotion.status === 'promoted' ? promotion.delivery.representationId : 'unavailable'} data-material-projection={projection.schemaVersion} data-material-hash={projection.projectionHash} data-material-mode={projection.backgroundMode} data-material-fidelity={projection.fidelity} data-projected-layer-kinds={projection.projectedLayerKinds.join(',')} data-texture-asset-set={textureAssetSet?.assetSetId ?? 'none'} data-texture-asset-revision={textureAssetSet?.revision ?? 'none'} data-decoration-rendered-count={dimensionalResult.renderedCount} data-decoration-fallback-count={dimensionalResult.fallbackAssetIds.length} data-render-bounds="nail-and-visible-decorations" data-uv-contract="nail-local-v1-tip-to-root" data-evidence="simulated-not-manufacturing">
      <div ref={hostRef} className="h-[min(58dvh,560px)] min-h-[360px] w-full overflow-hidden rounded-[28px] border border-white bg-[radial-gradient(circle_at_50%_30%,#fff_0%,#f5eee7_72%)] shadow-[0_24px_70px_rgba(77,53,67,0.16)]" data-testid="single-nail-pbr-canvas-host" />
      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label={t('render.cameraGroupAria')}>
        {(Object.keys(CAMERA_LABEL) as CameraId[]).map((id) => <button key={id} type="button" aria-pressed={cameraId === id} onClick={() => setCameraId(id)} className={cx('min-h-11 rounded-xl border px-3 text-nano font-medium', cameraId === id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')}>{t(CAMERA_LABEL[id])}</button>)}
      </div>
      <figcaption className="mt-2 text-center text-nano leading-4 text-gray-500">{t('render.caption', { schemaVersion: projection.schemaVersion, fidelity: projection.fidelity, materialMode: textureAssetSet ? 'decal + normal + roughness + visual height' : 'canonical color projection' })}</figcaption>
      {dimensionalResult.fallbackAssetIds.length > 0 && <p className="mt-2 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-center text-nano text-warning" role="status" data-testid="single-nail-decoration-fallback">{t('render.decorationFallback', { count: dimensionalResult.fallbackAssetIds.length })}</p>}
      {projection.warnings.length > 0 && <p className="mt-2 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-center text-nano text-warning">{projection.warnings.join('；')}</p>}
    </figure>
  );
}
