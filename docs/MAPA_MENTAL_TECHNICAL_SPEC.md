# Mapa Mental da Technical Spec

```text
Technical Spec
|
+-- 1. Identidade da feature
|   |
|   +-- featureKey
|       |
|       +-- define a identidade tecnica da feature
|       +-- afeta frontend, backend, contratos, schema e docs
|       +-- exemplo: event-follow-up-notes
|
+-- 2. Objetivo da implementacao
|   |
|   +-- implementationObjective
|       |
|       +-- primaryGoal
|       +-- userOutcome
|       +-- successDefinition
|       +-- nonGoals
|       |
|       +-- orienta o plano de execucao e a validacao final
|
+-- 3. Dominio funcional
|   |
|   +-- domain
|       |
|       +-- primaryAction
|       +-- submitLabel
|       +-- successMessage
|       +-- fields
|       |
|       +-- define o que a feature faz
|       +-- exemplo: Registrar Observacao
|
+-- 4. Campos
|   |
|   +-- domain.fields[]
|       |
|       +-- name
|       +-- label
|       +-- inputType
|       +-- tsType
|       +-- prismaType
|       +-- required
|       +-- helperText
|       +-- placeholder
|       +-- validations
|       +-- sampleValue
|       |
|       +-- afeta:
|           +-- formulario React
|           +-- schema de validacao
|           +-- contrato request
|           +-- model Prisma
|           +-- mensagens de erro
|
+-- 5. Frontend
|   |
|   +-- frontend
|       |
|       +-- featurePath
|       +-- suggestedRoute
|       +-- pageComponentName
|       +-- navigationLabel
|       +-- pageTitle
|       +-- pageDescription
|       +-- productMode
|       +-- layoutVariant
|       |
|       +-- afeta:
|           +-- pasta da feature
|           +-- rota no App.tsx
|           +-- nome do componente
|           +-- shell visual
|           +-- estrutura da experiencia
|
+-- 6. Arquitetura visual
|   |
|   +-- architecture
|       |
|       +-- screenTemplate
|       +-- sourceSummary
|       |
|       +-- afeta:
|           +-- tipo de tela
|           +-- workspace/settings/dashboard/wizard
|           +-- composicao do frontend
|
+-- 7. Classificacao estrutural
|   |
|   +-- structured.classification
|       |
|       +-- domain
|       +-- intent
|       +-- templateKey
|       +-- screenTemplate
|       +-- productMode
|       |
|       +-- afeta:
|           +-- template escolhido
|           +-- coerencia semantica
|           +-- tipo de UX gerada
|           +-- filtros de sanidade da esteira
|
+-- 8. Backend
|   |
|   +-- backend
|       |
|       +-- modulePath
|       +-- routeBase
|       +-- routerName
|       +-- serviceName
|       +-- routes
|       |
|       +-- afeta:
|           +-- modulo Express
|           +-- router
|           +-- service
|           +-- registro no server.ts
|
+-- 9. Contratos compartilhados
|   |
|   +-- shared
|       |
|       +-- contractPath
|       +-- requestContractName
|       +-- responseContractName
|       +-- listContractName
|       |
|       +-- afeta:
|           +-- tipagem entre frontend e backend
|           +-- shape de request/response
|           +-- integracao do monorepo
|
+-- 10. Persistencia
|   |
|   +-- database
|       |
|       +-- schemaPath
|       +-- modelName
|       +-- fields
|       |
|       +-- afeta:
|           +-- prisma/schema.prisma
|           +-- model final
|           +-- colunas persistidas
|
+-- 11. Regras de negocio
|   |
|   +-- businessRules[]
|       |
|       +-- afeta:
|           +-- validacoes no service
|           +-- coerencia da implementacao
|           +-- review automatico
|
+-- 12. Cenarios de QA
|   |
|   +-- qaScenarios[]
|       |
|       +-- code
|       +-- message
|       |
|       +-- afeta:
|           +-- mensagens esperadas
|           +-- cobertura de erro
|           +-- aderencia da feature ao requisito
|
+-- 13. UX e comportamento
    |
    +-- ux
        |
        +-- states
        +-- validationSummary
        +-- permissions
        |
        +-- afeta:
            +-- loading
            +-- empty state
            +-- feedback
            +-- experiencia da tela
```

## Leitura Rapida

Se voce quiser entender o que mais influencia a geracao de codigo, priorize estes campos:

1. `featureKey`
2. `domain.fields`
3. `frontend`
4. `backend`
5. `shared`
6. `database`
7. `architecture.screenTemplate`
8. `structured.classification`

## Exemplo Real

Story:

`Como Carlos, analista financeiro, eu quero registrar observacoes de acompanhamento do evento, para apoiar a leitura operacional e a tomada de decisao.`

Recorte correspondente:

- `featureKey`: `event-follow-up-notes`
- `frontend.suggestedRoute`: `/operations/event-notes`
- `backend.routeBase`: `/api/event-follow-up-notes`
- `shared.requestContractName`: `EventFollowUpNoteRequest`
- `database.modelName`: `EventFollowUpNote`
- `domain.fields`: `eventId`, `noteText`
- `architecture.screenTemplate`: `workspace`
- `structured.classification.templateKey`: `events/follow-up-notes`

## Fluxo Mental

1. A task refinada vira `Technical Spec`.
2. A `Technical Spec` organiza identidade, UI, backend, contrato e persistencia.
3. O gerador materializa arquivos reais com base nesses blocos.
4. O manifesto recompõe o app com as features validas e integradas.

## Checklist de Maturidade Antigravity

Use esta grade para avaliar se a geracao de codigo ja esta perto de um comportamento `antigravity`, ou seja, menos dependente de template fixo e mais guiada pela intencao real da feature.

### Escala

- `0`: ausente
- `1`: muito fraco
- `2`: parcial
- `3`: bom
- `4`: forte
- `5`: maduro

### 1. A spec vence a memoria do workspace

Pergunta:
- Quando uma nova `Technical Spec` entra, ela manda mais que template antigo, arquivo previo e heranca visual?

Sinal de maturidade:
- o gerador nao preserva pagina antiga sem justificativa forte
- a composicao final segue a spec mais recente
- residuos antigos nao contaminam a nova feature

Nota atual sugerida para o Aligna:
- `3/5`

Leitura:
- a spec ja governa boa parte da execucao
- houve avancos com reconciliacao e limpeza automatica
- ainda existe preservacao de page template e memoria de workspace influenciando demais o frontend

### 2. A variacao visual e estrutural e real

Pergunta:
- Features diferentes geram telas estruturalmente diferentes, e nao apenas a mesma moldura com copy alterada?

Sinal de maturidade:
- filas, dashboards, settings, approvals e workspaces sao visualmente distintos
- o layout muda de verdade conforme intencao e dominio
- o frontend nao cai sempre em `form + list + shell`

Nota atual sugerida para o Aligna:
- `2/5`

Leitura:
- existe classificacao de `screenTemplate`, `productMode`, `pageArchetype` e `componentMap`
- mas a expressao final ainda costuma convergir para um molde repetido

### 3. O mapeamento semantico e estavel

Pergunta:
- O sistema entende com consistencia se a feature e criar, editar, revisar, aprovar, buscar ou visualizar?

Sinal de maturidade:
- poucas quedas para dominio errado
- pouco drift entre task, spec e codigo
- sem confundir feature operacional com perfil/auth/configuracao generica

Nota atual sugerida para o Aligna:
- `3/5`

Leitura:
- a coerencia melhorou bastante
- a task de observacoes ja nao cai mais no desvio mais grave
- ainda existem casos antigos mostrando classificacao semantica errada

### 4. O repair e a reconciliacao sao inteligentes

Pergunta:
- Quando algo sai errado, o sistema corrige preservando aderencia sem voltar para o caminho mais generico?

Sinal de maturidade:
- repair corrige sem apagar a intencao da feature
- cleanup remove residuos de tentativas antigas
- o app recomposto reflete apenas features validas

Nota atual sugerida para o Aligna:
- `4/5`

Leitura:
- aqui o sistema esta forte
- review, validation, repair e reconciliacao ja funcionam como parte real da esteira

### 5. A tela nasce da operacao, nao apenas dos campos

Pergunta:
- A tela expressa a natureza da operacao ou apenas renderiza inputs e lista de registros?

Sinal de maturidade:
- a UX mostra fila, decisao, evidencia, cockpit, trilha, governanca ou acompanhamento
- o tipo de interacao vem antes do formulario
- o dominio e visivel no layout, nao so no texto

Nota atual sugerida para o Aligna:
- `2/5`

Leitura:
- semanticamente a feature pode estar correta
- mas visual e composicionalmente ainda ha gravidade de template

## Nota Consolidada do Aligna Hoje

### Gatilho de leitura

- `0 a 1`: geracao fortemente template-driven
- `2`: esteira avancada, mas ainda com forte gravidade de molde
- `3`: sistema agentic hibrido, proximo de antigravity
- `4`: agent-native forte, com pouca gravidade residual
- `5`: antigravity maduro

### Score sugerido

- `2.8 / 5`

### Interpretacao

- o Aligna ja esta acima de uma software factory baseada em prompt e scaffold
- ja existe comportamento agentic real em spec, validacao, repair e recomposicao do app
- o maior gap para antigravity ainda esta no frontend:
  - repeticao composicional
  - preservacao excessiva de template antigo
  - variacao visual ainda abaixo da ambicao do sistema

## Proxima Fronteira

Se a meta for empurrar o Aligna para uma faixa `3.5+`, as prioridades mais objetivas sao:

1. reduzir preservacao automatica de `pageTsxTemplate`
2. fazer `screenTemplate`, `pageArchetype`, `variationProfile` e `componentMap` mudarem de fato a composicao
3. usar a `Technical Spec` como autoridade maxima sobre a memoria do workspace
4. penalizar mais fortemente tela que sai semanticamente correta, mas visualmente generica
