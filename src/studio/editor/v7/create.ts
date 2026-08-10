import type { DesignSummary, FingerCode, NailLength, NailShape } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { parseHexColorV7 } from './background';
import type { EditorDocV7, FlatDesignElementV7, GeometryRefV7, ProcessStepV7, SurfaceFinishTypeV7 } from './model';
import { getOfficialTemplatePatternAssetV7 } from './official-template-assets';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { parseEditorDocV7 } from './schema';

export const PRODUCT_GEOMETRY_REVISION_V7 = 'shape-params-v3';

export type EditorDocV7CreationFailure =
  | 'invalid_input'
  | 'unsupported_finish'
  | 'unsupported_recipe'
  | 'unsupported_decoration'
  | 'template_asset_missing';

export type EditorDocV7CreationResult =
  | { ok: true; doc: EditorDocV7 }
  | { ok: false; reason: EditorDocV7CreationFailure; message: string };

export interface BlankEditorDocV7Input {
  designId: string;
  shape: NailShape;
  length: NailLength;
  customerRef?: string;
  title?: string;
  baseColor?: string;
  finish?: SurfaceFinishTypeV7;
  now?: string;
}

const identityTransform = () => ({
  position: { u: 0.5, v: 0.5 },
  scaleX: 1,
  scaleY: 1,
  rotationDeg: 0,
});

function idToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 48) || 'design';
}

export function createProductGeometryRefV7(
  shape: NailShape,
  length: NailLength,
  finger: FingerCode,
): GeometryRefV7 {
  return {
    assetId: `geometry.${shape}.${length}.${finger}`,
    revision: PRODUCT_GEOMETRY_REVISION_V7,
  };
}

function createSteps(
  token: string,
  finger: FingerCode,
  color: NonNullable<ReturnType<typeof parseHexColorV7>>,
  finish: SurfaceFinishTypeV7,
  templateElement: FlatDesignElementV7 | null,
): ProcessStepV7[] {
  const steps: ProcessStepV7[] = [{
    id: `step.${token}.${finger}.background`,
    typeId: PROCESS_STEP_TYPE_IDS_V7.background,
    kind: 'background',
    name: '背景层',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [],
    background: { mode: 'solid', opacity: 1, color },
  }];
  if (templateElement) {
    steps.push({
      id: `step.${token}.${finger}.template`,
      typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
      kind: 'flat_design',
      name: 'Wizard 模板',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      elements: [templateElement],
    });
  }
  steps.push({
    id: `step.${token}.${finger}.finish`,
    typeId: PROCESS_STEP_TYPE_IDS_V7.surface_finish,
    kind: 'surface_finish',
    name: '表面完成层',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [{ materialId: `material.finish.${finish}`, revision: '1' }],
    finish: {
      type: finish,
      materialPresetRef: { id: `preset.finish.${finish}`, revision: '1' },
    },
  });
  return steps;
}

function buildEditorDocV7(
  input: BlankEditorDocV7Input,
  perFingerColor: (finger: FingerCode) => string,
  templateId?: string,
  source?: { sourceId: string; revision: string },
): EditorDocV7CreationResult {
  const now = input.now ?? new Date().toISOString();
  const finish = input.finish ?? 'gloss';
  const token = idToken(input.designId);
  const nails = {} as EditorDocV7['nails'];
  for (const finger of FINGER_CODES) {
    const color = parseHexColorV7(perFingerColor(finger));
    if (!color) return { ok: false, reason: 'invalid_input', message: `Invalid background color for ${finger}` };
    const asset = templateId ? getOfficialTemplatePatternAssetV7(templateId, input.shape) : null;
    if (templateId && !asset) {
      return { ok: false, reason: 'template_asset_missing', message: `No verified ${templateId}/${input.shape} SVG asset exists` };
    }
    const templateElement: FlatDesignElementV7 | null = asset ? {
      id: `element.${token}.${finger}.template`,
      kind: 'image_2d',
      role: 'stamp',
      visible: true,
      locked: false,
      opacity: 1,
      transform: identityTransform(),
      asset,
    } : null;
    nails[finger] = {
      finger,
      geometryRef: createProductGeometryRefV7(input.shape, input.length, finger),
      steps: createSteps(token, finger, color, finish, templateElement),
    };
  }
  const candidate: EditorDocV7 = {
    schemaVersion: 7,
    designId: input.designId,
    ...(input.customerRef ? { customerRef: input.customerRef } : {}),
    title: input.title ?? '自由画布设计',
    nails,
    recipeInstances: {},
    sourceRefs: source ? [{ domain: 'wizard', sourceId: source.sourceId, revision: source.revision }] : [{ domain: 'manual', sourceId: input.designId }],
    communicationRefs: [],
    outputIntent: 'design',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  const parsed = parseEditorDocV7(candidate);
  return parsed.ok
    ? { ok: true, doc: parsed.doc }
    : { ok: false, reason: 'invalid_input', message: parsed.reason };
}

export function createBlankEditorDocV7(input: BlankEditorDocV7Input): EditorDocV7CreationResult {
  return buildEditorDocV7(input, () => input.baseColor ?? '#FBF5F0');
}

export function wizardDesignToEditorDocV7(
  design: DesignSummary,
  now = new Date().toISOString(),
): EditorDocV7CreationResult {
  if (design.finish === 'pearl') {
    return { ok: false, reason: 'unsupported_finish', message: 'Pearl finish requires the V7 surface-effect adapter' };
  }
  if (design.recipe) {
    return { ok: false, reason: 'unsupported_recipe', message: 'Recipe materialization remains on the V6 compatibility writer until V7-12/13' };
  }
  const decoration = Object.entries(design.fingerOverrides ?? {}).find(([, override]) => override?.decorationId);
  if (decoration) {
    return { ok: false, reason: 'unsupported_decoration', message: `Decoration on ${decoration[0]} requires the V7-13 adapter` };
  }
  return buildEditorDocV7({
    designId: design.id,
    shape: design.shape,
    length: design.length,
    customerRef: design.customerId || undefined,
    title: design.title ?? '未命名设计',
    baseColor: design.baseColor,
    finish: design.finish,
    now,
  }, (finger) => design.fingerOverrides?.[finger]?.baseColor ?? design.baseColor, design.templateId, {
    sourceId: design.id,
    revision: String(design.version),
  });
}
