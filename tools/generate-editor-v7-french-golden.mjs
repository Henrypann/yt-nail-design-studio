#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compileFrenchPathV1,
  enumerateFrenchGoldenBindingsV1,
  enumerateFrenchGoldenCasesV1,
  FRENCH_ANALYTIC_ROOT_TOLERANCE_V1,
  FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1,
  FRENCH_CONTOUR_MAX_POINTS_V1,
  FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1,
  FRENCH_PATH_COMPILER_REVISION_V1,
  FRENCH_WING_ON_CONTOUR_TOLERANCE_V1,
} from '../src/studio/editor/v7/french-compiler-v1.ts';
import {
  FRENCH_GOLDEN_FINGER_V1,
  resolveExactFrenchGeometryInputV1,
} from '../src/studio/editor/v7/french-geometry-input-v1.ts';
import {
  createDefaultFrenchRecipeParametersV1,
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_REVISION_V1,
} from '../src/studio/editor/v7/french-recipe-v1.ts';
import {
  parseNailPathDataV7,
} from '../src/studio/editor/v7/flat-vector.ts';
import {
  PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
  PRODUCT_GEOMETRY_REVISION_V7,
  resolveSignedProductGeometryRefV7,
} from '../src/studio/editor/v7/geometry-registry.ts';

const root = path.resolve(import.meta.dirname, '..');
const evidenceDir = path.join(root, 'evidence/pr-editor-v0-7-2-french-02');
const svgDir = path.join(evidenceDir, 'svg');

function scalePath(pathData, width, height) {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) throw new Error(`review path is not canonical: ${pathData.slice(0, 80)}`);
  return parsed.commands
    .map(({ command, values }) => {
      if (command === 'Z') return 'Z';
      const scaled = values.map((value, index) => Number((index % 2 === 0 ? value * width : value * height).toFixed(5)));
      return `${command}${scaled.join(' ')}`;
    })
    .join(' ');
}

function reviewSvg(contourPathData, fillPathData, boundaryPathData, label) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160" width="200" height="320">',
    `<title>${label}</title>`,
    '<rect width="100" height="160" fill="#f6f1ec"/>',
    `<path d="${scalePath(contourPathData, 100, 160)}" fill="#efe6de" stroke="#b7a79c" stroke-width="0.8"/>`,
    `<path d="${scalePath(fillPathData, 100, 160)}" fill="#fffdf9" fill-opacity="0.96"/>`,
    `<path d="${scalePath(boundaryPathData, 100, 160)}" fill="none" stroke="#c45c6a" stroke-width="1.1" stroke-linecap="round"/>`,
    `<text x="50" y="154" text-anchor="middle" font-size="6" fill="#6f625b">${label}</text>`,
    '</svg>',
    '',
  ].join('\n');
}

function compileBinding(shape, length, preset, finger) {
  const ref = resolveSignedProductGeometryRefV7(shape, length, finger);
  if (!ref) throw new Error(`missing signed geometry ${shape}/${length}/${finger}`);
  const geometry = resolveExactFrenchGeometryInputV1(ref, finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  if (!geometry.ok) throw new Error(`exact geometry unavailable ${shape}/${length}/${finger}: ${JSON.stringify(geometry.diagnostics)}`);
  const compiled = compileFrenchPathV1(geometry.geometry, createDefaultFrenchRecipeParametersV1(preset));
  if (!compiled.ok) throw new Error(`compile failed ${shape}/${length}/${preset}/${finger}: ${JSON.stringify(compiled.diagnostics)}`);
  return { ref, geometry: geometry.geometry, compiled };
}

await mkdir(svgDir, { recursive: true });

const goldens = enumerateFrenchGoldenCasesV1().map((item) => {
  const { geometry, compiled } = compileBinding(item.shape, item.length, item.preset, item.finger);
  const fileName = `${item.shape}-${item.length}-${item.preset}.svg`;
  return {
    id: item.id,
    shape: item.shape,
    length: item.length,
    preset: item.preset,
    finger: item.finger,
    fileName,
    assetId: geometry.assetId,
    revision: geometry.revision,
    registryAssetSetSha256: geometry.registryAssetSetSha256,
    contourIdentity: geometry.contourIdentity,
    cacheKey: compiled.cacheIdentity.cacheKey,
    bindingKey: compiled.cacheIdentity.bindingKey,
    fidelity: compiled.fidelity,
    manufacturingValidated: compiled.manufacturingValidated,
    boundaryPathData: compiled.boundaryPathData,
    fillPathData: compiled.fillPathData,
    anchors: compiled.anchors,
    svg: reviewSvg(geometry.contourPathData, compiled.fillPathData, compiled.boundaryPathData, item.id),
  };
});

const bindings = enumerateFrenchGoldenBindingsV1().map((item) => {
  const { geometry, compiled } = compileBinding(item.shape, item.length, item.preset, item.finger);
  return {
    id: `${item.id}.${item.finger}`,
    goldenId: item.id,
    shape: item.shape,
    length: item.length,
    preset: item.preset,
    finger: item.finger,
    assetId: geometry.assetId,
    revision: geometry.revision,
    registryAssetSetSha256: geometry.registryAssetSetSha256,
    contourIdentity: geometry.contourIdentity,
    cacheKey: compiled.cacheIdentity.cacheKey,
    bindingKey: compiled.cacheIdentity.bindingKey,
    fillPathData: compiled.fillPathData,
    boundaryPathData: compiled.boundaryPathData,
    fidelity: compiled.fidelity,
    manufacturingValidated: compiled.manufacturingValidated,
  };
});

goldens.sort((a, b) => a.id.localeCompare(b.id));
bindings.sort((a, b) => a.id.localeCompare(b.id));

for (const golden of goldens) {
  await writeFile(path.join(svgDir, golden.fileName), golden.svg);
}

const manifest = {
  checkpoint: 'EDITOR-v0.7.2-FRENCH-02',
  compilerRevision: FRENCH_PATH_COMPILER_REVISION_V1,
  recipeId: FRENCH_RECIPE_ID_V1,
  recipeRevision: FRENCH_RECIPE_REVISION_V1,
  representativeFinger: FRENCH_GOLDEN_FINGER_V1,
  productGeometryRevision: PRODUCT_GEOMETRY_REVISION_V7,
  registryAssetSetSha256: PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
  evidence: 'prototype',
  manufacturingValidated: false,
  contourContract: {
    source: 'exact-bezier',
    derivedCap: 'deterministic-adaptive-flatten',
    flatnessTolerance: FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1,
    maxSubdivisionDepth: FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1,
    maxPoints: FRENCH_CONTOUR_MAX_POINTS_V1,
    wingOnContourTolerance: FRENCH_WING_ON_CONTOUR_TOLERANCE_V1,
    analyticRootTolerance: FRENCH_ANALYTIC_ROOT_TOLERANCE_V1,
    manufacturingValidated: false,
    physicalExactness: false,
  },
  goldenCount: goldens.length,
  bindingCount: bindings.length,
  goldens: goldens.map(({ svg: _svg, ...item }) => item),
  bindings,
};

const manifestPath = path.join(evidenceDir, 'golden-manifest.json');
const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(manifestPath, manifestBytes);
const roundTrip = `${JSON.stringify(JSON.parse(await readFile(manifestPath, 'utf8')), null, 2)}\n`;
if (roundTrip !== manifestBytes) throw new Error('golden manifest JSON is not stable under parse/stringify');
if (manifest.goldens.length !== 60) throw new Error(`expected 60 goldens, got ${manifest.goldens.length}`);
if (manifest.bindings.length !== 600) throw new Error(`expected 600 bindings, got ${manifest.bindings.length}`);
console.log(`wrote ${manifest.goldens.length} golden SVGs and ${manifest.bindings.length} bindings to ${path.relative(root, evidenceDir)}`);
