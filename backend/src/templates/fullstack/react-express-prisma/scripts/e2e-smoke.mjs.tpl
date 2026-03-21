import { readFile, readdir } from 'fs/promises';
import path from 'path';

const root = process.cwd();

async function readSafe(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function listFeaturePages() {
  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');
  try {
    const entries = await readdir(featuresRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(featuresRoot, entry.name, 'page.tsx'));
  } catch {
    return [];
  }
}

const failures = [];
const appContent = await readSafe('apps/web/src/App.tsx');

if (!appContent.includes('AppFrame') || !appContent.includes('AppHeader') || !appContent.includes('StudioHome')) {
  failures.push('O shell principal nao usa o trio AppFrame/AppHeader/StudioHome.');
}

for (const pagePath of await listFeaturePages()) {
  const pageContent = await readSafe(path.relative(root, pagePath));
  if (!pageContent.includes('FeaturePage')) {
    failures.push(`${path.relative(root, pagePath)} nao usa FeaturePage.`);
  }
  if (!/highlights=\{/.test(pageContent)) {
    failures.push(`${path.relative(root, pagePath)} nao define highlights de experiencia.`);
  }
  if (!/metrics=\{\[/.test(pageContent)) {
    failures.push(`${path.relative(root, pagePath)} nao define metricas de tela.`);
  }
  if (!/layout="(crud|split|settings|wizard|dashboard)"/.test(pageContent)) {
    failures.push(`${path.relative(root, pagePath)} nao declara layout do design system.`);
  }
}

if (failures.length) {
  console.error('E2E smoke do projeto gerado falhou.\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('E2E smoke do projeto gerado concluido com sucesso.');
