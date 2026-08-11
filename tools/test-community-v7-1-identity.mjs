#!/usr/bin/env node
/**
 * test-community-v7-1-identity.mjs · GEN-V7.1-01
 * Identity, Visibility, Privacy & Permission contract tests.
 *
 * Covers: multi-role identity; separately typed/versioned profiles; strict
 * visibility (PRIVATE/UNLISTED/PUBLIC, default PRIVATE); PUBLIC transition
 * gated by actor permission + declared prerequisites; share-link access that
 * never mutates visibility; strict parsers that never throw, never mutate
 * input, and emit bounded stable-code issues; leaked-private-key rejection;
 * public projection strictness; JSON Schema ↔ runtime contract agreement.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  CONSUMER_PROFILE_V1_FIXTURE,
  CREATOR_PROFILE_V1_FIXTURE,
  IDENTITY_BUNDLE_V1_FIXTURE,
  IDENTITY_V1_FULL_FIXTURE,
  IDENTITY_V1_MINIMAL_FIXTURE,
  NAIL_PROFILE_V1_FIXTURE,
  PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE,
  SALON_MEMBERSHIP_V1_FIXTURE,
} from '../src/community/domain/v7_1/fixtures/identity-v1-valid.ts';
import { IDENTITY_V1_INVALID_FIXTURES } from '../src/community/domain/v7_1/fixtures/identity-v1-invalid.ts';
import {
  parseConsumerProfileV1,
  parseCreatorProfileV1,
  parseIdentityBundleV1,
  parseIdentityV1,
  parseNailProfileV1,
  parsePublicCreatorProfileProjectionV1,
  parsePublicTransitionPrerequisitesV1,
  parseSalonMembershipV1,
  validateIdentityBundleV1,
  validateIdentityV1,
  validateNailProfileV1,
  validatePublicCreatorProfileProjectionV1,
} from '../src/community/domain/v7_1/parse.ts';
import {
  canTransitionToPublic,
  canTransitionVisibility,
  defaultVisibility,
  hasPublishPermission,
  isPubliclyVisible,
  isShareLinkVisible,
  publicTransitionPrerequisitesMet,
  shareLinkAccess,
} from '../src/community/domain/v7_1/visibility.ts';
import {
  isForbiddenPrivateKey,
  projectPublicCreatorProfile,
  scanForbiddenPrivateKeys,
} from '../src/community/domain/v7_1/privacy.ts';
import {
  CONSUMER_PROFILE_V1_ALLOWED_KEYS,
  CONSUMER_PROFILE_V1_REQUIRED_FIELDS,
  CREATOR_PROFILE_V1_ALLOWED_KEYS,
  CREATOR_PROFILE_V1_REQUIRED_FIELDS,
  IDENTITY_BUNDLE_V1_ALLOWED_KEYS,
  IDENTITY_BUNDLE_V1_REQUIRED_FIELDS,
  IDENTITY_V1_ALLOWED_KEYS,
  IDENTITY_V1_REQUIRED_FIELDS,
  MAX_ISSUES,
  NAIL_PROFILE_V1_ALLOWED_KEYS,
  NAIL_PROFILE_V1_REQUIRED_FIELDS,
  PUBLIC_CREATOR_PROFILE_V1_ALLOWED_KEYS,
  PUBLIC_CREATOR_PROFILE_V1_REQUIRED_FIELDS,
  PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS,
  PUBLIC_TRANSITION_PREREQUISITES_REQUIRED_FIELDS,
  SALON_MEMBERSHIP_V1_ALLOWED_KEYS,
  SALON_MEMBERSHIP_V1_REQUIRED_FIELDS,
} from '../src/community/domain/v7_1/contract.ts';
import { IDENTITY_ROLE_IDS, VISIBILITY_V1 } from '../src/community/domain/v7_1/model.ts';

const schemaPath = fileURLToPath(
  new URL('../src/community/domain/v7_1/identity-v1.schema.json', import.meta.url),
);
const schemaText = await readFile(schemaPath, 'utf8');
const jsonSchema = JSON.parse(schemaText);

// ---------------------------------------------------------------------------
// 1 · Valid fixtures: parse ok, value preserved, input not mutated
// ---------------------------------------------------------------------------
const validCases = [
  ['identityV1 minimal', parseIdentityV1, IDENTITY_V1_MINIMAL_FIXTURE],
  ['identityV1 full multi-role', parseIdentityV1, IDENTITY_V1_FULL_FIXTURE],
  ['consumerProfileV1', parseConsumerProfileV1, CONSUMER_PROFILE_V1_FIXTURE],
  ['creatorProfileV1 public', parseCreatorProfileV1, CREATOR_PROFILE_V1_FIXTURE],
  ['salonMembershipV1', parseSalonMembershipV1, SALON_MEMBERSHIP_V1_FIXTURE],
  ['nailProfileV1 private', parseNailProfileV1, NAIL_PROFILE_V1_FIXTURE],
  ['identityBundleV1', parseIdentityBundleV1, IDENTITY_BUNDLE_V1_FIXTURE],
  ['publicCreatorProfileV1', parsePublicCreatorProfileProjectionV1, PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE],
];

for (const [name, parse, fixture] of validCases) {
  const snapshot = JSON.stringify(fixture);
  const parsed = parse(fixture);
  assert.equal(parsed.ok, true, `${name} should parse: ${JSON.stringify(parsed)}`);
  assert.deepEqual(parsed.value, fixture, `${name} successful parse must preserve the document`);
  assert.equal(JSON.stringify(fixture), snapshot, `${name} input must not be mutated`);
}

// Acceptance (1): identity holds multiple unique roles; profiles separately typed/versioned.
assert.deepEqual(IDENTITY_V1_FULL_FIXTURE.roles, ['CONSUMER', 'CREATOR', 'SALON_MEMBER', 'OPERATOR']);
assert.equal(IDENTITY_V1_FULL_FIXTURE.schemaVersion, 1);
for (const profile of [
  CONSUMER_PROFILE_V1_FIXTURE,
  CREATOR_PROFILE_V1_FIXTURE,
  SALON_MEMBERSHIP_V1_FIXTURE,
  NAIL_PROFILE_V1_FIXTURE,
]) {
  assert.equal(profile.schemaVersion, 1, 'each profile contract is schemaVersion 1');
}
assert.equal(validateIdentityV1(IDENTITY_V1_FULL_FIXTURE), true);
assert.equal(validateIdentityBundleV1(IDENTITY_BUNDLE_V1_FIXTURE), true);
assert.equal(IDENTITY_BUNDLE_V1_FIXTURE.salonMemberships.length, 1);
assert.equal(validateNailProfileV1(NAIL_PROFILE_V1_FIXTURE), true);
assert.equal(validatePublicCreatorProfileProjectionV1(PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE), true);

// Frozen inputs: parse must still work and must not mutate.
const frozenIdentity = Object.freeze({ ...IDENTITY_V1_MINIMAL_FIXTURE });
assert.equal(parseIdentityV1(frozenIdentity).ok, true);
assert.equal(JSON.stringify(frozenIdentity), JSON.stringify(IDENTITY_V1_MINIMAL_FIXTURE));
const frozenInvalidNail = Object.freeze({ ...NAIL_PROFILE_V1_FIXTURE, visibility: 'UNLISTED' });
const frozenParse = parseNailProfileV1(frozenInvalidNail);
assert.equal(frozenParse.ok, false);
assert.ok(frozenParse.issues.some((issue) => issue.code === 'nail_profile_not_private'));
assert.equal(frozenInvalidNail.visibility, 'UNLISTED', 'frozen input unchanged');

// ---------------------------------------------------------------------------
// 2 · Invalid fixtures: rejected, expected codes present, bounded, no throw,
//     no mutation
// ---------------------------------------------------------------------------
assert.ok(IDENTITY_V1_INVALID_FIXTURES.length >= 30, 'invalid fixture coverage');
for (const fixture of IDENTITY_V1_INVALID_FIXTURES) {
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
const noisy = { ...IDENTITY_V1_MINIMAL_FIXTURE };
for (let i = 0; i < 500; i += 1) noisy[`extra_${i}`] = i;
const noisyParse = parseIdentityV1(noisy);
assert.equal(noisyParse.ok, false);
assert.equal(noisyParse.issues.length, MAX_ISSUES, 'issue list capped at MAX_ISSUES');
assert.ok(noisyParse.issues.every((issue) => issue.code === 'unknown_key'));

// ---------------------------------------------------------------------------
// 3 · Visibility: exactly PRIVATE/UNLISTED/PUBLIC, default PRIVATE, strict
//     PUBLIC transition, share-link never mutates visibility
// ---------------------------------------------------------------------------
assert.deepEqual([...VISIBILITY_V1], ['PRIVATE', 'UNLISTED', 'PUBLIC']);
assert.equal(defaultVisibility(), 'PRIVATE', 'default helper always returns PRIVATE');

const fullPrereqs = { copyrightDeclared: true, sourceDeclared: true, moderationCleared: true };
const missingModeration = { copyrightDeclared: true, sourceDeclared: true, moderationCleared: false };

// Acceptance (2): transition to PUBLIC requires explicit actor permission + prerequisites.
assert.equal(canTransitionToPublic('OWNER', fullPrereqs), true);
assert.equal(canTransitionToPublic('OPERATOR', fullPrereqs), false, 'OPERATOR may not publish');
assert.equal(canTransitionToPublic('VIEWER', fullPrereqs), false);
assert.equal(canTransitionToPublic('OWNER', missingModeration), false, 'missing moderation blocks publish');
assert.equal(canTransitionToPublic('OWNER', undefined), false, 'undeclared prerequisites block publish');
assert.equal(hasPublishPermission('OWNER'), true);
assert.equal(hasPublishPermission('OPERATOR'), false);
assert.equal(publicTransitionPrerequisitesMet(fullPrereqs), true);
assert.equal(publicTransitionPrerequisitesMet(missingModeration), false);

assert.deepEqual(canTransitionVisibility('PRIVATE', 'PUBLIC', 'OWNER', fullPrereqs), { allowed: true });
assert.equal(canTransitionVisibility('PRIVATE', 'PUBLIC', 'OWNER', fullPrereqs).allowed, true);
assert.equal(canTransitionVisibility('PRIVATE', 'PUBLIC', 'OWNER', missingModeration).code, 'prerequisites_missing');
assert.equal(canTransitionVisibility('UNLISTED', 'PUBLIC', 'OWNER', missingModeration).code, 'prerequisites_missing');
assert.equal(canTransitionVisibility('PRIVATE', 'PUBLIC', 'OPERATOR', fullPrereqs).code, 'actor_permission_denied');
assert.equal(canTransitionVisibility('UNLISTED', 'PUBLIC', 'VIEWER', fullPrereqs).code, 'actor_permission_denied');
assert.equal(canTransitionVisibility('PRIVATE', 'UNLISTED', 'OWNER').allowed, true);
assert.equal(canTransitionVisibility('PRIVATE', 'UNLISTED', 'OPERATOR').allowed, true);
assert.equal(canTransitionVisibility('PRIVATE', 'UNLISTED', 'VIEWER').allowed, false);
assert.equal(canTransitionVisibility('PUBLIC', 'PRIVATE', 'OWNER').allowed, true);
assert.equal(canTransitionVisibility('PUBLIC', 'UNLISTED', 'OPERATOR').allowed, true);
assert.equal(canTransitionVisibility('PUBLIC', 'PRIVATE', 'VIEWER').allowed, false);
assert.deepEqual(canTransitionVisibility('PRIVATE', 'PRIVATE', 'VIEWER'), { allowed: true, note: 'unchanged' });

// Acceptance (3): share-link/unlisted access does not mutate visibility.
assert.deepEqual(shareLinkAccess('UNLISTED'), { access: 'GRANTED', visibility: 'UNLISTED', readOnly: true });
assert.deepEqual(shareLinkAccess('PRIVATE'), { access: 'DENIED', visibility: 'PRIVATE' });
assert.equal(shareLinkAccess('PUBLIC').access, 'GRANTED');
assert.equal(isPubliclyVisible('UNLISTED'), false, 'UNLISTED is not public');
assert.equal(isShareLinkVisible('UNLISTED'), true);
const unlistedBefore = JSON.stringify({ ...CREATOR_PROFILE_V1_FIXTURE, visibility: 'UNLISTED' });
const unlistedProfile = { ...CREATOR_PROFILE_V1_FIXTURE, visibility: 'UNLISTED' };
const link = shareLinkAccess(unlistedProfile.visibility);
assert.equal(link.access, 'GRANTED');
assert.equal(link.visibility, 'UNLISTED', 'share-link access keeps UNLISTED');
assert.equal(JSON.stringify(unlistedProfile), unlistedBefore, 'share-link access never mutates the profile');

// Prerequisites parser: strict booleans.
const prereqParse = parsePublicTransitionPrerequisitesV1(fullPrereqs);
assert.equal(prereqParse.ok, true);
const badPrereq = parsePublicTransitionPrerequisitesV1({
  copyrightDeclared: true,
  sourceDeclared: 'yes',
  moderationCleared: true,
});
assert.equal(badPrereq.ok, false);
assert.ok(badPrereq.issues.some((issue) => issue.code === 'invalid_type'));

// ---------------------------------------------------------------------------
// 4 · Public profile projection: helper + strictness + no private leakage
// ---------------------------------------------------------------------------
const projected = projectPublicCreatorProfile(IDENTITY_V1_FULL_FIXTURE, CREATOR_PROFILE_V1_FIXTURE);
assert.ok(projected, 'PUBLIC creator profile must project');
const projectedParse = parsePublicCreatorProfileProjectionV1(projected);
assert.equal(projectedParse.ok, true, 'projection helper output must satisfy the strict projection parser');
assert.deepEqual(projectedParse.value, projected);

// Private / unlisted profiles never project.
assert.equal(
  projectPublicCreatorProfile(IDENTITY_V1_FULL_FIXTURE, { ...CREATOR_PROFILE_V1_FIXTURE, visibility: 'PRIVATE' }),
  null,
);
assert.equal(
  projectPublicCreatorProfile(IDENTITY_V1_FULL_FIXTURE, { ...CREATOR_PROFILE_V1_FIXTURE, visibility: 'UNLISTED' }),
  null,
);
// Cross-identity projection refused.
assert.equal(
  projectPublicCreatorProfile({ ...IDENTITY_V1_MINIMAL_FIXTURE, identityId: 'idn_other' }, CREATOR_PROFILE_V1_FIXTURE),
  null,
);

// The projection fixture and the helper output contain no private fields.
const projectionJson = JSON.stringify(PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE);
for (const forbidden of [
  'customerId',
  'email',
  'phone',
  'allergyNotes',
  'serviceNotes',
  'nailTwinSnapshotRefs',
  'password',
  'token',
]) {
  assert.equal(
    projectionJson.includes(`"${forbidden}"`),
    false,
    `public projection must not contain ${forbidden}`,
  );
}
const projectionLeak = [];
scanForbiddenPrivateKeys(PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE, '$', projectionLeak);
assert.equal(projectionLeak.length, 0, 'public projection fixture must pass the privacy scan');
const helperLeak = [];
scanForbiddenPrivateKeys(projected, '$', helperLeak);
assert.equal(helperLeak.length, 0, 'helper projection output must pass the privacy scan');

// Deep privacy scan on arbitrary public data.
const leaked = {
  title: 'look',
  publisher: { email: 'x@example.test', customerId: 'cus_1' },
  rawNailGeometry: { mesh: 'raw' },
  assets: [{ render: 'a.png' }, { mesh: 'nested-mesh' }],
};
const leakIssues = [];
scanForbiddenPrivateKeys(leaked, '$', leakIssues);
assert.ok(leakIssues.some((issue) => issue.code === 'forbidden_private_key' && issue.path === '$.publisher.email'));
assert.ok(leakIssues.some((issue) => issue.code === 'forbidden_private_key' && issue.path === '$.publisher.customerId'));
assert.ok(leakIssues.some((issue) => issue.code === 'forbidden_private_key' && issue.path === '$.rawNailGeometry'));
// The condemned raw geometry subtree is reported at its root, not re-walked.
assert.equal(leakIssues.some((issue) => issue.path === '$.rawNailGeometry.mesh'), false);
// Public design metadata may legitimately name safe geometry/mesh/scan/token references.
assert.equal(isForbiddenPrivateKey('geometryRef'), false);
assert.equal(isForbiddenPrivateKey('mesh'), false);
assert.equal(isForbiddenPrivateKey('scanStatus'), false);
assert.equal(isForbiddenPrivateKey('token'), false);
assert.equal(leakIssues.some((issue) => issue.path === '$.assets[1].mesh'), false);
assert.equal(leakIssues.length, 3);

// ---------------------------------------------------------------------------
// 5 · JSON Schema artifact ↔ runtime contract agreement
// ---------------------------------------------------------------------------
assert.equal(jsonSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.deepEqual(
  jsonSchema.oneOf.map((entry) => entry.$ref),
  [
    '#/$defs/identityV1',
    '#/$defs/consumerProfileV1',
    '#/$defs/creatorProfileV1',
    '#/$defs/salonMembershipV1',
    '#/$defs/nailProfileV1',
    '#/$defs/publicCreatorProfileV1',
    '#/$defs/identityBundleV1',
    '#/$defs/publicTransitionPrerequisitesV1',
  ],
  'schema root must be an executable union of the contract documents',
);
const defs = jsonSchema.$defs;

const defAgreement = [
  ['identityV1', IDENTITY_V1_REQUIRED_FIELDS, IDENTITY_V1_ALLOWED_KEYS],
  ['consumerProfileV1', CONSUMER_PROFILE_V1_REQUIRED_FIELDS, CONSUMER_PROFILE_V1_ALLOWED_KEYS],
  ['creatorProfileV1', CREATOR_PROFILE_V1_REQUIRED_FIELDS, CREATOR_PROFILE_V1_ALLOWED_KEYS],
  ['salonMembershipV1', SALON_MEMBERSHIP_V1_REQUIRED_FIELDS, SALON_MEMBERSHIP_V1_ALLOWED_KEYS],
  ['nailProfileV1', NAIL_PROFILE_V1_REQUIRED_FIELDS, NAIL_PROFILE_V1_ALLOWED_KEYS],
  ['publicCreatorProfileV1', PUBLIC_CREATOR_PROFILE_V1_REQUIRED_FIELDS, PUBLIC_CREATOR_PROFILE_V1_ALLOWED_KEYS],
  ['identityBundleV1', IDENTITY_BUNDLE_V1_REQUIRED_FIELDS, IDENTITY_BUNDLE_V1_ALLOWED_KEYS],
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
  assert.deepEqual(
    [...def.required].sort(),
    [...required].sort(),
    `$defs.${defName}.required must match runtime contract`,
  );
  assert.deepEqual(
    Object.keys(def.properties).sort(),
    [...allowed].sort(),
    `$defs.${defName}.properties must match runtime allowed keys`,
  );
}

// Enum agreement.
assert.deepEqual(defs.visibility.enum, [...VISIBILITY_V1]);
assert.deepEqual(defs.identityRole.enum, [...IDENTITY_ROLE_IDS]);
assert.equal(defs.nailProfileV1.properties.visibility.const, 'PRIVATE');
assert.equal(defs.publicCreatorProfileV1.properties.visibility.const, 'PUBLIC');
assert.deepEqual(defs.creatorProfileV1.allOf[0].then.required, ['publicSince']);
assert.equal(defs.identityBundleV1.properties.salonMemberships.minItems, 1);

// The public projection schema def must not expose any forbidden private key.
const projectionDefLeak = [];
scanForbiddenPrivateKeys(defs.publicCreatorProfileV1.properties, '$', projectionDefLeak);
assert.equal(projectionDefLeak.length, 0, 'public projection schema def must not expose private keys');

console.log(
  `[test:community-v7-1-identity] PASS · valid=${validCases.length} invalid=${IDENTITY_V1_INVALID_FIXTURES.length} schemaDefs=${Object.keys(defs).length} maxIssues=${MAX_ISSUES}`,
);
