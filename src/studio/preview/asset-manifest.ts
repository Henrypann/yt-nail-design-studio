/**
 * Vendor-neutral browser 3D asset contract.
 *
 * This manifest describes preview inputs only. It is deliberately incapable of
 * claiming physical fit, print readiness, or manufacturing approval.
 */

export const WEB_3D_MANIFEST_URL = '/assets/glb/manifest.v1.json';
export const WEB_3D_MANIFEST_SCHEMA_VERSION = 1 as const;

export type AssetEvidence = 'SIMULATED' | 'MISSING';
export type RenderSuitability = 'simulated_preview' | 'fallback_only';

export interface BoundsMm {
  min: [number, number, number];
  max: [number, number, number];
}

export interface WebGlbLod {
  /** 0 is the highest-detail browser variant. */
  level: number;
  /** Use this LOD at or above this projected size. */
  minScreenCoveragePx: number;
  path: string;
  sizeBytes: number;
  sha256: string;
  boundsMm: BoundsMm;
}

export interface Web3dAssetEntry {
  id: string;
  revision: string;
  category: 'shell' | 'ribbon' | 'droplet' | 'stud' | 'pearl' | 'custom';
  evidence: AssetEvidence;
  renderSuitability: RenderSuitability;
  /** Must always remain false in this browser-preview contract. */
  manufacturingValidated: false;
  lods: WebGlbLod[];
  statusNote?: string;
}

export interface RendererAdapterDescriptor {
  id: string;
  recipeRef: { id: string; version: string };
  requiredAssetIds: string[];
  fallbackRendererId: string;
  evidence: 'SIMULATED';
}

export interface Web3dAssetManifestV1 {
  schemaVersion: 1;
  manifestId: string;
  manifestVersion: string;
  updatedAt: string;
  coordinateContract: {
    unit: 'mm';
    handedness: 'right';
    origin: 'nail_root_center';
    tipDirection: 'negative_y';
    surfaceDirection: 'positive_z';
  };
  assets: Web3dAssetEntry[];
  rendererAdapters: RendererAdapterDescriptor[];
}

export type ManifestValidationResult =
  | { ok: true; manifest: Web3dAssetManifestV1 }
  | { ok: false; errors: string[] };

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const WEB_GLB_PATH = /^\/assets\/glb\/[A-Za-z0-9._/-]+\.web\.glb$/;
const CATEGORIES = new Set(['shell', 'ribbon', 'droplet', 'stud', 'pearl', 'custom']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteTriplet(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function validateBounds(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value) || !isFiniteTriplet(value.min) || !isFiniteTriplet(value.max)) {
    errors.push(`${path} must contain finite min/max triplets in mm`);
    return;
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (value.min[axis] >= value.max[axis]) errors.push(`${path} min must be lower than max on axis ${axis}`);
  }
}

function validateLod(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!Number.isInteger(value.level) || Number(value.level) < 0) errors.push(`${path}.level must be a non-negative integer`);
  if (typeof value.minScreenCoveragePx !== 'number' || !Number.isFinite(value.minScreenCoveragePx) || value.minScreenCoveragePx < 0) {
    errors.push(`${path}.minScreenCoveragePx must be a non-negative finite number`);
  }
  if (!isNonEmptyString(value.path) || !WEB_GLB_PATH.test(value.path) || value.path.includes('..') || value.path.includes('.raw.')) {
    errors.push(`${path}.path must be an absolute browser .web.glb path under /assets/glb`);
  }
  if (!Number.isInteger(value.sizeBytes) || Number(value.sizeBytes) < 20) errors.push(`${path}.sizeBytes must be an integer of at least 20 bytes`);
  if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) errors.push(`${path}.sha256 must be a lowercase SHA-256 hex digest`);
  validateBounds(value.boundsMm, `${path}.boundsMm`, errors);
}

export function validateComponentEntry(value: unknown, index = 0): string | null {
  const errors: string[] = [];
  const path = `assets[${index}]`;
  if (!isRecord(value)) return `${path} must be an object`;
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id is required`);
  if (!isNonEmptyString(value.revision) || !SEMVER.test(value.revision)) errors.push(`${path}.revision must be semver`);
  if (!CATEGORIES.has(String(value.category))) errors.push(`${path}.category is unsupported`);
  if (value.evidence !== 'SIMULATED' && value.evidence !== 'MISSING') errors.push(`${path}.evidence must be SIMULATED or MISSING`);
  if (value.renderSuitability !== 'simulated_preview' && value.renderSuitability !== 'fallback_only') errors.push(`${path}.renderSuitability is unsupported`);
  if (value.manufacturingValidated !== false) errors.push(`${path}.manufacturingValidated must be false`);
  if (!Array.isArray(value.lods)) {
    errors.push(`${path}.lods must be an array`);
  } else {
    value.lods.forEach((lod, lodIndex) => validateLod(lod, `${path}.lods[${lodIndex}]`, errors));
    const levels = value.lods.map((lod) => isRecord(lod) ? lod.level : undefined);
    if (new Set(levels).size !== levels.length) errors.push(`${path}.lod levels must be unique`);
    for (let lodIndex = 1; lodIndex < value.lods.length; lodIndex += 1) {
      const previous = value.lods[lodIndex - 1];
      const current = value.lods[lodIndex];
      if (isRecord(previous) && isRecord(current) && Number(previous.level) >= Number(current.level)) {
        errors.push(`${path}.lods must be ordered by increasing level`);
      }
      if (isRecord(previous) && isRecord(current) && Number(previous.minScreenCoveragePx) <= Number(current.minScreenCoveragePx)) {
        errors.push(`${path}.lod thresholds must decrease as level increases`);
      }
    }
  }
  if (value.evidence === 'MISSING') {
    if (Array.isArray(value.lods) && value.lods.length > 0) errors.push(`${path} MISSING assets cannot declare browser files`);
    if (value.renderSuitability !== 'fallback_only') errors.push(`${path} MISSING assets must be fallback_only`);
    if (!isNonEmptyString(value.statusNote)) errors.push(`${path} MISSING assets require statusNote`);
  }
  if (value.evidence === 'SIMULATED') {
    if (!Array.isArray(value.lods) || value.lods.length === 0) errors.push(`${path} SIMULATED assets require at least one browser LOD`);
    if (value.renderSuitability !== 'simulated_preview') errors.push(`${path} SIMULATED assets must be simulated_preview`);
  }
  return errors.length ? errors.join('; ') : null;
}

export function validateAssetManifest(value: unknown): ManifestValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ['manifest must be an object'] };
  const errors: string[] = [];
  if (value.schemaVersion !== WEB_3D_MANIFEST_SCHEMA_VERSION) errors.push('schemaVersion must be 1');
  if (!isNonEmptyString(value.manifestId)) errors.push('manifestId is required');
  if (!isNonEmptyString(value.manifestVersion) || !SEMVER.test(value.manifestVersion)) errors.push('manifestVersion must be semver');
  if (!isNonEmptyString(value.updatedAt) || Number.isNaN(Date.parse(value.updatedAt))) errors.push('updatedAt must be an ISO date');
  const coordinate = value.coordinateContract;
  if (!isRecord(coordinate)
    || coordinate.unit !== 'mm'
    || coordinate.handedness !== 'right'
    || coordinate.origin !== 'nail_root_center'
    || coordinate.tipDirection !== 'negative_y'
    || coordinate.surfaceDirection !== 'positive_z') {
    errors.push('coordinateContract must use the right-handed nail_root_center millimetre contract');
  }
  if (!Array.isArray(value.assets)) errors.push('assets must be an array');
  const assets = Array.isArray(value.assets) ? value.assets : [];
  assets.forEach((asset, index) => {
    const error = validateComponentEntry(asset, index);
    if (error) errors.push(error);
  });
  const assetIds = assets.map((asset) => isRecord(asset) ? asset.id : undefined);
  if (new Set(assetIds).size !== assetIds.length) errors.push('asset IDs must be unique');

  if (!Array.isArray(value.rendererAdapters)) errors.push('rendererAdapters must be an array');
  const adapters = Array.isArray(value.rendererAdapters) ? value.rendererAdapters : [];
  const adapterIds: unknown[] = [];
  const recipeKeys: string[] = [];
  adapters.forEach((adapter, index) => {
    const path = `rendererAdapters[${index}]`;
    if (!isRecord(adapter)) {
      errors.push(`${path} must be an object`);
      return;
    }
    if (!isNonEmptyString(adapter.id)) errors.push(`${path}.id is required`);
    adapterIds.push(adapter.id);
    if (!isRecord(adapter.recipeRef) || !isNonEmptyString(adapter.recipeRef.id) || !isNonEmptyString(adapter.recipeRef.version)) {
      errors.push(`${path}.recipeRef requires id and version`);
    } else {
      recipeKeys.push(`${adapter.recipeRef.id}@${adapter.recipeRef.version}`);
    }
    if (!Array.isArray(adapter.requiredAssetIds) || adapter.requiredAssetIds.length === 0) {
      errors.push(`${path}.requiredAssetIds must be non-empty`);
    } else {
      const refs = adapter.requiredAssetIds.filter(isNonEmptyString);
      if (refs.length !== adapter.requiredAssetIds.length || new Set(refs).size !== refs.length) errors.push(`${path}.requiredAssetIds must contain unique IDs`);
      refs.forEach((id) => {
        if (!assetIds.includes(id)) errors.push(`${path} references missing asset ${id}`);
      });
    }
    if (!isNonEmptyString(adapter.fallbackRendererId)) errors.push(`${path}.fallbackRendererId is required`);
    if (adapter.evidence !== 'SIMULATED') errors.push(`${path}.evidence must be SIMULATED`);
  });
  if (new Set(adapterIds).size !== adapterIds.length) errors.push('renderer adapter IDs must be unique');
  if (new Set(recipeKeys).size !== recipeKeys.length) errors.push('recipe adapter references must be unique');

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, manifest: value as unknown as Web3dAssetManifestV1 };
}

export function selectLod(asset: Web3dAssetEntry, screenCoveragePx: number): WebGlbLod | null {
  if (asset.evidence === 'MISSING' || asset.lods.length === 0) return null;
  const coverage = Number.isFinite(screenCoveragePx) ? Math.max(0, screenCoveragePx) : 0;
  return asset.lods.find((lod) => coverage >= lod.minScreenCoveragePx) ?? asset.lods[asset.lods.length - 1] ?? null;
}
