# Developer Agents Task Tracking

## Snapshot

Data de referencia: `2026-04-10`

Objetivo: registrar o que ja foi implementado e o que ainda falta fechar nos agentes de desenvolvimento e na esteira de implementacao incremental.

Referencias principais:

- [implementation_autonomous/agent.py](/c:/Users/bleao/ai-software-factory/agents/implementation_autonomous/agent.py)
- [backend_agent/agent.py](/c:/Users/bleao/ai-software-factory/agents/backend_agent/agent.py)
- [frontend_agent/agent.py](/c:/Users/bleao/ai-software-factory/agents/frontend_agent/agent.py)
- [schema_agent/agent.py](/c:/Users/bleao/ai-software-factory/agents/schema_agent/agent.py)
- [debug_agent/agent.py](/c:/Users/bleao/ai-software-factory/agents/debug_agent/agent.py)
- [developer_backend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_backend/agent.py)
- [developer_frontend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_frontend/agent.py)
- [run_single_agent.py](/c:/Users/bleao/ai-software-factory/orchestrator/run_single_agent.py)

---

## Concluido

### 1. Agentes especializados materializados

- [x] `schema_agent` implementado para gerar `entityName`, `prismaFields`, contratos e resumo de dominio.
- [x] `backend_agent` implementado para devolver `serviceTsTemplate`, `routerTsTemplate` e `indexTsTemplate`.
- [x] `frontend_agent` implementado para devolver `pageTsxTemplate`, `serviceTsTemplate` e `indexTsTemplate`.
- [x] `debug_agent` implementado com analise heuristica deterministica para falhas de build, teste e consistencia estrutural.

### 2. Compatibilidade com agentes legados preservada

- [x] `developer_backend` segue operando com output legivel para o legado.
- [x] `developer_frontend` segue operando com output legivel para o legado.
- [x] a esteira continua aceitando agentes antigos e novos via [run_single_agent.py](/c:/Users/bleao/ai-software-factory/orchestrator/run_single_agent.py).

### 3. Executor autonomo expandido

- [x] `implementation_autonomous_agent` recebe `implementation_manifest` e `technical_spec`.
- [x] o agente autonomo ja devolve frontend e backend em estrutura separada.
- [x] o agente autonomo ja aceita `repair_context`.
- [x] o agente autonomo ja aceita `current_implementation_context`.
- [x] existe fallback minimo para frontend e backend quando a saida da LLM vem parcial.
- [x] a esteira ja registra `implementation_plan`, `implementation_apply` e `validation`.

### 4. Observabilidade minima da execucao pronta

- [x] `taskImplementation` e `generatedAppRun` estao sendo persistidos no banco.
- [x] artefatos de repair e debug estao sendo gravados durante a execucao.
- [x] a tela principal ja possui secoes para leitura de implementacao, runs tecnicos e repair em [CodeStudioPage.jsx](/c:/Users/bleao/ai-software-factory/frontend/src/pages/CodeStudioPage.jsx).

---

## Em Andamento

### 1. Fechar o loop de validacao final

Status atual:

- [x] o projeto gerado de referencia voltou a passar em `lint`, `test`, `build:web` e `build:api`.
- [x] a causa raiz `missing_shared_design_system_usage` foi corrigida na feature afetada e tratada na esteira.
- [x] a fundacao minima do monorepo gerado foi restaurada para permitir validacao real.
- [x] a reconciliacao preflight recuperou a run orfa `2b557184-606c-4326-abc0-f7a8a4172304`, que deixou de ficar `running` e foi marcada como `failed` antes de nova tentativa.
- [x] a geracao do `schema.prisma` passou a respeitar o datasource `sqlite`, removendo tipos nativos incompatíveis que derrubavam `db:generate`.
- [x] a esteira passou a rematerializar modulos legados com backend em memoria quando detecta templates autonomos antigos.
- [x] a task `8db29115-e0b5-487a-82dd-8f99d957fb1e` finalmente chegou a `implementation_apply=completed` e `taskImplementation=integrated` na run `89`.
- [x] o comportamento tecnico agora foi confirmado tambem em uma segunda historia gerada, alem do caso de referencia.
- [x] isso ocorreu repetidamente para:
  - task `8db29115-e0b5-487a-82dd-8f99d957fb1e`
  - task `fe9d564c-1dbe-4b3e-bd56-51eedabe21c8`

Checkpoint de execucao real mais recente:

- [x] task `8db29115-e0b5-487a-82dd-8f99d957fb1e` foi reexecutada varias vezes apos os ajustes da esteira.
- [x] o erro antigo `Cannot read properties of undefined (reading 'prisma')` saiu do caminho.
- [x] o specialist review chegou a `100` em uma das passagens da run `87`, indicando melhora real do repair estrutural.
- [x] na run `88`, `lint=completed`, `test=completed`, `build=completed`, `review=approved` e `specialist=approved` passaram juntos pela primeira vez na execucao real.
- [x] a run `89` consolidou a reconciliacao final do status e fechou com `validation=completed`.
- [x] a task `8db29115-e0b5-487a-82dd-8f99d957fb1e` saiu do estado recorrente de falha e virou caso integrado de referencia.
- [x] a task `fe9d564c-1dbe-4b3e-bd56-51eedabe21c8` tambem chegou a `validation=completed` com `lint=completed`, `test=completed` e `build=completed` na implementation `92`.
- [x] a confirmacao operacional minima agora cobre duas historias geradas com integracao completa.

Leitura pratica:

- os agentes agora conseguem materializar codigo, restaurar a base do workspace e passar em validacao no caso corrigido
- o problema nao era apenas a `page.tsx`; havia tambem perda de arquivos-base do monorepo gerado
- a esteira agora precisa preservar consistentemente:
  - imports do design system compartilhado
  - entrypoints do app web e api
  - scripts de validacao
  - manifests dos workspaces
- o gargalo deixou de ser unico e hoje esta mais concentrado em compatibilidade de templates autonomos antigos com os contratos e caminhos do shell atual
- os problemas de template frontend legado e backend em memoria deixaram de ser o bloqueio principal no checkpoint atual
- o maior gargalo do loop final foi superado para a story de referencia
- a replicabilidade minima ja foi comprovada em duas historias diferentes
- o caso de `specialist` bloqueando uma rodada tecnicamente verde foi eliminado no checkpoint atual

### 2. Repair automatico ainda instavel

- [x] o `debug_agent` ja produz diagnostico e sugestao de correcao
- [x] a esteira ja gera artefatos como `Implementation Debug Diagnosis` e `Implementation Repair Attempt`
- [x] o repair deixou de ser bloqueio recorrente no checkpoint atual, porque a esteira passou a preferir templates/frontend compativeis antes de entrar em ciclos desnecessarios de reparo
- [x] o repair passou a priorizar patch local de frontend quando a causa raiz for `missing_shared_design_system_usage`
- [x] a esteira agora restaura automaticamente arquivos-base ausentes do projeto gerado, incluindo manifests, entrypoints, scripts e `schema.prisma`
- [x] o backend legacy repair ja consegue substituir `const records = []` por Prisma em modulos antigos
- [x] os templates autonomos frontend antigos deixaram de ser aceitos quando importam `axios`, `packages/ui/src/index` sem `.tsx` e caminhos invalidos como `packages/ui/src/index/api/client`
- [x] os contratos compartilhados antigos passaram a aceitar `id: number | string`, reduzindo atrito com Prisma em `sqlite`
- [x] o status final da validacao passou a considerar a rodada final bem-sucedida, mesmo com falha intermitente anterior de `db:generate`
- [x] o tratamento de `db:generate` agora recupera lock transitório de `EPERM` em Windows quando o Prisma Client ja esta utilizavel, registrando `recoveredFromLock`
- [x] a promocao final de `implementation_apply` foi validada novamente quando `review`, `specialist` e `validation` fecharam verdes na implementation `94`

### 3. Finalizacao de estado operacional

- [x] foi adicionada recuperacao preflight para `implementation_apply` travado antes de iniciar nova tentativa
- [x] a reconciliacao foi validada em execucao real e removeu a run orfa antiga do estado `running`
- [x] a reconciliacao do `validation status` final foi validada quando a ultima rodada tecnica passou integralmente
- [x] o tratamento de falhas de filesystem/lock no `db:generate` em Windows foi endurecido com limpeza de temporarios e recuperacao segura do Prisma Client

---

## Pendente

### 1. Pendencias do `implementation_autonomous_agent`

- [ ] reduzir dependencia de fallback minimo e aumentar taxa de `llm_primary` aproveitavel no resultado final
- [ ] melhorar a qualidade do repair local para mexer so no write set necessario
- [ ] produzir saidas que passem em review specialist sem cair recorrentemente em score baixo
- [ ] transformar sucesso de build em sucesso de teste e validacao final
- [x] o fallback de `review/view` deixou de gerar pagina simplificada sem formulario e passou a usar `FieldGroup`, `PrimaryButton`, schema e contracts compativeis com o shell atual

### 2. Pendencias do `backend_agent`

- [ ] validar se os templates gerados cobrem de forma confiavel os contratos e a persistencia real esperada nas features de visita
- [ ] reduzir casos em que a camada backend passa em build mas falha no comportamento exigido pelos testes
- [ ] fortalecer aderencia do service/router aos cenarios reais de smoke e test
- [x] o `backend_agent` agora possui fallback deterministico local para `service/router/index`, exigindo Prisma Client, classe de service, rotas GET/POST e eliminando saidas fracas da LLM antes da materializacao

### 3. Pendencias do `frontend_agent`

- [ ] melhorar alinhamento entre `page.tsx` gerada e os cenarios cobrados pela validacao automatica
- [ ] garantir uso consistente do design system compartilhado nas features geradas
- [ ] reduzir dependencia de estruturas genericas quando a feature pede UX mais especifica
- [ ] garantir consistencia funcional entre formulario, listagem, copy e comportamento testado

### 4. Pendencias do `debug_agent`

- [x] persistir diagnosticos com causa raiz mais acionavel para falhas de `test=failed`
- [x] diminuir casos classificados apenas como falha generica de validacao
- [x] conectar melhor findings a arquivos foco do repair
- [x] quando detectar `missing_shared_design_system_usage`, apontar diretamente a `page.tsx` afetada como foco primario de correcao
- [x] classificar explicitamente falhas de `db:generate` por incompatibilidade de provider Prisma e por `EPERM` em Windows, em vez de cair em `validation_failure_unclassified`

### 5. Pendencias operacionais da esteira

- [ ] impedir `generatedAppRun` orfa em estado `running`
- [x] melhorar recovery de execucao para reconciliar processo encerrado com status persistido antes de nova tentativa
- [ ] expor no frontend um resumo mais direto de causa raiz da ultima falha de implementacao
- [ ] registrar com mais clareza qual teste falhou e em qual camada a correcao deve acontecer
- [ ] reduzir dependencia de artefatos historicos com templates autonomos legados quando eles entram em conflito com o shell atual

---

## Tracking Por Agente

| Agente | Papel atual | Status | Proximo passo |
| --- | --- | --- | --- |
| `schema_agent` | modelagem e contratos | operacional | validar cobertura de dominios menos padronizados |
| `backend_agent` | service/router/index backend | operacional com pendencias de qualidade | fechar aderencia aos testes reais |
| `frontend_agent` | page/service/index frontend | operacional com pendencias de qualidade | fechar aderencia aos testes reais |
| `implementation_autonomous_agent` | materializacao principal + repair | operacional, mas instavel no fechamento | estabilizar repair e reduzir fallback |
| `debug_agent` | diagnostico e guidance de correcao | operacional | melhorar causa raiz de falhas de teste |
| `developer_backend` | legado backend | estavel | manter compatibilidade ou aposentar com seguranca |
| `developer_frontend` | legado frontend | estavel | manter compatibilidade ou aposentar com seguranca |

---

## Checkpoint Atual

Historico recente observado:

- houve restauracao manual/assistida do workspace gerado de referencia
- o projeto voltou a passar em:
  - `npm run lint`
  - `npm run test`
  - `npm run build:web`
  - `npm run build:api`
- a causa raiz `missing_shared_design_system_usage` foi eliminada neste caso
- tambem foi corrigida a ausencia de arquivos-base do monorepo gerado, como `App.tsx`, `server.ts`, `index.html`, `tsconfig.json`, `scripts/test.mjs` e `prisma/schema.prisma`
- em execucoes reais posteriores da task `8db29115-e0b5-487a-82dd-8f99d957fb1e`, a run orfa antiga foi reconciliada com sucesso
- o schema Prisma passou a ser gerado de forma compativel com `sqlite`
- modulos backend legados deixaram de usar armazenamento em memoria, mas ainda resta alinhar contratos e templates frontend historicos
- na run `88`, a ultima rodada tecnica fechou com `lint`, `test`, `build`, `review` e `specialist` aprovados
- o status final, porem, ainda ficou `failed` por conta do ciclo de validacao considerar um erro intermitente anterior de `db:generate`
- na run `89`, esse ponto foi corrigido e a task `8db29115-e0b5-487a-82dd-8f99d957fb1e` fechou como `integrated`
- na implementation `92` da task `fe9d564c-1dbe-4b3e-bd56-51eedabe21c8`, a rodada tecnica tambem fechou com `validation=completed`, `lint=completed`, `test=completed` e `build=completed`
- na implementation `94` da mesma task, a esteira fechou de ponta a ponta com `implementation_apply=completed`, `taskImplementation=integrated`, `review=approved`, `specialist=approved` e `validation=completed`
- nessa run mais recente, o `db:generate` encontrou `EPERM` novamente, mas foi recuperado automaticamente com `recoveredFromLock=true` sem derrubar a integracao
- na implementation `95` da task `7f7bf1e5-17ec-4d8c-a279-19382f385a22`, uma terceira historia diferente tambem fechou como `integrated`, com `review=approved`, `specialist=approved`, `validation=completed` e `repairAttempts=0`

Conclusao do checkpoint:

- a fundacao dos agentes de desenvolvimento esta entregue
- o principal trabalho restante nao e criar novos agentes
- o principal trabalho restante e transformar essa recuperacao pontual em comportamento automatico e consistente da esteira
- o foco tecnico mais imediato saiu do bootstrap e foi para consolidacao de qualidade e expansao da cobertura para novas historias, nao mais para resgate da esteira base
- o `implementation_autonomous_agent` agora gera fallback de `review/view` mais aderente ao shell compartilhado, evitando a pagina simplificada que derrubava o `specialist`
- o `debug_agent` passou a classificar melhor falhas de `test`, arquivo obrigatorio ausente, provider Prisma incompativel e `EPERM` no `db:generate`
- a validacao mais recente confirmou que a melhoria de `review/view` ja se sustentou em uma historia nova, e nao apenas nas tasks de referencia anteriores
- o `backend_agent` passou a rejeitar saidas fracas da LLM e a cair para um template local compativel com smoke test e com a persistencia via Prisma

---

## Proximas Acoes Recomendadas

- [x] corrigir a `page.tsx` da feature afetada para usar o design system compartilhado
- [x] fazer o repair automatico priorizar essa correcao local de frontend quando a causa raiz for `missing_shared_design_system_usage`
- [x] ensinar a esteira a restaurar automaticamente arquivos-base ausentes do projeto gerado
- [x] corrigir a reconciliacao preflight de run orfa para nao deixar `implementation_apply` antigo bloqueando nova tentativa
- [x] validar um caso ponta a ponta ate `validation=completed` no projeto recuperado localmente
- [x] repetir a validacao em nova execucao real sem intervencao manual para a task `8db29115-e0b5-487a-82dd-8f99d957fb1e`
- [x] normalizar templates autonomos frontend antigos para o shell compartilhado atual
- [x] alinhar contratos `Response` antigos com ids numericos persistidos via Prisma em `sqlite`
- [x] reconciliar o status final da validacao quando a rodada final ja passou por todos os gates
- [x] tornar `db:generate` resiliente a lock/`EPERM` em Windows de forma consistente nas proximas execucoes
- [x] repetir a mesma confirmacao de ponta a ponta para a task `fe9d564c-1dbe-4b3e-bd56-51eedabe21c8` no nivel tecnico de validacao
- [x] promover automaticamente para sucesso final os casos em que `review`, `specialist` e `validation` passam integralmente na rodada final
- [ ] depois disso, transformar este tracking em painel ou checklist dentro do produto
