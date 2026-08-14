import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'public/render-v0-7-2/aurora-almond-v2');
const width = 256;
const height = 410;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function png(rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    rows[row] = 0;
    rgba.copy(rows, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(value, low = 0, high = 1) {
  return Math.min(high, Math.max(low, value));
}

function petalField(u, v) {
  const cx = 0.52;
  const cy = 0.43;
  let field = 0;
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * 0.105;
    const py = cy + Math.sin(angle) * 0.066;
    const dx = (u - px) / 0.105;
    const dy = (v - py) / 0.066;
    field = Math.max(field, Math.exp(-(dx * dx + dy * dy) * 2.4));
  }
  const center = Math.exp(-(((u - cx) / 0.045) ** 2 + ((v - cy) / 0.028) ** 2) * 2.2);
  return clamp(Math.max(field, center));
}

function heightField(u, v) {
  const petal = petalField(u, v);
  const wave = (Math.sin((u * 11 + v * 7) * Math.PI) * 0.5 + 0.5) * 0.045;
  return clamp(0.5 + petal * 0.46 + wave * petal);
}

function createRgba(pixel) {
  const bytes = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      const values = pixel(u, v, x, y);
      const offset = (y * width + x) * 4;
      values.forEach((value, channel) => { bytes[offset + channel] = Math.round(clamp(value, 0, 255)); });
    }
  }
  return bytes;
}

const decal = createRgba((u, v) => {
  const field = petalField(u, v);
  const alpha = clamp((field - 0.08) / 0.92);
  const highlight = clamp(field * 1.35);
  return [244 + highlight * 11, 105 + highlight * 86, 169 + highlight * 70, alpha * 226];
});

const heightValues = new Float64Array(width * height);
for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
  heightValues[y * width + x] = heightField(x / (width - 1), y / (height - 1));
}
const heightMap = createRgba((_u, _v, x, y) => {
  const value = heightValues[y * width + x] * 255;
  return [value, value, value, 255];
});
const roughness = createRgba((u, v) => {
  const value = 0.58 - petalField(u, v) * 0.38 + Math.sin((u + v) * Math.PI * 8) * 0.025;
  const channel = clamp(value) * 255;
  return [channel, channel, channel, 255];
});
const normal = createRgba((_u, _v, x, y) => {
  const left = heightValues[y * width + Math.max(0, x - 1)];
  const right = heightValues[y * width + Math.min(width - 1, x + 1)];
  const up = heightValues[Math.max(0, y - 1) * width + x];
  const down = heightValues[Math.min(height - 1, y + 1) * width + x];
  let nx = -(right - left) * 8;
  let ny = -(down - up) * 8;
  let nz = 1;
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length; ny /= length; nz /= length;
  return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255, 255];
});

const artifacts = [
  ['decal', 'aurora-petal-decal.png', png(decal), { colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' }],
  ['normal', 'aurora-petal-normal.png', png(normal), { colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' }],
  ['roughness', 'aurora-petal-roughness.png', png(roughness), { colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' }],
  ['height', 'aurora-petal-height.png', png(heightMap), { colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 }],
];

await mkdir(outputDir, { recursive: true });
const maps = {};
for (const [kind, fileName, bytes, metadata] of artifacts) {
  await writeFile(resolve(outputDir, fileName), bytes);
  maps[kind] = {
    assetId: `render.texture.aurora-almond-v2.${kind}`,
    revision: '1',
    path: `public/render-v0-7-2/aurora-almond-v2/${fileName}`,
    runtimeUrl: `/render-v0-7-2/aurora-almond-v2/${fileName}`,
    mimeType: 'image/png',
    widthPx: width,
    heightPx: height,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    ...metadata,
  };
}
const generatorSha = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const manifest = {
  schemaVersion: 'render-texture-asset-set-v1',
  assetSetId: 'render.texture-set.aurora-almond-v2',
  revision: '1.0.0-simulated',
  status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
  materialRef: { materialId: 'material.magnetic-gel', revision: '1' },
  uvContract: 'nail-local-v1-tip-to-root',
  generator: { path: 'tools/generate-render-v0-7-2-texture-assets.mjs', sha256: generatorSha },
  maps,
  limitations: [
    'Procedural screen-space render assets only.',
    'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
    'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
  ],
};
await writeFile(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ assetSetId: manifest.assetSetId, revision: manifest.revision, maps }, null, 2));
