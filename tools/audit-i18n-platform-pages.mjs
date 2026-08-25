import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'src/app/pages/DashboardPage.tsx',
  'src/app/pages/customers/CustomerListPage.tsx', 'src/app/pages/customers/CustomerDetailPage.tsx', 'src/app/pages/customers/CustomerNewPage.tsx',
  'src/app/pages/devices/DeviceListPage.tsx', 'src/app/pages/devices/DeviceBindPage.tsx', 'src/app/pages/devices/MobileBindPage.tsx',
  'src/app/pages/auth/LoginPage.tsx', 'src/app/pages/auth/RegisterPage.tsx', 'src/app/pages/NotFoundPage.tsx', 'src/app/pages/PlaceholderPage.tsx',
  'src/platform/devices/BindWizard.tsx', 'src/platform/devices/MobileBind.tsx', 'src/platform/CodeVerification.tsx',
];
const findings = [];
for (const relative of files) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node, kind) => findings.push(`${relative}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${kind}`);
  const visit = (node) => {
    if (ts.isJsxText(node) && /[\u3400-\u9fff]/.test(node.getText(sf)) && /[^\s·/→:：()（）.,，。!！?？-]/.test(node.getText(sf))) report(node, 'raw JSX text');
    if (ts.isJsxAttribute(node) && node.initializer && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.text)) {
      if (ts.isStringLiteral(node.initializer) && /[\u3400-\u9fff]/.test(node.initializer.text)) report(node, `raw ${node.name.text}`);
    }
    if (ts.isCallExpression(node) && /(?:toast|notify)\.(?:success|error|warning|info)$/.test(node.expression.getText(sf))) {
      const arg = node.arguments[0];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && /[\u3400-\u9fff]/.test(arg.text)) report(node, 'raw toast copy');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (findings.length) { console.error(`platform i18n audit failed: ${findings.length} raw literals`); findings.forEach((x) => console.error(`- ${x}`)); process.exit(1); }
console.log(`platform i18n audit passed: ${files.length} files, 0 raw product literals`);
