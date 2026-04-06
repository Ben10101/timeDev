# Aligna Pipeline Rearchitecture Plan

## Objetivo

Reestruturar a esteira do Aligna para preservar coerencia de produto do inicio ao codigo final, mantendo artefatos legiveis por humanos e adicionando contratos estruturados para execucao entre agentes.

## Principios

- Artefato humano continua existindo em todas as etapas.
- Contrato estruturado vira a fonte operacional entre agentes.
- O mesmo significado deve atravessar backlog, requisitos, arquitetura e codigo.
- O frontend deve nascer de familias reais de produto, nao de um shell generico parametrizado.
- A composicao incremental do projeto nao pode sobrescrever features anteriores.

## Arquitetura Alvo

### Etapas

1. Project DNA
2. PM contract-first
3. RE contract-first
4. QA contract-first
5. Architect contract-first
6. Coherence Guardian
7. Implementation Manifest
8. UI families and product composition
9. Composition Integrator
10. Observability and end-to-end evals

### Contratos principais

- `project-dna.json`
- `backlog.contract.json`
- `requirement-spec.json`
- `test-spec.json`
- `solution-blueprint.json`
- `implementation-manifest.json`
- `coherence-report.json`

## Roadmap por Sprint

### Status atual

- Sprint 1: concluida
- Sprint 2: concluida
- Sprint 3: concluida
- Sprint 4: concluida
- Sprint 5: concluida
- Sprint 6: concluida
- Sprint 7: concluida
- Sprint 8: concluida
- Sprint 9: concluida
- Sprint 10: concluida

### Sprint 1 - Project DNA

Objetivo:
Fazer todo projeto nascer com identidade explicita.

Entregas:
- `project-dna.json`
- artefato humano de visao do produto
- persistencia do DNA no backend

Criterio de pronto:
- todo projeto novo gera DNA humano e maquina
- PM ja consegue ler esse contrato

### Sprint 2 - PM contract-first

Objetivo:
Transformar backlog em contrato executavel.

Entregas:
- `backlog.contract.json`
- `Backlog Master.md` derivado do contrato
- validacao nova do PM
- eval nova do PM

Criterio de pronto:
- backlog sai com capacidades, epicos, stories e release slices
- contrato e markdown ficam coerentes

### Sprint 3 - RE contract-first

Objetivo:
Transformar refinamento em especificacao implementavel.

Entregas:
- `requirement-spec.json`
- `Requirements.md`
- validacao forte de fluxos, regras, estados, permissoes e auditoria

Criterio de pronto:
- toda story refinada gera contrato estruturado consumivel pelo planner

### Sprint 4 - QA contract-first

Objetivo:
Fazer QA sair do plano generico e virar estrategia executavel.

Entregas:
- `test-spec.json`
- `Test Plan.md`
- rastreabilidade de criterios
- smoke minimo por feature

Criterio de pronto:
- QA prova cobertura de criterios de aceite por contrato

### Sprint 5 - Architect contract-first

Objetivo:
Fazer arquitetura virar insumo real do codegen.

Entregas:
- `solution-blueprint.json`
- `Architecture.md`
- modulos, entidades, contratos e familias de tela

Criterio de pronto:
- implementation planner le blueprint sem depender so de texto livre

### Sprint 6 - Coherence Guardian

Objetivo:
Impedir drift de produto ao longo da esteira.

Entregas:
- `coherence-report.json`
- `Coherence Review.md`
- gates apos PM/RE/Architect, antes do Technical Spec e depois da implementacao

Criterio de pronto:
- backlog, requisitos, arquitetura e spec tecnico passam por cheque de coerencia

### Sprint 7 - Implementation Manifest

Objetivo:
Fazer a geracao materializar manifesto, nao interpretacao solta.

Entregas:
- `implementation-manifest.json`
- `Technical Spec.md`
- frontend, backend e shared lendo manifesto

Criterio de pronto:
- feature gera `featureKey`, `domain`, `routes`, `componentMap` e `operationMap` por contrato

### Sprint 8 - UI families

Objetivo:
Parar de gerar a mesma experiencia com outra copy.

Entregas:
- `operations-workspace`
- `executive-cockpit`
- `settings-console`
- `planner-workbench`

Criterio de pronto:
- 3 features diferentes geram telas visualmente distintas e coerentes

### Sprint 9 - Composition Integrator

Objetivo:
Garantir coexistencia real entre features.

Entregas:
- integracao segura de `App.tsx`
- integracao segura de `server.ts`
- composicao incremental de navegacao e rotas
- testes de composicao

Criterio de pronto:
- nova feature nao sobrescreve nem apaga a anterior

### Sprint 10 - Observability and evals

Objetivo:
Medir coerencia e qualidade da esteira completa.

Entregas:
- metricas por etapa
- painel de saude da esteira
- evals ponta a ponta por projeto
- score de coerencia final

Criterio de pronto:
- o sistema mostra onde a intencao do produto se perde

## Ordem recomendada

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 7
5. Sprint 6
6. Sprint 8
7. Sprint 9
8. Sprint 4
9. Sprint 5
10. Sprint 10

## Marcos de valor

- Apos Sprint 3: discovery ja fica mais forte e menos textual.
- Apos Sprint 7: codegen fica mais previsivel.
- Apos Sprint 8 e 9: a percepcao visual e a coerencia do produto mudam de verdade.

## Resultado esperado

- backlog, requisitos, arquitetura e UI final parecem o mesmo produto
- novas features convivem sem quebrar o projeto
- materializacao deixa de depender de parsing fragil de markdown
- artefatos humanos continuam fortes, legiveis e auditaveis
- o frontend deixa de convergir sempre para a mesma experiencia visual
