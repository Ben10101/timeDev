# Como anfitrião, eu quero visualizar o histórico de visitas de um cliente recorrente, para agilizar novo agendamento com dados pré-preenchidos.
Task UUID: fe9d564c-1dbe-4b3e-bd56-51eedabe21c8
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: dashboard
- uiFamily: executive-cockpit
- productMode: evidence-workbench
## Rotas
- Frontend: /operations/visit-history
- Backend: /api/visit-recurring-history
## Contratos da feature
- Request: VisitRecurringHistoryRequest
- Response: VisitRecurringHistoryResponse
- Shared contract: packages/shared/src/contracts/visit-recurring-history.ts
## Campos principais
- Identificador do cliente: Informe CPF, CNPJ ou ID do cliente para localizar visitas anteriores.
- Periodo: Defina o recorte temporal usado para consultar o historico recorrente.
- Status da visita: Mostre apenas visitas realmente aproveitaveis para o novo agendamento.
## Regras operacionais
- O sistema nao deve permitir registros com e-mail duplicado.
- O e-mail deve ser validado antes do envio para persistencia.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |