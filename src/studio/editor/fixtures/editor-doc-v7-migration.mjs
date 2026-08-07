import { FINGER_CODES } from './legacy/index.mjs';

export function createEditorDocV6MigrationFixture() {
  const nails = Object.fromEntries(FINGER_CODES.map((finger) => [finger, {
    finger,
    layers: [{
      id: `layer_v6_minimal_base_${finger}`,
      name: 'Base surface',
      typeId: 'builtin.base_surface',
      visible: true,
      locked: false,
      order: 0,
      surface: { baseColor: finger === 'L1' ? '#CFA89B' : '#D8B7AA' },
      elements: [],
    }],
  }]));
  return {
    schemaVersion: 6,
    designId: 'design.v6.migration.minimal',
    customerId: 'customer.reference.17',
    title: 'Minimal V6 migration source',
    defaultGeometry: { shape: 'almond', length: 'medium' },
    lengthPreset: 'short-extension',
    appearance: { baseCoverage: 'opaque', opticalEffect: 'none', topFinish: 'gloss' },
    presentationMeta: { masterFinger: 'R4' },
    nails,
    recipeInstances: {},
    communicationRefs: [],
    outputIntent: 'design',
    revision: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  };
}

export function createEditorDocV6MissingFinishFixture() {
  const doc = createEditorDocV6MigrationFixture();
  delete doc.appearance.topFinish;
  return doc;
}

export function createEditorDocV6UnknownLayerFixture() {
  const doc = createEditorDocV6MigrationFixture();
  doc.nails.L1.layers.push({
    id: 'layer_v6_unknown_L1',
    name: 'Unknown legacy visual',
    typeId: 'vendor.legacy.visual',
    visible: true,
    locked: false,
    order: 1,
    elements: [],
  });
  return doc;
}

export function createEditorDocV6UnknownRecipeFixture() {
  const doc = createEditorDocV6MigrationFixture();
  doc.recipeInstances['recipe.instance.opaque'] = {
    id: 'recipe.instance.opaque',
    recipeId: 'recipe.opaque',
    recipe: { opaqueLegacyBody: { nested: true } },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  doc.nails.L1.layers.push({
    id: 'layer_v6_recipe_L1',
    name: 'Opaque recipe',
    typeId: 'builtin.recipe',
    visible: true,
    locked: false,
    order: 1,
    recipeInstanceId: 'recipe.instance.opaque',
    elements: [],
  });
  return doc;
}

export function createEditorDocV6MissingBackgroundFixture() {
  const doc = createEditorDocV6MigrationFixture();
  doc.nails.L1.layers = [];
  return doc;
}

export const EDITOR_DOC_V7_FUTURE_FIXTURE = {
  schemaVersion: 8,
  designId: 'design.future.v8',
};

export const EDITOR_DOC_V7_INVALID_FIXTURE = {
  schemaVersion: 7,
  designId: 'design.invalid.v7',
};
