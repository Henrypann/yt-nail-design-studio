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

export const WIZARD_DRAFT_SCHEMA_VERSION = 1 as const;

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
  const parsed = parseWizardDraft(stored);
  if (!parsed) removeKey(StorageKeys.wizardDraft);
  return parsed;
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
