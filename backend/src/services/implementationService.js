import { randomUUID, createHash } from 'crypto';
import { exec } from 'child_process';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { resolveDomainTemplate } from '../templates/domains/index.js';
import { materializeFullstackTemplate, materializeFullstackTemplateSubset } from './generatedAppTemplateService.js';
import { generateImplementationUi } from './implementationAiService.js';
import { buildRuntimeAiEnvForUser } from './aiSettingsService.js';
import { getProjectArchitectureStatus } from './projectDataService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const GENERATED_PROJECTS_ROOT = path.join(REPO_ROOT, 'generated-projects');
const execAsync = promisify(exec);

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

function camelCase(value, fallback = 'generatedField') {
  const source = pascalCase(value, fallback);
  return source.charAt(0).toLowerCase() + source.slice(1);
}

function toImportPath(fromRelativePath, toRelativePath) {
  const fromDir = path.posix.dirname(fromRelativePath.replace(/\\/g, '/'));
  const toFile = toRelativePath.replace(/\\/g, '/');
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
    'packages/ui/package.json',
    'packages/ui/src/index.tsx',
    'packages/config/package.json',
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

  const writtenFiles = await materializeFullstackTemplateSubset({
    destinationRoot: generatedApp.rootPath,
    projectName: project.name,
    projectSlug: generatedApp.slug || slugify(project.slug || project.name, project.uuid),
    includeRelativeRoots: ['packages/ui', 'packages/config'],
  });

  if (writtenFiles.length) {
    await prisma.generatedFile.deleteMany({
      where: {
        generatedAppId: generatedApp.id,
        taskImplementationId: null,
        OR: [{ filePath: { startsWith: 'packages/ui/' } }, { filePath: { startsWith: 'packages/config/' } }],
      },
    });

    await prisma.generatedFile.createMany({
      data: writtenFiles.map((file) => ({
        generatedAppId: generatedApp.id,
        filePath: file.relativePath,
        fileType: file.fileType,
        changeType: 'created',
        checksum: file.checksum,
      })),
    });
  }

  return true;
}

async function removeFileIfExists(targetPath) {
  try {
    await rm(targetPath, { force: true });
  } catch {
    // Mantem a regeneracao idempotente quando o arquivo ja nao existe.
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
      panelRelationship: 'controle primeiro, historico depois',
      metricLabels: ['Cobertura', 'Risco', 'Governanca'],
      metricValues: ["isLoading ? 'Mapeando' : String(items.length || 0)", "isLoading ? 'Analisando' : 'Controlado'", "'Ativa'"],
      collectionMeta: "isLoading ? 'Sincronizando' : items.length ? `${items.length} perfil(is) monitorado(s)` : 'Governanca inicial'",
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
      metricValues: [`'${screenTemplate === 'settings' ? 'Preferencia' : 'Configuracao'}'`, "isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Inicial'", "'Agora'"],
      collectionMeta: "isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'",
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
      metricLabels: ['Triagem', 'Evidencias', 'Prioridade'],
      metricValues: ["isLoading ? 'Sincronizando' : 'Ativa'", "isLoading ? '...' : String(items.length || 0)", "'Alta'"],
      collectionMeta: "isLoading ? 'Sincronizando' : items.length ? `${items.length} evidencia(s) vinculada(s)` : 'Sem evidencias'",
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
      metricValues: ["isLoading ? 'Sincronizando' : String(items.length || 0)", "isLoading ? 'Atualizando' : 'Consolidada'", "'Agora'"],
      collectionMeta: "isLoading ? 'Atualizando' : `${items.length} insight(s)`",
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
      metricValues: ["isLoading ? '...' : String(items.length || 0)", "isLoading ? 'Sincronizando' : 'Em analise'", "'Rapida'"],
      collectionMeta: "isLoading ? 'Sincronizando' : `${items.length} item(ns) aguardando revisao`",
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
      metricValues: [`'${screenTemplate === 'workspace' ? 'Operacao' : 'Area'}'`, "isLoading ? 'Sincronizando' : 'Pronta'", "isLoading ? '...' : String(items.length || 0)"],
      collectionMeta: "isLoading ? 'Sincronizando' : `${items.length} registro(s)`",
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
      collectionMeta: "isLoading ? 'Sincronizando' : `${items.length} item(ns) prontos`",
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
      collectionMeta: "isLoading ? 'Sincronizando' : `${items.length} ativo(s) catalogado(s)`",
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
      metricValues: ["'Comercial'", "isLoading ? 'Sincronizando' : 'Configurado'", "'Agora'"],
      collectionMeta: "isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'",
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
      metricValues: ["'Ativo'", "isLoading ? 'Sincronizando' : 'Em curso'", "'Mantida'"],
      collectionMeta: "isLoading ? 'Sincronizando' : `${items.length} ponto(s) acompanhados`",
      emptyStateTone: 'Nenhum ponto de continuidade por enquanto. Esta area ganha vida conforme o fluxo principal evolui.',
    },
  };

  const fallback = profiles['structured-workspace'];
  return profiles[productMode] || fallback;
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
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    domainTemplate.productMode ||
    'structured-workspace';
  const productDirection = getProductModeDesignProfile(productMode, screenTemplate);
  const reuseHints = buildProjectMemoryReuseHints(technicalSpec.projectMemory, technicalSpec, task.title);

  return {
    taskTitle: task.title,
    summary: technicalSpec.summary,
    frontendRoute: technicalSpec.frontend?.suggestedRoute,
    screenTemplate,
    productMode,
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
      preferredScreenTemplate: reuseHints.preferredScreenTemplate || null,
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

function compactRepairContext(repairContext) {
  if (!repairContext) return null;

  return {
    attemptNumber: repairContext.attemptNumber,
    reviewStatus: repairContext.reviewStatus,
    reviewScore: repairContext.reviewScore,
    specialistReviewStatus: repairContext.specialistReviewStatus,
    specialistReviewScore: repairContext.specialistReviewScore,
    findings: (repairContext.findings || []).slice(0, 4).map((item) => ({
      code: item.code,
      severity: item.severity,
      filePath: item.filePath,
      message: truncateText(item.message, 160),
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
    { group: 'auth', aliases: ['conta', 'login', 'autenticacao', 'cadastro'] },
  ];

  return signals
    .filter((signal) => signal.aliases.some((alias) => title.includes(alias)))
    .map((signal) => ({
      group: signal.group,
      matchedInFeature: signal.aliases.some((alias) => feature.includes(alias) || route.includes(alias)),
    }));
}

function getExpectedDomainKeywords(domainKey = '') {
  const catalog = {
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

  if (!expected || !implemented || expected === implemented) {
    return Boolean(expected) && Boolean(implemented) ? expected === implemented : false;
  }

  const expectedBase = expected.split(/[-_/]/)[0];
  const implementedBase = implemented.split(/[-_/]/)[0];
  if (expectedBase && implementedBase && expectedBase === implementedBase) {
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
    if (implementedKeywords.has(keyword)) return true;
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

function buildRepairContext({ reviewReport, specialistReviewReport, validationSummary, attemptNumber }) {
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

  return {
    attemptNumber,
    reviewStatus: reviewReport?.summary?.status || 'unknown',
    reviewScore: reviewReport?.summary?.score ?? null,
    specialistReviewStatus: specialistReviewReport?.summary?.status || 'unknown',
    specialistReviewScore: specialistReviewReport?.summary?.score ?? null,
    findings,
    specialistFindings,
    validationStatus: validationSummary?.status || 'unknown',
    validationFailures,
    repairScope: inferRepairScope({ findings, specialistFindings, validationFailures }),
  };
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
  const findingsByLane = summarizeFindingsByLane(findings);
  const specialistFindingsByLane = summarizeFindingsByLane(specialistFindings);
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
    select: { id: true, uuid: true, name: true, slug: true, description: true, vision: true },
  });

  if (!project) {
    throw new Error('Projeto n?o encontrado.');
  }

  return project;
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
  const looksLikeAccessControl =
    (/\bpermiss/.test(titleNormalized) || /\brole\b|\broles\b|\bfunca/.test(titleNormalized)) &&
    (/\bacesso\b/.test(titleNormalized) || /\bperfil\b|\bperfis\b/.test(titleNormalized) || /\bseguranc/.test(titleNormalized));
  const looksLikeSupportAttachment =
    (/\banexo\b|\banexar\b|\barquivo\b|\bdocumento\b|\bcomprov/.test(titleNormalized) || /\banexo\b|\banexar\b|\bdocumento\b|\bcomprov/.test(normalized)) &&
    (/\bchamado\b|\bsuporte\b|\bticket\b/.test(titleNormalized) || /\bchamado\b|\bsuporte\b|\bticket\b/.test(normalized));
  const looksLikeNotificationPreference =
    /\bnotifica/.test(titleNormalized) &&
    /\be-?mail\b/.test(normalized) &&
    (/\batualizad/.test(normalized) || /\bchamado\b/.test(normalized) || /\balerta\b/.test(normalized));
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

  if (looksLikeSupportAttachment) {
    return {
      domainKey: 'support-ticket-attachments',
      entityName: 'SupportTicketAttachment',
      routeBase: '/api/support-ticket-attachments',
      frontendRoute: '/tickets/attachments',
      pageComponentName: 'SupportTicketAttachmentsPage',
      serviceName: 'SupportTicketAttachmentsService',
      submitLabel: 'Anexar Documento',
      navigationLabel: 'Anexos do Chamado',
      pageTitle: 'Envie documentos que destravam o atendimento',
      pageDescription: 'Associe comprovantes, notas e documentos fiscais ao chamado para acelerar a analise do suporte.',
      successMessage: 'Documento anexado com sucesso.',
      summary: 'Permite anexar documentos fiscais e comprobatórios ao abrir chamados de suporte para agilizar a triagem e o atendimento.',
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
        'Prote??o contra e-mails duplicados no fluxo incremental.',
      ],
      profileSummaryTitle: 'Checklist de cadastro',
      profileSummaryDescription: 'O fluxo precisa validar e-mail, senha e evitar duplicidade antes da cria??o da conta.',
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
      recordsTitle: 'Hist?rico de altera??es',
      recordsEmptyState: 'Nenhuma altera??o realizada at? o momento.',
      highlights: [
        'Nome obrigat?rio para exibi??o correta do perfil.',
        'Foto de perfil com valida??o de formato e limite de tamanho.',
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
  return resolveDomainTemplate(domainKey, technicalSpec);
}

async function enrichFrontendWithAi(task, technicalSpec, userUuid = null, repairContext = null, options = {}) {
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
    highlights: domainTemplate.highlights,
    recordsTitle: domainTemplate.recordsTitle,
    recordsEmptyState: domainTemplate.recordsEmptyState,
    profileSummaryTitle: domainTemplate.profileSummaryTitle,
    profileSummaryDescription: domainTemplate.profileSummaryDescription,
    domainTemplateKey: domainTemplate.templateKey,
  }));
  const uiGenerationContext = buildUiGenerationContext(task, technicalSpec, repairContext);

  try {
      const envOverrides = userUuid
        ? await buildRuntimeAiEnvForUser(userUuid, { agentName: 'implementation_architect' })
        : { AI_DISABLE_OLLAMA_FALLBACK: '0' };
      const aiResult = normalizeUiCopy(normalizeGeneratedCopy(await generateImplementationUi({
        ...uiGenerationContext,
      }, {
        envOverrides,
        bypassCache: Boolean(options.forceRefresh),
      })));

    return {
      ...technicalSpec,
      frontend: {
        ...technicalSpec.frontend,
        ...fallback,
        ...normalizeUiCopy(normalizeGeneratedCopy(aiResult)),
      },
      domain: {
        ...technicalSpec.domain,
        submitLabel: toAsciiUiText(aiResult?.submitLabel || technicalSpec.domain.submitLabel),
      },
    };
  } catch {
    return {
      ...technicalSpec,
      frontend: {
        ...technicalSpec.frontend,
        ...fallback,
      },
    };
  }
}

function inferBusinessRules(sourceText, actionSpec = null) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const rules = [];

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
    rules.push('As alteracoes de perfil devem ser registradas em historico para auditoria.');
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

  if (actionSpec?.domainKey === 'support-ticket-attachments') {
    scenarios.push({ code: 'missing_document_type', message: 'Selecione o tipo de documento antes de anexar o arquivo.' });
    scenarios.push({ code: 'missing_file_reference', message: 'Informe o arquivo ou link do comprovante antes de concluir o anexo.' });
    if (/\bdescricao\b|\bcontexto\b|\bdetalh/.test(normalized) || true) {
      scenarios.push({ code: 'missing_attachment_context', message: 'Descreva rapidamente o contexto do documento para apoiar a triagem.' });
    }
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

function buildPrismaFieldLine(field) {
  if (field.name === 'email') {
    return `  email     String   @unique @db.VarChar(190)`;
  }

  if (field.name === 'password') {
    return `  passwordHash String @db.VarChar(255)`;
  }

  return `  ${field.name.padEnd(9, ' ')} ${field.prismaType} @db.VarChar(190)`;
}

function buildFieldInitializer(field) {
  if (field.name === 'email') return `email: input.email.trim().toLowerCase()`;
  if (field.name === 'password') return `passwordHash: \`hashed:\${input.password}\``;
  return `${field.name}: input.${field.name}`;
}

function hasEncodingArtifacts(content) {
  return /[\u00C3\u00C2\u00E2\uFFFD]/.test(String(content || ''));
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
    actor: /\baluno\b/.test(normalized)
      ? 'student'
      : /\binfoprodutor\b/.test(normalized)
        ? 'creator'
        : 'user',
    scope: /\badmin\b|\badministrador\b/.test(normalized) ? 'admin' : 'self_service',
  };
}

function inferDomainName(actionSpec, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec.domainKey.startsWith('auth-')) return 'auth';
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
  return {
    classification: {
      domain: inferDomainName(actionSpec, `${task.title}\n${task.description || ''}`),
      intent: inferIntent(actionSpec, `${task.title}\n${task.description || ''}`),
      screenTemplate,
      productMode,
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
  const sourceText = `${task.title}\n${requirementsSource}\n${qaSource}\n${architectureSource}`;
  const actionSpec = inferActionSpec(task, sourceText);
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

function buildImplementationPlan(task, generatedApp, technicalSpec) {
  const screenTemplate = technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud';
  const reuseHints = buildProjectMemoryReuseHints(technicalSpec.projectMemory, technicalSpec, task.title);
  const sharedContractPath = technicalSpec.shared.contractPath;
  const backendFiles = [
    `${technicalSpec.backend.modulePath}/service.ts`,
    `${technicalSpec.backend.modulePath}/router.ts`,
    `${technicalSpec.backend.modulePath}/index.ts`,
    'apps/api/src/server.ts',
  ];
  const frontendFiles = [
    `${technicalSpec.frontend.featurePath}/page.tsx`,
    `${technicalSpec.frontend.featurePath}/service.ts`,
    `${technicalSpec.frontend.featurePath}/index.ts`,
    'apps/web/src/App.tsx',
  ];
  const persistenceFiles = [technicalSpec.database.schemaPath];
  const documentationFiles = [`docs/implementations/${technicalSpec.featureKey}.md`];

  return {
    version: 3,
    taskUuid: task.uuid,
    generatedAppUuid: generatedApp.uuid,
    generatedAppRoot: generatedApp.rootPath,
    executionModel: 'goal_driven_incremental',
    objective: technicalSpec.implementationObjective,
    reuseGuidance: reuseHints,
    steps: [
      'Ler o contexto atual do monorepo gerado',
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
  const sharedImportPath = toImportPath(
    `${technicalSpec.backend.modulePath}/service.ts`,
    technicalSpec.shared.contractPath
  );
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
    .map((field) => {
      if (field.name === 'password') {
        return `  password: String(payload.password || ''),`;
      }
      if (field.name === 'email') {
        return `  email: String(payload.email || ''),`;
      }
      return `  ${field.name}: String(payload.${field.name} || ''),`;
    })
    .join('\n');
  const seedRequestAssignments = technicalSpec.domain.fields
    .map((field) => `      ${field.name}: '${escapeTemplate(field.sampleValue || field.defaultValue || '')}',`)
    .join('\n');
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
  const uniqueEmailRule = technicalSpec.domain.fields.some((field) => field.name === 'email')
    ? `\n    const normalizedEmail = input.email.trim().toLowerCase();\n    const duplicated = records.find((record) => record.email === normalizedEmail);\n    if (duplicated) {\n      throw new Error('E-mail ja cadastrado.');\n    }\n`
    : '';
  const emailValidationRule = technicalSpec.domain.fields.some((field) => field.name === 'email')
    ? `\n    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.email)) {\n      throw new Error('E-mail invalido.');\n    }\n`
    : '';
  const passwordValidationRule = technicalSpec.domain.fields.some((field) => field.name === 'password')
    ? `\n    const password = input.password || '';\n    const hasStrongPassword = password.length >= 8 && /[A-Z]/.test(password) && /\\d/.test(password);\n    if (!hasStrongPassword) {\n      throw new Error('Senha invalida.');\n    }\n`
    : '';
  const businessRulesComment = technicalSpec.businessRules.length
    ? technicalSpec.businessRules.map((rule) => ` * - ${rule}`).join('\n')
    : ' * - Regras de negocio basicas aplicadas no fluxo incremental.';

  return [
    {
      relativePath: technicalSpec.shared.contractPath,
      content: `export interface ${technicalSpec.shared.requestContractName} {\n${requestShape}\n}\n\nexport interface ${technicalSpec.shared.responseContractName} {\n  id: string;\n${responseShape}\n  status: 'draft' | 'active';\n  createdAt: string;\n}\n\nexport interface ${technicalSpec.shared.listContractName} {\n  items: ${technicalSpec.shared.responseContractName}[];\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/service.ts`,
      content: `import { randomUUID } from 'crypto';\nimport type { ${technicalSpec.shared.listContractName}, ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nconst records: ${technicalSpec.shared.responseContractName}[] = [];\n\n/**\n${businessRulesComment}\n */\nexport class ${technicalSpec.backend.serviceName} {\n  list(): ${technicalSpec.shared.listContractName} {\n    return { items: records };\n  }\n\n  create(input: ${technicalSpec.shared.requestContractName}): ${technicalSpec.shared.responseContractName} {${emailValidationRule}${passwordValidationRule}${uniqueEmailRule}\n    const item: ${technicalSpec.shared.responseContractName} = {\n      id: randomUUID(),\n${responseFieldAssignments}\n      status: 'active',\n      createdAt: new Date().toISOString(),\n    };\n\n    records.push(item);\n    return item;\n  }\n\n  buildSeedFromTask(): ${technicalSpec.shared.requestContractName} {\n    return {\n${seedRequestAssignments}\n    };\n  }\n}\n\nexport const ${technicalSpec.backend.serviceInstanceName} = new ${technicalSpec.backend.serviceName}();\nrecords.push(${technicalSpec.backend.serviceInstanceName}.create(${technicalSpec.backend.serviceInstanceName}.buildSeedFromTask()));\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/router.ts`,
      content: `import { Router } from 'express';\nimport type { ${technicalSpec.shared.requestContractName} } from '${sharedImportPath}';\nimport { ${technicalSpec.backend.serviceInstanceName} } from './service';\n\nexport const ${technicalSpec.backend.routerName} = Router();\n\n${technicalSpec.backend.routerName}.get('/', (_req, res) => {\n  res.json(${technicalSpec.backend.serviceInstanceName}.list());\n});\n\n${technicalSpec.backend.routerName}.post('/', (req, res) => {\n  try {\n    const payload = req.body || {};\n    const input: ${technicalSpec.shared.requestContractName} = {\n${routerRequestAssignments}\n    };\n    const created = ${technicalSpec.backend.serviceInstanceName}.create(input);\n    res.status(201).json(created);\n  } catch (error) {\n    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });\n  }\n});\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.backend.modulePath}/index.ts`,
      content: `export { ${technicalSpec.backend.routerName} } from './router';\nexport { ${technicalSpec.backend.serviceInstanceName} } from './service';\n`,
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
  const productDirection = getProductModeDesignProfile(productMode, layout);
  const accent = productDirection.accent || 'teal';
  const isCrudLayout = layout === 'crud';
  const isDashboardLayout = layout === 'dashboard';
  const isWorkspaceLayout = layout === 'workspace';
  const isWizardLayout = layout === 'wizard';
  const isSettingsLayout = layout === 'settings';
  const shouldRenderCollectionPanel = isCrudLayout || isDashboardLayout || isWorkspaceLayout;
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
        ? "isLoading ? 'Sincronizando' : `${items.length} item(ns) na fila`"
        : "`${items.length} registro(s)`"))
    : isWizardLayout
      ? "isLoading ? 'Preparando' : 'Proximo passo'"
      : "isLoading ? 'Sincronizando' : items.length ? 'Configurado' : 'Ajuste inicial'";
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
                    ? 'Item pronto para consulta'
                    : isDashboardLayout
                      ? 'Indicador disponivel para consulta'
                      : 'Registro disponivel'
                )}')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
                {String(item.status || 'active')}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{String(item.createdAt || 'Agora')}</span>
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
          <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>Canal principal</strong>
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

  return [
    {
      relativePath: `${technicalSpec.frontend.featurePath}/service.ts`,
      content: `import type { ${technicalSpec.shared.listContractName}, ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nexport async function fetch${entityName}Items(): Promise<${technicalSpec.shared.responseContractName}[]> {\n  const response = await fetch('${technicalSpec.backend.routeBase}');\n  const data: ${technicalSpec.shared.listContractName} = await response.json();\n  return data.items || [];\n}\n\nexport async function create${entityName}(input: ${technicalSpec.shared.requestContractName}): Promise<${technicalSpec.shared.responseContractName}> {\n  const response = await fetch('${technicalSpec.backend.routeBase}', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(input),\n  });\n\n  if (!response.ok) {\n    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));\n    throw new Error(error.message || 'Falha ao criar registro.');\n  }\n\n  return response.json();\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      content: `import { useEffect, useState } from 'react';\nimport type { FormEvent } from 'react';\nimport type { ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\nimport { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '${uiImportPath}';\nimport { create${entityName}, fetch${entityName}Items } from './service';\n\nconst initialForm: ${technicalSpec.shared.requestContractName} = {\n${initialStateEntries}\n};\n\nexport function ${technicalSpec.frontend.pageComponentName}() {\n  const [items, setItems] = useState<${technicalSpec.shared.responseContractName}[]>([]);\n  const [form, setForm] = useState<${technicalSpec.shared.requestContractName}>(initialForm);\n  const [feedback, setFeedback] = useState('');\n  const [errorMessage, setErrorMessage] = useState('');\n  const [isLoading, setIsLoading] = useState(true);\n  const [isSubmitting, setIsSubmitting] = useState(false);\n\n  useEffect(() => {\n    fetch${entityName}Items()\n      .then(setItems)\n      .catch(() => setItems([]))\n      .finally(() => setIsLoading(false));\n  }, []);\n\n  async function handleSubmit(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    setFeedback('');\n    setErrorMessage('');\n    setIsSubmitting(true);\n\n    try {\n      const created = await create${entityName}({\n${payloadObject}\n      });\n      setItems((current) => [created, ...current]);\n      setForm(initialForm);\n      setFeedback('${escapeTemplate(technicalSpec.domain.successMessage)}');\n    } catch (error) {\n      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');\n    } finally {\n      setIsSubmitting(false);\n    }\n  }\n\n  return (\n    <FeatureWorkbench\n      accent="${accent}"\n      productMode="${productMode}"\n      eyebrow="${escapeTemplate(technicalSpec.frontend.heroEyebrow || technicalSpec.frontend.navigationLabel || technicalSpec.entityName)}"\n      title="${escapeTemplate(technicalSpec.frontend.heroTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"\n      description="${escapeTemplate(technicalSpec.frontend.heroDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"\n      metrics={${metricsExpression}}\n      highlights={${JSON.stringify(highlights.length ? highlights : ['Experiencia preparada para uma operacao mais clara e confiavel.'])}}\n      formTitle="${escapeTemplate(technicalSpec.frontend.formCardTitle || technicalSpec.frontend.pageTitle || technicalSpec.entityName)}"\n      formDescription="${escapeTemplate(technicalSpec.frontend.formCardDescription || technicalSpec.frontend.pageDescription || technicalSpec.summary)}"\n      form={\n        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>\n${inputBlocks}\n          <PrimaryButton type="submit" accent="${accent}">\n            {isSubmitting ? 'Processando...' : '${escapeTemplate(technicalSpec.domain.submitLabel)}'}\n          </PrimaryButton>\n\n          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}\n          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}\n        </form>\n      }\n${secondaryPanelBlock}\n    </FeatureWorkbench>\n  );\n}\n`,
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
  const files = frontendFeatureFiles(task, technicalSpec);

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
      status: { in: ['planned', 'in_progress', 'integrated'] },
      technicalSpecArtifactId: { not: null },
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

async function cleanupImplementationFiles(generatedAppRoot, implementation) {
  const filePaths = [...new Set((implementation?.generatedFiles || []).map((file) => file.filePath))];

  for (const filePath of filePaths) {
    await removeFileIfExists(path.join(generatedAppRoot, filePath));
  }

  if (implementation?.id) {
    await prisma.generatedFile.deleteMany({
      where: { taskImplementationId: implementation.id },
    });
  }
}

async function updateApiServer(generatedAppRoot, routeSpecs, appSlug = 'generated-app') {
  const uniqueRouteSpecs = Array.from(
    new Map(routeSpecs.map((spec) => [`${spec.featureKey}:${spec.backend.routeBase}`, spec])).values()
  );
  const serverPath = path.join(generatedAppRoot, 'apps/api/src/server.ts');
  const importLines = uniqueRouteSpecs
    .map((spec) => `import { ${spec.backend.routerName} } from './modules/${spec.featureKey}/index'`)
    .join('\n');
  const useLines = uniqueRouteSpecs
    .map((spec) => `app.use('${spec.backend.routeBase}', ${spec.backend.routerName})`)
    .join('\n');

  const content = `import express from 'express'\nimport cors from 'cors'\n${importLines ? `${importLines}\n` : ''}\nconst app = express()\napp.use(cors())\napp.use(express.json())\n\napp.get('/health', (_req, res) => {\n  res.json({ status: 'ok', app: '${appSlug}' })\n})\n\n${useLines}\n\napp.listen(3001, () => {\n  console.log('API running on 3001')\n})\n`;

  await writeText(serverPath, content);

  return {
    relativePath: 'apps/api/src/server.ts',
    content,
    fileType: 'ts',
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
    ...(parsed.scripts || {}),
  };
  parsed.dependencies = parsed.dependencies || {};
  parsed.dependencies.cors = parsed.dependencies.cors || '^2.8.5';
  parsed.dependencies.express = parsed.dependencies.express || '^4.18.2';
  parsed.devDependencies = parsed.devDependencies || {};
  parsed.devDependencies['@types/cors'] = parsed.devDependencies['@types/cors'] || '^2.8.17';
  parsed.devDependencies['@types/express'] = parsed.devDependencies['@types/express'] || '^5.0.1';
  parsed.devDependencies['@types/node'] = parsed.devDependencies['@types/node'] || '^22.10.2';
  parsed.devDependencies.tsx = parsed.devDependencies.tsx || '^4.19.0';
  parsed.devDependencies.typescript = parsed.devDependencies.typescript || '^5.6.0';

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
    ...(parsed.scripts || {}),
  };
  parsed.dependencies = parsed.dependencies || {};
  parsed.dependencies.react = parsed.dependencies.react || '^18.2.0';
  parsed.dependencies['react-dom'] = parsed.dependencies['react-dom'] || '^18.2.0';
  if (!parsed.dependencies['react-router-dom']) {
    parsed.dependencies['react-router-dom'] = '^6.28.0';
  }
  parsed.devDependencies = parsed.devDependencies || {};
  parsed.devDependencies['@types/react'] = parsed.devDependencies['@types/react'] || '^18.3.12';
  parsed.devDependencies['@types/react-dom'] = parsed.devDependencies['@types/react-dom'] || '^18.3.1';
  parsed.devDependencies['@vitejs/plugin-react'] = parsed.devDependencies['@vitejs/plugin-react'] || '^4.2.0';
  parsed.devDependencies.typescript = parsed.devDependencies.typescript || '^5.6.0';
  parsed.devDependencies.vite = parsed.devDependencies.vite || '^5.4.0';

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
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
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

async function ensureWorkspaceFoundationFiles(generatedAppRoot, projectName) {
  return [
    await updateRootPackageJson(generatedAppRoot),
    await updateRootTsconfigBase(generatedAppRoot),
    await updateApiPackageJson(generatedAppRoot),
    await updateApiTsconfig(generatedAppRoot),
    await updateWebPackageJson(generatedAppRoot),
    await updateWebIndexHtml(generatedAppRoot, projectName),
    await updateWebMainEntry(generatedAppRoot),
    await updateWebTsconfig(generatedAppRoot),
  ];
}

function buildSyntheticTaskFromSpec(technicalSpec) {
  return {
    title: technicalSpec.taskTitle || technicalSpec.frontend?.pageTitle || technicalSpec.entityName || 'Feature gerada',
    uuid: technicalSpec.taskUuid || technicalSpec.featureKey || randomUUID(),
  };
}

async function ensureValidationScripts(generatedAppRoot) {
  const lintContent = `import { readFile, readdir } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function listFeaturePages() {\n  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');\n  try {\n    const entries = await readdir(featuresRoot, { withFileTypes: true });\n    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(featuresRoot, entry.name, 'page.tsx'));\n  } catch {\n    return [];\n  }\n}\n\nfunction collectDuplicateLines(content, predicate) {\n  const lines = String(content || '')\n    .split(/\\r?\\n/)\n    .map((line) => line.trim())\n    .filter(Boolean)\n    .filter((line) => (predicate ? predicate(line) : true));\n\n  const counts = new Map();\n  for (const line of lines) {\n    counts.set(line, (counts.get(line) || 0) + 1);\n  }\n\n  return Array.from(counts.entries()).filter(([, count]) => count > 1);\n}\n\nasync function readSafe(filePath) {\n  try {\n    return await readFile(filePath, 'utf8');\n  } catch {\n    return '';\n  }\n}\n\nconst failures = [];\nconst genericFallbackPattern = /Campo principal da feature gerada|Informe o valor principal/;\nconst genericUxCopyPattern = /Nenhum dado exibido ainda\\.|Validacao automatica dos campos antes do envio\\.|Feedback imediato em caso de sucesso ou erro\\.|Conclua esta etapa/;\nconst basicWebShellPattern = /Frontend base gerado pela AI Software Factory|Bem-vindo ao .*?\\.<\\/p>|fontFamily: 'sans-serif', padding: 24/;\n\nconst appContent = await readSafe(path.join(root, 'apps', 'web', 'src', 'App.tsx'));\nconst serverContent = await readSafe(path.join(root, 'apps', 'api', 'src', 'server.ts'));\nconst hasPremiumShellSignals =\n  appContent.includes('AppFrame') &&\n  appContent.includes('AppHeader') &&\n  appContent.includes('StudioHome') &&\n  appContent.includes('MetricRow') &&\n  appContent.includes('SurfaceCard') &&\n  appContent.includes('function HomePage()') &&\n  appContent.includes('Resumo do workspace');\n\nfor (const [line, count] of collectDuplicateLines(appContent, (line) => line.startsWith('import ') || line.includes(\"path: '\"))) {\n  failures.push(\`App.tsx possui linha duplicada \${count}x: \${line}\`);\n}\n\nfor (const [line, count] of collectDuplicateLines(serverContent, (line) => line.startsWith('import ') || line.startsWith('app.use('))) {\n  failures.push(\`server.ts possui linha duplicada \${count}x: \${line}\`);\n}\n\nif (basicWebShellPattern.test(appContent) || !hasPremiumShellSignals) {\n  failures.push('App.tsx ainda usa um shell basico e precisa de uma home estruturada com navegacao premium.');\n}\n\nfor (const pagePath of await listFeaturePages()) {\n  const pageContent = await readSafe(pagePath);\n  if (genericFallbackPattern.test(pageContent)) {\n    failures.push(\`\${path.relative(root, pagePath)} ainda contem textos genericos de fallback.\`);\n  }\n  if (genericUxCopyPattern.test(pageContent)) {\n    failures.push(\`\${path.relative(root, pagePath)} ainda contem copy generica ou placeholders de UX.\`);\n  }\n}\n\nif (failures.length) {\n  console.error('Lint do projeto gerado falhou.\\n');\n  for (const failure of failures) {\n    console.error(\`- \${failure}\`);\n  }\n  process.exit(1);\n}\n\nconsole.log('Lint do projeto gerado concluido sem problemas.');\n`;
  const testContent = `import { access, readFile } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function assertFile(relativePath) {\n  try {\n    await access(path.join(root, relativePath));\n  } catch {\n    throw new Error(\`Arquivo obrigat?rio ausente: \${relativePath}\`);\n  }\n}\n\nasync function readSafe(relativePath) {\n  return readFile(path.join(root, relativePath), 'utf8');\n}\n\nfor (const file of ['apps/api/src/server.ts', 'apps/web/src/App.tsx', 'prisma/schema.prisma']) {\n  await assertFile(file);\n}\n\nconst serverContent = await readSafe('apps/api/src/server.ts');\nconst appContent = await readSafe('apps/web/src/App.tsx');\nconst schemaContent = await readSafe('prisma/schema.prisma');\n\nif (!serverContent.includes(\"app.get('/health'\")) {\n  throw new Error('API sem rota /health registrada.');\n}\n\nif (!appContent.includes(\"path: '/'\")) {\n  throw new Error('Frontend sem rota Home registrada.');\n}\n\nif (!schemaContent.includes('model ')) {\n  throw new Error('Schema Prisma sem nenhum model.');\n}\n\nconsole.log('Smoke tests do projeto gerado conclu?dos com sucesso.');\n`;

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

async function updateWebApp(generatedAppRoot, routeSpecs, projectName) {
  const uniqueRouteSpecs = Array.from(
    new Map(routeSpecs.map((spec) => [`${spec.featureKey}:${spec.frontend.suggestedRoute}`, spec])).values()
  );
  const appPath = path.join(generatedAppRoot, 'apps/web/src/App.tsx');
  const importLines = uniqueRouteSpecs
    .map((spec) => `import { ${spec.frontend.pageComponentName} } from './features/${spec.featureKey}/index'`)
    .join('\n');
  const shellImport = `import { AppFrame, AppHeader, MetricRow, SidebarNav, StudioHome, SurfaceCard } from '../../../packages/ui/src/index.tsx'`;
  const routeLines = uniqueRouteSpecs
    .map(
      (spec) =>
        `  { path: '${spec.frontend.suggestedRoute}', label: '${escapeTemplate(spec.frontend.navigationLabel || spec.entityName)}', render: () => <${spec.frontend.pageComponentName} /> },`
    )
    .join('\n');

  const content = `${shellImport}\n${importLines ? `\n${importLines}\n` : '\n'}const routes = [\n  { path: '/', label: 'Inicio', render: () => <HomePage /> },\n${routeLines}\n]\n\nfunction HomePage() {\n  const productAreas = routes.filter((route) => route.path !== '/')\n\n  return (\n    <div style={{ display: 'grid', gap: 20 }}>\n      <StudioHome title="${escapeTemplate(projectName)}" routes={productAreas} />\n      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' }}>\n        <SurfaceCard\n          title="Resumo do workspace"\n          description="Acompanhe a base gerada, as areas prontas para evolucao e a proxima frente operacional do produto."\n          meta={\`\${productAreas.length} modulo(s)\`}\n        >\n          <MetricRow\n            items={[\n              { label: 'Modulos ativos', value: String(productAreas.length) },\n              { label: 'Interface', value: 'Profissional' },\n              { label: 'Base', value: 'Web + API' },\n            ]}\n          />\n        </SurfaceCard>\n        <SurfaceCard\n          title="Fila de evolucao"\n          description="Escolha um modulo para continuar a implementacao incremental com contratos, backend e experiencia conectados."\n          meta="Fluxo guiado"\n        >\n          <div style={{ display: 'grid', gap: 12 }}>\n            {productAreas.map((route) => (\n              <a\n                key={route.path}\n                href={route.path}\n                style={{\n                  padding: '16px 18px',\n                  borderRadius: 18,\n                  border: '1px solid #dbe4ee',\n                  background: '#f8fafc',\n                  textDecoration: 'none',\n                  color: '#0f172a',\n                  fontWeight: 700,\n                }}\n              >\n                {route.label}\n              </a>\n            ))}\n          </div>\n        </SurfaceCard>\n      </div>\n    </div>\n  )\n}\n\nexport default function App() {\n  const currentPath = window.location.pathname\n  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]\n\n  return (\n    <AppFrame>\n      <AppHeader title={activeRoute.label} routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />\n      <div style={{ display: 'grid', gridTemplateColumns: '234px minmax(0, 1fr)' }}>\n        <SidebarNav routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />\n        <div style={{ padding: 18 }}>\n          {activeRoute.render()}\n        </div>\n      </div>\n    </AppFrame>\n  )\n}\n`;

  await writeText(appPath, content);

  return {
    relativePath: 'apps/web/src/App.tsx',
    content,
    fileType: 'tsx',
  };
}

async function updatePrismaSchema(generatedAppRoot, technicalSpec) {
  const schemaPath = path.join(generatedAppRoot, technicalSpec.database.schemaPath);
  let content = await readText(schemaPath);
  const fieldLines = technicalSpec.database.fields.map((field) => buildPrismaFieldLine(field)).join('\n');
  const modelBlock = `model ${technicalSpec.database.modelName} {\n  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt\n${fieldLines}\n  status    String   @default("draft") @db.VarChar(40)\n  createdAt DateTime @default(now()) @db.DateTime(0)\n  updatedAt DateTime @updatedAt @db.DateTime(0)\n}\n`;

  if (!content.includes(`model ${technicalSpec.database.modelName} {`)) {
    content = `${content.trim()}\n\n${modelBlock}`;
  }

  content = `${content.trim()}\n`;
  await writeText(schemaPath, content);

  return {
    relativePath: technicalSpec.database.schemaPath,
    content,
    fileType: 'prisma',
  };
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

async function runGeneratedProjectValidationSuite({ task, implementation, generatedApp }) {
  const reports = [];
  const hasNodeModules = await pathExists(path.join(generatedApp.rootPath, 'node_modules'));

  if (!hasNodeModules) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, 'install'));
  } else {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, 'install'));
  }

  for (const scriptName of ['lint', 'test', 'build:api', 'build:web']) {
    reports.push(await runGeneratedProjectCommand(generatedApp.rootPath, scriptName));
  }

  const installReport = reports.find((item) => item.scriptName === 'install');
  const lintReport = reports.find((item) => item.scriptName === 'lint');
  const testReport = reports.find((item) => item.scriptName === 'test');
  const buildApiReport = reports.find((item) => item.scriptName === 'build:api');
  const buildWebReport = reports.find((item) => item.scriptName === 'build:web');

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
        reports: [installReport, buildApiReport, buildWebReport].filter(Boolean),
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
    status: reports.every((report) => report.status === 'completed') ? 'completed' : 'failed',
    installStatus: installReport?.status || 'skipped',
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
      action: 'Ajustar o arquivo para alinhar a implementa??o ao structured spec e rodar review novamente.',
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
    /Nenhum dado exibido ainda\.|Validacao automatica dos campos antes do envio\.|Feedback imediato em caso de sucesso ou erro\.|Conclua esta etapa/;
  const basicWebShellPattern =
    /Frontend base gerado pela AI Software Factory|Bem-vindo ao .*?\.<\/p>|fontFamily: 'sans-serif', padding: 24/;
  const hasPremiumShellSignals =
    webAppContent.includes('AppFrame') &&
    webAppContent.includes('AppHeader') &&
    webAppContent.includes('StudioHome') &&
    webAppContent.includes('function HomePage()') &&
    webAppContent.includes('MetricRow') &&
    webAppContent.includes('SurfaceCard') &&
    webAppContent.includes('Resumo do workspace');
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
  const productMode =
    technicalSpec.frontend?.productMode ||
    technicalSpec.architecture?.productMode ||
    technicalSpec.structured?.classification?.productMode ||
    '';
  const usesFeatureWorkbench = pageContent.includes('FeatureWorkbench');
  const usesFeaturePage = pageContent.includes('FeaturePage');
  const hasExplicitLayout = pageContent.includes(`layout="${screenTemplate}"`);
  const hasExplicitProductMode = productMode ? pageContent.includes(`productMode="${productMode}"`) : false;
  const usesSharedFeatureShell = usesFeatureWorkbench || usesFeaturePage;

  if (!hasExplicitLayout && !(usesFeatureWorkbench && hasExplicitProductMode)) {
    findings.push({
      severity: 'high',
      code: 'specialist_screen_template_mismatch',
      category: 'quality',
      filePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      message: `A tela nao aplicou explicitamente o layout ${screenTemplate} nem declarou um product mode compativel com o shell compartilhado.`,
    });
  }

  if (!usesSharedFeatureShell || !pageContent.includes('FieldGroup') || !pageContent.includes('PrimaryButton')) {
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

  const semanticSignals = extractSemanticSignals(task.title, technicalSpec.featureKey, technicalSpec.backend.routeBase);
  if (semanticSignals.some((signal) => !signal.matchedInFeature)) {
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

  const expectedDomain = technicalSpec.structured?.classification?.domain || technicalSpec.featureKey;
  const implementedDomain = inferImplementedDomain(technicalSpec.featureKey, technicalSpec.backend.routeBase);
  const domainAligned = areDomainKeysAligned(expectedDomain, implementedDomain);
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
        repairContext: compactRepairContext(repairContext),
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

async function materializeImplementationFiles({ task, implementation, technicalSpec, generatedApp, workstreamIds = null }) {
  const routeSpecs = await getIntegratedTechnicalSpecs(generatedApp.id, technicalSpec);
  const featureFiles = Array.from(
    new Map(
      routeSpecs
        .flatMap((spec) => {
          const syntheticTask = buildSyntheticTaskFromSpec(spec);
          return [
            ...buildBackendModuleFilesFromTemplate(syntheticTask, spec).map((file) => ({
              ...file,
              lane: 'backend',
              workstreamId: 'backend_module',
            })),
            ...buildFrontendFeatureFilesFromTemplate(syntheticTask, spec).map((file) => ({
              ...file,
              lane: 'frontend',
              workstreamId: 'frontend_feature',
            })),
          ];
        })
        .map((file) => [file.relativePath.replace(/\\/g, '/'), file])
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
      content: `# ${task.title}\n\nTask UUID: ${task.uuid}\n\n## Resumo\nFeature integrada no baseline full stack pos-refinamento.\n\n## Template de tela\n- ${technicalSpec.architecture?.screenTemplate || technicalSpec.structured?.classification?.screenTemplate || 'crud'}\n\n## Rotas\n- Frontend: ${technicalSpec.frontend.suggestedRoute}\n- Backend: ${technicalSpec.backend.routeBase}\n\n## Stack e arquitetura\n${(technicalSpec.architecture?.sourceSummary?.stack || []).map((line) => `- ${line}`).join('\n') || '- Sem resumo de stack extraido.'}\n\n## Modulos e limites\n${(technicalSpec.architecture?.sourceSummary?.modules || []).map((line) => `- ${line}`).join('\n') || '- Sem resumo de modulos extraido.'}\n`,
      fileType: 'md',
      lane: 'shared',
      workstreamId: 'persistence_and_docs',
    },
    {
      ...(await updateApiServer(generatedApp.rootPath, routeSpecs, generatedApp.slug)),
      lane: 'backend',
      workstreamId: 'backend_module',
    },
    {
      ...(await updateWebApp(generatedApp.rootPath, routeSpecs, task.project.name)),
      lane: 'frontend',
      workstreamId: 'frontend_feature',
    },
    {
      ...(await updatePrismaSchema(generatedApp.rootPath, technicalSpec)),
      lane: 'shared',
      workstreamId: 'persistence_and_docs',
    },
  ];

  const selectedFiles = workstreamIds?.length
    ? generatedFiles.filter((file) => workstreamIds.includes(file.workstreamId))
    : generatedFiles;

  if (selectedFiles.length) {
    await prisma.generatedFile.deleteMany({
      where: {
        taskImplementationId: implementation.id,
        filePath: { in: selectedFiles.map((file) => file.relativePath.replace(/\\/g, '/')) },
      },
    });

    for (const file of selectedFiles) {
      await writeText(path.join(generatedApp.rootPath, file.relativePath), file.content);
    }

    await prisma.generatedFile.createMany({
      data: selectedFiles.map((file) => ({
        generatedAppId: generatedApp.id,
        taskImplementationId: implementation.id,
        filePath: file.relativePath.replace(/\\/g, '/'),
        fileType: file.fileType,
        changeType: 'created',
        checksum: sha(file.content),
      })),
    });
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

  await prisma.generatedAppRun.update({
    where: { id: reviewRun.id },
    data: {
      status:
        reviewReport.summary.status === 'approved' && specialistReviewReport.summary.status === 'approved'
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

  if (reviewReport.summary.status !== 'approved' || specialistReviewReport.summary.status !== 'approved' || validationSuite.summary.status !== 'completed') {
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

    if (existing) {
      await prisma.generatedFile.deleteMany({ where: { generatedAppId: app.id, taskImplementationId: null } });
      await prisma.generatedAppModule.deleteMany({ where: { generatedAppId: app.id } });
    }

    await prisma.generatedFile.createMany({
      data: writtenFiles.map((file) => ({
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

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        logSummary: `Template base criado em ${destinationRoot}`,
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
  technicalSpec = await enrichFrontendWithAi(task, technicalSpec, runtimeUserUuid, null, options);
  const technicalSpecArtifact = await createCurrentArtifact(
    task.id,
    `Technical Spec - ${task.title}`,
    JSON.stringify(technicalSpec, null, 2),
    'implementation_architect'
  );

  const plan = buildImplementationPlan(task, generatedApp, technicalSpec);
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

  const implementation = existingImplementation
    ? await prisma.taskImplementation.update({
        where: { id: existingImplementation.id },
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
        in: [technicalSpecArtifact.id, planArtifact.id, strategyArtifact.id, impactArtifact.id],
      },
    },
    data: {
      taskImplementationId: implementation.id,
      artifactScope: 'implementation',
    },
  });

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

  let implementation = await getLatestTaskImplementation(task.id);

  if (options.forceRefresh || !hasReusableImplementationPlan(implementation, generatedApp.id)) {
    implementation = await planTaskImplementation(taskUuid, runtimeUserUuid, options);
  }

  const implementationPlanContent = parseJsonArtifactContent(implementation?.implementationPlanArtifact);

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
        throw new Error(`A implementacao incremental do ${failedLane} falhou em ${failedScript}.`);
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

    for (let attemptIndex = 1; attemptIndex <= maxRepairAttempts; attemptIndex += 1) {
      const cyclePassed =
        cycleResult.reviewReport.summary.status === 'approved' &&
        cycleResult.specialistReviewReport.summary.status === 'approved' &&
        cycleResult.validationSuite.summary.status === 'completed';

      if (cyclePassed) {
        break;
      }

      const repairContext = buildRepairContext({
        reviewReport: cycleResult.reviewReport,
        specialistReviewReport: cycleResult.specialistReviewReport,
        validationSummary: cycleResult.validationSuite.summary,
        attemptNumber: attemptIndex,
      });

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
          `Escopo: ${(repairContext.repairScope?.workstreamIds || []).join(', ') || 'persistence_and_docs'}`,
        ],
        repairScope: repairContext.repairScope || null,
        ...getWorkstreamExecutionState(implementationPlanContent, 'integration_and_validation'),
      });

        if (repairContext.repairScope?.needsFrontend) {
          technicalSpec = await enrichFrontendWithAi(task, technicalSpec, runtimeUserUuid, repairContext, options);
        }
      const repairWorkstreamIds = repairContext.repairScope?.workstreamIds?.length
        ? repairContext.repairScope.workstreamIds
        : ['persistence_and_docs'];
      generatedFiles = [
        ...generatedFiles.filter((file) => !repairWorkstreamIds.includes(file.workstreamId)),
        ...(await materializeImplementationFiles({
          task,
          implementation,
          technicalSpec,
          generatedApp,
          workstreamIds: repairWorkstreamIds,
        })),
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
      cycleResult.specialistReviewReport.summary.status === 'approved' &&
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
        summary: `Integracao aplicada com arquivos reais:\n${createdPaths}\n\nReview score: ${cycleResult.reviewReport.summary.score}\nUX score: ${cycleResult.reviewReport.summary.uxScore}\nConsistency score: ${cycleResult.reviewReport.summary.consistencyScore}\nSpecialist score: ${cycleResult.specialistReviewReport.summary.score}\nSpecialist architecture score: ${cycleResult.specialistReviewReport.summary.architectureScore}\nValidation score: ${cycleResult.validationSuite.summary.validationScore}\nReview status: ${cycleResult.reviewReport.summary.status}\nSpecialist status: ${cycleResult.specialistReviewReport.summary.status}\nValidation status: ${cycleResult.validationSuite.summary.status}\nLint: ${cycleResult.validationSuite.summary.lintStatus}\nTest: ${cycleResult.validationSuite.summary.testStatus}\nBuild: ${cycleResult.validationSuite.summary.buildStatus}\nRepair attempts: ${repairAttempts.length}`,
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: finalSucceeded ? 'completed' : 'failed',
        finishedAt: new Date(),
        logSummary: `Integracao incremental aplicada para ${task.uuid} | validation=${cycleResult.validationSuite.summary.status} | repairAttempts=${repairAttempts.length}`,
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
    implementation,
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

  return {
    ...implementation,
    reviewArtifact,
    specialistReviewArtifact,
    fixPlanArtifact,
    strategyArtifact,
    impactArtifact,
    executionStateArtifact,
    diffReviewArtifact,
    buildReportArtifact,
    testReportArtifact,
    lintReportArtifact,
    qualitySummary: {
      ...qualitySummary,
      benchmark: benchmarkSummary,
    },
  };
}

export async function reviewTaskImplementation(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const implementation = await getLatestTaskImplementation(task.id);

  if (!implementation?.technicalSpecArtifact || !implementation?.generatedApp) {
    throw new Error('A task ainda n?o possui implementa??o gerada para revisar.');
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
      specialistReviewReport.summary.status === 'approved' &&
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
