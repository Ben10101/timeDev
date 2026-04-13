import { randomUUID, createHash } from 'crypto';
import { exec } from 'child_process';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import ts from 'typescript';
import { prisma } from '../lib/prisma.js';
import { resolveDomainTemplate } from '../templates/domains/index.js';
import { resolveProjectTemplate } from '../templates/projects/index.js';
import { materializeFullstackTemplate, materializeFullstackTemplateSubset } from './generatedAppTemplateService.js';
import { buildModernFrontendFeatureFiles } from './implementationFrontendGenerator.js';
import { buildRuntimeAiEnvForUser } from './aiSettingsService.js';
import { createGenerationIR, validateGenerationIR } from './generationSpecService.js';
import { getProjectArchitectureStatus, listProjectTasks } from './projectDataService.js';
import { runSingleAgent, runImplementationPipeline } from './orchestratorService.js';
import { buildPatternHints, resolveUiArchetype } from './uiArchetypeService.js';
import { resolveProjectShell } from './frontendShellRegistry.js';
import {
  buildAutonomousImplementationContract,
  resolveImplementationExecutionMode,
} from './implementationAutonomyService.js';
import { invokeDebugAgent } from './implementationAiService.js';
import { recoverBlockingGeneratedAppRunsForStart } from './generatedAppRunRecoveryService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const GENERATED_PROJECTS_ROOT = path.join(REPO_ROOT, 'generated-projects');
const execAsync = promisify(exec);

function uniqueList(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function slugify(value, fallback = 'generated-app') {
  const normalized = String(value || fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

  return normalized || fallback;
}

function pascalCase(value, fallback = 'GeneratedFeature') {
  const parts = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (!parts.length) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeTemplate(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function humanizeFieldName(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function humanizeSelectOptionLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const directMap = {
    self_service: 'Somente o proprio acesso',
    team: 'Equipe',
    global: 'Toda a empresa',
    enabled: 'Ativado',
    disabled: 'Desativado',
    active: 'Ativo',
    draft: 'Rascunho',
  };

  if (directMap[normalized]) return directMap[normalized];
  return humanizeFieldName(value);
}

function humanizeGeneratedStatusLabel(value, fallback = 'Ativo') {
  const normalized = String(value || '').trim().toLowerCase();
  const directMap = {
    active: 'Ativo',
    enabled: 'Ativado',
    disabled: 'Desativado',
    draft: 'Em preparacao',
    pending: 'Pendente',
    archived: 'Arquivado',
  };

  if (directMap[normalized]) return directMap[normalized];
  return value ? humanizeFieldName(value) : fallback;
}

function buildFieldSeedSeries(field) {
  const name = String(field?.name || '').toLowerCase();
  const sample = field?.sampleValue;
  const fallback = field?.defaultValue ?? '';
  const options = Array.isArray(field?.options) ? field.options.filter(Boolean) : [];

  if (options.length >= 3) return options.slice(0, 3);
  if (options.length === 2) return [options[0], options[1], options[0]];
  if (options.length === 1) return [options[0], options[0], options[0]];

  if (name.includes('email')) return ['contato@empresa.com', 'operacoes@empresa.com', 'gestor@empresa.com'];
  if (name.includes('fullname') || name === 'name') return ['Marina Souza', 'Carlos Lima', 'Renata Alves'];
  if (name.includes('role')) return ['solicitante', 'analista', 'gestor'];
  if (name.includes('scope')) return ['self_service', 'team', 'global'];
  if (name.includes('status')) return ['active', 'pending', 'draft'];
  if (name.includes('priority')) return ['alta', 'media', 'baixa'];
  if (name.includes('category')) return ['financeiro', 'acesso', 'suporte'];
  if (name.includes('type')) return ['principal', 'secundario', 'complementar'];
  if (name.includes('documenttype')) return ['nota_fiscal', 'comprovante', 'contrato'];
  if (name.includes('description') || name.includes('details') || name.includes('summary')) {
    return [
      'Informacao principal pronta para orientar a tela.',
      'Contexto adicional que ajuda na leitura do caso.',
      'Exemplo complementar para testar densidade de conteudo.',
    ];
  }
  if (name.includes('matrix') || name.includes('permissions')) {
    return [
      'Abrir chamados; anexar comprovantes; acompanhar andamento',
      'Atender chamados; comentar; reclassificar prioridade',
      'Acompanhar indicadores; revisar equipe; reatribuir atendimentos',
    ];
  }
  if (name.includes('url') || name.includes('link')) {
    return [
      'https://arquivos.empresa.com/base/documento-1.pdf',
      'https://arquivos.empresa.com/base/documento-2.pdf',
      'https://arquivos.empresa.com/base/documento-3.pdf',
    ];
  }
  if (field?.tsType === 'boolean') return [true, false, true];
  if (sample != null && sample !== '') return [sample, sample, sample];
  if (typeof fallback === 'number') return [fallback || 1, (fallback || 1) + 1, (fallback || 1) + 2];
  return [fallback, fallback, fallback];
}

function buildSeedRequestExamples(technicalSpec, domainTemplate) {
  const explicitSeeds = Array.isArray(domainTemplate?.seedRequests) ? domainTemplate.seedRequests : [];
  if (explicitSeeds.length) {
    return explicitSeeds.map((seed) => ({
      ...seed,
    }));
  }

  const fields = technicalSpec.domain.fields || [];
  return [0, 1, 2].map((variantIndex) =>
    Object.fromEntries(fields.map((field) => [field.name, buildFieldSeedSeries(field)[variantIndex]]))
  );
}

function camelCase(value, fallback = 'generatedField') {
  const source = pascalCase(value, fallback);
  return source.charAt(0).toLowerCase() + source.slice(1);
}

function toImportPath(fromRelativePath, toRelativePath) {
  const fromDir = path.posix.dirname(fromRelativePath.replace(/\\/g, '/'));
  let toFile = toRelativePath.replace(/\\/g, '/');
  // Strip TS/JS extensions for imports
  toFile = toFile.replace(/\.(ts|tsx|js|jsx)$/, '');
  const relativePath = path.posix.relative(fromDir, toFile);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readText(targetPath, fallback = '') {
  if (!(await pathExists(targetPath))) return fallback;
  return readFile(targetPath, 'utf8');
}

async function writeText(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const normalizedContent = /[\\/]apps[\\/]web[\\/].+\.(tsx|ts|jsx|js)$|[\\/]packages[\\/]ui[\\/].+\.(tsx|ts|jsx|js)$/i.test(targetPath)
    ? normalizeUiCopy(normalizeGeneratedCopy(content))
    : normalizeGeneratedCopy(content);
  await writeFile(targetPath, normalizedContent, 'utf8');
}

async function ensureGeneratedAppFoundation(project, generatedApp) {
  if (!generatedApp?.rootPath || !project) return false;

  const requiredFiles = [
    'package.json',
    'tsconfig.base.json',
    'apps/api/package.json',
    'apps/api/tsconfig.json',
    'apps/api/src/server.ts',
    'apps/web/package.json',
    'apps/web/index.html',
    'apps/web/tsconfig.json',
    'apps/web/src/main.tsx',
    'apps/web/src/App.tsx',
    'packages/shared/package.json',
    'packages/shared/src/index.ts',
    'packages/ui/package.json',
    'packages/ui/src/index.tsx',
    'packages/config/package.json',
    'prisma/schema.prisma',
    'scripts/lint.mjs',
    'scripts/test.mjs',
  ];

  const missingFiles = [];
  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(generatedApp.rootPath, relativePath);
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(absolutePath))) {
      missingFiles.push(relativePath);
    }
  }

  if (!missingFiles.length) {
    return false;
  }

  const projectTemplate = resolveProjectTemplate(
    project?.templateKey || project?.intakeConfig?.projectTemplateKey || null,
    {
      projectName: project.name,
      label: project.name,
      summary: project.description || project.vision || '',
    }
  );
  const routeSpecs = await getIntegratedTechnicalSpecs(generatedApp.id, null);
  const compositionManifest = buildAppCompositionManifest({
    project,
    generatedApp,
    routeSpecs,
    projectTemplate,
  });

  const writtenFiles = await materializeFullstackTemplateSubset({
    destinationRoot: generatedApp.rootPath,
    projectName: project.name,
    projectSlug: generatedApp.slug || slugify(project.slug || project.name, project.uuid),
    includeRelativeRoots: ['packages/ui', 'packages/config'],
  });
  const workspaceFoundationFiles = await ensureWorkspaceFoundationFiles(generatedApp.rootPath, project.name);
  const validationFiles = await ensureValidationScripts(generatedApp.rootPath);
  const apiServerFile = await updateApiServer(generatedApp.rootPath, compositionManifest, generatedApp.slug);
  const webAppFile = await updateWebApp(generatedApp.rootPath, compositionManifest, project.name, { projectTemplate });
  const compositionManifestFile = await writeCompositionManifest(generatedApp.rootPath, compositionManifest);
  const prismaSchemaContent = await ensureGeneratedProjectPrismaSchemaConsistency(generatedApp.rootPath);

  const normalizedWrittenFiles = [
    ...writtenFiles,
    ...workspaceFoundationFiles,
    ...validationFiles,
    apiServerFile,
    webAppFile,
    compositionManifestFile,
    {
      relativePath: 'prisma/schema.prisma',
      content: prismaSchemaContent,
      fileType: 'prisma',
    },
  ];

  if (normalizedWrittenFiles.length) {
    await prisma.generatedFile.deleteMany({
      where: {
        generatedAppId: generatedApp.id,
        taskImplementationId: null,
        filePath: {
          in: normalizedWrittenFiles.map((file) => file.relativePath.replace(/\\/g, '/')),
        },
      },
    });

    await prisma.generatedFile.createMany({
      data: normalizedWrittenFiles.map((file) => ({
        generatedAppId: generatedApp.id,
        filePath: file.relativePath.replace(/\\/g, '/'),
        fileType: file.fileType,
        changeType: 'created',
        checksum: file.checksum || sha(file.content),
      })),
    });
  }

  return true;
}

function isSpecialistAlignedFrontendPageTemplate(templateSource = '', technicalSpec = {}) {
  const pageContent = String(templateSource || '');
  if (!pageContent.trim()) return false;

  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.architecture?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    '';
  const escapedScreenTemplate = String(screenTemplate || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedProductMode = String(productMode || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasExplicitLayout = new RegExp(`layout\\s*=\\s*["']${escapedScreenTemplate}["']`).test(pageContent);
  const hasExplicitProductMode = productMode
    ? new RegExp(`productMode\\s*=\\s*["']${escapedProductMode}["']`).test(pageContent)
    : false;
  const usesSharedFeatureShell =
    pageContent.includes('FeatureWorkbench') ||
    pageContent.includes('SettingsWorkbench') ||
    pageContent.includes('OperationsWorkspace') ||
    pageContent.includes('ExecutiveCockpit') ||
    pageContent.includes('SettingsConsole') ||
    pageContent.includes('PlannerWorkbench') ||
    pageContent.includes('FeaturePage');
  const usesSharedDesignPrimitives =
    pageContent.includes('FieldGroup') &&
    pageContent.includes('PrimaryButton') &&
    (pageContent.includes('inputStyle') || pageContent.includes('SurfaceCard') || pageContent.includes('tokens'));

  return (
    usesSharedDesignPrimitives &&
    ((hasExplicitLayout && (!productMode || hasExplicitProductMode)) ||
      (usesSharedFeatureShell && (!productMode || hasExplicitProductMode)))
  );
}

function shouldPreserveExistingFrontendPageTemplate({
  technicalSpec,
  existingTemplate,
  candidateTemplate,
  candidateSource,
}) {
  const currentTemplate = String(existingTemplate || '').trim();
  const nextTemplate = String(candidateTemplate || '').trim();

  if (!currentTemplate || !nextTemplate || currentTemplate === nextTemplate) {
    return false;
  }

  if (!isSpecialistAlignedFrontendPageTemplate(currentTemplate, technicalSpec)) {
    return false;
  }

  if (!isSpecialistAlignedFrontendPageTemplate(nextTemplate, technicalSpec)) {
    return true;
  }

  return candidateSource !== 'llm_primary';
}

async function hydrateTechnicalSpecWithWorkspaceImplementation(technicalSpec, generatedAppRoot) {
  if (!technicalSpec || !generatedAppRoot) {
    return technicalSpec;
  }

  const frontendFeaturePath = technicalSpec.frontend?.featurePath || null;
  const backendModulePath = technicalSpec.backend?.modulePath || null;
  const workspaceFrontendFiles = frontendFeaturePath
    ? {
        pageTsxTemplate: await readText(path.join(generatedAppRoot, frontendFeaturePath, 'page.tsx'), ''),
        serviceTsTemplate: await readText(path.join(generatedAppRoot, frontendFeaturePath, 'service.ts'), ''),
        indexTsTemplate: await readText(path.join(generatedAppRoot, frontendFeaturePath, 'index.ts'), ''),
      }
    : {};
  const workspaceBackendFiles = backendModulePath
    ? {
        serviceTsTemplate: await readText(path.join(generatedAppRoot, backendModulePath, 'service.ts'), ''),
        routerTsTemplate: await readText(path.join(generatedAppRoot, backendModulePath, 'router.ts'), ''),
        indexTsTemplate: await readText(path.join(generatedAppRoot, backendModulePath, 'index.ts'), ''),
      }
    : {};

  const nextFrontendSources = { ...(technicalSpec.frontend?.autonomousFileSources || {}) };
  const nextBackendSources = { ...(technicalSpec.backend?.autonomousFileSources || {}) };

  for (const [key, value] of Object.entries(workspaceFrontendFiles)) {
    if (String(value || '').trim() && !nextFrontendSources[key]) {
      nextFrontendSources[key] = 'workspace_current';
    }
  }

  for (const [key, value] of Object.entries(workspaceBackendFiles)) {
    if (String(value || '').trim() && !nextBackendSources[key]) {
      nextBackendSources[key] = 'workspace_current';
    }
  }

  return {
    ...technicalSpec,
    frontend: {
      ...technicalSpec.frontend,
      autonomousPageTsxTemplate:
        technicalSpec.frontend?.autonomousPageTsxTemplate || workspaceFrontendFiles.pageTsxTemplate || null,
      autonomousServiceTsTemplate:
        technicalSpec.frontend?.autonomousServiceTsTemplate || workspaceFrontendFiles.serviceTsTemplate || null,
      autonomousIndexTsTemplate:
        technicalSpec.frontend?.autonomousIndexTsTemplate || workspaceFrontendFiles.indexTsTemplate || null,
      autonomousFileSources: Object.keys(nextFrontendSources).length ? nextFrontendSources : null,
    },
    backend: {
      ...technicalSpec.backend,
      autonomousServiceTsTemplate:
        technicalSpec.backend?.autonomousServiceTsTemplate || workspaceBackendFiles.serviceTsTemplate || null,
      autonomousRouterTsTemplate:
        technicalSpec.backend?.autonomousRouterTsTemplate || workspaceBackendFiles.routerTsTemplate || null,
      autonomousIndexTsTemplate:
        technicalSpec.backend?.autonomousIndexTsTemplate || workspaceBackendFiles.indexTsTemplate || null,
      autonomousFileSources: Object.keys(nextBackendSources).length ? nextBackendSources : null,
    },
  };
}

async function reconcileLegacyGeneratedFeatureModules(generatedAppRoot, technicalSpecs = []) {
  const repairedFiles = [];

  for (const technicalSpec of technicalSpecs) {
    const backendServicePath = path.join(generatedAppRoot, technicalSpec.backend.modulePath, 'service.ts');
    const frontendPagePath = path.join(generatedAppRoot, technicalSpec.frontend.featurePath, 'page.tsx');
    const backendServiceContent = await readText(backendServicePath, '');
    const frontendPageContent = await readText(frontendPagePath, '');

    const backendNeedsRepair =
      backendServiceContent.includes('const records:') ||
      !backendServiceContent.includes("from '@prisma/client'") ||
      !backendServiceContent.includes('const prisma = new PrismaClient()');
    const frontendNeedsRepair =
      frontendPageContent &&
      !frontendPageContent.includes('packages/ui/src/index.tsx') &&
      !frontendPageContent.includes('/packages/ui/src/index.tsx');

    if (!backendNeedsRepair && !frontendNeedsRepair) {
      continue;
    }

    const syntheticTask = buildSyntheticTaskFromSpec(technicalSpec);
    const files = [
      ...buildBackendModuleFilesFromTemplate(syntheticTask, technicalSpec),
      ...buildFrontendFeatureFilesFromTemplate(syntheticTask, technicalSpec),
    ];

    for (const file of files) {
      await writeText(path.join(generatedAppRoot, file.relativePath), file.content);
      repairedFiles.push(file);
    }
  }

  return repairedFiles;
}

async function removeFileIfExists(targetPath) {
  try {
    await rm(targetPath, { force: true });
  } catch {
    // Mantem a regeneracao idempotente quando o arquivo ja nao existe.
  }
}

async function removeEmptyParentDirectories(filePath, stopAtPath) {
  let currentPath = path.dirname(filePath);
  const normalizedStop = path.resolve(stopAtPath);

  while (currentPath.startsWith(normalizedStop) && currentPath !== normalizedStop) {
    try {
      const entries = await readdir(currentPath);
      if (entries.length > 0) {
        break;
      }
      await rm(currentPath, { recursive: true, force: true });
      currentPath = path.dirname(currentPath);
    } catch {
      break;
    }
  }
}

async function removeDirectoryIfExists(targetPath) {
  try {
    await rm(targetPath, { recursive: true, force: true });
  } catch {
    // Mantem a limpeza idempotente quando o diretório já não existe.
  }
}

async function removeObsoleteGeneratedFeatureSlices(rootPath, compositionManifest) {
  const expectedFeatureKeys = new Set(
    (compositionManifest?.frontend?.routes || [])
      .map((route) => route.featureKey)
      .filter(Boolean)
  );

  const cleanupDirectoryChildren = async (relativeRoot, shouldKeep) => {
    const absoluteRoot = path.join(rootPath, relativeRoot);
    let entries = [];

    try {
      entries = await readdir(absoluteRoot, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      if (shouldKeep(entryName)) {
        continue;
      }

      const targetPath = path.join(absoluteRoot, entryName);
      if (entry.isDirectory()) {
        await removeDirectoryIfExists(targetPath);
      } else {
        await removeFileIfExists(targetPath);
      }
    }
  };

  await cleanupDirectoryChildren(
    path.join('apps', 'web', 'src', 'features'),
    (entryName) => expectedFeatureKeys.has(entryName)
  );

  await cleanupDirectoryChildren(
    path.join('apps', 'api', 'src', 'modules'),
    (entryName) => expectedFeatureKeys.has(entryName)
  );

  await cleanupDirectoryChildren(
    path.join('packages', 'shared', 'src', 'contracts'),
    (entryName) => {
      if (!String(entryName).endsWith('.ts')) {
        return true;
      }
      const featureKey = entryName.replace(/\.ts$/, '');
      return expectedFeatureKeys.has(featureKey);
    }
  );

  await cleanupDirectoryChildren(
    path.join('docs', 'implementations'),
    (entryName) => {
      if (!String(entryName).endsWith('.md')) {
        return true;
      }
      const featureKey = entryName.replace(/\.md$/, '');
      return expectedFeatureKeys.has(featureKey);
    }
  );
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

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([line, count]) => ({ line, count }));
}

function getImplementationAutoRepairAttempts() {
  const parsed = Number.parseInt(process.env.IMPLEMENTATION_AUTO_REPAIR_ATTEMPTS || '2', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
}

function truncateText(value, maxLength = 2000) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function repairEncodingArtifacts(value) {
  let current = String(value || '');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!hasEncodingArtifacts(current)) break;

    const candidate = Buffer.from(current, 'latin1').toString('utf8');
    if (!candidate || candidate === current) break;

    const artifactPattern = /[\u00C3\u00C2\u00E2\uFFFD]/g;
    const candidateArtifacts = (candidate.match(artifactPattern) || []).length;
    const currentArtifacts = (current.match(artifactPattern) || []).length;
    if (candidateArtifacts > currentArtifacts) break;

    current = candidate;
  }

  return current;
}

function toAsciiUiText(value) {
  return repairEncodingArtifacts(value)
    .replace(/\uFFFD/g, 'O')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();
}

function normalizeUiCopy(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUiCopy(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeUiCopy(item)])
    );
  }

  if (typeof value === 'string') {
    return toAsciiUiText(value);
  }

  return value;
}

function normalizeGeneratedCopy(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGeneratedCopy(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeGeneratedCopy(item)])
    );
  }

  if (typeof value === 'string') {
    return repairEncodingArtifacts(value).replace(/\s+\n/g, '\n').trimEnd();
  }

  return value;
}

function getAiGovernanceVersionMeta() {
  return {
    policyVersion: process.env.AI_POLICY_VERSION || 'v1',
    promptVersion: process.env.AI_PROMPT_VERSION || 'v1',
    releaseVersion: process.env.PLATFORM_VERSION || '1.0.0',
  };
}

function compactValidationSummary(validationSummary = []) {
  return (validationSummary || []).slice(0, 6).map((item) => ({
    field: item.field,
    required: Boolean(item.required),
    validations: (item.validations || []).slice(0, 3),
  }));
}

function compactExperienceGoals(goals = []) {
  return (goals || []).map((item) => truncateText(item, 140)).slice(0, 4);
}

function compactUiFieldsForGeneration(fields = []) {
  return (fields || []).slice(0, 6).map((field) => ({
    name: field.name,
    label: field.label,
    inputType: field.inputType,
    required: Boolean(field.required),
    options: Array.isArray(field.selectOptions) ? field.selectOptions.slice(0, 5) : [],
  }));
}

function getUiIntentDirection(intent = 'custom', screenTemplate = 'crud') {
  const map = {
    configure: {
      userJob: 'ajustar preferencias e definir regras de uso',
      primaryActionStyle: 'confirmar ajuste com seguranca',
      supportingSurface: 'resumo do estado atual',
      visualPriority: 'form-first',
    },
    attach: {
      userJob: 'reunir contexto e anexos sem interromper o fluxo',
      primaryActionStyle: 'capturar evidencia com clareza',
      supportingSurface: 'acervo vivo do caso',
      visualPriority: 'records-first',
    },
    review: {
      userJob: 'avaliar itens e decidir rapidamente o proximo passo',
      primaryActionStyle: 'revisar e decidir',
      supportingSurface: 'fila de pendencias',
      visualPriority: 'records-first',
    },
    list: {
      userJob: 'consultar registros e localizar o que precisa de atencao',
      primaryActionStyle: 'explorar e filtrar',
      supportingSurface: 'lista viva',
      visualPriority: 'records-first',
    },
    update: {
      userJob: 'ajustar dados existentes sem perder contexto',
      primaryActionStyle: 'editar e confirmar',
      supportingSurface: 'estado atual da informacao',
      visualPriority: 'form-first',
    },
    create: {
      userJob: 'registrar um novo item com contexto suficiente',
      primaryActionStyle: 'criar com clareza',
      supportingSurface: 'registros recentes',
      visualPriority: 'form-first',
    },
    monitor: {
      userJob: 'acompanhar sinais e entender o estado da operacao',
      primaryActionStyle: 'ler e comparar',
      supportingSurface: 'indicadores e alertas',
      visualPriority: 'records-first',
    },
    compare: {
      userJob: 'comparar cenarios e tomar uma decisao mais segura',
      primaryActionStyle: 'analisar e decidir',
      supportingSurface: 'recortes comparativos',
      visualPriority: 'records-first',
    },
  };

  const fallbackIntent = screenTemplate === 'settings'
    ? 'configure'
    : screenTemplate === 'dashboard'
      ? 'monitor'
      : screenTemplate === 'workspace'
        ? 'review'
        : 'create';

  return map[intent] || map[fallbackIntent];
}

function getProductModeDesignProfile(productMode = 'structured-workspace', screenTemplate = 'crud') {
  const profiles = {
    'governance-console': {
      accent: 'blue',
      tone: 'controle e decisao cuidadosa',
      density: 'media',
      primarySurface: 'matriz de controle',
      secondarySurface: 'estado de governanca',
      listArchetype: 'policies',
      spatialModel: 'hero dark + matriz primaria + trilha secundaria de governanca',
      heroStyle: 'command-center',
      panelRelationship: 'controle primeiro, hist?rico depois',
      metricLabels: ['Cobertura', 'Risco', 'Governanca'],
      metricValues: ["isLoading ? 'Mapeando' : String(items.length || 0)", "isLoading ? 'Analisando' : 'Controlado'", "'Ativa'"],
      collectionMeta: "isLoading ? 'Carregando perfis' : items.length ? `${items.length} perfil(is) ativos` : 'Nenhum perfil configurado'",
      emptyStateTone: 'Nenhuma politica aplicada ainda. Defina a primeira base de controle desta area.',
    },
    'self-service-settings': {
      accent: 'teal',
      tone: 'autonomia com baixo atrito',
      density: 'baixa',
      primarySurface: 'ajuste principal',
      secondarySurface: 'estado atual da configuracao',
      listArchetype: 'preferences',
      spatialModel: 'hero leve + card de ajuste + resumo de estado',
      heroStyle: 'calm-settings',
      panelRelationship: 'ajuste principal com feedback lateral',
      metricLabels: ['Ajuste', 'Estado', 'Atualizacao'],
      metricValues: [`'${screenTemplate === 'settings' ? 'Preferencia' : 'Configuracao'}'`, "isLoading ? 'Verificando' : items.length ? 'Ativo' : 'Pendente'", "'Agora'"],
      collectionMeta: "isLoading ? 'Carregando preferencias' : items.length ? 'Preferencias ativas' : 'Defina seu primeiro ajuste'",
      emptyStateTone: 'Nenhuma preferencia registrada ainda. Ative o primeiro ajuste desta experiencia.',
    },
    'evidence-workbench': {
      accent: 'amber',
      tone: 'triagem com contexto e prova',
      density: 'media',
      primarySurface: 'envio orientado por contexto',
      secondarySurface: 'evidencias do caso',
      listArchetype: 'evidence',
      spatialModel: 'mesa de caso com evidencias em destaque e envio guiado',
      heroStyle: 'evidence-desk',
      panelRelationship: 'evidencias primeiro, captura depois',
      metricLabels: ['Fluxo', 'Anexos', 'Janela'],
      metricValues: ["isLoading ? 'Preparando envio' : 'Em andamento'", "isLoading ? '...' : String(items.length || 0)", "'Hoje'"],
      collectionMeta: "isLoading ? 'Atualizando anexos' : items.length ? `${items.length} anexo(s) enviados` : 'Nenhum anexo enviado'",
      emptyStateTone: 'Nenhum documento foi anexado ainda. Centralize aqui os comprovantes que destravam o atendimento.',
    },
    'manager-cockpit': {
      accent: 'blue',
      tone: 'leitura executiva e decisao',
      density: 'media',
      primarySurface: 'cockpit executivo',
      secondarySurface: 'recortes e sinais',
      listArchetype: 'insights',
      spatialModel: 'cockpit com hero forte, indicadores e area de leitura principal',
      heroStyle: 'executive-cockpit',
      panelRelationship: 'insights primeiro, acao secundaria depois',
      metricLabels: ['Indicadores', 'Leitura', 'Atualizacao'],
      metricValues: ["isLoading ? 'Atualizando painel' : String(items.length || 0)", "isLoading ? 'Preparando leitura' : 'Leitura pronta'", "'Agora'"],
      collectionMeta: "isLoading ? 'Atualizando painel' : `${items.length} insight(s)`",
      emptyStateTone: 'Sem recortes consolidados por enquanto. Os sinais desta area aparecem aqui conforme a operacao amadurece.',
    },
    'review-workbench': {
      accent: 'violet',
      tone: 'fila de revisao e decisao rapida',
      density: 'media',
      primarySurface: 'revisao guiada',
      secondarySurface: 'fila de itens',
      listArchetype: 'review-queue',
      spatialModel: 'bancada de revisao com fila forte e decisao lateral',
      heroStyle: 'review-desk',
      panelRelationship: 'fila primeiro, decisao depois',
      metricLabels: ['Fila', 'Pendencias', 'Decisao'],
      metricValues: ["isLoading ? '...' : String(items.length || 0)", "isLoading ? 'Preparando fila' : 'Em analise'", "'Rapida'"],
      collectionMeta: "isLoading ? 'Atualizando fila' : `${items.length} item(ns) aguardando revisao`",
      emptyStateTone: 'Nenhum item aguardando revisao agora. A fila aparece aqui quando houver algo para decidir.',
    },
    'onboarding-flow': {
      accent: 'blue',
      tone: 'progressao guiada',
      density: 'baixa',
      primarySurface: 'passo principal',
      secondarySurface: 'proximo passo',
      listArchetype: 'next-steps',
      spatialModel: 'jornada guiada com foco em proximo passo',
      heroStyle: 'guided-flow',
      panelRelationship: 'acao principal com apoio leve',
      metricLabels: ['Etapa', 'Progresso', 'Proximo'],
      metricValues: ["'Atual'", "isLoading ? 'Preparando' : 'Em andamento'", "'Continuar'"],
      collectionMeta: "isLoading ? 'Preparando' : 'Proximo passo'",
      emptyStateTone: 'Nenhuma etapa complementar por agora. Avance pela acao principal para seguir a jornada.',
    },
    'structured-workspace': {
      accent: 'teal',
      tone: 'mesa de trabalho com contexto claro',
      density: 'media',
      primarySurface: 'acao principal',
      secondarySurface: 'acompanhamento operacional',
      listArchetype: 'active-records',
      spatialModel: 'workspace operacional com acao e acompanhamento lado a lado',
      heroStyle: 'operational-workspace',
      panelRelationship: 'acao e acompanhamento equilibrados',
      metricLabels: ['Area', 'Situacao', 'Registros'],
      metricValues: [`'${screenTemplate === 'workspace' ? 'Operacao' : 'Area'}'`, "isLoading ? 'Atualizando' : 'Pronta'", "isLoading ? '...' : String(items.length || 0)"],
      collectionMeta: "isLoading ? 'Atualizando dados' : `${items.length} registro(s)`",
      emptyStateTone: 'Nenhum registro ativo ainda. Esta area fica pronta para acompanhar a operacao conforme os dados chegarem.',
    },
    'catalog-builder': {
      accent: 'teal',
      tone: 'montagem de oferta com valor percebido',
      density: 'media',
      primarySurface: 'composicao comercial',
      secondarySurface: 'itens publicados',
      listArchetype: 'catalog-items',
      spatialModel: 'builder comercial com configuracao protagonista e preview lateral',
      heroStyle: 'offer-builder',
      panelRelationship: 'montagem primeiro, preview depois',
      metricLabels: ['Oferta', 'Status', 'Publicacoes'],
      metricValues: ["'Estruturada'", "isLoading ? 'Preparando' : 'Pronta'", "isLoading ? '...' : String(items.length || 0)"],
      collectionMeta: "isLoading ? 'Atualizando catalogo' : `${items.length} item(ns) prontos`",
      emptyStateTone: 'Nenhum item publicado ainda. Monte a primeira oferta com titulo, posicionamento e valor claros.',
    },
    'curriculum-designer': {
      accent: 'blue',
      tone: 'estrutura e sequencia clara',
      density: 'media',
      primarySurface: 'sequencia principal',
      secondarySurface: 'estrutura cadastrada',
      listArchetype: 'curriculum',
      spatialModel: 'designer com sequencia, etapas e estrutura viva',
      heroStyle: 'curriculum-designer',
      panelRelationship: 'estrutura primeiro, sequencia depois',
      metricLabels: ['Estrutura', 'Sequencia', 'Blocos'],
      metricValues: ["'Guiada'", "isLoading ? 'Preparando' : 'Definida'", "isLoading ? '...' : String(items.length || 0)"],
      collectionMeta: "isLoading ? 'Preparando' : `${items.length} bloco(s) estruturado(s)`",
      emptyStateTone: 'Nenhum bloco criado ainda. Comece pela primeira etapa para dar forma a esta jornada.',
    },
    'asset-library': {
      accent: 'amber',
      tone: 'acervo util e organizado',
      density: 'media',
      primarySurface: 'cadastro do ativo',
      secondarySurface: 'biblioteca ativa',
      listArchetype: 'library',
      spatialModel: 'biblioteca operacional com acervo vivo e cadastro lateral',
      heroStyle: 'asset-library',
      panelRelationship: 'acervo primeiro, cadastro complementar',
      metricLabels: ['Acervo', 'Disponiveis', 'Acesso'],
      metricValues: ["'Organizado'", "isLoading ? '...' : String(items.length || 0)", "'Rapido'"],
      collectionMeta: "isLoading ? 'Atualizando acervo' : `${items.length} ativo(s) catalogado(s)`",
      emptyStateTone: 'Nenhum ativo registrado ainda. A biblioteca ganha valor quando os primeiros recursos entram com contexto.',
    },
    'commercial-settings': {
      accent: 'amber',
      tone: 'controle comercial com impacto no negocio',
      density: 'baixa',
      primarySurface: 'parametro comercial',
      secondarySurface: 'efeito configurado',
      listArchetype: 'commercial-state',
      spatialModel: 'configuracao comercial com impacto visivel',
      heroStyle: 'commercial-control',
      panelRelationship: 'regra principal com contexto de negocio',
      metricLabels: ['Impacto', 'Estado', 'Atualizacao'],
      metricValues: ["'Comercial'", "isLoading ? 'Verificando' : 'Configurado'", "'Agora'"],
      collectionMeta: "isLoading ? 'Carregando parametros' : items.length ? 'Configurado' : 'Defina o primeiro ajuste'",
      emptyStateTone: 'Nenhum parametro comercial configurado ainda. Defina a primeira regra que influencia o valor percebido.',
    },
    'access-gateway': {
      accent: 'violet',
      tone: 'entrada confiavel e segura',
      density: 'baixa',
      primarySurface: 'autenticacao principal',
      secondarySurface: 'estado de acesso',
      listArchetype: 'session-state',
      spatialModel: 'portal de entrada com foco em credencial e confianca',
      heroStyle: 'secure-gateway',
      panelRelationship: 'acesso principal com confianca lateral',
      metricLabels: ['Acesso', 'Status', 'Atualizacao'],
      metricValues: ["'Protegido'", "isLoading ? 'Verificando' : 'Pronto'", "'Agora'"],
      collectionMeta: "isLoading ? 'Verificando' : items.length ? 'Ativo' : 'Sem sessoes'",
      emptyStateTone: 'Nenhum acesso recente por aqui. A autenticacao aparece com mais contexto conforme a jornada for usada.',
    },
    'immersive-workspace': {
      accent: 'violet',
      tone: 'fluxo principal com foco continuo',
      density: 'media',
      primarySurface: 'experiencia central',
      secondarySurface: 'continuidade da jornada',
      listArchetype: 'continuity',
      spatialModel: 'experiencia imersiva com minimo de chrome',
      heroStyle: 'immersive-flow',
      panelRelationship: 'execucao primeiro, apoio minimo',
      metricLabels: ['Foco', 'Progresso', 'Continuidade'],
      metricValues: ["'Ativo'", "isLoading ? 'Atualizando' : 'Em curso'", "'Mantida'"],
      collectionMeta: "isLoading ? 'Atualizando acompanhamento' : `${items.length} ponto(s) acompanhados`",
      emptyStateTone: 'Nenhum ponto de continuidade por enquanto. Esta area ganha vida conforme o fluxo principal evolui.',
    },
  };

  const fallback = profiles['structured-workspace'];
  return profiles[productMode] || fallback;
}

function inferDefaultLayoutVariant(productMode = 'structured-workspace', screenTemplate = 'crud', uiIntent = 'custom') {
  if (productMode === 'manager-cockpit' || screenTemplate === 'dashboard') return 'hero-metrics';
  if (productMode === 'evidence-workbench') return 'evidence-split';
  if (productMode === 'review-workbench') return 'queue-first';
  if (productMode === 'governance-console') return 'checklist-settings';
  if (productMode === 'self-service-settings' && uiIntent === 'configure') return 'summary-first';
  if (productMode === 'self-service-settings' || screenTemplate === 'settings') return 'calm-settings';
  if (screenTemplate === 'wizard') return 'guided-stack';
  return 'balanced-split';
}

function normalizeLayoutVariant(layoutVariant, productMode = 'structured-workspace', screenTemplate = 'crud', uiIntent = 'custom') {
  const allowed = new Set([
    'balanced-split',
    'hero-metrics',
    'queue-first',
    'evidence-split',
    'calm-settings',
    'summary-first',
    'checklist-settings',
    'guided-stack',
  ]);

  const normalized = String(layoutVariant || '').trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  return inferDefaultLayoutVariant(productMode, screenTemplate, uiIntent);
}

function sanitizeUiStatesForGeneration(uiStates = {}) {
  return {
    loading: truncateText(uiStates?.loading || 'Carregando a experiencia principal da tela.', 120),
    empty: truncateText(uiStates?.empty || 'Nenhum registro disponivel ainda.', 120),
    success: truncateText(uiStates?.success || 'Operacao concluida com sucesso.', 120),
  };
}

function buildUiGenerationContext(task, technicalSpec, repairContext = null) {
  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const domainTemplate = getDomainTemplate(technicalSpec);
  const uiContract = technicalSpec?.ux?.uiContract || technicalSpec?.frontend?.uxContract || {};
  const uiInterfaceExamples = uiContract.interfaceExamples || {};
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    domainTemplate.productMode ||
    'structured-workspace';
  const uiIntent =
    technicalSpec.structured?.classification?.intent ||
    inferIntent({ domainKey: technicalSpec.featureKey }, `${task.title}\n${task.description || ''}`);
  const archetype = resolveUiArchetype({ technicalSpec, task, screenTemplate, productMode, uiIntent });
  const productDirection = getProductModeDesignProfile(productMode, screenTemplate);
  const intentDirection = getUiIntentDirection(uiIntent, screenTemplate);
  const reuseHints = buildProjectMemoryReuseHints(technicalSpec.projectMemory, technicalSpec, task.title);
  const generationIR = createGenerationIR({
    technicalSpec: {
      ...technicalSpec,
      frontend: {
        ...technicalSpec.frontend,
        productMode,
      },
      structured: {
        ...technicalSpec.structured,
        classification: {
          ...(technicalSpec.structured?.classification || {}),
          screenTemplate,
          productMode,
          intent: uiIntent,
        },
      },
    },
    domainTemplate,
    task,
  });
  const generationIRValidation = validateGenerationIR(generationIR);

  return {
    taskTitle: task.title,
    summary: technicalSpec.summary,
    frontendRoute: technicalSpec.frontend?.suggestedRoute,
    screenTemplate,
    productMode,
    uiIntent,
    pageArchetype: archetype.pageArchetype,
    fallbackPattern: archetype.fallbackPattern,
    archetypeConfidence: archetype.confidenceScore,
    alternativeArchetypes: archetype.alternativeArchetypes,
    domainSignals: archetype.domainSignals,
    intentDirection,
    productDirection: {
      tone: productDirection.tone,
      density: productDirection.density,
      primarySurface: productDirection.primarySurface,
      secondarySurface: productDirection.secondarySurface,
      listArchetype: productDirection.listArchetype,
      spatialModel: productDirection.spatialModel,
      heroStyle: productDirection.heroStyle,
      panelRelationship: productDirection.panelRelationship,
    },
    layoutVariant: normalizeLayoutVariant(
      technicalSpec.frontend?.layoutVariant,
      productMode,
      screenTemplate,
      uiIntent
    ),
    submitLabel: technicalSpec.domain?.submitLabel,
    navigationLabel: technicalSpec.frontend?.navigationLabel,
    pageTitle: technicalSpec.frontend?.pageTitle,
    pageDescription: technicalSpec.frontend?.pageDescription,
    userValue: technicalSpec.implementationObjective?.userOutcome || technicalSpec.summary,
    uiRole:
      screenTemplate === 'settings'
        ? 'configuracao'
        : screenTemplate === 'dashboard'
          ? 'acompanhamento'
          : screenTemplate === 'workspace'
            ? 'operacao guiada'
          : screenTemplate === 'wizard'
            ? 'progressao'
            : 'operacao',
    actorLabel: technicalSpec.ux?.permissions?.actor || 'usuario',
    fields: compactUiFieldsForGeneration(technicalSpec.domain?.fields),
    uiStates: sanitizeUiStatesForGeneration(technicalSpec.ux?.states),
    designReference: {
      templateKey: technicalSpec.structured?.classification?.templateKey || domainTemplate.templateKey,
      preferredAccent: productDirection.accent,
      interfaceExamples: {
        summaryItems: uniqueList([...(uiInterfaceExamples.summaryItems || []), ...(domainTemplate.settingsSummaryItems || [])]).slice(0, 3),
        promptExamples: uniqueList([...(uiInterfaceExamples.promptExamples || []), ...(domainTemplate.promptExamples || [])]).slice(0, 3),
        sectionLabels: uniqueList([...(uiInterfaceExamples.sectionLabels || []), ...(domainTemplate.sectionLabels || [])]).slice(0, 3),
        ctaLabels: uniqueList([...(uiInterfaceExamples.ctaLabels || []), ...(domainTemplate.ctaLabels || [])]).slice(0, 3),
        emptyStates: uniqueList([...(uiInterfaceExamples.emptyStates || []), ...(domainTemplate.emptyStates || [])]).slice(0, 2),
        reviewSignals: uniqueList([...(uiInterfaceExamples.reviewSignals || []), ...(domainTemplate.reviewSignals || [])]).slice(0, 3),
        helperTexts: uniqueList([...(uiInterfaceExamples.helperTexts || []), ...(domainTemplate.helperTexts || [])]).slice(0, 3),
        summaryStateTitle: uiInterfaceExamples.summaryStateTitle || domainTemplate.summaryStateTitle || null,
        summaryStateEmpty: uiInterfaceExamples.summaryStateEmpty || domainTemplate.summaryStateEmpty || null,
      },
      preferredScreenTemplate: reuseHints.preferredScreenTemplate || null,
      pageArchetype: archetype.pageArchetype,
      fallbackPattern: archetype.fallbackPattern,
      archetypeConfidence: archetype.confidenceScore,
      alternativeArchetypes: archetype.alternativeArchetypes,
      patternHints: buildPatternHints(archetype),
      domainReferences: reuseHints.domainReferences.slice(0, 2).map((item) => ({
        featureKey: item.featureKey,
        route: item.route,
        reason: item.reason,
      })),
      templateReferences: reuseHints.templateReferences.slice(0, 2).map((item) => ({
        featureKey: item.featureKey,
        route: item.route,
        reason: item.reason,
      })),
    },
    repairGoals: repairContext
      ? {
          previousIssueCodes: (repairContext.findings || []).slice(0, 4).map((item) => item.code),
          previousValidationFailures: (repairContext.validationFailures || [])
            .slice(0, 3)
            .map((item) => item.scriptName),
        }
      : null,
    generationIR,
    generationIRValidation,
  };
}

function normalizeUxInterfaceExamples(examples = {}) {
  const normalizeItems = (items = [], limit = 3) =>
    uniqueList(Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean) : []).slice(0, limit);

  return {
    summaryItems: normalizeItems(examples.summaryItems, 3),
    promptExamples: normalizeItems(examples.promptExamples, 3),
    sectionLabels: normalizeItems(examples.sectionLabels, 3),
    ctaLabels: normalizeItems(examples.ctaLabels, 3),
    emptyStates: normalizeItems(examples.emptyStates, 2),
    reviewSignals: normalizeItems(examples.reviewSignals, 3),
    helperTexts: normalizeItems(examples.helperTexts, 3),
    summaryStateTitle: String(examples.summaryStateTitle || '').trim() || null,
    summaryStateEmpty: String(examples.summaryStateEmpty || '').trim() || null,
  };
}

function normalizeUxCopyOverrides(copyOverrides = {}) {
  const keys = [
    'navigationLabel',
    'pageTitle',
    'pageDescription',
    'heroEyebrow',
    'heroTitle',
    'heroDescription',
    'formCardTitle',
    'formCardDescription',
    'recordsTitle',
    'recordsEmptyState',
    'profileSummaryTitle',
    'profileSummaryDescription',
    'asideTitle',
    'asideTone',
    'badge',
    'summaryTitle',
    'summaryTone',
    'submitLabel',
    'summaryStateTitle',
    'summaryStateEmpty',
  ];

  return Object.fromEntries(
    keys
      .map((key) => [key, String(copyOverrides?.[key] || '').trim()])
      .filter(([, value]) => Boolean(value))
  );
}

function applyUxSpecialistDraft(technicalSpec, uxDraft = null) {
  const contract = uxDraft?.uxContract || uxDraft || {};
  const copyOverrides = normalizeUxCopyOverrides(contract.copyOverrides || {});
  const interfaceExamples = normalizeUxInterfaceExamples(contract.interfaceExamples || {});
  const pageArchetype = String(contract.pageArchetype || technicalSpec.frontend?.pageArchetype || '').trim();
  const fallbackPattern = String(contract.fallbackPattern || technicalSpec.frontend?.fallbackPattern || '').trim();
  const patternHints = uniqueList([
    ...(Array.isArray(contract.patternHints) ? contract.patternHints : []),
    ...(Array.isArray(technicalSpec.frontend?.patternHints) ? technicalSpec.frontend.patternHints : []),
  ].map((item) => String(item || '').trim()));
  const uiIntent = String(contract.uiIntent || technicalSpec.frontend?.uiIntent || technicalSpec.structured?.classification?.intent || '').trim();

  return {
    ...technicalSpec,
    frontend: {
      ...technicalSpec.frontend,
      ...(copyOverrides.navigationLabel ? { navigationLabel: copyOverrides.navigationLabel } : {}),
      ...(copyOverrides.pageTitle ? { pageTitle: copyOverrides.pageTitle } : {}),
      ...(copyOverrides.pageDescription ? { pageDescription: copyOverrides.pageDescription } : {}),
      ...(copyOverrides.heroEyebrow ? { heroEyebrow: copyOverrides.heroEyebrow } : {}),
      ...(copyOverrides.heroTitle ? { heroTitle: copyOverrides.heroTitle } : {}),
      ...(copyOverrides.heroDescription ? { heroDescription: copyOverrides.heroDescription } : {}),
      ...(copyOverrides.formCardTitle ? { formCardTitle: copyOverrides.formCardTitle } : {}),
      ...(copyOverrides.formCardDescription ? { formCardDescription: copyOverrides.formCardDescription } : {}),
      ...(copyOverrides.recordsTitle ? { recordsTitle: copyOverrides.recordsTitle } : {}),
      ...(copyOverrides.recordsEmptyState ? { recordsEmptyState: copyOverrides.recordsEmptyState } : {}),
      ...(copyOverrides.profileSummaryTitle ? { profileSummaryTitle: copyOverrides.profileSummaryTitle } : {}),
      ...(copyOverrides.profileSummaryDescription ? { profileSummaryDescription: copyOverrides.profileSummaryDescription } : {}),
      ...(copyOverrides.asideTitle ? { asideTitle: copyOverrides.asideTitle } : {}),
      ...(copyOverrides.asideTone ? { asideTone: copyOverrides.asideTone } : {}),
      ...(copyOverrides.badge ? { badge: copyOverrides.badge } : {}),
      ...(copyOverrides.summaryTitle ? { summaryTitle: copyOverrides.summaryTitle } : {}),
      ...(copyOverrides.summaryTone ? { summaryTone: copyOverrides.summaryTone } : {}),
      ...(copyOverrides.submitLabel ? { submitLabel: copyOverrides.submitLabel } : {}),
      ...(pageArchetype ? { pageArchetype } : {}),
      ...(fallbackPattern ? { fallbackPattern } : {}),
      ...(patternHints.length ? { patternHints } : {}),
      ...(uiIntent ? { uiIntent } : {}),
      ...(interfaceExamples.summaryItems.length ? { highlights: interfaceExamples.summaryItems } : {}),
    },
    ux: {
      ...technicalSpec.ux,
      uiContract: {
        ...contract,
        pageArchetype: pageArchetype || contract.pageArchetype || null,
        fallbackPattern: fallbackPattern || contract.fallbackPattern || null,
        patternHints,
        uiIntent: uiIntent || contract.uiIntent || null,
        copyOverrides,
        interfaceExamples,
      },
    },
  };
}

function compactProjectMemory(projectMemory) {
  if (!projectMemory) return null;

  return {
    summary: projectMemory.summary || null,
    recurringFindings: (projectMemory.recurringFindings || []).slice(0, 4),
    highQualityReferences: (projectMemory.highQualityReferences || []).slice(0, 3),
    featurePatterns: (projectMemory.featurePatterns || []).slice(0, 5).map((item) => ({
      featureKey: item.featureKey,
      route: item.route,
      templateKey: item.templateKey,
      screenTemplate: item.screenTemplate,
      status: item.status,
      score: item.score,
    })),
  };
}

function buildAutonomousCurrentFileRegistry(currentImplementationContext = {}) {
  const featureKey = currentImplementationContext?.featureKey || 'feature';
  const frontendFiles = currentImplementationContext?.frontend?.files || {};
  const frontendSources = currentImplementationContext?.frontend?.fileSources || {};
  const backendFiles = currentImplementationContext?.backend?.files || {};
  const backendSources = currentImplementationContext?.backend?.fileSources || {};

  return [
    {
      layer: 'frontend',
      fileKey: 'frontend.pageTsxTemplate',
      relativePath: `apps/web/src/features/${featureKey}/page.tsx`,
      hasContent: Boolean(frontendFiles.pageTsxTemplate),
      source: frontendSources.pageTsxTemplate || null,
    },
    {
      layer: 'frontend',
      fileKey: 'frontend.serviceTsTemplate',
      relativePath: `apps/web/src/features/${featureKey}/service.ts`,
      hasContent: Boolean(frontendFiles.serviceTsTemplate),
      source: frontendSources.serviceTsTemplate || null,
    },
    {
      layer: 'frontend',
      fileKey: 'frontend.indexTsTemplate',
      relativePath: `apps/web/src/features/${featureKey}/index.ts`,
      hasContent: Boolean(frontendFiles.indexTsTemplate),
      source: frontendSources.indexTsTemplate || null,
    },
    {
      layer: 'backend',
      fileKey: 'backend.serviceTsTemplate',
      relativePath: `apps/api/src/modules/${featureKey}/service.ts`,
      hasContent: Boolean(backendFiles.serviceTsTemplate),
      source: backendSources.serviceTsTemplate || null,
    },
    {
      layer: 'backend',
      fileKey: 'backend.routerTsTemplate',
      relativePath: `apps/api/src/modules/${featureKey}/router.ts`,
      hasContent: Boolean(backendFiles.routerTsTemplate),
      source: backendSources.routerTsTemplate || null,
    },
    {
      layer: 'backend',
      fileKey: 'backend.indexTsTemplate',
      relativePath: `apps/api/src/modules/${featureKey}/index.ts`,
      hasContent: Boolean(backendFiles.indexTsTemplate),
      source: backendSources.indexTsTemplate || null,
    },
  ].filter((entry) => entry.hasContent || entry.source);
}

function signalMatchesRegistryPath(signalPath = '', relativePath = '') {
  const normalizedSignal = String(signalPath || '').replace(/\\/g, '/').toLowerCase();
  const normalizedRelative = String(relativePath || '').replace(/\\/g, '/').toLowerCase();

  if (!normalizedSignal || !normalizedRelative) {
    return false;
  }

  return (
    normalizedSignal === normalizedRelative ||
    normalizedSignal.endsWith(normalizedRelative) ||
    normalizedRelative.endsWith(normalizedSignal)
  );
}

function inferRepairExecutionFocus(repairContext = {}, currentImplementationContext = {}) {
  const registry = buildAutonomousCurrentFileRegistry(currentImplementationContext);
  const findings = [...(repairContext.findings || []), ...(repairContext.specialistFindings || [])];
  const validationFailures = repairContext.validationFailures || [];
  const debugDiagnosis = repairContext.debugDiagnosis || null;
  const focusEntries = new Map();
  let matchedExactFile = false;

  const addFocusEntry = (entry, reason) => {
    if (!entry) return;

    const existing = focusEntries.get(entry.fileKey);
    if (existing) {
      if (reason && !existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
      return;
    }

    focusEntries.set(entry.fileKey, {
      layer: entry.layer,
      fileKey: entry.fileKey,
      relativePath: entry.relativePath,
      source: entry.source || null,
      reasons: reason ? [reason] : [],
    });
  };

  const addLayerEntries = (layer, reason) => {
    registry.filter((entry) => entry.layer === layer).forEach((entry) => addFocusEntry(entry, reason));
  };

  for (const item of findings) {
    const filePath = item.filePath || '';
    const exactMatches = registry.filter((entry) => signalMatchesRegistryPath(filePath, entry.relativePath));

    if (exactMatches.length) {
      matchedExactFile = true;
      exactMatches.forEach((entry) => addFocusEntry(entry, item.code || item.message || 'review_finding'));
      continue;
    }

    const normalizedSignal = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    if (normalizedSignal.includes('apps/web/')) {
      addLayerEntries('frontend', item.code || 'frontend_review');
    }
    if (normalizedSignal.includes('apps/api/')) {
      addLayerEntries('backend', item.code || 'backend_review');
    }
  }

  for (const affectedFile of debugDiagnosis?.affectedFiles || []) {
    const exactMatches = registry.filter((entry) => signalMatchesRegistryPath(affectedFile, entry.relativePath));

    if (exactMatches.length) {
      matchedExactFile = true;
      exactMatches.forEach((entry) => addFocusEntry(entry, debugDiagnosis.rootCause || 'debug_diagnosis'));
      continue;
    }

    const normalizedSignal = String(affectedFile || '').replace(/\\/g, '/').toLowerCase();
    if (normalizedSignal.includes('apps/web/')) {
      addLayerEntries('frontend', debugDiagnosis.rootCause || 'debug_diagnosis_frontend');
    }
    if (normalizedSignal.includes('apps/api/')) {
      addLayerEntries('backend', debugDiagnosis.rootCause || 'debug_diagnosis_backend');
    }
    if (normalizedSignal.includes('packages/shared/')) {
      addLayerEntries('shared', debugDiagnosis.rootCause || 'debug_diagnosis_shared');
    }
    if (normalizedSignal.includes('prisma/')) {
      addLayerEntries('database', debugDiagnosis.rootCause || 'debug_diagnosis_database');
    }
  }

  for (const failure of validationFailures) {
    const signal = `${failure.scriptName || ''} ${failure.errorMessage || ''}`.toLowerCase();
    if (signal.includes('build:web') || signal.includes('lint')) {
      addLayerEntries('frontend', failure.scriptName || 'validation_frontend');
    }
    if (signal.includes('build:api')) {
      addLayerEntries('backend', failure.scriptName || 'validation_backend');
    }
    if (signal.includes('test')) {
      addLayerEntries('frontend', failure.scriptName || 'validation_test');
      addLayerEntries('backend', failure.scriptName || 'validation_test');
    }
  }

  if (!focusEntries.size && repairContext.repairScope?.needsFrontend) {
    addLayerEntries('frontend', 'repair_scope_frontend');
  }
  if (!focusEntries.size && repairContext.repairScope?.needsBackend) {
    addLayerEntries('backend', 'repair_scope_backend');
  }

  const focusFiles = Array.from(focusEntries.values());
  const preserveFiles = registry
    .filter((entry) => entry.hasContent && !focusEntries.has(entry.fileKey))
    .map((entry) => ({
      layer: entry.layer,
      fileKey: entry.fileKey,
      relativePath: entry.relativePath,
      source: entry.source || null,
    }));

  const touchedLayers = [...new Set(focusFiles.map((item) => item.layer))];
  const primaryFailureSurface = touchedLayers.length === 1
    ? touchedLayers[0]
    : touchedLayers.length > 1
      ? 'cross_surface'
      : repairContext.repairScope?.needsFrontend && !repairContext.repairScope?.needsBackend
        ? 'frontend'
        : repairContext.repairScope?.needsBackend && !repairContext.repairScope?.needsFrontend
          ? 'backend'
          : 'unknown';

  const locality = matchedExactFile && focusFiles.length <= 2
    ? 'local_patch'
    : touchedLayers.length > 1
      ? 'cross_surface'
      : focusFiles.length
        ? 'layer_scoped'
        : 'fallback_scope';

  return {
    primaryFailureSurface,
    locality,
    writeSet: {
      mode: locality,
      fileKeys: focusFiles.map((item) => item.fileKey),
    },
    focusFiles,
    preserveFiles,
  };
}

function compactRepairContext(repairContext, currentImplementationContext = null) {
  if (!repairContext) return null;

  const executionFocus = inferRepairExecutionFocus(repairContext, currentImplementationContext);

  return {
    attemptNumber: repairContext.attemptNumber,
    reviewStatus: repairContext.reviewStatus,
    reviewScore: repairContext.reviewScore,
    specialistReviewStatus: repairContext.specialistReviewStatus,
    specialistReviewScore: repairContext.specialistReviewScore,
    generationSource: repairContext.generationSource,
    repairStyle: repairContext.repairStyle,
    repairScope: repairContext.repairScope
      ? {
          needsFrontend: Boolean(repairContext.repairScope.needsFrontend),
          needsBackend: Boolean(repairContext.repairScope.needsBackend),
          needsShared: Boolean(repairContext.repairScope.needsShared),
          workstreamIds: Array.isArray(repairContext.repairScope.workstreamIds)
            ? repairContext.repairScope.workstreamIds
            : [],
        }
      : null,
    materialization: repairContext.materialization
      ? {
          generationSource: repairContext.materialization.generationSource || null,
          llmFileCount: repairContext.materialization.llmFileCount ?? null,
          fallbackFileCount: repairContext.materialization.fallbackFileCount ?? null,
        }
      : null,
    executionFocus,
    debugDiagnosis: repairContext.debugDiagnosis
      ? {
          rootCause: repairContext.debugDiagnosis.rootCause || null,
          suggestedFix: truncateText(repairContext.debugDiagnosis.suggestedFix, 220),
          affectedFiles: Array.isArray(repairContext.debugDiagnosis.affectedFiles)
            ? repairContext.debugDiagnosis.affectedFiles.slice(0, 6)
            : [],
          source: repairContext.debugDiagnosis.source || null,
        }
      : null,
    enforcementDirective: repairContext.enforcementDirective
      ? {
          reason: repairContext.enforcementDirective.reason || null,
          nextRepairStyle: repairContext.enforcementDirective.nextRepairStyle || null,
          nextExecutor: repairContext.enforcementDirective.nextExecutor || null,
          triggeredBy: repairContext.enforcementDirective.triggeredBy || null,
        }
      : null,
    adaptiveDirective: repairContext.adaptiveDirective
      ? {
          source: repairContext.adaptiveDirective.source || null,
          reason: repairContext.adaptiveDirective.reason || null,
          nextRepairStyle: repairContext.adaptiveDirective.nextRepairStyle || null,
          nextExecutor: repairContext.adaptiveDirective.nextExecutor || null,
          confidence: repairContext.adaptiveDirective.confidence || null,
          stats: repairContext.adaptiveDirective.stats || null,
        }
      : null,
    repairLearning: repairContext.repairLearning
      ? {
          totalSamples: repairContext.repairLearning.totalSamples ?? 0,
          relevantSamples: repairContext.repairLearning.relevantSamples ?? 0,
          defaultExecutor: repairContext.repairLearning.defaultExecutor || null,
          recentProjectBehavior: repairContext.repairLearning.recentProjectBehavior || null,
          relevantBehavior: repairContext.repairLearning.relevantBehavior || null,
          executorPerformance: Array.isArray(repairContext.repairLearning.executorPerformance)
            ? repairContext.repairLearning.executorPerformance.slice(0, 4)
            : [],
        }
      : null,
    findings: (repairContext.findings || []).slice(0, 4).map((item) => ({
      code: item.code,
      severity: item.severity,
      filePath: item.filePath,
      message: truncateText(item.message, 160),
      suggestedFix: item.suggestedFix ? truncateText(item.suggestedFix, 180) : null,
    })),
    specialistFindings: (repairContext.specialistFindings || []).slice(0, 4).map((item) => ({
      code: item.code,
      severity: item.severity,
      filePath: item.filePath,
      message: truncateText(item.message, 160),
    })),
    validationFailures: (repairContext.validationFailures || []).slice(0, 3).map((item) => ({
      scriptName: item.scriptName,
      errorMessage: truncateText(item.errorMessage, 180),
    })),
  };
}

function formatValidationFailures(summary) {
  if (!summary?.reports?.length) return [];

  return summary.reports
    .filter((report) => report.status !== 'completed')
    .map((report) => ({
      scriptName: report.scriptName,
      errorMessage: truncateText(report.errorMessage || report.stderr || report.stdout || 'Falha sem detalhes.'),
    }));
}

function deriveRepairAllowedSupportPaths(repairContext = {}) {
  const workstreamIds = Array.isArray(repairContext?.repairScope?.workstreamIds)
    ? repairContext.repairScope.workstreamIds
    : [];
  const allowedPaths = new Set();

  if (workstreamIds.includes('frontend_feature')) {
    allowedPaths.add('apps/web/src/App.tsx');
  }

  if (workstreamIds.includes('backend_module')) {
    allowedPaths.add('apps/api/src/server.ts');
  }

  return Array.from(allowedPaths);
}

function resolveRepairMaterializationPaths(repairContext = {}) {
  const mode = repairContext?.executionFocus?.writeSet?.mode || null;
  const focusFiles = Array.isArray(repairContext?.executionFocus?.focusFiles)
    ? repairContext.executionFocus.focusFiles
        .map((item) => String(item?.relativePath || '').replace(/\\/g, '/'))
        .filter(Boolean)
    : [];

  if (mode !== 'local_patch' || !focusFiles.length) {
    return null;
  }

  return Array.from(new Set([...focusFiles, ...deriveRepairAllowedSupportPaths(repairContext)]));
}

function resolveRepairEnforcementDirective(repairContext, repairScopeAssessment) {
  const mode = repairScopeAssessment?.mode || repairContext?.executionFocus?.writeSet?.mode || 'unknown';
  const status = repairScopeAssessment?.status || 'unscoped';

  if (mode === 'local_patch' && ['expanded', 'partial'].includes(status)) {
    return {
      triggeredBy: 'write_set_violation',
      reason: `O repair prometeu local_patch, mas tocou arquivos fora do write set (${status}).`,
      nextRepairStyle: 'reconstructive',
      nextExecutor: 'implementation_autonomous_agent',
    };
  }

  return null;
}

function inferFailureSurfaceFromRootCause(rootCause = '') {
  const normalized = String(rootCause || '').toLowerCase();

  if (!normalized) return 'unknown';
  if (normalized.includes('missing_shared_design_system_usage')) return 'frontend';
  if (normalized.includes('prisma') || normalized.includes('schema')) return 'database';
  if (normalized.includes('frontend') || normalized.includes('route_registration')) return 'frontend';
  if (normalized.includes('api_route') || normalized.includes('backend')) return 'backend';
  return 'unknown';
}

function resolveRepairExecutorByFailureSignature(repairContext = {}) {
  const rootCause = String(repairContext?.debugDiagnosis?.rootCause || '').toLowerCase();
  const primaryFailureSurface = String(repairContext?.executionFocus?.primaryFailureSurface || '').toLowerCase();

  if (
    rootCause.includes('prisma') ||
    rootCause.includes('schema') ||
    rootCause === 'missing_prisma_client_dependency'
  ) {
    return 'sub_agent_pipeline';
  }

  if (
    rootCause.includes('missing_shared_design_system_usage') ||
    rootCause.includes('frontend') ||
    rootCause.includes('route_registration') && primaryFailureSurface === 'frontend' ||
    primaryFailureSurface === 'frontend'
  ) {
    return 'frontend_agent';
  }

  if (
    rootCause.includes('api_route') ||
    rootCause.includes('backend') ||
    primaryFailureSurface === 'backend'
  ) {
    return 'backend_agent';
  }

  return 'implementation_autonomous_agent';
}

async function loadRecentRepairLearningSignals(projectId, repairContext, currentImplementationId = null) {
  if (!projectId) return null;

  const recentImplementations = await prisma.taskImplementation.findMany({
    where: {
      ...(currentImplementationId ? { id: { not: currentImplementationId } } : {}),
      task: {
        projectId,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!recentImplementations.length) {
    return {
      totalSamples: 0,
      relevantSamples: 0,
      defaultExecutor: resolveRepairExecutorByFailureSignature(repairContext),
      recentProjectBehavior: null,
      relevantBehavior: null,
      executorPerformance: [],
    };
  }

  const implementationIds = recentImplementations.map((item) => item.id);
  const repairArtifacts = await prisma.taskArtifact.findMany({
    where: {
      taskImplementationId: { in: implementationIds },
      artifactScope: 'implementation',
      isCurrent: true,
      OR: [
        { title: { startsWith: 'Implementation Repair Scope Assessment - ' } },
        { title: { startsWith: 'Implementation Repair Enforcement - ' } },
        { title: { startsWith: 'Implementation Debug Diagnosis - ' } },
        { title: { startsWith: 'Implementation Repair Draft - ' } },
        { title: { startsWith: 'Autonomous Implementation Repair Draft - ' } },
      ],
    },
    select: {
      taskImplementationId: true,
      title: true,
      content: true,
      createdByAgentName: true,
    },
  });

  const artifactsByImplementation = repairArtifacts.reduce((acc, artifact) => {
    const current = acc.get(artifact.taskImplementationId) || {};
    if (artifact.title.startsWith('Implementation Repair Scope Assessment - ')) {
      current.scopeAssessment = parseJsonArtifactContent(artifact)?.scopeAssessment || null;
    }
    if (artifact.title.startsWith('Implementation Repair Enforcement - ')) {
      current.enforcement = parseJsonArtifactContent(artifact)?.enforcementDirective || null;
    }
    if (artifact.title.startsWith('Implementation Debug Diagnosis - ')) {
      current.debugDiagnosis = parseJsonArtifactContent(artifact)?.diagnosis || null;
    }
    if (
      artifact.title.startsWith('Implementation Repair Draft - ') ||
      artifact.title.startsWith('Autonomous Implementation Repair Draft - ')
    ) {
      current.executor = artifact.createdByAgentName || null;
    }
    acc.set(artifact.taskImplementationId, current);
    return acc;
  }, new Map());

  const targetRootCause = String(repairContext?.debugDiagnosis?.rootCause || '').trim();
  const targetSurface = String(repairContext?.executionFocus?.primaryFailureSurface || '').trim() || inferFailureSurfaceFromRootCause(targetRootCause);
  const defaultExecutor = resolveRepairExecutorByFailureSignature(repairContext);

  const events = recentImplementations
    .map((implementation) => {
      const artifacts = artifactsByImplementation.get(implementation.id) || {};
      const rootCause = artifacts.debugDiagnosis?.rootCause || null;
      const failureSurface = inferFailureSurfaceFromRootCause(rootCause);
      const writeSetStatus = artifacts.scopeAssessment?.status || 'unknown';
      const executor = artifacts.executor || 'implementation_autonomous_agent';
      return {
        implementationId: implementation.id,
        status: implementation.status,
        executor,
        rootCause,
        failureSurface,
        writeSetStatus,
        escalated: Boolean(artifacts.enforcement),
        success: implementation.status === 'integrated',
        localSuccess: implementation.status === 'integrated' && writeSetStatus === 'compliant',
      };
    })
    .filter((item) => item.rootCause || item.writeSetStatus !== 'unknown');

  const relevantEvents = events.filter((item) => {
    if (targetRootCause && item.rootCause === targetRootCause) return true;
    if (targetSurface && targetSurface !== 'unknown' && item.failureSurface === targetSurface) return true;
    return false;
  });

  const summarizeEventSet = (items) => ({
    samples: items.length,
    compliantRatePercent: items.length ? Math.round((items.filter((item) => item.writeSetStatus === 'compliant').length / items.length) * 100) : null,
    expandedRatePercent: items.length ? Math.round((items.filter((item) => item.writeSetStatus === 'expanded').length / items.length) * 100) : null,
    escalatedRatePercent: items.length ? Math.round((items.filter((item) => item.escalated).length / items.length) * 100) : null,
    localSuccessRatePercent: items.length ? Math.round((items.filter((item) => item.localSuccess).length / items.length) * 100) : null,
  });

  const executorPerformance = Object.values(
    relevantEvents.reduce((acc, item) => {
      const current = acc[item.executor] || {
        executor: item.executor,
        samples: 0,
        compliant: 0,
        localSuccess: 0,
        escalated: 0,
      };
      current.samples += 1;
      current.compliant += item.writeSetStatus === 'compliant' ? 1 : 0;
      current.localSuccess += item.localSuccess ? 1 : 0;
      current.escalated += item.escalated ? 1 : 0;
      acc[item.executor] = current;
      return acc;
    }, {})
  )
    .map((item) => ({
      ...item,
      compliantRatePercent: item.samples ? Math.round((item.compliant / item.samples) * 100) : 0,
      localSuccessRatePercent: item.samples ? Math.round((item.localSuccess / item.samples) * 100) : 0,
      escalatedRatePercent: item.samples ? Math.round((item.escalated / item.samples) * 100) : 0,
    }))
    .sort((left, right) => {
      if (right.localSuccessRatePercent !== left.localSuccessRatePercent) {
        return right.localSuccessRatePercent - left.localSuccessRatePercent;
      }
      return right.samples - left.samples;
    });

  return {
    totalSamples: events.length,
    relevantSamples: relevantEvents.length,
    defaultExecutor,
    recentProjectBehavior: summarizeEventSet(events),
    relevantBehavior: summarizeEventSet(relevantEvents),
    executorPerformance,
  };
}

function resolveAdaptiveRepairDirective(repairContext, learningSignals = null) {
  if (!learningSignals) return null;

  const mode = repairContext?.executionFocus?.writeSet?.mode || 'unknown';
  const defaultExecutor = learningSignals.defaultExecutor || resolveRepairExecutorByFailureSignature(repairContext);
  const relevantBehavior = learningSignals.relevantBehavior || {};
  const recentProjectBehavior = learningSignals.recentProjectBehavior || {};
  const bestExecutor = learningSignals.executorPerformance?.find((item) => item.samples >= 2) || null;

  const directive = {
    source: 'adaptive_learning',
    reason: null,
    nextRepairStyle: null,
    nextExecutor: null,
    confidence: null,
    stats: {
      relevantSamples: learningSignals.relevantSamples || 0,
      projectSamples: learningSignals.totalSamples || 0,
      relevantCompliantRatePercent: relevantBehavior.compliantRatePercent ?? null,
      relevantExpandedRatePercent: relevantBehavior.expandedRatePercent ?? null,
      relevantLocalSuccessRatePercent: relevantBehavior.localSuccessRatePercent ?? null,
      projectCompliantRatePercent: recentProjectBehavior.compliantRatePercent ?? null,
      projectEscalatedRatePercent: recentProjectBehavior.escalatedRatePercent ?? null,
    },
  };

  if (
    mode === 'local_patch' &&
    (
      (learningSignals.relevantSamples >= 2 && (relevantBehavior.expandedRatePercent || 0) >= 50) ||
      (learningSignals.totalSamples >= 4 && (recentProjectBehavior.compliantRatePercent || 0) <= 35)
    )
  ) {
    directive.nextRepairStyle = 'reconstructive';
    directive.reason = 'O historico recente mostra baixa aderencia para patch local nesta categoria.';
    directive.confidence = learningSignals.relevantSamples >= 2 ? 'high' : 'medium';
  }

  if (
    bestExecutor &&
    bestExecutor.executor !== defaultExecutor &&
    bestExecutor.localSuccessRatePercent >= 60 &&
    bestExecutor.samples >= 2
  ) {
    const defaultExecutorStats = learningSignals.executorPerformance?.find((item) => item.executor === defaultExecutor) || null;
    const defaultSuccessRate = defaultExecutorStats?.localSuccessRatePercent ?? 0;

    if (bestExecutor.localSuccessRatePercent >= defaultSuccessRate + 20 || !defaultExecutorStats) {
      directive.nextExecutor = bestExecutor.executor;
      directive.reason = directive.reason
        ? `${directive.reason} Executor historicamente melhor encontrado para esta categoria.`
        : 'Historico recente aponta um executor mais eficaz para esta categoria de erro.';
      directive.confidence = directive.confidence || 'medium';
    }
  }

  return directive.nextExecutor || directive.nextRepairStyle ? directive : null;
}

function normalizeSemanticText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferFeatureDomainKey(spec = {}) {
  return (
    spec?.structured?.classification?.domain ||
    spec?.featureKey ||
    spec?.backend?.routeBase ||
    'generic'
  );
}

function buildProjectMemoryReuseHints(projectMemory, technicalSpec, taskTitle = '') {
  if (!projectMemory) {
    return {
      preferredScreenTemplate: null,
      domainReferences: [],
      templateReferences: [],
      recurringAntiPatterns: [],
    };
  }

  const domainKey = inferFeatureDomainKey(technicalSpec);
  const screenTemplate = technicalSpec?.architecture?.screenTemplate || technicalSpec?.structured?.classification?.screenTemplate || null;
  const taskSignals = extractSemanticSignals(taskTitle, technicalSpec?.featureKey, technicalSpec?.backend?.routeBase)
    .map((item) => item.group);

  const rankedPatterns = (projectMemory.featurePatterns || [])
    .filter((item) => item.featureKey !== technicalSpec?.featureKey)
    .map((item) => {
      let score = 0;
      if (item.domainKey === domainKey) score += 5;
      if (screenTemplate && item.screenTemplate === screenTemplate) score += 3;
      if (item.status === 'integrated') score += 2;
      if ((item.score || 0) >= 90) score += 2;
      if (taskSignals.some((signal) => (item.semanticGroups || []).includes(signal))) score += 2;
      return { ...item, matchScore: score };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || (b.score || 0) - (a.score || 0));

  const domainReferences = rankedPatterns.slice(0, 3).map((item) => ({
    featureKey: item.featureKey,
    route: item.route,
    screenTemplate: item.screenTemplate,
    score: item.score,
    reason: item.domainKey === domainKey ? 'Mesmo domínio funcional' : 'Semântica próxima',
  }));

  const templateReferences = rankedPatterns
    .filter((item) => item.screenTemplate === screenTemplate)
    .slice(0, 3)
    .map((item) => ({
      featureKey: item.featureKey,
      route: item.route,
      score: item.score,
      reason: 'Mesmo template visual',
    }));

  return {
    preferredScreenTemplate: projectMemory.summary?.preferredScreenTemplate || null,
    domainReferences,
    templateReferences,
    recurringAntiPatterns: (projectMemory.recurringFindings || []).slice(0, 4),
  };
}

function extractSemanticSignals(taskTitle = '', featureKey = '', routeBase = '') {
  const title = normalizeSemanticText(taskTitle);
  const feature = normalizeSemanticText(featureKey);
  const route = normalizeSemanticText(routeBase);
  const containsAlias = (source, alias) => {
    const normalizedAlias = normalizeSemanticText(alias);
    if (!normalizedAlias) return false;
    const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\b)${escapedAlias}(\\b|$)`).test(source);
  };

  const signals = [
    { group: 'support', aliases: ['suporte', 'support', 'chamado', 'ticket', 'atendimento'] },
    { group: 'attachment', aliases: ['anexo', 'anexar', 'arquivo', 'documento', 'comprovante', 'fiscal', 'attachment', 'attachments'] },
    { group: 'course', aliases: ['curso', 'courses', 'course'] },
    { group: 'module', aliases: ['modulo', 'modulos', 'modules', 'module'] },
    { group: 'lesson', aliases: ['aula', 'aulas', 'lessons', 'lesson'] },
    { group: 'material', aliases: ['material', 'materiais', 'pdf', 'video', 'audio'] },
    { group: 'access-control', aliases: ['permissao', 'permissoes', 'acesso', 'role', 'roles', 'funcao', 'perfil de acesso'] },
    { group: 'notification', aliases: ['notificacao', 'notificacoes', 'notificar', 'notification', 'notifications'] },
    { group: 'search', aliases: ['buscar', 'busca', 'search', 'pesquisa'] },
    { group: 'pricing', aliases: ['preco', 'valor', 'pricing', 'pagamento'] },
    { group: 'enrollment', aliases: ['inscricao', 'matricula', 'enrollment'] },
    { group: 'profile', aliases: ['perfil', 'profile'] },
    { group: 'auth', aliases: ['conta', 'login', 'autenticacao', 'signin', 'signup'] },
  ];

  return signals
    .filter((signal) => signal.aliases.some((alias) => containsAlias(title, alias)))
    .map((signal) => ({
      group: signal.group,
      matchedInFeature: signal.aliases.some((alias) => containsAlias(feature, alias) || containsAlias(route, alias)),
    }));
}

function getExpectedDomainKeywords(domainKey = '') {
  const catalog = {
    events: ['evento', 'eventos', 'operacao', 'operacional', 'planejamento', 'execucao'],
    'event-schedules': ['evento', 'eventos', 'cronograma', 'etapa', 'etapas', 'prazo', 'prazos', 'planejamento', 'execucao'],
    'event-suppliers': ['evento', 'eventos', 'fornecedor', 'fornecedores', 'prestador', 'parceiro', 'categoria', 'servico', 'contato'],
    'visit-operational-responsibles': [
      'visita',
      'visitas',
      'recepcao',
      'responsavel operacional',
      'responsavel',
      'contato',
      'tipo de suporte',
      'suporte',
      'operacional',
    ],
    'visit-recurring-history': [
      'visita',
      'visitas',
      'historico',
      'cliente',
      'recorrente',
      'agendamento',
      'cpf',
      'cnpj',
      'identificador',
      'anfitriao',
    ],
    'visit-intake': [
      'visita',
      'visitas',
      'criar',
      'abertura',
      'nova visita',
      'dados da visita',
      'nome',
      'objetivo',
      'data',
      'contexto inicial',
      'recepcao',
      'fluxo principal',
      'triagem',
    ],
    'visit-extra-companions': [
      'visita',
      'visitas',
      'acompanhante',
      'acompanhantes',
      'extra',
      'extras',
      'consultor',
      'seguranca',
      'aprovada',
      'aprovacao rapida',
      'anfitriao',
    ],
    'visit-approval-cutoff-settings': [
      'visita',
      'visitas',
      'horario',
      'horarios',
      'limite',
      'aprovacao',
      'dia util',
      'gestor administrativo',
      'analise',
    ],
    'support-ticket-attachments': ['support', 'suporte', 'ticket', 'chamado', 'attachment', 'attachments', 'anexo', 'arquivo', 'documento', 'comprovante', 'fiscal'],
    'access-control': ['access', 'acesso', 'permission', 'permissao', 'role', 'funcao', 'perfil'],
    'ticket-notification-preferences': ['notification', 'notificacao', 'email', 'alerta', 'ticket', 'chamado'],
    'course-catalog': ['course', 'courses', 'curso'],
    'course-modules': ['module', 'modules', 'modulo'],
    'course-lessons': ['lesson', 'lessons', 'aula'],
    'lesson-materials': ['material', 'materials', 'arquivo', 'anexo'],
    'course-pricing': ['pricing', 'preco', 'valor', 'price'],
    'course-search': ['search', 'busca', 'pesquisa', 'catalog'],
    'course-enrollment': ['enrollment', 'enrollments', 'matricula', 'inscricao'],
    'course-player': ['player', 'lesson', 'video', 'audio'],
    'access-control-roles': ['access', 'acesso', 'permission', 'permissao', 'perfil', 'role', 'funcao'],
    'profile-settings': ['profile', 'perfil'],
    'auth-login': ['login', 'auth', 'signin'],
    'auth-register': ['register', 'signup', 'cadastro'],
  };

  return catalog[domainKey] || [];
}

function detectDomainMismatch(taskTitle = '', domainKey = '', featureKey = '', routeBase = '', docsContent = '') {
  const expectedKeywords = getExpectedDomainKeywords(domainKey);
  if (!expectedKeywords.length) return null;

  const sources = [
    normalizeSemanticText(featureKey),
    normalizeSemanticText(routeBase),
    normalizeSemanticText(docsContent),
  ];

  const matchedKeywords = expectedKeywords.filter((keyword) =>
    sources.some((source) => source.includes(normalizeSemanticText(keyword)))
  );

  if (matchedKeywords.length) return null;

  return {
    severity: 'high',
    code: 'specialist_expected_domain_missing',
    category: 'semantic',
    message: `A implementacao nao preservou os sinais principais do dominio ${domainKey} esperado para a task: ${taskTitle}.`,
  };
}

function inferImplementedDomain(featureKey = '', routeBase = '') {
  const normalizedFeatureKey = normalizeSemanticText(featureKey);
  const normalizedRouteBase = normalizeSemanticText(routeBase);
  const source = `${normalizedFeatureKey} ${normalizedRouteBase}`;
  const candidates = [
    'event-schedules',
    'event-suppliers',
    'visit-operational-responsibles',
    'visit-recurring-history',
    'visit-extra-companions',
    'visit-approval-cutoff-settings',
    'support-ticket-attachments',
    'ticket-notification-preferences',
    'access-control',
    'course-catalog',
    'course-modules',
    'course-lessons',
    'lesson-materials',
    'course-pricing',
    'course-search',
    'course-enrollment',
    'course-player',
    'access-control-roles',
    'profile-settings',
    'auth-login',
    'auth-register',
  ];

  let bestCandidate = 'custom';
  let bestScore = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSemanticText(candidate);
    const keywords = getExpectedDomainKeywords(candidate);
    let score = 0;

    if (normalizedFeatureKey.includes(normalizedCandidate)) score += 12;
    if (normalizedRouteBase.includes(normalizedCandidate)) score += 8;

    const routeSlug = normalizedRouteBase.split('/').filter(Boolean).pop() || '';
    const candidateTail = normalizedCandidate.split('-').pop() || '';
    if (routeSlug && candidateTail && routeSlug.includes(candidateTail)) score += 4;

    for (const keyword of keywords) {
      const normalizedKeyword = normalizeSemanticText(keyword);
      if (!normalizedKeyword) continue;
      if (source.includes(normalizedKeyword)) score += 2;
      if (normalizedFeatureKey.includes(normalizedKeyword)) score += 1;
      if (normalizedRouteBase.includes(normalizedKeyword)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestScore > 0 ? bestCandidate : 'custom';
}

function areDomainKeysAligned(expectedDomain = '', implementedDomain = '') {
  const expected = normalizeSemanticText(expectedDomain);
  const implemented = normalizeSemanticText(implementedDomain);
  const toStem = (value) => String(value || '').replace(/s$/, '');

  if (!expected || !implemented || expected === implemented) {
    return Boolean(expected) && Boolean(implemented) ? expected === implemented : false;
  }

  const expectedBase = expected.split(/[-_/]/)[0];
  const implementedBase = implemented.split(/[-_/]/)[0];
  if (expectedBase && implementedBase && (expectedBase === implementedBase || toStem(expectedBase) === toStem(implementedBase))) {
    return true;
  }

  const expectedKeywords = new Set([
    expected,
    expectedBase,
    ...getExpectedDomainKeywords(expected),
  ].map((item) => normalizeSemanticText(item)).filter(Boolean));
  const implementedKeywords = new Set([
    implemented,
    implementedBase,
    ...getExpectedDomainKeywords(implemented),
  ].map((item) => normalizeSemanticText(item)).filter(Boolean));

  for (const keyword of expectedKeywords) {
    if (implementedKeywords.has(keyword) || implementedKeywords.has(toStem(keyword))) return true;
  }

  return false;
}

function buildTraceabilitySummary(task, implementation, technicalSpecContent, expectedDomain, implementedDomain) {
  const generatedFiles = implementation?.generatedFiles || [];
  const routeBase = technicalSpecContent?.backend?.routeBase || '';
  const featurePath = technicalSpecContent?.frontend?.featurePath || '';
  const contractPath = technicalSpecContent?.shared?.contractPath || '';
  const docsPath = technicalSpecContent?.featureKey ? `docs/implementations/${technicalSpecContent.featureKey}.md` : '';

  const filePaths = generatedFiles.map((file) => String(file.filePath || '').replace(/\\/g, '/'));
  const hasFrontendPage = featurePath ? filePaths.some((item) => item.includes(`${featurePath}/page.tsx`)) : false;
  const hasFrontendService = featurePath ? filePaths.some((item) => item.includes(`${featurePath}/service.ts`)) : false;
  const hasSharedContract = contractPath ? filePaths.some((item) => item.includes(contractPath.replace(/\\/g, '/'))) : false;
  const hasDocumentation = docsPath ? filePaths.some((item) => item.includes(docsPath)) : false;
  const routeSlug = routeBase.split('/').filter(Boolean).pop() || '';
  const routeRepresentedInFiles = routeSlug ? filePaths.some((item) => item.includes(routeSlug)) : false;
  const taskTerms = normalizeSemanticText(task?.title || '')
    .split(/[^a-z0-9]+/)
    .filter((item) => item.length >= 5)
    .slice(0, 6);
  const taskTermsMatched = taskTerms.filter((term) =>
    filePaths.some((item) => normalizeSemanticText(item).includes(term))
  );

  const checks = [
    hasFrontendPage,
    hasFrontendService,
    hasSharedContract,
    hasDocumentation,
    routeRepresentedInFiles,
    expectedDomain ? expectedDomain === implementedDomain : true,
    taskTerms.length ? taskTermsMatched.length >= Math.max(1, Math.ceil(taskTerms.length / 3)) : true,
  ];

  const passedChecks = checks.filter(Boolean).length;
  const traceabilityScore = Math.round((passedChecks / checks.length) * 100);

  return {
    traceabilityScore,
    expectedDomain,
    implementedDomain,
    routeBase,
    hasFrontendPage,
    hasFrontendService,
    hasSharedContract,
    hasDocumentation,
    routeRepresentedInFiles,
    taskTermsMatched,
  };
}

function buildAutonomousGenerationSummary(technicalSpecContent = {}) {
  const materialization = technicalSpecContent?.autonomousMaterialization || {};
  const frontendSources = technicalSpecContent?.frontend?.autonomousFileSources || {};
  const backendSources = technicalSpecContent?.backend?.autonomousFileSources || {};
  const rejectionReasons = materialization.rejectionReasons || {};
  const generationSource =
    materialization.generationSource ||
    technicalSpecContent?.frontend?.autonomousGenerationSource ||
    technicalSpecContent?.autonomousExecution?.generationSource ||
    'unknown';
  const llmFileCount = Number(materialization.llmFileCount || 0);
  const fallbackFileCount = Number(materialization.fallbackFileCount || 0);
  const totalFiles = llmFileCount + fallbackFileCount;
  const autonomyPercent = totalFiles ? Math.round((llmFileCount / totalFiles) * 100) : 0;
  const rejectionBreakdown = Object.entries(rejectionReasons).reduce((acc, [, scopeReasons]) => {
    for (const reasons of Object.values(scopeReasons || {})) {
      for (const reason of Array.isArray(reasons) ? reasons : []) {
        const key = String(reason || '').trim();
        if (!key) continue;
        acc[key] = (acc[key] || 0) + 1;
      }
    }
    return acc;
  }, {});
  const dominantRejectionReasons = Object.entries(rejectionBreakdown)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }));

  return {
    generationSource,
    llmFileCount,
    fallbackFileCount,
    totalTrackedFiles: totalFiles,
    autonomyPercent,
    variationProfile:
      materialization.variationProfile ||
      technicalSpecContent?.frontend?.autonomousVariationProfile ||
      technicalSpecContent?.autonomousExecution?.variationProfile ||
      null,
    compositionSignature:
      technicalSpecContent?.frontend?.autonomousCompositionSignature ||
      technicalSpecContent?.autonomousExecution?.compositionSignature ||
      null,
    rejectionReasons,
    rejectionCount: Number(materialization.rejectionCount || 0),
    rejectionBreakdown,
    dominantRejectionReasons,
    frontendFileSources: frontendSources,
    backendFileSources: backendSources,
    isLlmPrimary: generationSource === 'llm_primary',
    isHybrid: generationSource === 'llm_primary_with_fallback',
    isFallbackDominant: generationSource === 'fallback_full',
  };
}

async function buildImplementationBenchmarkSummary(implementation, technicalSpecContent, qualitySummary) {
  const generatedAppId = implementation?.generatedAppId;
  if (!generatedAppId) return null;

  const expectedDomain =
    qualitySummary?.expectedDomain ||
    technicalSpecContent?.structured?.classification?.domain ||
    technicalSpecContent?.featureKey ||
    null;
  const screenTemplate =
    qualitySummary?.screenTemplate ||
    technicalSpecContent?.architecture?.screenTemplate ||
    technicalSpecContent?.structured?.classification?.screenTemplate ||
    null;

  const peerImplementations = await prisma.taskImplementation.findMany({
    where: {
      generatedAppId,
    },
    include: {
      technicalSpecArtifact: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const totalImplementations = peerImplementations.length;
  const integratedImplementations = peerImplementations.filter((item) => item.status === 'integrated');
  const failedImplementations = peerImplementations.filter((item) => item.status === 'failed');

  const peerSpecs = peerImplementations.map((item) => ({
    implementation: item,
    spec: parseJsonArtifactContent(item.technicalSpecArtifact),
  }));

  const sameDomainPeers = peerSpecs.filter((item) => {
    const peerDomain = item.spec?.structured?.classification?.domain || item.spec?.featureKey || null;
    return expectedDomain && peerDomain === expectedDomain;
  });

  const sameTemplatePeers = peerSpecs.filter((item) => {
    const peerTemplate =
      item.spec?.architecture?.screenTemplate ||
      item.spec?.structured?.classification?.screenTemplate ||
      null;
    return screenTemplate && peerTemplate === screenTemplate;
  });

  const projectSuccessRatePercent = totalImplementations
    ? Math.round((integratedImplementations.length / totalImplementations) * 100)
    : 0;
  const domainSuccessRatePercent = sameDomainPeers.length
    ? Math.round(
        (sameDomainPeers.filter((item) => item.implementation.status === 'integrated').length / sameDomainPeers.length) * 100
      )
    : null;
  const templateUsagePercent = totalImplementations
    ? Math.round((sameTemplatePeers.length / totalImplementations) * 100)
    : 0;

  const comparativeScore = Math.round(
    ((qualitySummary?.premiumScore || 0) * 0.6) +
      (projectSuccessRatePercent * 0.15) +
      ((domainSuccessRatePercent ?? projectSuccessRatePercent) * 0.2) +
      (templateUsagePercent * 0.05)
  );

  return {
    totalImplementations,
    integratedImplementations: integratedImplementations.length,
    failedImplementations: failedImplementations.length,
    projectSuccessRatePercent,
    domainPeerCount: sameDomainPeers.length,
    domainSuccessRatePercent,
    templatePeerCount: sameTemplatePeers.length,
    templateUsagePercent,
    comparativeScore,
  };
}

function buildRepairTelemetrySummary({
  executionStateArtifact,
  repairScopeAssessmentArtifact,
  repairEnforcementArtifact,
  debugDiagnosisArtifact,
  repairLearningArtifact,
} = {}) {
  const executionState = parseJsonArtifactContent(executionStateArtifact);
  const scopeAssessment = parseJsonArtifactContent(repairScopeAssessmentArtifact);
  const enforcement = parseJsonArtifactContent(repairEnforcementArtifact);
  const debugDiagnosis = parseJsonArtifactContent(debugDiagnosisArtifact);
  const repairLearning = parseJsonArtifactContent(repairLearningArtifact);

  const scope = scopeAssessment?.scopeAssessment || executionState?.repairScopeAssessment || null;
  const directive = enforcement?.enforcementDirective || executionState?.enforcementDirective || null;
  const diagnosis = debugDiagnosis?.diagnosis || executionState?.debugDiagnosis || null;
  const adaptiveDirective = repairLearning?.adaptiveDirective || executionState?.adaptiveDirective || null;

  return {
    writeSetStatus: scope?.status || 'unknown',
    writeSetMode: scope?.mode || 'unknown',
    adherencePercent: scope?.adherencePercent ?? null,
    outsideWriteSetCount: Array.isArray(scope?.outsideWriteSet) ? scope.outsideWriteSet.length : 0,
    outsideWriteSet: Array.isArray(scope?.outsideWriteSet) ? scope.outsideWriteSet.slice(0, 5) : [],
    escalated: Boolean(directive),
    nextRepairStyle: directive?.nextRepairStyle || null,
    nextExecutor: directive?.nextExecutor || null,
    enforcementReason: directive?.reason || null,
    enforcementTriggeredBy: directive?.triggeredBy || null,
    rootCause: diagnosis?.rootCause || null,
    suggestedFix: diagnosis?.suggestedFix || null,
    affectedFiles: Array.isArray(diagnosis?.affectedFiles) ? diagnosis.affectedFiles.slice(0, 5) : [],
    adaptiveExecutor: adaptiveDirective?.nextExecutor || null,
    adaptiveRepairStyle: adaptiveDirective?.nextRepairStyle || null,
    adaptiveReason: adaptiveDirective?.reason || null,
    adaptiveConfidence: adaptiveDirective?.confidence || null,
    learningSamples: repairLearning?.repairLearning?.relevantSamples ?? null,
  };
}

function resolveRepairStyle({ technicalSpec, findings, specialistFindings, validationFailures }) {
  const materialization = technicalSpec?.autonomousMaterialization || {};
  const generationSource =
    materialization.generationSource ||
    technicalSpec?.frontend?.autonomousGenerationSource ||
    technicalSpec?.autonomousExecution?.generationSource ||
    'unknown';
  const fallbackFileCount = Number(materialization.fallbackFileCount || 0);
  const llmFileCount = Number(materialization.llmFileCount || 0);
  const totalFiles = fallbackFileCount + llmFileCount;
  const fallbackRatio = totalFiles ? fallbackFileCount / totalFiles : 1;
  const allSignals = [...findings, ...specialistFindings, ...validationFailures];
  const onlyValidationFailures = !findings.length && !specialistFindings.length && validationFailures.length > 0;
  const frontendOnlyReview =
    !validationFailures.length &&
    allSignals.length > 0 &&
    allSignals.every((item) => String(item.filePath || item.scriptName || '').includes('apps/web/'));

  if (generationSource === 'fallback_full' || fallbackRatio >= 0.75) {
    return 'reconstructive';
  }

  if (onlyValidationFailures) {
    return 'iterative';
  }

  if (frontendOnlyReview || generationSource === 'llm_primary' || generationSource === 'llm_primary_with_fallback') {
    return 'iterative';
  }

  return 'reconstructive';
}

async function buildRepairContext({ reviewReport, specialistReviewReport, validationSummary, attemptNumber, technicalSpec, projectId, forcedDirective = null }) {
  const findings = (reviewReport?.findings || []).slice(0, 10).map((finding) => ({
    code: finding.code,
    severity: finding.severity,
    filePath: finding.filePath,
    message: finding.message,
  }));
  const specialistFindings = (specialistReviewReport?.findings || []).slice(0, 10).map((finding) => ({
    code: finding.code,
    severity: finding.severity,
    filePath: finding.filePath,
    message: finding.message,
  }));
  const validationFailures = formatValidationFailures(validationSummary);
  let debugDiagnosis = null;

  const shouldInvokeDebugAgent =
    validationSummary?.status === 'failed' ||
    validationSummary?.buildStatus === 'failed' ||
    validationSummary?.testStatus === 'failed' ||
    validationSummary?.lintStatus === 'failed';

  if (shouldInvokeDebugAgent) {
    try {
      console.log(`[Self-Healing] Analisando falhas com DebugAgent...`);
      const debugReport = await invokeDebugAgent({
        project_id: projectId,
        idea: technicalSpec?.featureKey || 'repair_validation_failure',
        objective: technicalSpec?.implementationObjective?.primaryGoal || technicalSpec?.summary || 'Diagnosticar falha de validacao da implementacao.',
        validation_summary: validationSummary,
        error_logs: JSON.stringify(validationSummary, null, 2),
        current_implementation_context: {
          featureKey: technicalSpec?.featureKey || null,
          frontend: {
            featurePath: technicalSpec?.frontend?.featurePath || null,
            route: technicalSpec?.frontend?.suggestedRoute || null,
          },
          backend: {
            modulePath: technicalSpec?.backend?.modulePath || null,
            routeBase: technicalSpec?.backend?.routeBase || null,
          },
          shared: {
            contractPath: technicalSpec?.shared?.contractPath || null,
          },
        },
        file_context: {
          frontendFiles: technicalSpec?.frontend?.files || [],
          backendFiles: technicalSpec?.backend?.files || [],
          sharedFiles: technicalSpec?.shared?.files || [],
          databaseFiles: technicalSpec?.database?.files || [],
        },
      });

      if (debugReport && typeof debugReport === 'object') {
        debugDiagnosis = {
          diagnostic: debugReport.diagnostic || null,
          rootCause: debugReport.rootCause || null,
          suggestedFix: debugReport.suggestedFix || null,
          affectedFiles: Array.isArray(debugReport.affectedFiles) ? debugReport.affectedFiles : [],
          source: debugReport.source || 'debug_agent',
          findings: Array.isArray(debugReport.findings) ? debugReport.findings : [],
        };
      }

      if (debugReport?.findings?.length) {
        console.log(`[Self-Healing] DebugAgent encontrou ${debugReport.findings.length} causas raiz.`);
        findings.push(
          ...debugReport.findings
            .slice(0, 6)
            .map((finding) => ({
              code: finding.code || 'debug_agent_finding',
              severity: finding.severity || 'critical',
              filePath: finding.filePath || '',
              message: finding.message || finding.suggestedFix || debugReport.diagnostic || 'Falha de validacao detectada pelo debug_agent.',
              source: 'debug_agent',
              suggestedFix: finding.suggestedFix || debugReport.suggestedFix || null,
            }))
        );
      }
    } catch (err) {
      console.error('[Self-Healing] Falha ao invocar DebugAgent:', err.message);
    }
  }

  const repairScope = inferRepairScope({ findings, specialistFindings, validationFailures });
  const baseContext = {
    attemptNumber,
    reviewStatus: reviewReport?.summary?.status || 'unknown',
    reviewScore: reviewReport?.summary?.score ?? null,
    specialistReviewStatus: specialistReviewReport?.summary?.status || 'unknown',
    specialistReviewScore: specialistReviewReport?.summary?.score ?? null,
    findings,
    specialistFindings,
    validationStatus: validationSummary?.status || 'unknown',
    validationFailures,
    generationSource:
      technicalSpec?.autonomousMaterialization?.generationSource ||
      technicalSpec?.frontend?.autonomousGenerationSource ||
      technicalSpec?.autonomousExecution?.generationSource ||
      'unknown',
    materialization:
      technicalSpec?.autonomousMaterialization || null,
    debugDiagnosis,
    repairScope,
    enforcementDirective: forcedDirective || null,
  };

  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);
  baseContext.executionFocus = inferRepairExecutionFocus(baseContext, currentImplementationContext);
  baseContext.repairLearning = await loadRecentRepairLearningSignals(projectId, baseContext);
  baseContext.adaptiveDirective = resolveAdaptiveRepairDirective(baseContext, baseContext.repairLearning);
  baseContext.repairStyle =
    forcedDirective?.nextRepairStyle ||
    baseContext.adaptiveDirective?.nextRepairStyle ||
    resolveRepairStyle({ technicalSpec, findings, specialistFindings, validationFailures });

  return baseContext;
}

function inferRepairScope({ findings = [], specialistFindings = [], validationFailures = [] }) {
  const allSignals = [
    ...findings.map((item) => `${item.filePath || ''} ${item.code || ''}`.toLowerCase()),
    ...specialistFindings.map((item) => `${item.filePath || ''} ${item.code || ''}`.toLowerCase()),
    ...validationFailures.map((item) => `${item.scriptName || ''} ${item.errorMessage || ''}`.toLowerCase()),
  ];

  const needsFrontend = allSignals.some((signal) =>
    signal.includes('apps/web/') ||
    signal.includes('frontend') ||
    signal.includes('ux') ||
    signal.includes('shell') ||
    signal.includes('build:web') ||
    signal.includes('lint')
  );

  const needsBackend = allSignals.some((signal) =>
    signal.includes('apps/api/') ||
    signal.includes('backend') ||
    signal.includes('route') ||
    signal.includes('contract') ||
    signal.includes('build:api') ||
    signal.includes('schema')
  );

  const needsShared = allSignals.some((signal) =>
    signal.includes('packages/shared/') ||
    signal.includes('docs/implementations/') ||
    signal.includes('prisma/') ||
    signal.includes('test') ||
    signal.includes('build')
  );

  const workstreamIds = [];
  if (needsBackend) workstreamIds.push('backend_module');
  if (needsFrontend) workstreamIds.push('frontend_feature');
  if (needsShared || (!needsBackend && !needsFrontend)) workstreamIds.push('persistence_and_docs');

  return {
    needsBackend,
    needsFrontend,
    needsShared: needsShared || (!needsBackend && !needsFrontend),
    workstreamIds: [...new Set(workstreamIds)],
  };
}

function parseJsonArtifactContent(artifact) {
  if (!artifact?.content) return null;

  try {
    return JSON.parse(artifact.content);
  } catch {
    return null;
  }
}

function getWorkstreamExecutionState(planContent, phaseId) {
  const phases = planContent?.executionPhases || [];
  const workstreams = planContent?.workstreams || [];
  const currentPhaseIndex = phases.findIndex((phase) => phase.id === phaseId);
  const currentPhase = currentPhaseIndex >= 0 ? phases[currentPhaseIndex] : null;

  const completedWorkstreamIds = phases
    .slice(0, currentPhaseIndex < 0 ? 0 : currentPhaseIndex)
    .flatMap((phase) => phase.workstreams || []);
  const activeWorkstreamIds = currentPhase?.workstreams || [];

  const toView = (id) => {
    const stream = workstreams.find((item) => item.id === id);
    return stream
      ? {
          id: stream.id,
          label: stream.label,
          goal: stream.goal,
          lane: stream.lane || 'shared',
          ownerAgent: stream.ownerAgent || null,
        }
      : {
          id,
          label: id,
          goal: '',
          lane: 'shared',
          ownerAgent: null,
        };
  };

  const groupByLane = (items) =>
    items.reduce(
      (acc, item) => {
        const key = item.lane || 'shared';
        acc[key] = [...(acc[key] || []), item];
        return acc;
      },
      { shared: [], backend: [], frontend: [] }
    );

  const currentWorkstreams = activeWorkstreamIds.map(toView);
  const completedWorkstreams = completedWorkstreamIds.map(toView);

  return {
    currentPhaseId: currentPhase?.id || null,
    currentWorkstreams,
    completedWorkstreams,
    currentWorkstreamsByLane: groupByLane(currentWorkstreams),
    completedWorkstreamsByLane: groupByLane(completedWorkstreams),
  };
}

function buildCompletedWorkstreamState(planContent) {
  const workstreams = (planContent?.workstreams || []).map((stream) => ({
    id: stream.id,
    label: stream.label,
    goal: stream.goal,
    lane: stream.lane || 'shared',
    ownerAgent: stream.ownerAgent || null,
  }));
  const groupByLane = (items) =>
    items.reduce(
      (acc, item) => {
        const key = item.lane || 'shared';
        acc[key] = [...(acc[key] || []), item];
        return acc;
      },
      { shared: [], backend: [], frontend: [] }
    );

  return {
    currentWorkstreams: [],
    completedWorkstreams: workstreams,
    currentWorkstreamsByLane: groupByLane([]),
    completedWorkstreamsByLane: groupByLane(workstreams),
  };
}

function detectFindingLane(filePath = '', code = '') {
  const signal = `${String(filePath || '')} ${String(code || '')}`.toLowerCase();
  if (signal.includes('apps/api/') || signal.includes('backend') || signal.includes('route') || signal.includes('contract')) {
    return 'backend';
  }
  if (signal.includes('apps/web/') || signal.includes('frontend') || signal.includes('ux') || signal.includes('shell')) {
    return 'frontend';
  }
  return 'shared';
}

function summarizeFindingsByLane(findings = []) {
  const severityWeight = { high: 25, medium: 12, low: 5 };
  const buckets = {
    backend: { total: 0, score: 100, high: 0, medium: 0, low: 0 },
    frontend: { total: 0, score: 100, high: 0, medium: 0, low: 0 },
    shared: { total: 0, score: 100, high: 0, medium: 0, low: 0 },
  };

  for (const finding of findings) {
    const lane = detectFindingLane(finding.filePath, finding.code);
    const severity = finding.severity || 'low';
    buckets[lane].total += 1;
    buckets[lane][severity] = (buckets[lane][severity] || 0) + 1;
    buckets[lane].score = Math.max(0, buckets[lane].score - (severityWeight[severity] || 0));
  }

  return buckets;
}

function buildImplementationQualitySummary({ task, implementation, reviewArtifact, specialistReviewArtifact, buildReportArtifact, testReportArtifact, lintReportArtifact }) {
  const reviewContent = parseJsonArtifactContent(reviewArtifact);
  const specialistReviewContent = parseJsonArtifactContent(specialistReviewArtifact);
  const buildContent = parseJsonArtifactContent(buildReportArtifact);
  const testContent = parseJsonArtifactContent(testReportArtifact);
  const lintContent = parseJsonArtifactContent(lintReportArtifact);
  const technicalSpecContent = parseJsonArtifactContent(implementation?.technicalSpecArtifact);
  const score = reviewContent?.summary?.score ?? null;
  const reviewStatus = reviewContent?.summary?.status || 'unknown';
  const findings = reviewContent?.findings || [];
  const specialistFindings = specialistReviewContent?.findings || [];
  const countsBySeverity = findings.reduce(
    (acc, item) => {
      const key = item.severity || 'low';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const validationScore =
    (lintContent?.status === 'completed' ? 25 : 0) +
    (testContent?.status === 'completed' ? 35 : 0) +
    (buildContent?.status === 'completed' ? 40 : 0);
  const semanticFindings = specialistFindings.filter((item) => item.category === 'semantic');
  const expectedDomain =
    technicalSpecContent?.structured?.classification?.domain ||
    technicalSpecContent?.featureKey ||
    null;
  const implementedDomain = inferImplementedDomain(
    technicalSpecContent?.featureKey || '',
    technicalSpecContent?.backend?.routeBase || ''
  );
  const semanticScore = specialistReviewContent?.summary?.semanticScore ?? Math.max(0, 100 - semanticFindings.length * 25);
  const traceability = buildTraceabilitySummary(task, implementation, technicalSpecContent, expectedDomain, implementedDomain);
  const autonomousGeneration = buildAutonomousGenerationSummary(technicalSpecContent);
  const executionStateContent = parseJsonArtifactContent(
    implementation?.executionStateArtifact ||
    implementation?.currentExecutionStateArtifact ||
    null
  );
  const scopeAssessmentContent = parseJsonArtifactContent(
    implementation?.repairScopeAssessmentArtifact ||
    implementation?.currentRepairScopeAssessmentArtifact ||
    null
  );
  const enforcementContent = parseJsonArtifactContent(
    implementation?.repairEnforcementArtifact ||
    implementation?.currentRepairEnforcementArtifact ||
    null
  );
  const findingsByLane = summarizeFindingsByLane(findings);
  const specialistFindingsByLane = summarizeFindingsByLane(specialistFindings);
  const repairBehavior = {
    writeSetStatus: scopeAssessmentContent?.scopeAssessment?.status || executionStateContent?.repairScopeAssessment?.status || 'unknown',
    writeSetMode: scopeAssessmentContent?.scopeAssessment?.mode || executionStateContent?.repairScopeAssessment?.mode || 'unknown',
    adherencePercent:
      scopeAssessmentContent?.scopeAssessment?.adherencePercent ??
      executionStateContent?.repairScopeAssessment?.adherencePercent ??
      null,
    outsideWriteSetCount:
      scopeAssessmentContent?.scopeAssessment?.outsideWriteSet?.length ??
      executionStateContent?.repairScopeAssessment?.outsideWriteSet?.length ??
      0,
    escalated: Boolean(
      enforcementContent?.enforcementDirective ||
      executionStateContent?.enforcementDirective
    ),
    nextRepairStyle:
      enforcementContent?.enforcementDirective?.nextRepairStyle ||
      executionStateContent?.enforcementDirective?.nextRepairStyle ||
      null,
    nextExecutor:
      enforcementContent?.enforcementDirective?.nextExecutor ||
      executionStateContent?.enforcementDirective?.nextExecutor ||
      null,
  };
  const premiumScore = Math.round(
    [
      score,
      specialistReviewContent?.summary?.score ?? null,
      semanticScore,
      reviewContent?.summary?.uxScore ?? null,
      reviewContent?.summary?.consistencyScore ?? null,
      specialistReviewContent?.summary?.architectureScore ?? null,
      validationScore,
      traceability.traceabilityScore,
      repairBehavior.adherencePercent,
      repairBehavior.escalated ? 40 : 100,
    ]
      .filter((value) => value !== null && value !== undefined)
      .reduce((sum, value, _index, values) => sum + Number(value) / values.length, 0)
  );

  return {
    versioning: getAiGovernanceVersionMeta(),
    score,
    reviewStatus,
    specialistReviewStatus: specialistReviewContent?.summary?.status || 'unknown',
    specialistScore: specialistReviewContent?.summary?.score ?? null,
    semanticScore,
    premiumScore,
    expectedDomain,
    implementedDomain,
    domainAligned: expectedDomain ? expectedDomain === implementedDomain : null,
    traceability,
    autonomousGeneration,
    repairBehavior,
    verdict: reviewContent?.summary?.verdict || null,
    buildStatus: buildContent?.status || implementation?.buildStatus || 'unknown',
    testStatus: testContent?.status || implementation?.testStatus || 'unknown',
    lintStatus: lintContent?.status || 'unknown',
    totalFindings: reviewContent?.summary?.totalFindings ?? findings.length,
    findingsBySeverity: countsBySeverity,
    findingsByLane,
    specialistFindingsByLane,
    uxScore: reviewContent?.summary?.uxScore ?? null,
    consistencyScore: reviewContent?.summary?.consistencyScore ?? null,
    maintainabilityScore: reviewContent?.summary?.maintainabilityScore ?? null,
    specialistArchitectureScore: specialistReviewContent?.summary?.architectureScore ?? null,
    specialistExperienceScore: specialistReviewContent?.summary?.experienceScore ?? null,
    validationScore,
    screenTemplate:
      reviewContent?.structured?.classification?.screenTemplate ||
      technicalSpecContent?.architecture?.screenTemplate ||
      technicalSpecContent?.structured?.classification?.screenTemplate ||
      null,
  };
}

function classifyImplementationRisk({ generatedFiles = [], technicalSpec, qualitySummary, repairAttempts = 0 }) {
  const filePaths = (generatedFiles || []).map((file) => String(file.filePath || '').replace(/\\/g, '/'));
  const touchesDatabase = filePaths.some((filePath) => filePath.endsWith('prisma/schema.prisma'));
  const touchesSharedContracts = filePaths.some((filePath) => filePath.includes('packages/shared/src/contracts/'));
  const touchesApiServer = filePaths.some((filePath) => filePath.endsWith('apps/api/src/server.ts'));
  const touchesFrontendRouter = filePaths.some((filePath) => filePath.endsWith('apps/web/src/App.tsx'));
  const totalFindings = Number(qualitySummary?.totalFindings || 0);
  const highFindings = Number(qualitySummary?.findingsBySeverity?.high || 0);
  const validationFailed = qualitySummary?.buildStatus !== 'completed' || qualitySummary?.testStatus !== 'completed' || qualitySummary?.lintStatus !== 'completed';
  const traceabilityScore = Number(qualitySummary?.traceability?.traceabilityScore || 0);
  const repairBehavior = qualitySummary?.repairBehavior || {};

  let score = 0;
  if (touchesDatabase) score += 3;
  if (touchesSharedContracts) score += 3;
  if (touchesApiServer) score += 2;
  if (touchesFrontendRouter) score += 1;
  score += Math.min(4, Math.floor(filePaths.length / 4));
  score += highFindings * 3;
  score += Math.min(4, Math.floor(totalFindings / 3));
  score += repairAttempts > 0 ? Math.min(3, repairAttempts) : 0;
  if (validationFailed) score += 3;
  if (traceabilityScore > 0 && traceabilityScore < 70) score += 2;
  if (repairBehavior.writeSetStatus === 'expanded') score += 2;
  if (repairBehavior.writeSetStatus === 'partial') score += 3;
  if (repairBehavior.escalated) score += 2;

  const level = score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';

  return {
    level,
    score,
    signals: {
      touchesDatabase,
      touchesSharedContracts,
      touchesApiServer,
      touchesFrontendRouter,
      totalFiles: filePaths.length,
      repairAttempts,
      totalFindings,
      highFindings,
      validationFailed,
      traceabilityScore,
      repairWriteSetStatus: repairBehavior.writeSetStatus || 'unknown',
      repairEscalated: Boolean(repairBehavior.escalated),
    },
  };
}

function classifyLaneRisk(lane, qualitySummary = {}) {
  const laneSignals =
    lane === 'backend'
      ? ['buildStatus', 'specialistArchitectureScore']
      : lane === 'frontend'
        ? ['lintStatus', 'uxScore']
        : ['testStatus', 'validationScore'];
  const summary = qualitySummary?.findingsByLane?.[lane] || { total: 0, high: 0, score: 100 };
  const specialistSummary = qualitySummary?.specialistFindingsByLane?.[lane] || { total: 0, high: 0, score: 100 };
  const validationFailed =
    (lane === 'backend' && qualitySummary?.buildStatus !== 'completed') ||
    (lane === 'frontend' && qualitySummary?.lintStatus !== 'completed') ||
    (lane === 'shared' && qualitySummary?.testStatus !== 'completed');

  let score = 0;
  score += Number(summary.high || 0) * 3;
  score += Math.min(4, Number(summary.total || 0));
  score += Number(specialistSummary.high || 0) * 2;
  if (validationFailed) score += 3;

  const level = score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low';

  return {
    lane,
    level,
    score,
    reviewScore: summary.score ?? null,
    specialistScore: specialistSummary.score ?? null,
    totalFindings: summary.total || 0,
    highFindings: summary.high || 0,
    validationFailed,
    keySignals: laneSignals,
  };
}

function buildLaneRecommendations(laneRisks = []) {
  return laneRisks.map((laneRisk) => {
    const prefix = laneRisk.lane === 'backend' ? 'Backend' : laneRisk.lane === 'frontend' ? 'Frontend' : 'Shared';
    const recommendation =
      laneRisk.level === 'high'
        ? `${prefix}: revisar manualmente antes de promover a integração.`
        : laneRisk.level === 'medium'
          ? `${prefix}: validar os pontos principais desta vertente antes do merge final.`
          : `${prefix}: sem bloqueios relevantes na leitura atual.`;

    return {
      lane: laneRisk.lane,
      level: laneRisk.level,
      recommendation,
    };
  });
}

function summarizeReviewCodes(artifact) {
  const content = parseJsonArtifactContent(artifact);
  const findings = Array.isArray(content?.findings) ? content.findings : [];
  return findings.reduce((acc, finding) => {
    const key = String(finding?.code || '').trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function pickFocusFilesFromImplementation(implementation) {
  const files = [
    ...(implementation?.repairTelemetry?.affectedFiles || []),
    ...(implementation?.repairTelemetry?.outsideWriteSet || []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (files.length) {
    return [...new Set(files)].slice(0, 5);
  }

  const specialistContent = parseJsonArtifactContent(implementation?.specialistReviewArtifact);
  const specialistFiles = (specialistContent?.findings || [])
    .map((item) => String(item?.filePath || '').trim())
    .filter(Boolean);
  if (specialistFiles.length) {
    return [...new Set(specialistFiles)].slice(0, 5);
  }

  return [];
}

function normalizeValidationArtifactReport(artifact) {
  const parsed = parseJsonArtifactContent(artifact);
  if (!parsed) return null;
  return parsed.report || parsed.summary || parsed.validation || parsed;
}

function pickFirstFailedReport(reports = []) {
  if (!Array.isArray(reports) || !reports.length) return null;
  return (
    reports.find((report) => String(report?.status || '').toLowerCase() !== 'completed') ||
    reports.find(Boolean) ||
    null
  );
}

function humanizeValidationScriptName(scriptName = '') {
  const normalized = String(scriptName || '').trim();
  if (!normalized) return 'validação';
  const directMap = {
    test: 'testes',
    lint: 'lint',
    install: 'instalação',
    'db:generate': 'schema/prisma',
    'build:api': 'build da API',
    'build:web': 'build do frontend',
  };
  return directMap[normalized] || normalized.replace(/[:_-]+/g, ' ');
}

function resolveFailureLayerFromValidationScript(scriptName = '', implementation = null) {
  const normalized = String(scriptName || '').toLowerCase();
  if (normalized === 'install') return 'infra da esteira';
  if (normalized === 'db:generate') return 'schema';
  if (normalized === 'build:api') return 'backend';
  if (normalized === 'build:web') return 'frontend';
  if (normalized === 'lint') return 'frontend';
  if (normalized === 'test') {
    const quality = implementation?.qualitySummary || {};
    if (quality.buildStatus === 'completed' && quality.lintStatus === 'completed') {
      return 'validation';
    }
    return resolveImplementationFailureLayer(implementation);
  }
  return resolveImplementationFailureLayer(implementation);
}

function summarizeLatestFailure(implementation) {
  const quality = implementation?.qualitySummary || {};
  const buildArtifact = normalizeValidationArtifactReport(implementation?.buildReportArtifact);
  const testArtifact = normalizeValidationArtifactReport(implementation?.testReportArtifact);
  const lintArtifact = normalizeValidationArtifactReport(implementation?.lintReportArtifact);
  const buildReports = Array.isArray(buildArtifact?.reports) ? buildArtifact.reports : [];
  const failedBuildReport = pickFirstFailedReport(buildReports);

  const validationEvidence =
    testArtifact?.status !== 'completed'
      ? { scriptName: testArtifact?.scriptName || 'test', ...testArtifact }
      : lintArtifact?.status !== 'completed'
        ? { scriptName: lintArtifact?.scriptName || 'lint', ...lintArtifact }
        : failedBuildReport
          ? { scriptName: failedBuildReport.scriptName || 'build', ...failedBuildReport }
          : null;

  const scriptName = String(validationEvidence?.scriptName || '').trim();
  const layer = validationEvidence ? resolveFailureLayerFromValidationScript(scriptName, implementation) : resolveImplementationFailureLayer(implementation);
  const evidenceLabel = humanizeValidationScriptName(scriptName || (validationEvidence ? 'validation' : ''));
  const evidenceMessage =
    truncateText(validationEvidence?.errorMessage || validationEvidence?.stderr || validationEvidence?.stdout || '', 260) ||
    'Sem mensagem detalhada no artefato desta falha.';
  const focusFiles = pickFocusFilesFromImplementation(implementation);
  const firstFileToInspect =
    validationEvidence?.filePath ||
    focusFiles[0] ||
    (Array.isArray(validationEvidence?.reports)
      ? pickFirstFailedReport(validationEvidence.reports)?.filePath || null
      : null);

  return {
    layer,
    evidenceLabel,
    evidenceMessage,
    evidenceScript: scriptName || null,
    firstFileToInspect,
    focusFiles,
    hasValidationEvidence: Boolean(validationEvidence),
    validationStatus: quality.buildStatus === 'completed' && quality.testStatus === 'completed' && quality.lintStatus === 'completed' ? 'completed' : 'failed',
  };
}

function resolveImplementationFailureLayer(implementation) {
  const quality = implementation?.qualitySummary || {};
  const specialistLaneEntries = Object.entries(quality?.specialistFindingsByLane || {})
    .map(([lane, summary]) => ({
      lane,
      total: Number(summary?.total || 0),
      high: Number(summary?.high || 0),
      score: Number(summary?.score || 0),
    }))
    .filter((item) => item.total > 0)
    .sort((left, right) => right.high - left.high || right.total - left.total || left.score - right.score);
  const laneRisks = implementation?.diffReviewArtifact
    ? parseJsonArtifactContent(implementation.diffReviewArtifact)?.qualitySignals?.laneRisks || []
    : [];
  const topLane = [...laneRisks].sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0];

  if (quality.specialistReviewStatus && quality.specialistReviewStatus !== 'approved') {
    if (specialistLaneEntries[0]?.lane === 'frontend') return 'frontend';
    if (specialistLaneEntries[0]?.lane === 'backend') return 'backend';
    if (specialistLaneEntries[0]?.lane === 'shared') return 'validation';
    if (topLane?.lane === 'frontend') return 'frontend';
    if (topLane?.lane === 'backend') return 'backend';
    return 'specialist';
  }
  if (quality.buildStatus && quality.buildStatus !== 'completed') return 'backend';
  if (quality.lintStatus && quality.lintStatus !== 'completed') return 'frontend';
  if (quality.testStatus && quality.testStatus !== 'completed') return 'validation';
  if (implementation?.repairTelemetry?.rootCause) return 'repair';
  return topLane?.lane || 'validation';
}

function buildOperationalFocusSummary(implementations = []) {
  if (!implementations.length) {
    return {
      headline: 'Nenhuma implementacao analisada ainda.',
      dominantLayer: 'unknown',
      dominantIssue: 'Sem dados suficientes para apontar o gargalo atual.',
      nextStep: 'Gerar e executar pelo menos uma implementacao completa no projeto.',
      focusFiles: [],
      latestFailedTask: null,
    };
  }

  const failedImplementations = implementations
    .filter((item) => item.status === 'failed')
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
  const latestFailed = failedImplementations[0] || null;

  if (!latestFailed) {
    return {
      headline: 'As implementacoes observadas estao fechando sem falha aberta no momento.',
      dominantLayer: 'stable',
      dominantIssue: 'Nao ha uma falha dominante pendente na amostra atual.',
      nextStep: 'Expandir a amostra para novas historias e manter monitoramento de autonomy, specialist e repair.',
      focusFiles: [],
      latestFailedTask: null,
    };
  }

  const quality = latestFailed.qualitySummary || {};
  const latestFailure = summarizeLatestFailure(latestFailed);
  const failureLayer = latestFailure.layer || resolveImplementationFailureLayer(latestFailed);
  const specialistScore = quality.specialistScore;
  const dominantIssue =
    quality.specialistReviewStatus && quality.specialistReviewStatus !== 'approved'
      ? `Specialist em ${quality.specialistReviewStatus} com score ${specialistScore ?? 'n/a'}, apesar do status tecnico ${quality.validationScore ?? 'n/a'}.`
      : latestFailure.hasValidationEvidence
        ? `${latestFailure.evidenceLabel}: ${latestFailure.evidenceMessage}`
        : latestFailed.repairTelemetry?.rootCause ||
        `Falha predominante na camada ${failureLayer}.`;

  const nextStep =
    failureLayer === 'frontend' || failureLayer === 'specialist'
      ? 'Revisar page.tsx, design system compartilhado, copy e aderencia ao specialist antes da proxima rodada.'
      : failureLayer === 'backend'
        ? 'Revisar service/router, persistencia Prisma e aderencia aos contratos e cenarios de teste.'
        : failureLayer === 'schema'
          ? 'Revisar prisma/schema.prisma e a consistencia entre contratos, seed e geracao do client.'
        : failureLayer === 'repair'
          ? 'Reduzir write set e melhorar aderencia do repair aos arquivos foco.'
          : failureLayer === 'infra da esteira'
            ? 'Revisar install, db:generate e a infraestrutura local da esteira antes do proximo repair.'
          : 'Revisar a camada de validacao e os artefatos da ultima falha para orientar o repair.';

  return {
    headline: latestFailed.task?.title || latestFailed.uuid || 'Falha recente sem task associada',
    dominantLayer: failureLayer,
    dominantIssue,
    nextStep,
    focusFiles: latestFailure.focusFiles,
    latestFailure: {
      layer: latestFailure.layer,
      evidenceLabel: latestFailure.evidenceLabel,
      evidenceMessage: latestFailure.evidenceMessage,
      evidenceScript: latestFailure.evidenceScript,
      firstFileToInspect: latestFailure.firstFileToInspect,
    },
    latestFailedTask: {
      taskUuid: latestFailed.task?.uuid || null,
      implementationUuid: latestFailed.uuid || null,
      status: latestFailed.status || null,
      specialistStatus: quality.specialistReviewStatus || null,
      specialistScore: quality.specialistScore ?? null,
      validationStatus:
        latestFailure.validationStatus,
    },
  };
}

function averageNullable(values = []) {
  const numeric = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!numeric.length) return null;
  return Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
}

function buildImplementationWindowMetrics(items = []) {
  const repairEnabled = items.filter((item) => item?.repairTelemetry);
  const autonomyEnabled = items.filter((item) => item?.autonomySummary);
  const fallbackFullCount = autonomyEnabled.filter((item) => item?.autonomySummary?.generationSource === 'fallback_full').length;
  const needsAttentionCount = items.filter((item) => item?.qualitySummary?.specialistReviewStatus === 'needs_attention').length;
  const compliantRepairCount = repairEnabled.filter((item) => item?.repairTelemetry?.writeSetStatus === 'compliant').length;

  return {
    totalImplementations: items.length,
    autonomyCount: autonomyEnabled.length,
    repairCount: repairEnabled.length,
    fallbackFullCount,
    fallbackFullRatePercent: autonomyEnabled.length ? Math.round((fallbackFullCount / autonomyEnabled.length) * 100) : null,
    specialistAttentionCount: needsAttentionCount,
    specialistAttentionRatePercent: autonomyEnabled.length ? Math.round((needsAttentionCount / autonomyEnabled.length) * 100) : null,
    averageSpecialistScore: averageNullable(items.map((item) => item?.qualitySummary?.specialistScore)),
    averageAutonomyPercent: averageNullable(autonomyEnabled.map((item) => item?.autonomySummary?.autonomyPercent)),
    averageAdherencePercent: averageNullable(repairEnabled.map((item) => item?.repairTelemetry?.adherencePercent)),
    localRepairRatePercent: repairEnabled.length ? Math.round((compliantRepairCount / repairEnabled.length) * 100) : null,
  };
}

function buildTrendDelta(recentValue, previousValue) {
  if (!Number.isFinite(recentValue) || !Number.isFinite(previousValue)) return null;
  return Math.round((recentValue - previousValue) * 10) / 10;
}

function buildImplementationTrendSummary(implementations = []) {
  const timeline = [...implementations].sort(
    (left, right) => new Date(left.updatedAt || left.createdAt || 0) - new Date(right.updatedAt || right.createdAt || 0)
  );

  if (timeline.length < 2) return null;

  const windowSize = Math.max(1, Math.min(5, Math.floor(timeline.length / 2) || 1));
  const recent = timeline.slice(-windowSize);
  const previous = timeline.slice(Math.max(0, timeline.length - windowSize * 2), timeline.length - windowSize);
  const recentMetrics = buildImplementationWindowMetrics(recent);
  const previousMetrics = previous.length ? buildImplementationWindowMetrics(previous) : null;

  return {
    windowSize,
    recent: recentMetrics,
    previous: previousMetrics,
    deltas: previousMetrics
      ? {
          fallbackFullRatePercent: buildTrendDelta(recentMetrics.fallbackFullRatePercent, previousMetrics.fallbackFullRatePercent),
          specialistAttentionRatePercent: buildTrendDelta(recentMetrics.specialistAttentionRatePercent, previousMetrics.specialistAttentionRatePercent),
          averageSpecialistScore: buildTrendDelta(recentMetrics.averageSpecialistScore, previousMetrics.averageSpecialistScore),
          averageAdherencePercent: buildTrendDelta(recentMetrics.averageAdherencePercent, previousMetrics.averageAdherencePercent),
          localRepairRatePercent: buildTrendDelta(recentMetrics.localRepairRatePercent, previousMetrics.localRepairRatePercent),
        }
      : null,
  };
}

function buildImplementationDiffReview({ task, implementation, technicalSpec, qualitySummary, generatedFiles = [], repairAttempts = 0 }) {
  const normalizedFiles = (generatedFiles || []).map((file) => ({
    path: String(file.filePath || file.relativePath || '').replace(/\\/g, '/'),
    type: file.fileType || 'unknown',
    changeType: file.changeType || 'created',
  }));

  const grouped = {
    frontend: normalizedFiles.filter((file) => file.path.startsWith('apps/web/')).map((file) => file.path),
    backend: normalizedFiles.filter((file) => file.path.startsWith('apps/api/')).map((file) => file.path),
    shared: normalizedFiles.filter((file) => file.path.startsWith('packages/shared/')).map((file) => file.path),
    docs: normalizedFiles.filter((file) => file.path.startsWith('docs/')).map((file) => file.path),
    database: normalizedFiles.filter((file) => file.path.endsWith('prisma/schema.prisma')).map((file) => file.path),
  };

  const risk = classifyImplementationRisk({
    generatedFiles: normalizedFiles,
    technicalSpec,
    qualitySummary,
    repairAttempts,
  });
  const laneRisks = ['backend', 'frontend', 'shared'].map((lane) => classifyLaneRisk(lane, qualitySummary));
  const laneRecommendations = buildLaneRecommendations(laneRisks);
  const blockingLanes = laneRisks.filter((lane) => lane.level === 'high').map((lane) => lane.lane);

  const summaryLines = [
    grouped.frontend.length ? `Frontend: ${grouped.frontend.length} arquivo(s)` : null,
    grouped.backend.length ? `Backend: ${grouped.backend.length} arquivo(s)` : null,
    grouped.shared.length ? `Contratos compartilhados: ${grouped.shared.length} arquivo(s)` : null,
    grouped.database.length ? 'Schema alterado' : null,
    grouped.docs.length ? `Documentação: ${grouped.docs.length} arquivo(s)` : null,
  ].filter(Boolean);

  return {
    version: 1,
    taskUuid: task.uuid,
    implementationId: String(implementation.id),
    featureKey: technicalSpec.featureKey,
    generatedAt: new Date().toISOString(),
    summary: {
      headline: `A implementação alterou ${normalizedFiles.length} arquivo(s) para entregar ${technicalSpec.frontend?.navigationLabel || task.title}.`,
      changedAreas: summaryLines,
      riskLevel: risk.level,
      riskScore: risk.score,
      blockingLanes,
      recommendation:
        risk.level === 'high'
          ? 'Revisar manualmente o diff antes de considerar a integração encerrada.'
          : risk.level === 'medium'
            ? 'Revisar contratos, rotas e regressões principais antes de promover a mudança.'
            : 'Mudança localizada; a revisão pode focar nos fluxos principais e consistência final.',
    },
    filesByArea: grouped,
    topChangedFiles: normalizedFiles.slice(0, 12).map((file) => ({
      path: file.path,
      type: file.type,
      changeType: file.changeType,
    })),
    qualitySignals: {
      premiumScore: qualitySummary?.premiumScore ?? null,
      reviewScore: qualitySummary?.score ?? null,
      specialistScore: qualitySummary?.specialistScore ?? null,
      validationScore: qualitySummary?.validationScore ?? null,
      traceabilityScore: qualitySummary?.traceability?.traceabilityScore ?? null,
      repairWriteSetStatus: qualitySummary?.repairBehavior?.writeSetStatus || 'unknown',
      repairAdherencePercent: qualitySummary?.repairBehavior?.adherencePercent ?? null,
      repairEscalated: Boolean(qualitySummary?.repairBehavior?.escalated),
      repairAttempts,
      laneRisks,
      laneRecommendations,
    },
    risk,
  };
}

async function createImplementationDiffReviewArtifact(task, implementation, technicalSpec, qualitySummary, generatedFiles, repairAttempts) {
  const diffReview = buildImplementationDiffReview({
    task,
    implementation,
    technicalSpec,
    qualitySummary,
    generatedFiles,
    repairAttempts,
  });

  const artifact = await createCurrentArtifact(
    task.id,
    `Implementation Diff Review - ${task.title}`,
    JSON.stringify(diffReview, null, 2),
    'implementation_diff_reviewer',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  return { artifact, diffReview };
}

async function buildProjectMemorySnapshot(task, generatedApp) {
  const implementations = await prisma.taskImplementation.findMany({
    where: {
      generatedAppId: generatedApp.id,
      status: { in: ['planned', 'in_progress', 'integrated', 'failed'] },
    },
    include: {
      task: {
        select: { uuid: true, title: true, status: true },
      },
      technicalSpecArtifact: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 30,
  });

  const reviewArtifacts = await prisma.taskArtifact.findMany({
    where: {
      taskId: { in: implementations.map((item) => item.taskId) },
      title: { startsWith: 'Implementation Review - ' },
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const reviewByTaskId = new Map();
  for (const artifact of reviewArtifacts) {
    if (!reviewByTaskId.has(artifact.taskId)) {
      reviewByTaskId.set(artifact.taskId, parseJsonArtifactContent(artifact));
    }
  }

  const featurePatterns = [];
  const screenTemplates = {};
  const recurringFindings = {};
  const highQualityReferences = [];

  for (const implementation of implementations) {
    const spec = parseJsonArtifactContent(implementation.technicalSpecArtifact);
    const review = reviewByTaskId.get(implementation.taskId);
    if (!spec) continue;

    const templateKey = spec?.structured?.classification?.templateKey || 'generic/form';
    const screenTemplate = spec?.architecture?.screenTemplate || spec?.structured?.classification?.screenTemplate || 'crud';
    screenTemplates[screenTemplate] = (screenTemplates[screenTemplate] || 0) + 1;

    featurePatterns.push({
      taskUuid: implementation.task.uuid,
      title: implementation.task.title,
      featureKey: spec.featureKey,
      domainKey: inferFeatureDomainKey(spec),
      route: spec.frontend?.suggestedRoute,
      routeBase: spec.backend?.routeBase,
      templateKey,
      screenTemplate,
      status: implementation.status,
      score: review?.summary?.score ?? null,
      semanticGroups: extractSemanticSignals(
        implementation.task.title,
        spec.featureKey,
        spec.backend?.routeBase
      ).map((item) => item.group),
    });

    for (const finding of review?.findings || []) {
      recurringFindings[finding.code] = (recurringFindings[finding.code] || 0) + 1;
    }

    if ((review?.summary?.score || 0) >= 90 && implementation.status === 'integrated') {
      highQualityReferences.push({
        featureKey: spec.featureKey,
        route: spec.frontend?.suggestedRoute,
        templateKey,
        screenTemplate,
        score: review.summary.score,
      });
    }
  }

  return {
    version: 1,
    projectUuid: task.project.uuid,
    taskUuid: task.uuid,
    generatedAt: new Date().toISOString(),
    summary: {
      integratedFeatures: featurePatterns.filter((item) => item.status === 'integrated').length,
      totalKnownFeatures: featurePatterns.length,
      preferredScreenTemplate:
        Object.entries(screenTemplates).sort((a, b) => b[1] - a[1])[0]?.[0] || 'crud',
    },
    featurePatterns,
    recurringFindings: Object.entries(recurringFindings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code, count })),
    highQualityReferences: highQualityReferences.slice(0, 6),
  };
}

async function createProjectMemoryArtifact(task, implementation, generatedApp) {
  const systemTask = await ensureDevelopmentStageTask(task.project.id);
  const snapshot = await buildProjectMemorySnapshot(task, generatedApp);

  const artifact = await createCurrentArtifact(
    systemTask.id,
    `Project Memory Snapshot - ${task.project.name}`,
    JSON.stringify(snapshot, null, 2),
    'implementation_memory',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation?.id || null,
    }
  );

  return { artifact, snapshot };
}

function buildExecutionStrategy(task, generatedApp, technicalSpec, projectMemory) {
  const reuseHints = buildProjectMemoryReuseHints(projectMemory, technicalSpec, task.title);

  return {
    version: 1,
    taskUuid: task.uuid,
    generatedAppUuid: generatedApp.uuid,
    generatedAt: new Date().toISOString(),
    screenTemplate: technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud',
    preferredTemplateFromMemory: projectMemory?.summary?.preferredScreenTemplate || null,
    stages: [
      'strategy',
      'materialize',
      'review_structural',
      'review_specialist',
      'validate',
      'refactor_if_needed',
      'validate_again',
    ],
    architectureSummary: technicalSpec.architecture?.sourceSummary || null,
    projectMemory: projectMemory || null,
    reuseHints,
    productMode: technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || null,
    qualityTargets: {
      reviewScore: 85,
      validationScore: 80,
      specialistApproval: true,
    },
  };
}

function buildImplementationImpactAnalysis(task, generatedApp, technicalSpec, projectMemory) {
  const screenTemplate = technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud';
  const semanticSignals = extractSemanticSignals(task.title, technicalSpec.featureKey, technicalSpec.backend?.routeBase);
  const reuseHints = buildProjectMemoryReuseHints(projectMemory, technicalSpec, task.title);

  return {
    version: 1,
    taskUuid: task.uuid,
    generatedAppUuid: generatedApp.uuid,
    generatedAt: new Date().toISOString(),
    executionIntent: {
      primaryGoal: technicalSpec.implementationObjective?.primaryGoal || technicalSpec.summary,
      userOutcome: technicalSpec.implementationObjective?.userOutcome || technicalSpec.summary,
      successDefinition: technicalSpec.implementationObjective?.successDefinition || [],
    },
    impactSurface: {
      frontend: {
        route: technicalSpec.frontend?.suggestedRoute,
        pageComponent: technicalSpec.frontend?.pageComponentName,
        targetFiles: technicalSpec.files?.frontend || [],
      },
      backend: {
        routeBase: technicalSpec.backend?.routeBase,
        router: technicalSpec.backend?.routerName,
        targetFiles: technicalSpec.files?.backend || [],
      },
      shared: technicalSpec.files?.shared || [],
      database: technicalSpec.files?.database || [],
      documentation: [`docs/implementations/${technicalSpec.featureKey}.md`],
    },
    affectedCapabilities: [
      technicalSpec.frontend?.navigationLabel,
      technicalSpec.domain?.primaryAction,
      technicalSpec.backend?.routeBase,
    ].filter(Boolean),
    dependencySignals: {
      permissions: technicalSpec.ux?.permissions || null,
      semanticSignals,
      architectureHighlights: technicalSpec.architecture?.sourceSummary || [],
    },
    likelyRisks: [
      `Garantir consistencia entre ${technicalSpec.shared?.requestContractName} e ${technicalSpec.shared?.responseContractName}.`,
      `Evitar divergencia entre o template ${screenTemplate} e os padroes ja consolidados no projeto.`,
      'Confirmar que schema, rotas e navegacao sejam atualizados na mesma iteracao.',
    ],
    reuseHints: {
      preferredScreenTemplate: reuseHints.preferredScreenTemplate,
      highQualityReferences: (projectMemory?.highQualityReferences || []).slice(0, 3),
      sameDomainPatterns: reuseHints.domainReferences,
      templateReferences: reuseHints.templateReferences,
      recurringAntiPatterns: reuseHints.recurringAntiPatterns,
    },
  };
}

async function getProjectOrThrow(projectUuid) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true, uuid: true, name: true, slug: true, description: true, vision: true, templateKey: true, intakeConfig: true },
  });

  if (!project) {
    throw new Error('Projeto n?o encontrado.');
  }

  return project;
}

function resolveProjectTemplateForProject(project) {
  return resolveProjectTemplate(project?.templateKey || project?.intakeConfig?.projectTemplateKey || null, {
    projectName: project?.name,
    summary: project?.description || project?.vision || '',
    label: project?.name,
  });
}

function buildBlueprintSeedBrief(featureKey) {
  const briefs = {
    'support-performance-dashboard': {
      title: 'Painel gerencial do gestor com performance do suporte, fila e SLA',
      description:
        'Painel gerencial para acompanhar chamados, gargalos de atendimento, status, categorias e prioridades da operacao.',
    },
    'support-ticket-attachments': {
      title: 'Anexos e evidencias para chamados de suporte',
      description:
        'Fluxo para registrar comprovantes, documentos, imagens e arquivos associados ao ticket para acelerar a triagem.',
    },
    'ticket-notification-preferences': {
      title: 'Preferencias de notificacao por e-mail para chamados',
      description:
        'Tela para configurar e-mail principal e alertas de atualizacao do chamado sem depender do portal.',
    },
    'access-control-roles': {
      title: 'Perfis de acesso e permissoes da operacao',
      description:
        'Governanca de acesso por perfil, funcao e escopo para controlar quem pode atender, revisar e administrar a operacao.',
    },
    'course-catalog': {
      title: 'Criar curso com nome, descricao, categoria e preco',
      description:
        'Fluxo comercial e editorial para cadastrar cursos e preparar a oferta para a vitrine.',
    },
    'course-modules': {
      title: 'Organizar modulos do curso',
      description:
        'Estruturar o curso em modulos com sequencia logica e contexto pedagogico claro.',
    },
    'course-lessons': {
      title: 'Cadastrar aulas do curso',
      description:
        'Associar aulas aos modulos e escolher tipo de midia para o conteudo.',
    },
    'lesson-materials': {
      title: 'Materiais complementares para aulas',
      description:
        'Biblioteca de materiais, anexos e arquivos de apoio vinculados as aulas.',
    },
    'course-pricing': {
      title: 'Preco e configuracao comercial do curso',
      description:
        'Definir valor, condicoes comerciais e posicionamento para venda do curso.',
    },
    'course-search': {
      title: 'Busca e descoberta de cursos por categoria',
      description:
        'Experiencia de pesquisa por palavra-chave, filtros e catalogo para facilitar descoberta.',
    },
    'course-enrollment': {
      title: 'Matricular aluno em curso',
      description:
        'Fluxo de inscricao e liberacao de acesso do aluno aos cursos corretos.',
    },
    'course-player': {
      title: 'Player de curso com video, audio e progresso',
      description:
        'Tela para consumir aulas, acompanhar progresso e retomar conteudo.',
    },
  };

  return briefs[featureKey] || {
    title: humanizeFieldName(featureKey),
    description: `Fluxo inicial do blueprint para ${humanizeFieldName(featureKey).toLowerCase()}.`,
  };
}

function buildProjectTemplateTechnicalSpecs(project, projectTemplate) {
  return (projectTemplate?.featureKeys || [])
    .map((featureKey) => {
      const brief = buildBlueprintSeedBrief(featureKey);
      const syntheticTask = {
        uuid: `bootstrap-${featureKey}`,
        title: brief.title,
        description: brief.description,
        artifacts: [],
        project: {
          uuid: project.uuid,
          name: project.name,
        },
      };

      return buildTechnicalSpec(
        syntheticTask,
        [
          project.description,
          project.vision,
          projectTemplate?.summary,
          projectTemplate?.positioning,
          brief.description,
        ]
          .filter(Boolean)
          .join('\n')
      );
    })
    .filter(Boolean);
}

function sortRouteSpecsByProjectTemplate(routeSpecs, projectTemplate) {
  const preferredOrder = new Map((projectTemplate?.featureKeys || []).map((key, index) => [key, index]));

  return [...routeSpecs].sort((left, right) => {
    const leftIndex = preferredOrder.has(left.featureKey) ? preferredOrder.get(left.featureKey) : Number.MAX_SAFE_INTEGER;
    const rightIndex = preferredOrder.has(right.featureKey) ? preferredOrder.get(right.featureKey) : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return String(left.frontend?.navigationLabel || left.entityName || '').localeCompare(
      String(right.frontend?.navigationLabel || right.entityName || '')
    );
  });
}

function buildProjectTemplateBlueprintDoc(projectName, projectTemplate, routeSpecs) {
  const capabilities = (projectTemplate?.coreCapabilities || []).map((item) => `- ${item}`).join('\n') || '- Sem capacidades registradas.';
  const featureLines =
    routeSpecs
      .map((spec) => `- ${spec.frontend.navigationLabel || spec.entityName}: ${spec.frontend.suggestedRoute} (${spec.featureKey})`)
      .join('\n') || '- Nenhuma feature inicial materializada.';

  const content = `# Blueprint Inicial - ${projectName}

## Template

- Chave: ${projectTemplate?.templateKey || 'project/generic-saas'}
- Label: ${projectTemplate?.label || projectName}
- Dominio: ${projectTemplate?.domain || 'generic'}
- Home: ${projectTemplate?.frontend?.homeLabel || 'Workspace do produto'}
- Navegacao: ${projectTemplate?.frontend?.navigationStyle || 'generic-suite'}
- Tom visual: ${projectTemplate?.frontend?.visualTone || 'profissional'}

## Posicionamento

${projectTemplate?.positioning || projectTemplate?.summary || 'Blueprint generico do produto.'}

## Capacidades nucleares

${capabilities}

## Features materializadas no bootstrap

${featureLines}
`;

  return {
    relativePath: 'docs/project-blueprint.md',
    content,
    fileType: 'md',
  };
}

function buildAppCompositionManifest({ project, generatedApp, routeSpecs = [], projectTemplate = null }) {
  const sortedRouteSpecs = sortRouteSpecsByProjectTemplate(routeSpecs, projectTemplate);
  const visualTone = projectTemplate?.frontend?.visualTone || 'profissional';
  const navigationStyle = projectTemplate?.frontend?.navigationStyle || 'generic-suite';
  const homeLabel = projectTemplate?.frontend?.homeLabel || 'Workspace do produto';
  const projectDna = project?.intakeConfig?.projectDna || null;
  const productMode = projectDna?.project?.productMode || null;
  const experienceStyle = projectDna?.project?.experienceStyle || null;
  const shell = resolveProjectShell({ projectTemplate, projectDna });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    project: {
      uuid: project?.uuid || null,
      name: project?.name || null,
      slug: project?.slug || null,
      generatedAppUuid: generatedApp?.uuid || null,
    },
    identity: {
      homeLabel,
      navigationStyle,
      visualTone,
      productMode,
      experienceStyle,
    },
    frontend: {
      shell: {
        shellKey: shell.key,
        family: shell.family,
        label: shell.label,
        frame: shell.frame,
        header: shell.header,
        sidebar: shell.sidebar,
      },
      routes: sortedRouteSpecs.map((spec) => ({
        featureKey: spec.featureKey,
        path: spec.frontend?.suggestedRoute || null,
        label: spec.frontend?.navigationLabel || spec.entityName || spec.featureKey,
        pageComponentName: spec.frontend?.pageComponentName || null,
        uiFamily: inferUiFamilyFromSpec(spec, spec.implementationManifest || null),
      })),
    },
    backend: {
      healthRoute: '/health',
      routes: sortedRouteSpecs.map((spec) => ({
        featureKey: spec.featureKey,
        routeBase: spec.backend?.routeBase || null,
        routerName: spec.backend?.routerName || null,
      })),
    },
  };
}

async function getTaskWithArtifactsOrThrow(taskUuid) {
  const task = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    include: {
      project: {
        select: {
          id: true,
          uuid: true,
          name: true,
          slug: true,
          description: true,
          vision: true,
          templateKey: true,
          intakeConfig: true,
          creator: {
            select: {
              uuid: true,
            },
          },
        },
      },
      artifacts: {
        where: { isCurrent: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    throw new Error('Tarefa n?o encontrada.');
  }

  return task;
}

function buildImplementationManifest(task, technicalSpec) {
  const currentArtifacts = task?.artifacts || [];
  const requirementSpec = parseJsonArtifactContent(
    currentArtifacts.find((artifact) => artifact.title === '[SYSTEM] Requirement Spec' && artifact.isCurrent)
  );
  const testSpec = parseJsonArtifactContent(
    currentArtifacts.find((artifact) => artifact.title === '[SYSTEM] Test Spec' && artifact.isCurrent)
  );
  const execution = resolveImplementationExecutionMode(task, technicalSpec);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'implementation_planner',
    task: {
      uuid: task.uuid,
      title: task.title,
      description: task.description || null,
    },
    project: {
      uuid: task.project?.uuid || null,
      name: task.project?.name || null,
      slug: task.project?.slug || null,
    },
    upstreamContracts: {
      projectDna: task.project?.intakeConfig?.projectDna || null,
      requirementSpec,
      testSpec,
    },
    classification: {
      featureKey: technicalSpec.featureKey,
      domain: technicalSpec.structured?.classification?.domain || technicalSpec.featureKey,
      entityName: technicalSpec.entityName,
      intent: technicalSpec.structured?.classification?.intent || null,
      templateKey: technicalSpec.structured?.classification?.templateKey || null,
      screenTemplate:
        technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud',
      productMode: technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || null,
      uiFamily: inferUiFamilyFromSpec(technicalSpec),
    },
    objective: technicalSpec.implementationObjective || null,
    routes: {
      frontend: technicalSpec.frontend?.suggestedRoute || null,
      backend: technicalSpec.backend?.routeBase || null,
    },
    contracts: {
      request: technicalSpec.shared?.requestContractName || null,
      response: technicalSpec.shared?.responseContractName || null,
      sharedContractPath: technicalSpec.shared?.contractPath || null,
    },
    files: technicalSpec.files || null,
    frontend: {
      featurePath: technicalSpec.frontend?.featurePath || null,
      pageTitle: technicalSpec.frontend?.pageTitle || null,
      navigationLabel: technicalSpec.frontend?.navigationLabel || null,
      componentMap: technicalSpec.generationIR?.frontend?.screenSpec?.componentMap || null,
      screenSpec: technicalSpec.generationIR?.frontend?.screenSpec || null,
      dataSpec: technicalSpec.generationIR?.frontend?.dataSpec || null,
    },
    backend: {
      modulePath: technicalSpec.backend?.modulePath || null,
      routerName: technicalSpec.backend?.routerName || null,
      serviceName: technicalSpec.backend?.serviceInstanceName || null,
      operationMap: technicalSpec.generationIR?.backend?.moduleSpec?.operationMap || null,
      moduleSpec: technicalSpec.generationIR?.backend?.moduleSpec || null,
      testExpectations: testSpec || null,
    },
    architecture: {
      sourceSummary: technicalSpec.architecture?.sourceSummary || null,
    },
    execution,
    qualityTargets: {
      reviewScore: 85,
      validationScore: 80,
      specialistApproval: true,
    },
  };

  manifest.autonomousAgent = buildAutonomousImplementationContract(task, technicalSpec, manifest);
  return manifest;
}

function applyAutonomousImplementationDraft(technicalSpec, autonomousDraft) {
  if (!autonomousDraft || typeof autonomousDraft !== 'object') {
    return technicalSpec;
  }

  const frontend = autonomousDraft.frontend && typeof autonomousDraft.frontend === 'object' ? autonomousDraft.frontend : {};
  const backend = autonomousDraft.backend && typeof autonomousDraft.backend === 'object' ? autonomousDraft.backend : {};
  const shared = autonomousDraft.shared && typeof autonomousDraft.shared === 'object' ? autonomousDraft.shared : {};
  const materialization = autonomousDraft.materialization && typeof autonomousDraft.materialization === 'object'
    ? autonomousDraft.materialization
    : null;
  const preservedPageTemplate = shouldPreserveExistingFrontendPageTemplate({
    technicalSpec,
    existingTemplate: technicalSpec.frontend?.autonomousPageTsxTemplate,
    candidateTemplate: frontend.pageTsxTemplate,
    candidateSource: frontend.fileSources?.pageTsxTemplate || null,
  })
    ? technicalSpec.frontend?.autonomousPageTsxTemplate
    : null;
  const nextFrontendFileSources =
    frontend.fileSources && typeof frontend.fileSources === 'object'
      ? {
          ...(technicalSpec.frontend?.autonomousFileSources || {}),
          ...frontend.fileSources,
        }
      : technicalSpec.frontend?.autonomousFileSources || null;

  if (preservedPageTemplate && nextFrontendFileSources) {
    nextFrontendFileSources.pageTsxTemplate = 'workspace_preserved';
  }

  return {
    ...technicalSpec,
    frontend: {
      ...technicalSpec.frontend,
      heroEyebrow: frontend.heroEyebrow || technicalSpec.frontend?.heroEyebrow,
      heroTitle: frontend.heroTitle || technicalSpec.frontend?.heroTitle || technicalSpec.frontend?.pageTitle,
      heroDescription: frontend.heroDescription || technicalSpec.frontend?.heroDescription || technicalSpec.frontend?.pageDescription,
      formCardTitle: frontend.formCardTitle || technicalSpec.frontend?.formCardTitle,
      formCardDescription: frontend.formCardDescription || technicalSpec.frontend?.formCardDescription,
      recordsTitle: frontend.recordsTitle || technicalSpec.frontend?.recordsTitle,
      recordsEmptyState: frontend.recordsEmptyState || technicalSpec.frontend?.recordsEmptyState,
      highlights: Array.isArray(frontend.highlights) ? frontend.highlights : technicalSpec.frontend?.highlights,
      pageArchetype: frontend.pageArchetype || technicalSpec.frontend?.pageArchetype,
      fallbackPattern: frontend.fallbackPattern || technicalSpec.frontend?.fallbackPattern,
      sections: Array.isArray(frontend.sections) ? frontend.sections : technicalSpec.frontend?.sections,
      autonomousPageTsxTemplate:
        preservedPageTemplate ||
        frontend.pageTsxTemplate ||
        technicalSpec.frontend?.autonomousPageTsxTemplate ||
        null,
      autonomousServiceTsTemplate: frontend.serviceTsTemplate || technicalSpec.frontend?.autonomousServiceTsTemplate || null,
      autonomousIndexTsTemplate: frontend.indexTsTemplate || technicalSpec.frontend?.autonomousIndexTsTemplate || null,
      componentMap:
        frontend.componentMap && typeof frontend.componentMap === 'object'
          ? {
              ...(technicalSpec.frontend?.componentMap || {}),
              ...frontend.componentMap,
            }
          : technicalSpec.frontend?.componentMap,
      layoutVariant: frontend.layoutVariant || technicalSpec.frontend?.layoutVariant,
      autonomousFileSources: nextFrontendFileSources,
      autonomousGenerationSource:
        autonomousDraft.generationSource ||
        materialization?.generationSource ||
        technicalSpec.frontend?.autonomousGenerationSource ||
        null,
      autonomousVariationProfile:
        autonomousDraft.variationProfile ||
        materialization?.variationProfile ||
        technicalSpec.frontend?.autonomousVariationProfile ||
        null,
      autonomousCompositionSignature:
        autonomousDraft.compositionSignature ||
        technicalSpec.frontend?.autonomousCompositionSignature ||
        null,
      autonomousDraft,
    },
    backend: {
      ...technicalSpec.backend,
      autonomousGuidance: backend,
      autonomousServiceTsTemplate: backend.serviceTsTemplate || technicalSpec.backend?.autonomousServiceTsTemplate || null,
      autonomousRouterTsTemplate: backend.routerTsTemplate || technicalSpec.backend?.autonomousRouterTsTemplate || null,
      autonomousIndexTsTemplate: backend.indexTsTemplate || technicalSpec.backend?.autonomousIndexTsTemplate || null,
      autonomousFileSources: backend.fileSources || technicalSpec.backend?.autonomousFileSources || null,
    },
    shared: {
      ...technicalSpec.shared,
      autonomousGuidance: shared,
    },
    autonomousExecution: autonomousDraft,
    autonomousMaterialization: materialization,
  };
}

async function runSubAgentImplementationPipeline(task, technicalSpec, implementationManifest, userUuid = null, repairContext = null) {
  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);

  const payload = {
    project_id: task.project?.uuid,
    task_uuid: task.uuid,
    idea: task.title,
    implementation_manifest: implementationManifest,
    technical_spec: technicalSpec,
    current_implementation_context: currentImplementationContext,
    requirement_spec: implementationManifest?.upstreamContracts?.requirementSpec || null,
    test_spec: implementationManifest?.upstreamContracts?.testSpec || null,
    architecture: technicalSpec?.architecture?.sourceSummary || null,
    repair_context: compactRepairContext(repairContext, currentImplementationContext),
  };

  const envOverrides = userUuid
    ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'implementation_autonomous_agent' })
    : {};

  // O runImplementationPipeline orquestra o fluxo sequencial: Schema -> Backend -> Frontend
  return runImplementationPipeline(payload, { envOverrides });
}

function buildSchemaAgentSeedFromTechnicalSpec(technicalSpec = {}) {
  return {
    entityName: technicalSpec?.entityName || technicalSpec?.database?.modelName || 'GeneratedItem',
    prismaFields: Array.isArray(technicalSpec?.database?.fields)
      ? technicalSpec.database.fields.map((field) => ({
          name: field.name,
          type: field.prismaType || field.tsType || 'String',
          required: field.required !== false,
          default: field.defaultValue ?? null,
        }))
      : [],
    contracts: {
      request: technicalSpec?.shared?.requestContractName || null,
      response: technicalSpec?.shared?.responseContractName || null,
      list: technicalSpec?.shared?.listContractName || null,
    },
    domainSummary: technicalSpec?.summary || null,
  };
}

function resolveRepairExecutor(repairContext = {}) {
  return (
    repairContext?.adaptiveDirective?.nextExecutor ||
    resolveRepairExecutorByFailureSignature(repairContext)
  );
}

async function runFrontendRepairAgent(task, technicalSpec, implementationManifest, userUuid = null, repairContext = null) {
  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);
  const payload = {
    project_id: task.project?.uuid,
    task_uuid: task.uuid,
    idea: task.title,
    technical_spec: technicalSpec,
    frontend_spec: technicalSpec?.frontend || {},
    schema_output: buildSchemaAgentSeedFromTechnicalSpec(technicalSpec),
    current_implementation_context: currentImplementationContext,
    repair_context: compactRepairContext(repairContext, currentImplementationContext),
  };
  const envOverrides = userUuid
    ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'frontend_agent' })
    : {};
  const draft = await runSingleAgent('frontend_agent', payload, { envOverrides });
  if (!draft || typeof draft !== 'object') return null;
  return {
    frontend: {
      ...draft,
      fileSources: {
        pageTsxTemplate: 'llm_primary',
        serviceTsTemplate: 'llm_primary',
        indexTsTemplate: 'llm_primary',
      },
    },
    generationSource: 'frontend_agent_repair',
    materialization: {
      generationSource: 'frontend_agent_repair',
      llmFileCount: 3,
      fallbackFileCount: 0,
    },
  };
}

async function runUiUxSpecialistAgent(task, technicalSpec, userUuid = null, repairContext = null, options = {}) {
  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);
  const payload = {
    project_id: task.project?.uuid,
    task_uuid: task.uuid,
    idea: task.title,
    technical_spec: technicalSpec,
    frontend_spec: technicalSpec?.frontend || {},
    design_reference: (buildUiGenerationContext(task, technicalSpec, repairContext) || {}).designReference || {},
    current_implementation_context: currentImplementationContext,
    repair_context: compactRepairContext(repairContext, currentImplementationContext),
  };
  const envOverrides = userUuid
    ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'ui_ux_specialist' })
    : {};
  const draft = await runSingleAgent('ui_ux_specialist', payload, { envOverrides });
  if (!draft || typeof draft !== 'object') return null;
  return draft;
}

async function runBackendRepairAgent(task, technicalSpec, implementationManifest, userUuid = null, repairContext = null) {
  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);
  const payload = {
    project_id: task.project?.uuid,
    task_uuid: task.uuid,
    idea: task.title,
    technical_spec: technicalSpec,
    backend_spec: {
      ...(technicalSpec?.backend || {}),
      testExpectations: implementationManifest?.upstreamContracts?.testSpec || technicalSpec?.backend?.testExpectations || null,
    },
    schema_output: buildSchemaAgentSeedFromTechnicalSpec(technicalSpec),
    current_implementation_context: currentImplementationContext,
    repair_context: compactRepairContext(repairContext, currentImplementationContext),
    test_expectations: implementationManifest?.upstreamContracts?.testSpec || null,
  };
  const envOverrides = userUuid
    ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'backend_agent' })
    : {};
  const draft = await runSingleAgent('backend_agent', payload, { envOverrides });
  if (!draft || typeof draft !== 'object') return null;
  return {
    backend: {
      ...draft,
      fileSources: {
        serviceTsTemplate: 'llm_primary',
        routerTsTemplate: 'llm_primary',
        indexTsTemplate: 'llm_primary',
      },
    },
    generationSource: 'backend_agent_repair',
    materialization: {
      generationSource: 'backend_agent_repair',
      llmFileCount: 3,
      fallbackFileCount: 0,
    },
  };
}

async function runAutonomousImplementationAgent(task, technicalSpec, implementationManifest, userUuid = null, repairContext = null) {
  if (implementationManifest?.execution?.mode !== 'autonomous') {
    return null;
  }

  // Feature Toggle para usar a nova pipeline de sub-agentes
  if (process.env.FEATURE_SUB_AGENTS === 'true' || process.env.FEATURE_SUB_AGENTS === '1') {
    return runSubAgentImplementationPipeline(task, technicalSpec, implementationManifest, userUuid, repairContext);
  }

  const currentImplementationContext = buildAutonomousCurrentImplementationContext(technicalSpec);

  const payload = {
    project_id: task.project?.uuid,
    task_uuid: task.uuid,
    idea: task.title,
    implementation_manifest: implementationManifest,
    technical_spec: technicalSpec,
    current_implementation_context: currentImplementationContext,
    requirement_spec: implementationManifest?.upstreamContracts?.requirementSpec || null,
    test_spec: implementationManifest?.upstreamContracts?.testSpec || null,
    architecture: technicalSpec?.architecture?.sourceSummary || null,
    repair_context: compactRepairContext(repairContext, currentImplementationContext),
  };

  const envOverrides = userUuid
    ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'implementation_autonomous_agent' })
    : {};

  return runSingleAgent('implementation_autonomous_agent', payload, { envOverrides });
}

async function runRepairExecutionAgent(task, technicalSpec, implementationManifest, userUuid = null, repairContext = null) {
  const executor = repairContext?.enforcementDirective?.nextExecutor || resolveRepairExecutor(repairContext);

  if (executor === 'sub_agent_pipeline') {
    return runSubAgentImplementationPipeline(task, technicalSpec, implementationManifest, userUuid, repairContext);
  }

  if (executor === 'frontend_agent') {
    const frontendDraft = await runFrontendRepairAgent(task, technicalSpec, implementationManifest, userUuid, repairContext);
    if (frontendDraft) return frontendDraft;
  }

  if (executor === 'backend_agent') {
    const backendDraft = await runBackendRepairAgent(task, technicalSpec, implementationManifest, userUuid, repairContext);
    if (backendDraft) return backendDraft;
  }

  return runAutonomousImplementationAgent(task, technicalSpec, implementationManifest, userUuid, repairContext);
}

function buildAutonomousCurrentImplementationContext(technicalSpec = {}) {
  const frontend = technicalSpec?.frontend || {};
  const backend = technicalSpec?.backend || {};
  const autonomousMaterialization = technicalSpec?.autonomousMaterialization || {};
  const autonomousExecution = technicalSpec?.autonomousExecution || {};

  return {
    featureKey: technicalSpec?.featureKey || null,
    generationSource:
      autonomousMaterialization?.generationSource ||
      frontend?.autonomousGenerationSource ||
      autonomousExecution?.generationSource ||
      null,
    variationProfile:
      autonomousMaterialization?.variationProfile ||
      frontend?.autonomousVariationProfile ||
      autonomousExecution?.variationProfile ||
      null,
    compositionSignature:
      frontend?.autonomousCompositionSignature ||
      autonomousExecution?.compositionSignature ||
      null,
    frontend: {
      layoutVariant: frontend?.layoutVariant || null,
      pageArchetype: frontend?.pageArchetype || null,
      sections: Array.isArray(frontend?.sections) ? frontend.sections : [],
      highlights: Array.isArray(frontend?.highlights) ? frontend.highlights : [],
      fileSources: frontend?.autonomousFileSources || null,
      files: {
        pageTsxTemplate: frontend?.autonomousPageTsxTemplate || null,
        serviceTsTemplate: frontend?.autonomousServiceTsTemplate || null,
        indexTsTemplate: frontend?.autonomousIndexTsTemplate || null,
      },
    },
    backend: {
      fileSources: backend?.autonomousFileSources || null,
      notes: Array.isArray(backend?.autonomousGuidance?.notes) ? backend.autonomousGuidance.notes : [],
      files: {
        serviceTsTemplate: backend?.autonomousServiceTsTemplate || null,
        routerTsTemplate: backend?.autonomousRouterTsTemplate || null,
        indexTsTemplate: backend?.autonomousIndexTsTemplate || null,
      },
    },
  };
}

async function loadProjectCoherenceContracts(projectId) {
  const systemTasks = await prisma.task.findMany({
    where: {
      projectId,
      title: {
        in: ['[SYSTEM] Backlog Master', '[SYSTEM] Architecture Master'],
      },
    },
    select: {
      title: true,
      artifacts: {
        where: { isCurrent: true },
        orderBy: { createdAt: 'desc' },
        select: {
          title: true,
          artifactType: true,
          content: true,
          isApproved: true,
        },
      },
    },
  });

  const backlogTask = systemTasks.find((task) => task.title === '[SYSTEM] Backlog Master');
  const architectureTask = systemTasks.find((task) => task.title === '[SYSTEM] Architecture Master');

  return {
    backlogContract: parseJsonArtifactContent(
      backlogTask?.artifacts?.find((artifact) => artifact.title === '[SYSTEM] Backlog Contract')
    ),
    architectureArtifact: architectureTask?.artifacts?.find((artifact) => artifact.artifactType === 'architecture') || null,
  };
}

function buildCoherenceReport(task, technicalSpec, implementationManifest, coherenceContracts = {}) {
  const requirementSpec = implementationManifest?.upstreamContracts?.requirementSpec || null;
  const testSpec = implementationManifest?.upstreamContracts?.testSpec || null;
  const projectDna = implementationManifest?.upstreamContracts?.projectDna || null;
  const backlogContract = coherenceContracts.backlogContract || null;
  const architectureArtifact = coherenceContracts.architectureArtifact || null;
  const domainLanguage = Array.isArray(projectDna?.project?.domainLanguage) ? projectDna.project.domainLanguage : [];
  const normalizedDomainTerms = domainLanguage.map((term) => normalizeSemanticText(term)).filter(Boolean);

  const taskTokens = new Set(
    normalizeSemanticText(task.title)
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  );
  const isBacklogStoryMatch = (storyTitle = '') => {
    const normalizedStoryTitle = normalizeSemanticText(storyTitle);
    const normalizedTaskTitle = normalizeSemanticText(task.title);

    if (!normalizedStoryTitle) return false;
    if (normalizedStoryTitle === normalizedTaskTitle) return true;
    if (normalizedStoryTitle.includes(normalizedTaskTitle) || normalizedTaskTitle.includes(normalizedStoryTitle)) {
      return true;
    }

    const storyTokens = new Set(
      normalizedStoryTitle
        .split(/\s+/)
        .filter((token) => token.length >= 4)
    );
    if (!storyTokens.size || !taskTokens.size) return false;

    let intersection = 0;
    for (const token of storyTokens) {
      if (taskTokens.has(token)) intersection += 1;
    }

    const overlap = intersection / Math.max(storyTokens.size, taskTokens.size);
    return overlap >= 0.6;
  };

  const taskInBacklog = Boolean(
    backlogContract?.stories?.some((story) => isBacklogStoryMatch(story.title))
  );

  const semanticCorpus = normalizeSemanticText(
    [
      task.title,
      task.description,
      requirementSpec?.userStory,
      ...(requirementSpec?.functionalRequirements || []),
      ...(requirementSpec?.businessRules || []),
      ...(testSpec?.scenarios || []),
      ...(testSpec?.functionalCases || []),
      technicalSpec.featureKey,
      technicalSpec.backend?.routeBase,
      technicalSpec.frontend?.suggestedRoute,
      technicalSpec.summary,
    ]
      .flat()
      .filter(Boolean)
      .join('\n')
  );

  const matchedDomainTerms = normalizedDomainTerms.filter((term) => semanticCorpus.includes(term));
  const missingDomainTerms = normalizedDomainTerms.filter((term) => !matchedDomainTerms.includes(term));

  const allowedScreenFamilies = Array.isArray(projectDna?.designSystem?.allowedScreenFamilies)
    ? projectDna.designSystem.allowedScreenFamilies
    : [];
  const actualUiFamily = inferUiFamilyFromSpec(technicalSpec, implementationManifest);
  const actualScreenTemplate =
    implementationManifest?.classification?.screenTemplate ||
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    null;
  const screenFamilyMatch = !allowedScreenFamilies.length || allowedScreenFamilies.includes(actualUiFamily);

  const expectedProductMode = projectDna?.project?.productMode || null;
  const actualProductMode = implementationManifest?.classification?.productMode || null;
  const productModeMatch = !expectedProductMode || !actualProductMode || expectedProductMode === actualProductMode;

  const driftFlags = [];
  if (!projectDna) {
    driftFlags.push({ severity: 'high', code: 'missing_project_dna', message: 'Project DNA ausente para a task.' });
  }
  if (!backlogContract) {
    driftFlags.push({ severity: 'medium', code: 'missing_backlog_contract', message: 'Backlog Contract ausente no projeto.' });
  }
  if (!taskInBacklog) {
    driftFlags.push({ severity: 'medium', code: 'task_not_in_backlog_contract', message: 'A task atual nao foi localizada no Backlog Contract.' });
  }
  if (!requirementSpec) {
    driftFlags.push({ severity: 'high', code: 'missing_requirement_spec', message: 'Requirement Spec ausente para a task.' });
  }
  if (!testSpec) {
    driftFlags.push({ severity: 'high', code: 'missing_test_spec', message: 'Test Spec ausente para a task.' });
  }
  if (!architectureArtifact?.content) {
    driftFlags.push({ severity: 'high', code: 'missing_architecture', message: 'Arquitetura atual do projeto nao esta disponivel.' });
  }
  if (normalizedDomainTerms.length && !matchedDomainTerms.length) {
    driftFlags.push({
      severity: 'high',
      code: 'domain_language_missing',
      message: 'O dominio inferido para a implementacao nao preserva a linguagem central do projeto.',
    });
  }
  if (!screenFamilyMatch) {
    driftFlags.push({
      severity: 'medium',
      code: 'ui_family_outside_dna',
      message: `A familia visual ${actualUiFamily || 'indefinida'} nao pertence as familias previstas no Project DNA.`,
    });
  }
  if (!productModeMatch) {
    driftFlags.push({
      severity: 'medium',
      code: 'product_mode_mismatch',
      message: `O product mode ${actualProductMode || 'indefinido'} diverge do esperado ${expectedProductMode}.`,
    });
  }

  const status = driftFlags.some((flag) => flag.severity === 'high')
    ? 'blocked'
    : driftFlags.length
      ? 'warning'
      : 'approved';

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stage: 'pre_implementation_planning',
    status,
    task: {
      uuid: task.uuid,
      title: task.title,
    },
    alignment: {
      taskInBacklog,
      productMode: {
        expected: expectedProductMode,
        actual: actualProductMode,
        match: productModeMatch,
      },
      screenTemplate: {
        allowed: allowedScreenFamilies,
        actual: actualScreenTemplate,
      },
      uiFamily: {
        allowed: allowedScreenFamilies,
        actual: actualUiFamily,
        match: screenFamilyMatch,
      },
      domainLanguage: {
        expected: domainLanguage,
        matched: matchedDomainTerms,
        missing: missingDomainTerms,
      },
      routes: {
        frontend: implementationManifest?.routes?.frontend || null,
        backend: implementationManifest?.routes?.backend || null,
      },
    },
    upstreamContracts: {
      hasProjectDna: Boolean(projectDna),
      hasBacklogContract: Boolean(backlogContract),
      hasRequirementSpec: Boolean(requirementSpec),
      hasTestSpec: Boolean(testSpec),
      hasArchitecture: Boolean(architectureArtifact?.content),
    },
    driftFlags,
  };
}

async function ensureDevelopmentStageTask(projectId) {
  let task = await prisma.task.findFirst({
    where: {
      projectId,
      taskType: 'agent_job',
      title: '[SYSTEM] Development Master',
    },
    select: { id: true, uuid: true, title: true },
  });

  if (task) return task;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { creator: { select: { id: true } } },
  });

  if (!project) {
    throw new Error('Projeto nao encontrado ao criar task de sistema.');
  }

  task = await prisma.task.create({
    data: {
      uuid: randomUUID(),
      projectId,
      title: '[SYSTEM] Development Master',
      description: 'Artefatos tecnicos consolidados do pipeline de implementacao.',
      taskType: 'agent_job',
      status: 'done',
      priority: 'medium',
      assigneeType: 'agent',
      assigneeAgentName: 'developer',
      createdBy: project.creator.id,
    },
    select: { id: true, uuid: true, title: true },
  });

  return task;
}

function resolveImplementationUserUuid(task, explicitUserUuid = null) {
  if (explicitUserUuid) return explicitUserUuid;
  return task?.project?.creator?.uuid || null;
}

function inferFieldDefinitions(sourceText, actionSpec = null) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec?.domainKey === 'visit-operational-responsibles') {
    return [
      {
        name: 'responsibleName',
        label: 'Nome do responsavel operacional',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe o nome de quem apoia a operacao desta visita.',
        placeholder: 'Ex.: Joao Silva',
        defaultValue: '',
        sampleValue: 'Joao Silva',
        validations: ['required', 'min:3'],
      },
      {
        name: 'contact',
        label: 'Contato',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Registre um e-mail ou telefone com DDD para acionamento rapido.',
        placeholder: 'joao@empresa.com ou (11) 98765-4321',
        defaultValue: '',
        sampleValue: 'joao@empresa.com',
        validations: ['required', 'contact'],
      },
      {
        name: 'supportType',
        label: 'Tipo de suporte',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Selecione o tipo principal de apoio prestado por este responsavel.',
        placeholder: 'tecnico | logistica | seguranca | apoio',
        defaultValue: 'tecnico',
        sampleValue: 'seguranca',
        selectOptions: ['tecnico', 'logistica', 'seguranca', 'apoio'],
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'visit-recurring-history') {
    return [
      {
        name: 'clientIdentifier',
        label: 'Identificador do cliente',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe CPF, CNPJ ou ID do cliente para localizar visitas anteriores.',
        placeholder: 'CPF, CNPJ ou ID do cliente',
        defaultValue: '',
        sampleValue: '12345678909',
        validations: ['required', 'min:5'],
      },
      {
        name: 'periodRange',
        label: 'Periodo',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina o recorte temporal usado para consultar o historico recorrente.',
        placeholder: 'ultimos_3_meses | ultimos_6_meses | ultimos_12_meses',
        defaultValue: 'ultimos_12_meses',
        sampleValue: 'ultimos_12_meses',
        selectOptions: ['ultimos_3_meses', 'ultimos_6_meses', 'ultimos_12_meses'],
        validations: ['required'],
      },
      {
        name: 'visitStatus',
        label: 'Status da visita',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Mostre apenas visitas realmente aproveitaveis para o novo agendamento.',
        placeholder: 'realizada | concluida',
        defaultValue: 'realizada',
        sampleValue: 'concluida',
        selectOptions: ['realizada', 'concluida'],
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'visit-intake') {
    return [
      {
        name: 'visitName',
        label: 'Nome da visita',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe um nome claro para identificar esta visita no fluxo operacional.',
        placeholder: 'Ex.: Reuniao com fornecedor internacional',
        defaultValue: '',
        sampleValue: 'Reuniao com fornecedor internacional',
        validations: ['required', 'min:3'],
      },
      {
        name: 'visitPurpose',
        label: 'Objetivo da visita',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Resuma o objetivo principal para orientar triagem e aprovacao inicial.',
        placeholder: 'Ex.: Alinhamento comercial e visita tecnica',
        defaultValue: '',
        sampleValue: 'Alinhamento comercial e visita tecnica',
        validations: ['required', 'min:5'],
      },
      {
        name: 'scheduledDate',
        label: 'Data da visita',
        inputType: 'date',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina a data prevista para iniciar o fluxo principal de atendimento da visita.',
        placeholder: '2026-04-20',
        defaultValue: '',
        sampleValue: '2026-04-20',
        validations: ['required'],
      },
      {
        name: 'initialContext',
        label: 'Contexto inicial',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Registre o contexto inicial minimo para que recepcao e operacao entendam a solicitacao.',
        placeholder: 'Descreva quem vem, o motivo da visita e qualquer observacao relevante.',
        defaultValue: '',
        sampleValue: 'Fornecedor estrangeiro vem apresentar proposta comercial e precisa de acesso a sala de reuniao.',
        validations: ['required', 'min:15'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'visit-extra-companions') {
    return [
      {
        name: 'approvedVisitCode',
        label: 'Visita aprovada',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe o identificador da visita ja aprovada para vincular o acompanhante extra ao registro correto.',
        placeholder: 'Ex.: VIS-2026-0142',
        defaultValue: '',
        sampleValue: 'VIS-2026-0142',
        validations: ['required', 'min:5'],
      },
      {
        name: 'companionName',
        label: 'Nome do acompanhante',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Registre o nome de quem sera incluído na mesma visita aprovada.',
        placeholder: 'Ex.: Ana Beatriz Lopes',
        defaultValue: '',
        sampleValue: 'Ana Beatriz Lopes',
        validations: ['required', 'min:3'],
      },
      {
        name: 'securityFastApproval',
        label: 'Aprovacao rapida da seguranca',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Indique a decisao rapida da seguranca para liberar a inclusao sem reiniciar o fluxo completo.',
        placeholder: 'pendente | aprovado',
        defaultValue: 'pendente',
        sampleValue: 'aprovado',
        selectOptions: ['pendente', 'aprovado'],
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'visit-approval-cutoff-settings') {
    return [
      {
        name: 'cutoffTime',
        label: 'Horario limite',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Use o formato HH:MM para definir o horario limite diario.',
        placeholder: '17:00',
        defaultValue: '17:00',
        sampleValue: '17:00',
        validations: ['required', 'time_hhmm'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'event-schedules') {
    return [
      {
        name: 'stageName',
        label: 'Etapa do cronograma',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Nomeie a etapa principal para deixar o plano facil de acompanhar.',
        placeholder: 'Ex.: Confirmacao de fornecedores',
        defaultValue: '',
        sampleValue: 'Confirmacao de fornecedores',
        validations: ['required', 'min:3'],
      },
      {
        name: 'plannedDeadline',
        label: 'Prazo planejado',
        inputType: 'date',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina a data alvo dessa etapa para dar previsibilidade ao time.',
        placeholder: '2026-04-20',
        defaultValue: '',
        sampleValue: '2026-04-20',
        validations: ['required'],
      },
      {
        name: 'executionNotes',
        label: 'Notas operacionais',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Registre o contexto minimo da etapa para facilitar a execucao e o handoff.',
        placeholder: 'Dependencias, criterio de prontidao e observacoes importantes.',
        defaultValue: '',
        sampleValue: 'Confirmar briefing final e checklist de liberacao antes de acionar o fornecedor.',
        validations: ['required', 'min:10'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'event-suppliers') {
    return [
      {
        name: 'supplierName',
        label: 'Nome do fornecedor',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: true,
        helperText: 'Use o nome comercial do parceiro para facilitar busca e reutilizacao em novos eventos.',
        placeholder: 'Ex.: Buffet Sabor & Arte',
        defaultValue: '',
        sampleValue: 'Buffet Sabor & Arte',
        validations: ['required', 'min:3'],
      },
      {
        name: 'serviceCategory',
        label: 'Categoria de servico',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Classifique o tipo principal de servico que este fornecedor entrega.',
        placeholder: 'buffet | audiovisual | brindes | recepcao',
        defaultValue: 'buffet',
        sampleValue: 'audiovisual',
        selectOptions: ['buffet', 'audiovisual', 'brindes', 'recepcao', 'cenografia', 'transporte', 'outro'],
        validations: ['required'],
      },
      {
        name: 'primaryContacts',
        label: 'Contatos principais',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Registre pelo menos um contato com nome, canal e referencia para acionamento rapido.',
        placeholder: 'Nome | cargo | telefone | e-mail',
        defaultValue: '',
        sampleValue: 'Marina Costa | Comercial | (11) 99999-1111 | marina@fornecedor.com',
        validations: ['required', 'min:10'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'support-ticket-attachments') {
    return [
      {
        name: 'documentType',
        label: 'Tipo de documento',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Classifique o anexo para facilitar a triagem do chamado.',
        placeholder: 'nota_fiscal | comprovante | recibo | contrato',
        defaultValue: 'nota_fiscal',
        sampleValue: 'comprovante',
        selectOptions: ['nota_fiscal', 'comprovante', 'recibo', 'contrato', 'outro'],
        validations: ['required'],
      },
      {
        name: 'documentDescription',
        label: 'Descricao do anexo',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Explique rapidamente por que este documento ajuda no atendimento.',
        placeholder: 'Descreva o conteudo do documento e o contexto do chamado',
        defaultValue: '',
        sampleValue: 'Comprovante referente ao pagamento associado ao chamado aberto pelo financeiro.',
        validations: ['required', 'min:10'],
      },
      {
        name: 'fileUrl',
        label: 'Arquivo ou link do comprovante',
        inputType: 'url',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.',
        placeholder: 'https://arquivos.empresa.com/documentos/comprovante.pdf',
        defaultValue: '',
        sampleValue: 'https://arquivos.empresa.com/documentos/comprovante.pdf',
        validations: ['required', 'url'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'support-performance-dashboard') {
    return [
      {
        name: 'categoryFilter',
        label: 'Categoria',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Escolha a categoria principal para analisar o volume de chamados.',
        placeholder: 'financeiro | acesso | geral',
        defaultValue: 'geral',
        sampleValue: 'financeiro',
        selectOptions: ['geral', 'financeiro', 'acesso', 'infraestrutura', 'comercial'],
        validations: ['required'],
      },
      {
        name: 'statusFilter',
        label: 'Status',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina qual status deve ganhar protagonismo na leitura do painel.',
        placeholder: 'aberto | em_atendimento | resolvido',
        defaultValue: 'aberto',
        sampleValue: 'em_atendimento',
        selectOptions: ['aberto', 'em_atendimento', 'aguardando', 'resolvido'],
        validations: ['required'],
      },
      {
        name: 'timeRange',
        label: 'Periodo',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Selecione o periodo usado para consolidar os indicadores.',
        placeholder: 'ultimos_7_dias | mes_atual | ultimos_30_dias',
        defaultValue: 'ultimos_7_dias',
        sampleValue: 'ultimos_30_dias',
        selectOptions: ['ultimos_7_dias', 'mes_atual', 'ultimos_30_dias', 'trimestre'],
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'course-catalog') {
    return [
      {
        name: 'courseName',
        label: 'Nome do curso',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe um nome claro para identificar o curso.',
        placeholder: 'Ex.: Dominando React do zero',
        defaultValue: '',
        sampleValue: 'Dominando React do zero',
        validations: ['required', 'min:3'],
      },
      {
        name: 'description',
        label: 'Descricao',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Descreva a proposta e os beneficios do curso.',
        placeholder: 'Explique o que o aluno vai aprender.',
        defaultValue: '',
        sampleValue: 'Curso completo para criar interfaces modernas com React.',
        validations: ['required', 'min:10'],
      },
      {
        name: 'category',
        label: 'Categoria',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Organize o curso em uma categoria comercial.',
        placeholder: 'Ex.: Desenvolvimento Web',
        defaultValue: '',
        sampleValue: 'Desenvolvimento Web',
        validations: ['required'],
      },
      {
        name: 'price',
        label: 'Preco',
        inputType: 'number',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina o valor de venda do curso.',
        placeholder: 'Ex.: 197.00',
        defaultValue: '',
        sampleValue: '197.00',
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'course-modules') {
    return [
      {
        name: 'moduleName',
        label: 'Nome do modulo',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina um titulo objetivo para o modulo.',
        placeholder: 'Ex.: Fundamentos do curso',
        defaultValue: '',
        sampleValue: 'Fundamentos do curso',
        validations: ['required', 'min:3'],
      },
      {
        name: 'moduleDescription',
        label: 'Descricao do modulo',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: false,
        unique: false,
        helperText: 'Explique rapidamente o que sera abordado neste modulo.',
        placeholder: 'Resumo curto do modulo',
        defaultValue: '',
        sampleValue: 'Introducao aos conceitos essenciais do treinamento.',
        validations: [],
      },
      {
        name: 'displayOrder',
        label: 'Ordem',
        inputType: 'number',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Controle a sequencia em que o modulo aparece no curso.',
        placeholder: '1',
        defaultValue: '1',
        sampleValue: '1',
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'course-lessons') {
    return [
      {
        name: 'lessonTitle',
        label: 'Titulo da aula',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe o nome da aula exibido para o aluno.',
        placeholder: 'Ex.: Instalando o ambiente',
        defaultValue: '',
        sampleValue: 'Instalando o ambiente',
        validations: ['required', 'min:3'],
      },
      {
        name: 'mediaType',
        label: 'Tipo de midia',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Defina se a aula sera em video, audio ou PDF.',
        placeholder: 'video | audio | pdf',
        defaultValue: 'video',
        sampleValue: 'video',
        selectOptions: ['video', 'audio', 'pdf'],
        validations: ['required'],
      },
      {
        name: 'moduleReference',
        label: 'Modulo',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Associe a aula ao modulo correto do curso.',
        placeholder: 'Ex.: Fundamentos do curso',
        defaultValue: '',
        sampleValue: 'Fundamentos do curso',
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'lesson-materials') {
    return [
      {
        name: 'materialTitle',
        label: 'Titulo do material',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Identifique o material complementar para o aluno.',
        placeholder: 'Ex.: Checklist da aula',
        defaultValue: '',
        sampleValue: 'Checklist da aula',
        validations: ['required'],
      },
      {
        name: 'fileType',
        label: 'Tipo de arquivo',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe o formato do material enviado.',
        placeholder: 'pdf | planilha | zip',
        defaultValue: 'pdf',
        sampleValue: 'pdf',
        selectOptions: ['pdf', 'planilha', 'zip', 'link'],
        validations: ['required'],
      },
      {
        name: 'fileUrl',
        label: 'URL do arquivo',
        inputType: 'url',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Use a URL do arquivo armazenado para liberar o download.',
        placeholder: 'https://cdn.exemplo.com/material.pdf',
        defaultValue: '',
        sampleValue: 'https://cdn.exemplo.com/material.pdf',
        validations: ['required', 'url'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'access-control-roles') {
    return [
      {
        name: 'roleName',
        label: 'Perfil de acesso',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: true,
        helperText: 'Selecione o perfil que recebera o conjunto de permissoes.',
        placeholder: 'solicitante | analista | gestor',
        defaultValue: 'solicitante',
        sampleValue: 'gestor',
        selectOptions: ['solicitante', 'analista', 'gestor'],
        validations: ['required'],
      },
      {
        name: 'permissionMatrix',
        label: 'Permissoes',
        inputType: 'textarea',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Liste o que esse perfil pode fazer no sistema, de forma simples e objetiva.',
        placeholder: 'Ex.: acompanhar chamados, aprovar atendimento, administrar usuarios',
        defaultValue: '',
        sampleValue: 'acompanhar chamados; aprovar atendimento; administrar usuarios',
        validations: ['required', 'min:10'],
      },
      {
        name: 'accessScope',
        label: 'Escopo',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Escolha onde esse perfil pode atuar no sistema.',
        placeholder: 'somente o proprio acesso | equipe | toda a empresa',
        defaultValue: 'team',
        sampleValue: 'global',
        selectOptions: ['self_service', 'team', 'global'],
        validations: ['required'],
      },
    ];
  }

  if (actionSpec?.domainKey === 'ticket-notification-preferences') {
    return [
      {
        name: 'notificationEmail',
        label: 'E-mail para notificacoes',
        inputType: 'email',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: true,
        helperText: 'Use o e-mail que deve receber avisos sempre que houver atualizacao do chamado.',
        placeholder: 'nome@empresa.com',
        defaultValue: '',
        sampleValue: 'comercial@empresa.com',
        validations: ['required', 'email'],
      },
      {
        name: 'ticketUpdateAlerts',
        label: 'Notificar atualizacoes do chamado',
        inputType: 'select',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Escolha se deseja receber avisos por e-mail sobre novidades no chamado.',
        placeholder: 'ativado | desativado',
        defaultValue: 'enabled',
        sampleValue: 'enabled',
        selectOptions: ['enabled', 'disabled'],
        validations: ['required'],
      },
    ];
  }

  const fields = [];

  if (/\bperfil\b/.test(normalized)) {
    if (/\bnome\b/.test(normalized)) {
      fields.push({
        name: 'fullName',
        label: 'Nome completo',
        inputType: 'text',
        tsType: 'string',
        prismaType: 'String',
        required: true,
        unique: false,
        helperText: 'Informe o nome que sera exibido no seu perfil.',
        placeholder: 'Digite seu nome completo',
        defaultValue: '',
        sampleValue: 'Joao Silva',
        validations: ['required', 'min:3'],
      });
    }

    if (/\bfoto\b|\bimagem\b|\bupload\b/.test(normalized)) {
      fields.push({
        name: 'profilePhotoUrl',
        label: 'Foto do perfil',
        inputType: 'url',
        tsType: 'string',
        prismaType: 'String',
        required: false,
        unique: false,
        helperText: 'Informe a URL da imagem do perfil. Considere JPG/PNG com limite de 2MB no ambiente real.',
        placeholder: 'https://exemplo.com/minha-foto.png',
        defaultValue: '',
        sampleValue: 'https://exemplo.com/avatar-joao.png',
        validations: ['image_url', 'max_file_size:2mb'],
      });
    }
  }

  if (/\be-?mail\b/.test(normalized)) {
    fields.push({
      name: 'email',
      label: 'E-mail',
      inputType: 'email',
      tsType: 'string',
      prismaType: 'String',
      required: true,
      unique: true,
      helperText: 'Use um e-mail valido para acessar a plataforma.',
      placeholder: 'Digite seu e-mail',
      defaultValue: '',
      sampleValue: 'aluno@exemplo.com',
      validations: ['required', 'email'],
    });
  }

  if (/\bsenha\b/.test(normalized) || /\bpassword\b/.test(normalized)) {
    fields.push({
      name: 'password',
      label: 'Senha',
      inputType: 'password',
      tsType: 'string',
      prismaType: 'String',
      required: true,
      unique: false,
      helperText: 'A senha deve atender aos criterios minimos de seguranca.',
      placeholder: 'Crie uma senha segura',
      defaultValue: '',
      sampleValue: 'SenhaForte123',
      validations: ['required', 'min:8', 'password_strength'],
    });
  }

  if (!fields.length) {
    fields.push({
      name: 'title',
      label: 'Titulo',
      inputType: 'text',
      tsType: 'string',
      prismaType: 'String',
      required: true,
      unique: false,
      helperText: 'Campo principal da feature gerada.',
      placeholder: 'Informe o valor principal',
      defaultValue: '',
      sampleValue: 'Item inicial',
      validations: ['required'],
    });
  }

  return fields;
}

function inferActionSpec(task, sourceText) {
  const titleNormalized = stripAccents(task.title).toLowerCase();
  const normalized = stripAccents(`${task.title}\n${sourceText}`).toLowerCase();
  const hasCredentials = /\be-?mail\b/.test(normalized) && /\bsenha\b/.test(normalized);
  const looksLikeLogin = /\blogin\b|\bentrar\b|\bautentic/.test(titleNormalized);
  const looksLikeRegister = /\bregistr/.test(titleNormalized) || /\bcadastr/.test(titleNormalized);
  const looksLikeProfile = /\bperfil\b/.test(titleNormalized) || (/\bperfil\b/.test(normalized) && /\bnome\b|\bfoto\b/.test(normalized));
  const looksLikeCourse = /\bcurso\b/.test(titleNormalized);
  const looksLikeModule = /\bmodulo\b|\bmodulos\b/.test(titleNormalized);
  const looksLikeLesson = /\baula\b|\baulas\b/.test(titleNormalized);
  const looksLikeEventSupplier =
    (/\bfornecedor\b|\bfornecedores\b|\bprestador\b|\bparceiro\b/.test(titleNormalized) ||
      (/\bfornecedor\b|\bfornecedores\b|\bprestador\b|\bparceiro\b/.test(normalized) &&
        /\bcategoria\b|\bservico\b|\bcontato\b|\bcontatos\b/.test(normalized))) &&
    (/\bevento\b|\beventos\b/.test(titleNormalized) ||
      /\bevento\b|\beventos\b|\boperacao\b|\boperacional\b|\bcoordenador de eventos\b/.test(normalized));
  const looksLikeVisitOperationalResponsible =
    (/\bresponsavel operacional\b/.test(titleNormalized) ||
      (/\bresponsavel\b/.test(titleNormalized) && /\boperacional\b/.test(titleNormalized)) ||
      (/\bresponsavel\b/.test(normalized) &&
        /\boperacional\b/.test(normalized) &&
        /\bcontato\b/.test(normalized) &&
        /\btipo de suporte\b|\bsuporte\b/.test(normalized))) &&
    (/\bvisita\b|\bvisitas\b|\brecepcao\b/.test(titleNormalized) ||
      /\bvisita\b|\bvisitas\b|\brecepcao\b|\bassistente de recepcao\b/.test(normalized));
  const looksLikeVisitRecurringHistory =
    (/\bhistorico\b/.test(titleNormalized) || /\bhistorico\b|\brecorrente\b|\bnovo agendamento\b|\bpre preenchid/.test(normalized)) &&
    (/\bcliente\b/.test(titleNormalized) || /\bcliente\b|\bcpf\b|\bcnpj\b|\bidentificador\b/.test(normalized)) &&
    (/\bvisita\b|\bvisitas\b/.test(titleNormalized) || /\bvisita\b|\bvisitas\b|\banfitriao\b|\bagendamento\b/.test(normalized));
  const looksLikeVisitIntake =
    (/\bcriar\b|\bcadastrar\b|\bregistrar\b|\bsolicitar\b|\babrir\b/.test(titleNormalized) ||
      /\bcriar\b|\bcadastrar\b|\bregistrar\b|\bsolicitar\b|\babrir\b/.test(normalized)) &&
    (/\bvisita\b|\bvisitas\b/.test(titleNormalized) || /\bvisita\b|\bvisitas\b|\brecepcao\b|\brecepcionista\b/.test(normalized)) &&
    ((/\bnome\b/.test(normalized) && /\bobjetivo\b/.test(normalized) && /\bdata\b/.test(normalized)) ||
      /\bcontexto inicial\b|\bdados iniciais\b|\biniciar o fluxo principal\b|\bfluxo principal\b/.test(normalized)) &&
    !(/\bhorario\b|\bhorarios\b|\btemplate\b|\bdocumento\b|\bperfil\b|\bperfis\b|\bretencao\b/.test(titleNormalized) ||
      /\bhorario\b|\bhorarios\b|\bdia util anterior\b|\btemplate\b|\bdocumentos obrigatorios\b|\bperfil\b|\bperfis\b|\bretencao\b/.test(normalized));
  const looksLikeVisitExtraCompanions =
    (/\bacompanhante\b|\bacompanhantes\b|\bconsultor\b/.test(titleNormalized) ||
      /\bacompanhante\b|\bacompanhantes\b|\bconsultor\b|\bacrescentar acompanhante\b|\badicionar acompanhante\b/.test(normalized)) &&
    (/\bvisita\b|\bvisitas\b/.test(titleNormalized) || /\bvisita\b|\bvisitas\b|\banfitriao\b/.test(normalized)) &&
    (/\baprovad/.test(titleNormalized) || /\baprovad/.test(normalized) || /\bseguranc/.test(normalized));
  const looksLikeVisitApprovalCutoff =
    (/\bhorario\b|\bhorarios\b|\blimite\b/.test(titleNormalized) || /\bhorario\b|\bhorarios\b|\blimite\b|\bdia util anterior\b/.test(normalized)) &&
    (/\baprov/.test(titleNormalized) || /\baprov/.test(normalized)) &&
    (/\bvisita\b|\bvisitas\b/.test(titleNormalized) || /\bvisita\b|\bvisitas\b|\bgestor administrativo\b/.test(normalized));
  const looksLikeEventSchedule =
    (/\bcronograma\b|\betapa\b|\betapas\b|\bprazo\b|\bprazos\b|\bmarco\b|\bagenda operacional\b/.test(titleNormalized) ||
      ((/\bcronograma\b|\betapa\b|\betapas\b|\bprazo\b|\bprazos\b|\bmarco\b/.test(normalized)) &&
        /\bplanejamento\b|\bexecucao\b|\bevento\b|\beventos\b/.test(normalized))) &&
    (/\bevento\b|\beventos\b/.test(titleNormalized) ||
      /\bevento\b|\beventos\b|\boperacao\b|\bplanejamento\b|\bcoordenador de eventos\b/.test(normalized));
  const looksLikeAccessControl =
    (/\bpermiss/.test(titleNormalized) || /\brole\b|\broles\b|\bfunca/.test(titleNormalized)) &&
    (/\bacesso\b/.test(titleNormalized) || /\bperfil\b|\bperfis\b/.test(titleNormalized) || /\bseguranc/.test(titleNormalized));
  const looksLikeSupportAttachment =
    (/\banexo\b|\banexar\b|\barquivo\b|\bdocumento\b|\bcomprov|\bevidenc|\bimagem/.test(titleNormalized) || /\banexo\b|\banexar\b|\bdocumento\b|\bcomprov|\bevidenc|\bimagem/.test(normalized)) &&
    (/\bchamado\b|\bsuporte\b|\bticket\b/.test(titleNormalized) || /\bchamado\b|\bsuporte\b|\bticket\b/.test(normalized));
  const looksLikeNotificationPreference =
    /\bnotifica/.test(titleNormalized) &&
    /\be-?mail\b/.test(normalized) &&
    (/\batualizad/.test(normalized) || /\bchamado\b/.test(normalized) || /\balerta\b/.test(normalized));
  const looksLikeManagerAudience =
    /\bgestor\b|\bgestora\b|\bgerente\b|\bsupervisor\b|\bcoordenador\b|\bexecutiv/.test(titleNormalized) ||
    /\bgestor\b|\bgestora\b|\bgerente\b|\bsupervisor\b|\bcoordenador\b|\bexecutiv/.test(normalized);
  const looksLikeSupportPerformanceDashboard =
    (/\bpainel\b|\bdashboard\b|\brelatorio\b/.test(titleNormalized) || /\bpainel\b|\bdashboard\b|\brelatorio\b/.test(normalized)) &&
    (/\bvolume\b|\bindicador\b|\bmetric/.test(normalized) || /\bcategoria\b/.test(normalized) || /\bstatus\b/.test(normalized)) &&
    (/\bchamado\b|\bsuporte\b|\batendimento\b|\bperformance\b/.test(normalized)) &&
    looksLikeManagerAudience;
  const looksLikeMaterial = /\bmaterial\b|\bmateriais\b|\banexo\b|\banexar\b|\bupload\b/.test(titleNormalized);
  const looksLikeCategory = /\bcategoria\b/.test(titleNormalized);
  const looksLikePricing = /\bpreco\b|\bvalor\b|\breceita\b/.test(titleNormalized);
  const looksLikeSearch = /\bpesquisar\b|\bbuscar\b|\bpalavra-chave\b/.test(titleNormalized);
  const looksLikeStudentEnrollment = /\bmatricular\b|\binscrever\b|\bacesso aos cursos\b/.test(titleNormalized);
  const looksLikeMediaPlayer = /\bvideo\b|\baudio\b|\bassistir\b/.test(titleNormalized);

  if (looksLikeCourse && looksLikePricing && /\bcriar\b/.test(titleNormalized)) {
    return {
      domainKey: 'course-catalog',
      entityName: 'CourseCatalog',
      routeBase: '/api/courses',
      frontendRoute: '/courses',
      pageComponentName: 'CourseCatalogPage',
      serviceName: 'CourseCatalogService',
      submitLabel: 'Criar Curso',
      navigationLabel: 'Cursos',
      pageTitle: 'Cadastre um novo curso',
      pageDescription: 'Defina nome, descricao, categoria e preco para disponibilizar um curso na plataforma.',
      successMessage: 'Curso criado com sucesso.',
      summary: 'Permite ao infoprodutor cadastrar novos cursos com informacoes comerciais e editoriais.',
    };
  }

  if (looksLikeAccessControl) {
    return {
      domainKey: 'access-control-roles',
      entityName: 'AccessControlRole',
      routeBase: '/api/access-control/roles',
      frontendRoute: '/settings/access-control',
      pageComponentName: 'AccessControlRolesPage',
      serviceName: 'AccessControlRolesService',
      submitLabel: 'Salvar Perfil',
      navigationLabel: 'Perfis de Acesso',
      pageTitle: 'Configure perfis e permissoes',
      pageDescription: 'Defina quais funcoes podem acessar cada parte da operacao com seguranca e rastreabilidade.',
      successMessage: 'Perfil de acesso atualizado com sucesso.',
      summary: 'Permite configurar perfis de acesso e permissoes por funcao para controlar a operacao com seguranca.',
    };
  }

  if (looksLikeVisitOperationalResponsible) {
    return {
      domainKey: 'visit-operational-responsibles',
      entityName: 'VisitOperationalResponsible',
      routeBase: '/api/visit-operational-responsibles',
      frontendRoute: '/operations/responsibles',
      pageComponentName: 'VisitOperationalResponsiblesPage',
      serviceName: 'VisitOperationalResponsiblesService',
      submitLabel: 'Cadastrar Responsavel',
      navigationLabel: 'Responsaveis',
      pageTitle: 'Cadastre responsaveis operacionais',
      pageDescription: 'Registre quem apoia a operacao da visita com nome, contato e tipo de suporte.',
      successMessage: 'Responsavel operacional cadastrado com sucesso.',
      summary: 'Permite cadastrar responsaveis operacionais para apoiar a execucao da visita com acionamento rapido.',
    };
  }

  if (looksLikeVisitRecurringHistory) {
    return {
      domainKey: 'visit-recurring-history',
      entityName: 'VisitRecurringHistory',
      routeBase: '/api/visit-recurring-history',
      frontendRoute: '/operations/visit-history',
      pageComponentName: 'VisitRecurringHistoryPage',
      serviceName: 'VisitRecurringHistoryService',
      submitLabel: 'Buscar Historico',
      navigationLabel: 'Historico de visitas',
      pageTitle: 'Consulte historico de visitas',
      pageDescription: 'Busque visitas anteriores de um cliente recorrente para reaproveitar dados em um novo agendamento.',
      successMessage: 'Historico consultado com sucesso.',
      summary: 'Permite ao anfitriao localizar visitas anteriores de um cliente recorrente e reaproveitar contexto no novo agendamento.',
    };
  }

  if (looksLikeVisitIntake) {
    return {
      domainKey: 'visit-intake',
      entityName: 'VisitIntake',
      routeBase: '/api/visits',
      frontendRoute: '/operations/visits/new',
      pageComponentName: 'VisitIntakePage',
      serviceName: 'VisitIntakeService',
      submitLabel: 'Abrir visita',
      navigationLabel: 'Abertura de visita',
      pageTitle: 'Abertura da visita',
      pageDescription: 'Registre nome, objetivo, data e contexto inicial para iniciar a triagem da visita com clareza operacional.',
      successMessage: 'Visita criada com sucesso.',
      summary: 'Permite abrir uma visita com os dados iniciais minimos para triagem, acompanhamento e continuidade do fluxo.',
    };
  }

  if (looksLikeVisitExtraCompanions) {
    return {
      domainKey: 'visit-extra-companions',
      entityName: 'VisitExtraCompanion',
      routeBase: '/api/visit-extra-companions',
      frontendRoute: '/operations/extra-companions',
      pageComponentName: 'VisitExtraCompanionsPage',
      serviceName: 'VisitExtraCompanionsService',
      submitLabel: 'Adicionar Acompanhante',
      navigationLabel: 'Acompanhantes extras',
      pageTitle: 'Adicione acompanhantes extras',
      pageDescription: 'Inclua acompanhantes adicionais em visitas aprovadas sem reiniciar todo o fluxo de aprovacao.',
      successMessage: 'Acompanhante extra registrado com sucesso.',
      summary: 'Permite ao anfitriao incluir acompanhantes extras em visitas ja aprovadas com decisao rapida da seguranca.',
    };
  }

  if (looksLikeVisitApprovalCutoff) {
    return {
      domainKey: 'visit-approval-cutoff-settings',
      entityName: 'VisitApprovalCutoffSetting',
      routeBase: '/api/settings/visit-approval-cutoff',
      frontendRoute: '/settings/visit-approval-cutoff',
      pageComponentName: 'VisitApprovalCutoffSettingsPage',
      serviceName: 'VisitApprovalCutoffSettingsService',
      submitLabel: 'Salvar Horario',
      navigationLabel: 'Horarios limite',
      pageTitle: 'Configure horarios limite',
      pageDescription: 'Defina o horario diario usado para bloquear aprovacoes de ultima hora sem tempo de analise.',
      successMessage: 'Horario limite atualizado com sucesso.',
      summary: 'Permite configurar o horario limite de aprovacao das visitas para evitar solicitacoes sem tempo habil de analise.',
    };
  }

  if (looksLikeEventSupplier) {
    return {
      domainKey: 'event-suppliers',
      entityName: 'EventSupplier',
      routeBase: '/api/event-suppliers',
      frontendRoute: '/operations/suppliers',
      pageComponentName: 'EventSuppliersPage',
      serviceName: 'EventSuppliersService',
      submitLabel: 'Cadastrar Fornecedor',
      navigationLabel: 'Fornecedores',
      pageTitle: 'Cadastre fornecedores da operacao',
      pageDescription: 'Centralize parceiros com categoria de servico e contatos principais para acionar a operacao com menos retrabalho.',
      successMessage: 'Fornecedor cadastrado com sucesso.',
      summary: 'Permite cadastrar fornecedores com categoria de servico e contatos principais para manter a operacao de eventos centralizada.',
    };
  }

  if (looksLikeEventSchedule) {
    return {
      domainKey: 'event-schedules',
      entityName: 'EventSchedule',
      routeBase: '/api/event-schedules',
      frontendRoute: '/operations/schedules',
      pageComponentName: 'EventSchedulesPage',
      serviceName: 'EventSchedulesService',
      submitLabel: 'Adicionar Etapa',
      navigationLabel: 'Cronograma',
      pageTitle: 'Monte o cronograma inicial do evento',
      pageDescription: 'Organize etapas, prazos e responsaveis para manter a execucao do evento previsivel desde o planejamento.',
      successMessage: 'Etapa do cronograma registrada com sucesso.',
      summary: 'Permite estruturar o cronograma inicial do evento com etapas e prazos para dar previsibilidade a execucao.',
    };
  }

  if (looksLikeNotificationPreference) {
    return {
      domainKey: 'ticket-notification-preferences',
      entityName: 'TicketNotificationPreference',
      routeBase: '/api/notification-preferences',
      frontendRoute: '/settings/notifications',
      pageComponentName: 'TicketNotificationPreferencesPage',
      serviceName: 'TicketNotificationPreferencesService',
      submitLabel: 'Salvar Preferencias',
      navigationLabel: 'Notificacoes',
      pageTitle: 'Configure notificacoes por e-mail',
      pageDescription: 'Defina para quais atualizacoes do chamado o sistema deve enviar avisos por e-mail.',
      successMessage: 'Preferencias de notificacao atualizadas com sucesso.',
      summary: 'Permite configurar notificacoes por e-mail para acompanhar atualizacoes do chamado sem acessar o sistema.',
    };
  }

  if (looksLikeSupportPerformanceDashboard && !looksLikeSupportAttachment) {
    return {
      domainKey: 'support-performance-dashboard',
      entityName: 'SupportPerformanceDashboard',
      routeBase: '/api/support-performance/dashboard',
      frontendRoute: '/analytics/support-performance',
      pageComponentName: 'SupportPerformanceDashboardPage',
      serviceName: 'SupportPerformanceDashboardService',
      submitLabel: 'Atualizar Painel',
      navigationLabel: 'Painel de Atendimento',
      pageTitle: 'Acompanhe a performance do atendimento',
      pageDescription: 'Visualize volume de chamados por categoria e status para identificar gargalos e prioridades da operacao.',
      successMessage: 'Painel atualizado com sucesso.',
      summary: 'Permite ao gestor acompanhar o volume de chamados por categoria e status para decidir onde agir primeiro.',
    };
  }

  if (looksLikeSupportAttachment) {
    return {
      domainKey: 'support-ticket-attachments',
      entityName: 'SupportTicketAttachment',
      routeBase: '/api/support-ticket-attachments',
      frontendRoute: '/tickets/attachments',
      pageComponentName: 'SupportTicketAttachmentsPage',
      serviceName: 'SupportTicketAttachmentsService',
      submitLabel: 'Anexar Evidencia',
      navigationLabel: 'Anexos do Chamado',
      pageTitle: 'Anexe evidencias ao chamado',
      pageDescription: 'Associe imagens, arquivos e documentos ao chamado para facilitar o entendimento do problema pelo suporte.',
      successMessage: 'Evidencia anexada com sucesso.',
      summary: 'Permite anexar evidencias como imagens e documentos ao abrir chamados para dar mais contexto ao atendimento.',
    };
  }

  if (looksLikeMaterial) {
    return {
      domainKey: 'lesson-materials',
      entityName: 'LessonMaterial',
      routeBase: '/api/lesson-materials',
      frontendRoute: '/courses/materials',
      pageComponentName: 'LessonMaterialsPage',
      serviceName: 'LessonMaterialsService',
      submitLabel: 'Enviar Material',
      navigationLabel: 'Materiais',
      pageTitle: 'Envie materiais complementares',
      pageDescription: 'Anexe PDFs, planilhas e outros arquivos para enriquecer cada aula.',
      successMessage: 'Material enviado com sucesso.',
      summary: 'Permite gerenciar uploads de materiais complementares vinculados a aulas.',
    };
  }

  if (looksLikeLesson) {
    return {
      domainKey: 'course-lessons',
      entityName: 'CourseLesson',
      routeBase: '/api/course-lessons',
      frontendRoute: '/courses/lessons',
      pageComponentName: 'CourseLessonsPage',
      serviceName: 'CourseLessonsService',
      submitLabel: 'Adicionar Aula',
      navigationLabel: 'Aulas',
      pageTitle: 'Cadastre aulas do curso',
      pageDescription: 'Associe aulas aos modulos e escolha o tipo de midia para cada conteudo.',
      successMessage: 'Aula adicionada com sucesso.',
      summary: 'Permite cadastrar aulas vinculadas a modulos com diferentes tipos de midia.',
    };
  }

  if (looksLikeModule) {
    return {
      domainKey: 'course-modules',
      entityName: 'CourseModule',
      routeBase: '/api/course-modules',
      frontendRoute: '/courses/modules',
      pageComponentName: 'CourseModulesPage',
      serviceName: 'CourseModulesService',
      submitLabel: 'Adicionar Modulo',
      navigationLabel: 'Modulos',
      pageTitle: 'Organize os modulos do curso',
      pageDescription: 'Crie e ordene modulos para estruturar o conteudo do curso em secoes logicas.',
      successMessage: 'Modulo adicionado com sucesso.',
      summary: 'Permite estruturar o curso em modulos e secoes organizadas.',
    };
  }

  if (looksLikePricing && looksLikeCourse) {
    return {
      domainKey: 'course-pricing',
      entityName: 'CoursePricing',
      routeBase: '/api/course-pricing',
      frontendRoute: '/courses/pricing',
      pageComponentName: 'CoursePricingPage',
      serviceName: 'CoursePricingService',
      submitLabel: 'Salvar Preco',
      navigationLabel: 'Precos',
      pageTitle: 'Defina o preco do curso',
      pageDescription: 'Configure o valor de venda e as regras comerciais de cada curso.',
      successMessage: 'Preco atualizado com sucesso.',
      summary: 'Permite configurar e ajustar a estrategia de precificacao dos cursos.',
    };
  }

  if (looksLikeCategory && looksLikeSearch) {
    return {
      domainKey: 'course-search',
      entityName: 'CourseSearch',
      routeBase: '/api/course-search',
      frontendRoute: '/courses/search',
      pageComponentName: 'CourseSearchPage',
      serviceName: 'CourseSearchService',
      submitLabel: 'Buscar Cursos',
      navigationLabel: 'Busca',
      pageTitle: 'Encontre cursos com facilidade',
      pageDescription: 'Pesquise cursos por categoria, nome ou palavra-chave.',
      successMessage: 'Busca concluida com sucesso.',
      summary: 'Permite ao aluno localizar cursos com filtros e termos de busca.',
    };
  }

  if (looksLikeStudentEnrollment) {
    return {
      domainKey: 'course-enrollment',
      entityName: 'CourseEnrollment',
      routeBase: '/api/course-enrollments',
      frontendRoute: '/courses/enrollments',
      pageComponentName: 'CourseEnrollmentPage',
      serviceName: 'CourseEnrollmentService',
      submitLabel: 'Matricular Aluno',
      navigationLabel: 'Matriculas',
      pageTitle: 'Gerencie matriculas',
      pageDescription: 'Associe alunos aos cursos disponiveis para liberar acesso ao conteudo.',
      successMessage: 'Matricula criada com sucesso.',
      summary: 'Permite registrar matriculas e liberar acesso dos alunos aos cursos.',
    };
  }

  if (looksLikeMediaPlayer) {
    return {
      domainKey: 'course-player',
      entityName: 'CoursePlayer',
      routeBase: '/api/course-player',
      frontendRoute: '/courses/player',
      pageComponentName: 'CoursePlayerPage',
      serviceName: 'CoursePlayerService',
      submitLabel: 'Salvar Progresso',
      navigationLabel: 'Player',
      pageTitle: 'Consuma o conteudo do curso',
      pageDescription: 'Assista aulas em video e audio com acompanhamento de progresso.',
      successMessage: 'Progresso salvo com sucesso.',
      summary: 'Permite ao aluno assistir aulas e acompanhar o consumo do conteudo.',
    };
  }

  if (looksLikeProfile) {
    return {
      domainKey: 'profile-settings',
      entityName: 'ProfileSettings',
      routeBase: '/api/profile',
      frontendRoute: '/profile',
      pageComponentName: 'ProfileSettingsPage',
      serviceName: 'ProfileSettingsService',
      submitLabel: 'Salvar Alteracoes',
      navigationLabel: 'Perfil',
      pageTitle: 'Atualize seu perfil',
      pageDescription: 'Edite seus dados pessoais, foto e outras informacoes da conta.',
      successMessage: 'Perfil atualizado com sucesso.',
      summary: 'Permite ao aluno atualizar nome, foto e demais informacoes de perfil.',
    };
  }

  if (looksLikeLogin && hasCredentials) {
    return {
      domainKey: 'auth-login',
      entityName: 'LoginSession',
      routeBase: '/api/auth/login',
      frontendRoute: '/login',
      pageComponentName: 'LoginPage',
      serviceName: 'LoginService',
      submitLabel: 'Entrar',
      navigationLabel: 'Login',
      pageTitle: 'Acesse sua conta',
      pageDescription: 'Use suas credenciais para entrar na plataforma.',
      successMessage: 'Login realizado com sucesso.',
      summary: 'Permite autenticar o usuario no sistema.',
    };
  }

  if (looksLikeRegister && hasCredentials) {
    return {
      domainKey: 'auth-register',
      entityName: 'AccountRegistration',
      routeBase: '/api/auth/register',
      frontendRoute: '/register',
      pageComponentName: 'RegisterPage',
      serviceName: 'RegisterAccountService',
      submitLabel: 'Registrar',
      navigationLabel: 'Cadastro',
      pageTitle: 'Crie sua conta',
      pageDescription: 'Preencha seu e-mail e uma senha segura para acessar a plataforma.',
      successMessage: 'Cadastro realizado com sucesso.',
      summary: 'Permite registrar uma nova conta com e-mail e senha.',
    };
  }

  if (
    /\blogin\b|\bentrar\b|\bautentic/.test(normalized) &&
    hasCredentials
  ) {
    return {
      domainKey: 'auth-login',
      entityName: 'LoginSession',
      routeBase: '/api/auth/login',
      frontendRoute: '/login',
      pageComponentName: 'LoginPage',
      serviceName: 'LoginService',
      submitLabel: 'Entrar',
      navigationLabel: 'Login',
      pageTitle: 'Acesse sua conta',
      pageDescription: 'Use suas credenciais para entrar na plataforma.',
      successMessage: 'Login realizado com sucesso.',
      summary: 'Permite autenticar o usuario no sistema.',
    };
  }

  if (
    (/\bregistr/.test(normalized) || /\bcadastr/.test(normalized)) &&
    hasCredentials
  ) {
    return {
      domainKey: 'auth-register',
      entityName: 'AccountRegistration',
      routeBase: '/api/auth/register',
      frontendRoute: '/register',
      pageComponentName: 'RegisterPage',
      serviceName: 'RegisterAccountService',
      submitLabel: 'Registrar',
      navigationLabel: 'Cadastro',
      pageTitle: 'Crie sua conta',
      pageDescription: 'Preencha seu e-mail e uma senha segura para acessar a plataforma.',
      successMessage: 'Cadastro realizado com sucesso.',
      summary: 'Permite registrar uma nova conta com e-mail e senha.',
    };
  }

  const featureKey = slugify(task.title, task.uuid);
  const entityName = pascalCase(task.title, 'GeneratedFeature');
  return {
    domainKey: featureKey,
    entityName,
    routeBase: `/api/${featureKey}`,
    frontendRoute: `/${featureKey}`,
    pageComponentName: `${entityName}Page`,
    serviceName: `${entityName}Service`,
    submitLabel: 'Salvar',
    navigationLabel: humanizeFieldName(entityName),
    pageTitle: humanizeFieldName(entityName),
    pageDescription: 'Preencha os dados principais para concluir a operacao.',
    successMessage: 'Registro salvo com sucesso.',
    summary: 'Feature integrada a partir da task refinada.',
  };
}

function getDomainTemplateLegacy(technicalSpec) {
  const domainKey = technicalSpec?.featureKey || technicalSpec?.structured?.classification?.domain;

  if (domainKey === 'auth-register') {
    return {
      templateKey: 'auth/register',
      heroEyebrow: 'Cadastro',
      heroTitle: 'Crie sua conta',
      heroDescription: 'Cadastre seu acesso com e-mail e senha para começar a usar a plataforma.',
      formCardTitle: 'Dados de acesso',
      formCardDescription: 'Preencha as credenciais m?nimas para liberar seu primeiro acesso.',
      recordsTitle: 'Cadastros recentes',
      recordsEmptyState: 'Nenhum cadastro processado at? o momento.',
      highlights: [
        'Validação imediata de e-mail antes da persistência.',
        'Senha forte exigida para concluir o cadastro.',
        'Prote?o contra e-mails duplicados no fluxo incremental.',
      ],
      profileSummaryTitle: 'Checklist de cadastro',
      profileSummaryDescription: 'O fluxo precisa validar e-mail, senha e evitar duplicidade antes da cria?o da conta.',
    };
  }

  if (domainKey === 'auth-login') {
    return {
      templateKey: 'auth/login',
      heroEyebrow: 'Autenticação',
      heroTitle: 'Entre na plataforma',
      heroDescription: 'Use suas credenciais para acessar cursos, progresso e recursos da sua conta.',
      formCardTitle: 'Acesso',
      formCardDescription: 'Informe o e-mail cadastrado e a senha para autenticar a sessão.',
      recordsTitle: 'Sess?es recentes',
      recordsEmptyState: 'Nenhuma sess?o registrada at? o momento.',
      highlights: [
        'Validação de credenciais antes de iniciar a sessão.',
        'Mensagens claras para e-mail ou senha inv?lidos.',
        'Fluxo pensado para acoplar autentica��o real depois.',
      ],
      profileSummaryTitle: 'Checklist de login',
      profileSummaryDescription: 'A entrada deve validar credenciais e retornar feedback imediato em caso de falha.',
    };
  }

  if (domainKey === 'profile-settings') {
    return {
      templateKey: 'profile/update',
      heroEyebrow: 'Perfil',
      heroTitle: 'Atualize seu perfil',
      heroDescription: 'Mantenha nome, foto e dados principais da conta sempre consistentes.',
      formCardTitle: 'Dados do perfil',
      formCardDescription: 'Edite as informações visíveis na conta e salve as alterações.',
      recordsTitle: 'Hist?rico de altera?es',
      recordsEmptyState: 'Nenhuma altera?o realizada at? o momento.',
      highlights: [
        'Nome obrigat?rio para exibi?o correta do perfil.',
        'Foto de perfil com valida?o de formato e limite de tamanho.',
        'Hist?rico preparado para auditoria de atualiza��es.',
      ],
      profileSummaryTitle: 'Boas pr?ticas do perfil',
      profileSummaryDescription: 'O aluno precisa manter dados atualizados, com nome obrigat?rio e foto v?lida.',
    };
  }

  if (domainKey === 'access-control-roles') {
    return {
      templateKey: 'security/access-control',
      heroEyebrow: 'Seguranca',
      heroTitle: 'Governanca de perfis e permissoes',
      heroDescription: 'Configure perfis por funcao e distribua o acesso correto para cada etapa da operacao.',
      formCardTitle: 'Matriz de acesso',
      formCardDescription: 'Defina o perfil, o escopo de atuacao e as permissoes liberadas para a funcao.',
      recordsTitle: 'Perfis configurados',
      recordsEmptyState: 'Nenhum perfil configurado ate o momento.',
      highlights: [
        'Permissoes centralizadas por funcao.',
        'Escopo de acesso claro para cada perfil operacional.',
        'Base pronta para auditoria e rastreabilidade de seguranca.',
      ],
      profileSummaryTitle: 'Governanca minima',
      profileSummaryDescription: 'Cada perfil deve registrar permissoes, escopo de acesso e responsabilidade operacional.',
    };
  }

  return {
    templateKey: 'generic/form',
    heroEyebrow: technicalSpec.frontend?.navigationLabel || technicalSpec.entityName,
    heroTitle: technicalSpec.frontend?.pageTitle || technicalSpec.entityName,
    heroDescription: technicalSpec.frontend?.pageDescription || technicalSpec.summary,
    formCardTitle: 'Preencha os dados',
    formCardDescription: 'Informe os dados necess?rios para continuar.',
    recordsTitle: 'Últimos registros',
    recordsEmptyState: 'Nenhum registro processado ainda.',
    highlights: [
      'Validação básica aplicada aos campos principais.',
      'Feedback imediato em caso de sucesso ou erro.',
    ],
    profileSummaryTitle: 'Resumo da feature',
    profileSummaryDescription: technicalSpec.summary,
  };
}

function getDomainTemplate(technicalSpec) {
  const domainKey = technicalSpec?.featureKey || technicalSpec?.structured?.classification?.domain;
  const template = resolveDomainTemplate(domainKey, technicalSpec);
  const uiContract = technicalSpec?.ux?.uiContract || technicalSpec?.frontend?.uxContract || null;

  if (!uiContract) {
    return template;
  }

  const copyOverrides = uiContract.copyOverrides || {};
  const interfaceExamples = uiContract.interfaceExamples || {};

  return {
    ...template,
    heroEyebrow: copyOverrides.heroEyebrow || template.heroEyebrow,
    heroTitle: copyOverrides.heroTitle || template.heroTitle,
    heroDescription: copyOverrides.heroDescription || template.heroDescription,
    formCardTitle: copyOverrides.formCardTitle || template.formCardTitle,
    formCardDescription: copyOverrides.formCardDescription || template.formCardDescription,
    recordsTitle: copyOverrides.recordsTitle || template.recordsTitle,
    recordsEmptyState: copyOverrides.recordsEmptyState || template.recordsEmptyState,
    highlights: interfaceExamples.summaryItems?.length ? interfaceExamples.summaryItems : template.highlights,
    profileSummaryTitle: copyOverrides.profileSummaryTitle || template.profileSummaryTitle,
    profileSummaryDescription: copyOverrides.profileSummaryDescription || template.profileSummaryDescription,
    asideTitle: copyOverrides.asideTitle || template.asideTitle,
    asideTone: copyOverrides.asideTone || template.asideTone,
    badge: copyOverrides.badge || template.badge,
    summaryTitle: copyOverrides.summaryTitle || template.summaryTitle,
    summaryTone: copyOverrides.summaryTone || template.summaryTone,
    settingsSummaryItems: interfaceExamples.summaryItems?.length ? interfaceExamples.summaryItems : template.settingsSummaryItems,
    promptExamples: interfaceExamples.promptExamples?.length ? interfaceExamples.promptExamples : template.promptExamples,
    sectionLabels: interfaceExamples.sectionLabels?.length ? interfaceExamples.sectionLabels : template.sectionLabels,
    ctaLabels: interfaceExamples.ctaLabels?.length ? interfaceExamples.ctaLabels : template.ctaLabels,
    emptyStates: interfaceExamples.emptyStates?.length ? interfaceExamples.emptyStates : template.emptyStates,
    reviewSignals: interfaceExamples.reviewSignals?.length ? interfaceExamples.reviewSignals : template.reviewSignals,
    helperTexts: interfaceExamples.helperTexts?.length ? interfaceExamples.helperTexts : template.helperTexts,
    summaryStateTitle: copyOverrides.summaryStateTitle || interfaceExamples.summaryStateTitle || template.summaryStateTitle,
    summaryStateEmpty: copyOverrides.summaryStateEmpty || interfaceExamples.summaryStateEmpty || template.summaryStateEmpty,
  };
}

function polishUiDraftText(text, context = {}) {
  const screenTemplate = context.screenTemplate || 'crud';
  const productMode = context.productMode || 'structured-workspace';
  const uiIntent = context.uiIntent || 'custom';

  return String(text || '')
    .replace(/\bRBAC\b/gi, 'acessos por perfil')
    .replace(/\bauditavel\b/gi, 'claro')
    .replace(/\bself_service\b/gi, 'somente o proprio acesso')
    .replace(/\bteam\b/gi, 'equipe')
    .replace(/\bglobal\b/gi, 'toda a empresa')
    .replace(/\benabled\b/gi, 'Ativado')
    .replace(/\bdisabled\b/gi, 'Desativado')
    .replace(/\bvalidacao fiscal imediata\b/gi, 'analise fiscal mais agil')
    .replace(/\bprioridade alta\b/gi, uiIntent === 'review' ? 'fila prioritaria' : 'mais contexto')
    .replace(/\btempo real\b/gi, screenTemplate === 'dashboard' ? 'leitura atual' : 'acompanhamento continuo')
    .replace(/\bacompanhamento operacional\b/gi, 'consulta rapida')
    .replace(/\bsincronizando o estado atual\b/gi, 'carregando informacoes')
    .replace(/\bpreferencia registrada e pronta para acompanhamento\b/gi, 'configuracao salva com sucesso')
    .replace(/\bcanal principal\b/gi, screenTemplate === 'settings' ? 'Resumo atual' : productMode === 'evidence-workbench' ? 'Contexto do caso' : 'Visao geral')
    .replace(/\brotina de acompanhamento\b/gi, screenTemplate === 'settings' ? 'Como funciona' : 'Acompanhamento')
    .replace(/\bgovernanca minima\b/gi, 'Resumo dos acessos')
    .replace(/\bajuste inicial\b/gi, screenTemplate === 'settings' ? 'Pronto para ajustar' : 'Aguardando primeira movimentacao')
    .replace(/\bconfigurado\b/gi, screenTemplate === 'settings' ? 'Ativo' : 'Configurado')
    .replace(/\bsincronizando\b/gi, 'Atualizando')
    .replace(/\bnovo anexo\b/gi, 'Adicionar documento')
    .replace(/\bnova? anexo\b/gi, 'Adicionar documento')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickPreferredLabel(candidates = [], fallback = '') {
  const preferred = (candidates || []).find((item) => typeof item === 'string' && item.trim());
  return preferred || fallback;
}

function getFrontendShellContract({ screenTemplate = 'crud', productMode = 'structured-workspace', uiIntent = 'custom' } = {}) {
  if (screenTemplate === 'settings') {
    return {
      componentName: 'SettingsConsole',
      imports: 'SettingsConsole, FieldGroup, PrimaryButton, inputStyle',
      defaultPageArchetype: 'settings-console',
      defaultFallbackPattern: 'stripe-settings',
      defaultSections: ['hero', 'form', 'summary'],
    };
  }

  if (screenTemplate === 'dashboard' || productMode === 'manager-cockpit') {
    return {
      componentName: 'ExecutiveCockpit',
      imports: 'ExecutiveCockpit, FieldGroup, PrimaryButton, inputStyle',
      defaultPageArchetype: 'executive-dashboard',
      defaultFallbackPattern: 'vercel-analytics',
      defaultSections: ['hero', 'metrics', 'form', 'records'],
    };
  }

  if (
    productMode === 'timeline-planner' ||
    productMode === 'approval-flow' ||
    productMode === 'review-workbench' ||
    uiIntent === 'plan' ||
    uiIntent === 'review'
  ) {
    return {
      componentName: 'PlannerWorkbench',
      imports: 'PlannerWorkbench, FieldGroup, PrimaryButton, inputStyle',
      defaultPageArchetype: 'approval-flow',
      defaultFallbackPattern: 'github-review',
      defaultSections: ['hero', 'metrics', 'form', 'queue'],
    };
  }

  return {
    componentName: 'OperationsWorkspace',
    imports: 'OperationsWorkspace, FieldGroup, PrimaryButton, inputStyle',
    defaultPageArchetype: screenTemplate === 'wizard' ? 'workflow-guided' : 'crud',
    defaultFallbackPattern: 'stripe-records',
    defaultSections: screenTemplate === 'wizard' ? ['hero', 'form', 'summary'] : ['hero', 'metrics', 'form', 'records'],
  };
}

function normalizeHighlightList(highlights = [], fallback = []) {
  const seen = new Set();
  const output = [];
  for (const item of [...highlights, ...fallback]) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    const key = stripAccents(normalized).toLowerCase();
    if (seen.has(key)) continue;
    if (/feedback imediato|validacao basica|operacao concluida com sucesso|sem friccao/.test(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= 3) break;
  }
  return output;
}

function runUiProductPolishPass(draft = {}, context = {}) {
  const polished = { ...draft };
  const examples = context.interfaceExamples || {};
  const screenTemplate = context.screenTemplate || 'crud';
  const productMode = context.productMode || 'structured-workspace';
  const uiIntent = context.uiIntent || 'custom';

  polished.highlights = normalizeHighlightList(
    Array.isArray(polished.highlights) ? polished.highlights : [],
    Array.isArray(examples.summaryItems) ? examples.summaryItems : []
  );

  if (!polished.navigationLabel || /operacao|workflow|experiencia/i.test(polished.navigationLabel)) {
    polished.navigationLabel = context.navigationLabel || polished.navigationLabel;
  }

  if (!polished.recordsTitle || /ultimos registros|registros ativos|atividade recente|rotina de acompanhamento/i.test(stripAccents(polished.recordsTitle))) {
    polished.recordsTitle = pickPreferredLabel(examples.sectionLabels, polished.recordsTitle || 'Resumo atual');
  }

  if (!polished.submitLabel || /salvar|enviar|concluir operacao/i.test(stripAccents(polished.submitLabel).toLowerCase())) {
    polished.submitLabel = pickPreferredLabel(examples.ctaLabels, polished.submitLabel || context.submitLabel || 'Salvar');
  }

  if (!polished.recordsEmptyState || /nenhum registro|nenhum dado exibido|movimentacao registrada/i.test(stripAccents(polished.recordsEmptyState).toLowerCase())) {
    polished.recordsEmptyState = pickPreferredLabel(examples.emptyStates, polished.recordsEmptyState || 'Nenhum dado disponivel ainda.');
  }

  if (screenTemplate === 'settings') {
    polished.recordsTitle = pickPreferredLabel(examples.sectionLabels, 'Resumo atual');
    if (/hist?rico|fila|registros/i.test(stripAccents(polished.recordsTitle).toLowerCase())) {
      polished.recordsTitle = 'Resumo atual';
    }
    if (!polished.formCardTitle || /concluir operacao|preencha os dados/i.test(stripAccents(polished.formCardTitle).toLowerCase())) {
      polished.formCardTitle = context.pageTitle || polished.formCardTitle || 'Ajustes principais';
    }
  }

  if (
    !polished.profileSummaryTitle ||
    /resumo da feature|resumo da tela|visao atual/i.test(stripAccents(polished.profileSummaryTitle).toLowerCase())
  ) {
    polished.profileSummaryTitle = pickPreferredLabel(
      examples.sectionLabels,
      polished.profileSummaryTitle || context.pageTitle || 'Resumo atual'
    );
  }

  if (
    !polished.formCardDescription ||
    /preencha apenas o essencial|informe os dados necessarios|atualize a configuracao e confira o estado atual/i.test(
      stripAccents(polished.formCardDescription).toLowerCase()
    )
  ) {
    polished.formCardDescription =
      pickPreferredLabel(examples.helperTexts, '') ||
      polished.formCardDescription ||
      context.pageDescription ||
      'Registre o contexto principal desta etapa com clareza operacional.';
  }

  if (productMode === 'manager-cockpit') {
    polished.recordsTitle = pickPreferredLabel(examples.sectionLabels, 'Recortes principais');
    if (!polished.formCardTitle || /configuracao|dados/i.test(stripAccents(polished.formCardTitle).toLowerCase())) {
      polished.formCardTitle = 'Filtro da leitura';
    }
  }

  if (productMode === 'evidence-workbench') {
    polished.recordsTitle = pickPreferredLabel(examples.sectionLabels, 'Acervo do caso');
    if (/indexar/i.test(polished.submitLabel || '')) {
      polished.submitLabel = 'Anexar documento';
    }
  }

  if (uiIntent === 'review' && /salvar/i.test(stripAccents(polished.submitLabel || '').toLowerCase())) {
    polished.submitLabel = pickPreferredLabel(examples.ctaLabels, 'Revisar item');
  }

  polished.layoutVariant = normalizeLayoutVariant(
    polished.layoutVariant,
    productMode,
    screenTemplate,
    uiIntent
  );

  return polished;
}

function polishGeneratedUiDraft(rawDraft = {}, context = {}) {
  const draft = normalizeUiCopy(normalizeGeneratedCopy(rawDraft || {}));
  const polishedText = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.map((item) => (typeof item === 'string' ? polishUiDraftText(item, context) : item))];
      }
      if (typeof value === 'string') {
        return [key, polishUiDraftText(value, context)];
      }
      return [key, value];
    })
  );
  const polished = runUiProductPolishPass(polishedText, context);

  if (context.screenTemplate === 'settings') {
    if (!polished.recordsTitle || /rotina|registro|acompanhamento/i.test(polished.recordsTitle)) {
      polished.recordsTitle = 'Resumo atual';
    }
    if (!polished.profileSummaryTitle || /rotina|registro|acompanhamento|visao atual/i.test(polished.profileSummaryTitle)) {
      polished.profileSummaryTitle = 'Resumo atual';
    }
  }

  if (context.productMode === 'evidence-workbench') {
    if (!polished.recordsTitle || /registro|acompanhamento/i.test(polished.recordsTitle)) {
      polished.recordsTitle = 'Documentos do chamado';
    }
    if (!polished.profileSummaryTitle || /registro|acompanhamento|visao atual/i.test(polished.profileSummaryTitle)) {
      polished.profileSummaryTitle = 'Contexto do envio';
    }
  }

  if (context.productMode === 'manager-cockpit') {
    if (!polished.recordsTitle || /registro|ultimos/i.test(stripAccents(polished.recordsTitle))) {
      polished.recordsTitle = 'Recortes principais';
    }
    if (!polished.profileSummaryTitle || /registro|acompanhamento|visao atual/i.test(polished.profileSummaryTitle)) {
      polished.profileSummaryTitle = 'Leitura principal';
    }
  }

  return polished;
}

async function enrichFrontendWithAi(task, technicalSpec, userUuid = null, repairContext = null, options = {}) {
  const uxSpecialistDraft = await runUiUxSpecialistAgent(task, technicalSpec, userUuid, repairContext, options);
  if (uxSpecialistDraft) {
    technicalSpec = applyUxSpecialistDraft(technicalSpec, uxSpecialistDraft);
  }

  const domainTemplate = getDomainTemplate(technicalSpec);
  const fallback = normalizeUiCopy(normalizeGeneratedCopy({
    navigationLabel: technicalSpec.frontend.navigationLabel,
    pageTitle: technicalSpec.frontend.pageTitle,
    pageDescription: technicalSpec.frontend.pageDescription,
    heroEyebrow: domainTemplate.heroEyebrow,
    heroTitle: domainTemplate.heroTitle,
    heroDescription: domainTemplate.heroDescription,
    formCardTitle: domainTemplate.formCardTitle,
    formCardDescription: domainTemplate.formCardDescription,
    submitLabel: technicalSpec.domain.submitLabel,
    layoutVariant: inferDefaultLayoutVariant(
      technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || domainTemplate.productMode || 'structured-workspace',
      technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud',
      technicalSpec.structured?.classification?.intent || 'custom'
    ),
    highlights: domainTemplate.highlights,
    recordsTitle: domainTemplate.recordsTitle,
    recordsEmptyState: domainTemplate.recordsEmptyState,
    profileSummaryTitle: domainTemplate.profileSummaryTitle,
    profileSummaryDescription: domainTemplate.profileSummaryDescription,
    domainTemplateKey: domainTemplate.templateKey,
    screenSpec: createGenerationIR({ technicalSpec, domainTemplate, task }).frontend.screenSpec,
    dataSpec: createGenerationIR({ technicalSpec, domainTemplate, task }).frontend.dataSpec,
  }));
  const uiGenerationContext = buildUiGenerationContext(task, technicalSpec, repairContext);
  const artifactFirstDraft = polishGeneratedUiDraft(
    {
      ...fallback,
      componentMap: fallback.componentMap || fallback.screenSpec?.componentMap || {},
      screenSpec: fallback.screenSpec,
      dataSpec: fallback.dataSpec,
      layoutVariant: fallback.layoutVariant,
    },
    {
      ...uiGenerationContext,
      interfaceExamples: uiGenerationContext.designReference?.interfaceExamples || {},
    }
  );

  return {
    ...technicalSpec,
    frontend: {
      ...technicalSpec.frontend,
      ...fallback,
      ...normalizeUiCopy(normalizeGeneratedCopy(artifactFirstDraft)),
      screenSpec: normalizeUiCopy(
        normalizeGeneratedCopy(
          artifactFirstDraft?.screenSpec || uiGenerationContext.generationIR?.frontend?.screenSpec || fallback.screenSpec
        )
      ),
      dataSpec: normalizeUiCopy(
        normalizeGeneratedCopy(
          artifactFirstDraft?.dataSpec || uiGenerationContext.generationIR?.frontend?.dataSpec || fallback.dataSpec
        )
      ),
      componentMap: normalizeUiCopy(
        normalizeGeneratedCopy(
          artifactFirstDraft?.componentMap ||
            artifactFirstDraft?.screenSpec?.componentMap ||
            uiGenerationContext.generationIR?.frontend?.screenSpec?.componentMap ||
            fallback.componentMap ||
            fallback.screenSpec?.componentMap ||
            {}
        )
      ),
      generationIR: uiGenerationContext.generationIR,
      layoutVariant: normalizeLayoutVariant(
        artifactFirstDraft?.layoutVariant || fallback.layoutVariant,
        uiGenerationContext.productMode,
        uiGenerationContext.screenTemplate,
        uiGenerationContext.uiIntent
      ),
    },
    domain: {
      ...technicalSpec.domain,
      submitLabel: toAsciiUiText(artifactFirstDraft?.submitLabel || technicalSpec.domain.submitLabel),
    },
  };
}

function inferBusinessRules(sourceText, actionSpec = null) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const rules = [];

  if (actionSpec?.domainKey === 'event-schedules') {
    rules.push('Cada etapa do cronograma precisa ter um nome claro para facilitar acompanhamento e comunicacao entre os times.');
    rules.push('O cronograma inicial deve registrar um prazo planejado para cada etapa antes da execucao do evento.');
    rules.push('As notas operacionais precisam trazer contexto suficiente para orientar handoff e preparo da etapa.');
    return rules;
  }

  if (actionSpec?.domainKey === 'event-suppliers') {
    rules.push('O fornecedor precisa ter nome unico para evitar duplicidade na base operacional.');
    rules.push('Cada fornecedor deve estar associado a pelo menos uma categoria de servico valida para facilitar triagem e acionamento.');
    rules.push('O cadastro precisa registrar ao menos um contato principal com contexto suficiente para acao rapida durante a operacao.');
    return rules;
  }

  if (actionSpec?.domainKey === 'visit-operational-responsibles') {
    rules.push('O responsavel operacional precisa ter nome valido para identificacao clara durante a operacao.');
    rules.push('O contato deve aceitar e-mail valido ou telefone com DDD para acionamento rapido.');
    rules.push('O tipo de suporte precisa vir de uma lista predefinida para padronizar a classificacao.');
    rules.push('Nao e permitido duplicar responsavel operacional com mesmo nome e tipo de suporte.');
    return rules;
  }

  if (actionSpec?.domainKey === 'visit-intake') {
    rules.push('A visita precisa registrar nome, objetivo e data previstos antes de entrar no fluxo principal.');
    rules.push('O contexto inicial deve trazer informacoes suficientes para triagem da recepcao sem depender de contato adicional imediato.');
    rules.push('Nao e permitido criar a visita sem uma data prevista para organizacao operacional.');
    return rules;
  }

  if (actionSpec?.domainKey === 'support-ticket-attachments') {
    if (/\bchamado\b|\bticket\b/.test(normalized)) {
      rules.push('O documento anexado deve permanecer vinculado ao chamado correto para consulta durante o atendimento.');
    }
    if (/\bfiscal\b|\bcomprov/.test(normalized)) {
      rules.push('O tipo do documento precisa indicar se o anexo e fiscal, comprovante ou outro apoio operacional.');
    }
    if (/\barquivo\b|\banexo\b|\bdocumento\b/.test(normalized)) {
      rules.push('O anexo precisa registrar uma referencia acessivel para que o suporte consulte o documento sem retrabalho.');
    }
    return rules.length ? rules : ['O documento anexado deve permanecer vinculado ao chamado correto para consulta durante o atendimento.'];
  }

  if (actionSpec?.domainKey === 'support-performance-dashboard') {
    if (/\bcategoria\b/.test(normalized)) {
      rules.push('O painel deve permitir comparar o volume de chamados por categoria sem perder clareza na leitura gerencial.');
    }
    if (/\bstatus\b/.test(normalized)) {
      rules.push('Os indicadores precisam destacar a distribuicao por status para revelar gargalos do atendimento.');
    }
    if (/\bgestor\b|\bperformance\b|\bindicador\b/.test(normalized)) {
      rules.push('A leitura do painel deve priorizar decisao gerencial, com recortes simples e acionaveis.');
    }
    return rules.length ? rules : ['O painel deve consolidar volume por categoria e status para apoiar decisao gerencial.'];
  }

  if (/\bperfil\b/.test(normalized) && /\bconta ativa\b|\blogado\b/.test(normalized)) {
    rules.push('O aluno precisa estar autenticado e com conta ativa para atualizar o perfil.');
  }

  if (/\bperfil\b/.test(normalized) && /\bnome\b/.test(normalized) && /\bobrigatorio\b|\bnao pode ser deixado em branco\b/.test(normalized)) {
    rules.push('O nome do perfil e obrigatorio e nao pode ficar em branco.');
  }

  if (/\bperfil\b/.test(normalized) && /\b2mb\b|\btamanho maximo\b/.test(normalized)) {
    rules.push('A foto de perfil deve respeitar o limite maximo de 2MB.');
  }

  if (/\bperfil\b/.test(normalized) && /\blog de todas as atualizacoes\b|\blog de atualizacoes\b/.test(normalized)) {
    rules.push('As alteracoes de perfil devem ser registradas em hist?rico para auditoria.');
  }

  if (/\be-?mail ja cadastrado\b|\bemails duplicados\b|\bduplicad/.test(normalized)) {
    rules.push('O sistema nao deve permitir registros com e-mail duplicado.');
  }

  if (/\be-?mail invalido\b|\bformato valido\b/.test(normalized)) {
    rules.push('O e-mail deve ser validado antes do envio para persistencia.');
  }

  if (/\bsenha invalida\b|\bcriterios de seguranca\b|\b8 caracteres\b/.test(normalized)) {
    rules.push('A senha precisa atender aos criterios minimos de seguranca antes de criar o registro.');
  }

  if (/\bhash\b|\bcryptograf/.test(normalized)) {
    rules.push('A senha nao deve ser persistida em texto puro no ambiente real.');
  }

  return rules;
}

function inferQaScenarios(sourceText, actionSpec = null) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const scenarios = [];

  if (actionSpec?.domainKey === 'event-schedules') {
    scenarios.push({ code: 'missing_stage_name', message: 'Informe o nome da etapa antes de salvar o cronograma.' });
    scenarios.push({ code: 'missing_planned_deadline', message: 'Defina um prazo planejado para esta etapa do cronograma.' });
    scenarios.push({ code: 'missing_execution_notes', message: 'Registre notas operacionais minimas para orientar a execucao da etapa.' });
    scenarios.push({ code: 'duplicated_stage_name', message: 'Ja existe uma etapa com este nome no cronograma atual.' });
    return scenarios;
  }

  if (actionSpec?.domainKey === 'event-suppliers') {
    scenarios.push({ code: 'missing_supplier_name', message: 'Informe o nome do fornecedor antes de concluir o cadastro.' });
    scenarios.push({ code: 'missing_service_category', message: 'Selecione a categoria de servico principal do fornecedor.' });
    scenarios.push({ code: 'missing_primary_contacts', message: 'Registre pelo menos um contato principal para acionar este fornecedor.' });
    scenarios.push({ code: 'duplicated_supplier_name', message: 'Ja existe um fornecedor cadastrado com este nome.' });
    return scenarios;
  }

  if (actionSpec?.domainKey === 'visit-operational-responsibles') {
    scenarios.push({ code: 'missing_responsible_name', message: 'Informe o nome do responsavel operacional antes de salvar.' });
    scenarios.push({ code: 'invalid_contact', message: 'Informe um contato valido por e-mail ou telefone com DDD.' });
    scenarios.push({ code: 'missing_support_type', message: 'Selecione o tipo de suporte principal deste responsavel.' });
    scenarios.push({ code: 'duplicated_operational_responsible', message: 'Ja existe um responsavel operacional com este nome e tipo de suporte.' });
    return scenarios;
  }

  if (actionSpec?.domainKey === 'visit-intake') {
    scenarios.push({ code: 'missing_visit_name', message: 'Informe o nome da visita antes de criar o registro.' });
    scenarios.push({ code: 'missing_visit_purpose', message: 'Descreva o objetivo principal desta visita.' });
    scenarios.push({ code: 'missing_scheduled_date', message: 'Defina a data prevista da visita antes de continuar.' });
    scenarios.push({ code: 'missing_initial_context', message: 'Registre o contexto inicial minimo para orientar a recepcao.' });
    return scenarios;
  }

  if (actionSpec?.domainKey === 'support-ticket-attachments') {
    scenarios.push({ code: 'missing_document_type', message: 'Selecione o tipo de documento antes de anexar o arquivo.' });
    scenarios.push({ code: 'missing_file_reference', message: 'Informe o arquivo ou link do comprovante antes de concluir o anexo.' });
    if (/\bdescricao\b|\bcontexto\b|\bdetalh/.test(normalized) || true) {
      scenarios.push({ code: 'missing_attachment_context', message: 'Descreva rapidamente o contexto do documento para apoiar a triagem.' });
    }
    return scenarios;
  }

  if (actionSpec?.domainKey === 'support-performance-dashboard') {
    scenarios.push({ code: 'missing_category_filter', message: 'Selecione ao menos uma categoria para consolidar o painel.' });
    scenarios.push({ code: 'missing_status_filter', message: 'Defina o status principal para comparar o volume do atendimento.' });
    scenarios.push({ code: 'missing_time_range', message: 'Escolha o periodo do recorte antes de atualizar os indicadores.' });
    return scenarios;
  }

  if (/\bperfil\b/.test(normalized) && /\bnome\b/.test(normalized) && /\bobrigatorio\b|\bnao pode ser deixado em branco\b/.test(normalized)) {
    scenarios.push({ code: 'required_full_name', message: 'Nome obrigatorio.' });
  }

  if (/\bperfil\b/.test(normalized) && /\bfoto\b|\bimagem\b/.test(normalized) && /\b2mb\b|\btamanho maximo\b/.test(normalized)) {
    scenarios.push({ code: 'invalid_profile_photo_size', message: 'A foto do perfil excede o limite permitido.' });
  }

  if (/\bperfil\b/.test(normalized) && /\bfoto\b|\bimagem\b/.test(normalized) && /\btipo de arquivo invalido\b|\bnao for uma imagem valida\b/.test(normalized)) {
    scenarios.push({ code: 'invalid_profile_photo_type', message: 'A foto do perfil precisa ser uma imagem valida.' });
  }

  if (/\bperfil\b/.test(normalized) && /\bconta inativa\b|\bconta ativa\b/.test(normalized)) {
    scenarios.push({ code: 'inactive_account', message: 'A conta precisa estar ativa para atualizar o perfil.' });
  }

  if (/\be-?mail ja cadastrado\b|\bduplicad/.test(normalized)) {
    scenarios.push({ code: 'duplicate_email', message: 'E-mail ja cadastrado.' });
  }

  if (/\bsenha invalida\b|\bcriterios de seguranca\b/.test(normalized)) {
    scenarios.push({ code: 'invalid_password', message: 'Senha invalida.' });
  }

  if (/\be-?mail invalido\b|\bformato valido\b/.test(normalized)) {
    scenarios.push({ code: 'invalid_email', message: 'E-mail invalido.' });
  }

  if (!scenarios.length) {
    scenarios.push({ code: 'invalid_payload', message: 'Os dados informados sao invalidos.' });
  }

  return scenarios;
}

function toPrismaEnumName(modelName, fieldName) {
  return `${String(modelName || 'Generated').replace(/[^A-Za-z0-9]/g, '')}${pascalCase(fieldName, 'Field')}Enum`;
}

function extractPrismaDatasourceProvider(content) {
  const match = String(content || '').match(/datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
  return String(match?.[1] || 'mysql').trim().toLowerCase();
}

function normalizePrismaAttributesForProvider(attributes = [], provider = 'mysql') {
  if (provider !== 'sqlite') {
    return attributes;
  }

  return attributes.filter((attribute) => !String(attribute).startsWith('@db.'));
}

function buildPrismaModelMeta(provider = 'mysql') {
  if (provider === 'sqlite') {
    return {
      idLine: '  id        Int      @id @default(autoincrement())',
      statusLine: '  status    String   @default("draft")',
      createdAtLine: '  createdAt DateTime @default(now())',
      updatedAtLine: '  updatedAt DateTime @updatedAt',
    };
  }

  return {
    idLine: '  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt',
    statusLine: '  status    String   @default("draft") @db.VarChar(40)',
    createdAtLine: '  createdAt DateTime @default(now()) @db.DateTime(0)',
    updatedAtLine: '  updatedAt DateTime @updatedAt @db.DateTime(0)',
  };
}

function resolvePrismaFieldConfig(field, modelName = 'GeneratedModel', provider = 'mysql') {
  if (field.name === 'email') {
    return {
      fieldName: 'email',
      type: 'String',
      attributes: normalizePrismaAttributesForProvider(['@unique', '@db.VarChar(190)'], provider),
    };
  }

  if (field.name === 'password') {
    return {
      fieldName: 'passwordHash',
      type: 'String',
      attributes: normalizePrismaAttributesForProvider(['@db.VarChar(255)'], provider),
    };
  }

  if (Array.isArray(field.selectOptions) && field.selectOptions.length) {
    const enumName = toPrismaEnumName(modelName, field.name);
    const attributes = [];
    if (field.defaultValue && field.selectOptions.includes(field.defaultValue)) {
      attributes.push(`@default(${field.defaultValue})`);
    }
    return { fieldName: field.name, type: enumName, attributes, enumName, enumValues: field.selectOptions };
  }

  if (field.inputType === 'textarea') {
    return {
      fieldName: field.name,
      type: 'String',
      attributes: normalizePrismaAttributesForProvider(['@db.Text'], provider),
    };
  }

  if (field.inputType === 'number') {
    const normalizedName = stripAccents(field.name).toLowerCase();
    if (/\bprice\b|\bvalor\b|\bpreco\b|\bamount\b/.test(normalizedName)) {
      return {
        fieldName: field.name,
        type: 'Decimal',
        attributes: normalizePrismaAttributesForProvider(['@db.Decimal(10,2)'], provider),
      };
    }
    return { fieldName: field.name, type: 'Int', attributes: [] };
  }

  if (field.inputType === 'date' || /date|data/.test(stripAccents(field.name).toLowerCase())) {
    return {
      fieldName: field.name,
      type: 'DateTime',
      attributes: normalizePrismaAttributesForProvider(['@db.DateTime(0)'], provider),
    };
  }

  if (field.inputType === 'url') {
    return {
      fieldName: field.name,
      type: 'String',
      attributes: normalizePrismaAttributesForProvider(['@db.VarChar(500)'], provider),
    };
  }

  return {
    fieldName: field.name,
    type: field.prismaType || 'String',
    attributes: normalizePrismaAttributesForProvider(['@db.VarChar(190)'], provider),
  };
}

function buildPrismaFieldLine(field, modelName = 'GeneratedModel', provider = 'mysql') {
  const config = resolvePrismaFieldConfig(field, modelName, provider);
  const attributes = config.attributes?.length ? ` ${config.attributes.join(' ')}` : '';
  return `  ${config.fieldName.padEnd(18, ' ')} ${config.type}${attributes}`;
}

function buildPrismaEnumBlocks(fields, modelName) {
  const blocks = [];
  const seen = new Set();

  for (const field of fields || []) {
    const config = resolvePrismaFieldConfig(field, modelName);
    if (!config.enumName || !Array.isArray(config.enumValues) || seen.has(config.enumName)) continue;
    seen.add(config.enumName);
    const enumValues = config.enumValues.map((value) => `  ${value}`).join('\n');
    blocks.push(`enum ${config.enumName} {\n${enumValues}\n}`);
  }

  return blocks;
}

function buildFieldInitializer(field) {
  if (field.name === 'email') return `email: input.email.trim().toLowerCase()`;
  if (field.name === 'password') return `passwordHash: \`hashed:\${input.password}\``;
  return `${field.name}: input.${field.name}`;
}

function buildRouterFieldAssignment(field) {
  if (field.name === 'password') {
    return `  password: String(payload.password || ''),`;
  }

  if (field.name === 'email') {
    return `  email: String(payload.email || '').trim().toLowerCase(),`;
  }

  if (field.inputType === 'number') {
    return `  ${field.name}: payload.${field.name} === undefined || payload.${field.name} === null || payload.${field.name} === '' ? Number.NaN : Number(payload.${field.name}),`;
  }

  if (field.inputType === 'date' || /date|data/.test(stripAccents(field.name).toLowerCase())) {
    return `  ${field.name}: payload.${field.name} ? new Date(String(payload.${field.name})).toISOString() : '',`;
  }

  return `  ${field.name}: String(payload.${field.name} || ''),`;
}

function buildServiceFieldValidation(field) {
  const label = field.label || humanizeFieldName(field.name);
  const lines = [];

  if (field.required) {
    if (field.inputType === 'number') {
      lines.push(`  if (!Number.isFinite(input.${field.name})) throw new Error('${label} invalido.');`);
    } else {
      lines.push(`  if (!String(input.${field.name} || '').trim()) throw new Error('${label} obrigatorio.');`);
    }
  }

  if (Array.isArray(field.selectOptions) && field.selectOptions.length) {
    const optionsLiteral = JSON.stringify(field.selectOptions);
    lines.push(`  if (!${optionsLiteral}.includes(String(input.${field.name}))) throw new Error('${label} invalido.');`);
  }

  if (field.inputType === 'email') {
    lines.push(`  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(input.${field.name} || ''))) throw new Error('${label} invalido.');`);
  }

  if (field.inputType === 'url') {
    lines.push(`  if (!/^https?:\\/\\//.test(String(input.${field.name} || ''))) throw new Error('${label} invalido.');`);
  }

  if (field.inputType === 'number') {
    lines.push(`  if (!Number.isFinite(input.${field.name})) throw new Error('${label} invalido.');`);
    if (/price|valor|preco|amount/.test(stripAccents(field.name).toLowerCase())) {
      lines.push(`  if (input.${field.name} < 0) throw new Error('${label} nao pode ser negativo.');`);
    }
  }

  const minValidation = (field.validations || []).find((validation) => /^min:\d+/.test(validation));
  if (minValidation) {
    const minLength = Number(minValidation.split(':')[1] || '0');
    lines.push(`  if (String(input.${field.name} || '').trim().length < ${minLength}) throw new Error('${label} deve ter ao menos ${minLength} caracteres.');`);
  }

  return lines;
}

function buildDomainSpecificValidation(actionSpec, fields) {
  if (actionSpec.domainKey === 'event-schedules') {
    return [
      `  const duplicatedStage = existingRecords.find((record) => String(record.stageName || '').toLowerCase() === String(input.stageName || '').toLowerCase());`,
      `  if (duplicatedStage) throw new Error('Ja existe uma etapa cadastrada com este nome no cronograma.');`,
      `  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(input.plannedDeadline || ''))) throw new Error('Informe um prazo planejado valido para a etapa.');`,
      `  if (String(input.executionNotes || '').trim().length < 10) throw new Error('Descreva melhor o contexto operacional desta etapa.');`,
    ];
  }

  if (actionSpec.domainKey === 'access-control-roles') {
    return [
      `  const duplicatedRole = existingRecords.find((record) => record.roleName === input.roleName);`,
      `  if (duplicatedRole) throw new Error('Ja existe um perfil configurado para esta funcao.');`,
    ];
  }

  if (actionSpec.domainKey === 'support-ticket-attachments') {
    return [
      `  if (String(input.documentDescription || '').trim().length < 10) throw new Error('Descreva melhor o contexto do anexo.');`,
      `  if (!/^https?:\\/\\//.test(String(input.fileUrl || ''))) throw new Error('Informe um arquivo ou link valido para o documento.');`,
    ];
  }

  if (actionSpec.domainKey === 'support-performance-dashboard') {
    return [
      `  if (String(input.categoryFilter || '') === String(input.statusFilter || '')) {`,
      `    throw new Error('Categoria e status precisam representar recortes diferentes do painel.');`,
      `  }`,
    ];
  }

  if (actionSpec.domainKey === 'visit-operational-responsibles') {
    return [
      `  const duplicatedResponsible = existingRecords.find((record) => String(record.responsibleName || '').toLowerCase() === String(input.responsibleName || '').trim().toLowerCase() && String(record.supportType || '') === String(input.supportType || ''));`,
      `  if (duplicatedResponsible) throw new Error('Ja existe um responsavel operacional com este nome e tipo de suporte.');`,
      `  const contactValue = String(input.contact || '').trim();`,
      `  const isEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(contactValue);`,
      `  const isPhone = /^\\(?\\d{2}\\)?\\s?\\d{4,5}-?\\d{4}$/.test(contactValue);`,
      `  if (!isEmail && !isPhone) throw new Error('Informe um contato valido por e-mail ou telefone com DDD.');`,
    ];
  }

  if (actionSpec.domainKey === 'visit-extra-companions') {
    return [
      `  const duplicatedCompanion = existingRecords.find((record) => String(record.approvedVisitCode || '').toLowerCase() === String(input.approvedVisitCode || '').trim().toLowerCase() && String(record.companionName || '').toLowerCase() === String(input.companionName || '').trim().toLowerCase());`,
      `  if (duplicatedCompanion) throw new Error('Este acompanhante extra ja foi vinculado a esta visita aprovada.');`,
      `  if (String(input.securityFastApproval || '') !== 'aprovado' && String(input.securityFastApproval || '') !== 'pendente') throw new Error('Informe se a aprovacao rapida da seguranca esta pendente ou aprovada.');`,
    ];
  }

  if (actionSpec.domainKey === 'event-suppliers') {
    return [
      `  const duplicatedSupplier = existingRecords.find((record) => String(record.supplierName || '').toLowerCase() === String(input.supplierName || '').toLowerCase());`,
      `  if (duplicatedSupplier) throw new Error('Ja existe um fornecedor cadastrado com este nome.');`,
      `  if (String(input.primaryContacts || '').trim().length < 10) throw new Error('Informe contatos principais com contexto suficiente para acionamento.');`,
    ];
  }

  return [];
}

function hasEncodingArtifacts(content) {
  return /[\u00C3\u00C2\u00E2\uFFFD]/.test(String(content || ''));
}

function normalizeSharedUiImportPath(content) {
  return String(content || '')
    .replace(/packages\/ui\/src\/index(?=['"])/g, 'packages/ui/src/index.tsx')
    .replace(/packages\/ui\/src\/index(?:\.tsx)?\/api\/client/g, 'packages/ui/src/api/client')
    .replace(/packages\/ui\/src\/index(?:\.tsx)?\/apiClient/g, 'packages/ui/src/api/client')
    .replace(/packages\/ui\/src\/index(?:\.tsx)?\/api-client/g, 'packages/ui/src/api/client');
}

function inferUiStates(actionSpec, fields, qaScenarios) {
  return {
    loading: `Carregando dados de ${actionSpec.navigationLabel.toLowerCase()}...`,
    empty: actionSpec.recordsEmptyState || 'Nenhum registro disponivel ainda.',
    success: actionSpec.successMessage,
    error: 'Nao foi possivel concluir a operacao. Revise os dados e tente novamente.',
    validation: qaScenarios.map((scenario) => scenario.message).slice(0, 5),
    fieldCount: fields.length,
  };
}

function inferValidationSummary(fields) {
  return fields.map((field) => ({
    field: field.name,
    label: field.label,
    required: field.required,
    validations: field.validations || [],
  }));
}

function inferPermissions(sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();
  return {
    requiresAuthentication: /\blogado\b|\bautenticad|\bconta ativa\b/.test(normalized),
    actor: /\bassistente de recepcao\b|\brecepcionista\b/.test(normalized)
      ? 'receptionist'
      : /\baluno\b/.test(normalized)
        ? 'student'
        : /\binfoprodutor\b/.test(normalized)
          ? 'creator'
          : 'user',
    scope: /\badmin\b|\badministrador\b/.test(normalized)
      ? 'admin'
      : /\bvisita\b|\bvisitas\b|\brecepcao\b|\boperacional\b/.test(normalized)
        ? 'operations'
        : 'self_service',
  };
}

function inferDomainName(actionSpec, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec.domainKey.startsWith('auth-')) return 'auth';
  if (actionSpec.domainKey === 'event-schedules') return 'events';
  if (actionSpec.domainKey === 'event-suppliers') return 'events';
  if (actionSpec.domainKey === 'visit-operational-responsibles') return 'visits';
  if (actionSpec.domainKey === 'visit-intake') return 'visit-intake';
  if (actionSpec.domainKey === 'visit-recurring-history') return 'visits';
  if (actionSpec.domainKey === 'visit-extra-companions') return 'visits';
  if (actionSpec.domainKey === 'visit-approval-cutoff-settings') return 'visits';
  if (actionSpec.domainKey === 'support-performance-dashboard' || /\bpainel\b|\bdashboard\b|\brelatorio\b/.test(normalized) && /\bchamado\b|\batendimento\b|\bperformance\b/.test(normalized)) return 'support';
  if (actionSpec.domainKey === 'support-ticket-attachments' || /\bchamado\b|\bsuporte\b|\bticket\b/.test(normalized) && /\banexo\b|\barquivo\b|\bdocumento\b/.test(normalized)) return 'support';
  if (actionSpec.domainKey === 'access-control-roles' || /\bpermiss/.test(normalized) || /\brole\b|\broles\b/.test(normalized)) return 'access-control';
  if (actionSpec.domainKey === 'ticket-notification-preferences' || /\bnotifica/.test(normalized) || /\balerta\b/.test(normalized)) return 'notification';
  if (actionSpec.domainKey === 'profile-settings' || /\bperfil\b/.test(normalized)) return 'profile';
  if (['course-catalog', 'course-modules', 'course-lessons', 'lesson-materials'].includes(actionSpec.domainKey)) {
    return 'education';
  }
  if (/\bupload\b|\barquivo\b|\banexo\b|\bimagem\b/.test(normalized)) return 'upload';
  if (/\bcrud\b|\blistar\b|\bcriar\b|\beditar\b|\bexcluir\b/.test(normalized)) return 'crud';

  return 'custom';
}

function inferIntent(actionSpec, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec.domainKey === 'auth-login' || /\blogin\b|\bentrar\b|\bautentic/.test(normalized)) return 'login';
  if (actionSpec.domainKey === 'auth-register' || /\bregistr/.test(normalized) || /\bcadastr/.test(normalized)) return 'register';
  if (actionSpec.domainKey === 'event-schedules') return 'plan';
  if (actionSpec.domainKey === 'event-suppliers') return 'register';
  if (actionSpec.domainKey === 'visit-operational-responsibles') return 'register';
  if (actionSpec.domainKey === 'visit-intake') return 'create';
  if (actionSpec.domainKey === 'visit-recurring-history') return 'review';
  if (actionSpec.domainKey === 'visit-extra-companions') return 'attach';
  if (actionSpec.domainKey === 'support-performance-dashboard') return 'monitor';
  if (actionSpec.domainKey === 'support-ticket-attachments') return 'attach';
  if (actionSpec.domainKey === 'access-control-roles' || /\bconfigurar\b/.test(normalized) && /\bpermiss/.test(normalized)) return 'configure';
  if (actionSpec.domainKey === 'ticket-notification-preferences') return 'configure';
  if (actionSpec.domainKey === 'profile-settings' || /\batualiz/.test(normalized) || /\bedita/.test(normalized)) return 'update';
  if (actionSpec.domainKey === 'course-catalog') return 'create';
  if (actionSpec.domainKey === 'course-modules') return 'structure';
  if (actionSpec.domainKey === 'course-lessons') return 'compose';
  if (actionSpec.domainKey === 'lesson-materials') return 'attach';
  if (/\bupload\b|\benviar\b/.test(normalized)) return 'upload';
  if (/\bcriar\b/.test(normalized)) return 'create';
  if (/\blistar\b|\bvisualizar\b/.test(normalized)) return 'list';

  return 'custom';
}

function inferScreenTemplate(actionSpec, fields, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const hasFewFields = (fields || []).length <= 3;

  if (actionSpec.domainKey === 'event-schedules') return 'workspace';
  if (actionSpec.domainKey === 'event-suppliers') return 'workspace';
  if (actionSpec.domainKey === 'visit-operational-responsibles') return hasFewFields ? 'crud' : 'workspace';
  if (actionSpec.domainKey === 'visit-intake') return 'crud';
  if (actionSpec.domainKey === 'visit-recurring-history') return 'dashboard';
  if (actionSpec.domainKey === 'visit-extra-companions') return hasFewFields ? 'crud' : 'workspace';
  if (actionSpec.domainKey === 'visit-approval-cutoff-settings') return 'settings';
  if (actionSpec.domainKey === 'support-performance-dashboard') return 'dashboard';
  if (actionSpec.domainKey === 'support-ticket-attachments') return 'workspace';
  if (actionSpec.domainKey === 'access-control-roles') return 'settings';
  if (actionSpec.domainKey === 'ticket-notification-preferences') return 'settings';
  if (actionSpec.domainKey === 'profile-settings') return 'settings';
  if (actionSpec.domainKey.startsWith('auth-')) return hasFewFields ? 'settings' : 'wizard';
  if (/\bdashboard\b|\bpainel\b|\brelatorio\b|\bmetricas\b/.test(normalized)) return 'dashboard';
  if (/\bchamado\b|\bfila\b|\bcarteira\b|\batendente\b|\banalista\b|\breclassific/.test(normalized)) return 'workspace';
  if (/\betapa\b|\bpasso\b|\bwizard\b|\bsequencia\b/.test(normalized)) return 'wizard';
  if (/\bconfigurar\b|\bpreferencia\b|\bajuste\b|\bperfil\b/.test(normalized)) return 'settings';

  return 'crud';
}

function extractArchitectureHighlights(architectureSource) {
  const lines = String(architectureSource || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {
    stack: [],
    modules: [],
    entities: [],
    contracts: [],
  };

  for (const line of lines) {
    const normalized = stripAccents(line).toLowerCase();

    if (sections.stack.length < 5 && /\b(stack|frontend|backend|prisma|react|express|vite|typescript)\b/.test(normalized)) {
      sections.stack.push(line);
    }

    if (sections.modules.length < 6 && /\b(modulo|modulos|module|feature|dominio|domain)\b/.test(normalized)) {
      sections.modules.push(line);
    }

    if (sections.entities.length < 6 && /\b(entidade|entidades|entity|model|modelo|tabela)\b/.test(normalized)) {
      sections.entities.push(line);
    }

    if (sections.contracts.length < 6 && /\b(api|rota|route|endpoint|contract|contrato)\b/.test(normalized)) {
      sections.contracts.push(line);
    }
  }

  return sections;
}

function inferUiFamilyFromSpec(technicalSpec = {}, implementationManifest = null) {
  const explicitUiFamily =
    implementationManifest?.classification?.uiFamily ||
    technicalSpec.implementationManifest?.classification?.uiFamily ||
    technicalSpec.classification?.uiFamily ||
    technicalSpec.frontend?.uiFamily ||
    technicalSpec.structured?.classification?.uiFamily;

  if (explicitUiFamily) return explicitUiFamily;

  const screenTemplate =
    implementationManifest?.classification?.screenTemplate ||
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const productMode =
    implementationManifest?.classification?.productMode ||
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    '';
  const pageArchetype =
    technicalSpec.generationIR?.frontend?.screenSpec?.pageArchetype ||
    technicalSpec.frontend?.pageArchetype ||
    '';

  if (screenTemplate === 'settings') return 'settings-console';
  if (screenTemplate === 'dashboard' || productMode === 'manager-cockpit' || pageArchetype === 'executive-dashboard') {
    return 'executive-cockpit';
  }
  if (screenTemplate === 'workspace' && (String(productMode).includes('planner') || pageArchetype === 'approval-flow')) {
    return 'planner-workbench';
  }
  return 'operations-workspace';
}

function sanitizeArchitectureSummaryItems(items = [], { kind = 'generic', limit = 5 } = {}) {
  const bannedPatterns = [
    /FIM_DA_ARQUITETURA/i,
    /FIM_DO_/i,
    /WEB\[/i,
    /\/modules\/auth/i,
    /\bKeycloak\b/i,
    /\bGraphQL\b/i,
    /\bKubernetes\b/i,
    /\bEKS\b/i,
    /\bLaunchDarkly\b/i,
    /\bFirebase\b/i,
    /\bRedis\b/i,
    /\bCQRS\b/i,
    /\bEvent Sourcing\b/i,
    /\bDRAFT\b.*\bAPPROVED\b/i,
  ];

  const kindPatterns =
    kind === 'stack'
      ? [/\bfrontend\b/i, /\bbackend\b/i, /\breact\b/i, /\bexpress\b/i, /\bvite\b/i, /\bprisma\b/i, /\bpostgres/i, /\btypescript\b/i]
      : [/\bmodulo\b/i, /\bmodulos\b/i, /\bresponsab/i, /\bvisita\b/i, /\bresponsavel\b/i, /\boperac/i, /\broute\b/i, /\brota\b/i, /\bcontrato\b/i];

  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').replace(/^[\-\s#|]+/, '').trim())
        .filter(Boolean)
        .filter((item) => !bannedPatterns.some((pattern) => pattern.test(item)))
        .filter((item) => kindPatterns.some((pattern) => pattern.test(item)))
        .map((item) => item.replace(/\s+/g, ' ').trim())
    )
  ).slice(0, limit);
}

function buildImplementationDocContent(task, technicalSpec) {
  const screenTemplate =
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const uiFamily = inferUiFamilyFromSpec(technicalSpec, technicalSpec.implementationManifest || null);
  const stackLines = sanitizeArchitectureSummaryItems(technicalSpec.architecture?.sourceSummary?.stack || [], {
    kind: 'stack',
    limit: 5,
  });
  const moduleLines = sanitizeArchitectureSummaryItems(technicalSpec.architecture?.sourceSummary?.modules || [], {
    kind: 'modules',
    limit: 6,
  });
  const domainRules = Array.isArray(technicalSpec.businessRules) ? technicalSpec.businessRules.slice(0, 4) : [];

  return `# ${task.title}

Task UUID: ${task.uuid}

## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.

## Template de tela
- screenTemplate: ${screenTemplate}
- uiFamily: ${uiFamily}
- productMode: ${technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || 'operations-registry'}

## Rotas
- Frontend: ${technicalSpec.frontend.suggestedRoute}
- Backend: ${technicalSpec.backend.routeBase}

## Contratos da feature
- Request: ${technicalSpec.shared?.requestContractName || 'n/d'}
- Response: ${technicalSpec.shared?.responseContractName || 'n/d'}
- Shared contract: ${technicalSpec.shared?.contractPath || 'n/d'}

## Campos principais
${(technicalSpec.domain?.fields || []).map((field) => `- ${field.label || field.name}: ${field.helperText || 'Campo operacional da feature.'}`).join('\n') || '- Sem campos identificados.'}

## Regras operacionais
${domainRules.map((line) => `- ${line}`).join('\n') || '- Sem regras adicionais registradas.'}

## Stack e arquitetura
${stackLines.map((line) => `- ${line}`).join('\n') || '- React + TypeScript + Vite no frontend; Express + Prisma no backend.'}

## Modulos e limites
${moduleLines.map((line) => `- ${line}`).join('\n') || '- Modulo isolado para responsaveis operacionais com contratos compartilhados e rotas REST basicas.'}
`;
}

function buildUiSections(actionSpec, fields, frontendSpec) {
  const screenTemplate = frontendSpec.screenTemplate || 'crud';
  const productMode = frontendSpec.productMode || 'structured-workspace';
  const sections = [
    {
      key: 'hero',
      type: 'hero',
      title: frontendSpec.pageTitle,
      description: frontendSpec.pageDescription,
    },
  ];

  sections.push({
    key: 'form',
      type: 'form',
      title: frontendSpec.formCardTitle || actionSpec.pageTitle,
      description: frontendSpec.formCardDescription || actionSpec.pageDescription,
      productMode,
      fields: fields.map((field) => ({
      name: field.name,
      label: field.label,
      inputType: field.inputType,
      required: field.required,
      helperText: field.helperText,
      placeholder: field.placeholder,
      validations: field.validations || [],
      selectOptions: field.selectOptions || [],
    })),
    primaryAction: actionSpec.submitLabel,
  });

  if (screenTemplate === 'settings') {
    sections.push({
      key: 'summary',
      type: 'summary',
      title: frontendSpec.profileSummaryTitle || 'Estado atual',
      description: frontendSpec.profileSummaryDescription || frontendSpec.recordsEmptyState || frontendSpec.pageDescription,
      productMode,
    });
  } else if (screenTemplate === 'wizard') {
    sections.push({
      key: 'next-step',
      type: 'guidance',
      title: frontendSpec.profileSummaryTitle || 'Proximo passo',
      description: frontendSpec.profileSummaryDescription || frontendSpec.pageDescription,
      productMode,
    });
  } else if (screenTemplate === 'dashboard') {
    sections.push({
      key: 'insights',
      type: 'insights',
      title: frontendSpec.recordsTitle || 'Leitura consolidada',
      description: frontendSpec.recordsEmptyState || frontendSpec.pageDescription,
      productMode,
    });
  } else if (screenTemplate === 'workspace') {
    sections.push({
      key: 'queue',
      type: 'queue',
      title: frontendSpec.recordsTitle || 'Fila operacional',
      description: frontendSpec.recordsEmptyState || frontendSpec.pageDescription,
      productMode,
    });
  } else {
    sections.push({
      key: 'records',
      type: 'list',
      title: frontendSpec.recordsTitle || 'Registros ativos',
      description: frontendSpec.recordsEmptyState || frontendSpec.pageDescription,
      productMode,
    });
  }

  return sections;
}

function buildStructuredSpec(task, actionSpec, fields, businessRules, qaScenarios, frontendSpec, backendSpec, sharedSpec, databaseSpec) {
  const domainTemplate = getDomainTemplate({
    featureKey: slugify(actionSpec.domainKey, task.uuid),
    frontend: frontendSpec,
    entityName: databaseSpec.modelName,
    summary: actionSpec.summary,
  });
  const screenTemplate = inferScreenTemplate(actionSpec, fields, `${task.title}\n${task.description || ''}`);
  const productMode = domainTemplate.productMode || 'structured-workspace';
  const layoutVariant = inferDefaultLayoutVariant(productMode, screenTemplate, inferIntent(actionSpec, `${task.title}\n${task.description || ''}`));
  return {
    classification: {
      domain: inferDomainName(actionSpec, `${task.title}\n${task.description || ''}`),
      intent: inferIntent(actionSpec, `${task.title}\n${task.description || ''}`),
      screenTemplate,
      productMode,
      layoutVariant,
      changeType: 'feature',
      implementationMode: 'post_refinement',
      templateKey: domainTemplate.templateKey,
    },
    entities: [
      {
        name: databaseSpec.modelName,
        source: 'task_refinement',
        fields: fields.map((field) => ({
          name: field.name,
          type: field.tsType,
          required: field.required,
          unique: field.unique,
          inputType: field.inputType,
        })),
      },
    ],
    ui: {
      route: frontendSpec.suggestedRoute,
      navigationLabel: frontendSpec.navigationLabel,
      sections: buildUiSections(actionSpec, fields, { ...frontendSpec, screenTemplate, productMode }),
      layoutVariant,
      states: inferUiStates(
        {
          ...actionSpec,
          recordsEmptyState: frontendSpec.recordsEmptyState || domainTemplate.recordsEmptyState,
        },
        fields,
        qaScenarios
      ),
    },
    api: {
      routeBase: backendSpec.routeBase,
      routes: backendSpec.routes,
      requestContractName: sharedSpec.requestContractName,
      responseContractName: sharedSpec.responseContractName,
      actor: inferPermissions(`${task.title}\n${task.description || ''}`).actor,
    },
    constraints: {
      businessRules,
      qaScenarios,
      validations: inferValidationSummary(fields),
      permissions: inferPermissions(`${task.title}\n${task.description || ''}`),
    },
    files: {
      frontend: [
        `${frontendSpec.featurePath}/page.tsx`,
        `${frontendSpec.featurePath}/service.ts`,
        `${frontendSpec.featurePath}/index.ts`,
      ],
      backend: [
        `${backendSpec.modulePath}/service.ts`,
        `${backendSpec.modulePath}/router.ts`,
        `${backendSpec.modulePath}/index.ts`,
      ],
      shared: [sharedSpec.contractPath],
      database: [databaseSpec.schemaPath],
    },
  };
}

async function getProjectArchitectureSource(projectUuid) {
  const architectureStatus = await getProjectArchitectureStatus(projectUuid);

  if (!architectureStatus.allStoriesRefined) {
    throw new Error('A implementacao so pode comecar quando todas as historias do projeto estiverem refinadas.');
  }

  if (!architectureStatus.hasArchitecture || !architectureStatus.architectureArtifact?.content) {
    throw new Error('A arquitetura do projeto precisa ser gerada antes de liberar implementacao.');
  }

  return architectureStatus.architectureArtifact.content;
}

function buildTechnicalSpec(task, projectArchitectureSource = '') {
  const requirements = task.artifacts.find((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent);
  const testPlan = task.artifacts.find((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent);
  const requirementsSource = requirements?.content || '';
  const qaSource = testPlan?.content || '';
  const architectureSource = projectArchitectureSource || '';
  const classificationSource = `${task.title}\n${requirementsSource}\n${qaSource}`;
  const sourceText = `${classificationSource}\n${architectureSource}`;
  const actionSpec = inferActionSpec(task, classificationSource);
  const featureKey = slugify(actionSpec.domainKey, task.uuid);
  const entityName = actionSpec.entityName;
  const routerName = `${entityName}Router`;
  const routeBase = actionSpec.routeBase;
  const fields = inferFieldDefinitions(sourceText, actionSpec);
  const businessRules = inferBusinessRules(sourceText, actionSpec);
  const qaScenarios = inferQaScenarios(sourceText, actionSpec);
  const uiStates = inferUiStates(actionSpec, fields, qaScenarios);
  const validationSummary = inferValidationSummary(fields);
  const permissions = inferPermissions(sourceText);
  const screenTemplate = inferScreenTemplate(actionSpec, fields, sourceText);
  const architectureHighlights = extractArchitectureHighlights(architectureSource);
  const requestContractName = `${entityName}Request`;
  const responseContractName = `${entityName}Response`;
  const listContractName = `${entityName}ListResponse`;
  const frontendSpec = {
    featurePath: `apps/web/src/features/${featureKey}`,
    suggestedRoute: actionSpec.frontendRoute,
    pageComponentName: actionSpec.pageComponentName,
    serviceName: `${entityName}Api`,
    formComponentName: `${entityName}Form`,
    navigationLabel: actionSpec.navigationLabel,
    pageTitle: actionSpec.pageTitle,
    pageDescription: actionSpec.pageDescription,
    productMode: getDomainTemplate({ featureKey: actionSpec.domainKey, frontend: { navigationLabel: actionSpec.navigationLabel }, entityName, summary: actionSpec.summary }).productMode || 'structured-workspace',
    layoutVariant: inferDefaultLayoutVariant(
      getDomainTemplate({ featureKey: actionSpec.domainKey, frontend: { navigationLabel: actionSpec.navigationLabel }, entityName, summary: actionSpec.summary }).productMode || 'structured-workspace',
      screenTemplate,
      inferIntent(actionSpec, sourceText)
    ),
  };
  const backendSpec = {
    modulePath: `apps/api/src/modules/${featureKey}`,
    routeBase,
    routerName,
    serviceName: actionSpec.serviceName,
    serviceInstanceName: `${entityName}ServiceInstance`,
    controllerName: `${entityName}Controller`,
    routes: [`GET ${routeBase}`, `POST ${routeBase}`],
    requestContractName,
    responseContractName,
    listContractName,
  };
  const sharedSpec = {
    contractPath: `packages/shared/src/contracts/${featureKey}.ts`,
    contractName: responseContractName,
    requestContractName,
    responseContractName,
    listContractName,
  };
  const databaseSpec = {
    schemaPath: 'prisma/schema.prisma',
    modelName: entityName,
    fields,
  };

  return {
    version: 5,
    taskUuid: task.uuid,
    taskTitle: task.title,
    projectUuid: task.project.uuid,
    changeType: 'feature',
    implementationMode: 'post_refinement',
    featureKey,
    entityName,
    entityPluralName: `${entityName}Items`,
    summary: actionSpec.summary,
    implementationObjective: {
      primaryGoal: `Entregar a feature ${actionSpec.navigationLabel || task.title} com consistencia entre frontend, backend e contratos compartilhados.`,
      userOutcome: actionSpec.summary,
      successDefinition: [
        `Fluxo principal ${actionSpec.submitLabel.toLowerCase()} disponivel em ${actionSpec.frontendRoute}.`,
        `Contrato ${requestContractName}/${responseContractName} publicado e consumido sem divergencia.`,
        `Modulo ${featureKey} integrado ao monorepo com documentacao incremental.`,
      ],
      nonGoals: [
        'Nao reestruturar modulos fora do escopo da story.',
        'Nao introduzir novos fluxos de negocio sem base no refinamento atual.',
      ],
    },
    businessRules,
    qaScenarios,
    domain: {
      primaryAction: actionSpec.submitLabel,
      submitLabel: actionSpec.submitLabel,
      successMessage: actionSpec.successMessage,
      fields,
    },
    frontend: frontendSpec,
    backend: backendSpec,
    shared: sharedSpec,
    database: databaseSpec,
    ux: {
      states: uiStates,
      validationSummary,
      permissions,
    },
    architecture: {
      screenTemplate,
      sourceSummary: architectureHighlights,
    },
    structured: buildStructuredSpec(
      task,
      actionSpec,
      fields,
      businessRules,
      qaScenarios,
      frontendSpec,
      backendSpec,
      sharedSpec,
      databaseSpec
    ),
    requirementsSource,
    qaSource,
    architectureSource,
  };
}

function normalizeTechnicalSpec(rawSpec, task) {
  if (
    rawSpec?.database?.schemaPath &&
    rawSpec?.frontend?.pageComponentName &&
    rawSpec?.backend?.routerName &&
    rawSpec?.backend?.routeBase
  ) {
    return rawSpec;
  }

  const sourceText = `${task.title}\n${rawSpec?.requirementsSource || ''}\n${rawSpec?.qaSource || ''}`;
  const actionSpec = inferActionSpec(task, sourceText);
  const featureKey = rawSpec?.featureKey || slugify(actionSpec.domainKey, task.uuid);
  const entityName = rawSpec?.entityName || actionSpec.entityName;
  const fields = rawSpec?.domain?.fields || rawSpec?.database?.fields || inferFieldDefinitions(sourceText, actionSpec);
  const businessRules = rawSpec?.businessRules || inferBusinessRules(sourceText, actionSpec);
  const qaScenarios = rawSpec?.qaScenarios || inferQaScenarios(sourceText, actionSpec);
  const uiStates = rawSpec?.ux?.states || inferUiStates(actionSpec, fields, qaScenarios);
  const validationSummary = rawSpec?.ux?.validationSummary || inferValidationSummary(fields);
  const permissions = rawSpec?.ux?.permissions || inferPermissions(sourceText);
  const screenTemplate =
    rawSpec?.architecture?.screenTemplate ||
    rawSpec?.structured?.classification?.screenTemplate ||
    inferScreenTemplate(actionSpec, fields, sourceText);
  const architectureHighlights = rawSpec?.architecture?.sourceSummary || extractArchitectureHighlights(rawSpec?.architectureSource || '');
  const requestContractName = rawSpec?.shared?.requestContractName || `${entityName}Request`;
  const responseContractName = rawSpec?.shared?.responseContractName || `${entityName}Response`;
  const listContractName = rawSpec?.shared?.listContractName || `${entityName}ListResponse`;
  const inferredProductMode =
    rawSpec?.frontend?.productMode ||
    rawSpec?.structured?.classification?.productMode ||
    getDomainTemplate({
      featureKey,
      frontend: rawSpec?.frontend,
      entityName,
      summary: rawSpec?.summary || actionSpec.summary,
    }).productMode ||
    'structured-workspace';
  const inferredUiIntent =
    rawSpec?.structured?.classification?.intent ||
    inferIntent(actionSpec, sourceText);
  const inferredLayoutVariant = normalizeLayoutVariant(
    rawSpec?.frontend?.layoutVariant || rawSpec?.structured?.classification?.layoutVariant,
    inferredProductMode,
    screenTemplate,
    inferredUiIntent
  );

  return {
    ...rawSpec,
    version: 4,
    featureKey,
    entityName,
    entityPluralName: rawSpec?.entityPluralName || `${entityName}Items`,
    summary: rawSpec?.summary || actionSpec.summary,
    businessRules,
    qaScenarios,
    domain: {
      primaryAction: rawSpec?.domain?.primaryAction || actionSpec.submitLabel,
      submitLabel: rawSpec?.domain?.submitLabel || actionSpec.submitLabel,
      successMessage: rawSpec?.domain?.successMessage || actionSpec.successMessage,
      fields,
    },
    frontend: {
      featurePath: rawSpec?.frontend?.featurePath || `apps/web/src/features/${featureKey}`,
      suggestedRoute: rawSpec?.frontend?.suggestedRoute || actionSpec.frontendRoute,
      pageComponentName: rawSpec?.frontend?.pageComponentName || actionSpec.pageComponentName,
      serviceName: rawSpec?.frontend?.serviceName || `${entityName}Api`,
      formComponentName: rawSpec?.frontend?.formComponentName || `${entityName}Form`,
      navigationLabel: rawSpec?.frontend?.navigationLabel || actionSpec.navigationLabel,
      pageTitle: rawSpec?.frontend?.pageTitle || actionSpec.pageTitle,
      pageDescription: rawSpec?.frontend?.pageDescription || actionSpec.pageDescription,
      productMode: inferredProductMode,
      layoutVariant: inferredLayoutVariant,
    },
    backend: {
      modulePath: rawSpec?.backend?.modulePath || `apps/api/src/modules/${featureKey}`,
      routeBase: rawSpec?.backend?.routeBase || actionSpec.routeBase,
      routerName: rawSpec?.backend?.routerName || `${entityName}Router`,
      serviceName: rawSpec?.backend?.serviceName || actionSpec.serviceName,
      serviceInstanceName: rawSpec?.backend?.serviceInstanceName || `${entityName}ServiceInstance`,
      controllerName: rawSpec?.backend?.controllerName || `${entityName}Controller`,
      routes: rawSpec?.backend?.routes || [`GET ${actionSpec.routeBase}`, `POST ${actionSpec.routeBase}`],
      requestContractName: rawSpec?.backend?.requestContractName || requestContractName,
      responseContractName: rawSpec?.backend?.responseContractName || responseContractName,
      listContractName: rawSpec?.backend?.listContractName || listContractName,
    },
    shared: {
      contractPath: rawSpec?.shared?.contractPath || `packages/shared/src/contracts/${featureKey}.ts`,
      contractName: rawSpec?.shared?.contractName || responseContractName,
      requestContractName,
      responseContractName,
      listContractName,
    },
    database: {
      schemaPath: rawSpec?.database?.schemaPath || 'prisma/schema.prisma',
      modelName: rawSpec?.database?.modelName || entityName,
      fields,
    },
    ux: {
      states: uiStates,
      validationSummary,
      permissions,
    },
    architecture: {
      screenTemplate,
      sourceSummary: architectureHighlights,
    },
    structured:
      rawSpec?.structured ||
      buildStructuredSpec(
        task,
        actionSpec,
        fields,
        businessRules,
        qaScenarios,
        {
          featurePath: rawSpec?.frontend?.featurePath || `apps/web/src/features/${featureKey}`,
          suggestedRoute: rawSpec?.frontend?.suggestedRoute || actionSpec.frontendRoute,
          pageComponentName: rawSpec?.frontend?.pageComponentName || actionSpec.pageComponentName,
          serviceName: rawSpec?.frontend?.serviceName || `${entityName}Api`,
          formComponentName: rawSpec?.frontend?.formComponentName || `${entityName}Form`,
          navigationLabel: rawSpec?.frontend?.navigationLabel || actionSpec.navigationLabel,
          pageTitle: rawSpec?.frontend?.pageTitle || actionSpec.pageTitle,
          pageDescription: rawSpec?.frontend?.pageDescription || actionSpec.pageDescription,
          productMode: inferredProductMode,
          layoutVariant: inferredLayoutVariant,
          formCardTitle: rawSpec?.frontend?.formCardTitle,
          formCardDescription: rawSpec?.frontend?.formCardDescription,
          recordsTitle: rawSpec?.frontend?.recordsTitle,
        },
        {
          modulePath: rawSpec?.backend?.modulePath || `apps/api/src/modules/${featureKey}`,
          routeBase: rawSpec?.backend?.routeBase || actionSpec.routeBase,
          routerName: rawSpec?.backend?.routerName || `${entityName}Router`,
          serviceName: rawSpec?.backend?.serviceName || actionSpec.serviceName,
          serviceInstanceName: rawSpec?.backend?.serviceInstanceName || `${entityName}ServiceInstance`,
          controllerName: rawSpec?.backend?.controllerName || `${entityName}Controller`,
          routes: rawSpec?.backend?.routes || [`GET ${actionSpec.routeBase}`, `POST ${actionSpec.routeBase}`],
        },
        {
          contractPath: rawSpec?.shared?.contractPath || `packages/shared/src/contracts/${featureKey}.ts`,
          contractName: rawSpec?.shared?.contractName || responseContractName,
          requestContractName,
          responseContractName,
          listContractName,
        },
        {
          schemaPath: rawSpec?.database?.schemaPath || 'prisma/schema.prisma',
          modelName: rawSpec?.database?.modelName || entityName,
          fields,
        }
      ),
  };
}

function buildImplementationPlan(task, generatedApp, technicalSpec, implementationManifest = null, coherenceReport = null) {
  const screenTemplate =
    implementationManifest?.classification?.screenTemplate ||
    technicalSpec.architecture?.screenTemplate ||
    technicalSpec.structured?.classification?.screenTemplate ||
    'crud';
  const reuseHints = buildProjectMemoryReuseHints(technicalSpec.projectMemory, technicalSpec, task.title);
  const sharedContractPath = implementationManifest?.contracts?.sharedContractPath || technicalSpec.shared.contractPath;
  const backendFiles = [
    `${implementationManifest?.backend?.modulePath || technicalSpec.backend.modulePath}/service.ts`,
    `${implementationManifest?.backend?.modulePath || technicalSpec.backend.modulePath}/router.ts`,
    `${implementationManifest?.backend?.modulePath || technicalSpec.backend.modulePath}/index.ts`,
    'apps/api/src/server.ts',
  ];
  const frontendFiles = [
    `${implementationManifest?.frontend?.featurePath || technicalSpec.frontend.featurePath}/page.tsx`,
    `${implementationManifest?.frontend?.featurePath || technicalSpec.frontend.featurePath}/service.ts`,
    `${implementationManifest?.frontend?.featurePath || technicalSpec.frontend.featurePath}/index.ts`,
    'apps/web/src/App.tsx',
  ];
  const persistenceFiles = [technicalSpec.database.schemaPath];
  const documentationFiles = [`docs/implementations/${implementationManifest?.classification?.featureKey || technicalSpec.featureKey}.md`];
  const executionMode = implementationManifest?.execution?.mode || 'deterministic';
  const autonomousContract = implementationManifest?.autonomousAgent || null;

  return {
    version: 4,
    taskUuid: task.uuid,
    generatedAppUuid: generatedApp.uuid,
    generatedAppRoot: generatedApp.rootPath,
    executionModel: executionMode === 'autonomous' ? 'autonomous_goal_driven_incremental' : 'goal_driven_incremental',
    objective: implementationManifest?.objective || technicalSpec.implementationObjective,
    implementationManifest,
    coherenceReport,
    reuseGuidance: reuseHints,
    autonomousAgent: autonomousContract,
    steps: [
      'Ler o contexto atual do monorepo gerado',
      executionMode === 'autonomous'
        ? 'Permitir que o agente autonomo defina a melhor composicao dentro dos contratos da feature'
        : 'Seguir o caminho deterministico atual de materializacao por workstreams',
      `Aplicar o template de tela ${screenTemplate}`,
      'Usar os highlights da arquitetura para respeitar stack, modulos e contratos ja definidos',
      'Reaproveitar padroes de dominio e referencias bem avaliadas do proprio projeto',
      'Criar contrato compartilhado da feature',
      'Criar módulo funcional no backend',
      'Registrar rota real no servidor da API',
      'Criar página e serviço reais no frontend',
      'Registrar a página na navegação do app',
      'Atualizar prisma/schema.prisma do app gerado',
      'Registrar documentação da implementação incremental',
    ],
    workstreams: [
      {
        id: 'shared_contracts',
        label: 'Contratos compartilhados',
        goal: 'Definir a interface publica da feature antes da integracao completa.',
        lane: 'shared',
        ownerAgent: 'developer',
        dependsOn: [],
        targetFiles: [sharedContractPath],
        deliverables: ['Request/Response contract', 'tipagem reutilizavel entre frontend e backend'],
      },
      {
        id: 'backend_module',
        label: 'Backend e rotas',
        goal: 'Materializar servico, router e registro do modulo da feature.',
        lane: 'backend',
        ownerAgent: 'developer_backend',
        dependsOn: ['shared_contracts'],
        targetFiles: backendFiles,
        deliverables: ['modulo funcional', 'rotas registradas', 'alinhamento com contrato compartilhado'],
      },
      {
        id: 'frontend_feature',
        label: 'Frontend e experiencia',
        goal: `Publicar a experiencia ${screenTemplate} com fluxo principal acessivel pelo app.`,
        lane: 'frontend',
        ownerAgent: 'developer_frontend',
        dependsOn: ['shared_contracts'],
        targetFiles: frontendFiles,
        deliverables: ['pagina', 'servico de consumo', 'registro na navegacao'],
      },
      {
        id: 'persistence_and_docs',
        label: 'Persistencia e documentacao',
        goal: 'Atualizar schema e registrar a trilha tecnica da feature.',
        lane: 'shared',
        ownerAgent: 'developer',
        dependsOn: ['backend_module', 'frontend_feature'],
        targetFiles: [...persistenceFiles, ...documentationFiles],
        deliverables: ['schema atualizado', 'documentacao incremental'],
      },
    ],
    executionLanes: [
      {
        id: 'shared',
        label: 'Shared',
        summary: 'Contratos, persistencia e consolidacao final da feature.',
      },
      {
        id: 'backend',
        label: 'Backend',
        summary: 'Servico, regras de negocio, rotas e impacto na API.',
      },
      {
        id: 'frontend',
        label: 'Frontend',
        summary: 'Tela, fluxo visual, consumo de API e experiencia do usuario.',
      },
    ],
    executionPhases: [
      {
        id: 'impact_and_contract',
        label: 'Impacto e contrato',
        goal: 'Confirmar superficie de mudanca e fechar o contrato compartilhado.',
        workstreams: ['shared_contracts'],
      },
      {
        id: 'parallel_delivery',
        label: 'Entrega paralela',
        goal: 'Executar backend e frontend em paralelo apos fechar o contrato compartilhado.',
        workstreams: ['backend_module', 'frontend_feature'],
      },
      {
        id: 'integration_and_validation',
        label: 'Integracao e validacao',
        goal: 'Conectar persistencia, documentacao e validar a entrega completa.',
        workstreams: ['persistence_and_docs'],
      },
    ],
    targetFiles: [
      sharedContractPath,
      ...backendFiles,
      ...frontendFiles,
      'apps/web/package.json',
      ...persistenceFiles,
      ...documentationFiles,
    ],
    architectureGuidance: technicalSpec.architecture?.sourceSummary || null,
    qualityTargets: {
      minimumReviewScore: 85,
      requiredStatuses: ['review=approved', 'lint=completed', 'test=completed', 'build=completed'],
      screenTemplate,
    },
  };
}

async function createCurrentArtifact(taskId, title, content, createdByAgentName, options = {}) {
  const existing = await prisma.taskArtifact.findMany({
    where: {
      taskId,
      title,
      isCurrent: true,
      artifactScope: options.artifactScope || 'implementation',
    },
    select: { id: true },
  });

  if (existing.length) {
    await prisma.taskArtifact.updateMany({
      where: { id: { in: existing.map((item) => item.id) } },
      data: { isCurrent: false },
    });
  }

  const latest = await prisma.taskArtifact.findFirst({
    where: {
      taskId,
      title,
      artifactScope: options.artifactScope || 'implementation',
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return prisma.taskArtifact.create({
    data: {
      uuid: randomUUID(),
      taskId,
      taskImplementationId: options.taskImplementationId || null,
      artifactType: 'custom',
      artifactScope: options.artifactScope || 'implementation',
      title,
      content,
      contentFormat: 'json',
      version: (latest?.version || 0) + 1,
      isCurrent: true,
      createdByAgentName,
    },
  });
}

function backendModuleFiles(task, technicalSpec) {
  const { entityName, featureKey } = technicalSpec;
  const domainTemplate = getDomainTemplate(technicalSpec);
  const moduleSpec = technicalSpec.generationIR?.backend?.moduleSpec || {};
  const operationMap = moduleSpec.operationMap || {};
  const hasDecisionAction = operationMap.review === 'decisionAction';
  const hasEvidenceIngest = operationMap.attach === 'evidenceIngest';
  const hasTimelineRead = operationMap.audit === 'timelineRead';
  const isQueueList = operationMap.list === 'paginatedQueue';
  const sharedImportPath = toImportPath(
    `${technicalSpec.backend.modulePath}/service.ts`,
    technicalSpec.shared.contractPath
  );
  const toPrismaModelId = (spec) => {
    const name = String(spec.entityName || spec.backend?.serviceName || spec.shared?.requestContractName || 'entity');
    const clean = name.replace(/Service$|Router$|Request$|Response$/, '');
    return clean.charAt(0).toLowerCase() + clean.slice(1);
  };
const renderAutonomousTemplate = (template) =>
    String(template || '')
      .replaceAll('__SHARED_IMPORT_PATH__', escapeTemplate(sharedImportPath))
      .replaceAll('__REQUEST_CONTRACT_NAME__', escapeTemplate(technicalSpec.shared.requestContractName))
      .replaceAll('__RESPONSE_CONTRACT_NAME__', escapeTemplate(technicalSpec.shared.responseContractName))
      .replaceAll('__LIST_CONTRACT_NAME__', escapeTemplate(technicalSpec.shared.listContractName))
      .replaceAll('__ENTITY_NAME__', escapeTemplate(entityName))
      .replaceAll('__ROUTE_BASE__', escapeTemplate(technicalSpec.backend.routeBase))
      .replaceAll('__SUBMIT_LABEL__', escapeTemplate(technicalSpec.domain.submitLabel))
      .replaceAll('__SUCCESS_MESSAGE__', escapeTemplate(technicalSpec.domain.successMessage))
      .replaceAll('__BACKEND_ROUTER_NAME__', escapeTemplate(technicalSpec.backend.routerName))
      .replaceAll('__BACKEND_SERVICE_NAME__', escapeTemplate(technicalSpec.backend.serviceName))
      .replaceAll('__BACKEND_SERVICE_INSTANCE_NAME__', escapeTemplate(technicalSpec.backend.serviceInstanceName))
      .replaceAll('__PRISMA_MODEL_ID__', escapeTemplate(toPrismaModelId(technicalSpec)));
  const responseShape = technicalSpec.domain.fields
    .map((field) => {
      if (field.name === 'password') return `  passwordHint?: string;`;
      return `  ${field.name}${field.required ? '' : '?'}: ${field.tsType};`;
    })
    .join('\n');
  const requestShape = technicalSpec.domain.fields
    .map((field) => `  ${field.name}${field.required ? '' : '?'}: ${field.tsType};`)
    .join('\n');
  const routerRequestAssignments = technicalSpec.domain.fields
    .map((field) => buildRouterFieldAssignment(field))
    .join('\n');
  const seedRequestExamples = buildSeedRequestExamples(technicalSpec, domainTemplate);
  const seedRequestLiteral = JSON.stringify(seedRequestExamples, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, '\'');
  const responseFieldAssignments = technicalSpec.domain.fields
    .map((field) => {
      if (field.name === 'password') return `      passwordHint: 'Senha protegida',`;
      if (field.name === 'email') return `      email: input.email.trim().toLowerCase(),`;
      if (!field.required) {
        return `      ...(input.${field.name} ? { ${field.name}: input.${field.name} } : {}),`;
      }
      return `      ${field.name}: input.${field.name},`;
    })
    .join('\n');
  const modelAssignments = technicalSpec.domain.fields.map((field) => `      ${buildFieldInitializer(field)},`).join('\n');
  const fieldValidationRules = technicalSpec.domain.fields.flatMap((field) => buildServiceFieldValidation(field));
  const domainSpecificValidationRules = buildDomainSpecificValidation(
    { domainKey: technicalSpec.featureKey || technicalSpec.domainKey || '' },
    technicalSpec.domain.fields
  );
  const uniqueEmailRule = technicalSpec.domain.fields.some((field) => field.name === 'email')
    ? [
        `  const normalizedEmail = String(input.email || '').trim().toLowerCase();`,
        `  const duplicated = existingRecords.find((record) => record.email === normalizedEmail);`,
        `  if (duplicated) throw new Error('E-mail ja cadastrado.');`,
      ]
    : '';
  const passwordValidationRule = technicalSpec.domain.fields.some((field) => field.name === 'password')
    ? [
        `  const password = input.password || '';`,
        `  const hasStrongPassword = password.length >= 8 && /[A-Z]/.test(password) && /\\d/.test(password);`,
        `  if (!hasStrongPassword) throw new Error('Senha invalida.');`,
      ]
    : [];
  const validateInputRules = [
    ...fieldValidationRules,
    ...passwordValidationRule,
    ...(Array.isArray(uniqueEmailRule) ? uniqueEmailRule : []),
    ...domainSpecificValidationRules,
  ]
    .filter(Boolean)
    .join('\n');
  const businessRulesComment = technicalSpec.businessRules.length
    ? technicalSpec.businessRules.map((rule) => ` * - ${rule}`).join('\n')
    : ' * - Regras de negocio basicas aplicadas no fluxo incremental.';
  const validateInputFunction = validateInputRules
    ? `function validateInput(input: ${technicalSpec.shared.requestContractName}, existingRecords: ${technicalSpec.shared.responseContractName}[]): void {\n${validateInputRules}\n}\n\n`
    : '';
  const prismaModelIdVar = toPrismaModelId(technicalSpec);
  const listImplementation = isQueueList
    ? `  async list() {\n    const items = await prisma['${prismaModelIdVar}'].findMany({ orderBy: { createdAt: 'desc' } });\n    const sorted = items.sort((left, right) => {\n      const leftPriority = String(left.priority || left.status || '').toLowerCase();\n      const rightPriority = String(right.priority || right.status || '').toLowerCase();\n      return leftPriority.localeCompare(rightPriority);\n    });\n    return {\n      items: sorted,\n      meta: { mode: 'queue', total: sorted.length, sort: '${escapeTemplate(operationMap.prioritize || 'prioritySort')}' },\n    };\n  }\n\n`
    : `  async list() {\n    const items = await prisma['${prismaModelIdVar}'].findMany({ orderBy: { createdAt: 'desc' } });\n    return { items };\n  }\n\n`;
  const reviewMethod = hasDecisionAction
    ? `  async review(id: string, decision: 'approved' | 'rejected', reviewerNote = '') {\n    return prisma['${prismaModelIdVar}'].update({\n      where: { id: Number(id) || id as any },\n      data: { status: decision === 'approved' ? 'active' : 'draft', reviewDecision: decision, reviewNote: reviewerNote || undefined, updatedAt: new Date().toISOString() },\n    });\n  }\n\n`
    : '';
  const attachMethod = hasEvidenceIngest
    ? `  async attach(id: string, attachmentName: string) {\n    return prisma['${prismaModelIdVar}'].update({\n      where: { id: Number(id) || id as any },\n      data: { latestAttachment: attachmentName || 'Arquivo enviado', updatedAt: new Date().toISOString() },\n    });\n  }\n\n`
    : '';
  const activityMethod = hasTimelineRead
    ? `  async activity() {\n    const items = await prisma['${prismaModelIdVar}'].findMany({ take: 10, orderBy: { createdAt: 'desc' } });\n    return { items: items.map((record: any) => ({ id: record.id, status: record.status, summary: String(record.title || record.name || record.subject || record.id), createdAt: record.updatedAt || record.createdAt })) };\n  }\n\n`
    : '';
  const createStatusValue = hasDecisionAction ? `'draft'` : `'active'`;
  const createUpdatedAtField = hasTimelineRead || hasEvidenceIngest ? `\n      updatedAt: new Date().toISOString(),` : '';
  const routerActivityBody = hasTimelineRead
    ? `\n${technicalSpec.backend.routerName}.get('/activity', async (_req, res) => {\n  try {\n    const data = await ${technicalSpec.backend.serviceInstanceName}.activity();\n    res.json(data);\n  } catch (error) {\n    res.status(500).json({ message: 'Falha ao buscar atividade recente.' });\n  }\n});\n`
    : '';
  const routerDecisionBody = hasDecisionAction
    ? `\n${technicalSpec.backend.routerName}.post('/:id/review', async (req, res) => {\n  try {\n    const decision = String(req.body?.decision || 'approved') === 'rejected' ? 'rejected' : 'approved';\n    const reviewed = await ${technicalSpec.backend.serviceInstanceName}.review(req.params.id, decision, String(req.body?.reviewerNote || ''));\n    res.json(reviewed);\n  } catch (error) {\n    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao revisar registro.' });\n  }\n});\n`
    : '';
  const routerAttachmentBody = hasEvidenceIngest
    ? `\n${technicalSpec.backend.routerName}.post('/:id/attachments', async (req, res) => {\n  try {\n    const attached = await ${technicalSpec.backend.serviceInstanceName}.attach(req.params.id, String(req.body?.attachmentName || 'Arquivo enviado'));\n    res.status(201).json(attached);\n  } catch (error) {\n    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao anexar evidencia.' });\n  }\n});\n`
    : '';
  const readmeOperationSummary = Object.entries(operationMap)
    .map(([name, mode]) => `- \`${name}\`: ${mode}`)
    .join('\n');
  const autonomousBackendServiceTemplate = technicalSpec.backend?.autonomousServiceTsTemplate || '';
  const autonomousBackendRouterTemplate = technicalSpec.backend?.autonomousRouterTsTemplate || '';
  const autonomousBackendIndexTemplate = technicalSpec.backend?.autonomousIndexTsTemplate || '';
  const hasHealthyAutonomousBackendServiceTemplate =
    autonomousBackendServiceTemplate &&
    autonomousBackendServiceTemplate.includes("from '@prisma/client'") &&
    autonomousBackendServiceTemplate.includes('const prisma = new PrismaClient()') &&
    !autonomousBackendServiceTemplate.includes('const records:');

  return [
    {
      relativePath: technicalSpec.shared.contractPath,
      content: `export interface ${technicalSpec.shared.requestContractName} {\n${requestShape}\n}\n\nexport interface ${technicalSpec.shared.responseContractName} {\n  id: number | string;\n${responseShape}\n  status: 'draft' | 'active';\n  createdAt: string;\n}\n\nexport interface ${technicalSpec.shared.listContractName} {\n  items: ${technicalSpec.shared.responseContractName}[];\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/service.ts`,
      content: hasHealthyAutonomousBackendServiceTemplate
        ? renderAutonomousTemplate(autonomousBackendServiceTemplate)
        : `import { PrismaClient } from '@prisma/client';\nimport type { ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nconst prisma = new PrismaClient();\n\n${validateInputFunction}/**\n${businessRulesComment}\n */\nexport class ${technicalSpec.backend.serviceName} {\n${listImplementation}  async create(input: ${technicalSpec.shared.requestContractName}): Promise<${technicalSpec.shared.responseContractName}> {\n    const existingRecords = await prisma['${prismaModelIdVar}'].findMany({ orderBy: { createdAt: 'desc' } });\n${validateInputFunction ? `    validateInput(input, existingRecords as unknown as ${technicalSpec.shared.responseContractName}[]);\n` : ''}    const item = await prisma['${prismaModelIdVar}'].create({\n      data: {\n${responseFieldAssignments}\n        status: ${createStatusValue},${createUpdatedAtField}\n      }\n    });\n    return item as unknown as ${technicalSpec.shared.responseContractName};\n  }\n\n${reviewMethod}${attachMethod}${activityMethod}}\n\nexport const ${technicalSpec.backend.serviceInstanceName} = new ${technicalSpec.backend.serviceName}();\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/router.ts`,
      content: autonomousBackendRouterTemplate
        ? renderAutonomousTemplate(autonomousBackendRouterTemplate)
        : `import { Router } from 'express';\nimport type { ${technicalSpec.shared.requestContractName} } from '${sharedImportPath}';\nimport { ${technicalSpec.backend.serviceInstanceName} } from './service';\n\nexport const ${technicalSpec.backend.routerName} = Router();\n\n${technicalSpec.backend.routerName}.get('/', async (_req, res) => {\n  try {\n    const data = await ${technicalSpec.backend.serviceInstanceName}.list();\n    res.json(data);\n  } catch (error) {\n    res.status(500).json({ message: 'Falha ao buscar registros.' });\n  }\n});\n${routerActivityBody}\n${technicalSpec.backend.routerName}.post('/', async (req, res) => {\n  try {\n    const payload = req.body || {};\n    const input: ${technicalSpec.shared.requestContractName} = {\n${routerRequestAssignments}\n    };\n    const created = await ${technicalSpec.backend.serviceInstanceName}.create(input);\n    res.status(201).json(created);\n  } catch (error) {\n    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });\n  }\n});\n${routerDecisionBody}${routerAttachmentBody}`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/index.ts`,
      content: autonomousBackendIndexTemplate
        ? renderAutonomousTemplate(autonomousBackendIndexTemplate)
        : `export { ${technicalSpec.backend.routerName} } from './router';\nexport { ${technicalSpec.backend.serviceInstanceName} } from './service';\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/README.md`,
      content: `# ${task.title}\n\nM�dulo backend incremental criado a partir da task refinada.\n`,
      fileType: 'md',
    },
  ];
}

function frontendFeatureFiles(task, technicalSpec) {
  const { entityName } = technicalSpec;
  const domainTemplate = getDomainTemplate(technicalSpec);
  const sharedImportPath = toImportPath(
    `${technicalSpec.frontend.featurePath}/page.tsx`,
    technicalSpec.shared.contractPath
  );
  const uiImportPath = toImportPath(
    `${technicalSpec.frontend.featurePath}/page.tsx`,
    'packages/ui/src/index.tsx'
  );
  const initialStateEntries = technicalSpec.domain.fields
    .map((field) => `  ${field.name}: '${escapeTemplate(field.defaultValue || '')}',`)
    .join('\n');
  const inputBlocks = technicalSpec.domain.fields
    .map((field) => {
      const common = `              value={form.${field.name}}\n              onChange={(event) => setForm((current) => ({ ...current, ${field.name}: event.target.value }))}`;
      let control = '';

      if (field.inputType === 'textarea') {
        control = `            <textarea\n${common}\n              placeholder="${escapeTemplate(field.placeholder)}"\n              style={inputStyle({ minHeight: 132, resize: 'vertical' })}\n            />`;
      } else if (field.inputType === 'select' && Array.isArray(field.selectOptions) && field.selectOptions.length) {
        const options = field.selectOptions
          .map((option) => `              <option value="${escapeTemplate(option)}">${escapeTemplate(humanizeSelectOptionLabel(option))}</option>`)
          .join('\n');
        control = `            <select\n${common}\n              style={inputStyle()}\n            >\n${options}\n            </select>`;
      } else {
        control = `            <input\n              type="${field.inputType}"\n${common}\n              placeholder="${escapeTemplate(field.placeholder)}"\n              style={inputStyle()}\n            />`;
      }

      return `          <FieldGroup label="${escapeTemplate(field.label)}" hint="${escapeTemplate(field.helperText)}">\n${control}\n          </FieldGroup>`;
    })
    .join('\n');
  const payloadObject = technicalSpec.domain.fields.map((field) => `      ${field.name}: form.${field.name},`).join('\n');
  const previewField = technicalSpec.domain.fields.find((field) => field.name === 'email') || technicalSpec.domain.fields[0];
  const secondaryField =
    technicalSpec.domain.fields.find((field) => field.name !== previewField.name && field.name !== 'password') ||
    previewField;
  const highlights = (technicalSpec.frontend.highlights || []).slice(0, 3);
  const layout = technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'split';
  const productMode = technicalSpec.frontend?.productMode || technicalSpec.structured?.classification?.productMode || 'structured-workspace';
  const uiIntent = technicalSpec.structured?.classification?.intent || 'custom';
  const layoutVariant = normalizeLayoutVariant(technicalSpec.frontend?.layoutVariant, productMode, layout, uiIntent);
  const productDirection = getProductModeDesignProfile(productMode, layout);
  const accent = productDirection.accent || 'teal';
  const isCrudLayout = layout === 'crud';
  const isDashboardLayout = layout === 'dashboard';
  const isWorkspaceLayout = layout === 'workspace';
  const isWizardLayout = layout === 'wizard';
  const isSettingsLayout = layout === 'settings';
  const shellContract = getFrontendShellContract({ screenTemplate: layout, productMode, uiIntent });
  const shellComponentName = shellContract.componentName;
  const shouldRenderCollectionPanel = isCrudLayout || isDashboardLayout || isWorkspaceLayout;
  const uiImports = shellContract.imports;
  const screenSpec =
    technicalSpec.frontend?.screenSpec ||
    technicalSpec.generationIR?.frontend?.screenSpec ||
    {};
  const pageArchetype = screenSpec.pageArchetype || shellContract.defaultPageArchetype;
  const fallbackPattern = screenSpec.fallbackPattern || shellContract.defaultFallbackPattern;
  const patternHints = JSON.stringify(
    Array.isArray(screenSpec.patternHints) && screenSpec.patternHints.length
      ? screenSpec.patternHints
      : [uiIntent === 'review' ? 'decision-focused' : 'workflow-guided']
  );
  const sections = JSON.stringify(
    Array.isArray(screenSpec.sections) && screenSpec.sections.length
      ? screenSpec.sections
      : shellContract.defaultSections
  );
  const componentMap = JSON.stringify(screenSpec.componentMap || {});
  const collectionHelpers = shouldRenderCollectionPanel
    ? `function humanizeStatus(value?: string) {\n  const normalized = String(value || '').trim().toLowerCase();\n  const directMap: Record<string, string> = {\n    active: 'Ativo',\n    enabled: 'Ativado',\n    disabled: 'Desativado',\n    draft: 'Em preparacao',\n    pending: 'Pendente',\n  };\n\n  return directMap[normalized] || (value ? String(value) : 'Ativo');\n}\n\nfunction formatCreatedAt(value?: string) {\n  if (!value) return 'Agora';\n  const parsed = new Date(value);\n  if (Number.isNaN(parsed.getTime())) return 'Agora';\n  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });\n}\n\n`
    : '';
  const settingsSummaryItems = JSON.stringify(
    (domainTemplate.settingsSummaryItems || highlights || ['Estado atual claro para o usuario.']).slice(0, 3)
  );
  const summaryStateTitle = escapeTemplate(domainTemplate.summaryStateTitle || 'Resumo principal');
  const summaryStateEmpty = escapeTemplate(
    domainTemplate.summaryStateEmpty ||
      technicalSpec.frontend.recordsEmptyState ||
      'Nenhum dado configurado ainda.'
  );
  const metricsExpression = isSettingsLayout || isWizardLayout
    ? 'undefined'
    : isDashboardLayout
      ? `[
          { label: '${escapeTemplate(productDirection.metricLabels?.[0] || 'Indicadores')}', value: ${productDirection.metricValues?.[0] || "isLoading ? 'Sincronizando' : String(items.length || 0)"} },
          { label: '${escapeTemplate(productDirection.metricLabels?.[1] || 'Leitura')}', value: ${productDirection.metricValues?.[1] || "isLoading ? 'Atualizando' : 'Consolidada'"} },
          { label: '${escapeTemplate(productDirection.metricLabels?.[2] || 'Atualizacao')}', value: ${productDirection.metricValues?.[2] || "'Agora'"} },
        ]`
      : isWorkspaceLayout
        ? `[
            { label: '${escapeTemplate(productDirection.metricLabels?.[0] || 'Fila ativa')}', value: ${productDirection.metricValues?.[0] || "isLoading ? '...' : String(items.length)"} },
            { label: '${escapeTemplate(productDirection.metricLabels?.[1] || 'Status operacional')}', value: ${productDirection.metricValues?.[1] || "isLoading ? 'Sincronizando' : 'Em acompanhamento'"} },
            { label: '${escapeTemplate(productDirection.metricLabels?.[2] || 'Visibilidade')}', value: ${productDirection.metricValues?.[2] || "'Tempo real'"} },
          ]`
        : `[
            { label: '${escapeTemplate(productDirection.metricLabels?.[0] || 'Area')}', value: ${productDirection.metricValues?.[0] || `'${escapeTemplate(technicalSpec.frontend.navigationLabel || technicalSpec.entityName)}'`} },
            { label: '${escapeTemplate(productDirection.metricLabels?.[1] || 'Situacao')}', value: ${productDirection.metricValues?.[1] || "isLoading ? 'Sincronizando' : 'Pronta'"} },
            { label: '${escapeTemplate(productDirection.metricLabels?.[2] || 'Registros')}', value: ${productDirection.metricValues?.[2] || "isLoading ? '...' : String(items.length)"} },
          ]`;
  const supportMetaExpression = shouldRenderCollectionPanel
    ? (productDirection.collectionMeta || (isDashboardLayout
      ? "isLoading ? 'Atualizando' : `${items.length} insight(s)`"
      : isWorkspaceLayout
        ? "isLoading ? 'Atualizando fila' : `${items.length} item(ns) na fila`"
        : "`${items.length} registro(s)`"))
    : isWizardLayout
      ? "isLoading ? 'Preparando' : 'Proximo passo'"
      : `isLoading ? 'Atualizando' : items.length ? '${escapeTemplate(domainTemplate.summaryMetaReady || 'Ativo')}' : '${escapeTemplate(domainTemplate.summaryMetaIdle || 'Pronto para ajustar')}'`;
  const secondaryPanelTitle = shouldRenderCollectionPanel
    ? escapeTemplate(
        technicalSpec.frontend.recordsTitle ||
          (isWorkspaceLayout ? 'Fila operacional' : isDashboardLayout ? 'Leitura consolidada' : 'Registros ativos')
      )
    : escapeTemplate(technicalSpec.frontend.profileSummaryTitle || (isWizardLayout ? 'Proximo passo' : 'Visao atual'));
  const secondaryPanelDescription = shouldRenderCollectionPanel
    ? escapeTemplate(
        technicalSpec.frontend.recordsEmptyState ||
          (isWorkspaceLayout
            ? productDirection.emptyStateTone || 'Acompanhe os itens que exigem acao da operacao.'
            : isDashboardLayout
              ? productDirection.emptyStateTone || 'Visualize os recortes mais importantes desta area.'
              : productDirection.emptyStateTone || 'Acompanhe os registros criados nesta area.')
      )
    : escapeTemplate(
        technicalSpec.frontend.profileSummaryDescription ||
          technicalSpec.frontend.recordsEmptyState ||
          (isWizardLayout
            ? 'Avance com seguranca mantendo clareza sobre a proxima etapa.'
            : 'Entenda rapidamente como esta configuracao apoia a rotina do usuario.')
      );
  const secondaryLeadTitle = escapeTemplate(
    technicalSpec.frontend.profileSummaryLeadTitle ||
      (uiIntent === 'configure'
        ? 'Resumo da configuracao'
        : uiIntent === 'attach'
          ? 'Orientacao do envio'
          : uiIntent === 'review'
            ? 'Pontos de atencao'
            : uiIntent === 'monitor'
              ? 'Leitura principal'
              : isWizardLayout
                ? 'Contexto atual'
                : 'Resumo da experiencia')
  );
  const secondaryPanelBlock = shouldRenderCollectionPanel
    ? `      listTitle="${secondaryPanelTitle}"
      listDescription="${secondaryPanelDescription}"
      listMeta={${supportMetaExpression}}
    >
      {isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1].map((placeholder) => (
            <div
              key={placeholder}
              style={{
                padding: '18px 16px',
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                minHeight: 74,
              }}
            />
          ))}
        </div>
      ) : items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9deea',
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.${previewField.name === 'password' ? 'passwordHint' : previewField.name} || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.${secondaryField.name === 'password' ? 'passwordHint' : secondaryField.name} || '${escapeTemplate(
                  isWorkspaceLayout
                    ? 'Contexto pronto para consulta'
                    : isDashboardLayout
                      ? 'Status em foco para decisao'
                      : 'Configuracao registrada'
                )}')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'grid', placeItems: 'center', fontSize: 24 }}>O</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>${escapeTemplate(technicalSpec.frontend.recordsEmptyState || technicalSpec.ux?.states?.empty || 'Nenhum registro disponivel ainda.')}</p>
        </div>
      )}`
    : `      listTitle="${secondaryPanelTitle}"
      listDescription="${secondaryPanelDescription}"
      listMeta={${supportMetaExpression}}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: '16px 18px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>${secondaryLeadTitle}</strong>
          <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>${escapeTemplate(technicalSpec.frontend.heroDescription || technicalSpec.summary)}</p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {${JSON.stringify(highlights.length ? highlights : ['Fluxo preparado para uma operacao mais clara e confiavel.'])}.map((item) => (
            <div key={item} style={{ padding: '12px 14px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', color: '#475569', lineHeight: 1.6 }}>
              {item}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: '#eef5ef', border: '1px solid #d9e7de', color: '#21493d' }}>
          {isLoading ? '${escapeTemplate(isWizardLayout ? 'Preparando a proxima etapa...' : 'Carregando informacoes...')}' : items.length ? '${escapeTemplate(
            isWizardLayout ? 'Etapa pronta para continuar.' : 'Configuracao salva com sucesso.'
          )}' : '${escapeTemplate(technicalSpec.frontend.recordsEmptyState || (isWizardLayout ? 'Nenhum passo confirmado ainda.' : 'Nenhuma configuracao registrada ainda.'))}' }
        </div>
      </div>`;
  const settingsSummaryBlock = `      summaryTitle="${secondaryPanelTitle}"
      summaryDescription="${secondaryPanelDescription}"
      summaryMeta={${supportMetaExpression}}
      summaryHighlights={${settingsSummaryItems}}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>${summaryStateTitle}</strong>
          <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.7 }}>
            {isLoading
              ? 'Carregando o resumo da configuracao...'
              : items.length
                ? 'Configuracao salva e pronta para consulta.'
                : '${summaryStateEmpty}'}
          </p>
        </div>
      </div>`;

  return [
    {
      relativePath: `${technicalSpec.frontend.featurePath}/service.ts`,
      content: `import type { ${technicalSpec.shared.listContractName}, ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nexport async function fetch${entityName}Items(): Promise<${technicalSpec.shared.responseContractName}[]> {\n  const response = await fetch('${technicalSpec.backend.routeBase}');\n  const data: ${technicalSpec.shared.listContractName} = await response.json();\n  return data.items || [];\n}\n\nexport async function create${entityName}(input: ${technicalSpec.shared.requestContractName}): Promise<${technicalSpec.shared.responseContractName}> {\n  const response = await fetch('${technicalSpec.backend.routeBase}', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(input),\n  });\n\n  if (!response.ok) {\n    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));\n    throw new Error(error.message || 'Falha ao criar registro.');\n  }\n\n  return response.json();\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      content: `import { useEffect, useState } from 'react';\nimport type { FormEvent } from 'react';\nimport type { ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\nimport { ${uiImports} } from '${uiImportPath}';\nimport { create${entityName}, fetch${entityName}Items } from './service';\n\nconst initialForm: ${technicalSpec.shared.requestContractName} = {\n${initialStateEntries}\n};\n\n${collectionHelpers}export function ${technicalSpec.frontend.pageComponentName}() {\n  const [items, setItems] = useState<${technicalSpec.shared.responseContractName}[]>([]);\n  const [form, setForm] = useState<${technicalSpec.shared.requestContractName}>(initialForm);\n  const [feedback, setFeedback] = useState('');\n  const [errorMessage, setErrorMessage] = useState('');\n  const [isLoading, setIsLoading] = useState(true);\n  const [isSubmitting, setIsSubmitting] = useState(false);\n\n  useEffect(() => {\n    fetch${entityName}Items()\n      .then(setItems)\n      .catch(() => setItems([]))\n      .finally(() => setIsLoading(false));\n  }, []);\n\n  async function handleSubmit(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    setFeedback('');\n    setErrorMessage('');\n    setIsSubmitting(true);\n\n    try {\n      const created = await create${entityName}({\n${payloadObject}\n      });\n      setItems((current) => [created, ...current]);\n      setForm(initialForm);\n      setFeedback('${escapeTemplate(technicalSpec.domain.successMessage)}');\n    } catch (error) {\n      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');\n    } finally {\n      setIsSubmitting(false);\n    }\n  }\n\n  return (\n    <${shellComponentName}\n      accent="${accent}"\n      productMode="${productMode}"\n      uiIntent="${uiIntent}"\n      layoutVariant="${layoutVariant}"\n      pageArchetype="${pageArchetype}"\n      fallbackPattern="${fallbackPattern}"\n      patternHints={${patternHints}}\n      sections={${sections}}\n      componentMap={${componentMap}}\n      eyebrow="${escapeTemplate(technicalSpec.frontend.heroEyebrow || technicalSpec.frontend.navigationLabel || technicalSpec.entityName)}"\n      title="${escapeTemplate(technicalSpec.frontend.heroTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"\n      description="${escapeTemplate(technicalSpec.frontend.heroDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"\n      ${isSettingsLayout ? '' : `metrics={${metricsExpression}}\n      `}highlights={${JSON.stringify(highlights.length ? highlights : ['Experiencia preparada para uma operacao mais clara e confiavel.'])}}\n      formTitle="${escapeTemplate(technicalSpec.frontend.formCardTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"\n      formDescription="${escapeTemplate(technicalSpec.frontend.formCardDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"\n      form={\n        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>\n${inputBlocks}\n          <PrimaryButton type="submit" accent="${accent}">\n            {isSubmitting ? 'Processando...' : '${escapeTemplate(technicalSpec.domain.submitLabel)}'}\n          </PrimaryButton>\n\n          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}\n          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}\n        </form>\n      }\n${isSettingsLayout ? settingsSummaryBlock : secondaryPanelBlock}\n    </${shellComponentName}>\n  );\n}\n`,
        fileType: 'tsx',
      },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/index.ts`,
      content: `export { ${technicalSpec.frontend.pageComponentName} } from './page';\nexport { fetch${entityName}Items } from './service';\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/README.md`,
      content: `# ${task.title}\n\nFeature frontend incremental criada a partir da task refinada.\n`,
      fileType: 'md',
    },
  ];
}
function buildBackendModuleFilesFromTemplate(task, technicalSpec) {
  const domainTemplate = getDomainTemplate(technicalSpec);
  const files = backendModuleFiles(task, technicalSpec);

  return files.map((file) => {
    if (file.relativePath.endsWith('/service.ts')) {
      let content = file.content;

      if (technicalSpec.domain.fields.some((field) => field.name === 'fullName')) {
        content = content.replace(
          'return { items: records };',
          "return { items: records };"
        ).replace(
          "throw new Error('Senha invalida.');\n    }\n",
          "throw new Error('Senha invalida.');\n    }\n"
        );

        if (!content.includes("throw new Error('Nome obrigatorio.');")) {
          content = content.replace(
            'const item:',
            "const normalizedFullName = String(input.fullName || '').trim();\n    if (normalizedFullName.length < 3) {\n      throw new Error('Nome obrigatorio.');\n    }\n\n    const item:"
          );
        }
      }

      if (technicalSpec.domain.fields.some((field) => field.name === 'profilePhotoUrl') && !content.includes('Foto do perfil precisa ser uma URL valida.')) {
        content = content.replace(
          'const item:',
          "if (input.profilePhotoUrl && !/^https?:\\/\\//.test(input.profilePhotoUrl)) {\n      throw new Error('Foto do perfil precisa ser uma URL valida.');\n    }\n\n    const item:"
        );
      }

      return { ...file, content };
    }

    if (file.relativePath.endsWith('/README.md')) {
      return {
        ...file,
        content: `${file.content.trim()}\n\nTemplate aplicado: ${domainTemplate.templateKey}\n`,
      };
    }

    return file;
  });
}

function buildFrontendFeatureFilesFromTemplate(task, technicalSpec) {
  const domainTemplate = getDomainTemplate(technicalSpec);
  const files = buildModernFrontendFeatureFiles(task, technicalSpec, {
    sharedImportPath: toImportPath(
      `${technicalSpec.frontend.featurePath}/page.tsx`,
      technicalSpec.shared.contractPath
    ),
    uiImportPath: toImportPath(
      `${technicalSpec.frontend.featurePath}/page.tsx`,
      'packages/ui/src/index.tsx'
    ),
    domainTemplate,
  });

  return files.map((file) => {
    if (file.relativePath.endsWith('/page.tsx')) {
      let content = file.content;

      content = content
        .replace(
          escapeTemplate(technicalSpec.frontend.pageTitle || technicalSpec.entityName),
          escapeTemplate(technicalSpec.frontend.heroTitle || domainTemplate.heroTitle)
        )
        .replace(
          escapeTemplate(technicalSpec.frontend.pageDescription || technicalSpec.summary),
          escapeTemplate(technicalSpec.frontend.heroDescription || domainTemplate.heroDescription)
        )
        .replace(
          escapeTemplate(technicalSpec.frontend.heroEyebrow || 'Fluxo principal'),
          escapeTemplate(technicalSpec.frontend.heroEyebrow || domainTemplate.heroEyebrow)
        )
        .replace(
          escapeTemplate(technicalSpec.frontend.recordsTitle || 'Ultimos registros'),
          escapeTemplate(technicalSpec.frontend.recordsTitle || domainTemplate.recordsTitle)
        )
        .replace(
          escapeTemplate(technicalSpec.frontend.recordsEmptyState || 'Nenhum registro processado ainda.'),
          escapeTemplate(technicalSpec.frontend.recordsEmptyState || domainTemplate.recordsEmptyState)
        );

      return { ...file, content };
    }

    if (file.relativePath.endsWith('/README.md')) {
      return {
        ...file,
        content: `${file.content.trim()}\n\nTemplate aplicado: ${domainTemplate.templateKey}\n`,
      };
    }

    return file;
  });
}

async function getIntegratedTechnicalSpecs(generatedAppId, fallbackSpec) {
  const implementations = await prisma.taskImplementation.findMany({
    where: {
      generatedAppId,
      technicalSpecArtifactId: { not: null },
      OR: [
        { status: { in: ['planned', 'in_progress', 'integrated'] } },
        { buildStatus: 'completed' },
        { testStatus: 'completed' },
      ],
    },
    include: {
      task: {
        select: { uuid: true, title: true },
      },
      technicalSpecArtifact: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const seenTasks = new Set();
  const specs = implementations
    .filter((implementation) => {
      if (seenTasks.has(implementation.task.uuid)) return false;
      seenTasks.add(implementation.task.uuid);
      return true;
    })
    .reverse()
    .map((implementation) =>
      normalizeTechnicalSpec(JSON.parse(implementation.technicalSpecArtifact.content), implementation.task)
    )
    .filter(Boolean);

  const dedupedSpecs = [];
  const indexByFeature = new Map();

  for (const spec of specs) {
    const dedupeKey = `${spec.featureKey}:${spec.backend?.routeBase || ''}`;
    if (indexByFeature.has(dedupeKey)) {
      dedupedSpecs[indexByFeature.get(dedupeKey)] = spec;
      continue;
    }

    indexByFeature.set(dedupeKey, dedupedSpecs.length);
    dedupedSpecs.push(spec);
  }

  if (fallbackSpec) {
    const fallbackKey = `${fallbackSpec.featureKey}:${fallbackSpec.backend?.routeBase || ''}`;
    if (indexByFeature.has(fallbackKey)) {
      dedupedSpecs[indexByFeature.get(fallbackKey)] = fallbackSpec;
    } else {
      dedupedSpecs.push(fallbackSpec);
    }
  }

  return dedupedSpecs;
}

async function getLatestTaskImplementation(taskId) {
  return prisma.taskImplementation.findFirst({
    where: { taskId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      technicalSpecArtifact: true,
      implementationPlanArtifact: true,
      generatedFiles: true,
      generatedApp: true,
    },
  });
}

function shouldReuseImplementationRecord(implementation) {
  if (!implementation) return false;
  return implementation.status === 'planned' || implementation.status === 'in_progress';
}

async function cleanupImplementationFiles(generatedAppRoot, implementation) {
  const filePaths = [...new Set((implementation?.generatedFiles || []).map((file) => file.filePath))];

  for (const filePath of filePaths) {
    const absoluteFilePath = path.join(generatedAppRoot, filePath);
    await removeFileIfExists(absoluteFilePath);
    await removeEmptyParentDirectories(absoluteFilePath, generatedAppRoot);
  }

  if (implementation?.id) {
    await prisma.generatedFile.deleteMany({
      where: { taskImplementationId: implementation.id },
    });
  }
}

async function updateApiServer(generatedAppRoot, routeSpecs, appSlug = 'generated-app') {
  const backendRoutes = Array.isArray(routeSpecs?.backend?.routes)
    ? routeSpecs.backend.routes
    : Array.from(new Map((routeSpecs || []).map((spec) => [`${spec.featureKey}:${spec.backend.routeBase}`, spec])).values()).map(
        (spec) => ({
          featureKey: spec.featureKey,
          routeBase: spec.backend.routeBase,
          routerName: spec.backend.routerName,
        })
      );
  const serverPath = path.join(generatedAppRoot, 'apps/api/src/server.ts');
  const importLines = backendRoutes
    .map((spec) => `import { ${spec.routerName} } from './modules/${spec.featureKey}/index'`)
    .join('\n');
  const useLines = backendRoutes
    .map((spec) => `app.use('${spec.routeBase}', ${spec.routerName})`)
    .join('\n');

  const content = `import express from 'express'\nimport cors from 'cors'\nimport pino from 'pino'\n${importLines ? `${importLines}\n` : ''}\nconst app = express()\nconst logger = pino({ name: '${appSlug}-api' })\nconst port = Number(process.env.PORT || 3001)\nconst allowedOrigins = (process.env.FRONTEND_ORIGIN || '')\n  .split(',')\n  .map((item) => item.trim())\n  .filter(Boolean)\n\napp.use(\n  cors({\n    origin(origin, callback) {\n      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {\n        return callback(null, true)\n      }\n\n      return callback(new Error(\`Origin not allowed: \${origin}\`))\n    },\n    credentials: true,\n  })\n)\napp.use(express.json({ limit: '1mb' }))\n\napp.get('/health', (_req, res) => {\n  res.json({ status: 'ok', app: '${appSlug}' })\n})\n\n${useLines}\n\napp.listen(port, () => {\n  logger.info({ port }, 'API running')\n})\n`;

  await writeText(serverPath, content);

  return {
    relativePath: 'apps/api/src/server.ts',
    content,
    fileType: 'ts',
  };
}

async function writeCompositionManifest(generatedAppRoot, compositionManifest) {
  const relativePath = 'docs/system/app-composition.manifest.json';
  const content = `${JSON.stringify(compositionManifest, null, 2)}\n`;
  await writeText(path.join(generatedAppRoot, relativePath), content);
  return {
    relativePath,
    content,
    fileType: 'json',
  };
}

async function updateApiPackageJson(generatedAppRoot) {
  const rootPackagePath = path.join(generatedAppRoot, 'package.json');
  const packagePath = path.join(generatedAppRoot, 'apps/api/package.json');
  const rootPackageRaw = await readText(rootPackagePath, '{}');
  const rootPackage = JSON.parse(rootPackageRaw || '{}');
  const rootName = slugify(rootPackage.name || path.basename(generatedAppRoot), 'generated-app');
  const raw = await readText(packagePath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.name = parsed.name || `@${rootName}/api`;
  parsed.private = parsed.private ?? true;
  parsed.version = parsed.version || '1.0.0';
  parsed.type = parsed.type || 'module';
  parsed.scripts = {
    dev: 'tsx watch src/server.ts',
    build: 'tsc -p tsconfig.json',
    test: 'vitest run',
    ...(parsed.scripts || {}),
  };
  parsed.dependencies = parsed.dependencies || {};
  parsed.dependencies.cors = parsed.dependencies.cors || '^2.8.5';
  parsed.dependencies.express = parsed.dependencies.express || '^4.18.2';
  parsed.dependencies.pino = parsed.dependencies.pino || '^9.5.0';
  parsed.dependencies.zod = parsed.dependencies.zod || '^3.24.1';
  parsed.dependencies['@prisma/client'] = parsed.dependencies['@prisma/client'] || '^6.0.1';
  parsed.devDependencies = parsed.devDependencies || {};
  parsed.devDependencies.prisma = parsed.devDependencies.prisma || '^6.0.1';
  parsed.devDependencies['@types/cors'] = parsed.devDependencies['@types/cors'] || '^2.8.17';
  parsed.devDependencies['@types/express'] = parsed.devDependencies['@types/express'] || '^5.0.1';
  parsed.devDependencies['@types/node'] = parsed.devDependencies['@types/node'] || '^22.10.2';
  parsed.devDependencies.supertest = parsed.devDependencies.supertest || '^7.0.0';
  parsed.devDependencies.tsx = parsed.devDependencies.tsx || '^4.19.0';
  parsed.devDependencies.typescript = parsed.devDependencies.typescript || '^5.6.0';
  parsed.devDependencies.vitest = parsed.devDependencies.vitest || '^2.1.8';

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(packagePath, content);

  return {
    relativePath: 'apps/api/package.json',
    content,
    fileType: 'json',
  };
}

async function updateApiTsconfig(generatedAppRoot) {
  const tsconfigPath = path.join(generatedAppRoot, 'apps/api/tsconfig.json');
  const raw = await readText(tsconfigPath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.extends = parsed.extends || '../../tsconfig.base.json';
  parsed.compilerOptions = {
    outDir: 'dist',
    types: ['node'],
    ...(parsed.compilerOptions || {}),
  };
  parsed.include = Array.isArray(parsed.include) && parsed.include.length ? parsed.include : ['src'];

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(tsconfigPath, content);

  return {
    relativePath: 'apps/api/tsconfig.json',
    content,
    fileType: 'json',
  };
}

async function updateWebPackageJson(generatedAppRoot) {
  const rootPackagePath = path.join(generatedAppRoot, 'package.json');
  const packagePath = path.join(generatedAppRoot, 'apps/web/package.json');
  const rootPackageRaw = await readText(rootPackagePath, '{}');
  const rootPackage = JSON.parse(rootPackageRaw || '{}');
  const rootName = slugify(rootPackage.name || path.basename(generatedAppRoot), 'generated-app');
  const raw = await readText(packagePath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.name = parsed.name || `@${rootName}/web`;
  parsed.private = parsed.private ?? true;
  parsed.version = parsed.version || '1.0.0';
  parsed.type = parsed.type || 'module';
  parsed.scripts = {
    dev: 'vite',
    build: 'vite build',
    test: 'vitest run',
    ...(parsed.scripts || {}),
  };
  parsed.dependencies = parsed.dependencies || {};
  parsed.dependencies['@hookform/resolvers'] = parsed.dependencies['@hookform/resolvers'] || '^3.10.0';
  parsed.dependencies['@tanstack/react-query'] = parsed.dependencies['@tanstack/react-query'] || '^5.64.1';
  parsed.dependencies.react = parsed.dependencies.react || '^18.2.0';
  parsed.dependencies['react-dom'] = parsed.dependencies['react-dom'] || '^18.2.0';
  parsed.dependencies['react-hook-form'] = parsed.dependencies['react-hook-form'] || '^7.54.2';
  if (!parsed.dependencies['react-router-dom']) {
    parsed.dependencies['react-router-dom'] = '^6.28.0';
  }
  parsed.dependencies.zod = parsed.dependencies.zod || '^3.24.1';
  parsed.devDependencies = parsed.devDependencies || {};
  parsed.devDependencies['@types/react'] = parsed.devDependencies['@types/react'] || '^18.3.12';
  parsed.devDependencies['@types/react-dom'] = parsed.devDependencies['@types/react-dom'] || '^18.3.1';
  parsed.devDependencies['@vitejs/plugin-react'] = parsed.devDependencies['@vitejs/plugin-react'] || '^4.2.0';
  parsed.devDependencies.typescript = parsed.devDependencies.typescript || '^5.6.0';
  parsed.devDependencies.vite = parsed.devDependencies.vite || '^5.4.0';
  parsed.devDependencies.vitest = parsed.devDependencies.vitest || '^2.1.8';

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(packagePath, content);

  return {
    relativePath: 'apps/web/package.json',
    content,
    fileType: 'json',
  };
}

async function updateWebIndexHtml(generatedAppRoot, projectName) {
  const indexPath = path.join(generatedAppRoot, 'apps/web/index.html');
  const safeProjectName = String(projectName || path.basename(generatedAppRoot) || 'Generated App');
  const content = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeProjectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  await writeText(indexPath, content);

  return {
    relativePath: 'apps/web/index.html',
    content,
    fileType: 'html',
  };
}

async function updateWebMainEntry(generatedAppRoot) {
  const mainPath = path.join(generatedAppRoot, 'apps/web/src/main.tsx');
  const content = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
`;
  await writeText(mainPath, content);

  return {
    relativePath: 'apps/web/src/main.tsx',
    content,
    fileType: 'tsx',
  };
}

async function updateWebViteConfig(generatedAppRoot) {
  const viteConfigPath = path.join(generatedAppRoot, 'apps/web/vite.config.ts');
  const content = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
        },
      },
    },
  },
});
`;
  await writeText(viteConfigPath, content);

  return {
    relativePath: 'apps/web/vite.config.ts',
    content,
    fileType: 'ts',
  };
}

async function updateWebTsconfig(generatedAppRoot) {
  const tsconfigPath = path.join(generatedAppRoot, 'apps/web/tsconfig.json');
  const raw = await readText(tsconfigPath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.extends = parsed.extends || '../../tsconfig.base.json';
  parsed.compilerOptions = {
    jsx: 'react-jsx',
    ...(parsed.compilerOptions || {}),
  };
  parsed.include = Array.isArray(parsed.include) && parsed.include.length ? parsed.include : ['src'];

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(tsconfigPath, content);

  return {
    relativePath: 'apps/web/tsconfig.json',
    content,
    fileType: 'json',
  };
}

async function updateRootPackageJson(generatedAppRoot) {
  const packagePath = path.join(generatedAppRoot, 'package.json');
  const raw = await readText(packagePath, '{}');
  const parsed = JSON.parse(raw || '{}');
  const rootName = slugify(parsed.name || path.basename(generatedAppRoot), 'generated-app');

  parsed.name = parsed.name || rootName;
  parsed.private = parsed.private ?? true;
  parsed.version = parsed.version || '1.0.0';
  parsed.workspaces = Array.isArray(parsed.workspaces) && parsed.workspaces.length ? parsed.workspaces : ['apps/*', 'packages/*'];
  parsed.scripts = {
    ...(parsed.scripts || {}),
    'dev:web': 'npm --workspace apps/web run dev',
    'dev:api': 'npm --workspace apps/api run dev',
    'build:web': 'npm --workspace apps/web run build',
    'build:api': 'npm --workspace apps/api run build',
    'db:generate': 'npx prisma generate',
    lint: 'node scripts/lint.mjs',
    test: 'node scripts/test.mjs',
  };

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(packagePath, content);

  return {
    relativePath: 'package.json',
    content,
    fileType: 'json',
  };
}

async function updateRootTsconfigBase(generatedAppRoot) {
  const tsconfigPath = path.join(generatedAppRoot, 'tsconfig.base.json');
  const raw = await readText(tsconfigPath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.compilerOptions = {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    strict: true,
    skipLibCheck: true,
    ...(parsed.compilerOptions || {}),
  };

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(tsconfigPath, content);

  return {
    relativePath: 'tsconfig.base.json',
    content,
    fileType: 'json',
  };
}

async function updateSharedPackageJson(generatedAppRoot) {
  const rootPackagePath = path.join(generatedAppRoot, 'package.json');
  const packagePath = path.join(generatedAppRoot, 'packages/shared/package.json');
  const rootPackageRaw = await readText(rootPackagePath, '{}');
  const rootPackage = JSON.parse(rootPackageRaw || '{}');
  const rootName = slugify(rootPackage.name || path.basename(generatedAppRoot), 'generated-app');
  const raw = await readText(packagePath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.name = parsed.name || `@${rootName}/shared`;
  parsed.private = parsed.private ?? true;
  parsed.version = parsed.version || '1.0.0';
  parsed.type = parsed.type || 'module';

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(packagePath, content);

  return {
    relativePath: 'packages/shared/package.json',
    content,
    fileType: 'json',
  };
}

async function updateConfigPackageJson(generatedAppRoot) {
  const rootPackagePath = path.join(generatedAppRoot, 'package.json');
  const packagePath = path.join(generatedAppRoot, 'packages/config/package.json');
  const rootPackageRaw = await readText(rootPackagePath, '{}');
  const rootPackage = JSON.parse(rootPackageRaw || '{}');
  const rootName = slugify(rootPackage.name || path.basename(generatedAppRoot), 'generated-app');
  const raw = await readText(packagePath, '{}');
  const parsed = JSON.parse(raw || '{}');

  parsed.name = parsed.name || `@${rootName}/config`;
  parsed.private = parsed.private ?? true;
  parsed.version = parsed.version || '1.0.0';
  parsed.type = parsed.type || 'module';

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  await writeText(packagePath, content);

  return {
    relativePath: 'packages/config/package.json',
    content,
    fileType: 'json',
  };
}

async function updateSharedIndexEntry(generatedAppRoot) {
  const contractsRoot = path.join(generatedAppRoot, 'packages/shared/src/contracts');
  const indexPath = path.join(generatedAppRoot, 'packages/shared/src/index.ts');
  let contractEntries = [];

  try {
    contractEntries = await readdir(contractsRoot, { withFileTypes: true });
  } catch {
    contractEntries = [];
  }

  const exportLines = contractEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name.replace(/\.ts$/i, ''))
    .sort((left, right) => left.localeCompare(right))
    .map((contractName) => `export * from './contracts/${contractName}'`);

  const content = `${exportLines.join('\n') || 'export {}'}\n`;
  await writeText(indexPath, content);

  return {
    relativePath: 'packages/shared/src/index.ts',
    content,
    fileType: 'ts',
  };
}

async function ensureWorkspaceFoundationFiles(generatedAppRoot, projectName) {
  return [
    await updateRootPackageJson(generatedAppRoot),
    await updateRootTsconfigBase(generatedAppRoot),
    await updateApiPackageJson(generatedAppRoot),
    await updateApiTsconfig(generatedAppRoot),
    await updateWebPackageJson(generatedAppRoot),
    await updateWebIndexHtml(generatedAppRoot, projectName),
    await updateWebMainEntry(generatedAppRoot),
    await updateWebViteConfig(generatedAppRoot),
    await updateWebTsconfig(generatedAppRoot),
    await updateSharedPackageJson(generatedAppRoot),
    await updateConfigPackageJson(generatedAppRoot),
    await updateSharedIndexEntry(generatedAppRoot),
  ];
}

function buildSyntheticTaskFromSpec(technicalSpec) {
  return {
    title: technicalSpec.taskTitle || technicalSpec.frontend?.pageTitle || technicalSpec.entityName || 'Feature gerada',
    uuid: technicalSpec.taskUuid || technicalSpec.featureKey || randomUUID(),
  };
}

async function ensureValidationScripts(generatedAppRoot) {
  const lintContent = `import { readFile, readdir } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function listFeaturePages() {\n  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');\n  try {\n    const entries = await readdir(featuresRoot, { withFileTypes: true });\n    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(featuresRoot, entry.name, 'page.tsx'));\n  } catch {\n    return [];\n  }\n}\n\nfunction collectDuplicateLines(content, predicate) {\n  const lines = String(content || '')\n    .split(/\\r?\\n/)\n    .map((line) => line.trim())\n    .filter(Boolean)\n    .filter((line) => (predicate ? predicate(line) : true));\n\n  const counts = new Map();\n  for (const line of lines) {\n    counts.set(line, (counts.get(line) || 0) + 1);\n  }\n\n  return Array.from(counts.entries()).filter(([, count]) => count > 1);\n}\n\nasync function readSafe(filePath) {\n  try {\n    return await readFile(filePath, 'utf8');\n  } catch {\n    return '';\n  }\n}\n\nconst failures = [];\nconst genericFallbackPattern = /Campo principal da feature gerada|Informe o valor principal/;\nconst genericUxCopyPattern = /Nenhum dado exibido ainda\\.|Validacao automatica dos campos antes do envio\\.|Feedback imediato em caso de sucesso ou erro\\.|Conclua esta etapa|Carregando dados da feature|Atividade recente/;\nconst basicWebShellPattern = /Frontend base gerado pela AI Software Factory|Bem-vindo ao .*?\\.<\\/p>|fontFamily: 'sans-serif', padding: 24/;\n\nconst appContent = await readSafe(path.join(root, 'apps', 'web', 'src', 'App.tsx'));\nconst serverContent = await readSafe(path.join(root, 'apps', 'api', 'src', 'server.ts'));\nconst hasPremiumShellSignals =\n  appContent.includes('AppFrame') &&\n  appContent.includes('AppHeader') &&\n  appContent.includes('SidebarNav') &&\n  appContent.includes('SurfaceCard') &&\n  appContent.includes('const routes = [');\n\nfor (const [line, count] of collectDuplicateLines(appContent, (line) => line.startsWith('import ') || line.includes(\"path: '\"))) {\n  failures.push(\`App.tsx possui linha duplicada \${count}x: \${line}\`);\n}\n\nfor (const [line, count] of collectDuplicateLines(serverContent, (line) => line.startsWith('import ') || line.startsWith('app.use('))) {\n  failures.push(\`server.ts possui linha duplicada \${count}x: \${line}\`);\n}\n\nif (basicWebShellPattern.test(appContent) || !hasPremiumShellSignals) {\n  failures.push('App.tsx ainda usa um shell basico e precisa de navegacao estruturada entre as features.');\n}\n\nfor (const pagePath of await listFeaturePages()) {\n  const pageContent = await readSafe(pagePath);\n  if (genericFallbackPattern.test(pageContent)) {\n    failures.push(\`\${path.relative(root, pagePath)} ainda contem textos genericos de fallback.\`);\n  }\n  if (genericUxCopyPattern.test(pageContent)) {\n    failures.push(\`\${path.relative(root, pagePath)} ainda contem copy generica ou placeholders de UX.\`);\n  }\n}\n\nif (failures.length) {\n  console.error('Lint do projeto gerado falhou.\\n');\n  for (const failure of failures) {\n    console.error(\`- \${failure}\`);\n  }\n  process.exit(1);\n}\n\nconsole.log('Lint do projeto gerado concluido sem problemas.');\n`;
  const testContent = `import { access, readFile, readdir } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function assertFile(relativePath) {\n  try {\n    await access(path.join(root, relativePath));\n  } catch {\n    throw new Error(\`Arquivo obrigatorio ausente: \${relativePath}\`);\n  }\n}\n\nasync function readSafe(relativePath) {\n  return readFile(path.join(root, relativePath), 'utf8');\n}\n\nasync function listFeatureDirs() {\n  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');\n  try {\n    const entries = await readdir(featuresRoot, { withFileTypes: true });\n    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);\n  } catch {\n    return [];\n  }\n}\n\nasync function listDirectories(relativePath) {\n  try {\n    const entries = await readdir(path.join(root, relativePath), { withFileTypes: true });\n    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);\n  } catch {\n    return [];\n  }\n}\n\nconst requiredFiles = [\n  'apps/api/src/server.ts',\n  'apps/web/src/App.tsx',\n  'prisma/schema.prisma',\n];\n\nfor (const file of requiredFiles) {\n  await assertFile(file);\n}\n\nconst serverContent = await readSafe('apps/api/src/server.ts');\nconst appContent = await readSafe('apps/web/src/App.tsx');\nconst schemaContent = await readSafe('prisma/schema.prisma');\nconst featureDirs = await listFeatureDirs();\nconst apiModuleDirs = await listDirectories('apps/api/src/modules');\nconst contractFiles = await readdir(path.join(root, 'packages', 'shared', 'src', 'contracts')).catch(() => []);\n\nif (!serverContent.includes(\"app.get('/health'\")) {\n  throw new Error('API sem rota /health registrada.');\n}\n\nfor (const featureDir of featureDirs) {\n  const pagePath = \`apps/web/src/features/\${featureDir}/page.tsx\`;\n  const servicePath = \`apps/web/src/features/\${featureDir}/service.ts\`;\n  const apiRouterPath = \`apps/api/src/modules/\${featureDir}/router.ts\`;\n  const apiServicePath = \`apps/api/src/modules/\${featureDir}/service.ts\`;\n  const contractPath = \`packages/shared/src/contracts/\${featureDir}.ts\`;\n  await assertFile(pagePath);\n  await assertFile(servicePath);\n  await assertFile(apiRouterPath);\n  await assertFile(apiServicePath);\n  await assertFile(contractPath);\n\n  const pageContent = await readSafe(pagePath);\n  const routerContent = await readSafe(apiRouterPath);\n  const backendServiceContent = await readSafe(apiServicePath);\n  const contractContent = await readSafe(contractPath);\n  const importsSharedUi =\n    pageContent.includes('packages/ui/src/index.tsx') ||\n    pageContent.includes('/packages/ui/src/index.tsx');\n  if (!importsSharedUi) {\n    throw new Error(\`Feature \${featureDir} nao esta usando o design system compartilhado.\`);\n  }\n  if (!routerContent.includes(\".get('/',\") || !routerContent.includes(\".post('/',\")) {\n    throw new Error(\`Modulo \${featureDir} sem rotas GET/POST basicas.\`);\n  }\n  if (!backendServiceContent.includes(\"from '@prisma/client'\") || !backendServiceContent.includes('const prisma = new PrismaClient()')) {\n    throw new Error(\`Modulo \${featureDir} nao esta usando Prisma Client no service.\`);\n  }\n  if (/const\\s+records\\s*=\\s*\\[\\]/.test(backendServiceContent)) {\n    throw new Error(\`Modulo \${featureDir} ainda contem armazenamento em memoria e precisa persistir com Prisma.\`);\n  }\n  if (!/Request\\s*\\{/.test(contractContent) || !/Response\\s*\\{/.test(contractContent) || !/ListResponse\\s*\\{/.test(contractContent)) {\n    throw new Error(\`Contrato \${featureDir} sem Request/Response/ListResponse completos.\`);\n  }\n  const expectedModelName = contractContent.match(/export interface ([A-Za-z0-9]+)Request/)?.[1]?.replace(/Request$/, '');\n  if (expectedModelName && !schemaContent.includes(\`model \${expectedModelName} {\`)) {\n    throw new Error(\`Schema Prisma sem model esperado para \${featureDir}: \${expectedModelName}.\`);\n  }\n}\n\nconst frontendRoutes = [...appContent.matchAll(/path:\\s*'([^']+)'/g)].map((match) => match[1]);\nconst apiRoutes = [...serverContent.matchAll(/app\\.use\\('([^']+)'/g)].map((match) => match[1]);\n\nif (featureDirs.length && frontendRoutes.length < featureDirs.length) {\n  throw new Error('O frontend nao registrou todas as rotas das features geradas.');\n}\n\nif (featureDirs.length && apiRoutes.length < featureDirs.length) {\n  throw new Error('A API nao registrou todas as rotas das features geradas.');\n}\n\nif (featureDirs.length !== apiModuleDirs.length) {\n  throw new Error('Quantidade de features web difere da quantidade de modulos da API.');\n}\n\nif (featureDirs.length !== contractFiles.filter((file) => String(file).endsWith('.ts')).length) {\n  throw new Error('Quantidade de contratos compartilhados difere das features geradas.');\n}\n\nif (!schemaContent.includes('model ')) {\n  throw new Error('Schema Prisma sem nenhum model.');\n}\n\nif (!/createdAt\\s+DateTime/.test(schemaContent) || !/updatedAt\\s+DateTime/.test(schemaContent)) {\n  throw new Error('Schema Prisma sem trilha minima de datas nas models geradas.');\n}\n\nconsole.log('Smoke tests do projeto gerado concluidos com sucesso.');\n`;

  return [
    {
      relativePath: 'scripts/lint.mjs',
      content: lintContent,
      fileType: 'mjs',
    },
    {
      relativePath: 'scripts/test.mjs',
      content: testContent,
      fileType: 'mjs',
    },
  ];
}

async function updateWebApp(generatedAppRoot, routeSpecs, projectName, options = {}) {
  const projectTemplate =
    options.projectTemplate ||
    resolveProjectTemplate(null, {
      projectName,
      label: projectName,
    });
  const frontendRoutes = Array.isArray(routeSpecs?.frontend?.routes)
    ? routeSpecs.frontend.routes
    : sortRouteSpecsByProjectTemplate(
        Array.from(new Map((routeSpecs || []).map((spec) => [`${spec.featureKey}:${spec.frontend.suggestedRoute}`, spec])).values()),
        projectTemplate
      ).map((spec) => ({
        featureKey: spec.featureKey,
        path: spec.frontend.suggestedRoute,
        label: spec.frontend.navigationLabel || spec.entityName,
        pageComponentName: spec.frontend.pageComponentName,
      }));
  const appPath = path.join(generatedAppRoot, 'apps/web/src/App.tsx');
  const importLines = frontendRoutes
    .map(
      (spec) =>
        `const ${spec.pageComponentName} = lazy(() => import('./features/${spec.featureKey}/index').then((module) => ({ default: module.${spec.pageComponentName} })))`
    )
    .join('\n');
  const shellImport = `import { AppFrame, AppHeader, SidebarNav, SurfaceCard } from '../../../packages/ui/src/index.tsx'`;
  const routeLines = frontendRoutes
    .map(
      (spec) =>
        `  { path: '${spec.path}', label: '${escapeTemplate(spec.label)}', render: () => <${spec.pageComponentName} /> },`
    )
    .join('\n');
  const content = `import { Suspense, lazy } from 'react'\n${shellImport}\n${importLines ? `\n${importLines}\n` : '\n'}const routes = [\n${routeLines}\n]\n\nfunction RouteLoadingFallback() {\n  return (\n    <SurfaceCard\n      title="Preparando modulo"\n      description="Carregando a experiencia dessa area com navegacao progressiva para manter o shell mais leve."\n      meta="Lazy loading ativo"\n    >\n      <div style={{ display: 'grid', gap: 10 }}>\n        <div style={{ height: 12, borderRadius: 999, background: '#dbe4ee' }} />\n        <div style={{ height: 12, width: '72%', borderRadius: 999, background: '#e7edf5' }} />\n      </div>\n    </SurfaceCard>\n  )\n}\n\nexport default function App() {\n  const currentPath = window.location.pathname\n  const defaultRoute = routes[0]\n  const activeRoute = routes.find((route) => route.path === currentPath) || defaultRoute\n\n  if (currentPath === '/' && defaultRoute && window.location.pathname !== defaultRoute.path) {\n    window.history.replaceState({}, '', defaultRoute.path)\n  }\n\n  return (\n    <AppFrame>\n      <AppHeader title={activeRoute?.label || '${escapeTemplate(projectName)}'} routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute?.path || ''} />\n      <div style={{ display: 'grid', gridTemplateColumns: '234px minmax(0, 1fr)' }}>\n        <SidebarNav routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute?.path || ''} />\n        <div style={{ padding: 18 }}>\n          <Suspense fallback={<RouteLoadingFallback />}>\n            {activeRoute ? activeRoute.render() : null}\n          </Suspense>\n        </div>\n      </div>\n    </AppFrame>\n  )\n}\n`;

  await writeText(appPath, content);

  return {
    relativePath: 'apps/web/src/App.tsx',
    content,
    fileType: 'tsx',
  };
}

function ensurePrismaSchemaFoundation(content) {
  let normalized = String(content || '').trim();

  if (!/generator\s+client\s*\{/.test(normalized)) {
    normalized = `generator client {\n  provider = "prisma-client-js"\n}\n\n${normalized}`.trim();
  }

  if (!/datasource\s+db\s*\{/.test(normalized)) {
    normalized = `${normalized}\n\ndatasource db {\n  provider = "mysql"\n  url      = env("DATABASE_URL")\n}`.trim();
  }

  return `${normalized}\n`;
}

function buildPrismaFieldLineFromContractField(fieldName, tsType, isOptional = false, provider = 'mysql') {
  const normalizedName = String(fieldName || '').trim();
  const normalizedType = String(tsType || '').trim().toLowerCase();
  const compactName = stripAccents(normalizedName).toLowerCase();
  const optionalSuffix = isOptional ? '?' : '';

  if (!normalizedName || ['id', 'status', 'createdAt', 'updatedAt'].includes(normalizedName)) {
    return null;
  }

  if (normalizedType.includes('boolean')) {
    return `  ${normalizedName}${optionalSuffix} Boolean @default(false)`;
  }

  if (normalizedType.includes('number')) {
    if (/price|valor|preco|amount|total|sla|tempo/.test(compactName)) {
      return provider === 'sqlite'
        ? `  ${normalizedName}${optionalSuffix} Decimal`
        : `  ${normalizedName}${optionalSuffix} Decimal @db.Decimal(10,2)`;
    }
    return `  ${normalizedName}${optionalSuffix} Int`;
  }

  if (normalizedType.includes('date')) {
    return provider === 'sqlite'
      ? `  ${normalizedName}${optionalSuffix} DateTime`
      : `  ${normalizedName}${optionalSuffix} DateTime @db.DateTime(0)`;
  }

  if (normalizedType.includes('string')) {
    if (compactName === 'email') {
      return provider === 'sqlite'
        ? `  ${normalizedName} String${optionalSuffix} @unique`
        : `  ${normalizedName} String${optionalSuffix} @unique @db.VarChar(190)`;
    }
    if (compactName.includes('url') || compactName.includes('link')) {
      return `  ${normalizedName} String${optionalSuffix}`;
    }
    if (compactName.includes('description') || compactName.includes('details') || compactName.includes('summary')) {
      return `  ${normalizedName} String${optionalSuffix}`;
    }
    return `  ${normalizedName} String${optionalSuffix}`;
  }

  return `  ${normalizedName} String${optionalSuffix}`;
}

/**
 * Extrai informações de esquema de um código TypeScript usando o compilador nativo (AST).
 * Isso substitui extrações baseadas em RegEx que são frágeis.
 */
function extractSchemaFromTsAst(sourceCode) {
  const sourceFile = ts.createSourceFile('contract.ts', sourceCode || '', ts.ScriptTarget.Latest, true);
  const interfaces = [];

  function visit(node) {
    if (ts.isInterfaceDeclaration(node)) {
      const properties = [];
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.name) {
          properties.push({
            name: member.name.getText(sourceFile).trim(),
            type: member.type ? member.type.getText(sourceFile).trim() : 'any',
            isOptional: !!member.questionToken,
          });
        }
      });

      interfaces.push({
        name: node.name.text,
        properties,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return interfaces;
}

function buildPrismaModelFromContract(contractName, contractContent, provider = 'mysql') {
  const interfaces = extractSchemaFromTsAst(contractContent);
  const modelMeta = buildPrismaModelMeta(provider);
  
  // Procuramos pela interface de Request que define o contrato principal da entidade
  const requestInterface = interfaces.find((item) => item.name.endsWith('Request')) || interfaces[0];
  
  if (!requestInterface) {
    const fallbackName = pascalCase(contractName, 'GeneratedContractModel');
    return `model ${fallbackName} {\n${modelMeta.idLine}\n${modelMeta.statusLine}\n${modelMeta.createdAtLine}\n${modelMeta.updatedAtLine}\n}`;
  }

  // Remove o sufixo 'Request' para o nome do modelo no Prisma
  const modelName = requestInterface.name.replace(/Request$/, '');
  const fields = requestInterface.properties
    .map((prop) => buildPrismaFieldLineFromContractField(prop.name, prop.type, prop.isOptional, provider))
    .filter(Boolean);

  return `model ${modelName} {\n${modelMeta.idLine}\n${fields.join('\n')}${fields.length ? '\n' : ''}${modelMeta.statusLine}\n${modelMeta.createdAtLine}\n${modelMeta.updatedAtLine}\n}`;
}

async function syncPrismaModelsFromContracts(generatedAppRoot, content, preferredModelBlock = null) {
  const contractsRoot = path.join(generatedAppRoot, 'packages', 'shared', 'src', 'contracts');
  let nextContent = ensurePrismaSchemaFoundation(content);
  const provider = extractPrismaDatasourceProvider(nextContent);
  let contractFiles = [];

  try {
    contractFiles = await readdir(contractsRoot);
  } catch {
    return nextContent;
  }

  for (const fileName of contractFiles.filter((item) => item.endsWith('.ts'))) {
    const contractPath = path.join(contractsRoot, fileName);
    const contractContent = await readText(contractPath, '');
    const contractBaseName = fileName.replace(/\.ts$/, '');
    const modelBlock = buildPrismaModelFromContract(contractBaseName, contractContent, provider);
    const modelName = modelBlock.match(/^model\s+([A-Za-z0-9_]+)/m)?.[1];
    if (!modelName) continue;

    if (
      preferredModelBlock &&
      preferredModelBlock.match(/^model\s+([A-Za-z0-9_]+)/m)?.[1] === modelName
    ) {
      continue;
    }

    const modelPattern = new RegExp(`model\\s+${modelName}\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
    if (modelPattern.test(nextContent)) {
      nextContent = nextContent.replace(modelPattern, modelBlock);
    } else {
      nextContent = `${nextContent.trim()}\n\n${modelBlock}`;
    }
  }

  return `${nextContent.trim()}\n`;
}

async function updatePrismaSchema(generatedAppRoot, technicalSpec) {
  const schemaPath = path.join(generatedAppRoot, technicalSpec.database.schemaPath);
  let content = ensurePrismaSchemaFoundation(await readText(schemaPath));
  const provider = extractPrismaDatasourceProvider(content);
  const modelMeta = buildPrismaModelMeta(provider);
  const enumBlocks = buildPrismaEnumBlocks(technicalSpec.database.fields, technicalSpec.database.modelName);
  const fieldLines = technicalSpec.database.fields
    .map((field) => buildPrismaFieldLine(field, technicalSpec.database.modelName, provider))
    .join('\n');
  const modelBlock = `model ${technicalSpec.database.modelName} {\n${modelMeta.idLine}\n${fieldLines}\n${modelMeta.statusLine}\n${modelMeta.createdAtLine}\n${modelMeta.updatedAtLine}\n}\n`;

  if (enumBlocks.length) {
    for (const enumBlock of enumBlocks) {
      const enumName = enumBlock.match(/^enum\s+([A-Za-z0-9_]+)/m)?.[1];
      if (!enumName) continue;
      const enumPattern = new RegExp(`enum\\s+${enumName}\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
      if (enumPattern.test(content)) {
        content = content.replace(enumPattern, enumBlock);
      } else {
        content = `${content.trim()}\n\n${enumBlock}`;
      }
    }
  }

  const modelPattern = new RegExp(`model\\s+${technicalSpec.database.modelName}\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
  if (modelPattern.test(content)) {
    content = content.replace(modelPattern, modelBlock.trim());
  } else if (!content.includes(`model ${technicalSpec.database.modelName} {`)) {
    content = `${content.trim()}\n\n${modelBlock}`;
  }

  content = await syncPrismaModelsFromContracts(generatedAppRoot, content, modelBlock.trim());
  content = `${content.trim()}\n`;
  await writeText(schemaPath, content);

  return {
    relativePath: technicalSpec.database.schemaPath,
    content,
    fileType: 'prisma',
  };
}

async function ensureGeneratedProjectPrismaSchemaConsistency(generatedAppRoot) {
  const schemaPath = path.join(generatedAppRoot, 'prisma', 'schema.prisma');
  const existingContent = ensurePrismaSchemaFoundation(await readText(schemaPath));
  const syncedContent = await syncPrismaModelsFromContracts(generatedAppRoot, existingContent);

  if (syncedContent.trim() !== existingContent.trim()) {
    await writeText(schemaPath, syncedContent);
  }

  return syncedContent;
}

async function runGeneratedProjectCommand(generatedAppRoot, scriptName) {
  const startedAt = new Date().toISOString();
  const command = scriptName === 'install' ? 'npm install' : `npm run ${scriptName}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: generatedAppRoot,
      shell: true,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20,
    });

    return {
      scriptName,
      status: 'completed',
      startedAt,
      finishedAt: new Date().toISOString(),
      stdout: stdout || '',
      stderr: stderr || '',
    };
  } catch (error) {
    return {
      scriptName,
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      errorMessage: error.message,
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriablePrismaGenerateLockError(report) {
  const details = String(report?.stderr || report?.errorMessage || '');
  return report?.scriptName === 'db:generate' && /EPERM: operation not permitted, rename/i.test(details);
}

async function cleanupPrismaGenerateTempArtifacts(generatedAppRoot) {
  const prismaClientRoot = path.join(generatedAppRoot, 'node_modules', '.prisma', 'client');
  if (!(await pathExists(prismaClientRoot))) return;

  const entries = await readdir(prismaClientRoot).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => /\.tmp\d+$/i.test(entry) || /\.tmp$/i.test(entry))
      .map((entry) => rm(path.join(prismaClientRoot, entry), { force: true }).catch(() => null))
  );
}

async function hasUsableGeneratedPrismaClient(generatedAppRoot) {
  const prismaClientRoot = path.join(generatedAppRoot, 'node_modules', '.prisma', 'client');
  const candidateFiles = [
    'query_engine-windows.dll.node',
    'query_engine-windows.dll',
    'libquery_engine-windows.dll.node',
    'edge.js',
    'index.js',
    'default.js',
  ];

  for (const fileName of candidateFiles) {
    if (await pathExists(path.join(prismaClientRoot, fileName))) {
      return true;
    }
  }

  return false;
}

async function runGeneratedProjectCommandWithRetry(generatedAppRoot, scriptName, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 1));
  const retryDelayMs = Math.max(250, Number(options.retryDelayMs || 1200));
  const reports = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (scriptName === 'db:generate') {
      await cleanupPrismaGenerateTempArtifacts(generatedAppRoot);
    }

    const report = await runGeneratedProjectCommand(generatedAppRoot, scriptName);
    reports.push({
      ...report,
      attempt,
    });

    if (
      scriptName === 'db:generate' &&
      report.status === 'failed' &&
      isRetriablePrismaGenerateLockError(report) &&
      (await hasUsableGeneratedPrismaClient(generatedAppRoot))
    ) {
      return {
        ...report,
        status: 'completed',
        recoveredFromLock: true,
        attempt,
        attempts: reports,
      };
    }

    if (report.status === 'completed' || !isRetriablePrismaGenerateLockError(report) || attempt >= maxAttempts) {
      return {
        ...report,
        attempt,
        attempts: reports,
      };
    }

    await sleep(retryDelayMs * attempt);
  }

  return reports[reports.length - 1];
}

function isAcceptableDbGenerateReport(report, validationContext = {}) {
  if (!report) return false;
  if (report.status === 'completed') return true;

  const gatesPassed =
    validationContext.lintReport?.status === 'completed' &&
    validationContext.testReport?.status === 'completed' &&
    validationContext.buildApiReport?.status === 'completed' &&
    validationContext.buildWebReport?.status === 'completed';

  return gatesPassed && isRetriablePrismaGenerateLockError(report);
}

async function runGeneratedProjectValidationSuite({ task, implementation, generatedApp }) {
  const reports = [];
  const hasNodeModules = await pathExists(path.join(generatedApp.rootPath, 'node_modules'));

  if (!hasNodeModules) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, 'install'));
  } else {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, 'install'));
  }

  await ensureGeneratedProjectPrismaSchemaConsistency(generatedApp.rootPath);

  // Ensure and generate Prisma Client before build
  const dbGenerateReport = await runGeneratedProjectCommandWithRetry(generatedApp.rootPath, 'db:generate', {
    maxAttempts: 3,
    retryDelayMs: 1500,
  });
  reports.push(dbGenerateReport);

  for (const scriptName of ['lint', 'test', 'build:api', 'build:web']) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, scriptName));
  }

  const installReport = reports.find((item) => item.scriptName === 'install');
  const prismaGenerateReport = reports.find((item) => item.scriptName === 'db:generate');
  const lintReport = reports.find((item) => item.scriptName === 'lint');
  const testReport = reports.find((item) => item.scriptName === 'test');
  const buildApiReport = reports.find((item) => item.scriptName === 'build:api');
  const buildWebReport = reports.find((item) => item.scriptName === 'build:web');
  const dbGenerateAccepted = isAcceptableDbGenerateReport(prismaGenerateReport, {
    lintReport,
    testReport,
    buildApiReport,
    buildWebReport,
  });

  const buildArtifact = await createCurrentArtifact(
    task.id,
    `Build Report - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        generatedAt: new Date().toISOString(),
        status: buildApiReport?.status === 'completed' && buildWebReport?.status === 'completed' ? 'completed' : 'failed',
        reports: [installReport, prismaGenerateReport, buildApiReport, buildWebReport].filter(Boolean),
      },
      null,
      2
    ),
    'implementation_validator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  const testArtifact = await createCurrentArtifact(
    task.id,
    `Test Report - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        generatedAt: new Date().toISOString(),
        status: testReport?.status || 'failed',
        report: testReport,
      },
      null,
      2
    ),
    'implementation_validator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  const lintArtifact = await createCurrentArtifact(
    task.id,
    `Lint Report - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        generatedAt: new Date().toISOString(),
        status: lintReport?.status || 'failed',
        report: lintReport,
      },
      null,
      2
    ),
    'implementation_validator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  const summary = {
    status:
      lintReport?.status === 'completed' &&
      testReport?.status === 'completed' &&
      buildApiReport?.status === 'completed' &&
      buildWebReport?.status === 'completed' &&
      dbGenerateAccepted
        ? 'completed'
        : 'failed',
    installStatus: installReport?.status || 'skipped',
    dbGenerateStatus: prismaGenerateReport?.status || 'failed',
    dbGenerateAccepted,
    lintStatus: lintReport?.status || 'failed',
    testStatus: testReport?.status || 'failed',
    buildStatus:
      buildApiReport?.status === 'completed' && buildWebReport?.status === 'completed' ? 'completed' : 'failed',
    validationScore: Math.round(
      (
        (lintReport?.status === 'completed' ? 25 : 0) +
        (testReport?.status === 'completed' ? 35 : 0) +
        (buildApiReport?.status === 'completed' ? 20 : 0) +
        (buildWebReport?.status === 'completed' ? 20 : 0)
      )
    ),
    reports,
  };

  return {
    summary,
    artifacts: {
      buildArtifact,
      testArtifact,
      lintArtifact,
    },
  };
}

async function runGeneratedProjectQuickValidation({ generatedApp, scriptNames = [] }) {
  const reports = [];
  const hasNodeModules = await pathExists(path.join(generatedApp.rootPath, 'node_modules'));

  if (!hasNodeModules) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, 'install'));
  }

  for (const scriptName of scriptNames) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, scriptName));
  }

  return {
    status: reports.every((report) => report.status === 'completed') ? 'completed' : 'failed',
    reports,
  };
}

async function ensureGeneratedProjectInstall(generatedApp) {
  const hasNodeModules = await pathExists(path.join(generatedApp.rootPath, 'node_modules'));

  if (hasNodeModules) {
    return null;
  }

  return runGeneratedProjectCommand(generatedApp.rootPath, 'install');
}

function categorizeFinding(code) {
  if (String(code || '').includes('fallback')) return 'fallback';
  if (String(code || '').includes('ux')) return 'quality';
  if (String(code || '').includes('duplicate')) return 'duplication';
  if (String(code || '').includes('missing')) return 'inconsistency';
  if (String(code || '').includes('unclassified')) return 'template_deviation';
  return 'quality';
}

function buildFixPlan(findings, technicalSpec) {
  return findings.map((finding) => {
    if (finding.code === 'generic_form_fallback') {
      return {
        category: 'fallback',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Substituir copy gen?rica e campos de fallback pelo template de dom?nio correspondente.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    if (finding.code === 'duplicate_api_registration' || finding.code === 'duplicate_web_registration') {
      return {
        category: 'duplication',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Deduplicar imports e registros agregados antes de regravar o arquivo compartilhado.',
        suggestedTemplate: 'aggregator/dedup',
      };
    }

    if (finding.code === 'missing_backend_route' || finding.code === 'missing_frontend_route') {
      return {
        category: 'inconsistency',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Reaplicar a etapa de registro de rotas para alinhar o agregador ao technical spec.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    if (finding.code === 'missing_contract_field' || finding.code === 'missing_ui_field') {
      return {
        category: 'inconsistency',
        priority: finding.code === 'missing_contract_field' ? 'high' : 'medium',
        filePath: finding.filePath,
        action: 'Reconciliar os campos do structured spec com o contrato e com a UI gerada.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    if (finding.code === 'unclassified_domain') {
      return {
        category: 'template_deviation',
        priority: 'medium',
        filePath: finding.filePath,
        action: 'Mapear a task para um template de dom?nio conhecido ou enriquecer o structured spec.',
        suggestedTemplate: 'domain-mapping',
      };
    }

    if (finding.code === 'basic_web_shell') {
      return {
        category: 'quality',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Substituir o shell basico por uma navegacao mais robusta, com home estruturada, contexto visual e estado ativo.',
        suggestedTemplate: 'app-shell/premium',
      };
    }

    if (finding.code === 'generic_ux_copy') {
      return {
        category: 'quality',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Reescrever a copy da tela para remover frases genericas e destacar beneficios reais da experiencia.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    if (
      finding.code === 'generic_visual_sections' ||
      finding.code === 'weak_primary_cta' ||
      finding.code === 'template_like_status_copy' ||
      finding.code === 'settings_using_generic_shell' ||
      finding.code === 'product_mode_visual_drift'
    ) {
      return {
        category: 'quality',
        priority: finding.severity === 'high' ? 'high' : 'medium',
        filePath: finding.filePath,
        action: 'Refinar a composicao da tela, fortalecer labels de produto e reaplicar o shell mais adequado ao product mode.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    if (finding.code === 'broken_text_encoding') {
      return {
        category: 'quality',
        priority: 'high',
        filePath: finding.filePath,
        action: 'Normalizar o encoding do arquivo para UTF-8 limpo e revisar os textos antes de reaplicar a feature.',
        suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
      };
    }

    return {
      category: categorizeFinding(finding.code),
      priority: finding.severity === 'high' ? 'high' : 'medium',
      filePath: finding.filePath,
      action: 'Ajustar o arquivo para alinhar a implementa?o ao structured spec e rodar review novamente.',
      suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
    };
  });
}

async function runImplementationReviewInternal({ task, implementation, technicalSpec, generatedApp }) {
  const findings = [];
  const rootPath = generatedApp.rootPath;
  const filesToInspect = new Set([
    'apps/api/src/server.ts',
    'apps/web/src/App.tsx',
    ...(technicalSpec?.structured?.files?.frontend || []),
    ...(technicalSpec?.structured?.files?.backend || []),
    ...(technicalSpec?.structured?.files?.shared || []),
    ...(technicalSpec?.structured?.files?.database || []),
  ]);

  const loadedFiles = {};
  for (const relativePath of filesToInspect) {
    loadedFiles[relativePath] = await readText(path.join(rootPath, relativePath), '');
  }

  const apiServerContent = loadedFiles['apps/api/src/server.ts'] || '';
  const webAppContent = loadedFiles['apps/web/src/App.tsx'] || '';
  const pagePath = `${technicalSpec.frontend.featurePath}/page.tsx`;
  const contractPath = technicalSpec.shared.contractPath;
  const pageContent = loadedFiles[pagePath] || '';
  const contractContent = loadedFiles[contractPath] || '';
  const genericUxCopyPattern =
    /Nenhum dado exibido ainda\.|Validacao automatica dos campos antes do envio\.|Feedback imediato em caso de sucesso ou erro\.|Conclua esta etapa|Carregando dados da feature|Atividade recente/;
  const genericVisualSectionPattern =
    /listTitle="Rotina de acompanhamento"|listTitle="Ultimos registros"|listTitle="Registros ativos"|listTitle="Atividade recente"|summaryTitle="Resumo da feature"/;
  const legacyShellPattern =
    /AppShell|BasicShell|FeaturePage|FeatureWorkbench|SettingsWorkbench|Frontend base gerado pela AI Software Factory|Bem-vindo ao .*?\.<\/p>|Carregando dados da feature/;
  const internalModelLanguagePattern =
    /\bRBAC\b|>\s*(?:Enabled|Disabled|self_service|team|global)\s*</;
  const weakPrimaryCtaPattern =
    />\s*(?:Salvar|Enviar|Concluir operacao|Executar|Processar)\s*</;
  const templateLikeStatusCopyPattern =
    /Ajuste inicial|Configurado|Item pronto para consulta|Indicador pronto para leitura|Registro claro e organizado por tipo/;
  const basicWebShellPattern =
    /Frontend base gerado pela AI Software Factory|Bem-vindo ao .*?\.<\/p>|fontFamily: 'sans-serif', padding: 24/;
  const hasPremiumShellSignals =
    webAppContent.includes('AppFrame') &&
    webAppContent.includes('AppHeader') &&
    webAppContent.includes('SurfaceCard') &&
    webAppContent.includes('SidebarNav') &&
    webAppContent.includes('const routes = [');
  const encodingPattern = /[\u00C3\u00C2\u00E2\uFFFD]/;

  if (/Campo principal da feature gerada|Informe o valor principal/.test(pageContent)) {
    findings.push({
      severity: 'high',
      code: 'generic_form_fallback',
      category: 'fallback',
      filePath: pagePath,
      message: 'A tela ainda usa textos genericos de fallback no formulario.',
    });
  }

  if (genericUxCopyPattern.test(pageContent)) {
    findings.push({
      severity: 'high',
      code: 'generic_ux_copy',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela ainda apresenta copy generica ou placeholder de baixo valor percebido.',
    });
  }

  const usesFeatureWorkbenchShell = /<FeatureWorkbench\b/.test(pageContent);
  const usesSettingsWorkbenchShell = /<SettingsWorkbench\b/.test(pageContent);
  const usesWorkbenchShell = usesFeatureWorkbenchShell || usesSettingsWorkbenchShell;

  if (usesWorkbenchShell && !pageContent.includes('uiIntent=')) {
    findings.push({
      severity: 'medium',
      code: 'missing_ui_intent_signal',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela nao declarou explicitamente a intencao principal da experiencia no shell compartilhado.',
    });
  }

  if (genericVisualSectionPattern.test(pageContent)) {
    findings.push({
      severity: 'medium',
      code: 'generic_visual_sections',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela ainda usa nomes de secao genericos e pouco orientados a produto.',
    });
  }

  if (legacyShellPattern.test(pageContent)) {
    findings.push({
      severity: 'high',
      code: 'legacy_shell_template',
      category: 'template_deviation',
      filePath: pagePath,
      message: 'A tela ainda carrega sinais de shell legado ou incompativel com o shell atual do projeto.',
    });
  }

  if (technicalSpec.architecture?.screenTemplate === 'settings' && usesFeatureWorkbenchShell) {
    findings.push({
      severity: 'medium',
      code: 'settings_using_generic_shell',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela de configuracao ainda usa um shell generico e perdeu a chance de parecer um workspace de ajustes mais autoral.',
    });
  }

  if (internalModelLanguagePattern.test(pageContent)) {
    findings.push({
      severity: 'medium',
      code: 'internal_model_language_visible',
      category: 'quality',
      filePath: pagePath,
      message: 'A interface ainda expoe termos de modelo interno em vez de linguagem final de produto.',
    });
  }

  if (weakPrimaryCtaPattern.test(pageContent)) {
    findings.push({
      severity: 'medium',
      code: 'weak_primary_cta',
      category: 'quality',
      filePath: pagePath,
      message: 'A acao principal ainda parece genrica e pouco orientada a tarefa principal do usuario.',
    });
  }

  if (templateLikeStatusCopyPattern.test(pageContent)) {
    findings.push({
      severity: 'medium',
      code: 'template_like_status_copy',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela ainda carrega estados ou labels com cara de template, em vez de linguagem de produto final.',
    });
  }

  if (
    technicalSpec.frontend?.productMode === 'manager-cockpit' &&
    pageContent.includes('formTitle=') &&
    /formTitle="(?:Configuracao|Novo cadastro|Dados|Concluir operacao)"/.test(pageContent)
  ) {
    findings.push({
      severity: 'medium',
      code: 'product_mode_visual_drift',
      category: 'quality',
      filePath: pagePath,
      message: 'A tela de cockpit ainda esta com cara de formulario genérico e perdeu leitura executiva de produto.',
    });
  }

  if (basicWebShellPattern.test(webAppContent) || !hasPremiumShellSignals) {
    findings.push({
      severity: 'high',
      code: 'basic_web_shell',
      category: 'quality',
      filePath: 'apps/web/src/App.tsx',
      message: 'O shell do frontend ainda esta basico demais e nao atende o padrao minimo de UX do projeto gerado.',
    });
  }

  if (encodingPattern.test(pageContent) || encodingPattern.test(webAppContent)) {
    findings.push({
      severity: 'high',
      code: 'broken_text_encoding',
      category: 'quality',
      filePath: encodingPattern.test(pageContent) ? pagePath : 'apps/web/src/App.tsx',
      message: 'A implementacao contem texto com encoding quebrado e precisa ser normalizada antes da integracao.',
    });
  }

  if (technicalSpec.structured?.classification?.domain === 'custom') {
    findings.push({
      severity: 'medium',
      code: 'unclassified_domain',
      category: 'template_deviation',
      filePath: contractPath,
      message: 'O spec caiu no dominio custom; a task ainda nao encaixou em um template de mercado conhecido.',
    });
  }

  const duplicatedApiLines = collectDuplicateLines(apiServerContent, (line) => line.startsWith('import ') || line.startsWith('app.use('));
  for (const duplicate of duplicatedApiLines) {
    findings.push({
      severity: 'high',
      code: 'duplicate_api_registration',
      category: 'duplication',
      filePath: 'apps/api/src/server.ts',
      message: `Linha duplicada detectada ${duplicate.count}x: ${duplicate.line}`,
    });
  }

  const duplicatedWebLines = collectDuplicateLines(webAppContent, (line) => line.startsWith('import ') || line.includes("path: '"));
  for (const duplicate of duplicatedWebLines) {
    findings.push({
      severity: 'high',
      code: 'duplicate_web_registration',
      category: 'duplication',
      filePath: 'apps/web/src/App.tsx',
      message: `Linha duplicada detectada ${duplicate.count}x: ${duplicate.line}`,
    });
  }

  if (technicalSpec.backend?.routeBase && !apiServerContent.includes(`app.use('${technicalSpec.backend.routeBase}'`)) {
    findings.push({
      severity: 'high',
      code: 'missing_backend_route',
      category: 'inconsistency',
      filePath: 'apps/api/src/server.ts',
      message: `A rota ${technicalSpec.backend.routeBase} nao foi registrada no servidor da API.`,
    });
  }

  if (technicalSpec.frontend?.suggestedRoute && !webAppContent.includes(`path: '${technicalSpec.frontend.suggestedRoute}'`)) {
    findings.push({
      severity: 'high',
      code: 'missing_frontend_route',
      category: 'inconsistency',
      filePath: 'apps/web/src/App.tsx',
      message: `A rota ${technicalSpec.frontend.suggestedRoute} nao foi registrada na navegacao principal.`,
    });
  }

  for (const field of technicalSpec.domain.fields || []) {
    if (!contractContent.includes(field.name)) {
      findings.push({
        severity: 'high',
        code: 'missing_contract_field',
        category: 'inconsistency',
        filePath: contractPath,
        message: `O campo ${field.name} nao apareceu no contrato compartilhado.`,
      });
    }

    if (!pageContent.includes(`form.${field.name}`) && !pageContent.includes(field.name)) {
      findings.push({
        severity: 'medium',
        code: 'missing_ui_field',
        category: 'inconsistency',
        filePath: pagePath,
        message: `O campo ${field.name} nao apareceu claramente na tela gerada.`,
      });
    }
  }

  const severityWeight = { high: 20, medium: 10, low: 5 };
  const score = Math.max(0, 100 - findings.reduce((total, finding) => total + (severityWeight[finding.severity] || 0), 0));
  const uxFindings = findings.filter((item) => item.category === 'quality' || item.code.includes('ux') || item.code.includes('shell'));
  const consistencyFindings = findings.filter((item) => item.category === 'inconsistency');
  const duplicationFindings = findings.filter((item) => item.category === 'duplication');
  const uxScore = Math.max(0, 100 - uxFindings.reduce((total, finding) => total + (severityWeight[finding.severity] || 0), 0));
  const consistencyScore = Math.max(0, 100 - consistencyFindings.reduce((total, finding) => total + (severityWeight[finding.severity] || 0), 0));
  const maintainabilityScore = Math.max(0, 100 - duplicationFindings.reduce((total, finding) => total + (severityWeight[finding.severity] || 0), 0));
  const findingsByLane = summarizeFindingsByLane(findings);
  const fixPlan = buildFixPlan(findings, technicalSpec);
  const reviewReport = {
    version: 1,
    taskUuid: task.uuid,
    implementationId: String(implementation.id),
    featureKey: technicalSpec.featureKey,
    reviewedAt: new Date().toISOString(),
    summary: {
      score,
      uxScore,
      consistencyScore,
      maintainabilityScore,
      findingsByLane,
      totalFindings: findings.length,
      status: findings.some((item) => item.severity === 'high') ? 'needs_attention' : findings.length ? 'minor_issues' : 'approved',
      verdict: findings.length ? 'A implementacao precisa de ajustes antes de ficar pronta para uso.' : 'A implementacao esta consistente com o structured spec.',
    },
    findings,
    fixPlan,
    checkedFiles: Array.from(filesToInspect),
    structured: technicalSpec.structured || null,
  };

  const artifact = await createCurrentArtifact(
    task.id,
    `Implementation Review - ${task.title}`,
    JSON.stringify(reviewReport, null, 2),
    'implementation_reviewer',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  const fixPlanArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Fix Plan - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        summary: {
          totalActions: fixPlan.length,
          templateKey: technicalSpec.structured?.classification?.templateKey || 'generic/form',
        },
        actions: fixPlan,
      },
      null,
      2
    ),
    'implementation_reviewer',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  return { artifact, reviewReport, fixPlanArtifact };
}

async function runImplementationSpecialistReviewInternal({ task, implementation, technicalSpec, generatedApp }) {
  const pagePath = path.join(generatedApp.rootPath, `${technicalSpec.frontend.featurePath}/page.tsx`);
  const servicePath = path.join(generatedApp.rootPath, `${technicalSpec.frontend.featurePath}/service.ts`);
  const contractPath = path.join(generatedApp.rootPath, technicalSpec.shared.contractPath);
  const docsPath = path.join(generatedApp.rootPath, `docs/implementations/${technicalSpec.featureKey}.md`);
  const pageContent = await readText(pagePath);
  const serviceContent = await readText(servicePath);
  const contractContent = await readText(contractPath);
  const docsContent = await readText(docsPath);

  const findings = [];
  const screenTemplate = technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud';
  const autonomousAgentContract =
    technicalSpec.implementationManifest?.autonomousAgent ||
    technicalSpec.implementationManifest?.execution?.autonomousAgent ||
    null;
  const frontendControlMode = autonomousAgentContract?.frontendControlMode || 'guided';
  const canSkipSharedShell = Boolean(autonomousAgentContract?.freedomWithinBounds?.canSkipSharedShell);
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.architecture?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    '';
  const usesFeatureWorkbench = pageContent.includes('FeatureWorkbench');
  const usesSettingsWorkbench = pageContent.includes('SettingsWorkbench');
  const usesOperationsWorkspace = pageContent.includes('OperationsWorkspace');
  const usesExecutiveCockpit = pageContent.includes('ExecutiveCockpit');
  const usesSettingsConsole = pageContent.includes('SettingsConsole');
  const usesPlannerWorkbench = pageContent.includes('PlannerWorkbench');
  const usesFeaturePage = pageContent.includes('FeaturePage');
  const usesSurfaceCard = pageContent.includes('SurfaceCard');
  const usesInputStyle = pageContent.includes('inputStyle');
  const usesTokens = pageContent.includes('tokens');
  const escapedScreenTemplate = String(screenTemplate || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedProductMode = String(productMode || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasExplicitLayout = new RegExp(`layout\\s*=\\s*["']${escapedScreenTemplate}["']`).test(pageContent);
  const hasExplicitProductMode = productMode
    ? new RegExp(`productMode\\s*=\\s*["']${escapedProductMode}["']`).test(pageContent)
    : false;
  const usesSharedFeatureShell =
    usesFeatureWorkbench ||
    usesSettingsWorkbench ||
    usesOperationsWorkspace ||
    usesExecutiveCockpit ||
    usesSettingsConsole ||
      usesPlannerWorkbench ||
      usesFeaturePage;
  const usesSharedDesignPrimitives =
    pageContent.includes('FieldGroup') &&
    pageContent.includes('PrimaryButton') &&
    (usesInputStyle || usesSurfaceCard || usesTokens);
  const requiredFieldNames = (
    technicalSpec.structured?.ui?.sections?.find((section) => section?.type === 'form')?.fields ||
    technicalSpec.domain?.fields ||
    []
  )
    .map((field) => String(field?.name || '').trim())
    .filter(Boolean);
  const explicitFieldCoverage =
    !requiredFieldNames.length ||
    requiredFieldNames.every((fieldName) => pageContent.includes(fieldName));
  const hasRenderedRecords =
    pageContent.includes('.map((item)') ||
    pageContent.includes('.map((record)') ||
    pageContent.includes('items.length ?');
  const usesSharedShellWithProductMode =
    (usesFeatureWorkbench ||
      usesSettingsWorkbench ||
      usesOperationsWorkspace ||
      usesExecutiveCockpit ||
      usesSettingsConsole ||
      usesPlannerWorkbench) &&
    hasExplicitProductMode;

  const workspaceShellMatches =
    screenTemplate === 'workspace' && (usesOperationsWorkspace || usesPlannerWorkbench || usesFeatureWorkbench);
  const freeformAutonomousMatch =
    frontendControlMode === 'freeform' &&
    canSkipSharedShell &&
    usesSharedDesignPrimitives;
  const standaloneSharedWorkspaceMatch =
    screenTemplate === 'workspace' &&
    usesSharedDesignPrimitives &&
    !usesSharedFeatureShell;
  const standaloneSharedSettingsMatch =
    screenTemplate === 'settings' &&
    usesSharedDesignPrimitives &&
    !usesSharedFeatureShell;
  const standaloneSharedDashboardMatch =
    screenTemplate === 'dashboard' &&
    usesSharedDesignPrimitives &&
    explicitFieldCoverage &&
    hasRenderedRecords &&
    !usesSharedFeatureShell;
  const autonomousResultOrientedMatch =
    frontendControlMode === 'freeform' &&
    usesSharedDesignPrimitives &&
    explicitFieldCoverage &&
    hasRenderedRecords;

  if (
    !hasExplicitLayout &&
    !usesSharedShellWithProductMode &&
    !workspaceShellMatches &&
    !freeformAutonomousMatch &&
    !standaloneSharedWorkspaceMatch &&
    !standaloneSharedSettingsMatch &&
    !standaloneSharedDashboardMatch &&
    !autonomousResultOrientedMatch
  ) {
    findings.push({
      severity: 'high',
      code: 'specialist_screen_template_mismatch',
      category: 'quality',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: `A tela nao aplicou explicitamente o layout ${screenTemplate} nem declarou um product mode compativel com o shell compartilhado.`,
    });
  }

  if (
    ((!usesSharedFeatureShell &&
      !freeformAutonomousMatch &&
      !standaloneSharedWorkspaceMatch &&
      !standaloneSharedSettingsMatch &&
      !standaloneSharedDashboardMatch &&
      !autonomousResultOrientedMatch) ||
      (
        /<form\b|FieldGroup|PrimaryButton|<input\b|<textarea\b|<select\b/.test(pageContent) &&
        !pageContent.includes('FieldGroup') &&
        !pageContent.includes('PrimaryButton')
      ))
  ) {
    findings.push({
      severity: 'high',
      code: 'specialist_missing_design_system',
      category: 'quality',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: 'A feature nao esta usando plenamente o design system compartilhado.',
    });
  }

  if (!serviceContent.includes(technicalSpec.backend.routeBase)) {
    findings.push({
      severity: 'high',
      code: 'specialist_route_contract_mismatch',
      category: 'inconsistency',
      filePath: `${technicalSpec.frontend.featurePath}/service.ts`,
      message: `O service da feature nao aponta para ${technicalSpec.backend.routeBase}.`,
    });
  }

  if (!contractContent.includes(technicalSpec.shared.requestContractName) || !contractContent.includes(technicalSpec.shared.responseContractName)) {
    findings.push({
      severity: 'high',
      code: 'specialist_contract_incomplete',
      category: 'inconsistency',
      filePath: technicalSpec.shared.contractPath,
      message: 'Os contratos compartilhados nao estao completos para a feature.',
    });
  }

  if (!docsContent.includes('## Template de tela') || !docsContent.includes('## Stack e arquitetura')) {
    findings.push({
      severity: 'medium',
      code: 'specialist_missing_architecture_trace',
      category: 'quality',
      filePath: `docs/implementations/${technicalSpec.featureKey}.md`,
      message: 'A documentacao da implementacao nao preservou o contexto arquitetural esperado.',
    });
  }

  if ((technicalSpec.projectMemory?.recurringFindings || []).some((item) => item.code === 'generic_ux_copy') && !pageContent.includes('highlights={')) {
    findings.push({
      severity: 'medium',
      code: 'specialist_memory_ignored',
      category: 'quality',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: 'A feature ignorou um padrao recorrente registrado na memoria do projeto.',
    });
  }

  const expectedDomain = technicalSpec.structured?.classification?.domain || technicalSpec.featureKey;
  const implementedDomain = inferImplementedDomain(technicalSpec.featureKey, technicalSpec.backend.routeBase);
  const domainAligned = areDomainKeysAligned(expectedDomain, implementedDomain);

  const semanticSignals = extractSemanticSignals(task.title, technicalSpec.featureKey, technicalSpec.backend.routeBase);
  if (!domainAligned && semanticSignals.some((signal) => !signal.matchedInFeature)) {
    findings.push({
      severity: 'high',
      code: 'specialist_semantic_feature_mismatch',
      category: 'semantic',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: `A feature ${technicalSpec.featureKey} nao parece refletir corretamente o dominio esperado da task: ${task.title}.`,
    });
  }

  const explicitDomainMismatch = detectDomainMismatch(
    task.title,
    technicalSpec.structured?.classification?.domain || technicalSpec.featureKey,
    technicalSpec.featureKey,
    technicalSpec.backend.routeBase,
    docsContent
  );
  if (explicitDomainMismatch) {
    findings.push({
      ...explicitDomainMismatch,
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
    });
  }
  if (expectedDomain && implementedDomain !== 'custom' && !domainAligned) {
    findings.push({
      severity: 'high',
      code: 'specialist_domain_alignment_mismatch',
      category: 'semantic',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: `O dominio implementado (${implementedDomain}) diverge do dominio esperado (${expectedDomain}) para a task.`,
    });
  }

  const titleHint = normalizeSemanticText(task.title);
  if (titleHint.includes('curso') && !docsContent.toLowerCase().includes('curso')) {
    findings.push({
      severity: 'medium',
      code: 'specialist_docs_semantic_gap',
      category: 'semantic',
      filePath: `docs/implementations/${technicalSpec.featureKey}.md`,
      message: 'A documentacao da implementacao nao preservou os termos centrais do dominio da historia.',
    });
  }

  const severityWeight = { high: 25, medium: 12, low: 5 };
  const specialistScore = Math.max(0, 100 - findings.reduce((total, item) => total + (severityWeight[item.severity] || 0), 0));
  const architectureScore = findings
    .filter((item) => item.code.includes('route') || item.code.includes('contract') || item.code.includes('architecture'))
    .reduce((total, item) => total - (severityWeight[item.severity] || 0), 100);
  const experienceScore = findings
    .filter((item) => item.category === 'quality')
    .reduce((total, item) => total - (severityWeight[item.severity] || 0), 100);
  const semanticScore = findings
    .filter((item) => item.category === 'semantic')
    .reduce((total, item) => total - (severityWeight[item.severity] || 0), 100);
  const hasSemanticBlocker = findings.some((item) => item.category === 'semantic' && item.severity === 'high');
  const findingsByLane = summarizeFindingsByLane(findings);

  const reviewReport = {
    version: 1,
    taskUuid: task.uuid,
    implementationId: String(implementation.id),
    featureKey: technicalSpec.featureKey,
    reviewedAt: new Date().toISOString(),
    specialist: 'v3_specialist_reviewer',
    summary: {
      score: specialistScore,
      architectureScore: Math.max(0, architectureScore),
      experienceScore: Math.max(0, experienceScore),
      semanticScore: Math.max(0, semanticScore),
      findingsByLane,
      expectedDomain,
      implementedDomain,
      domainAligned,
      totalFindings: findings.length,
      status: hasSemanticBlocker || findings.some((item) => item.severity === 'high') ? 'needs_attention' : findings.length ? 'minor_issues' : 'approved',
      verdict: hasSemanticBlocker
        ? 'A implementacao divergiu semanticamente do dominio esperado e precisa ser corrigida antes de integrar.'
        : findings.length
          ? 'A implementacao precisa de refinamento especializado para ficar no padrao premium.'
          : 'A implementacao passou no reviewer especializado.',
    },
    findings,
    projectMemory: technicalSpec.projectMemory || null,
  };

  const artifact = await createCurrentArtifact(
    task.id,
    `Implementation Specialist Review - ${task.title}`,
    JSON.stringify(reviewReport, null, 2),
    'implementation_specialist_reviewer',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  return { artifact, reviewReport };
}

async function createRepairAttemptArtifact(task, implementation, technicalSpec, repairContext) {
  return createCurrentArtifact(
    task.id,
    `Implementation Repair Attempt - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        repairContext: compactRepairContext(
          repairContext,
          buildAutonomousCurrentImplementationContext(technicalSpec)
        ),
      },
      null,
      2
    ),
    'implementation_repairer',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

async function createDebugDiagnosisArtifact(task, implementation, technicalSpec, repairContext) {
  if (!repairContext?.debugDiagnosis) {
    return null;
  }

  return createCurrentArtifact(
    task.id,
    `Implementation Debug Diagnosis - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        diagnosis: repairContext.debugDiagnosis,
        executionFocus: compactRepairContext(
          repairContext,
          buildAutonomousCurrentImplementationContext(technicalSpec)
        )?.executionFocus || null,
      },
      null,
      2
    ),
    'debug_agent',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

async function createRepairLearningArtifact(task, implementation, technicalSpec, repairContext) {
  if (!repairContext?.adaptiveDirective && !repairContext?.repairLearning) {
    return null;
  }

  return createCurrentArtifact(
    task.id,
    `Implementation Repair Learning - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        adaptiveDirective: repairContext.adaptiveDirective || null,
        repairLearning: compactRepairContext(
          repairContext,
          buildAutonomousCurrentImplementationContext(technicalSpec)
        )?.repairLearning || null,
      },
      null,
      2
    ),
    'implementation_orchestrator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

function assessRepairWriteSetCompliance(repairContext, touchedFiles = []) {
  const executionFocus = repairContext?.executionFocus || compactRepairContext(repairContext)?.executionFocus || null;
  const normalizedTouched = touchedFiles
    .map((file) => String(file?.relativePath || file?.filePath || '').replace(/\\/g, '/'))
    .filter(Boolean);

  const expectedFocusFiles = Array.isArray(executionFocus?.focusFiles)
    ? executionFocus.focusFiles.map((item) => String(item.relativePath || '').replace(/\\/g, '/')).filter(Boolean)
    : [];
  const allowedFileKeys = Array.isArray(executionFocus?.writeSet?.fileKeys) ? executionFocus.writeSet.fileKeys : [];
  const allowedSupportFiles = deriveRepairAllowedSupportPaths(repairContext).map((file) =>
    String(file || '').replace(/\\/g, '/')
  );

  if (!expectedFocusFiles.length) {
    return {
      status: 'unscoped',
      mode: executionFocus?.writeSet?.mode || 'unknown',
      expectedFocusFiles,
      allowedFileKeys,
      allowedSupportFiles,
      touchedFiles: normalizedTouched,
      outsideWriteSet: [],
      adherencePercent: null,
    };
  }

  const expectedSet = new Set(expectedFocusFiles);
  const allowedSupportSet = new Set(allowedSupportFiles);
  const insideWriteSet = normalizedTouched.filter((file) => expectedSet.has(file));
  const insideSupportSet = normalizedTouched.filter((file) => allowedSupportSet.has(file));
  const allowedTouched = normalizedTouched.filter((file) => expectedSet.has(file) || allowedSupportSet.has(file));
  const outsideWriteSet = normalizedTouched.filter((file) => !expectedSet.has(file) && !allowedSupportSet.has(file));
  const adherencePercent = normalizedTouched.length
    ? Math.round((allowedTouched.length / normalizedTouched.length) * 100)
    : 0;

  const status = !outsideWriteSet.length
    ? 'compliant'
    : executionFocus?.writeSet?.mode === 'local_patch'
      ? 'expanded'
      : 'partial';

  return {
    status,
    mode: executionFocus?.writeSet?.mode || 'unknown',
    expectedFocusFiles,
    allowedFileKeys,
    allowedSupportFiles,
    touchedFiles: normalizedTouched,
    insideWriteSet,
    insideSupportSet,
    allowedTouched,
    outsideWriteSet,
    adherencePercent,
  };
}

async function createRepairScopeAssessmentArtifact(task, implementation, technicalSpec, repairContext, scopeAssessment) {
  return createCurrentArtifact(
    task.id,
    `Implementation Repair Scope Assessment - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        executor: resolveRepairExecutor(
          compactRepairContext(repairContext, buildAutonomousCurrentImplementationContext(technicalSpec))
        ),
        scopeAssessment,
      },
      null,
      2
    ),
    'implementation_orchestrator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

async function createRepairEnforcementArtifact(task, implementation, technicalSpec, repairContext, enforcementDirective, scopeAssessment) {
  if (!enforcementDirective) {
    return null;
  }

  return createCurrentArtifact(
    task.id,
    `Implementation Repair Enforcement - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        enforcementDirective,
        scopeAssessment,
        executionFocus: compactRepairContext(
          repairContext,
          buildAutonomousCurrentImplementationContext(technicalSpec)
        )?.executionFocus || null,
      },
      null,
      2
    ),
    'implementation_orchestrator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

async function persistImplementationExecutionState(task, implementation, state) {
  const phaseLabel = state?.phaseLabel || state?.phase || 'unknown';
  const progressLabel =
    typeof state?.progressPercent === 'number' ? `${Math.max(0, Math.min(100, state.progressPercent))}%` : 'n/a';

  await createCurrentArtifact(
    task.id,
    `Implementation Execution State - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        generatedAt: new Date().toISOString(),
        generationSource: state?.generationSource || null,
        repairStyle: state?.repairStyle || null,
        ...state,
      },
      null,
      2
    ),
    'implementation_orchestrator',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );

  await prisma.taskImplementation.update({
    where: { id: implementation.id },
    data: {
      summary: `${state?.headline || 'Execucao tecnica em andamento.'}\nFase atual: ${phaseLabel}\nProgresso: ${progressLabel}`,
    },
  });
}

async function createRefactorPlanArtifact(task, implementation, technicalSpec, reviewReport, specialistReviewReport, validationSummary) {
  const repairStyle = resolveRepairStyle({
    technicalSpec,
    findings: reviewReport?.findings || [],
    specialistFindings: specialistReviewReport?.findings || [],
    validationFailures: formatValidationFailures(validationSummary),
  });
  const actions = [
    ...(reviewReport?.fixPlan || []),
    ...((specialistReviewReport?.findings || []).map((finding) => ({
      category: finding.category,
      priority: finding.severity,
      filePath: finding.filePath,
      action: finding.message,
      suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
    }))),
    ...formatValidationFailures(validationSummary).map((failure) => ({
      category: 'validation',
      priority: 'high',
      filePath: failure.scriptName,
      action: failure.errorMessage,
      suggestedTemplate: technicalSpec.structured?.classification?.templateKey || 'generic/form',
    })),
  ];

  return createCurrentArtifact(
    task.id,
    `Implementation Refactor Plan - ${task.title}`,
    JSON.stringify(
      {
        version: 1,
        taskUuid: task.uuid,
        implementationId: String(implementation.id),
        featureKey: technicalSpec.featureKey,
        generatedAt: new Date().toISOString(),
        stages: ['review_structural', 'review_specialist', 'validation', 'refactor'],
        repairStyle,
        generationSource:
          technicalSpec?.autonomousMaterialization?.generationSource ||
          technicalSpec?.frontend?.autonomousGenerationSource ||
          technicalSpec?.autonomousExecution?.generationSource ||
          'unknown',
        actions,
      },
      null,
      2
    ),
    'implementation_refactor_planner',
    {
      artifactScope: 'implementation',
      taskImplementationId: implementation.id,
    }
  );
}

async function materializeImplementationFiles({
  task,
  implementation,
  technicalSpec,
  generatedApp,
  workstreamIds = null,
  allowedRelativePaths = null,
}) {
  const routeSpecs = await getIntegratedTechnicalSpecs(generatedApp.id, technicalSpec);
  const projectTemplate = resolveProjectTemplate(
    task.project?.templateKey || task.project?.intakeConfig?.projectTemplateKey || null,
    {
      projectName: task.project.name,
      label: task.project.name,
      summary: task.project.description || task.project.vision || '',
    }
  );
  const compositionManifest = buildAppCompositionManifest({
    project: task.project,
    generatedApp,
    routeSpecs,
    projectTemplate,
  });
  await removeObsoleteGeneratedFeatureSlices(generatedApp.rootPath, compositionManifest);
  const featureFiles = Array.from(
    new Map(
      (() => {
        const syntheticTask = buildSyntheticTaskFromSpec(technicalSpec);
        return [
          ...buildBackendModuleFilesFromTemplate(syntheticTask, technicalSpec).map((file) => {
            const normalizedPath = file.relativePath.replace(/\\/g, '/');
            const isSharedContract = normalizedPath.startsWith('packages/shared/');
            return {
              ...file,
              lane: isSharedContract ? 'shared' : 'backend',
              workstreamId: isSharedContract ? 'shared_contracts' : 'backend_module',
            };
          }),
          ...buildFrontendFeatureFilesFromTemplate(syntheticTask, technicalSpec).map((file) => ({
            ...file,
            lane: 'frontend',
            workstreamId: 'frontend_feature',
          })),
        ];
      })().map((file) => [file.relativePath.replace(/\\/g, '/'), file])
    ).values()
  );

  const generatedFiles = [
    ...featureFiles,
    ...(await ensureValidationScripts(generatedApp.rootPath)).map((file) => ({
      ...file,
      lane: 'shared',
      workstreamId: 'persistence_and_docs',
    })),
    ...(await ensureWorkspaceFoundationFiles(generatedApp.rootPath, task.project.name)).map((file) => ({
      ...file,
      lane: 'shared',
      workstreamId: 'shared_contracts',
    })),
    {
      relativePath: `docs/implementations/${technicalSpec.featureKey}.md`,
      content: buildImplementationDocContent(task, technicalSpec),
      fileType: 'md',
      lane: 'shared',
      workstreamId: 'persistence_and_docs',
    },
    {
      ...(await updateApiServer(generatedApp.rootPath, compositionManifest, generatedApp.slug)),
      lane: 'backend',
      workstreamId: 'backend_module',
    },
    {
      ...(await updateWebApp(generatedApp.rootPath, compositionManifest, task.project.name, { projectTemplate })),
      lane: 'frontend',
      workstreamId: 'frontend_feature',
    },
    {
      ...(await writeCompositionManifest(generatedApp.rootPath, compositionManifest)),
      lane: 'shared',
      workstreamId: 'shared_contracts',
    },
  ];

  const allowedPathSet = Array.isArray(allowedRelativePaths) && allowedRelativePaths.length
    ? new Set(allowedRelativePaths.map((file) => String(file || '').replace(/\\/g, '/')))
    : null;
  const selectedFiles = generatedFiles.filter((file) => {
    const normalizedPath = file.relativePath.replace(/\\/g, '/');
    if (workstreamIds?.length && !workstreamIds.includes(file.workstreamId)) {
      return false;
    }
    if (allowedPathSet && !allowedPathSet.has(normalizedPath)) {
      return false;
    }
    return true;
  });
  const shouldWritePrisma =
    (!workstreamIds?.length || workstreamIds.includes('persistence_and_docs')) &&
    (!allowedPathSet || allowedPathSet.has(technicalSpec.database.schemaPath.replace(/\\/g, '/')));

  if (selectedFiles.length) {
    const prismaRelativePath = technicalSpec.database.schemaPath.replace(/\\/g, '/');
    const nonPrismaFiles = selectedFiles.filter((file) => file.relativePath.replace(/\\/g, '/') !== prismaRelativePath);

    await prisma.generatedFile.deleteMany({
      where: {
        taskImplementationId: implementation.id,
        filePath: {
          in: [
            ...selectedFiles.map((file) => file.relativePath.replace(/\\/g, '/')),
            ...(shouldWritePrisma ? [prismaRelativePath] : []),
          ],
        },
      },
    });

    for (const file of nonPrismaFiles) {
      await writeText(path.join(generatedApp.rootPath, file.relativePath), file.content);
    }

    let prismaFile = null;
    if (shouldWritePrisma) {
      prismaFile = {
        ...(await updatePrismaSchema(generatedApp.rootPath, technicalSpec)),
        lane: 'shared',
        workstreamId: 'persistence_and_docs',
      };
    }

    const persistedFiles = [...nonPrismaFiles, ...(prismaFile ? [prismaFile] : [])];

    await prisma.generatedFile.createMany({
      data: persistedFiles.map((file) => ({
        generatedAppId: generatedApp.id,
        taskImplementationId: implementation.id,
        filePath: file.relativePath.replace(/\\/g, '/'),
        fileType: file.fileType,
        changeType: 'created',
        checksum: sha(file.content),
      })),
    });

    return persistedFiles;
  }

  return selectedFiles;
}

async function executeImplementationQualityCycle({ task, implementation, technicalSpec, generatedApp }) {
  const reviewRun = await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: generatedApp.id,
      taskImplementationId: implementation.id,
      runType: 'validation',
      status: 'running',
      startedAt: new Date(),
    },
  });

  const { reviewReport } = await runImplementationReviewInternal({
    task,
    implementation,
    technicalSpec,
    generatedApp,
  });

  const { reviewReport: specialistReviewReport } = await runImplementationSpecialistReviewInternal({
    task,
    implementation,
    technicalSpec,
    generatedApp,
  });

  const specialistBlocksIntegration = specialistReviewReport.summary.status === 'needs_attention';

  await prisma.generatedAppRun.update({
    where: { id: reviewRun.id },
    data: {
      status:
        reviewReport.summary.status === 'approved' && !specialistBlocksIntegration
          ? 'completed'
          : 'failed',
      finishedAt: new Date(),
      logSummary: `Review automatico executado para ${task.uuid} | estrutural=${reviewReport.summary.score} | specialist=${specialistReviewReport.summary.score}`,
    },
  });

  const validationRun = await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: generatedApp.id,
      taskImplementationId: implementation.id,
      runType: 'validation',
      status: 'running',
      startedAt: new Date(),
    },
  });

  const validationSuite = await runGeneratedProjectValidationSuite({
    task,
    implementation,
    generatedApp,
  });

  await prisma.generatedAppRun.update({
    where: { id: validationRun.id },
    data: {
      status: validationSuite.summary.status === 'completed' ? 'completed' : 'failed',
      finishedAt: new Date(),
      logSummary: `Validation suite executada para ${task.uuid} | lint=${validationSuite.summary.lintStatus} test=${validationSuite.summary.testStatus} build=${validationSuite.summary.buildStatus}`,
    },
  });

  if (reviewReport.summary.status !== 'approved' || specialistBlocksIntegration || validationSuite.summary.status !== 'completed') {
    await createRefactorPlanArtifact(task, implementation, technicalSpec, reviewReport, specialistReviewReport, validationSuite.summary);
  }

  return { reviewReport, specialistReviewReport, validationSuite };
}

export async function getGeneratedAppByProjectUuid(projectUuid) {
  const project = await getProjectOrThrow(projectUuid);

  return prisma.generatedApp.findFirst({
    where: { projectId: project.id },
    include: {
      modules: true,
      files: {
        orderBy: { createdAt: 'desc' },
        take: 200,
      },
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listGeneratedAppFiles(projectUuid) {
  const app = await getGeneratedAppByProjectUuid(projectUuid);
  if (!app) return [];
  return app.files;
}

export async function bootstrapGeneratedApp(projectUuid, options = {}) {
  const project = await getProjectOrThrow(projectUuid);
  const projectTemplate = resolveProjectTemplateForProject(project);
  const existing = await prisma.generatedApp.findFirst({
    where: { projectId: project.id },
    include: { modules: true, files: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existing && !options.forceRebuild) {
    await ensureGeneratedAppFoundation(project, existing);
    return getGeneratedAppByProjectUuid(projectUuid);
  }

  const slug = slugify(project.slug || project.name, project.uuid);
  const destinationRoot = existing?.rootPath || path.join(GENERATED_PROJECTS_ROOT, slug);

  await mkdir(GENERATED_PROJECTS_ROOT, { recursive: true });

  const app = existing
    ? await prisma.generatedApp.update({
        where: { id: existing.id },
        data: {
          name: `${project.name} App`,
          slug,
          rootPath: destinationRoot,
          stackPreset: 'react-vite-typescript__express-prisma-typescript',
          status: 'bootstrapping',
        },
      })
    : await prisma.generatedApp.create({
        data: {
          uuid: randomUUID(),
          projectId: project.id,
          name: `${project.name} App`,
          slug,
          rootPath: destinationRoot,
          stackPreset: 'react-vite-typescript__express-prisma-typescript',
          status: 'bootstrapping',
        },
      });

  const run = await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: app.id,
      runType: 'bootstrap',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    const writtenFiles = await materializeFullstackTemplate({
      destinationRoot,
      projectName: project.name,
      projectSlug: slug,
    });
    const blueprintSpecs = buildProjectTemplateTechnicalSpecs(project, projectTemplate);
    const blueprintFeatureFiles = Array.from(
      new Map(
        blueprintSpecs
          .flatMap((spec) => {
            const syntheticTask = buildSyntheticTaskFromSpec(spec);
            return [
              ...buildBackendModuleFilesFromTemplate(syntheticTask, spec),
              ...buildFrontendFeatureFilesFromTemplate(syntheticTask, spec),
            ];
          })
          .map((file) => [file.relativePath.replace(/\\/g, '/'), file])
      ).values()
    );
    const blueprintShellFiles = [
      ...(await ensureValidationScripts(destinationRoot)),
      ...(await ensureWorkspaceFoundationFiles(destinationRoot, project.name)),
      await updateApiServer(destinationRoot, blueprintSpecs, slug),
      await updateWebApp(destinationRoot, blueprintSpecs, project.name, { projectTemplate }),
      buildProjectTemplateBlueprintDoc(project.name, projectTemplate, blueprintSpecs),
    ];
    const blueprintFiles = [...blueprintFeatureFiles, ...blueprintShellFiles];

    for (const file of blueprintFiles) {
      // Regrava o shell base com o blueprint para o projeto nascer com jornadas iniciais coerentes.
      // eslint-disable-next-line no-await-in-loop
      await writeText(path.join(destinationRoot, file.relativePath), file.content);
    }
    const syncedSchemaContent = await ensureGeneratedProjectPrismaSchemaConsistency(destinationRoot);
    blueprintFiles.push({
      relativePath: 'prisma/schema.prisma',
      content: syncedSchemaContent,
      fileType: 'prisma',
    });
    const persistedFiles = Array.from(
      new Map(
        [...writtenFiles, ...blueprintFiles].map((file) => [
          file.relativePath.replace(/\\/g, '/'),
          {
            ...file,
            checksum: file.checksum || sha(file.content || ''),
          },
        ])
      ).values()
    );

    if (existing) {
      await prisma.generatedFile.deleteMany({ where: { generatedAppId: app.id, taskImplementationId: null } });
      await prisma.generatedAppModule.deleteMany({ where: { generatedAppId: app.id } });
    }

    await prisma.generatedFile.createMany({
      data: persistedFiles.map((file) => ({
        generatedAppId: app.id,
        filePath: file.relativePath,
        fileType: file.fileType,
        changeType: 'created',
        checksum: file.checksum,
      })),
    });

    await prisma.generatedAppModule.createMany({
      data: [
        { generatedAppId: app.id, name: 'web', moduleType: 'frontend', path: 'apps/web', status: 'ready' },
        { generatedAppId: app.id, name: 'api', moduleType: 'backend', path: 'apps/api', status: 'ready' },
        { generatedAppId: app.id, name: 'shared', moduleType: 'shared', path: 'packages/shared', status: 'ready' },
        { generatedAppId: app.id, name: 'ui', moduleType: 'shared_ui', path: 'packages/ui', status: 'ready' },
        { generatedAppId: app.id, name: 'config', moduleType: 'config', path: 'packages/config', status: 'ready' },
      ],
    });

    await prisma.generatedApp.update({
      where: { id: app.id },
      data: { status: 'ready' },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: {
        intakeConfig: {
          ...(project.intakeConfig || {}),
          projectTemplateKey: project.templateKey || project.intakeConfig?.projectTemplateKey || null,
          bootstrapTemplateKey: projectTemplate.templateKey,
          bootstrapFeatureKeys: blueprintSpecs.map((spec) => spec.featureKey),
          bootstrapGeneratedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        logSummary: `Template base criado em ${destinationRoot} com ${blueprintSpecs.length} feature(s) do blueprint inicial.`,
      },
    });
  } catch (error) {
    await prisma.generatedApp.update({
      where: { id: app.id },
      data: { status: 'failed' },
    });
    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        logSummary: error.message,
      },
    });
    throw error;
  }

  return getGeneratedAppByProjectUuid(projectUuid);
}

export async function planTaskImplementation(taskUuid, userUuid = null, options = {}) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const runtimeUserUuid = resolveImplementationUserUuid(task, userUuid);

  if (task.status !== 'done') {
    throw new Error('A implementacao so pode comecar apos o refinamento completo da task.');
  }

  const projectArchitectureSource = await getProjectArchitectureSource(task.project.uuid);

  const generatedApp = await getGeneratedAppByProjectUuid(task.project.uuid);
  if (!generatedApp) {
    throw new Error('O projeto ainda nao possui um app full stack gerado. Faca o bootstrap primeiro.');
  }
  await ensureGeneratedAppFoundation(task.project, generatedApp);

  let technicalSpec = buildTechnicalSpec(task, projectArchitectureSource);
  const projectMemory = await buildProjectMemorySnapshot(task, generatedApp);
  technicalSpec = {
    ...technicalSpec,
    projectMemory,
  };
  technicalSpec = await hydrateTechnicalSpecWithWorkspaceImplementation(technicalSpec, generatedApp.rootPath);
  technicalSpec = await enrichFrontendWithAi(task, technicalSpec, runtimeUserUuid, null, options);
  let implementationManifest = buildImplementationManifest(task, technicalSpec);
  let autonomousDraftArtifact = null;
  if (implementationManifest.execution?.mode === 'autonomous') {
    const autonomousDraft = await runAutonomousImplementationAgent(task, technicalSpec, implementationManifest, runtimeUserUuid);
    if (autonomousDraft) {
      technicalSpec = applyAutonomousImplementationDraft(technicalSpec, autonomousDraft);
      implementationManifest = buildImplementationManifest(task, technicalSpec);
      autonomousDraftArtifact = await createCurrentArtifact(
        task.id,
        `Autonomous Implementation Draft - ${task.title}`,
        JSON.stringify(autonomousDraft, null, 2),
        'implementation_autonomous_agent'
      );
    }
  }
  const coherenceContracts = await loadProjectCoherenceContracts(task.project.id);
  const coherenceReport = buildCoherenceReport(task, technicalSpec, implementationManifest, coherenceContracts);
  const coherenceArtifact = await createCurrentArtifact(
    task.id,
    `Coherence Report - ${task.title}`,
    JSON.stringify(coherenceReport, null, 2),
    'coherence_guardian'
  );
  if (coherenceReport.status === 'blocked') {
    const reasons = (coherenceReport.driftFlags || []).map((flag) => `- ${flag.message}`).join('\n');
    throw new Error(`A task falhou no gate de coerencia antes do planejamento tecnico.\n${reasons}`);
  }
  const technicalSpecArtifact = await createCurrentArtifact(
    task.id,
    `Technical Spec - ${task.title}`,
    JSON.stringify(technicalSpec, null, 2),
    'implementation_architect'
  );
  const implementationManifestArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Manifest - ${task.title}`,
    JSON.stringify(implementationManifest, null, 2),
    'implementation_architect'
  );

  const plan = buildImplementationPlan(task, generatedApp, technicalSpec, implementationManifest, coherenceReport);
  const strategy = buildExecutionStrategy(task, generatedApp, technicalSpec, projectMemory);
  const impactAnalysis = buildImplementationImpactAnalysis(task, generatedApp, technicalSpec, projectMemory);
  const planArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Plan - ${task.title}`,
    JSON.stringify(plan, null, 2),
    'implementation_architect'
  );
  const strategyArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Strategy - ${task.title}`,
    JSON.stringify(strategy, null, 2),
    'implementation_architect'
  );
  const impactArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Impact Analysis - ${task.title}`,
    JSON.stringify(impactAnalysis, null, 2),
    'implementation_architect'
  );

  const existingImplementation = await getLatestTaskImplementation(task.id);
  const implementationToReuse = shouldReuseImplementationRecord(existingImplementation) ? existingImplementation : null;

  const implementation = implementationToReuse
    ? await prisma.taskImplementation.update({
        where: { id: implementationToReuse.id },
        data: {
          generatedAppId: generatedApp.id,
          technicalSpecArtifactId: technicalSpecArtifact.id,
          implementationPlanArtifactId: planArtifact.id,
          status: 'planned',
          implementationType: 'incremental_feature',
          targetBranch: 'main',
          targetPath: generatedApp.rootPath,
          buildStatus: null,
          testStatus: null,
          summary: `Planejamento tecnico atualizado para a task ${task.title}.`,
        },
        include: {
          technicalSpecArtifact: true,
          implementationPlanArtifact: true,
          generatedApp: true,
          generatedFiles: true,
        },
      })
    : await prisma.taskImplementation.create({
        data: {
          uuid: randomUUID(),
          taskId: task.id,
          generatedAppId: generatedApp.id,
          technicalSpecArtifactId: technicalSpecArtifact.id,
          implementationPlanArtifactId: planArtifact.id,
          status: 'planned',
          implementationType: 'incremental_feature',
          targetBranch: 'main',
          targetPath: generatedApp.rootPath,
          summary: `Planejamento tecnico criado para a task ${task.title}.`,
        },
        include: {
          technicalSpecArtifact: true,
          implementationPlanArtifact: true,
          generatedApp: true,
          generatedFiles: true,
        },
      });

  await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: generatedApp.id,
      taskImplementationId: implementation.id,
      runType: 'implementation_plan',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      logSummary: `Plano de implementacao criado para ${task.uuid}`,
    },
  });

  await prisma.taskArtifact.updateMany({
    where: {
      id: {
        in: [coherenceArtifact.id, technicalSpecArtifact.id, implementationManifestArtifact.id, planArtifact.id, strategyArtifact.id, impactArtifact.id],
      },
    },
    data: {
      taskImplementationId: implementation.id,
      artifactScope: 'implementation',
    },
  });

  if (autonomousDraftArtifact?.id) {
    await prisma.taskArtifact.update({
      where: { id: autonomousDraftArtifact.id },
      data: {
        taskImplementationId: implementation.id,
        artifactScope: 'implementation',
      },
    });
  }

  const memoryArtifact = await createProjectMemoryArtifact(task, implementation, generatedApp);
  await prisma.taskArtifact.update({
    where: { id: memoryArtifact.artifact.id },
    data: {
      taskImplementationId: implementation.id,
      artifactScope: 'implementation',
    },
  });

  return implementation;
}

export async function runTaskImplementation(taskUuid, userUuid = null, options = {}) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const runtimeUserUuid = resolveImplementationUserUuid(task, userUuid);
  const generatedApp = await getGeneratedAppByProjectUuid(task.project.uuid);

  if (!generatedApp) {
    throw new Error('O projeto ainda nao possui um app full stack gerado. Faca o bootstrap primeiro.');
  }
  await ensureGeneratedAppFoundation(task.project, generatedApp);
  const integratedSpecs = await getIntegratedTechnicalSpecs(generatedApp.id, null);
  await reconcileLegacyGeneratedFeatureModules(generatedApp.rootPath, integratedSpecs);
  await recoverBlockingGeneratedAppRunsForStart({
    generatedAppId: generatedApp.id,
    taskId: task.id,
    runType: 'implementation_apply',
    reason: 'Execucao de implementation_apply travada foi encerrada automaticamente antes de uma nova tentativa.',
  });

  let implementation = await getLatestTaskImplementation(task.id);

  if (options.forceRefresh || !hasReusableImplementationPlan(implementation, generatedApp.id)) {
    implementation = await planTaskImplementation(taskUuid, runtimeUserUuid, options);
  }

  const implementationPlanContent = parseJsonArtifactContent(implementation?.implementationPlanArtifact);
  let implementationManifest = parseJsonArtifactContent(
    await prisma.taskArtifact.findFirst({
      where: {
        taskId: task.id,
        title: `Implementation Manifest - ${task.title}`,
      },
      orderBy: { createdAt: 'desc' },
    })
  );

  implementation = await prisma.taskImplementation.update({
    where: { id: implementation.id },
    data: { status: 'in_progress' },
    include: {
      technicalSpecArtifact: true,
      implementationPlanArtifact: true,
      generatedApp: true,
      generatedFiles: true,
    },
  });

  const run = await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: generatedApp.id,
      taskImplementationId: implementation.id,
      runType: 'implementation_apply',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    await persistImplementationExecutionState(task, implementation, {
      phase: 'impact_and_contract',
      phaseLabel: 'Impacto e contrato',
      progressPercent: 10,
      status: 'in_progress',
      headline: 'Consolidando objetivo, impacto e plano tecnico antes da integracao.',
      notes: [
        'Revisar technical spec atual',
        'Confirmar plano de implementacao reutilizavel',
        'Preparar contexto da feature para materializacao',
      ],
      ...getWorkstreamExecutionState(implementationPlanContent, 'impact_and_contract'),
    });

    await cleanupImplementationFiles(generatedApp.rootPath, implementation);

    let technicalSpec = normalizeTechnicalSpec(JSON.parse(implementation.technicalSpecArtifact.content), task);
    let generatedFiles = await materializeImplementationFiles({
      task,
      implementation,
      technicalSpec,
      generatedApp,
      workstreamIds: ['shared_contracts'],
    });

      await persistImplementationExecutionState(task, implementation, {
        phase: 'parallel_delivery',
        phaseLabel: 'Entrega paralela',
        progressPercent: 32,
        status: 'in_progress',
        headline: 'Materializando backend e frontend em paralelo a partir do contrato compartilhado.',
        notes: [
          technicalSpec.backend?.routeBase || 'Rota backend pendente',
          technicalSpec.frontend?.suggestedRoute || 'Rota frontend pendente',
          'Validacoes rapidas: build da API e build web em paralelo',
        ],
        ...getWorkstreamExecutionState(implementationPlanContent, 'parallel_delivery'),
      });

      const parallelDeliveryResults = await Promise.all([
        materializeImplementationFiles({
          task,
          implementation,
          technicalSpec,
          generatedApp,
          workstreamIds: ['backend_module'],
        }),
        materializeImplementationFiles({
          task,
          implementation,
          technicalSpec,
          generatedApp,
          workstreamIds: ['frontend_feature'],
        }),
      ]);
      generatedFiles = [...generatedFiles, ...parallelDeliveryResults.flat()];

      await ensureGeneratedProjectInstall(generatedApp);

      const [backendQuickValidation, frontendQuickValidation] = await Promise.all([
        runGeneratedProjectCommand(generatedApp.rootPath, 'build:api'),
        runGeneratedProjectCommand(generatedApp.rootPath, 'build:web'),
      ]);

      if (backendQuickValidation.status !== 'completed' || frontendQuickValidation.status !== 'completed') {
        const failedLane = backendQuickValidation.status !== 'completed' ? 'backend' : 'frontend';
        const failedReport = failedLane === 'backend' ? backendQuickValidation : frontendQuickValidation;
        const failedScript = failedReport?.scriptName || (failedLane === 'backend' ? 'build:api' : 'build:web');
        // Nivel Antigravity: Nao paramos mais aqui. Deixamos o ciclo de qualidade capturar e o DebugAgent agir.
        console.warn(`[Self-Healing] Quick validation falhou em ${failedLane}/${failedScript}. Proceeding to repair cycle.`);
      }

      await persistImplementationExecutionState(task, implementation, {
        phase: 'integration_and_validation',
        phaseLabel: 'Integração e validação',
        progressPercent: 62,
      status: 'in_progress',
      headline: 'Consolidando persistencia, documentacao e suite tecnica final.',
      notes: [
          'Schema e documentacao incremental',
          'Review estrutural',
          'Review especialista, build, teste e lint',
        ],
        ...getWorkstreamExecutionState(implementationPlanContent, 'integration_and_validation'),
    });

    generatedFiles = [
      ...generatedFiles,
      ...(await materializeImplementationFiles({
        task,
        implementation,
        technicalSpec,
        generatedApp,
        workstreamIds: ['persistence_and_docs'],
      })),
    ];
    const maxRepairAttempts = getImplementationAutoRepairAttempts();
    const repairAttempts = [];

    let cycleResult = await executeImplementationQualityCycle({
      task,
      implementation,
      technicalSpec,
      generatedApp,
    });
    let forcedRepairDirective = null;

    for (let attemptIndex = 1; attemptIndex <= maxRepairAttempts; attemptIndex += 1) {
      const cyclePassed =
        cycleResult.reviewReport.summary.status === 'approved' &&
        cycleResult.specialistReviewReport.summary.status !== 'needs_attention' &&
        cycleResult.validationSuite.summary.status === 'completed';

      if (cyclePassed) {
        break;
      }

      const repairContext = await buildRepairContext({
        reviewReport: cycleResult.reviewReport,
        specialistReviewReport: cycleResult.specialistReviewReport,
        validationSummary: cycleResult.validationSuite.summary,
        attemptNumber: attemptIndex,
        technicalSpec,
        projectId: task.projectId,
        forcedDirective: forcedRepairDirective,
      });

      await createDebugDiagnosisArtifact(task, implementation, technicalSpec, repairContext);
      await createRepairLearningArtifact(task, implementation, technicalSpec, repairContext);
      await createRepairAttemptArtifact(task, implementation, technicalSpec, repairContext);
      repairAttempts.push(repairContext);

      await persistImplementationExecutionState(task, implementation, {
        phase: 'repair',
        phaseLabel: 'Reparo incremental',
        progressPercent: Math.min(92, 68 + attemptIndex * 8),
        status: 'in_progress',
        headline: `Aplicando reparo automatico ${attemptIndex}/${maxRepairAttempts}.`,
        notes: [
          ...((repairContext.findings || [])
          .slice(0, 3)
          .map((item) => `${item.severity}: ${item.message}`)),
          `Estilo: ${repairContext.repairStyle || 'iterative'}`,
          `Executor: ${resolveRepairExecutor(compactRepairContext(repairContext, buildAutonomousCurrentImplementationContext(technicalSpec)))}`,
          repairContext.adaptiveDirective?.reason
            ? `Aprendizado: ${repairContext.adaptiveDirective.reason}`
            : 'Aprendizado: sem ajuste adaptativo.',
          `Escopo: ${(repairContext.repairScope?.workstreamIds || []).join(', ') || 'persistence_and_docs'}`,
        ],
        repairScope: repairContext.repairScope || null,
        repairStyle: repairContext.repairStyle || null,
        generationSource: repairContext.generationSource || null,
        ...getWorkstreamExecutionState(implementationPlanContent, 'integration_and_validation'),
      });

      if (implementationManifest?.execution?.mode === 'autonomous' && repairContext.repairStyle === 'iterative') {
        const repairExecutor = resolveRepairExecutor(
          compactRepairContext(repairContext, buildAutonomousCurrentImplementationContext(technicalSpec))
        );
        const autonomousRepairDraft = await runRepairExecutionAgent(
          task,
          technicalSpec,
          implementationManifest,
          runtimeUserUuid,
          repairContext
        );
        if (autonomousRepairDraft) {
          technicalSpec = applyAutonomousImplementationDraft(technicalSpec, autonomousRepairDraft);
          implementationManifest = buildImplementationManifest(task, technicalSpec);
          await createCurrentArtifact(
            task.id,
            `Implementation Repair Draft - ${task.title}`,
            JSON.stringify(autonomousRepairDraft, null, 2),
            repairExecutor,
            {
              taskImplementationId: implementation.id,
              artifactScope: 'implementation',
            }
          );
          await createCurrentArtifact(
            task.id,
            `Implementation Manifest - ${task.title}`,
            JSON.stringify(implementationManifest, null, 2),
            'implementation_architect',
            {
              taskImplementationId: implementation.id,
              artifactScope: 'implementation',
            }
          );
        }
      }

      if (repairContext.repairScope?.needsFrontend && repairContext.repairStyle === 'iterative') {
          technicalSpec = await enrichFrontendWithAi(task, technicalSpec, runtimeUserUuid, repairContext, options);
      }
      const repairWorkstreamIds = repairContext.repairScope?.workstreamIds?.length
        ? repairContext.repairScope.workstreamIds
        : ['persistence_and_docs'];
      const repairMaterializationPaths = resolveRepairMaterializationPaths(repairContext);
      const repairedFiles = await materializeImplementationFiles({
        task,
        implementation,
        technicalSpec,
        generatedApp,
        workstreamIds: repairWorkstreamIds,
        allowedRelativePaths: repairMaterializationPaths,
      });
      const repairScopeAssessment = assessRepairWriteSetCompliance(repairContext, repairedFiles);
      const nextRepairDirective = resolveRepairEnforcementDirective(repairContext, repairScopeAssessment);
      await createRepairScopeAssessmentArtifact(task, implementation, technicalSpec, repairContext, repairScopeAssessment);
      await createRepairEnforcementArtifact(task, implementation, technicalSpec, repairContext, nextRepairDirective, repairScopeAssessment);
      await persistImplementationExecutionState(task, implementation, {
        phase: 'repair',
        phaseLabel: 'Reparo incremental',
        progressPercent: Math.min(94, 72 + attemptIndex * 8),
        status: 'in_progress',
        headline: `Reparo ${attemptIndex}/${maxRepairAttempts} materializado e avaliado.`,
        notes: [
          `Executor: ${resolveRepairExecutor(compactRepairContext(repairContext, buildAutonomousCurrentImplementationContext(technicalSpec)))}`,
          `Write set: ${repairScopeAssessment.status}`,
          repairScopeAssessment.adherencePercent == null
            ? 'Aderencia: n/a'
            : `Aderencia: ${repairScopeAssessment.adherencePercent}%`,
          nextRepairDirective
            ? `Escalada: ${nextRepairDirective.nextRepairStyle} via ${nextRepairDirective.nextExecutor}`
            : 'Sem escalada de repair.',
          repairScopeAssessment.outsideWriteSet.length
            ? `Fora do escopo: ${repairScopeAssessment.outsideWriteSet.slice(0, 3).join(', ')}`
            : 'Sem arquivos fora do escopo esperado.',
        ],
        repairScope: repairContext.repairScope || null,
        repairStyle: repairContext.repairStyle || null,
        generationSource: repairContext.generationSource || null,
        repairScopeAssessment,
        enforcementDirective: nextRepairDirective,
        ...getWorkstreamExecutionState(implementationPlanContent, 'integration_and_validation'),
      });
      forcedRepairDirective = nextRepairDirective;
      const repairedFileSet = new Set(
        repairedFiles.map((file) => String(file.relativePath || file.filePath || '').replace(/\\/g, '/'))
      );
      generatedFiles = [
        ...generatedFiles.filter((file) => !repairedFileSet.has(String(file.relativePath || file.filePath || '').replace(/\\/g, '/'))),
        ...repairedFiles,
      ];
      cycleResult = await executeImplementationQualityCycle({
        task,
        implementation,
        technicalSpec,
        generatedApp,
      });
    }

    const finalSucceeded =
      cycleResult.reviewReport.summary.status === 'approved' &&
      cycleResult.specialistReviewReport.summary.status !== 'needs_attention' &&
      cycleResult.validationSuite.summary.status === 'completed';
    const createdPaths = generatedFiles.map((file) => file.relativePath).join('\n');
    const qualitySummary = buildImplementationQualitySummary({
      task,
      implementation,
      reviewArtifact: cycleResult.reviewArtifact,
      specialistReviewArtifact: cycleResult.specialistReviewArtifact,
      buildReportArtifact: cycleResult.validationSuite.buildArtifact,
      testReportArtifact: cycleResult.validationSuite.testArtifact,
      lintReportArtifact: cycleResult.validationSuite.lintArtifact,
    });
    await createImplementationDiffReviewArtifact(
      task,
      implementation,
      technicalSpec,
      qualitySummary,
      generatedFiles,
      repairAttempts.length
    );

    await persistImplementationExecutionState(task, implementation, {
      phase: finalSucceeded ? 'completed' : 'failed_validation',
      phaseLabel: finalSucceeded ? 'Integração concluída' : 'Validação final com ressalvas',
      progressPercent: finalSucceeded ? 100 : 96,
      status: finalSucceeded ? 'completed' : 'needs_attention',
      headline: finalSucceeded
        ? 'A feature foi integrada com sucesso e passou pelos gates tecnicos.'
        : 'A feature foi materializada, mas ainda requer atencao de qualidade antes de ser considerada integrada.',
      notes: [
        `Review: ${cycleResult.reviewReport.summary.status}`,
        `Specialist: ${cycleResult.specialistReviewReport.summary.status}`,
        `Validation: ${cycleResult.validationSuite.summary.status}`,
      ],
      ...buildCompletedWorkstreamState(implementationPlanContent),
    });

    await prisma.taskImplementation.update({
      where: { id: implementation.id },
      data: {
        status: finalSucceeded ? 'integrated' : 'failed',
        buildStatus: cycleResult.validationSuite.summary.buildStatus,
        testStatus:
          cycleResult.validationSuite.summary.testStatus === 'completed' &&
          cycleResult.validationSuite.summary.lintStatus === 'completed'
            ? 'completed'
            : 'failed',
        summary: `Integracao aplicada com arquivos reais:\n${createdPaths}\n\nReview score: ${cycleResult.reviewReport.summary.score}\nUX score: ${cycleResult.reviewReport.summary.uxScore}\nConsistency score: ${cycleResult.reviewReport.summary.consistencyScore}\nSpecialist score: ${cycleResult.specialistReviewReport.summary.score}\nSpecialist architecture score: ${cycleResult.specialistReviewReport.summary.architectureScore}\nValidation score: ${cycleResult.validationSuite.summary.validationScore}\nReview status: ${cycleResult.reviewReport.summary.status}\nSpecialist status: ${cycleResult.specialistReviewReport.summary.status}\nValidation status: ${cycleResult.validationSuite.summary.status}\nLint: ${cycleResult.validationSuite.summary.lintStatus}\nTest: ${cycleResult.validationSuite.summary.testStatus}\nBuild: ${cycleResult.validationSuite.summary.buildStatus}\nRepair attempts: ${repairAttempts.length}\nRepair write set: ${qualitySummary.repairBehavior?.writeSetStatus || 'unknown'}\nRepair adherence: ${qualitySummary.repairBehavior?.adherencePercent ?? 'n/a'}\nRepair escalated: ${qualitySummary.repairBehavior?.escalated ? 'yes' : 'no'}`,
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: finalSucceeded ? 'completed' : 'failed',
        finishedAt: new Date(),
        logSummary: `Integracao incremental aplicada para ${task.uuid} | validation=${cycleResult.validationSuite.summary.status} | repairAttempts=${repairAttempts.length} | writeSet=${qualitySummary.repairBehavior?.writeSetStatus || 'unknown'} | escalated=${qualitySummary.repairBehavior?.escalated ? 'yes' : 'no'}`,
      },
    });
  } catch (error) {
    await persistImplementationExecutionState(task, implementation, {
      phase: 'failed',
      phaseLabel: 'Falha na execução',
      progressPercent: 100,
      status: 'failed',
      headline: 'A implementacao falhou antes de concluir a trilha tecnica.',
      notes: [error.message],
      ...getWorkstreamExecutionState(implementationPlanContent, 'integration_and_validation'),
    });
    await prisma.taskImplementation.update({
      where: { id: implementation.id },
      data: {
        status: 'failed',
        summary: error.message,
      },
    });
    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        logSummary: error.message,
      },
    });
    throw error;
  }

  return prisma.taskImplementation.findUnique({
    where: { id: implementation.id },
    include: {
      technicalSpecArtifact: true,
      implementationPlanArtifact: true,
      generatedApp: true,
      generatedFiles: true,
      runs: true,
    },
  });
}

function hasReusableImplementationPlan(implementation, generatedAppId) {
  if (!implementation) return false;

  return (
    implementation.status === 'planned' &&
    implementation.generatedAppId === generatedAppId &&
    Boolean(implementation.technicalSpecArtifact?.content) &&
    Boolean(implementation.implementationPlanArtifact?.content)
  );
}

export async function getTaskImplementationStatus(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const implementation = await prisma.taskImplementation.findFirst({
    where: { taskId: task.id },
    include: {
      technicalSpecArtifact: true,
      implementationPlanArtifact: true,
      generatedApp: true,
      generatedFiles: {
        orderBy: { createdAt: 'desc' },
      },
      runs: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (!implementation) return null;

  const reviewArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Review - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const fixPlanArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Fix Plan - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const specialistReviewArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Specialist Review - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const strategyArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Strategy - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const impactArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Impact Analysis - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const executionStateArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Execution State - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const repairScopeAssessmentArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Repair Scope Assessment - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const repairEnforcementArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Repair Enforcement - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const debugDiagnosisArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Debug Diagnosis - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const repairLearningArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Repair Learning - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const diffReviewArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Implementation Diff Review - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const buildReportArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Build Report - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const testReportArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Test Report - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const lintReportArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      title: `Lint Report - ${task.title}`,
      artifactScope: 'implementation',
      isCurrent: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const qualitySummary = buildImplementationQualitySummary({
    task,
    implementation: {
      ...implementation,
      currentExecutionStateArtifact: executionStateArtifact,
      currentRepairScopeAssessmentArtifact: repairScopeAssessmentArtifact,
      currentRepairEnforcementArtifact: repairEnforcementArtifact,
    },
    reviewArtifact,
    specialistReviewArtifact,
    buildReportArtifact,
    testReportArtifact,
    lintReportArtifact,
  });
  const benchmarkSummary = await buildImplementationBenchmarkSummary(
    implementation,
    parseJsonArtifactContent(implementation.technicalSpecArtifact),
    qualitySummary
  );
  const repairTelemetry = buildRepairTelemetrySummary({
    executionStateArtifact,
    repairScopeAssessmentArtifact,
    repairEnforcementArtifact,
    debugDiagnosisArtifact,
    repairLearningArtifact,
  });

  return {
    ...implementation,
    task: {
      uuid: task.uuid,
      title: task.title,
      status: task.status,
    },
    reviewArtifact,
    specialistReviewArtifact,
    fixPlanArtifact,
    strategyArtifact,
    impactArtifact,
    executionStateArtifact,
    repairScopeAssessmentArtifact,
    repairEnforcementArtifact,
    debugDiagnosisArtifact,
    repairLearningArtifact,
    diffReviewArtifact,
    buildReportArtifact,
    testReportArtifact,
    lintReportArtifact,
    qualitySummary: {
      ...qualitySummary,
      benchmark: benchmarkSummary,
    },
    autonomySummary: qualitySummary.autonomousGeneration,
    repairTelemetry,
  };
}

export async function getProjectImplementationOverview(projectUuid, userUuid = null) {
  const tasks = await listProjectTasks(projectUuid, {}, userUuid);
  const implementationStatuses = await Promise.all(
    tasks.map((task) =>
      getTaskImplementationStatus(task.uuid).catch(() => null)
    )
  );

  const implementations = implementationStatuses.filter(Boolean);
  const repairEnabled = implementations.filter((item) => item?.repairTelemetry);
  const autonomyEnabled = implementations.filter((item) => item?.autonomySummary);
  const numericAdherence = repairEnabled
    .map((item) => Number(item.repairTelemetry?.adherencePercent))
    .filter((value) => Number.isFinite(value));
  const numericAutonomy = autonomyEnabled
    .map((item) => Number(item.autonomySummary?.autonomyPercent))
    .filter((value) => Number.isFinite(value));

  const statusCounts = implementations.reduce((acc, implementation) => {
    const key = implementation.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const writeSetCounts = repairEnabled.reduce((acc, implementation) => {
    const key = implementation.repairTelemetry?.writeSetStatus || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const rootCauseCounts = repairEnabled.reduce((acc, implementation) => {
    const key = implementation.repairTelemetry?.rootCause || null;
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const executorCounts = repairEnabled.reduce((acc, implementation) => {
    const key = implementation.repairTelemetry?.nextExecutor || 'unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const specialistStatusCounts = autonomyEnabled.reduce((acc, implementation) => {
    const key = implementation.qualitySummary?.specialistReviewStatus || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const specialistCodeCounts = implementations.reduce((acc, implementation) => {
    const counts = summarizeReviewCodes(implementation.specialistReviewArtifact);
    for (const [key, count] of Object.entries(counts)) {
      acc[key] = (acc[key] || 0) + count;
    }
    return acc;
  }, {});
  const generationSourceCounts = autonomyEnabled.reduce((acc, implementation) => {
    const key = implementation.autonomySummary?.generationSource || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const rejectionReasonCounts = autonomyEnabled.reduce((acc, implementation) => {
    const rejectionReasons = implementation.autonomySummary?.rejectionReasons || {};
    for (const scope of Object.values(rejectionReasons)) {
      for (const reasons of Object.values(scope || {})) {
        for (const reason of Array.isArray(reasons) ? reasons : []) {
          acc[reason] = (acc[reason] || 0) + 1;
        }
      }
    }
    return acc;
  }, {});

  const withEscalation = repairEnabled.filter((item) => item.repairTelemetry?.escalated).length;
  const compliantCount = writeSetCounts.compliant || 0;
  const expandedCount = writeSetCounts.expanded || 0;
  const partialCount = writeSetCounts.partial || 0;
  const unscopedCount = writeSetCounts.unscoped || 0;
  const averageAdherencePercent =
    numericAdherence.length > 0
      ? Math.round(numericAdherence.reduce((sum, value) => sum + value, 0) / numericAdherence.length)
      : null;
  const averageAutonomyPercent =
    numericAutonomy.length > 0
      ? Math.round(numericAutonomy.reduce((sum, value) => sum + value, 0) / numericAutonomy.length)
      : null;
  const averageSpecialistScore = averageNullable(
    implementations.map((implementation) => implementation.qualitySummary?.specialistScore)
  );
  const operationalFocus = buildOperationalFocusSummary(implementations);
  const trendSummary = buildImplementationTrendSummary(implementations);

  return {
    projectUuid,
    totalTasks: tasks.length,
    totalImplementations: implementations.length,
    tasksWithRepairTelemetry: repairEnabled.length,
    tasksWithAutonomyTelemetry: autonomyEnabled.length,
    statusCounts,
    autonomySummary: {
      averageAutonomyPercent,
      llmPrimaryCount: generationSourceCounts.llm_primary || 0,
      hybridCount: generationSourceCounts.llm_primary_with_fallback || 0,
      fallbackFullCount: generationSourceCounts.fallback_full || 0,
      unknownCount: generationSourceCounts.unknown || 0,
    },
    specialistSummary: {
      averageSpecialistScore,
      approvedCount: specialistStatusCounts.approved || 0,
      needsAttentionCount: specialistStatusCounts.needs_attention || 0,
      failedCount: specialistStatusCounts.failed || 0,
      unknownCount: specialistStatusCounts.unknown || 0,
    },
    repairSummary: {
      compliantCount,
      expandedCount,
      partialCount,
      unscopedCount,
      escalatedCount: withEscalation,
      averageAdherencePercent,
      localRepairRatePercent: repairEnabled.length ? Math.round((compliantCount / repairEnabled.length) * 100) : null,
      escalatedRatePercent: repairEnabled.length ? Math.round((withEscalation / repairEnabled.length) * 100) : null,
    },
    trendSummary,
    topRootCauses: Object.entries(rootCauseCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([rootCause, count]) => ({ rootCause, count })),
    topAutonomousRejections: Object.entries(rejectionReasonCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count })),
    topSpecialistCodes: Object.entries(specialistCodeCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code, count })),
    generationSourceMix: Object.entries(generationSourceCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([generationSource, count]) => ({ generationSource, count })),
    executorMix: Object.entries(executorCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([executor, count]) => ({ executor, count })),
    operationalFocus,
  };
}

export async function reviewTaskImplementation(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const implementation = await getLatestTaskImplementation(task.id);

  if (!implementation?.technicalSpecArtifact || !implementation?.generatedApp) {
    throw new Error('A task ainda n?o possui implementa?o gerada para revisar.');
  }

  const run = await prisma.generatedAppRun.create({
    data: {
      uuid: randomUUID(),
      generatedAppId: implementation.generatedApp.id,
      taskImplementationId: implementation.id,
      runType: 'validation',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    const technicalSpec = normalizeTechnicalSpec(JSON.parse(implementation.technicalSpecArtifact.content), task);
    const { artifact, reviewReport, fixPlanArtifact } = await runImplementationReviewInternal({
      task,
      implementation,
      technicalSpec,
      generatedApp: implementation.generatedApp,
    });
    const { artifact: specialistReviewArtifact, reviewReport: specialistReviewReport } = await runImplementationSpecialistReviewInternal({
      task,
      implementation,
      technicalSpec,
      generatedApp: implementation.generatedApp,
    });

    const [buildReportArtifact, testReportArtifact, lintReportArtifact] = await Promise.all([
      prisma.taskArtifact.findFirst({
        where: {
          taskId: task.id,
          title: `Build Report - ${task.title}`,
          artifactScope: 'implementation',
          isCurrent: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.taskArtifact.findFirst({
        where: {
          taskId: task.id,
          title: `Test Report - ${task.title}`,
          artifactScope: 'implementation',
          isCurrent: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.taskArtifact.findFirst({
        where: {
          taskId: task.id,
          title: `Lint Report - ${task.title}`,
          artifactScope: 'implementation',
          isCurrent: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const qualitySummary = buildImplementationQualitySummary({
      task,
      implementation,
      reviewArtifact: artifact,
      specialistReviewArtifact,
      buildReportArtifact,
      testReportArtifact,
      lintReportArtifact,
    });
    const validationCompleted =
      qualitySummary.buildStatus === 'completed' &&
      qualitySummary.testStatus === 'completed' &&
      qualitySummary.lintStatus === 'completed';
    const approvedNow =
      reviewReport.summary.status === 'approved' &&
      specialistReviewReport.summary.status !== 'needs_attention' &&
      validationCompleted;

    if (approvedNow) {
      await prisma.taskImplementation.update({
        where: { id: implementation.id },
        data: {
          status: 'integrated',
          buildStatus: 'completed',
          testStatus: 'completed',
          summary: `Implementacao validada manualmente e aprovada para a task ${task.title}.`,
        },
      });

      await persistImplementationExecutionState(task, implementation, {
        phase: 'completed',
        phaseLabel: 'Integração concluída',
        progressPercent: 100,
        status: 'completed',
        headline: 'A feature foi revisada novamente e agora passou por todos os gates tecnicos.',
        notes: [
          `Review: ${reviewReport.summary.status}`,
          `Specialist: ${specialistReviewReport.summary.status}`,
          'Validation: completed',
        ],
        ...buildCompletedWorkstreamState(parseJsonArtifactContent(implementation.implementationPlanArtifact)),
      });
    }

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        logSummary: `Review manual executado para ${task.uuid} | estrutural=${reviewReport.summary.score} | specialist=${specialistReviewReport.summary.score}`,
      },
    });

    return {
      implementation: approvedNow
        ? await prisma.taskImplementation.findUnique({
            where: { id: implementation.id },
            include: {
              technicalSpecArtifact: true,
              implementationPlanArtifact: true,
              generatedApp: true,
              generatedFiles: true,
            },
          })
        : implementation,
      reviewArtifact: artifact,
      specialistReviewArtifact,
      fixPlanArtifact,
      reviewReport,
      specialistReviewReport,
    };
  } catch (error) {
    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        logSummary: error.message,
      },
    });
    throw error;
  }
}
