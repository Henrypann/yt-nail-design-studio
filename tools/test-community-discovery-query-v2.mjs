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
 *  - issues bounded at MAX_DISCOVERY_QUERY_ISSUES; inputs never mutated;
 *  - URL compatibility glue (checkpoint 3): canonical + raw merge preserves
 *    the incompatible representation without duplicate accumulation
 *    (byte-stable), CSV-item-aware explicit removal, fail-closed singleton
 *    removal, and input immutability for both helpers;
 *  - executor matrix (checkpoint 2): governance-first counting, primary /
 *    auxiliary / q filters over the real four-look + canonical read models,
 *    source, recommendation channels, fail-closed unknown channel and
 *    executor immutability/determinism.
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
  executeDiscoveryQueryV2,
  mergeDiscoveryQueryIncompatibleParams,
  parseDiscoveryQueryV2,
  removeDiscoveryQueryIncompatibleIssue,
  serializeDiscoveryQueryV2,
} from '../src/community/domain/taxonomy-v2/discovery-query.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

const root = process.cwd();
const fixturePath = path.join(root, 'public/community/taxonomy-v2.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const PUBLISHERS = JSON.parse(
  fs.readFileSync(path.join(root, 'public/community/publishers.json'), 'utf8'),
);

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
// URL compatibility glue (COMM-v0.7.2-TAX-03 checkpoint 3)
// ---------------------------------------------------------------------------

test('glue merge: mixed csv survives the canonical merge without duplicate accumulation', () => {
  const current = new URLSearchParams('q=hi&length=length%3Ashort%2Cultra-long');
  const parsed = parseDiscoveryQueryV2(current, taxonomy, { relationshipProviderAvailable: false });
  expectIncompatible(parsed, 'invalid-length-item');
  assert.deepEqual(parsed.state.lengthIds, ['length:short'], 'valid sibling still parses');

  const canonical = new URLSearchParams(serializeDiscoveryQueryV2(parsed.state));
  assert.equal(canonical.toString(), 'q=hi&length=length%3Ashort', 'canonical carries the valid part');

  const merged = mergeDiscoveryQueryIncompatibleParams(canonical, current, parsed.state.incompatible);
  // exactly one same raw occurrence: canonical + raw are never stacked
  assert.deepEqual(merged.getAll('length'), ['length:short,ultra-long']);
  assert.equal(merged.toString(), 'q=hi&length=length%3Ashort%2Cultra-long');

  // repeated merge on its own output: byte-stable, no accumulation
  const parsedAgain = parseDiscoveryQueryV2(merged, taxonomy, { relationshipProviderAvailable: false });
  expectIncompatible(parsedAgain, 'invalid-length-item');
  assert.deepEqual(parsedAgain.state.lengthIds, ['length:short']);
  const mergedAgain = mergeDiscoveryQueryIncompatibleParams(
    new URLSearchParams(serializeDiscoveryQueryV2(parsedAgain.state)),
    merged,
    parsedAgain.state.incompatible,
  );
  assert.equal(mergedAgain.toString(), merged.toString(), 'repeat merge is byte-stable');
  assert.deepEqual(mergedAgain.getAll('length'), ['length:short,ultra-long'], 'no growing duplicates');
});

test('glue merge: locked source keeps only the raw source, no growing duplicate', () => {
  const current = new URLSearchParams('source=bogus&q=hi');
  const parsed = parseDiscoveryQueryV2(current, taxonomy, { relationshipProviderAvailable: false });
  expectIncompatible(parsed, 'invalid-source');

  // lockedSource: effective state carries source=official while the URL must
  // keep the raw incompatible source=bogus untouched.
  const effective = { ...parsed.state, source: 'official' };
  const canonical = new URLSearchParams(serializeDiscoveryQueryV2(effective));
  assert.equal(canonical.toString(), 'q=hi&source=official');

  const merged = mergeDiscoveryQueryIncompatibleParams(canonical, current, parsed.state.incompatible);
  assert.deepEqual(merged.getAll('source'), ['bogus'], 'only the raw source survives');
  assert.equal(merged.toString(), 'q=hi&source=bogus');

  // repeating the merge on its own output never stacks source occurrences
  const parsedAgain = parseDiscoveryQueryV2(merged, taxonomy, { relationshipProviderAvailable: false });
  expectIncompatible(parsedAgain, 'invalid-source');
  const mergedAgain = mergeDiscoveryQueryIncompatibleParams(
    new URLSearchParams(serializeDiscoveryQueryV2({ ...parsedAgain.state, source: 'official' })),
    merged,
    parsedAgain.state.incompatible,
  );
  assert.deepEqual(mergedAgain.getAll('source'), ['bogus'], 'no growing duplicate');
  assert.equal(mergedAgain.toString(), merged.toString(), 'repeat merge is byte-stable');
});

test('glue remove: dropping one csv item preserves siblings and other keys', () => {
  const params = new URLSearchParams(
    'q=hi&length=length%3Ashort%2Cultra-long&length=length%3Amedium&technique=technique%3Afrench',
  );
  const issue = { key: 'length', rawValue: 'ultra-long', code: 'invalid-length-item' };
  const out = removeDiscoveryQueryIncompatibleIssue(params, issue);
  assert.equal(
    out.toString(),
    'q=hi&length=length%3Ashort%2Clength%3Amedium&technique=technique%3Afrench',
    'sibling items and other keys preserved, canonicalized to one occurrence',
  );
  assert.deepEqual(out.getAll('length'), ['length:short,length:medium']);
  assert.deepEqual(out.getAll('technique'), ['technique:french']);
  assert.equal(out.get('q'), 'hi');

  // the cleaned URL reparses fully compatible
  const reparsed = parseDiscoveryQueryV2(out, taxonomy, { relationshipProviderAvailable: false });
  expectCompatible(reparsed, 'cleaned url');
  assert.deepEqual(reparsed.state.lengthIds, ['length:medium', 'length:short']);
});

test('glue remove: empty csv item is removed for empty-csv-item issues', () => {
  const params = new URLSearchParams('length=length%3Ashort%2C%2Clength%3Amedium');
  const parsed = parseDiscoveryQueryV2(params, taxonomy, { relationshipProviderAvailable: false });
  const issue = parsed.state.incompatible.find((item) => item.code === 'empty-csv-item');
  assert.ok(issue, 'empty-csv-item issue present');
  assert.equal(issue.rawValue, '');
  const out = removeDiscoveryQueryIncompatibleIssue(params, issue);
  assert.equal(out.toString(), 'length=length%3Ashort%2Clength%3Amedium', 'empty item dropped, siblings kept');
  const reparsed = parseDiscoveryQueryV2(out, taxonomy, { relationshipProviderAvailable: false });
  expectCompatible(reparsed, 'cleaned empty csv item');
});

test('glue remove: deleting the only csv item removes the key', () => {
  const params = new URLSearchParams('q=hi&length=ultra-long');
  const issue = { key: 'length', rawValue: 'ultra-long', code: 'invalid-length-item' };
  const out = removeDiscoveryQueryIncompatibleIssue(params, issue);
  assert.equal(out.has('length'), false, 'key deleted when no item remains');
  assert.equal(out.toString(), 'q=hi');
  // removal is repeatable / idempotent
  assert.equal(removeDiscoveryQueryIncompatibleIssue(out, issue).toString(), 'q=hi');
});

test('glue remove: invalid singleton keys are deleted wholesale, others preserved', () => {
  const params = new URLSearchParams('source=bogus&q=hi&length=length%3Ashort');
  const issue = { key: 'source', rawValue: 'bogus', code: 'invalid-source' };
  const out = removeDiscoveryQueryIncompatibleIssue(params, issue);
  assert.equal(out.has('source'), false);
  assert.equal(out.toString(), 'q=hi&length=length%3Ashort');

  // duplicate singleton intent is ambiguous: the whole key fails closed
  const dup = new URLSearchParams('source=bogus&source=everyone&q=hi');
  const dupOut = removeDiscoveryQueryIncompatibleIssue(dup, {
    key: 'source',
    rawValue: 'bogus',
    code: 'duplicate-param',
  });
  assert.equal(dupOut.has('source'), false, 'every duplicate occurrence is removed');
  assert.equal(dupOut.toString(), 'q=hi');
});

test('glue helpers never mutate their inputs', () => {
  const canonical = new URLSearchParams('q=hi&length=length%3Ashort');
  const current = new URLSearchParams('length=length%3Ashort%2Cultra-long');
  const issues = [{ key: 'length', rawValue: 'ultra-long', code: 'invalid-length-item' }];
  const canonicalBefore = canonical.toString();
  const currentBefore = current.toString();
  const merged = mergeDiscoveryQueryIncompatibleParams(canonical, current, issues);
  assert.notEqual(merged, canonical, 'merge returns a new instance');
  assert.equal(canonical.toString(), canonicalBefore, 'canonical untouched');
  assert.equal(current.toString(), currentBefore, 'current untouched');

  const params = new URLSearchParams('length=length%3Ashort%2Cultra-long&source=bogus');
  const paramsBefore = params.toString();
  const removed = removeDiscoveryQueryIncompatibleIssue(params, issues[0]);
  assert.notEqual(removed, params, 'removal returns a new instance');
  assert.equal(params.toString(), paramsBefore, 'params untouched');
});

// ---------------------------------------------------------------------------
// Executor matrix (COMM-v0.7.2-TAX-03 checkpoint 2)
//
// `executeDiscoveryQueryV2` is exercised through one helper that runs the real
// `parseDiscoveryQueryV2` (injected relationship flag) and then the executor
// with a frozen `asOf` and explicit trending signals. Crafted looks are
// structural clones of the real governed four-look / canonical read models
// with only the field under test changed; everything else stays governed.
// ---------------------------------------------------------------------------

const AS_OF = '2026-08-17T00:00:00.000Z';
const REAL_LOOKS = [...FOUR_LOOK_SET_READ_MODELS_V0_7_2, CANONICAL_USE_DEMO_READ_MODEL_V1];

/** Clone the ivory-lace-crystal read model (governed base) under a fresh id. */
function craftedLook(id, patch = {}) {
  const look = structuredClone(FOUR_LOOK_SET_READ_MODELS_V0_7_2[2]);
  look.lookId = id;
  look.contentId = id;
  look.discovery = structuredClone(look.discovery);
  look.curation = structuredClone(look.curation);
  look.discovery.subjectRef = { kind: 'PUBLISHED_LOOK', id: `look:${id}` };
  look.curation.subjectRef = { kind: 'PUBLISHED_LOOK', id: `look:${id}` };
  return Object.assign(look, patch);
}

/**
 * Parse `search` (or reuse a pre-built `state`) and execute with the frozen
 * clock, injected relationship flag and signals. `parseRelationshipAvailable`
 * may diverge from `relationshipProviderAvailable` to exercise the executor's
 * own following gate on an otherwise-compatible parsed state.
 */
function runQuery({
  search = '',
  state,
  looks,
  publishers = PUBLISHERS,
  relationshipProviderAvailable = false,
  parseRelationshipAvailable = relationshipProviderAvailable,
  trendingSignals = [],
}) {
  const parsed =
    state ??
    parseDiscoveryQueryV2(new URLSearchParams(search), taxonomy, {
      relationshipProviderAvailable: parseRelationshipAvailable,
    }).state;
  return executeDiscoveryQueryV2({
    looks,
    publishers,
    taxonomy,
    state: parsed,
    relationshipProviderAvailable,
    trendingSignals,
    asOf: AS_OF,
  });
}

const itemIds = (result) => result.items.map((ranked) => ranked.look.lookId);
const SHA_256_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const MAKEABLE_REFS = {
  capabilityRef: 'capability://v0.7.2/uv-inkjet@v1.2.0',
  assetRefs: [`asset://v0.7.2/look-0001/template@sha256:${SHA_256_HEX}`],
  evidenceRefs: ['evidence://v0.7.2/look-0001/makeability@v1.0.0'],
};

test('executor: governance-first blocks invalid records and counts exactly', () => {
  const blockedDiscovery = craftedLook('look.v0-7-2.test.blocked-discovery', { discovery: null });
  const blockedCuration = craftedLook('look.v0-7-2.test.blocked-curation', { curation: null });
  const pendingRights = craftedLook('look.v0-7-2.test.pending-rights');
  pendingRights.discovery.rights.status = 'PENDING';
  const missingStyle = craftedLook('look.v0-7-2.test.missing-style');
  missingStyle.discovery.styleIds = [];
  missingStyle.discovery.techniqueIds = [];
  missingStyle.discovery.migration.state = 'NONE';
  const missingShape = craftedLook('look.v0-7-2.test.missing-shape');
  missingShape.discovery.recommendedShapeIds = [];

  const looks = [
    ...REAL_LOOKS,
    blockedDiscovery,
    blockedCuration,
    pendingRights,
    missingStyle,
    missingShape,
  ];
  const result = runQuery({ search: '', looks });
  assert.equal(result.status, 'ok');
  assert.equal(result.items.length, 5, 'only the five governed real looks surface');
  assert.equal(result.governedCandidateCount, 5);
  assert.equal(result.queryCandidateCount, 5);
  assert.equal(result.governanceBlocked, 5, 'one blocked look per crafted failure mode');
});

test('executor: incompatible state still runs governance first and returns zero', () => {
  const looks = [
    ...REAL_LOOKS,
    craftedLook('look.v0-7-2.test.blocked-extra', { discovery: null }),
  ];
  const result = runQuery({ search: 'foo=bar', looks });
  assert.equal(result.status, 'incompatible');
  assert.deepEqual(result.items, []);
  assert.equal(result.governedCandidateCount, 5, 'governance ran over every input look');
  assert.equal(result.governanceBlocked, 1);
  assert.equal(result.queryCandidateCount, 0);
});

test('executor: french NEEDS_STYLE_REVIEW surfaces by default and technique, never by style', () => {
  const petalVeil = CANONICAL_USE_DEMO_READ_MODEL_V1.lookId;

  const def = runQuery({ search: '', looks: REAL_LOOKS });
  assert.ok(itemIds(def).includes(petalVeil), 'french demo appears in for-you');

  const french = runQuery({ search: 'technique=technique%3Afrench', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(french), [petalVeil], 'only the french record matches technique:french');

  for (const topic of [
    'style%3Aglamorous-sparkling',
    'style%3Asoft-delicate',
    'style%3Agothic-dark',
  ]) {
    const style = runQuery({ search: `browse=style&topic=${topic}`, looks: REAL_LOOKS });
    assert.ok(style.items.length >= 1, `style browse ${topic} still surfaces real records`);
    assert.ok(
      !itemIds(style).includes(petalVeil),
      `french NEEDS_STYLE_REVIEW must never appear in browse=style (${topic})`,
    );
  }
});

test('executor: primary shape/style exact matching on real looks', () => {
  const almond = runQuery({ search: 'browse=shape&topic=shape%3Aalmond', looks: REAL_LOOKS });
  assert.equal(almond.items.length, 5, 'every real look recommends almond');

  const soft = runQuery({ search: 'browse=style&topic=style%3Asoft-delicate', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(soft), [
    'look.v0-7-2.honey-petal-glass',
    'look.v0-7-2.ivory-lace-crystal',
  ]);
});

test('executor: scene/theme primary matching on governed clones with canonical ids', () => {
  const sceneLook = craftedLook('look.v0-7-2.test.scene-gift');
  sceneLook.discovery.sceneIds = ['scene:gift-custom'];
  const themeLook = craftedLook('look.v0-7-2.test.theme-ocean');
  themeLook.discovery.themeIds = ['theme:ocean-coast'];
  const looks = [sceneLook, themeLook];

  const scene = runQuery({ search: 'browse=scene&topic=scene%3Agift-custom', looks });
  assert.deepEqual(itemIds(scene), ['look.v0-7-2.test.scene-gift']);

  const theme = runQuery({ search: 'browse=theme&topic=theme%3Aocean-coast', looks });
  assert.deepEqual(itemIds(theme), ['look.v0-7-2.test.theme-ocean']);

  // exact ids only: an unassigned scene topic matches neither clone
  const miss = runQuery({ search: 'browse=scene&topic=scene%3Awork-commute', looks });
  assert.deepEqual(itemIds(miss), []);
});

test('executor: auxiliary OR within dimensions and AND across them', () => {
  const cloneA = craftedLook('look.v0-7-2.test.aux-a');
  cloneA.discovery.lengthIds = ['length:short'];
  cloneA.discovery.techniqueIds = ['technique:french'];
  cloneA.discovery.makeability = { classification: 'MACHINE_DIRECT', ...MAKEABLE_REFS };
  cloneA.discovery.rights.status = 'LICENSED';

  const cloneB = craftedLook('look.v0-7-2.test.aux-b');
  cloneB.discovery.lengthIds = ['length:long'];
  cloneB.discovery.techniqueIds = [];
  cloneB.discovery.makeability = { classification: 'HAND_MADE', assetRefs: [], evidenceRefs: [] };
  cloneB.discovery.rights.status = 'ORIGINAL';

  const cloneC = craftedLook('look.v0-7-2.test.aux-c');
  cloneC.discovery.lengthIds = ['length:medium'];
  cloneC.discovery.techniqueIds = ['technique:french'];
  cloneC.discovery.makeability = {
    classification: 'MACHINE_HAND_FINISH',
    assetRefs: [],
    evidenceRefs: [],
  };
  cloneC.discovery.rights.status = 'PERSONAL_USE_ONLY';

  const looks = [cloneA, cloneB, cloneC];

  const lengthOr = runQuery({ search: 'length=length%3Ashort%2Clength%3Along', looks });
  assert.deepEqual(itemIds(lengthOr), ['look.v0-7-2.test.aux-a', 'look.v0-7-2.test.aux-b']);

  const makeabilityOr = runQuery({
    search: 'makeability=makeability%3Amachine-direct%2Cmakeability%3Ahand-made',
    looks,
  });
  assert.deepEqual(itemIds(makeabilityOr), ['look.v0-7-2.test.aux-a', 'look.v0-7-2.test.aux-b']);

  const techniqueOr = runQuery({ search: 'technique=technique%3Afrench', looks });
  assert.deepEqual(itemIds(techniqueOr), ['look.v0-7-2.test.aux-a', 'look.v0-7-2.test.aux-c']);

  const rightsOr = runQuery({ search: 'rights=rights%3Alicensed', looks });
  assert.deepEqual(itemIds(rightsOr), ['look.v0-7-2.test.aux-a']);

  const andAcross = runQuery({
    search:
      'length=length%3Ashort&technique=technique%3Afrench' +
      '&makeability=makeability%3Amachine-direct&rights=rights%3Alicensed',
    looks,
  });
  assert.deepEqual(itemIds(andAcross), ['look.v0-7-2.test.aux-a']);

  const miss = runQuery({ search: 'length=length%3Aextra-long', looks });
  assert.deepEqual(itemIds(miss), []);
});

test('executor: q matches title, publisher, canonical ids and taxonomy labels', () => {
  const byTitle = runQuery({ search: 'q=Petal+Veil', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(byTitle), ['look.v7-1.petal-veil']);

  const byDisplayName = runQuery({ search: 'q=%E5%AE%98%E6%96%B9', looks: REAL_LOOKS });
  assert.equal(byDisplayName.items.length, 5, 'displayName 官方 matches every official look');

  const byHandle = runQuery({ search: 'q=nailstyle', looks: REAL_LOOKS });
  assert.equal(byHandle.items.length, 5, 'handle nailstyle matches every official look');

  const byCanonicalId = runQuery({ search: 'q=style%3Aglamorous-sparkling', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(byCanonicalId), ['look.v0-7-2.leopard-gilded-nude']);

  const byZhLabel = runQuery({ search: 'q=%E9%97%AA%E8%80%80%E5%8D%8E%E4%B8%BD', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(byZhLabel), ['look.v0-7-2.leopard-gilded-nude']);

  const byEnLabel = runQuery({ search: 'q=french', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(byEnLabel), ['look.v7-1.petal-veil']);
});

test('executor: legacy-only fields are never searchable via q', () => {
  const legacyOnly = craftedLook('look.v0-7-2.test.legacy-only', {
    mainStyleId: 'zzz-unique-token',
    subStyleIds: ['zzz-unique-token'],
    campaignTags: ['zzz-unique-token'],
  });
  legacyOnly.sourceContent.campaignTags = ['zzz-unique-token'];

  const governed = runQuery({ search: '', looks: [legacyOnly] });
  assert.deepEqual(itemIds(governed), ['look.v0-7-2.test.legacy-only'], 'look is governed');

  const byLegacyToken = runQuery({ search: 'q=zzz-unique-token', looks: [legacyOnly] });
  assert.equal(byLegacyToken.status, 'ok');
  assert.deepEqual(itemIds(byLegacyToken), [], 'legacy fields never feed q matching');
});

test('executor: source filter splits official vs verified creators', () => {
  const creatorLook = craftedLook('look.v0-7-2.test.creator-luna', {
    publisherId: 'pub_demo_luna',
    publisherType: 'VERIFIED_CREATOR',
  });
  const looks = [...REAL_LOOKS, creatorLook];

  const all = runQuery({ search: '', looks });
  assert.equal(all.items.length, 6);

  const official = runQuery({ search: 'source=official', looks });
  assert.equal(official.items.length, 5);
  assert.ok(!itemIds(official).includes(creatorLook.lookId));

  const creators = runQuery({ search: 'source=creators', looks });
  assert.deepEqual(itemIds(creators), [creatorLook.lookId]);
});

test('executor: for-you surfaces every governed look; trending/new force their sort', () => {
  const forYou = runQuery({ search: '', looks: REAL_LOOKS });
  assert.equal(forYou.items.length, 5);
  assert.equal(forYou.effectiveSort.requested, 'featured');
  assert.equal(forYou.effectiveSort.applied, 'featured');

  const trending = runQuery({ search: 'topic=trending', looks: REAL_LOOKS });
  assert.equal(trending.items.length, 5);
  assert.deepEqual(trending.effectiveSort, {
    requested: 'trending',
    applied: 'featured',
    fallbackReason: 'trending_no_signals',
  });

  const fresh = runQuery({ search: 'topic=new', looks: REAL_LOOKS });
  assert.equal(fresh.items.length, 5);
  assert.deepEqual(fresh.effectiveSort, { requested: 'new', applied: 'new' });
});

test('executor: editorial requires curated or explicit editorial feature', () => {
  const notCurated = craftedLook('look.v0-7-2.test.editorial-no');
  notCurated.curation.curated = false;
  notCurated.curation.featuredChannels = [];
  const featuredEditorial = craftedLook('look.v0-7-2.test.editorial-yes');
  featuredEditorial.curation.curated = false;
  featuredEditorial.curation.featuredChannels = ['editorial'];

  const editorial = runQuery({
    search: 'topic=editorial',
    looks: [notCurated, featuredEditorial],
  });
  assert.deepEqual(itemIds(editorial), ['look.v0-7-2.test.editorial-yes']);
});

test('executor: makeable needs current-makeable evidence; dimensional via classification or feature', () => {
  const makeableEmpty = runQuery({ search: 'topic=makeable', looks: REAL_LOOKS });
  assert.deepEqual(itemIds(makeableEmpty), [], 'real fixtures are CONCEPT_ONLY: no current-makeable');

  const machineDirect = craftedLook('look.v0-7-2.test.makeable-md');
  machineDirect.discovery.makeability = { classification: 'MACHINE_DIRECT', ...MAKEABLE_REFS };

  const makeable = runQuery({ search: 'topic=makeable', looks: [machineDirect] });
  assert.deepEqual(itemIds(makeable), ['look.v0-7-2.test.makeable-md']);

  const dimensionalModule = craftedLook('look.v0-7-2.test.dimensional-module');
  dimensionalModule.discovery.makeability = {
    classification: 'DIMENSIONAL_MODULE',
    assetRefs: [],
    evidenceRefs: [],
  };
  const featuredDimensional = craftedLook('look.v0-7-2.test.dimensional-featured');
  featuredDimensional.curation.featuredChannels = ['dimensional'];

  const dimensional = runQuery({
    search: 'topic=dimensional',
    looks: [dimensionalModule, featuredDimensional],
  });
  assert.deepEqual(itemIds(dimensional), [
    'look.v0-7-2.test.dimensional-featured',
    'look.v0-7-2.test.dimensional-module',
  ]);
});

test('executor: emerging-creator and collections are explicit-featured only', () => {
  const emerging = craftedLook('look.v0-7-2.test.emerging');
  emerging.curation.featuredChannels = ['emerging-creator'];
  const collections = craftedLook('look.v0-7-2.test.collections');
  collections.curation.featuredChannels = ['collections'];
  const plainCurated = craftedLook('look.v0-7-2.test.plain-curated');

  const looks = [emerging, collections, plainCurated];
  assert.deepEqual(itemIds(runQuery({ search: 'topic=emerging-creator', looks })), [
    'look.v0-7-2.test.emerging',
  ]);
  assert.deepEqual(itemIds(runQuery({ search: 'topic=collections', looks })), [
    'look.v0-7-2.test.collections',
  ]);
});

test('executor: following unavailable is incompatible zero; available needs explicit feature', () => {
  // parser-level unavailability: the parse already records following-unavailable
  const parserUnavailable = runQuery({
    search: 'topic=following',
    looks: REAL_LOOKS,
    relationshipProviderAvailable: false,
  });
  assert.equal(parserUnavailable.status, 'incompatible');
  assert.deepEqual(parserUnavailable.items, []);
  assert.ok(
    parserUnavailable.incompatible.some((issue) => issue.code === 'following-unavailable'),
  );
  assert.equal(parserUnavailable.governedCandidateCount, 5, 'governance counts still reported');

  // executor-level unavailability: a compatible parsed state is re-checked
  const executorUnavailable = runQuery({
    search: 'topic=following',
    looks: REAL_LOOKS,
    parseRelationshipAvailable: true,
    relationshipProviderAvailable: false,
  });
  assert.equal(executorUnavailable.status, 'incompatible');
  assert.deepEqual(executorUnavailable.items, []);
  assert.ok(
    executorUnavailable.incompatible.some((issue) => issue.code === 'following-unavailable'),
  );

  // available provider: only explicit featuredChannels membership qualifies
  const following = craftedLook('look.v0-7-2.test.following');
  following.curation.featuredChannels = ['following'];
  const plain = craftedLook('look.v0-7-2.test.following-plain');
  const available = runQuery({
    search: 'topic=following',
    looks: [following, plain],
    relationshipProviderAvailable: true,
  });
  assert.equal(available.status, 'ok');
  assert.deepEqual(itemIds(available), ['look.v0-7-2.test.following']);
});

test('executor: unknown recommendation channel fails closed on a clean state', () => {
  const unknownTopic = { ...createDefaultDiscoveryQueryState(), topic: 'not-a-channel' };
  const result = runQuery({ state: unknownTopic, looks: REAL_LOOKS });
  assert.equal(result.status, 'ok', 'clean state stays ok');
  assert.deepEqual(result.items, [], 'unknown channel never behaves like for-you');
  assert.equal(result.governedCandidateCount, 5, 'governance still ran over all looks');
});

test('executor: issues are carried not widened; inputs never mutate; runs are deterministic', () => {
  // carried, not widened
  const parsed = parseDiscoveryQueryV2(new URLSearchParams('foo=bar'), taxonomy, {
    relationshipProviderAvailable: false,
  });
  const carried = runQuery({ state: parsed.state, looks: REAL_LOOKS });
  assert.equal(carried.status, 'incompatible');
  assert.deepEqual(carried.incompatible, parsed.state.incompatible, 'exactly the carried issues');

  // inputs never mutated
  const looks = REAL_LOOKS;
  const state = createDefaultDiscoveryQueryState();
  const looksBefore = structuredClone(looks);
  const stateBefore = structuredClone(state);
  const taxonomyBefore = structuredClone(taxonomy);
  const publishersBefore = structuredClone(PUBLISHERS);
  runQuery({ state, looks, publishers: PUBLISHERS });
  assert.deepEqual(looks, looksBefore);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(taxonomy, taxonomyBefore);
  assert.deepEqual(PUBLISHERS, publishersBefore);

  // repeated runs deep-equal (deterministic filter + rank)
  const first = runQuery({ search: '', looks: REAL_LOOKS });
  const second = runQuery({ search: '', looks: REAL_LOOKS });
  assert.deepEqual(second, first);
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
