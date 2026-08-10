import type { FingerCode } from '../../../lib/types';
import type { AssetRefV7, EditorDocV7 } from './model';
import {
  addEditorV7Element,
  type EditorV7CommandFailure,
  type EditorV7CommandResult,
} from './commands';
import { replaceEditorV7FlatElement } from './flat-vector';
import {
  createImageFlatElementV7,
  createTextFlatElementV7,
  getBundledFlatAssetV7,
  isFlatImageRoleCompatibleV7,
  isValidFlatAssetRefV7,
  relinkImageFlatElementV7,
  type ImageFlatElementInputV7,
  type TextFlatElementInputV7,
} from './flat-content-assets';

/**
 * V7-10 narrow pure commands for flat content: text creation, bundled
 * sticker/stamp placement, prepared import placement and image relink.
 * They reuse the shared atomic parse/history gates and never write asset
 * data into the document.
 */

function reject(reason: EditorV7CommandFailure, message: string): EditorV7CommandResult {
  return { ok: false, reason, message };
}

export function addTextFlatElementCommand(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  input: TextFlatElementInputV7,
): EditorV7CommandResult {
  const element = createTextFlatElementV7(input);
  if (!element) return reject('invalid_value', 'text element input is not valid (text, font, size or color)');
  return addEditorV7Element(doc, finger, stepId, element);
}

export function addBundledFlatAssetCommand(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  bundleId: string,
  id: string,
): EditorV7CommandResult {
  const entry = getBundledFlatAssetV7(bundleId);
  if (!entry) return reject('not_found', `bundled flat asset ${bundleId} is not registered`);
  const element = createImageFlatElementV7({ id, role: entry.role, asset: entry.asset });
  if (!element) return reject('invalid_value', 'bundled image element is not valid');
  if (element.kind === 'image_2d' && element.role === 'stamp') {
    const step = doc.nails[finger]?.steps.find((candidate) => candidate.id === stepId);
    if (step?.kind === 'flat_design') {
      const stampCount = step.elements.filter((candidate) => candidate.kind === 'image_2d' && candidate.role === 'stamp').length;
      const positions = [
        { u: 0.36, v: 0.38 },
        { u: 0.64, v: 0.38 },
        { u: 0.36, v: 0.62 },
        { u: 0.64, v: 0.62 },
        { u: 0.5, v: 0.5 },
      ];
      element.transform.position = positions[stampCount % positions.length];
    }
  }
  return addEditorV7Element(doc, finger, stepId, element);
}

export function addPreparedImportCommand(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  id: string,
  asset: AssetRefV7,
): EditorV7CommandResult {
  const element = createImageFlatElementV7({ id, role: 'import', asset });
  if (!element) return reject('invalid_value', 'prepared import element is not valid');
  return addEditorV7Element(doc, finger, stepId, element);
}

/**
 * Atomic text update: revalidates every canonical field through the same
 * pure creator used at creation time. Invalid input, an unregistered font,
 * or an unchanged element produce a rejection — zero document mutation.
 */
export function replaceTextFlatElementCommand(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  input: TextFlatElementInputV7,
): EditorV7CommandResult {
  const step = doc.nails[finger].steps.find((candidate) => candidate.id === stepId);
  if (!step) return reject('not_found', 'step not found');
  if (step.kind !== 'flat_design') return reject('not_allowed', 'text update requires a flat design step');
  if (step.locked) return reject('locked', 'step is locked');
  const element = step.elements.find((candidate) => candidate.id === elementId);
  if (!element) return reject('not_found', 'element not found');
  if (element.kind !== 'text') return reject('not_allowed', 'text update requires a text element');
  if (element.locked) return reject('locked', 'element is locked');
  const validated = createTextFlatElementV7({ ...input, id: elementId });
  if (!validated || validated.kind !== 'text') return reject('invalid_value', 'text element input is not valid (text, font, size or color)');
  const candidate: typeof element = {
    ...validated,
    visible: element.visible,
    locked: element.locked,
    opacity: element.opacity,
    transform: structuredClone(element.transform),
  };
  if (JSON.stringify(candidate) === JSON.stringify(element)) return reject('not_allowed', 'text element is unchanged');
  return replaceEditorV7FlatElement(doc, finger, stepId, elementId, candidate);
}

export function relinkImageAssetCommand(
  doc: EditorDocV7,
  finger: FingerCode,
  stepId: string,
  elementId: string,
  asset: AssetRefV7,
): EditorV7CommandResult {
  const step = doc.nails[finger].steps.find((candidate) => candidate.id === stepId);
  if (!step) return reject('not_found', 'step not found');
  if (step.kind !== 'flat_design') return reject('not_allowed', 'image relink requires a flat design step');
  if (step.locked) return reject('locked', 'step is locked');
  const element = step.elements.find((candidate) => candidate.id === elementId);
  if (!element) return reject('not_found', 'element not found');
  if (element.kind !== 'image_2d') return reject('not_allowed', 'relink requires an image_2d element');
  if (element.locked) return reject('locked', 'element is locked');
  if (!isValidFlatAssetRefV7(asset)) return reject('invalid_value', 'asset reference is not valid');
  if (!isFlatImageRoleCompatibleV7(element.role, asset)) {
    return reject('not_allowed', `asset is not compatible with the ${element.role} element role`);
  }
  const replacement = relinkImageFlatElementV7(element, asset);
  if (!replacement) return reject('invalid_value', 'relink produced an invalid element');
  return replaceEditorV7FlatElement(doc, finger, stepId, elementId, replacement);
}

export type { ImageFlatElementInputV7 };
