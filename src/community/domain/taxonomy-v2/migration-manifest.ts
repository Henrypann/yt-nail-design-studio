/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-02 Content Migration & Discovery manifest.
 *
 * The checked-in fixture `public/community/migration-manifest-v1.json` is the
 * single explicit authority that migrates every current
 * `public/community/content-index.json` content record (plus the canonical
 * demo, the four v0.7.2 look sets and the deterministic creator V1 fixture)
 * onto CommunityDiscoveryMetadataV1 + CommunityCurationMetadataV1 envelopes.
 *
 * Hard rules enforced by the strict parser (never inferred at runtime):
 * - Every entry names its source contentId and carries explicit discovery and
 *   curation metadata; no rights/style/makeability/scene/theme/manufacturing
 *   status is derived from publisherType, title, applicationLevel or
 *   verificationLevel.
 * - ST-02 / French records carry technique:french with an empty styleIds and
 *   migration NEEDS_STYLE_REVIEW; they stay discoverable by technique and are
 *   excluded from style channels by TAX-01 governance.
 * - Non-French legacy styles use only the explicit audited mappings below.
 * - Rights are explicit per entry: ORIGINAL only where the manifest asserts
 *   first-party provenance; everything else PENDING.
 * - No current record has a complete capability + immutable-asset + evidence
 *   chain, so every entry classifies makeability CONCEPT_ONLY.
 * - rights-PENDING entries are never public: publicStatus must be
 *   PUBLIC_BLOCKED, and the load path fails closed instead of synthesizing
 *   discovery data.
 *
 * This module is pure and Node-testable (no browser globals, no env access).
 */

import {
  MIGRATION_STATES,
  type MigrationState,
} from './contract.ts';
import {
  parseCurationMetadataV1,
  parseDiscoveryMetadataV1,
  type ParseResultV2,
  type TaxonomyV2Issue,
} from './parse.ts';
import {
  legacyStyleReviewExceptionApplies,
  publicationEligibility,
} from './governance.ts';
import type {
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
  SubjectRefV1,
} from './types.ts';

export const MIGRATION_MANIFEST_CONTRACT = 'COMM-v0.7.2-TAX-02' as const;
export const MIGRATION_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Subject identity convention: `look:<identityKey>` (SUBJECT_REF_PATTERN). */
export const DISCOVERY_SUBJECT_ID_PREFIX = 'look:' as const;

export const MIGRATION_SOURCE_CLASSES = [
  'LEGACY_CONTENT_INDEX',
  'CANONICAL_DEMO',
  'V0_7_2_LOOK_SET',
  'CREATOR_V1_FIXTURE',
] as const;
export type MigrationSourceClass = (typeof MIGRATION_SOURCE_CLASSES)[number];

/**
 * Public discovery outcome of the migration:
 * - MIGRATED         — discovery passes the normal public gate (no legacy
 *                      exception), rights non-PENDING.
 * - MANUAL_REVIEW    — the narrow legacy NEEDS_STYLE_REVIEW french exception
 *                      applies (technique:french, empty styleIds).
 * - PUBLIC_BLOCKED   — not publicly eligible (PENDING rights, draft, or no
 *                      first-party provenance assertion).
 */
export const MIGRATION_PUBLIC_STATUSES = [
  'MIGRATED',
  'MANUAL_REVIEW',
  'PUBLIC_BLOCKED',
] as const;
export type MigrationPublicStatus = (typeof MIGRATION_PUBLIC_STATUSES)[number];

export interface MigrationProvenanceV1 {
  /** True only when the manifest explicitly asserts first-party provenance. */
  firstParty: boolean;
  note?: string;
}

export interface MigrationManifestEntryV1 {
  /**
   * Identity key: the legacy contentId (content-index) or the canonical
   * lookId (demo / four look sets / creator fixture). This is the pairing key
   * with PublishedLookReadModelV1.
   */
  contentId: string;
  subjectRef: SubjectRefV1;
  sourceClass: MigrationSourceClass;
  provenance: MigrationProvenanceV1;
  publicStatus: MigrationPublicStatus;
  /** Legacy style ids migrated for this subject (content-index ST ids). */
  legacyStyleIds: string[];
  discovery: CommunityDiscoveryMetadataV1;
  curation: CommunityCurationMetadataV1;
}

export interface CommunityDiscoveryMigrationManifestV1 {
  schemaVersion: 1;
  contractRef: typeof MIGRATION_MANIFEST_CONTRACT;
  description?: string;
  entries: MigrationManifestEntryV1[];
}

export interface MigrationManifestIndexV1 {
  /** Entry lookup by identity key (contentId / lookId). */
  byId: Map<string, MigrationManifestEntryV1>;
  /** Entry lookup by discovery subject id (`look:<identityKey>`). */
  bySubjectId: Map<string, MigrationManifestEntryV1>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function push(
  issues: TaxonomyV2Issue[],
  code: string,
  path: string,
  message: string,
): void {
  if (issues.length < 200) issues.push({ code, path, message });
}

/** Deterministic discovery subject id for an identity key. */
export function discoverySubjectId(contentId: string): string {
  return `${DISCOVERY_SUBJECT_ID_PREFIX}${contentId}`;
}

export function buildMigrationManifestIndexV1(
  manifest: CommunityDiscoveryMigrationManifestV1,
): MigrationManifestIndexV1 {
  const byId = new Map<string, MigrationManifestEntryV1>();
  const bySubjectId = new Map<string, MigrationManifestEntryV1>();
  for (const entry of manifest.entries) {
    byId.set(entry.contentId, entry);
    bySubjectId.set(entry.subjectRef.id, entry);
  }
  return { byId, bySubjectId };
}

// ---------------------------------------------------------------------------
// Strict manifest parser (never throws; bounded typed issues)
// ---------------------------------------------------------------------------

/**
 * Parses and validates the migration manifest against the taxonomy.
 * Rejections include: unknown keys, wrong schema/contract, duplicate or
 * missing identity keys, subjectRef mismatches, unknown sourceClass /
 * publicStatus / migration state, invalid provenance, discovery/curation
 * parse failures (unknown tags, unresolved refs, cross-dimension refs,
 * invalid timestamps), rights-PENDING entries that are not PUBLIC_BLOCKED,
 * and publicStatus/gate mismatches (MIGRATED without a passing public gate,
 * MANUAL_REVIEW without the french exception, PUBLIC_BLOCKED while eligible).
 */
export function parseMigrationManifestV1(
  value: unknown,
  taxonomy: CommunityTaxonomyV2,
): ParseResultV2<CommunityDiscoveryMigrationManifestV1> {
  const issues: TaxonomyV2Issue[] = [];
  if (!isPlainObject(value)) {
    push(issues, 'not_an_object', '$', 'migration manifest must be an object');
    return { ok: false, issues };
  }
  const rootAllowed = ['schemaVersion', 'contractRef', 'description', 'entries'];
  for (const key of Object.keys(value)) {
    if (!rootAllowed.includes(key)) {
      push(issues, 'unknown_key', `$.${key}`, 'unknown migration manifest key');
    }
  }
  if (value.schemaVersion !== MIGRATION_MANIFEST_SCHEMA_VERSION) {
    push(issues, 'schema_version', '$.schemaVersion', `schemaVersion must be ${MIGRATION_MANIFEST_SCHEMA_VERSION}`);
  }
  if (value.contractRef !== MIGRATION_MANIFEST_CONTRACT) {
    push(issues, 'contract_version', '$.contractRef', `contractRef must be ${MIGRATION_MANIFEST_CONTRACT}`);
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    push(issues, 'invalid_description', '$.description', 'description must be a string');
  }
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    push(issues, 'empty_entries', '$.entries', 'entries must be a non-empty array');
    return { ok: false, issues };
  }

  const parsedEntries: MigrationManifestEntryV1[] = [];
  const ids = new Set<string>();
  const subjectIds = new Set<string>();
  value.entries.forEach((rawEntry, index) => {
    const path = `$.entries[${index}]`;
    if (!isPlainObject(rawEntry)) {
      push(issues, 'invalid_entry', path, 'entry must be an object');
      return;
    }
    const entryAllowed = [
      'contentId', 'subjectRef', 'sourceClass', 'provenance', 'publicStatus',
      'legacyStyleIds', 'discovery', 'curation',
    ];
    for (const key of Object.keys(rawEntry)) {
      if (!entryAllowed.includes(key)) {
        push(issues, 'unknown_key', `${path}.${key}`, 'unknown entry key');
      }
    }
    const { contentId, subjectRef, sourceClass, provenance, publicStatus, legacyStyleIds, discovery, curation } = rawEntry;

    if (!nonEmptyString(contentId)) {
      push(issues, 'invalid_content_id', `${path}.contentId`, 'contentId must be a non-empty string');
      return;
    }
    if (ids.has(contentId)) {
      push(issues, 'duplicate_content_id', `${path}.contentId`, `contentId "${contentId}" is duplicated`);
      return;
    }
    ids.add(contentId);

    if (!MIGRATION_SOURCE_CLASSES.includes(sourceClass as MigrationSourceClass)) {
      push(issues, 'invalid_source_class', `${path}.sourceClass`, `sourceClass must be one of ${MIGRATION_SOURCE_CLASSES.join(', ')}`);
    }
    if (!MIGRATION_PUBLIC_STATUSES.includes(publicStatus as MigrationPublicStatus)) {
      push(issues, 'invalid_public_status', `${path}.publicStatus`, `publicStatus must be one of ${MIGRATION_PUBLIC_STATUSES.join(', ')}`);
    }
    if (!isPlainObject(provenance)) {
      push(issues, 'invalid_provenance', `${path}.provenance`, 'provenance must be an object');
    } else {
      for (const key of Object.keys(provenance)) {
        if (!['firstParty', 'note'].includes(key)) {
          push(issues, 'unknown_key', `${path}.provenance.${key}`, 'unknown provenance key');
        }
      }
      if (typeof provenance.firstParty !== 'boolean') {
        push(issues, 'invalid_provenance', `${path}.provenance.firstParty`, 'firstParty must be a boolean');
      }
      if (provenance.note !== undefined && typeof provenance.note !== 'string') {
        push(issues, 'invalid_provenance_note', `${path}.provenance.note`, 'note must be a string');
      }
    }
    if (!Array.isArray(legacyStyleIds) || !legacyStyleIds.every((id) => nonEmptyString(id))) {
      push(issues, 'invalid_legacy_style_ids', `${path}.legacyStyleIds`, 'legacyStyleIds must be an array of strings');
    } else if (hasDuplicates(legacyStyleIds as string[])) {
      push(issues, 'duplicate_legacy_style_id', `${path}.legacyStyleIds`, 'legacyStyleIds must be unique');
    }

    if (!isPlainObject(subjectRef) || subjectRef.kind !== 'PUBLISHED_LOOK' || !nonEmptyString(subjectRef.id)) {
      push(issues, 'invalid_subject_ref', `${path}.subjectRef`, 'subjectRef must be { kind: "PUBLISHED_LOOK", id }');
    } else {
      const expectedSubjectId = discoverySubjectId(contentId);
      if (subjectRef.id !== expectedSubjectId) {
        push(
          issues,
          'subject_ref_mismatch',
          `${path}.subjectRef.id`,
          `subjectRef.id must be "${expectedSubjectId}" (look:<contentId> convention)`,
        );
      }
      if (subjectIds.has(subjectRef.id)) {
        push(issues, 'duplicate_subject_ref', `${path}.subjectRef.id`, `subjectRef.id "${subjectRef.id}" is duplicated`);
      }
      subjectIds.add(subjectRef.id);
    }

    let parsedDiscovery: CommunityDiscoveryMetadataV1 | null = null;
    let parsedCuration: CommunityCurationMetadataV1 | null = null;
    const discoveryResult = parseDiscoveryMetadataV1(discovery, taxonomy);
    if (!discoveryResult.ok) {
      for (const issue of discoveryResult.issues) {
        push(issues, issue.code, `${path}.discovery${issue.path.slice(1)}`, issue.message);
      }
    } else {
      parsedDiscovery = discoveryResult.value;
      const expectedSubjectId = discoverySubjectId(contentId);
      if (parsedDiscovery.subjectRef.id !== expectedSubjectId) {
        push(
          issues,
          'discovery_subject_mismatch',
          `${path}.discovery.subjectRef.id`,
          `discovery subjectRef.id must be "${expectedSubjectId}"`,
        );
      }
    }
    const curationResult = parseCurationMetadataV1(curation);
    if (!curationResult.ok) {
      for (const issue of curationResult.issues) {
        push(issues, issue.code, `${path}.curation${issue.path.slice(1)}`, issue.message);
      }
    } else {
      parsedCuration = curationResult.value;
      const expectedSubjectId = discoverySubjectId(contentId);
      if (parsedCuration.subjectRef.id !== expectedSubjectId) {
        push(
          issues,
          'curation_subject_mismatch',
          `${path}.curation.subjectRef.id`,
          `curation subjectRef.id must be "${expectedSubjectId}"`,
        );
      }
    }

    // Public-status / governance consistency (fail closed, never synthesized).
    if (parsedDiscovery) {
      const rightsPending = parsedDiscovery.rights.status === 'PENDING';
      // COMM-v0.7.2-TAX-02 hard rule: the entry-level legacy style list is the
      // single migration authority; discovery.migration.legacyStyleIds must
      // mirror it exactly (order-insensitive). Drift is a typed parser issue.
      const entryLegacy = [...(Array.isArray(legacyStyleIds) ? (legacyStyleIds as string[]) : [])].sort();
      const discoveryLegacy = [...parsedDiscovery.migration.legacyStyleIds].sort();
      if (JSON.stringify(entryLegacy) !== JSON.stringify(discoveryLegacy)) {
        push(
          issues,
          'legacy_style_mismatch',
          `${path}.discovery.migration.legacyStyleIds`,
          `discovery.migration.legacyStyleIds must equal entry legacyStyleIds (declared [${entryLegacy.join(', ')}])`,
        );
      }
      if (rightsPending && publicStatus !== 'PUBLIC_BLOCKED') {
        push(
          issues,
          'rights_pending_not_blocked',
          `${path}.publicStatus`,
          'rights PENDING is never public: publicStatus must be PUBLIC_BLOCKED',
        );
      }
      if (publicStatus === 'MIGRATED') {
        const gate = publicationEligibility(parsedDiscovery, taxonomy);
        if (!gate.eligible || gate.legacyExceptionApplied) {
          push(
            issues,
            'public_status_gate_mismatch',
            `${path}.publicStatus`,
            'MIGRATED requires a passing public gate without the legacy french exception',
          );
        }
      }
      if (publicStatus === 'MANUAL_REVIEW') {
        if (!legacyStyleReviewExceptionApplies(parsedDiscovery, taxonomy)) {
          push(
            issues,
            'public_status_exception_mismatch',
            `${path}.publicStatus`,
            'MANUAL_REVIEW requires the narrow NEEDS_STYLE_REVIEW french exception (technique:french, empty styleIds)',
          );
        }
      }
      if (publicStatus === 'PUBLIC_BLOCKED' && !rightsPending) {
        const gate = publicationEligibility(parsedDiscovery, taxonomy);
        if (gate.eligible) {
          push(
            issues,
            'public_status_blocked_mismatch',
            `${path}.publicStatus`,
            'PUBLIC_BLOCKED entries must not pass the public gate',
          );
        }
      }
    }

    if (parsedDiscovery && parsedCuration) {
      const parsedProvenance = isPlainObject(provenance) ? provenance : {};
      parsedEntries.push({
        contentId,
        subjectRef: { kind: 'PUBLISHED_LOOK', id: discoverySubjectId(contentId) },
        sourceClass: sourceClass as MigrationSourceClass,
        provenance: {
          firstParty: parsedProvenance.firstParty === true,
          ...(typeof parsedProvenance.note === 'string' ? { note: parsedProvenance.note } : {}),
        },
        publicStatus: publicStatus as MigrationPublicStatus,
        legacyStyleIds: Array.isArray(legacyStyleIds) ? [...(legacyStyleIds as string[])] : [],
        discovery: parsedDiscovery,
        curation: parsedCuration,
      });
    }
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, contractRef: MIGRATION_MANIFEST_CONTRACT, entries: parsedEntries } };
}

// ---------------------------------------------------------------------------
// Content-index coverage validation (pure; used by the strict load path)
// ---------------------------------------------------------------------------

export interface MigrationCoverageIssueV1 {
  code: 'missing_manifest_entry' | 'orphan_manifest_entry' | 'legacy_style_mismatch' | 'subject_identity_mismatch' | 'legacy_class_not_public';
  contentId: string;
  message: string;
}

/**
 * Validates that the manifest covers every content-index record and that each
 * LEGACY_CONTENT_INDEX entry agrees with its record (legacy style ids match
 * `[mainStyleId, ...subStyleIds]`, and the record is PUBLISHED/non-demo-gated
 * consistently with the entry's public status). Pure and deterministic.
 */
export function validateContentIndexCoverageV1(input: {
  manifest: CommunityDiscoveryMigrationManifestV1;
  contents: ReadonlyArray<{ contentId: string; mainStyleId: string; subStyleIds: string[]; status: string; demo?: boolean }>;
}): MigrationCoverageIssueV1[] {
  const issues: MigrationCoverageIssueV1[] = [];
  const index = buildMigrationManifestIndexV1(input.manifest);
  const recordById = new Map(input.contents.map((record) => [record.contentId, record]));

  for (const record of input.contents) {
    const entry = index.byId.get(record.contentId);
    if (!entry) {
      issues.push({
        code: 'missing_manifest_entry',
        contentId: record.contentId,
        message: `content record "${record.contentId}" has no migration manifest entry`,
      });
      continue;
    }
    if (entry.sourceClass !== 'LEGACY_CONTENT_INDEX') {
      issues.push({
        code: 'legacy_class_not_public',
        contentId: record.contentId,
        message: `manifest entry for content record "${record.contentId}" must use sourceClass LEGACY_CONTENT_INDEX`,
      });
    }
    const expectedLegacyStyles = [...new Set([record.mainStyleId, ...record.subStyleIds])];
    const declared = [...entry.legacyStyleIds];
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...expectedLegacyStyles].sort())) {
      issues.push({
        code: 'legacy_style_mismatch',
        contentId: record.contentId,
        message: `manifest legacyStyleIds [${declared.join(', ')}] do not match record styles [${expectedLegacyStyles.join(', ')}]`,
      });
    }
    if (entry.discovery.subjectRef.id !== discoverySubjectId(record.contentId)) {
      issues.push({
        code: 'subject_identity_mismatch',
        contentId: record.contentId,
        message: `discovery subjectRef must be "${discoverySubjectId(record.contentId)}"`,
      });
    }
    if (record.status !== 'PUBLISHED' && entry.publicStatus !== 'PUBLIC_BLOCKED') {
      issues.push({
        code: 'legacy_class_not_public',
        contentId: record.contentId,
        message: `non-published record "${record.contentId}" must map to publicStatus PUBLIC_BLOCKED`,
      });
    }
  }

  for (const entry of input.manifest.entries) {
    if (entry.sourceClass === 'LEGACY_CONTENT_INDEX' && !recordById.has(entry.contentId)) {
      issues.push({
        code: 'orphan_manifest_entry',
        contentId: entry.contentId,
        message: `manifest entry "${entry.contentId}" has no content-index record`,
      });
    }
  }

  return issues;
}

// Re-exported types for tooling/tests.
export type { MigrationState };
export { MIGRATION_STATES };
