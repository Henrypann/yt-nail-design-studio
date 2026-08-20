#!/usr/bin/env node
/**
 * test-community-studio-flow.mjs · Community Intent 行为门禁（PR-02 review）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = globalThis;
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const { hasEditorDoc, inspectEditorDoc, readEditorDocs } = await import(
  pathToFileURL(path.join(root, 'src/studio/editor/lib/repo.ts')).href
);
const { writeEnvelope, StorageKeys } = await import(
  pathToFileURL(path.join(root, 'src/lib/storage.ts')).href
);
const { detectCommunityIntentConflictFromSnapshot } = await import(
  pathToFileURL(path.join(root, 'src/studio/wizard/community-intent-conflict.ts')).href
);
const { consumeCommunityImportIntent } = await import(
  pathToFileURL(path.join(root, 'src/studio/wizard/community-intent-apply.ts')).href
);
const {
  createStudioImportIntent,
  clearStudioImportIntent,
  getStudioImportIntent,
  peekStudioImportIntentRaw,
  validateStudioImportIntent,
  parseStudioImportIntent,
  isAllowlistedReturnTo,
  sanitizeReturnTo,
} = await import(
  pathToFileURL(path.join(root, 'src/community/domain/studio-import-intent.ts')).href
);

const index = JSON.parse(
  fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'),
);
const tryable = index.contents.find(
  (c) =>
    c.status === 'PUBLISHED' &&
    c.applicationLevel === 'STRUCTURED_EDITABLE' &&
    c.assetRef?.templateId,
);
assert.ok(tryable, 'need tryable fixture');

function fakeTemplate(content) {
  return {
    id: content.assetRef.templateId,
    name: content.title || 'Fixture',
    name_en: content.titleEn || 'Fixture',
    style_tags: [],
    default_base_color: '#F5E0D3',
    default_finish: 'gloss',
    shape_compatibility: {
      highly_compatible: ['almond'],
      neutral: [],
      not_recommended: {},
    },
    thumbnail_url: '/x.png',
    manifest_url: '/x.json',
    sort_order: 1,
  };
}

function makeWizard(initial = {}) {
  const state = {
    status: 'draft',
    designId: 'd_test_clean',
    customer: null,
    appliedShape: null,
    appliedLength: null,
    templateId: null,
    templateName: null,
    step: 1,
    shape: null,
    length: null,
    resetCount: 0,
    applyCount: 0,
    appliedTemplates: [],
    ...initial,
  };
  const editorIds = new Set(initial.editorIds || []);
  return {
    state,
    editorIds,
    api: {
      getSnapshot: () => ({ ...state }),
      hasEditorDoc: (id) => editorIds.has(id),
      resetForNewDesign: () => {
        state.resetCount += 1;
        state.designId = `d_new_${state.resetCount}`;
        state.customer = null;
        state.appliedShape = null;
        state.appliedLength = null;
        state.templateId = null;
        state.templateName = null;
        state.step = 1;
        state.shape = null;
        state.length = null;
        state.status = 'draft';
      },
      setShapeLengthDraft: ({ shape, length, enterStep2 }) => {
        state.shape = shape;
        state.length = length;
        if (enterStep2) {
          state.appliedShape = shape;
          state.appliedLength = length;
          state.step = 2;
        } else {
          state.step = 1;
        }
      },
      applyTemplate: (template) => {
        state.applyCount += 1;
        state.appliedTemplates.push(template.id);
        state.templateId = template.id;
        state.templateName = template.name;
        return true;
      },
    },
    deps(extra = {}) {
      return {
        getContentById: async (id) => (id === tryable.contentId ? structuredClone(tryable) : null),
        loadLibraryIndex: async () => ({ templates: [fakeTemplate(tryable)] }),
        wizard: this.api,
        ...extra,
      };
    },
  };
}

function putIntent(intentId, patch) {
  const key = 'nail-studio:community.studio-import-intent';
  const created = createStudioImportIntent({
    content: tryable,
    returnTo: `/community/content/${tryable.contentId}`,
    suggestedContext: {
      shape: tryable.recommendedShapes?.[0] || 'almond',
      length: tryable.supportedLengths?.[0] || 'short',
    },
  });
  assert.equal(created.ok, true);
  const id = intentId || created.intentId;
  if (intentId && intentId !== created.intentId) {
    // rewrite key
    const env = JSON.parse(localStorage.getItem(key));
    const intent = env.data[created.intentId];
    delete env.data[created.intentId];
    intent.intentId = intentId;
    Object.assign(intent, patch || {});
    env.data[intentId] = intent;
    localStorage.setItem(key, JSON.stringify(env));
    return intentId;
  }
  if (patch) {
    const env = JSON.parse(localStorage.getItem(key));
    Object.assign(env.data[created.intentId], patch);
    localStorage.setItem(key, JSON.stringify(env));
  }
  return created.intentId;
}

function seedEditorDocs(map) {
  writeEnvelope(StorageKeys.editorDocs, map);
}

/* ── Probe / conflict matrix ── */
mem.clear();
assert.equal(inspectEditorDoc('missing').present, false);

seedEditorDocs({
  d_v3: { schemaVersion: 3, designId: 'd_v3' },
  d_v4: { schemaVersion: 4, designId: 'd_v4' },
  d_v5: { schemaVersion: 5, designId: 'd_v5' },
  d_future: { schemaVersion: 9, designId: 'd_future' },
  d_bad: 'not-an-object',
});

assert.deepEqual(inspectEditorDoc('d_v3'), {
  present: true,
  schemaVersion: 3,
  kind: 'supported',
});
assert.deepEqual(inspectEditorDoc('d_v4'), {
  present: true,
  schemaVersion: 4,
  kind: 'supported',
});
assert.deepEqual(inspectEditorDoc('d_v5'), {
  present: true,
  schemaVersion: 5,
  kind: 'supported',
});
assert.deepEqual(inspectEditorDoc('d_future'), {
  present: true,
  schemaVersion: 9,
  kind: 'unsupported',
});
assert.equal(inspectEditorDoc('d_bad').kind, 'invalid');

const before = JSON.stringify(readEditorDocs());
inspectEditorDoc('d_v3');
inspectEditorDoc('d_v4');
assert.equal(JSON.stringify(readEditorDocs()), before);

const cleanSnap = {
  status: 'draft',
  designId: 'd_clean',
  customer: null,
  appliedShape: null,
  templateId: null,
  step: 1,
  shape: null,
  length: null,
};
assert.equal(detectCommunityIntentConflictFromSnapshot(cleanSnap), 'none');
assert.equal(
  detectCommunityIntentConflictFromSnapshot({ ...cleanSnap, designId: 'd_v3' }),
  'editor_doc',
);
assert.equal(
  detectCommunityIntentConflictFromSnapshot({ ...cleanSnap, designId: 'd_v4' }),
  'editor_doc',
);
assert.equal(
  detectCommunityIntentConflictFromSnapshot({ ...cleanSnap, designId: 'd_v5' }),
  'editor_doc',
);
assert.equal(
  detectCommunityIntentConflictFromSnapshot({ ...cleanSnap, designId: 'd_future' }),
  'editor_doc',
);

/* 1) clean apply + clear intent */
mem.clear();
{
  const w = makeWizard();
  const intentId = putIntent();
  const r = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r.ok, true);
  assert.equal(w.state.applyCount, 1);
  assert.equal(getStudioImportIntent(intentId), null);
}

/* 2) wizard draft → current */
mem.clear();
{
  const w = makeWizard({
    appliedShape: 'almond',
    step: 2,
    templateId: 'old',
    designId: 'd_draft',
  });
  const intentId = putIntent();
  assert.equal(detectCommunityIntentConflictFromSnapshot(w.api.getSnapshot()), 'wizard_draft');
  const r = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r.ok, true);
  assert.equal(w.state.resetCount, 0);
  assert.equal(w.state.applyCount, 1);
  assert.equal(getStudioImportIntent(intentId), null);
}

/* 3) wizard draft → new：先 reset 再 apply */
mem.clear();
{
  const w = makeWizard({
    appliedShape: 'almond',
    step: 2,
    templateId: 'old',
    designId: 'd_draft',
  });
  const intentId = putIntent();
  const order = [];
  const origReset = w.api.resetForNewDesign;
  const origApply = w.api.applyTemplate;
  w.api.resetForNewDesign = () => {
    order.push('reset');
    origReset();
  };
  w.api.applyTemplate = (t) => {
    order.push('apply');
    return origApply(t);
  };
  const r = await consumeCommunityImportIntent(intentId, 'new', w.deps());
  assert.equal(r.ok, true);
  assert.deepEqual(order, ['reset', 'apply']);
  assert.equal(w.state.resetCount, 1);
  assert.match(w.state.designId, /^d_new_/);
}

/* 4) cancel 语义：不调用 consume；清除 intent */
mem.clear();
{
  const w = makeWizard({ appliedShape: 'almond', step: 2, templateId: 'old' });
  const intentId = putIntent();
  const beforeApply = w.state.applyCount;
  clearStudioImportIntent(intentId);
  assert.equal(getStudioImportIntent(intentId), null);
  assert.equal(w.state.applyCount, beforeApply);
  assert.equal(w.state.templateId, 'old');
}

/* 5) frozen / current 拒绝 */
mem.clear();
{
  const w = makeWizard({ status: 'confirmed', designId: 'd_frozen' });
  const intentId = putIntent();
  const r = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'frozen');
  assert.equal(w.state.applyCount, 0);
  assert.ok(getStudioImportIntent(intentId));
}

/* 6) existing EditorDoc v3 / current 拒绝 */
mem.clear();
seedEditorDocs({ d_v3: { schemaVersion: 3, designId: 'd_v3' } });
{
  const w = makeWizard({ designId: 'd_v3', editorIds: ['d_v3'] });
  // hasEditorDoc via wizard api uses editorIds; also conflict snapshot uses inspect via detect
  // detectCommunityIntentConflictFromSnapshot uses hasEditorDoc from repo - seed storage
  const intentId = putIntent();
  assert.equal(detectCommunityIntentConflictFromSnapshot(w.api.getSnapshot()), 'editor_doc');
  const r = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'editor_doc');
  assert.equal(w.state.applyCount, 0);
}

/* 7) v4/v5 present as known schemas; future remains unsupported; all conflict */
for (const [id, ver, kind] of [
  ['d_v4', 4, 'supported'],
  ['d_v5', 5, 'supported'],
  ['d_fut', 9, 'unsupported'],
]) {
  mem.clear();
  seedEditorDocs({ [id]: { schemaVersion: ver, designId: id } });
  assert.equal(inspectEditorDoc(id).kind, kind);
  assert.equal(
    detectCommunityIntentConflictFromSnapshot({ ...cleanSnap, designId: id }),
    'editor_doc',
  );
}

/* 8) Modal 打开后 Intent 过期 → current/new 不得改 store */
mem.clear();
{
  const w = makeWizard({ appliedShape: 'almond', step: 2, templateId: 'old' });
  const intentId = putIntent();
  const env = JSON.parse(localStorage.getItem('nail-studio:community.studio-import-intent'));
  env.data[intentId].createdAt = new Date(Date.now() - 60_000).toISOString();
  env.data[intentId].expiresAt = new Date(Date.now() - 1000).toISOString();
  localStorage.setItem('nail-studio:community.studio-import-intent', JSON.stringify(env));
  const before = { ...w.state, applyCount: w.state.applyCount, templateId: w.state.templateId };
  const r = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'validation');
  assert.equal(r.validationReason, 'expired');
  assert.equal(w.state.applyCount, before.applyCount);
  assert.equal(w.state.templateId, before.templateId);
  assert.equal(getStudioImportIntent(intentId), null);
}

/* 9) Modal 打开后 assetVersion 变化 */
mem.clear();
{
  const w = makeWizard({ appliedShape: 'almond', step: 2, templateId: 'old' });
  const intentId = putIntent();
  const mutated = {
    ...structuredClone(tryable),
    assetRef: { ...tryable.assetRef, assetVersion: '99.0.0-changed' },
  };
  const r = await consumeCommunityImportIntent(
    intentId,
    'current',
    w.deps({ getContentById: async () => mutated }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'validation');
  assert.equal(r.validationReason, 'asset_mismatch');
  assert.equal(w.state.applyCount, 0);
  assert.equal(w.state.templateId, 'old');
}

/* 10) loadLibraryIndex reject：无部分写入、无未捕获 */
mem.clear();
{
  const w = makeWizard();
  const intentId = putIntent();
  let unhandled = 0;
  const onRej = () => {
    unhandled += 1;
  };
  process.on('unhandledRejection', onRej);
  const r = await consumeCommunityImportIntent(
    intentId,
    'current',
    w.deps({
      loadLibraryIndex: async () => {
        throw new Error('network boom');
      },
    }),
  );
  await new Promise((r) => setTimeout(r, 20));
  process.off('unhandledRejection', onRej);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'load_failed');
  assert.equal(w.state.applyCount, 0);
  assert.equal(w.state.resetCount, 0);
  assert.ok(getStudioImportIntent(intentId), 'intent kept for retry');
  assert.equal(unhandled, 0);
}

/* 11) malformed intents */
mem.clear();
{
  const key = 'nail-studio:community.studio-import-intent';
  const writeBad = (id, data) => {
    writeEnvelope(StorageKeys.communityStudioImportIntent, { [id]: data });
  };

  writeBad('bad1', {
    v: 1,
    intentId: 'bad1',
    source: 'COMMUNITY',
    contentId: 'x',
    publisherId: 'p',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    applicationLevel: 'STRUCTURED_EDITABLE',
    // missing assetRef
  });
  assert.equal(parseStudioImportIntent(JSON.parse(localStorage.getItem(key)).data.bad1, 'bad1').ok, false);
  assert.equal(validateStudioImportIntent('bad1', tryable).reason, 'invalid');
  assert.equal(getStudioImportIntent('bad1'), null);

  writeBad('bad2', {
    v: 1,
    intentId: 'bad2',
    source: 'COMMUNITY',
    contentId: tryable.contentId,
    publisherId: 'p',
    createdAt: 'not-a-date',
    expiresAt: 'also-bad',
    applicationLevel: 'STRUCTURED_EDITABLE',
    assetRef: { templateId: 't', assetVersion: '1' },
  });
  assert.equal(validateStudioImportIntent('bad2', tryable).reason, 'invalid');

  writeBad('bad3', {
    v: 1,
    intentId: 'other-id',
    source: 'COMMUNITY',
    contentId: tryable.contentId,
    publisherId: 'p',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    applicationLevel: 'STRUCTURED_EDITABLE',
    assetRef: { templateId: tryable.assetRef.templateId, assetVersion: tryable.assetRef.assetVersion },
  });
  assert.equal(validateStudioImportIntent('bad3', tryable).reason, 'invalid');

  writeBad('bad4', {
    v: 1,
    intentId: 'bad4',
    source: 'HACKER',
    contentId: tryable.contentId,
    publisherId: 'p',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    applicationLevel: 'STRUCTURED_EDITABLE',
    assetRef: { templateId: tryable.assetRef.templateId, assetVersion: tryable.assetRef.assetVersion },
  });
  assert.equal(validateStudioImportIntent('bad4', tryable).reason, 'invalid');
}

/* 12) returnTo 边界 */
assert.equal(isAllowlistedReturnTo('/'), true);
assert.equal(isAllowlistedReturnTo('/community'), true);
assert.equal(isAllowlistedReturnTo('/community/content/x'), true);
assert.equal(isAllowlistedReturnTo('/design'), true);
assert.equal(isAllowlistedReturnTo('/design/new'), true);
assert.equal(isAllowlistedReturnTo('/look/x'), true);
assert.equal(isAllowlistedReturnTo('/studio/design/new'), true);
assert.equal(isAllowlistedReturnTo('/community-evil'), false);
assert.equal(isAllowlistedReturnTo('/designer'), false);
assert.equal(isAllowlistedReturnTo('//host'), false);
assert.equal(isAllowlistedReturnTo('https://evil'), false);
assert.equal(isAllowlistedReturnTo('community'), false);
assert.equal(sanitizeReturnTo('/community-evil', '/community'), '/community');

/* 13) 重复消费不能重复 apply */
mem.clear();
{
  const w = makeWizard();
  const intentId = putIntent();
  const r1 = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r1.ok, true);
  const r2 = await consumeCommunityImportIntent(intentId, 'current', w.deps());
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'validation');
  assert.equal(w.state.applyCount, 1);
}

/* 14) template missing：终止消费、不写 Wizard、清除 Intent */
mem.clear();
{
  const w = makeWizard({ appliedShape: 'almond', step: 2, templateId: 'old' });
  const intentId = putIntent();
  const r = await consumeCommunityImportIntent(
    intentId,
    'new',
    w.deps({ loadLibraryIndex: async () => ({ templates: [] }) }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'template_missing');
  assert.equal(w.state.resetCount, 0);
  assert.equal(w.state.applyCount, 0);
  assert.equal(w.state.templateId, 'old');
  assert.equal(getStudioImportIntent(intentId), null);
}

console.log('[test:community-studio-flow] PASS');
