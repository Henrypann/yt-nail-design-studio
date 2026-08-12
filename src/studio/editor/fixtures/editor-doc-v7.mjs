const FINGERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

export const COLORS_V7 = {
  red: { colorSpace: 'srgb', r: 220, g: 34, b: 64, a: 1 },
  pink: { colorSpace: 'srgb', r: 244, g: 147, b: 177, a: 0.82 },
  white: { colorSpace: 'srgb', r: 255, g: 255, b: 255, a: 1 },
  black: { colorSpace: 'srgb', r: 16, g: 16, b: 18, a: 1 },
};

const transform = (u = 0.5, v = 0.5) => ({
  position: { u, v },
  scaleX: 1,
  scaleY: 1,
  rotationDeg: 0,
});

const mask = (suffix = 'base') => ({
  coordinateSpace: 'nail-local-v1',
  pathData: `M0.1 0.2 L0.9 0.2 L0.8 0.8 Z ${suffix}`,
  fillRule: 'nonzero',
  inverted: false,
});

const material = (suffix = 'gel') => ({ materialId: `material.${suffix}`, revision: '1' });

const asset = (suffix, kind = 'raster', mimeType = 'image/png', sha256 = SHA_A) => ({
  assetId: `asset.${suffix}`,
  revision: '1',
  kind,
  mimeType,
  sha256,
  widthPx: 1024,
  heightPx: 1024,
  colorSpace: 'srgb',
  alphaMode: 'straight',
});

const stepBase = (finger, suffix, kind, visible = true, skipped = false) => ({
  id: `step.${finger}.${suffix}`,
  typeId: `builtin.v7.${kind}`,
  kind,
  name: suffix,
  visible,
  locked: false,
  skipped,
  materialRefs: [],
});

const backgroundFor = (finger, index, minimal = false) => {
  const common = stepBase(finger, 'background', 'background', minimal ? true : finger !== 'R5');
  if (minimal || index === 0) {
    return { ...common, background: { mode: 'solid', opacity: 1, color: COLORS_V7.red } };
  }
  if (index === 1) {
    return {
      ...common,
      background: {
        mode: 'translucent', opacity: 0.72, color: COLORS_V7.pink,
        materialPresetRef: { id: 'preset.jelly', revision: '2' },
      },
    };
  }
  if (index === 2) {
    return {
      ...common,
      background: {
        mode: 'gradient', opacity: 1, directionDeg: 135,
        stops: [{ offset: 0, color: COLORS_V7.white }, { offset: 0.4, color: COLORS_V7.pink }, { offset: 1, color: COLORS_V7.red }],
      },
    };
  }
  if (index === 3) {
    return {
      ...common,
      background: {
        mode: 'cat_eye', opacity: 1, color: COLORS_V7.pink, directionDeg: 45,
        intensity: 0.7, bandWidth: 0.2, previewFidelity: 'approximate',
      },
    };
  }
  return structuredClone({
    ...common,
    background: {
      mode: 'glitter', opacity: 0.95, colors: [COLORS_V7.white, COLORS_V7.pink],
      density: 0.5, particleSizeMm: 0.18, seed: `glitter-${finger}`,
      previewFidelity: 'approximate',
    },
  });
};

const finishFor = (finger, index) => ({
  ...stepBase(finger, 'finish', 'surface_finish'),
  materialRefs: [material(`finish-${index % 3}`)],
  finish: {
    type: ['gloss', 'matte', 'frosted'][index % 3],
    materialPresetRef: { id: `preset.finish-${index % 3}`, revision: '1' },
  },
});

const fullMiddleSteps = (finger) => [
  {
    ...stepBase(finger, 'flat', 'flat_design'),
    mask: mask('flat'),
    elements: [
      { id: `element.${finger}.brush`, kind: 'brush_stroke', visible: true, locked: false, opacity: 1, transform: transform(), points: [{ u: 0.1, v: 0.1 }, { u: 0.9, v: 0.8 }], color: COLORS_V7.red, widthMm: 0.35 },
      { id: `element.${finger}.eraser`, kind: 'eraser_mask', visible: true, locked: false, opacity: 1, transform: transform(), path: [{ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.7 }], widthMm: 0.25 },
      { id: `element.${finger}.vector`, kind: 'vector_shape', visible: true, locked: false, opacity: 0.9, transform: transform(), pathData: 'M0.2 0.2 L0.8 0.8 Z', fill: COLORS_V7.pink, stroke: COLORS_V7.white, strokeWidthMm: 0.12 },
      { id: `element.${finger}.text`, kind: 'text', visible: true, locked: false, opacity: 1, transform: transform(), text: 'V7', fontRef: { id: 'font.inter', revision: '1' }, fontSizeMm: 2.4, color: COLORS_V7.black },
      { id: `element.${finger}.image`, kind: 'image_2d', visible: true, locked: false, opacity: 1, transform: transform(), role: 'sticker', asset: asset(`sticker-${finger}`) },
      { id: `element.${finger}.french`, kind: 'french_edge', visible: true, locked: false, opacity: 1, transform: transform(), widthRatio: 0.22, curvature: 0.3, color: COLORS_V7.white },
      { id: `element.${finger}.mask`, kind: 'region_mask', visible: true, locked: true, opacity: 1, transform: transform(), mask: mask('element') },
    ],
  },
  {
    ...stepBase(finger, 'effect-cat-eye', 'surface_effect'),
    recipeInstanceId: 'recipe.cat-eye.1',
    materialRefs: [material('magnetic-gel')],
    effect: { effectType: 'cat_eye', directionDeg: 90, intensity: 0.8, bandWidth: 0.22, previewFidelity: 'approximate' },
    mask: mask('effect'),
  },
  {
    ...stepBase(finger, 'effect-glitter', 'surface_effect', true, true),
    effect: { effectType: 'glitter', density: 0.45, particleSizeMm: 0.12, seed: 'effect-glitter', previewFidelity: 'exact' },
    mask: mask('glitter'),
  },
  {
    ...stepBase(finger, 'effect-mirror', 'surface_effect'),
    effect: { effectType: 'mirror', tint: COLORS_V7.white, reflectance: 0.88, previewFidelity: 'approximate' },
    mask: mask('mirror'),
  },
  {
    ...stepBase(finger, 'effect-ink', 'surface_effect'),
    effect: { effectType: 'ink_bloom', colors: [COLORS_V7.red, COLORS_V7.pink], spread: 0.6, seed: 'ink-bloom', previewFidelity: 'unavailable' },
    mask: mask('ink'),
  },
  {
    ...stepBase(finger, 'decoration', 'dimensional_decoration'),
    materialRefs: [material('resin')],
    decorations: [
      { id: `element.${finger}.relief`, kind: 'relief_2_5d', visible: true, locked: false, transform: transform(0.35, 0.5), heightMm: 0.45, materialRef: material('relief'), previewFidelity: 'exact', outline: mask('relief') },
      { id: `element.${finger}.attachment`, kind: 'attachment_3d', visible: true, locked: false, transform: transform(0.65, 0.4), heightMm: 1.4, materialRef: material('metal'), previewFidelity: 'approximate', asset: asset(`charm-${finger}`, 'mesh', 'model/gltf-binary', SHA_B), anchor: { u: 0.65, v: 0.4 } },
    ],
  },
];

export function createMinimalEditorDocV7Fixture() {
  const nails = Object.fromEntries(FINGERS.map((finger, index) => [finger, {
    finger,
    geometryRef: { assetId: `geometry.almond.medium.${finger}`, revision: 'geometry-v1-p3-c1-adde3f42d79d7b561eb32759ba75a1171bdc0c263d1909b787ea86b0831897ba' },
    steps: [backgroundFor(finger, index, true), finishFor(finger, index)],
  }]));
  return structuredClone({
    schemaVersion: 7,
    designId: 'design.v7.minimal',
    title: 'Minimal V7 Contract',
    nails,
    recipeInstances: {},
    sourceRefs: [],
    communicationRefs: [],
    outputIntent: 'design',
    revision: 1,
    createdAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T01:00:00.000Z',
  });
}

export function createFullEditorDocV7Fixture() {
  const compositionMeta = {
    compositionId: 'composition.summer-set', revision: '3',
    source: { domain: 'community', sourceId: 'community.design.42', revision: '8' },
  };
  const nails = Object.fromEntries(FINGERS.map((finger, index) => [finger, {
    finger,
    geometryRef: { assetId: `geometry.almond.medium.${finger}`, revision: 'geometry-v1-p3-c1-adde3f42d79d7b561eb32759ba75a1171bdc0c263d1909b787ea86b0831897ba' },
    steps: [backgroundFor(finger, index), ...(index === 0 ? fullMiddleSteps(finger) : []), finishFor(finger, index)],
    compositionProvenance: { compositionId: compositionMeta.compositionId, revision: compositionMeta.revision, syncState: index === 9 ? 'detached' : 'linked' },
  }]));
  return structuredClone({
    schemaVersion: 7,
    designId: 'design.v7.full',
    customerRef: 'customer.reference.17',
    title: 'Full V7 Contract',
    nails,
    recipeInstances: {
      'recipe.cat-eye.1': {
        instanceId: 'recipe.cat-eye.1', recipeId: 'recipe.cat-eye', recipeRevision: '2',
        parameterValues: { passes: 2, magnetMode: 'diagonal', enabled: true },
      },
    },
    compositionMeta,
    sourceRefs: [
      { domain: 'community', sourceId: 'community.design.42', revision: '8' },
      { domain: 'manual', sourceId: 'manual.session.7' },
    ],
    communicationRefs: [{
      communicationId: 'communication.reference.1',
      asset: asset('consultation-preview'),
      caption: 'Customer confirmed reference',
      createdAt: '2026-08-07T01:02:00.000Z',
    }],
    outputIntent: 'customer',
    revision: 4,
    createdAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T02:00:00.000Z',
  });
}

export const EDITOR_DOC_V7_MINIMAL_FIXTURE = createMinimalEditorDocV7Fixture();
export const EDITOR_DOC_V7_FULL_FIXTURE = createFullEditorDocV7Fixture();
