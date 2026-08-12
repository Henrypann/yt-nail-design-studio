import type { PublishedLookReadModelV1 } from './v7_1/published-look-read-model';

export type StudioUseAvailabilityStateV1 =
  | 'VERSIONED_READY'
  | 'LEGACY_READY'
  | 'LEGACY_APPROXIMATE'
  | 'ASSETS_INCOMPLETE'
  | 'INSPIRATION_ONLY'
  | 'VERSION_UNAVAILABLE';

export interface StudioUseAvailabilityV1 {
  enabled: boolean;
  state: StudioUseAvailabilityStateV1;
}

/**
 * Community UI-only capability projection. This never probes the network and
 * never upgrades a missing asset into a usable Studio intent.
 */
export function resolveStudioUseAvailabilityV1(
  look: PublishedLookReadModelV1,
): StudioUseAvailabilityV1 {
  if (look.applicationLevel === 'INSPIRATION_ONLY') {
    return { enabled: false, state: 'INSPIRATION_ONLY' };
  }
  if (look.readModelKind === 'CANONICAL') {
    const ready = look.sourceLook.status === 'PUBLISHED'
      && look.sourceLook.visibility === 'PUBLIC'
      && look.evidence.immutableDesignVersion.present
      && look.evidence.previewEvidence.present
      && look.evidence.publicationGate.present;
    return ready
      ? { enabled: true, state: 'VERSIONED_READY' }
      : { enabled: false, state: 'VERSION_UNAVAILABLE' };
  }

  const asset = look.assetRef;
  if (!asset?.templateId || !asset.assetVersion || !asset.manifestUrl) {
    return { enabled: false, state: 'ASSETS_INCOMPLETE' };
  }

  return look.applicationLevel === 'APPROXIMATE'
    ? { enabled: true, state: 'LEGACY_APPROXIMATE' }
    : { enabled: true, state: 'LEGACY_READY' };
}
