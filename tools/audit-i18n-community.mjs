import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/community');
const files = [];
for (const dir of ['pages', 'components']) {
  const folder = path.join(root, dir);
  for (const name of fs.readdirSync(folder)) if (name.endsWith('.tsx')) files.push(path.join(folder, name));
}

// These are implementation identifiers, not product copy. Keep the list exact and reviewed.
const allow = new Set(['·', '✓', '×', '…', 'Fixed DesignVersion', 'DesignVersion', 'Fidelity', 'Derived assets']);
const findings = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/<[A-Za-z][^>]*>/.test(line) || line.includes('useState<') || line.includes('useParams<')) return;
    const text = line.match(/>([^<>{}]+)</g) ?? [];
    for (const match of text) {
      const value = match.slice(1, -1).trim();
      if (value && /[A-Za-z\u3400-\u9fff]/.test(value) && !allow.has(value) && !value.includes('?')) findings.push({ file, line: index + 1, kind: 'jsx-text', value });
    }
    for (const match of line.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]+)"/g)) {
      if (/[A-Za-z\u3400-\u9fff]/.test(match[2])) findings.push({ file, line: index + 1, kind: match[1], value: match[2] });
    }
  });
}
console.log(JSON.stringify({ scope: files.map((file) => path.relative(process.cwd(), file)), productionFiles: files.length, rawUiCount: findings.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;
