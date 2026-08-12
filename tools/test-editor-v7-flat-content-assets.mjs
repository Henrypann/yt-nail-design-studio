import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { PROCESS_STEP_TYPE_IDS_V7 } from '../src/studio/editor/v7/registry.ts';
import { addEditorV7Element, addEditorV7Step } from '../src/studio/editor/v7/commands.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import {
  FLAT_ASSET_MAX_BYTES_V7,
  FLAT_ASSET_MIME_PNG_V7,
  FLAT_ASSET_MIME_SVG_V7,
  FLAT_ASSET_REVISION_V1_V7,
  FLAT_BUNDLED_ASSET_REGISTRY_V7,
  FLAT_FONT_REGISTRY_V7,
  FLAT_TEXT_MAX_CODE_POINTS_V7,
  createImageFlatElementV7,
  createTextFlatElementV7,
  flatAssetSourcePayloadBytesV7,
  flatAssetSourcePayloadV7,
  getBundledFlatAssetV7,
  isFlatImageRoleCompatibleV7,
  isValidFlatAssetRefV7,
  prepareFlatAssetImportV7,
  resolveBundledFlatAssetV7,
  resolveFontCssFamilyV7,
} from '../src/studio/editor/v7/flat-content-assets.ts';
import { IDENTITY_TRANSFORM_V7 } from '../src/studio/editor/v7/flat-vector.ts';
import {
  FLAT_ASSETS_STORAGE_KEY_V7,
  createFlatAssetRepositoryV7,
  flatAssetKeyV7,
} from '../src/studio/editor/v7/flat-content-repository.ts';
import {
  addBundledFlatAssetCommand,
  addPreparedImportCommand,
  addTextFlatElementCommand,
  relinkImageAssetCommand,
} from '../src/studio/editor/v7/flat-content-commands.ts';
import { deriveEditorWorkspaceToolsV7 } from '../src/studio/editor/v7/workspace-ia.ts';

const clone = (value) => structuredClone(value);
const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };
const color = { colorSpace: 'srgb', r: 184, g: 36, b: 92, a: 1 };
const SANS_FONT = { id: 'font.builtin.system-sans', revision: 'flat-fonts-v1' };
const SERIF_FONT = { id: 'font.builtin.system-serif', revision: 'flat-fonts-v1' };

const digest = async (bytes) => (
  createHash('sha256').update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex')
);

/* ── PNG fixture builder (valid structure, real CRCs) ─────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pngBytes({ width, height, colorType, bitDepth = 8, randomSeed = null }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const rowLength = 1 + Math.max(0, width) * channels;
  const raw = Buffer.alloc(rowLength * Math.max(0, height));
  if (randomSeed !== null) {
    let state = randomSeed >>> 0;
    for (let row = 0; row < Math.max(0, height); row += 1) {
      const offset = row * rowLength;
      raw[offset] = 0;
      for (let index = 1; index < rowLength; index += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        raw[offset + index] = state >>> 24;
      }
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

/* ── shared helpers ───────────────────────────────────────────────────── */

const source = (bytes, type, name = 'import.bin') => ({
  name,
  type,
  size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

class MemoryStorage {
  constructor(docs) { this.docs = clone(docs); this.writes = 0; }
  read = () => clone(this.docs);
  write = async (docs) => { this.docs = clone(docs); this.writes += 1; };
}

class MemoryFlatStorage {
  constructor(initial = null) { this.value = initial; this.reads = 0; this.writes = 0; this.failWrite = null; this.failRead = null; }
  read = () => { this.reads += 1; if (this.failRead) throw this.failRead; return this.value; };
  write = (value) => { if (this.failWrite) throw this.failWrite; this.value = value; this.writes += 1; };
}

class FakeTimers {
  next = 1;
  tasks = new Map();
  setTimeout = (callback) => { const id = this.next++; this.tasks.set(id, callback); return id; };
  clearTimeout = (id) => { this.tasks.delete(id); };
}

function createFlatStep(id = 'step.v7-10.flat') {
  return {
    id,
    typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
    kind: 'flat_design',
    name: '平面设计',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [],
    elements: [],
  };
}

function runtime(doc) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const flatStorage = new MemoryFlatStorage();
  const timers = new FakeTimers();
  let counter = 0;
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    flatAssets: createFlatAssetRepositoryV7(flatStorage, { digest }),
    now: () => '2026-08-10T12:00:00.000Z',
    idFactory: (prefix) => `${prefix}.v7-10.${++counter}`,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  return { storage, flatStorage, store };
}

function captureInvariants(store) {
  const state = store.getState();
  return {
    doc: clone(state.doc),
    history: clone(state.history),
    future: clone(state.future),
    saveState: state.saveState,
    revision: state.doc?.revision,
  };
}

function assertInvariants(store, before) {
  const state = store.getState();
  assert.deepEqual(state.doc, before.doc);
  assert.deepEqual(state.history, before.history);
  assert.deepEqual(state.future, before.future);
  assert.equal(state.saveState, before.saveState);
  assert.equal(state.doc?.revision, before.revision);
}

function flatElements(store, finger = 'L1', stepId = 'step.v7-10.flat') {
  return store.getState().doc.nails[finger].steps.find((step) => step.id === stepId).elements;
}

/* ── G1: deterministic fonts + text creator ───────────────────────────── */

{
  const sans = FLAT_FONT_REGISTRY_V7.find((entry) => entry.id === SANS_FONT.id);
  const serif = FLAT_FONT_REGISTRY_V7.find((entry) => entry.id === SERIF_FONT.id);
  assert.ok(sans && serif);
  assert.equal(resolveFontCssFamilyV7(SANS_FONT), sans.cssFamily);
  assert.equal(resolveFontCssFamilyV7(SERIF_FONT), serif.cssFamily);
  assert.equal(resolveFontCssFamilyV7({ id: 'font.builtin.system-sans', revision: 'other' }), null);
  assert.equal(resolveFontCssFamilyV7({ id: 'font.nonexistent', revision: 'flat-fonts-v1' }), null);

  const zh = createTextFlatElementV7({ id: 'element.text.zh', text: '你好，穿戴甲', fontRef: SANS_FONT, fontSizeMm: 2.5, color });
  const en = createTextFlatElementV7({ id: 'element.text.en', text: 'Hello Nail Studio', fontRef: SERIF_FONT, fontSizeMm: 1.2, color });
  assert.ok(zh && en);
  assert.equal(zh.kind, 'text');
  assert.equal(zh.text, '你好，穿戴甲');
  assert.deepEqual(zh.transform, IDENTITY_TRANSFORM_V7);
  assert.equal(zh.fontRef.id, SANS_FONT.id);
  assert.equal(zh.visible, true);
  assert.equal(zh.locked, false);
  assert.equal(zh.opacity, 1);

  const base = { id: 'element.text.bad', fontRef: SANS_FONT, fontSizeMm: 2, color };
  assert.equal(createTextFlatElementV7({ ...base, text: '   ' }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: '' }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: '你'.repeat(FLAT_TEXT_MAX_CODE_POINTS_V7 + 1) }), null);
  assert.ok(createTextFlatElementV7({ ...base, text: '你'.repeat(FLAT_TEXT_MAX_CODE_POINTS_V7) }));
  assert.equal(createTextFlatElementV7({ ...base, text: 'ok', fontSizeMm: 0.4 }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: 'ok', fontSizeMm: 20.1 }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: 'ok', fontSizeMm: NaN }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: 'ok', fontRef: { id: 'font.unknown', revision: '1' } }), null);
  assert.equal(createTextFlatElementV7({ ...base, text: 'ok', color: { colorSpace: 'srgb', r: 999, g: 0, b: 0, a: 1 } }), null);
  console.log('[v7-flat-assets] deterministic fonts and text creator limits: PASS');
}

/* ── G2: bundled sticker/stamp registry + schema validity ─────────────── */

{
  assert.equal(FLAT_BUNDLED_ASSET_REGISTRY_V7.length, 5);
  const stickers = FLAT_BUNDLED_ASSET_REGISTRY_V7.filter((entry) => entry.role === 'sticker');
  const stamps = FLAT_BUNDLED_ASSET_REGISTRY_V7.filter((entry) => entry.role === 'stamp');
  assert.equal(stickers.length, 3);
  assert.equal(stamps.length, 2);
  assert.equal(new Set(FLAT_BUNDLED_ASSET_REGISTRY_V7.map((entry) => entry.id)).size, 5);
  for (const entry of FLAT_BUNDLED_ASSET_REGISTRY_V7) {
    assert.match(entry.sourceUrl, /^\/editor-v7-assets\/[a-z0-9-]+\.svg$/);
    assert.equal(entry.asset.mimeType, FLAT_ASSET_MIME_SVG_V7);
    assert.equal(entry.asset.kind, 'vector');
    assert.equal(entry.asset.revision, FLAT_ASSET_REVISION_V1_V7);
    assert.match(entry.asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(isValidFlatAssetRefV7(entry.asset), true);
    const fileBytes = await readFile(new URL(`../public${entry.sourceUrl}`, import.meta.url));
    assert.equal(entry.asset.sha256, await digest(fileBytes), `${entry.id} sha256 must match file bytes`);
  }
  const sparkle = getBundledFlatAssetV7('bundled.sticker.sparkle');
  assert.ok(sparkle);
  assert.equal(getBundledFlatAssetV7('bundled.sticker.missing'), undefined);
  assert.equal(resolveBundledFlatAssetV7(stickers[0].asset)?.id, stickers[0].id);
  assert.equal(resolveBundledFlatAssetV7({ ...stickers[0].asset, sha256: 'f'.repeat(64) }), null);
  assert.equal(isFlatImageRoleCompatibleV7('sticker', stickers[0].asset), true);
  assert.equal(isFlatImageRoleCompatibleV7('stamp', stickers[0].asset), false);
  assert.equal(isFlatImageRoleCompatibleV7('import', stickers[0].asset), false);
  assert.equal(isFlatImageRoleCompatibleV7('stamp', stamps[0].asset), true);
  assert.equal(isFlatImageRoleCompatibleV7('import', stamps[0].asset), false);

  const doc = createMinimalEditorDocV7Fixture();
  const inserted = addEditorV7Step(doc, 'L1', createFlatStep(), 1);
  assert.equal(inserted.ok, true);
  const sticker = createImageFlatElementV7({ id: 'element.bundled.sticker', role: 'sticker', asset: stickers[0].asset });
  const stamp = createImageFlatElementV7({ id: 'element.bundled.stamp', role: 'stamp', asset: stamps[0].asset });
  assert.ok(sticker && stamp);
  assert.deepEqual(sticker.transform, { ...IDENTITY_TRANSFORM_V7, scaleX: 0.42, scaleY: 0.42 });
  const withSticker = addEditorV7Element(inserted.doc, 'L1', 'step.v7-10.flat', sticker);
  const withStamp = addEditorV7Element(withSticker.doc, 'L1', 'step.v7-10.flat', stamp);
  assert.equal(withStamp.ok, true);
  console.log('[v7-flat-assets] bundled registry checksums, roles and doc schema fit: PASS');
}

/* ── G3: PNG prepared imports ─────────────────────────────────────────── */

{
  const rgba = pngBytes({ width: 1, height: 1, colorType: 6 });
  const prepared = await prepareFlatAssetImportV7(source(rgba, FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.asset.kind, 'raster');
  assert.equal(prepared.asset.mimeType, FLAT_ASSET_MIME_PNG_V7);
  assert.equal(prepared.asset.widthPx, 1);
  assert.equal(prepared.asset.heightPx, 1);
  assert.equal(prepared.asset.alphaMode, 'straight');
  assert.equal(prepared.asset.colorSpace, 'srgb');
  assert.equal(prepared.asset.sha256, await digest(rgba));
  assert.equal(prepared.asset.assetId, `asset.flat-content.${prepared.asset.sha256.slice(0, 32)}`);
  assert.equal(prepared.asset.revision, FLAT_ASSET_REVISION_V1_V7);
  assert.match(prepared.source, /^data:image\/png;base64,/);
  assert.deepEqual([...flatAssetSourcePayloadV7(FLAT_ASSET_MIME_PNG_V7, prepared.source)], [...rgba]);
  assert.equal(flatAssetSourcePayloadBytesV7(FLAT_ASSET_MIME_PNG_V7, prepared.source), rgba.byteLength);

  const rgb = pngBytes({ width: 4, height: 2, colorType: 2 });
  const preparedRgb = await prepareFlatAssetImportV7(source(rgb, FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.equal(preparedRgb.ok, true);
  assert.equal(preparedRgb.asset.alphaMode, 'opaque');
  assert.equal(preparedRgb.asset.widthPx, 4);
  assert.equal(preparedRgb.asset.heightPx, 2);

  const grayAlpha = pngBytes({ width: 2, height: 3, colorType: 4 });
  const preparedGray = await prepareFlatAssetImportV7(source(grayAlpha, FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.equal(preparedGray.ok, true);
  assert.equal(preparedGray.asset.alphaMode, 'straight');

  // Deterministic assetId: same bytes → same ref, different bytes → different ref.
  const again = await prepareFlatAssetImportV7(source(rgba, FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.equal(again.ok, true);
  assert.equal(again.asset.assetId, prepared.asset.assetId);
  const different = await prepareFlatAssetImportV7(source(pngBytes({ width: 2, height: 2, colorType: 6 }), FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.equal(different.ok, true);
  assert.notEqual(different.asset.assetId, prepared.asset.assetId);

  const badSignature = Buffer.from(rgba);
  badSignature[0] = 0x00;
  assert.equal((await prepareFlatAssetImportV7(source(badSignature, FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_signature');
  assert.equal((await prepareFlatAssetImportV7(source(rgba.subarray(0, 20), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_header');
  const badCrc = Buffer.from(rgba);
  badCrc[33] ^= 0xff;
  assert.equal((await prepareFlatAssetImportV7(source(badCrc, FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_header');
  assert.equal((await prepareFlatAssetImportV7(source(rgba.subarray(0, rgba.length - 12), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_header');
  const badIhdrLength = Buffer.concat([rgba.subarray(0, 8), pngChunk('IHDR', Buffer.alloc(12))]);
  assert.equal((await prepareFlatAssetImportV7(source(badIhdrLength, FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_header');
  assert.equal((await prepareFlatAssetImportV7(source(pngBytes({ width: 0, height: 8, colorType: 2 }), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_dimensions');
  assert.equal((await prepareFlatAssetImportV7(source(pngBytes({ width: 5000, height: 8, colorType: 2 }), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_dimensions');
  assert.equal((await prepareFlatAssetImportV7(source(pngBytes({ width: 8, height: 0, colorType: 2 }), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_dimensions');
  assert.equal((await prepareFlatAssetImportV7(source(pngBytes({ width: 8, height: 8, colorType: 3 }), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_color_type');
  assert.equal((await prepareFlatAssetImportV7(source(pngBytes({ width: 8, height: 8, colorType: 2, bitDepth: 16 }), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_header');
  assert.equal((await prepareFlatAssetImportV7(source(new Uint8Array(FLAT_ASSET_MAX_BYTES_V7 + 1), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'oversize');
  assert.equal((await prepareFlatAssetImportV7(source(rgba, 'image/jpeg'), { digest })).reason, 'unsupported_mime');
  assert.equal((await prepareFlatAssetImportV7(source(new TextEncoder().encode('<svg width="8" height="8"></svg>'), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'png_signature');
  assert.equal((await prepareFlatAssetImportV7(source(new Uint8Array(0), FLAT_ASSET_MIME_PNG_V7), { digest })).reason, 'empty_file');
  const lyingSize = { ...source(rgba, FLAT_ASSET_MIME_PNG_V7), size: FLAT_ASSET_MAX_BYTES_V7 + 1 };
  assert.equal((await prepareFlatAssetImportV7(lyingSize, { digest })).reason, 'oversize');
  console.log('[v7-flat-assets] PNG parse, alpha/color-space, determinism and rejection matrix: PASS');
}

/* ── G4: SVG prepared imports ─────────────────────────────────────────── */

{
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M10 10 L54 54" fill="none" stroke="#c8365c"/></svg>';
  const svgBytes = new TextEncoder().encode(svgText);
  const prepared = await prepareFlatAssetImportV7(source(svgBytes, FLAT_ASSET_MIME_SVG_V7), { digest });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.asset.kind, 'vector');
  assert.equal(prepared.asset.mimeType, FLAT_ASSET_MIME_SVG_V7);
  assert.equal(prepared.asset.widthPx, 64);
  assert.equal(prepared.asset.heightPx, 64);
  assert.equal(prepared.asset.alphaMode, 'straight');
  assert.equal(prepared.source, svgText);
  assert.equal(prepared.asset.sha256, await digest(svgBytes));

  const bomBytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(svgText)]);
  const bomPrepared = await prepareFlatAssetImportV7(source(bomBytes, FLAT_ASSET_MIME_SVG_V7), { digest });
  assert.equal(bomPrepared.ok, true);
  assert.equal(bomPrepared.source, svgText);
  assert.equal(bomPrepared.asset.sha256, await digest(svgBytes));
  const bomRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage(), { digest });
  assert.equal((await bomRepo.put(bomPrepared.asset, bomPrepared.source)).ok, true);
  assert.equal((await bomRepo.get(bomPrepared.asset)).status, 'valid');

  const viewBoxOnly = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"><rect x="4" y="4" width="40" height="16"/></svg>';
  const vbPrepared = await prepareFlatAssetImportV7(source(new TextEncoder().encode(viewBoxOnly), FLAT_ASSET_MIME_SVG_V7), { digest });
  assert.equal(vbPrepared.ok, true);
  assert.equal(vbPrepared.asset.widthPx, 48);
  assert.equal(vbPrepared.asset.heightPx, 24);

  const unsafe = [
    '<script>alert(1)</script><svg width="8" height="8"></svg>',
    '<svg width="8" height="8" onload="alert(1)"></svg>',
    '<svg width="8" height="8"><path d="M0 0" href="javascript:alert(1)"/></svg>',
    '<svg width="8" height="8"><path style="fill: url(javascript:alert(1))"/></svg>',
    '<svg width="8" height="8"><foreignObject/></svg>',
    '<!DOCTYPE svg><svg width="8" height="8"></svg>',
    '<!ENTITY x "y"><svg width="8" height="8"></svg>',
    '<svg width="8" height="8"><image href="https://evil.example/x.png"/></svg>',
    '<svg width="8" height="8"><image href="//evil.example/x.png"/></svg>',
    '<svg width="8" height="8"><image href="data:image/png;base64,AAAA"/></svg>',
    '<svg width="8" height="8"><use href="file:///etc/passwd"/></svg>',
    '<svg width="8" height="8"><rect style="fill: url(https://evil.example/x.svg#y)"/></svg>',
    'not svg at all',
    '<svg width="8" height="8">',
    '<svg></svg>',
    '<svg width="0" height="8"></svg>',
    '<svg width="50%" height="8"></svg>',
    '<svg width="5000" height="8"></svg>',
    '<svg width="8" height="8"><text>javascript:alert(1)</text></svg>',
    '<svg width="8" height="8"><iframe/></svg>',
    '<svg width="8" height="8"><style>@import "https://evil.example/x.css"</style></svg>',
    '<svg width="8" height="8"><rect style="fill:red"/></svg>',
    '<svg width="8" height="8"><use href="#local"/></svg>',
    '<svg width="8" height="8"></svg><svg width="8" height="8"></svg>',
  ];
  for (const text of unsafe) {
    const result = await prepareFlatAssetImportV7(source(new TextEncoder().encode(text), FLAT_ASSET_MIME_SVG_V7), { digest });
    assert.equal(result.ok, false, `must reject: ${text}`);
    assert.ok(['svg_invalid', 'svg_unsafe', 'svg_dimensions'].includes(result.reason), `reason for: ${text}`);
  }
  const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0x3c, 0x73, 0x76, 0x67]);
  assert.equal((await prepareFlatAssetImportV7(source(invalidUtf8, FLAT_ASSET_MIME_SVG_V7), { digest })).reason, 'svg_invalid');
  const badDigest = async () => 'zzz-not-a-hash';
  assert.equal((await prepareFlatAssetImportV7(source(svgBytes, FLAT_ASSET_MIME_SVG_V7), { digest: badDigest })).reason, 'hash_invalid');
  console.log('[v7-flat-assets] SVG sanitizer, dimensions and hash rejection: PASS');
}

/* ── G5: repository round trip / missing / corrupt / quota ────────────── */

{
  const rgba = pngBytes({ width: 8, height: 8, colorType: 6 });
  const prep = await prepareFlatAssetImportV7(source(rgba, FLAT_ASSET_MIME_PNG_V7), { digest });
  const storage = new MemoryFlatStorage();
  const repo = createFlatAssetRepositoryV7(storage, { digest, now: () => '2026-08-10T00:00:00.000Z' });

  assert.equal((await repo.put(prep.asset, prep.source)).ok, true);
  assert.equal((await repo.put(prep.asset, prep.source)).ok, true); // idempotent same-content overwrite
  assert.equal(storage.writes, 2);
  const got = await repo.get(prep.asset);
  assert.equal(got.status, 'valid');
  assert.equal(got.source, prep.source);
  assert.deepEqual(got.asset, prep.asset);
  assert.equal(repo.inspect().ok, true);
  assert.equal(repo.inspect().entryCount, 1);
  assert.equal(repo.inspect().entries[0].status, 'valid');
  assert.equal(repo.inspect().entries[0].payloadBytes, rgba.byteLength);
  assert.equal(repo.inspect().entries[0].key, flatAssetKeyV7(prep.asset.assetId, prep.asset.revision));

  const unknownRef = { ...prep.asset, assetId: `asset.flat-content.${'a'.repeat(32)}` };
  assert.equal((await repo.get(unknownRef)).status, 'missing');
  assert.equal(repo.remove(unknownRef).ok, false);

  // Bundled refs resolve from the builtin registry first: storage is untouched.
  const noReadStorage = new MemoryFlatStorage();
  noReadStorage.failRead = new Error('storage must not be read for bundled refs');
  const noReadRepo = createFlatAssetRepositoryV7(noReadStorage, { digest });
  const bundled = await noReadRepo.get(FLAT_BUNDLED_ASSET_REGISTRY_V7[0].asset);
  assert.equal(bundled.status, 'bundled');
  assert.equal(bundled.entry.id, FLAT_BUNDLED_ASSET_REGISTRY_V7[0].id);

  // Corrupt envelope / wrong version / metadata mismatch / checksum mismatch.
  const corruptRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage('not-json{{'), { digest });
  assert.equal((await corruptRepo.get(prep.asset)).status, 'corrupt');
  assert.equal(corruptRepo.inspect().ok, false);
  const versionRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage('{"version":2,"assets":{}}'), { digest });
  assert.equal((await versionRepo.get(prep.asset)).status, 'corrupt');
  const unknownEnvelopeRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage('{"version":1,"assets":{},"extra":true}'), { digest });
  assert.equal((await unknownEnvelopeRepo.get(prep.asset)).status, 'corrupt');
  const readFailureStorage = new MemoryFlatStorage();
  readFailureStorage.failRead = new Error('read blocked');
  assert.equal((await createFlatAssetRepositoryV7(readFailureStorage, { digest }).get(prep.asset)).status, 'corrupt');
  const tamperStorage = new MemoryFlatStorage();
  const tamperRepo = createFlatAssetRepositoryV7(tamperStorage, { digest });
  assert.equal((await tamperRepo.put(prep.asset, prep.source)).ok, true);
  const envelope = JSON.parse(tamperStorage.value);
  const key = flatAssetKeyV7(prep.asset.assetId, prep.asset.revision);
  envelope.assets[key].sha256 = 'f'.repeat(64);
  tamperStorage.value = JSON.stringify(envelope);
  assert.equal((await tamperRepo.get(prep.asset)).status, 'corrupt');
  envelope.assets[key].sha256 = prep.asset.sha256;
  envelope.assets[key].source = envelope.assets[key].source.replace('AAAA', 'BBBB');
  tamperStorage.value = JSON.stringify(envelope);
  assert.equal((await tamperRepo.get(prep.asset)).status, 'corrupt');
  // Removal is structural: a checksum-tampered entry can still be cleaned up.
  assert.equal(tamperRepo.remove(prep.asset).ok, true);
  assert.equal((await tamperRepo.get(prep.asset)).status, 'missing');

  // remove round trip.
  const removeRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage(), { digest });
  assert.equal((await removeRepo.put(prep.asset, prep.source)).ok, true);
  assert.equal(removeRepo.remove(prep.asset).ok, true);
  assert.equal((await removeRepo.get(prep.asset)).status, 'missing');
  assert.equal(removeRepo.remove(prep.asset).ok, false);

  // put rejects malformed refs/sources.
  const strictRepo = createFlatAssetRepositoryV7(new MemoryFlatStorage(), { digest });
  assert.equal((await strictRepo.put({ ...prep.asset, sha256: 'zzz' }, prep.source)).reason, 'invalid_asset');
  assert.equal((await strictRepo.put(prep.asset, 'garbage-that-is-not-a-data-url')).reason, 'invalid_source');
  assert.equal((await strictRepo.put(prep.asset, `data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`)).reason, 'too_large');

  // Storage failure preserves the previous envelope and reports explicitly.
  const failStorage = new MemoryFlatStorage();
  const failRepo = createFlatAssetRepositoryV7(failStorage, { digest });
  assert.equal((await failRepo.put(prep.asset, prep.source)).ok, true);
  const previousValue = failStorage.value;
  failStorage.failWrite = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
  const svgPrep = await prepareFlatAssetImportV7(
    source(new TextEncoder().encode('<svg width="4" height="4"></svg>'), FLAT_ASSET_MIME_SVG_V7),
    { digest },
  );
  assert.equal(svgPrep.ok, true);
  assert.equal((await failRepo.put(svgPrep.asset, svgPrep.source)).reason, 'quota_exceeded');
  assert.equal(failStorage.value, previousValue);
  assert.equal(failStorage.writes, 1);

  // Total 8 MiB budget is enforced before any write using valid, independently
  // checksummed PNG imports (repository writes revalidate structure + hash).
  const quotaStorage = new MemoryFlatStorage();
  const quotaRepo = createFlatAssetRepositoryV7(quotaStorage, { digest });
  const largePrepared = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const prepared = await prepareFlatAssetImportV7(source(pngBytes({ width: 700, height: 600, colorType: 6, randomSeed: seed }), FLAT_ASSET_MIME_PNG_V7), { digest });
    assert.equal(prepared.ok, true, `prepare seed ${seed}`);
    largePrepared.push(prepared);
  }
  for (const [index, prepared] of largePrepared.slice(0, 4).entries()) {
    assert.equal((await quotaRepo.put(prepared.asset, prepared.source)).ok, true, `seed ${index + 1}`);
  }
  assert.equal(quotaStorage.writes, 4);
  assert.ok(quotaRepo.inspect().totalPayloadBytes > 6 * 1024 * 1024);
  assert.equal((await quotaRepo.put(largePrepared[4].asset, largePrepared[4].source)).reason, 'quota_exceeded');
  assert.equal(quotaStorage.writes, 4);
  console.log('[v7-flat-assets] repository round trip, corrupt/checksum, quota and storage preservation: PASS');
}

/* ── G6: pure commands ────────────────────────────────────────────────── */

{
  const doc = createMinimalEditorDocV7Fixture();
  const inserted = addEditorV7Step(doc, 'L1', createFlatStep(), 1);
  assert.equal(inserted.ok, true);
  const flat = createFlatStep('step.v7-10.flat');

  const textResult = addTextFlatElementCommand(inserted.doc, 'L1', flat.id, { id: 'element.cmd.text', text: '纯命令', fontRef: SANS_FONT, fontSizeMm: 2, color });
  assert.equal(textResult.ok, true);
  assert.equal(textResult.selectedElementId, 'element.cmd.text');
  const before = clone(textResult.doc);
  assert.equal(addTextFlatElementCommand(inserted.doc, 'L1', flat.id, { id: 'element.cmd.bad', text: '  ', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'invalid_value');
  assert.deepEqual(textResult.doc, before);

  const stickerResult = addBundledFlatAssetCommand(textResult.doc, 'L1', flat.id, 'bundled.sticker.heart', 'element.cmd.sticker');
  assert.equal(stickerResult.ok, true);
  assert.equal(stickerResult.doc.nails.L1.steps[1].elements.at(-1).role, 'sticker');
  assert.equal(addBundledFlatAssetCommand(textResult.doc, 'L1', flat.id, 'bundled.missing', 'element.cmd.x').reason, 'not_found');
  assert.equal(addBundledFlatAssetCommand(stickerResult.doc, 'L1', flat.id, 'bundled.sticker.heart', 'element.cmd.sticker').reason, 'duplicate_id');

  const prep = await prepareFlatAssetImportV7(source(pngBytes({ width: 2, height: 2, colorType: 6 }), FLAT_ASSET_MIME_PNG_V7), { digest });
  const importResult = addPreparedImportCommand(stickerResult.doc, 'L1', flat.id, 'element.cmd.import', prep.asset);
  assert.equal(importResult.ok, true);
  assert.equal(importResult.doc.nails.L1.steps[1].elements.at(-1).role, 'import');

  const relinked = relinkImageAssetCommand(importResult.doc, 'L1', flat.id, 'element.cmd.sticker', getBundledFlatAssetV7('bundled.sticker.sparkle').asset);
  assert.equal(relinked.ok, true);
  const element = relinked.doc.nails.L1.steps[1].elements.find((e) => e.id === 'element.cmd.sticker');
  assert.equal(element.asset.assetId, getBundledFlatAssetV7('bundled.sticker.sparkle').asset.assetId);
  assert.equal(relinkImageAssetCommand(relinked.doc, 'L1', flat.id, 'element.cmd.sticker', getBundledFlatAssetV7('bundled.stamp.star').asset).reason, 'not_allowed');
  assert.equal(relinkImageAssetCommand(relinked.doc, 'L1', flat.id, 'element.cmd.text', FLAT_BUNDLED_ASSET_REGISTRY_V7[0].asset).reason, 'not_allowed');
  assert.equal(relinkImageAssetCommand(relinked.doc, 'L1', flat.id, 'element.missing', FLAT_BUNDLED_ASSET_REGISTRY_V7[0].asset).reason, 'not_found');
  assert.equal(relinkImageAssetCommand(relinked.doc, 'L2', flat.id, 'element.cmd.sticker', FLAT_BUNDLED_ASSET_REGISTRY_V7[0].asset).reason, 'not_found');
  assert.equal(relinkImageAssetCommand(relinked.doc, 'L1', 'step.missing', 'element.cmd.sticker', FLAT_BUNDLED_ASSET_REGISTRY_V7[0].asset).reason, 'not_found');
  console.log('[v7-flat-assets] narrow pure commands and relink gates: PASS');
}

/* ── G7: store actions, atomicity, round trip, JSON hygiene ───────────── */

{
  const doc = createMinimalEditorDocV7Fixture();
  const { storage, flatStorage, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  assert.equal(store.getState().addStep('L1', createFlatStep(), 1).ok, true);

  // text + sticker + two stamps + import
  const beforeText = captureInvariants(store);
  assert.equal(store.getState().createTextElement('L1', 'step.v7-10.flat', { text: '中文文字', fontRef: SANS_FONT, fontSizeMm: 2.5, color }).ok, true);
  const afterTextRevision = store.getState().doc.revision;
  assert.equal(afterTextRevision, beforeText.revision + 1);
  assert.equal(store.getState().history.length, 2); // addStep + createTextElement
  assert.equal(store.getState().addBundledImage('L1', 'step.v7-10.flat', 'bundled.sticker.sparkle').ok, true);
  assert.equal(store.getState().addBundledImage('L1', 'step.v7-10.flat', 'bundled.stamp.star').ok, true);
  assert.equal(store.getState().addBundledImage('L1', 'step.v7-10.flat', 'bundled.stamp.flower').ok, true);
  const stamps = flatElements(store).filter((element) => element.kind === 'image_2d' && element.role === 'stamp');
  assert.equal(stamps.length, 2);
  assert.notEqual(stamps[0].id, stamps[1].id);
  assert.notDeepEqual(stamps[0].transform.position, stamps[1].transform.position);
  assert.ok(stamps.every((element) => element.transform.scaleX === 0.3 && element.transform.scaleY === 0.3));
  assert.ok(stamps.every((element) => element.asset.mimeType === FLAT_ASSET_MIME_SVG_V7));

  const pngPrep = await prepareFlatAssetImportV7(source(pngBytes({ width: 8, height: 8, colorType: 6 }), FLAT_ASSET_MIME_PNG_V7), { digest });
  assert.deepEqual(await store.getState().applyPreparedImport('L1', 'step.v7-10.flat', pngPrep), { ok: true });
  assert.equal(flatStorage.writes, 1);
  const importElement = flatElements(store).at(-1);
  assert.equal(importElement.kind, 'image_2d');
  assert.equal(importElement.role, 'import');
  assert.equal(importElement.asset.assetId, pngPrep.asset.assetId);
  assert.equal((await createFlatAssetRepositoryV7(flatStorage, { digest }).get(pngPrep.asset)).status, 'valid');

  // JSON hygiene: the document never carries data URLs, base64, raw SVG or repo source.
  const docJson = JSON.stringify(store.getState().doc);
  assert.doesNotMatch(docJson, /data:/);
  assert.doesNotMatch(docJson, /base64/);
  assert.doesNotMatch(docJson, /<svg/i);
  assert.doesNotMatch(docJson, /\/editor-v7-assets\//);

  // Store failure matrix leaves doc/history/revision/saveState untouched.
  assert.equal(store.getState().createTextElement('L1', 'step.v7-10.flat', { text: '   ', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'invalid_value');
  assert.equal(store.getState().createTextElement('L1', 'step.missing', { text: 'ok', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'not_found');
  assert.equal(store.getState().addBundledImage('L1', 'step.v7-10.flat', 'bundled.missing').reason, 'not_found');
  const svgPrep = await prepareFlatAssetImportV7(
    source(new TextEncoder().encode('<svg width="4" height="4"></svg>'), FLAT_ASSET_MIME_SVG_V7),
    { digest },
  );
  assert.deepEqual(await store.getState().applyPreparedImport('L1', 'step.missing', svgPrep), { ok: false, reason: 'not_found', message: 'step not found' });
  assert.deepEqual(await store.getState().applyPreparedImport('L1', 'step.v7-10.flat', svgPrep), { ok: true });
  const invariantBeforeFailures = captureInvariants(store);
  flatStorage.failWrite = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
  const svgPrep2 = await prepareFlatAssetImportV7(
    source(new TextEncoder().encode('<svg width="6" height="6"></svg>'), FLAT_ASSET_MIME_SVG_V7),
    { digest },
  );
  assert.equal((await store.getState().applyPreparedImport('L1', 'step.v7-10.flat', svgPrep2)).reason, 'quota_exceeded');
  assertInvariants(store, invariantBeforeFailures);
  flatStorage.failWrite = null;

  // Text apply preserves structural fields; no-op apply makes zero writes.
  const originalText = flatElements(store).find((element) => element.kind === 'text');
  const movedTextTransform = { position: { u: 0.36, v: 0.41 }, scaleX: 1.2, scaleY: 0.9, rotationDeg: 12 };
  assert.equal(store.getState().setElementTransform('L1', 'step.v7-10.flat', originalText.id, movedTextTransform).ok, true);
  assert.equal(store.getState().setFlatElementOpacity('L1', 'step.v7-10.flat', originalText.id, 0.64).ok, true);
  const textBeforeApply = flatElements(store).find((element) => element.id === originalText.id);
  assert.equal(store.getState().replaceTextElement('L1', 'step.v7-10.flat', originalText.id, { ...textBeforeApply, text: '中英 Nail Art' }).ok, true);
  const textAfterApply = flatElements(store).find((element) => element.id === originalText.id);
  assert.equal(textAfterApply.text, '中英 Nail Art');
  assert.deepEqual(textAfterApply.transform, movedTextTransform);
  assert.equal(textAfterApply.opacity, 0.64);
  const noOpTextBefore = captureInvariants(store);
  assert.equal(store.getState().replaceTextElement('L1', 'step.v7-10.flat', originalText.id, textAfterApply).reason, 'not_allowed');
  assertInvariants(store, noOpTextBefore);

  // Fresh-file relink preserves image identity/layout; read-only resolution is writer-zero.
  const importBeforeRelink = flatElements(store).find((element) => element.id === importElement.id);
  const relinkPrepared = await prepareFlatAssetImportV7(
    source(new TextEncoder().encode('<svg width="12" height="9"><rect width="12" height="9" fill="#c8365c"/></svg>'), FLAT_ASSET_MIME_SVG_V7),
    { digest },
  );
  assert.deepEqual(await store.getState().relinkPreparedImageAsset('L1', 'step.v7-10.flat', importElement.id, relinkPrepared), { ok: true });
  const importAfterRelink = flatElements(store).find((element) => element.id === importElement.id);
  assert.equal(importAfterRelink.id, importBeforeRelink.id);
  assert.equal(importAfterRelink.role, 'import');
  assert.deepEqual(importAfterRelink.transform, importBeforeRelink.transform);
  assert.equal(importAfterRelink.opacity, importBeforeRelink.opacity);
  assert.equal(importAfterRelink.asset.assetId, relinkPrepared.asset.assetId);
  const resolveBefore = captureInvariants(store);
  assert.equal((await store.getState().resolveFlatAsset(importAfterRelink.asset)).status, 'valid');
  assertInvariants(store, resolveBefore);

  // Relink preserves id/role/transform/opacity/visible/locked and swaps only the asset.
  const stickerElement = flatElements(store).find((element) => element.kind === 'image_2d' && element.role === 'sticker');
  const relinkTarget = getBundledFlatAssetV7('bundled.sticker.heart').asset;
  assert.deepEqual(await store.getState().relinkImageAsset('L1', 'step.v7-10.flat', stickerElement.id, relinkTarget), { ok: true });
  const relinked = flatElements(store).find((element) => element.id === stickerElement.id);
  assert.equal(relinked.id, stickerElement.id);
  assert.equal(relinked.role, stickerElement.role);
  assert.deepEqual(relinked.transform, stickerElement.transform);
  assert.equal(relinked.opacity, stickerElement.opacity);
  assert.equal(relinked.visible, stickerElement.visible);
  assert.equal(relinked.locked, stickerElement.locked);
  assert.equal(relinked.asset.assetId, relinkTarget.assetId);
  assert.deepEqual(await store.getState().relinkImageAsset('L1', 'step.v7-10.flat', stickerElement.id, getBundledFlatAssetV7('bundled.stamp.star').asset), { ok: false, reason: 'not_allowed', message: 'asset is not compatible with the sticker element role' });
  assert.equal((await store.getState().relinkImageAsset('L1', 'step.v7-10.flat', stickerElement.id, unknownRef(store))).reason, 'not_found');

  // readOnly / switching / locked gates.
  const { store: roStore, flatStorage: roFlat } = runtime(doc);
  assert.equal(await roStore.getState().load(doc.designId, { readOnly: true }), 'ok');
  const roBefore = captureInvariants(roStore);
  assert.equal(roStore.getState().createTextElement('L1', 'step.v7-10.flat', { text: 'x', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'read_only');
  assert.equal((await roStore.getState().applyPreparedImport('L1', 'step.v7-10.flat', pngPrep)).reason, 'read_only');
  assert.equal(roFlat.writes, 0);
  assert.equal(roStore.getState().addBundledImage('L1', 'step.v7-10.flat', 'bundled.sticker.sparkle').reason, 'read_only');
  assertInvariants(roStore, roBefore);

  const { store: swStore, flatStorage: swFlat } = runtime(doc);
  assert.equal(await swStore.getState().load(doc.designId), 'ok');
  swStore.setState({ switching: true });
  const swBefore = captureInvariants(swStore);
  assert.equal(swStore.getState().createTextElement('L1', 'step.v7-10.flat', { text: 'x', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'busy');
  assert.equal((await swStore.getState().applyPreparedImport('L1', 'step.v7-10.flat', pngPrep)).reason, 'busy');
  assert.equal(swFlat.writes, 0);
  assertInvariants(swStore, swBefore);

  const { store: lkStore, flatStorage: lkFlat } = runtime(doc);
  assert.equal(await lkStore.getState().load(doc.designId), 'ok');
  assert.equal(lkStore.getState().addStep('L1', createFlatStep(), 1).ok, true);
  const lockedDoc = clone(lkStore.getState().doc);
  lockedDoc.nails.L1.steps[1].locked = true;
  lkStore.setState({ doc: lockedDoc });
  const lkBefore = captureInvariants(lkStore);
  assert.equal(lkStore.getState().createTextElement('L1', 'step.v7-10.flat', { text: 'x', fontRef: SANS_FONT, fontSizeMm: 2, color }).reason, 'locked');
  assert.equal((await lkStore.getState().applyPreparedImport('L1', 'step.v7-10.flat', pngPrep)).reason, 'locked');
  assert.equal(lkFlat.writes, 0);
  assertInvariants(lkStore, lkBefore);

  // Hidden/skipped steps are rejected before any flat-asset repository I/O.
  for (const inactive of ['hidden', 'skipped']) {
    const { store: inactiveStore, flatStorage: inactiveFlat } = runtime(doc);
    assert.equal(await inactiveStore.getState().load(doc.designId), 'ok');
    assert.equal(inactiveStore.getState().addStep('L1', createFlatStep(), 1).ok, true);
    assert.equal(inactiveStore.getState().setStepFlag(
      'L1',
      'step.v7-10.flat',
      inactive === 'hidden' ? 'visible' : 'skipped',
      inactive === 'hidden' ? false : true,
    ).ok, true);
    const inactiveBefore = captureInvariants(inactiveStore);
    const readsBefore = inactiveFlat.reads;
    const writesBefore = inactiveFlat.writes;
    assert.equal((await inactiveStore.getState().applyPreparedImport('L1', 'step.v7-10.flat', pngPrep)).reason, 'not_allowed');
    assert.equal((await inactiveStore.getState().relinkImageAsset('L1', 'step.v7-10.flat', 'element.missing', relinkTarget)).reason, 'not_allowed');
    assert.equal((await inactiveStore.getState().relinkPreparedImageAsset('L1', 'step.v7-10.flat', 'element.missing', relinkPrepared)).reason, 'not_allowed');
    assert.equal(inactiveFlat.reads, readsBefore);
    assert.equal(inactiveFlat.writes, writesBefore);
    assertInvariants(inactiveStore, inactiveBefore);
  }

  // undo/redo targets the latest relink while preserving earlier imported content.
  assert.equal(store.getState().undo().ok, true);
  assert.equal(flatElements(store).find((element) => element.id === stickerElement.id).asset.assetId, getBundledFlatAssetV7('bundled.sticker.sparkle').asset.assetId);
  assert.equal(flatElements(store).some((element) => element.id === importElement.id), true);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(flatElements(store).find((element) => element.id === stickerElement.id).asset.assetId, relinkTarget.assetId);
  assert.equal(flatElements(store).some((element) => element.id === importElement.id), true);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(storage.writes, 1);
  const reloaded = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    flatAssets: createFlatAssetRepositoryV7(flatStorage, { digest }),
    now: () => '2026-08-10T12:00:00.000Z',
    idFactory: () => 'element.reload',
    setTimeout: (() => { const t = new FakeTimers(); return t.setTimeout; })(),
    clearTimeout: () => {},
    autosaveDelayMs: 25,
  });
  assert.equal(await reloaded.getState().load(doc.designId), 'ok');
  const reloadedElements = reloaded.getState().doc.nails.L1.steps[1].elements;
  const textElement = reloadedElements.find((element) => element.kind === 'text');
  assert.equal(textElement.text, '中英 Nail Art');
  assert.equal(textElement.fontRef.id, SANS_FONT.id);
  assert.equal(textElement.fontSizeMm, 2.5);
  assert.equal(reloadedElements.filter((element) => element.kind === 'image_2d' && element.role === 'sticker').length, 1);
  assert.equal(reloadedElements.filter((element) => element.kind === 'image_2d' && element.role === 'stamp').length, 2);
  const reloadedImports = reloadedElements.filter((element) => element.kind === 'image_2d' && element.role === 'import');
  assert.equal(reloadedImports.length, 2);
  for (const reloadedImport of reloadedImports) {
    assert.equal((await createFlatAssetRepositoryV7(flatStorage, { digest }).get(reloadedImport.asset)).status, 'valid');
  }
  assert.doesNotMatch(JSON.stringify(reloaded.getState().doc), /data:|base64|<svg/i);
  console.log('[v7-flat-assets] store actions, atomic failure matrix, relink preservation, round trip, JSON hygiene: PASS');
}

/* ── G8: workspace tools enabled iff a flat design step exists ────────── */

{
  const minimal = createMinimalEditorDocV7Fixture();
  const minimalTools = deriveEditorWorkspaceToolsV7(minimal.nails.L1);
  for (const id of ['text', 'assets']) {
    assert.equal(minimalTools.find((tool) => tool.id === id).enabled, false, `${id} needs a flat step`);
    assert.equal(minimalTools.find((tool) => tool.id === id).targetStepId, null);
  }
  for (const id of ['effects', 'decorations']) {
    assert.equal(minimalTools.find((tool) => tool.id === id).enabled, false);
    assert.equal(minimalTools.find((tool) => tool.id === id).status, 'missing_step');
  }

  const full = createFullEditorDocV7Fixture();
  const flatStep = full.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.ok(flatStep);
  const fullTools = deriveEditorWorkspaceToolsV7(full.nails.L1);
  for (const id of ['text', 'assets']) {
    assert.equal(fullTools.find((tool) => tool.id === id).enabled, true, `${id} should be enabled with a flat step`);
    assert.equal(fullTools.find((tool) => tool.id === id).targetStepId, flatStep.id);
  }
  for (const id of ['effects', 'decorations']) assert.equal(fullTools.find((tool) => tool.id === id).enabled, true);
  assert.equal(fullTools.find((tool) => tool.id === 'brush').enabled, true);
  console.log('[v7-flat-assets] workspace tools gate on flat design step presence: PASS');
}

/* ── G9: local storage key is the literal envelope contract ───────────── */

{
  assert.equal(FLAT_ASSETS_STORAGE_KEY_V7, 'nail-studio:editor.v7.flat-assets');
  console.log('[v7-flat-assets] literal flat asset storage key: PASS');
}

/* ── G10: V7 workspace uses one shared flat-content reader ───────────── */

{
  const files = Object.fromEntries(await Promise.all([
    'src/studio/editor/components/EditorToolRailV7.tsx',
    'src/studio/editor/components/EditorShellV7.tsx',
    'src/studio/editor/components/EditorResourceDrawerV7.tsx',
    'src/studio/editor/components/V7FlatDesignCanvas.tsx',
    'src/studio/editor/components/CustomerNailPreviewV7.tsx',
    'src/studio/editor/components/LayerPanelV7.tsx',
    'src/studio/editor/components/FlatContentArtworkV7.tsx',
    'src/studio/editor/components/FlatContentResourcesV7.tsx',
    'src/studio/editor/components/FlatContentInspectorV7.tsx',
  ].map(async (file) => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])));
  assert.match(files['src/studio/editor/components/EditorShellV7.tsx'], /setResourceMode\('text'\)/);
  assert.match(files['src/studio/editor/components/EditorShellV7.tsx'], /setResourceMode\('assets'\)/);
  assert.match(files['src/studio/editor/components/EditorToolRailV7.tsx'], /onActivateTool/);
  assert.match(files['src/studio/editor/components/EditorResourceDrawerV7.tsx'], /FlatContentResourcesV7/);
  assert.match(files['src/studio/editor/components/V7FlatDesignCanvas.tsx'], /FlatContentArtworkV7/);
  assert.match(files['src/studio/editor/components/CustomerNailPreviewV7.tsx'], /FlatContentArtworkV7/);
  assert.match(files['src/studio/editor/components/LayerPanelV7.tsx'], /FlatContentInspectorV7/);
  assert.match(files['src/studio/editor/components/FlatContentArtworkV7.tsx'], /素材缺失/);
  assert.match(files['src/studio/editor/components/FlatContentArtworkV7.tsx'], /data-font-status/);
  assert.match(files['src/studio/editor/components/FlatContentResourcesV7.tsx'], /image\/png,image\/svg\+xml/);
  assert.match(files['src/studio/editor/components/FlatContentInspectorV7.tsx'], /relinkPreparedImageAsset/);
  console.log('[v7-flat-assets] rail/drawer/canvas/preview/inspector shared-reader wiring: PASS');
}

function unknownRef(store) {
  const current = store.getState().doc.nails.L1.steps.find((step) => step.id === 'step.v7-10.flat').elements.find((element) => element.kind === 'image_2d' && element.role === 'import');
  return {
    assetId: `asset.flat-content.${'b'.repeat(32)}`,
    revision: FLAT_ASSET_REVISION_V1_V7,
    kind: 'raster',
    mimeType: FLAT_ASSET_MIME_PNG_V7,
    sha256: 'b'.repeat(64),
    widthPx: 1,
    heightPx: 1,
    colorSpace: 'srgb',
    alphaMode: 'straight',
  };
}

console.log('[v7-flat-assets] all behavior checks passed');
