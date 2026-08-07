/**
 * EditorDocV6 model — single writable editor document contract (PR-03).
 * Not to be confused with canvas ProjectV4.
 */

import {
  FINGER_CODES,
  type FingerCode,
  type Finish,
  type NailLength,
  type NailShape,
} from '../../../lib/types.ts';
import {
  LENGTH_PRESET_BY_GEOMETRY,
  appearanceFromLegacyFinish,
  type DesignIntent,
  type LengthPreset,
  type SurfaceAppearance,
} from '../lib/model.ts';

export type EditorDocOutputIntent = 'design' | 'customer' | 'manufacturing';

export type EditorElementDomain = 'pattern' | 'attachment' | 'relief';

export interface NailGeometryOverride {
  shape?: NailShape;
  length?: NailLength;
}

export interface LayerSurfaceV6 {
  baseColor: string;
}

/** Flat element record: domain payload is inlined (fixtures / contract shape). */
export interface EditorElementV6 {
  id: string;
  domain: EditorElementDomain;
  kind: string;
  visible: boolean;
  locked: boolean;
  order: number;
  [key: string]: unknown;
}

export interface EditorLayerV6 {
  id: string;
  name: string;
  typeId: string;
  visible: boolean;
  locked: boolean;
  order: number;
  recipeInstanceId?: string;
  surface?: LayerSurfaceV6;
  /** Optional guide metadata; not manufacturing truth. */
  stepId?: string;
  elements: EditorElementV6[];
}

export interface NailDesignV6 {
  finger: FingerCode;
  geometryOverride?: NailGeometryOverride;
  layers: EditorLayerV6[];
}

export interface CommunicationRefV6 {
  id: string;
  dataUrl: string;
  caption?: string;
  uploadedAt: string;
}

export interface EditorDocRecipeInstanceV6 {
  id: string;
  recipeId: string;
  recipe: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EditorDocV6 {
  schemaVersion: 6;
  designId: string;
  customerId?: string;
  title: string;
  defaultGeometry: { shape: NailShape; length: NailLength };
  lengthPreset: LengthPreset;
  appearance: SurfaceAppearance;
  intent?: DesignIntent;
  presentationMeta: { masterFinger: FingerCode };
  nails: Record<FingerCode, NailDesignV6>;
  recipeInstances: Record<string, EditorDocRecipeInstanceV6>;
  communicationRefs: CommunicationRefV6[];
  outputIntent: EditorDocOutputIntent;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmptyEditorDocV6Options {
  designId: string;
  customerId?: string;
  title?: string;
  shape?: NailShape;
  length?: NailLength;
  lengthPreset?: LengthPreset;
  baseColor?: string;
  appearance?: SurfaceAppearance;
  masterFinger?: FingerCode;
  outputIntent?: EditorDocOutputIntent;
  finish?: Finish;
}

function defaultAppearance(finish?: Finish): SurfaceAppearance {
  return appearanceFromLegacyFinish(finish ?? 'gloss');
}

export function createBlankNailDesignV6(
  finger: FingerCode,
  opts?: { baseColor?: string },
): NailDesignV6 {
  return {
    finger,
    layers: [
      {
        id: `layer_base_${finger}`,
        name: '底色/表面',
        typeId: 'builtin.base_surface',
        visible: true,
        locked: false,
        order: 0,
        surface: { baseColor: opts?.baseColor ?? '#FBF5F0' },
        elements: [],
      },
    ],
  };
}

export function createEmptyEditorDocV6(opts: CreateEmptyEditorDocV6Options): EditorDocV6 {
  const now = new Date().toISOString();
  const length = opts.length ?? 'medium';
  const appearance = opts.appearance ?? defaultAppearance(opts.finish);
  const baseColor = opts.baseColor ?? '#FBF5F0';
  const nails = {} as Record<FingerCode, NailDesignV6>;
  for (const finger of FINGER_CODES) {
    nails[finger] = createBlankNailDesignV6(finger, { baseColor });
  }
  return {
    schemaVersion: 6,
    designId: opts.designId,
    customerId: opts.customerId,
    title: opts.title ?? '未命名设计',
    defaultGeometry: {
      shape: opts.shape ?? 'almond',
      length,
    },
    lengthPreset: opts.lengthPreset ?? LENGTH_PRESET_BY_GEOMETRY[length],
    appearance,
    presentationMeta: { masterFinger: opts.masterFinger ?? 'R4' },
    nails,
    recipeInstances: {},
    communicationRefs: [],
    outputIntent: opts.outputIntent ?? 'design',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export { FINGER_CODES };
export type { FingerCode, NailLength, NailShape, LengthPreset, SurfaceAppearance, DesignIntent };
