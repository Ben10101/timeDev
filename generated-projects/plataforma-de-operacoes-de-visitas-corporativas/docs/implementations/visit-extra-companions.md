# Como anfitrião, eu quero adicionar acompanhantes extras à visita já aprovada com aprovação rápida do segurança, para evitar refazer todo o processo quando o cliente traz um consultor.
Task UUID: 8db29115-e0b5-487a-82dd-8f99d957fb1e
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: crud
- uiFamily: operations-workspace
- productMode: approval-flow
## Rotas
- Frontend: /operations/extra-companions
- Backend: /api/visit-extra-companions
## Contratos da feature
- Request: VisitExtraCompanionRequest
- Response: VisitExtraCompanionResponse
- Shared contract: packages/shared/src/contracts/visit-extra-companions.ts
## Campos principais
- Visita aprovada: Informe o identificador da visita ja aprovada para vincular o acompanhante extra ao registro correto.
- Nome do acompanhante: Registre o nome de quem sera incluído na mesma visita aprovada.
- Aprovacao rapida da seguranca: Indique a decisao rapida da seguranca para liberar a inclusao sem reiniciar o fluxo completo.
## Regras operacionais
- Sem regras adicionais registradas.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |