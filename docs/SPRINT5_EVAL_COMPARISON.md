# Sprint 5 Eval Comparison

## Escopo

Comparacao da Sprint 5: ampliar qualidade e comparabilidade de agentes, prompts e provider runtime.

Arquivos alterados:

- [run-eval.mjs](/c:/Users/bleao/ai-software-factory/scripts/agent-evals/run-eval.mjs)
- [run-developer-agent.py](/c:/Users/bleao/ai-software-factory/scripts/agent-evals/run-developer-agent.py)
- [agent-evals/README.md](/c:/Users/bleao/ai-software-factory/agent-evals/README.md)
- [developer-backend-depth.md](/c:/Users/bleao/ai-software-factory/agent-evals/cases/developer-backend-depth.md)
- [developer-frontend-depth.md](/c:/Users/bleao/ai-software-factory/agent-evals/cases/developer-frontend-depth.md)
- [developer-backend-depth.json](/c:/Users/bleao/ai-software-factory/agent-evals/fixtures/developer-backend-depth.json)
- [developer-frontend-depth.json](/c:/Users/bleao/ai-software-factory/agent-evals/fixtures/developer-frontend-depth.json)

## Antes

- os evals conseguiam validar build, smoke e alguns fluxos de produto
- faltava uma forma simples de comparar profundidade dos agentes `developer_backend` e `developer_frontend`
- os resultados nao distinguiam bem:
  - saida estrutural do agente
  - origem da resposta em runtime
  - hints de provider usados pelo fluxo
- a leitura do resultado ainda dependia demais de abrir o artefato bruto

## Depois

- o runner passou a suportar casos de profundidade de agente:
  - `developer-backend-depth`
  - `developer-frontend-depth`
- o runner agora extrai metadata JSON automatica quando o comando devolve estrutura parseavel
- os resultados passam a registrar sinais comparaveis como:
  - `artifact_version`
  - `primary_entity`
  - `meta.source`
  - `meta.providerHint`
  - sinais curtos de modulos, operacoes ou secoes de UI
- ficou mais facil comparar:
  - fallback vs provider real
  - prompt antigo vs novo
  - agente mais raso vs mais profundo

## Casos reais executados

### Developer Backend Depth

Resultado: [2026-04-02-developer-backend-depth-v5-evals.md](/c:/Users/bleao/ai-software-factory/agent-evals/results/2026-04-02-developer-backend-depth-v5-evals.md)

Sinais capturados:

- `artifact_version = 2`
- `primary_entity = Ticket`
- modulos backend detectados:
  - `backend/src/routes/ticket.js`
  - `backend/src/controllers/ticketController.js`
  - `backend/src/services/ticketService.js`
  - `backend/src/repositories/ticketRepository.js`
- contrato de API presente no payload JSON

### Developer Frontend Depth

Resultado: [2026-04-02-developer-frontend-depth-v5-evals.md](/c:/Users/bleao/ai-software-factory/agent-evals/results/2026-04-02-developer-frontend-depth-v5-evals.md)

Sinais capturados:

- `artifact_version = 2`
- `primary_entity = Ticket`
- modulos frontend detectados:
  - `frontend/src/pages/TicketListPage.jsx`
  - `frontend/src/pages/TicketDetailPage.jsx`
  - `frontend/src/components/forms/TicketForm.jsx`
  - `frontend/src/components/Ticket/TicketToolbar.jsx`
- experiencia de UI presente com:
  - rotas
  - estados
  - secoes de interface

### Runtime Metadata do UI Generator

Resultado: [2026-04-02-aligna-ui-copy-generation-v5-evals.md](/c:/Users/bleao/ai-software-factory/agent-evals/results/2026-04-02-aligna-ui-copy-generation-v5-evals.md)

Sinais capturados:

- `meta.source = fallback`
- `meta.providerHint = auto`
- `layoutVariant = summary-first` dentro do payload da tela
- motivo explicito de fallback com detalhe de quota/chaves indisponiveis

## Comparacao real do ganho

- antes: a profundidade dos agentes precisava ser validada manualmente, abrindo o output inteiro
- depois: os resultados ja mostram entidade, versao de artefato e sinais estruturais de forma automatica
- antes: fallback e provider real podiam se misturar visualmente no resultado
- depois: a origem do runtime fica explicita no proprio markdown do eval
- antes: o loop de comparacao era mais forte em build e smoke do que em qualidade de artefato
- depois: ele tambem mede profundidade dos agentes de implementacao

## Limites atuais

- a Sprint 5 melhora comparabilidade, nao resolve por si so indisponibilidade de provider
- quando a chave ou quota falha, o eval continua util, mas ele prova fallback e nao qualidade do provider remoto
- ainda falta ampliar checkpoint visual/manual por tela critica para transformar layout e UX em score mais objetivo

## Validacao local

Execucoes validadas:

- `python -m py_compile scripts/agent-evals/run-developer-agent.py`
- `node scripts/agent-evals/run-eval.mjs developer-backend-depth --prompt-version v5-evals --evaluator Codex --model manual-agent-eval --target "developer backend depth" --run`
- `node scripts/agent-evals/run-eval.mjs developer-frontend-depth --prompt-version v5-evals --evaluator Codex --model manual-agent-eval --target "developer frontend depth" --run`
- `node scripts/agent-evals/run-eval.mjs aligna-ui-copy-generation --prompt-version v5-evals --evaluator Codex --model manual-ui-eval --target "aligna ui runtime metadata" --run`

## Ganho real

- ficou mais facil provar ganho em agentes sem depender so de leitura humana de markdown
- o loop de eval agora cobre melhor backend, frontend e runtime de UI
- a equipe consegue distinguir com clareza:
  - melhoria estrutural do agente
  - melhoria de prompt
  - indisponibilidade de provider
- isso reduz bastante o risco de achar que houve melhora quando o sistema apenas caiu em fallback
