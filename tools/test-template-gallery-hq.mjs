#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isHighFidelityConceptGalleryTemplate } from '../src/studio/preview/material-library.ts';

const root = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));
const visible = index.templates.filter(isHighFidelityConceptGalleryTemplate);

assert.equal(visible.length, 10, `expected 10 high-fidelity concept cards, got ${visible.length}`);
assert.deepEqual(
  index.style_tags.map((tag) => tag.id),
  ['trending', 'sweet', 'minimal', 'luxe'],
  'gallery taxonomy must stay on the converged four customer-facing tags',
);

for (const template of visible) {
  assert.match(template.thumbnail_url, /^assets\/hero-recipes\//);
  assert.ok(
    template.asset_status === 'CONCEPT' || template.asset_status === 'SIMULATED',
    `${template.id} must declare concept fidelity`,
  );
  assert.ok(
    fs.existsSync(path.join(root, template.thumbnail_url)),
    `${template.id} thumbnail must exist: ${template.thumbnail_url}`,
  );
}

const forbiddenGalleryMocks = [
  't_liquid_velvet_cat_eye',
  't_french_white',
  't_nude_gradient',
  't_cat_eye_nude',
  't_y2k_ice',
  't_dark_gradient',
  't_chrome_mirror',
  't_checkerboard',
  't_3d_waterdrop',
  't_classic_high_gloss',
  't_holiday_glitter',
];
const visibleIds = new Set(visible.map((template) => template.id));
for (const id of forbiddenGalleryMocks) {
  assert.equal(visibleIds.has(id), false, `${id} must not appear in the Wizard gallery`);
}

for (const sourcePath of [
  'src/studio/wizard/TemplateGallery.tsx',
  'src/app/pages/design/TemplateGalleryPage.tsx',
]) {
  const gallerySource = fs.readFileSync(path.join(root, sourcePath), 'utf8');
  assert.match(
    gallerySource,
    /filter\(isHighFidelityConceptGalleryTemplate\)/,
    `${sourcePath} must enforce the high-fidelity gallery boundary`,
  );
}

console.log(
  `[template-gallery-hq] PASS · ${visible.length} hero concepts; ${forbiddenGalleryMocks.length} legacy mocks excluded`,
);
