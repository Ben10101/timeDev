# UI Layout Variant Comparison

## Escopo

Comparacao da Sprint 2: sair de geracao de UI centrada em copy para geracao com `layoutVariant`.

Projeto de validacao:

- [central-de-chamados-internos](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos)

Arquivos-chave:

- [generate_implementation_ui.py](/c:/Users/bleao/ai-software-factory/orchestrator/generate_implementation_ui.py)
- [implementationService.js](/c:/Users/bleao/ai-software-factory/backend/src/services/implementationService.js)
- [packages/ui/src/index.tsx](/c:/Users/bleao/ai-software-factory/backend/src/templates/fullstack/react-express-prisma/packages/ui/src/index.tsx)

## Antes

- o gerador devolvia copy e labels, mas nao escolhia uma variante explicita de composicao
- o frontend gerado passava sempre pelo mesmo tipo de arranjo por template
- `settings`, `dashboard` e `workspace` mudavam tom, mas pouco mudavam a ordem de leitura

## Depois

- o gerador agora devolve `layoutVariant`
- o fallback tambem decide variante por dominio, `productMode` e `screenTemplate`
- o `implementationService` normaliza e persiste essa variante no spec/frontend
- os shells `FeatureWorkbench` e `SettingsWorkbench` passaram a reagir a variantes reais

Variantes ativas:

- `balanced-split`
- `hero-metrics`
- `queue-first`
- `evidence-split`
- `calm-settings`
- `summary-first`
- `checklist-settings`
- `guided-stack`

## Comparacao concreta

Dashboard de performance:

- arquivo: [support-performance-dashboard/page.tsx](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/apps/web/src/features/support-performance-dashboard/page.tsx)
- variante: `hero-metrics`
- efeito real:
  - painel principal invertido para leitura executiva primeiro
  - metrics destacadas no hero
  - records variant de `insights`

Notificacoes:

- arquivo: [ticket-notification-preferences/page.tsx](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/apps/web/src/features/ticket-notification-preferences/page.tsx)
- variante: `summary-first`
- efeito real:
  - summary lidera a tela
  - ordem dos paineis invertida no `SettingsWorkbench`
  - a coluna lateral deixa de ser so apoio e vira leitura principal

Shell compartilhado:

- arquivo: [packages/ui/src/index.tsx](/c:/Users/bleao/ai-software-factory/generated-projects/central-de-chamados-internos/packages/ui/src/index.tsx)
- ganho:
  - `FeatureWorkbench` agora aceita `layoutVariant`
  - `SettingsWorkbench` agora aceita `layoutVariant`
  - as variantes alteram `reversePanels`, `bodyColumns`, `recordsVariant`, `highlightVariant` e ordem das colunas

## Validacoes executadas

- `python -m py_compile orchestrator/generate_implementation_ui.py`
- `node -e "import('./backend/src/services/implementationService.js')..."`
- `bootstrapGeneratedApp('c4a735a7-8034-4dea-acf0-407d3932bab9', { forceRebuild: true })`
- `npm run lint`
- `npm run build:web`
- `npm run build:api`

## Ganho real

- telas do mesmo sistema agora podem nascer com hierarquia visual diferente
- `dashboard` e `settings` deixaram de ser apenas copy diferente sobre um esqueleto quase igual
- a variacao passou a existir no contrato da IA, no spec tecnico e no shell renderizado
