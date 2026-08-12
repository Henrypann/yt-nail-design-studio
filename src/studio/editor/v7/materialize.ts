import type {
  DesignSourceRefV1,
  EditorDocV7,
  ProcessStepV7,
  RecipeInstanceV7,
} from './model';
import { parseEditorDocV7 } from './schema';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface IndependentEditorDocMaterializationV7 {
  sourceRef: DesignSourceRefV1;
  title: string;
  now: string;
}

export interface IndependentEditorDocMaterializerDependenciesV7 {
  nextId(scope: 'design' | 'node'): string;
}

export type IndependentEditorDocMaterializationResultV7 =
  | { ok: true; doc: EditorDocV7 }
  | { ok: false; reason: 'invalid_source' | 'invalid_time' | 'id_collision' | 'invalid_result' | 'dependency' };

class MaterializerIdDependencyError extends Error {}
class MaterializerIdCollisionError extends Error {}

function collectCanonicalIds(doc: EditorDocV7): Set<string> {
  const ids = new Set<string>([doc.designId, ...Object.keys(doc.recipeInstances)]);
  for (const nail of Object.values(doc.nails)) {
    for (const step of nail.steps) {
      ids.add(step.id);
      if (step.kind === 'flat_design') step.elements.forEach((element) => ids.add(element.id));
      if (step.kind === 'dimensional_decoration') step.decorations.forEach((decoration) => ids.add(decoration.id));
    }
  }
  return ids;
}

function cloneStepWithFreshIds(
  step: ProcessStepV7,
  recipeIds: ReadonlyMap<string, string>,
  freshNodeId: () => string,
): ProcessStepV7 {
  const copy = structuredClone(step);
  copy.id = freshNodeId();
  if (copy.recipeInstanceId) copy.recipeInstanceId = recipeIds.get(copy.recipeInstanceId) ?? copy.recipeInstanceId;
  if (copy.kind === 'flat_design') {
    copy.elements = copy.elements.map((element) => ({ ...structuredClone(element), id: freshNodeId() }));
  }
  if (copy.kind === 'dimensional_decoration') {
    copy.decorations = copy.decorations.map((decoration) => ({ ...structuredClone(decoration), id: freshNodeId() }));
  }
  return copy;
}

/**
 * Community-neutral, pure independent-copy materializer.
 *
 * The caller owns intent/permission/asset orchestration. This function only
 * creates a new canonical EditorDocV7 and deliberately strips private runtime
 * and live-composition linkage from the source.
 */
export function materializeIndependentEditorDocV7(
  sourceValue: unknown,
  request: IndependentEditorDocMaterializationV7,
  dependencies: IndependentEditorDocMaterializerDependenciesV7,
): IndependentEditorDocMaterializationResultV7 {
  const source = parseEditorDocV7(sourceValue);
  if (!source.ok) return { ok: false, reason: 'invalid_source' };
  if (!Number.isFinite(Date.parse(request.now))) return { ok: false, reason: 'invalid_time' };

  const sourceIds = collectCanonicalIds(source.doc);
  const generated = new Set<string>();
  const fresh = (scope: 'design' | 'node'): string => {
    let value: string;
    try { value = dependencies.nextId(scope); }
    catch { throw new MaterializerIdDependencyError(); }
    if (!ID.test(value) || generated.has(value) || sourceIds.has(value)) throw new MaterializerIdCollisionError();
    generated.add(value);
    return value;
  };

  try {
    const designId = fresh('design');
    const recipeIds = new Map<string, string>();
    const recipeInstances: Record<string, RecipeInstanceV7> = {};
    for (const [sourceId, recipe] of Object.entries(source.doc.recipeInstances)) {
      const instanceId = fresh('node');
      recipeIds.set(sourceId, instanceId);
      recipeInstances[instanceId] = { ...structuredClone(recipe), instanceId };
    }

    const nails = structuredClone(source.doc.nails);
    for (const nail of Object.values(nails)) {
      nail.steps = source.doc.nails[nail.finger].steps.map((step) => (
        cloneStepWithFreshIds(step, recipeIds, () => fresh('node'))
      ));
      delete nail.compositionProvenance;
    }

    const candidate: EditorDocV7 = {
      schemaVersion: 7,
      designId,
      title: request.title,
      nails,
      recipeInstances,
      sourceRefs: [structuredClone(request.sourceRef)],
      communicationRefs: [],
      outputIntent: 'design',
      revision: 1,
      createdAt: request.now,
      updatedAt: request.now,
    };
    const parsed = parseEditorDocV7(candidate);
    return parsed.ok
      ? { ok: true, doc: parsed.doc }
      : { ok: false, reason: 'invalid_result' };
  } catch (error) {
    return { ok: false, reason: error instanceof MaterializerIdDependencyError ? 'dependency' : 'id_collision' };
  }
}
