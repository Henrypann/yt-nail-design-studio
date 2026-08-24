#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { buildCommunityLookAssetCapabilityIndexV1 } from '../src/community/domain/asset-capability-v1.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

const root = process.cwd();
const outputPath = path.join(root, 'evidence/pr-community-v0-7-2-asset-04b-input/owner-input-pack-v1.json');
const update = process.argv.includes('--update');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const taxonomy = parseCommunityTaxonomyV2(readJson('public/community/taxonomy-v2.json'));
if (!taxonomy.ok) throw new Error(`taxonomy_invalid:${taxonomy.issues.map((issue) => issue.code).join(',')}`);
const migration = parseMigrationManifestV1(readJson('public/community/migration-manifest-v1.json'), taxonomy.value);
if (!migration.ok) throw new Error(`migration_invalid:${migration.issues.map((issue) => issue.code).join(',')}`);
const authorities = [CANONICAL_USE_DEMO_READ_MODEL_V1, ...FOUR_LOOK_SET_READ_MODELS_V0_7_2];
const capability = buildCommunityLookAssetCapabilityIndexV1(
  readJson('public/community/asset-capability-evidence-v1.json'),
  migration.value,
  authorities,
);
if (!capability.ok) throw new Error(`capability_invalid:${capability.issues.map((issue) => issue.code).join(',')}`);

const legacy = readJson('public/community/content-index.json').contents;
const titles = new Map([
  ...legacy.map((look) => [look.contentId, { title: look.title, titleEn: look.titleEn ?? look.title }]),
  ...authorities.map((look) => [look.lookId, { title: look.title, titleEn: look.titleEn ?? look.title }]),
]);
const candidates = capability.value.entries
  .filter((entry) => entry.permissions.public)
  .map((entry) => {
    const copy = titles.get(entry.contentId);
    if (!copy) throw new Error(`title_missing:${entry.contentId}`);
    return {
      contentId: entry.contentId,
      title: copy.title,
      titleEn: copy.titleEn,
      sourceClass: entry.sourceClass,
      rightsStatus: entry.rightsStatus,
      capabilityState: entry.capabilityState,
      cta: entry.cta,
      technicalStatus: entry.technicalStatus,
      currentMakeable: entry.currentMakeable,
      manufacturingValidated: entry.manufacturingValidated,
    };
  })
  .sort((a, b) => a.contentId.localeCompare(b.contentId));

const pack = {
  schemaVersion: 1,
  contractRef: 'COMM-v0.7.2-ASSET-04B-INPUT',
  status: 'AWAITING_OWNER_SELECTION',
  generatedFrom: {
    taxonomy: 'public/community/taxonomy-v2.json',
    migration: 'public/community/migration-manifest-v1.json',
    capability: 'public/community/asset-capability-evidence-v1.json',
  },
  selectionPolicy: 'UNRANKED_GOVERNED_PUBLIC_CANDIDATES',
  candidates,
  requiredOwnerInput: {
    banner: null,
    editorialSelections: [],
    collections: [],
    owner: null,
    reviewedAt: null,
    evidenceRefs: [],
  },
  prohibitions: [
    'NO_AUTOMATIC_RANKING',
    'NO_TRENDING_OR_PERSONALIZATION_CLAIM',
    'NO_STARTER_SHELF_COPY',
    'NO_MAKEABILITY_OR_MANUFACTURING_UPGRADE',
  ],
};
const bytes = `${JSON.stringify(pack, null, 2)}\n`;

if (update) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bytes);
  console.log(`generate-community-home-owner-input: UPDATED (${candidates.length} unranked candidates)`);
} else {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== bytes) {
    throw new Error('owner input pack is stale; run npm run generate:community-home-owner-input:update');
  }
  console.log(`generate-community-home-owner-input: CHECK PASS (${candidates.length} unranked candidates)`);
}
