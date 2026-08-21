import type { NailShape } from '@/generated/shape-types';
import { getOfficialTemplatePatternAssetV7, identifyOfficialTemplatePatternV7 } from '@/studio/editor/v7/official-template-assets';
import { parseOfficialStarterShelfEntryV1, STARTER_SHELF_CANDIDATE_IDS, type OfficialStarterShelfEntryV1 } from './read-model-v1';
import type { AssetRefV7 } from '@/studio/editor/v7/model';

export type StarterAssetPreflightTechnicalStatusV1 = 'EXACT' | 'UNAVAILABLE';
export type StarterAssetPreflightAssetRefV1 = {
  assetId: string;
  revision: string;
  sha256: string;
  kind: 'vector';
  mimeType: 'image/svg+xml';
  path: string;
};
export type StarterAssetPreflightV1 = {
  technicalStatus: StarterAssetPreflightTechnicalStatusV1;
  usageScope: 'LOCAL_CONCEPT_DRAFT_ONLY';
  rightsStatus: 'PENDING';
  promotionStatus: 'BLOCKED';
  manufacturingValidated: false;
  diagnostics: string[];
  assetRef: StarterAssetPreflightAssetRefV1 | null;
};

const SHAPES: readonly NailShape[] = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const EXPECTED_RENDER_TEMPLATE_IDS: Record<string, string> = {
  t_petal_pearl_bloom_simulated: 't_petal_pearl_bloom_simulated',
  t_mercury_dew_concept: 't_liquid_velvet_cat_eye',
  t_pearl_tide_shell_concept: 't_3d_waterdrop',
  t_micro_coquette_concept: 't_french_white',
  t_starfish_bloom_elegance_concept: 't_3d_waterdrop',
  t_sea_glass_chrome_concept: 't_liquid_velvet_cat_eye',
  t_sunset_aura_glaze_concept: 't_nude_gradient',
  t_liquid_chrome_statement_concept: 't_chrome_mirror',
  t_butter_glaze_quiet_concept: 't_nude_gradient',
  t_petal_veil_french: 't_petal_veil_french',
};
const OUTPUT_KEYS = ['assetRef', 'diagnostics', 'manufacturingValidated', 'promotionStatus', 'rightsStatus', 'technicalStatus', 'usageScope'];
const ASSET_REF_KEYS = ['assetId', 'kind', 'mimeType', 'path', 'revision', 'sha256'];
const SHA256 = /^[a-f0-9]{64}$/;

export type StarterAssetByteLoaderV1 = (path: string) => Promise<Uint8Array>;

function unavailable(diagnostics: string[]): StarterAssetPreflightV1 {
  return {
    technicalStatus: 'UNAVAILABLE',
    usageScope: 'LOCAL_CONCEPT_DRAFT_ONLY',
    rightsStatus: 'PENDING',
    promotionStatus: 'BLOCKED',
    manufacturingValidated: false,
    diagnostics,
    assetRef: null,
  };
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function parseOutput(value: unknown): StarterAssetPreflightV1 | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = value as Record<string, unknown>;
  if (!exactKeys(output, OUTPUT_KEYS) || !['EXACT', 'UNAVAILABLE'].includes(output.technicalStatus as string)
    || output.usageScope !== 'LOCAL_CONCEPT_DRAFT_ONLY' || output.rightsStatus !== 'PENDING'
    || output.promotionStatus !== 'BLOCKED' || output.manufacturingValidated !== false
    || !Array.isArray(output.diagnostics) || !output.diagnostics.every((item) => typeof item === 'string' && item.length > 0)) return null;
  if (output.technicalStatus === 'UNAVAILABLE' && (output.assetRef !== null || output.diagnostics.length === 0)) return null;
  if (output.technicalStatus === 'EXACT' && output.diagnostics.length !== 0) return null;
  if (output.technicalStatus === 'EXACT' && (output.assetRef === null || typeof output.assetRef !== 'object' || Array.isArray(output.assetRef))) return null;
  if (output.assetRef !== null) {
    const ref = output.assetRef as Record<string, unknown>;
    if (!exactKeys(ref, ASSET_REF_KEYS) || typeof ref.assetId !== 'string' || typeof ref.revision !== 'string'
      || typeof ref.path !== 'string' || ref.kind !== 'vector' || ref.mimeType !== 'image/svg+xml' || !SHA256.test(String(ref.sha256))) return null;
  }
  return output as unknown as StarterAssetPreflightV1;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('web_crypto_unavailable');
  const digest = await subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify one already-governed shelf candidate. This function has no storage or
 * network dependency; the caller owns the byte loader and receives no fallback
 * asset when any identity or digest check fails.
 */
export async function preflightOfficialStarterAssetV1(input: {
  entry: OfficialStarterShelfEntryV1;
  shape: NailShape;
  loadBytes: StarterAssetByteLoaderV1;
  resolveRegistry?: (templateId: string, shape: NailShape) => { assetId: string; revision: string; sha256: string; kind: string; mimeType: string } | null;
}): Promise<StarterAssetPreflightV1> {
  const { entry, shape, loadBytes } = input;
  if (!parseOfficialStarterShelfEntryV1(entry) || !SHAPES.includes(shape) || typeof loadBytes !== 'function') return unavailable(['INVALID_PREFLIGHT_INPUT']);
  if (entry.rightsStatus !== 'PENDING' || entry.promotionStatus !== 'BLOCKED') return unavailable(['GOVERNANCE_UNLOCK_REJECTED']);
  if (!entry.candidateOnlyLabels.includes('CANDIDATE_ONLY') || !entry.candidateOnlyLabels.includes('RIGHTS_PENDING')
    || !entry.candidateOnlyLabels.includes('PROMOTION_BLOCKED')) return unavailable(['CANDIDATE_LABELS_INVALID']);
  if (!entry.blockingCodes.includes('RIGHTS_EVIDENCE_MISSING') || !entry.blockingCodes.includes('PROMOTION_NOT_AUTHORIZED')) return unavailable(['GOVERNANCE_BLOCKERS_MISSING']);
  if (!STARTER_SHELF_CANDIDATE_IDS.includes(entry.assetId as typeof STARTER_SHELF_CANDIDATE_IDS[number])
    || entry.assetId.includes('/') || entry.assetId.includes('..')
    || !entry.renderTemplateId || entry.renderTemplateId.includes('/') || entry.renderTemplateId.includes('..')) return unavailable(['CANDIDATE_SOURCE_ID_INVALID']);
  const expectedRenderTemplateId = EXPECTED_RENDER_TEMPLATE_IDS[entry.assetId];
  if (entry.renderTemplateId !== expectedRenderTemplateId) return unavailable(['CANDIDATE_RENDER_MAPPING_MISMATCH']);
  if (entry.assetId === 't_petal_pearl_bloom_simulated') return unavailable(['UNAVAILABLE_FOR_TEMPLATE_PREFLIGHT']);
  const resolveRegistry = input.resolveRegistry ?? getOfficialTemplatePatternAssetV7;
  const registryAsset = resolveRegistry(entry.renderTemplateId, shape);
  if (!registryAsset) return unavailable(['UNAVAILABLE_FOR_TEMPLATE_PREFLIGHT']);
  if (registryAsset.assetId !== `asset.template-pattern.${entry.renderTemplateId}.${shape}`
    || typeof registryAsset.revision !== 'string' || !/^template-v\d+$/.test(registryAsset.revision)
    || registryAsset.kind !== 'vector' || registryAsset.mimeType !== 'image/svg+xml' || !SHA256.test(registryAsset.sha256)) return unavailable(['REGISTRY_ASSET_IDENTITY_INVALID']);
  const registryIdentity = identifyOfficialTemplatePatternV7(registryAsset as AssetRefV7);
  if (!registryIdentity || registryIdentity.templateId !== entry.renderTemplateId || registryIdentity.shape !== shape) return unavailable(['REGISTRY_ASSET_IDENTITY_INVALID']);
  const path = `material-library/templates/${entry.renderTemplateId}/patterns/${shape}.svg`;
  if (path.includes('..') || !path.startsWith('material-library/templates/')) return unavailable(['ASSET_PATH_INVALID']);
  const assetRef: StarterAssetPreflightAssetRefV1 = {
    assetId: registryAsset.assetId,
    revision: registryAsset.revision,
    sha256: registryAsset.sha256,
    kind: 'vector',
    mimeType: 'image/svg+xml',
    path,
  };
  try {
    const bytes = await loadBytes(path);
    if (!(bytes instanceof Uint8Array)) return unavailable(['ASSET_BYTES_INVALID']);
    const actualSha = await sha256Hex(bytes);
    if (actualSha !== assetRef.sha256) return unavailable(['ASSET_SHA256_MISMATCH']);
    return parseOutput({
      technicalStatus: 'EXACT', usageScope: 'LOCAL_CONCEPT_DRAFT_ONLY', rightsStatus: 'PENDING', promotionStatus: 'BLOCKED',
      manufacturingValidated: false, diagnostics: [], assetRef,
    }) as StarterAssetPreflightV1;
  } catch (error) {
    return unavailable([error instanceof Error && error.message === 'web_crypto_unavailable' ? 'WEB_CRYPTO_UNAVAILABLE' : 'ASSET_BYTES_UNAVAILABLE']);
  }
}

export function parseStarterAssetPreflightV1(value: unknown): StarterAssetPreflightV1 | null {
  return parseOutput(value);
}
