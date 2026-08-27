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
    const { idea, answers, description, vision } = req.body;

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
        lastGeneratedAt: new Date().toISOString(),
      },
    });

    const refreshedProject = await getProjectByUuid(projectUuid, req.authUser.uuid);
    const projectDnaContext = compactProjectDnaForAgent(refreshedProject?.projectDna || null);

    const payload = {
      project_id: projectUuid,
      idea: [compactBacklogInput(idea.trim(), answers || {}), projectDnaContext].filter(Boolean).join('\n\n'),
      answers: {},
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

    if (result?.clarification_required) {
      // Keep the requirements gate recoverable after a browser refresh. No
      // backlog has been published here, so no stories/tasks are created.
      await updateProjectBrief(projectUuid, {
        intakeConfig: {
          requirementsContract: result.requirements_contract || null,
          backlogClarifications: result.clarifications || [],
        },
      });
      const [project, tasks] = await Promise.all([
        getProjectByUuid(projectUuid, req.authUser.uuid),
        listProjectTasks(projectUuid, {}, req.authUser.uuid),
      ]);
      return res.status(200).json(serializeBigInts({ project, tasks, result }));
    }

    await persistAgentResult(projectUuid, 'project_manager', payloadWithRuntime, result);

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
    const story = await updateBacklogStory(req.params.projectUuid, req.params.storyId, req.body);
    res.status(200).json(serializeBigInts(story));
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
    const result = await runSingleAgent('artifact_repair', {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      artifact_type: artifact.artifactType,
      current_artifact: artifact.content,
      findings: findings?.length ? findings : (req.body?.findings || []),
      source_context: `${task.title}\n${task.description || ''}`,
      idea: `Reparar somente o artefato ${artifact.artifactType}`,
    });
    const sectionTitle = String(result.section || '').replace(/^#+\s*/, '').trim();
    const sectionRegex = new RegExp(`(^##\\s+${sectionTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$)([\\s\\S]*?)(?=^##\\s+|$)`, 'im');
    const replacement = `## ${sectionTitle}\n${String(result.content).trim()}\n`;
    const patchedContent = sectionRegex.test(artifact.content)
      ? artifact.content.replace(sectionRegex, replacement)
      : `${artifact.content.trim()}\n\n${replacement}`;
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
