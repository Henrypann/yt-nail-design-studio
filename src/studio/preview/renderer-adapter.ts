/**
 * Lazy, data-driven preview renderer boundary.
 *
 * Selection is made from a validated manifest and a V6 recipe reference. Asset
 * failure always returns an explicit local 2D fallback; callers never need to
 * guess whether a blank canvas means loading or failure.
 */

import type { EditorDocRecipeInstanceV6 } from '@/studio/editor/v6/model';
import {
  selectLod,
  validateAssetManifest,
  type RendererAdapterDescriptor,
  type Web3dAssetManifestV1,
  type WebGlbLod,
} from './asset-manifest';

export type RendererFallbackReason =
  | 'invalid_manifest'
  | 'unsupported_recipe'
  | 'missing_asset'
  | 'corrupt_asset'
  | 'incompatible_asset'
  | 'renderer_load_failed';

export interface RendererModule {
  readonly rendererId: string;
  readonly engine: 'three' | 'svg-2d';
  readonly evidence: 'SIMULATED';
}

export type RendererModuleLoader = () => Promise<RendererModule>;

export interface RendererLoadDependencies {
  fetchBytes?: (path: string) => Promise<ArrayBuffer>;
  digestSha256?: (bytes: ArrayBuffer) => Promise<string>;
  moduleLoaders?: Readonly<Record<string, RendererModuleLoader>>;
}

export interface RendererRequest {
  recipeRef: { id: string; version: string };
  screenCoveragePx: number;
}

export type RendererResolution =
  | {
      kind: 'adapter_loaded';
      rendererId: string;
      evidence: 'SIMULATED';
      statusLabel: '模拟 3D 预览';
      assets: Array<{ assetId: string; lod: WebGlbLod }>;
      module: RendererModule;
    }
  | {
      kind: 'fallback_2d';
      rendererId: string;
      reason: RendererFallbackReason;
      statusLabel: '2D 预览降级';
      message: string;
    };

const DEFAULT_MODULE_LOADERS: Readonly<Record<string, RendererModuleLoader>> = {
  'three-pbr/mercury-dew-1': () => import('./renderers/mercury-dew-adapter'),
  'three-pbr/starfish-bloom-1': () => import('./renderers/starfish-bloom-adapter'),
};

async function defaultFetchBytes(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

async function defaultDigestSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fallback(
  adapter: RendererAdapterDescriptor | null,
  reason: RendererFallbackReason,
  message: string,
): RendererResolution {
  return {
    kind: 'fallback_2d',
    rendererId: adapter?.fallbackRendererId ?? 'svg-2d/generic-nail-1',
    reason,
    statusLabel: '2D 预览降级',
    message,
  };
}

function findAdapter(manifest: Web3dAssetManifestV1, request: RendererRequest): RendererAdapterDescriptor | null {
  return manifest.rendererAdapters.find((adapter) => (
    adapter.recipeRef.id === request.recipeRef.id && adapter.recipeRef.version === request.recipeRef.version
  )) ?? null;
}

/** Read the canonical recipe reference from a V6 recipe wrapper. */
export function rendererRequestFromV6Recipe(
  instance: EditorDocRecipeInstanceV6,
  screenCoveragePx: number,
): RendererRequest | null {
  if (!instance.recipe || typeof instance.recipe !== 'object' || Array.isArray(instance.recipe)) return null;
  const recipe = instance.recipe as Record<string, unknown>;
  const ref = recipe.recipeRef;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return null;
  const recipeRef = ref as Record<string, unknown>;
  if (typeof recipeRef.id !== 'string' || typeof recipeRef.version !== 'string') return null;
  if (recipeRef.id !== instance.recipeId) return null;
  return { recipeRef: { id: recipeRef.id, version: recipeRef.version }, screenCoveragePx };
}

export function inspectGlb(bytes: ArrayBuffer): string | null {
  if (bytes.byteLength < 20) return 'GLB is shorter than its header and first chunk';
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67) return 'GLB magic is invalid';
  if (view.getUint32(4, true) !== 2) return 'Only GLB version 2 is supported';
  if (view.getUint32(8, true) !== bytes.byteLength) return 'GLB declared length does not match response length';
  const firstChunkLength = view.getUint32(12, true);
  const firstChunkType = view.getUint32(16, true);
  if (firstChunkType !== 0x4e4f534a) return 'GLB first chunk must be JSON';
  if (firstChunkLength <= 0 || 20 + firstChunkLength > bytes.byteLength) return 'GLB JSON chunk length is invalid';
  return null;
}

async function verifyLod(
  lod: WebGlbLod,
  deps: Required<Pick<RendererLoadDependencies, 'fetchBytes' | 'digestSha256'>>,
): Promise<RendererFallbackReason | null> {
  let bytes: ArrayBuffer;
  try {
    bytes = await deps.fetchBytes(lod.path);
  } catch {
    return 'missing_asset';
  }
  if (bytes.byteLength !== lod.sizeBytes || inspectGlb(bytes)) return 'corrupt_asset';
  try {
    if ((await deps.digestSha256(bytes)) !== lod.sha256) return 'corrupt_asset';
  } catch {
    return 'incompatible_asset';
  }
  return null;
}

export async function resolveRenderer(
  manifestValue: unknown,
  request: RendererRequest,
  dependencies: RendererLoadDependencies = {},
): Promise<RendererResolution> {
  const validation = validateAssetManifest(manifestValue);
  if (!validation.ok) return fallback(null, 'invalid_manifest', validation.errors.join('; '));
  const manifest = validation.manifest;
  const adapter = findAdapter(manifest, request);
  if (!adapter) return fallback(null, 'unsupported_recipe', `没有适配 ${request.recipeRef.id}@${request.recipeRef.version} 的 3D 预览。`);

  const selectedAssets: Array<{ assetId: string; lod: WebGlbLod }> = [];
  for (const assetId of adapter.requiredAssetIds) {
    const asset = manifest.assets.find((candidate) => candidate.id === assetId);
    if (!asset || asset.evidence === 'MISSING') {
      return fallback(adapter, 'missing_asset', `3D 资产 ${assetId} 尚未交付，已保留可操作的 2D 预览。`);
    }
    const lod = selectLod(asset, request.screenCoveragePx);
    if (!lod) return fallback(adapter, 'incompatible_asset', `3D 资产 ${assetId} 没有适用的浏览器 LOD。`);
    const failure = await verifyLod(lod, {
      fetchBytes: dependencies.fetchBytes ?? defaultFetchBytes,
      digestSha256: dependencies.digestSha256 ?? defaultDigestSha256,
    });
    if (failure) {
      const detail = failure === 'missing_asset' ? '无法加载' : failure === 'corrupt_asset' ? '完整性校验失败' : '当前环境无法验证';
      return fallback(adapter, failure, `3D 资产 ${assetId} ${detail}，已降级为 2D 预览。`);
    }
    selectedAssets.push({ assetId, lod });
  }

  const loader = (dependencies.moduleLoaders ?? DEFAULT_MODULE_LOADERS)[adapter.id];
  if (!loader) return fallback(adapter, 'renderer_load_failed', `渲染器 ${adapter.id} 未注册，已降级为 2D 预览。`);
  try {
    const module = await loader();
    if (module.rendererId !== adapter.id || module.evidence !== 'SIMULATED') {
      return fallback(adapter, 'renderer_load_failed', `渲染器 ${adapter.id} 契约不兼容，已降级为 2D 预览。`);
    }
    return {
      kind: 'adapter_loaded',
      rendererId: adapter.id,
      evidence: 'SIMULATED',
      statusLabel: '模拟 3D 预览',
      assets: selectedAssets,
      module,
    };
  } catch {
    return fallback(adapter, 'renderer_load_failed', `渲染器 ${adapter.id} 加载失败，已降级为 2D 预览。`);
  }
}

export function describeRendererStatus(result: RendererResolution): string {
  return result.statusLabel;
}
