import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { CATALOGS } from '../src/lib/i18n/messages.ts';
import { FROZEN_LEGACY_KEY_BASELINE, FROZEN_LEGACY_KEY_BASELINE_MAX } from '../src/lib/i18n/key-quality.ts';

const root = process.cwd();
const scanRoots = ['src'];
const excluded = new Map();
excluded.set('src/lib/debug-panel.tsx', 'developer-only debug inspection surface; not product UI');
excluded.set('src/lib/mock-panel.tsx', 'developer-only mock failure injection surface; not product UI');
excluded.set('src/studio/geometry/v0-7-2/SurfaceBooleanDevPage.tsx', 'developer-only geometry proof page; simulated internal surface, not product UI');
const technicalAllowlist = new Map([
  ['v', 'design version prefix'],
  ['Esc', 'keyboard shortcut'],
  ['mm', 'millimetre unit'],
  ['MOCK', 'explicit prototype status marker'],
  ['MOCK IOT', 'explicit prototype hardware status marker'],
  ['you@example.com', 'email input example placeholder'],
]);
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx$/.test(entry.name) && !/\.test\.|\.spec\./.test(entry.name)) files.push(file);
  }
}
scanRoots.forEach((relative) => walk(path.join(root, relative)));

const keys = Object.keys(CATALOGS['zh-CN'].messages);
if (new Set(keys).size !== keys.length || keys.some((key) => !key.includes('.'))) throw new Error('i18n catalog key namespace/uniqueness failure');
if (keys.some((key) => key.startsWith('legacy.') || /^\w+\.[a-f0-9]{8,}$/.test(key))) throw new Error('i18n audit failed: unstable legacy/hash catalog key');
const keyViolations = keys.filter((key) =>
  key.length > 64
  || /(?:^|\.)[A-Za-z]+(?:[A-Z][A-Za-z]+){5,}/.test(key)
  || /\d$/.test(key)
  || /^app\.(?:community|board|rights|share|asset)/.test(key),
);
const baseline = new Set(FROZEN_LEGACY_KEY_BASELINE);
if (baseline.size !== FROZEN_LEGACY_KEY_BASELINE.length) throw new Error('i18n audit failed: duplicate frozen legacy key');
if (baseline.size > FROZEN_LEGACY_KEY_BASELINE_MAX) throw new Error('i18n audit failed: frozen legacy baseline grew');
if (FROZEN_LEGACY_KEY_BASELINE.some((key) => !keys.includes(key))) throw new Error('i18n audit failed: frozen legacy baseline contains a deleted key');
if (keyViolations.some((key) => !baseline.has(key))) throw new Error(`i18n audit failed: new key quality violation: ${keyViolations.filter((key) => !baseline.has(key)).join(', ')}`);
if (FROZEN_LEGACY_KEY_BASELINE.some((key) => !keyViolations.includes(key))) throw new Error('i18n audit failed: frozen legacy baseline contains a key that no longer violates the gate; remove it');

const findings = [];
const skipped = [];
const line = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const meaningful = (value) => /[A-Za-z\u3400-\u9fff]/.test(value) && !/^\s*(?:[A-Za-z]?\d[\d\s./:%-]*|[·/→›:：()（）.,，。!！?？+*=<>≤≥↑↓×—–-]+)\s*$/.test(value);
const literalText = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
const parentProp = (node, sf) => { let current = node.parent; while (current && !ts.isPropertyAssignment(current) && !ts.isJsxAttribute(current) && !ts.isCallExpression(current)) current = current.parent; return current?.getText(sf) ?? ''; };

for (const file of files) {
  const relative = path.relative(root, file);
  if (excluded.has(relative)) { skipped.push(`${relative} — ${excluded.get(relative)}`); continue; }
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxText(node)) { const value = node.getText(sf); if (meaningful(value) && !technicalAllowlist.has(value.trim())) findings.push(`${relative}:${line(sf, node)}: JSX visible copy ${JSON.stringify(value.trim())}`); }
    if (ts.isJsxAttribute(node) && node.initializer && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.text)) { const value = literalText(node.initializer); if (value && meaningful(value) && !technicalAllowlist.has(value)) findings.push(`${relative}:${line(sf, node)}: ${node.name.text} literal ${JSON.stringify(value)}`); }
    if (ts.isCallExpression(node) && /(?:toast|notify)\.(?:success|error|warning|info)$/.test(node.expression.getText(sf))) { const value = literalText(node.arguments[0]); if (value && meaningful(value)) findings.push(`${relative}:${line(sf, node)}: toast literal ${JSON.stringify(value)}`); }
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'localizedLabel' && node.arguments.length < 3) findings.push(`${relative}:${line(sf, node)}: localizedLabel must receive the current locale as its third argument`);
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'text') findings.push(`${relative}:${line(sf, node)}: removed compatibility text() call; use semantic t(key)`);
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) for (const element of node.name.elements) { const propertyName = element.propertyName?.getText(sf) ?? element.name.getText(sf); if (propertyName === 'text') findings.push(`${relative}:${line(sf, node)}: compatibility text destructure; use semantic t(key)`); }
    if (ts.isStringLiteral(node) && /[\u3400-\u9fff]/.test(node.text)) {
      const context = parentProp(node, sf);
      const technical = /(?:className|data-testid|data-[\w-]+|id|key|href|src|path|route|protocol|schema|registry|enum|fixture|mock|geometry|taxonomy|status|type|role|value|name|labelId|assetId|testId)/i.test(context);
      const inCatalog = relative.startsWith('src/lib/i18n/');
      if (!technical && !inCatalog && meaningful(node.text) && !technicalAllowlist.has(node.text)) findings.push(`${relative}:${line(sf, node)}: CJK string literal in product expression ${JSON.stringify(node.text)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (findings.length) {
  console.error(`i18n global AST audit failed: ${findings.length} raw product findings across ${files.length - skipped.length} production TSX files`);
  findings.forEach((finding) => console.error(`- ${finding}`));
  console.error(`Exact exclusions (${skipped.length}):`);
  skipped.forEach((entry) => console.error(`- ${entry}`));
  console.error('Exact technical allowlist:');
  technicalAllowlist.forEach((reason, value) => console.error(`- ${JSON.stringify(value)} — ${reason}`));
  process.exit(1);
}
console.log(`i18n global AST audit passed: ${keys.length} catalog keys; ${files.length - skipped.length} production TSX files; 0 findings`);
console.log(`Exact exclusions (${skipped.length}):`);
skipped.forEach((entry) => console.log(`- ${entry}`));
console.log('Exact technical allowlist:');
technicalAllowlist.forEach((reason, value) => console.log(`- ${JSON.stringify(value)} — ${reason}`));
