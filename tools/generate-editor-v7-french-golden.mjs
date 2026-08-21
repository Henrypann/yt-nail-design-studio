#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compileFrenchPathV1,
  enumerateFrenchGoldenBindingsV1,
  enumerateFrenchGoldenCasesV1,
  FRENCH_ANALYTIC_ROOT_TOLERANCE_V1,
  FRENCH_BOUNDARY_CONTAINMENT_SAMPLES_V1,
  FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1,
  FRENCH_CANVAS_CENTER_U_TOLERANCE_V1,
  FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1,
  FRENCH_CONTOUR_MAX_POINTS_V1,
  FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1,
  FRENCH_PATH_COMPILER_REVISION_V1,
  FRENCH_WING_ON_CONTOUR_TOLERANCE_V1,
} from '../src/studio/editor/v7/french-compiler-v1.ts';
import {
  FRENCH_GOLDEN_FINGER_V1,
  resolveExactFrenchGeometryInputV1,
  sha256Hex,
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
const manifestPath = path.join(evidenceDir, 'golden-manifest.json');
const update = process.argv.includes('--update');

function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

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

function fileRecord(fileName, bytes) {
  return {
    fileName,
    byteLength: utf8ByteLength(bytes),
    sha256: sha256Hex(bytes),
  };
}

/** Collection digest hashes per-file name/bytes/sha256 only. It never hashes itself. */
function collectionDigestFromFiles(files) {
  const canonical = [...files]
    .sort((left, right) => left.fileName.localeCompare(right.fileName))
    .map((item) => `${item.fileName.length}:${item.fileName}:${item.byteLength}:${item.sha256}`)
    .join('\n');
  return sha256Hex(canonical);
}

function buildExpectedEvidence() {
  const goldens = enumerateFrenchGoldenCasesV1().map((item) => {
    const { geometry, compiled } = compileBinding(item.shape, item.length, item.preset, item.finger);
    const fileName = `${item.shape}-${item.length}-${item.preset}.svg`;
    const svg = reviewSvg(geometry.contourPathData, compiled.fillPathData, compiled.boundaryPathData, item.id);
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
      viewBox: geometry.viewBox,
      canvasCenterU: geometry.canvasCenterU,
      cacheKey: compiled.cacheIdentity.cacheKey,
      bindingKey: compiled.cacheIdentity.bindingKey,
      fidelity: compiled.fidelity,
      manufacturingValidated: compiled.manufacturingValidated,
      boundaryPathData: compiled.boundaryPathData,
      fillPathData: compiled.fillPathData,
      anchors: compiled.anchors,
      svg,
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

  const svgFiles = goldens
    .map((item) => fileRecord(item.fileName, item.svg))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
  const collectionDigest = collectionDigestFromFiles(svgFiles);

  const manifest = {
    checkpoint: 'EDITOR-v0.7.2-FRENCH-02',
    compilerRevision: FRENCH_PATH_COMPILER_REVISION_V1,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    representativeFinger: FRENCH_GOLDEN_FINGER_V1,
    productGeometryRevision: PRODUCT_GEOMETRY_REVISION_V7,
    registryAssetSetSha256: PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
    evidence: 'prototype',
    bindingRole: 'property-evidence',
    visualSignoff: false,
    manufacturingValidated: false,
    contourContract: {
      source: 'exact-bezier',
      derivedCap: 'deterministic-adaptive-flatten',
      flatnessTolerance: FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1,
      maxSubdivisionDepth: FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1,
      maxPoints: FRENCH_CONTOUR_MAX_POINTS_V1,
      wingOnContourTolerance: FRENCH_WING_ON_CONTOUR_TOLERANCE_V1,
      analyticRootTolerance: FRENCH_ANALYTIC_ROOT_TOLERANCE_V1,
      canvasCenterUTolerance: FRENCH_CANVAS_CENTER_U_TOLERANCE_V1,
      boundaryContainmentTolerance: FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1,
      boundaryContainmentSamples: FRENCH_BOUNDARY_CONTAINMENT_SAMPLES_V1,
      manufacturingValidated: false,
      physicalExactness: false,
    },
    goldenCount: goldens.length,
    bindingCount: bindings.length,
    svgFiles,
    collectionDigest,
    goldens: goldens.map(({ svg: _svg, ...item }) => item),
    bindings,
  };

  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  if (`${JSON.stringify(JSON.parse(manifestBytes), null, 2)}\n` !== manifestBytes) {
    throw new Error('golden manifest JSON is not stable under parse/stringify');
  }
  if (manifest.goldens.length !== 60) throw new Error(`expected 60 goldens, got ${manifest.goldens.length}`);
  if (manifest.bindings.length !== 600) throw new Error(`expected 600 bindings, got ${manifest.bindings.length}`);
  if (manifest.svgFiles.length !== 60) throw new Error(`expected 60 svg file records, got ${manifest.svgFiles.length}`);
  if (manifest.collectionDigest !== collectionDigestFromFiles(manifest.svgFiles)) {
    throw new Error('collection digest is not a pure function of per-file records');
  }

  return { goldens, bindings, manifest, manifestBytes };
}

async function readCommittedOrMissing(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function checkCommitted(expected) {
  const errors = [];
  const committedManifest = await readCommittedOrMissing(manifestPath);
  if (committedManifest === null) {
    errors.push(`missing committed manifest: ${path.relative(root, manifestPath)}`);
  } else if (committedManifest !== expected.manifestBytes) {
    errors.push('golden-manifest.json byte drift versus independently computed current output');
  }

  let listed = [];
  try {
    listed = (await readdir(svgDir)).filter((name) => name.endsWith('.svg')).sort();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      errors.push(`missing svg directory: ${path.relative(root, svgDir)}`);
    } else {
      throw error;
    }
  }

  const expectedNames = expected.goldens.map((item) => item.fileName).sort();
  const extra = listed.filter((name) => !expectedNames.includes(name));
  const missing = expectedNames.filter((name) => !listed.includes(name));
  if (extra.length > 0) errors.push(`extra stale SVGs: ${extra.join(', ')}`);
  if (missing.length > 0) errors.push(`missing SVGs: ${missing.join(', ')}`);

  for (const golden of expected.goldens) {
    const committed = await readCommittedOrMissing(path.join(svgDir, golden.fileName));
    if (committed === null) {
      errors.push(`missing SVG bytes: ${golden.fileName}`);
      continue;
    }
    if (committed !== golden.svg) {
      errors.push(`SVG byte drift: ${golden.fileName}`);
    }
    const record = expected.manifest.svgFiles.find((item) => item.fileName === golden.fileName);
    if (!record) {
      errors.push(`manifest missing svg file record: ${golden.fileName}`);
      continue;
    }
    if (record.sha256 !== sha256Hex(committed) || record.byteLength !== utf8ByteLength(committed)) {
      errors.push(`manifest sha256/byteLength mismatch: ${golden.fileName}`);
    }
  }

  const committedParsed = committedManifest ? JSON.parse(committedManifest) : null;
  if (committedParsed) {
    if (committedParsed.visualSignoff === true) {
      errors.push('committed manifest must not self-certify visual sign-off');
    }
    if (committedParsed.reviewerApproval) {
      errors.push('committed manifest must not store a reviewer approval');
    }
    if (committedParsed.bindingRole !== 'property-evidence') {
      errors.push('600 bindings must be labeled property-evidence, not visually signed golden');
    }
    if (committedParsed.collectionDigest !== expected.manifest.collectionDigest) {
      errors.push('collection digest drift versus independently computed file records');
    }
  }

  if (errors.length > 0) {
    throw new Error(`FRENCH-02 golden check failed:\n- ${errors.join('\n- ')}`);
  }
}

const expected = buildExpectedEvidence();

if (update) {
  await mkdir(svgDir, { recursive: true });
  for (const golden of expected.goldens) {
    await writeFile(path.join(svgDir, golden.fileName), golden.svg);
  }
  await writeFile(manifestPath, expected.manifestBytes);
  await checkCommitted(expected);
  console.log(
    `updated ${expected.goldens.length} golden SVGs and ${expected.bindings.length} property-evidence bindings in ${path.relative(root, evidenceDir)} digest=${expected.manifest.collectionDigest}`,
  );
} else {
  await checkCommitted(expected);
  console.log(
    `checked ${expected.goldens.length} committed SVGs and golden-manifest.json against independently computed bytes digest=${expected.manifest.collectionDigest}`,
  );
}
