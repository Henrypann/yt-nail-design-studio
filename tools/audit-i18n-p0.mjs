import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'src/app/pages/design/WizardPage.tsx',
  'src/app/pages/design/VersionedImportPage.tsx',
  'src/app/pages/design/DesignListPage.tsx',
  'src/app/pages/StudioHomePage.tsx',
  ...fs.readdirSync(path.join(root, 'src/studio/wizard')).filter((name) => name.endsWith('.tsx')).map((name) => `src/studio/wizard/${name}`),
];
const allowlist = new Map([
  ['src/studio/wizard/ShapeLengthPicker.tsx', 'domain availability labels are resolved through shape capability registry'],
  ['src/studio/wizard/CustomerPickerModal.tsx', 'twin mock status fallback text is a domain fixture label'],
]);
const findings = [];
const isMeaningful = (value) => /[^\s]/.test(value) && !/^\s*([·/→:：()（）.,，。!！?？-]+)\s*$/.test(value);
for (const relative of files) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) {
      const value = node.getText(sf);
      if (/[\u3400-\u9fff]/.test(value) && isMeaningful(value)) findings.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: JSX text`);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.text;
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(name)) {
        const value = node.initializer;
        if (ts.isStringLiteral(value) && /[\u3400-\u9fff]/.test(value.text)) findings.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${name}`);
        if (ts.isJsxExpression(value) && value.expression && (ts.isStringLiteral(value.expression) || ts.isNoSubstitutionTemplateLiteral(value.expression)) && /[\u3400-\u9fff]/.test(value.expression.text)) findings.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${name}`);
      }
    } else if (ts.isCallExpression(node) && node.expression.getText(sf).match(/(?:toast|notify)\.(?:success|error|warning|info)$/)) {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && /[\u3400-\u9fff]/.test(arg.text)) findings.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: toast copy`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
if (findings.length) {
  console.error(`P0 i18n AST audit failed: ${findings.length} raw product literals`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`P0 i18n AST audit passed: ${files.length} files, 0 raw product literals`);
console.log(`Allowlist: ${[...allowlist.entries()].map(([file, reason]) => `${file} (${reason})`).join('; ')}`);
