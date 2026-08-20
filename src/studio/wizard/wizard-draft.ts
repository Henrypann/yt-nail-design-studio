/**
 * Versioned active Wizard draft. This is a recovery snapshot, not a second
 * DesignSummary schema: incomplete Step 1 work is intentionally allowed.
 */

import { NAIL_SHAPE_IDS } from '@/generated/shape-types';
import {
  FINGER_CODES,
  type Confirmation,
  type DesignSummary,
  type DesignStatus,
  type FingerOverrides,
  type Finish,
  type NailLength,
  type NailShape,
} from '@/lib/types';
import { readData, removeKey, StorageKeys, writeEnvelope } from '@/lib/storage';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import type { AssetRefV7 } from '@/studio/editor/v7/model';
import type { ApplicationLevel } from '@/community/domain/types';
import {
  getOfficialTemplatePatternAssetForCommunityVersionV7,
  getOfficialTemplatePatternAssetV7,
  assetRefV7Equal,
  identifyOfficialTemplatePatternV7,
} from '@/studio/editor/v7/official-template-assets';

export const WIZARD_DRAFT_SCHEMA_VERSION = 1 as const;
export const WIZARD_RECOVERY_DRAFT_SCHEMA_VERSION = 2 as const;

export type CommunityLegacySourceRefV1 = {
  intentId: string;
  contentId: string;
  publisherId: string;
  sourceTemplateId: string;
  assetVersion: string;
  applicationLevel: ApplicationLevel;
};

export type StudioStartSourceV1 =
  | { kind: 'blank' }
  | { kind: 'customer'; customerId: string }
  | { kind: 'official_template'; templateId: string; shape: NailShape; asset: AssetRefV7 }
  | {
      kind: 'community_legacy';
      intentId: string;
      contentId: string;
      publisherId: string;
      assetVersion: string;
      sourceTemplateId: string;
      applicationLevel: CommunityLegacySourceRefV1['applicationLevel'];
      templateId: string;
      shape: NailShape;
      asset: AssetRefV7;
    };

export type WizardRecoveryDraftFailureCode =
  | 'missing'
  | 'invalid'
  | 'unsupported_schema'
  | 'confirmed_legacy'
  | 'asset_missing'
  | 'asset_mismatch'
  | 'storage_unavailable';

export interface WizardRecoveryDraftV2 {
  schemaVersion: typeof WIZARD_RECOVERY_DRAFT_SCHEMA_VERSION;
  designId: string;
  step: 1 | 2;
  source: StudioStartSourceV1;
  customerId: string | null;
  shape: NailShape | null;
  length: NailLength | null;
  styleId: string | null;
  styleName: string | null;
  stylePrompted: boolean;
  appliedShape: NailShape | null;
  appliedLength: NailLength | null;
  templateId: string | null;
  templateName: string | null;
  templateAssetRef: AssetRefV7 | null;
  communitySourceRef?: CommunityLegacySourceRefV1;
  baseColor: string | null;
  finish: Finish;
  fingerOverrides: FingerOverrides;
  recipe?: RecipeInstanceV1;
  createdAt: string;
  version: number;
  status: DesignStatus;
  confirmation?: Confirmation;
}

export interface WizardDraftV1 {
  schemaVersion: typeof WIZARD_DRAFT_SCHEMA_VERSION;
  designId: string;
  step: 1 | 2;
  customerId: string | null;
  shape: NailShape | null;
  length: NailLength | null;
  styleId: string | null;
  styleName: string | null;
  stylePrompted: boolean;
  appliedShape: NailShape | null;
  appliedLength: NailLength | null;
  templateId: string | null;
  templateName: string | null;
  /** Optional only for legacy V1 compatibility; V2 requires exact identity. */
  templateAssetRef?: AssetRefV7 | null;
  source?: StudioStartSourceV1;
  communitySourceRef?: CommunityLegacySourceRefV1;
  baseColor: string | null;
  finish: Finish;
  fingerOverrides: FingerOverrides;
  recipe?: RecipeInstanceV1;
  createdAt: string;
  version: number;
  status: DesignStatus;
  confirmation?: Confirmation;
}

export type WizardDraftSource = Omit<WizardDraftV1, 'schemaVersion' | 'customerId'> & {
  customer: { id: string } | null;
};

const SHAPES = new Set<string>(NAIL_SHAPE_IDS);
const LENGTHS = new Set<string>(['short', 'medium', 'long', 'extra-long']);
const FINISHES = new Set<string>(['gloss', 'matte', 'pearl']);
const STATUSES = new Set<string>([
  'draft', 'confirmed', 'submitted', 'completed', 'exported', 'archived',
]);
const FINGERS = new Set<string>(FINGER_CODES);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableEnum<T extends string>(value: unknown, values: Set<string>): value is T | null {
  return value === null || (typeof value === 'string' && values.has(value));
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function validFingerOverrides(value: unknown): value is FingerOverrides {
  const overrides = record(value);
  if (!overrides) return false;
  return Object.entries(overrides).every(([finger, raw]) => {
    if (!FINGERS.has(finger)) return false;
    const override = record(raw);
    if (!override) return false;
    return Object.keys(override).every((key) => key === 'baseColor' || key === 'decorationId')
      && (override.baseColor === undefined || typeof override.baseColor === 'string')
      && (override.decorationId === undefined || override.decorationId === null || typeof override.decorationId === 'string');
  });
}

function validConfirmation(value: unknown): value is Confirmation | undefined {
  if (value === undefined) return true;
  const confirmation = record(value);
  return Boolean(
    confirmation
      && typeof confirmation.confirmedAt === 'string'
      && Number.isFinite(Date.parse(confirmation.confirmedAt))
      && typeof confirmation.confirmedBy === 'string',
  );
}

export function parseWizardDraft(value: unknown): WizardDraftV1 | null {
  const raw = record(value);
  if (!raw || raw.schemaVersion !== WIZARD_DRAFT_SCHEMA_VERSION) return null;
  if (typeof raw.designId !== 'string' || !raw.designId) return null;
  if (raw.step !== 1 && raw.step !== 2) return null;
  if (!nullableString(raw.customerId)) return null;
  if (!nullableEnum<NailShape>(raw.shape, SHAPES)) return null;
  if (!nullableEnum<NailLength>(raw.length, LENGTHS)) return null;
  if (!nullableString(raw.styleId) || !nullableString(raw.styleName)) return null;
  if (typeof raw.stylePrompted !== 'boolean') return null;
  if (!nullableEnum<NailShape>(raw.appliedShape, SHAPES)) return null;
  if (!nullableEnum<NailLength>(raw.appliedLength, LENGTHS)) return null;
  if (!nullableString(raw.templateId) || !nullableString(raw.templateName)) return null;
  if (!nullableString(raw.baseColor)) return null;
  if (typeof raw.finish !== 'string' || !FINISHES.has(raw.finish)) return null;
  if (!validFingerOverrides(raw.fingerOverrides)) return null;
  if (raw.recipe !== undefined && !record(raw.recipe)) return null;
  if (typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt))) return null;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) return null;
  if (typeof raw.status !== 'string' || !STATUSES.has(raw.status)) return null;
  if (!validConfirmation(raw.confirmation)) return null;
  if (raw.step === 2 && (raw.appliedShape === null || raw.appliedLength === null || raw.baseColor === null)) {
    return null;
  }

  return structuredClone(raw) as unknown as WizardDraftV1;
}

export function readWizardDraft(): WizardDraftV1 | null {
  const stored = readData<unknown>(StorageKeys.wizardDraft);
  if (stored === null) return null;
  const v2 = parseWizardRecoveryDraftV2(stored);
  if (v2) {
    return {
      ...v2,
      schemaVersion: 1,
      source: structuredClone(v2.source),
      templateAssetRef: v2.templateAssetRef ? structuredClone(v2.templateAssetRef) : null,
    };
  }
  const parsed = parseWizardDraft(stored);
  return parsed;
}

export function wizardRecoveryDraftToLegacyProjection(draft: WizardRecoveryDraftV2): WizardDraftV1 {
  return { ...structuredClone(draft), schemaVersion: WIZARD_DRAFT_SCHEMA_VERSION } as WizardDraftV1;
}

const V2_KEYS = new Set([
  'schemaVersion', 'designId', 'step', 'source', 'customerId', 'shape', 'length',
  'styleId', 'styleName', 'stylePrompted', 'appliedShape', 'appliedLength',
  'templateId', 'templateName', 'templateAssetRef', 'baseColor', 'finish',
  'fingerOverrides', 'recipe', 'createdAt', 'version', 'status', 'confirmation', 'communitySourceRef',
]);
const SOURCE_KEYS: Record<StudioStartSourceV1['kind'], readonly string[]> = {
  blank: ['kind'],
  customer: ['kind', 'customerId'],
  official_template: ['kind', 'templateId', 'shape', 'asset'],
  community_legacy: ['kind', 'intentId', 'contentId', 'publisherId', 'assetVersion', 'sourceTemplateId', 'applicationLevel', 'templateId', 'shape', 'asset'],
};

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key)) && Object.keys(value).length === allowed.size;
}

function validAssetRef(value: unknown): value is AssetRefV7 {
  const asset = record(value);
  if (!asset || !exactKeys(asset, ['assetId', 'revision', 'kind', 'mimeType', 'sha256', 'widthPx', 'heightPx', 'colorSpace', 'alphaMode'].filter((key) => asset[key] !== undefined))) return false;
  return typeof asset.assetId === 'string' && asset.assetId.length > 0
    && typeof asset.revision === 'string' && asset.revision.length > 0
    && (asset.kind === 'raster' || asset.kind === 'vector' || asset.kind === 'mesh' || asset.kind === 'texture')
    && typeof asset.mimeType === 'string' && asset.mimeType.length > 0
    && typeof asset.sha256 === 'string' && /^[0-9a-f]{64}$/.test(asset.sha256)
    && (asset.widthPx === undefined || (typeof asset.widthPx === 'number' && Number.isInteger(asset.widthPx) && asset.widthPx > 0))
    && (asset.heightPx === undefined || (typeof asset.heightPx === 'number' && Number.isInteger(asset.heightPx) && asset.heightPx > 0))
    && (asset.colorSpace === undefined || asset.colorSpace === 'srgb' || asset.colorSpace === 'display-p3')
    && (asset.alphaMode === undefined || asset.alphaMode === 'straight' || asset.alphaMode === 'premultiplied' || asset.alphaMode === 'opaque');
}

function parseSource(value: unknown): StudioStartSourceV1 | null {
  const source = record(value);
  if (!source || typeof source.kind !== 'string' || !(source.kind in SOURCE_KEYS)) return null;
  if (!exactKeys(source, SOURCE_KEYS[source.kind as StudioStartSourceV1['kind']])) return null;
  if (source.kind === 'blank') return { kind: 'blank' };
  if (source.kind === 'customer') return typeof source.customerId === 'string' && source.customerId.length > 0
    ? { kind: 'customer', customerId: source.customerId } : null;
  if (source.kind === 'official_template') {
    if (typeof source.templateId !== 'string' || !SHAPES.has(source.shape as string) || !validAssetRef(source.asset)) return null;
    const expected = getOfficialTemplatePatternAssetV7(source.templateId, source.shape as NailShape);
    return expected && assetRefV7Equal(expected, source.asset)
      ? { kind: 'official_template', templateId: source.templateId, shape: source.shape as NailShape, asset: structuredClone(source.asset) }
      : null;
  }
  if (
    typeof source.intentId !== 'string' || !source.intentId || typeof source.contentId !== 'string' || !source.contentId
    || typeof source.publisherId !== 'string' || !source.publisherId || typeof source.assetVersion !== 'string' || !source.assetVersion
    || typeof source.sourceTemplateId !== 'string' || !source.sourceTemplateId
    || typeof source.applicationLevel !== 'string' || !['INSPIRATION_ONLY', 'APPROXIMATE', 'STRUCTURED_EDITABLE', 'REPRODUCIBLE'].includes(source.applicationLevel)
    || typeof source.templateId !== 'string' || !source.templateId || !SHAPES.has(source.shape as string) || !validAssetRef(source.asset)
  ) return null;
  const expected = getOfficialTemplatePatternAssetForCommunityVersionV7(source.sourceTemplateId, source.shape as NailShape, source.assetVersion);
  const identity = expected ? identifyOfficialTemplatePatternV7(expected) : null;
  if (!expected || !identity || identity.templateId !== source.templateId || !assetRefV7Equal(expected, source.asset)) return null;
  return {
    kind: 'community_legacy', intentId: source.intentId, contentId: source.contentId, publisherId: source.publisherId,
    assetVersion: source.assetVersion, sourceTemplateId: source.sourceTemplateId,
    applicationLevel: source.applicationLevel as CommunityLegacySourceRefV1['applicationLevel'],
    templateId: source.templateId, shape: source.shape as NailShape, asset: structuredClone(source.asset),
  };
}

export function parseWizardRecoveryDraftV2(value: unknown): WizardRecoveryDraftV2 | null {
  const raw = record(value);
  if (!raw || raw.schemaVersion !== 2 || !exactKeys(Object.fromEntries(Object.entries(raw).filter(([, item]) => item !== undefined)), [...V2_KEYS].filter((key) => raw[key] !== undefined))) return null;
  const v1 = parseWizardDraft({ ...raw, schemaVersion: 1 });
  const parsedSource = parseSource(raw.source);
  if (!v1 || !parsedSource || !validAssetRef(raw.templateAssetRef) && raw.templateAssetRef !== null) return null;
  if (raw.communitySourceRef !== undefined) {
    const community = record(raw.communitySourceRef);
    if (!community || !exactKeys(community, ['intentId', 'contentId', 'publisherId', 'sourceTemplateId', 'assetVersion', 'applicationLevel']) || Object.values(community).some((value) => typeof value !== 'string' || !value)) return null;
  }
  const hasTemplate = typeof raw.templateId === 'string' && raw.templateId.length > 0;
  const sourceHasTemplate = parsedSource.kind === 'official_template' || parsedSource.kind === 'community_legacy';
  if (hasTemplate !== sourceHasTemplate) return null;
  if (sourceHasTemplate && raw.templateId !== parsedSource.templateId) return null;
  if (sourceHasTemplate && (raw.appliedShape ?? raw.shape) !== parsedSource.shape) return null;
  if (!hasTemplate && raw.templateAssetRef !== null) return null;
  if (!sourceHasTemplate) {
    if (raw.customerId === null) {
      if (parsedSource.kind !== 'blank') return null;
    } else if (parsedSource.kind !== 'customer' || parsedSource.customerId !== raw.customerId) {
      return null;
    }
  }
  if (hasTemplate && (!raw.templateAssetRef || !('asset' in parsedSource) || !assetRefV7Equal(raw.templateAssetRef, parsedSource.asset))) return null;
  if (parsedSource.kind === 'community_legacy') {
    const community = record(raw.communitySourceRef);
    if (!community || community.intentId !== parsedSource.intentId || community.contentId !== parsedSource.contentId
      || community.publisherId !== parsedSource.publisherId || community.sourceTemplateId !== parsedSource.sourceTemplateId
      || community.assetVersion !== parsedSource.assetVersion || community.applicationLevel !== parsedSource.applicationLevel) return null;
  } else if (raw.communitySourceRef !== undefined) return null;
  return structuredClone(raw) as unknown as WizardRecoveryDraftV2;
}

export type ReadWizardRecoveryResult =
  | { ok: true; draft: WizardRecoveryDraftV2; migrated: boolean }
  | { ok: false; code: WizardRecoveryDraftFailureCode; preserved: boolean };

export function toWizardRecoveryDraftV2(source: WizardDraftSource & {
  source?: StudioStartSourceV1;
  templateAssetRef?: AssetRefV7 | null;
  communitySourceRef?: CommunityLegacySourceRefV1;
}): WizardRecoveryDraftV2 {
  const legacy = toWizardDraft(source);
  const shape = source.appliedShape ?? source.shape;
  const templateAssetRef = source.templateAssetRef ?? (source.templateId && shape
    ? getOfficialTemplatePatternAssetV7(source.templateId, shape) : null);
  const startSource = source.source ?? (source.communitySourceRef && source.templateId && shape && templateAssetRef
    ? { kind: 'community_legacy', ...source.communitySourceRef, templateId: source.templateId, shape, asset: templateAssetRef }
    : source.templateId && shape && templateAssetRef
      ? { kind: 'official_template', templateId: source.templateId, shape, asset: templateAssetRef }
      : source.customer ? { kind: 'customer', customerId: source.customer.id } : { kind: 'blank' });
  if (source.templateId && !templateAssetRef) throw new Error('template_asset_missing');
  return {
    ...legacy,
    schemaVersion: 2,
    source: startSource,
    templateAssetRef,
    ...(source.communitySourceRef ? { communitySourceRef: source.communitySourceRef } : {}),
  } as WizardRecoveryDraftV2;
}

export function readWizardRecoveryDraft(): ReadWizardRecoveryResult {
  let stored: unknown;
  try { stored = readData<unknown>(StorageKeys.wizardDraft); } catch { return { ok: false, code: 'storage_unavailable', preserved: true }; }
  if (stored === null) return { ok: false, code: 'missing', preserved: false };
  const v2 = parseWizardRecoveryDraftV2(stored);
  if (v2) return { ok: true, draft: v2, migrated: false };
  const raw = record(stored);
  if (raw?.schemaVersion === 2) return { ok: false, code: 'invalid', preserved: true };
  const v1 = parseWizardDraft(stored);
  if (!v1) return { ok: false, code: raw?.schemaVersion && raw.schemaVersion !== 1 ? 'unsupported_schema' : 'invalid', preserved: true };
  if (v1.confirmation || v1.status !== 'draft') return { ok: false, code: 'confirmed_legacy', preserved: true };
  const shape = v1.appliedShape ?? v1.shape;
  if (v1.templateId && (!shape || !getOfficialTemplatePatternAssetV7(v1.templateId, shape))) return { ok: false, code: 'asset_missing', preserved: true };
  try {
    const migrated = toWizardRecoveryDraftV2({
      ...v1,
      customer: v1.customerId ? { id: v1.customerId } : null,
    });
    return { ok: true, draft: migrated, migrated: true };
  } catch {
    return { ok: false, code: 'asset_missing', preserved: true };
  }
}

export function writeWizardRecoveryDraftV2(source: WizardDraftSource & {
  source?: StudioStartSourceV1;
  templateAssetRef?: AssetRefV7 | null;
  communitySourceRef?: CommunityLegacySourceRefV1;
}): WizardRecoveryDraftV2 {
  const draft = toWizardRecoveryDraftV2(source);
  if (!parseWizardRecoveryDraftV2(draft)) throw new Error('wizard_recovery_contract_invalid');
  writeEnvelope(StorageKeys.wizardDraft, draft);
  return draft;
}

export function toWizardDraft(source: WizardDraftSource): WizardDraftV1 {
  const draft: WizardDraftV1 = {
    schemaVersion: WIZARD_DRAFT_SCHEMA_VERSION,
    designId: source.designId,
    step: source.step,
    customerId: source.customer?.id ?? null,
    shape: source.shape,
    length: source.length,
    styleId: source.styleId,
    styleName: source.styleName,
    stylePrompted: source.stylePrompted,
    appliedShape: source.appliedShape,
    appliedLength: source.appliedLength,
    templateId: source.templateId,
    templateName: source.templateName,
    baseColor: source.baseColor,
    finish: source.finish,
    fingerOverrides: structuredClone(source.fingerOverrides),
    createdAt: source.createdAt,
    version: source.version,
    status: source.status,
  };
  if (source.recipe) draft.recipe = structuredClone(source.recipe);
  if (source.confirmation) draft.confirmation = structuredClone(source.confirmation);
  if (source.templateAssetRef !== undefined) draft.templateAssetRef = structuredClone(source.templateAssetRef);
  if (source.source) draft.source = structuredClone(source.source);
  if (source.communitySourceRef) draft.communitySourceRef = structuredClone(source.communitySourceRef);
  return draft;
}

export function writeWizardDraft(source: WizardDraftSource): WizardDraftV1 {
  const draft = toWizardDraft(source);
  writeEnvelope(StorageKeys.wizardDraft, draft);
  return draft;
}

export function clearWizardDraft(): void {
  removeKey(StorageKeys.wizardDraft);
}

/** Explicit design deep links outrank the active draft and rehydrate from its summary. */
export function wizardDraftFromDesignSummary(design: DesignSummary): WizardDraftV1 {
  return {
    schemaVersion: WIZARD_DRAFT_SCHEMA_VERSION,
    designId: design.id,
    step: 2,
    customerId: design.customerId || null,
    shape: design.shape,
    length: design.length,
    styleId: null,
    styleName: null,
    stylePrompted: Boolean(design.templateId),
    appliedShape: design.shape,
    appliedLength: design.length,
    templateId: design.templateId ?? null,
    templateName: design.title ?? null,
    templateAssetRef: design.templateAssetRef ? structuredClone(design.templateAssetRef) : null,
    communitySourceRef: design.communitySourceRef ? structuredClone(design.communitySourceRef) : undefined,
    source: design.communitySourceRef && design.templateId && design.shape && design.templateAssetRef
      ? {
          kind: 'community_legacy', ...design.communitySourceRef, templateId: design.templateId,
          shape: design.shape, asset: structuredClone(design.templateAssetRef),
        }
      : design.templateId && design.templateAssetRef
        ? { kind: 'official_template', templateId: design.templateId, shape: design.shape, asset: structuredClone(design.templateAssetRef) }
        : design.customerId ? { kind: 'customer', customerId: design.customerId } : { kind: 'blank' },
    baseColor: design.baseColor,
    finish: design.finish,
    fingerOverrides: structuredClone(design.fingerOverrides ?? {}),
    recipe: design.recipe ? structuredClone(design.recipe) : undefined,
    createdAt: design.createdAt,
    version: design.version,
    status: design.status,
    confirmation: design.confirmation ? structuredClone(design.confirmation) : undefined,
  };
}

export function chooseWizardRestoreDraft(input: {
  explicitDesignId: string | null;
  explicitDesign: DesignSummary | null;
  activeDraft: WizardDraftV1 | null;
}): WizardDraftV1 | null {
  if (input.explicitDesignId) {
    return input.explicitDesign
      ? wizardDraftFromDesignSummary(input.explicitDesign)
      : null;
  }
  return input.activeDraft;
}
