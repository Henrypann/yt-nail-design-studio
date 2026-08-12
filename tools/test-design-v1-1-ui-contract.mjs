import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/app', 'src/community', 'src/studio'];
const files = roots.flatMap((root) => fs.readdirSync(root, { recursive: true })
  .filter((name) => typeof name === 'string' && /\.(?:tsx?|css)$/.test(name) && !/selftest|fixture|fixtures/.test(name))
  .map((name) => path.join(root, name)));
const productSource = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assert.doesNotMatch(productSource, /text-\[(?:8|9|10|11|12|15)px\]/, 'product UI uses semantic typography');
assert.doesNotMatch(productSource, /#[cC]2497[aA]/, 'legacy brand color is absent from product UI');

const tokens = fs.readFileSync('src/design-system/tokens.css', 'utf8');
for (const value of ['#f04e7e', '#db3a6a', '#fde4ee', '#f7a8c6', '#faf6ef', '#f3ede3']) {
  assert.match(tokens.toLowerCase(), new RegExp(value), `DESIGN token ${value} is present`);
}

const grid = fs.readFileSync('src/studio/preview/NailGrid.tsx', 'utf8');
const tiled = fs.readFileSync('src/studio/preview/TiledNailsPreview.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
assert.match(grid, /nail-grid__items/);
assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
assert.match(css, /max-width: 459px/);
assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(tiled, /min-w-\[120px\]/);
assert.match(tiled, /ResizeObserver/);
assert.match(tiled, /Number\.isFinite/);

const shell = fs.readFileSync('src/studio/editor/components/EditorShellV7.tsx', 'utf8');
assert.match(shell, /min-width: 1440px/);
assert.match(shell, /min-width: 1100px/);
assert.match(shell, /max-width: 1099px/);
assert.match(shell, /max-width: 799px/);
assert.doesNotMatch(shell, /w-\[380px\]/);

console.log('[design-v1.1] semantic tokens, typography, NailGrid and editor breakpoints: PASS');
