import type {
  CommunityLookAssetCapabilityReadModelV1,
  CommunityLookCapabilityStateV1,
} from './asset-capability-v1';

export type StudioUseAvailabilityStateV1 = CommunityLookCapabilityStateV1;

export interface StudioUseAvailabilityV1 {
  enabled: boolean;
  state: StudioUseAvailabilityStateV1;
}

/**
 * Deprecated compatibility helper. Capability is now an explicit
 * COMM-ASSET-03 read model; this helper maps it to the former enabled/state
 * shape without consulting PublishedLook applicationLevel/verificationLevel.
 */
export function resolveStudioUseAvailabilityV1(
  capability: CommunityLookAssetCapabilityReadModelV1 | null,
): StudioUseAvailabilityV1 {
  if (!capability) return { enabled: false, state: 'UNAVAILABLE' };
  return {
    enabled: capability.cta === 'USE_VERSIONED' || capability.cta === 'USE_LEGACY_APPROXIMATE',
    state: capability.capabilityState,
  };
}
