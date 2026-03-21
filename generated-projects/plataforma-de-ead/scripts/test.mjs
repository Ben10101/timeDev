import { access, readFile } from 'fs/promises';
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

for (const file of ['apps/api/src/server.ts', 'apps/web/src/App.tsx', 'prisma/schema.prisma']) {
  await assertFile(file);
}

const serverContent = await readSafe('apps/api/src/server.ts');
const appContent = await readSafe('apps/web/src/App.tsx');
const schemaContent = await readSafe('prisma/schema.prisma');

if (!serverContent.includes("app.get('/health'")) {
  throw new Error('API sem rota /health registrada.');
}

if (!appContent.includes("path: '/'")) {
  throw new Error('Frontend sem rota Home registrada.');
}

if (!schemaContent.includes('model ')) {
  throw new Error('Schema Prisma sem nenhum model.');
}

console.log('Smoke tests do projeto gerado concluídos com sucesso.');
