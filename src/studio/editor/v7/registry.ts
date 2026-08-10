import type { ProcessStepKindV7 } from './model.ts';

export const PROCESS_STEP_KINDS_V7 = [
  'background',
  'flat_design',
  'surface_effect',
  'dimensional_decoration',
  'surface_finish',
] as const satisfies readonly ProcessStepKindV7[];

export const SURFACE_FINISH_TYPES_V7 = ['gloss', 'matte', 'frosted'] as const;
export const PREVIEW_FIDELITIES_V7 = ['exact', 'approximate', 'unavailable'] as const;

export const PROCESS_STEP_TYPE_IDS_V7 = {
  background: 'builtin.v7.background',
  flat_design: 'builtin.v7.flat_design',
  surface_effect: 'builtin.v7.surface_effect',
  dimensional_decoration: 'builtin.v7.dimensional_decoration',
  surface_finish: 'builtin.v7.surface_finish',
} as const satisfies Record<ProcessStepKindV7, string>;

export type ProcessStepContentKindV7 =
  | 'solid'
  | 'translucent'
  | 'gradient'
  | 'cat_eye'
  | 'glitter'
  | 'brush_stroke'
  | 'eraser_mask'
  | 'vector_shape'
  | 'text'
  | 'image_2d'
  | 'french_edge'
  | 'region_mask'
  | 'mirror'
  | 'ink_bloom'
  | 'relief_2_5d'
  | 'attachment_3d'
  | 'gloss'
  | 'matte'
  | 'frosted';

export type EditorToolIdV7 =
  | 'select'
  | 'background_fill'
  | 'color_picker'
  | 'gradient'
  | 'brush'
  | 'eraser'
  | 'shape'
  | 'french'
  | 'text'
  | 'import_2d'
  | 'mask'
  | 'cat_eye'
  | 'glitter'
  | 'mirror'
  | 'ink_bloom'
  | 'relief'
  | 'attachment'
  | 'finish_picker'
  | 'preview_3d';

export interface ProcessStepTypeDefinitionV1 {
  typeId: string;
  kind: ProcessStepKindV7;
  cardinality: 'exactly_one' | 'zero_or_more';
  position: 'first' | 'middle' | 'last';
  repeatable: boolean;
  deletable: boolean;
  skippable: boolean;
  movable: boolean;
  duplicable: boolean;
  supportsMask: boolean;
  supportsMaterial: boolean;
  allowedTools: readonly EditorToolIdV7[];
  allowedContentKinds: readonly ProcessStepContentKindV7[];
}

export const PROCESS_STEP_REGISTRY_V7 = {
  [PROCESS_STEP_TYPE_IDS_V7.background]: {
    typeId: PROCESS_STEP_TYPE_IDS_V7.background,
    kind: 'background',
    cardinality: 'exactly_one',
    position: 'first',
    repeatable: false,
    deletable: false,
    skippable: false,
    movable: false,
    duplicable: false,
    supportsMask: false,
    supportsMaterial: true,
    allowedTools: ['background_fill', 'color_picker', 'gradient', 'cat_eye', 'glitter'],
    allowedContentKinds: ['solid', 'translucent', 'gradient', 'cat_eye', 'glitter'],
  },
  [PROCESS_STEP_TYPE_IDS_V7.flat_design]: {
    typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
    kind: 'flat_design',
    cardinality: 'zero_or_more',
    position: 'middle',
    repeatable: true,
    deletable: true,
    skippable: true,
    movable: true,
    duplicable: true,
    supportsMask: true,
    supportsMaterial: false,
    allowedTools: ['select', 'brush', 'eraser', 'shape', 'french', 'text', 'import_2d', 'mask'],
    allowedContentKinds: [
      'brush_stroke',
      'eraser_mask',
      'vector_shape',
      'text',
      'image_2d',
      'french_edge',
      'region_mask',
    ],
  },
  [PROCESS_STEP_TYPE_IDS_V7.surface_effect]: {
    typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect,
    kind: 'surface_effect',
    cardinality: 'zero_or_more',
    position: 'middle',
    repeatable: true,
    deletable: true,
    skippable: true,
    movable: true,
    duplicable: true,
    supportsMask: true,
    supportsMaterial: true,
    allowedTools: ['select', 'mask', 'cat_eye', 'glitter', 'mirror', 'ink_bloom'],
    allowedContentKinds: ['cat_eye', 'glitter', 'mirror', 'ink_bloom'],
  },
  [PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration]: {
    typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration,
    kind: 'dimensional_decoration',
    cardinality: 'zero_or_more',
    position: 'middle',
    repeatable: true,
    deletable: true,
    skippable: true,
    movable: true,
    duplicable: true,
    supportsMask: false,
    supportsMaterial: true,
    allowedTools: ['select', 'relief', 'attachment'],
    allowedContentKinds: ['relief_2_5d', 'attachment_3d'],
  },
  [PROCESS_STEP_TYPE_IDS_V7.surface_finish]: {
    typeId: PROCESS_STEP_TYPE_IDS_V7.surface_finish,
    kind: 'surface_finish',
    cardinality: 'exactly_one',
    position: 'last',
    repeatable: false,
    deletable: false,
    skippable: false,
    movable: false,
    duplicable: false,
    supportsMask: false,
    supportsMaterial: true,
    allowedTools: ['finish_picker', 'preview_3d'],
    allowedContentKinds: ['gloss', 'matte', 'frosted'],
  },
} as const satisfies Record<string, ProcessStepTypeDefinitionV1>;

export function getProcessStepTypeDefinitionV7(
  typeId: string,
): ProcessStepTypeDefinitionV1 | undefined {
  return PROCESS_STEP_REGISTRY_V7[typeId as keyof typeof PROCESS_STEP_REGISTRY_V7];
}
