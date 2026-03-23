# Documentação do Sistema

Documentação funcional e técnica do Aligna, com foco no produto em execução no repositório atual.

Data de referência desta documentação: `2026-03-23`

## Visão geral

O Aligna é uma plataforma para transformar uma ideia de produto em um fluxo operacional de definição, refinamento e validação antes da implementação.

Na prática, o sistema cobre:

- autenticação e criação de workspace
- cadastro e acompanhamento de projetos
- geração de backlog com user stories
- refinamento de requisitos por agente
- geração de plano de testes por agente
- gate de arquitetura antes da implementação
- governança de providers de IA e fallback

## Objetivo do produto

O sistema foi desenhado para reduzir retrabalho causado por requisitos vagos, critérios de aceite incompletos e QA pensado tarde demais. Em vez de começar diretamente pela implementação, o fluxo força clareza progressiva:

1. ideia do projeto
2. geração de stories
3. refinamento de requisitos
4. QA
5. arquitetura
6. implementação

## Capturas de tela

### Login e acesso

![Tela de autenticação](./screenshots/auth-page.png)

### Visão do projeto e geração de user stories

![Visão do projeto](./screenshots/project-overview.png)

### Board operacional

![Board de projetos](./screenshots/projects-board.png)

### Governança de IA

![Governança de IA](./screenshots/ai-governance.png)

## Principais módulos da interface

### 1. Autenticação

Rota principal:

- `/auth`

Permite:

- login
- registro com criação de workspace
- restauração automática de sessão com refresh token

Depois do login, o frontend persiste o contexto básico do usuário e do workspace para liberar o uso do board e dos formulários operacionais.

### 2. Projetos e board operacional

Rota principal:

- `/projects`

É a tela central de operação do sistema. Ela reúne:

- catálogo de projetos
- criação rápida de projetos
- indicadores de execução
- board por status
- criação rápida de tasks
- acionamento dos agentes de requisitos e QA

O board trabalha com estas colunas:

- `backlog`
- `todo`
- `in_progress`
- `in_review`
- `qa`
- `done`

As tasks são agrupadas visualmente por tipo:

- `epic`
- `story`
- `task`

Regra importante:

- só `story` entra no fluxo de requisitos e QA
- `epic` funciona como agrupador
- `task` técnica fica fora do refinamento funcional

### 3. Visão do projeto

Rota principal:

- `/projects/:projectUuid`

Essa tela funciona como o briefing consolidado do projeto. Ela mostra:

- resumo do projeto
- saúde operacional
- gate de arquitetura
- atalho para gerar user stories
- stories já persistidas no board

É a melhor entrada para transformar um briefing inicial em backlog acionável.

### 4. Detalhe da task

Rota principal:

- `/projects/:projectUuid/tasks/:taskUuid`

Serve para inspecionar uma história específica, seus artefatos, histórico de processamento e transição entre agentes.

### 5. Governança de IA

Rota principal:

- `/settings/ai`

Centraliza a configuração dos providers e da política de runtime. Hoje a plataforma suporta:

- Ollama
- Gemini
- OpenAI
- DeepSeek
- NVIDIA
- Anthropic
- Groq
- OpenRouter

Nessa área é possível:

- definir provider preferencial
- habilitar ou desabilitar providers
- informar chave e modelo
- testar chave/conexão
- configurar fallback do OpenRouter
- aplicar preset de modelos gratuitos

### 6. Governança operacional

Rota principal:

- `/governance`

Complementa a governança de IA com readiness, auditoria e visão operacional da plataforma.

### 7. Code Studio

Rota principal:

- `/code-studio`

É a superfície voltada para o handoff técnico e implementação, liberada depois que o gate de arquitetura estiver satisfeito.

## Fluxo operacional do sistema

### 1. Entrada

O usuário cria uma conta, entra no workspace e registra um projeto.

### 2. Geração de backlog

Na visão do projeto, o usuário descreve:

- ideia do produto
- objetivo
- público
- fluxos principais
- restrições

O PM Agent converte isso em backlog inicial com:

- épicos
- histórias de usuário
- tarefas técnicas iniciais

### 3. Persistência no board

O backend transforma o backlog em tasks persistidas.

Mapeamento atual:

- `epicos` → `taskType: epic`
- `historias de usuario` → `taskType: story`
- `tarefas tecnicas iniciais` → `taskType: task`

### 4. Refinamento de requisitos

Cada `story` pode ser enviada ao `requirements_analyst`, que deve retornar um artefato com:

- user story refinada
- requisitos funcionais
- fluxo principal
- fluxos alternativos
- fluxos de exceção
- regras de negócio
- critérios de aceite

### 5. QA

Depois do refinamento, a story pode ser enviada ao `qa_engineer`, que gera:

- estratégia de testes
- dados de teste
- riscos e métricas
- cenários de teste
- casos de teste funcionais
- usabilidade e acessibilidade

### 6. Gate de arquitetura

A arquitetura do projeto só é liberada quando todas as histórias exigidas estiverem refinadas. Esse gate evita avançar para implementação com backlog ainda incompleto.

### 7. Implementação

Depois da arquitetura pronta, o fluxo técnico pode seguir para implementação e code handoff.

## Arquitetura técnica

### Frontend

Stack principal:

- React
- Vite
- Tailwind CSS
- Framer Motion
- Axios

Responsabilidades:

- autenticação
- navegação entre módulos
- board operacional
- formulários de briefing
- governança e configuração de IA

### Backend

Stack principal:

- Node.js
- Express
- Prisma
- MySQL

Responsabilidades:

- autenticação e sessão
- persistência de projetos, tasks e artefatos
- execução dos endpoints operacionais
- orquestração dos agentes
- observabilidade

### Camada de agentes

Stack principal:

- Python

Responsabilidades:

- geração de backlog
- refinamento de requisitos
- geração de plano de testes
- fallback entre providers
- validação estrutural das respostas

## Providers de IA e política de fallback

O runtime suporta ordem de providers e fallback automático. Isso permite que a plataforma:

- tente um provider principal
- avance para o próximo provider em caso de erro
- mantenha fallback local com Ollama quando habilitado

Exemplo de uso atual no produto:

- fallback de modelos no OpenRouter
- preset de modelos gratuitos
- suporte a runtime híbrido entre remoto e local

## Entidades principais

### Workspace

Representa o espaço organizacional do usuário autenticado.

### Projeto

Representa a iniciativa principal. Pode conter briefing, visão, intake e configurações de operação.

### Task

Representa um item operacional no board. Pode ser:

- `epic`
- `story`
- `task`

### Artifact

Representa um documento gerado por agentes ou usuários, como:

- `requirements`
- `test_plan`

### AgentRun

Representa uma execução concreta de um agente, incluindo:

- payload de entrada
- status
- erro
- tokens
- horários de início e fim

## Rotas principais da interface

- `/auth`
- `/projects`
- `/projects/:projectUuid`
- `/projects/:projectUuid/tasks/:taskUuid`
- `/settings/ai`
- `/governance`
- `/code-studio`

## Endpoints principais da API

Autenticação:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

Projetos e tasks:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectUuid`
- `GET /api/projects/:projectUuid/tasks`
- `POST /api/projects/:projectUuid/tasks`
- `POST /api/projects/:projectUuid/generate-backlog`
- `POST /api/projects/:projectUuid/generate-architecture`

Execução de agentes por task:

- `POST /api/tasks/:taskUuid/requirements/run`
- `POST /api/tasks/:taskUuid/qa/run`
- `POST /api/tasks/:taskUuid/implementation/run`

Governança de IA:

- `GET /api/auth/ai-settings`
- `PUT /api/auth/ai-settings`
- `GET /api/auth/ai-runtime`
- `POST /api/auth/ai-settings/test`

Saúde e observabilidade:

- `GET /health`
- `GET /api/observability/...`

## Estrutura do repositório

Diretórios mais importantes:

- `frontend/`
- `backend/`
- `agents/`
- `orchestrator/`
- `docs/`
- `tests/`

## Como executar localmente

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### URLs locais

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`
- health: `http://localhost:3001/health`

## Limitações e observações atuais

- o fluxo depende de providers de IA configurados e com saldo/cota disponível
- stories entram no ciclo de requisitos e QA; épicos e tarefas técnicas não
- a etapa de arquitetura é protegida por gate de refinamento
- o sistema já possui mecanismos de prevenção contra execuções concorrentes na mesma task/agente
- existe watchdog para recuperar execuções órfãs do backend

## Documentos complementares

- [ALIGNA_ARCHITECTURE.md](./ALIGNA_ARCHITECTURE.md)
- [API.md](./API.md)
- [INSTALL.md](./INSTALL.md)
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
