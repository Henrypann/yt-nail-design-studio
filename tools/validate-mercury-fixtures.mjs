/**
 * Mercury Dew golden-fixture gate.
 *
 * Verifies real Canonical Renderer outputs exist (rejects missing / 1×1 placeholder
 * fakes) and enforces the signoff state machine:
 *   pending_visual_signoff → approved
 * `approved` requires manual-signoff metadata; fixtureType must agree with the
 * aggregate state, so an approved entry can never be produced by a code path that
 * merely passes automated tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(ROOT, 'assets/golden-fixtures/mercury-dew');
const INDEX_PATH = path.join(FIXTURE_ROOT, 'index.json');

const EXPECTED = new Set([
  'almond-natural',
  'almond-medium',
  'oval-natural',
  'oval-medium',
  'coffin-natural',
  'coffin-medium',
]);
const GEOMETRY_BY_PRESET = { natural: 'short', medium: 'long' };
const STATUSES = ['pending_visual_signoff', 'approved'];
const FIXTURE_TYPE_PENDING = 'visual-signoff-pending';
const FIXTURE_TYPE_APPROVED = 'visual-signoff-approved';
const REQUIRED_REL = ['recipe.json', 'single.svg', 'tiled.svg', 'preview.png', 'tiled.png', 'snapshot.json'];
const MIN_PREVIEW = { w: 64, h: 64 };
const MIN_TILED = { w: 128, h: 128 };

function sha256Hex(buf) {
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) throw new Error(`PNG too short: ${filePath}`);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`not a PNG: ${filePath}`);
  // IHDR: bytes 16..23 are width/height big-endian
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, buf };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

assert(
  index.fixtureType === FIXTURE_TYPE_PENDING || index.fixtureType === FIXTURE_TYPE_APPROVED,
  `fixtureType 非法: ${index.fixtureType}`,
);
assert(index.renderer === 'svg-2.5d/mercury-1', `Unexpected renderer: ${index.renderer}`);
assert(index.fixtures.length === 6, '必须覆盖 Almond/Oval/Coffin × natural/medium');
assert(new Set(index.fixtures.map((f) => f.id)).size === 6, 'fixture id 必须唯一');

const allApproved = index.fixtures.every((f) => f.status === 'approved');
// fixtureType 必须与聚合状态一致：任何一项未签收就不得声称已签收
assert(
  index.fixtureType === (allApproved ? FIXTURE_TYPE_APPROVED : FIXTURE_TYPE_PENDING),
  allApproved
    ? '六项均已 approved，fixtureType 必须为 visual-signoff-approved'
    : '仍有未签收项，fixtureType 必须保持 visual-signoff-pending',
);

for (const fixture of index.fixtures) {
  assert(EXPECTED.has(fixture.id), `未知 fixture id: ${fixture.id}`);
  assert(STATUSES.includes(fixture.status), `fixture 状态错误: ${fixture.id} (${fixture.status})`);
  if (fixture.status === 'approved') {
    // 人工签收才能产生 approved：必须留下可追溯的签收记录
    assert(
      typeof fixture.signoff?.by === 'string' && fixture.signoff.by.length > 0,
      `approved 缺少 signoff.by: ${fixture.id}`,
    );
    assert(
      typeof fixture.signoff?.at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fixture.signoff.at),
      `approved 缺少 signoff.at: ${fixture.id}`,
    );
    assert(fixture.signoff?.method === 'manual-visual', `signoff.method 必须为 manual-visual: ${fixture.id}`);
    assert(
      fixture.signoff?.reviewed?.single === fixture.checksum?.singleSvg &&
        fixture.signoff?.reviewed?.preview === fixture.checksum?.previewPng,
      `signoff 记录的 checksum 与当前产物不一致（产物在签收后被改动）: ${fixture.id}`,
    );
  }
  assert(['almond', 'oval', 'coffin'].includes(fixture.shape), `fixture 甲型非法: ${fixture.id}`);
  assert(['natural', 'medium'].includes(fixture.lengthPreset), `fixture 产品长度非法: ${fixture.id}`);
  assert(
    fixture.geometryLength === GEOMETRY_BY_PRESET[fixture.lengthPreset],
    `fixture 长度映射错误: ${fixture.id}`,
  );
  assert(
    fixture.recipeRef?.id === 'mercury-dew' && fixture.recipeRef?.version === '1.0.0',
    `recipeRef 错误: ${fixture.id}`,
  );

  const dir = path.join(FIXTURE_ROOT, 'fixtures', fixture.id);
  assert(fs.existsSync(dir), `缺少产物目录: fixtures/${fixture.id}`);

  for (const name of REQUIRED_REL) {
    const p = path.join(dir, name);
    assert(fs.existsSync(p), `缺少产物 ${name}: ${fixture.id}`);
    assert(fs.statSync(p).size > 32, `产物过小（疑似占位） ${name}: ${fixture.id}`);
  }

  const single = fs.readFileSync(path.join(dir, 'single.svg'), 'utf8');
  const tiled = fs.readFileSync(path.join(dir, 'tiled.svg'), 'utf8');
  assert(single.includes('data-recipe="mercury-dew"'), `single.svg 缺少 mercury-dew 标记: ${fixture.id}`);
  assert(single.includes('data-renderer="svg-2.5d"'), `single.svg 缺少 renderer 标记: ${fixture.id}`);
  assert(tiled.includes('data-recipe="mercury-dew"'), `tiled.svg 缺少 mercury-dew 标记: ${fixture.id}`);
  const fingerCount = (tiled.match(/data-finger="/g) || []).length;
  assert(fingerCount === 10, `tiled.svg 应含 10 指，实际 ${fingerCount}: ${fixture.id}`);

  const preview = readPngSize(path.join(dir, 'preview.png'));
  const tiledPng = readPngSize(path.join(dir, 'tiled.png'));
  assert(
    preview.width >= MIN_PREVIEW.w && preview.height >= MIN_PREVIEW.h,
    `preview.png 尺寸过小（拒绝 1×1 占位）: ${fixture.id} ${preview.width}x${preview.height}`,
  );
  assert(
    tiledPng.width >= MIN_TILED.w && tiledPng.height >= MIN_TILED.h,
    `tiled.png 尺寸过小: ${fixture.id} ${tiledPng.width}x${tiledPng.height}`,
  );

  const snapshot = JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'));
  assert(snapshot.renderer === 'svg-2.5d/mercury-1', `snapshot.renderer 错误: ${fixture.id}`);
  assert(snapshot.manufacturing === 'unvalidated', `manufacturing 必须 unvalidated: ${fixture.id}`);
  assert(snapshot.manufacturing_command_allowed === false, `不得允许制造命令: ${fixture.id}`);
  assert(!('stl' in snapshot) && !('toolpath' in snapshot) && !('commands' in snapshot), `snapshot 含制造字段: ${fixture.id}`);
  assert(snapshot.shape === fixture.shape, `snapshot.shape 不匹配: ${fixture.id}`);
  assert(snapshot.lengthPreset === fixture.lengthPreset, `snapshot.lengthPreset 不匹配: ${fixture.id}`);
  assert(snapshot.geometryLength === fixture.geometryLength, `snapshot.geometryLength 不匹配: ${fixture.id}`);
  assert(snapshot.components?.magneticBeam === true, `snapshot 缺 magneticBeam: ${fixture.id}`);
  assert(snapshot.components?.chromeRibbon === true, `snapshot 缺 chromeRibbon: ${fixture.id}`);
  assert(typeof snapshot.components?.clearDroplets === 'number', `snapshot 缺 clearDroplets: ${fixture.id}`);

  const singleHash = sha256Hex(fs.readFileSync(path.join(dir, 'single.svg')));
  const tiledHash = sha256Hex(fs.readFileSync(path.join(dir, 'tiled.svg')));
  const previewHash = sha256Hex(preview.buf);
  const tiledPngHash = sha256Hex(tiledPng.buf);

  assert(snapshot.checksums?.singleSvg === singleHash, `snapshot singleSvg checksum 不一致: ${fixture.id}`);
  assert(snapshot.checksums?.tiledSvg === tiledHash, `snapshot tiledSvg checksum 不一致: ${fixture.id}`);
  assert(snapshot.checksums?.previewPng === previewHash, `snapshot previewPng checksum 不一致: ${fixture.id}`);
  assert(snapshot.checksums?.tiledPng === tiledPngHash, `snapshot tiledPng checksum 不一致: ${fixture.id}`);

  assert(fixture.outputs?.single === `fixtures/${fixture.id}/single.svg`, `outputs.single 缺失: ${fixture.id}`);
  assert(fixture.checksum?.singleSvg === singleHash, `index checksum.singleSvg 不一致: ${fixture.id}`);
  assert(fixture.checksum?.tiledSvg === tiledHash, `index checksum.tiledSvg 不一致: ${fixture.id}`);
  assert(fixture.checksum?.previewPng === previewHash, `index checksum.previewPng 不一致: ${fixture.id}`);
  assert(fixture.checksum?.tiledPng === tiledPngHash, `index checksum.tiledPng 不一致: ${fixture.id}`);
  assert(
    typeof fixture.checksum?.recipeDefinition === 'string' && fixture.checksum.recipeDefinition.startsWith('fnv1a:'),
    `index 缺 recipeDefinition checksum: ${fixture.id}`,
  );
}

const approvedCount = index.fixtures.filter((f) => f.status === 'approved').length;
console.log(
  `validate-mercury-fixtures: PASS (6 fixtures with real SVG/PNG outputs + checksums; ${approvedCount} approved, ${6 - approvedCount} pending)`,
);
