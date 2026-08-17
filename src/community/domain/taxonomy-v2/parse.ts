/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-01 strict runtime parsers (pure).
 *
 * Every `parse*` function:
 *  - never throws (null/primitives/arrays/cycles/deeply malformed input);
 *  - never mutates its input (successful parses return the input object);
 *  - reports bounded issues (at most MAX_ISSUES) with stable code + path.
 *
 * Rejections include: unknown keys, invalid bilingual labels, duplicate tag
 * ids, duplicate aliases, alias collisions with tag ids (cross-dimension and
 * same-dimension), alias self-references (cycles), invalid / cyclic
 * replacements, reused deprecated ids, uncovered deprecated ids, fixed browse
 * order/count drift, channel-vs-tag collisions, unresolved tag references,
 * malformed capability/asset/evidence refs, and curation/discovery
 * cross-contract violations. PublishedLookV1.tags are never consulted.
 */

import {
  ASSET_REF_PATTERN,
  CAMPAIGN_TAG_PATTERN,
  CAPABILITY_REF_PATTERN,
  DEFAULT_RECOMMENDATION_CHANNEL,
  DEPRECATED_STYLE_IDS,
  DIMENSION_TAG_PREFIX,
  EVIDENCE_REF_PATTERN,
  FOLLOWING_CHANNEL_ID,
  ISO_TIMESTAMP_PATTERN,
  MAKEABILITY_CLASSIFICATIONS,
  MAKEABILITY_CLASSIFICATION_TAGS,
  MAX_ISSUES,
  MIGRATION_STATES,
  PRIMARY_BROWSE_DIMENSION,
  PRIMARY_BROWSE_IDS,
  RECOMMENDATION_CHANNEL_IDS,
  RIGHTS_STATUSES,
  RIGHTS_STATUS_TAGS,
  SUBJECT_REF_PATTERN,
  TAG_LIFECYCLES,
  TAXONOMY_V2_CONTRACT,
  TAXONOMY_V2_DEFAULT_LOCALE,
  TAXONOMY_V2_DIMENSIONS,
  TAXONOMY_V2_SCHEMA_VERSION,
  TAXONOMY_V2_TAG_ID_PATTERN,
  type MakeabilityClassification,
  type MigrationState,
  type RightsStatus,
  type TagLifecycleV2,
  type TaxonomyDimensionV2,
} from './contract.ts';
import { dimensionOfTagId, resolveTagId, type TagIndexV2 } from './resolve.ts';
import type {
  BilingualLabelsV2,
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
  DiscoveryMakeabilityV1,
  DiscoveryMigrationV1,
  DiscoveryRightsV1,
  RecommendationChannelV2,
  SubjectRefV1,
  TaxonomyTagV2,
} from './types.ts';

export interface TaxonomyV2Issue {
  code: string;
  path: string;
  message: string;
}

export type ParseResultV2<T> =
  | { ok: true; value: T }
  | { ok: false; issues: TaxonomyV2Issue[] };

type UnknownRecord = Record<string, unknown>;

const LABEL_KEYS = ['zh-CN', 'en'] as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function unknownKeysOf(obj: UnknownRecord, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((key) => !allowed.includes(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => nonEmptyString(item))
  );
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function isValidCapabilityRef(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY_REF_PATTERN.test(value);
}

export function isValidAssetRef(value: unknown): value is string {
  return typeof value === 'string' && ASSET_REF_PATTERN.test(value);
}

export function isValidEvidenceRef(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_REF_PATTERN.test(value);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_TIMESTAMP_PATTERN.test(value);
}

function push(
  issues: TaxonomyV2Issue[],
  code: string,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

// ---------------------------------------------------------------------------
// Shared: labels + tag shape
// ---------------------------------------------------------------------------

function parseLabels(
  value: unknown,
  path: string,
  issues: TaxonomyV2Issue[],
): BilingualLabelsV2 | null {
  if (!isPlainObject(value)) {
    push(issues, 'invalid_labels', path, 'labels must be an object');
    return null;
  }
  const extra = unknownKeysOf(value, LABEL_KEYS);
  for (const key of extra) {
    push(issues, 'unknown_key', `${path}.${key}`, `unknown label key`);
  }
  if (extra.length > 0) return null;
  for (const key of LABEL_KEYS) {
    if (!nonEmptyString(value[key])) {
      push(
        issues,
        'invalid_labels',
        `${path}.${key}`,
        `label "${key}" must be a non-empty string`,
      );
      return null;
    }
  }
  return value as unknown as BilingualLabelsV2;
}

/** Validates one tag; collects issues; returns the normalized tag or null. */
function parseTag(
  value: unknown,
  dimension: TaxonomyDimensionV2,
  path: string,
  issues: TaxonomyV2Issue[],
): TaxonomyTagV2 | null {
  if (!isPlainObject(value)) {
    push(issues, 'invalid_tag', path, 'tag must be an object');
    return null;
  }
  const allowed = ['id', 'labels', 'lifecycle', 'aliases', 'replacementId'];
  for (const key of unknownKeysOf(value, allowed)) {
    push(issues, 'unknown_key', `${path}.${key}`, 'unknown tag key');
  }
  const { id, labels, lifecycle, aliases, replacementId } = value;
  if (!nonEmptyString(id)) {
    push(issues, 'invalid_tag_id', `${path}.id`, 'tag id must be a non-empty string');
    return null;
  }
  if (!TAXONOMY_V2_TAG_ID_PATTERN.test(id)) {
    push(issues, 'invalid_tag_id', `${path}.id`, `tag id "${id}" must match ${TAXONOMY_V2_TAG_ID_PATTERN}`);
  }
  const prefix = DIMENSION_TAG_PREFIX[dimension];
  if (!id.startsWith(`${prefix}:`)) {
    push(
      issues,
      'tag_id_namespace_mismatch',
      `${path}.id`,
      `tag id "${id}" must use the ${prefix}: namespace for ${dimension}`,
    );
  }
  const parsedLabels = parseLabels(labels, `${path}.labels`, issues);
  if (!parsedLabels) return null;
  if (!TAG_LIFECYCLES.includes(lifecycle as TagLifecycleV2)) {
    push(
      issues,
      'invalid_lifecycle',
      `${path}.lifecycle`,
      `lifecycle must be one of ${TAG_LIFECYCLES.join(', ')}`,
    );
    return null;
  }
  if (!Array.isArray(aliases) || !aliases.every((a) => nonEmptyString(a))) {
    push(issues, 'invalid_alias', `${path}.aliases`, 'aliases must be an array of non-empty strings');
    return null;
  }
  if (hasDuplicates(aliases as string[])) {
    push(issues, 'duplicate_alias', `${path}.aliases`, 'aliases must be unique within a tag');
  }
  const hasReplacement = replacementId !== undefined;
  if (hasReplacement && !nonEmptyString(replacementId)) {
    push(issues, 'invalid_replacement_id', `${path}.replacementId`, 'replacementId must be a non-empty string');
    return null;
  }
  if (lifecycle === 'ACTIVE' && hasReplacement) {
    push(issues, 'replacement_on_active', `${path}.replacementId`, 'ACTIVE tags must not carry replacementId');
  }
  if (lifecycle !== 'ACTIVE' && !hasReplacement) {
    push(
      issues,
      'replacement_missing',
      `${path}.replacementId`,
      `${lifecycle} tags must declare replacementId`,
    );
  }
  return {
    id,
    labels: parsedLabels,
    lifecycle: lifecycle as TagLifecycleV2,
    aliases: aliases as string[],
    replacementId: hasReplacement ? (replacementId as string) : undefined,
  };
}

// ---------------------------------------------------------------------------
// CommunityTaxonomyV2
// ---------------------------------------------------------------------------

export function parseCommunityTaxonomyV2(value: unknown): ParseResultV2<CommunityTaxonomyV2> {
  const issues: TaxonomyV2Issue[] = [];
  if (!isPlainObject(value)) {
    push(issues, 'not_an_object', '$', 'taxonomy must be an object');
    return { ok: false, issues };
  }
  const rootAllowed = [
    'schemaVersion',
    'contractVersion',
    'defaultLocale',
    'description',
    'browse',
    'dimensions',
    'deprecatedIds',
  ];
  for (const key of unknownKeysOf(value, rootAllowed)) {
    push(issues, 'unknown_key', `$.${key}`, 'unknown taxonomy key');
  }
  if (value.schemaVersion !== TAXONOMY_V2_SCHEMA_VERSION) {
    push(issues, 'schema_version', '$.schemaVersion', `schemaVersion must be ${TAXONOMY_V2_SCHEMA_VERSION}`);
  }
  if (value.contractVersion !== TAXONOMY_V2_CONTRACT) {
    push(issues, 'contract_version', '$.contractVersion', `contractVersion must be ${TAXONOMY_V2_CONTRACT}`);
  }
  if (value.defaultLocale !== TAXONOMY_V2_DEFAULT_LOCALE) {
    push(issues, 'default_locale', '$.defaultLocale', `defaultLocale must be ${TAXONOMY_V2_DEFAULT_LOCALE}`);
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    push(issues, 'invalid_description', '$.description', 'description must be a string');
  }

  // --- dimensions ----------------------------------------------------------
  if (!isPlainObject(value.dimensions)) {
    push(issues, 'invalid_dimensions', '$.dimensions', 'dimensions must be an object');
    return { ok: false, issues };
  }
  const dimensions = value.dimensions;
  const dimensionKeys = Object.keys(dimensions);
  for (const key of dimensionKeys) {
    if (!TAXONOMY_V2_DIMENSIONS.includes(key as TaxonomyDimensionV2)) {
      push(issues, 'unknown_dimension', `$.dimensions.${key}`, `unknown dimension "${key}"`);
    }
  }
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    if (!dimensionKeys.includes(dimension)) {
      push(issues, 'missing_dimension', `$.dimensions.${dimension}`, `missing dimension "${dimension}"`);
    }
  }

  const tagsByDimension = new Map<TaxonomyDimensionV2, TaxonomyTagV2[]>();
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    const raw = dimensions[dimension];
    const path = `$.dimensions.${dimension}`;
    if (!isPlainObject(raw)) {
      push(issues, 'invalid_dimension', path, 'dimension must be an object');
      continue;
    }
    for (const key of unknownKeysOf(raw, ['tags'])) {
      push(issues, 'unknown_key', `${path}.${key}`, 'unknown dimension key');
    }
    if (!Array.isArray(raw.tags) || raw.tags.length === 0) {
      push(issues, 'empty_dimension', `${path}.tags`, 'dimension must have a non-empty tags array');
      continue;
    }
    const parsed: TaxonomyTagV2[] = [];
    raw.tags.forEach((tag, index) => {
      const parsedTag = parseTag(tag, dimension, `${path}.tags[${index}]`, issues);
      if (parsedTag) parsed.push(parsedTag);
    });
    tagsByDimension.set(dimension, parsed);
  }

  // --- global tag consistency ----------------------------------------------
  const allTags: TaxonomyTagV2[] = [];
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    allTags.push(...(tagsByDimension.get(dimension) ?? []));
  }
  const ids = allTags.map((tag) => tag.id);
  if (hasDuplicates(ids)) {
    push(issues, 'duplicate_tag_id', '$.dimensions', 'tag ids must be unique across all dimensions');
  }
  const aliasOwner = new Map<string, TaxonomyTagV2>();
  const seenAliases = new Set<string>();
  for (const tag of allTags) {
    for (const alias of tag.aliases) {
      if (seenAliases.has(alias)) {
        push(
          issues,
          'duplicate_alias',
          `$.dimensions.${dimensionOfTagId(tag.id)}.tags[${tag.id}]`,
          `alias "${alias}" is duplicated across the taxonomy`,
        );
      }
      seenAliases.add(alias);
      aliasOwner.set(alias, tag);
    }
  }
  const index: TagIndexV2 = { byId: new Map(), byAlias: aliasOwner };
  for (const tag of allTags) index.byId.set(tag.id, tag);
  for (const tag of allTags) {
    const tagDimension = dimensionOfTagId(tag.id);
    for (const alias of tag.aliases) {
      if (alias === tag.id) {
        push(issues, 'alias_self_reference', `$.dimensions.${tagDimension}.tags[${tag.id}]`, `alias "${alias}" equals its own tag id`);
        continue;
      }
      const target = index.byId.get(alias);
      if (target) {
        const targetDimension = dimensionOfTagId(target.id);
        if (targetDimension !== tagDimension) {
          push(
            issues,
            'cross_dimension_alias_target',
            `$.dimensions.${tagDimension}.tags[${tag.id}].aliases`,
            `alias "${alias}" targets tag "${target.id}" in dimension ${targetDimension}`,
          );
        } else {
          push(
            issues,
            'alias_collides_with_tag_id',
            `$.dimensions.${tagDimension}.tags[${tag.id}].aliases`,
            `alias "${alias}" collides with live tag id "${target.id}"`,
          );
        }
      }
    }
  }
  // replacement validity + cycles (replacement graph must be acyclic)
  for (const tag of allTags) {
    if (tag.lifecycle === 'ACTIVE' || !tag.replacementId) continue;
    const target = index.byId.get(tag.replacementId);
    const tagDimension = dimensionOfTagId(tag.id);
    const tagPath = `$.dimensions.${tagDimension}.tags[${tag.id}]`;
    if (!target) {
      push(issues, 'replacement_missing_target', `${tagPath}.replacementId`, `replacementId "${tag.replacementId}" does not exist`);
      continue;
    }
    if (target.id === tag.id) {
      push(issues, 'replacement_self', `${tagPath}.replacementId`, 'replacementId must not point to itself');
      continue;
    }
    if (dimensionOfTagId(target.id) !== tagDimension) {
      push(issues, 'replacement_cross_dimension', `${tagPath}.replacementId`, 'replacement target must be in the same dimension');
      continue;
    }
    if (target.lifecycle !== 'ACTIVE') {
      push(issues, 'replacement_target_not_active', `${tagPath}.replacementId`, 'replacement target must be ACTIVE');
    }
  }
  for (const tag of allTags) {
    if (tag.lifecycle === 'ACTIVE' || !tag.replacementId) continue;
    const visited = new Set<string>([tag.id]);
    let current: TaxonomyTagV2 | undefined = index.byId.get(tag.replacementId);
    while (current && current.lifecycle !== 'ACTIVE') {
      if (visited.has(current.id)) {
        push(
          issues,
          'replacement_cycle',
          `$.dimensions.${dimensionOfTagId(tag.id)}.tags[${tag.id}]`,
          `replacement chain cycles through "${current.id}"`,
        );
        break;
      }
      visited.add(current.id);
      current = current.replacementId ? index.byId.get(current.replacementId) : undefined;
    }
  }

  // --- deprecated ids -------------------------------------------------------
  const deprecatedIds = value.deprecatedIds;
  if (!stringArray(deprecatedIds)) {
    push(issues, 'invalid_deprecated_ids', '$.deprecatedIds', 'deprecatedIds must be an array of non-empty strings');
  } else if (hasDuplicates(deprecatedIds)) {
    push(issues, 'duplicate_deprecated_id', '$.deprecatedIds', 'deprecatedIds must be unique');
  } else {
    for (const deprecatedId of deprecatedIds) {
      if (index.byId.has(deprecatedId)) {
        push(
          issues,
          'reused_deprecated_id',
          '$.deprecatedIds',
          `deprecated id "${deprecatedId}" must never be reintroduced as a live tag id`,
        );
      }
    }
    for (const deprecatedId of deprecatedIds) {
      const owners = allTags.filter((tag) => tag.aliases.includes(deprecatedId));
      if (owners.length === 0) {
        push(
          issues,
          'uncovered_deprecated_id',
          '$.deprecatedIds',
          `deprecated id "${deprecatedId}" has no alias mapping; legacy links would be unresolvable`,
        );
      } else if (owners.length > 1) {
        push(
          issues,
          'ambiguous_deprecated_id',
          '$.deprecatedIds',
          `deprecated id "${deprecatedId}" is aliased by ${owners.length} tags; resolution would be ambiguous`,
        );
      }
    }
  }

  // --- browse ---------------------------------------------------------------
  const browse = value.browse;
  if (!isPlainObject(browse)) {
    push(issues, 'invalid_browse', '$.browse', 'browse must be an object');
    return { ok: false, issues };
  }
  for (const key of unknownKeysOf(browse, ['primary', 'recommendationChannels'])) {
    push(issues, 'unknown_key', `$.browse.${key}`, 'unknown browse key');
  }
  const primary = Array.isArray(browse.primary)
    ? (browse.primary as UnknownRecord[])
    : null;
  const channels = browse.recommendationChannels;
  if (!primary || primary.length !== PRIMARY_BROWSE_IDS.length) {
    push(
      issues,
      'primary_browse_count',
      '$.browse.primary',
      `primary browse must have exactly ${PRIMARY_BROWSE_IDS.length} entries`,
    );
  } else {
    primary.forEach((entry, index) => {
      const path = `$.browse.primary[${index}]`;
      if (!isPlainObject(entry)) {
        push(issues, 'invalid_primary_entry', path, 'primary entry must be an object');
        return;
      }
      for (const key of unknownKeysOf(entry, ['id', 'kind', 'labels', 'dimension', 'defaultSubchannelId'])) {
        push(issues, 'unknown_key', `${path}.${key}`, 'unknown primary entry key');
      }
      const expectedId = PRIMARY_BROWSE_IDS[index];
      if (entry.id !== expectedId) {
        push(
          issues,
          'primary_browse_order',
          `${path}.id`,
          `primary entry ${index} must be "${expectedId}"`,
        );
      }
      const expectedKind = expectedId === 'recommended' ? 'channel' : 'dimension';
      if (entry.kind !== expectedKind) {
        push(
          issues,
          'primary_kind_mismatch',
          `${path}.kind`,
          `primary entry "${expectedId}" must have kind "${expectedKind}"`,
        );
      }
      parseLabels(entry.labels, `${path}.labels`, issues);
      if (expectedKind === 'dimension') {
        if (entry.dimension !== PRIMARY_BROWSE_DIMENSION[expectedId as keyof typeof PRIMARY_BROWSE_DIMENSION]) {
          push(
            issues,
            'primary_dimension_mismatch',
            `${path}.dimension`,
            `primary entry "${expectedId}" must declare dimension ${PRIMARY_BROWSE_DIMENSION[expectedId as keyof typeof PRIMARY_BROWSE_DIMENSION]}`,
          );
        }
      }
      if (expectedId === 'recommended' && !nonEmptyString(entry.defaultSubchannelId)) {
        push(issues, 'missing_default_subchannel', `${path}.defaultSubchannelId`, 'recommended entry must declare defaultSubchannelId');
      }
    });
  }
  if (!Array.isArray(channels) || channels.length !== RECOMMENDATION_CHANNEL_IDS.length) {
    push(
      issues,
      'recommendation_channel_count',
      '$.browse.recommendationChannels',
      `recommendationChannels must have exactly ${RECOMMENDATION_CHANNEL_IDS.length} entries`,
    );
  } else {
    const parsedChannels: RecommendationChannelV2[] = [];
    channels.forEach((entry, channelIndex) => {
      const path = `$.browse.recommendationChannels[${channelIndex}]`;
      if (!isPlainObject(entry)) {
        push(issues, 'invalid_channel', path, 'channel must be an object');
        return;
      }
      for (const key of unknownKeysOf(entry, ['id', 'labels', 'isDefault', 'requiresRelationshipProvider'])) {
        push(issues, 'unknown_key', `${path}.${key}`, 'unknown channel key');
      }
      const expectedId = RECOMMENDATION_CHANNEL_IDS[channelIndex];
      if (entry.id !== expectedId) {
        push(
          issues,
          'recommendation_channel_order',
          `${path}.id`,
          `channel ${channelIndex} must be "${expectedId}"`,
        );
      }
      parseLabels(entry.labels, `${path}.labels`, issues);
      if (entry.isDefault !== undefined && typeof entry.isDefault !== 'boolean') {
        push(issues, 'invalid_channel_flag', `${path}.isDefault`, 'isDefault must be a boolean');
      }
      if (
        entry.requiresRelationshipProvider !== undefined &&
        typeof entry.requiresRelationshipProvider !== 'boolean'
      ) {
        push(issues, 'invalid_channel_flag', `${path}.requiresRelationshipProvider`, 'requiresRelationshipProvider must be a boolean');
      }
      parsedChannels.push({
        id: entry.id as string,
        labels: entry.labels as unknown as BilingualLabelsV2,
        isDefault: entry.isDefault as boolean | undefined,
        requiresRelationshipProvider: entry.requiresRelationshipProvider as boolean | undefined,
      });
    });
    const defaultChannels = parsedChannels.filter((channel) => channel.isDefault === true);
    if (defaultChannels.length !== 1 || defaultChannels[0].id !== DEFAULT_RECOMMENDATION_CHANNEL) {
      push(
        issues,
        'default_channel_mismatch',
        '$.browse.recommendationChannels',
        `exactly one channel must be default and it must be "${DEFAULT_RECOMMENDATION_CHANNEL}"`,
      );
    }
    const following = parsedChannels.find((channel) => channel.id === FOLLOWING_CHANNEL_ID);
    if (following && following.requiresRelationshipProvider !== true) {
      push(
        issues,
        'following_relationship_provider',
        '$.browse.recommendationChannels',
        `"${FOLLOWING_CHANNEL_ID}" must declare requiresRelationshipProvider: true`,
      );
    }
    for (const channel of parsedChannels) {
      if (index.byId.has(channel.id)) {
        push(
          issues,
          'channel_id_collides_with_tag',
          '$.browse.recommendationChannels',
          `channel id "${channel.id}" collides with a tag id; channels are definitions, not tags`,
        );
      }
    }
    const firstEntry = primary ? (primary[0] as UnknownRecord | undefined) : undefined;
    const defaultSubchannelId = firstEntry?.defaultSubchannelId;
    if (
      typeof defaultSubchannelId === 'string' &&
      !parsedChannels.some((channel) => channel.id === defaultSubchannelId)
    ) {
      push(
        issues,
        'unknown_default_subchannel',
        '$.browse.primary[0].defaultSubchannelId',
        `defaultSubchannelId "${defaultSubchannelId}" is not a recommendation channel`,
      );
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as CommunityTaxonomyV2 };
}

// ---------------------------------------------------------------------------
// Shared: subjectRef + ref arrays
// ---------------------------------------------------------------------------

function parseSubjectRef(
  value: unknown,
  path: string,
  issues: TaxonomyV2Issue[],
): SubjectRefV1 | null {
  if (!isPlainObject(value)) {
    push(issues, 'invalid_subject_ref', path, 'subjectRef must be an object');
    return null;
  }
  for (const key of unknownKeysOf(value, ['kind', 'id'])) {
    push(issues, 'unknown_key', `${path}.${key}`, 'unknown subjectRef key');
  }
  if (value.kind !== 'PUBLISHED_LOOK') {
    push(issues, 'invalid_subject_ref', `${path}.kind`, 'subjectRef.kind must be PUBLISHED_LOOK');
    return null;
  }
  if (!nonEmptyString(value.id) || !SUBJECT_REF_PATTERN.test(value.id as string)) {
    push(issues, 'invalid_subject_ref', `${path}.id`, 'subjectRef.id is invalid');
    return null;
  }
  return { kind: 'PUBLISHED_LOOK', id: value.id as string };
}

function parseEvidenceRefs(
  value: unknown,
  path: string,
  issues: TaxonomyV2Issue[],
): string[] | null {
  if (!stringArray(value)) {
    push(issues, 'invalid_evidence_refs', path, 'evidenceRefs must be an array of strings');
    return null;
  }
  if (hasDuplicates(value)) {
    push(issues, 'duplicate_ref', path, 'evidenceRefs must be unique');
  }
  const invalid = value.filter((ref) => !isValidEvidenceRef(ref));
  for (const ref of invalid) {
    push(issues, 'invalid_evidence_ref', path, `evidence ref "${ref}" does not match ${EVIDENCE_REF_PATTERN}`);
  }
  return value;
}

function validateDimensionRefs(
  raw: unknown,
  path: string,
  dimension: TaxonomyDimensionV2,
  taxonomy: CommunityTaxonomyV2,
  issues: TaxonomyV2Issue[],
): string[] | null {
  if (!stringArray(raw)) {
    push(issues, 'invalid_tag_refs', path, 'must be an array of tag ids');
    return null;
  }
  if (hasDuplicates(raw)) {
    push(issues, 'duplicate_tag_reference', path, 'tag references must be unique');
  }
  for (const id of raw) {
    const resolved = resolveTagId(taxonomy, id);
    if (!resolved) {
      push(issues, 'unresolved_tag_reference', path, `tag reference "${id}" does not resolve`);
      continue;
    }
    if (resolved.dimension !== dimension) {
      push(
        issues,
        'tag_dimension_mismatch',
        path,
        `tag reference "${id}" resolves to ${resolved.dimension}, expected ${dimension}`,
      );
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// CommunityDiscoveryMetadataV1
// ---------------------------------------------------------------------------

export function parseDiscoveryMetadataV1(
  value: unknown,
  taxonomy: CommunityTaxonomyV2,
): ParseResultV2<CommunityDiscoveryMetadataV1> {
  const issues: TaxonomyV2Issue[] = [];
  if (!isPlainObject(value)) {
    push(issues, 'not_an_object', '$', 'discovery metadata must be an object');
    return { ok: false, issues };
  }
  const allowed = [
    'schemaVersion',
    'contractRef',
    'subjectRef',
    'styleIds',
    'recommendedShapeIds',
    'sceneIds',
    'themeIds',
    'techniqueIds',
    'lengthIds',
    'makeability',
    'rights',
    'migration',
    'updatedAt',
  ];
  for (const key of unknownKeysOf(value, allowed)) {
    push(issues, 'unknown_key', `$.${key}`, 'unknown discovery metadata key');
  }
  if (value.schemaVersion !== 1) {
    push(issues, 'schema_version', '$.schemaVersion', 'schemaVersion must be 1');
  }
  if (value.contractRef !== TAXONOMY_V2_CONTRACT) {
    push(issues, 'contract_version', '$.contractRef', `contractRef must be ${TAXONOMY_V2_CONTRACT}`);
  }
  parseSubjectRef(value.subjectRef, '$.subjectRef', issues);
  validateDimensionRefs(value.styleIds, '$.styleIds', 'STYLE', taxonomy, issues);
  validateDimensionRefs(value.recommendedShapeIds, '$.recommendedShapeIds', 'SHAPE', taxonomy, issues);
  validateDimensionRefs(value.sceneIds, '$.sceneIds', 'SCENE', taxonomy, issues);
  validateDimensionRefs(value.themeIds, '$.themeIds', 'THEME', taxonomy, issues);
  validateDimensionRefs(value.techniqueIds, '$.techniqueIds', 'TECHNIQUE', taxonomy, issues);
  validateDimensionRefs(value.lengthIds, '$.lengthIds', 'LENGTH', taxonomy, issues);
  if (!isValidTimestamp(value.updatedAt)) {
    push(issues, 'invalid_timestamp', '$.updatedAt', 'updatedAt must be an ISO-8601 UTC timestamp');
  }

  // makeability
  if (!isPlainObject(value.makeability)) {
    push(issues, 'invalid_makeability', '$.makeability', 'makeability must be an object');
  } else {
    const makeability = value.makeability;
    for (const key of unknownKeysOf(makeability, ['classification', 'capabilityRef', 'assetRefs', 'evidenceRefs'])) {
      push(issues, 'unknown_key', `$.makeability.${key}`, 'unknown makeability key');
    }
    const classification = makeability.classification;
    if (!MAKEABILITY_CLASSIFICATIONS.includes(classification as MakeabilityClassification)) {
      push(issues, 'invalid_makeability_classification', '$.makeability.classification', `classification must be one of ${MAKEABILITY_CLASSIFICATIONS.join(', ')}`);
    } else {
      const tagId = MAKEABILITY_CLASSIFICATION_TAGS[classification as MakeabilityClassification];
      const resolved = resolveTagId(taxonomy, tagId);
      if (!resolved || resolved.lifecycle !== 'ACTIVE') {
        push(issues, 'makeability_tag_mismatch', '$.makeability.classification', `classification "${classification}" must map to an ACTIVE ${tagId} tag`);
      }
    }
    if (makeability.capabilityRef !== undefined && !isValidCapabilityRef(makeability.capabilityRef)) {
      push(issues, 'invalid_capability_ref', '$.makeability.capabilityRef', `capabilityRef must match ${CAPABILITY_REF_PATTERN}`);
    }
    const assetRefs = makeability.assetRefs;
    if (!Array.isArray(assetRefs) || !assetRefs.every((ref) => typeof ref === 'string')) {
      push(issues, 'invalid_asset_refs', '$.makeability.assetRefs', 'assetRefs must be an array of strings');
    } else {
      if (hasDuplicates(assetRefs)) push(issues, 'duplicate_ref', '$.makeability.assetRefs', 'assetRefs must be unique');
      for (const ref of assetRefs) {
        if (!isValidAssetRef(ref)) {
          push(issues, 'invalid_asset_ref', '$.makeability.assetRefs', `asset ref "${ref}" must be immutable (${ASSET_REF_PATTERN})`);
        }
      }
    }
    parseEvidenceRefs(makeability.evidenceRefs, '$.makeability.evidenceRefs', issues);
  }

  // rights
  if (!isPlainObject(value.rights)) {
    push(issues, 'invalid_rights', '$.rights', 'rights must be an object');
  } else {
    const rights = value.rights;
    for (const key of unknownKeysOf(rights, ['status', 'evidenceRefs'])) {
      push(issues, 'unknown_key', `$.rights.${key}`, 'unknown rights key');
    }
    const status = rights.status;
    if (!RIGHTS_STATUSES.includes(status as RightsStatus)) {
      push(issues, 'invalid_rights_status', '$.rights.status', `status must be one of ${RIGHTS_STATUSES.join(', ')}`);
    } else {
      const tagId = RIGHTS_STATUS_TAGS[status as RightsStatus];
      const resolved = resolveTagId(taxonomy, tagId);
      if (!resolved || resolved.lifecycle !== 'ACTIVE') {
        push(issues, 'rights_tag_mismatch', '$.rights.status', `status "${status}" must map to an ACTIVE ${tagId} tag`);
      }
    }
    parseEvidenceRefs(rights.evidenceRefs, '$.rights.evidenceRefs', issues);
  }

  // migration
  if (!isPlainObject(value.migration)) {
    push(issues, 'invalid_migration', '$.migration', 'migration must be an object');
  } else {
    const migration = value.migration;
    for (const key of unknownKeysOf(migration, ['state', 'legacyStyleIds', 'migratedAt', 'note'])) {
      push(issues, 'unknown_key', `$.migration.${key}`, 'unknown migration key');
    }
    if (!MIGRATION_STATES.includes(migration.state as MigrationState)) {
      push(issues, 'invalid_migration_state', '$.migration.state', `state must be one of ${MIGRATION_STATES.join(', ')}`);
    }
    if (!stringArray(migration.legacyStyleIds)) {
      push(issues, 'invalid_legacy_style_ids', '$.migration.legacyStyleIds', 'legacyStyleIds must be an array of strings');
    } else {
      if (hasDuplicates(migration.legacyStyleIds)) {
        push(issues, 'duplicate_tag_reference', '$.migration.legacyStyleIds', 'legacyStyleIds must be unique');
      }
      for (const id of migration.legacyStyleIds) {
        if (!resolveTagId(taxonomy, id)) {
          push(issues, 'unresolved_legacy_style_id', '$.migration.legacyStyleIds', `legacy style id "${id}" does not resolve to any tag`);
        }
      }
    }
    if (!isValidTimestamp(migration.migratedAt)) {
      push(issues, 'invalid_timestamp', '$.migration.migratedAt', 'migratedAt must be an ISO-8601 UTC timestamp');
    }
    if (migration.note !== undefined && typeof migration.note !== 'string') {
      push(issues, 'invalid_migration_note', '$.migration.note', 'note must be a string');
    }
    if (migration.state === 'LEGACY_STYLE_MIGRATED') {
      const styleIds = value.styleIds;
      if (!Array.isArray(styleIds) || styleIds.length === 0) {
        push(
          issues,
          'legacy_migrated_without_style',
          '$.migration.state',
          'LEGACY_STYLE_MIGRATED requires at least one styleId',
        );
      }
    }
    if (migration.state === 'NEEDS_STYLE_REVIEW') {
      const techniqueIds = value.techniqueIds;
      const hasFrench = Array.isArray(techniqueIds) && techniqueIds.some((id) => resolveTagId(taxonomy, id)?.id === 'technique:french');
      if (!hasFrench) {
        push(
          issues,
          'needs_style_review_without_french',
          '$.migration.state',
          'NEEDS_STYLE_REVIEW is a narrowly typed exception and requires technique:french',
        );
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as CommunityDiscoveryMetadataV1 };
}

// ---------------------------------------------------------------------------
// CommunityCurationMetadataV1 (separate from discovery, never merged)
// ---------------------------------------------------------------------------

export function parseCurationMetadataV1(
  value: unknown,
): ParseResultV2<CommunityCurationMetadataV1> {
  const issues: TaxonomyV2Issue[] = [];
  if (!isPlainObject(value)) {
    push(issues, 'not_an_object', '$', 'curation metadata must be an object');
    return { ok: false, issues };
  }
  const allowed = [
    'schemaVersion',
    'contractRef',
    'subjectRef',
    'curated',
    'curatedBy',
    'curatedAt',
    'campaignTags',
    'featuredChannels',
    'evidenceRefs',
  ];
  for (const key of unknownKeysOf(value, allowed)) {
    push(issues, 'unknown_key', `$.${key}`, 'unknown curation metadata key');
  }
  if (value.schemaVersion !== 1) {
    push(issues, 'schema_version', '$.schemaVersion', 'schemaVersion must be 1');
  }
  if (value.contractRef !== TAXONOMY_V2_CONTRACT) {
    push(issues, 'contract_version', '$.contractRef', `contractRef must be ${TAXONOMY_V2_CONTRACT}`);
  }
  parseSubjectRef(value.subjectRef, '$.subjectRef', issues);
  if (typeof value.curated !== 'boolean') {
    push(issues, 'invalid_curated', '$.curated', 'curated must be a boolean');
  }
  if (value.curatedBy !== undefined && !nonEmptyString(value.curatedBy)) {
    push(issues, 'invalid_curated_by', '$.curatedBy', 'curatedBy must be a non-empty string');
  }
  if (value.curatedAt !== undefined && !isValidTimestamp(value.curatedAt)) {
    push(issues, 'invalid_timestamp', '$.curatedAt', 'curatedAt must be an ISO-8601 UTC timestamp');
  }
  if (value.curated === true && (!nonEmptyString(value.curatedBy) || !isValidTimestamp(value.curatedAt))) {
    push(
      issues,
      'curation_missing_actor',
      '$.curated',
      'curated records must declare curatedBy and curatedAt',
    );
  }
  if (!Array.isArray(value.campaignTags) || !value.campaignTags.every((tag) => nonEmptyString(tag))) {
    push(issues, 'invalid_campaign_tags', '$.campaignTags', 'campaignTags must be an array of strings');
  } else {
    const campaignTags = value.campaignTags as string[];
    if (hasDuplicates(campaignTags)) {
      push(issues, 'duplicate_campaign_tag', '$.campaignTags', 'campaignTags must be unique');
    }
    for (const tag of campaignTags) {
      if (!CAMPAIGN_TAG_PATTERN.test(tag)) {
        push(issues, 'invalid_campaign_tag', '$.campaignTags', `campaign tag "${tag}" must match ${CAMPAIGN_TAG_PATTERN}`);
      }
    }
  }
  if (!stringArray(value.featuredChannels)) {
    push(issues, 'invalid_featured_channels', '$.featuredChannels', 'featuredChannels must be an array of strings');
  } else {
    const featuredChannels = value.featuredChannels as string[];
    if (hasDuplicates(featuredChannels)) {
      push(issues, 'duplicate_featured_channel', '$.featuredChannels', 'featuredChannels must be unique');
    }
    for (const channelId of featuredChannels) {
      if (!RECOMMENDATION_CHANNEL_IDS.includes(channelId as (typeof RECOMMENDATION_CHANNEL_IDS)[number])) {
        push(issues, 'unknown_featured_channel', '$.featuredChannels', `"${channelId}" is not a recommendation channel`);
      }
      if (channelId === FOLLOWING_CHANNEL_ID) {
        push(
          issues,
          'featured_relationship_channel',
          '$.featuredChannels',
          `"${FOLLOWING_CHANNEL_ID}" is relationship-driven and cannot be statically featured`,
        );
      }
    }
  }
  parseEvidenceRefs(value.evidenceRefs, '$.evidenceRefs', issues);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as CommunityCurationMetadataV1 };
}

// Re-exported for the governance layer + tooling.
export { DEPRECATED_STYLE_IDS };

// Type-only re-exports used by tooling/tests.
export type {
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
  DiscoveryMakeabilityV1,
  DiscoveryMigrationV1,
  DiscoveryRightsV1,
};
