import { FINGER_CODES, type FingerCode, type NailLength, type NailShape } from '@/lib/types';
import {
  EDITOR_SHAPE_CAPABILITIES,
  SHAPE_CAPABILITIES_VERSION,
  SHAPE_PARAMS_VERSION,
  getSilhouette,
  type EditorShapeCapability,
  type SilhouetteInfo,
} from '@/studio/editor/lib/material';
import type { GeometryRefV7, PreviewFidelityV7 } from './model';

/** CI-verified digest of the sorted 28 `filename:sha256` silhouette set. */
export const PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 = 'adde3f42d79d7b561eb32759ba75a1171bdc0c263d1909b787ea86b0831897ba';
/** Immutable registry identity binds params, capability evidence and SVG bytes. */
export const PRODUCT_GEOMETRY_REVISION_V7 = `geometry-v1-p${SHAPE_PARAMS_VERSION}-c${SHAPE_CAPABILITIES_VERSION}-${PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7}`;
export const PRODUCT_GEOMETRY_LENGTHS_V7 = ['short', 'medium', 'long', 'extra-long'] as const satisfies readonly NailLength[];

export type GeometryEvidenceV7 = 'signed_off' | 'generated' | 'in_review' | 'placeholder';
export type GeometryUnavailableReasonV7 =
  | 'unknown_asset'
  | 'revision_mismatch'
  | 'finger_mismatch'
  | 'silhouette_missing'
  | 'capability_unavailable';

interface GeometryRegistryEntryV7 {
  assetId: string;
  revision: string;
  shape: NailShape;
  length: NailLength;
  finger: FingerCode;
  evidence: GeometryEvidenceV7;
  editorCapability: EditorShapeCapability['capabilities']['editor'];
  silhouette: SilhouetteInfo | null;
}

export interface NailSilhouetteV7 {
  source: 'product' | 'generated' | 'generic';
  pathD: string;
  viewBox: string;
  label: string;
  fidelity: 'exact' | 'approximate' | 'unavailable';
  evidence?: GeometryEvidenceV7;
  reason?: GeometryUnavailableReasonV7;
  manufacturingValidated: false;
}

export type GeometryResolutionV7 =
  | {
      status: 'resolved';
      source: 'registry';
      fidelity: 'exact' | 'approximate';
      evidence: 'signed_off' | 'generated' | 'in_review';
      assetId: string;
      revision: string;
      shape: NailShape;
      length: NailLength;
      finger: FingerCode;
      silhouette: SilhouetteInfo;
      label: string;
      registryAssetSetSha256: string;
      manufacturingValidated: false;
    }
  | {
      status: 'unresolved';
      source: 'generic';
      fidelity: 'unavailable';
      reason: GeometryUnavailableReasonV7;
      assetId: string;
      revision: string;
      shape?: NailShape;
      length?: NailLength;
      finger?: FingerCode;
      fallback: NailSilhouetteV7;
      label: string;
      manufacturingValidated: false;
    };

export const GENERIC_NAIL_SILHOUETTE_V7: NailSilhouetteV7 = {
  source: 'generic',
  pathD: 'M50 5 C74 5 87 20 88 48 L84 120 C82 144 69 155 50 155 C31 155 18 144 16 120 L12 48 C13 20 26 5 50 5 Z',
  viewBox: '0 0 100 160',
  label: '通用甲型轮廓（未关联可用产品几何）',
  fidelity: 'unavailable',
  manufacturingValidated: false,
};

function evidenceOf(capability: EditorShapeCapability): GeometryEvidenceV7 {
  return capability.capabilities.geometry;
}

function buildRegistry(): GeometryRegistryEntryV7[] {
  const entries: GeometryRegistryEntryV7[] = [];
  for (const capability of EDITOR_SHAPE_CAPABILITIES) {
    for (const length of PRODUCT_GEOMETRY_LENGTHS_V7) {
      for (const finger of FINGER_CODES) {
        entries.push({
          assetId: `geometry.${capability.id}.${length}.${finger}`,
          revision: PRODUCT_GEOMETRY_REVISION_V7,
          shape: capability.id,
          length,
          finger,
          evidence: evidenceOf(capability),
          editorCapability: capability.capabilities.editor,
          silhouette: capability.geometry_id ? getSilhouette(capability.geometry_id, length) : null,
        });
      }
    }
  }
  return entries;
}

const REGISTRY = buildRegistry();
const REGISTRY_BY_ASSET = new Map(REGISTRY.map((entry) => [entry.assetId, entry]));
const REGISTRY_BY_EXACT_REF = new Map(REGISTRY.map((entry) => [`${entry.assetId}@${entry.revision}`, entry]));

function unresolved(
  ref: GeometryRefV7,
  reason: GeometryUnavailableReasonV7,
  known?: GeometryRegistryEntryV7,
): GeometryResolutionV7 {
  const reasonLabel: Record<GeometryUnavailableReasonV7, string> = {
    unknown_asset: '未注册的几何引用',
    revision_mismatch: '几何版本与当前注册表不一致',
    finger_mismatch: '几何引用与当前指位不一致',
    silhouette_missing: '几何轮廓资产缺失',
    capability_unavailable: '该甲型尚未开放几何编辑',
  };
  return {
    status: 'unresolved',
    source: 'generic',
    fidelity: 'unavailable',
    reason,
    assetId: ref.assetId,
    revision: ref.revision,
    ...(known ? { shape: known.shape, length: known.length, finger: known.finger } : {}),
    fallback: { ...GENERIC_NAIL_SILHOUETTE_V7, reason },
    label: `${reasonLabel[reason]} · 使用通用轮廓预览`,
    manufacturingValidated: false,
  };
}

/** Exact registry lookup; a familiar-looking asset id never implies validity. */
export function resolveEditorGeometryV7(
  ref: GeometryRefV7,
  expectedFinger: FingerCode,
): GeometryResolutionV7 {
  const known = REGISTRY_BY_ASSET.get(ref.assetId);
  if (!known) return unresolved(ref, 'unknown_asset');
  if (known.finger !== expectedFinger) return unresolved(ref, 'finger_mismatch', known);
  const exact = REGISTRY_BY_EXACT_REF.get(`${ref.assetId}@${ref.revision}`);
  if (!exact) return unresolved(ref, 'revision_mismatch', known);
  if (exact.editorCapability === 'disabled' || exact.evidence === 'placeholder') {
    return unresolved(ref, 'capability_unavailable', exact);
  }
  if (!exact.silhouette) return unresolved(ref, 'silhouette_missing', exact);
  const fidelity = exact.evidence === 'signed_off' ? 'exact' : 'approximate';
  const evidence = exact.evidence === 'signed_off' ? 'signed_off' : exact.evidence;
  return {
    status: 'resolved',
    source: 'registry',
    fidelity,
    evidence,
    assetId: exact.assetId,
    revision: exact.revision,
    shape: exact.shape,
    length: exact.length,
    finger: exact.finger,
    silhouette: structuredClone(exact.silhouette),
    label: fidelity === 'exact'
      ? `${exact.shape} / ${exact.length} · 已签收 2D 产品轮廓`
      : `${exact.shape} / ${exact.length} · 生成轮廓（近似）`,
    registryAssetSetSha256: PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
    manufacturingValidated: false,
  };
}

export function isExactEditorGeometryV7(ref: GeometryRefV7, finger: FingerCode): boolean {
  return resolveEditorGeometryV7(ref, finger).fidelity === 'exact';
}

/** Geometry is part of every visual result, so it can only lower fidelity. */
export function combineGeometryPreviewFidelityV7(
  geometryFidelity: PreviewFidelityV7,
  contentFidelity: PreviewFidelityV7,
): PreviewFidelityV7 {
  const rank: Record<PreviewFidelityV7, number> = { exact: 0, approximate: 1, unavailable: 2 };
  return rank[geometryFidelity] >= rank[contentFidelity] ? geometryFidelity : contentFidelity;
}

export function resolveSignedProductGeometryRefV7(
  shape: NailShape,
  length: NailLength,
  finger: FingerCode,
): GeometryRefV7 | null {
  const ref = { assetId: `geometry.${shape}.${length}.${finger}`, revision: PRODUCT_GEOMETRY_REVISION_V7 };
  return isExactEditorGeometryV7(ref, finger) ? ref : null;
}

export function matchProductSilhouetteRefV7(
  ref: GeometryRefV7,
  expectedFinger: FingerCode,
): { shape: NailShape; length: NailLength; finger: FingerCode; fidelity: 'exact' | 'approximate' } | null {
  const known = REGISTRY_BY_ASSET.get(ref.assetId);
  if (!known) return null;
  const resolved = resolveEditorGeometryV7(ref, expectedFinger);
  return resolved.status === 'resolved'
    ? { shape: resolved.shape, length: resolved.length, finger: resolved.finger, fidelity: resolved.fidelity }
    : null;
}

export function resolveBackgroundSilhouetteV7(
  ref: GeometryRefV7,
  expectedFinger: FingerCode,
): NailSilhouetteV7 {
  const resolved = resolveEditorGeometryV7(ref, expectedFinger);
  if (resolved.status === 'unresolved') return { ...resolved.fallback, label: resolved.label };
  return {
    source: resolved.fidelity === 'exact' ? 'product' : 'generated',
    pathD: resolved.silhouette.pathD,
    viewBox: resolved.silhouette.viewBox,
    label: resolved.label,
    fidelity: resolved.fidelity,
    evidence: resolved.evidence,
    manufacturingValidated: false,
  };
}

/** Read-only registry exposure for tests and diagnostics. */
export function listEditorGeometryRegistryV7(): ReadonlyArray<Omit<GeometryRegistryEntryV7, 'silhouette'> & { silhouetteAvailable: boolean }> {
  return REGISTRY.map(({ silhouette, ...entry }) => ({ ...entry, silhouetteAvailable: silhouette !== null }));
}
