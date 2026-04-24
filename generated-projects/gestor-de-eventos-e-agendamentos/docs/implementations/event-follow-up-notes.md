# Como Carlos, analista financeiro, eu quero registrar observacoes de acompanhamento do evento, para apoiar a leitura operacional e a tomada de decisao.
Task UUID: 63704482-a8e3-4313-b393-c2e1d4fc68b9
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: workspace
- uiFamily: operations-workspace
- productMode: structured-workspace
## Rotas
- Frontend: /operations/event-notes
- Backend: /api/event-follow-up-notes
## Contratos da feature
- Request: EventFollowUpNoteRequest
- Response: EventFollowUpNoteResponse
- Shared contract: packages/shared/src/contracts/event-follow-up-notes.ts
## Campos principais
- Evento: Informe o identificador do evento ao qual a observacao sera vinculada.
- Observacao de acompanhamento: Registre a nota de contexto que ajuda a explicar prioridades, riscos ou pendencias do evento.
## Regras operacionais
- Cada observacao deve ficar vinculada a um evento existente antes de ser registrada.
- O texto da observacao e obrigatorio e precisa trazer contexto suficiente para leitura operacional, com minimo de 10 e maximo de 1000 caracteres.
- O sistema deve registrar automaticamente autor e data/hora para manter rastreabilidade do acompanhamento.
- Observacoes registradas nao devem ser excluidas do historico operacional da feature gerada.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4 + TypeScript
- **ORM**: Prisma 5 + PostgreSQL 15
- API[Express REST API]
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Camada |
- **OperationalRecord** | Registro operacional inicial + aprovação | Domain |
- **Responsible** | Vincular responsável operacional | Domain |