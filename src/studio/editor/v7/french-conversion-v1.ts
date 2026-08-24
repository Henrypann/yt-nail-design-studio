/**
 * Explicit, fail-closed conversion of a legacy V7 `french_edge` element.
 *
 * The legacy payload is retained as inert evidence.  A caller must provide
 * already validated recipe parameters; this module never infers a preset or
 * recipe anchors from widthRatio/curvature.
 */
import type { FingerCode } from '../../../lib/types.ts';
import type { EditorDocV7, FlatDesignElementV7, NailDesignV7, ProcessStepV7, RgbaColorV7, Transform2DV7 } from './model.ts';
import { parseEditorDocV7 } from './schema.ts';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry.ts';
import { IDENTITY_TRANSFORM_V7 } from './flat-vector.ts';
import {
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_REVISION_V1,
  parseFrenchRecipeInstanceV1,
  parseFrenchRecipeParametersV1,
  type FrenchRecipeParametersV1,
} from './french-recipe-v1.ts';
import { compileFrenchPathV1, type FrenchPathDiagnosticV1 } from './french-compiler-v1.ts';
import { previewFrenchLegacyConversionV1 } from './french-migration-v1.ts';
import { rebindFrenchExactGeometryToCanonicalRegistryV1, resolveExactFrenchGeometryInputV1 } from './french-geometry-input-v1.ts';
import type { FrenchExactGeometryV1 } from './french-geometry-input-v1.ts';
import { PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from './geometry-registry.ts';

export interface FrenchLegacyConversionInputV1 {
  doc: EditorDocV7;
  finger: FingerCode;
  sourceStepId: string;
  sourceElementId: string;
  /** Explicit, strictly parsed parameters. Never derive these from legacy fields. */
  parameters: FrenchRecipeParametersV1;
  geometry: FrenchExactGeometryV1;
  recipeInstanceId: string;
  stepId: string;
  fillElementId: string;
  outlineElementId?: string;
}

export interface FrenchConversionDiagnosticV1 {
  code: string;
  path: string;
  message: string;
}

export type FrenchLegacyConversionResultV1 =
  | { ok: true; doc: EditorDocV7; recipeInstanceId: string; stepId: string; fillElementId: string; outlineElementId?: string; diagnostics: FrenchConversionDiagnosticV1[] }
  | { ok: false; diagnostics: FrenchConversionDiagnosticV1[] };

export type FrenchProjectionInspectionResultV1 =
  | { ok: true; diagnostics: FrenchConversionDiagnosticV1[] }
  | { ok: false; diagnostics: FrenchConversionDiagnosticV1[] };

// Keep this synchronized with EditorDocV7 schema ID_PATTERN (max 128, ':' allowed).
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function diagnostic(code: string, path: string, message: string): FrenchConversionDiagnosticV1 {
  return { code, path, message };
}

function findSource(nail: NailDesignV7, stepId: string, elementId: string): { step: Extract<ProcessStepV7, { kind: 'flat_design' }>; stepIndex: number; element: Extract<FlatDesignElementV7, { kind: 'french_edge' }>; elementIndex: number } | null {
  const stepIndex = nail.steps.findIndex((step) => step.id === stepId);
  const step = nail.steps[stepIndex];
  if (!step || step.kind !== 'flat_design') return null;
  const elementIndex = step.elements.findIndex((element) => element.id === elementId);
  const element = step.elements[elementIndex];
  return element?.kind === 'french_edge' ? { step, stepIndex, element, elementIndex } : null;
}

function vectorElement(id: string, pathData: string, opacity: number, fill?: RgbaColorV7, stroke?: RgbaColorV7, strokeWidthMm?: number): FlatDesignElementV7 {
  const result: Extract<FlatDesignElementV7, { kind: 'vector_shape' }> = {
    id, kind: 'vector_shape', visible: true, locked: true, opacity,
    transform: structuredClone(IDENTITY_TRANSFORM_V7), pathData,
  };
  if (fill) result.fill = structuredClone(fill);
  if (stroke) result.stroke = structuredClone(stroke);
  if (strokeWidthMm !== undefined) result.strokeWidthMm = strokeWidthMm;
  return result;
}

function stepIds(doc: EditorDocV7): Set<string> {
  const ids = new Set<string>();
  for (const nail of Object.values(doc.nails)) for (const step of nail.steps) {
    ids.add(step.id);
    if (step.kind === 'flat_design') for (const element of step.elements) ids.add(element.id);
    if (step.kind === 'dimensional_decoration') for (const element of step.decorations) ids.add(element.id);
  }
  return ids;
}

function recipeIds(doc: EditorDocV7): Set<string> {
  return new Set(Object.keys(doc.recipeInstances));
}

function validateGeometryForDoc(doc: EditorDocV7, finger: FingerCode, geometry: FrenchExactGeometryV1): FrenchConversionDiagnosticV1[] {
  const nail = doc.nails[finger];
  const diagnostics: FrenchConversionDiagnosticV1[] = [];
  if (!nail) return [diagnostic('missing_finger', 'finger', 'target finger is not present')];
  if (geometry.finger !== finger) diagnostics.push(diagnostic('geometry_mismatch', 'geometry.finger', 'geometry finger must equal conversion finger'));
  if (geometry.assetId !== nail.geometryRef.assetId) diagnostics.push(diagnostic('geometry_mismatch', 'geometry.assetId', 'geometry asset must equal current document geometry asset'));
  if (geometry.revision !== nail.geometryRef.revision) diagnostics.push(diagnostic('geometry_mismatch', 'geometry.revision', 'geometry revision must equal current document geometry revision'));
  const rebound = rebindFrenchExactGeometryToCanonicalRegistryV1(geometry);
  if (!rebound.ok) diagnostics.push(...rebound.diagnostics.map((item) => diagnostic(item.code, item.path, item.message)));
  return diagnostics;
}

function safeIds(input: FrenchLegacyConversionInputV1): FrenchConversionDiagnosticV1[] {
  const values = [input.recipeInstanceId, input.stepId, input.fillElementId, input.outlineElementId].filter((value): value is string => value !== undefined);
  const diagnostics: FrenchConversionDiagnosticV1[] = [];
  values.forEach((value, index) => { if (!ID.test(value)) diagnostics.push(diagnostic('invalid_id', `ids[${index}]`, 'conversion IDs must be stable V7 IDs')); });
  if (new Set(values).size !== values.length) diagnostics.push(diagnostic('duplicate_id', 'ids', 'conversion IDs must be unique'));
  return diagnostics;
}

export function convertLegacyFrenchEdgeToRecipeV1(input: FrenchLegacyConversionInputV1): FrenchLegacyConversionResultV1 {
  const diagnostics = safeIds(input);
  const nail = input.doc.nails[input.finger];
  if (!nail) diagnostics.push(diagnostic('missing_finger', 'finger', 'target finger is not present'));
  const source = nail ? findSource(nail, input.sourceStepId, input.sourceElementId) : null;
  if (!source) diagnostics.push(diagnostic('invalid_source', 'sourceStepId', 'source must be a flat_design french_edge element'));
  if (source) {
    if (!source.step.visible || source.step.locked || source.step.skipped) diagnostics.push(diagnostic('source_uneditable', 'sourceStep', 'source step must be visible, unlocked, and not skipped'));
    if (!source.element.visible || source.element.locked) diagnostics.push(diagnostic('source_uneditable', 'sourceElement', 'source element must be visible and unlocked'));
    const preview = previewFrenchLegacyConversionV1(source.element, { sourceId: source.element.id, path: `nails.${input.finger}.steps.${input.sourceStepId}.elements.${input.sourceElementId}` });
    if (preview.family !== 'v7_simple' || preview.status !== 'approximate') diagnostics.push(diagnostic('invalid_legacy', 'sourceElement', 'only an approximate V7 simple french_edge may enter explicit conversion'));
  }
  const parsedParameters = parseFrenchRecipeParametersV1(input.parameters);
  if (!parsedParameters.ok) diagnostics.push(...parsedParameters.diagnostics.map((item) => diagnostic(item.code, `parameters.${item.path}`, item.message)));
  if (parsedParameters.ok && parsedParameters.parameters.outlineEnabled && !input.outlineElementId) diagnostics.push(diagnostic('missing_id', 'outlineElementId', 'outline-enabled conversion requires a dedicated outline element ID'));
  if (input.doc.recipeInstances[input.recipeInstanceId]) diagnostics.push(diagnostic('duplicate_id', 'recipeInstanceId', 'recipe instance ID already exists'));
  const ids = stepIds(input.doc);
  const recipeKeys = recipeIds(input.doc);
  [input.stepId, input.fillElementId, input.outlineElementId].forEach((id, index) => {
    if (id && ids.has(id)) diagnostics.push(diagnostic('duplicate_id', `ids[${index + 1}]`, 'step or element ID already exists in document'));
    if (id && recipeKeys.has(id)) diagnostics.push(diagnostic('cross_domain_id', `ids[${index + 1}]`, 'node ID collides with an existing recipe instance key'));
  });
  ids.forEach((id) => { if (recipeKeys.has(id)) diagnostics.push(diagnostic('cross_domain_id', 'document', 'existing node ID collides with a recipe instance key')); });
  if (recipeKeys.has(input.recipeInstanceId) || ids.has(input.recipeInstanceId)) diagnostics.push(diagnostic('cross_domain_id', 'recipeInstanceId', 'recipe ID collides with a node ID or recipe key'));
  diagnostics.push(...validateGeometryForDoc(input.doc, input.finger, input.geometry));
  const compiled = parsedParameters.ok && diagnostics.length === 0 ? compileFrenchPathV1(input.geometry, parsedParameters.parameters) : null;
  if (!compiled?.ok) diagnostics.push(...(compiled?.diagnostics ?? [diagnostic('compile_failed', 'geometry', 'French compiler did not run')] as FrenchPathDiagnosticV1[]).map((item) => diagnostic(item.code, item.path, item.message)));
  if (diagnostics.length > 0 || !source || !parsedParameters.ok || !compiled?.ok || !nail) return { ok: false, diagnostics };

  const next = structuredClone(input.doc);
  const targetNail = next.nails[input.finger];
  const targetSource = targetNail.steps[source.stepIndex];
  if (targetSource.kind !== 'flat_design') return { ok: false, diagnostics: [diagnostic('invalid_source', 'sourceStepId', 'source changed during conversion')] };
  const evidence = targetSource.elements[source.elementIndex];
  if (evidence?.kind !== 'french_edge') return { ok: false, diagnostics: [diagnostic('invalid_source', 'sourceElementId', 'source changed during conversion')] };
  evidence.visible = false;
  evidence.locked = true;
  const recipe = {
    instanceId: input.recipeInstanceId,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    parameterValues: { ...parsedParameters.parameters },
  };
  const parsedRecipe = parseFrenchRecipeInstanceV1(recipe);
  if (!parsedRecipe.ok) return { ok: false, diagnostics: parsedRecipe.diagnostics.map((item) => diagnostic(item.code, item.path, item.message)) };
  const projection = compiled.projection;
  const elements: FlatDesignElementV7[] = [vectorElement(input.fillElementId, projection.fill.pathData, projection.fill.opacity, projection.fill.fill, projection.fill.stroke, projection.fill.strokeWidthMm)];
  if (projection.outline) elements.push(vectorElement(input.outlineElementId!, projection.outline.pathData, projection.outline.opacity, projection.outline.fill, projection.outline.stroke, projection.outline.strokeWidthMm));
  const managedStep: ProcessStepV7 = {
    id: input.stepId, typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: '法式（配方投影）', visible: true, locked: true, skipped: false,
    recipeInstanceId: input.recipeInstanceId, materialRefs: [], elements,
  };
  targetNail.steps.splice(source.stepIndex + 1, 0, managedStep);
  next.recipeInstances[input.recipeInstanceId] = parsedRecipe.instance;
  const parsedDoc = parseEditorDocV7(next);
  if (!parsedDoc.ok) return { ok: false, diagnostics: [diagnostic('invalid_document', '$', parsedDoc.reason)] };
  return { ok: true, doc: parsedDoc.doc, recipeInstanceId: input.recipeInstanceId, stepId: input.stepId, fillElementId: input.fillElementId, ...(projection.outline ? { outlineElementId: input.outlineElementId } : {}), diagnostics: [] };
}

function sameTransform(a: Transform2DV7, b: Transform2DV7): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Recompiles the recipe and checks that its locked projection has not drifted. */
export function inspectFrenchRecipeProjectionV1(doc: EditorDocV7, finger: FingerCode, stepId: string, suppliedGeometry?: FrenchExactGeometryV1): FrenchProjectionInspectionResultV1 {
  const diagnostics: FrenchConversionDiagnosticV1[] = [];
  const nail = doc.nails[finger];
  const step = nail?.steps.find((item) => item.id === stepId);
  if (!step || step.kind !== 'flat_design') diagnostics.push(diagnostic('missing_step', 'stepId', 'managed French step must be flat_design'));
  if (!step || !step.recipeInstanceId) diagnostics.push(diagnostic('missing_recipe', 'recipeInstanceId', 'managed French step must reference a recipe instance'));
  if (step && (step.visible !== true || step.locked !== true || step.skipped !== false)) diagnostics.push(diagnostic('managed_step_flags', 'step', 'managed French step must be visible, locked, and not skipped'));
  if (step?.recipeInstanceId) {
    const references = Object.values(doc.nails).flatMap((item) => item.steps.filter((candidate) => candidate.recipeInstanceId === step.recipeInstanceId));
    if (references.length !== 1) diagnostics.push(diagnostic('ambiguous_recipe_reference', 'recipeInstanceId', 'recipe must be referenced by exactly one managed step'));
  }
  const parsed = step?.recipeInstanceId ? parseFrenchRecipeInstanceV1(doc.recipeInstances[step.recipeInstanceId]) : null;
  if (parsed && !parsed.ok) diagnostics.push(...parsed.diagnostics.map((item) => diagnostic(item.code, item.path, item.message)));
  const resolved = resolveExactFrenchGeometryInputV1(doc.nails[finger]?.geometryRef, finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  if (!resolved.ok) diagnostics.push(...resolved.diagnostics.map((item) => diagnostic(item.code, item.path, item.message)));
  if (suppliedGeometry) diagnostics.push(...validateGeometryForDoc(doc, finger, suppliedGeometry));
  const compiled = parsed?.ok && resolved.ok && diagnostics.length === 0 ? compileFrenchPathV1(resolved.geometry, parsed.parameters) : null;
  if (!compiled?.ok) diagnostics.push(...(compiled?.diagnostics ?? []).map((item) => diagnostic(item.code, item.path, item.message)));
  if (step?.kind === 'flat_design' && compiled?.ok) {
    const expected = [compiled.projection.fill, ...(compiled.projection.outline ? [compiled.projection.outline] : [])];
    if (step.elements.length !== expected.length) diagnostics.push(diagnostic('projection_drift', 'elements', 'managed step must contain exactly fill and optional outline'));
    expected.forEach((want, index) => {
      const actual = step.elements[index];
      if (!actual || actual.kind !== 'vector_shape') { diagnostics.push(diagnostic('projection_drift', `elements[${index}]`, 'managed projection must be vector_shape')); return; }
      if (!actual.locked || !actual.visible || actual.pathData !== want.pathData || actual.opacity !== want.opacity || !sameTransform(actual.transform, want.transform)
        || JSON.stringify(actual.fill) !== JSON.stringify(want.fill) || JSON.stringify(actual.stroke) !== JSON.stringify(want.stroke) || actual.strokeWidthMm !== want.strokeWidthMm) {
        diagnostics.push(diagnostic('projection_drift', `elements[${index}]`, 'locked projection differs from current recipe compiler output'));
      }
    });
  }
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, diagnostics: [] };
}
