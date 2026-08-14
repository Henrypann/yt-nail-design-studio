import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const width = 384;
const height = 640;
const fingers = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];
const allFingers = [...fingers];
const glbRoot = 'assets/glb/components/v0-7-2-four-looks';
const geometryRegistryRef = {
  registryEntryId: 'geometry-registry.almond.medium.visual-v3',
  revision: '3.0.0-simulated-preview',
  promotionState: 'promoted_simulated_preview',
};

const lookSpecs = {
  'leopard-gilded-nude': {
    title: 'Leopard Gilded Nude',
    titleZh: '鎏金豹纹裸粉',
    sourceReference: 'reference-01-layer-breakdown',
    background: { type: 'translucent', color: '#F0CFC6', opacity: 0.82 },
    finish: 'gloss',
    dimensional: ['gilded-crystal-cluster'],
    allocations: {
      L1: ['diagonal_ivory', 'leopard_local', 'gilded_crystal_cluster'],
      L2: ['diagonal_ivory'], L3: ['leopard_local'], L4: ['gold_hairline'], L5: [],
      R1: ['leopard_local'], R2: ['diagonal_ivory'], R3: ['diagonal_ivory'],
      R4: ['diagonal_ivory', 'leopard_local', 'gilded_crystal_cluster'], R5: ['gold_microbead'],
    },
    field: leopardField,
    svg: leopardSvg(),
  },
  'crimson-reliquary': {
    title: 'Crimson Reliquary',
    titleZh: '绯红圣物',
    sourceReference: 'reference-02-layer-breakdown',
    background: { type: 'solid', color: '#980F2D', opacity: 1 },
    finish: 'gloss',
    dimensional: ['gold-cross-chain'],
    allocations: {
      L1: ['abstract_curve', 'gold_cross_chain'], L2: ['abstract_curve'],
      L3: ['abstract_curve', 'gold_chain_arc'], L4: ['curve_hairline'], L5: ['gold_microbead'],
      R1: ['abstract_curve'], R2: ['gold_microbead'],
      R3: ['abstract_curve', 'gold_cross_chain'], R4: ['abstract_curve', 'gold_chain_arc'], R5: ['curve_hairline'],
    },
    field: crimsonField,
    svg: crimsonSvg(),
  },
  'ivory-lace-crystal': {
    title: 'Ivory Lace Crystal',
    titleZh: '象牙蕾丝晶露',
    sourceReference: 'reference-03-layer-breakdown',
    background: { type: 'gradient', color: '#EFCFC3', opacity: 0.9, tipColor: '#FFFDF8' },
    finish: 'gloss',
    dimensional: ['teardrop-pearl-cluster', 'ivory-relief-flower', 'ivory-lace-applique'],
    allocations: {
      L1: ['milky_tip_gradient', 'teardrop_pearl_cluster'], L2: ['milky_tip_gradient', 'ivory_lace_applique'],
      L3: ['milky_tip_gradient', 'pearl_crystal_constellation'], L4: ['milky_tip_gradient', 'ivory_relief_flower'],
      L5: ['milky_tip_gradient'], R1: ['milky_tip_gradient'],
      R2: ['milky_tip_gradient', 'ivory_relief_flower'], R3: ['milky_tip_gradient', 'ivory_lace_applique'],
      R4: ['milky_tip_gradient', 'teardrop_pearl_cluster'], R5: ['milky_tip_gradient', 'pearl_crystal_constellation'],
    },
    field: laceField,
    svg: laceSvg(),
  },
  'honey-petal-glass': {
    title: 'Honey Petal Glass',
    titleZh: '蜂蜜玻璃花瓣',
    sourceReference: 'reference-04-layer-breakdown',
    background: { type: 'translucent', color: '#EBC9BD', opacity: 0.8 },
    finish: 'gloss',
    dimensional: ['glass-flower-pearl'],
    allocations: {
      L1: ['glass_flower_pearl', 'honey_jelly_center'], L2: ['white_asymmetric_french'],
      L3: ['honey_jelly_center'], L4: ['white_asymmetric_french', 'pearl_accent'], L5: ['white_hairline'],
      R1: ['white_asymmetric_french'], R2: ['white_hairline'],
      R3: ['glass_flower_pearl', 'honey_jelly_center'], R4: ['white_asymmetric_french', 'pearl_accent'],
      R5: ['honey_jelly_center'],
    },
    field: honeyField,
    svg: honeySvg(),
  },
};

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function clamp(value, low = 0, high = 1) { return Math.min(high, Math.max(low, value)); }
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1); rows[row] = 0;
    rgba.copy(rows, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function gaussian(u, v, cx, cy, rx, ry) {
  return Math.exp(-((((u - cx) / rx) ** 2) + (((v - cy) / ry) ** 2)) * 2.2);
}
function leopardField(u, v) {
  const diagonal = clamp((u + v * 0.75 - 0.78) * 4.5);
  let spots = 0;
  for (const [cx, cy, rx, ry] of [[0.28,0.72,.06,.05],[.45,.62,.08,.055],[.66,.77,.07,.06],[.76,.53,.055,.045],[.5,.88,.05,.04]]) spots = Math.max(spots, gaussian(u,v,cx,cy,rx,ry));
  return { alpha: clamp(diagonal * 0.72 + spots), height: spots * 0.16, roughness: 0.44 - spots * 0.14, color: [238 - spots * 100, 213 - spots * 140, 177 - spots * 150] };
}
function crimsonField(u, v) {
  const waveA = Math.exp(-1 * (((u - (0.28 + Math.sin(v * Math.PI * 2.2) * 0.13)) / 0.055) ** 2));
  const waveB = Math.exp(-1 * (((u - (0.7 + Math.sin(v * Math.PI * 1.7 + 1) * 0.11)) / 0.045) ** 2));
  const field = clamp(Math.max(waveA, waveB));
  return { alpha: field, height: field * 0.12, roughness: 0.32 - field * 0.16, color: [245, 114 + field * 45, 152 + field * 38] };
}
function laceField(u, v) {
  const gradient = clamp((v - 0.36) * 2.2);
  const threads = clamp((Math.sin(u * 58) * Math.sin(v * 72) * 0.5 + 0.5 - 0.68) * 4);
  const region = clamp((0.58 - u + v * 0.18) * 4);
  const lace = threads * region;
  return { alpha: clamp(gradient * 0.35 + lace), height: lace * 0.2, roughness: 0.46 - lace * 0.2, color: [255, 252, 246] };
}
function honeyField(u, v) {
  const french = clamp((v - (0.73 + (u - 0.5) ** 2 * 0.55)) * 18);
  const center = gaussian(u, v, 0.5, 0.46, 0.12, 0.08);
  return { alpha: clamp(french + center), height: center * 0.34 + french * 0.04, roughness: 0.36 - center * 0.22, color: center > french ? [255, 194, 68] : [255, 253, 249] };
}
function createRgba(pixel) {
  const bytes = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const values = pixel(x / (width - 1), y / (height - 1), x, y);
    const offset = (y * width + x) * 4;
    values.forEach((value, channel) => { bytes[offset + channel] = Math.round(clamp(value, 0, 255)); });
  }
  return bytes;
}
function buildMaps(field) {
  const heights = new Float64Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) heights[y * width + x] = clamp(0.5 + field(x / (width - 1), y / (height - 1)).height);
  const decal = createRgba((u, v) => { const sample = field(u, v); return [...sample.color, sample.alpha * 235]; });
  const heightMap = createRgba((_u, _v, x, y) => { const value = heights[y * width + x] * 255; return [value, value, value, 255]; });
  const roughness = createRgba((u, v) => { const value = clamp(field(u, v).roughness) * 255; return [value, value, value, 255]; });
  const normal = createRgba((_u, _v, x, y) => {
    const left = heights[y * width + Math.max(0, x - 1)], right = heights[y * width + Math.min(width - 1, x + 1)];
    const up = heights[Math.max(0, y - 1) * width + x], down = heights[Math.min(height - 1, y + 1) * width + x];
    let nx = -(right - left) * 7, ny = -(down - up) * 7, nz = 1;
    const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
    return [(nx * .5 + .5) * 255, (ny * .5 + .5) * 255, (nz * .5 + .5) * 255, 255];
  });
  return { decal: png(decal), normal: png(normal), roughness: png(roughness), height: png(heightMap) };
}
function svgShell(body) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><defs><clipPath id="n"><path d="M50 3C77 3 92 29 89 81c-2 41-13 67-39 76C24 148 13 122 11 81 8 29 23 3 50 3Z"/></clipPath></defs><g clip-path="url(#n)">${body}</g></svg>\n`; }
function leopardSvg() { return svgShell('<path fill="#F1DFC3" d="M15 108 100 64v96H15Z"/><g fill="#17110E"><circle cx="42" cy="119" r="7"/><circle cx="66" cy="101" r="6"/><circle cx="80" cy="128" r="8"/><circle cx="55" cy="145" r="5"/></g>'); }
function crimsonSvg() { return svgShell('<path fill="#9A1230" d="M0 0h100v160H0z"/><path d="M18 4c55 32-20 52 24 78s-7 46 12 78M82 0C38 39 98 61 58 94s19 44 4 66" fill="none" stroke="#F58CA8" stroke-width="9"/>'); }
function laceSvg() { return svgShell('<defs><pattern id="l" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 5 0l5 5-5 5Z" fill="none" stroke="#FFF" stroke-width="1"/></pattern><linearGradient id="g" x2="0" y2="1"><stop stop-color="#EDC9BE"/><stop offset="1" stop-color="#FFF"/></linearGradient></defs><path fill="url(#g)" d="M0 0h100v160H0z"/><path fill="url(#l)" d="M0 32 62 0 46 160 0 160Z"/>'); }
function honeySvg() { return svgShell('<path fill="#EBC9BD" d="M0 0h100v160H0z"/><path fill="#FFF" d="M0 123c30-17 68-14 100-35v72H0Z"/><circle cx="50" cy="72" r="15" fill="#FFC445" fill-opacity=".72"/>'); }

const generatorSha = sha(await readFile(new URL(import.meta.url)));
const glbGeneratorSha = sha(await readFile(resolve(root, 'tools/generate-v0-7-2-four-look-glb.py')));
const indexEntries = [];

for (const [lookId, spec] of Object.entries(lookSpecs)) {
  const outputDir = resolve(root, 'assets/hero-recipes', lookId);
  await mkdir(resolve(outputDir, 'maps'), { recursive: true });
  await mkdir(resolve(outputDir, 'flat'), { recursive: true });
  const cover = await readFile(resolve(outputDir, 'look-cover-16x9-v1.png'));
  const maps = buildMaps(spec.field);
  const mapRefs = {};
  for (const [kind, bytes] of Object.entries(maps)) {
    const fileName = `${lookId}-${kind}.png`;
    await writeFile(resolve(outputDir, 'maps', fileName), bytes);
    mapRefs[kind] = {
      assetId: `look.${lookId}.map.${kind}`,
      revision: '1', path: `maps/${fileName}`, runtimeUrl: `/assets/hero-recipes/${lookId}/maps/${fileName}`,
      mimeType: 'image/png', widthPx: width, heightPx: height, sha256: sha(bytes), byteLength: bytes.length,
      colorSpace: kind === 'decal' ? 'srgb' : 'linear', role: kind === 'height' ? 'visual_bump_not_geometry' : kind,
      runtimeUse: 'reference_only_not_shared_across_fingers',
    };
  }
  const svgBytes = Buffer.from(spec.svg);
  await writeFile(resolve(outputDir, 'flat', 'design-reference.svg'), svgBytes);
  const dimensionalAssets = [];
  for (const component of spec.dimensional) {
    const relative = `${glbRoot}/${lookId}/${component}/${component}.web.glb`;
    const bytes = await readFile(resolve(root, relative));
    dimensionalAssets.push({
      assetId: `look.${lookId}.decoration.${component}`, revision: '1.0.0-simulated',
      path: relative, runtimeUrl: `/${relative}`, mimeType: 'model/gltf-binary', sha256: sha(bytes), byteLength: bytes.length,
      evidence: 'SIMULATED_PREVIEW_REPRESENTATION', manufacturingValidated: false,
    });
  }
  const kitRelative = `${glbRoot}/${lookId}/dimensional-kit.web.glb`;
  const kitBytes = await readFile(resolve(root, kitRelative));
  const layerContract = [
    { kind: 'background', cardinality: 'exactly_one', fingers: allFingers },
    { kind: 'flat_design', cardinality: 'zero_or_more', fingers: fingers.filter((finger) => spec.allocations[finger].some((entry) => /diagonal|leopard|curve|french|hairline|gradient/.test(entry))) },
    { kind: 'surface_effect', cardinality: 'zero_or_more', fingers: fingers.filter((finger) => spec.allocations[finger].some((entry) => /honey_jelly/.test(entry))) },
    { kind: 'dimensional_decoration', cardinality: 'zero_or_more', fingers: fingers.filter((finger) => spec.allocations[finger].some((entry) => /cluster|chain|flower|lace|pearl|bead/.test(entry))) },
    { kind: 'surface_finish', cardinality: 'exactly_one_last', fingers: allFingers },
  ];
  const manifest = {
    schemaVersion: 'look-asset-pack-v0.7.2-v1', architectureBaseline: 'v0.7.2',
    lookId, revision: '1.0.0-simulated', title: spec.title, titleZh: spec.titleZh,
    status: 'SIMULATED_LOOK_ASSET_PACK', visualSignoff: 'candidate_pending_designer_trial', manufacturingValidated: false,
    sourceReference: { id: spec.sourceReference, role: 'layer_and_material_language_only', redistributed: false },
    designTruth: 'structured_finger_allocation_and_layer_contract',
    previewGeometryRef: geometryRegistryRef,
    geometryPolicy: { nailLocalReflowable: true, exactShapeClaim: false, compatibleShapes: ['almond', 'oval', 'squoval'] },
    layerContract,
    fingerAllocation: Object.fromEntries(fingers.map((finger) => [finger, { background: spec.background, middle: spec.allocations[finger], surfaceFinish: { type: spec.finish } }])),
    assets: {
      highFidelityCover: { assetId: `look.${lookId}.cover`, revision: '1', path: 'look-cover-16x9-v1.png', widthPx: 1672, heightPx: 941, mimeType: 'image/png', sha256: sha(cover), byteLength: cover.length, evidence: 'AI_GENERATED_HIGH_FIDELITY_CONCEPT' },
      flatVector: { assetId: `look.${lookId}.flat-reference`, revision: '1', path: 'flat/design-reference.svg', mimeType: 'image/svg+xml', sha256: sha(svgBytes), byteLength: svgBytes.length, evidence: 'DETERMINISTIC_2D_REFERENCE' },
      textureMaps: mapRefs,
      dimensionalAssets,
      dimensionalKit: { assetId: `look.${lookId}.dimensional-kit`, revision: '1.0.0-simulated', path: kitRelative, runtimeUrl: `/${kitRelative}`, mimeType: 'model/gltf-binary', sha256: sha(kitBytes), byteLength: kitBytes.length, evidence: 'SIMULATED_PREVIEW_REPRESENTATION', manufacturingValidated: false },
    },
    generators: { rasterAndManifest: { path: 'tools/generate-v0-7-2-four-look-assets.mjs', sha256: generatorSha }, glb: { path: 'tools/generate-v0-7-2-four-look-glb.py', sha256: glbGeneratorSha, toolchain: 'CPython + trimesh preview primitives' } },
    limitations: [
      'High-fidelity cover is concept imagery, not an exact canonical renderer output.',
      'Look-level texture maps are reference-only and must not be projected across fingers; runtime design color and artwork come from each canonical NailDesignV7 projection.',
      'GLB and texture maps are simulated preview assets only and are not manufacturing geometry.',
      'No fit, adhesion, material, curing, strength, print, device, or manufacturability validation.',
      'STL is intentionally absent; Look decoration content does not own CanonicalGeometry manufacturing representations.',
    ],
  };
  const recipe = {
    schemaVersion: 'look-set-definition-v0.7.2-v1', architectureBaseline: 'v0.7.2',
    lookRef: { id: lookId, revision: manifest.revision }, previewGeometryRef: geometryRegistryRef,
    coordinateSpace: 'nail-local-v1-u-left-to-right-v-tip-to-root', fingerOrder: fingers,
    fingers: manifest.fingerAllocation, finish: { type: spec.finish, fingers: allFingers },
    evidence: 'SIMULATED', manufacturing: { status: 'blocked', validated: false },
  };
  await writeFile(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(outputDir, 'recipe-spec.json'), `${JSON.stringify(recipe, null, 2)}\n`);
  indexEntries.push({ lookId, revision: manifest.revision, manifest: `assets/hero-recipes/${lookId}/manifest.json`, cover: `assets/hero-recipes/${lookId}/look-cover-16x9-v1.png`, dimensionalKit: kitRelative });
}

await writeFile(resolve(root, 'assets/hero-recipes/v0-7-2-four-look-sets.json'), `${JSON.stringify({ schemaVersion: 'look-asset-pack-index-v1', architectureBaseline: 'v0.7.2', entries: indexEntries }, null, 2)}\n`);
console.log(JSON.stringify({ generated: indexEntries.length, looks: indexEntries.map((entry) => entry.lookId) }, null, 2));
