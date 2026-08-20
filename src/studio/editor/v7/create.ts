import type { DesignSummary, FingerCode, NailLength, NailShape } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { parseHexColorV7 } from './background';
import type { AssetRefV7, DesignSourceRefV1, EditorDocV7, FlatDesignElementV7, GeometryRefV7, ProcessStepV7, SurfaceFinishTypeV7 } from './model';
import { assetRefV7Equal, getOfficialTemplatePatternAssetV7 } from './official-template-assets';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { parseEditorDocV7 } from './schema';
import { materializeMercuryDewV7 } from './mercury-dew';
import { materializePetalPearlBloomV7 } from './petal-pearl-bloom';
import { createSurfaceFinishDefinitionV7 } from './finish';
import { isExactEditorGeometryV7, PRODUCT_GEOMETRY_REVISION_V7 } from './geometry-registry';

export { PRODUCT_GEOMETRY_REVISION_V7 } from './geometry-registry';

const PETAL_PEARL_BLOOM_TEMPLATE_ID = 't_petal_pearl_bloom_simulated';

export type EditorDocV7CreationFailure =
  | 'invalid_input'
  | 'unsupported_finish'
  | 'unsupported_recipe'
  | 'unsupported_decoration'
  | 'geometry_unavailable'
  | 'template_asset_missing';

export type EditorDocV7CreationResult =
  | { ok: true; doc: EditorDocV7 }
  | { ok: false; reason: EditorDocV7CreationFailure; message: string };

export interface WizardEditorV7CompatibilityInput {
  shape: NailShape;
  length: NailLength;
  templateId?: string;
  finish: DesignSummary['finish'];
  recipe?: DesignSummary['recipe'];
  fingerOverrides?: DesignSummary['fingerOverrides'];
  templateAssetRef?: AssetRefV7;
}

export interface WizardEditorV7CompatibilityItem {
  id: 'geometry' | 'template' | 'recipe' | 'finish' | 'document';
  label: string;
  value: string;
  fidelity: 'exact' | 'approximate' | 'unavailable';
}

export type WizardEditorV7CompatibilityReport =
  | { ok: true; items: readonly WizardEditorV7CompatibilityItem[]; warning: string }
  | { ok: false; reason: EditorDocV7CreationFailure; message: string; items: readonly WizardEditorV7CompatibilityItem[] };

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

function createProductGeometryRefV7(
  shape: NailShape,
  length: NailLength,
  finger: FingerCode,
): GeometryRefV7 {
  return {
    assetId: `geometry.${shape}.${length}.${finger}`,
    revision: PRODUCT_GEOMETRY_REVISION_V7,
  };
}

function wizardCompatibilityFailure(input: WizardEditorV7CompatibilityInput): Extract<EditorDocV7CreationResult, { ok: false }> | null {
  if (input.finish === 'pearl') {
    return { ok: false, reason: 'unsupported_finish', message: '珠光封层尚不能无损转换为 V7 表面完成层' };
  }
  if (input.recipe && input.recipe.recipeRef.id !== 'mercury-dew') {
    return { ok: false, reason: 'unsupported_recipe', message: `配方 ${input.recipe.recipeRef.id} 尚未接入 EditorDocV7` };
  }
  const decoration = Object.entries(input.fingerOverrides ?? {}).find(([, override]) => override?.decorationId);
  if (decoration) {
    return { ok: false, reason: 'unsupported_decoration', message: `${decoration[0]} 的装饰尚不能无损转换为 V7 立体元素` };
  }
  const unavailableFinger = FINGER_CODES.find((finger) => !isExactEditorGeometryV7(
    createProductGeometryRefV7(input.shape, input.length, finger),
    finger,
  ));
  if (unavailableFinger) {
    return { ok: false, reason: 'geometry_unavailable', message: `${input.shape}/${input.length}/${unavailableFinger} 尚无已签收 V7 轮廓` };
  }
  if (input.templateId && !input.templateAssetRef) {
    return { ok: false, reason: 'template_asset_missing', message: `${input.templateId}/${input.shape} 缺少精确 AssetRefV7，拒绝使用当前注册表漂移` };
  }
  if (input.templateId && !getOfficialTemplatePatternAssetV7(input.templateId, input.shape)) {
    return { ok: false, reason: 'template_asset_missing', message: `${input.templateId}/${input.shape} 缺少已验证 SVG 图案资产` };
  }
  if (input.templateId && input.templateAssetRef) {
    const expected = getOfficialTemplatePatternAssetV7(input.templateId, input.shape);
    if (!expected || !assetRefV7Equal(expected, input.templateAssetRef)) {
      return { ok: false, reason: 'template_asset_missing', message: `${input.templateId}/${input.shape} 的素材 revision/SHA 不匹配` };
    }
  }
  return null;
}

/** Writer-zero Wizard → Editor preflight. It mirrors the creation gates without creating or saving a document. */
export function inspectWizardEditorV7Compatibility(
  input: WizardEditorV7CompatibilityInput,
): WizardEditorV7CompatibilityReport {
  const baseItems: WizardEditorV7CompatibilityItem[] = [
    { id: 'geometry', label: '十指甲型', value: `10/10 · ${input.shape} / ${input.length}`, fidelity: 'exact' },
    {
      id: 'template',
      label: '模板图案',
      value: input.templateId ? `${input.templateId} · 10 指可物化` : '未使用模板',
      fidelity: 'exact',
    },
    {
      id: 'recipe',
      label: '结构化效果',
      value: input.recipe ? (input.recipe.recipeRef.id === 'mercury-dew' ? 'Mercury Dew · 模拟预览' : input.recipe.recipeRef.id) : '无额外配方',
      fidelity: input.recipe ? 'approximate' : 'exact',
    },
    { id: 'finish', label: '表面封层', value: input.finish, fidelity: input.finish === 'pearl' ? 'unavailable' : 'exact' },
    { id: 'document', label: '目标文档', value: 'EditorDocV7 · schema 7', fidelity: 'exact' },
  ];
  const failure = wizardCompatibilityFailure(input);
  if (!failure) {
    return {
      ok: true,
      items: baseItems,
      warning: input.recipe ? '2D/2.5D/3D 为模拟预览，不代表材料或制造验证。' : '预览通过不代表材料、贴合或制造验证。',
    };
  }
  return {
    ok: false,
    reason: failure.reason,
    message: failure.message,
    items: baseItems.map((item) => (
      (failure.reason === 'geometry_unavailable' && item.id === 'geometry')
      || (failure.reason === 'template_asset_missing' && item.id === 'template')
      || ((failure.reason === 'unsupported_recipe' || failure.reason === 'unsupported_decoration') && item.id === 'recipe')
      || (failure.reason === 'unsupported_finish' && item.id === 'finish')
        ? { ...item, fidelity: 'unavailable' as const }
        : item
    )),
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
  const finishDefinition = createSurfaceFinishDefinitionV7(finish);
  steps.push({
    id: `step.${token}.${finger}.finish`,
    typeId: PROCESS_STEP_TYPE_IDS_V7.surface_finish,
    kind: 'surface_finish',
    name: '表面完成层',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [finishDefinition.materialRef],
    finish: finishDefinition.finish,
  });
  return steps;
}

function buildEditorDocV7(
  input: BlankEditorDocV7Input,
  perFingerColor: (finger: FingerCode) => string,
  templateId?: string,
  source?: { sourceRefs: DesignSourceRefV1[] },
  templateAssetRef?: AssetRefV7,
): EditorDocV7CreationResult {
  const now = input.now ?? new Date().toISOString();
  const finish = input.finish ?? 'gloss';
  const token = idToken(input.designId);
  const nails = {} as EditorDocV7['nails'];
  for (const finger of FINGER_CODES) {
    const color = parseHexColorV7(perFingerColor(finger));
    if (!color) return { ok: false, reason: 'invalid_input', message: `Invalid background color for ${finger}` };
    const asset = templateId ? templateAssetRef ?? null : null;
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
    const geometryRef = createProductGeometryRefV7(input.shape, input.length, finger);
    if (!isExactEditorGeometryV7(geometryRef, finger)) {
      return {
        ok: false,
        reason: 'geometry_unavailable',
        message: `${input.shape}/${input.length}/${finger} has no signed-off V7 geometry`,
      };
    }
    nails[finger] = {
      finger,
      geometryRef,
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
    sourceRefs: source?.sourceRefs ?? [{ domain: 'manual', sourceId: input.designId }],
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
  const compatibilityFailure = wizardCompatibilityFailure(design);
  if (compatibilityFailure) return compatibilityFailure;
  const petalPearlBloom = design.templateId === PETAL_PEARL_BLOOM_TEMPLATE_ID;
  const base = buildEditorDocV7({
    designId: design.id,
    shape: design.shape,
    length: design.length,
    customerRef: design.customerId || undefined,
    title: design.title ?? '未命名设计',
    baseColor: design.baseColor,
    finish: design.finish as SurfaceFinishTypeV7,
    now,
  }, (finger) => design.fingerOverrides?.[finger]?.baseColor ?? design.baseColor, petalPearlBloom ? undefined : design.templateId, {
    sourceRefs: [
      { domain: 'wizard', sourceId: design.id, revision: String(design.version) },
      ...(design.communitySourceRef
        ? [{ domain: 'community' as const, sourceId: design.communitySourceRef.contentId, revision: design.communitySourceRef.assetVersion }]
        : []),
    ],
  }, design.templateAssetRef);
  if (!base.ok) return base;
  if (petalPearlBloom) {
    const materialized = materializePetalPearlBloomV7(base.doc);
    return materialized
      ? { ok: true, doc: materialized }
      : { ok: false, reason: 'unsupported_recipe', message: 'Petal Pearl Bloom V7 materialization failed contract validation' };
  }
  if (!design.recipe) return base;
  const materialized = materializeMercuryDewV7(base.doc, design.recipe);
  return materialized
    ? { ok: true, doc: materialized }
    : { ok: false, reason: 'unsupported_recipe', message: 'Mercury Dew V7 materialization failed contract validation' };
}
