/**
 * Anonymous executable storage fixtures. v1-v3 mirror mainline model history;
 * v4-v5 mirror the Cursor model/migration history listed in README.md.
 */

export const FINGER_CODES = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];

const transform = { x: 0, y: -12, scale: 1, rotation: 0 };
const appearance = {
  baseCoverage: 'opaque',
  opticalEffect: 'pearl',
  topFinish: 'gloss',
};

const legacyBrushV1 = {
  id: 'brush_legacy_01',
  kind: 'brush',
  points: [{ x: 0, y: -8 }, { x: 2, y: -14 }],
  color: '#F7F2EC',
  size: 5,
  opacity: 0.8,
};

const legacyBrushV2 = {
  ...legacyBrushV1,
  name: 'Anonymous stroke',
  visible: true,
  locked: false,
  order: 0,
  source: 'manual',
};

export const editorDocV1Fixture = {
  schemaVersion: 1,
  designId: 'design_fixture_v1',
  customerId: 'customer_fixture',
  shape: 'almond',
  length: 'medium',
  finish: 'pearl',
  baseColor: '#D8B7AA',
  pattern: [legacyBrushV1],
  attachments: [{
    id: 'attachment_legacy_01',
    kind: 'attachment',
    decorationId: 'decoration_fixture_pearl',
    name: 'Anonymous pearl',
    transform,
    heightMm: 0.12,
  }],
  fingerLocks: {},
  masterFinger: 'R4',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const editorDocV2Fixture = {
  schemaVersion: 2,
  designId: 'design_fixture_v2',
  shape: 'almond',
  length: 'medium',
  lengthPreset: 'short-extension',
  appearance,
  intent: { styleDirection: 'classic', occasion: 'wedding' },
  baseColor: '#D8B7AA',
  pattern: [legacyBrushV2],
  attachments: [],
  fingerLocks: {
    L1: {
      baseColor: '#CFA89B',
      pattern: [{ ...legacyBrushV2, id: 'brush_legacy_l1' }],
      attachments: [],
    },
  },
  masterFinger: 'R4',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

export const editorDocV3Fixture = {
  schemaVersion: 3,
  designId: 'design_fixture_v3',
  customerId: 'customer_fixture',
  shape: 'almond',
  length: 'medium',
  lengthPreset: 'short-extension',
  appearance,
  intent: { styleDirection: 'classic', lookPresetId: 'look_fixture' },
  baseColor: '#D8B7AA',
  pattern: [legacyBrushV2],
  attachments: [],
  recipe: {
    recipeRef: { id: 'recipe_fixture', version: 1 },
    parameters: { accent: '#F7F2EC' },
  },
  relief: [{
    id: 'relief_legacy_01',
    kind: 'relief',
    name: 'Anonymous relief',
    visible: true,
    locked: false,
    order: 0,
    heightMm: 0.1,
    transform,
  }],
  fingerLocks: {},
  masterFinger: 'R4',
  updatedAt: '2026-01-03T00:00:00.000Z',
};

function observedNails(schemaVersion) {
  return Object.fromEntries(FINGER_CODES.map((finger) => [
    finger,
    {
      finger,
      ...(finger === 'L1' ? { geometryOverride: { shape: 'oval', length: 'short' } } : {}),
      layers: [
        {
          id: `layer_base_${finger}`,
          name: 'Base surface',
          typeId: 'builtin.base_surface',
          visible: true,
          locked: false,
          order: 0,
          designRole: 'base',
          processTag: 'unassigned',
          validation: 'simulated',
          surface: { baseColor: finger === 'L1' ? '#CFA89B' : '#D8B7AA', appearance },
          elements: [],
          ...(schemaVersion === 5 ? { stepId: 'base_color' } : {}),
        },
        {
          id: `layer_recipe_${finger}`,
          name: 'Recipe',
          typeId: 'builtin.recipe',
          visible: true,
          locked: false,
          order: 1,
          designRole: 'custom',
          processTag: 'unassigned',
          validation: 'simulated',
          recipeInstanceId: 'recipe_instance_fixture',
          elements: [],
          ...(schemaVersion === 5 ? { stepId: 'add_effects' } : {}),
        },
      ],
    },
  ]));
}

function observedCursorFixture(schemaVersion) {
  return {
    schemaVersion,
    designId: `design_fixture_v${schemaVersion}`,
    customerId: 'customer_fixture',
    title: 'Anonymous layered design',
    defaultGeometry: { shape: 'almond', length: 'medium' },
    lengthPreset: 'short-extension',
    appearance,
    intent: { styleDirection: 'classic', occasion: 'wedding' },
    presentationMeta: { masterFinger: 'R4' },
    nails: observedNails(schemaVersion),
    layerTypes: {},
    recipeInstances: {
      recipe_instance_fixture: {
        id: 'recipe_instance_fixture',
        recipeId: 'recipe_fixture',
        instance: editorDocV3Fixture.recipe,
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    },
    communicationRefs: [{
      id: 'communication_fixture_01',
      dataUrl: 'data:image/png;base64,AA==',
      caption: 'Anonymous reference',
      uploadedAt: '2026-01-03T00:00:00.000Z',
    }],
    updatedAt: `2026-01-0${schemaVersion}T00:00:00.000Z`,
  };
}

export const editorDocV4Fixture = observedCursorFixture(4);
export const editorDocV5Fixture = observedCursorFixture(5);

export const legacyEditorDocFixtures = [
  editorDocV1Fixture,
  editorDocV2Fixture,
  editorDocV3Fixture,
  editorDocV4Fixture,
  editorDocV5Fixture,
];
