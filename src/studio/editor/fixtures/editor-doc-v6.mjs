import { FINGER_CODES } from './legacy/index.mjs';

const appearance = {
  baseCoverage: 'opaque',
  opticalEffect: 'pearl',
  topFinish: 'gloss',
};

const nails = Object.fromEntries(FINGER_CODES.map((finger) => [
  finger,
  {
    finger,
    ...(finger === 'L1' ? { geometryOverride: { shape: 'oval', length: 'short' } } : {}),
    layers: [
      {
        id: `layer_v6_base_${finger}`,
        name: 'Base surface',
        typeId: 'builtin.base_surface',
        visible: true,
        locked: false,
        order: 0,
        surface: { baseColor: finger === 'L1' ? '#CFA89B' : '#D8B7AA' },
        elements: [],
      },
      {
        id: `layer_v6_recipe_${finger}`,
        name: 'Recipe',
        typeId: 'builtin.recipe',
        visible: true,
        locked: false,
        order: 1,
        recipeInstanceId: 'recipe_instance_fixture',
        elements: [{
          id: `element_v6_accent_${finger}`,
          domain: 'pattern',
          kind: 'brush',
          visible: true,
          locked: false,
          order: 0,
          points: [{ x: 0, y: -8 }, { x: 2, y: -14 }],
          color: '#F7F2EC',
          size: 5,
          opacity: 0.8,
        }],
      },
    ],
  },
]));

/**
 * Contract fixture for the target writable format. It is test data, not a
 * product-module export; the product model remains owned by the v6 contract
 * implementation.
 */
export const editorDocV6Fixture = {
  schemaVersion: 6,
  designId: 'design_fixture_v6',
  customerId: 'customer_fixture',
  title: 'Anonymous v6 design',
  defaultGeometry: { shape: 'almond', length: 'medium' },
  lengthPreset: 'short-extension',
  appearance,
  intent: { styleDirection: 'classic', occasion: 'wedding' },
  presentationMeta: { masterFinger: 'R4' },
  nails,
  recipeInstances: {
    recipe_instance_fixture: {
      id: 'recipe_instance_fixture',
      recipeId: 'recipe_fixture',
      recipe: {
        recipeRef: { id: 'recipe_fixture', version: 1 },
        parameters: { accent: '#F7F2EC' },
      },
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
    },
  },
  communicationRefs: [{
    id: 'communication_fixture_01',
    dataUrl: 'data:image/png;base64,AA==',
    caption: 'Anonymous reference',
    uploadedAt: '2026-01-03T00:00:00.000Z',
  }],
  outputIntent: 'customer',
  revision: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-06T00:00:00.000Z',
};
