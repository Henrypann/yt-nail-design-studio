/**
 * Generate Mercury Dew M4 golden fixtures from the Canonical Renderer.
 *
 * True-source chain:
 *   Recipe Definition → Recipe Instance → FingerRenderModel → Single / Tiled / PNG
 *
 * Usage:
 *   node --import ./tools/lib/register-node-vite.mjs --experimental-strip-types tools/generate-mercury-fixtures.mjs
 *
 * Agent shells may need: env -u PLAYWRIGHT_BROWSERS_PATH …
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(ROOT, 'assets/golden-fixtures/mercury-dew');
const INDEX_PATH = path.join(FIXTURE_ROOT, 'index.json');
const FIXED_UPDATED_AT = '2026-07-31T00:00:00.000Z';
const GEOMETRY_BY_PRESET = { natural: 'short', medium: 'long' };
const REQUIRED_FILES = ['recipe.json', 'single.svg', 'tiled.svg', 'preview.png', 'tiled.png', 'snapshot.json'];

function fnv1aHex(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sha256Hex(buf) {
  return `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
}

/** Expand CSS var fallbacks the same way export-png.ts does for offscreen docs. */
function expandSkinVars(svg) {
  return svg
    .replace(/var\(--skin-base,\s*([^)]+)\)/g, '$1')
    .replace(/var\(--skin-outline,\s*([^)]+)\)/g, '$1');
}

function parseSvgSize(svg) {
  const w = Number(svg.match(/\bwidth="([0-9.]+)"/)?.[1] ?? 0);
  const h = Number(svg.match(/\bheight="([0-9.]+)"/)?.[1] ?? 0);
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
  if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  if (vb && vb.length === 4) return { width: Math.round(vb[2] * 4), height: Math.round(vb[3] * 4) };
  return { width: 400, height: 600 };
}

async function rasterizeSvg(page, svg, outPath) {
  const markup = expandSkinVars(svg);
  const { width, height } = parseSvgSize(markup);
  // Scale up for crisp preview while keeping aspect from the same SVG composition.
  const scale = 2;
  const pw = Math.max(1, Math.round(width * scale));
  const ph = Math.max(1, Math.round(height * scale));
  await page.setViewportSize({ width: pw, height: ph });
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:#fff;width:${pw}px;height:${ph}px;overflow:hidden}
    img{display:block;width:${pw}px;height:${ph}px}
  </style></head><body>
  <img id="nail" alt="fixture" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}" />
  </body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForSelector('#nail');
  // Wait until the image has decoded natural dimensions.
  await page.waitForFunction(() => {
    const img = document.querySelector('#nail');
    return img && img.complete && img.naturalWidth > 1;
  });
  await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
  return { width: pw, height: ph };
}

async function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  if (index.renderer !== 'svg-2.5d/mercury-1') {
    throw new Error(`Unexpected renderer in index: ${index.renderer}`);
  }

  const renderUrl = pathToFileURL(path.join(ROOT, 'src/studio/editor/lib/render.ts')).href;
  const recipeUrl = pathToFileURL(path.join(ROOT, 'src/studio/editor/lib/recipe-model.ts')).href;
  const mercuryUrl = pathToFileURL(path.join(ROOT, 'src/studio/editor/lib/mercury-renderer.ts')).href;
  const checksumUrl = pathToFileURL(path.join(ROOT, 'src/studio/editor/lib/recipe-checksum.ts')).href;

  const { composeNailSvg, composeTiledSvg } = await import(renderUrl);
  const { createMercuryInstance, MERCURY_DEFAULT_PARAMS } = await import(recipeUrl);
  const { compileRecipeToFingerRenderModel } = await import(mercuryUrl);
  const { recipeDefinitionChecksum } = await import(checksumUrl);

  const definitionChecksum = recipeDefinitionChecksum('mercury-dew');
  const recipe = createMercuryInstance('signature');
  const baseColor = recipe.params.baseColor || MERCURY_DEFAULT_PARAMS.baseColor;
  const appearance = {
    baseCoverage: recipe.params.baseCoverage,
    opticalEffect: recipe.params.opticalEffect,
    topFinish: recipe.params.topFinish,
  };

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const results = [];

  for (const fixture of index.fixtures) {
    const expectedGeo = GEOMETRY_BY_PRESET[fixture.lengthPreset];
    if (fixture.geometryLength !== expectedGeo) {
      throw new Error(
        `length mapping mismatch for ${fixture.id}: lengthPreset=${fixture.lengthPreset} geometryLength=${fixture.geometryLength} expected=${expectedGeo}`,
      );
    }

    const shape = fixture.shape;
    const geometryLength = fixture.geometryLength;
    const lengthPreset = fixture.lengthPreset;
    const outDir = path.join(FIXTURE_ROOT, 'fixtures', fixture.id);
    fs.mkdirSync(outDir, { recursive: true });

    const fingerData = { baseColor, pattern: [], attachments: [] };
    const model = compileRecipeToFingerRenderModel(recipe, {
      shape,
      length: geometryLength,
      finger: 'R4',
    });

    const single = composeNailSvg(
      {
        shape,
        length: geometryLength,
        data: fingerData,
        uid: `fx-${fixture.id}-R4`,
        appearance,
        recipe,
        finger: 'R4',
      },
      4,
    );
    if (!single) throw new Error(`composeNailSvg returned null for ${fixture.id}`);
    if (!single.includes('data-recipe="mercury-dew"')) {
      throw new Error(`single.svg missing mercury-dew marker for ${fixture.id}`);
    }

    const doc = {
      schemaVersion: 3,
      designId: `mercury-fixture-${fixture.id}`,
      shape,
      length: geometryLength,
      lengthPreset,
      appearance,
      baseColor,
      pattern: [],
      attachments: [],
      recipe,
      relief: [],
      fingerLocks: {},
      masterFinger: 'R4',
      updatedAt: FIXED_UPDATED_AT,
    };
    const tiled = composeTiledSvg(doc, { view: 'back', markBadges: true });
    if (!tiled) throw new Error(`composeTiledSvg returned null for ${fixture.id}`);
    const fingerMatches = tiled.match(/data-finger="/g) || [];
    if (fingerMatches.length !== 10) {
      throw new Error(`tiled.svg expected 10 fingers, got ${fingerMatches.length} for ${fixture.id}`);
    }
    if (!tiled.includes('data-recipe="mercury-dew"')) {
      throw new Error(`tiled.svg missing mercury-dew marker for ${fixture.id}`);
    }

    const recipePath = path.join(outDir, 'recipe.json');
    const singlePath = path.join(outDir, 'single.svg');
    const tiledPath = path.join(outDir, 'tiled.svg');
    const previewPath = path.join(outDir, 'preview.png');
    const tiledPngPath = path.join(outDir, 'tiled.png');
    const snapshotPath = path.join(outDir, 'snapshot.json');

    fs.writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);
    fs.writeFileSync(singlePath, single);
    fs.writeFileSync(tiledPath, tiled);

    const previewMeta = await rasterizeSvg(page, single, previewPath);
    const tiledMeta = await rasterizeSvg(page, tiled, tiledPngPath);

    if (previewMeta.width < 32 || previewMeta.height < 32) {
      throw new Error(`preview.png too small for ${fixture.id}: ${previewMeta.width}x${previewMeta.height}`);
    }
    if (tiledMeta.width < 64 || tiledMeta.height < 64) {
      throw new Error(`tiled.png too small for ${fixture.id}: ${tiledMeta.width}x${tiledMeta.height}`);
    }

    const singleBuf = fs.readFileSync(singlePath);
    const tiledBuf = fs.readFileSync(tiledPath);
    const previewBuf = fs.readFileSync(previewPath);
    const tiledPngBuf = fs.readFileSync(tiledPngPath);
    const recipeBuf = fs.readFileSync(recipePath);

    const checksums = {
      recipeDefinition: definitionChecksum,
      recipeInstance: fnv1aHex(recipeBuf.toString('utf8')),
      singleSvg: sha256Hex(singleBuf),
      tiledSvg: sha256Hex(tiledBuf),
      previewPng: sha256Hex(previewBuf),
      tiledPng: sha256Hex(tiledPngBuf),
    };

    const snapshot = {
      id: fixture.id,
      shape,
      lengthPreset,
      geometryLength,
      recipeRef: recipe.recipeRef,
      presetId: recipe.presetId,
      renderer: 'svg-2.5d/mercury-1',
      manufacturing: 'unvalidated',
      manufacturing_command_allowed: false,
      components: model.components,
      warnings: model.warnings,
      previewSize: previewMeta,
      tiledSize: tiledMeta,
      checksums,
      outputs: {
        recipe: 'recipe.json',
        single: 'single.svg',
        tiled: 'tiled.svg',
        preview: 'preview.png',
        tiledPng: 'tiled.png',
        snapshot: 'snapshot.json',
      },
      generatedAt: FIXED_UPDATED_AT,
      note: '屏幕 SVG 与 PNG 同源构图；2.5D 模拟效果，非生产可制造结果。',
    };

    fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

    for (const name of REQUIRED_FILES) {
      if (!fs.existsSync(path.join(outDir, name))) {
        throw new Error(`missing output ${name} for ${fixture.id}`);
      }
    }

    fixture.outputs = {
      dir: `fixtures/${fixture.id}`,
      recipe: `fixtures/${fixture.id}/recipe.json`,
      single: `fixtures/${fixture.id}/single.svg`,
      tiled: `fixtures/${fixture.id}/tiled.svg`,
      preview: `fixtures/${fixture.id}/preview.png`,
      tiledPng: `fixtures/${fixture.id}/tiled.png`,
      snapshot: `fixtures/${fixture.id}/snapshot.json`,
    };
    fixture.checksum = {
      recipeDefinition: definitionChecksum,
      singleSvg: checksums.singleSvg,
      tiledSvg: checksums.tiledSvg,
      previewPng: checksums.previewPng,
      tiledPng: checksums.tiledPng,
    };
    // Regenerating outputs invalidates any prior manual signoff: reset to pending.
    fixture.status = 'pending_visual_signoff';
    delete fixture.signoff;

    results.push({
      id: fixture.id,
      singleBytes: singleBuf.length,
      tiledBytes: tiledBuf.length,
      preview: `${previewMeta.width}x${previewMeta.height}`,
      tiledPng: `${tiledMeta.width}x${tiledMeta.height}`,
      checksums,
    });

    console.log(
      `generated ${fixture.id}: single=${singleBuf.length}B tiled=${tiledBuf.length}B preview=${previewMeta.width}x${previewMeta.height} def=${definitionChecksum}`,
    );
  }

  // Fresh outputs always land pending; signoff must be re-done by a human.
  index.fixtureType = 'visual-signoff-pending';
  delete index.signoff;
  index.note =
    '由 Canonical Renderer 生成屏幕 SVG/PNG 后人工签收；本清单不把静态占位图冒充视觉基线。重新生成会作废既有签收。';
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);

  await browser.close();

  console.log(`generate-mercury-fixtures: PASS (${results.length} fixtures, definition ${definitionChecksum})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
