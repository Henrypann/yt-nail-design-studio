/**
 * StudioImportIntent · Community → Studio 解耦合同（PR-02）
 *
 * Community 只发布 Intent；Studio 是唯一消费者。
 * 本模块不 import Wizard / Editor Store。
 */

import { createClientId, readData, removeKey, writeEnvelope, StorageKeys } from '@/lib/storage';
import { Routes } from '@/app/routes';
import type { CommunityContentV1 } from './types';

export const STUDIO_IMPORT_INTENT_TTL_MS = 30 * 60 * 1000;

export interface StudioImportIntentV1 {
  v: 1;
  intentId: string;
  createdAt: string;
  expiresAt: string;
  source: 'COMMUNITY';
  contentId: string;
  publisherId: string;
  assetRef: {
    templateId: string;
    renderTemplateId?: string;
    recipeId?: string;
    assetVersion: string;
  };
  applicationLevel: CommunityContentV1['applicationLevel'];
  suggestedContext?: {
    shape?: string;
    length?: string;
  };
  returnTo?: string;
}

type IntentStore = Record<string, StudioImportIntentV1>;

function readStore(): IntentStore {
  return readData<IntentStore>(StorageKeys.communityStudioImportIntent) ?? {};
}

function writeStore(store: IntentStore): void {
  writeEnvelope(StorageKeys.communityStudioImportIntent, store);
}

/** Allowlisted internal return targets for intent.returnTo / recovery navigation. */
export function isAllowlistedReturnTo(path: string | undefined | null): path is string {
  if (!path || path.startsWith('//') || !path.startsWith('/')) return false;
  if (path === Routes.dashboard) return true;
  if (path.startsWith('/community')) return true;
  if (path.startsWith('/design')) return true;
  return false;
}

export function sanitizeReturnTo(path: string | undefined, fallback: string): string {
  return isAllowlistedReturnTo(path) ? path : fallback;
}

export function clearStudioImportIntent(intentId?: string): void {
  if (!intentId) {
    removeKey(StorageKeys.communityStudioImportIntent);
    return;
  }
  const store = readStore();
  if (!(intentId in store)) return;
  delete store[intentId];
  if (Object.keys(store).length === 0) {
    removeKey(StorageKeys.communityStudioImportIntent);
  } else {
    writeStore(store);
  }
}

export function getStudioImportIntent(intentId: string): StudioImportIntentV1 | null {
  const intent = readStore()[intentId];
  if (!intent || intent.v !== 1) return null;
  if (Date.parse(intent.expiresAt) <= Date.now()) {
    clearStudioImportIntent(intentId);
    return null;
  }
  return intent;
}

/** Test/helper: read raw intent without TTL purge (for expired fixtures). */
export function peekStudioImportIntentRaw(intentId: string): StudioImportIntentV1 | null {
  const intent = readStore()[intentId];
  return intent?.v === 1 ? intent : null;
}

export type CreateIntentResult =
  | { ok: true; intentId: string; href: string }
  | { ok: false; reason: 'inspiration_only' | 'missing_asset' | 'not_published' };

/** Community 发布 Intent 并返回 Studio 深链（永不写 Wizard Store）。 */
export function createStudioImportIntent(input: {
  content: CommunityContentV1;
  returnTo?: string;
  suggestedContext?: { shape?: string; length?: string };
}): CreateIntentResult {
  const { content } = input;
  if (content.status !== 'PUBLISHED') return { ok: false, reason: 'not_published' };
  if (content.applicationLevel === 'INSPIRATION_ONLY') {
    return { ok: false, reason: 'inspiration_only' };
  }
  const asset = content.assetRef;
  if (!asset?.templateId || !asset.assetVersion) {
    return { ok: false, reason: 'missing_asset' };
  }

  const now = Date.now();
  const intentId = createClientId('intent-');
  const fallbackReturn = Routes.communityContent(content.contentId);
  const intent: StudioImportIntentV1 = {
    v: 1,
    intentId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + STUDIO_IMPORT_INTENT_TTL_MS).toISOString(),
    source: 'COMMUNITY',
    contentId: content.contentId,
    publisherId: content.publisherId,
    assetRef: {
      templateId: asset.templateId,
      renderTemplateId: asset.renderTemplateId,
      recipeId: asset.recipeId,
      assetVersion: asset.assetVersion,
    },
    applicationLevel: content.applicationLevel,
    suggestedContext: input.suggestedContext,
    returnTo: sanitizeReturnTo(input.returnTo, fallbackReturn),
  };

  const store = readStore();
  store[intentId] = intent;
  writeStore(store);

  const params = new URLSearchParams();
  params.set('communityIntent', intentId);
  return { ok: true, intentId, href: `${Routes.designNew}?${params.toString()}` };
}

export type IntentValidation =
  | { ok: true; intent: StudioImportIntentV1; content: CommunityContentV1 }
  | {
      ok: false;
      reason:
        | 'missing'
        | 'expired'
        | 'content_mismatch'
        | 'asset_mismatch'
        | 'inspiration_only'
        | 'invalid_return';
    };

/** Studio 消费前：对照最新 content 校验 contentId / assetVersion / templateId。 */
export function validateStudioImportIntent(
  intentId: string,
  content: CommunityContentV1 | null,
): IntentValidation {
  const raw = peekStudioImportIntentRaw(intentId);
  if (!raw || raw.v !== 1) return { ok: false, reason: 'missing' };
  if (Date.parse(raw.expiresAt) <= Date.now()) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'expired' };
  }
  const intent = raw;
  if (intent.returnTo && !isAllowlistedReturnTo(intent.returnTo)) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'invalid_return' };
  }
  if (!content || content.contentId !== intent.contentId) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'content_mismatch' };
  }
  if (content.applicationLevel === 'INSPIRATION_ONLY') {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'inspiration_only' };
  }
  const asset = content.assetRef;
  if (
    !asset ||
    asset.templateId !== intent.assetRef.templateId ||
    asset.assetVersion !== intent.assetRef.assetVersion
  ) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'asset_mismatch' };
  }
  return { ok: true, intent, content };
}

export function canTryInStudio(content: CommunityContentV1): boolean {
  return (
    content.status === 'PUBLISHED' &&
    content.applicationLevel !== 'INSPIRATION_ONLY' &&
    Boolean(content.assetRef?.templateId && content.assetRef.assetVersion)
  );
}
