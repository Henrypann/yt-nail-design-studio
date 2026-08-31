/**
 * Browser composition for S-LOOK Community Look → DesignVersion confirm.
 * Domain stays store-free; this adapter only resolves released DesignVersion
 * authority already used by versioned import, then writes the confirm store.
 */

import type { DesignVersionV1, PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import type { CanonicalPublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import {
  confirmLookAsDesignVersionV1,
  listConfirmedLookDesignVersionsV1,
  parseLookConfirmStoreV1,
  type LookConfirmResultV1,
  type LookConfirmStorageV1,
} from '@/community/domain/v7_1/look-confirm';
import { createClientId, readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import {
  CANONICAL_USE_DEMO_LOOK_ID,
  CANONICAL_USE_DEMO_RELEASE_RECORD_V1,
} from './canonical-use-demo';
import { getFourLookSetAuthorityByLookIdV0_7_2 } from './v0-7-2-four-look-sets';

export function createLookConfirmStorageV1(): LookConfirmStorageV1 {
  return {
    read() {
      return readData<unknown>(StorageKeys.lookConfirmDesignVersions);
    },
    write(next) {
      const parsed = parseLookConfirmStoreV1(next);
      if (!parsed) throw new Error('look confirm store contract failed');
      writeEnvelope(StorageKeys.lookConfirmDesignVersions, parsed);
    },
  };
}

export const lookConfirmStorageV1 = createLookConfirmStorageV1();

export function resolveReleasedDesignVersionForLookV1(look: PublishedLookV1): DesignVersionV1 | null {
  const fourLook = getFourLookSetAuthorityByLookIdV0_7_2(look.lookId);
  const release = fourLook?.release ?? (look.lookId === CANONICAL_USE_DEMO_LOOK_ID
    ? CANONICAL_USE_DEMO_RELEASE_RECORD_V1
    : null);
  if (!release) return null;
  if (release.designVersion.designVersionId !== look.designVersionId) return null;
  return structuredClone(release.designVersion);
}

export function confirmCanonicalLookAsDesignVersionV1(
  look: CanonicalPublishedLookReadModelV1,
  options?: { confirmedByIdentityRef?: string; now?: string; snapshotId?: string },
): LookConfirmResultV1 {
  if (!look.evidence.immutableDesignVersion.present) {
    return { ok: false, reason: 'legacy_missing_design_version', message: 'look has no immutable DesignVersion' };
  }
  const designVersion = resolveReleasedDesignVersionForLookV1(look.sourceLook);
  if (!designVersion) {
    return { ok: false, reason: 'invalid_release', message: 'released DesignVersion is unavailable' };
  }
  if (
    designVersion.designVersionId !== look.evidence.immutableDesignVersion.designVersionId
    || designVersion.editorDocRef.sha256 !== look.evidence.immutableDesignVersion.editorDocRef.sha256
    || designVersion.revision !== look.evidence.immutableDesignVersion.editorDocRef.revision
  ) {
    return { ok: false, reason: 'version_mismatch', message: 'read-model evidence does not match released DesignVersion' };
  }
  return confirmLookAsDesignVersionV1(
    {
      look: look.sourceLook,
      designVersion,
      confirmedByIdentityRef: options?.confirmedByIdentityRef,
    },
    {
      storage: lookConfirmStorageV1,
      nextSnapshotId: () => options?.snapshotId ?? createClientId('look-confirm.'),
      now: () => options?.now ?? new Date().toISOString(),
    },
  );
}

export function readConfirmedLookDesignVersionsV1() {
  return listConfirmedLookDesignVersionsV1(lookConfirmStorageV1);
}
