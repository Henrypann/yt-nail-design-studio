/**
 * Record manual visual signoff for Mercury Dew golden fixtures.
 *
 * This script only writes down a signoff decision a human has already made; it
 * performs no visual judgement of its own. It refuses to run unless every fixture
 * has real outputs whose checksums match, so an approved entry always points at
 * the exact artifacts that were reviewed.
 *
 * Usage:
 *   node tools/signoff-mercury-fixtures.mjs --by "<name>" [--fixture <id> ...]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(ROOT, 'assets/golden-fixtures/mercury-dew');
const INDEX_PATH = path.join(FIXTURE_ROOT, 'index.json');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function argAll(name) {
  const out = [];
  process.argv.forEach((v, i) => {
    if (v === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

const by = arg('by');
const at = arg('at', new Date().toISOString().slice(0, 10));
const only = argAll('fixture');

if (!by) {
  console.error('必须提供签收人：--by "<name>"');
  process.exit(1);
}

const sha256 = (buf) => `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;

const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const targets = only.length > 0 ? only : index.fixtures.map((f) => f.id);
const unknown = targets.filter((id) => !index.fixtures.some((f) => f.id === id));
if (unknown.length > 0) {
  console.error(`未知 fixture: ${unknown.join(', ')}`);
  process.exit(1);
}

for (const fixture of index.fixtures) {
  if (!targets.includes(fixture.id)) continue;

  const dir = path.join(FIXTURE_ROOT, 'fixtures', fixture.id);
  const singleHash = sha256(fs.readFileSync(path.join(dir, 'single.svg')));
  const tiledHash = sha256(fs.readFileSync(path.join(dir, 'tiled.svg')));
  const previewHash = sha256(fs.readFileSync(path.join(dir, 'preview.png')));
  const tiledPngHash = sha256(fs.readFileSync(path.join(dir, 'tiled.png')));

  if (
    fixture.checksum?.singleSvg !== singleHash ||
    fixture.checksum?.tiledSvg !== tiledHash ||
    fixture.checksum?.previewPng !== previewHash ||
    fixture.checksum?.tiledPng !== tiledPngHash
  ) {
    console.error(`产物 checksum 与清单不一致，拒绝签收: ${fixture.id}（请先重新生成）`);
    process.exit(1);
  }

  fixture.status = 'approved';
  fixture.signoff = {
    by,
    at,
    method: 'manual-visual',
    renderer: 'svg-2.5d/mercury-1',
    manufacturing: 'unvalidated',
    reviewed: {
      single: singleHash,
      tiled: tiledHash,
      preview: previewHash,
      tiledPng: tiledPngHash,
    },
  };
  console.log(`approved ${fixture.id} (by ${by} at ${at})`);
}

const allApproved = index.fixtures.every((f) => f.status === 'approved');
index.fixtureType = allApproved ? 'visual-signoff-approved' : 'visual-signoff-pending';
if (allApproved) {
  index.signoff = { by, at, method: 'manual-visual', scope: 'all-6-fixtures' };
  index.note =
    '六组产物均由 Canonical Renderer 生成并完成人工视觉签收；仍为 2.5D 模拟效果，制造状态 unvalidated。重新生成产物会作废签收。';
} else {
  delete index.signoff;
}

fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `signoff-mercury-fixtures: ${index.fixtures.filter((f) => f.status === 'approved').length}/6 approved, fixtureType=${index.fixtureType}`,
);
