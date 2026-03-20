import { runSingleAgent } from '../services/orchestratorService.js';
import { v4 as uuidv4 } from 'uuid';
import {
  assertTaskAccess,
  createAgentRunStart,
  createTaskArtifact,
  ensurePipelineProject,
  finishAgentRun,
  getTaskContextByUuid,
  persistAgentResult,
  updateTask,
} from '../services/projectDataService.js';
import { serializeBigInts } from '../utils/serialize.js';

export async function runAgentController(req, res) {
  let agentRun = null;
  try {
    const { agent, payload } = req.body;

    if (!agent || !payload || !payload.idea) {
      return res.status(400).json({ message: 'Nome do agente e payload com a ideia sao obrigatorios.' });
    }

    if (!payload.project_id) {
      payload.project_id = uuidv4();
    }

    await ensurePipelineProject(payload.project_id, payload.idea, req.authUser.uuid);
    agentRun = await createAgentRunStart(payload.project_id, agent, payload);

    const result = await runSingleAgent(agent, payload);
    await finishAgentRun(agentRun.id, { status: 'completed', result });
    await persistAgentResult(payload.project_id, agent, payload, result);

    res.status(200).json({
      success: true,
      project_id: payload.project_id,
      data: result,
    });
  } catch (error) {
    if (agentRun?.id) {
      await finishAgentRun(agentRun.id, { status: 'failed', errorMessage: error.message });
    }
    console.error(`[AgentController] Error: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o agente de IA', error: error.message });
  }
}

export async function runRequirementsForTaskController(req, res) {
  let agentRun = null;

  try {
    const { taskUuid } = req.params;
    await assertTaskAccess(taskUuid, req.authUser.uuid);
    const task = await getTaskContextByUuid(taskUuid, req.authUser.uuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    const latestRequirements = task.artifacts.find(
      (artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent
    );

    await updateTask(taskUuid, {
      status: 'in_progress',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
      changedByUserUuid: req.authUser.uuid,
      statusNote: latestRequirements
        ? 'Refinamento de requisitos reiniciado'
        : 'Task enviada para o Analista de Requisitos',
    });

    const payload = {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      idea: `Refine somente esta historia de usuario: ${task.title}${
        task.description ? `\n\nContexto complementar da tarefa: ${task.description}` : ''
      }`,
      backlog: [`Historia: ${task.title}`, task.description ? `Contexto: ${task.description}` : null]
        .filter(Boolean)
        .join('\n'),
      project_name: task.project.name,
      project_context: {
        description: task.project.description,
        vision: task.project.vision,
        intake: task.project.intakeConfig || {},
      },
    };

    agentRun = await createAgentRunStart(task.project.uuid, 'requirements_analyst', payload);
    const result = await runSingleAgent('requirements_analyst', payload);

    await finishAgentRun(agentRun.id, { status: 'completed', result });

    const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    await createTaskArtifact(task.uuid, {
      artifactType: 'requirements',
      title: `Requisitos refinados - ${task.title}`,
      content,
      contentFormat: 'markdown',
      createdByAgentName: 'requirements_analyst',
      agentRunId: agentRun.id,
    });

    const updatedTask = await updateTask(taskUuid, {
      status: 'in_review',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
      changedByUserUuid: req.authUser.uuid,
      statusNote: 'Refinamento de requisitos concluido',
    });

    res.status(200).json(
      serializeBigInts({
        success: true,
        task: updatedTask,
        data: result,
      })
    );
  } catch (error) {
    if (agentRun?.id) {
      await finishAgentRun(agentRun.id, { status: 'failed', errorMessage: error.message }).catch(() => null);
    }
    console.error(`[AgentController] Error running requirements for task: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o Analista de Requisitos', error: error.message });
  }
}

export async function runQaForTaskController(req, res) {
  let agentRun = null;

  try {
    const { taskUuid } = req.params;
    await assertTaskAccess(taskUuid, req.authUser.uuid);
    const task = await getTaskContextByUuid(taskUuid, req.authUser.uuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    const latestRequirements = task.artifacts.find(
      (artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent
    );

    if (!latestRequirements) {
      return res.status(400).json({
        message: 'A task precisa ter requisitos refinados antes de seguir para QA.',
      });
    }

    const latestTestPlan = task.artifacts.find(
      (artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent
    );

    await updateTask(taskUuid, {
      status: 'qa',
      assigneeType: 'agent',
      assigneeAgentName: 'qa_engineer',
      changedByUserUuid: req.authUser.uuid,
      statusNote: latestTestPlan ? 'Plano de testes reiniciado' : 'Task enviada para QA',
    });

    const payload = {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      idea: `Crie o plano de testes apenas para esta tarefa: ${task.title}${
        task.description ? `\n\nContexto especifico da tarefa: ${task.description}` : ''
      }`,
      code_structure: latestRequirements.content,
      developer_output: {
        code: latestRequirements.content,
      },
      project_name: task.project.name,
      project_context: {
        description: task.project.description,
        vision: task.project.vision,
        intake: task.project.intakeConfig || {},
      },
      requirement_summary: latestRequirements.content,
    };

    agentRun = await createAgentRunStart(task.project.uuid, 'qa_engineer', payload);
    const result = await runSingleAgent('qa_engineer', payload);

    await finishAgentRun(agentRun.id, { status: 'completed', result });

    const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    await createTaskArtifact(task.uuid, {
      artifactType: 'test_plan',
      title: `Plano de testes - ${task.title}`,
      content,
      contentFormat: 'markdown',
      createdByAgentName: 'qa_engineer',
      agentRunId: agentRun.id,
    });

    const updatedTask = await updateTask(taskUuid, {
      status: 'done',
      assigneeType: 'agent',
      assigneeAgentName: 'qa_engineer',
      changedByUserUuid: req.authUser.uuid,
      statusNote: 'Plano de testes concluido',
    });

    res.status(200).json(
      serializeBigInts({
        success: true,
        task: updatedTask,
        data: result,
      })
    );
  } catch (error) {
    if (agentRun?.id) {
      await finishAgentRun(agentRun.id, { status: 'failed', errorMessage: error.message }).catch(() => null);
    }
    console.error(`[AgentController] Error running QA for task: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o QA Engineer', error: error.message });
  }
}
