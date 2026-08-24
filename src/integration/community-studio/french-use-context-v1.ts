/**
 * INT-v0.7.2-FRENCH-01A · Community → Studio French use context.
 *
 * This is a short-lived, read-only hint derived from governed discovery
 * metadata after a Community source has passed its existing import preflight.
 * It is deliberately separate from VersionedStudioImportIntentV2 and
 * EditorDocV7: it cannot select a preset, create a recipe, claim makeability,
 * or mutate geometry.
 */

import type { CommunityDiscoveryMetadataV1 } from '@/community/domain/taxonomy-v2/types';
import { FINGER_CODES, type NailLength, type NailShape } from '@/lib/types';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import {
  FRENCH_SIGNED_LENGTHS_V1,
  FRENCH_SIGNED_SHAPES_V1,
} from '@/studio/editor/v7/french-geometry-input-v1';

export const FRENCH_USE_CONTEXT_CONTRACT_V1 = 'INT-v0.7.2-FRENCH-01A' as const;
export const FRENCH_USE_CONTEXT_TTL_MS_V1 = 15 * 60 * 1000;
export const FRENCH_USE_TECHNIQUE_ID_V1 = 'technique:french' as const;

export type FrenchUseRouteV1 = 'CANONICAL_V2' | 'LEGACY_V1';
export type FrenchUseAuthoringStatusV1 = 'AVAILABLE' | 'SOURCE_TARGET_MISMATCH' | 'UNAVAILABLE';

export interface FrenchUseContextV1 {
  schemaVersion: 1;
  contractRef: typeof FRENCH_USE_CONTEXT_CONTRACT_V1;
  contextId: string;
  source: 'COMMUNITY';
  route: FrenchUseRouteV1;
  sourceId: string;
  sourceRevision: string | null;
  targetDesignId: string;
  techniqueId: typeof FRENCH_USE_TECHNIQUE_ID_V1;
  sourceShapeId: string | null;
  sourceLengthId: string | null;
  targetShape: NailShape | null;
  targetLength: NailLength | null;
  authoringStatus: FrenchUseAuthoringStatusV1;
  action: 'OFFER_OPEN_FRENCH_TOOL' | 'SHOW_DIAGNOSTIC';
  diagnostics: string[];
  claims: {
    presetInferred: false;
    makeabilityInferred: false;
    manufacturingValidated: false;
  };
  createdAt: string;
  expiresAt: string;
}

export type FrenchUsePreflightV1 =
  | {
      status: 'FRENCH_DECLARED';
      techniqueId: typeof FRENCH_USE_TECHNIQUE_ID_V1;
      sourceShapeId: string | null;
      sourceLengthId: string | null;
    }
  | { status: 'NOT_FRENCH' }
  | { status: 'DISCOVERY_UNAVAILABLE' };

export interface FrenchUseContextStorageV1 {
  read(): Record<string, unknown>;
  write(next: Record<string, unknown>): void;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const CONTEXT_KEYS = [
  'schemaVersion', 'contractRef', 'contextId', 'source', 'route', 'sourceId',
  'sourceRevision', 'targetDesignId', 'techniqueId', 'sourceShapeId',
  'sourceLengthId', 'targetShape', 'targetLength', 'authoringStatus', 'action',
  'diagnostics', 'claims', 'createdAt', 'expiresAt',
] as const;
const CLAIM_KEYS = ['presetInferred', 'makeabilityInferred', 'manufacturingValidated'] as const;
const SHAPES = new Set<NailShape>(['almond', 'oval', 'coffin', 'squoval', 'square']);
const LENGTHS = new Set<NailLength>(['short', 'medium', 'long', 'extra-long']);
const SIGNED_SHAPES = new Set<string>(FRENCH_SIGNED_SHAPES_V1);
const SIGNED_LENGTHS = new Set<string>(FRENCH_SIGNED_LENGTHS_V1);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function optionalId(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && ID.test(value));
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === 'string' && item.length > 0)
    && new Set(value).size === value.length;
}

export function deriveFrenchUsePreflightV1(
  discovery: CommunityDiscoveryMetadataV1 | null,
): FrenchUsePreflightV1 {
  if (!discovery) return { status: 'DISCOVERY_UNAVAILABLE' };
  if (!discovery.techniqueIds.includes(FRENCH_USE_TECHNIQUE_ID_V1)) return { status: 'NOT_FRENCH' };
  return {
    status: 'FRENCH_DECLARED',
    techniqueId: FRENCH_USE_TECHNIQUE_ID_V1,
    sourceShapeId: discovery.recommendedShapeIds.length === 1 ? discovery.recommendedShapeIds[0] : null,
    sourceLengthId: discovery.lengthIds.length === 1 ? discovery.lengthIds[0] : null,
  };
}

function inspectTargetGeometry(doc: EditorDocV7): {
  status: FrenchUseAuthoringStatusV1;
  shape: NailShape | null;
  length: NailLength | null;
  diagnostics: string[];
} {
  const resolved = FINGER_CODES.map((finger) => ({
    finger,
    geometry: resolveEditorGeometryV7(doc.nails[finger].geometryRef, finger),
  }));
  const unavailable = resolved.filter(({ geometry }) => (
    geometry.status !== 'resolved'
    || geometry.fidelity !== 'exact'
    || geometry.evidence !== 'signed_off'
    || !SIGNED_SHAPES.has(geometry.shape)
    || !SIGNED_LENGTHS.has(geometry.length)
  ));
  if (unavailable.length > 0) {
    return {
      status: 'UNAVAILABLE',
      shape: null,
      length: null,
      diagnostics: unavailable.map(({ finger, geometry }) => (
        geometry.status === 'unresolved'
          ? `${finger}:geometry:${geometry.reason}`
          : `${finger}:french:${geometry.shape}:${geometry.length}:${geometry.fidelity}`
      )),
    };
  }
  const shapes = new Set(resolved.map(({ geometry }) => geometry.status === 'resolved' ? geometry.shape : ''));
  const lengths = new Set(resolved.map(({ geometry }) => geometry.status === 'resolved' ? geometry.length : ''));
  if (shapes.size !== 1 || lengths.size !== 1) {
    return { status: 'UNAVAILABLE', shape: null, length: null, diagnostics: ['target:ten-finger-geometry-not-uniform'] };
  }
  return {
    status: 'AVAILABLE',
    shape: [...shapes][0] as NailShape,
    length: [...lengths][0] as NailLength,
    diagnostics: [],
  };
}

export function createFrenchUseContextV1(input: {
  contextId: string;
  route: FrenchUseRouteV1;
  sourceId: string;
  sourceRevision: string | null;
  discovery: CommunityDiscoveryMetadataV1 | null;
  targetDoc: EditorDocV7;
  nowMs: number;
}): { ok: true; context: FrenchUseContextV1 | null } | { ok: false; reason: 'invalid_input' | 'discovery_unavailable' } {
  if (!ID.test(input.contextId) || !ID.test(input.sourceId) || !optionalId(input.sourceRevision)
    || !Number.isFinite(input.nowMs) || !ID.test(input.targetDoc.designId)) return { ok: false, reason: 'invalid_input' };
  const preflight = deriveFrenchUsePreflightV1(input.discovery);
  if (preflight.status === 'DISCOVERY_UNAVAILABLE') return { ok: false, reason: 'discovery_unavailable' };
  if (preflight.status === 'NOT_FRENCH') return { ok: true, context: null };
  const target = inspectTargetGeometry(input.targetDoc);
  const expectedShape = preflight.sourceShapeId?.startsWith('shape:') ? preflight.sourceShapeId.slice('shape:'.length) : null;
  const expectedLength = preflight.sourceLengthId?.startsWith('length:') ? preflight.sourceLengthId.slice('length:'.length) : null;
  const mismatch = target.status === 'AVAILABLE' && (
    (expectedShape !== null && expectedShape !== target.shape)
    || (expectedLength !== null && expectedLength !== target.length)
  );
  const authoringStatus: FrenchUseAuthoringStatusV1 = mismatch ? 'SOURCE_TARGET_MISMATCH' : target.status;
  const diagnostics = [
    ...target.diagnostics,
    ...(mismatch ? [`source-target:${expectedShape ?? '*'}:${expectedLength ?? '*'}->${target.shape}:${target.length}`] : []),
  ];
  const createdAt = new Date(input.nowMs).toISOString();
  const context: FrenchUseContextV1 = {
    schemaVersion: 1,
    contractRef: FRENCH_USE_CONTEXT_CONTRACT_V1,
    contextId: input.contextId,
    source: 'COMMUNITY',
    route: input.route,
    sourceId: input.sourceId,
    sourceRevision: input.sourceRevision,
    targetDesignId: input.targetDoc.designId,
    techniqueId: FRENCH_USE_TECHNIQUE_ID_V1,
    sourceShapeId: preflight.sourceShapeId,
    sourceLengthId: preflight.sourceLengthId,
    targetShape: target.shape,
    targetLength: target.length,
    authoringStatus,
    action: authoringStatus === 'AVAILABLE' ? 'OFFER_OPEN_FRENCH_TOOL' : 'SHOW_DIAGNOSTIC',
    diagnostics,
    claims: { presetInferred: false, makeabilityInferred: false, manufacturingValidated: false },
    createdAt,
    expiresAt: new Date(input.nowMs + FRENCH_USE_CONTEXT_TTL_MS_V1).toISOString(),
  };
  return { ok: true, context };
}

export function parseFrenchUseContextV1(
  value: unknown,
  expectedId?: string,
): { ok: true; context: FrenchUseContextV1 } | { ok: false } {
  const raw = record(value);
  const claims = raw ? record(raw.claims) : null;
  if (!raw || !exactKeys(raw, CONTEXT_KEYS) || !claims || !exactKeys(claims, CLAIM_KEYS)
    || raw.schemaVersion !== 1 || raw.contractRef !== FRENCH_USE_CONTEXT_CONTRACT_V1
    || raw.source !== 'COMMUNITY' || (raw.route !== 'CANONICAL_V2' && raw.route !== 'LEGACY_V1')
    || typeof raw.contextId !== 'string' || !ID.test(raw.contextId)
    || (expectedId !== undefined && raw.contextId !== expectedId)
    || typeof raw.sourceId !== 'string' || !ID.test(raw.sourceId)
    || !optionalId(raw.sourceRevision)
    || typeof raw.targetDesignId !== 'string' || !ID.test(raw.targetDesignId)
    || raw.techniqueId !== FRENCH_USE_TECHNIQUE_ID_V1
    || !optionalId(raw.sourceShapeId) || !optionalId(raw.sourceLengthId)
    || (raw.targetShape !== null && (typeof raw.targetShape !== 'string' || !SHAPES.has(raw.targetShape as NailShape)))
    || (raw.targetLength !== null && (typeof raw.targetLength !== 'string' || !LENGTHS.has(raw.targetLength as NailLength)))
    || !['AVAILABLE', 'SOURCE_TARGET_MISMATCH', 'UNAVAILABLE'].includes(String(raw.authoringStatus))
    || !['OFFER_OPEN_FRENCH_TOOL', 'SHOW_DIAGNOSTIC'].includes(String(raw.action))
    || !uniqueStrings(raw.diagnostics)
    || claims.presetInferred !== false || claims.makeabilityInferred !== false || claims.manufacturingValidated !== false
    || typeof raw.createdAt !== 'string' || typeof raw.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(raw.createdAt)) || !Number.isFinite(Date.parse(raw.expiresAt))
    || Date.parse(raw.expiresAt) <= Date.parse(raw.createdAt)
    || (raw.authoringStatus === 'AVAILABLE' && raw.action !== 'OFFER_OPEN_FRENCH_TOOL')
    || (raw.authoringStatus !== 'AVAILABLE' && raw.action !== 'SHOW_DIAGNOSTIC')) return { ok: false };
  return { ok: true, context: structuredClone(raw) as unknown as FrenchUseContextV1 };
}

export function frenchUseContextMatchesTargetV1(context: FrenchUseContextV1, doc: EditorDocV7): boolean {
  return context.targetDesignId === doc.designId && doc.sourceRefs.some((ref) => (
    ref.domain === 'community'
    && ref.sourceId === context.sourceId
    && (context.sourceRevision === null || ref.revision === context.sourceRevision)
  ));
}

export function createFrenchUseContextPortV1(storage: FrenchUseContextStorageV1, nowMs: () => number) {
  const rewriteWithout = (contextId: string) => {
    const current = storage.read();
    if (!(contextId in current)) return;
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => key !== contextId));
    storage.write(next);
  };
  return {
    save(context: FrenchUseContextV1): { ok: true } | { ok: false } {
      const parsed = parseFrenchUseContextV1(context, context.contextId);
      if (!parsed.ok || Date.parse(parsed.context.expiresAt) <= nowMs()) return { ok: false };
      try {
        const current = storage.read();
        for (const [key, value] of Object.entries(current)) {
          if (!parseFrenchUseContextV1(value, key).ok) return { ok: false };
        }
        storage.write({ ...current, [context.contextId]: structuredClone(context) });
        return { ok: true };
      } catch { return { ok: false }; }
    },
    peek(contextId: string): FrenchUseContextV1 | null {
      if (!ID.test(contextId)) return null;
      let current: Record<string, unknown>;
      try { current = storage.read(); } catch { return null; }
      const parsed = parseFrenchUseContextV1(current[contextId], contextId);
      if (!parsed.ok || Date.parse(parsed.context.expiresAt) <= nowMs()) {
        try { rewriteWithout(contextId); } catch { /* fail closed */ }
        return null;
      }
      return parsed.context;
    },
    clear(contextId: string): void {
      if (!ID.test(contextId)) return;
      rewriteWithout(contextId);
    },
  };
}
