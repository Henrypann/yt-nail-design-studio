/**
 * StudioImportIntent · Community → Studio 解耦合同（PR-02）
 *
 * Community 只发布 Intent；Studio 是唯一消费者。
 * 本模块不 import Wizard / Editor Store。
 */

import { createClientId, readData, removeKey, writeEnvelope, StorageKeys } from '@/lib/storage';
import { Routes } from '@/app/routes';
import type { ApplicationLevel, CommunityContentV1 } from './types';

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

const APPLICATION_LEVELS = new Set<ApplicationLevel>([
  'INSPIRATION_ONLY',
  'APPROXIMATE',
  'STRUCTURED_EDITABLE',
  'REPRODUCIBLE',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeStore(store: IntentStore): void {
  writeEnvelope(StorageKeys.communityStudioImportIntent, store);
}

function readRawStore(): Record<string, unknown> {
  const raw = readData<unknown>(StorageKeys.communityStudioImportIntent);
  if (!isPlainObject(raw)) return {};
  return raw as Record<string, unknown>;
}

/**
 * Runtime schema guard：非法数据不抛异常，返回 typed failure。
 * expectedIntentId：存储 key 必须与对象内 intentId 一致。
 */
export function parseStudioImportIntent(
  value: unknown,
  expectedIntentId?: string,
): { ok: true; intent: StudioImportIntentV1 } | { ok: false; reason: 'invalid' } {
  if (!isPlainObject(value)) return { ok: false, reason: 'invalid' };
  if (value.v !== 1) return { ok: false, reason: 'invalid' };
  if (value.source !== 'COMMUNITY') return { ok: false, reason: 'invalid' };
  if (!isNonEmptyString(value.intentId)) return { ok: false, reason: 'invalid' };
  if (!isNonEmptyString(value.contentId)) return { ok: false, reason: 'invalid' };
  if (!isNonEmptyString(value.publisherId)) return { ok: false, reason: 'invalid' };
  if (expectedIntentId !== undefined && value.intentId !== expectedIntentId) {
    return { ok: false, reason: 'invalid' };
  }

  const createdAtMs = typeof value.createdAt === 'string' ? Date.parse(value.createdAt) : NaN;
  const expiresAtMs = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(expiresAtMs)) {
    return { ok: false, reason: 'invalid' };
  }
  if (expiresAtMs <= createdAtMs) return { ok: false, reason: 'invalid' };

  if (!isPlainObject(value.assetRef)) return { ok: false, reason: 'invalid' };
  if (!isNonEmptyString(value.assetRef.templateId)) return { ok: false, reason: 'invalid' };
  if (!isNonEmptyString(value.assetRef.assetVersion)) return { ok: false, reason: 'invalid' };
  if (
    value.assetRef.renderTemplateId !== undefined &&
    !isNonEmptyString(value.assetRef.renderTemplateId)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (value.assetRef.recipeId !== undefined && !isNonEmptyString(value.assetRef.recipeId)) {
    return { ok: false, reason: 'invalid' };
  }

  if (
    typeof value.applicationLevel !== 'string' ||
    !APPLICATION_LEVELS.has(value.applicationLevel as ApplicationLevel)
  ) {
    return { ok: false, reason: 'invalid' };
  }

  let suggestedContext: StudioImportIntentV1['suggestedContext'];
  if (value.suggestedContext !== undefined) {
    if (!isPlainObject(value.suggestedContext)) return { ok: false, reason: 'invalid' };
    const shape = value.suggestedContext.shape;
    const length = value.suggestedContext.length;
    if (shape !== undefined && typeof shape !== 'string') return { ok: false, reason: 'invalid' };
    if (length !== undefined && typeof length !== 'string') return { ok: false, reason: 'invalid' };
    suggestedContext = {
      shape: typeof shape === 'string' ? shape : undefined,
      length: typeof length === 'string' ? length : undefined,
    };
  }

  let returnTo: string | undefined;
  if (value.returnTo !== undefined) {
    if (typeof value.returnTo !== 'string') return { ok: false, reason: 'invalid' };
    returnTo = value.returnTo;
  }

  const intent: StudioImportIntentV1 = {
    v: 1,
    intentId: value.intentId,
    createdAt: value.createdAt as string,
    expiresAt: value.expiresAt as string,
    source: 'COMMUNITY',
    contentId: value.contentId,
    publisherId: value.publisherId,
    assetRef: {
      templateId: value.assetRef.templateId,
      renderTemplateId:
        typeof value.assetRef.renderTemplateId === 'string'
          ? value.assetRef.renderTemplateId
          : undefined,
      recipeId: typeof value.assetRef.recipeId === 'string' ? value.assetRef.recipeId : undefined,
      assetVersion: value.assetRef.assetVersion,
    },
    applicationLevel: value.applicationLevel as ApplicationLevel,
    suggestedContext,
    returnTo,
  };
  return { ok: true, intent };
}

/**
 * Allowlisted internal return targets.
 * 仅 `/`、`/community`、`/community/...`、`/design`、`/design/...`。
 */
export function isAllowlistedReturnTo(path: string | undefined | null): path is string {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  if (path === '/') return true;
  if (path === '/community' || path.startsWith('/community/')) return true;
  if (path === '/design' || path.startsWith('/design/')) return true;
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
  const store = readRawStore();
  if (!(intentId in store)) return;
  delete store[intentId];
  if (Object.keys(store).length === 0) {
    removeKey(StorageKeys.communityStudioImportIntent);
  } else {
    writeStore(store as IntentStore);
  }
}

export function getStudioImportIntent(intentId: string): StudioImportIntentV1 | null {
  const raw = readRawStore()[intentId];
  if (raw === undefined) return null;
  const parsed = parseStudioImportIntent(raw, intentId);
  if (!parsed.ok) {
    clearStudioImportIntent(intentId);
    return null;
  }
  if (Date.parse(parsed.intent.expiresAt) <= Date.now()) {
    clearStudioImportIntent(intentId);
    return null;
  }
  return parsed.intent;
}

/** Test/helper: read raw after schema guard（不含 TTL purge）。 */
export function peekStudioImportIntentRaw(intentId: string): StudioImportIntentV1 | null {
  const raw = readRawStore()[intentId];
  if (raw === undefined) return null;
  const parsed = parseStudioImportIntent(raw, intentId);
  if (!parsed.ok) {
    clearStudioImportIntent(intentId);
    return null;
  }
  return parsed.intent;
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

  const store = readRawStore();
  store[intentId] = intent;
  writeStore(store as IntentStore);

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
        | 'not_published'
        | 'publisher_mismatch'
        | 'application_level_mismatch'
        | 'asset_mismatch'
        | 'inspiration_only'
        | 'invalid_return'
        | 'invalid';
    };

/** Studio 消费前：对照最新 content 校验 contentId / assetVersion / templateId。 */
export function validateStudioImportIntent(
  intentId: string,
  content: CommunityContentV1 | null,
): IntentValidation {
  const rawEntry = readRawStore()[intentId];
  if (rawEntry === undefined) return { ok: false, reason: 'missing' };

  const parsed = parseStudioImportIntent(rawEntry, intentId);
  if (!parsed.ok) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'invalid' };
  }

  if (Date.parse(parsed.intent.expiresAt) <= Date.now()) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'expired' };
  }

  const intent = parsed.intent;
  if (intent.returnTo && !isAllowlistedReturnTo(intent.returnTo)) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'invalid_return' };
  }
  if (!content || content.contentId !== intent.contentId) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'content_mismatch' };
  }
  if (content.status !== 'PUBLISHED') {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'not_published' };
  }
  if (content.publisherId !== intent.publisherId) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'publisher_mismatch' };
  }
  if (content.applicationLevel === 'INSPIRATION_ONLY') {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'inspiration_only' };
  }
  if (content.applicationLevel !== intent.applicationLevel) {
    clearStudioImportIntent(intentId);
    return { ok: false, reason: 'application_level_mismatch' };
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
