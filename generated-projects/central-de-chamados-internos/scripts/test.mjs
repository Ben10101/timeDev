import { access, readFile, readdir } from 'fs/promises';
import path from 'path';
const root = process.cwd();
async function assertFile(relativePath) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    throw new Error(`Arquivo obrigatorio ausente: ${relativePath}`);
  }
}
async function readSafe(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}
async function listDirectories(relativePath) {
  try {
    const entries = await readdir(path.join(root, relativePath), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
for (const file of ['apps/api/src/server.ts', 'apps/web/src/App.tsx', 'prisma/schema.prisma']) {
  await assertFile(file);
}
const serverContent = await readSafe('apps/api/src/server.ts');
const appContent = await readSafe('apps/web/src/App.tsx');
const schemaContent = await readSafe('prisma/schema.prisma');
const webFeatures = await listDirectories('apps/web/src/features');
const apiModules = await listDirectories('apps/api/src/modules');
const contractFiles = await readdir(path.join(root, 'packages', 'shared', 'src', 'contracts')).catch(() => []);
if (!serverContent.includes("app.get('/health'")) {
  throw new Error('API sem rota /health registrada.');
}
if (!appContent.includes("path: '/'")) {
  throw new Error('Frontend sem rota Home registrada.');
}
if (!schemaContent.includes('model ')) {
  throw new Error('Schema Prisma sem nenhum model.');
}
for (const featureDir of webFeatures) {
  await assertFile(`apps/web/src/features/${featureDir}/page.tsx`);
  await assertFile(`apps/web/src/features/${featureDir}/service.ts`);
  await assertFile(`apps/api/src/modules/${featureDir}/router.ts`);
  await assertFile(`apps/api/src/modules/${featureDir}/service.ts`);
  await assertFile(`packages/shared/src/contracts/${featureDir}.ts`);
  const pageContent = await readSafe(`apps/web/src/features/${featureDir}/page.tsx`);
  const routerContent = await readSafe(`apps/api/src/modules/${featureDir}/router.ts`);
  const serviceContent = await readSafe(`apps/api/src/modules/${featureDir}/service.ts`);
  const contractContent = await readSafe(`packages/shared/src/contracts/${featureDir}.ts`);
  if (!pageContent.includes('packages/ui/src/index.tsx')) {
    throw new Error(`Feature ${featureDir} nao usa o kit visual compartilhado.`);
  }
  if (!routerContent.includes(".get('/',") || !routerContent.includes(".post('/',")) {
    throw new Error(`Modulo ${featureDir} sem rotas GET/POST basicas.`);
  }
  if (!serviceContent.includes('buildSeedRecordsFromTask')) {
    throw new Error(`Modulo ${featureDir} sem seeds basicos para validacao incremental.`);
  }
  if (!/Request\s*\{/.test(contractContent) || !/Response\s*\{/.test(contractContent) || !/ListResponse\s*\{/.test(contractContent)) {
    throw new Error(`Contrato ${featureDir} sem Request/Response/ListResponse completos.`);
  }
  const expectedModelName = contractContent.match(/export interface ([A-Za-z0-9]+)Request/)?.[1]?.replace(/Request$/, '');
  if (expectedModelName && !schemaContent.includes(`model ${expectedModelName} {`)) {
    throw new Error(`Schema Prisma sem model esperado para ${featureDir}: ${expectedModelName}.`);
  }
}
if (webFeatures.length !== apiModules.length) {
  throw new Error('Quantidade de features web difere da quantidade de modulos da API.');
}
if (webFeatures.length !== contractFiles.filter((file) => String(file).endsWith('.ts')).length) {
  throw new Error('Quantidade de contratos compartilhados difere das features geradas.');
}
if (!/createdAt\s+DateTime/.test(schemaContent) || !/updatedAt\s+DateTime/.test(schemaContent)) {
  throw new Error('Schema Prisma sem trilha minima de datas nas models geradas.');
}
console.log('Smoke tests do projeto gerado concluidos com sucesso.');