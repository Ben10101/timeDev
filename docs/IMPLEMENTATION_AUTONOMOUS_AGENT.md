# Implementation Autonomous Agent

## Objetivo

Adicionar uma camada de implementacao mais autonoma para a etapa de codificacao, preservando os contratos estruturados ja conquistados pela esteira.

## Problema atual

Hoje a implementacao ainda depende demais de:

- heuristicas fixas
- mapeamento por dominio
- templates muito opinativos
- ajustes manuais quando a feature sai do trilho esperado

Isso funciona para casos simples, mas limita a qualidade quando a feature pede:

- composicao de tela menos previsivel
- integracao mais contextual com o projeto existente
- melhor decisao entre shell, layout e densidade
- materializacao menos presa ao mesmo esqueleto

## Papel do novo agente

O `implementation_autonomous_agent` nao substitui o planner.

Ele entra depois de:

- `Requirement Spec`
- `Test Spec`
- `Solution Blueprint`
- `Implementation Manifest`

E recebe liberdade para decidir:

- composicao frontend
- divisao de arquivos
- encaixe na casca do projeto
- refinamentos de backend e shared

Sempre dentro dos limites do contrato.

## Arquitetura alvo

### 1. Planner deterministico

Continua responsavel por:

- `featureKey`
- rotas
- contratos compartilhados
- superficies de mudanca
- arquivos alvo
- `implementation-manifest.json`

### 2. Autonomous executor

Novo agente responsavel por:

- ler os contratos estruturados
- inspecionar o projeto atual
- escolher a melhor composicao
- materializar frontend, backend e shared
- se autoavaliar contra requisito e QA

### 3. Reviewer e gate

Camada final responsavel por:

- checar aderencia ao requisito
- checar aderencia ao QA
- checar coerencia de dominio
- checar convivencia com o projeto atual

## Contrato de entrada

O manifesto de implementacao agora passa a carregar:

- `execution.mode`
- `execution.autonomyLevel`
- `execution.rationale`
- `autonomousAgent.agentKey`
- `autonomousAgent.freedomWithinBounds`
- `autonomousAgent.outputTargets`
- `autonomousAgent.reviewChecklist`

No primeiro corte materializavel, o executor autonomo ja pode devolver:

- `frontend.pageTsxTemplate`
- `frontend.serviceTsTemplate`
- `frontend.indexTsTemplate`
- `backend.routerTsTemplate`
- `backend.serviceTsTemplate`
- `backend.indexTsTemplate`

Esses templates sao arquivos completos com placeholders controlados, que a esteira substitui antes de gravar a feature.

## Repair iterativo orientado pelo agente

O executor autonomo agora tambem recebe `repair_context` quando a feature falha em review, specialist review ou validacao.

Esse contexto inclui:

- findings principais
- falhas de validacao
- `repairStyle`
- `generationSource`
- resumo de materializacao anterior
- `repairScope`
- `executionFocus`
  - `primaryFailureSurface`
  - `writeSet`
  - `focusFiles`
  - `preserveFiles`

Com isso, o papel do agente no repair deixa de ser apenas gerar a primeira versao e passa a ser:

- corrigir a propria solucao quando os problemas forem locais
- preservar a estrutura boa que ja existe
- evitar resetar a feature inteira para um template seguro

Para sustentar isso, o executor agora tambem recebe `current_implementation_context`, contendo:

- arquivos atuais materializados de frontend e backend
- `generationSource`
- `variationProfile`
- `compositionSignature`
- origem por arquivo quando disponivel

Isso permite repair e iteracao sobre a solucao atual, em vez de operar apenas sobre manifesto e spec abstrata.

Com isso, o agente passa a receber uma orientacao mais local para repair:

- quais arquivos devem concentrar a maior parte das mudancas
- quais arquivos devem ser preservados
- quando agir como `local_patch` em vez de recompor a feature inteira

Na esteira, o repair iterativo agora tenta primeiro:

- `implementation_autonomous_agent` com `repair_context`

e so depois usa enriquecimentos auxiliares quando ainda fizer sentido.

## Regras de autonomia

O agente autonomo pode:

- escolher casca quando o modo for `autonomous`
- redefinir composicao frontend
- ajustar split de arquivos
- aprofundar a integracao da feature

O agente autonomo nao pode:

- trocar rotas definidas no manifesto
- quebrar contratos compartilhados
- ignorar `Requirement Spec`
- ignorar `Test Spec`
- entregar sem passar em review, lint, test e build

## Selecao de modo

O planner continua existindo, mas a etapa de implementacao agora segue um caminho unico:

- `autonomous`

Nao existe mais bifurcacao entre executor deterministico e executor autonomo.

O que varia agora e o `autonomyLevel`, que orienta quanta liberdade o agente recebe para:

- escolher composicao
- refinar split de arquivos
- ajustar densidade e estrutura da tela
- aprofundar integracao com o projeto existente

## Resultado esperado

Com essa camada, a esteira deve evoluir de:

- geracao por moldes fortes demais

para:

- implementacao com mais julgamento
- telas menos enviesadas
- melhor encaixe no projeto real
- codigo mais proximo do comportamento de um bom agente de desenvolvimento

## Limite do estado atual

O corte atual resolveu bem a fundacao operacional da esteira, mas ainda nao entrega autonomia plena.

Hoje o sistema esta mais proximo de:

- agente autonomo guiado por contrato
- reviewer ainda influenciando forma demais
- fallback estrutural forte demais
- UI ainda parcialmente pre-desenhada pela factory

Isso e bom para confiabilidade, mas ainda insuficiente para parecer o trabalho de uma boa ferramenta de agente de desenvolvimento.

## Meta de evolucao

O alvo nao e remover contratos nem review.

O alvo e mudar o papel de cada camada:

- contratos definem limites
- agente cria a solucao
- review avalia resultado
- repair melhora a solucao
- fallback so salva falhas estruturais reais

Em outras palavras, a arquitetura deve sair de:

- `agente dentro de trilhos`

para:

- `agente livre com guardrails`

## Plano de migracao

### Fase 1. Materializacao primaria pelo agente

#### Objetivo

Fazer o `implementation_autonomous_agent` virar o gerador principal dos arquivos-alvo.

#### O que mudar

- tratar a saida da LLM como fonte primaria de `page.tsx`, `service.ts`, `router.ts` e `service.ts` backend
- usar fallback apenas quando faltar arquivo essencial ou quando o parse falhar
- parar de reconstruir a feature inteira a partir de helpers estruturais quando o agente respondeu algo aproveitavel

#### Criterio de pronto

- em features `workspace` e `settings`, a maioria das execucoes bem-sucedidas nasce primeiro da saida da LLM
- fallback passa a ser excecao observavel, nao caminho dominante

### Fase 2. Review orientado a resultado

#### Objetivo

Fazer o reviewer validar aderencia, nao impor uma unica forma de tela.

#### O que mudar

- reduzir dependencia de `screenTemplate`, `uiFamily` e `shell` como exigencias rigidas
- manter checks de:
  - requisito
  - QA
  - uso do design system compartilhado
  - coerencia de dominio
  - convivencia com o projeto atual
- aceitar variedade estrutural real quando a feature usa primitivas compartilhadas e entrega os comportamentos esperados

#### Criterio de pronto

- duas solucoes estruturalmente diferentes podem passar no specialist review para a mesma familia funcional
- o gate deixa de matar frontend livre so por nao usar a mesma casca

### Fase 3. Factory menos opinativa na UI

#### Objetivo

Parar de pre-desenhar a feature antes do agente decidir.

#### O que mudar

- rebaixar `screenTemplate`, `uiFamily`, `shellKey` e exemplos de dominio de trilho para contexto
- manter shell registry como repertorio opcional, nao caminho obrigatorio
- reduzir geradores auxiliares que empurram `hero + form + list`, cockpit, ou variantes fixas

#### Criterio de pronto

- o agente consegue escolher entre usar shell, usar casca mais leve ou renderizar pagina livre
- a estrutura final da tela depende mais da historia e menos do helper da factory

### Fase 4. Repair como iteracao, nao substituicao

#### Objetivo

Fazer o repair melhorar a solucao do agente, e nao trocar a autoria da feature por um template seguro.

#### O que mudar

- repair deve receber findings concretos e responder sobre os mesmos arquivos
- preservar o desenho da feature quando os erros forem locais
- usar reconstrucoes completas so em caso de:
  - parse invalido
  - quebra estrutural grave
  - ausencia de arquivos obrigatorios

#### Criterio de pronto

- a segunda passada do agente corrige os findings sem resetar a tela para um molde generico
- a autoria do agente permanece legivel depois do repair

### Fase 5. Observabilidade da autonomia

#### Objetivo

Medir se a autonomia esta de fato aumentando.

#### O que mudar

- registrar por implementacao:
  - `generationSource`: `llm_primary`, `llm_repair`, `fallback_minimal`, `fallback_full`
  - `reviewFreedomAccepted`: boolean
  - `repairStyle`: `iterative` ou `reconstructive`
- criar eval para comparar:
  - diversidade estrutural
  - aderencia a requisito e QA
  - taxa de fallback
  - taxa de repair destrutivo

#### Criterio de pronto

- cada rodada da esteira mostra claramente quanta autonomia real houve
- o time consegue provar reducao de fallback e aumento de materializacao primaria por agente

## Ordem recomendada

1. Fase 1
2. Fase 2
3. Fase 4
4. Fase 3
5. Fase 5

## Por que essa ordem

- primeiro o agente precisa virar gerador principal
- depois o review precisa parar de puxar tudo para a mesma forma
- em seguida o repair deixa de matar a autoria da feature
- so depois vale reduzir mais a opiniao da factory
- por fim medimos autonomia com mais precisao

## Sinais de que chegamos no alvo

- a feature parece criada por julgamento, nao por trilho
- o build e os testes continuam estaveis
- o specialist review aprova variedade estrutural real
- o fallback vira excecao
- o repair melhora a solucao sem reencaixotar a tela
