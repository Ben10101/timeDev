import {
  assertProjectAccess,
  assertProjectPermission,
  assertTaskAccess,
  assertWorkspaceAccess,
  addProjectMember,
  approveCurrentArchitectureArtifact,
  createAgentRunStart,
  createProject,
  createTask,
  createTaskArtifact,
  createTaskComment,
  ensurePipelineProject,
  finishAgentRun,
  getDefaultWorkspaceForUserUuid,
  getProjectArchitectureStatus,
  getProjectDocumentationBundle,
  getProjectByUuid,
  getTaskByUuid,
  getWorkspaceTeamSummary,
  importBacklogTasks,
  publishBacklogTasks,
  updateBacklogStory,
  listProjects,
  listProjectTasks,
  listAllTasks,
  persistAgentResult,
  removeProjectMember,
  deleteProject,
  updateProjectBrief,
  updateProjectMemberRole,
  updateProjectStatus,
  updateTask,
  reviewTaskArtifact,
} from '../services/projectDataService.js';
import { evaluateArtifactQuality } from '../services/artifactQualityGateService.js';
import { runSingleAgent } from '../services/orchestratorService.js';
import { buildRuntimeAiEnvForUser } from '../services/aiSettingsService.js';
import { bootstrapGeneratedApp } from '../services/implementationService.js';
import { createAgentRunLifecycle } from '../utils/agentRunLifecycle.js';
import { assertArtifactCompleteness } from '../utils/artifactQuality.js';
import { serializeBigInts } from '../utils/serialize.js';
import { buildAgentRunUsage, withAiRuntimeMeta } from '../utils/aiRunMetrics.js';
import { inferProjectTemplateKey } from '../templates/projects/index.js';

function isAgentRunConflictError(error) {
  return error?.statusCode === 409 || error?.code === 'AGENT_RUN_CONFLICT';
}

function compactWhitespace(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeBacklogStoryForReview(story = {}) {
  const actor = String(story.actor || '').trim();
  const goal = String(story.goal || '').trim();
  const benefit = String(story.benefit || '').trim();
  const description = String(story.description || '').trim();
  const title = String(story.title || '').trim()
    || (actor && goal
      ? `Como ${actor}, quero ${goal}${benefit ? `, para ${benefit}` : ''}.`
      : goal || description);

  return {
    ...story,
    id: String(story.id || '').trim(),
    title,
    description: description || null,
    actor: actor || null,
    benefit: benefit || null,
  };
}

function mergeReviewAnswers(storedAnswers, submittedAnswers) {
  const answerKey = (item = {}) => String(item.id || item.question || '').trim().toLowerCase();
  const normalize = (values) => (Array.isArray(values) ? values : [])
    .map((item) => ({
      id: String(item?.id || '').trim(),
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((item) => item.answer && answerKey(item));
  const merged = new Map();
  normalize(storedAnswers).forEach((item) => merged.set(answerKey(item), item));
  normalize(submittedAnswers).forEach((item) => merged.set(answerKey(item), item));
  return [...merged.values()].slice(0, 20);
}

function extractMarkdownSection(content, sectionTitle) {
  const normalized = compactWhitespace(content);
  if (!normalized) return '';

  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`##+\\s+${escaped}\\s*([\\s\\S]*?)(?=\\n##+\\s+|$)`, 'i');
  const match = normalized.match(regex);
  return match ? compactWhitespace(match[1]) : '';
}

function clampText(value, maxLength = 420) {
  const text = compactWhitespace(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function compactRequirementArtifact(content) {
  const userStory = clampText(extractMarkdownSection(content, 'User Story Refinada'), 180);
  const functional = clampText(extractMarkdownSection(content, 'Requisitos Funcionais'), 420);
  const rules = clampText(extractMarkdownSection(content, 'Regras de Negocio'), 260);
  const acceptance = clampText(extractMarkdownSection(content, 'Criterios de Aceite (BDD)'), 320);

  return [
    userStory ? `User Story Refinada:\n${userStory}` : null,
    functional ? `Requisitos Funcionais:\n${functional}` : null,
    rules ? `Regras de Negocio:\n${rules}` : null,
    acceptance ? `Criterios de Aceite:\n${acceptance}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function compactProjectBrief(project) {
  return [
    `Projeto: ${project?.name || 'Projeto'}`,
    project?.description ? `Descricao: ${clampText(project.description, 180)}` : null,
    project?.vision ? `Visao: ${clampText(project.vision, 220)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function compactBacklogInput(idea = '', answers = {}) {
  const answerLimits = {
    objective: 360,
    audience: 360,
    mainFlows: 720,
    constraints: 720,
    clarifications: 1800,
  };
  const entries = Object.entries(answers || {})
    .map(([key, value]) => {
      if (key === 'clarifications' && Array.isArray(value)) {
        const resolved = value
          .filter((item) => item?.question && item?.answer)
          .map((item) => `${item.question}: ${item.answer}`)
          .join(' | ');
        return resolved ? `Clarificacoes respondidas: ${clampText(resolved, answerLimits.clarifications)}` : null;
      }
      return `${key}: ${clampText(typeof value === 'string' ? value : JSON.stringify(value), answerLimits[key] || 240)}`;
    })
    .filter(Boolean)
    .slice(0, 8);

  return [
    clampText(idea, 480),
    entries.length ? `Respostas-chave:\n- ${entries.join('\n- ')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function compactProjectDnaForAgent(projectDna) {
  if (!projectDna || typeof projectDna !== 'object') return '';

  const project = projectDna.project || {};
  const positioning = projectDna.positioning || {};
  const designSystem = projectDna.designSystem || {};
  const coherenceRules = projectDna.coherenceRules || {};

  const domainLanguage = Array.isArray(project.domainLanguage) ? project.domainLanguage.slice(0, 8).join(', ') : '';
  const allowedScreenFamilies = Array.isArray(designSystem.allowedScreenFamilies)
    ? designSystem.allowedScreenFamilies.slice(0, 6).join(', ')
    : '';

  return [
    'Project DNA:',
    project.productMode ? `- Product mode: ${project.productMode}` : null,
    project.experienceStyle ? `- Experience style: ${project.experienceStyle}` : null,
    project.primaryActor ? `- Ator principal: ${project.primaryActor}` : null,
    domainLanguage ? `- Linguagem do dominio: ${domainLanguage}` : null,
    positioning.summary ? `- Resumo: ${clampText(positioning.summary, 180)}` : null,
    positioning.promise ? `- Promessa: ${clampText(positioning.promise, 180)}` : null,
    allowedScreenFamilies ? `- Familias de tela permitidas: ${allowedScreenFamilies}` : null,
    Array.isArray(coherenceRules.mustPreserve) && coherenceRules.mustPreserve.length
      ? `- Preservar: ${coherenceRules.mustPreserve.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function compactArchitectureBacklogContract(project) {
  const backlogContract = project?.intakeConfig?.backlogContract;
  if (!backlogContract || typeof backlogContract !== 'object') return '';

  const capabilities = Array.isArray(backlogContract.capabilities)
    ? backlogContract.capabilities.slice(0, 6).map((item) => item?.name || '').filter(Boolean).join(', ')
    : '';
  const epics = Array.isArray(backlogContract.epics)
    ? backlogContract.epics.slice(0, 6).map((item) => item?.name || '').filter(Boolean).join(', ')
    : '';
  const releaseSlices = Array.isArray(backlogContract.releaseSlices)
    ? backlogContract.releaseSlices.slice(0, 4).map((item) => item?.name || '').filter(Boolean).join(', ')
    : '';

  return [
    'Backlog Contract:',
    capabilities ? `- Capacidades: ${capabilities}` : null,
    epics ? `- Epicos: ${epics}` : null,
    releaseSlices ? `- Releases: ${releaseSlices}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function listProjectsController(req, res, next) {
  try {
    const projects = await listProjects(req.authUser.uuid);
    res.json(serializeBigInts(projects));
  } catch (error) {
    next(error);
  }
}

export async function getWorkspaceTeamSummaryController(req, res, next) {
  try {
    const summary = await getWorkspaceTeamSummary(req.authUser.uuid, req.query.workspaceUuid || null);
    res.json(serializeBigInts(summary));
  } catch (error) {
    next(error);
  }
}

export async function bootstrapController(_req, res) {
  res.status(410).json({
    message: 'Bootstrap pÃºblico desativado. Use /api/auth/register para criar sua conta com seguranÃ§a.',
  });
}

export async function getProjectController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);

    if (!project) {
      return res.status(404).json({ message: 'Projeto nÃ£o encontrado.' });
    }

    res.json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function createProjectController(req, res, next) {
  try {
    const {
      workspaceUuid,
      name,
      description,
      vision,
      startMode,
      templateKey,
      intakeConfig,
      boardConfig,
      agentsConfig,
      automationConfig,
      status,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: 'name e obrigatorio.',
      });
    }

    const workspace =
      workspaceUuid
        ? await assertWorkspaceAccess(workspaceUuid, req.authUser.uuid)
        : await getDefaultWorkspaceForUserUuid(req.authUser.uuid);

    if (!workspace?.uuid) {
      return res.status(400).json({
        message: 'Nenhum workspace disponÃ­vel para este usuÃ¡rio.',
      });
    }

    const resolvedTemplateKey =
      templateKey?.trim() ||
      inferProjectTemplateKey({
        projectName: name,
        description,
        vision,
        idea: intakeConfig?.idea,
        summary: intakeConfig?.objective,
      });

    const project = await createProject({
      workspaceUuid: workspace.uuid,
      createdByUuid: req.authUser.uuid,
      name,
      description,
      vision,
      startMode,
      templateKey: resolvedTemplateKey,
      intakeConfig: {
        ...(intakeConfig || {}),
        projectTemplateKey: resolvedTemplateKey || intakeConfig?.projectTemplateKey || null,
      },
      boardConfig,
      agentsConfig,
      automationConfig,
      status,
    });

    res.status(201).json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function updateProjectBriefController(req, res, next) {
  try {
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');

    const { description, vision, intakeConfig } = req.body || {};
    const resolvedTemplateKey = inferProjectTemplateKey({
      description,
      vision,
      idea: intakeConfig?.idea,
      summary: intakeConfig?.objective,
    });
    const project = await updateProjectBrief(req.params.projectUuid, {
      description,
      vision,
      templateKey: intakeConfig?.projectTemplateKey || resolvedTemplateKey || undefined,
      intakeConfig,
    });

    res.json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function updateProjectStatusController(req, res, next) {
  try {
    const { status } = req.body || {};

    if (!status?.trim()) {
      return res.status(400).json({ message: 'status e obrigatorio.' });
    }

    const project = await updateProjectStatus(req.params.projectUuid, status, req.authUser.uuid);
    res.json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectController(req, res, next) {
  try {
    const result = await deleteProject(req.params.projectUuid, req.authUser.uuid);
    res.json(serializeBigInts(result));
  } catch (error) {
    next(error);
  }
}

export async function listProjectTasksController(req, res, next) {
  try {
    const tasks = await listProjectTasks(
      req.params.projectUuid,
      {
        status: req.query.status,
        parentTaskUuid: req.query.parentTaskUuid,
      },
      req.authUser.uuid
    );

    res.json(serializeBigInts(tasks));
  } catch (error) {
    next(error);
  }
}

export async function listAllTasksController(req, res, next) {
  try {
    const tasks = await listAllTasks(
      {
        status: req.query.status,
      },
      req.authUser.uuid
    );

    res.json(serializeBigInts(tasks));
  } catch (error) {
    next(error);
  }
}

export async function createTaskController(req, res, next) {
  try {
    const { title } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        message: 'title e obrigatorio.',
      });
    }

    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'editor');

    const task = await createTask(req.params.projectUuid, {
      ...req.body,
      createdByUuid: req.authUser.uuid,
      reporterUserUuid: req.body.reporterUserUuid || req.authUser.uuid,
    });

    res.status(201).json(serializeBigInts(task));
  } catch (error) {
    next(error);
  }
}

export async function updateTaskController(req, res, next) {
  try {
    await assertTaskAccess(req.params.taskUuid, req.authUser.uuid);
    if (req.body?.status || req.body?.assigneeUserUuid !== undefined || req.body?.dueDate !== undefined || req.body?.title || req.body?.description) {
      const existingTask = await getTaskByUuid(req.params.taskUuid, req.authUser.uuid);
      await assertProjectPermission(existingTask.project.uuid, req.authUser.uuid, 'editor');
    }

    const task = await updateTask(req.params.taskUuid, {
      ...req.body,
      changedByUserUuid: req.authUser.uuid,
    });
    res.json(serializeBigInts(task));
  } catch (error) {
    next(error);
  }
}

export async function getTaskController(req, res, next) {
  try {
    const task = await getTaskByUuid(req.params.taskUuid, req.authUser.uuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa nÃ£o encontrada.' });
    }

    res.json(serializeBigInts(task));
  } catch (error) {
    next(error);
  }
}

export async function createTaskCommentController(req, res, next) {
  try {
    const { body } = req.body;

    if (!body?.trim()) {
      return res.status(400).json({ message: 'body e obrigatorio.' });
    }

    await assertTaskAccess(req.params.taskUuid, req.authUser.uuid);
    const existingTask = await getTaskByUuid(req.params.taskUuid, req.authUser.uuid);
    await assertProjectPermission(existingTask.project.uuid, req.authUser.uuid, 'editor');

    const comment = await createTaskComment(req.params.taskUuid, {
      ...req.body,
      authorUserUuid: req.authUser.uuid,
    });
    res.status(201).json(serializeBigInts(comment));
  } catch (error) {
    next(error);
  }
}

export async function ensurePipelineProjectController(req, res, next) {
  try {
    const { projectUuid, idea } = req.body;

    if (!projectUuid?.trim()) {
      return res.status(400).json({ message: 'projectUuid e obrigatorio.' });
    }

    const project = await ensurePipelineProject(projectUuid, idea, req.authUser.uuid);
    res.status(201).json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function importBacklogTasksController(req, res, next) {
  try {
    const { backlogMarkdown } = req.body;
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');

    const tasks = await importBacklogTasks(req.params.projectUuid, backlogMarkdown);
    res.status(201).json(serializeBigInts(tasks));
  } catch (error) {
    next(error);
  }
}

export async function generateProjectBacklogController(req, res, next) {
  let agentRun = null;
  let runLifecycle = null;

  try {
    const { projectUuid } = req.params;
    const { idea, answers, description, vision, elicitation } = req.body;

    if (!idea?.trim()) {
      return res.status(400).json({ message: 'idea e obrigatorio.' });
    }

    await assertProjectPermission(projectUuid, req.authUser.uuid, 'manager');

    await updateProjectBrief(projectUuid, {
      description,
      vision,
      templateKey: inferProjectTemplateKey({
        idea: idea.trim(),
        description,
        vision,
        summary: answers?.objective || '',
      }),
      intakeConfig: {
        idea: idea.trim(),
        objective: answers?.objective || '',
        audience: answers?.audience || '',
        answers: answers || {},
        ...(elicitation ? { pmElicitation: elicitation } : {}),
        lastGeneratedAt: new Date().toISOString(),
      },
    });

    const refreshedProject = await getProjectByUuid(projectUuid, req.authUser.uuid);
    const projectDnaContext = compactProjectDnaForAgent(refreshedProject?.projectDna || null);

    const payload = {
      project_id: projectUuid,
      idea: [compactBacklogInput(idea.trim(), answers || {}), projectDnaContext].filter(Boolean).join('\n\n'),
      answers: {},
      elicitation: elicitation || refreshedProject?.intakeConfig?.pmElicitation || null,
      elicitation_answers: answers?.elicitationAnswers || {},
    };

    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid, { agentName: 'project_manager' });
    const payloadWithRuntime = withAiRuntimeMeta(payload, envOverrides);
    agentRun = await createAgentRunStart(projectUuid, 'project_manager', payloadWithRuntime);
    runLifecycle = createAgentRunLifecycle(req, res, agentRun, finishAgentRun);
    const result = await runSingleAgent('project_manager', payloadWithRuntime, { envOverrides });

    const finalized = await runLifecycle.finalizeSuccess({
      result,
      usageMeta: buildAgentRunUsage(payloadWithRuntime, result, envOverrides),
    });

    if (!finalized) {
      return;
    }

    if (result?.clarification_required || result?.elicitation_required) {
      // Keep the requirements gate recoverable after a browser refresh. No
      // backlog has been published here, so no stories/tasks are created.
      await updateProjectBrief(projectUuid, {
        intakeConfig: {
          requirementsContract: result.requirements_contract || null,
          backlogClarifications: result.clarifications || [],
          pmElicitation: result.elicitation || null,
        },
      });
      const [project, tasks] = await Promise.all([
        getProjectByUuid(projectUuid, req.authUser.uuid),
        listProjectTasks(projectUuid, {}, req.authUser.uuid),
      ]);
      return res.status(200).json(serializeBigInts({ project, tasks, result }));
    }

    await persistAgentResult(projectUuid, 'project_manager', payloadWithRuntime, result);
    // The successful contract carries the evaluated readiness state. Replace
    // the pending discovery snapshot so a later page load does not revive an
    // already answered question round.
    await updateProjectBrief(projectUuid, {
      intakeConfig: {
        pmElicitation: result?.backlog_contract?.elicitation || null,
        backlogClarifications: [],
      },
    });

    const [project, tasks] = await Promise.all([
      getProjectByUuid(projectUuid, req.authUser.uuid),
      listProjectTasks(projectUuid, {}, req.authUser.uuid),
    ]);

    res.status(201).json(
      serializeBigInts({
        project,
        tasks,
        result,
      })
    );
  } catch (error) {
    if (runLifecycle?.isFinalized()) {
      return;
    }

    if (runLifecycle) {
      await runLifecycle.finalizeFailure({
        errorMessage: error.message,
        result: error.agentDiagnostic || null,
      }).catch(() => null);
    } else if (agentRun?.id) {
      await finishAgentRun(agentRun.id, {
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => null);
    }

    if (runLifecycle?.wasAborted()) {
      return;
    }

    if (isAgentRunConflictError(error)) {
      return res.status(409).json({
        message: error.message,
        existingRunUuid: error.existingRunUuid || null,
      });
    }

    next(error);
  }
}

function getBacklogQualityReview(contract = {}) {
  return contract.qualityReview || contract.quality_review || {};
}

function withBacklogQualityReview(contract = {}, review = {}) {
  // `qualityReview` is the persisted contract format. Keep the legacy alias in
  // sync so projects generated by older PM versions remain actionable.
  return { ...contract, qualityReview: review, quality_review: review };
}

function recalculateBacklogQualityReview(review = {}) {
  const pendingProposals = (review.proposals || []).some((item) => !['accepted', 'rejected'].includes(String(item?.status || 'proposed').toLowerCase()));
  const pendingQuestions = (review.questions || []).some((item) => item?.requires_confirmation && String(item?.status || '').toLowerCase() !== 'answered');
  const hasFindings = Array.isArray(review.findings) && review.findings.length > 0;
  return {
    ...review,
    decision: pendingProposals || pendingQuestions || hasFindings ? 'REVISE' : 'PASS',
    resolvedAt: pendingProposals || pendingQuestions || hasFindings ? null : new Date().toISOString(),
  };
}

function replaceArtifactSection(content, requestedTitle, replacementBody, artifactType) {
  const aliases = artifactType === 'requirements'
    ? ['criterios de aceite', 'criterios de aceite (bdd)', 'criteria de aceite']
    : ['cenarios de teste', 'casos de teste funcionais', 'estrategia de testes', 'dados de teste', 'riscos e metricas', 'qualidade nao funcional', 'rastreabilidade dos criterios de aceite', 'smoke minimo da feature', 'usabilidade e acessibilidade'];
  const requested = String(requestedTitle || '').replace(/^#+\s*/, '').trim().toLocaleLowerCase('pt-BR');
  const candidates = [requested, ...aliases].filter(Boolean);
  const headingRegex = /^##\s+([^\n]+?)\s*$/gim;
  let match;
  while ((match = headingRegex.exec(String(content || ''))) !== null) {
    const heading = match[1].trim().toLocaleLowerCase('pt-BR');
    if (!candidates.some((candidate) => heading === candidate || heading.startsWith(`${candidate} `) || heading.startsWith(`${candidate} (`))) continue;
    const start = match.index;
    const afterHeading = start + match[0].length;
    const next = /^##\s+[^\n]+?\s*$/gim;
    next.lastIndex = afterHeading;
    const nextMatch = next.exec(String(content || ''));
    const end = nextMatch ? nextMatch.index : String(content || '').length;
    return `${String(content || '').slice(0, start)}## ${requestedTitle}\n${String(replacementBody || '').trim()}\n${String(content || '').slice(end)}`.replace(/\n{3,}/g, '\n\n');
  }
  return `${String(content || '').trim()}\n\n## ${requestedTitle}\n${String(replacementBody || '').trim()}\n`;
}

export async function publishBacklogTasksController(req, res, next) {
  try {
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');
    const tasks = await publishBacklogTasks(req.params.projectUuid);
    res.status(201).json(serializeBigInts(tasks));
  } catch (error) { next(error); }
}

export async function updateBacklogStoryController(req, res, next) {
  try {
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');
    const story = await updateBacklogStory(req.params.projectUuid, req.params.storyId, req.body, req.authUser.uuid);
    res.status(200).json(serializeBigInts(story));
  } catch (error) { next(error); }
}

export async function reviewBacklogStoryController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    await assertProjectPermission(project.uuid, req.authUser.uuid, 'editor');
    const contract = project.intakeConfig?.backlogContract || {};
    const stories = Array.isArray(contract.stories) ? contract.stories : [];
    const storedStory = stories.find((item) => String(item?.id) === String(req.params.storyId));
    if (!storedStory) return res.status(404).json({ message: 'Story não encontrada.' });
    const story = normalizeBacklogStoryForReview(storedStory);
    const reviewAnswers = mergeReviewAnswers(storedStory.reviewAnswers, req.body?.answers);
    if (!story.id || !story.title) {
      return res.status(422).json({ message: 'A story precisa ter um objetivo ou título antes da revisão.' });
    }
    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid, { agentName: 'story_reviewer' });
    const result = await runSingleAgent('story_reviewer', {
      project_id: project.uuid,
      idea: project.description || project.vision || project.name,
      briefing: {
        name: project.name,
        description: project.description,
        vision: project.vision,
        intake: project.intakeConfig,
      },
      project_dna: project.projectDna || project.intakeConfig?.projectDna || {},
      backlog_contract: contract,
      other_stories: stories.filter((item) => String(item?.id) !== String(story.id)).slice(0, 30),
      story,
      review_answers: reviewAnswers,
    }, { envOverrides });
    res.status(200).json(serializeBigInts({ success: true, review: result }));
  } catch (error) { next(error); }
}

export async function applyBacklogStoryReviewController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    await assertProjectPermission(project.uuid, req.authUser.uuid, 'editor');
    const config = project.intakeConfig || {};
    const contract = config.backlogContract || {};
    const stories = Array.isArray(contract.stories) ? [...contract.stories] : [];
    const index = stories.findIndex((item) => String(item?.id) === String(req.params.storyId));
    if (index < 0) return res.status(404).json({ message: 'Story não encontrada.' });
    if (contract.publicationStatus === 'published') return res.status(409).json({ message: 'O backlog já foi publicado e não pode ser alterado.' });

    const proposal = req.body?.proposedStory || {};
    const title = String(proposal.title || '').trim();
    if (!title) return res.status(400).json({ message: 'A proposta precisa ter um título.' });
    const answers = Array.isArray(req.body?.answers) ? req.body.answers.slice(0, 20).map((item) => ({ id: String(item?.id || ''), question: String(item?.question || ''), answer: String(item?.answer || '').trim() })) : [];
    if (answers.some((item) => !item.answer)) return res.status(400).json({ message: 'Responda todas as perguntas antes de aplicar a proposta.' });

    const current = stories[index];
    const acceptanceCriteria = Array.isArray(proposal.acceptance_criteria) ? proposal.acceptance_criteria : [];
    stories[index] = {
      ...current,
      title,
      description: String(proposal.description || current.description || '').trim(),
      actor: String(proposal.actor || current.actor || '').trim() || null,
      benefit: String(proposal.benefit || current.benefit || '').trim() || null,
      refinementContext: { ...(current.refinementContext || {}), acceptanceCriteria },
      reviewAnswers: answers,
      lastAgentReview: { assessment: req.body?.assessment || null, appliedAt: new Date().toISOString(), appliedBy: req.authUser.uuid },
    };
    await updateProjectBrief(project.uuid, { intakeConfig: { ...config, backlogContract: { ...contract, stories } } });
    res.json(serializeBigInts({ success: true, story: stories[index] }));
  } catch (error) { next(error); }
}

export async function decideBacklogProposalController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);
    if (!project) return res.status(404).json({ message: 'Projeto nÃ£o encontrado.' });
    await assertProjectPermission(project.uuid, req.authUser.uuid, 'editor');
    const contract = project.intakeConfig?.backlogContract || {};
    const review = getBacklogQualityReview(contract);
    const proposalId = String(req.params.proposalId || '');
    const decision = String(req.body?.decision || '').toLowerCase();
    if (!['accepted', 'rejected', 'edited'].includes(decision)) return res.status(400).json({ message: 'DecisÃ£o invÃ¡lida.' });
    const proposals = (review.proposals || []).map((item, index) => ({ ...item, id: item.id || `PROP-${String(index + 1).padStart(3, '0')}` }));
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) return res.status(404).json({ message: 'Proposta nÃ£o encontrada.' });
    if (decision === 'edited') proposal.capability = String(req.body?.comment || proposal.capability).trim();
    proposal.status = decision === 'edited' ? 'proposed' : decision;
    proposal.decidedBy = req.authUser.uuid;
    proposal.decidedAt = new Date().toISOString();
    proposal.comment = String(req.body?.comment || '').trim() || null;
    const questions = (review.questions || []).map((item, index) => ({ ...item, id: item.id || `CQ-${String(index + 1).padStart(3, '0')}` }));
    // Rejecting a proposal as already covered is also an explicit answer to
    // its matching capability question. This avoids asking the user to make
    // the same decision twice.
    if (decision === 'rejected' && proposal.capability) {
      questions.forEach((question) => {
        if (String(question.question || '').toLowerCase().includes(String(proposal.capability).toLowerCase())) {
          Object.assign(question, { answer: proposal.comment || 'Capacidade já coberta pelas stories aprovadas.', status: 'answered', answeredBy: req.authUser.uuid, answeredAt: new Date().toISOString() });
        }
      });
    }
    const nextReview = recalculateBacklogQualityReview({ ...review, proposals, questions });
    const nextContract = withBacklogQualityReview(contract, nextReview);
    await updateProjectBrief(project.uuid, { intakeConfig: { ...(project.intakeConfig || {}), backlogContract: nextContract } });
    res.json(serializeBigInts({ success: true, proposal, qualityReview: nextReview }));
  } catch (error) { next(error); }
}

export async function answerBacklogQuestionController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);
    if (!project) return res.status(404).json({ message: 'Projeto nÃ£o encontrado.' });
    await assertProjectPermission(project.uuid, req.authUser.uuid, 'editor');
    const contract = project.intakeConfig?.backlogContract || {};
    const review = getBacklogQualityReview(contract);
    const questionId = String(req.params.questionId || '');
    const answer = String(req.body?.answer || '').trim();
    if (!answer) return res.status(400).json({ message: 'A resposta Ã© obrigatÃ³ria.' });
    const questions = (review.questions || []).map((item, index) => ({ ...item, id: item.id || `CQ-${String(index + 1).padStart(3, '0')}` }));
    const question = questions.find((item) => item.id === questionId);
    if (!question) return res.status(404).json({ message: 'Pergunta nÃ£o encontrada.' });
    Object.assign(question, { answer, status: 'answered', answeredBy: req.authUser.uuid, answeredAt: new Date().toISOString() });
    const nextReview = recalculateBacklogQualityReview({ ...review, questions });
    await updateProjectBrief(project.uuid, { intakeConfig: { ...(project.intakeConfig || {}), backlogContract: withBacklogQualityReview(contract, nextReview) } });
    res.json(serializeBigInts({ success: true, question, qualityReview: nextReview }));
  } catch (error) { next(error); }
}

export async function applyBacklogProposalsController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);
    if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
    await assertProjectPermission(project.uuid, req.authUser.uuid, 'editor');
    const config = project.intakeConfig || {}; const contract = config.backlogContract || {}; const review = getBacklogQualityReview(contract);
    const accepted = (review.proposals || []).filter((item) => item.status === 'accepted');
    const stories = [...(contract.stories || [])];
    for (const proposal of accepted) {
      if (stories.some((story) => String(story.title || '').toLowerCase().includes(String(proposal.capability || '').toLowerCase()))) continue;
      const id = `US-${String(stories.length + 1).padStart(2, '0')}`;
      const capability = String(proposal.capability || 'capacidade aprovada').trim();
      const actor = capability.match(/segment|campanh|cobran/i) ? 'Analista de cobrança' : 'Usuário autorizado';
      stories.push({
        id,
        actor,
        goal: `executar ${capability}`,
        benefit: `garantir a cobertura de ${capability} no fluxo da campanha`,
        description: `[PROPOSTO - VALIDAR] História adicionada após confirmação humana: ${proposal.reason || 'capacidade identificada pelo Challenger'}.`,
        lane: capability.match(/aprova|decis/i) ? 'governance' : 'operation',
        priority: 'medium', release: 'MVP',
        source_ids: Array.isArray(proposal.source_ids) ? proposal.source_ids : [],
        status: 'proposed', review_tags: ['REVIEW_HUMAN_APPROVED'], open_questions: [],
        refinement_context: {
          inputs: [], outputs: [capability], confirmed_rules: [], constraints: [], dependencies: [], open_questions: ['Confirmar regra e comportamento esperado para esta capacidade.'], acceptance_hints: [],
          acceptance_criteria: [{ id: `${id}-CA-01`, given: 'o usuário autorizado está no contexto da campanha', when: `executar ${capability}`, then: 'o sistema deve registrar e apresentar o resultado esperado', source_ids: Array.isArray(proposal.source_ids) ? proposal.source_ids : [], status: 'proposed' }],
        },
      });
    }
    const questions = (review.questions || []).map((question) => {
      const isIncluded = accepted.some((proposal) => String(question.question || '').toLowerCase().includes(String(proposal.capability || '').toLowerCase()));
      return isIncluded
        ? { ...question, answer: 'Capacidade aprovada e incluída no backlog.', status: 'answered', answeredBy: req.authUser.uuid, answeredAt: new Date().toISOString() }
        : question;
    });
    const nextReview = recalculateBacklogQualityReview({ ...review, questions, appliedAt: new Date().toISOString(), appliedBy: req.authUser.uuid });
    const next = { ...withBacklogQualityReview(contract, nextReview), stories, version: Number(contract.version || 1) + 1 };
    await updateProjectBrief(project.uuid, { intakeConfig: { ...config, backlogContract: next } });
    const masterTask = await prisma.task.findFirst({ where: { projectId: project.id, title: '[SYSTEM] Backlog Master' }, select: { uuid: true } });
    if (masterTask) {
      const previousContent = JSON.stringify(contract, null, 2);
      const nextContent = JSON.stringify(next, null, 2);
      await createTaskArtifact(masterTask.uuid, { artifactType: 'backlog', title: `[SYSTEM] Backlog v${next.version}`, content: nextContent, contentFormat: 'json', createdByUserUuid: req.authUser.uuid, createdByUserId: req.authUser.id, createdByAgentName: 'backlog_challenger' });
      await createTaskArtifact(masterTask.uuid, { artifactType: 'custom', title: `[SYSTEM] Backlog diff v${next.version}`, content: JSON.stringify({ fromVersion: contract.version || 1, toVersion: next.version, generatedAt: new Date().toISOString(), generatedBy: req.authUser.uuid, previous: previousContent, current: nextContent }, null, 2), contentFormat: 'json', createdByUserUuid: req.authUser.uuid, createdByUserId: req.authUser.id, createdByAgentName: 'backlog_challenger' });
    }
    res.json(serializeBigInts({ success: true, version: next.version, stories: next.stories }));
  } catch (error) { next(error); }
}

export async function getProjectArchitectureStatusController(req, res, next) {
  try {
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');
    const status = await getProjectArchitectureStatus(req.params.projectUuid, req.authUser.uuid);
    res.json(serializeBigInts(status));
  } catch (error) {
    next(error);
  }
}

export async function getProjectDocumentationBundleController(req, res, next) {
  try {
    await assertProjectPermission(req.params.projectUuid, req.authUser.uuid, 'manager');
    const architectureStatus = await getProjectArchitectureStatus(req.params.projectUuid, req.authUser.uuid);
    if (architectureStatus?.hasArchitecture && !architectureStatus?.architectureApproved) {
      return res.status(409).json({
        message: 'A documentaÃ§Ã£o final sÃ³ pode ser exportada depois da aprovaÃ§Ã£o humana da arquitetura atual.',
        architectureStatus: serializeBigInts(architectureStatus),
      });
    }
    const bundle = await getProjectDocumentationBundle(req.params.projectUuid, req.authUser.uuid);
    res.json(serializeBigInts(bundle));
  } catch (error) {
    next(error);
  }
}

export async function approveProjectArchitectureController(req, res, next) {
  try {
    await assertProjectAccess(req.params.projectUuid, req.authUser.uuid);
    const artifact = await approveCurrentArchitectureArtifact(req.params.projectUuid, req.authUser.uuid);
    const architectureStatus = await getProjectArchitectureStatus(req.params.projectUuid, req.authUser.uuid);
    res.json(
      serializeBigInts({
        success: true,
        artifact,
        architectureStatus,
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function generateProjectArchitectureController(req, res, next) {
  let agentRun = null;
  let runLifecycle = null;

  try {
    const { projectUuid } = req.params;
    await assertProjectPermission(projectUuid, req.authUser.uuid, 'manager');

    const [project, tasks, architectureStatus] = await Promise.all([
      getProjectByUuid(projectUuid, req.authUser.uuid),
      listProjectTasks(projectUuid, {}, req.authUser.uuid),
      getProjectArchitectureStatus(projectUuid, req.authUser.uuid),
    ]);

    if (!architectureStatus.allStoriesRefined) {
      return res.status(400).json({
        message: 'A arquitetura so pode ser gerada quando todas as historias estiverem refinadas.',
        architectureStatus: serializeBigInts(architectureStatus),
      });
    }

    if (architectureStatus.hasArchitecture) {
      return res.status(409).json({
        message: 'A arquitetura deste projeto jÃ¡ foi gerada e nÃ£o pode ser executada novamente.',
        architectureStatus: serializeBigInts(architectureStatus),
      });
    }

      const refinedStories = tasks
        .filter((task) => task.taskType !== 'agent_job')
        .map((task) => {
          const requirementsArtifact = (task.artifacts || []).find(
            (artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent
          );

          return {
            taskUuid: task.uuid,
            title: task.title,
            description: clampText(task.description || '', 220),
            requirements: compactRequirementArtifact(requirementsArtifact?.content || ''),
          };
        });

      const requirementsBundle = refinedStories
        .map((story, index) =>
          [
            `## Historia ${index + 1}: ${clampText(story.title, 120)}`,
            `UUID: ${story.taskUuid}`,
            story.description ? `Contexto: ${clampText(story.description, 120)}` : null,
            story.requirements,
          ]
            .filter(Boolean)
            .join('\n\n')
        )
        .join('\n\n---\n\n');

    const payload = {
      project_id: projectUuid,
      idea: compactProjectBrief(project),
      requirements: requirementsBundle,
      project_name: project?.name || 'Projeto',
      project_context: {
        description: project?.description || '',
        vision: project?.vision || '',
        intake: project?.intakeConfig || {},
        project_dna: compactProjectDnaForAgent(project?.projectDna || project?.intakeConfig?.projectDna || null),
        backlog_contract: compactArchitectureBacklogContract(project),
        stories: refinedStories.map((story) => {
          const backlogStories = Array.isArray(project?.intakeConfig?.backlogContract?.stories)
            ? project.intakeConfig.backlogContract.stories
            : [];
          const backlogStory = backlogStories.find(
            (item) => String(item?.title || '').trim() === String(story.title || '').trim()
          );
          return {
            taskUuid: story.taskUuid,
            backlogStoryId: backlogStory?.id || null,
            title: story.title,
          };
        }),
      },
    };

    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid, { agentName: 'architect' });
    const payloadWithRuntime = withAiRuntimeMeta(payload, envOverrides);
    agentRun = await createAgentRunStart(projectUuid, 'architect', payloadWithRuntime);
    runLifecycle = createAgentRunLifecycle(req, res, agentRun, finishAgentRun);
    const result = await runSingleAgent('architect', payloadWithRuntime, { envOverrides });
    assertArtifactCompleteness('architect', typeof result === 'string' ? result : JSON.stringify(result, null, 2));

    const finalized = await runLifecycle.finalizeSuccess({
      result,
      usageMeta: buildAgentRunUsage(payloadWithRuntime, result, envOverrides),
    });

    if (!finalized) {
      return;
    }

    await persistAgentResult(projectUuid, 'architect', payloadWithRuntime, result);
    const generatedApp = await bootstrapGeneratedApp(projectUuid);
    const updatedArchitectureStatus = await getProjectArchitectureStatus(projectUuid, req.authUser.uuid);

    res.status(201).json(
      serializeBigInts({
        success: true,
        architectureStatus: updatedArchitectureStatus,
        generatedApp,
        data: result,
      })
    );
  } catch (error) {
    if (runLifecycle?.isFinalized()) {
      return;
    }

    if (runLifecycle) {
      await runLifecycle.finalizeFailure({ errorMessage: error.message }).catch(() => null);
    } else if (agentRun?.id) {
      await finishAgentRun(agentRun.id, {
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => null);
    }

    if (runLifecycle?.wasAborted()) {
      return;
    }

    if (isAgentRunConflictError(error)) {
      return res.status(409).json({
        message: error.message,
        existingRunUuid: error.existingRunUuid || null,
      });
    }

    next(error);
  }
}

export async function createTaskArtifactController(req, res, next) {
  try {
    const { artifactType, title, content } = req.body;

    if (!artifactType || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'artifactType, title e content sao obrigatorios.' });
    }

    await assertTaskAccess(req.params.taskUuid, req.authUser.uuid);
    const existingTask = await getTaskByUuid(req.params.taskUuid, req.authUser.uuid);
    await assertProjectPermission(existingTask.project.uuid, req.authUser.uuid, 'editor');

    const artifact = await createTaskArtifact(req.params.taskUuid, {
      ...req.body,
      createdByUserUuid: req.authUser.uuid,
      createdByUserId: req.authUser.id,
    });
    res.status(201).json(serializeBigInts(artifact));
  } catch (error) {
    next(error);
  }
}

export async function repairTaskArtifactController(req, res, next) {
  try {
    const task = await getTaskByUuid(req.params.taskUuid, req.authUser.uuid);
    if (!task) return res.status(404).json({ message: 'Tarefa não encontrada.' });
    const artifact = (task.artifacts || []).find((item) => item.uuid === req.params.artifactUuid && item.isCurrent);
    if (!artifact) return res.status(404).json({ message: 'Artefato atual não encontrado.' });
    const relatedRequirement = artifact.artifactType === 'test_plan'
      ? (task.artifacts || []).find((item) => item.artifactType === 'requirements' && item.isCurrent)?.content || `${task.title}\n${task.description || ''}`
      : `${task.title}\n${task.description || ''}`;
    const suppliedReport = req.body?.qualityReport || {};
    const currentReport = evaluateArtifactQuality({ artifactType: artifact.artifactType, content: artifact.content, relatedRequirement });
    const findings = suppliedReport.findings?.length ? suppliedReport.findings : currentReport.findings;
    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid, { agentName: 'artifact_repair' });
    const result = await runSingleAgent('artifact_repair', {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      artifact_type: artifact.artifactType,
      current_artifact: artifact.content,
      findings: findings?.length ? findings : (req.body?.findings || []),
      source_context: `${task.title}\n${task.description || ''}`,
      idea: `Reparar somente o artefato ${artifact.artifactType}`,
    }, { envOverrides });
    const sectionTitle = String(result.section || '').replace(/^#+\s*/, '').trim();
    let patchedContent = replaceArtifactSection(artifact.content, sectionTitle, result.content, artifact.artifactType);
    // Garantia determinística: um reparo não pode continuar sem a seção que
    // o Quality Gate apontou. O texto é explicitamente proposto para revisão
    // humana, sem inventar regra de negócio.
    if (artifact.artifactType === 'requirements' && currentReport.findings?.some((item) => item.code === 'missing_section' && /criterios de aceite/i.test(item.message))) {
      const hasAcceptance = /^##\s+Criterios de Aceite(?:\s+\(BDD\))?\s*$/im.test(patchedContent);
      if (!hasAcceptance) {
        patchedContent = `${patchedContent.trim()}\n\n## Criterios de Aceite\n- [PROPOSTO - VALIDAR] DADO o ator autorizado e o contexto descrito na User Story, QUANDO executar a ação principal, ENTÃO o sistema deve apresentar o resultado esperado descrito na história.\n`;
      }
    }
    if (currentReport.findings?.some((item) => item.code === 'contradictory_not_applicable')) {
      patchedContent = patchedContent.replace(/n[aã]o se aplica/gi, 'A validar com o responsável');
    }
    const nextArtifact = await createTaskArtifact(task.uuid, {
      artifactType: artifact.artifactType,
      title: artifact.title,
      content: patchedContent,
      contentFormat: artifact.contentFormat,
      createdByAgentName: 'artifact_repair',
    });
    const repairedReport = evaluateArtifactQuality({ artifactType: artifact.artifactType, content: patchedContent, relatedRequirement });
    res.status(201).json(serializeBigInts({ success: true, artifact: nextArtifact, patch: result, qualityReport: repairedReport }));
  } catch (error) {
    next(error);
  }
}

export async function reviewTaskArtifactController(req, res, next) {
  try {
    const artifact = await reviewTaskArtifact(req.params.taskUuid, req.params.artifactUuid, {
      approved: req.body?.approved,
      comment: req.body?.comment,
      userUuid: req.authUser.uuid,
    });
    res.json(serializeBigInts({ success: true, artifact }));
  } catch (error) {
    next(error);
  }
}

export async function addProjectMemberController(req, res, next) {
  try {
    const project = await addProjectMember(req.params.projectUuid, req.body || {}, req.authUser.uuid);
    res.status(201).json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function updateProjectMemberController(req, res, next) {
  try {
    const project = await updateProjectMemberRole(
      req.params.projectUuid,
      req.params.memberUuid,
      req.body || {},
      req.authUser.uuid
    );
    res.json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function removeProjectMemberController(req, res, next) {
  try {
    const project = await removeProjectMember(req.params.projectUuid, req.params.memberUuid, req.authUser.uuid);
    res.json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}
