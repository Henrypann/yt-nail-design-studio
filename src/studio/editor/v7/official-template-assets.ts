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

const entries = registryRaw.assets as OfficialTemplatePatternEntryV7[];

export interface OfficialTemplatePatternIdentityV7 {
  templateId: string;
  shape: NailShape;
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
