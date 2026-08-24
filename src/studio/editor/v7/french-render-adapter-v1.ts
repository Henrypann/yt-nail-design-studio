import type { FingerCode } from '../../../lib/types.ts';
import { compileFrenchPathV1, type FrenchVectorProjectionV1 } from './french-compiler-v1.ts';
import { resolveExactFrenchGeometryInputV1 } from './french-geometry-input-v1.ts';
import { PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from './geometry-registry.ts';
import { FRENCH_RECIPE_ID_V1, FRENCH_RECIPE_REVISION_V1, parseFrenchRecipeInstanceV1 } from './french-recipe-v1.ts';
import type { EditorDocV7, NailDesignV7, ProcessStepV7, RecipeInstanceV7 } from './model.ts';

export type FrenchRenderAdapterResultV1 =
  | { status: 'passthrough'; consumer: FrenchRenderConsumerV1; step: Extract<ProcessStepV7, { kind: 'flat_design' }> }
  | { status: 'structured'; consumer: FrenchRenderConsumerV1; step: Extract<ProcessStepV7, { kind: 'flat_design' }>; cacheIdentity: string; bindingKey: string; fidelity: 'exact-source-derived'; manufacturingValidated: false; diagnostics: readonly string[] }
  | { status: 'unavailable'; consumer: FrenchRenderConsumerV1; step: Extract<ProcessStepV7, { kind: 'flat_design' }>; diagnostics: readonly string[]; fidelity: 'unavailable'; manufacturingValidated: false };

export type FrenchRenderConsumerV1 = 'editor-flat' | 'finish-composite' | 'customer-preview' | 'pbr-material';

function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function projectionMatches(step: Extract<ProcessStepV7, { kind: 'flat_design' }>, projection: FrenchVectorProjectionV1): boolean {
  const expected = [projection.fill, ...(projection.outline ? [projection.outline] : [])];
  if (step.elements.length !== expected.length) return false;
  return expected.every((want, index) => { const actual = step.elements[index]; return actual?.kind === 'vector_shape' && actual.visible === true && actual.locked === true && actual.pathData === want.pathData && actual.opacity === want.opacity && same(actual.transform, want.transform) && same(actual.fill, want.fill) && same(actual.stroke, want.stroke) && actual.strokeWidthMm === want.strokeWidthMm; });
}

export function adaptFrenchFlatStepV1(input: { consumer: FrenchRenderConsumerV1; finger: FingerCode; nail: NailDesignV7; step: Extract<ProcessStepV7, { kind: 'flat_design' }>; recipeInstances: Record<string, RecipeInstanceV7>; allNails?: EditorDocV7['nails'] }): FrenchRenderAdapterResultV1 {
  const { consumer, finger, nail, step, recipeInstances, allNails } = input;
  if (!step.recipeInstanceId) return { status: 'passthrough', consumer, step };
  const raw = recipeInstances[step.recipeInstanceId];
  const fail = (diagnostic: string): FrenchRenderAdapterResultV1 => ({ status: 'unavailable', consumer, step, diagnostics: [diagnostic], fidelity: 'unavailable', manufacturingValidated: false });
  if (!raw) return fail('Referenced recipe instance is missing');
  if (raw.recipeId !== FRENCH_RECIPE_ID_V1) return { status: 'passthrough', consumer, step };
  if (raw.instanceId !== step.recipeInstanceId) return fail('French recipe key and instance identity differ');
  if (raw.recipeRevision !== FRENCH_RECIPE_REVISION_V1) return fail('French recipe revision is unsupported');
  const parsed = parseFrenchRecipeInstanceV1(raw); if (!parsed.ok) return fail(`French recipe parameters invalid: ${parsed.diagnostics.map((item) => item.path).join(', ')}`);
  if (step.visible !== true || step.locked !== true || step.skipped !== false) return fail('French managed step flags are invalid');
  if (!allNails) return fail('French recipe reference context is unavailable');
  const refs = Object.values(allNails).flatMap((candidate) => candidate.steps.filter((candidateStep) => candidateStep.recipeInstanceId === step.recipeInstanceId));
  if (refs.length !== 1 || refs[0].id !== step.id) return fail('French recipe reference is shared or ambiguous');
  const geometry = resolveExactFrenchGeometryInputV1(nail.geometryRef, finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7); if (!geometry.ok) return fail(`French geometry unavailable: ${geometry.diagnostics.map((item) => item.code).join(', ')}`);
  const compiled = compileFrenchPathV1(geometry.geometry, parsed.parameters); if (!compiled.ok) return fail(`French compiler unavailable: ${compiled.diagnostics.map((item) => item.code).join(', ')}`);
  if (!projectionMatches(step, compiled.projection)) return fail('French stored projection drifted from compiler output');
  const virtualStep = structuredClone(step);
  virtualStep.elements = [compiled.projection.fill, ...(compiled.projection.outline ? [compiled.projection.outline] : [])].map((projection, index) => ({ ...projection, id: step.elements[index].id }));
  return { status: 'structured', consumer, step: virtualStep, cacheIdentity: compiled.cacheIdentity.cacheKey, bindingKey: compiled.cacheIdentity.bindingKey, fidelity: 'exact-source-derived', manufacturingValidated: false, diagnostics: [] };
}

/** Adapter-level parity helper for tests and consumers that already hold a full doc. */
export function adaptFrenchFlatStepFromDocV1(doc: EditorDocV7, finger: FingerCode, step: Extract<ProcessStepV7, { kind: 'flat_design' }>, consumer: FrenchRenderConsumerV1): FrenchRenderAdapterResultV1 { return adaptFrenchFlatStepV1({ consumer, finger, nail: doc.nails[finger], step, recipeInstances: doc.recipeInstances, allNails: doc.nails }); }

export function isStructuredFrenchAdapterResultV1(result: FrenchRenderAdapterResultV1): result is Extract<FrenchRenderAdapterResultV1, { status: 'structured' }> { return result.status === 'structured'; }
