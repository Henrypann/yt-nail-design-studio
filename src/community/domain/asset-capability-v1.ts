/**
 * Community v0.7.2 · COMM-ASSET-03A Look capability and lineage contract.
 *
 * This is a read-only projection. It never writes EditorDoc, never derives
 * rights or makeability from legacy application/verification labels, and
 * never upgrades digital evidence into manufacturing evidence.
 */

import {
  actionPermissions,
  isCurrentMakeable,
  type ActionPermissionsV1,
} from './taxonomy-v2/governance.ts';
import {
  MAKEABILITY_CLASSIFICATIONS,
  RIGHTS_STATUSES,
  type MakeabilityClassification,
  type RightsStatus,
} from './taxonomy-v2/contract.ts';
import {
  MIGRATION_PUBLIC_STATUSES,
  MIGRATION_SOURCE_CLASSES,
  type CommunityDiscoveryMigrationManifestV1,
  type MigrationManifestEntryV1,
  type MigrationPublicStatus,
  type MigrationSourceClass,
} from './taxonomy-v2/migration-manifest.ts';
import type { PublishedLookReadModelV1 } from './v7_1/published-look-read-model.ts';

export const COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1 = 'COMM-v0.7.2-ASSET-03A' as const;

export const COMMUNITY_ASSET_TECHNICAL_STATUSES_V1 = [
  'EXACT',
  'APPROXIMATE',
  'INCOMPLETE',
  'UNAVAILABLE',
] as const;
export type CommunityAssetTechnicalStatusV1 =
  (typeof COMMUNITY_ASSET_TECHNICAL_STATUSES_V1)[number];

export const COMMUNITY_LOOK_CAPABILITY_STATES_V1 = [
  'VERSIONED_READY',
  'LEGACY_APPROXIMATE',
  'INSPIRATION_ONLY',
  'ASSETS_INCOMPLETE',
  'UNAVAILABLE',
] as const;
export type CommunityLookCapabilityStateV1 =
  (typeof COMMUNITY_LOOK_CAPABILITY_STATES_V1)[number];

export type CommunityLookAssetCtaV1 =
  | 'USE_VERSIONED'
  | 'USE_LEGACY_APPROXIMATE'
  | 'VIEW_ONLY'
  | 'UNAVAILABLE';

export interface CommunityDesignVersionLineageV1 {
  designVersionId: string;
  editorDocSha256: string;
  previewSha256: string;
}

export interface CommunityLegacyAssetLineageV1 {
  templateId: string;
  assetVersion: string;
  manifestUrl: string;
}

export interface CommunityCoverLineageV1 {
  url: string;
  /** Legacy editorial covers have no immutable hash; absence stays explicit. */
  sha256: string | null;
}

/** Explicit audited input. No field may be inferred from a content card. */
export interface CommunityLookAssetCapabilityEvidenceV1 {
  schemaVersion: 1;
  contractRef: typeof COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1;
  contentId: string;
  subjectId: string;
  sourceClass: MigrationSourceClass;
  publicStatus: MigrationPublicStatus;
  rightsStatus: RightsStatus;
  makeabilityClassification: MakeabilityClassification;
  recommendedShapeIds: string[];
  technicalStatus: CommunityAssetTechnicalStatusV1;
  intendedCapabilityState: CommunityLookCapabilityStateV1;
  designVersionRef: CommunityDesignVersionLineageV1 | null;
  legacyAssetRef: CommunityLegacyAssetLineageV1 | null;
  coverRef: CommunityCoverLineageV1;
  diagnostics: string[];
  manufacturingValidated: false;
}

export interface CommunityLookAssetCapabilityReadModelV1 {
  schemaVersion: 1;
  contractRef: typeof COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1;
  contentId: string;
  subjectId: string;
  sourceClass: MigrationSourceClass;
  publicStatus: MigrationPublicStatus;
  rightsStatus: RightsStatus;
  makeabilityClassification: MakeabilityClassification;
  recommendedShapeIds: string[];
  technicalStatus: CommunityAssetTechnicalStatusV1;
  capabilityState: CommunityLookCapabilityStateV1;
  cta: CommunityLookAssetCtaV1;
  permissions: ActionPermissionsV1;
  currentMakeable: boolean;
  designVersionRef: CommunityDesignVersionLineageV1 | null;
  legacyAssetRef: CommunityLegacyAssetLineageV1 | null;
  coverRef: CommunityCoverLineageV1;
  diagnostics: string[];
  manufacturingValidated: false;
}

export interface CommunityAssetCapabilityIssueV1 {
  code: string;
  path: string;
  message: string;
}

export type CommunityAssetCapabilityResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; issues: CommunityAssetCapabilityIssueV1[] };

const ROOT_KEYS = [
  'schemaVersion',
  'contractRef',
  'contentId',
  'subjectId',
  'sourceClass',
  'publicStatus',
  'rightsStatus',
  'makeabilityClassification',
  'recommendedShapeIds',
  'technicalStatus',
  'intendedCapabilityState',
  'designVersionRef',
  'legacyAssetRef',
  'coverRef',
  'diagnostics',
  'manufacturingValidated',
] as const;

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._:-]*$/;
const ASSET_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function add(
  issues: CommunityAssetCapabilityIssueV1[],
  code: string,
  path: string,
  message: string,
): void {
  if (issues.length < 200) issues.push({ code, path, message });
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: CommunityAssetCapabilityIssueV1[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add(issues, 'unknown_key', `${path}.${key}`, 'unknown key');
  }
  for (const key of allowed) {
    if (!(key in value)) add(issues, 'missing_key', `${path}.${key}`, 'required key is missing');
  }
}

function stringArray(
  value: unknown,
  path: string,
  issues: CommunityAssetCapabilityIssueV1[],
  predicate: (item: string) => boolean = (item) => item.trim().length > 0,
): value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && predicate(item))) {
    add(issues, 'invalid_string_array', path, 'must be an array of valid strings');
    return false;
  }
  if (new Set(value).size !== value.length) add(issues, 'duplicate_value', path, 'values must be unique');
  return true;
}

function parseDesignVersionRef(
  value: unknown,
  path: string,
  issues: CommunityAssetCapabilityIssueV1[],
): CommunityDesignVersionLineageV1 | null {
  if (value === null) return null;
  if (!isObject(value)) {
    add(issues, 'invalid_design_version_ref', path, 'must be an object or null');
    return null;
  }
  exactKeys(value, ['designVersionId', 'editorDocSha256', 'previewSha256'], path, issues);
  if (typeof value.designVersionId !== 'string' || !ID.test(value.designVersionId)) {
    add(issues, 'invalid_design_version_id', `${path}.designVersionId`, 'invalid designVersionId');
  }
  for (const key of ['editorDocSha256', 'previewSha256'] as const) {
    if (typeof value[key] !== 'string' || !SHA256.test(value[key])) {
      add(issues, 'invalid_sha256', `${path}.${key}`, 'must be a lowercase SHA-256');
    }
  }
  if (issues.some((issue) => issue.path.startsWith(path))) return null;
  return value as unknown as CommunityDesignVersionLineageV1;
}

function parseLegacyAssetRef(
  value: unknown,
  path: string,
  issues: CommunityAssetCapabilityIssueV1[],
): CommunityLegacyAssetLineageV1 | null {
  if (value === null) return null;
  if (!isObject(value)) {
    add(issues, 'invalid_legacy_asset_ref', path, 'must be an object or null');
    return null;
  }
  exactKeys(value, ['templateId', 'assetVersion', 'manifestUrl'], path, issues);
  if (typeof value.templateId !== 'string' || !ID.test(value.templateId)) {
    add(issues, 'invalid_template_id', `${path}.templateId`, 'invalid templateId');
  }
  if (typeof value.assetVersion !== 'string' || !ASSET_VERSION.test(value.assetVersion)) {
    add(issues, 'invalid_asset_version', `${path}.assetVersion`, 'invalid semantic asset version');
  }
  if (typeof value.manifestUrl !== 'string' || !value.manifestUrl.startsWith('/')) {
    add(issues, 'invalid_manifest_url', `${path}.manifestUrl`, 'manifestUrl must be root-relative');
  }
  if (issues.some((issue) => issue.path.startsWith(path))) return null;
  return value as unknown as CommunityLegacyAssetLineageV1;
}

function parseCoverRef(
  value: unknown,
  path: string,
  issues: CommunityAssetCapabilityIssueV1[],
): CommunityCoverLineageV1 | null {
  if (!isObject(value)) {
    add(issues, 'invalid_cover_ref', path, 'must be an object');
    return null;
  }
  exactKeys(value, ['url', 'sha256'], path, issues);
  if (typeof value.url !== 'string' || !value.url.startsWith('/')) {
    add(issues, 'invalid_cover_url', `${path}.url`, 'cover URL must be root-relative');
  }
  if (value.sha256 !== null && (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256))) {
    add(issues, 'invalid_sha256', `${path}.sha256`, 'must be null or a lowercase SHA-256');
  }
  if (issues.some((issue) => issue.path.startsWith(path))) return null;
  return value as unknown as CommunityCoverLineageV1;
}

function validateState(
  value: CommunityLookAssetCapabilityEvidenceV1,
  issues: CommunityAssetCapabilityIssueV1[],
): void {
  const fail = (message: string) => add(issues, 'state_mismatch', '$.intendedCapabilityState', message);
  switch (value.intendedCapabilityState) {
    case 'VERSIONED_READY':
      if (value.technicalStatus !== 'EXACT' || !value.designVersionRef || value.legacyAssetRef) {
        fail('VERSIONED_READY requires EXACT + designVersionRef and forbids legacyAssetRef');
      }
      if (!['CANONICAL_DEMO', 'V0_7_2_LOOK_SET', 'CREATOR_V1_FIXTURE'].includes(value.sourceClass)) {
        fail('VERSIONED_READY requires a versioned source class');
      }
      break;
    case 'LEGACY_APPROXIMATE':
      if (value.sourceClass !== 'LEGACY_CONTENT_INDEX' || value.technicalStatus !== 'APPROXIMATE' || !value.legacyAssetRef || value.designVersionRef) {
        fail('LEGACY_APPROXIMATE requires legacy source + APPROXIMATE + legacyAssetRef only');
      }
      break;
    case 'INSPIRATION_ONLY':
      if (value.technicalStatus !== 'APPROXIMATE' || value.designVersionRef || value.legacyAssetRef) {
        fail('INSPIRATION_ONLY requires APPROXIMATE and no editable lineage');
      }
      break;
    case 'ASSETS_INCOMPLETE':
      if (value.technicalStatus !== 'INCOMPLETE' || value.designVersionRef || value.legacyAssetRef) {
        fail('ASSETS_INCOMPLETE requires INCOMPLETE and no editable lineage');
      }
      break;
    case 'UNAVAILABLE':
      if (value.technicalStatus !== 'UNAVAILABLE' || value.designVersionRef || value.legacyAssetRef) {
        fail('UNAVAILABLE requires UNAVAILABLE and no editable lineage');
      }
      break;
  }
  if ((value.publicStatus === 'PUBLIC_BLOCKED' || value.rightsStatus === 'PENDING') && value.intendedCapabilityState !== 'UNAVAILABLE') {
    fail('PUBLIC_BLOCKED or PENDING rights must be UNAVAILABLE');
  }
  if (value.intendedCapabilityState === 'VERSIONED_READY' && value.coverRef.sha256 !== value.designVersionRef?.previewSha256) {
    add(issues, 'preview_sha_mismatch', '$.coverRef.sha256', 'versioned cover SHA must equal preview SHA');
  }
}

/** Strict exact-key parser for one controlled capability evidence record. */
export function parseCommunityLookAssetCapabilityEvidenceV1(
  input: unknown,
): CommunityAssetCapabilityResultV1<CommunityLookAssetCapabilityEvidenceV1> {
  const issues: CommunityAssetCapabilityIssueV1[] = [];
  if (!isObject(input)) return { ok: false, issues: [{ code: 'not_an_object', path: '$', message: 'evidence must be an object' }] };
  exactKeys(input, ROOT_KEYS, '$', issues);
  if (input.schemaVersion !== 1) add(issues, 'schema_version', '$.schemaVersion', 'schemaVersion must be 1');
  if (input.contractRef !== COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1) add(issues, 'contract_ref', '$.contractRef', `contractRef must be ${COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1}`);
  for (const key of ['contentId', 'subjectId'] as const) {
    if (typeof input[key] !== 'string' || !ID.test(input[key])) add(issues, 'invalid_id', `$.${key}`, 'invalid identifier');
  }
  if (!MIGRATION_SOURCE_CLASSES.includes(input.sourceClass as MigrationSourceClass)) add(issues, 'invalid_source_class', '$.sourceClass', 'unknown source class');
  if (!MIGRATION_PUBLIC_STATUSES.includes(input.publicStatus as MigrationPublicStatus)) add(issues, 'invalid_public_status', '$.publicStatus', 'unknown public status');
  if (!RIGHTS_STATUSES.includes(input.rightsStatus as RightsStatus)) add(issues, 'invalid_rights_status', '$.rightsStatus', 'unknown rights status');
  if (!MAKEABILITY_CLASSIFICATIONS.includes(input.makeabilityClassification as MakeabilityClassification)) add(issues, 'invalid_makeability', '$.makeabilityClassification', 'unknown makeability classification');
  stringArray(input.recommendedShapeIds, '$.recommendedShapeIds', issues, (item) => /^shape:[a-z0-9][a-z0-9-]*$/.test(item));
  if (Array.isArray(input.recommendedShapeIds) && input.recommendedShapeIds.length === 0) {
    add(issues, 'empty_shape_ids', '$.recommendedShapeIds', 'at least one recommended shape is required');
  }
  if (!COMMUNITY_ASSET_TECHNICAL_STATUSES_V1.includes(input.technicalStatus as CommunityAssetTechnicalStatusV1)) add(issues, 'invalid_technical_status', '$.technicalStatus', 'unknown technical status');
  if (!COMMUNITY_LOOK_CAPABILITY_STATES_V1.includes(input.intendedCapabilityState as CommunityLookCapabilityStateV1)) add(issues, 'invalid_capability_state', '$.intendedCapabilityState', 'unknown capability state');
  const designVersionRef = parseDesignVersionRef(input.designVersionRef, '$.designVersionRef', issues);
  const legacyAssetRef = parseLegacyAssetRef(input.legacyAssetRef, '$.legacyAssetRef', issues);
  const coverRef = parseCoverRef(input.coverRef, '$.coverRef', issues);
  stringArray(input.diagnostics, '$.diagnostics', issues);
  if (Array.isArray(input.diagnostics) && input.diagnostics.length === 0) {
    add(issues, 'empty_diagnostics', '$.diagnostics', 'at least one explicit diagnostic is required');
  }
  if (input.manufacturingValidated !== false) add(issues, 'manufacturing_claim', '$.manufacturingValidated', 'must remain false');
  if (
    typeof input.contentId === 'string'
    && typeof input.subjectId === 'string'
    && input.subjectId !== `look:${input.contentId}`
  ) {
    add(issues, 'subject_id_mismatch', '$.subjectId', 'subjectId must equal look:<contentId>');
  }
  if (issues.length > 0 || !coverRef) return { ok: false, issues };
  const value: CommunityLookAssetCapabilityEvidenceV1 = {
    ...(structuredClone(input) as unknown as CommunityLookAssetCapabilityEvidenceV1),
    designVersionRef,
    legacyAssetRef,
    coverRef,
  };
  validateState(value, issues);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

function ctaFor(state: CommunityLookCapabilityStateV1): CommunityLookAssetCtaV1 {
  if (state === 'VERSIONED_READY') return 'USE_VERSIONED';
  if (state === 'LEGACY_APPROXIMATE') return 'USE_LEGACY_APPROXIMATE';
  if (state === 'INSPIRATION_ONLY' || state === 'ASSETS_INCOMPLETE') return 'VIEW_ONLY';
  return 'UNAVAILABLE';
}

/** Binds explicit asset evidence to the existing discovery migration authority. */
export function projectCommunityLookAssetCapabilityV1(
  evidence: CommunityLookAssetCapabilityEvidenceV1,
  migration: MigrationManifestEntryV1,
  versionedAuthority?: PublishedLookReadModelV1,
): CommunityAssetCapabilityResultV1<CommunityLookAssetCapabilityReadModelV1> {
  const issues: CommunityAssetCapabilityIssueV1[] = [];
  const parity: Array<[boolean, string, string]> = [
    [evidence.contentId === migration.contentId, 'content_id_mismatch', '$.contentId'],
    [evidence.subjectId === migration.subjectRef.id, 'subject_id_mismatch', '$.subjectId'],
    [evidence.sourceClass === migration.sourceClass, 'source_class_mismatch', '$.sourceClass'],
    [evidence.publicStatus === migration.publicStatus, 'public_status_mismatch', '$.publicStatus'],
    [evidence.rightsStatus === migration.discovery.rights.status, 'rights_status_mismatch', '$.rightsStatus'],
    [evidence.makeabilityClassification === migration.discovery.makeability.classification, 'makeability_mismatch', '$.makeabilityClassification'],
    [JSON.stringify(evidence.recommendedShapeIds) === JSON.stringify(migration.discovery.recommendedShapeIds), 'shape_ids_mismatch', '$.recommendedShapeIds'],
  ];
  for (const [ok, code, path] of parity) {
    if (!ok) add(issues, code, path, 'capability evidence does not match migration authority');
  }
  if (evidence.intendedCapabilityState === 'VERSIONED_READY') {
    if (!versionedAuthority || versionedAuthority.readModelKind !== 'CANONICAL') {
      add(issues, 'missing_versioned_authority', '$.designVersionRef', 'VERSIONED_READY requires a canonical PublishedLook authority');
    } else {
      const immutable = versionedAuthority.evidence.immutableDesignVersion;
      const preview = versionedAuthority.evidence.previewEvidence;
      const authorityParity: Array<[boolean, string, string]> = [
        [versionedAuthority.lookId === evidence.contentId, 'authority_content_id_mismatch', '$.contentId'],
        [immutable.present, 'authority_design_version_missing', '$.designVersionRef'],
        [preview.present, 'authority_preview_missing', '$.coverRef.sha256'],
        [versionedAuthority.designVersionId === evidence.designVersionRef?.designVersionId, 'design_version_id_mismatch', '$.designVersionRef.designVersionId'],
        [immutable.present && immutable.editorDocRef.sha256 === evidence.designVersionRef?.editorDocSha256, 'editor_doc_sha_mismatch', '$.designVersionRef.editorDocSha256'],
        [preview.present && preview.previewSha256 === evidence.designVersionRef?.previewSha256, 'preview_sha_mismatch', '$.designVersionRef.previewSha256'],
        [versionedAuthority.cover.url === evidence.coverRef.url, 'cover_url_mismatch', '$.coverRef.url'],
      ];
      for (const [ok, code, path] of authorityParity) {
        if (!ok) add(issues, code, path, 'capability evidence does not match PublishedLook authority');
      }
    }
  } else if (versionedAuthority) {
    add(issues, 'unexpected_versioned_authority', '$.contentId', 'non-versioned capability must not receive a versioned authority');
  }
  if (issues.length > 0) return { ok: false, issues };

  const basePermissions = actionPermissions(migration.discovery);
  const publicAllowed = migration.publicStatus !== 'PUBLIC_BLOCKED';
  const permissions: ActionPermissionsV1 = {
    public: basePermissions.public && publicAllowed,
    commercial: basePermissions.commercial && publicAllowed,
    remix: basePermissions.remix && publicAllowed,
    attributionRequired: basePermissions.attributionRequired,
  };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractRef: COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1,
      contentId: evidence.contentId,
      subjectId: evidence.subjectId,
      sourceClass: evidence.sourceClass,
      publicStatus: evidence.publicStatus,
      rightsStatus: evidence.rightsStatus,
      makeabilityClassification: evidence.makeabilityClassification,
      recommendedShapeIds: [...evidence.recommendedShapeIds],
      technicalStatus: evidence.technicalStatus,
      capabilityState: evidence.intendedCapabilityState,
      cta: !permissions.public
        ? 'UNAVAILABLE'
        : !permissions.remix
          ? 'VIEW_ONLY'
          : ctaFor(evidence.intendedCapabilityState),
      permissions,
      currentMakeable: isCurrentMakeable(migration.discovery),
      designVersionRef: structuredClone(evidence.designVersionRef),
      legacyAssetRef: structuredClone(evidence.legacyAssetRef),
      coverRef: structuredClone(evidence.coverRef),
      diagnostics: [...evidence.diagnostics],
      manufacturingValidated: false,
    },
  };
}

export interface CommunityLookAssetCapabilityIndexV1 {
  schemaVersion: 1;
  contractRef: typeof COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1;
  entries: CommunityLookAssetCapabilityReadModelV1[];
}

/** Exact-coverage, deterministic index. Missing/extra/duplicate records fail closed. */
export function buildCommunityLookAssetCapabilityIndexV1(
  rawEvidence: readonly unknown[],
  manifest: CommunityDiscoveryMigrationManifestV1,
  versionedAuthorities: readonly PublishedLookReadModelV1[],
): CommunityAssetCapabilityResultV1<CommunityLookAssetCapabilityIndexV1> {
  const issues: CommunityAssetCapabilityIssueV1[] = [];
  const parsed = new Map<string, CommunityLookAssetCapabilityEvidenceV1>();
  rawEvidence.forEach((raw, index) => {
    const result = parseCommunityLookAssetCapabilityEvidenceV1(raw);
    if (!result.ok) {
      for (const issue of result.issues) add(issues, issue.code, `$[${index}]${issue.path.slice(1)}`, issue.message);
      return;
    }
    if (parsed.has(result.value.contentId)) {
      add(issues, 'duplicate_content_id', `$[${index}].contentId`, 'duplicate capability evidence');
      return;
    }
    parsed.set(result.value.contentId, result.value);
  });
  const migrationIds = new Set(manifest.entries.map((entry) => entry.contentId));
  const authorities = new Map<string, PublishedLookReadModelV1>();
  for (const authority of versionedAuthorities) {
    if (authorities.has(authority.lookId)) {
      add(issues, 'duplicate_versioned_authority', '$', `duplicate PublishedLook authority ${authority.lookId}`);
    } else {
      authorities.set(authority.lookId, authority);
    }
  }
  for (const entry of manifest.entries) {
    if (!parsed.has(entry.contentId)) add(issues, 'missing_evidence', '$', `missing capability evidence for ${entry.contentId}`);
  }
  for (const id of parsed.keys()) {
    if (!migrationIds.has(id)) add(issues, 'unknown_evidence', '$', `capability evidence has unknown contentId ${id}`);
  }
  for (const [id, item] of parsed) {
    const hasAuthority = authorities.has(id);
    if (item.intendedCapabilityState === 'VERSIONED_READY' && !hasAuthority) {
      add(issues, 'missing_versioned_authority', '$', `missing PublishedLook authority for ${id}`);
    }
    if (item.intendedCapabilityState !== 'VERSIONED_READY' && hasAuthority) {
      add(issues, 'unexpected_versioned_authority', '$', `unexpected PublishedLook authority for ${id}`);
    }
  }
  for (const id of authorities.keys()) {
    if (!parsed.has(id)) add(issues, 'orphan_versioned_authority', '$', `PublishedLook authority has no capability evidence for ${id}`);
  }
  if (issues.length > 0) return { ok: false, issues };
  const entries: CommunityLookAssetCapabilityReadModelV1[] = [];
  for (const migration of manifest.entries) {
    const projected = projectCommunityLookAssetCapabilityV1(
      parsed.get(migration.contentId)!,
      migration,
      authorities.get(migration.contentId),
    );
    if (!projected.ok) {
      for (const issue of projected.issues) add(issues, issue.code, `${migration.contentId}${issue.path.slice(1)}`, issue.message);
    } else {
      entries.push(projected.value);
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  entries.sort((a, b) => a.contentId.localeCompare(b.contentId));
  return {
    ok: true,
    value: { schemaVersion: 1, contractRef: COMMUNITY_ASSET_CAPABILITY_CONTRACT_V1, entries },
  };
}
