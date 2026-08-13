import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { cx } from '@/design-system';
import type { NailDesignV7 } from '@/studio/editor/v7/model';
import type { CustomerNailPreviewReadModelV7 } from '@/studio/editor/v7/customer-preview';
import { representativeBackgroundColorV7 } from '@/studio/editor/v7/background';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import { GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1 } from './fixtures';
import { createSingleNailPreviewSurfaceV1, hashPreviewSurfaceMeshV1 } from './single-nail-surface';

const CAMERA_LABEL = {
  surface: '正视', oblique_left: '左斜', oblique_right: '右斜', side_profile: '侧面', tip_grazing: '指尖',
} as const;
type CameraId = keyof typeof CAMERA_LABEL;

function backgroundCss(nail: NailDesignV7, readModel: CustomerNailPreviewReadModelV7): THREE.Color {
  const background = nail.steps[0];
  const color = readModel.backgroundColorOverride
    ?? (background.kind === 'background' ? representativeBackgroundColorV7(background.background) : { r: 244, g: 220, b: 229 });
  return new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
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
  const surface = useMemo(() => createSingleNailPreviewSurfaceV1(), [nail.geometryRef]);

  useEffect(() => {
    let active = true;
    hashPreviewSurfaceMeshV1(surface).then((hash) => { if (active) setSurfaceHash(hash); });
    return () => { active = false; };
  }, [surface]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || resolution.status !== 'resolved') { setStatus('fallback'); return; }
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!context) { setStatus('fallback'); return; }
    const loseContext = context.getExtension('WEBGL_lose_context');
    loseContext?.loseContext();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('fallback');
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.colorManagement.exposure;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute('aria-label', `${nail.finger} 单指模拟 3D PBR 预览`);
    renderer.domElement.setAttribute('role', 'img');
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.positions, 3));
    geometry.setIndex(surface.indices);
    geometry.computeVertexNormals();
    const finish = GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.finishes[readModel.finishType];
    const material = new THREE.MeshPhysicalMaterial({
      color: backgroundCss(nail, readModel), roughness: finish.baseRoughness, metalness: 0,
      clearcoat: finish.clearcoat, clearcoatRoughness: finish.clearcoatRoughness,
      transmission: finish.transmission, thickness: 0.25, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    scene.add(new THREE.HemisphereLight(0xfff8f5, 0x5e5260, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-12, -5, 28);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb7d0, 1.8);
    rim.position.set(18, -2, 10);
    scene.add(rim);

    const decorationStep = nail.steps.find((step) => step.kind === 'dimensional_decoration' && step.visible && !step.skipped);
    if (decorationStep?.kind === 'dimensional_decoration') {
      decorationStep.decorations.filter((item) => item.visible).slice(0, 8).forEach((decoration, index) => {
        const radius = Math.max(0.3, Math.min(1.15, decoration.kind === 'attachment_3d' ? decoration.heightMm * 0.62 : decoration.heightMm * 0.8));
        const jewelGeometry = new THREE.SphereGeometry(radius, 20, 12);
        const jewelMaterial = new THREE.MeshPhysicalMaterial({
          color: index % 3 === 0 ? 0xcdb5ef : index % 3 === 1 ? 0xf4dce8 : 0xdce4e8,
          roughness: 0.18, clearcoat: 1, transmission: 0.35, thickness: 0.4,
        });
        const jewel = new THREE.Mesh(jewelGeometry, jewelMaterial);
        jewel.position.set((decoration.transform.position.u - 0.5) * 8.5, 1 - decoration.transform.position.v * 17, 3.2 + decoration.heightMm * 0.4);
        scene.add(jewel);
      });
    }

    runtimeRef.current = { renderer, scene, camera };
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    setStatus('ready');
    return () => {
      observer.disconnect();
      runtimeRef.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((entry) => entry.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [nail, readModel, resolution.status, surface]);

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
    <figure className="mx-auto w-full max-w-[520px]" data-testid="single-nail-pbr-v0-7-2" data-runtime-status={status} data-camera-id={cameraId} data-surface-hash={surfaceHash} data-evidence="simulated-not-manufacturing">
      <div ref={hostRef} className="h-[min(58dvh,560px)] min-h-[360px] w-full overflow-hidden rounded-[28px] border border-white bg-[radial-gradient(circle_at_50%_30%,#fff_0%,#f5eee7_72%)] shadow-[0_24px_70px_rgba(77,53,67,0.16)]" />
      <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="group" aria-label="单指模拟 3D 观察角度">
        {(Object.keys(CAMERA_LABEL) as CameraId[]).map((id) => <button key={id} type="button" aria-pressed={cameraId === id} onClick={() => setCameraId(id)} className={cx('min-h-11 rounded-xl border px-3 text-nano font-medium', cameraId === id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')}>{CAMERA_LABEL[id]}</button>)}
      </div>
      <figcaption className="mt-2 text-center text-nano leading-4 text-gray-500">SIMULATED PBR · 单指沟通预览 · C 弧/纵向拱高及 0.55mm 视觉厚度均为算法假设；不证明贴合、工程壁厚、材质、固化、打印或制造。</figcaption>
    </figure>
  );
}
