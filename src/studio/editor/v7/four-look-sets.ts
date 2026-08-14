import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { parseHexColorV7 } from './background';
import { dimensionalMeshAssetRefV7 } from './dimensional-decoration';
import type {
  DimensionalDecorationV7,
  EditorDocV7,
  FlatDesignElementV7,
  ProcessStepV7,
  RegionMaskV7,
  RgbaColorV7,
} from './model';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { parseEditorDocV7 } from './schema';

export const FOUR_LOOK_SET_IDS_V0_7_2 = [
  'leopard-gilded-nude',
  'crimson-reliquary',
  'ivory-lace-crystal',
  'honey-petal-glass',
] as const;

export type FourLookSetIdV0_7_2 = (typeof FOUR_LOOK_SET_IDS_V0_7_2)[number];
type BackgroundDefinition = { type: 'solid' | 'translucent' | 'gradient'; color: string; opacity: number; tipColor?: string };
type FingerDefinition = { background: BackgroundDefinition; middle: readonly string[]; surfaceFinish: { type: 'gloss' } };

export interface FourLookSetDefinitionV0_7_2 {
  id: FourLookSetIdV0_7_2;
  title: string;
  titleZh: string;
  publishedAt: string;
  palette: readonly string[];
  tags: readonly string[];
  fingers: Record<FingerCode, FingerDefinition>;
}

const fingers = (background: BackgroundDefinition, middle: Record<FingerCode, readonly string[]>): Record<FingerCode, FingerDefinition> => (
  Object.fromEntries(FINGER_CODES.map((finger) => [finger, { background, middle: middle[finger], surfaceFinish: { type: 'gloss' as const } }])) as Record<FingerCode, FingerDefinition>
);

export const FOUR_LOOK_SET_DEFINITIONS_V0_7_2: readonly FourLookSetDefinitionV0_7_2[] = [
  {
    id: 'leopard-gilded-nude', title: 'Leopard Gilded Nude', titleZh: '鎏金豹纹裸粉', publishedAt: '2026-08-14T01:00:00.000Z',
    palette: ['#F0CFC6', '#F8E9D2', '#1A1512', '#D9A441'], tags: ['豹纹', '裸粉', '鎏金', '立体珠饰'],
    fingers: fingers({ type: 'translucent', color: '#F0CFC6', opacity: 0.82 }, {
      L1: ['diagonal_ivory', 'leopard_local', 'gilded_crystal_cluster'], L2: ['diagonal_ivory'], L3: ['leopard_local'], L4: ['gold_hairline'], L5: [],
      R1: ['leopard_local'], R2: ['diagonal_ivory'], R3: ['diagonal_ivory'], R4: ['diagonal_ivory', 'leopard_local', 'gilded_crystal_cluster'], R5: ['gold_microbead'],
    }),
  },
  {
    id: 'crimson-reliquary', title: 'Crimson Reliquary', titleZh: '绯红圣物', publishedAt: '2026-08-14T01:10:00.000Z',
    palette: ['#980F2D', '#E93E63', '#F8B8C5', '#D9A441'], tags: ['酒红', '抽象曲线', '金属链', '哥特'],
    fingers: fingers({ type: 'solid', color: '#980F2D', opacity: 1 }, {
      L1: ['abstract_curve', 'gold_cross_chain'], L2: ['abstract_curve'], L3: ['abstract_curve', 'gold_chain_arc'], L4: ['curve_hairline'], L5: ['gold_microbead'],
      R1: ['abstract_curve'], R2: ['gold_microbead'], R3: ['abstract_curve', 'gold_cross_chain'], R4: ['abstract_curve', 'gold_chain_arc'], R5: ['curve_hairline'],
    }),
  },
  {
    id: 'ivory-lace-crystal', title: 'Ivory Lace Crystal', titleZh: '象牙蕾丝晶露', publishedAt: '2026-08-14T01:20:00.000Z',
    palette: ['#EFCFC3', '#FFFDF8', '#F3E8DA', '#D8DEE8'], tags: ['蕾丝', '水钻', '珍珠', '乳白渐变'],
    fingers: fingers({ type: 'gradient', color: '#EFCFC3', tipColor: '#FFFDF8', opacity: 0.9 }, {
      L1: ['milky_tip_gradient', 'teardrop_pearl_cluster'], L2: ['milky_tip_gradient', 'ivory_lace_applique'], L3: ['milky_tip_gradient', 'pearl_crystal_constellation'], L4: ['milky_tip_gradient', 'ivory_relief_flower'], L5: ['milky_tip_gradient'],
      R1: ['milky_tip_gradient'], R2: ['milky_tip_gradient', 'ivory_relief_flower'], R3: ['milky_tip_gradient', 'ivory_lace_applique'], R4: ['milky_tip_gradient', 'teardrop_pearl_cluster'], R5: ['milky_tip_gradient', 'pearl_crystal_constellation'],
    }),
  },
  {
    id: 'honey-petal-glass', title: 'Honey Petal Glass', titleZh: '蜂蜜玻璃花瓣', publishedAt: '2026-08-14T01:30:00.000Z',
    palette: ['#EBC9BD', '#FFFDF8', '#F6C94F', '#F8E4D8'], tags: ['玻璃花', '蜂蜜胶', '白色法式', '珍珠'],
    fingers: fingers({ type: 'translucent', color: '#EBC9BD', opacity: 0.8 }, {
      L1: ['glass_flower_pearl', 'honey_jelly_center'], L2: ['white_asymmetric_french'], L3: ['honey_jelly_center'], L4: ['white_asymmetric_french', 'pearl_accent'], L5: ['white_hairline'],
      R1: ['white_asymmetric_french'], R2: ['white_hairline'], R3: ['glass_flower_pearl', 'honey_jelly_center'], R4: ['white_asymmetric_french', 'pearl_accent'], R5: ['honey_jelly_center'],
    }),
  },
] as const;

const FLAT_TOKENS = new Set([
  'diagonal_ivory', 'leopard_local', 'gold_hairline', 'abstract_curve', 'curve_hairline',
  'milky_tip_gradient', 'white_asymmetric_french', 'white_hairline',
]);
const EFFECT_TOKENS = new Set(['honey_jelly_center']);
const ATTACHMENT_ASSETS: Partial<Record<string, string>> = {
  gilded_crystal_cluster: 'look.leopard-gilded-nude.decoration.gilded-crystal-cluster',
  gold_cross_chain: 'look.crimson-reliquary.decoration.gold-cross-chain',
  gold_chain_arc: 'look.crimson-reliquary.decoration.gold-cross-chain',
  teardrop_pearl_cluster: 'look.ivory-lace-crystal.decoration.teardrop-pearl-cluster',
  pearl_crystal_constellation: 'look.ivory-lace-crystal.decoration.teardrop-pearl-cluster',
  ivory_relief_flower: 'look.ivory-lace-crystal.decoration.ivory-relief-flower',
  ivory_lace_applique: 'look.ivory-lace-crystal.decoration.ivory-lace-applique',
  glass_flower_pearl: 'look.honey-petal-glass.decoration.glass-flower-pearl',
};

const TOKEN_LABELS: Record<string, string> = {
  diagonal_ivory: '斜法式象牙色块', leopard_local: '局部豹纹', gold_hairline: '鎏金细线', gold_microbead: '金色微珠',
  abstract_curve: '抽象曲线', curve_hairline: '曲线细描', gold_cross_chain: '十字金属链', gold_chain_arc: '弧形金属链',
  milky_tip_gradient: '乳白指尖渐变', teardrop_pearl_cluster: '水滴珍珠簇', ivory_lace_applique: '象牙蕾丝贴饰',
  pearl_crystal_constellation: '珍珠水晶星群', ivory_relief_flower: '象牙浮雕花', white_asymmetric_french: '白色不对称法式',
  white_hairline: '白色细线', glass_flower_pearl: '透明浮雕花与珍珠', honey_jelly_center: '蜂蜜拍拍胶花蕊', pearl_accent: '珍珠点饰',
  gilded_crystal_cluster: '鎏金水钻簇',
};

const fullMask = (): RegionMaskV7 => ({ coordinateSpace: 'nail-local-v1', pathData: 'M0 0 L1 0 L1 1 L0 1 Z', fillRule: 'nonzero', inverted: false });
const color = (hex: string, alpha = 1): RgbaColorV7 => {
  const parsed = parseHexColorV7(hex);
  if (!parsed) throw new Error(`invalid four-look color ${hex}`);
  parsed.a = alpha;
  return parsed;
};

function backgroundStep(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode): ProcessStepV7 {
  const input = definition.fingers[finger].background;
  const background = input.type === 'gradient'
    ? { mode: 'gradient' as const, opacity: input.opacity, directionDeg: 0, stops: [
      { offset: 0, color: color(input.tipColor ?? '#FFFDF8') },
      { offset: 1, color: color(input.color) },
    ] }
    : input.type === 'translucent'
      ? { mode: 'translucent' as const, opacity: input.opacity, color: color(input.color, input.opacity), materialPresetRef: { id: `preset.${definition.id}.background`, revision: '1' } }
      : { mode: 'solid' as const, opacity: input.opacity, color: color(input.color) };
  return {
    id: `step.${definition.id}.${finger}.background`, typeId: PROCESS_STEP_TYPE_IDS_V7.background, kind: 'background', name: '背景层',
    visible: true, locked: false, skipped: false, recipeInstanceId: `recipe.${definition.id}.v1`,
    materialRefs: [{ materialId: `material.${definition.id}.background`, revision: '1' }], background,
  };
}

function flatElement(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): FlatDesignElementV7 {
  const ivory = color('#FFF8EE');
  const gold = color('#D9A441');
  const crimson = color('#F06582');
  const dark = color('#171311');
  const common = { id: `element.${definition.id}.${finger}.${token}`, visible: true, locked: false, opacity: 0.94,
    transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 } };
  if (token === 'white_asymmetric_french') return { ...common, kind: 'french_edge', widthRatio: 0.27, curvature: 0.63, color: ivory };
  if (token.includes('hairline')) return { ...common, kind: 'vector_shape', pathData: 'M0.22 0.72 C0.38 0.53 0.58 0.42 0.79 0.3', stroke: token.startsWith('gold') ? gold : ivory, strokeWidthMm: 0.18 };
  if (token === 'diagonal_ivory') return { ...common, kind: 'vector_shape', pathData: 'M0.12 0.68 L0.88 0.38 L0.88 0.88 L0.12 0.88 Z', fill: ivory };
  if (token === 'leopard_local') return { ...common, kind: 'vector_shape', pathData: 'M0.22 0.58 C0.3 0.48 0.4 0.5 0.44 0.59 C0.4 0.7 0.29 0.71 0.22 0.58 Z M0.55 0.66 C0.62 0.55 0.75 0.57 0.78 0.68 C0.71 0.78 0.6 0.77 0.55 0.66 Z M0.43 0.82 C0.48 0.74 0.57 0.75 0.6 0.84 C0.54 0.91 0.46 0.9 0.43 0.82 Z', fill: dark, stroke: gold, strokeWidthMm: 0.12 };
  if (token === 'milky_tip_gradient') return { ...common, kind: 'vector_shape', pathData: 'M0.08 0.1 C0.3 0.28 0.7 0.28 0.92 0.1 L0.92 0.35 C0.7 0.43 0.3 0.43 0.08 0.35 Z', fill: color('#FFFDF8', 0.78) };
  return { ...common, kind: 'vector_shape', pathData: 'M0.18 0.25 C0.42 0.18 0.48 0.52 0.78 0.38 C0.64 0.58 0.42 0.62 0.24 0.79', stroke: crimson, strokeWidthMm: 0.34 };
}

function flatStep(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): ProcessStepV7 {
  return {
    id: `step.${definition.id}.${finger}.${token}`, typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: TOKEN_LABELS[token],
    visible: true, locked: false, skipped: false, recipeInstanceId: `recipe.${definition.id}.v1`, materialRefs: [], elements: [flatElement(definition, finger, token)],
  };
}

function effectStep(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): ProcessStepV7 {
  return {
    id: `step.${definition.id}.${finger}.${token}`, typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect, kind: 'surface_effect', name: TOKEN_LABELS[token],
    visible: true, locked: false, skipped: false, recipeInstanceId: `recipe.${definition.id}.v1`, materialRefs: [{ materialId: 'material.honey-jelly.simulated', revision: '1' }],
    effect: { effectType: 'ink_bloom', colors: [color('#F6C94F', 0.72), color('#FFF1B8', 0.42)], spread: 0.32, seed: `${definition.id}-${finger}-${token}`, previewFidelity: 'approximate' }, mask: fullMask(),
  };
}

function reliefDecoration(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): DimensionalDecorationV7 {
  return {
    id: `decoration.${definition.id}.${finger}.${token}`, kind: 'relief_2_5d', visible: true, locked: false,
    transform: { position: { u: 0.58, v: 0.55 }, scaleX: 0.62, scaleY: 0.62, rotationDeg: finger.startsWith('L') ? -8 : 8 },
    heightMm: 0.24, materialRef: { materialId: token === 'gold_microbead' ? 'material.simulated.gold' : 'material.simulated.pearl', revision: '1' }, previewFidelity: 'approximate',
    outline: { coordinateSpace: 'nail-local-v1', pathData: 'M0.5 0.34 C0.61 0.34 0.68 0.41 0.68 0.5 C0.68 0.59 0.61 0.66 0.5 0.66 C0.39 0.66 0.32 0.59 0.32 0.5 C0.32 0.41 0.39 0.34 0.5 0.34 Z', fillRule: 'nonzero', inverted: false },
  };
}

function dimensionalStep(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): ProcessStepV7 | null {
  const assetId = ATTACHMENT_ASSETS[token];
  let decoration: DimensionalDecorationV7;
  if (assetId) {
    const asset = dimensionalMeshAssetRefV7(assetId);
    if (!asset) return null;
    const position = { u: finger.startsWith('L') ? 0.44 : 0.56, v: 0.52 };
    decoration = {
      id: `decoration.${definition.id}.${finger}.${token}`, kind: 'attachment_3d', visible: true, locked: false,
      transform: { position, scaleX: 0.62, scaleY: 0.62, rotationDeg: finger.startsWith('L') ? -7 : 7 },
      heightMm: token.includes('lace') ? 0.18 : token.includes('flower') ? 1.04 : 0.72,
      materialRef: { materialId: `material.${definition.id}.${token}`, revision: '1' }, previewFidelity: 'approximate', asset, anchor: position,
    };
  } else decoration = reliefDecoration(definition, finger, token);
  return {
    id: `step.${definition.id}.${finger}.${token}`, typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration, kind: 'dimensional_decoration', name: TOKEN_LABELS[token],
    visible: true, locked: false, skipped: false, recipeInstanceId: `recipe.${definition.id}.v1`, materialRefs: [], decorations: [decoration],
  };
}

function middleStep(definition: FourLookSetDefinitionV0_7_2, finger: FingerCode, token: string): ProcessStepV7 | null {
  if (FLAT_TOKENS.has(token)) return flatStep(definition, finger, token);
  if (EFFECT_TOKENS.has(token)) return effectStep(definition, finger, token);
  return dimensionalStep(definition, finger, token);
}

/** Materializes one signed allocation into canonical, independently editable EditorDocV7 steps. */
export function materializeFourLookSetV0_7_2(doc: EditorDocV7, lookId: FourLookSetIdV0_7_2): EditorDocV7 | null {
  const definition = FOUR_LOOK_SET_DEFINITIONS_V0_7_2.find((candidate) => candidate.id === lookId);
  if (!definition) return null;
  const next = structuredClone(doc);
  next.title = definition.title;
  next.recipeInstances = {
    [`recipe.${definition.id}.v1`]: {
      instanceId: `recipe.${definition.id}.v1`, recipeId: definition.id, recipeRevision: '1',
      parameterValues: { architectureBaseline: 'v0.7.2', evidence: 'simulated', manufacturingCommandAllowed: false },
    },
  };
  next.sourceRefs = [{ domain: 'manual', sourceId: `look-asset-pack.${definition.id}`, revision: '1.0.0-simulated' }];
  for (const finger of FINGER_CODES) {
    const currentFinish = next.nails[finger].steps[next.nails[finger].steps.length - 1];
    if (!currentFinish || currentFinish.kind !== 'surface_finish') return null;
    const middle = definition.fingers[finger].middle.map((token) => middleStep(definition, finger, token));
    if (middle.some((step) => step === null)) return null;
    next.nails[finger].steps = [
      backgroundStep(definition, finger),
      ...(middle as ProcessStepV7[]),
      {
        ...currentFinish, id: `step.${definition.id}.${finger}.finish`, name: '透明亮面封层', recipeInstanceId: `recipe.${definition.id}.v1`,
        materialRefs: [{ materialId: 'material.finish.gloss', revision: '1' }], finish: { type: 'gloss', materialPresetRef: { id: 'preset.finish.gloss', revision: '1' } },
      },
    ];
  }
  const parsed = parseEditorDocV7(next);
  return parsed.ok ? parsed.doc : null;
}
