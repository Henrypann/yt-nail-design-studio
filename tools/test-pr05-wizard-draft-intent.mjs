#!/usr/bin/env node
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  setTimeout,
  clearTimeout,
};

const {
  chooseWizardRestoreDraft,
  parseWizardDraft,
  readWizardDraft,
  toWizardDraft,
  wizardDraftFromDesignSummary,
  writeWizardDraft,
} = await import('../src/studio/wizard/wizard-draft.ts');
const { StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');
const { canBuildWizardSummary, missingWizardSummaryFields, wizardSummaryCustomerId } =
  await import('../src/studio/wizard/design-summary.ts');

const customer = { id: 'customer-1' };
const source = {
  designId: 'draft-1',
  step: 2,
  customer,
  shape: 'almond',
  length: 'medium',
  styleId: 'soft',
  styleName: 'Soft',
  stylePrompted: true,
  appliedShape: 'almond',
  appliedLength: 'medium',
  templateId: 't_soft',
  templateName: 'Soft template',
  baseColor: '#f0e0d0',
  finish: 'gloss',
  fingerOverrides: { R4: { baseColor: '#ffffff' } },
  createdAt: '2026-08-07T00:00:00.000Z',
  version: 2,
  status: 'draft',
  confirmation: undefined,
  recipe: undefined,
  // UI-only values must never leak into the stored snapshot.
  pickerOpen: false,
  viewMode: 'single',
  selectedFinger: 'R4',
  saveState: 'dirty',
  applying: true,
};

const serialized = toWizardDraft(source);
assert.equal(serialized.schemaVersion, 1);
assert.equal(serialized.customerId, customer.id);
assert.equal(serialized.designId, 'draft-1');
for (const forbidden of ['pickerOpen', 'viewMode', 'selectedFinger', 'saveState', 'applying']) {
  assert.equal(Object.hasOwn(serialized, forbidden), false, `${forbidden} must be transient`);
}
writeWizardDraft(source);
assert.deepEqual(readWizardDraft(), serialized);

// Incomplete Step 1 work is recoverable with the same designId.
const stepOne = { ...source, designId: 'draft-step-1', step: 1, appliedShape: null, appliedLength: null, baseColor: null };
assert.equal(parseWizardDraft(toWizardDraft(stepOne))?.designId, 'draft-step-1');

// Step 2 requires an applied geometry and base color.
assert.equal(parseWizardDraft({ ...serialized, appliedShape: null }), null);

// Malformed and future schemas are ignored and removed without throwing.
writeEnvelope(StorageKeys.wizardDraft, { schemaVersion: 99, designId: 'future' });
assert.equal(readWizardDraft(), null);
assert.notEqual(localStorage.getItem('nail-studio:wizard.active-draft'), null, 'future draft is preserved for recovery');
writeEnvelope(StorageKeys.wizardDraft, { schemaVersion: 1, designId: '', step: 7 });
assert.equal(readWizardDraft(), null);
assert.notEqual(localStorage.getItem('nail-studio:wizard.active-draft'), null, 'invalid draft is preserved for recovery');

const summary = {
  id: 'explicit-design',
  customerId: 'customer-2',
  title: 'Explicit',
  shape: 'oval',
  length: 'long',
  templateId: 't_explicit',
  baseColor: '#abcdef',
  finish: 'matte',
  status: 'confirmed',
  source: 'wizard',
  version: 3,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
};
const explicitDraft = wizardDraftFromDesignSummary(summary);
assert.equal(explicitDraft.designId, 'explicit-design');
assert.equal(explicitDraft.status, 'confirmed');
assert.equal(explicitDraft.step, 2);

// Explicit deep link wins. Missing explicit ID does not silently fall back.
assert.equal(chooseWizardRestoreDraft({
  explicitDesignId: 'explicit-design', explicitDesign: summary, activeDraft: serialized,
}).designId, 'explicit-design');
assert.equal(chooseWizardRestoreDraft({
  explicitDesignId: 'missing', explicitDesign: null, activeDraft: serialized,
}), null);
assert.equal(chooseWizardRestoreDraft({
  explicitDesignId: null, explicitDesign: null, activeDraft: serialized,
}).designId, 'draft-1');

// A Community trial can enter Step 2 before a customer is selected. Saving
// that design must remain possible so the Wizard -> EditorDocV6 bridge does
// not dead-end on the visible "未选择客户" state.
const communityTrial = {
  customer: null,
  appliedShape: 'almond',
  appliedLength: 'short',
  baseColor: '#F5E0D3',
};
assert.equal(canBuildWizardSummary(communityTrial), true);
assert.equal(wizardSummaryCustomerId(communityTrial.customer), '');
assert.equal(canBuildWizardSummary({ ...communityTrial, appliedShape: null }), false);
assert.deepEqual(missingWizardSummaryFields({ ...communityTrial, appliedShape: null }), ['甲型']);

console.log('test-pr05-wizard-draft-intent: versioned recovery and precedence PASS');
