import {
  bootstrapWorkspaceAndUser,
  createTaskArtifact,
  createAgentRunStart,
  createProject,
  createTaskComment,
  createTask,
  ensurePipelineProject,
  finishAgentRun,
  getProjectByUuid,
  getTaskByUuid,
  importBacklogTasks,
  listProjects,
  listProjectTasks,
  persistAgentResult,
  updateTask,
  updateProjectBrief,
} from '../services/projectDataService.js';
import { runSingleAgent } from '../services/orchestratorService.js';
import { serializeBigInts } from '../utils/serialize.js';

export async function listProjectsController(req, res, next) {
  try {
    const projects = await listProjects();
    res.json(serializeBigInts(projects));
  } catch (error) {
    next(error);
  }
}

export async function bootstrapController(req, res, next) {
  try {
    const { userName, email, workspaceName } = req.body;

    if (!userName?.trim() || !email?.trim() || !workspaceName?.trim()) {
      return res.status(400).json({
        message: 'userName, email e workspaceName são obrigatórios.',
      });
    }

    const result = await bootstrapWorkspaceAndUser({ userName, email, workspaceName });
    res.status(201).json(serializeBigInts(result));
  } catch (error) {
    next(error);
  }
}

export async function getProjectController(req, res, next) {
  try {
    const project = await getProjectByUuid(req.params.projectUuid);

    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado.' });
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
      createdByUuid,
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

    if (!workspaceUuid || !createdByUuid || !name?.trim()) {
      return res.status(400).json({
        message: 'workspaceUuid, createdByUuid e name são obrigatórios.',
      });
    }

    const project = await createProject({
      workspaceUuid,
      createdByUuid,
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
    const tasks = await listProjectTasks(req.params.projectUuid, {
      status: req.query.status,
      parentTaskUuid: req.query.parentTaskUuid,
    });

    res.json(serializeBigInts(tasks));
  } catch (error) {
    next(error);
  }
}

export async function createTaskController(req, res, next) {
  try {
    const { title, createdByUuid } = req.body;

    if (!title?.trim() || !createdByUuid) {
      return res.status(400).json({
        message: 'title e createdByUuid são obrigatórios.',
      });
    }

    const task = await createTask(req.params.projectUuid, req.body);
    res.status(201).json(serializeBigInts(task));
  } catch (error) {
    next(error);
  }
}

export async function updateTaskController(req, res, next) {
  try {
    const task = await updateTask(req.params.taskUuid, req.body);
    res.json(serializeBigInts(task));
  } catch (error) {
    next(error);
  }
}

export async function getTaskController(req, res, next) {
  try {
    const task = await getTaskByUuid(req.params.taskUuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa não encontrada.' });
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
      return res.status(400).json({ message: 'body é obrigatório.' });
    }

    const comment = await createTaskComment(req.params.taskUuid, req.body);
    res.status(201).json(serializeBigInts(comment));
  } catch (error) {
    next(error);
  }
}

export async function ensurePipelineProjectController(req, res, next) {
  try {
    const { projectUuid, idea } = req.body;

    if (!projectUuid?.trim()) {
      return res.status(400).json({ message: 'projectUuid é obrigatório.' });
    }

    const project = await ensurePipelineProject(projectUuid, idea);
    res.status(201).json(serializeBigInts(project));
  } catch (error) {
    next(error);
  }
}

export async function importBacklogTasksController(req, res, next) {
  try {
    const { backlogMarkdown } = req.body;

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
      return res.status(400).json({ message: 'idea é obrigatório.' });
    }

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

    const [project, tasks] = await Promise.all([getProjectByUuid(projectUuid), listProjectTasks(projectUuid)]);

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
      return res.status(400).json({ message: 'artifactType, title e content são obrigatórios.' });
    }

    const artifact = await createTaskArtifact(req.params.taskUuid, req.body);
    res.status(201).json(serializeBigInts(artifact));
  } catch (error) {
    next(error);
  }
}
