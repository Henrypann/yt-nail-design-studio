#!/usr/bin/env node
/**
 * test-community-intent.mjs · StudioImportIntentV1 合同门禁（PR-02）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

/** Minimal localStorage for Node */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    mem.set(k, String(v));
  },
  removeItem: (k) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
};

const {
  STUDIO_IMPORT_INTENT_TTL_MS,
  canTryInStudio,
  clearStudioImportIntent,
  createStudioImportIntent,
  getStudioImportIntent,
  isAllowlistedReturnTo,
  peekStudioImportIntentRaw,
  sanitizeReturnTo,
  validateStudioImportIntent,
} = await import(pathToFileURL(path.join(root, 'src/community/domain/studio-import-intent.ts')).href);

const index = JSON.parse(fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'));
const tryable = index.contents.find(
  (c) => c.status === 'PUBLISHED' && c.applicationLevel === 'STRUCTURED_EDITABLE' && c.assetRef?.templateId,
);
const inspiration = index.contents.find(
  (c) => c.status === 'PUBLISHED' && c.applicationLevel === 'INSPIRATION_ONLY',
);
const missingAsset = index.contents.find(
  (c) => c.status === 'PUBLISHED' && c.applicationLevel === 'APPROXIMATE' && !c.assetRef,
);
assert.ok(tryable, 'need tryable fixture');
assert.ok(inspiration, 'need inspiration fixture');
assert.ok(missingAsset, 'need missing-asset approximate fixture');

assert.equal(canTryInStudio(tryable), true);
assert.equal(canTryInStudio(inspiration), false);
assert.equal(canTryInStudio(missingAsset), false);

assert.equal(isAllowlistedReturnTo('/community/content/x'), true);
assert.equal(isAllowlistedReturnTo('/design/new'), true);
assert.equal(isAllowlistedReturnTo('/'), true);
assert.equal(isAllowlistedReturnTo('https://evil.example'), false);
assert.equal(isAllowlistedReturnTo('//evil'), false);
assert.equal(sanitizeReturnTo('https://evil.example', '/community'), '/community');

mem.clear();
const blocked = createStudioImportIntent({ content: inspiration });
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, 'inspiration_only');

const noAsset = createStudioImportIntent({ content: missingAsset });
assert.equal(noAsset.ok, false);
assert.equal(noAsset.reason, 'missing_asset');

const created = createStudioImportIntent({
  content: tryable,
  returnTo: 'https://evil.example/phish',
  suggestedContext: { shape: tryable.recommendedShapes[0], length: tryable.supportedLengths[0] },
});
assert.equal(created.ok, true);
assert.match(created.href, /communityIntent=/);
const stored = getStudioImportIntent(created.intentId);
assert.ok(stored);
assert.equal(stored.returnTo, `/community/content/${tryable.contentId}`);
assert.equal(stored.assetRef.templateId, tryable.assetRef.templateId);
assert.ok(Date.parse(stored.expiresAt) - Date.parse(stored.createdAt) === STUDIO_IMPORT_INTENT_TTL_MS);

const ok = validateStudioImportIntent(created.intentId, tryable);
assert.equal(ok.ok, true);

const mismatch = validateStudioImportIntent(created.intentId, {
  ...tryable,
  contentId: 'cc_tampered',
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.reason, 'content_mismatch');
assert.equal(getStudioImportIntent(created.intentId), null);

const created2 = createStudioImportIntent({ content: tryable });
assert.equal(created2.ok, true);
const assetMismatch = validateStudioImportIntent(created2.intentId, {
  ...tryable,
  assetRef: { ...tryable.assetRef, assetVersion: '9.9.9' },
});
assert.equal(assetMismatch.ok, false);
assert.equal(assetMismatch.reason, 'asset_mismatch');

const created3 = createStudioImportIntent({ content: tryable });
assert.equal(created3.ok, true);
const raw = peekStudioImportIntentRaw(created3.intentId);
assert.ok(raw);
raw.expiresAt = new Date(Date.now() - 1000).toISOString();
const storeKey = 'nail-studio:community.studio-import-intent';
const envelope = JSON.parse(localStorage.getItem(storeKey));
envelope.data[created3.intentId] = raw;
localStorage.setItem(storeKey, JSON.stringify(envelope));
const expired = validateStudioImportIntent(created3.intentId, tryable);
assert.equal(expired.ok, false);
assert.equal(expired.reason, 'expired');

const created4 = createStudioImportIntent({ content: tryable });
assert.equal(created4.ok, true);
clearStudioImportIntent(created4.intentId);
assert.equal(getStudioImportIntent(created4.intentId), null);
assert.equal(validateStudioImportIntent(created4.intentId, tryable).reason, 'missing');

const created5 = createStudioImportIntent({ content: tryable });
assert.equal(created5.ok, true);
const once = validateStudioImportIntent(created5.intentId, tryable);
assert.equal(once.ok, true);
clearStudioImportIntent(created5.intentId);
assert.equal(validateStudioImportIntent(created5.intentId, tryable).reason, 'missing');

console.log('[test:community-intent] PASS');
