# Como gestor administrativo, eu quero configurar templates de documentos obrigatórios por tipo de visita, para garantir que cada visitante traga exatamente o que a política de segurança exige.
Task UUID: 40958687-48a1-4f3c-84cc-f62dd0fc1a8f
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: workspace
- uiFamily: operations-workspace
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
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |