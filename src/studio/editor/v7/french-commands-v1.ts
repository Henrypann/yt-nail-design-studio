import type { FingerCode } from '../../../lib/types.ts';
import { parseEditorDocV7 } from './schema.ts';
import { resolveEditorV7FingerScope, type EditorV7FingerScope, type EditorV7ScopeTarget } from './ten-finger-operations.ts';
import { isExactEditorGeometryV7, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from './geometry-registry.ts';
import { resolveExactFrenchGeometryInputV1 } from './french-geometry-input-v1.ts';
import { compileFrenchPathV1, type FrenchProjectedVectorShapeV1 } from './french-compiler-v1.ts';
import { FRENCH_RECIPE_ID_V1, FRENCH_RECIPE_REVISION_V1, parseFrenchRecipeInstanceV1, parseFrenchRecipeParametersV1, type FrenchRecipeParametersV1 } from './french-recipe-v1.ts';
import { inspectFrenchRecipeProjectionV1 } from './french-conversion-v1.ts';
import type { EditorDocV7, FlatDesignElementV7, ProcessStepV7, RecipeInstanceV7 } from './model.ts';
import type { EditorV7CommandFailure, EditorV7CommandResult } from './commands.ts';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry.ts';

export type FrenchIdFactory = (kind: 'step' | 'element' | 'recipe') => string;
export type FrenchCommandResult = EditorV7CommandResult;
type Found = { status: 'found'; step: Extract<ProcessStepV7, { kind: 'flat_design' }>; recipe: RecipeInstanceV7; index: number; ordinal: number };
type Managed = Found | { status: 'missing' } | { status: 'missing_ordinal' } | { status: 'ambiguous'; message: string };
function fail(reason: EditorV7CommandFailure, message: string): FrenchCommandResult { return { ok: false, reason, message }; }
function clone<T>(value: T): T { return structuredClone(value); }
function parseParams(raw: unknown): FrenchRecipeParametersV1 | null { const parsed = parseFrenchRecipeParametersV1(raw); return parsed.ok ? parsed.parameters : null; }
function ids(doc: EditorDocV7): Set<string> { const result = new Set(Object.keys(doc.recipeInstances)); for (const nail of Object.values(doc.nails)) for (const step of nail.steps) { result.add(step.id); if (step.kind === 'flat_design') step.elements.forEach((item) => result.add(item.id)); if (step.kind === 'dimensional_decoration') step.decorations.forEach((item) => result.add(item.id)); } return result; }
function inputGate(doc: EditorDocV7): FrenchCommandResult | null {
  const seen = new Set<string>(); const refs = new Map<string, Array<{ finger: FingerCode; step: Extract<ProcessStepV7, { kind: 'flat_design' }> }>>();
  const add = (id: string) => { if (seen.has(id)) return false; seen.add(id); return true; };
  for (const [finger, nail] of Object.entries(doc.nails) as Array<[FingerCode, EditorDocV7['nails'][FingerCode]]>) for (const step of nail.steps) {
    if (!add(step.id)) return fail('duplicate_id', `duplicate node ID ${step.id}`);
    if (step.recipeInstanceId && !doc.recipeInstances[step.recipeInstanceId]) return fail('invalid_value', `dangling recipe reference ${step.recipeInstanceId}`);
    if (step.recipeInstanceId && step.kind === 'flat_design') { const list = refs.get(step.recipeInstanceId) ?? []; list.push({ finger, step }); refs.set(step.recipeInstanceId, list); }
    if (step.kind === 'flat_design') for (const item of step.elements) if (!add(item.id)) return fail('duplicate_id', `duplicate node ID ${item.id}`);
    if (step.kind === 'dimensional_decoration') for (const item of step.decorations) if (!add(item.id)) return fail('duplicate_id', `duplicate node ID ${item.id}`);
  }
  for (const id of Object.keys(doc.recipeInstances)) if (seen.has(id)) return fail('duplicate_id', `recipe/node cross-domain collision ${id}`);
  for (const [recipeId, raw] of Object.entries(doc.recipeInstances)) {
    if (raw.recipeId !== FRENCH_RECIPE_ID_V1) continue;
    const entries = refs.get(recipeId) ?? [];
    const entry = entries[0];
    if (entries.length !== 1 || raw.recipeRevision !== FRENCH_RECIPE_REVISION_V1 || !parseFrenchRecipeInstanceV1(raw).ok || entry.step.visible !== true || entry.step.locked !== true || entry.step.skipped !== false || entry.step.elements.length < 1 || entry.step.elements.length > 2 || !inspectFrenchRecipeProjectionV1(doc, entry.finger, entry.step.id).ok) return fail('invalid_value', `French recipe ${recipeId} has malformed identity or projection`);
  }
  return null;
}
function fresh(factory: FrenchIdFactory, kind: 'step' | 'element' | 'recipe', used: Set<string>): string | null { try { const value = factory(kind); return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) && !used.has(value) ? (used.add(value), value) : null; } catch { return null; } }
function managed(doc: EditorDocV7, finger: FingerCode): Found[] { const result: Found[] = []; doc.nails[finger].steps.forEach((step, index) => { if (step.kind !== 'flat_design' || !step.recipeInstanceId) return; const raw = doc.recipeInstances[step.recipeInstanceId]; if (!raw || raw.recipeId !== FRENCH_RECIPE_ID_V1 || raw.recipeRevision !== FRENCH_RECIPE_REVISION_V1) return; const parsed = parseFrenchRecipeInstanceV1(raw); if (parsed.ok) result.push({ status: 'found', step, recipe: parsed.instance, index, ordinal: result.length }); }); return result; }
function identity(doc: EditorDocV7, finger: FingerCode, ordinal?: number): Managed { const malformed = doc.nails[finger].steps.find((step) => { if (!step.recipeInstanceId) return false; const raw = doc.recipeInstances[step.recipeInstanceId]; return raw?.recipeId === FRENCH_RECIPE_ID_V1 && (!raw || raw.recipeRevision !== FRENCH_RECIPE_REVISION_V1 || !parseFrenchRecipeInstanceV1(raw).ok); }); if (malformed) return { status: 'ambiguous', message: `${finger} contains a malformed French recipe identity` }; const values = managed(doc, finger); if (!values.length) return ordinal === undefined ? { status: 'missing' } : { status: 'missing_ordinal' }; const candidate: Found | undefined = ordinal === undefined ? (values.length === 1 ? values[0] : undefined) : values[ordinal]; if (!candidate) return ordinal !== undefined && ordinal >= values.length ? { status: 'missing_ordinal' } : { status: 'ambiguous', message: `${finger} has ambiguous French ordinal` }; const refs = Object.values(doc.nails).flatMap((nail) => nail.steps.filter((step) => step.recipeInstanceId === candidate.recipe.instanceId)); if (refs.length !== 1 || candidate.step.visible !== true || candidate.step.locked !== true || candidate.step.skipped !== false || candidate.step.elements.length < 1 || candidate.step.elements.length > 2 || !inspectFrenchRecipeProjectionV1(doc, finger, candidate.step.id).ok) return { status: 'ambiguous', message: `${finger} French identity/projection is invalid` }; return candidate; }
function targets(scope: EditorV7FingerScope): readonly EditorV7ScopeTarget[] | FrenchCommandResult { const result = resolveEditorV7FingerScope(scope); return result.ok ? result.targets : fail('invalid_value', result.reason === 'empty_scope' ? 'selected scope is empty' : 'invalid finger scope'); }
function projection(doc: EditorDocV7, target: EditorV7ScopeTarget, raw: FrenchRecipeParametersV1) { const nail = doc.nails[target.finger]; if (!nail || !isExactEditorGeometryV7(nail.geometryRef, target.finger)) return { ok: false as const, error: fail('geometry_unavailable', `${target.finger} geometry is not exact`) }; const resolved = resolveExactFrenchGeometryInputV1(nail.geometryRef, target.finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7); if (!resolved.ok) return { ok: false as const, error: fail('geometry_unavailable', resolved.diagnostics.map((item) => item.message).join('; ')) }; const mirrored = target.projection === 'mirror-x' ? { ...raw, leftWingV: raw.rightWingV, rightWingV: raw.leftWingV, balanceLocked: raw.balanceLocked && raw.leftWingV === raw.rightWingV } : raw; const params = parseParams(mirrored); if (!params) return { ok: false as const, error: fail('invalid_value', 'target French parameters failed strict parsing') }; const compiled = compileFrenchPathV1(resolved.geometry, params); return compiled.ok ? { ok: true as const, params, compiled } : { ok: false as const, error: fail('invalid_value', compiled.diagnostics.map((item) => item.message).join('; ')) }; }
function element(id: string, source: FrenchProjectedVectorShapeV1): FlatDesignElementV7 { return { id, kind: 'vector_shape', visible: true, locked: true, opacity: source.opacity, transform: clone(source.transform), pathData: source.pathData, ...(source.fill ? { fill: clone(source.fill) } : {}), ...(source.stroke ? { stroke: clone(source.stroke) } : {}), ...(source.strokeWidthMm === undefined ? {} : { strokeWidthMm: source.strokeWidthMm }) }; }
function validate(doc: EditorDocV7): FrenchCommandResult { const parsed = parseEditorDocV7(doc); return parsed.ok ? { ok: true, doc: parsed.doc } : fail('invalid_document', parsed.reason); }
function identityByStepId(doc: EditorDocV7, finger: FingerCode, stepId: string): Found | null { const candidate = managed(doc, finger).find((item) => item.step.id === stepId); if (!candidate) return null; const checked = identity(doc, finger, candidate.ordinal); return checked.status === 'found' && checked.step.id === stepId ? checked : null; }
function ordinalOf(doc: EditorDocV7, finger: FingerCode, stepId: string): number | null { const found = identityByStepId(doc, finger, stepId); return found ? found.ordinal : null; }

export function createFrenchRecipeCommand(doc: EditorDocV7, scope: EditorV7FingerScope, raw: FrenchRecipeParametersV1, factory: FrenchIdFactory): FrenchCommandResult {
  const gate = inputGate(doc); if (gate) return gate;
  const resolved = targets(scope); if ('ok' in resolved) return resolved; const params = parseParams(raw); if (!params) return fail('invalid_value', 'French parameters failed strict parsing'); const used = ids(doc); const plan = [] as Array<{ target: EditorV7ScopeTarget; params: FrenchRecipeParametersV1; compiled: Extract<ReturnType<typeof compileFrenchPathV1>, { ok: true }>; recipeId: string; stepId: string; fillId: string; outlineId?: string }>;
  for (const target of resolved) { const compiled = projection(doc, target, params); if (!compiled.ok) return compiled.error; const recipeId = fresh(factory, 'recipe', used); const stepId = fresh(factory, 'step', used); const fillId = fresh(factory, 'element', used); const outlineId = compiled.compiled.projection.outline ? (fresh(factory, 'element', used) ?? undefined) : undefined; if (!recipeId || !stepId || !fillId || (compiled.compiled.projection.outline && !outlineId)) return fail('duplicate_id', 'generated French ID is invalid or collides'); plan.push({ target, params: compiled.params, compiled: compiled.compiled, recipeId, stepId, fillId, outlineId }); }
  const next = clone(doc); let selectedStepId: string | undefined; let selectedElementId: string | undefined; for (const item of plan) { const step: ProcessStepV7 = { id: item.stepId, typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: '法式（结构化配方）', visible: true, locked: true, skipped: false, recipeInstanceId: item.recipeId, materialRefs: [], elements: [element(item.fillId, item.compiled.projection.fill), ...(item.compiled.projection.outline && item.outlineId ? [element(item.outlineId, item.compiled.projection.outline)] : [])] }; const nail = next.nails[item.target.finger]; const index = nail.steps.findIndex((candidate) => candidate.kind === 'surface_finish'); nail.steps.splice(index < 0 ? nail.steps.length : index, 0, step); next.recipeInstances[item.recipeId] = { instanceId: item.recipeId, recipeId: FRENCH_RECIPE_ID_V1, recipeRevision: FRENCH_RECIPE_REVISION_V1, parameterValues: { ...item.params } }; if (item.target.finger === scope.currentFinger) { selectedStepId = item.stepId; selectedElementId = item.fillId; } } const result = validate(next); return result.ok ? { ...result, ...(selectedStepId ? { selectedStepId } : {}), ...(selectedElementId ? { selectedElementId } : {}) } : result;
}
export function updateFrenchRecipeCommand(doc: EditorDocV7, scope: EditorV7FingerScope, raw: FrenchRecipeParametersV1, sourceFinger: FingerCode, sourceStepId: string, factory: FrenchIdFactory): FrenchCommandResult {
  const gate = inputGate(doc); if (gate) return gate;
  const resolved = targets(scope); if ('ok' in resolved) return resolved;
  const params = parseParams(raw); if (!params) return fail('invalid_value', 'French parameters failed strict parsing');
  const sourceIdentity = identityByStepId(doc, sourceFinger, sourceStepId); if (!sourceIdentity) return fail('invalid_value', 'source French step identity is invalid');
  const used = ids(doc); const plan: Array<{ target: EditorV7ScopeTarget; source: Found | null; params: FrenchRecipeParametersV1; compiled: Extract<ReturnType<typeof compileFrenchPathV1>, { ok: true }>; recipeId?: string; stepId?: string; fillId?: string; outlineId?: string }> = [];
  for (const target of resolved) {
    const source = identity(doc, target.finger, sourceIdentity.ordinal);
    if (source.status === 'ambiguous') return fail('invalid_value', source.message);
    const compiled = projection(doc, target, params); if (!compiled.ok) return compiled.error;
    if (source.status === 'found') {
      if (source.step.elements.length !== (compiled.compiled.projection.outline ? 2 : 1)) return fail('invalid_value', `${target.finger} projection element count drifted`);
      plan.push({ target, source, params: compiled.params, compiled: compiled.compiled });
    } else {
      const recipeId = fresh(factory, 'recipe', used); const stepId = fresh(factory, 'step', used); const fillId = fresh(factory, 'element', used); const outlineId = compiled.compiled.projection.outline ? (fresh(factory, 'element', used) ?? undefined) : undefined;
      if (!recipeId || !stepId || !fillId || (compiled.compiled.projection.outline && !outlineId)) return fail('duplicate_id', 'generated detached French ID is invalid or collides');
      plan.push({ target, source: null, params: compiled.params, compiled: compiled.compiled, recipeId, stepId, fillId, outlineId });
    }
  }
  const next = clone(doc);
  for (const item of plan) {
    if (item.source) {
      const step = next.nails[item.target.finger].steps[item.source.index]; if (step.kind !== 'flat_design') return fail('invalid_value', 'source step changed during transaction');
      step.elements = [element(step.elements[0].id, item.compiled.projection.fill), ...(item.compiled.projection.outline ? [element(step.elements[1].id, item.compiled.projection.outline)] : [])]; next.recipeInstances[step.recipeInstanceId!].parameterValues = { ...item.params };
    } else {
      const step: ProcessStepV7 = { id: item.stepId!, typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: '法式（结构化配方）', visible: true, locked: true, skipped: false, recipeInstanceId: item.recipeId!, materialRefs: [], elements: [element(item.fillId!, item.compiled.projection.fill), ...(item.compiled.projection.outline && item.outlineId ? [element(item.outlineId, item.compiled.projection.outline)] : [])] };
      const nail = next.nails[item.target.finger]; const index = nail.steps.findIndex((candidate) => candidate.kind === 'surface_finish'); nail.steps.splice(index < 0 ? nail.steps.length : index, 0, step); next.recipeInstances[item.recipeId!] = { instanceId: item.recipeId!, recipeId: FRENCH_RECIPE_ID_V1, recipeRevision: FRENCH_RECIPE_REVISION_V1, parameterValues: { ...item.params } };
    }
  }
  return validate(next);
}
export function deleteFrenchRecipeCommand(doc: EditorDocV7, scope: EditorV7FingerScope, sourceFinger: FingerCode, sourceStepId: string): FrenchCommandResult {
  const gate = inputGate(doc); if (gate) return gate;
  const resolved = targets(scope); if ('ok' in resolved) return resolved; const ordinal = ordinalOf(doc, sourceFinger, sourceStepId); if (ordinal === null) return fail('not_found', 'sourceStepId is not a managed French step'); const plan: Array<{ target: EditorV7ScopeTarget; source: Found }> = []; for (const target of resolved) { const source = identity(doc, target.finger, ordinal); if (source.status !== 'found') return fail('invalid_value', source.status === 'missing' || source.status === 'missing_ordinal' ? `${target.finger} French ordinal is missing` : source.message); plan.push({ target, source }); } const refs = new Map<string, number>(); for (const nail of Object.values(doc.nails)) for (const step of nail.steps) if (step.recipeInstanceId) refs.set(step.recipeInstanceId, (refs.get(step.recipeInstanceId) ?? 0) + 1); const next = clone(doc); for (const item of plan) { const recipeId = item.source.recipe.instanceId; if ((refs.get(recipeId) ?? 0) !== 1) return fail('invalid_value', `${recipeId} is shared or dangling`); next.nails[item.target.finger].steps.splice(item.source.index, 1); delete next.recipeInstances[recipeId]; } return validate(next);
}
