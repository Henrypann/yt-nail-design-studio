#!/usr/bin/env node
/**
 * test-community-v7-1-design-content.mjs · GEN-V7.1-02
 * DesignVersionV1, PublishedLookV1, RemixRelationV1 contract tests.
 *
 * Covers: immutable DesignVersion refs (SHA-256, never embedded EditorDoc);
 * PublishedLook lifecycle rules (PUBLIC requires gate clearance; PUBLISHED
 * requires publishedAt and may remain PRIVATE; DRAFT forbids publishedAt);
 * RemixRelation exact source/target provenance; strict parsers that never
 * throw, never mutate input, and emit bounded stable-code issues; GEN-01
 * privacy scanner + device/manufacturing-field scan; source lineage
 * traceability with no shared mutable references in fixtures; JSON Schema ↔
 * runtime contract agreement.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  DESIGN_LINEAGE_FIXTURES,
  DESIGN_VERSION_V1_CHILD_FIXTURE,
  DESIGN_VERSION_V1_ROOT_FIXTURE,
  PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE,
  PUBLISHED_LOOK_V1_FIXTURE,
  PUBLISHED_LOOK_V1_HIDDEN_FIXTURE,
  PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE,
  REMIX_RELATION_V1_FIXTURE,
} from '../src/community/domain/v7_1/fixtures/design-content-v1-valid.ts';
import { DESIGN_CONTENT_V1_INVALID_FIXTURES } from '../src/community/domain/v7_1/fixtures/design-content-v1-invalid.ts';
import {
  parseDesignVersionV1,
  parsePublishedLookV1,
  parseRemixRelationV1,
  validateDesignVersionV1,
  validatePublishedLookV1,
  validateRemixRelationV1,
  isForbiddenDeviceManufacturingKey,
  scanForbiddenDeviceManufacturingKeys,
} from '../src/community/domain/v7_1/design-content-parse.ts';
import {
  DESIGN_VERSION_V1_ALLOWED_KEYS,
  DESIGN_VERSION_V1_REQUIRED_FIELDS,
  EDITOR_DOC_V7_REF_ALLOWED_KEYS,
  EDITOR_DOC_V7_REF_REQUIRED_FIELDS,
  FORBIDDEN_DEVICE_MANUFACTURING_KEYS,
  IMMUTABLE_ASSET_REVISION_REF_ALLOWED_KEYS,
  IMMUTABLE_ASSET_REVISION_REF_REQUIRED_FIELDS,
  MAX_ISSUES,
  PUBLISHED_LOOK_SUMMARY_ALLOWED_KEYS,
  PUBLISHED_LOOK_SUMMARY_REQUIRED_FIELDS,
  PUBLISHED_LOOK_V1_ALLOWED_KEYS,
  PUBLISHED_LOOK_V1_REQUIRED_FIELDS,
  PUBLISHED_PREVIEW_ASSET_REF_ALLOWED_KEYS,
  PUBLISHED_PREVIEW_ASSET_REF_REQUIRED_FIELDS,
  REMIX_RELATION_V1_ALLOWED_KEYS,
  REMIX_RELATION_V1_REQUIRED_FIELDS,
} from '../src/community/domain/v7_1/design-content-contract.ts';
import {
  DESIGN_LOOK_STATUS_V1,
  PREVIEW_FIDELITY_V1,
  PREVIEW_KIND_V1,
  PREVIEW_MIME_V1,
  VISIBILITY_V1,
} from '../src/community/domain/v7_1/design-content-model.ts';
import { defaultVisibility } from '../src/community/domain/v7_1/visibility.ts';
import { parsePublicTransitionPrerequisitesV1 } from '../src/community/domain/v7_1/parse.ts';
import { isForbiddenPrivateKey, scanForbiddenPrivateKeys } from '../src/community/domain/v7_1/privacy.ts';
import {
  PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS,
  PUBLIC_TRANSITION_PREREQUISITES_REQUIRED_FIELDS,
} from '../src/community/domain/v7_1/contract.ts';

const schemaPath = fileURLToPath(
  new URL('../src/community/domain/v7_1/design-content-v1.schema.json', import.meta.url),
);
const schemaText = await readFile(schemaPath, 'utf8');
const jsonSchema = JSON.parse(schemaText);

// ---------------------------------------------------------------------------
// 1 · Valid fixtures: parse ok, value preserved, input not mutated
// ---------------------------------------------------------------------------
const validCases = [
  ['designVersionV1 root', parseDesignVersionV1, DESIGN_VERSION_V1_ROOT_FIXTURE],
  ['designVersionV1 child', parseDesignVersionV1, DESIGN_VERSION_V1_CHILD_FIXTURE],
  ['publishedLookV1 public', parsePublishedLookV1, PUBLISHED_LOOK_V1_FIXTURE],
  ['publishedLookV1 draft private', parsePublishedLookV1, PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE],
  ['publishedLookV1 published private', parsePublishedLookV1, PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE],
  ['publishedLookV1 hidden with publication history', parsePublishedLookV1, PUBLISHED_LOOK_V1_HIDDEN_FIXTURE],
  ['remixRelationV1', parseRemixRelationV1, REMIX_RELATION_V1_FIXTURE],
];

for (const [name, parse, fixture] of validCases) {
  const snapshot = JSON.stringify(fixture);
  const parsed = parse(fixture);
  assert.equal(parsed.ok, true, `${name} should parse: ${JSON.stringify(parsed)}`);
  assert.deepEqual(parsed.value, fixture, `${name} successful parse must preserve the document`);
  assert.equal(JSON.stringify(fixture), snapshot, `${name} input must not be mutated`);
}

// Acceptance (1): DesignVersion carries stable ids, positive version/revision,
// EditorDocV7 SHA-256 reference (schemaVersion 7, not an embedded doc).
assert.equal(DESIGN_VERSION_V1_ROOT_FIXTURE.schemaVersion, 1);
assert.ok(DESIGN_VERSION_V1_ROOT_FIXTURE.version >= 1);
assert.ok(DESIGN_VERSION_V1_ROOT_FIXTURE.revision >= 1);
assert.equal(DESIGN_VERSION_V1_ROOT_FIXTURE.editorDocRef.schemaVersion, 7);
assert.equal(DESIGN_VERSION_V1_CHILD_FIXTURE.editorDocRef.schemaVersion, 7);
for (const version of [DESIGN_VERSION_V1_ROOT_FIXTURE, DESIGN_VERSION_V1_CHILD_FIXTURE]) {
  assert.equal(version.editorDocRef.designId, version.designId);
  assert.equal(version.editorDocRef.revision, version.revision);
  assert.match(version.editorDocRef.sha256, /^[0-9a-f]{64}$/);
  assert.ok(version.assetRevisionRefs.length >= 1);
  for (const asset of version.assetRevisionRefs) {
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
  }
}
assert.equal(validateDesignVersionV1(DESIGN_VERSION_V1_ROOT_FIXTURE), true);
assert.equal(validatePublishedLookV1(PUBLISHED_LOOK_V1_FIXTURE), true);
assert.equal(validateRemixRelationV1(REMIX_RELATION_V1_FIXTURE), true);

// Acceptance (2): PUBLIC requires clearance; PUBLISHED requires publishedAt
// but may remain PRIVATE by default; DRAFT carries no publishedAt.
assert.deepEqual(PUBLISHED_LOOK_V1_FIXTURE.publicationGate, {
  copyrightDeclared: true,
  sourceDeclared: true,
  moderationCleared: true,
});
assert.ok(PUBLISHED_LOOK_V1_FIXTURE.publishedAt);
assert.equal(PUBLISHED_LOOK_V1_FIXTURE.status, 'PUBLISHED');
assert.equal(PUBLISHED_LOOK_V1_FIXTURE.visibility, 'PUBLIC');
assert.equal(PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE.publishedAt, undefined);
assert.equal(PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE.status, 'DRAFT');
assert.equal(PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE.visibility, 'PRIVATE');
assert.equal(PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE.status, 'PUBLISHED');
assert.equal(PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE.visibility, 'PRIVATE');
assert.ok(PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE.publishedAt);
assert.equal(PUBLISHED_LOOK_V1_HIDDEN_FIXTURE.status, 'HIDDEN');
assert.ok(PUBLISHED_LOOK_V1_HIDDEN_FIXTURE.publishedAt, 'hidden look retains publication history');
assert.deepEqual(PUBLISHED_LOOK_V1_FIXTURE.summaries.shapeIds, ['almond', 'oval']);

// Acceptance (3): visibility defaults come from GEN-01 semantics (PRIVATE).
assert.equal(defaultVisibility(), 'PRIVATE', 'GEN-01 default visibility is the shared default');

// Acceptance (4): the publication gate IS the GEN-01 prerequisites contract.
const gateParse = parsePublicTransitionPrerequisitesV1(PUBLISHED_LOOK_V1_FIXTURE.publicationGate);
assert.equal(gateParse.ok, true, 'look publicationGate must satisfy the GEN-01 prerequisites parser');

// Frozen inputs: parse must still work and must not mutate.
const frozenLook = Object.freeze({ ...PUBLISHED_LOOK_V1_FIXTURE });
assert.equal(parsePublishedLookV1(frozenLook).ok, true);
assert.equal(JSON.stringify(frozenLook), JSON.stringify(PUBLISHED_LOOK_V1_FIXTURE));
const frozenInvalidLook = Object.freeze({ ...PUBLISHED_LOOK_V1_FIXTURE, status: 'DRAFT' });
const frozenParse = parsePublishedLookV1(frozenInvalidLook);
assert.equal(frozenParse.ok, false);
assert.ok(frozenParse.issues.some((issue) => issue.code === 'status_visibility_conflict'));
assert.equal(frozenInvalidLook.status, 'DRAFT', 'frozen input unchanged');

// ---------------------------------------------------------------------------
// 2 · Invalid fixtures: rejected, expected codes present, bounded, no throw,
//     no mutation
// ---------------------------------------------------------------------------
assert.ok(DESIGN_CONTENT_V1_INVALID_FIXTURES.length >= 40, 'invalid fixture coverage');
for (const fixture of DESIGN_CONTENT_V1_INVALID_FIXTURES) {
  let parsed;
  assert.doesNotThrow(() => {
    parsed = fixture.parse(fixture.value);
  }, `${fixture.name} must never throw`);
  assert.equal(parsed.ok, false, `${fixture.name} should be rejected`);
  assert.ok(parsed.issues.length > 0, `${fixture.name} should report issues`);
  for (const code of fixture.expectedCodes) {
    assert.ok(
      parsed.issues.some((issue) => issue.code === code),
      `${fixture.name} should emit ${code}: ${JSON.stringify(parsed.issues)}`,
    );
  }
  assert.ok(parsed.issues.length <= MAX_ISSUES, `${fixture.name} issue count bounded`);
  for (const issue of parsed.issues) {
    assert.ok(issue.path.startsWith('$'), `${fixture.name} issue has stable path: ${issue.path}`);
  }
  if (fixture.snapshotSafe !== false) {
    const before = JSON.stringify(fixture.value);
    fixture.parse(fixture.value);
    assert.equal(JSON.stringify(fixture.value), before, `${fixture.name} input must not be mutated`);
  }
}

// Issue list is bounded even for pathological inputs.
const noisy = { ...DESIGN_VERSION_V1_ROOT_FIXTURE };
for (let i = 0; i < 500; i += 1) noisy[`extra_${i}`] = i;
const noisyParse = parseDesignVersionV1(noisy);
assert.equal(noisyParse.ok, false);
assert.equal(noisyParse.issues.length, MAX_ISSUES, 'issue list capped at MAX_ISSUES');
assert.ok(noisyParse.issues.every((issue) => issue.code === 'unknown_key'));

// ---------------------------------------------------------------------------
// 3 · Source lineage traceability + no shared mutable references
// ---------------------------------------------------------------------------
const lineage = DESIGN_LINEAGE_FIXTURES;
const versions = new Map([
  [lineage.rootVersion.designVersionId, lineage.rootVersion],
  [lineage.childVersion.designVersionId, lineage.childVersion],
]);
const walked = [];
let cursor = lineage.childVersion;
while (cursor !== undefined) {
  walked.push(cursor.designVersionId);
  cursor = cursor.parentVersionId !== undefined ? versions.get(cursor.parentVersionId) : undefined;
}
assert.deepEqual(walked, ['dv_design_alpha_0002', 'dv_design_alpha_0001'], 'parent refs walk to the root');
assert.equal(lineage.rootVersion.parentVersionId, undefined, 'root version has no parent');
assert.equal(lineage.childVersion.parentVersionId, lineage.rootVersion.designVersionId);

// Look → design version → editor doc ref consistency.
assert.equal(lineage.look.designVersionId, lineage.childVersion.designVersionId);
assert.equal(lineage.look.remixRelationId, lineage.remixRelation.relationId);
const childAssets = new Map(
  lineage.childVersion.assetRevisionRefs.map((asset) => [`${asset.assetId}#${asset.revision}`, asset]),
);
for (const preview of [lineage.look.coverPreview, ...lineage.look.detailPreviews]) {
  const sourceAsset = childAssets.get(`${preview.assetId}#${preview.revision}`);
  assert.ok(sourceAsset, 'each look preview must derive from a versioned design asset');
  assert.equal(sourceAsset.sha256, preview.sha256, 'derived preview hash must match its versioned asset');
}

// Remix relation: exact source → target provenance, no live linkage needed.
assert.equal(lineage.remixRelation.targetDesignVersionId, lineage.look.designVersionId);
assert.equal(lineage.remixRelation.sourceDesignVersionId, lineage.rootVersion.designVersionId);
assert.equal(lineage.remixRelation.sourceCreatorProfileId, lineage.look.creatorProfileId);
assert.notEqual(lineage.remixRelation.sourceDesignVersionId, lineage.remixRelation.targetDesignVersionId);
assert.equal(lineage.remixRelation.sourceLookId, 'lk_design_beta_0001');

// Every document in the lineage parses cleanly.
assert.equal(parseDesignVersionV1(lineage.rootVersion).ok, true);
assert.equal(parseDesignVersionV1(lineage.childVersion).ok, true);
assert.equal(parsePublishedLookV1(lineage.look).ok, true);
assert.equal(parseRemixRelationV1(lineage.remixRelation).ok, true);

// No shared mutable object references across the golden fixtures.
function collectObjects(value, seen) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, seen);
    return;
  }
  for (const key of Object.keys(value)) collectObjects(value[key], seen);
}
const golden = [
  DESIGN_VERSION_V1_ROOT_FIXTURE,
  DESIGN_VERSION_V1_CHILD_FIXTURE,
  PUBLISHED_LOOK_V1_FIXTURE,
  PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE,
  PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE,
  PUBLISHED_LOOK_V1_HIDDEN_FIXTURE,
  REMIX_RELATION_V1_FIXTURE,
];
const allObjects = new Set();
let objectCount = 0;
for (const fixture of golden) {
  const local = new Set();
  collectObjects(fixture, local);
  objectCount += local.size;
  for (const obj of local) allObjects.add(obj);
}
assert.equal(allObjects.size, objectCount, 'golden fixtures must not share mutable object references');

// ---------------------------------------------------------------------------
// 4 · Privacy scanner + device/manufacturing field scan
// ---------------------------------------------------------------------------
for (const fixture of golden) {
  const privateIssues = [];
  scanForbiddenPrivateKeys(fixture, '$', privateIssues);
  assert.equal(privateIssues.length, 0, 'golden fixtures must pass the GEN-01 privacy scan');
  const deviceIssues = [];
  scanForbiddenDeviceManufacturingKeys(fixture, '$', deviceIssues);
  assert.equal(deviceIssues.length, 0, 'golden fixtures must pass the device/manufacturing scan');
}

const leaked = {
  title: 'look',
  publisher: { email: 'x@example.test', customerId: 'cus_1' },
  metadata: { job: { deviceParameters: { uvPower: 36 } } },
};
const privateLeaks = [];
scanForbiddenPrivateKeys(leaked, '$', privateLeaks);
assert.ok(privateLeaks.some((issue) => issue.path === '$.publisher.email'));
assert.ok(privateLeaks.some((issue) => issue.path === '$.publisher.customerId'));
const deviceLeaks = [];
scanForbiddenDeviceManufacturingKeys(leaked, '$', deviceLeaks);
assert.ok(deviceLeaks.some((issue) => issue.path === '$.metadata.job.deviceParameters'));
assert.equal(
  deviceLeaks.some((issue) => issue.path === '$.metadata.job.deviceParameters.uvPower'),
  false,
  'condemned device subtree is reported at its root, not re-walked',
);

// Deny lists are key-exact and case-insensitive; design-safe words stay free.
assert.equal(isForbiddenPrivateKey('customerId'), true);
assert.equal(isForbiddenPrivateKey('email'), true);
assert.equal(isForbiddenPrivateKey('geometryRef'), false);
assert.equal(isForbiddenPrivateKey('mesh'), false);
assert.equal(isForbiddenDeviceManufacturingKey('deviceId'), true);
assert.equal(isForbiddenDeviceManufacturingKey('Waveform'), true, 'case-insensitive match');
assert.equal(isForbiddenDeviceManufacturingKey('workOrderId'), true);
assert.equal(isForbiddenDeviceManufacturingKey('manufacturingDefinition'), true);
assert.equal(isForbiddenDeviceManufacturingKey('revision'), false);
assert.equal(isForbiddenDeviceManufacturingKey('palette'), false);
assert.ok(FORBIDDEN_DEVICE_MANUFACTURING_KEYS.length >= 25, 'bounded deny list');

// ---------------------------------------------------------------------------
// 5 · JSON Schema artifact ↔ runtime contract agreement
// ---------------------------------------------------------------------------
assert.equal(jsonSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.deepEqual(
  jsonSchema.oneOf.map((entry) => entry.$ref),
  ['#/$defs/designVersionV1', '#/$defs/publishedLookV1', '#/$defs/remixRelationV1'],
  'schema root must be an executable union of the three contract documents',
);
const defs = jsonSchema.$defs;

const defAgreement = [
  ['designVersionV1', DESIGN_VERSION_V1_REQUIRED_FIELDS, DESIGN_VERSION_V1_ALLOWED_KEYS],
  ['editorDocV7RefV1', EDITOR_DOC_V7_REF_REQUIRED_FIELDS, EDITOR_DOC_V7_REF_ALLOWED_KEYS],
  [
    'immutableAssetRevisionRefV1',
    IMMUTABLE_ASSET_REVISION_REF_REQUIRED_FIELDS,
    IMMUTABLE_ASSET_REVISION_REF_ALLOWED_KEYS,
  ],
  ['publishedLookV1', PUBLISHED_LOOK_V1_REQUIRED_FIELDS, PUBLISHED_LOOK_V1_ALLOWED_KEYS],
  [
    'publishedPreviewAssetRefV1',
    PUBLISHED_PREVIEW_ASSET_REF_REQUIRED_FIELDS,
    PUBLISHED_PREVIEW_ASSET_REF_ALLOWED_KEYS,
  ],
  ['publishedLookSummaryV1', PUBLISHED_LOOK_SUMMARY_REQUIRED_FIELDS, PUBLISHED_LOOK_SUMMARY_ALLOWED_KEYS],
  ['remixRelationV1', REMIX_RELATION_V1_REQUIRED_FIELDS, REMIX_RELATION_V1_ALLOWED_KEYS],
  [
    'publicTransitionPrerequisitesV1',
    PUBLIC_TRANSITION_PREREQUISITES_REQUIRED_FIELDS,
    PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS,
  ],
];
for (const [defName, required, allowed] of defAgreement) {
  const def = defs[defName];
  assert.ok(def, `schema $defs.${defName} must exist`);
  assert.equal(def.additionalProperties, false, `$defs.${defName}.additionalProperties must be false`);
  assert.deepEqual([...def.required].sort(), [...required].sort(), `$defs.${defName}.required must match runtime contract`);
  assert.deepEqual(
    Object.keys(def.properties).sort(),
    [...allowed].sort(),
    `$defs.${defName}.properties must match runtime allowed keys`,
  );
}

// Enum agreement.
assert.deepEqual(defs.visibility.enum, [...VISIBILITY_V1]);
assert.deepEqual(defs.publishedLookStatus.enum, [...DESIGN_LOOK_STATUS_V1]);
assert.deepEqual(defs.previewKind.enum, [...PREVIEW_KIND_V1]);
assert.deepEqual(defs.previewMime.enum, [...PREVIEW_MIME_V1]);
assert.deepEqual(defs.previewFidelity.enum, [...PREVIEW_FIDELITY_V1]);

// EditorDoc reference semantics: schemaVersion 7 const, sha256 pattern,
// positive ints, conditional publishedAt, status/visibility constraints.
assert.equal(defs.editorDocV7RefV1.properties.schemaVersion.const, 7, 'EditorDoc schema stays 7');
assert.equal(defs.sha256.pattern, '^[0-9a-f]{64}$');
assert.deepEqual(defs.positiveInt, { type: 'integer', minimum: 1 });
assert.equal(defs.designVersionV1.properties.version.$ref, '#/$defs/positiveInt');
assert.equal(defs.publishedPreviewAssetRefV1.properties.width.$ref, '#/$defs/positiveInt');
assert.equal(defs.publishedPreviewAssetRefV1.properties.revision.$ref, '#/$defs/positiveInt');
assert.deepEqual(defs.publishedLookV1.allOf[0].then.required, ['publishedAt']);
assert.deepEqual(defs.publishedLookV1.allOf[1].then, { not: { required: ['publishedAt'] } });
assert.equal(
  defs.publishedLookV1.allOf[2].then.properties.publicationGate.properties.moderationCleared.const,
  true,
);
assert.deepEqual(
  defs.publishedLookV1.allOf[3].then.properties.visibility.enum,
  ['PRIVATE', 'UNLISTED'],
);
assert.equal(defs.publishedLookV1.properties.metadata.additionalProperties.type, 'string');

// The public look schema def must not expose any forbidden private key or
// device/manufacturing key.
const lookDefLeak = [];
scanForbiddenPrivateKeys(defs.publishedLookV1.properties, '$', lookDefLeak);
assert.equal(lookDefLeak.length, 0, 'published look schema def must not expose private keys');
const lookDefDeviceLeak = [];
scanForbiddenDeviceManufacturingKeys(defs.publishedLookV1.properties, '$', lookDefDeviceLeak);
assert.equal(lookDefDeviceLeak.length, 0, 'published look schema def must not expose device/manufacturing keys');

console.log(
  `[test:community-v7-1-design-content] PASS · valid=${validCases.length} invalid=${DESIGN_CONTENT_V1_INVALID_FIXTURES.length} schemaDefs=${Object.keys(defs).length} maxIssues=${MAX_ISSUES}`,
);
