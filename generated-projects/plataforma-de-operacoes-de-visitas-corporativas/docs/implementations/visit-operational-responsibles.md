# Como Bruno, assistente de recepcao, eu quero cadastrar o responsavel operacional com nome, contato e tipo de suporte, para vincular os recursos essenciais da visita.
Task UUID: 64022dfd-9fed-4e13-9d1f-a1c95bc0a796
## Resumo
Implementacao incremental desta story no fluxo operacional de visitas corporativas.
## Template de tela
- screenTemplate: workspace
- uiFamily: operations-workspace
- productMode: operations-registry
## Rotas
- Frontend: /operations/responsibles
- Backend: /api/visit-operational-responsibles
## Contratos da feature
- Request: VisitOperationalResponsibleRequest
- Response: VisitOperationalResponsibleResponse
- Shared contract: packages/shared/src/contracts/visit-operational-responsibles.ts
## Campos principais
- Nome do responsavel operacional: Informe o nome de quem apoia a operacao desta visita.
- Contato: Registre um e-mail ou telefone com DDD para acionamento rapido.
- Tipo de suporte: Selecione o tipo principal de apoio prestado por este responsavel.
## Regras operacionais
- O responsavel operacional precisa ter nome valido para identificacao clara durante a operacao.
- O contato deve aceitar e-mail valido ou telefone com DDD para acionamento rapido.
- O tipo de suporte precisa vir de uma lista predefinida para padronizar a classificacao.
- Nao e permitido duplicar responsavel operacional com mesmo nome e tipo de suporte.
## Stack e arquitetura
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 20 + Express 4
- **ORM**: Prisma 5
## Modulos e limites
- Modulos e Responsabilidades
- Módulo | Responsabilidade | Entidades Principais |