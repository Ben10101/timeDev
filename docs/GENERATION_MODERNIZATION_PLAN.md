# Generation Modernization Plan

## Objetivo

Modernizar a geracao de frontend e backend do Aligna para sair de um modelo centrado em texto e templates soltos e evoluir para uma fabrica guiada por:

- contratos intermediarios estaveis
- composicao de tela previsivel
- modulos backend implementaveis
- validacao automatica forte
- comparabilidade entre providers, prompts e versoes

Este plano assume o stack aprovado:

- Frontend:
  - React
  - TypeScript
  - Vite
  - React Router
  - TanStack Query
  - React Hook Form
  - Zod
  - shadcn/ui
- Backend:
  - Express
  - TypeScript
  - Prisma
  - Zod
  - Vitest
  - Supertest
  - Pino

## Meta principal

Fazer o Aligna gerar software com este fluxo:

1. entender o dominio e o blueprint do projeto
2. produzir uma spec intermediaria confiavel
3. materializar frontend e backend a partir dessa spec
4. validar o resultado com gates objetivos

## Estado atual

Hoje o Aligna ja esta forte em:

- backlog e refinamento
- arquitetura de projeto
- bootstrap guiado por template
- geracao de UI com `layoutVariant`
- fortalecimentos recentes de `developer_backend` e `developer_frontend`
- evals e comparabilidade

Os gargalos principais ainda sao:

- geracao de frontend ainda muito centrada em copy e estrutura parcial
- geracao de backend ainda mais proxima de plano do que de implementacao completa
- ausencia de um contrato intermediario unico entre agentes e geradores
- coexistencia entre runtime legado e moderno

## Arquitetura alvo

### Camadas

1. Blueprint de projeto
   Entrada de dominio e posicionamento.

2. Product Spec
   Estrutura do projeto, entidades, jornadas, permissoes, regras e relacoes.

3. Generation IR
   Contrato tecnico intermediario para frontend e backend.

4. Materializers
   Geradores que convertem IR em codigo real.

5. Validators
   Build, lint, smoke, testes e evals.

### Fluxo desejado

`briefing -> template -> product spec -> generation IR -> frontend/backend materializers -> validation -> artifacts/evals`

## Contrato intermediario

### Product Spec

Camada semantica, ainda proxima do produto.

Campos principais:

- `projectTemplateKey`
- `domain`
- `productName`
- `positioning`
- `personas`
- `entities`
- `capabilities`
- `journeys`
- `permissions`
- `nonFunctionalRequirements`

### Generation IR

Camada tecnica, propria para gerar codigo.

Campos principais:

- `app`
- `routes`
- `screens`
- `forms`
- `queries`
- `mutations`
- `apiContracts`
- `dataModels`
- `validationSchemas`
- `policies`
- `seedData`
- `testScenarios`

## Frontend alvo

### Stack alvo

- React + TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- shadcn/ui

### Papel do gerador frontend

O gerador frontend deixa de gerar pagina como texto grande e passa a gerar uma composicao.

Saidas esperadas:

- `screen spec`
- `component map`
- `route map`
- `query/mutation bindings`
- `form schema bindings`
- `empty/loading/error/success states`
- `layoutVariant`
- `visual tone`

### Estrutura alvo de tela

Cada tela gerada deve nascer com:

- shell
- hero ou header
- secoes principais
- actions
- lista, tabela ou cards
- formulario quando existir
- estados obrigatorios
- copy de empty state
- pontos de extensao

### Materializacao frontend

Arquivos gerados por feature:

- `page.tsx`
- `components/*.tsx`
- `hooks/*.ts`
- `service.ts`
- `schema.ts`
- `index.ts`

### Beneficios esperados

- menos repeticao de layout
- menos copy generica
- forms mais confiaveis
- ligacao mais clara entre tela e API
- codigo gerado mais legivel e componivel

## Backend alvo

### Stack alvo

- Express + TypeScript
- Prisma
- Zod
- Vitest
- Supertest
- Pino

### Papel do gerador backend

O gerador backend deixa de sair como plano textual e passa a emitir modulos implementaveis.

Saidas esperadas:

- `entity spec`
- `schema/model`
- `route contract`
- `controller`
- `service`
- `repository`
- `validation schema`
- `seed`
- `test suite`
- `logging hooks`

### Estrutura alvo por modulo

Cada modulo gerado deve nascer com:

- `router.ts`
- `controller.ts`
- `service.ts`
- `repository.ts`
- `schema.ts`
- `mapper.ts`
- `seed.ts`
- `*.test.ts`

### Beneficios esperados

- mais profundidade de implementacao real
- menor retrabalho manual
- validacao de payload forte
- testes basicos ja nascem junto
- menos logica espalhada entre controller e service

## Biblioteca de patterns

### Frontend patterns

Catalogo inicial recomendado:

- `dashboard.executive`
- `dashboard.operations`
- `settings.summary-first`
- `settings.checklist`
- `workspace.review-queue`
- `workspace.evidence-split`
- `crud.master-detail`
- `crud.table-form`
- `governance.role-matrix`

### Backend patterns

Catalogo inicial recomendado:

- `crud.standard`
- `crud.status-workflow`
- `crud.attachments`
- `settings.preferences`
- `governance.roles`
- `analytics.read-model`

## Roadmap de implementacao

### Fase 1: Foundation

Objetivo:

- criar a espinha dorsal da geracao moderna

Entregas:

- definir `Product Spec`
- definir `Generation IR`
- criar mapeadores `template -> product spec`
- criar mapeadores `product spec -> generation IR`
- documentar contratos e versoes

Arquivos alvo provaveis:

- `backend/src/templates/projects/`
- `backend/src/services/implementationService.js`
- `orchestrator/generate_implementation_ui.py`
- `agents/developer/shared.py`

### Fase 2: Frontend Composition Engine

Objetivo:

- tornar a geracao de UI realmente orientada a composicao

Entregas:

- `screen spec` por tela
- materializer React/TypeScript
- integracao com `React Hook Form` e `Zod`
- integracao com `TanStack Query`
- patterns de layout e estados obrigatorios

Arquivos alvo provaveis:

- `orchestrator/generate_implementation_ui.py`
- `backend/src/templates/fullstack/react-express-prisma/packages/ui/`
- `backend/src/services/implementationService.js`

### Fase 3: Backend Module Engine

Objetivo:

- gerar backend implementavel com padrao consistente

Entregas:

- generation IR para API
- materializer Express/TypeScript
- schemas `Zod`
- testes `Vitest + Supertest`
- logging com `Pino`

Arquivos alvo provaveis:

- `agents/developer_backend/agent.py`
- `agents/developer/shared.py`
- `orchestrator/backendGenerator.py`
- `backend/src/templates/fullstack/react-express-prisma/apps/api/`

### Fase 4: Unified Validation

Objetivo:

- transformar qualidade em gate

Entregas:

- lint de frontend gerado
- smoke de backend gerado
- build de app gerado
- evals por provider
- score de retrabalho manual

Arquivos alvo provaveis:

- `scripts/agent-evals/run-eval.mjs`
- `generated-projects/*/scripts/test.mjs`
- `generated-projects/*/scripts/lint.mjs`

### Fase 5: Runtime Convergence

Objetivo:

- unificar pipeline antigo e runtime moderno

Entregas:

- um caminho principal de execucao
- compatibilidade temporaria apenas onde necessario
- menos duplicidade entre `factory.py` e backend Node

Arquivos alvo provaveis:

- `orchestrator/factory.py`
- `orchestrator/run_single_agent.py`
- `backend/src/services/orchestratorService.js`

## Decisoes de tecnologia

### Frontend

#### React + TypeScript + Vite

Escolha principal.

Motivos:

- encaixa no repo atual
- melhora ergonomia de geracao
- facilita componentizacao
- mantem custo de migracao controlado

#### TanStack Query

Adotar para dados remotos.

Motivos:

- remove muito estado manual repetido
- melhora cache e loading state
- facilita geracao consistente de lista/detalhe/mutacao

#### React Hook Form + Zod

Adotar para formularios.

Motivos:

- reduz improviso em forms
- melhora validacao
- permite gerar schema e UI juntos

#### shadcn/ui

Adotar como base de componentes.

Motivos:

- evita inventar componente basico toda vez
- melhora consistencia visual
- combina bem com patterns internos do Aligna

### Backend

#### Express + TypeScript

Escolha principal para agora.

Motivos:

- menor ruptura
- reaproveita boa parte da base
- permite modernizar a geracao sem reescrever tudo

#### Prisma

Manter como ORM padrao.

Motivos:

- encaixa com o estado atual
- bom fit para generation IR de entidades

#### Zod

Adotar no backend tambem.

Motivos:

- unifica contratos
- permite gerar schema a partir do mesmo IR
- ajuda a aproximar frontend e backend

#### Vitest + Supertest

Adotar como baseline de testes gerados.

Motivos:

- rapido para feedback local
- simples para smoke e testes de rota

#### Pino

Adotar para logs gerados.

Motivos:

- deixa observabilidade minima melhor
- ajuda troubleshooting dos apps gerados

## Riscos e mitigacoes

### Risco: aumentar complexidade cedo demais

Mitigacao:

- introduzir IR primeiro
- manter compatibilidade com materializers atuais durante transicao

### Risco: frontend ficar mais rigido do que desejado

Mitigacao:

- manter biblioteca de patterns em vez de um unico layout
- separar `screen spec` de `visual tone`

### Risco: backend gerar estrutura demais e utilidade de menos

Mitigacao:

- exigir testes, contratos e casos reais nos evals
- validar modulo por modulo em projetos reais

## Indicadores de sucesso

- menos retrabalho manual por feature gerada
- mais apps gerados passando `lint`, `test` e `build`
- menor repeticao de layout entre telas
- maior profundidade util em `developer_backend` e `developer_frontend`
- mais clareza sobre `fallback` vs provider real
- menor dependencia de ajustes manuais apos bootstrap

## Primeiro corte recomendado

Se formos atacar isso sem abrir trabalho demais ao mesmo tempo, a sequencia recomendada e:

1. definir `Generation IR` e versionar o contrato
2. integrar `Zod` ao frontend e backend gerados
3. adicionar `React Hook Form` e `TanStack Query` no template base
4. criar materializer frontend orientado a `screen spec`
5. criar materializer backend orientado a `module spec`
6. ampliar evals para medir ganho real nos projetos gerados

## Resultado esperado

Ao final desse plano, o Aligna deve sair de:

- gerador com agentes fortes em analise e medianos em materializacao

para:

- sistema multiagente com contrato intermediario
- frontend gerado com composicao mais previsivel
- backend gerado com modulos implementaveis
- validacao forte e repetivel
- base tecnica mais preparada para evolucao continua

## Status atual desta execucao

- Fase 1: implementada no primeiro corte com [generationSpecService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/generationSpecService.js)
- Fase 2: implementada no primeiro corte com `screenSpec`, `dataSpec` e `componentMap` no gerador de UI em [generate_implementation_ui.py](/c:/Users/bleao/ai-software-factory/orchestrator/generate_implementation_ui.py)
- Fase 3: implementada no primeiro corte com `module_spec` e `screen_spec` nos agentes em [developer_backend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_backend/agent.py) e [developer_frontend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_frontend/agent.py)
- Fase 4: implementada no primeiro corte com o validador [validate-generation-ir.mjs](/c:/Users/bleao/ai-software-factory/scripts/agent-evals/validate-generation-ir.mjs) e o caso [generation-ir-contract.md](/c:/Users/bleao/ai-software-factory/agent-evals/cases/generation-ir-contract.md)
- Fase 5: implementada no primeiro corte com metadados de runtime moderno em [run_single_agent.py](/c:/Users/bleao/ai-software-factory/orchestrator/run_single_agent.py) e [orchestratorService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/orchestratorService.js)

Leitura honesta:

- as 5 fases ja estao representadas no codigo
- algumas fases ainda entraram como fundacao e nao como migracao total
- o maior trabalho restante e aprofundar os materializers e convergir mais do runtime legado
