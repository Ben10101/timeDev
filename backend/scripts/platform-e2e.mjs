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

  const projects = await request('/projects', { headers: authHeaders });
  if (!projects.response.ok || !Array.isArray(projects.data) || !projects.data.some((item) => item.uuid === createdProject.data.uuid)) {
    throw new Error('Projeto criado nao apareceu na listagem.');
  }

  const architectureStatus = await request(`/projects/${createdProject.data.uuid}/architecture/status`, { headers: authHeaders });
  if (!architectureStatus.response.ok) {
    throw new Error('Falha ao consultar status de arquitetura do projeto.');
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
