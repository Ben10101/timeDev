import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function waitForStableUi(page, delay = 1200) {
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(delay);
}

async function run() {
  await ensureDir(screenshotsDir);

  const browser = await chromium.launch({
    headless: true,
    executablePath: edgePath,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const uniqueId = Date.now();
  const account = {
    name: 'Documentacao Aligna',
    email: `docs.${uniqueId}@example.com`,
    password: 'AlignaDocs123',
    workspaceName: `Workspace Docs ${uniqueId}`,
    projectName: 'Portal de Reembolsos Demo',
    projectVision: 'Centralizar solicitacoes, aprovacoes e rastreabilidade do fluxo de reembolsos corporativos.',
    taskTitle: 'Como colaborador, quero registrar uma solicitação com comprovantes para acompanhar a aprovação.',
  };

  await page.goto('http://localhost:5173/auth', { waitUntil: 'domcontentloaded' });
  await waitForStableUi(page);
  await page.screenshot({
    path: path.join(screenshotsDir, 'auth-page.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Para Empresa' }).click();
  await page.getByPlaceholder('João Silva').fill(account.name);
  await page.getByPlaceholder('joao@empresa.com').fill(account.email);
  await page.getByPlaceholder('Sua Empresa').fill(account.workspaceName);
  await page.getByPlaceholder('No mínimo 8 caracteres').fill(account.password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  await page.waitForURL('**/projects', { timeout: 30000 });
  await waitForStableUi(page);

  await page.locator('section').filter({ hasText: 'Catalogo' }).getByRole('button').click();
  await page.getByPlaceholder('Ex.: Plataforma de EAD').fill(account.projectName);
  await page.getByPlaceholder('Objetivo principal, público e resultado esperado...').fill(account.projectVision);
  await page.getByRole('button', { name: 'Criar projeto' }).click();

  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30000 });
  await waitForStableUi(page);
  await page.screenshot({
    path: path.join(screenshotsDir, 'project-overview.png'),
    fullPage: true,
  });

  const currentUrl = page.url();
  const projectUuid = currentUrl.split('/projects/')[1];

  await page.goto(`http://localhost:5173/projects?project=${projectUuid}`, { waitUntil: 'domcontentloaded' });
  await waitForStableUi(page);
  await page.getByPlaceholder('Descreva a nova task...').fill(account.taskTitle);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await waitForStableUi(page);
  await page.screenshot({
    path: path.join(screenshotsDir, 'projects-board.png'),
    fullPage: true,
  });

  await page.goto('http://localhost:5173/settings/ai', { waitUntil: 'domcontentloaded' });
  await waitForStableUi(page, 1800);
  await page.screenshot({
    path: path.join(screenshotsDir, 'ai-governance.png'),
    fullPage: true,
  });

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
