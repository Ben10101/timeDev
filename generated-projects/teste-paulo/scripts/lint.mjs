import { readFile, readdir } from 'fs/promises';
import path from 'path';

const root = process.cwd();

async function listFeaturePages() {
  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');
  try {
    const entries = await readdir(featuresRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(featuresRoot, entry.name, 'page.tsx'));
  } catch {
    return [];
  }
}

function collectDuplicateLines(content, predicate) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => (predicate ? predicate(line) : true));

  const counts = new Map();
  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }

  return Array.from(counts.entries()).filter(([, count]) => count > 1);
}

async function readSafe(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

const failures = [];
const genericFallbackPattern = /Campo principal da feature gerada|Informe o valor principal/;

const appContent = await readSafe(path.join(root, 'apps', 'web', 'src', 'App.tsx'));
const serverContent = await readSafe(path.join(root, 'apps', 'api', 'src', 'server.ts'));

for (const [line, count] of collectDuplicateLines(appContent, (line) => line.startsWith('import ') || line.includes("path: '"))) {
  failures.push(`App.tsx possui linha duplicada ${count}x: ${line}`);
}

for (const [line, count] of collectDuplicateLines(serverContent, (line) => line.startsWith('import ') || line.startsWith('app.use('))) {
  failures.push(`server.ts possui linha duplicada ${count}x: ${line}`);
}

for (const pagePath of await listFeaturePages()) {
  const pageContent = await readSafe(pagePath);
  if (genericFallbackPattern.test(pageContent)) {
    failures.push(`${path.relative(root, pagePath)} ainda contém textos genéricos de fallback.`);
  }
}

if (failures.length) {
  console.error('Lint do projeto gerado falhou.\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Lint do projeto gerado concluído sem problemas.');
