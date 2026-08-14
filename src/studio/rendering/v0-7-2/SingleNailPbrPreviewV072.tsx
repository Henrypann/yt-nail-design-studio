import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { cx } from '@/design-system';
import type { NailDesignV7 } from '@/studio/editor/v7/model';
import type { CustomerNailPreviewReadModelV7 } from '@/studio/editor/v7/customer-preview';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import { resolvePromotedGeometryV2 } from '@/studio/geometry/v0-7-2/registry-v2';
import { GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1 } from './fixtures';
import { createSingleNailMaterialProjectionV1, type SingleNailMaterialProjectionV1 } from './material-projection';
import { loadPromotedGeometryV2 } from './promoted-geometry-loader';
import {
  resolveRenderTextureAssetSetV1,
  type RenderTextureMapRefV1,
} from './texture-map-assets';

const CAMERA_LABEL = {
  surface: '正视', oblique_left: '左斜', oblique_right: '右斜', side_profile: '侧面', tip_grazing: '指尖',
} as const;
type CameraId = keyof typeof CAMERA_LABEL;

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

function cameraPreset(id: CameraId) {
  return GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.cameraPresets.find((preset) => preset.id === id)
    ?? GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.cameraPresets[0];
}

export default function SingleNailPbrPreviewV072({
  nail,
  readModel,
  fallback,
}: {
  nail: NailDesignV7;
  readModel: CustomerNailPreviewReadModelV7;
  fallback: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null>(null);
  const [cameraId, setCameraId] = useState<CameraId>('oblique_left');
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [surfaceHash, setSurfaceHash] = useState('pending');
  const resolution = useMemo(() => resolveEditorGeometryV7(nail.geometryRef, nail.finger), [nail.finger, nail.geometryRef]);
  const promotion = useMemo(() => resolution.status === 'resolved'
    ? resolvePromotedGeometryV2({ shape: resolution.shape, length: resolution.length, consumer: 'single_nail_pbr' })
    : { status: 'unavailable' as const, reason: 'not_registered' as const, manufacturingValidated: false as const }, [resolution]);
  const projection = useMemo(() => createSingleNailMaterialProjectionV1(nail, readModel), [nail, readModel]);
  const textureAssetSet = useMemo(() => resolveRenderTextureAssetSetV1(nail), [nail]);

  useEffect(() => {
    setSurfaceHash(promotion.status === 'promoted' ? promotion.entry.geometrySnapshotRef.sha256 : 'unavailable');
  }, [promotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || resolution.status !== 'resolved' || promotion.status !== 'promoted') { setStatus('fallback'); return; }
    setStatus('loading');
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
      scene.add(mesh);
      scene.add(new THREE.HemisphereLight(0xfff8f5, 0x5e5260, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.35);
      key.position.set(-12, -5, 28);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffb7d0, 1.15);
      rim.position.set(18, -2, 10);
      scene.add(rim);

      runtimeRef.current = { renderer, scene, camera };
      const resize = () => {
        if (!renderer || !scene) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
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
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const preset = cameraPreset(cameraId);
    runtime.camera.position.set(...preset.positionMm);
    runtime.camera.up.set(...preset.up);
    runtime.camera.fov = preset.verticalFovDeg;
    runtime.camera.lookAt(...preset.targetMm);
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [cameraId, status]);

  if (status === 'fallback') {
    return <div data-testid="single-nail-pbr-fallback" className="space-y-3">{fallback}<p className="mx-auto max-w-sm rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-nano text-warning">模拟 3D 运行时或已签收甲型不可用；已留在当前指并回退 SVG 2.5D。设计未被修改。</p></div>;
  }

  return (
    <figure className="mx-auto w-full max-w-[520px]" data-testid="single-nail-pbr-v0-7-2" data-runtime-status={status} data-camera-id={cameraId} data-surface-hash={surfaceHash} data-geometry-registry-entry={promotion.status === 'promoted' ? promotion.entry.registryEntryId : 'unavailable'} data-geometry-representation={promotion.status === 'promoted' ? promotion.delivery.representationId : 'unavailable'} data-material-projection={projection.schemaVersion} data-material-hash={projection.projectionHash} data-material-mode={projection.backgroundMode} data-material-fidelity={projection.fidelity} data-texture-asset-set={textureAssetSet?.assetSetId ?? 'none'} data-texture-asset-revision={textureAssetSet?.revision ?? 'none'} data-uv-contract="nail-local-v1-tip-to-root" data-evidence="simulated-not-manufacturing">
      <div ref={hostRef} className="h-[min(58dvh,560px)] min-h-[360px] w-full overflow-hidden rounded-[28px] border border-white bg-[radial-gradient(circle_at_50%_30%,#fff_0%,#f5eee7_72%)] shadow-[0_24px_70px_rgba(77,53,67,0.16)]" />
      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label="单指模拟 3D 观察角度">
        {(Object.keys(CAMERA_LABEL) as CameraId[]).map((id) => <button key={id} type="button" aria-pressed={cameraId === id} onClick={() => setCameraId(id)} className={cx('min-h-11 rounded-xl border px-3 text-nano font-medium', cameraId === id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')}>{CAMERA_LABEL[id]}</button>)}
      </div>
      <figcaption className="mt-2 text-center text-nano leading-4 text-gray-500">SIMULATED PBR · Registry V2 · Almond medium v3 · {projection.schemaVersion} · {projection.fidelity} · {textureAssetSet ? 'decal + normal + roughness + visual height' : 'canonical color projection'}。甲面 GLB 已绑定 CanonicalGeometry，但 C 弧与 vertical preview thickness 仍为算法假设；立体装饰 Boolean 尚未接入，不证明贴合、工程壁厚、真实材质、固化、打印或制造。</figcaption>
      {projection.warnings.length > 0 && <p className="mt-2 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-center text-nano text-warning">{projection.warnings.join('；')}</p>}
    </figure>
  );
}
