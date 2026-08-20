#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = { localStorage, sessionStorage, setTimeout, clearTimeout };

const { StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');
const {
  getOfficialTemplatePatternAssetForCommunityVersionV7,
  getOfficialTemplatePatternAssetV7,
} = await import('../src/studio/editor/v7/official-template-assets.ts');
const {
  parseWizardRecoveryDraftV2,
  readWizardRecoveryDraft,
  toWizardRecoveryDraftV2,
  writeWizardRecoveryDraftV2,
} = await import('../src/studio/wizard/wizard-draft.ts');
const { wizardDesignToEditorDocV7 } = await import('../src/studio/editor/v7/create.ts');
const { consumeCommunityImportIntent } = await import('../src/studio/wizard/community-intent-apply.ts');
const { createStudioImportIntent, peekStudioImportIntentRaw } = await import('../src/community/domain/studio-import-intent.ts');

const asset = getOfficialTemplatePatternAssetV7('t_petal_veil_french', 'almond');
assert.ok(asset, 'registered exact asset');
assert.equal(getOfficialTemplatePatternAssetForCommunityVersionV7('t_petal_veil_french', 'almond', '1.0.0')?.revision, 'template-v2');
assert.equal(getOfficialTemplatePatternAssetForCommunityVersionV7('t_petal_veil_french', 'almond', 'template-v2'), null, 'bundle version is not renderer revision');
assert.equal(getOfficialTemplatePatternAssetForCommunityVersionV7('t_mercury_dew_concept', 'almond', '1.0.0')?.revision, 'template-v1');

const source = {
  designId: 'd_provenance', step: 2, customer: { id: 'customer-1' }, shape: 'almond', length: 'medium',
  styleId: null, styleName: null, stylePrompted: false, appliedShape: 'almond', appliedLength: 'medium',
  templateId: 't_petal_veil_french', templateName: 'Petal Veil', templateAssetRef: asset,
  communitySourceRef: { intentId: 'intent-1', contentId: 'cc_petal_veil', publisherId: 'pub-1', sourceTemplateId: 't_petal_veil_french', assetVersion: '1.0.0', applicationLevel: 'APPROXIMATE' },
  source: { kind: 'community_legacy', intentId: 'intent-1', contentId: 'cc_petal_veil', publisherId: 'pub-1', sourceTemplateId: 't_petal_veil_french', applicationLevel: 'APPROXIMATE', assetVersion: '1.0.0', templateId: 't_petal_veil_french', shape: 'almond', asset },
  baseColor: '#F2E4DA', finish: 'gloss', fingerOverrides: {}, createdAt: '2026-08-20T00:00:00.000Z',
  version: 1, status: 'draft',
};
const migrated = toWizardRecoveryDraftV2(source);
assert.equal(migrated.schemaVersion, 2);
assert.deepEqual(parseWizardRecoveryDraftV2(migrated), migrated);
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, unknown: true }), null, 'unknown top-level key rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, templateAssetRef: { ...asset, sha256: '0'.repeat(64) } }), null, 'wrong SHA rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, templateAssetRef: { sha256: asset.sha256, alphaMode: asset.alphaMode, colorSpace: asset.colorSpace, mimeType: asset.mimeType, kind: asset.kind, revision: asset.revision, assetId: asset.assetId }, source: { ...migrated.source, asset: { sha256: asset.sha256, alphaMode: asset.alphaMode, colorSpace: asset.colorSpace, mimeType: asset.mimeType, kind: asset.kind, revision: asset.revision, assetId: asset.assetId } } })?.designId, migrated.designId, 'asset property order is semantic');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, templateAssetRef: { ...asset, sha256: asset.sha256.toUpperCase() }, source: { ...migrated.source, asset: { ...asset, sha256: asset.sha256.toUpperCase() } } }), null, 'uppercase SHA rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, templateId: null, templateAssetRef: null }), null, 'template/source identity mismatch rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, templateId: 't_liquid_velvet_cat_eye' }), null, 'top-level template B/source template A rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, appliedShape: 'oval' }), null, 'shape/source identity mismatch rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, communitySourceRef: { ...migrated.communitySourceRef, assetVersion: '2.0.0' } }), null, 'community provenance mismatch rejected');
assert.equal(parseWizardRecoveryDraftV2({ ...migrated, source: { ...migrated.source, sourceTemplateId: 't_liquid_velvet_cat_eye' } }), null, 'forged Community source template rejected');

const blankDraft = { ...migrated, templateId: null, templateName: null, templateAssetRef: null, source: { kind: 'blank' }, communitySourceRef: undefined, customerId: null };
const parsedBlank = parseWizardRecoveryDraftV2(blankDraft);
assert.ok(parsedBlank, 'blank draft remains valid');
assert.equal(parsedBlank.source.kind, 'blank');
assert.equal(parseWizardRecoveryDraftV2({ ...blankDraft, source: { kind: 'customer', customerId: 'customer-2' } }), null, 'customer source cannot omit matching customer');
assert.equal(parseWizardRecoveryDraftV2({ ...blankDraft, customerId: 'customer-2' }), null, 'customerId requires customer source');

writeWizardRecoveryDraftV2(source);
assert.equal(readWizardRecoveryDraft().ok, true);
const before = localStorage.getItem('nail-studio:wizard.active-draft');
writeEnvelope(StorageKeys.wizardDraft, { ...migrated, status: 'confirmed', confirmation: { confirmedAt: '2026-08-20T00:00:00.000Z', confirmedBy: 'test' } });
const confirmed = readWizardRecoveryDraft();
assert.equal(confirmed.ok, true, 'V2 confirmed remains readable as historical data');
writeEnvelope(StorageKeys.wizardDraft, { ...migrated, schemaVersion: 1, status: 'confirmed', confirmation: { confirmedAt: '2026-08-20T00:00:00.000Z', confirmedBy: 'test' } });
const legacyConfirmed = readWizardRecoveryDraft();
assert.equal(legacyConfirmed.ok, false);
assert.equal(legacyConfirmed.code, 'confirmed_legacy');
assert.notEqual(localStorage.getItem('nail-studio:wizard.active-draft'), null, 'failed migration preserves storage');
assert.notEqual(before, null);
writeEnvelope(StorageKeys.wizardDraft, { schemaVersion: 99, designId: 'future' });
assert.equal(readWizardRecoveryDraft().ok, false);
assert.notEqual(localStorage.getItem('nail-studio:wizard.active-draft'), null, 'production reader preserves invalid storage');

const design = {
  id: 'd_provenance', customerId: 'customer-1', title: 'Petal Veil', shape: 'almond', length: 'medium',
  templateId: 't_petal_veil_french', templateAssetRef: asset,
  communitySourceRef: { intentId: 'intent-1', contentId: 'cc_petal_veil', publisherId: 'pub-1', sourceTemplateId: 't_petal_veil_french', assetVersion: '1.0.0', applicationLevel: 'APPROXIMATE' }, baseColor: '#F2E4DA', finish: 'gloss',
  status: 'draft', source: 'wizard', version: 1, createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z',
};
const created = wizardDesignToEditorDocV7(design, '2026-08-20T00:00:00.000Z');
assert.equal(created.ok, true);
if (created.ok) {
  assert.deepEqual(created.doc.sourceRefs, [
    { domain: 'wizard', sourceId: 'd_provenance', revision: '1' },
    { domain: 'community', sourceId: 'cc_petal_veil', revision: '1.0.0' },
  ]);
}

const contentIndex = JSON.parse(await readFile(new URL('../public/community/content-index.json', import.meta.url), 'utf8'));
const libraryIndex = JSON.parse(await readFile(new URL('../material-library/index.json', import.meta.url), 'utf8'));
const content = contentIndex.contents.find((item) => item.contentId === 'cc_petal_veil');
assert.ok(content, 'real legacy content fixture');
const makeWizard = (fixture = content) => {
  const state = { status: 'draft', designId: 'd_consume', appliedShape: null, applyCount: 0 };
  const libraryTemplate = libraryIndex.templates.find((entry) => entry.id === fixture.assetRef.templateId);
  assert.ok(libraryTemplate, `real library template ${fixture.assetRef.templateId}`);
  return {
    state,
    deps: {
      getContentById: async (id) => id === fixture.contentId ? structuredClone(fixture) : null,
      loadLibraryIndex: async () => ({ templates: [structuredClone(libraryTemplate)] }),
      wizard: {
        getSnapshot: () => ({ ...state }),
        hasEditorDoc: () => false,
        resetForNewDesign: () => { state.designId = 'd_new'; },
        setShapeLengthDraft: ({ shape, length }) => { state.appliedShape = shape; state.length = length; },
        applyTemplate: (_template, options) => {
          state.applyCount += 1;
          state.templateId = _template.render_template_id ?? _template.id;
          state.templateAssetRef = options?.exactAsset;
          state.communitySourceRef = options?.communitySourceRef;
          state.snapshots = [...(state.snapshots ?? []), structuredClone(state)];
          return true;
        },
      },
    },
  };
};
memory.clear();
{
  const createdIntent = createStudioImportIntent({ content, suggestedContext: { shape: 'almond', length: 'medium' } });
  assert.equal(createdIntent.ok, true);
  const w = makeWizard();
  const result = await consumeCommunityImportIntent(createdIntent.intentId, 'current', w.deps);
  assert.equal(result.ok, true, 'real Community legacy exact consume');
  assert.equal(w.state.applyCount, 1);
  assert.equal(w.state.snapshots.length, 1);
  assert.equal(w.state.snapshots[0].communitySourceRef.contentId, content.contentId, 'first visible template state has provenance');
  assert.equal(w.state.snapshots[0].templateAssetRef.sha256, 'a677774006ca273d10b9b733731ce797a2730ab4445a7a93865aaa7d5629e029');
}
memory.clear();
{
  const mercury = contentIndex.contents.find((item) => item.assetRef?.templateId === 't_mercury_dew_concept');
  assert.ok(mercury, 'real Mercury legacy content fixture');
  const createdIntent = createStudioImportIntent({ content: mercury, suggestedContext: { shape: 'almond', length: 'medium' } });
  assert.equal(createdIntent.ok, true);
  const w = makeWizard(mercury);
  const result = await consumeCommunityImportIntent(createdIntent.intentId, 'current', w.deps);
  assert.equal(result.ok, true, 'source template version maps to exact renderer asset');
  assert.equal(w.state.templateId, 't_liquid_velvet_cat_eye');
  assert.equal(w.state.templateAssetRef.revision, 'template-v1');
  assert.equal(w.state.communitySourceRef.sourceTemplateId, 't_mercury_dew_concept');
}
memory.clear();
{
  const wrong = structuredClone(content);
  wrong.assetRef.assetVersion = '9.9.9';
  const createdIntent = createStudioImportIntent({ content: wrong, suggestedContext: { shape: 'almond', length: 'medium' } });
  assert.equal(createdIntent.ok, true);
  const w = makeWizard();
  const before = JSON.stringify(w.state);
  const result = await consumeCommunityImportIntent(createdIntent.intentId, 'current', { ...w.deps, getContentById: async () => wrong });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'asset_mismatch');
  assert.equal(JSON.stringify(w.state), before, 'wrong version writer-zero');
  assert.equal(peekStudioImportIntentRaw(createdIntent.intentId), null, 'failed intent cleanup follows legacy semantics');
}

console.log('[wizard-v0-7-2-provenance] strict V2 recovery, exact assets, fail-closed migration, and Editor provenance: PASS');
