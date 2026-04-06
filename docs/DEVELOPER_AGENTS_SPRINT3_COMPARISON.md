# Developer Agents Sprint 3 Comparison

## Escopo

Comparacao da Sprint 3: fortalecimento dos agentes `developer_backend` e `developer_frontend`.

Arquivos alterados:

- [shared.py](/c:/Users/bleao/ai-software-factory/agents/developer/shared.py)
- [developer_backend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_backend/agent.py)
- [developer_frontend/agent.py](/c:/Users/bleao/ai-software-factory/agents/developer_frontend/agent.py)

## Antes

- os agentes devolviam basicamente:
  - `code`
  - `primary_entity`
  - `attributes`
  - `specialization`
- o `code` era um texto mais raso, com pouca profundidade operacional
- nao havia metadata estruturada de:
  - modulos
  - contratos
  - validacoes
  - experiencia de UI
  - resumo de entrega

## Depois

- os agentes continuam compativeis com o legado via `code`
- agora tambem devolvem `artifact_version = 2`
- `developer_backend` passou a devolver:
  - `modules`
  - `api_contract`
  - `validation_rules`
  - `delivery_summary`
- `developer_frontend` passou a devolver:
  - `modules`
  - `experience`
  - `delivery_summary`
- o agregador `developer` agora herda esses resumos para consolidacao melhor

## Caso de validacao

Ideia usada:

`Sistema para gerenciar chamados internos com prioridade, anexos, responsavel, status e historico para colaboradores, suporte e gestores.`

Arquitetura usada:

- React no frontend
- Express no backend
- MySQL com Prisma
- JWT
- modulos de chamados, anexos, notificacoes, perfis de acesso e dashboard

## Comparacao real

Backend:

- antes: entidade, atributos e um texto geral
- depois:
  - entidade inferida como `Ticket`
  - lista de modulos backend sugeridos
  - contrato de API com rotas, request/response e operacoes
  - regras de validacao derivadas dos atributos
  - bloco de erros, comportamento operacional e testes recomendados

Frontend:

- antes: entidade, atributos e um texto geral
- depois:
  - modulos de tela e service sugeridos
  - rotas de experiencia
  - estados obrigatorios
  - secoes de interface
  - regras de interacao para listagem, detalhe e feedback

Agregador `developer`:

- antes: mergeava backend/frontend, mas com pouco sinal estruturado
- depois: consolida `artifact_version = 2` e resumos claros por camada

## Evidencias locais

Execucoes validadas:

- `python -m py_compile agents/developer/shared.py agents/developer_backend/agent.py agents/developer_frontend/agent.py`
- execucao direta de `DeveloperBackend('sprint3-demo').process(...)`
- execucao direta de `DeveloperFrontend('sprint3-demo').process(...)`
- execucao direta de `Developer('sprint3-demo').process(...)`

Saidas observadas:

- `developer_backend` devolveu entidade `Ticket`
- `developer_backend.api_contract.collection_route = /api/v1/tickets`
- `developer_frontend.experience.routes = ['/tickets', '/tickets/:id']`
- `developer.artifact_version = 2`

## Ganho real

- os agentes deixaram de ser apenas planejadores textuais rasos
- o output ficou mais comparavel, mais orientado a implementacao e mais reutilizavel por outros passos
- o legado continua funcionando porque `code` foi preservado
- ficou mais facil medir profundidade de backend/frontend sem depender so de leitura humana do markdown
