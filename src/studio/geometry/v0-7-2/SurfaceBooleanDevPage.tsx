import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createBrowserSurfaceBooleanAssetReaderV1, loadSurfaceBooleanInputsV1, type SurfaceBooleanBundleV1 } from './surface-boolean';
import { evaluateSurfaceBooleanInWorkerV1 } from './surface-boolean-client';
import type { GeometryParityMeshV1, GeometryParityOperationV1 } from './parity/model';
import './surface-boolean-dev.css';

type View = 'before' | 'after';
type CameraPreset = 'surface' | 'oblique' | 'side' | 'underside';
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; bundle: SurfaceBooleanBundleV1 };

declare global {
  interface Window {
    __SURFACE_BOOLEAN_V072__?: Record<string, unknown>;
  }
}

function meshGeometry(mesh: GeometryParityMeshV1): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function BooleanViewport({ bundle, operation, view, cameraPreset }: {
  bundle: SurfaceBooleanBundleV1;
  operation: GeometryParityOperationV1;
  view: View;
  cameraPreset: CameraPreset;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#f3ede3');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight('#fff9f4', '#6e5a54', 2.1));
    const key = new THREE.DirectionalLight('#ffffff', 3.2);
    key.position.set(-12, -2, 24);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#f4b6cf', 1.8);
    rim.position.set(14, -18, 10);
    scene.add(rim);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const addMesh = (mesh: GeometryParityMeshV1, color: string, opacity = 1) => {
      const geometry = meshGeometry(mesh);
      const material = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.27,
        metalness: 0.02,
        clearcoat: 0.9,
        clearcoatRoughness: 0.14,
        transparent: opacity < 1,
        opacity,
        side: THREE.DoubleSide,
      });
      geometries.push(geometry);
      materials.push(material);
      scene.add(new THREE.Mesh(geometry, material));
    };
    if (view === 'before') {
      addMesh(bundle.inputs.base, '#efcbd9', 0.82);
      addMesh(bundle.inputs.operand, '#a88bdd', 0.9);
    } else {
      addMesh(bundle.results[operation].mesh, operation === 'union' ? '#e7bfd4' : operation === 'subtract' ? '#f0c6d6' : '#b39be2');
    }
    const bounds = bundle.inputTopology.base.boundsMm;
    const center = new THREE.Vector3(
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    );
    // Keep the complete 19.1 mm nail envelope visible in tall mobile canvases;
    // controls and captions must not hide the root or rounded tip.
    const distance = 48;
    const positions: Record<CameraPreset, THREE.Vector3> = {
      surface: center.clone().add(new THREE.Vector3(0, 0, distance)),
      oblique: center.clone().add(new THREE.Vector3(25, -25, 38)),
      side: center.clone().add(new THREE.Vector3(distance, 0, 3)),
      underside: center.clone().add(new THREE.Vector3(0, 3, -distance)),
    };
    camera.position.copy(positions[cameraPreset]);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    const render = () => renderer.render(scene, camera);
    const resize = new ResizeObserver(([entry]) => {
      const width = Math.max(1, entry.contentRect.width);
      const height = Math.max(1, entry.contentRect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(canvas);
    render();
    return () => {
      resize.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
    };
  }, [bundle, cameraPreset, operation, view]);
  return <canvas ref={canvasRef} aria-label="Registry V2 真实甲面布尔结果" data-testid="surface-boolean-canvas" />;
}

const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

export default function SurfaceBooleanDevPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [operation, setOperation] = useState<GeometryParityOperationV1>('union');
  const [view, setView] = useState<View>('after');
  const [camera, setCamera] = useState<CameraPreset>('oblique');
  useEffect(() => {
    const abort = new AbortController();
    setState({ kind: 'loading' });
    void loadSurfaceBooleanInputsV1(createBrowserSurfaceBooleanAssetReaderV1(), abort.signal)
      .then((inputs) => evaluateSurfaceBooleanInWorkerV1(inputs, { signal: abort.signal }))
      .then((bundle) => setState({ kind: 'ready', bundle }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'surface_boolean_failed' });
      });
    return () => abort.abort();
  }, []);
  const bundle = state.kind === 'ready' ? state.bundle : null;
  useEffect(() => {
    if (!bundle) return;
    window.__SURFACE_BOOLEAN_V072__ = {
      contract: bundle.contract,
      registryEntryId: bundle.inputs.evidence.registryEntryId,
      placement: bundle.inputs.placement,
      frame: bundle.inputs.frame,
      operation,
      view,
      camera,
      topology: Object.fromEntries(Object.entries(bundle.results).map(([key, value]) => [key, value.topology])),
      deterministic: bundle.deterministic,
      manufacturingValidated: false,
    };
  }, [bundle, camera, operation, view]);
  return (
    <main className="surface-boolean-page" data-testid="surface-boolean-page">
      <header>
        <div><p>INTERNAL · GEO‑v0.7.2‑03</p><h1>真实甲面 Surface Boolean</h1></div>
        <aside role="note"><strong>SIMULATED 3D</strong><span>Registry V2 + UV surface frame · 非制造输出</span></aside>
      </header>
      {state.kind === 'loading' && <section className="surface-boolean-status" role="status">正在校验 GLB 并在 Worker 中计算三种布尔结果…</section>}
      {state.kind === 'error' && <section className="surface-boolean-status is-error" role="alert">布尔计算已阻断：{state.message}</section>}
      {bundle && (
        <div className="surface-boolean-workspace">
          <aside className="surface-boolean-panel">
            <p className="eyebrow">IMMUTABLE INPUTS</p>
            <h2>晋级资产与定位</h2>
            <dl>
              <div><dt>Registry</dt><dd>{bundle.inputs.evidence.registryEntryId}</dd></div>
              <div><dt>Base GLB</dt><dd>{short(bundle.inputs.evidence.baseArtifactSha256)}</dd></div>
              <div><dt>Attachment</dt><dd>{bundle.inputs.evidence.attachmentAssetId}</dd></div>
              <div><dt>Placement</dt><dd>UV {bundle.inputs.frame.uv.join(' / ')}</dd></div>
              <div><dt>Surface Z</dt><dd>{bundle.inputs.frame.positionMm[2].toFixed(3)} mm</dd></div>
              <div><dt>Fixed Z</dt><dd>NO</dd></div>
            </dl>
            <p className="surface-boolean-note">位置来自晋级 GLB 的外表面三角插值与法线；没有复用旧平板 Z 常量。</p>
          </aside>
          <section className="surface-boolean-stage">
            <nav aria-label="布尔与视角控制">
              <div role="group" aria-label="布尔操作">
                {(['union', 'subtract', 'intersect'] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={operation === value} onClick={() => setOperation(value)}>{value}</button>
                ))}
              </div>
              <div role="group" aria-label="结果对比">
                {(['before', 'after'] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value}</button>
                ))}
              </div>
              <div role="group" aria-label="相机视角">
                {(['surface', 'oblique', 'side', 'underside'] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={camera === value} onClick={() => setCamera(value)}>{value}</button>
                ))}
              </div>
            </nav>
            <figure><BooleanViewport bundle={bundle} operation={operation} view={view} cameraPreset={camera} /><figcaption>晋级 v3 甲壳 + 淡紫珍珠；结果仅用于浏览器几何与视觉验证。</figcaption></figure>
          </section>
          <aside className="surface-boolean-panel diagnostics">
            <p className="eyebrow">TOPOLOGY PROOF</p><h2>闭合网格结果</h2>
            {(['union', 'subtract', 'intersect'] as const).map((value) => {
              const topology = bundle.results[value].topology;
              return <article key={value} className={operation === value ? 'is-current' : ''}>
                <strong>{value}</strong><span>{topology.triangleCount.toLocaleString()} tris</span>
                <small>{topology.componentCount} component · boundary {topology.boundaryEdgeCount}</small>
                <small>{Math.abs(topology.signedVolumeMm3).toFixed(3)} mm³ · {short(topology.geometryHash)}</small>
              </article>;
            })}
            <p className="surface-boolean-note">三种结果重复计算 hash 一致；UV、材质组与面来源在本轮明确降级，不进入制造链。</p>
          </aside>
        </div>
      )}
    </main>
  );
}
