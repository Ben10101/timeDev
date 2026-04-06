# Agent Improvement Sprint Plan

## Objetivo

Transformar o sistema atual de agentes do Aligna em uma fabrica mais coerente, previsivel e forte em geracao de produto real.

## Leitura Rapida

Hoje o sistema ja esta forte em:

- backlog
- refinamento de requisitos
- arquitetura
- governanca operacional dos agent runs

Os gargalos mais relevantes agora estao em:

- bootstrap guiado por template de projeto
- geracao de UI com composicao mais rica
- maturidade real dos agentes `developer_backend` e `developer_frontend`
- convivencia entre pipeline legado e runtime moderno

## Prioridade Geral

1. fazer o template de projeto governar o bootstrap real
2. evoluir geracao de UI de copy para composicao
3. fortalecer implementacao backend/frontend
4. reduzir dependencia do pipeline legado
5. ampliar evals de produto real

## Sprint 1

### Tema

Template de projeto como motor de bootstrap

### Meta

Fazer o `projectTemplateKey` sair do nivel de metadata e passar a influenciar a geracao real do projeto.

### Entregas

- usar `resolvedProjectTemplate` para pre-montar features iniciais
- orientar a home do projeto gerado por blueprint
- orientar a navegacao inicial por tipo de produto
- registrar no projeto quais features vieram do blueprint

### Arquivos alvo

- [projectDataService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/projectDataService.js)
- [implementationService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/implementationService.js)
- [catalog.js](/c:/Users/bleao/ai-software-factory/backend/src/templates/projects/catalog.js)

### Critério de pronto

- ao criar um projeto de suporte, o bootstrap inicial ja nasce com jornadas coerentes de suporte
- ao criar um projeto de EAD, o bootstrap inicial ja nasce com jornadas coerentes de educacao
- a home do projeto deixa de ser completamente generica

## Sprint 2

### Tema

Geracao de UI com composicao

### Meta

Evoluir o gerador de UI para escolher nao so a copy, mas tambem a familia de layout e a ordem de enfase da tela.

### Entregas

- introduzir `layoutVariant`
- permitir escolha de variantes por `productMode`
- variar composicao entre `settings`, `workspace`, `dashboard` e `governance`
- criar eval especifica de diversidade e adequacao visual

### Arquivos alvo

- [generate_implementation_ui.py](/c:/Users/bleao/ai-software-factory/orchestrator/generate_implementation_ui.py)
- [implementationService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/implementationService.js)
- [agent-evals](/c:/Users/bleao/ai-software-factory/agent-evals/README.md)

### Critério de pronto

- duas telas do mesmo tipo nao saem sempre no mesmo esqueleto
- dashboard de performance e tela de configuracao passam a parecer familias diferentes de produto

## Sprint 3

### Tema

Fortalecer agentes de implementacao

### Meta

Fazer `developer_backend` e `developer_frontend` sairem de planejadores estruturais e ficarem mais proximos de implementadores reais.

### Entregas

- melhorar prompts e contratos desses agentes
- aumentar profundidade de saida por camada
- integrar melhor com arquitetura aprovada
- adicionar evals especificas para implementacao backend/frontend

### Arquivos alvo

- [developer_backend agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_backend/agent.py)
- [developer_frontend agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_frontend/agent.py)
- [shared.py](/c:/Users/bleao/ai-software-factory/agents/developer/shared.py)

### Critério de pronto

- os agentes geram artefatos mais profundos e menos genericos
- a qualidade de backend/frontend melhora de forma mensuravel nas evals

## Sprint 4

### Tema

Convergencia de runtime

### Meta

Reduzir a duplicidade entre `factory.py` legado e o runtime moderno baseado em Node + agent runs.

### Entregas

- mapear o que ainda depende do pipeline legado
- mover fluxos criticos para o runtime moderno
- deixar o pipeline legado apenas como compatibilidade temporaria ou remover quando seguro

### Arquivos alvo

- [factory.py](/c:/Users/bleao/ai-software-factory/orchestrator/factory.py)
- [run_single_agent.py](/c:/Users/bleao/ai-software-factory/orchestrator/run_single_agent.py)
- [orchestratorService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/orchestratorService.js)

### Critério de pronto

- um caminho principal claro para execucao de agentes
- menos duplicidade conceitual e operacional

## Sprint 5

### Tema

Qualidade e comparabilidade

### Meta

Tornar mais facil provar ganho real de qualidade por provider, prompt e agente.

### Entregas

- ampliar `agent-evals` para fluxos de produto
- comparar `fallback` vs provider real
- comparar provider por caso de uso
- adicionar checkpoint visual/manual por tela critica

### Arquivos alvo

- [run-eval.mjs](/c:/Users/bleao/ai-software-factory/scripts/agent-evals/run-eval.mjs)
- [agent-evals](/c:/Users/bleao/ai-software-factory/agent-evals/README.md)

### Critério de pronto

- cada melhoria relevante em agentes ou prompts pode ser comparada com evidencia

## Ordem Recomendada de Execucao

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 5
5. Sprint 4

## Por que essa ordem

- primeiro damos contexto estrutural ao projeto
- depois melhoramos a experiencia gerada
- em seguida fortalecemos os implementadores
- so depois consolidamos comparabilidade e convergencia final

## Resultado Esperado

Se esse plano for seguido, o Aligna deve evoluir de:

- gerador com boas pecas isoladas

para:

- sistema multiagente com blueprint de projeto
- UI mais aderente ao dominio
- implementacao mais forte por camada
- runtime mais coerente
- melhoria continua baseada em eval

## Status Atual

- Sprint 1: concluida com bootstrap guiado por template implementado e comparado em [AGENT_IMPROVEMENT_COMPARISON.md](/c:/Users/bleao/ai-software-factory/docs/AGENT_IMPROVEMENT_COMPARISON.md)
- Sprint 2: concluida com `layoutVariant` implementado e comparado em [UI_LAYOUT_VARIANT_COMPARISON.md](/c:/Users/bleao/ai-software-factory/docs/UI_LAYOUT_VARIANT_COMPARISON.md)
- Sprint 3: concluida com fortalecimento dos agentes de implementacao e comparacao em [DEVELOPER_AGENTS_SPRINT3_COMPARISON.md](/c:/Users/bleao/ai-software-factory/docs/DEVELOPER_AGENTS_SPRINT3_COMPARISON.md)
- Sprint 4: pendente
- Sprint 5: concluida com comparabilidade ampliada e evidencias em [SPRINT5_EVAL_COMPARISON.md](/c:/Users/bleao/ai-software-factory/docs/SPRINT5_EVAL_COMPARISON.md)
