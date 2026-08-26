import {
  EXPECTED_TEMPLATE_IDS,
  parseGovernanceLedgerV1,
  type GovernanceLedgerV1,
  type GovernanceRecordV1,
} from '@/platform/backend/asset-ops-governance-v1';

export const OFFICIAL_STARTER_SHELF_SCHEMA = 'studio-official-starter-shelf-v1' as const;
export const STARTER_SHELF_CANDIDATE_IDS = Object.freeze([
  't_french_white',
] as const);

const ROOT_KEYS = ['architectureBaseline', 'featureFlags', 'schemaVersion', 'summary', 'entries'];
const FLAG_KEYS = ['petalVeilEnabled'];
const SUMMARY_KEYS = ['candidateDatasetCount', 'visibleCount'];
const ENTRY_KEYS = [
  'assetId', 'displayName', 'evidenceTier', 'candidateOnlyLabels', 'lifecycleStatus', 'sortOrder',
  'rightsStatus', 'promotionStatus', 'capabilityStatus', 'blockingCodes', 'renderTemplateId', 'thumbnailUrl',
];

export type OfficialStarterShelfEntryV1 = {
  assetId: string;
  displayName: string;
  evidenceTier: string;
  candidateOnlyLabels: string[];
  sortOrder: number;
  lifecycleStatus: 'REAL';
  rightsStatus: 'PENDING';
  promotionStatus: 'BLOCKED';
  capabilityStatus: 'UNVERIFIED' | 'CONCEPT_ONLY';
  blockingCodes: string[];
  renderTemplateId: string;
  thumbnailUrl: string;
};

export type OfficialStarterShelfReadModelV1 = {
  schemaVersion: typeof OFFICIAL_STARTER_SHELF_SCHEMA;
  architectureBaseline: 'v0.7.2';
  featureFlags: { petalVeilEnabled: boolean };
  summary: { candidateDatasetCount: 1; visibleCount: 1 };
  entries: OfficialStarterShelfEntryV1[];
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

export function parseOfficialStarterShelfEntryV1(value: unknown): OfficialStarterShelfEntryV1 | null {
  const entry = object(value);
  if (!entry || !exactKeys(entry, ENTRY_KEYS) || !string(entry.assetId) || !string(entry.displayName) || !string(entry.evidenceTier)
    || !strings(entry.candidateOnlyLabels) || entry.candidateOnlyLabels.length !== 3
    || !entry.candidateOnlyLabels.includes('CANDIDATE_ONLY') || !entry.candidateOnlyLabels.includes('RIGHTS_PENDING') || !entry.candidateOnlyLabels.includes('PROMOTION_BLOCKED')
    || entry.lifecycleStatus !== 'REAL' || !Number.isInteger(entry.sortOrder)
    || entry.rightsStatus !== 'PENDING' || entry.promotionStatus !== 'BLOCKED'
    || !['UNVERIFIED', 'CONCEPT_ONLY'].includes(entry.capabilityStatus as string)
    || !strings(entry.blockingCodes) || !entry.blockingCodes.includes('RIGHTS_EVIDENCE_MISSING') || !entry.blockingCodes.includes('PROMOTION_NOT_AUTHORIZED')
    || !string(entry.renderTemplateId) || !string(entry.thumbnailUrl)) return null;
  return entry as unknown as OfficialStarterShelfEntryV1;
}

function candidateRecord(ledger: GovernanceLedgerV1, assetId: string): GovernanceRecordV1 | null {
  return ledger.records.find((record) => record.subjectType === 'MATERIAL_TEMPLATE' && record.subjectId === assetId) ?? null;
}

/**
 * Build the read-only shelf projection. All governance fields come from the
 * parsed ledger; this function never upgrades rights, capability, lifecycle,
 * or promotion state from index metadata.
 */
export function createOfficialStarterShelfReadModelV1(input: {
  materialIndex: unknown;
  governanceLedger: unknown;
  petalVeilEnabled?: boolean;
}): OfficialStarterShelfReadModelV1 | null {
  const index = object(input.materialIndex);
  const ledger = parseGovernanceLedgerV1(input.governanceLedger);
  const petalVeilEnabled = input.petalVeilEnabled ?? false;
  if (!index || !ledger || typeof petalVeilEnabled !== 'boolean' || !Array.isArray(index.templates)) return null;
  const templates = index.templates as unknown[];
  const indexIds = templates.map((entry) => object(entry)?.id);
  if (indexIds.length !== EXPECTED_TEMPLATE_IDS.length || indexIds.some((id) => !string(id))
    || new Set(indexIds).size !== EXPECTED_TEMPLATE_IDS.length
    || indexIds.some((id) => !EXPECTED_TEMPLATE_IDS.includes(id as typeof EXPECTED_TEMPLATE_IDS[number]))) return null;
  const candidateSet: Set<string> = new Set(STARTER_SHELF_CANDIDATE_IDS);
  const candidates = templates.filter((entry) => candidateSet.has(object(entry)?.id as string));
  if (candidates.length !== STARTER_SHELF_CANDIDATE_IDS.length) return null;
  const seen = new Set<string>();
  const entries: OfficialStarterShelfEntryV1[] = [];
  for (const rawEntry of candidates) {
    const entry = object(rawEntry);
    if (!entry || !string(entry.id) || seen.has(entry.id) || !candidateSet.has(entry.id)) return null;
    seen.add(entry.id);
    const record = candidateRecord(ledger, entry.id);
    if (!record || entry.asset_status !== 'REAL'
      || record.lifecycleStatus !== entry.asset_status || record.rightsStatus !== 'PENDING'
      || record.promotionStatus !== 'BLOCKED' || !['UNVERIFIED', 'CONCEPT_ONLY'].includes(record.capabilityStatus)
      || !Number.isFinite(entry.sort_order as number)
      || !record.blockingCodes.includes('RIGHTS_EVIDENCE_MISSING') || !record.blockingCodes.includes('PROMOTION_NOT_AUTHORIZED')
      || !string(entry.manifest_url) || !string(entry.thumbnail_url)) return null;
    const displayName = string(entry.name) ? entry.name : string(entry.name_en) ? entry.name_en : null;
    if (!displayName || !string(entry.render_template_id)) return null;
    entries.push({
      assetId: entry.id,
      displayName,
      evidenceTier: record.evidenceTier,
      candidateOnlyLabels: ['CANDIDATE_ONLY', 'RIGHTS_PENDING', 'PROMOTION_BLOCKED'],
      sortOrder: entry.sort_order as number,
      lifecycleStatus: record.lifecycleStatus as 'REAL',
      rightsStatus: record.rightsStatus,
      promotionStatus: record.promotionStatus,
      capabilityStatus: record.capabilityStatus,
      blockingCodes: [...record.blockingCodes],
      renderTemplateId: entry.render_template_id,
      thumbnailUrl: entry.thumbnail_url,
    });
  }
  if (seen.size !== STARTER_SHELF_CANDIDATE_IDS.length || entries.length !== STARTER_SHELF_CANDIDATE_IDS.length) return null;
  entries.sort((a, b) => a.sortOrder - b.sortOrder || a.assetId.localeCompare(b.assetId));
  entries.forEach((entry, index) => { entry.sortOrder = index; });
  const visibleEntries = entries;
  return {
    schemaVersion: OFFICIAL_STARTER_SHELF_SCHEMA,
    architectureBaseline: 'v0.7.2',
    featureFlags: { petalVeilEnabled },
    summary: { candidateDatasetCount: 1, visibleCount: 1 },
    entries: visibleEntries,
  };
}

export function parseOfficialStarterShelfReadModelV1(value: unknown): OfficialStarterShelfReadModelV1 | null {
  const raw = object(value);
  if (!raw || !exactKeys(raw, ROOT_KEYS) || raw.schemaVersion !== OFFICIAL_STARTER_SHELF_SCHEMA || raw.architectureBaseline !== 'v0.7.2'
    || !Array.isArray(raw.entries)) return null;
  const flags = object(raw.featureFlags);
  if (!flags || !exactKeys(flags, FLAG_KEYS) || typeof flags.petalVeilEnabled !== 'boolean') return null;
  const summary = object(raw.summary);
  if (!summary || !exactKeys(summary, SUMMARY_KEYS) || summary.candidateDatasetCount !== 1
    || summary.visibleCount !== 1 || raw.entries.length !== summary.visibleCount) return null;
  const seen = new Set<string>();
  for (const candidate of raw.entries) {
    const entry = parseOfficialStarterShelfEntryV1(candidate);
    if (!entry || seen.has(entry.assetId)
      || !STARTER_SHELF_CANDIDATE_IDS.includes(entry.assetId as typeof STARTER_SHELF_CANDIDATE_IDS[number])
    ) return null;
    seen.add(entry.assetId);
  }
  const expectedVisibleIds = STARTER_SHELF_CANDIDATE_IDS;
  if (seen.size !== expectedVisibleIds.length || expectedVisibleIds.some((id) => !seen.has(id))) return null;
  for (let index = 1; index < raw.entries.length; index += 1) {
    const previous = object(raw.entries[index - 1]);
    const current = object(raw.entries[index]);
    if (!previous || !current || (previous.sortOrder as number) > (current.sortOrder as number)
      || ((previous.sortOrder as number) === (current.sortOrder as number)
        && String(previous.assetId).localeCompare(String(current.assetId)) > 0)) return null;
  }
  return structuredClone(value) as OfficialStarterShelfReadModelV1;
}
