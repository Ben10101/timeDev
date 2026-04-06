# Project Template Blueprints

Este documento define o primeiro nivel de templates de projeto inteiro para o Aligna.

## Objetivo

Sair de geracao isolada por feature e passar a iniciar projetos com um blueprint mais coerente de:

- posicionamento do produto
- tom do frontend
- modulos nucleares
- jornadas principais
- familias de tela esperadas

## Templates iniciais

### `internal-support-hub`

- label: `Central de Chamados Internos`
- foco: operacao de suporte, fila, SLA, evidencias e governanca
- modulos nucleares:
  - `support-performance-dashboard`
  - `support-ticket-attachments`
  - `ticket-notification-preferences`
  - `access-control-roles`

### `corporate-reimbursement-saas`

- label: `Plataforma SaaS de Reembolsos Corporativos`
- foco: solicitacao, aprovacao, comprovantes, politicas e auditoria
- modulos nucleares:
  - `support-ticket-attachments`
  - `ticket-notification-preferences`
  - `access-control-roles`
  - `support-performance-dashboard`

### `education-platform-suite`

- label: `Plataforma de EAD`
- foco: descoberta, estrutura pedagogica, matricula, consumo e conteudo
- modulos nucleares:
  - `course-catalog`
  - `course-modules`
  - `course-lessons`
  - `lesson-materials`
  - `course-pricing`
  - `course-search`
  - `course-enrollment`
  - `course-player`

## Como usar

Os blueprints ficam em:

- [catalog.js](/c:/Users/bleao/ai-software-factory/backend/src/templates/projects/catalog.js)
- [index.js](/c:/Users/bleao/ai-software-factory/backend/src/templates/projects/index.js)

O passo seguinte e conectar esse nivel ao fluxo de intake/orquestracao para:

1. identificar um `projectTemplateKey`
2. pre-selecionar o conjunto inicial de features
3. orientar a home do projeto e a linguagem das jornadas
4. reduzir variacao aleatoria entre projetos do mesmo tipo
