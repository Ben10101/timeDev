# Como anfitrião, eu quero adicionar acompanhantes extras à visita já aprovada com aprovação rápida do segurança, para evitar refazer todo o processo quando o cliente traz um consultor.
Task UUID: 8db29115-e0b5-487a-82dd-8f99d957fb1e
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: workspace
- uiFamily: planner-workbench
- productMode: timeline-planner
## Rotas
- Frontend: /operations/schedules
- Backend: /api/event-schedules
## Contratos da feature
- Request: EventScheduleRequest
- Response: EventScheduleResponse
- Shared contract: packages/shared/src/contracts/event-schedules.ts
## Campos principais
- Etapa do cronograma: Nomeie a etapa principal para deixar o plano facil de acompanhar.
- Prazo planejado: Defina a data alvo dessa etapa para dar previsibilidade ao time.
- Notas operacionais: Registre o contexto minimo da etapa para facilitar a execucao e o handoff.
## Regras operacionais
- Cada etapa do cronograma precisa ter um nome claro para facilitar acompanhamento e comunicacao entre os times.
- O cronograma inicial deve registrar um prazo planejado para cada etapa antes da execucao do evento.
- As notas operacionais precisam trazer contexto suficiente para orientar handoff e preparo da etapa.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |