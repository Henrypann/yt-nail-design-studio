#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-02 · Deterministic migration report generator.
 *
 * Reads the shipped discovery fixtures (taxonomy-v2, migration-manifest-v1,
 * content-index), strict-validates all three with the same runtime parsers
 * the app uses (parseCommunityTaxonomyV2, parseMigrationManifestV1,
 * buildCommunityDiscoveryIndexV1 coverage validation), then writes:
 *
 *   evidence/pr-community-v0-7-2-tax-02/migration-report.json
 *   evidence/pr-community-v0-7-2-tax-02/MIGRATION_REPORT.md
 *
 * The report covers all 24 migration entries (18 legacy content-index
 * records, the canonical demo, the four v0.7.2 look sets and the creator V1
 * fixture): source class, contentId, public status, rights, makeability,
 * migration state, styles/techniques, and review/block reasons, plus summary
 * counts.
 *
 * Deterministic by construction: fixed timestamps, manifest order, no clock,
 * no network. Re-running is byte-stable — both outputs are hashed and the
 * hashes are printed so a second run can be compared (the generator also
 * self-checks by re-reading and re-parsing the JSON it wrote).
 *
 * Fail-closed: any strict-parse or coverage failure throws before anything
 * is written; the report never claims success for invalid fixtures.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { buildCommunityDiscoveryIndexV1 } from '../src/community/domain/taxonomy-v2/load.ts';
import { publicationEligibility } from '../src/community/domain/taxonomy-v2/governance.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const taxonomyPath = path.join(root, 'public/community/taxonomy-v2.json');
const manifestPath = path.join(root, 'public/community/migration-manifest-v1.json');
const contentIndexPath = path.join(root, 'public/community/content-index.json');
const evidenceDir = path.join(root, 'evidence/pr-community-v0-7-2-tax-02');
const jsonOutput = path.join(evidenceDir, 'migration-report.json');
const mdOutput = path.join(evidenceDir, 'MIGRATION_REPORT.md');

// Fixed report timestamp (same release instant as the manifest migration);
// keeps the report byte-stable across runs.
const REPORT_AT = '2026-08-17T00:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Strict fixture validation (same parsers the runtime uses)
// ---------------------------------------------------------------------------

const taxonomyResult = parseCommunityTaxonomyV2(JSON.parse(fs.readFileSync(taxonomyPath, 'utf8')));
if (!taxonomyResult.ok) {
  throw new Error(`taxonomy-v2 strict parse failed: ${JSON.stringify(taxonomyResult.issues).slice(0, 2000)}`);
}
const taxonomy = taxonomyResult.value;

const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestResult = parseMigrationManifestV1(manifestRaw, taxonomy);
if (!manifestResult.ok) {
  throw new Error(`migration-manifest-v1 strict parse failed: ${JSON.stringify(manifestResult.issues).slice(0, 2000)}`);
}
const manifest = manifestResult.value;

const contentIndexRaw = JSON.parse(fs.readFileSync(contentIndexPath, 'utf8'));
const indexResult = buildCommunityDiscoveryIndexV1({
  taxonomyRaw: taxonomyResult.value,
  manifestRaw,
  contentIndexRaw,
});
// Strict content-index coverage validation (missing/orphan manifest entries,
// legacy style mismatch, subject identity mismatch, non-published mapping,
// duplicate ids). Any blocked record fails the report generation.
if (!indexResult.ok) {
  throw new Error(`content-index strict validation failed: ${JSON.stringify(indexResult.issues).slice(0, 2000)}`);
}
if (indexResult.blocked.length > 0) {
  throw new Error(`content-index coverage blocked entries: ${JSON.stringify(indexResult.blocked).slice(0, 2000)}`);
}

const records = new Map(
  (Array.isArray(contentIndexRaw.contents) ? contentIndexRaw.contents : [])
    .filter((record) => record && typeof record === 'object' && typeof record.contentId === 'string')
    .map((record) => [record.contentId, record]),
);

// ---------------------------------------------------------------------------
// 2. Deterministic per-entry report rows
// ---------------------------------------------------------------------------

function reviewBlockReason(entry) {
  const discovery = entry.discovery;
  if (entry.publicStatus === 'PUBLIC_BLOCKED') {
    if (discovery.rights.status === 'PENDING') return 'rights PENDING (never public)';
    return 'not publicly eligible (non-public record / gate blocked)';
  }
  if (entry.publicStatus === 'MANUAL_REVIEW') {
    return 'french NEEDS_STYLE_REVIEW exception (technique:french, empty styleIds)';
  }
  const gate = publicationEligibility(discovery, taxonomy);
  if (!gate.eligible) return `MIGRATED but gate mismatch: ${gate.reasons.join('; ')}`;
  return 'discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability)';
}

function entryRow(entry) {
  const discovery = entry.discovery;
  const row = {
    contentId: entry.contentId,
    subjectRef: entry.subjectRef.id,
    sourceClass: entry.sourceClass,
    publicStatus: entry.publicStatus,
    rights: discovery.rights.status,
    makeability: discovery.makeability.classification,
    migrationState: discovery.migration.state,
    legacyStyleIds: [...entry.legacyStyleIds],
    styles: [...discovery.styleIds],
    techniques: [...discovery.techniqueIds],
    recommendedShapes: [...discovery.recommendedShapeIds],
    scenes: [...discovery.sceneIds],
    themes: [...discovery.themeIds],
    lengths: [...discovery.lengthIds],
    reviewOrBlockReason: reviewBlockReason(entry),
  };
  const record = entry.sourceClass === 'LEGACY_CONTENT_INDEX' ? records.get(entry.contentId) : null;
  if (record && typeof record === 'object') {
    row.sourceRecord = {
      status: typeof record.status === 'string' ? record.status : 'UNKNOWN',
      publisherType: typeof record.publisherType === 'string' ? record.publisherType : 'UNKNOWN',
      title: typeof record.title === 'string' ? record.title : '',
    };
  }
  return row;
}

const entries = manifest.entries.map(entryRow);

// ---------------------------------------------------------------------------
// 3. Summary counts (deterministic)
// ---------------------------------------------------------------------------

const countBy = (key) => {
  const counts = {};
  for (const entry of entries) {
    const value = entry[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
};
const summary = {
  totalEntries: entries.length,
  bySourceClass: countBy('sourceClass'),
  byPublicStatus: countBy('publicStatus'),
  byRights: countBy('rights'),
  byMakeability: countBy('makeability'),
  byMigrationState: countBy('migrationState'),
  coverageBlocked: indexResult.blocked.length,
};

// ---------------------------------------------------------------------------
// 4. Report payload (fixed key order keeps the JSON byte-stable)
// ---------------------------------------------------------------------------

const report = {
  schemaVersion: 1,
  contractRef: 'COMM-v0.7.2-TAX-02',
  title: 'Community v0.7.2 · TAX-02 content migration report',
  generatedAt: REPORT_AT,
  fixtures: {
    taxonomy: {
      path: 'public/community/taxonomy-v2.json',
      strictParse: 'PASS',
      tagCount: Object.values(taxonomy.dimensions).reduce((total, dimension) => total + dimension.tags.length, 0),
    },
    migrationManifest: {
      path: 'public/community/migration-manifest-v1.json',
      strictParse: 'PASS',
      entryCount: manifest.entries.length,
    },
    contentIndex: {
      path: 'public/community/content-index.json',
      recordCount: records.size,
      strictCoverage: 'PASS',
      blocked: indexResult.blocked,
    },
  },
  entries,
  summary,
};

// ---------------------------------------------------------------------------
// 5. Markdown report (deterministic)
// ---------------------------------------------------------------------------

const mdLines = [];
mdLines.push('# COMM-v0.7.2-TAX-02 · Content Migration Report');
mdLines.push('');
mdLines.push(`Deterministic report over the shipped discovery fixtures. Fixed timestamp \`${REPORT_AT}\`; manifest order; byte-stable across re-runs.`);
mdLines.push('');
mdLines.push('## Fixture validation');
mdLines.push('');
mdLines.push('| Fixture | Result |');
mdLines.push('|---|---|');
mdLines.push(`| \`public/community/taxonomy-v2.json\` | PASS — strict parse (${report.fixtures.taxonomy.tagCount} tags) |`);
mdLines.push(`| \`public/community/migration-manifest-v1.json\` | PASS — strict parse (${report.fixtures.migrationManifest.entryCount} entries) |`);
mdLines.push(`| \`public/community/content-index.json\` | PASS — strict coverage (${report.fixtures.contentIndex.recordCount} records, ${report.fixtures.contentIndex.blocked.length} blocked) |`);
mdLines.push('');
mdLines.push('## Summary counts');
mdLines.push('');
mdLines.push('| Dimension | Counts |');
mdLines.push('|---|---|');
mdLines.push(`| Total entries | ${summary.totalEntries} |`);
mdLines.push(`| Source class | ${Object.entries(summary.bySourceClass).map(([key, value]) => `${key} ${value}`).join(' / ')} |`);
mdLines.push(`| Public status | ${Object.entries(summary.byPublicStatus).map(([key, value]) => `${key} ${value}`).join(' / ')} |`);
mdLines.push(`| Rights | ${Object.entries(summary.byRights).map(([key, value]) => `${key} ${value}`).join(' / ')} |`);
mdLines.push(`| Makeability | ${Object.entries(summary.byMakeability).map(([key, value]) => `${key} ${value}`).join(' / ')} |`);
mdLines.push(`| Migration state | ${Object.entries(summary.byMigrationState).map(([key, value]) => `${key} ${value}`).join(' / ')} |`);
mdLines.push(`| Coverage blocked | ${summary.coverageBlocked} |`);
mdLines.push('');
mdLines.push('## Entries');
mdLines.push('');
mdLines.push('| contentId | source class | public status | rights | makeability | migration | styles | techniques | review/block reason |');
mdLines.push('|---|---|---|---|---|---|---|---|---|');
for (const entry of entries) {
  const cell = (values) => (values.length > 0 ? values.join(', ') : '—');
  mdLines.push(`| \`${entry.contentId}\` | ${entry.sourceClass} | ${entry.publicStatus} | ${entry.rights} | ${entry.makeability} | ${entry.migrationState} | ${cell(entry.styles)} | ${cell(entry.techniques)} | ${entry.reviewOrBlockReason} |`);
}
mdLines.push('');

// ---------------------------------------------------------------------------
// 6. Write + self-verify (re-parse JSON; hash both outputs)
// ---------------------------------------------------------------------------

fs.mkdirSync(evidenceDir, { recursive: true });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const mdText = `${mdLines.join('\n')}`;
fs.writeFileSync(jsonOutput, jsonText);
fs.writeFileSync(mdOutput, mdText);

const written = JSON.parse(fs.readFileSync(jsonOutput, 'utf8'));
if (written.entries.length !== manifest.entries.length || JSON.stringify(written.entries) !== JSON.stringify(report.entries)) {
  throw new Error('migration-report.json self-check failed (round-trip mismatch)');
}
if (fs.readFileSync(mdOutput, 'utf8') !== mdText) {
  throw new Error('MIGRATION_REPORT.md self-check failed (round-trip mismatch)');
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
console.log(`[generate:community-tax-02-migration-report] wrote ${jsonOutput}`);
console.log(`[generate:community-tax-02-migration-report] wrote ${mdOutput}`);
console.log(`  entries=${entries.length} byClass=${JSON.stringify(summary.bySourceClass)} byStatus=${JSON.stringify(summary.byPublicStatus)}`);
console.log(`  sha256 ${path.basename(jsonOutput)} = ${sha256(jsonOutput)}`);
console.log(`  sha256 ${path.basename(mdOutput)}   = ${sha256(mdOutput)}`);
console.log('[generate:community-tax-02-migration-report] byte-stable: re-run and compare the two hashes');
