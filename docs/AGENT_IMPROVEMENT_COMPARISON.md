# Agent Improvement Comparison

## Escopo desta comparacao

Comparacao do estado anterior do bootstrap de app gerado com o novo bootstrap guiado por `projectTemplateKey`.

Projeto de referencia preservado:

- Projeto: `central-de-chamados-internos`
- Template aplicado: `internal-support-hub`
- App gerado: [central-de-chamados-internos](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos)

## Antes

- o bootstrap criava apenas a base full-stack generica
- a home do app era sempre a mesma, com copy fixa e sem relacao com o blueprint do projeto
- o projeto nao registrava quais features iniciais vinham do template
- features do blueprint nao eram materializadas automaticamente no bootstrap

## Depois

- o bootstrap resolve o `projectTemplateKey` e usa esse blueprint para montar a home
- a navegacao inicial respeita a ordem definida em `featureKeys`
- o app nasce com features iniciais materializadas pelo template
- o projeto passa a registrar:
  - `bootstrapTemplateKey`
  - `bootstrapFeatureKeys`
  - `bootstrapGeneratedAt`
- o bootstrap deixa evidencias diretas na home, na navegacao e nos modulos gerados do app preservado

## Comparacao real

Home do app:

- antes: `Resumo do workspace` com descricao generica e metricas fixas
- depois: `Resumo do workspace` com posicionamento do blueprint de suporte e metricas de `Tom visual` e `Navegacao`

Jornadas iniciais:

- antes: nenhuma feature inicial garantida no bootstrap
- depois:
  - `support-performance-dashboard`
  - `support-ticket-attachments`
  - `ticket-notification-preferences`
  - `access-control-roles`

Persistencia do blueprint:

- antes: o projeto nao guardava quais features vieram do template
- depois:
  - `bootstrapTemplateKey = project/internal-support-hub`
  - `bootstrapFeatureKeys = [support-performance-dashboard, support-ticket-attachments, ticket-notification-preferences, access-control-roles]`

## Evidencias

Arquivos gerados pelo bootstrap:

- [App.tsx](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/apps/web/src/App.tsx)
- [support-performance-dashboard/page.tsx](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/apps/web/src/features/support-performance-dashboard/page.tsx)
- [server.ts](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/apps/api/src/server.ts)
- [schema.prisma](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/prisma/schema.prisma)

Validacoes executadas:

- `node -e "import('./backend/src/services/implementationService.js')..."`
- `bootstrapGeneratedApp('c4a735a7-8034-4dea-acf0-407d3932bab9', { forceRebuild: true })`
- `npm install`
- `npm run lint`
- `npm run test`
- `npm run build:web`
- `npm run build:api`

## Ganho real

- o template de projeto deixou de ser metadata passiva e passou a dirigir o app inicial
- a home gerada ja comunica dominio e tom do produto
- a primeira geracao do projeto fica mais comparavel entre templates
- a base nasce com jornadas mais proximas do produto real, em vez de um shell genericamente bonito
