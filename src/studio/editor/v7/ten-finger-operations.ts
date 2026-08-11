import { FINGER_CODES, type FingerCode } from '../../../lib/types';
import { normalizeBackgroundDirectionV7 } from './background';
import type { EditorV7CommandFailure, EditorV7CommandResult } from './commands';
import { mapNailPathDataV7 } from './flat-vector';
import type { EditorV7IdFactory } from './id';
import type {
  EditorDocV7,
  NailPointV7,
  ProcessStepV7,
  RegionMaskV7,
  Transform2DV7,
} from './model';
import { parseEditorDocV7 } from './schema';

export type EditorV7FingerScopeKind = 'current' | 'selected' | 'mirror' | 'all';
export type EditorV7FingerProjection = 'identity' | 'mirror-x';

export interface EditorV7FingerScope {
  kind: EditorV7FingerScopeKind;
  currentFinger: FingerCode;
  selectedFingers?: readonly FingerCode[];
}

export interface EditorV7ScopeTarget {
  finger: FingerCode;
  projection: EditorV7FingerProjection;
}

export type EditorV7ScopeResolution =
  | { ok: true; targets: readonly EditorV7ScopeTarget[] }
  | { ok: false; reason: 'empty_scope' | 'invalid_scope' };

export interface EditorV7ScopeCommandSuccess {
  ok: true;
  doc: EditorDocV7;
  affectedFingers: readonly FingerCode[];
  idMap: Readonly<Record<FingerCode, Readonly<Record<string, string>>>>;
}

export type EditorV7ScopeCommandResult =
  | EditorV7ScopeCommandSuccess
  | Extract<EditorV7CommandResult, { ok: false }>;

const FINGER_SET = new Set<FingerCode>(FINGER_CODES);
const OPPOSITE_FINGER: Readonly<Record<FingerCode, FingerCode>> = {
  L1: 'R1', L2: 'R2', L3: 'R3', L4: 'R4', L5: 'R5',
  R1: 'L1', R2: 'L2', R3: 'L3', R4: 'L4', R5: 'L5',
};

function reject(reason: EditorV7CommandFailure, message: string): EditorV7ScopeCommandResult {
  return { ok: false, reason, message };
}

export function oppositeEditorV7Finger(finger: FingerCode): FingerCode {
  return OPPOSITE_FINGER[finger];
}

export function resolveEditorV7FingerScope(scope: EditorV7FingerScope): EditorV7ScopeResolution {
  if (!FINGER_SET.has(scope.currentFinger)) return { ok: false, reason: 'invalid_scope' };
  if (scope.kind === 'current') return { ok: true, targets: [{ finger: scope.currentFinger, projection: 'identity' }] };
  if (scope.kind === 'mirror') {
    return {
      ok: true,
      targets: [
        { finger: scope.currentFinger, projection: 'identity' },
        { finger: OPPOSITE_FINGER[scope.currentFinger], projection: 'mirror-x' },
      ],
    };
  }
  if (scope.kind === 'all') {
    return { ok: true, targets: FINGER_CODES.map((finger) => ({ finger, projection: 'identity' })) };
  }
  if (scope.kind !== 'selected' || !Array.isArray(scope.selectedFingers)) {
    return { ok: false, reason: 'invalid_scope' };
  }
  const selected = new Set(scope.selectedFingers);
  if ([...selected].some((finger) => !FINGER_SET.has(finger))) return { ok: false, reason: 'invalid_scope' };
  const targets = FINGER_CODES
    .filter((finger) => selected.has(finger))
    .map((finger) => ({ finger, projection: 'identity' as const }));
  return targets.length > 0 ? { ok: true, targets } : { ok: false, reason: 'empty_scope' };
}

function mirrorPoint(point: NailPointV7): NailPointV7 {
  return {
    u: Number((1 - point.u).toFixed(5)),
    v: point.v,
  };
}

function normalizeSignedAngle(angle: number): number {
  const normalized = ((angle + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function mirrorTransform(transform: Transform2DV7): Transform2DV7 {
  return {
    ...structuredClone(transform),
    position: mirrorPoint(transform.position),
    rotationDeg: normalizeSignedAngle(-transform.rotationDeg),
  };
}

function mirrorMask(mask: RegionMaskV7): RegionMaskV7 | null {
  const pathData = mapNailPathDataV7(mask.pathData, mirrorPoint);
  return pathData ? { ...structuredClone(mask), pathData } : null;
}

function cloneStepWithFreshIds(
  source: ProcessStepV7,
  projection: EditorV7FingerProjection,
  idFactory: EditorV7IdFactory,
  usedIds: Set<string>,
  idMap: Record<string, string>,
  failure: { reason: EditorV7CommandFailure; message: string } | null,
): ProcessStepV7 | null {
  const freshId = (prefix: 'step' | 'element', oldId: string): string | null => {
    const nextId = idFactory(prefix);
    if (usedIds.has(nextId)) {
      if (failure) {
        failure.reason = 'duplicate_id';
        failure.message = 'generated node ID already exists';
      }
      return null;
    }
    usedIds.add(nextId);
    idMap[oldId] = nextId;
    return nextId;
  };
  const step = structuredClone(source);
  const stepId = freshId('step', source.id);
  if (!stepId) return null;
  step.id = stepId;
  if (projection === 'identity') {
    if (step.kind === 'flat_design') {
      for (const element of step.elements) {
        const id = freshId('element', element.id);
        if (!id) return null;
        element.id = id;
      }
    } else if (step.kind === 'dimensional_decoration') {
      for (const decoration of step.decorations) {
        const id = freshId('element', decoration.id);
        if (!id) return null;
        decoration.id = id;
      }
    }
    return step;
  }

  if (step.kind === 'background') {
    if (step.background.mode === 'gradient' || step.background.mode === 'cat_eye') {
      step.background.directionDeg = normalizeBackgroundDirectionV7(180 - step.background.directionDeg);
    }
    return step;
  }

  if (step.kind === 'flat_design') {
    if (step.mask) {
      const mirrored = mirrorMask(step.mask);
      if (!mirrored) {
        if (failure) {
          failure.reason = 'invalid_value';
          failure.message = 'step mask cannot be mirrored by the nail-local path adapter';
        }
        return null;
      }
      step.mask = mirrored;
    }
    for (const element of step.elements) {
      const id = freshId('element', element.id);
      if (!id) return null;
      element.id = id;
      element.transform = mirrorTransform(element.transform);
      if (element.kind === 'brush_stroke') element.points = element.points.map(mirrorPoint);
      else if (element.kind === 'eraser_mask') element.path = element.path.map(mirrorPoint);
      else if (element.kind === 'vector_shape') {
        const pathData = mapNailPathDataV7(element.pathData, mirrorPoint);
        if (!pathData) {
          if (failure) {
            failure.reason = 'invalid_value';
            failure.message = 'vector path cannot be mirrored by the nail-local path adapter';
          }
          return null;
        }
        element.pathData = pathData;
      } else if (element.kind === 'region_mask') {
        const mirrored = mirrorMask(element.mask);
        if (!mirrored) {
          if (failure) {
            failure.reason = 'invalid_value';
            failure.message = 'region mask cannot be mirrored by the nail-local path adapter';
          }
          return null;
        }
        element.mask = mirrored;
      }
      // Text glyphs and image pixels intentionally remain readable/upright.
      // Their nail-local placement and rotation are mirrored by the transform.
    }
    return step;
  }

  if (step.kind === 'surface_effect') {
    const mirrored = mirrorMask(step.mask);
    if (!mirrored) {
      if (failure) {
        failure.reason = 'invalid_value';
        failure.message = 'surface-effect mask cannot be mirrored by the nail-local path adapter';
      }
      return null;
    }
    step.mask = mirrored;
    if (step.effect.effectType === 'cat_eye') {
      step.effect.directionDeg = normalizeBackgroundDirectionV7(180 - step.effect.directionDeg);
    }
    return step;
  }

  if (step.kind === 'dimensional_decoration') {
    for (const decoration of step.decorations) {
      const id = freshId('element', decoration.id);
      if (!id) return null;
      decoration.id = id;
      decoration.transform = mirrorTransform(decoration.transform);
      if (decoration.kind === 'relief_2_5d') {
        const outline = mirrorMask(decoration.outline);
        if (!outline) {
          if (failure) {
            failure.reason = 'invalid_value';
            failure.message = 'relief outline cannot be mirrored by the nail-local path adapter';
          }
          return null;
        }
        decoration.outline = outline;
      } else {
        decoration.anchor = mirrorPoint(decoration.anchor);
        // The mesh body stays upright; only placement/anchor are mirrored in V7.
      }
    }
  }
  return step;
}

function allNodeIds(doc: EditorDocV7): Set<string> {
  const ids = new Set<string>();
  for (const nail of Object.values(doc.nails)) {
    for (const step of nail.steps) {
      ids.add(step.id);
      if (step.kind === 'flat_design') step.elements.forEach((element) => ids.add(element.id));
      if (step.kind === 'dimensional_decoration') step.decorations.forEach((decoration) => ids.add(decoration.id));
    }
  }
  return ids;
}

function hasLockedContent(doc: EditorDocV7, finger: FingerCode): boolean {
  return doc.nails[finger].steps.some((step) =>
    step.locked ||
    (step.kind === 'flat_design' && step.elements.some((element) => element.locked)) ||
    (step.kind === 'dimensional_decoration' && step.decorations.some((decoration) => decoration.locked)),
  );
}

function localCompositionId(designId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < designId.length; index += 1) {
    hash ^= designId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `composition.local.${(hash >>> 0).toString(36)}`;
}

export function materializeEditorV7NailScope(
  doc: EditorDocV7,
  request: {
    sourceFinger: FingerCode;
    scope: EditorV7FingerScope;
    mode: 'copy-detached' | 'sync-linked';
  },
  idFactory: EditorV7IdFactory,
): EditorV7ScopeCommandResult {
  if (!FINGER_SET.has(request.sourceFinger) || request.scope.currentFinger !== request.sourceFinger) {
    return reject('invalid_value', 'source finger and scope current finger must match');
  }
  const resolution = resolveEditorV7FingerScope(request.scope);
  if (!resolution.ok) return reject('invalid_value', resolution.reason === 'empty_scope' ? 'finger scope is empty' : 'finger scope is invalid');
  if (request.mode === 'sync-linked' && request.scope.kind === 'mirror') {
    return reject('not_allowed', 'mirror is a one-time layout copy and cannot create a linked sync');
  }
  const targets = resolution.targets.filter((target) => target.finger !== request.sourceFinger);
  if (targets.length === 0) return reject('not_allowed', 'scope has no target finger');
  if (targets.some((target) => hasLockedContent(doc, target.finger))) {
    return reject('locked', 'one or more target fingers contain locked content');
  }
  const linkedScope = new Set([request.sourceFinger, ...targets.map((target) => target.finger)]);
  if (request.mode === 'sync-linked') {
    const linkedOutsideScope = FINGER_CODES.filter((finger) => (
      !linkedScope.has(finger) && doc.nails[finger].compositionProvenance?.syncState === 'linked'
    ));
    if (linkedOutsideScope.length > 0) {
      return reject('not_allowed', `scope excludes linked fingers: ${linkedOutsideScope.join(', ')}`);
    }
  }

  const next = structuredClone(doc);
  const usedIds = allNodeIds(doc);
  const idMap: Record<FingerCode, Record<string, string>> = Object.fromEntries(
    FINGER_CODES.map((finger) => [finger, {}]),
  ) as Record<FingerCode, Record<string, string>>;
  const failure = { reason: 'invalid_value' as EditorV7CommandFailure, message: 'scope could not be materialized' };

  for (const target of targets) {
    const steps: ProcessStepV7[] = [];
    for (const sourceStep of doc.nails[request.sourceFinger].steps) {
      const step = cloneStepWithFreshIds(sourceStep, target.projection, idFactory, usedIds, idMap[target.finger], failure);
      if (!step) return reject(failure.reason, failure.message);
      steps.push(step);
    }
    next.nails[target.finger].steps = steps;
  }

  if (request.mode === 'sync-linked') {
    const compositionMeta = next.compositionMeta ?? {
      compositionId: localCompositionId(next.designId),
      revision: 'editor-v7-explicit-sync-v1',
      source: { domain: 'manual' as const, sourceId: next.designId },
    };
    next.compositionMeta = compositionMeta;
    const linked = linkedScope;
    for (const finger of FINGER_CODES) {
      if (linked.has(finger)) {
        next.nails[finger].compositionProvenance = {
          compositionId: compositionMeta.compositionId,
          revision: compositionMeta.revision,
          syncState: 'linked',
        };
      }
    }
  } else if (next.compositionMeta) {
    for (const target of targets) {
      next.nails[target.finger].compositionProvenance = {
        compositionId: next.compositionMeta.compositionId,
        revision: next.compositionMeta.revision,
        syncState: 'detached',
      };
    }
  }

  const parsed = parseEditorDocV7(next);
  if (!parsed.ok) return reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return {
    ok: true,
    doc: parsed.doc,
    affectedFingers: targets.map((target) => target.finger),
    idMap,
  };
}

export function detachEditorV7NailScope(
  doc: EditorDocV7,
  scope: EditorV7FingerScope,
): EditorV7ScopeCommandResult {
  const resolution = resolveEditorV7FingerScope(scope);
  if (!resolution.ok) return reject('invalid_value', resolution.reason === 'empty_scope' ? 'finger scope is empty' : 'finger scope is invalid');
  if (!doc.compositionMeta) return reject('not_allowed', 'document has no composition sync to detach');
  const next = structuredClone(doc);
  const affected: FingerCode[] = [];
  for (const { finger } of resolution.targets) {
    const provenance = next.nails[finger].compositionProvenance;
    if (provenance?.syncState === 'linked') {
      next.nails[finger].compositionProvenance = { ...provenance, syncState: 'detached' };
      affected.push(finger);
    }
  }
  if (affected.length === 0) return reject('not_allowed', 'scope contains no linked finger');
  const parsed = parseEditorDocV7(next);
  if (!parsed.ok) return reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return {
    ok: true,
    doc: parsed.doc,
    affectedFingers: affected,
    idMap: Object.fromEntries(FINGER_CODES.map((finger) => [finger, {}])) as Record<FingerCode, Record<string, string>>,
  };
}

/** A normal single-finger edit breaks snapshot membership in the same transaction. */
export function detachLinkedEditorV7NailAfterEdit(doc: EditorDocV7, finger: FingerCode): EditorDocV7 {
  const provenance = doc.nails[finger]?.compositionProvenance;
  if (provenance?.syncState !== 'linked') return doc;
  const next = structuredClone(doc);
  next.nails[finger].compositionProvenance = { ...provenance, syncState: 'detached' };
  return next;
}
