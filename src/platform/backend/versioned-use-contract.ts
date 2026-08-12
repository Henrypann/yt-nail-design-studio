import type { EditorDocV7 } from '@/studio/editor/v7/model';
import type { LookCustomizeEventV1 } from '@/studio/versioning/versioned-import';
import type { ServiceCommandContextV1, ServiceResultV1 } from './service-contract';

export interface VersionedUseTargetCommandV1 {
  intentId: string;
  sourceLookId: string;
  sourceDesignVersionId: string;
  doc: EditorDocV7;
}

/**
 * Backend-neutral persistence boundary for Community → Studio materialization.
 *
 * The cross-product intent itself is deliberately created synchronously by a
 * browser-local trusted-gesture handoff so the new Studio tab is not blocked.
 * Durable target/event persistence always crosses this authenticated async
 * port and returns a structured service result.
 */
export interface VersionedUsePersistencePortV1 {
  readonly adapterKind: 'LOCAL_PROTOTYPE' | 'REMOTE';
  createTarget(
    context: ServiceCommandContextV1,
    command: VersionedUseTargetCommandV1,
  ): Promise<ServiceResultV1<{ created: boolean; doc: EditorDocV7 }>>;
  recordEvent(
    context: ServiceCommandContextV1,
    event: LookCustomizeEventV1,
  ): Promise<ServiceResultV1<LookCustomizeEventV1>>;
  readEvents(
    context: ServiceCommandContextV1,
  ): Promise<ServiceResultV1<readonly LookCustomizeEventV1[]>>;
}
