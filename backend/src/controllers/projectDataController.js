import {
  assertProjectAccess,
  assertTaskAccess,
  assertWorkspaceAccess,
  createAgentRunStart,
  createProject,
  createTask,
  createTaskArtifact,
  createTaskComment,
  ensurePipelineProject,
  finishAgentRun,
  getDefaultWorkspaceForUserUuid,
  getProjectArchitectureStatus,
  getProjectByUuid,
  getTaskByUuid,
  importBacklogTasks,
  listProjects,
  listProjectTasks,
  listAllTasks,
  persistAgentResult,
  updateProjectBrief,
  updateTask,
} from '../services/projectDataService.js';
import { runSingleAgent } from '../services/orchestratorService.js';
import { buildRuntimeAiEnvForUser } from '../services/aiSettingsService.js';
import { bootstrapGeneratedApp } from '../services/implementationService.js';
import { serializeBigInts } from '../utils/serialize.js';
import { buildAgentRunUsage, withAiRuntimeMeta } from '../utils/aiRunMetrics.js';

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
  const entries = Object.entries(answers || {})
    .map(([key, value]) => `${key}: ${clampText(typeof value === 'string' ? value : JSON.stringify(value), 120)}`)
    .slice(0, 8);

  return [
    clampText(idea, 480),
    entries.length ? `Respostas-chave:\n- ${entries.join('\n- ')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function listProjectsController(req, res, next) {
  try {
    const projects = await listProjects(req.authUser.uuid);
    res.json(serializeBigInts(projects));
  } catch (error) {
    next(error);
  }
}

export async function bootstrapController(_req, res) {
  res.status(410).json({
    message: 'Bootstrap publico desativado. Use /api/auth/register para criar sua conta com seguranca.',
  });
}

export async function getProjectController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid, req.authUser.uuid);

    if (!project) {
      return res.status(404).json({ message: 'Projeto nao encontrado.' });
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
        message: 'Nenhum workspace disponivel para este usuario.',
      });
    }

    const project = await createProject({
      workspaceUuid: workspace.uuid,
      createdByUuid: req.authUser.uuid,
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
    });

    res.status(201).json(serializeBigInts(project));
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

    await assertProjectAccess(req.params.projectUuid, req.authUser.uuid);

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
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
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
    await assertProjectAccess(req.params.projectUuid, req.authUser.uuid);

    const tasks = await importBacklogTasks(req.params.projectUuid, backlogMarkdown);
    res.status(201).json(serializeBigInts(tasks));
  } catch (error) {
    next(error);
  }
}

export async function generateProjectBacklogController(req, res, next) {
  let agentRun = null;

  try {
    const { projectUuid } = req.params;
    const { idea, answers, description, vision } = req.body;

    if (!idea?.trim()) {
      return res.status(400).json({ message: 'idea e obrigatorio.' });
    }

    await assertProjectAccess(projectUuid, req.authUser.uuid);

    await updateProjectBrief(projectUuid, {
      description,
      vision,
      intakeConfig: {
        idea: idea.trim(),
        answers: answers || {},
        lastGeneratedAt: new Date().toISOString(),
      },
    });

    const payload = {
      project_id: projectUuid,
      idea: compactBacklogInput(idea.trim(), answers || {}),
      answers: {},
    };

    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid);
    const payloadWithRuntime = withAiRuntimeMeta(payload, envOverrides);
    agentRun = await createAgentRunStart(projectUuid, 'project_manager', payloadWithRuntime);
    const result = await runSingleAgent('project_manager', payloadWithRuntime, { envOverrides });

    await finishAgentRun(agentRun.id, {
      status: 'completed',
      result,
      usageMeta: buildAgentRunUsage(payloadWithRuntime, result, envOverrides),
    });

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
    if (agentRun?.id) {
      await finishAgentRun(agentRun.id, {
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => null);
    }

    next(error);
  }
}

export async function getProjectArchitectureStatusController(req, res, next) {
  try {
    await assertProjectAccess(req.params.projectUuid, req.authUser.uuid);
    const status = await getProjectArchitectureStatus(req.params.projectUuid, req.authUser.uuid);
    res.json(serializeBigInts(status));
  } catch (error) {
    next(error);
  }
}

export async function generateProjectArchitectureController(req, res, next) {
  let agentRun = null;

  try {
    const { projectUuid } = req.params;
    await assertProjectAccess(projectUuid, req.authUser.uuid);

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
        stories: refinedStories.map((story) => ({
          taskUuid: story.taskUuid,
          title: story.title,
        })),
      },
    };

    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid);
    const payloadWithRuntime = withAiRuntimeMeta(payload, envOverrides);
    agentRun = await createAgentRunStart(projectUuid, 'architect', payloadWithRuntime);
    const result = await runSingleAgent('architect', payloadWithRuntime, { envOverrides });

    await finishAgentRun(agentRun.id, {
      status: 'completed',
      result,
      usageMeta: buildAgentRunUsage(payloadWithRuntime, result, envOverrides),
    });

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
    if (agentRun?.id) {
      await finishAgentRun(agentRun.id, {
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => null);
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
