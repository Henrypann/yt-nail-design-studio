/**
 * Asset Ops v1 governance contract.
 *
 * This module is intentionally browser-safe: it parses values supplied by a
 * caller and never reads storage, the filesystem, or infers missing evidence.
 */

export const GOVERNANCE_SCHEMA = 'asset-ops-governance-v1' as const;
export const LIFECYCLE_STATUSES = ['REAL', 'CONCEPT', 'SIMULATED'] as const;
export const RIGHTS_STATUSES = ['PENDING', 'DECLARED', 'CLEARED', 'REJECTED'] as const;
export const CAPABILITY_STATUSES = ['UNVERIFIED', 'CONCEPT_ONLY'] as const;
export const PROMOTION_STATUSES = ['BLOCKED'] as const;

export const EXPECTED_TEMPLATE_IDS = Object.freeze([
  't_petal_pearl_bloom_simulated', 't_mercury_dew_concept', 't_pearl_tide_shell_concept', 't_micro_coquette_concept',
  't_starfish_bloom_elegance_concept', 't_sea_glass_chrome_concept', 't_sunset_aura_glaze_concept',
  't_liquid_chrome_statement_concept', 't_butter_glaze_quiet_concept', 't_liquid_velvet_cat_eye',
  't_petal_veil_french', 't_french_white', 't_nude_gradient', 't_cat_eye_nude', 't_y2k_ice',
  't_dark_gradient', 't_chrome_mirror', 't_checkerboard', 't_3d_waterdrop', 't_classic_high_gloss', 't_holiday_glitter',
] as const);
export const EXPECTED_LOOK_IDS = Object.freeze(['leopard-gilded-nude', 'crimson-reliquary', 'ivory-lace-crystal', 'honey-petal-glass'] as const);

const ROOT_KEYS = ['architectureBaseline', 'generatedFrom', 'records', 'schemaVersion', 'summary'];
const RECORD_KEYS = [
  'blockingCodes', 'capabilityEvidenceRefs', 'capabilityStatus', 'completeness',
  'evidenceTier', 'lifecycleStatus', 'limitations', 'manifestRefs', 'promotionStatus',
  'recordId', 'rightsEvidenceRefs', 'rightsStatus', 'sourceRefs', 'specRefs', 'subjectId', 'subjectType',
];
const COMPLETENESS_KEYS = ['binaries', 'manifest', 'source', 'spec', 'structure'];
const COMPLETENESS_VALUES = new Set(['PRESENT', 'MISSING', 'DECLARED', 'UNKNOWN']);
const SUMMARY_KEYS = ['lookCount', 'promotionBlockedCount', 'rightsPendingCount', 'templateCount'];

export type GovernanceLedgerV1 = {
  schemaVersion: typeof GOVERNANCE_SCHEMA;
  architectureBaseline: 'v0.7.2';
  generatedFrom: string[];
  summary: { lookCount: number; promotionBlockedCount: number; rightsPendingCount: number; templateCount: number };
  records: GovernanceRecordV1[];
};

export type GovernanceRecordV1 = {
  recordId: string;
  subjectId: string;
  subjectType: 'MATERIAL_TEMPLATE' | 'LOOK_ASSET_PACK';
  lifecycleStatus: typeof LIFECYCLE_STATUSES[number];
  sourceRefs: string[];
  specRefs: string[];
  manifestRefs: string[];
  completeness: { binaries: string; manifest: string; source: string; spec: string; structure: string };
  evidenceTier: string;
  rightsStatus: typeof RIGHTS_STATUSES[number];
  rightsEvidenceRefs: string[];
  capabilityStatus: typeof CAPABILITY_STATUSES[number];
  capabilityEvidenceRefs: string[];
  promotionStatus: 'BLOCKED';
  blockingCodes: string[];
  limitations: string[];
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
function string(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(string) && new Set(value).size === value.length;
}
function safeStatus<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Strict parser for the complete 21-template + 4-look governance ledger. */
export function parseGovernanceLedgerV1(value: unknown): GovernanceLedgerV1 | null {
  const raw = object(value);
  if (!raw || !exactKeys(raw, ROOT_KEYS) || raw.schemaVersion !== GOVERNANCE_SCHEMA || raw.architectureBaseline !== 'v0.7.2'
    || !Array.isArray(raw.generatedFrom) || !raw.generatedFrom.every(string) || !Array.isArray(raw.records)) return null;
  const summary = object(raw.summary);
  if (!summary || !exactKeys(summary, SUMMARY_KEYS) || !SUMMARY_KEYS.every((key) => Number.isInteger(summary[key]) && (summary[key] as number) >= 0)) return null;
  if (raw.records.length !== EXPECTED_TEMPLATE_IDS.length + EXPECTED_LOOK_IDS.length) return null;
  const seen = new Set<string>();
  const templateIds = new Set<string>();
  const lookIds = new Set<string>();
  let templateCount = 0;
  let lookCount = 0;
  for (const candidate of raw.records) {
    const record = object(candidate);
    if (!record || !exactKeys(record, RECORD_KEYS) || !string(record.recordId) || seen.has(record.recordId)) return null;
    seen.add(record.recordId);
    if (!string(record.subjectId) || !['MATERIAL_TEMPLATE', 'LOOK_ASSET_PACK'].includes(record.subjectType as string)
      || !safeStatus(record.lifecycleStatus, LIFECYCLE_STATUSES) || !strings(record.sourceRefs) || !strings(record.specRefs) || !strings(record.manifestRefs)
      || !safeStatus(record.rightsStatus, RIGHTS_STATUSES) || !strings(record.rightsEvidenceRefs)
      || !safeStatus(record.capabilityStatus, CAPABILITY_STATUSES) || !strings(record.capabilityEvidenceRefs)
      || !safeStatus(record.promotionStatus, PROMOTION_STATUSES) || !strings(record.blockingCodes) || !strings(record.limitations)
      || !string(record.evidenceTier)) return null;
    const expectedRecordId = `${record.subjectType === 'MATERIAL_TEMPLATE' ? 'template' : 'look'}:${record.subjectId}`;
    if (record.recordId !== expectedRecordId) return null;
    if (record.subjectType === 'LOOK_ASSET_PACK' && record.lifecycleStatus !== 'SIMULATED') return null;
    if (record.subjectType === 'MATERIAL_TEMPLATE') { templateCount += 1; templateIds.add(record.subjectId); }
    else { lookCount += 1; lookIds.add(record.subjectId); }
    if (record.rightsStatus !== 'PENDING' && record.rightsEvidenceRefs.length === 0) return null;
    if (record.promotionStatus !== 'BLOCKED') return null;
    const completeness = object(record.completeness);
    if (!completeness || !exactKeys(completeness, COMPLETENESS_KEYS) || !COMPLETENESS_KEYS.every((key) => COMPLETENESS_VALUES.has(completeness[key] as string))) return null;
  }
  if (templateIds.size !== EXPECTED_TEMPLATE_IDS.length || EXPECTED_TEMPLATE_IDS.some((id) => !templateIds.has(id))) return null;
  if (lookIds.size !== EXPECTED_LOOK_IDS.length || EXPECTED_LOOK_IDS.some((id) => !lookIds.has(id))) return null;
  if (templateCount !== summary.templateCount || lookCount !== summary.lookCount
    || summary.rightsPendingCount !== raw.records.filter((record) => object(record)?.rightsStatus === 'PENDING').length
    || summary.promotionBlockedCount !== raw.records.filter((record) => object(record)?.promotionStatus === 'BLOCKED').length) return null;
  return structuredClone(value) as GovernanceLedgerV1;
}
