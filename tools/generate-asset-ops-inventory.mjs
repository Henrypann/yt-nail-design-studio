#!/usr/bin/env node

/**
 * ASSET-GEN-01: read-only, deterministic inventory/gap analyzer.
 *
 * This tool deliberately does not infer promotion, manufacturing readiness, or
 * makeability from a thumbnail. It only checks the checked-in index, manifests,
 * and referenced files, then emits an auditable gap report.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const INVENTORY_SCHEMA = 'asset-ops-inventory-v1';
export const INVENTORY_CLASSIFICATIONS = Object.freeze([
  'already_valid_legacy',
  'metadata_migration_required',
  'candidate_only',
  'already_valid_simulated_pack',
  'missing_binary',
  'mapping_mismatch',
]);

const FORMAL_SHAPES = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const FINGERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];

function fail(message) {
  throw new Error(`ASSET-GEN-01 fail-closed: ${message}`);
}

function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} does not exist: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function relativePath(rootDir, value) {
  if (typeof value !== 'string' || value.trim() === '') fail('asset path must be a non-empty string');
  const normalized = value.replace(/^\/+/, '');
  const absolute = path.resolve(rootDir, normalized);
  const relative = path.relative(rootDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`asset path escapes repository: ${value}`);
  return absolute;
}

function resolveAssetPath(rootDir, baseDir, value) {
  if (typeof value !== 'string' || value.trim() === '') fail('manifest asset path must be a non-empty string');
  const normalized = value.replace(/^\/+/, '');
  // Asset URLs in the repository use either a root-relative `assets/...` path
  // or a manifest-relative `patterns/...` path.
  return normalized.startsWith('assets/')
    ? relativePath(rootDir, normalized)
    : relativePath(rootDir, path.relative(rootDir, path.resolve(baseDir, normalized)));
}

function fileFact(rootDir, file, declaredPath, expected = null) {
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  const fact = { path: path.relative(rootDir, file).split(path.sep).join('/'), declaredPath, exists };
  if (!exists) return fact;
  const bytes = fs.readFileSync(file);
  fact.byteLength = bytes.byteLength;
  fact.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (expected?.sha256 !== undefined) {
    if (typeof expected.sha256 !== 'string' || fact.sha256 !== expected.sha256) {
      fail(`sha256 mismatch for ${fact.path}: declared=${expected.sha256}, actual=${fact.sha256}`);
    }
  }
  if (expected?.byteLength !== undefined) {
    if (!Number.isInteger(expected.byteLength) || fact.byteLength !== expected.byteLength) {
      fail(`byteLength mismatch for ${fact.path}: declared=${expected.byteLength}, actual=${fact.byteLength}`);
    }
  }
  return fact;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) fail(`${label} contains duplicate ids: ${[...new Set(duplicates)].join(', ')}`);
}

function summarizeFileFacts(facts) {
  return facts.filter((fact) => !fact.exists).map((fact) => fact.path).sort();
}

function classifyTemplate({ entry, manifest, missingFiles, mappingMismatch }) {
  if (missingFiles.length) return 'missing_binary';
  if (entry.asset_status === undefined) return 'metadata_migration_required';
  if (entry.asset_status === 'SIMULATED') return 'already_valid_simulated_pack';
  if (entry.asset_status === 'LEGACY' || entry.asset_status === 'REAL') return 'already_valid_legacy';
  if (entry.asset_status === 'CONCEPT') return 'candidate_only';
  if (mappingMismatch) return 'mapping_mismatch';
  return 'mapping_mismatch';
}

function analyzeTemplate(rootDir, entry, knownTemplateIds) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') fail('template entry missing id');
  const manifestUrl = entry.manifest_url;
  const manifestFile = relativePath(rootDir, manifestUrl);
  const manifest = readJson(manifestFile, `template ${entry.id} manifest`);
  // The original simulated Petal Pearl manifest predates template_id. Its
  // index id is the only safe identity fallback; do not apply this fallback to
  // a manifest that claims a conflicting id.
  const manifestTemplateId = manifest.template_id ?? entry.id;
  if (!knownTemplateIds.has(manifestTemplateId)) fail(`template ${entry.id} references unknown manifest template_id ${manifestTemplateId}`);

  const expectedRenderId = entry.render_template_id ?? entry.id;
  const mappingMismatch = entry.render_template_id !== undefined && entry.render_template_id !== manifestTemplateId;
  const mappingNotes = [];
  if (manifest.template_id === undefined) mappingNotes.push('legacy manifest has no template_id; identity taken from index id');
  if (mappingMismatch) {
    mappingNotes.push(`render_template_id=${entry.render_template_id} differs from manifest.template_id=${manifestTemplateId}`);
  }

  const manifestDir = path.dirname(manifestFile);
  const files = [];
  const declaredThumbnail = entry.thumbnail_url;
  if (declaredThumbnail) files.push(fileFact(rootDir, relativePath(rootDir, declaredThumbnail), declaredThumbnail));
  const defaultThumbnail = manifest.thumbnails?.default;
  if (defaultThumbnail) files.push(fileFact(rootDir, resolveAssetPath(rootDir, manifestDir, defaultThumbnail), defaultThumbnail));
  else mappingNotes.push('manifest has no default thumbnail reference');

  const patterns = manifest.patterns && typeof manifest.patterns === 'object' ? manifest.patterns : null;
  if (patterns) {
    for (const shape of FORMAL_SHAPES) {
      const declaredPattern = patterns[shape];
      if (typeof declaredPattern !== 'string') {
        files.push({ path: `${path.relative(rootDir, manifestFile)}/${shape}`, declaredPath: declaredPattern ?? null, exists: false });
      } else {
        files.push(fileFact(rootDir, resolveAssetPath(rootDir, manifestDir, declaredPattern), declaredPattern));
      }
    }
  } else if (Array.isArray(manifest.assets)) {
    // Legacy simulated packs carry their own asset list instead of formal
    // shape patterns. Check every declared binary/vector reference read-only.
    mappingNotes.push('legacy simulated pack has no formal shape pattern map; checked manifest.assets references');
    for (const asset of manifest.assets) {
      if (typeof asset?.path !== 'string') {
        files.push({ path: `${path.relative(rootDir, manifestFile)}/assets`, declaredPath: asset?.path ?? null, exists: false });
      } else {
        files.push(fileFact(rootDir, resolveAssetPath(rootDir, manifestDir, asset.path), asset.path));
      }
    }
  } else {
    fail(`template ${entry.id} manifest missing patterns/assets object`);
  }

  if (entry.render_template_id && !knownTemplateIds.has(entry.render_template_id)) {
    fail(`template ${entry.id} references unknown render_template_id ${entry.render_template_id}`);
  }

  const missingFiles = summarizeFileFacts(files);
  const classification = classifyTemplate({ entry, manifest, missingFiles, mappingMismatch });
  const categories = [classification];
  if (mappingMismatch && !categories.includes('mapping_mismatch')) categories.push('mapping_mismatch');
  if (entry.asset_status === 'CONCEPT' && !categories.includes('candidate_only')) categories.push('candidate_only');
  if (entry.asset_status === 'SIMULATED' && !categories.includes('already_valid_simulated_pack')) categories.push('already_valid_simulated_pack');

  return {
    id: entry.id,
    classification,
    categories,
    assetStatus: entry.asset_status ?? null,
    renderTemplateId: entry.render_template_id ?? null,
    manifestTemplateId,
    manifestUrl,
    manifestAssetStatus: manifest.asset_status ?? null,
    mappingNotes,
    missingFiles,
    references: files.map(({ path: filePath, declaredPath, exists }) => ({ path: filePath, declaredPath, exists })),
  };
}

function analyzeLook(rootDir, entry) {
  if (!entry || typeof entry.lookId !== 'string') fail('look entry missing lookId');
  const manifestFile = relativePath(rootDir, entry.manifest);
  const manifest = readJson(manifestFile, `look ${entry.lookId} manifest`);
  if (manifest.lookId !== entry.lookId) fail(`look ${entry.lookId} manifest lookId mismatch: ${manifest.lookId}`);
  if (manifest.revision !== entry.revision) fail(`look ${entry.lookId} revision mismatch: index=${entry.revision}, manifest=${manifest.revision}`);
  if (manifest.status !== 'SIMULATED_LOOK_ASSET_PACK') fail(`look ${entry.lookId} must be SIMULATED_LOOK_ASSET_PACK, got ${manifest.status}`);
  if (manifest.manufacturingValidated !== false) fail(`look ${entry.lookId} must have manufacturingValidated=false`);
  const manifestDir = path.dirname(manifestFile);
  const assets = manifest.assets;
  if (!assets || typeof assets !== 'object') fail(`look ${entry.lookId} missing assets object`);
  const facts = [];
  const requiredAsset = (name, value) => {
    if (!value || typeof value !== 'object' || typeof value.path !== 'string') {
      facts.push({ path: `missing ${name}`, declaredPath: null, exists: false });
      return;
    }
    facts.push(fileFact(rootDir, resolveAssetPath(rootDir, manifestDir, value.path), value.path, value));
  };
  requiredAsset('highFidelityCover', assets.highFidelityCover);
  requiredAsset('flatVector', assets.flatVector);
  const textureMaps = assets.textureMaps;
  if (!textureMaps || typeof textureMaps !== 'object') fail(`look ${entry.lookId} missing textureMaps`);
  for (const key of ['decal', 'normal', 'roughness', 'height']) requiredAsset(`textureMaps.${key}`, textureMaps[key]);
  if (!Array.isArray(assets.dimensionalAssets) || assets.dimensionalAssets.length === 0) fail(`look ${entry.lookId} missing dimensionalAssets`);
  assets.dimensionalAssets.forEach((asset, index) => requiredAsset(`dimensionalAssets[${index}]`, asset));
  requiredAsset('dimensionalKit', assets.dimensionalKit);
  const resolveRelative = (value) => path.relative(rootDir, resolveAssetPath(rootDir, manifestDir, value)).split(path.sep).join('/');
  if (typeof entry.cover === 'string' && assets.highFidelityCover?.path && resolveRelative(entry.cover) !== resolveRelative(assets.highFidelityCover.path)) {
    fail(`look ${entry.lookId} cover mapping mismatch: index=${entry.cover}, manifest=${assets.highFidelityCover.path}`);
  }
  if (typeof entry.dimensionalKit === 'string' && assets.dimensionalKit?.path && resolveRelative(entry.dimensionalKit) !== resolveRelative(assets.dimensionalKit.path)) {
    fail(`look ${entry.lookId} dimensionalKit mapping mismatch: index=${entry.dimensionalKit}, manifest=${assets.dimensionalKit.path}`);
  }
  // recipe-spec.json is the deterministic recipe companion for every four-look
  // manifest. It has no embedded hash today, so existence is the contract.
  const recipeSpec = path.join(manifestDir, 'recipe-spec.json');
  facts.push(fileFact(rootDir, recipeSpec, 'recipe-spec.json'));
  const missingFiles = summarizeFileFacts(facts);
  if (missingFiles.length) fail(`look ${entry.lookId} references missing binary: ${missingFiles.join(', ')}`);
  const fingers = Object.keys(manifest.fingerAllocation ?? {}).sort();
  if (fingers.length !== FINGERS.length || FINGERS.some((finger) => !fingers.includes(finger))) {
    fail(`look ${entry.lookId} must contain exactly ten finger allocations`);
  }
  return {
    id: entry.lookId,
    classification: 'already_valid_simulated_pack',
    categories: ['already_valid_simulated_pack'],
    revision: manifest.revision,
    manifestUrl: entry.manifest,
    status: manifest.status ?? null,
    visualSignoff: manifest.visualSignoff ?? null,
    manufacturingValidated: false,
    evidenceBoundary: 'simulated/non-manufacturing',
    fingerCount: fingers.length,
    missingFiles: [],
    references: facts,
  };
}

export function generateAssetOpsInventory({ rootDir = process.cwd(), strict = true } = {}) {
  const indexFile = path.join(rootDir, 'material-library/index.json');
  const fourLooksFile = path.join(rootDir, 'assets/hero-recipes/v0-7-2-four-look-sets.json');
  const index = readJson(indexFile, 'material-library/index.json');
  const fourLooks = readJson(fourLooksFile, 'four-look asset index');
  if (!Array.isArray(index.templates)) fail('material-library/index.json templates must be an array');
  if (!Array.isArray(fourLooks.entries)) fail('four-look asset index entries must be an array');
  const templateIds = index.templates.map((entry) => entry?.id);
  assertUnique(templateIds, 'template index');
  const lookIds = fourLooks.entries.map((entry) => entry?.lookId);
  assertUnique(lookIds, 'four-look index');
  const knownTemplateIds = new Set(templateIds);
  const templates = index.templates.map((entry) => analyzeTemplate(rootDir, entry, knownTemplateIds)).sort((a, b) => a.id.localeCompare(b.id));
  const looks = fourLooks.entries.map((entry) => analyzeLook(rootDir, entry)).sort((a, b) => a.id.localeCompare(b.id));
  const missing = templates.flatMap((template) => template.missingFiles.map((file) => `${template.id}:${file}`));
  if (strict && missing.length) fail(`missing binary references: ${missing.join(', ')}`);
  const summary = Object.fromEntries(INVENTORY_CLASSIFICATIONS.map((classification) => [classification, 0]));
  for (const template of templates) {
    for (const category of template.categories) summary[category] += 1;
  }
  for (const look of looks) summary[look.classification] += 1;
  return sortKeys({
    schemaVersion: INVENTORY_SCHEMA,
    architectureBaseline: 'v0.7.2',
    generatedFrom: ['material-library/index.json', 'assets/hero-recipes/v0-7-2-four-look-sets.json'],
    summary: {
      templateCount: templates.length,
      lookCount: looks.length,
      classifications: summary,
      formalTemplateMetadataGap: templates.filter((template) => template.classification === 'metadata_migration_required').length === 11,
      fourLookSimulatedNonManufacturing: looks.length === 4 && looks.every((look) => look.manufacturingValidated === false),
    },
    templates,
    looks,
  });
}

function parseArgs(argv) {
  const args = { rootDir: process.cwd(), output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') args.rootDir = path.resolve(argv[++index]);
    else if (arg === '--output') args.output = path.resolve(argv[++index]);
    else if (arg === '--help') return null;
    else fail(`unknown argument ${arg}`);
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args) {
      console.log('Usage: node tools/generate-asset-ops-inventory.mjs [--root DIR] [--output FILE]');
      process.exit(0);
    }
    const report = generateAssetOpsInventory(args);
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (args.output) {
      fs.mkdirSync(path.dirname(args.output), { recursive: true });
      fs.writeFileSync(args.output, output, 'utf8');
    } else {
      process.stdout.write(output);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
