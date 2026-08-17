#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-03 · Discovery query URL state contract tests (checkpoint 1).
 *
 * Covers:
 *  - fixture loads and strict-parses as CommunityTaxonomyV2;
 *  - default state + empty serialization (explicit defaults collapse too);
 *  - full canonical serialization: fixed order, URL encoding, sorted/deduped
 *    CSV arrays, defaults absent;
 *  - parse-serialize-parse fixed point + repeated-serialization byte-stability;
 *  - q trim/bound (100);
 *  - incompatible inputs: unknown keys, duplicate singletons, unknown /
 *    wrong-dimension / raw-alias / deprecated topic and CSV items, malformed
 *    and empty CSV entries, unsupported `following`, missing topic for
 *    non-default browse;
 *  - legacy compatibility markers: style=ST-02 → technique:french (with the
 *    default recommended/for-you browse kept), other ST-* aliases → style
 *    browse, bare shape/length maps → canonical ids; serialization never
 *    emits old keys;
 *  - lossy legacy params (color/occasion/effect/mood/application/verification)
 *    are always incompatible;
 *  - old+new representation conflicts are incompatible;
 *  - issues bounded at MAX_DISCOVERY_QUERY_ISSUES; inputs never mutated.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_DISCOVERY_QUERY_STATE,
  DISCOVERY_BROWSE,
  LEGACY_LENGTH_MAP,
  LEGACY_SHAPE_MAP,
  MAX_DISCOVERY_QUERY_ISSUES,
  MAX_DISCOVERY_QUERY_Q_LENGTH,
  createDefaultDiscoveryQueryState,
  parseDiscoveryQueryV2,
  serializeDiscoveryQueryV2,
} from '../src/community/domain/taxonomy-v2/discovery-query.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';

const root = process.cwd();
const fixturePath = path.join(root, 'public/community/taxonomy-v2.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const strict = parseCommunityTaxonomyV2(rawFixture);
assert.equal(strict.ok, true, 'fixture must strict-parse before the suite runs');
const taxonomy = strict.value;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}\n    ${error.message}`);
  }
}

function parseUrl(search, opts = { relationshipProviderAvailable: false }) {
  return parseDiscoveryQueryV2(new URLSearchParams(search), taxonomy, opts);
}

function issueCodes(result) {
  return result.state.incompatible.map((issue) => issue.code);
}

function expectCompatible(result, label = '') {
  assert.equal(
    result.ok,
    true,
    `expected compatible${label ? ` (${label})` : ''}, got issues [${issueCodes(result).join(', ')}]`,
  );
}

function expectIncompatible(result, expectedCode, label = '') {
  assert.equal(
    result.ok,
    false,
    `expected incompatible${label ? ` (${label})` : ''} with "${expectedCode}", got ok`,
  );
  const codes = issueCodes(result);
  assert.ok(
    codes.includes(expectedCode),
    `expected issue code "${expectedCode}" among [${codes.join(', ')}]${label ? ` (${label})` : ''}`,
  );
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

test('fixture loads and strict-parses as CommunityTaxonomyV2', () => {
  assert.equal(strict.ok, true);
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

test('default state serializes to the empty string', () => {
  const result = parseUrl('');
  expectCompatible(result, 'empty url');
  assert.deepEqual(result.state, createDefaultDiscoveryQueryState());
  assert.equal(serializeDiscoveryQueryV2(result.state), '');
  assert.equal(serializeDiscoveryQueryV2(DEFAULT_DISCOVERY_QUERY_STATE), '');
});

test('explicit default params collapse to the default state', () => {
  const result = parseUrl('tab=looks&sort=featured&source=all&browse=recommended&topic=for-you');
  expectCompatible(result);
  assert.deepEqual(result.state, createDefaultDiscoveryQueryState());
  assert.equal(serializeDiscoveryQueryV2(result.state), '');
});

// ---------------------------------------------------------------------------
// Canonical serialization
// ---------------------------------------------------------------------------

test('full canonical serialization: fixed order and URL encoding', () => {
  const state = {
    tab: 'creators',
    q: 'hello world',
    sort: 'new',
    source: 'official',
    browse: 'style',
    topic: 'style:minimal-clean',
    lengthIds: ['length:long', 'length:short'],
    makeabilityIds: ['makeability:machine-direct'],
    rightsIds: ['rights:licensed', 'rights:original'],
    techniqueIds: ['technique:french'],
    incompatible: [],
    markers: [],
  };
  const expected =
    'tab=creators&q=hello+world&sort=new&source=official&browse=style' +
    '&topic=style%3Aminimal-clean&length=length%3Along%2Clength%3Ashort' +
    '&makeability=makeability%3Amachine-direct' +
    '&rights=rights%3Alicensed%2Crights%3Aoriginal&technique=technique%3Afrench';
  assert.equal(serializeDiscoveryQueryV2(state), expected);
  // The serialized form parses back to the identical canonical state.
  const back = parseUrl(expected);
  expectCompatible(back, 'full canonical url');
  assert.deepEqual(back.state, state);
});

test('csv arrays are trimmed, deduped and sorted', () => {
  const result = parseUrl(
    'length=length%3Along,length%3Ashort&length=length%3Ashort,length%3Amedium',
  );
  expectCompatible(result);
  assert.deepEqual(result.state.lengthIds, ['length:long', 'length:medium', 'length:short']);
  assert.equal(
    serializeDiscoveryQueryV2(result.state),
    'length=length%3Along%2Clength%3Amedium%2Clength%3Ashort',
  );
});

test('parse-serialize-parse is a fixed point for compatible queries', () => {
  const inputs = [
    '',
    'tab=creators',
    'q=hello+world&sort=trending&source=creators',
    'browse=shape&topic=shape%3Aalmond',
    'browse=theme&topic=theme%3Afloral-plants',
    'topic=editorial',
    'length=length%3Amedium%2Clength%3Aextra-long',
    'technique=technique%3Afrench&makeability=makeability%3Ahand-made&rights=rights%3Aoriginal',
    'browse=recommended&topic=following',
  ];
  for (const input of inputs) {
    const opts = { relationshipProviderAvailable: input.includes('following') };
    const first = parseUrl(input, opts);
    expectCompatible(first, input);
    const serialized = serializeDiscoveryQueryV2(first.state);
    const second = parseUrl(serialized, opts);
    expectCompatible(second, `${input} -> ${serialized}`);
    assert.deepEqual(second.state, first.state, `fixed point failed for ${input} -> ${serialized}`);
    assert.equal(
      serializeDiscoveryQueryV2(second.state),
      serialized,
      `serialization not stable for ${input}`,
    );
  }
});

test('repeated serialization is byte-stable', () => {
  const samples = [
    createDefaultDiscoveryQueryState(),
    parseUrl(
      'tab=creators&q=hi&sort=new&source=official&browse=style&topic=style%3Aminimal-clean' +
        '&length=length%3Along,length%3Ashort&makeability=makeability%3Amachine-direct' +
        '&rights=rights%3Aoriginal&technique=technique%3Afrench',
    ).state,
    parseUrl('style=ST-02').state,
    parseUrl('shape=coffin').state,
    parseUrl('browse=shape').state, // incompatible state stays deterministic
  ];
  for (const state of samples) {
    assert.equal(serializeDiscoveryQueryV2(state), serializeDiscoveryQueryV2(state));
  }
});

// ---------------------------------------------------------------------------
// q trim / bound
// ---------------------------------------------------------------------------

test('q is trimmed and bounded at 100', () => {
  const result = parseUrl('q=%20%20hello%20world%20%20');
  expectCompatible(result);
  assert.equal(result.state.q, 'hello world');

  const long = 'a'.repeat(MAX_DISCOVERY_QUERY_Q_LENGTH + 1);
  const result2 = parseUrl(`q=${encodeURIComponent(long)}`);
  expectIncompatible(result2, 'q-too-long');
  assert.equal(result2.state.q, '');
  assert.equal(result2.state.incompatible[0].rawValue, long);

  const result3 = parseUrl(`q=${encodeURIComponent('a'.repeat(MAX_DISCOVERY_QUERY_Q_LENGTH))}`);
  expectCompatible(result3);
  assert.equal(result3.state.q.length, MAX_DISCOVERY_QUERY_Q_LENGTH);
});

// ---------------------------------------------------------------------------
// Incompatible new-format inputs
// ---------------------------------------------------------------------------

test('unknown keys are incompatible with stable issue shape', () => {
  const result = parseUrl('foo=bar&page=2');
  expectIncompatible(result, 'unknown-key');
  assert.deepEqual(result.state.incompatible, [
    { key: 'foo', rawValue: 'bar', code: 'unknown-key' },
    { key: 'page', rawValue: '2', code: 'unknown-key' },
  ]);
});

test('duplicate singleton params are incompatible', () => {
  const cases = [
    ['q=a&q=b', 'q'],
    ['tab=looks&tab=creators', 'tab'],
    ['sort=featured&sort=new', 'sort'],
    ['source=all&source=official', 'source'],
    ['browse=style&browse=shape', 'browse'],
    ['topic=for-you&topic=trending', 'topic'],
    ['style=ST-01&style=ST-02', 'style'],
    ['shape=almond&shape=oval', 'shape'],
  ];
  for (const [search, key] of cases) {
    const result = parseUrl(search);
    expectIncompatible(result, 'duplicate-param', search);
    const issue = result.state.incompatible.find((item) => item.code === 'duplicate-param');
    assert.equal(issue.key, key, `duplicate key for ${search}`);
  }
});

test('invalid tab/sort/source/browse values are incompatible', () => {
  const cases = [
    ['tab=admin', 'invalid-tab', 'tab'],
    ['sort=hot', 'invalid-sort', 'sort'],
    ['source=everyone', 'invalid-source', 'source'],
    ['browse=random', 'invalid-browse', 'browse'],
  ];
  for (const [search, code, key] of cases) {
    const result = parseUrl(search);
    expectIncompatible(result, code, search);
    assert.equal(result.state.incompatible.find((issue) => issue.code === code).key, key);
  }
});

test('topic must be an exact active namespaced id in the correct dimension', () => {
  // unknown id in the correct dimension
  let result = parseUrl('browse=style&topic=style%3Anot-a-tag');
  expectIncompatible(result, 'topic-invalid-tag');

  // raw alias is never accepted for the new topic param
  result = parseUrl('browse=style&topic=ST-01');
  expectIncompatible(result, 'topic-invalid-tag');

  // bare legacy shape value is not a namespaced id
  result = parseUrl('browse=shape&topic=almond');
  expectIncompatible(result, 'topic-invalid-tag');

  // valid id in the wrong dimension
  result = parseUrl('browse=style&topic=shape%3Aalmond');
  expectIncompatible(result, 'topic-wrong-dimension');

  // recommended browse only accepts known channels
  result = parseUrl('topic=shape%3Aalmond');
  expectIncompatible(result, 'topic-unknown-channel');
  result = parseUrl('topic=for-you-2');
  expectIncompatible(result, 'topic-unknown-channel');

  // deprecated tag ids are incompatible when the fixture carries any
  const deprecatedTagIds = [];
  for (const dimension of Object.keys(taxonomy.dimensions)) {
    for (const tag of taxonomy.dimensions[dimension].tags) {
      if (tag.lifecycle !== 'ACTIVE') deprecatedTagIds.push(tag.id);
    }
  }
  for (const id of deprecatedTagIds) {
    const deprecated = parseUrl(`browse=style&topic=${encodeURIComponent(id)}`);
    expectIncompatible(deprecated, 'topic-invalid-tag', `deprecated topic ${id}`);
  }
});

test('csv items must be exact active namespaced ids in the correct dimension', () => {
  // wrong dimension
  let result = parseUrl('technique=length%3Ashort');
  expectIncompatible(result, 'invalid-technique-item');
  result = parseUrl('length=makeability%3Amachine-direct');
  expectIncompatible(result, 'invalid-length-item');

  // raw alias is never accepted
  result = parseUrl('technique=ST-02');
  expectIncompatible(result, 'invalid-technique-item');

  // unknown namespaced id
  result = parseUrl('rights=rights%3Anot-a-thing');
  expectIncompatible(result, 'invalid-rights-item');
  result = parseUrl('makeability=makeability%3Aconcept-only-x');
  expectIncompatible(result, 'invalid-makeability-item');

  // deprecated tag ids are incompatible when the fixture carries any
  const deprecatedTagIds = [];
  for (const dimension of Object.keys(taxonomy.dimensions)) {
    for (const tag of taxonomy.dimensions[dimension].tags) {
      if (tag.lifecycle !== 'ACTIVE') deprecatedTagIds.push(tag.id);
    }
  }
  for (const id of deprecatedTagIds) {
    const deprecated = parseUrl(`length=${encodeURIComponent(id)}`);
    expectIncompatible(deprecated, 'invalid-length-item', `deprecated csv ${id}`);
  }
});

test('malformed and empty csv entries are incompatible', () => {
  let result = parseUrl('length=a,,b');
  expectIncompatible(result, 'empty-csv-item');
  expectIncompatible(result, 'invalid-length-item');

  result = parseUrl('length=');
  expectIncompatible(result, 'empty-csv-item');

  result = parseUrl('technique=,technique%3Afrench');
  expectIncompatible(result, 'empty-csv-item');

  // valid items still parse alongside a typed issue
  result = parseUrl('technique=technique%3Afrench');
  expectCompatible(result);
  assert.deepEqual(result.state.techniqueIds, ['technique:french']);
});

test('non-default browse without a topic is incompatible', () => {
  for (const browse of ['shape', 'style', 'scene', 'theme']) {
    const result = parseUrl(`browse=${browse}`);
    expectIncompatible(result, 'topic-missing', browse);
    assert.equal(result.state.browse, browse);
  }
});

test('following channel requires a relationship provider', () => {
  const unavailable = parseUrl('topic=following', { relationshipProviderAvailable: false });
  expectIncompatible(unavailable, 'following-unavailable');

  const available = parseUrl('browse=recommended&topic=following', {
    relationshipProviderAvailable: true,
  });
  expectCompatible(available);
  assert.equal(available.state.topic, 'following');
  assert.equal(serializeDiscoveryQueryV2(available.state), 'topic=following');
});

// ---------------------------------------------------------------------------
// Legacy compatibility markers
// ---------------------------------------------------------------------------

test('style=ST-02 maps to technique:french with a removable marker', () => {
  const result = parseUrl('style=ST-02');
  expectCompatible(result);
  assert.equal(result.state.browse, 'recommended');
  assert.equal(result.state.topic, 'for-you');
  assert.deepEqual(result.state.techniqueIds, ['technique:french']);
  assert.deepEqual(result.state.markers, [
    {
      legacyKey: 'style',
      rawValue: 'ST-02',
      canonicalKey: 'technique',
      canonicalValue: 'technique:french',
      code: 'compat-style-french',
    },
  ]);
  // canonical serialization: only the new technique param, never style=
  assert.equal(serializeDiscoveryQueryV2(result.state), 'technique=technique%3Afrench');
});

test('french aliases behave like ST-02 and never produce a sixth browse value', () => {
  for (const alias of ['法式', 'French', 'french', 'French Tip']) {
    const result = parseUrl(`style=${encodeURIComponent(alias)}`);
    expectCompatible(result, alias);
    assert.deepEqual(result.state.techniqueIds, ['technique:french']);
    assert.equal(result.state.markers[0].code, 'compat-style-french');
    assert.ok(
      DISCOVERY_BROWSE.includes(result.state.browse),
      `browse must stay within the five browse values for ${alias}`,
    );
    assert.equal(result.state.browse, 'recommended');
  }
  // Round-trip: the compatibility marker is parse-time provenance for an old
  // URL and is intentionally removable. Canonical serialization drops it, so a
  // reparsed canonical URL must have empty markers while preserving the
  // browse/topic/techniqueIds and staying byte-stable.
  const first = parseUrl('style=ST-02');
  assert.equal(first.state.markers.length, 1, 'marker present before round-trip');
  const canonical = serializeDiscoveryQueryV2(first.state);
  assert.equal(canonical, 'technique=technique%3Afrench');
  const back = parseUrl(canonical);
  expectCompatible(back, 'reparsed canonical french');
  assert.deepEqual(back.state.markers, [], 'markers must not persist into canonical state');
  assert.equal(back.state.browse, first.state.browse);
  assert.equal(back.state.topic, first.state.topic);
  assert.deepEqual(back.state.techniqueIds, first.state.techniqueIds);
  assert.equal(
    serializeDiscoveryQueryV2(back.state),
    canonical,
    'french round-trip serialization is byte-stable',
  );
});

test('entry and return_to are passthrough context keys, not discovery filters', () => {
  const passthrough = 'entry=wizard&return_to=%2Fstudio%2Fdesign%2Fnew%3Ffresh%3D1';

  // passthrough keys + a legacy style still parse compatibly, produce the
  // french marker, and never surface as unknown-key issues.
  const result = parseUrl(`${passthrough}&style=ST-02`);
  expectCompatible(result, 'passthrough + style=ST-02');
  assert.deepEqual(result.state.incompatible, []);
  assert.equal(result.state.browse, 'recommended');
  assert.equal(result.state.topic, 'for-you');
  assert.deepEqual(result.state.techniqueIds, ['technique:french']);
  assert.equal(result.state.markers.length, 1);
  assert.equal(result.state.markers[0].code, 'compat-style-french');
  // the serializer omits the passthrough keys: only the canonical technique remains
  assert.equal(serializeDiscoveryQueryV2(result.state), 'technique=technique%3Afrench');

  // passthrough keys alone carry no discovery filter and serialize empty
  const bare = parseUrl(passthrough);
  expectCompatible(bare, 'passthrough only');
  assert.deepEqual(bare.state, createDefaultDiscoveryQueryState());
  assert.equal(serializeDiscoveryQueryV2(bare.state), '');

  // unknown keys (e.g. foo) remain incompatible even alongside passthrough keys
  const foo = parseUrl(`${passthrough}&foo=bar`);
  expectIncompatible(foo, 'unknown-key', 'unknown foo alongside passthrough');
});

test('other legacy ST ids resolve via taxonomy alias to a style browse', () => {
  const cases = [
    ['ST-01', 'style:minimal-clean'],
    ['ST-03', 'style:soft-delicate'],
    ['ST-10', 'style:glamorous-sparkling'],
  ];
  for (const [legacy, canonical] of cases) {
    const result = parseUrl(`style=${legacy}`);
    expectCompatible(result, legacy);
    assert.equal(result.state.browse, 'style');
    assert.equal(result.state.topic, canonical);
    assert.deepEqual(result.state.markers, [
      {
        legacyKey: 'style',
        rawValue: legacy,
        canonicalKey: 'topic',
        canonicalValue: canonical,
        code: 'compat-style-alias',
      },
    ]);
    assert.equal(
      serializeDiscoveryQueryV2(result.state),
      `browse=style&topic=${encodeURIComponent(canonical)}`,
    );
  }
});

test('unresolvable style values are incompatible', () => {
  let result = parseUrl('style=ST-99');
  expectIncompatible(result, 'invalid-style-item');
  result = parseUrl('style=minimal-clean');
  expectIncompatible(result, 'invalid-style-item');
  result = parseUrl('style=');
  expectIncompatible(result, 'invalid-style-item');
});

test('bare legacy shape values map to canonical shape ids', () => {
  for (const [legacy, canonical] of Object.entries(LEGACY_SHAPE_MAP)) {
    const result = parseUrl(`shape=${legacy}`);
    expectCompatible(result, legacy);
    assert.equal(result.state.browse, 'shape');
    assert.equal(result.state.topic, canonical);
    assert.deepEqual(result.state.markers, [
      {
        legacyKey: 'shape',
        rawValue: legacy,
        canonicalKey: 'topic',
        canonicalValue: canonical,
        code: 'compat-shape',
      },
    ]);
    assert.equal(
      serializeDiscoveryQueryV2(result.state),
      `browse=shape&topic=${encodeURIComponent(canonical)}`,
    );
  }
  // coffin → shape:coffin-ballerina specifically
  assert.equal(LEGACY_SHAPE_MAP.coffin, 'shape:coffin-ballerina');
});

test('unknown bare shape values are incompatible', () => {
  let result = parseUrl('shape=tapered-square');
  expectIncompatible(result, 'invalid-shape-item');
  result = parseUrl('shape=shape%3Aalmond');
  expectIncompatible(result, 'invalid-shape-item');
  result = parseUrl('shape=');
  expectIncompatible(result, 'invalid-shape-item');
});

test('bare legacy length values map to canonical length ids', () => {
  const result = parseUrl('length=short,medium,extra-long');
  expectCompatible(result);
  assert.deepEqual(result.state.lengthIds, ['length:extra-long', 'length:medium', 'length:short']);
  assert.equal(result.state.markers.length, 3);
  assert.ok(result.state.markers.every((marker) => marker.code === 'compat-length'));
  assert.ok(result.state.markers.every((marker) => marker.legacyKey === 'length'));
  assert.ok(result.state.markers.every((marker) => marker.canonicalKey === 'length'));
  assert.equal(
    serializeDiscoveryQueryV2(result.state),
    'length=length%3Aextra-long%2Clength%3Amedium%2Clength%3Ashort',
  );

  // namespaced length is the new format: no compatibility marker
  const namespaced = parseUrl('length=length%3Ashort');
  expectCompatible(namespaced);
  assert.deepEqual(namespaced.state.lengthIds, ['length:short']);
  assert.equal(namespaced.state.markers.length, 0);

  // bare value outside the legacy map is incompatible
  const unknown = parseUrl('length=ultra-long');
  expectIncompatible(unknown, 'invalid-length-item');
  const unknown2 = parseUrl('length=extra-short');
  expectIncompatible(unknown2, 'invalid-length-item');
});

test('lossy legacy params are always incompatible, even with plausible values', () => {
  for (const key of ['color', 'occasion', 'effect', 'mood', 'application', 'verification']) {
    const result = parseUrl(`${key}=whatever`);
    expectIncompatible(result, 'legacy-lossy', key);
    const issue = result.state.incompatible.find((item) => item.code === 'legacy-lossy');
    assert.equal(issue.key, key);
    assert.equal(issue.rawValue, 'whatever');
  }
  // plausible-looking values never get guessed
  const result = parseUrl('color=red&occasion=bridal&effect=glossy');
  expectIncompatible(result, 'legacy-lossy');
  assert.equal(result.state.incompatible.filter((issue) => issue.code === 'legacy-lossy').length, 3);
  // the serializer never emits lossy keys
  assert.equal(serializeDiscoveryQueryV2(result.state), '');
});

test('old and new representations of the same dimension conflict', () => {
  // style=ST-02 (→ technique:french) + new technique param
  let result = parseUrl('style=ST-02&technique=technique%3Afrench');
  expectIncompatible(result, 'legacy-conflict');
  assert.deepEqual(result.state.techniqueIds, ['technique:french']);
  assert.equal(result.state.markers.length, 0);

  // style=ST-01 (→ style browse) + new style browse
  result = parseUrl('style=ST-01&browse=style');
  expectIncompatible(result, 'legacy-conflict');
  assert.equal(result.state.markers.length, 0);

  // shape=almond + new shape browse
  result = parseUrl('shape=almond&browse=shape');
  expectIncompatible(result, 'legacy-conflict');
  result = parseUrl('shape=almond&browse=shape&topic=shape%3Aalmond');
  expectIncompatible(result, 'legacy-conflict');
  assert.equal(result.state.markers.length, 0);

  // bare length + namespaced length for the same canonical id
  result = parseUrl('length=short&length=length%3Ashort');
  expectIncompatible(result, 'legacy-conflict');
  assert.equal(result.state.lengthIds.length, 0);
  assert.equal(result.state.markers.length, 0);
});

// ---------------------------------------------------------------------------
// Totality, bounds, immutability
// ---------------------------------------------------------------------------

test('incompatible issues are bounded', () => {
  const params = new URLSearchParams();
  for (let i = 0; i < 60; i += 1) params.set(`unknown${i}`, `v${i}`);
  const result = parseDiscoveryQueryV2(params, taxonomy, { relationshipProviderAvailable: false });
  assert.equal(result.state.incompatible.length, MAX_DISCOVERY_QUERY_ISSUES);
  assert.equal(result.state.incompatible.every((issue) => issue.code === 'unknown-key'), true);
});

test('parser never mutates its inputs', () => {
  const search = 'q=hello&length=short&style=ST-02&unknown=1&browse=shape';
  const params = new URLSearchParams(search);
  const before = params.toString();
  const taxonomyBefore = structuredClone(taxonomy);
  parseDiscoveryQueryV2(params, taxonomy, { relationshipProviderAvailable: false });
  assert.equal(params.toString(), before);
  assert.deepEqual(taxonomy, taxonomyBefore);
});

test('parser is total: malformed inputs never throw', () => {
  const inputs = [
    '=x',
    'a',
    'a=1&a',
    'q=%00',
    'browse=style&topic=%00',
    'style=%00',
    'length=%E0%A4%A',
    'topic=%00&browse=shape',
    'browse=style&topic=ST-01&style=ST-01',
    'length=short&length=length%3Ashort&length=medium',
    'browse=recommended&topic=following&topic=for-you',
  ];
  for (const input of inputs) {
    assert.doesNotThrow(() => parseUrl(input), `must not throw for ${input}`);
  }
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failed > 0) {
  console.error(`\n${failed} of ${passed + failed} discovery-query tests FAILED:\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}
console.log(`discovery-query v2: all ${passed} tests passed.`);
