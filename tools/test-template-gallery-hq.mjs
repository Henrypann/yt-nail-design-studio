#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isQuickStartOfficialTemplate } from '../src/studio/preview/material-library.ts';

const root = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));
const shapes = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const visible = index.templates.filter((template) => isQuickStartOfficialTemplate(template));
assert.deepEqual(visible.map((template) => template.id), ['t_french_white']);
assert.equal(visible[0].name, '经典法式');
assert.deepEqual(visible[0].applies_to_shapes, shapes);
assert.equal(isQuickStartOfficialTemplate({ ...visible[0], applies_to_shapes: [] }), false);
assert.equal(isQuickStartOfficialTemplate({ ...visible[0], applies_to_shapes: ['almond', 'unknown'] }), false);
for (const shape of shapes) assert.equal(isQuickStartOfficialTemplate(visible[0], shape), true, `${shape} must have an exact registry ref`);
for (const template of index.templates.filter((template) => template.id !== 't_french_white')) {
  assert.equal(isQuickStartOfficialTemplate(template), false, `${template.id} must stay out of Quick Start`);
}
assert.ok(fs.existsSync(path.join(root, 'material-library/templates/t_french_white/thumbnails/default.png')));
assert.match(fs.readFileSync(path.join(root, 'src/studio/wizard/TemplateGallery.tsx'), 'utf8'), /isQuickStartOfficialTemplate/);
console.log('[template-gallery] PASS · Quick Start has one exact Classic French starter across 7 shapes');
