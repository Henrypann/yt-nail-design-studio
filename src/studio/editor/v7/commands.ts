import type { FingerCode } from '../../../lib/types';
import type {
  DimensionalDecorationV7,
  EditorDocV7,
  FlatDesignElementV7,
  ProcessStepV7,
  RegionMaskV7,
  SurfaceEffectPayloadV7,
  Transform2DV7,
} from './model';
import { getProcessStepTypeDefinitionV7 } from './registry';
import { parseEditorDocV7 } from './schema';
import type { EditorV7IdFactory } from './id';

export type EditorV7CommandFailure =
  | 'missing_document'
  | 'read_only'
  | 'not_found'
  | 'locked'
  | 'not_allowed'
  | 'invalid_position'
  | 'invalid_value'
  | 'duplicate_id'
  | 'invalid_document';

export type EditorV7CommandResult =
  | { ok: true; doc: EditorDocV7; selectedStepId?: string; selectedElementId?: string }
  | { ok: false; reason: EditorV7CommandFailure; message: string };

export type EditorV7Element = FlatDesignElementV7 | DimensionalDecorationV7;

function reject(reason: EditorV7CommandFailure, message: string): EditorV7CommandResult {
  return { ok: false, reason, message };
}

function validate(next: EditorDocV7): EditorV7CommandResult {
  const parsed = parseEditorDocV7(next);
  return parsed.ok
    ? { ok: true, doc: parsed.doc }
    : reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
}

function findStep(doc: EditorDocV7, finger: FingerCode, stepId: string) {
  const steps = doc.nails[finger].steps;
  const index = steps.findIndex((step) => step.id === stepId);
  return { steps, index, step: index >= 0 ? steps[index] : undefined };
}

function allNodeIds(doc: EditorDocV7): Set<string> {
  const ids = new Set<string>();
  for (const nail of Object.values(doc.nails)) {
    for (const step of nail.steps) {
      ids.add(step.id);
      if (step.kind === 'flat_design') step.elements.forEach((element) => ids.add(element.id));
      if (step.kind === 'dimensional_decoration') step.decorations.forEach((element) => ids.add(element.id));
    }
  }
  return ids;
}

function nodeIdsInStep(step: ProcessStepV7): string[] {
  return [
    step.id,
    ...(step.kind === 'flat_design' ? step.elements.map((item) => item.id) : []),
    ...(step.kind === 'dimensional_decoration' ? step.decorations.map((item) => item.id) : []),
  ];
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function cloneStepWithFreshIds(step: ProcessStepV7, idFactory: EditorV7IdFactory): ProcessStepV7 {
  const copy = structuredClone(step);
  copy.id = idFactory('step');
  copy.name = `${copy.name} (副本)`;
  if (copy.kind === 'flat_design') {
    copy.elements = copy.elements.map((element) => ({ ...element, id: idFactory('element') }));
  }
  if (copy.kind === 'dimensional_decoration') {
    copy.decorations = copy.decorations.map((element) => ({ ...element, id: idFactory('element') }));
  }
  return copy;
}

export function addEditorV7Step(
  doc: EditorDocV7,
  finger: FingerCode,
  step: ProcessStepV7,
  index: number,
): EditorV7CommandResult {
  const definition = getProcessStepTypeDefinitionV7(step.typeId);
  if (!definition || definition.kind !== step.kind || !definition.repeatable) {
    return reject('not_allowed', 'only registered repeatable middle steps may be inserted');
  }
  const steps = doc.nails[finger].steps;
  if (!Number.isInteger(index) || index < 1 || index >= steps.length) {
    return reject('invalid_position', 'step must be inserted between background and finish');
  }
  const incomingIds = nodeIdsInStep(step);
  const existingIds = allNodeIds(doc);
  if (hasDuplicate(incomingIds) || incomingIds.some((id) => existingIds.has(id))) {
    return reject('duplicate_id', 'step or nested element ID already exists');
  }
  const next = structuredClone(doc);
  next.nails[finger].steps.splice(index, 0, structuredClone(step));
  const result = validate(next);
  return result.ok ? { ...result, selectedStepId: step.id } : result;
}

export function deleteEditorV7Step(doc: EditorDocV7, finger: FingerCode, stepId: string): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  const definition = getProcessStepTypeDefinitionV7(found.step.typeId);
  if (!definition?.deletable) return reject('not_allowed', 'step cannot be deleted');
  if (found.step.locked) return reject('locked', 'step is locked');
  const next = structuredClone(doc);
  next.nails[finger].steps.splice(found.index, 1);
  return validate(next);
}

export function moveEditorV7Step(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  targetIndex: number,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (!getProcessStepTypeDefinitionV7(found.step.typeId)?.movable) return reject('not_allowed', 'step cannot move');
  if (found.step.locked) return reject('locked', 'step is locked');
  if (!Number.isInteger(targetIndex) || targetIndex < 1 || targetIndex >= found.steps.length - 1) {
    return reject('invalid_position', 'target must remain between background and finish');
  }
  if (targetIndex === found.index) return reject('invalid_position', 'step is already at target');
  const next = structuredClone(doc);
  const steps = next.nails[finger].steps;
  const [moving] = steps.splice(found.index, 1);
  steps.splice(targetIndex, 0, moving);
  return validate(next);
}

export function duplicateEditorV7Step(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  idFactory: EditorV7IdFactory,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (!getProcessStepTypeDefinitionV7(found.step.typeId)?.duplicable) return reject('not_allowed', 'step cannot duplicate');
  if (found.step.locked) return reject('locked', 'step is locked');
  const copy = cloneStepWithFreshIds(found.step, idFactory);
  const copiedIds = nodeIdsInStep(copy);
  if (hasDuplicate(copiedIds) || copiedIds.some((id) => allNodeIds(doc).has(id))) {
    return reject('duplicate_id', 'generated ID already exists');
  }
  const next = structuredClone(doc);
  next.nails[finger].steps.splice(found.index + 1, 0, copy);
  const result = validate(next);
  return result.ok ? { ...result, selectedStepId: copy.id } : result;
}

export function setEditorV7StepFlag(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  flag: 'visible' | 'locked' | 'skipped',
  value: boolean,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  const definition = getProcessStepTypeDefinitionV7(found.step.typeId);
  if (flag !== 'locked' && found.step.locked) return reject('locked', 'step is locked');
  if (flag === 'skipped' && !definition?.skippable) return reject('not_allowed', 'step cannot be skipped');
  if (flag === 'visible' && found.step.kind === 'surface_finish' && !value) return reject('not_allowed', 'finish must remain visible');
  const next = structuredClone(doc);
  next.nails[finger].steps[found.index][flag] = value;
  return validate(next);
}

export function setEditorV7SurfaceEffect(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  effect: SurfaceEffectPayloadV7,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.kind !== 'surface_effect') return reject('not_allowed', 'surface effect payload requires a surface effect step');
  if (found.step.locked) return reject('locked', 'step is locked');
  const next = structuredClone(doc);
  const target = next.nails[finger].steps[found.index];
  if (target.kind !== 'surface_effect') return reject('not_allowed', 'surface effect payload requires a surface effect step');
  target.effect = structuredClone(effect);
  return validate(next);
}

export function setEditorV7SurfaceEffectMask(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  mask: RegionMaskV7,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.kind !== 'surface_effect') return reject('not_allowed', 'surface effect mask requires a surface effect step');
  if (found.step.locked) return reject('locked', 'step is locked');
  const next = structuredClone(doc);
  const target = next.nails[finger].steps[found.index];
  if (target.kind !== 'surface_effect') return reject('not_allowed', 'surface effect mask requires a surface effect step');
  target.mask = structuredClone(mask);
  return validate(next);
}

export function addEditorV7Element(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  element: EditorV7Element,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.locked) return reject('locked', 'step is locked');
  if (allNodeIds(doc).has(element.id)) return reject('duplicate_id', 'element ID already exists');
  const next = structuredClone(doc);
  const target = next.nails[finger].steps[found.index];
  if (target.kind === 'flat_design' && 'opacity' in element) target.elements.push(structuredClone(element));
  else if (target.kind === 'dimensional_decoration' && !('opacity' in element)) target.decorations.push(structuredClone(element));
  else return reject('not_allowed', 'element kind is not allowed in this step');
  const result = validate(next);
  return result.ok ? { ...result, selectedElementId: element.id } : result;
}

function findElement(step: ProcessStepV7, elementId: string): { items: EditorV7Element[]; index: number } | null {
  const items: EditorV7Element[] = step.kind === 'flat_design'
    ? step.elements
    : step.kind === 'dimensional_decoration'
      ? step.decorations
      : [];
  const index = items.findIndex((item) => item.id === elementId);
  return index >= 0 ? { items, index } : null;
}

export function removeEditorV7Element(doc: EditorDocV7, finger: FingerCode, stepId: string, elementId: string): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.locked) return reject('locked', 'step is locked');
  const located = findElement(found.step, elementId);
  if (!located) return reject('not_found', 'element not found');
  if (located.items[located.index].locked) return reject('locked', 'element is locked');
  const next = structuredClone(doc);
  const nextLocated = findElement(next.nails[finger].steps[found.index], elementId);
  nextLocated?.items.splice(nextLocated.index, 1);
  return validate(next);
}

export function setEditorV7ElementFlag(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  flag: 'visible' | 'locked',
  value: boolean,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.locked) return reject('locked', 'step is locked');
  const located = findElement(found.step, elementId);
  if (!located) return reject('not_found', 'element not found');
  if (flag !== 'locked' && located.items[located.index].locked) return reject('locked', 'element is locked');
  const next = structuredClone(doc);
  const nextLocated = findElement(next.nails[finger].steps[found.index], elementId);
  if (!nextLocated) return reject('not_found', 'element not found');
  nextLocated.items[nextLocated.index][flag] = value;
  return validate(next);
}

export function setEditorV7ElementTransform(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  transform: Transform2DV7,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.locked) return reject('locked', 'step is locked');
  const located = findElement(found.step, elementId);
  if (!located) return reject('not_found', 'element not found');
  if (located.items[located.index].locked) return reject('locked', 'element is locked');
  const next = structuredClone(doc);
  const nextLocated = findElement(next.nails[finger].steps[found.index], elementId);
  if (!nextLocated) return reject('not_found', 'element not found');
  nextLocated.items[nextLocated.index].transform = structuredClone(transform);
  return validate(next);
}

export function replaceEditorV7DimensionalDecoration(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  replacement: DimensionalDecorationV7,
): EditorV7CommandResult {
  const found = findStep(doc, finger, stepId);
  if (!found.step) return reject('not_found', 'step not found');
  if (found.step.kind !== 'dimensional_decoration') return reject('not_allowed', 'replacement requires a dimensional decoration step');
  if (found.step.locked) return reject('locked', 'step is locked');
  const index = found.step.decorations.findIndex((item) => item.id === elementId);
  if (index < 0) return reject('not_found', 'decoration not found');
  if (found.step.decorations[index].locked) return reject('locked', 'decoration is locked');
  if (replacement.id !== elementId) return reject('invalid_value', 'replacement must preserve the decoration ID');
  const next = structuredClone(doc);
  const target = next.nails[finger].steps[found.index];
  if (target.kind !== 'dimensional_decoration') return reject('not_allowed', 'replacement requires a dimensional decoration step');
  target.decorations[index] = structuredClone(replacement);
  return validate(next);
}
