#!/usr/bin/env node

/** ASSET-OPS-02/B4: deterministic governance ledger for current assets. */
import fs from 'node:fs';
import path from 'node:path';

export const GOVERNANCE_SCHEMA = 'asset-ops-governance-v1';
export const LIFECYCLE_STATUSES = Object.freeze(['REAL', 'CONCEPT', 'SIMULATED']);
export const RIGHTS_STATUSES = Object.freeze(['PENDING', 'DECLARED', 'CLEARED', 'REJECTED']);
export const CAPABILITY_STATUSES = Object.freeze(['UNVERIFIED', 'CONCEPT_ONLY']);
export const PROMOTION_STATUSES = Object.freeze(['BLOCKED']);

const TEMPLATE_COUNT = 21;
const LOOK_COUNT = 4;
const FINGERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];
const SHAPES = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const EXPECTED_TEMPLATE_IDS = new Set([
  't_petal_pearl_bloom_simulated', 't_mercury_dew_concept', 't_pearl_tide_shell_concept', 't_micro_coquette_concept',
  't_starfish_bloom_elegance_concept', 't_sea_glass_chrome_concept', 't_sunset_aura_glaze_concept',
  't_liquid_chrome_statement_concept', 't_butter_glaze_quiet_concept', 't_liquid_velvet_cat_eye',
  't_petal_veil_french', 't_french_white', 't_nude_gradient', 't_cat_eye_nude', 't_y2k_ice',
  't_dark_gradient', 't_chrome_mirror', 't_checkerboard', 't_3d_waterdrop', 't_classic_high_gloss', 't_holiday_glitter',
]);
const EXPECTED_LOOK_IDS = new Set(['leopard-gilded-nude', 'crimson-reliquary', 'ivory-lace-crystal', 'honey-petal-glass']);
const ROOT_KEYS = ['architectureBaseline', 'generatedFrom', 'records', 'schemaVersion', 'summary'];
const RECORD_KEYS = [
  'blockingCodes', 'capabilityEvidenceRefs', 'capabilityStatus', 'completeness',
  'evidenceTier', 'lifecycleStatus', 'limitations', 'manifestRefs', 'promotionStatus',
  'recordId', 'rightsEvidenceRefs', 'rightsStatus', 'sourceRefs', 'specRefs', 'subjectId', 'subjectType',
];
const COMPLETENESS_KEYS = ['binaries', 'manifest', 'source', 'spec', 'structure'];
const COMPLETENESS_VALUES = new Set(['PRESENT', 'MISSING', 'DECLARED', 'UNKNOWN']);
const SUMMARY_KEYS = ['lookCount', 'promotionBlockedCount', 'rightsPendingCount', 'templateCount'];

function fail(message) {
  throw new Error(`ASSET-OPS-02 fail-closed: ${message}`);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function exactKeys(value, keys) {
  return !!value && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function string(value) { return typeof value === 'string' && value.length > 0; }
function strings(value) { return Array.isArray(value) && value.every(string) && new Set(value).size === value.length; }
function safeStatus(value, allowed) { return typeof value === 'string' && allowed.includes(value); }

function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} does not exist: ${file}`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}

function safePath(rootDir, value, label) {
  if (!string(value)) fail(`${label} must be a non-empty path`);
  const normalized = value.replace(/^\/+/, '');
  const absolute = path.resolve(rootDir, normalized);
  const relative = path.relative(rootDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`${label} escapes repository: ${value}`);
  return absolute;
}

function resolveManifestPath(rootDir, manifestDir, value, label) {
  if (!string(value)) fail(`${label} must be a non-empty path`);
  const normalized = value.replace(/^\/+/, '');
  return normalized.startsWith('assets/') || normalized.startsWith('material-library/')
    ? safePath(rootDir, normalized, label)
    : safePath(rootDir, path.relative(rootDir, path.resolve(manifestDir, normalized)), label);
}

function fileStatus(file) { return fs.existsSync(file) && fs.statSync(file).isFile() ? 'PRESENT' : 'MISSING'; }
function collectTemplateRefs(rootDir, entry, manifest, manifestFile) {
  const manifestDir = path.dirname(manifestFile);
  const references = [];
  const add = (value, label) => {
    const file = resolveManifestPath(rootDir, manifestDir, value, label);
    references.push({ file, label, declared: value });
  };
  if (entry.thumbnail_url) add(entry.thumbnail_url, `${entry.id}.thumbnail_url`);
  const manifestThumb = manifest.thumbnails?.default;
  if (manifestThumb) add(manifestThumb, `${entry.id}.manifest.thumbnails.default`);
  if (manifest.patterns && object(manifest.patterns)) {
    for (const shape of SHAPES) {
      if (!string(manifest.patterns[shape])) fail(`${entry.id} missing pattern reference: ${shape}`);
      add(manifest.patterns[shape], `${entry.id}.patterns.${shape}`);
    }
  } else if (Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) {
      if (!object(asset) || !string(asset.path)) fail(`${entry.id} has invalid legacy asset reference`);
      add(asset.path, `${entry.id}.assets.${asset.asset_id ?? 'unknown'}`);
    }
  } else fail(`${entry.id} manifest has no patterns/assets references`);
  return references;
}

function makeCompleteness(rootDir, refs, sourceRefs, specRefs, manifestFile, structure = 'PRESENT') {
  const binaries = refs.every((ref) => fileStatus(ref.file) === 'PRESENT') ? 'PRESENT' : 'MISSING';
  return {
    binaries,
    manifest: fileStatus(manifestFile),
    source: sourceRefs.length ? 'DECLARED' : 'UNKNOWN',
    spec: specRefs.length && specRefs.every((ref) => fileStatus(safePath(rootDir, ref, 'specRef')) === 'PRESENT') ? 'PRESENT' : 'UNKNOWN',
    structure,
  };
}

function templateRecord(rootDir, entry, knownIds) {
  if (!object(entry) || !string(entry.id)) fail('template entry missing id');
  if (!safeStatus(entry.asset_status, LIFECYCLE_STATUSES)) fail(`${entry.id} has invalid or missing lifecycle status`);
  const manifestFile = safePath(rootDir, entry.manifest_url, `${entry.id}.manifest_url`);
  const manifest = readJson(manifestFile, `${entry.id} manifest`);
  const expectedManifestTemplateId = entry.render_template_id ?? entry.id;
  if (manifest.template_id && manifest.template_id !== expectedManifestTemplateId) fail(`${entry.id} manifest template_id mismatch: ${manifest.template_id}`);
  const manifestRefs = [entry.manifest_url];
  const sourceRefs = [];
  const specRefs = [];
  if (entry.asset_spec_url) { safePath(rootDir, entry.asset_spec_url, `${entry.id}.asset_spec_url`); sourceRefs.push(entry.asset_spec_url); specRefs.push(entry.asset_spec_url); }
  if (entry.recipe_ref?.id) sourceRefs.push(`recipe:${entry.recipe_ref.id}@${entry.recipe_ref.version ?? 'unknown'}`);
  if (entry.render_template_id && !knownIds.has(entry.render_template_id)) fail(`${entry.id} unknown render_template_id: ${entry.render_template_id}`);
  const refs = collectTemplateRefs(rootDir, entry, manifest, manifestFile);
  const capabilityStatus = entry.asset_status === 'REAL' ? 'UNVERIFIED' : 'CONCEPT_ONLY';
  return {
    recordId: `template:${entry.id}`,
    subjectId: entry.id,
    subjectType: 'MATERIAL_TEMPLATE',
    lifecycleStatus: entry.asset_status,
    sourceRefs,
    specRefs,
    manifestRefs,
    completeness: makeCompleteness(rootDir, refs, sourceRefs, specRefs, manifestFile),
    evidenceTier: entry.asset_status === 'REAL' ? 'METADATA_ONLY' : entry.asset_status === 'SIMULATED' ? 'SIMULATED_PREVIEW' : 'CONCEPT',
    rightsStatus: 'PENDING',
    rightsEvidenceRefs: [],
    capabilityStatus,
    capabilityEvidenceRefs: [],
    promotionStatus: 'BLOCKED',
    blockingCodes: ['RIGHTS_EVIDENCE_MISSING', 'CAPABILITY_EVIDENCE_MISSING', 'PROMOTION_NOT_AUTHORIZED'],
    limitations: entry.asset_status === 'REAL'
      ? ['Asset metadata and references are present; no rights, capability, or production evidence is asserted.']
      : [entry.asset_status === 'SIMULATED' ? 'Preview is simulated and non-manufacturing.' : 'Candidate concept is not a signed renderer or manufacturing definition.', 'No rights or commercial-use clearance is asserted.'],
  };
}

function lookRecord(rootDir, entry) {
  if (!object(entry) || !string(entry.lookId)) fail('Look entry missing lookId');
  const manifestFile = safePath(rootDir, entry.manifest, `${entry.lookId}.manifest`);
  const manifest = readJson(manifestFile, `${entry.lookId} manifest`);
  if (manifest.lookId !== entry.lookId || manifest.revision !== entry.revision) fail(`${entry.lookId} manifest identity/revision mismatch`);
  if (manifest.status !== 'SIMULATED_LOOK_ASSET_PACK') fail(`${entry.lookId} must be SIMULATED_LOOK_ASSET_PACK`);
  if (manifest.manufacturingValidated !== false) fail(`${entry.lookId} must have manufacturingValidated=false`);
  const assets = object(manifest.assets);
  if (!assets) fail(`${entry.lookId} manifest assets missing`);
  const manifestDir = path.dirname(manifestFile);
  const refs = [];
  const add = (value, label) => { if (!object(value) || !string(value.path)) fail(`${entry.lookId} missing ${label}`); refs.push({ file: resolveManifestPath(rootDir, manifestDir, value.path, label), label, declared: value.path }); };
  add(assets.highFidelityCover, 'highFidelityCover');
  add(assets.flatVector, 'flatVector');
  for (const key of ['decal', 'normal', 'roughness', 'height']) add(assets.textureMaps?.[key], `textureMaps.${key}`);
  if (!Array.isArray(assets.dimensionalAssets) || !assets.dimensionalAssets.length) fail(`${entry.lookId} dimensionalAssets missing`);
  assets.dimensionalAssets.forEach((asset, index) => add(asset, `dimensionalAssets[${index}]`));
  add(assets.dimensionalKit, 'dimensionalKit');
  const recipeSpec = path.join(manifestDir, 'recipe-spec.json');
  refs.push({ file: recipeSpec, label: 'recipe-spec.json', declared: 'recipe-spec.json' });
  const fingers = Object.keys(manifest.fingerAllocation ?? {}).sort();
  if (fingers.length !== 10 || FINGERS.some((finger) => !fingers.includes(finger))) fail(`${entry.lookId} must have exactly ten fingers`);
  const sourceRefs = manifest.sourceReference?.id ? [`source:${manifest.sourceReference.id}`] : [];
  const specRefs = [path.relative(rootDir, recipeSpec).split(path.sep).join('/')];
  return {
    recordId: `look:${entry.lookId}`,
    subjectId: entry.lookId,
    subjectType: 'LOOK_ASSET_PACK',
    lifecycleStatus: 'SIMULATED',
    sourceRefs,
    specRefs,
    manifestRefs: [entry.manifest],
    completeness: makeCompleteness(rootDir, refs, sourceRefs, specRefs, manifestFile),
    evidenceTier: 'SIMULATED_PREVIEW',
    rightsStatus: 'PENDING',
    rightsEvidenceRefs: [],
    capabilityStatus: 'CONCEPT_ONLY',
    capabilityEvidenceRefs: [],
    promotionStatus: 'BLOCKED',
    blockingCodes: ['RIGHTS_EVIDENCE_MISSING', 'CAPABILITY_EVIDENCE_MISSING', 'SIMULATED_PREVIEW_ONLY', 'MANUFACTURING_NOT_VALIDATED', 'PROMOTION_NOT_AUTHORIZED'],
    limitations: ['Look pack is a simulated preview with ten-finger allocation.', 'No fit, material, adhesion, print, manufacturing, or commercial-use evidence is asserted.'],
  };
}

export function parseGovernanceLedgerV1(value) {
  const raw = object(value);
  if (!raw || !exactKeys(raw, ROOT_KEYS) || raw.schemaVersion !== GOVERNANCE_SCHEMA || raw.architectureBaseline !== 'v0.7.2'
    || !Array.isArray(raw.generatedFrom) || !raw.generatedFrom.every(string) || !Array.isArray(raw.records)) return null;
  const summary = object(raw.summary);
  if (!summary || !exactKeys(summary, SUMMARY_KEYS) || !SUMMARY_KEYS.every((key) => Number.isInteger(summary[key]) && summary[key] >= 0)) return null;
  if (raw.records.length !== TEMPLATE_COUNT + LOOK_COUNT) return null;
  const seen = new Set();
  const templateIds = new Set();
  const lookIds = new Set();
  let templateCount = 0;
  let lookCount = 0;
  for (const record of raw.records) {
    if (!object(record) || !exactKeys(record, RECORD_KEYS) || !string(record.recordId) || seen.has(record.recordId)) return null;
    seen.add(record.recordId);
    if (!string(record.subjectId) || !['MATERIAL_TEMPLATE', 'LOOK_ASSET_PACK'].includes(record.subjectType)
      || !safeStatus(record.lifecycleStatus, LIFECYCLE_STATUSES) || !strings(record.sourceRefs) || !strings(record.specRefs) || !strings(record.manifestRefs)
      || !safeStatus(record.rightsStatus, RIGHTS_STATUSES) || !strings(record.rightsEvidenceRefs)
      || !safeStatus(record.capabilityStatus, CAPABILITY_STATUSES) || !strings(record.capabilityEvidenceRefs)
      || !safeStatus(record.promotionStatus, PROMOTION_STATUSES) || !strings(record.blockingCodes) || !strings(record.limitations)
      || !string(record.evidenceTier)) return null;
    const expectedRecordId = `${record.subjectType === 'MATERIAL_TEMPLATE' ? 'template' : 'look'}:${record.subjectId}`;
    if (record.recordId !== expectedRecordId) return null;
    if (record.subjectType === 'MATERIAL_TEMPLATE') templateCount += 1;
    else lookCount += 1;
    if (record.subjectType === 'MATERIAL_TEMPLATE') templateIds.add(record.subjectId);
    else lookIds.add(record.subjectId);
    if (record.rightsStatus !== 'PENDING' && record.rightsEvidenceRefs.length === 0) return null;
    // Both UNVERIFIED and CONCEPT_ONLY are deliberately allowed with an empty
    // evidence list: the ledger must not invent capability proof.
    if (record.promotionStatus !== 'BLOCKED') return null;
    const completeness = object(record.completeness);
    if (!completeness || !exactKeys(completeness, COMPLETENESS_KEYS) || !COMPLETENESS_KEYS.every((key) => COMPLETENESS_VALUES.has(completeness[key]))) return null;
  }
  if (templateIds.size !== EXPECTED_TEMPLATE_IDS.size || [...EXPECTED_TEMPLATE_IDS].some((id) => !templateIds.has(id))) return null;
  if (lookIds.size !== EXPECTED_LOOK_IDS.size || [...EXPECTED_LOOK_IDS].some((id) => !lookIds.has(id))) return null;
  if (templateCount !== summary.templateCount || lookCount !== summary.lookCount
    || summary.rightsPendingCount !== raw.records.filter((record) => record.rightsStatus === 'PENDING').length
    || summary.promotionBlockedCount !== raw.records.filter((record) => record.promotionStatus === 'BLOCKED').length) return null;
  return structuredClone(value);
}

export function generateAssetOpsGovernance({ rootDir = process.cwd() } = {}) {
  const index = readJson(path.join(rootDir, 'material-library/index.json'), 'material index');
  const lookIndex = readJson(path.join(rootDir, 'assets/hero-recipes/v0-7-2-four-look-sets.json'), 'Look index');
  if (!Array.isArray(index.templates) || index.templates.length !== TEMPLATE_COUNT) fail(`expected ${TEMPLATE_COUNT} templates`);
  if (!Array.isArray(lookIndex.entries) || lookIndex.entries.length !== LOOK_COUNT) fail(`expected ${LOOK_COUNT} Look packs`);
  const templateIds = index.templates.map((entry) => entry?.id);
  const lookIds = lookIndex.entries.map((entry) => entry?.lookId);
  if (templateIds.some((id) => !string(id)) || new Set(templateIds).size !== TEMPLATE_COUNT
    || templateIds.some((id) => !EXPECTED_TEMPLATE_IDS.has(id))) fail('template IDs must exactly match governed subject set');
  if (lookIds.some((id) => !string(id)) || new Set(lookIds).size !== LOOK_COUNT
    || lookIds.some((id) => !EXPECTED_LOOK_IDS.has(id))) fail('Look IDs must exactly match governed subject set');
  const knownIds = new Set(templateIds);
  const records = [
    ...index.templates.map((entry) => templateRecord(rootDir, entry, knownIds)),
    ...lookIndex.entries.map((entry) => lookRecord(rootDir, entry)),
  ].sort((a, b) => a.recordId.localeCompare(b.recordId));
  const ledger = {
    schemaVersion: GOVERNANCE_SCHEMA,
    architectureBaseline: 'v0.7.2',
    generatedFrom: ['material-library/index.json', 'assets/hero-recipes/v0-7-2-four-look-sets.json'],
    summary: { templateCount: TEMPLATE_COUNT, lookCount: LOOK_COUNT, rightsPendingCount: records.filter((record) => record.rightsStatus === 'PENDING').length, promotionBlockedCount: records.filter((record) => record.promotionStatus === 'BLOCKED').length },
    records,
  };
  if (!parseGovernanceLedgerV1(ledger)) fail('generated ledger failed strict exact-key validation');
  return ledger;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const rootDir = process.cwd();
    const output = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : 'material-library/asset-ops-governance-v1.json';
    if (!string(output) || path.isAbsolute(output)) fail('--output must be a worktree-relative path');
    const outputFile = safePath(rootDir, output, '--output');
    const ledger = generateAssetOpsGovernance({ rootDir });
    fs.writeFileSync(outputFile, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
