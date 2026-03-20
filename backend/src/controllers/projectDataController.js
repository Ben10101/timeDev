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
import { serializeBigInts } from '../utils/serialize.js';

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
      idea: idea.trim(),
      answers: answers || {},
    };

    agentRun = await createAgentRunStart(projectUuid, 'project_manager', payload);
    const result = await runSingleAgent('project_manager', payload);

    await finishAgentRun(agentRun.id, {
      status: 'completed',
      result,
    });

    await persistAgentResult(projectUuid, 'project_manager', payload, result);

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
