const API_BASE = process.env.PLATFORM_E2E_API_URL || 'http://localhost:3001/api';
const RUN_EXPENSIVE = process.env.PLATFORM_E2E_EXPENSIVE === '1';

function uniqueEmail() {
  return `platform.e2e.${Date.now()}@example.com`;
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await parseJson(response);
  return { response, data };
}

function assertOk(result, message) {
  if (!result.response.ok) {
    throw new Error(`${message}: ${JSON.stringify(result.data)}`);
  }
}

async function main() {
  const health = await fetch(API_BASE.replace(/\/api$/, '') + '/health');
  if (!health.ok) throw new Error(`Health check falhou: ${health.status}`);

  const unauthorizedMe = await request('/auth/me');
  if (unauthorizedMe.response.ok) {
    throw new Error('Esperava falha em /auth/me sem autenticacao.');
  }

  const email = uniqueEmail();
  const password = 'SenhaForte123!';
  const register = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Platform E2E',
      email,
      password,
      workspaceName: 'Workspace E2E',
    }),
  });

  if (!register.response.ok || !register.data?.accessToken) {
    throw new Error(`Falha ao registrar usuario E2E: ${JSON.stringify(register.data)}`);
  }

  const authHeaders = { Authorization: `Bearer ${register.data.accessToken}` };
  const me = await request('/auth/me', { headers: authHeaders });
  if (!me.response.ok || me.data?.user?.email !== email) {
    throw new Error('Sessao autenticada nao retornou o usuario esperado.');
  }

  const alignment = await request('/alignment/analyze', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      input: 'Como gerente de operacoes, preciso aprovar reembolsos acima de R$ 500 com dupla validacao para reduzir fraude.',
    }),
  });

  if (
    !alignment.response.ok ||
    !alignment.data?.user_story ||
    !Array.isArray(alignment.data?.acceptance_criteria) ||
    !alignment.data?.clarity_score
  ) {
    throw new Error(`Falha ao validar o fluxo principal do Aligna: ${JSON.stringify(alignment.data)}`);
  }

  const createdProject = await request('/projects', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Projeto E2E ${Date.now()}`,
      description: 'Projeto de smoke test automatizado',
      vision: 'Validar fluxo principal da plataforma',
    }),
  });

  if (!createdProject.response.ok || !createdProject.data?.uuid) {
    throw new Error(`Falha ao criar projeto: ${JSON.stringify(createdProject.data)}`);
  }

  const createdTask = await request(`/projects/${createdProject.data.uuid}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Task E2E ${Date.now()}`,
      description: 'Task criada pelo smoke test da plataforma',
      status: 'backlog',
      priority: 'medium',
      taskType: 'task',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
      createdByUuid: register.data.user.uuid,
    }),
  });
  assertOk(createdTask, 'Falha ao criar task');

  const projects = await request('/projects', { headers: authHeaders });
  if (!projects.response.ok || !Array.isArray(projects.data) || !projects.data.some((item) => item.uuid === createdProject.data.uuid)) {
    throw new Error('Projeto criado nao apareceu na listagem.');
  }

  const projectTasks = await request(`/projects/${createdProject.data.uuid}/tasks`, { headers: authHeaders });
  if (!projectTasks.response.ok || !Array.isArray(projectTasks.data) || !projectTasks.data.some((item) => item.uuid === createdTask.data.uuid)) {
    throw new Error('Task criada nao apareceu no board do projeto.');
  }

  const taskDetails = await request(`/tasks/${createdTask.data.uuid}`, { headers: authHeaders });
  if (!taskDetails.response.ok || taskDetails.data?.uuid !== createdTask.data.uuid) {
    throw new Error('Falha ao consultar detalhe da task criada.');
  }

  const comment = await request(`/tasks/${createdTask.data.uuid}/comments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      body: 'Comentario criado pelo smoke test E2E.',
      authorUserUuid: register.data.user.uuid,
    }),
  });
  assertOk(comment, 'Falha ao registrar comentario da task');

  const architectureStatus = await request(`/projects/${createdProject.data.uuid}/architecture/status`, { headers: authHeaders });
  if (!architectureStatus.response.ok) {
    throw new Error('Falha ao consultar status de arquitetura do projeto.');
  }

  const observability = await request('/observability/ai', { headers: authHeaders });
  if (!observability.response.ok || !observability.data?.summary) {
    throw new Error('Falha ao consultar observabilidade da plataforma.');
  }

  if (!Array.isArray(observability.data?.reliability?.topFailingAgents)) {
    throw new Error('Observabilidade nao retornou a secao de confiabilidade esperada.');
  }

  const readiness = await request('/observability/readiness', { headers: authHeaders });
  if (!readiness.response.ok || !Array.isArray(readiness.data?.checks) || !readiness.data?.release?.version) {
    throw new Error('Falha ao consultar readiness premium da plataforma.');
  }

  const auditTrail = await request('/observability/audit?limit=5', { headers: authHeaders });
  if (!auditTrail.response.ok || !Array.isArray(auditTrail.data)) {
    throw new Error('Falha ao consultar trilha de auditoria da plataforma.');
  }

  const governance = await request('/observability/governance', { headers: authHeaders });
  if (!governance.response.ok || !Array.isArray(governance.data?.topActionTypes)) {
    throw new Error('Falha ao consultar governanca operacional da plataforma.');
  }

  if (RUN_EXPENSIVE) {
    const backlog = await request(`/projects/${createdProject.data.uuid}/generate-backlog`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        idea: 'Plataforma de EAD para criadores venderem cursos e gerenciarem alunos.',
      }),
    });

    if (!backlog.response.ok) {
      throw new Error(`Falha ao gerar backlog E2E: ${JSON.stringify(backlog.data)}`);
    }
  }

  console.log('Platform E2E concluido com sucesso.');
}

main().catch((error) => {
  console.error('Platform E2E falhou.');
  console.error(error);
  process.exit(1);
});
