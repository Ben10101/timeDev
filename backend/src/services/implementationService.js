import { randomUUID, createHash } from 'crypto';
import { exec } from 'child_process';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { resolveDomainTemplate } from '../templates/domains/index.js';
import { materializeFullstackTemplate } from './generatedAppTemplateService.js';
import { generateImplementationUi } from './implementationAiService.js';

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
  await writeFile(targetPath, content, 'utf8');
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

async function getProjectOrThrow(projectUuid) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true, uuid: true, name: true, slug: true, description: true, vision: true },
  });

  if (!project) {
    throw new Error('Projeto não encontrado.');
  }

  return project;
}

async function getTaskWithArtifactsOrThrow(taskUuid) {
  const task = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    include: {
      project: {
        select: { id: true, uuid: true, name: true, slug: true },
      },
      artifacts: {
        where: { isCurrent: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    throw new Error('Tarefa não encontrada.');
  }

  return task;
}

function inferFieldDefinitions(sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();
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
      formCardDescription: 'Preencha as credenciais mínimas para liberar seu primeiro acesso.',
      recordsTitle: 'Cadastros recentes',
      recordsEmptyState: 'Nenhum cadastro processado até o momento.',
      highlights: [
        'Validação imediata de e-mail antes da persistência.',
        'Senha forte exigida para concluir o cadastro.',
        'Proteção contra e-mails duplicados no fluxo incremental.',
      ],
      profileSummaryTitle: 'Checklist de cadastro',
      profileSummaryDescription: 'O fluxo precisa validar e-mail, senha e evitar duplicidade antes da criação da conta.',
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
      recordsTitle: 'Sessões recentes',
      recordsEmptyState: 'Nenhuma sessão registrada até o momento.',
      highlights: [
        'Validação de credenciais antes de iniciar a sessão.',
        'Mensagens claras para e-mail ou senha inválidos.',
        'Fluxo pensado para acoplar autenticação real depois.',
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
      recordsTitle: 'Histórico de alterações',
      recordsEmptyState: 'Nenhuma alteração realizada até o momento.',
      highlights: [
        'Nome obrigatório para exibição correta do perfil.',
        'Foto de perfil com validação de formato e limite de tamanho.',
        'Histórico preparado para auditoria de atualizações.',
      ],
      profileSummaryTitle: 'Boas práticas do perfil',
      profileSummaryDescription: 'O aluno precisa manter dados atualizados, com nome obrigatório e foto válida.',
    };
  }

  return {
    templateKey: 'generic/form',
    heroEyebrow: technicalSpec.frontend?.navigationLabel || technicalSpec.entityName,
    heroTitle: technicalSpec.frontend?.pageTitle || technicalSpec.entityName,
    heroDescription: technicalSpec.frontend?.pageDescription || technicalSpec.summary,
    formCardTitle: 'Preencha os dados',
    formCardDescription: 'Informe os dados necessários para continuar.',
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

async function enrichFrontendWithAi(task, technicalSpec) {
  const domainTemplate = getDomainTemplate(technicalSpec);
  const fallback = {
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
  };

  try {
    const aiResult = await generateImplementationUi({
      taskTitle: task.title,
      summary: technicalSpec.summary,
      frontendRoute: technicalSpec.frontend.suggestedRoute,
      submitLabel: technicalSpec.domain.submitLabel,
      navigationLabel: technicalSpec.frontend.navigationLabel,
      pageTitle: technicalSpec.frontend.pageTitle,
      pageDescription: technicalSpec.frontend.pageDescription,
      fields: technicalSpec.domain.fields,
      businessRules: technicalSpec.businessRules,
      qaScenarios: technicalSpec.qaScenarios,
    });

    return {
      ...technicalSpec,
      frontend: {
        ...technicalSpec.frontend,
        ...fallback,
        ...aiResult,
      },
      domain: {
        ...technicalSpec.domain,
        submitLabel: aiResult?.submitLabel || technicalSpec.domain.submitLabel,
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

function inferBusinessRules(sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const rules = [];

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

function inferQaScenarios(sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();
  const scenarios = [];

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

function inferDomainName(actionSpec, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec.domainKey.startsWith('auth-')) return 'auth';
  if (actionSpec.domainKey === 'profile-settings' || /\bperfil\b/.test(normalized)) return 'profile';
  if (/\bupload\b|\barquivo\b|\banexo\b|\bimagem\b/.test(normalized)) return 'upload';
  if (/\bcrud\b|\blistar\b|\bcriar\b|\beditar\b|\bexcluir\b/.test(normalized)) return 'crud';

  return 'custom';
}

function inferIntent(actionSpec, sourceText) {
  const normalized = stripAccents(sourceText).toLowerCase();

  if (actionSpec.domainKey === 'auth-login' || /\blogin\b|\bentrar\b|\bautentic/.test(normalized)) return 'login';
  if (actionSpec.domainKey === 'auth-register' || /\bregistr/.test(normalized) || /\bcadastr/.test(normalized)) return 'register';
  if (actionSpec.domainKey === 'profile-settings' || /\batualiz/.test(normalized) || /\bedita/.test(normalized)) return 'update';
  if (/\bupload\b|\benviar\b/.test(normalized)) return 'upload';
  if (/\bcriar\b/.test(normalized)) return 'create';
  if (/\blistar\b|\bvisualizar\b/.test(normalized)) return 'list';

  return 'custom';
}

function buildUiSections(actionSpec, fields, frontendSpec) {
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
    fields: fields.map((field) => ({
      name: field.name,
      label: field.label,
      inputType: field.inputType,
      required: field.required,
    })),
    primaryAction: actionSpec.submitLabel,
  });

  sections.push({
    key: 'history',
    type: 'list',
    title: frontendSpec.recordsTitle || 'Historico',
  });

  return sections;
}

function buildStructuredSpec(task, actionSpec, fields, businessRules, qaScenarios, frontendSpec, backendSpec, sharedSpec, databaseSpec) {
  const domainTemplate = getDomainTemplate({
    featureKey: slugify(actionSpec.domainKey, task.uuid),
    frontend: frontendSpec,
    entityName: databaseSpec.modelName,
    summary: actionSpec.summary,
  });
  return {
    classification: {
      domain: inferDomainName(actionSpec, `${task.title}\n${task.description || ''}`),
      intent: inferIntent(actionSpec, `${task.title}\n${task.description || ''}`),
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
      sections: buildUiSections(actionSpec, fields, frontendSpec),
    },
    api: {
      routeBase: backendSpec.routeBase,
      routes: backendSpec.routes,
      requestContractName: sharedSpec.requestContractName,
      responseContractName: sharedSpec.responseContractName,
    },
    constraints: {
      businessRules,
      qaScenarios,
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

function buildTechnicalSpec(task) {
  const requirements = task.artifacts.find((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent);
  const testPlan = task.artifacts.find((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent);
  const requirementsSource = requirements?.content || '';
  const qaSource = testPlan?.content || '';
  const sourceText = `${task.title}\n${requirementsSource}\n${qaSource}`;
  const actionSpec = inferActionSpec(task, sourceText);
  const featureKey = slugify(actionSpec.domainKey, task.uuid);
  const entityName = actionSpec.entityName;
  const routerName = `${entityName}Router`;
  const routeBase = actionSpec.routeBase;
  const fields = inferFieldDefinitions(sourceText);
  const businessRules = inferBusinessRules(sourceText);
  const qaScenarios = inferQaScenarios(sourceText);
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
    version: 4,
    taskUuid: task.uuid,
    taskTitle: task.title,
    projectUuid: task.project.uuid,
    changeType: 'feature',
    implementationMode: 'post_refinement',
    featureKey,
    entityName,
    entityPluralName: `${entityName}Items`,
    summary: actionSpec.summary,
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
  const fields = rawSpec?.domain?.fields || rawSpec?.database?.fields || inferFieldDefinitions(sourceText);
  const businessRules = rawSpec?.businessRules || inferBusinessRules(sourceText);
  const qaScenarios = rawSpec?.qaScenarios || inferQaScenarios(sourceText);
  const requestContractName = rawSpec?.shared?.requestContractName || `${entityName}Request`;
  const responseContractName = rawSpec?.shared?.responseContractName || `${entityName}Response`;
  const listContractName = rawSpec?.shared?.listContractName || `${entityName}ListResponse`;

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
  return {
    version: 2,
    taskUuid: task.uuid,
    generatedAppUuid: generatedApp.uuid,
    generatedAppRoot: generatedApp.rootPath,
    steps: [
      'Ler o contexto atual do monorepo gerado',
      'Criar contrato compartilhado da feature',
      'Criar módulo funcional no backend',
      'Registrar rota real no servidor da API',
      'Criar página e serviço reais no frontend',
      'Registrar a página na navegação do app',
      'Atualizar prisma/schema.prisma do app gerado',
      'Registrar documentação da implementação incremental',
    ],
    targetFiles: [
      technicalSpec.shared.contractPath,
      `${technicalSpec.backend.modulePath}/service.ts`,
      `${technicalSpec.backend.modulePath}/router.ts`,
      `${technicalSpec.backend.modulePath}/index.ts`,
      'apps/api/src/server.ts',
      `${technicalSpec.frontend.featurePath}/page.tsx`,
      `${technicalSpec.frontend.featurePath}/service.ts`,
      `${technicalSpec.frontend.featurePath}/index.ts`,
      'apps/web/src/App.tsx',
      'apps/web/package.json',
      technicalSpec.database.schemaPath,
      `docs/implementations/${technicalSpec.featureKey}.md`,
    ],
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
      content: `# ${task.title}\n\nMódulo backend incremental criado a partir da task refinada.\n`,
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
  const initialStateEntries = technicalSpec.domain.fields
    .map((field) => `  ${field.name}: '${escapeTemplate(field.defaultValue || '')}',`)
    .join('\n');
  const inputBlocks = technicalSpec.domain.fields
    .map(
      (field) => `        <label style={{ display: 'grid', gap: 6 }}>\n          <span>${field.label}</span>\n          <input\n            type="${field.inputType}"\n            value={form.${field.name}}\n            placeholder="${escapeTemplate(field.placeholder)}"\n            onChange={(event) => setForm((current) => ({ ...current, ${field.name}: event.target.value }))}\n            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}\n          />\n          <small style={{ color: '#64748b' }}>${escapeTemplate(field.helperText)}</small>\n        </label>`
    )
    .join('\n');
  const payloadObject = technicalSpec.domain.fields.map((field) => `      ${field.name}: form.${field.name},`).join('\n');
  const previewField = technicalSpec.domain.fields.find((field) => field.name === 'email') || technicalSpec.domain.fields[0];
  const highlights = (technicalSpec.frontend.highlights || [])
    .slice(0, 3)
    .map(
      (item) =>
        `              <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>${escapeTemplate(item)}</div>`
    )
    .join('\n');

  return [
    {
      relativePath: `${technicalSpec.frontend.featurePath}/service.ts`,
      content: `import type { ${technicalSpec.shared.listContractName}, ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\n\nexport async function fetch${entityName}Items(): Promise<${technicalSpec.shared.responseContractName}[]> {\n  const response = await fetch('${technicalSpec.backend.routeBase}');\n  const data: ${technicalSpec.shared.listContractName} = await response.json();\n  return data.items || [];\n}\n\nexport async function create${entityName}(input: ${technicalSpec.shared.requestContractName}): Promise<${technicalSpec.shared.responseContractName}> {\n  const response = await fetch('${technicalSpec.backend.routeBase}', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(input),\n  });\n\n  if (!response.ok) {\n    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));\n    throw new Error(error.message || 'Falha ao criar registro.');\n  }\n\n  return response.json();\n}\n`,
      fileType: 'ts',
    },
    {
      relativePath: `${technicalSpec.frontend.featurePath}/page.tsx`,
      content: `import { useEffect, useState } from 'react';\nimport type { FormEvent } from 'react';\nimport type { ${technicalSpec.shared.requestContractName}, ${technicalSpec.shared.responseContractName} } from '${sharedImportPath}';\nimport { create${entityName}, fetch${entityName}Items } from './service';\n\nconst initialForm: ${technicalSpec.shared.requestContractName} = {\n${initialStateEntries}\n};\n\nexport function ${technicalSpec.frontend.pageComponentName}() {\n  const [items, setItems] = useState<${technicalSpec.shared.responseContractName}[]>([]);\n  const [form, setForm] = useState<${technicalSpec.shared.requestContractName}>(initialForm);\n  const [feedback, setFeedback] = useState('');\n  const [errorMessage, setErrorMessage] = useState('');\n\n  useEffect(() => {\n    fetch${entityName}Items().then(setItems).catch(() => setItems([]));\n  }, []);\n\n  async function handleSubmit(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    setFeedback('');\n    setErrorMessage('');\n\n    try {\n      const created = await create${entityName}({\n${payloadObject}\n      });\n      setItems((current) => [...current, created]);\n      setForm(initialForm);\n      setFeedback('${escapeTemplate(technicalSpec.domain.successMessage)}');\n    } catch (error) {\n      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');\n    }\n  }\n\n  return (\n    <section style={{ minHeight: '100vh', background: '#f8fafc', padding: 32 }}>\n      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 32, gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)' }}>\n        <div style={{ display: 'grid', gap: 18, alignContent: 'start', paddingTop: 32 }}>\n          <span style={{ display: 'inline-flex', width: 'fit-content', padding: '8px 14px', borderRadius: 999, background: '#ccfbf1', color: '#115e59', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 12 }}>\n            ${escapeTemplate(technicalSpec.frontend.navigationLabel || technicalSpec.entityName)}\n          </span>\n          <div style={{ display: 'grid', gap: 12 }}>\n            <h2 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, color: '#0f172a' }}>${escapeTemplate(technicalSpec.frontend.pageTitle || technicalSpec.entityName)}</h2>\n            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: '#475569', maxWidth: 560 }}>${escapeTemplate(technicalSpec.frontend.pageDescription || technicalSpec.summary)}</p>\n          </div>\n          <div style={{ display: 'grid', gap: 14, padding: 24, borderRadius: 24, background: 'linear-gradient(135deg, #0f766e, #115e59)', color: '#f8fafc', boxShadow: '0 24px 60px rgba(15, 118, 110, 0.22)' }}>\n            <strong style={{ fontSize: 16 }}>${escapeTemplate(technicalSpec.frontend.heroEyebrow || 'Fluxo principal')}</strong>\n            <p style={{ margin: 0, lineHeight: 1.6, color: 'rgba(248, 250, 252, 0.88)' }}>${escapeTemplate(technicalSpec.frontend.heroDescription || technicalSpec.summary)}</p>\n            <div style={{ display: 'grid', gap: 10 }}>\n${highlights || `              <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>Validacao automatica dos campos antes do envio.</div>`}\n            </div>\n          </div>\n        </div>\n\n        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>\n          <div style={{ padding: 28, borderRadius: 28, background: '#ffffff', boxShadow: '0 22px 50px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }}>\n            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>\n${inputBlocks}\n              <button type="submit" style={{ padding: '14px 18px', borderRadius: 14, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>\n                ${escapeTemplate(technicalSpec.domain.submitLabel)}\n              </button>\n            </form>\n\n            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}\n            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}\n          </div>\n\n          <div style={{ padding: 24, borderRadius: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)' }}>\n            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#0f172a' }}>${escapeTemplate(technicalSpec.frontend.recordsTitle || 'Ultimos registros')}</h3>\n            {items.length ? (\n              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', display: 'grid', gap: 8 }}>\n                {items.map((item) => (\n                  <li key={item.id}>{String(item.${previewField.name === 'password' ? 'passwordHint' : previewField.name} || item.id)}</li>\n                ))}\n              </ul>\n            ) : (\n              <p style={{ margin: 0, color: '#64748b' }}>${escapeTemplate(technicalSpec.frontend.recordsEmptyState || 'Nenhum registro processado ainda.')}</p>\n            )}\n          </div>\n        </div>\n      </div>\n    </section>\n  );\n}\n`,
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

      if (!content.includes('Cenarios de QA mapeados')) {
        const qaItems = (technicalSpec.qaScenarios || [])
          .slice(0, 4)
          .map((item) => `                  <li>${escapeTemplate(item.message)}</li>`)
          .join('\n');

        content = content.replace(
          "        </div>\n      </div>\n    </section>",
          `          <div style={{ padding: 24, borderRadius: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)' }}>\n            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#0f172a' }}>Cenarios de QA mapeados</h3>\n            <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', display: 'grid', gap: 8 }}>\n${qaItems || "              <li>Nenhum cenário de QA estruturado foi mapeado.</li>"}\n            </ul>\n          </div>\n        </div>\n      </div>\n    </section>`
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

async function ensureValidationScripts(generatedAppRoot) {
  const lintContent = `import { readFile, readdir } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function listFeaturePages() {\n  const featuresRoot = path.join(root, 'apps', 'web', 'src', 'features');\n  try {\n    const entries = await readdir(featuresRoot, { withFileTypes: true });\n    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(featuresRoot, entry.name, 'page.tsx'));\n  } catch {\n    return [];\n  }\n}\n\nfunction collectDuplicateLines(content, predicate) {\n  const lines = String(content || '')\n    .split(/\\r?\\n/)\n    .map((line) => line.trim())\n    .filter(Boolean)\n    .filter((line) => (predicate ? predicate(line) : true));\n\n  const counts = new Map();\n  for (const line of lines) {\n    counts.set(line, (counts.get(line) || 0) + 1);\n  }\n\n  return Array.from(counts.entries()).filter(([, count]) => count > 1);\n}\n\nasync function readSafe(filePath) {\n  try {\n    return await readFile(filePath, 'utf8');\n  } catch {\n    return '';\n  }\n}\n\nconst failures = [];\nconst genericFallbackPattern = /Campo principal da feature gerada|Informe o valor principal/;\n\nconst appContent = await readSafe(path.join(root, 'apps', 'web', 'src', 'App.tsx'));\nconst serverContent = await readSafe(path.join(root, 'apps', 'api', 'src', 'server.ts'));\n\nfor (const [line, count] of collectDuplicateLines(appContent, (line) => line.startsWith('import ') || line.includes(\"path: '\"))) {\n  failures.push(\`App.tsx possui linha duplicada \${count}x: \${line}\`);\n}\n\nfor (const [line, count] of collectDuplicateLines(serverContent, (line) => line.startsWith('import ') || line.startsWith('app.use('))) {\n  failures.push(\`server.ts possui linha duplicada \${count}x: \${line}\`);\n}\n\nfor (const pagePath of await listFeaturePages()) {\n  const pageContent = await readSafe(pagePath);\n  if (genericFallbackPattern.test(pageContent)) {\n    failures.push(\`\${path.relative(root, pagePath)} ainda contém textos genéricos de fallback.\`);\n  }\n}\n\nif (failures.length) {\n  console.error('Lint do projeto gerado falhou.\\n');\n  for (const failure of failures) {\n    console.error(\`- \${failure}\`);\n  }\n  process.exit(1);\n}\n\nconsole.log('Lint do projeto gerado concluído sem problemas.');\n`;
  const testContent = `import { access, readFile } from 'fs/promises';\nimport path from 'path';\n\nconst root = process.cwd();\n\nasync function assertFile(relativePath) {\n  try {\n    await access(path.join(root, relativePath));\n  } catch {\n    throw new Error(\`Arquivo obrigatório ausente: \${relativePath}\`);\n  }\n}\n\nasync function readSafe(relativePath) {\n  return readFile(path.join(root, relativePath), 'utf8');\n}\n\nfor (const file of ['apps/api/src/server.ts', 'apps/web/src/App.tsx', 'prisma/schema.prisma']) {\n  await assertFile(file);\n}\n\nconst serverContent = await readSafe('apps/api/src/server.ts');\nconst appContent = await readSafe('apps/web/src/App.tsx');\nconst schemaContent = await readSafe('prisma/schema.prisma');\n\nif (!serverContent.includes(\"app.get('/health'\")) {\n  throw new Error('API sem rota /health registrada.');\n}\n\nif (!appContent.includes(\"path: '/'\")) {\n  throw new Error('Frontend sem rota Home registrada.');\n}\n\nif (!schemaContent.includes('model ')) {\n  throw new Error('Schema Prisma sem nenhum model.');\n}\n\nconsole.log('Smoke tests do projeto gerado concluídos com sucesso.');\n`;

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
  const routeLines = uniqueRouteSpecs
    .map(
      (spec) =>
        `  { path: '${spec.frontend.suggestedRoute}', label: '${escapeTemplate(spec.frontend.navigationLabel || spec.entityName)}', render: () => <${spec.frontend.pageComponentName} /> },`
    )
    .join('\n');

  const content = `${importLines ? `${importLines}\n\n` : ''}const routes = [\n  { path: '/', label: 'Home', render: () => <p>Bem-vindo ao ${projectName}.</p> },\n${routeLines}\n]\n\nexport default function App() {\n  const currentPath = window.location.pathname\n  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]\n\n  return (\n    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>\n      <h1>${projectName}</h1>\n      <nav style={{ display: 'flex', gap: 12, marginBottom: 24 }}>\n        {routes.map((route) => (\n          <a key={route.path} href={route.path}>{route.label}</a>\n        ))}\n      </nav>\n      {activeRoute.render()}\n    </main>\n  )\n}\n`;

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

function categorizeFinding(code) {
  if (String(code || '').includes('fallback')) return 'fallback';
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
        action: 'Substituir copy genérica e campos de fallback pelo template de domínio correspondente.',
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
        action: 'Mapear a task para um template de domínio conhecido ou enriquecer o structured spec.',
        suggestedTemplate: 'domain-mapping',
      };
    }

    return {
      category: categorizeFinding(finding.code),
      priority: finding.severity === 'high' ? 'high' : 'medium',
      filePath: finding.filePath,
      action: 'Ajustar o arquivo para alinhar a implementação ao structured spec e rodar review novamente.',
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

  if (/Campo principal da feature gerada|Informe o valor principal/.test(pageContent)) {
    findings.push({
      severity: 'high',
      code: 'generic_form_fallback',
      category: 'fallback',
      filePath: pagePath,
      message: 'A tela ainda usa textos genericos de fallback no formulario.',
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
  const fixPlan = buildFixPlan(findings, technicalSpec);
  const reviewReport = {
    version: 1,
    taskUuid: task.uuid,
    implementationId: String(implementation.id),
    featureKey: technicalSpec.featureKey,
    reviewedAt: new Date().toISOString(),
    summary: {
      score,
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
    return existing;
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

export async function planTaskImplementation(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);

  if (task.status !== 'done') {
    throw new Error('A implementacao so pode comecar apos o refinamento completo da task.');
  }

  const generatedApp = await getGeneratedAppByProjectUuid(task.project.uuid);
  if (!generatedApp) {
    throw new Error('O projeto ainda nao possui um app full stack gerado. Faca o bootstrap primeiro.');
  }

  const technicalSpec = await enrichFrontendWithAi(task, buildTechnicalSpec(task));
  const technicalSpecArtifact = await createCurrentArtifact(
    task.id,
    `Technical Spec - ${task.title}`,
    JSON.stringify(technicalSpec, null, 2),
    'implementation_architect'
  );

  const plan = buildImplementationPlan(task, generatedApp, technicalSpec);
  const planArtifact = await createCurrentArtifact(
    task.id,
    `Implementation Plan - ${task.title}`,
    JSON.stringify(plan, null, 2),
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
        in: [technicalSpecArtifact.id, planArtifact.id],
      },
    },
    data: {
      taskImplementationId: implementation.id,
      artifactScope: 'implementation',
    },
  });

  return implementation;
}

export async function runTaskImplementation(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const generatedApp = await getGeneratedAppByProjectUuid(task.project.uuid);

  if (!generatedApp) {
    throw new Error('O projeto ainda não possui um app full stack gerado. Faça o bootstrap primeiro.');
  }

  let implementation = await planTaskImplementation(taskUuid);

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
    await cleanupImplementationFiles(generatedApp.rootPath, implementation);

    const technicalSpec = normalizeTechnicalSpec(JSON.parse(implementation.technicalSpecArtifact.content), task);
    const routeSpecs = await getIntegratedTechnicalSpecs(generatedApp.id, technicalSpec);
    const generatedFiles = [
      ...buildBackendModuleFilesFromTemplate(task, technicalSpec),
      ...buildFrontendFeatureFilesFromTemplate(task, technicalSpec),
      ...(await ensureValidationScripts(generatedApp.rootPath)),
      {
        relativePath: `docs/implementations/${technicalSpec.featureKey}.md`,
        content: `# ${task.title}\n\nTask UUID: ${task.uuid}\n\n## Resumo\nFeature integrada no baseline full stack pós-refinamento.\n\n## Rotas\n- Frontend: ${technicalSpec.frontend.suggestedRoute}\n- Backend: ${technicalSpec.backend.routeBase}\n`,
        fileType: 'md',
      },
      await updateRootPackageJson(generatedApp.rootPath),
      await updateApiServer(generatedApp.rootPath, routeSpecs, generatedApp.slug),
      await updateWebPackageJson(generatedApp.rootPath),
      await updateWebApp(generatedApp.rootPath, routeSpecs, task.project.name),
      await updatePrismaSchema(generatedApp.rootPath, technicalSpec),
    ];

    for (const file of generatedFiles) {
      await writeText(path.join(generatedApp.rootPath, file.relativePath), file.content);
    }

    await prisma.generatedFile.createMany({
      data: generatedFiles.map((file) => ({
        generatedAppId: generatedApp.id,
        taskImplementationId: implementation.id,
        filePath: file.relativePath.replace(/\\/g, '/'),
        fileType: file.fileType,
        changeType: 'created',
        checksum: sha(file.content),
      })),
    });

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

    const createdPaths = generatedFiles.map((file) => file.relativePath).join('\n');
    await prisma.taskImplementation.update({
      where: { id: implementation.id },
      data: {
        status:
          reviewReport.summary.status === 'approved' && validationSuite.summary.status === 'completed'
            ? 'integrated'
            : 'failed',
        buildStatus: validationSuite.summary.buildStatus,
        testStatus:
          validationSuite.summary.testStatus === 'completed' && validationSuite.summary.lintStatus === 'completed'
            ? 'completed'
            : 'failed',
        summary: `Integração aplicada com arquivos reais:\n${createdPaths}\n\nReview score: ${reviewReport.summary.score}\nReview status: ${reviewReport.summary.status}\nValidation status: ${validationSuite.summary.status}\nLint: ${validationSuite.summary.lintStatus}\nTest: ${validationSuite.summary.testStatus}\nBuild: ${validationSuite.summary.buildStatus}`,
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: reviewRun.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        logSummary: `Review automático executado para ${task.uuid} com score ${reviewReport.summary.score}`,
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: validationRun.id },
      data: {
        status: validationSuite.summary.status === 'completed' ? 'completed' : 'failed',
        finishedAt: new Date(),
        logSummary: `Validation suite executada para ${task.uuid} | lint=${validationSuite.summary.lintStatus} test=${validationSuite.summary.testStatus} build=${validationSuite.summary.buildStatus}`,
      },
    });

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status:
          reviewReport.summary.status === 'approved' && validationSuite.summary.status === 'completed'
            ? 'completed'
            : 'failed',
        finishedAt: new Date(),
        logSummary: `Integração incremental aplicada para ${task.uuid} | validation=${validationSuite.summary.status}`,
      },
    });
  } catch (error) {
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

  return {
    ...implementation,
    reviewArtifact,
    fixPlanArtifact,
    buildReportArtifact,
    testReportArtifact,
    lintReportArtifact,
  };
}

export async function reviewTaskImplementation(taskUuid) {
  const task = await getTaskWithArtifactsOrThrow(taskUuid);
  const implementation = await getLatestTaskImplementation(task.id);

  if (!implementation?.technicalSpecArtifact || !implementation?.generatedApp) {
    throw new Error('A task ainda não possui implementação gerada para revisar.');
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

    await prisma.generatedAppRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        logSummary: `Review manual executado para ${task.uuid} com score ${reviewReport.summary.score}`,
      },
    });

    return {
      implementation,
      reviewArtifact: artifact,
      fixPlanArtifact,
      reviewReport,
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
