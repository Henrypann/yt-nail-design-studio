/**
 * Wizard → EditorDocV6 bridge (PR-05).
 * One-way conversion from Wizard DesignSummary to EditorDocV6.
 * Creates a layered per-finger document structure.
 */

import type { DesignSummary, FingerCode } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import {
  LENGTH_PRESET_BY_GEOMETRY,
  appearanceFromLegacyFinish,
} from '@/studio/editor/lib/model';
import { generateEditorId } from '@/studio/editor/v6/id';
import type {
  EditorDocV6,
  EditorLayerV6,
  EditorElementV6,
  NailDesignV6,
} from '@/studio/editor/v6/model';
import { DECORATIONS, templateById } from '@/studio/editor/lib/material';
import { isPetalVeilRecipe } from '@/studio/editor/lib/recipe-model';

/**
 * Convert a Wizard DesignSummary into an EditorDocV6.
 * This is a one-way bridge: Wizard → Editor only.
 */
export function wizardToEditorDocV6(design: DesignSummary): EditorDocV6 {
  const now = new Date().toISOString();
  const shape = design.shape ?? 'almond';
  const length = design.length ?? 'medium';
  const baseColor = design.baseColor ?? '#FBF5F0';
  const legacyFinish = design.finish ?? 'gloss';
  const appearance = appearanceFromLegacyFinish(legacyFinish);
  const lengthPreset = LENGTH_PRESET_BY_GEOMETRY[length];

  // Preserve the Wizard template reference even when the local display manifest
  // only knows its render-template alias.
  const template = design.templateId ? templateById(design.templateId) : undefined;
  const templateName = template?.name ?? design.title ?? '模板图案';

  // Build recipe instance if recipe exists
  let recipeInstanceId: string | undefined;
  const recipeInstances: EditorDocV6['recipeInstances'] = {};
  if (design.recipe) {
    recipeInstanceId = `recipe_${design.id}`;
    recipeInstances[recipeInstanceId] = {
      id: recipeInstanceId,
      recipeId: design.recipe.recipeRef?.id ?? recipeInstanceId,
      recipe: design.recipe,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Build per-finger nail designs
  const nails = {} as Record<FingerCode, NailDesignV6>;
  for (const finger of FINGER_CODES) {
    const override = design.fingerOverrides?.[finger as FingerCode];
    const fingerBaseColor = override?.baseColor ?? baseColor;
    const layers: EditorLayerV6[] = [];
    let order = 0;

    // Layer 1: Base surface
    layers.push({
      id: generateEditorId(`layer_base_${finger}`),
      name: '底色/表面',
      typeId: 'builtin.base_surface',
      visible: true,
      locked: false,
      order: order++,
      surface: { baseColor: fingerBaseColor },
      elements: [],
    });

    // Layer 2: Art 2D (template pattern)
    if (design.templateId) {
      layers.push({
        id: generateEditorId(`layer_art_${finger}`),
        name: '二维素材',
        typeId: 'builtin.art_2d',
        visible: true,
        locked: false,
        order: order++,
        elements: [{
          id: generateEditorId(`el_tpl_${finger}`),
          domain: 'pattern',
          kind: 'template_pattern',
          name: templateName,
          visible: true,
          locked: false,
          order: 0,
          templateId: design.templateId,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          editable: true,
          source: 'recipe',
        } satisfies EditorElementV6],
      });
    }

    // Layer 3: Attachment (from finger override decoration)
    if (override?.decorationId) {
      const deco = DECORATIONS.find((d) => d.id === override.decorationId);
      if (deco) {
        layers.push({
          id: generateEditorId(`layer_attachment_${finger}`),
          name: '附件',
          typeId: 'builtin.attachment',
          visible: true,
          locked: false,
          order: order++,
          elements: [
            {
              id: generateEditorId(`el_att_${finger}`),
              domain: 'attachment',
              kind: 'attachment',
              name: deco.name,
              visible: true,
              locked: false,
              order: 0,
              decorationId: deco.id,
              transform: {
                x: deco.defaults.x,
                y: deco.defaults.y,
                scale: deco.defaults.scale,
                rotation: deco.defaults.rotation,
              },
              heightMm: deco.defaults.heightMm,
            },
          ],
        });
      }
    }

    // Layer 4: Recipe layer
    if (recipeInstanceId) {
      layers.push({
        id: generateEditorId(`layer_recipe_${finger}`),
        name: '配方层',
        typeId: 'builtin.recipe',
        visible: true,
        locked: false,
        order: order++,
        recipeInstanceId,
        elements: [],
      });
    }

    nails[finger] = { finger, layers };
  }

  const recipe = design.recipe;
  const outputIntent: EditorDocV6['outputIntent'] =
    recipe && isPetalVeilRecipe(recipe) ? 'customer' : 'design';

  return {
    schemaVersion: 6,
    designId: design.id,
    customerId: design.customerId || undefined,
    title: design.title ?? '未命名设计',
    defaultGeometry: { shape, length },
    lengthPreset,
    appearance,
    presentationMeta: { masterFinger: 'R4' },
    nails,
    recipeInstances,
    communicationRefs: [],
    outputIntent,
    revision: 1,
    createdAt: design.createdAt ?? now,
    updatedAt: now,
  };
}
