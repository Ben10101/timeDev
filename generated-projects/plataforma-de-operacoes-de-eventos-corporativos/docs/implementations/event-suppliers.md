# Como coordenador de eventos, eu quero cadastrar fornecedores com categoria de servico e contatos principais, para centralizar quem pode participar da operacao.
Task UUID: 4375b870-befd-46e9-8b93-1db870d15609
## Resumo
Feature integrada no baseline full stack pos-refinamento.
## Template de tela
- workspace
## Rotas
- Frontend: /operations/suppliers
- Backend: /api/event-suppliers
## Stack e arquitetura
- ## Stack Tecnologico
- - **Frontend**: React + TypeScript + Tailwind
- - **Backend**: Node.js (NestJS) + TypeScript
- WEB[React SPA]
- ```typescript
## Modulos e limites
- ## Modulos e Responsabilidades
- | Módulo | Responsabilidades |
- │   │   ├── domain/
- - **Domain-Driven Design (DDD)**: Estrutura modular por domínio (events, suppliers, budgets) com agregados ricos (Event, Budget, Timeline) e repositórios focados em persistência.
- - **Event Sourcing para Auditoria**: Registro imutável de Occurrence, BudgetApproval e StageStatusChange como eventos de domínio para rastreabilidade completa.
- - **Branching**: trunk-based; feature flags via LaunchDarkly.