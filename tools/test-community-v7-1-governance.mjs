import assert from 'node:assert/strict';
import {
  decidePublicationReviewV1, emptyGovernanceStoreV1, hasPublicGovernanceClearanceV1,
  parseGovernanceStoreV1, publicationReviewClearedV1, reportGovernanceCaseV1,
  submitPublicationReviewV1, transitionGovernanceCaseV1,
} from '../src/community/domain/v7_1/governance.ts';

const now = '2026-08-12T12:00:00.000Z';
let store = emptyGovernanceStoreV1();
let review = submitPublicationReviewV1(store, { reviewId: 'review.1', auditId: 'audit.submit.1', draftId: 'draft.1', creatorProfileId: 'profile.1', draftRevision: 3, now });
assert.equal(review.ok, true);
store = review.value;
assert.equal(publicationReviewClearedV1(store, 'draft.1', 'profile.1', 3), false);
assert.equal(store.audits.at(-1).action, 'PUBLICATION_SUBMITTED');

review = decidePublicationReviewV1(store, { reviewId: 'review.1', auditId: 'audit.clear.1', status: 'CLEARED', reviewedBy: 'operator.1', reasonCode: 'policy-cleared', now });
assert.equal(review.ok, true);
store = review.value;
assert.equal(publicationReviewClearedV1(store, 'draft.1', 'profile.1', 3), true);
assert.equal(publicationReviewClearedV1(store, 'draft.1', 'profile.1', 4), false, 'content edit must invalidate prior clearance');
assert.equal(store.audits.at(-1).action, 'PUBLICATION_CLEARED');

const revised = submitPublicationReviewV1(store, { reviewId: 'review.2', auditId: 'audit.submit.2', draftId: 'draft.1', creatorProfileId: 'profile.1', draftRevision: 4, now });
assert.equal(revised.ok, true, 'a new content revision may be reviewed independently');
store = revised.value;

let result = reportGovernanceCaseV1({ store, caseId: 'case.1', auditId: 'audit.report', subjectType: 'PUBLISHED_LOOK', subjectId: 'look.1', reporterRef: 'actor.1', reasonCode: 'copyright', idempotencyKey: 'idem.report', now });
assert.equal(result.ok, true);
store = result.value;
assert.equal(hasPublicGovernanceClearanceV1(store, 'look.1'), false);
result = transitionGovernanceCaseV1({ store, caseId: 'case.1', to: 'UNDER_REVIEW', auditId: 'audit.review', actorRef: 'operator.1', reasonCode: 'copyright', idempotencyKey: 'idem.review', expectedVersion: 1, now });
assert.equal(result.ok, true);
store = result.value;
const conflict = transitionGovernanceCaseV1({ store, caseId: 'case.1', to: 'HIDDEN', auditId: 'audit.x', actorRef: 'operator.1', reasonCode: 'copyright', idempotencyKey: 'idem.x', expectedVersion: 1, now });
assert.equal(conflict.code, 'conflict');
result = transitionGovernanceCaseV1({ store, caseId: 'case.1', to: 'RESTORED', auditId: 'audit.restore', actorRef: 'operator.1', reasonCode: 'cleared', idempotencyKey: 'idem.restore', expectedVersion: 2, now });
assert.equal(result.ok, true);
store = result.value;
assert.equal(hasPublicGovernanceClearanceV1(store, 'look.1'), true);
assert.ok(parseGovernanceStoreV1(store));
console.log('[COMM-V7.1-08A/05B] revision-bound publication review, enforcement and audit: PASS');
