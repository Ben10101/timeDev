# Aligna

**Aligna ajuda times a gerir projetos com IA, alinhando requisitos, QA e arquitetura antes da implementação.**

## Why Aligna

A maioria dos problemas de software nasce antes da implementação. O Aligna ajuda a garantir clareza antes do código e mantém a gestão do projeto visível depois do kickoff.

Em vez de pular da ideia direto para a implementação, o produto transforma uma necessidade inicial em um pacote mais claro, verificável e menos ambíguo para produto, engenharia e QA.
Depois disso, a plataforma continua apoiando o board, a governança e a aprovação dos artefatos críticos.

## What problem it solves

Times sofrem com:

- retrabalho causado por requisitos vagos
- histórias mal especificadas
- critérios de aceite incompletos
- regras de negócio implícitas
- cenários de teste pensados tarde demais

O Aligna reduz esse desalinhamento antes do desenvolvimento.

## Core flow

Entrada:

- uma ideia
- uma feature
- uma necessidade de negócio

Saida:

- user story refinada
- critérios de aceite
- regras de negócio
- cenários de teste
- score de clareza
- alertas de ambiguidade

## Main product experience

1. O usuário descreve a necessidade na tela principal
2. O Aligna analisa a entrada
3. O produto devolve um pacote estruturado para alinhamento antes do desenvolvimento
4. O time pode seguir para projetos, board, aprovação e governança quando fizer sentido

## Clarity score

O produto avalia a entrada em quatro dimensoes principais:

- `clarity`
- `completeness`
- `testability`
- `ambiguity`

Observação:

- `clarity`, `completeness` e `testability` usam a lógica "quanto maior, melhor"
- `ambiguity` representa risco semântico: quanto menor, melhor
- `overall` consolida essas leituras em um score único

## Ambiguity alerts

O Aligna sinaliza problemas comuns como:

- termos vagos
- ator indefinido
- objetivo de negócio ausente
- fluxo sem exceção
- regras de negócio incompletas
- contexto insuficiente

## Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Framer Motion
- Axios

### Backend

- Node.js
- Express
- Prisma
- MySQL

### AI runtime

- Python agent layer
- multiple provider configuration
- OpenAI / Anthropic / Gemini / Groq / OpenRouter / Ollama support

## Repository structure

```text
frontend/                 main product UI
backend/                  main API and services
agents/                   agent implementations
orchestrator/             legacy orchestration compatibility layer
tests/                    root-level smoke and agent tests
scripts/maintenance/      maintenance and local support scripts
scripts/windows/          Windows helper scripts
experiments/              archived non-canonical implementations
docs/                     product and repository documentation
generated-projects/       generated example output
```

More detail:

- canonical architecture: [docs/ALIGNA_ARCHITECTURE.md](docs/ALIGNA_ARCHITECTURE.md)
- repository audit: [docs/REPOSITORY_AUDIT.md](docs/REPOSITORY_AUDIT.md)
- product vision and roadmap: [docs/PRODUCT_VISION_ROADMAP.md](docs/PRODUCT_VISION_ROADMAP.md)
- roadmap to 10 maturity: [docs/ROADMAP_TO_10_PRODUCT_MATURITY.md](docs/ROADMAP_TO_10_PRODUCT_MATURITY.md)
- roadmap execution status: [docs/ROADMAP_EXECUTION_STATUS.md](docs/ROADMAP_EXECUTION_STATUS.md)
- production readiness checklist: [docs/PRODUCTION_READINESS_CHECKLIST.md](docs/PRODUCTION_READINESS_CHECKLIST.md)
- incident runbook: [docs/RUNBOOK_INCIDENT_RESPONSE.md](docs/RUNBOOK_INCIDENT_RESPONSE.md)
- release and rollback runbook: [docs/RUNBOOK_RELEASE_ROLLBACK.md](docs/RUNBOOK_RELEASE_ROLLBACK.md)

## Run locally

### 1. Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

Python dependencies, if you want to run the legacy/agent layer locally:

```bash
pip install -r requirements.txt
```

### 2. Configure environment

Create and adjust your local `.env` at the repository root with at least:

- database connection
- auth secrets
- optional AI provider keys

You can start from:

```bash
cp .env.example .env
```

### 3. Start the backend

```bash
cd backend
npm run dev
```

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

### 5. Open the app

Frontend:

- `http://localhost:5173`

Backend API:

- `http://localhost:3001/api`

Health:

- `http://localhost:3001/health`

## Quality gates

Backend security baseline:

```bash
cd backend
npm run test:security:baseline
```

Backend security smoke:

```bash
cd backend
npm run test:security:smoke
```

Backend auth and governance smoke:

```bash
cd backend
npm run test:auth-governance:smoke
```

Backend authenticated user flow smoke:

```bash
cd backend
npm run test:auth-user-flow:smoke
```

Generated project security audit:

```bash
node scripts/maintenance/audit_generated_projects_security.mjs
```

## Main API endpoint for the new MVP

Analyze alignment:

```http
POST /api/alignment/analyze
```

Example payload:

```json
{
  "input": "Como gerente de operações, preciso aprovar reembolsos acima de R$ 500 com dupla validação para reduzir fraude."
}
```

Example response shape:

```json
{
  "input_summary": "",
  "user_story": "",
  "acceptance_criteria": [],
  "business_rules": [],
  "test_scenarios": [],
  "clarity_score": {
    "overall": 0,
    "clarity": 0,
    "completeness": 0,
    "testability": 0,
    "ambiguity": 0
  },
  "ambiguity_alerts": []
}
```

## Screenshots

Add product screenshots here:

- `docs/screenshots/home-aligna.png`
- `docs/screenshots/alignment-output.png`
- `docs/screenshots/projects-board.png`

Suggested placeholders:

```text
[ Screenshot: Home with alignment input ]
[ Screenshot: Clarity score and ambiguity alerts ]
[ Screenshot: Project board and handoff flow ]
```

## Roadmap

### Now

- clear alignment-first positioning
- standardized requirement output
- clarity score
- ambiguity alerts
- cleaner repository structure

### Next

- richer project-to-alignment traceability
- benchmark across domains
- stronger historical analytics
- broader visual regression and deeper E2E coverage

### Later

- stronger release governance
- automated remediation playbooks
- broader requirement patterns by domain

## Product positioning

Aligna is no longer presented as a generic full software factory first.

The product now emphasizes:

- alignment
- clarity
- validation
- predictability
- less rework before development

Broader implementation capabilities can remain available as supporting surfaces, but they are not the main story of the product anymore.
