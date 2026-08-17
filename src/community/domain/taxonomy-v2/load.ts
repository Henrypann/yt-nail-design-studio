/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-02 strict discovery-index load (pure).
 *
 * The checked-in fixtures `taxonomy-v2.json` + `migration-manifest-v1.json` +
 * `content-index.json` are the only authority for community discovery. This
 * module runs the three strict parsers and the content-index coverage
 * validator and builds the runtime discovery index. It never synthesizes a
 * discovery/curation record:
 *
 * - Taxonomy or manifest parse failure, or a structurally invalid content
 *   index → global failure (`ok: false` with typed issues). Consumers must
 *   keep every discovery projection `null` and emit the diagnostic.
 * - Per-record content-index coverage failures (missing / orphan manifest
 *   entry, legacy style mismatch, subject identity mismatch, non-published
 *   record mapping, duplicate content ids) → that record is reported in
 *   `blocked` and excluded from the index; every other record still loads.
 * - rights-PENDING entries stay PUBLIC_BLOCKED by the manifest parser and are
 *   excluded from public browse by the governance gate, never by inference.
 *
 * Pure and Node-testable (no browser globals, no env access, no clock).
 */

import type { CommunityTaxonomyV2 } from './types';
import {
  parseMigrationManifestV1,
  validateContentIndexCoverageV1,
  discoverySubjectId,
  type CommunityDiscoveryMigrationManifestV1,
  type MigrationPublicStatus,
  type MigrationSourceClass,
} from './migration-manifest';
import { parseCommunityTaxonomyV2 } from './parse';
import type { CommunityCurationMetadataV1, CommunityDiscoveryMetadataV1, SubjectRefV1 } from './types';

export const DISCOVERY_INDEX_SCHEMA_VERSION = 1 as const;

export interface DiscoveryIndexIssueV1 {
  code: string;
  scope: 'taxonomy' | 'manifest' | 'content-index';
  path: string;
  message: string;
}

export interface DiscoveryIndexEntryV1 {
  contentId: string;
  subjectRef: SubjectRefV1;
  sourceClass: MigrationSourceClass;
  publicStatus: MigrationPublicStatus;
  legacyStyleIds: string[];
  discovery: CommunityDiscoveryMetadataV1;
  curation: CommunityCurationMetadataV1;
}

export interface CommunityDiscoveryIndexV1 {
  schemaVersion: typeof DISCOVERY_INDEX_SCHEMA_VERSION;
  /** Stable manifest order. */
  entries: DiscoveryIndexEntryV1[];
  byContentId: Map<string, DiscoveryIndexEntryV1>;
  bySubjectId: Map<string, DiscoveryIndexEntryV1>;
}

export interface DiscoveryIndexBlockedEntryV1 {
  contentId: string;
  code: 'missing_manifest_entry' | 'orphan_manifest_entry' | 'legacy_style_mismatch'
    | 'subject_identity_mismatch' | 'legacy_class_not_public' | 'duplicate_content_id';
  message: string;
}

export type DiscoveryIndexLoadResultV1 =
  | { ok: true; index: CommunityDiscoveryIndexV1; blocked: DiscoveryIndexBlockedEntryV1[] }
  | { ok: false; issues: DiscoveryIndexIssueV1[] };

export interface ContentIndexRecordShapeV1 {
  contentId: string;
  mainStyleId: string;
  subStyleIds: string[];
  status: string;
  demo?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Minimal structural extraction of the content-index `contents` records. */
function extractContentIndexRecords(raw: unknown): {
  records: ContentIndexRecordShapeV1[];
  issues: DiscoveryIndexIssueV1[];
} {
  const issues: DiscoveryIndexIssueV1[] = [];
  if (!isPlainObject(raw)) {
    issues.push({ code: 'invalid_content_index', scope: 'content-index', path: '$', message: 'content index must be an object' });
    return { records: [], issues };
  }
  if (raw.schemaVersion !== 1) {
    issues.push({ code: 'schema_version', scope: 'content-index', path: '$.schemaVersion', message: 'content index schemaVersion must be 1' });
  }
  if (!Array.isArray(raw.contents)) {
    issues.push({ code: 'invalid_contents', scope: 'content-index', path: '$.contents', message: 'contents must be an array' });
    return { records: [], issues };
  }
  const records: ContentIndexRecordShapeV1[] = [];
  const seen = new Set<string>();
  raw.contents.forEach((record, index) => {
    const path = `$.contents[${index}]`;
    if (!isPlainObject(record)) {
      issues.push({ code: 'invalid_record', scope: 'content-index', path, message: 'record must be an object' });
      return;
    }
    if (!nonEmptyString(record.contentId)) {
      issues.push({ code: 'invalid_record', scope: 'content-index', path: `${path}.contentId`, message: 'contentId must be a non-empty string' });
      return;
    }
    if (seen.has(record.contentId)) {
      issues.push({ code: 'duplicate_content_id', scope: 'content-index', path: `${path}.contentId`, message: `contentId "${record.contentId}" is duplicated` });
      return;
    }
    seen.add(record.contentId);
    if (!nonEmptyString(record.mainStyleId)) {
      issues.push({ code: 'invalid_record', scope: 'content-index', path: `${path}.mainStyleId`, message: 'mainStyleId must be a non-empty string' });
      return;
    }
    if (!Array.isArray(record.subStyleIds) || !record.subStyleIds.every((id) => nonEmptyString(id))) {
      issues.push({ code: 'invalid_record', scope: 'content-index', path: `${path}.subStyleIds`, message: 'subStyleIds must be an array of strings' });
      return;
    }
    if (typeof record.status !== 'string') {
      issues.push({ code: 'invalid_record', scope: 'content-index', path: `${path}.status`, message: 'status must be a string' });
      return;
    }
    if (record.demo !== undefined && typeof record.demo !== 'boolean') {
      issues.push({ code: 'invalid_record', scope: 'content-index', path: `${path}.demo`, message: 'demo must be a boolean' });
      return;
    }
    records.push({
      contentId: record.contentId,
      mainStyleId: record.mainStyleId,
      subStyleIds: [...(record.subStyleIds as string[])],
      status: record.status,
      demo: record.demo === true,
    });
  });
  return { records, issues };
}

/**
 * Strict runtime load of taxonomy-v2 + migration-manifest-v1 + content-index.
 * Global failures (taxonomy/manifest/content-index structure) return
 * `ok: false`; per-record coverage failures return `ok: true` with `blocked`.
 */
export function buildCommunityDiscoveryIndexV1(input: {
  taxonomyRaw: unknown;
  manifestRaw: unknown;
  contentIndexRaw: unknown;
}): DiscoveryIndexLoadResultV1 {
  const taxonomyResult = parseCommunityTaxonomyV2(input.taxonomyRaw);
  if (!taxonomyResult.ok) {
    return {
      ok: false,
      issues: taxonomyResult.issues.map((issue) => ({
        code: issue.code,
        scope: 'taxonomy' as const,
        path: issue.path,
        message: issue.message,
      })),
    };
  }
  const taxonomy: CommunityTaxonomyV2 = taxonomyResult.value;

  const manifestResult = parseMigrationManifestV1(input.manifestRaw, taxonomy);
  if (!manifestResult.ok) {
    return {
      ok: false,
      issues: manifestResult.issues.map((issue) => ({
        code: issue.code,
        scope: 'manifest' as const,
        path: issue.path,
        message: issue.message,
      })),
    };
  }
  const manifest: CommunityDiscoveryMigrationManifestV1 = manifestResult.value;

  const { records, issues: indexIssues } = extractContentIndexRecords(input.contentIndexRaw);
  if (indexIssues.length > 0) return { ok: false, issues: indexIssues };

  const coverage = validateContentIndexCoverageV1({
    manifest,
    contents: records.map((record) => ({
      contentId: record.contentId,
      mainStyleId: record.mainStyleId,
      subStyleIds: record.subStyleIds,
      status: record.status,
      demo: record.demo,
    })),
  });

  const blocked = new Map<string, DiscoveryIndexBlockedEntryV1>();
  for (const issue of coverage) {
    blocked.set(issue.contentId, {
      contentId: issue.contentId,
      code: issue.code,
      message: issue.message,
    });
  }
  for (const record of records) {
    if (!manifest.entries.some((entry) => entry.contentId === record.contentId)) {
      blocked.set(record.contentId, {
        contentId: record.contentId,
        code: 'missing_manifest_entry',
        message: `content record "${record.contentId}" has no migration manifest entry`,
      });
    }
  }

  const entries: DiscoveryIndexEntryV1[] = [];
  for (const entry of manifest.entries) {
    if (blocked.has(entry.contentId)) continue;
    entries.push({
      contentId: entry.contentId,
      subjectRef: { kind: 'PUBLISHED_LOOK', id: entry.subjectRef.id },
      sourceClass: entry.sourceClass,
      publicStatus: entry.publicStatus,
      legacyStyleIds: [...entry.legacyStyleIds],
      discovery: structuredClone(entry.discovery),
      curation: structuredClone(entry.curation),
    });
  }

  const index: CommunityDiscoveryIndexV1 = {
    schemaVersion: DISCOVERY_INDEX_SCHEMA_VERSION,
    entries,
    byContentId: new Map(entries.map((entry) => [entry.contentId, entry])),
    bySubjectId: new Map(entries.map((entry) => [entry.subjectRef.id, entry])),
  };
  return { ok: true, index, blocked: [...blocked.values()] };
}

/** Deterministic discovery subject id (mirrors migration-manifest convention). */
export { discoverySubjectId };
