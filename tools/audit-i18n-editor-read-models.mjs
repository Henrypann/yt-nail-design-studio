import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'src/studio/editor/v7/workspace-ia.ts',
  'src/studio/editor/v7/workspace-step-factory.ts',
  'src/studio/editor/v7/geometry-registry.ts',
];
const presentationFields = new Set(['label', 'labelKey', 'shortLabel', 'shortLabelKey', 'description', 'descriptionKey', 'message', 'messageKey']);
const findings = [];
for (const relative of files) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const field = node.name.getText(sf).replace(/["']/g, '');
      const initializer = node.initializer;
      if (presentationFields.has(field) && (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) && /[\u3400-\u9fff]/u.test(initializer.text)) {
        findings.push(`${relative}:${line(node)}: raw UI copy in ${field}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (findings.length) {
  console.error(`Editor read-model i18n audit failed: ${findings.length} raw presentation literals`);
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`Editor read-model i18n audit passed: ${files.length} files; ProcessStep.name and EditorDoc.title remain canonical/user-data exceptions.`);
