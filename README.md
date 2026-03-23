# Aligna

**Aligna ajuda times a alinhar e validar requisitos antes do desenvolvimento.**

## Why Aligna

A maioria dos problemas de software nasce antes da implementacao. O Aligna ajuda a garantir clareza antes do codigo.

Em vez de pular da ideia direto para a implementacao, o produto transforma uma necessidade inicial em um pacote mais claro, verificavel e menos ambiguo para produto, engenharia e QA.

## What problem it solves

Times sofrem com:

- retrabalho causado por requisitos vagos
- historias mal especificadas
- criterios de aceite incompletos
- regras de negocio implícitas
- cenarios de teste pensados tarde demais

O Aligna reduz esse desalinhamento antes do desenvolvimento.

## Core flow

Entrada:

- uma ideia
- uma feature
- uma necessidade de negocio

Saida:

- user story refinada
- criterios de aceite
- regras de negocio
- cenarios de teste
- score de clareza
- alertas de ambiguidade

## Main product experience

1. O usuario descreve a necessidade na tela principal
2. O Aligna analisa a entrada
3. O produto devolve um pacote estruturado para alinhamento antes do desenvolvimento
4. O time pode seguir para projetos, handoff tecnico e governanca quando fizer sentido

## Clarity score

O produto avalia a entrada em quatro dimensoes principais:

- `clarity`
- `completeness`
- `testability`
- `ambiguity`

Observacao:

- `clarity`, `completeness` e `testability` usam a logica "quanto maior, melhor"
- `ambiguity` representa risco semantico: quanto menor, melhor
- `overall` consolida essas leituras em um score unico

## Ambiguity alerts

O Aligna sinaliza problemas comuns como:

- termos vagos
- ator indefinido
- objetivo de negocio ausente
- fluxo sem excecao
- regras de negocio incompletas
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

## Main API endpoint for the new MVP

Analyze alignment:

```http
POST /api/alignment/analyze
```

Example payload:

```json
{
  "input": "Como gerente de operacoes, preciso aprovar reembolsos acima de R$ 500 com dupla validacao para reduzir fraude."
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
