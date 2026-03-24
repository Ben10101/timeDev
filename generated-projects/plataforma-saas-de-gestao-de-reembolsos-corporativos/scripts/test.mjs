import { access, readFile, readdir } from 'fs/promises';
import path from 'path';

const root = process.cwd();

async function assertFile(relativePath) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
  }
}

async function readSafe(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function listFeatureDirs() {
  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');
  try {
    const entries = await readdir(featuresRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

const requiredFiles = [
  'apps/api/src/server.ts',
  'apps/web/src/App.tsx',
  'prisma/schema.prisma',
];

for (const file of requiredFiles) {
  await assertFile(file);
}

const serverContent = await readSafe('apps/api/src/server.ts');
const appContent = await readSafe('apps/web/src/App.tsx');
const schemaContent = await readSafe('prisma/schema.prisma');
const featureDirs = await listFeatureDirs();

if (!serverContent.includes("app.get('/health'")) {
  throw new Error('API sem rota /health registrada.');
}

if (!appContent.includes("path: '/'")) {
  throw new Error('Frontend sem rota Home registrada.');
}

for (const featureDir of featureDirs) {
  const pagePath = `apps/web/src/features/${featureDir}/page.tsx`;
  const servicePath = `apps/web/src/features/${featureDir}/service.ts`;
  await assertFile(pagePath);
  await assertFile(servicePath);

  const pageContent = await readSafe(pagePath);
  if (!pageContent.includes('FeaturePage') || !pageContent.includes('packages/ui/src/index.tsx')) {
    throw new Error(`Feature ${featureDir} nao esta usando o design system compartilhado.`);
  }
}

const frontendRoutes = [...appContent.matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1]);
const apiRoutes = [...serverContent.matchAll(/app\.use\('([^']+)'/g)].map((match) => match[1]);

if (featureDirs.length && frontendRoutes.length < featureDirs.length) {
  throw new Error('O frontend nao registrou todas as rotas das features geradas.');
}

if (featureDirs.length && apiRoutes.length < featureDirs.length) {
  throw new Error('A API nao registrou todas as rotas das features geradas.');
}

if (!schemaContent.includes('model ')) {
  throw new Error('Schema Prisma sem nenhum model.');
}

console.log('Smoke tests do projeto gerado concluídos com sucesso.');
