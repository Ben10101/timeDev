import { runSingleAgent } from '../services/orchestratorService.js';
import { buildRuntimeAiEnvForUser } from '../services/aiSettingsService.js';
import { v4 as uuidv4 } from 'uuid';
import {
  assertTaskAccess,
  createAgentRunStart,
  createTaskArtifact,
  ensurePipelineProject,
  finishAgentRun,
  getTaskContextByUuid,
  persistAgentResult,
  restoreTaskAfterAgentFailure,
  updateTask,
} from '../services/projectDataService.js';
import { serializeBigInts } from '../utils/serialize.js';

function compactText(value = '', maxLength = 220) {
  const text = String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function buildCompactRequirementBacklog(task) {
  return [
    `Historia alvo: ${compactText(task.title, 140)}`,
    task.description ? `Contexto imediato: ${compactText(task.description, 180)}` : null,
    task.project?.description ? `Projeto: ${compactText(task.project.description, 140)}` : null,
    task.project?.vision ? `Visao: ${compactText(task.project.vision, 160)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractCompactRequirementSection(content = '', sectionTitle = '', maxLength = 260) {
  const normalized = String(content || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = normalized.match(new RegExp(`##+\\s+${escaped}\\s*([\\s\\S]*?)(?=\\n##+\\s+|$)`, 'i'));
  return compactText(match ? match[1] : '', maxLength);
}

function buildQaRequirementSummary(requirementsContent = '') {
  const userStory = extractCompactRequirementSection(requirementsContent, 'User Story Refinada', 180);
  const functional = extractCompactRequirementSection(requirementsContent, 'Requisitos Funcionais', 360);
  const mainFlow = extractCompactRequirementSection(requirementsContent, 'Fluxo Principal', 220);
  const rules = extractCompactRequirementSection(requirementsContent, 'Regras de Negocio', 220);
  const acceptance = extractCompactRequirementSection(requirementsContent, 'Criterios de Aceite (BDD)', 260);

  return [
    userStory ? `User Story Refinada:\n${userStory}` : null,
    functional ? `Requisitos Funcionais:\n${functional}` : null,
    mainFlow ? `Fluxo Principal:\n${mainFlow}` : null,
    rules ? `Regras de Negocio:\n${rules}` : null,
    acceptance ? `Criterios de Aceite:\n${acceptance}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function hasBrokenEnding(content = '') {
  const text = (content || '').trimEnd();
  if (!text) return true;
  if (text.endsWith('```') || text.endsWith('**')) return true;
  return /[:|*_\-\/(\[{,;]$/.test(text);
}

function assertArtifactCompleteness(agentName, content) {
  const normalized = (content || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!content?.trim()) {
    throw new Error(`O agente ${agentName} retornou um artefato vazio.`);
  }

  if (agentName === 'requirements_analyst') {
    const requiredSections = [
      'user story refinada',
      'requisitos funcionais',
      'fluxo principal',
      'fluxos alternativos',
      'fluxos de excecao',
      'regras de negocio',
      'criterios de aceite',
    ];

    for (const section of requiredSections) {
      if (!normalized.includes(section)) {
        throw new Error(`O artefato de requisitos foi retornado de forma incompleta: secao ausente (${section}).`);
      }
    }

    if (!normalized.includes('dado') || !normalized.includes('quando') || !normalized.includes('entao')) {
      throw new Error('O artefato de requisitos foi retornado sem criterios de aceite BDD completos.');
    }
  }

  if (agentName === 'qa_engineer') {
    const requiredSections = [
      'estrategia de testes',
      'dados de teste',
      'riscos e metricas',
      'cenarios de teste',
      'casos de teste funcionais',
      'usabilidade e acessibilidade',
    ];

    for (const section of requiredSections) {
      if (!normalized.includes(section)) {
        throw new Error(`O plano de testes foi retornado de forma incompleta: secao ausente (${section}).`);
      }
    }

    if (!normalized.includes('ct01')) {
      throw new Error('O plano de testes foi retornado sem casos de teste funcionais completos.');
    }
  }

  if (hasBrokenEnding(content)) {
    throw new Error(`O agente ${agentName} retornou um texto aparentemente truncado no final.`);
  }
}

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
    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid);

    const result = await runSingleAgent(agent, payload, { envOverrides });
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
  let previousTaskState = null;

  try {
    const { taskUuid } = req.params;
    await assertTaskAccess(taskUuid, req.authUser.uuid);
    const task = await getTaskContextByUuid(taskUuid, req.authUser.uuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    previousTaskState = {
      status: task.status,
      assigneeType: task.assigneeType,
      assigneeUserId: task.assigneeUserId,
      assigneeAgentName: task.assigneeAgentName,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      currentArtifactSummary: task.currentArtifactSummary,
    };

    const latestRequirements = task.artifacts.find(
      (artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent
    );

    if (latestRequirements) {
      return res.status(400).json({
        message: 'A etapa de requisitos desta task ja foi concluida e nao pode ser executada novamente.',
      });
    }

    await updateTask(taskUuid, {
      status: 'in_progress',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
      changedByUserUuid: req.authUser.uuid,
      statusNote: 'Task enviada para o Analista de Requisitos',
    });

    const payload = {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      idea: `Refine somente esta historia de usuario: ${task.title}${
        task.description ? `\n\nContexto complementar da tarefa: ${task.description}` : ''
      }`,
      backlog: buildCompactRequirementBacklog(task),
      project_name: task.project.name,
      project_context: {
        description: compactText(task.project.description, 180),
        vision: compactText(task.project.vision, 220),
      },
    };

    agentRun = await createAgentRunStart(task.project.uuid, 'requirements_analyst', payload);
    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid);
    const result = await runSingleAgent('requirements_analyst', payload, { envOverrides });
    const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    assertArtifactCompleteness('requirements_analyst', content);

    await finishAgentRun(agentRun.id, { status: 'completed', result });

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
    if (previousTaskState) {
      await restoreTaskAfterAgentFailure(req.params.taskUuid, previousTaskState, {
        changedByUserUuid: req.authUser.uuid,
        failedAgentName: 'requirements_analyst',
        errorMessage: error.message,
      }).catch(() => null);
    }
    console.error(`[AgentController] Error running requirements for task: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o Analista de Requisitos', error: error.message });
  }
}

export async function runQaForTaskController(req, res) {
  let agentRun = null;
  let previousTaskState = null;

  try {
    const { taskUuid } = req.params;
    await assertTaskAccess(taskUuid, req.authUser.uuid);
    const task = await getTaskContextByUuid(taskUuid, req.authUser.uuid);

    if (!task) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    previousTaskState = {
      status: task.status,
      assigneeType: task.assigneeType,
      assigneeUserId: task.assigneeUserId,
      assigneeAgentName: task.assigneeAgentName,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      currentArtifactSummary: task.currentArtifactSummary,
    };

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

    if (latestTestPlan) {
      return res.status(400).json({
        message: 'A etapa de QA desta task ja foi concluida e nao pode ser executada novamente.',
      });
    }

    await updateTask(taskUuid, {
      status: 'qa',
      assigneeType: 'agent',
      assigneeAgentName: 'qa_engineer',
      changedByUserUuid: req.authUser.uuid,
      statusNote: 'Task enviada para QA',
    });

    const requirementSummary = buildQaRequirementSummary(latestRequirements.content);

    const payload = {
      project_id: task.project.uuid,
      task_uuid: task.uuid,
      idea: `Crie o plano de testes apenas para esta tarefa: ${task.title}${
        task.description ? `\n\nContexto especifico da tarefa: ${task.description}` : ''
      }`,
      code_structure: requirementSummary,
      developer_output: {
        code: requirementSummary,
      },
      project_name: task.project.name,
      project_context: {
        description: compactText(task.project.description, 180),
        vision: compactText(task.project.vision, 220),
      },
      requirement_summary: requirementSummary,
    };

    agentRun = await createAgentRunStart(task.project.uuid, 'qa_engineer', payload);
    const envOverrides = await buildRuntimeAiEnvForUser(req.authUser.uuid);
    const result = await runSingleAgent('qa_engineer', payload, { envOverrides });
    const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    assertArtifactCompleteness('qa_engineer', content);

    await finishAgentRun(agentRun.id, { status: 'completed', result });

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
    if (previousTaskState) {
      await restoreTaskAfterAgentFailure(req.params.taskUuid, previousTaskState, {
        changedByUserUuid: req.authUser.uuid,
        failedAgentName: 'qa_engineer',
        errorMessage: error.message,
      }).catch(() => null);
    }
    console.error(`[AgentController] Error running QA for task: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o QA Engineer', error: error.message });
  }
}
