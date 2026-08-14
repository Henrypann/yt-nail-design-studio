/** Browser composition root for COMM-V7.1-04. Domain modules remain store-free. */

import { Routes } from '@/app/routes';
import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import {
  createVersionedStudioImportIntentV2,
} from '@/community/domain/v7_1/versioned-studio-intent';
import {
  BACKEND_OPERATIONS_V1,
  BACKEND_PERMISSIONS_V1,
  createLocalPrototypeIdentityAccessPortV1,
} from '@/platform/backend';
import {
  createLocalVersionedUsePersistencePortV1,
  localTrustedGestureIntentHandoffV2,
  localVersionedIntentPortV2,
} from '@/platform/backend/versioned-use-local-adapter';
import { createBrowserSha256V1 } from '@/studio/versioning/design-release';
import {
  consumeVersionedStudioImportV2,
  type VersionedImportModeV2,
  type VersionedImportResultV2,
} from '@/studio/versioning/versioned-import';
import {
  CANONICAL_USE_DEMO_LOOK_ID,
  CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1,
  CANONICAL_USE_DEMO_RELEASE_RECORD_V1,
} from './canonical-use-demo';
import { creatorWorkspaceServiceV1 } from './backend-runtime';
import {
  getFourLookSetAuthorityByLookIdV0_7_2,
  getFourLookSetAuthorityByVersionIdV0_7_2,
} from './v0-7-2-four-look-sets';

const persistence = createLocalVersionedUsePersistencePortV1();
const persistenceIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'studio.local-versioned-use',
  permissions: [BACKEND_PERMISSIONS_V1.versionedUseRead, BACKEND_PERMISSIONS_V1.versionedUseWrite],
});
export const versionedIntentPortV2 = localVersionedIntentPortV2;

export type CreateVersionedUseIntentResultV1 =
  | { ok: true; intentId: string; href: string }
  | { ok: false; reason: string };

export function createVersionedUseIntentForLookV1(look: PublishedLookV1): CreateVersionedUseIntentResultV1 {
  const fourLookAuthority = getFourLookSetAuthorityByLookIdV0_7_2(look.lookId);
  const release = fourLookAuthority?.release ?? (look.lookId === CANONICAL_USE_DEMO_LOOK_ID
    ? CANONICAL_USE_DEMO_RELEASE_RECORD_V1
    : null);
  if (!release || look.designVersionId !== release.designVersion.designVersionId
    || look.status !== 'PUBLISHED' || look.visibility !== 'PUBLIC') {
    return { ok: false, reason: 'release_unavailable' };
  }
  const result = createVersionedStudioImportIntentV2(
    { look, designVersion: release.designVersion, returnTo: Routes.communityLook(look.lookId) },
    {
      storage: localTrustedGestureIntentHandoffV2.storage,
      nextId: localTrustedGestureIntentHandoffV2.nextIntentId,
      nowMs: localTrustedGestureIntentHandoffV2.nowMs,
    },
  );
  if (!result.ok) return result;
  const query = new URLSearchParams({ versionedIntent: result.intent.intentId });
  return { ok: true, intentId: result.intent.intentId, href: `${Routes.designNew}?${query.toString()}` };
}

function deterministicIds(intentId: string) {
  let node = 0;
  return (scope: 'design' | 'node') => scope === 'design'
    ? `design.remix.${intentId}`
    : `node.remix.${++node}.${intentId}`;
}

export async function readLookCustomizeEventsV1() {
  const readContext = await persistenceIdentity.issueContext({ operation: BACKEND_OPERATIONS_V1.versionedUseRead });
  if (!readContext.ok) return readContext;
  return persistence.readEvents(readContext.value);
}

export async function consumeVersionedUseIntentV2(
  intentId: string,
  mode: VersionedImportModeV2,
): Promise<VersionedImportResultV2> {
  const nextId = deterministicIds(intentId);
  const sha256 = createBrowserSha256V1();
  const result = await consumeVersionedStudioImportV2(intentId, mode, {
    intents: versionedIntentPortV2,
    getLook: async (lookId) => {
      if (lookId === CANONICAL_USE_DEMO_LOOK_ID) return structuredClone(CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1);
      const fourLookAuthority = getFourLookSetAuthorityByLookIdV0_7_2(lookId);
      if (fourLookAuthority) return structuredClone(fourLookAuthority.publishedLook);
      const workspace = await creatorWorkspaceServiceV1.load();
      return workspace.ok
        ? structuredClone(workspace.value.publication.looks.find((look) => look.lookId === lookId && look.status === 'PUBLISHED' && look.visibility === 'PUBLIC') ?? null)
        : null;
    },
    getRelease: async (versionId) => {
      if (versionId === CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId) {
        return structuredClone(CANONICAL_USE_DEMO_RELEASE_RECORD_V1);
      }
      return structuredClone(getFourLookSetAuthorityByVersionIdV0_7_2(versionId)?.release ?? null);
    },
    sha256,
    canReadLook: async (look) => look.visibility === 'PUBLIC' && look.status === 'PUBLISHED',
    assetAvailable: async (asset) => {
      const authorities = [
        CANONICAL_USE_DEMO_RELEASE_RECORD_V1,
        getFourLookSetAuthorityByVersionIdV0_7_2(versionedIntentPortV2.peek(intentId)?.designVersionId ?? '')?.release,
      ].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
      return authorities.some((authority) => authority.designVersion.assetRevisionRefs.some((candidate) => (
        candidate.assetId === asset.assetId && candidate.revision === asset.revision
        && candidate.sha256 === asset.sha256 && candidate.mimeType === asset.mimeType
      )));
    },
    createTarget: async ({ intentId: exactIntentId, doc }) => {
      const writeContext = await persistenceIdentity.issueContext({
        operation: BACKEND_OPERATIONS_V1.versionedUseWrite,
        idempotencyKey: exactIntentId,
      });
      if (!writeContext.ok) return { ok: false as const, message: writeContext.error.reason };
      const sourceIntent = versionedIntentPortV2.peek(exactIntentId);
      if (!sourceIntent) return { ok: false as const, message: 'versioned_use.intent_unavailable' };
      const written = await persistence.createTarget(writeContext.value, {
        intentId: exactIntentId,
        sourceLookId: sourceIntent.lookId,
        sourceDesignVersionId: sourceIntent.designVersionId,
        doc,
      });
      return written.ok
        ? { ok: true as const, created: written.value.created, doc: written.value.doc }
        : { ok: false as const, message: written.error.reason };
    },
    recordEvent: async (event) => {
      const eventContext = await persistenceIdentity.issueContext({
        operation: BACKEND_OPERATIONS_V1.versionedUseWrite,
        idempotencyKey: event.eventId,
      });
      if (!eventContext.ok) return { ok: false as const, retryable: eventContext.error.retryable, message: eventContext.error.reason };
      const saved = await persistence.recordEvent(eventContext.value, event);
      return saved.ok
        ? { ok: true as const }
        : { ok: false as const, retryable: saved.error.retryable, message: saved.error.reason };
    },
    nextId,
    now: () => new Date().toISOString(),
  });
  if (result.ok && result.mode === 'new') {
    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('community:look-customize', { detail: structuredClone(result.event) }));
    }
  }
  return result;
}
