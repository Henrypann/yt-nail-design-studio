import { FINGER_CODES, type FingerCode } from '@/lib/types';
import {
  PETAL_VEIL_SIGNATURE,
  type PetalVeilSignatureV1,
  type RecipeInstanceV1,
} from '@/studio/editor/lib/recipe-model';

export const PETAL_VEIL_RENDERER_ID = 'three-pbr/petal-veil-1' as const;

export interface NailAppearanceModel {
  recipeRef: { id: 'petal-veil-french'; version: '1.0.0' };
  rendererId: typeof PETAL_VEIL_RENDERER_ID;
  renderStatus: 'candidate';
  shape: 'almond';
  length: 'medium';
  finger: FingerCode;
  base: PetalVeilSignatureV1['base'];
  french: PetalVeilSignatureV1['french'];
  relief: Array<PetalVeilSignatureV1['flower']>;
  material: {
    roughness: 0.22;
    clearcoat: 1;
    clearcoatRoughness: 0.12;
    transmission: 0.08;
  };
  manufacturing: 'unvalidated';
  manufacturingCommandAllowed: false;
  appearanceChecksum: string;
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function compilePetalVeilAppearance(
  recipe: RecipeInstanceV1,
  finger: FingerCode,
): NailAppearanceModel {
  if (recipe.recipeRef.id !== 'petal-veil-french') {
    throw new Error(`Petal Veil renderer received ${recipe.recipeRef.id}`);
  }
  const signature = recipe.petalVeil ?? PETAL_VEIL_SIGNATURE;
  const relief = finger === signature.flower.finger ? [signature.flower] : [];
  const checksumSource = {
    recipeRef: recipe.recipeRef,
    rendererId: signature.rendererId,
    shape: 'almond',
    length: 'medium',
    finger,
    base: signature.base,
    french: signature.french,
    relief,
  };
  return {
    recipeRef: { id: 'petal-veil-french', version: '1.0.0' },
    rendererId: PETAL_VEIL_RENDERER_ID,
    renderStatus: 'candidate',
    shape: 'almond',
    length: 'medium',
    finger,
    base: signature.base,
    french: signature.french,
    relief,
    material: {
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      transmission: 0.08,
    },
    manufacturing: 'unvalidated',
    manufacturingCommandAllowed: false,
    appearanceChecksum: fnv1a(JSON.stringify(checksumSource)),
  };
}

export function compilePetalVeilSet(recipe: RecipeInstanceV1): NailAppearanceModel[] {
  return FINGER_CODES.map((finger) => compilePetalVeilAppearance(recipe, finger));
}

