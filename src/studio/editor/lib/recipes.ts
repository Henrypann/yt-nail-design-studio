import {
  createLayerMeta,
  genId,
  IDENTITY_TRANSFORM,
  type PatternElement,
} from './model.ts';
import {
  defaultClassicControls,
  defaultFrenchParams,
} from './french-edge.ts';
import type { SilhouetteInfo } from './material.ts';

export type EditorRecipeId = 'solid' | 'french' | 'gradient';

/** E2 Recipe 只生成图案分区元素；底色和表面仍由 Design Inspector 管理。 */
export function buildRecipePattern(
  recipe: EditorRecipeId,
  silhouette: SilhouetteInfo,
  startOrder = 0,
): PatternElement[] {
  if (recipe === 'solid') return [];
  if (recipe === 'gradient') {
    return [
      {
        id: genId('el_gradient'),
        kind: 'gradient',
        ...createLayerMeta('裸色渐变', startOrder),
        source: 'recipe',
        recipeId: 'gradient',
        rootColor: '#F8E8E1',
        tipColor: '#D991A4',
        rootOpacity: 0.12,
        tipOpacity: 0.88,
      },
    ];
  }

  const defaults = defaultFrenchParams(silhouette);
  return [
    {
      id: genId('el_french'),
      kind: 'french_edge',
      ...createLayerMeta('经典法式', startOrder),
      source: 'recipe',
      recipeId: 'french',
      variant: 'arc',
      fillColor: '#FFFDF9',
      outlineEnabled: false,
      strokeColor: '#E8D8D0',
      strokeWidth: 3,
      tipOffset: defaults.tipOffset,
      smileDepth: defaults.smileDepth,
      classicControls: defaultClassicControls(silhouette),
      lineGap: defaults.lineGap,
      transform: { ...IDENTITY_TRANSFORM },
    },
  ];
}
