import registryRaw from '../../../../material-library/template-pattern-assets.v7.json' with { type: 'json' };
import type { NailShape } from '@/generated/shape-types';
import type { AssetRefV7 } from './model';

interface OfficialTemplatePatternEntryV7 {
  templateId: string;
  shape: NailShape;
  assetId: string;
  revision: string;
  sha256: string;
}

/**
 * Community assetVersion is a published bundle/source version, not the
 * renderer manifest version and therefore must not be compared to revision.
 * This table is deliberately explicit for mappings where the published
 * source was regenerated without changing its public assetVersion.
 */
const COMMUNITY_TEMPLATE_MAPPING: Record<string, { renderTemplateId: string; revisions: Record<string, string> }> = {
  t_petal_veil_french: { renderTemplateId: 't_petal_veil_french', revisions: { '1.0.0': 'template-v2' } },
  t_mercury_dew_concept: { renderTemplateId: 't_liquid_velvet_cat_eye', revisions: { '1.0.0': 'template-v1' } },
};

const entries = registryRaw.assets as OfficialTemplatePatternEntryV7[];

export interface OfficialTemplatePatternIdentityV7 {
  templateId: string;
  shape: NailShape;
}

export function assetRefV7Equal(a: AssetRefV7 | null | undefined, b: AssetRefV7 | null | undefined): boolean {
  if (!a || !b) return a === b;
  return a.assetId === b.assetId
    && a.revision === b.revision
    && a.kind === b.kind
    && a.mimeType === b.mimeType
    && a.sha256 === b.sha256
    && a.widthPx === b.widthPx
    && a.heightPx === b.heightPx
    && a.colorSpace === b.colorSpace
    && a.alphaMode === b.alphaMode;
}

export function getOfficialTemplatePatternAssetV7(
  templateId: string,
  shape: NailShape,
): AssetRefV7 | null {
  const entry = entries.find((candidate) => candidate.templateId === templateId && candidate.shape === shape);
  if (!entry) return null;
  return {
    assetId: entry.assetId,
    revision: entry.revision,
    kind: 'vector',
    mimeType: 'image/svg+xml',
    sha256: entry.sha256,
    colorSpace: 'srgb',
    alphaMode: 'straight',
  };
}

export function getOfficialTemplatePatternAssetForCommunityVersionV7(
  templateId: string,
  shape: NailShape,
  assetVersion: string,
): AssetRefV7 | null {
  const mapping = COMMUNITY_TEMPLATE_MAPPING[templateId];
  if (!mapping) return null;
  const resolvedTemplateId = mapping.renderTemplateId;
  const expectedRevision = mapping.revisions[assetVersion] ?? null;
  if (!expectedRevision) return null;
  const entry = entries.find((candidate) => (
    candidate.templateId === resolvedTemplateId &&
    candidate.shape === shape &&
    candidate.revision === expectedRevision
  ));
  if (!entry) return null;
  return {
    assetId: entry.assetId,
    revision: entry.revision,
    kind: 'vector',
    mimeType: 'image/svg+xml',
    sha256: entry.sha256,
    colorSpace: 'srgb',
    alphaMode: 'straight',
  };
}

export function identifyOfficialTemplatePatternV7(
  asset: AssetRefV7,
): OfficialTemplatePatternIdentityV7 | null {
  const entry = entries.find((candidate) => (
    candidate.assetId === asset.assetId &&
    candidate.revision === asset.revision &&
    candidate.sha256 === asset.sha256
  ));
  if (!entry || asset.kind !== 'vector' || asset.mimeType !== 'image/svg+xml') return null;
  return { templateId: entry.templateId, shape: entry.shape };
}

export const OFFICIAL_TEMPLATE_PATTERN_ASSET_COUNT_V7 = entries.length;
