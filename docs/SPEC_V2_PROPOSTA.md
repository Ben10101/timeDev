# Proposta de Spec V2

Esta proposta consolida o que hoje esta espalhado entre `productSpec`, `screenSpec`, `moduleSpec` e o backlog do PM Agent em uma spec unica, mais contratual e mais facil de validar.

## Objetivo

- Tornar a spec mais forte como contrato de produto, nao apenas como insumo de geracao.
- Preservar compatibilidade com a estrutura atual.
- Aumentar rastreabilidade entre briefing, backlog, UI, API, QA e observabilidade.

## Principios

1. A spec precisa explicar o que o produto e e por que ele existe.
2. A spec precisa dizer como o sistema se comporta em produto, UI, API e testes.
3. Cada requisito importante precisa ser rastreavel ate uma historia, um endpoint, uma tela ou um teste.
4. A estrutura nova deve permitir evolucao sem quebrar o formato atual.

## Schema Proposto

```json
{
  "specVersion": "2.0",
  "project": {
    "uuid": "string",
    "name": "string",
    "slug": "string",
    "summary": "string",
    "problemStatement": "string",
    "goals": ["string"],
    "inScope": ["string"],
    "outOfScope": ["string"],
    "assumptions": ["string"],
    "dependencies": ["string"],
    "risks": [
      {
        "id": "string",
        "label": "string",
        "severity": "low | medium | high | critical",
        "mitigation": "string"
      }
    ]
  },
  "personas": [
    {
      "id": "string",
      "name": "string",
      "role": "string",
      "responsibilities": ["string"],
      "permissions": ["string"],
      "painPoints": ["string"],
      "primaryJourneys": ["string"]
    }
  ],
  "domainModel": {
    "entities": [
      {
        "name": "string",
        "description": "string",
        "fields": [
          {
            "name": "string",
            "type": "string",
            "required": true,
            "unique": false,
            "label": "string",
            "description": "string"
          }
        ],
        "relationships": [
          {
            "target": "string",
            "type": "one-to-one | one-to-many | many-to-many",
            "cardinality": "string",
            "description": "string"
          }
        ],
        "states": ["string"],
        "invariants": ["string"],
        "businessRules": ["string"]
      }
    ]
  },
  "journeys": [
    {
      "id": "string",
      "title": "string",
      "personaId": "string",
      "trigger": "string",
      "steps": ["string"],
      "successCriteria": ["string"],
      "failureModes": ["string"],
      "edgeCases": ["string"],
      "primaryCTA": "string",
      "acceptanceCriteria": ["string"],
      "relatedStoryIds": ["string"]
    }
  ],
  "backlog": {
    "stories": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "personaId": "string",
        "journeyId": "string",
        "priority": "string",
        "acceptanceCriteria": ["string"],
        "businessRules": ["string"],
        "testScenarios": ["string"],
        "tags": ["string"]
      }
    ],
    "epics": [
      {
        "id": "string",
        "title": "string",
        "scope": "string",
        "storyIds": ["string"]
      }
    ],
    "releaseSlices": [
      {
        "id": "string",
        "name": "MVP | Fase 2 | Fase 3",
        "goal": "string",
        "inclusions": ["string"],
        "exclusions": ["string"]
      }
    ]
  },
  "ui": {
    "screenSpec": {
      "route": "string",
      "navigationLabel": "string",
      "pageTitle": "string",
      "productMode": "string",
      "uiIntent": "string",
      "pageArchetype": "string",
      "fallbackPattern": "string",
      "layoutVariant": "string",
      "sections": [
        {
          "id": "string",
          "name": "string",
          "intent": "string",
          "priority": "high | medium | low",
          "content": ["string"],
          "primaryCTAs": ["string"],
          "secondaryCTAs": ["string"],
          "states": {
            "empty": "string",
            "loading": "string",
            "error": "string",
            "success": "string"
          },
          "visibilityRules": ["string"]
        }
      ],
      "componentMap": {
        "string": "string"
      },
      "patternHints": ["string"],
      "dataSources": [
        {
          "name": "string",
          "resource": "string",
          "fields": ["string"]
        }
      ],
      "fieldMap": [
        {
          "name": "string",
          "label": "string",
          "inputType": "string",
          "required": true,
          "placeholder": "string",
          "helpText": "string"
        }
      ]
    }
  },
  "api": {
    "moduleSpec": {
      "entityName": "string",
      "routeBase": "string",
      "moduleName": "string",
      "pageArchetype": "string",
      "domainSignals": ["string"],
      "validationLibrary": "string",
      "testLibrary": "string",
      "logger": "string",
      "files": ["string"],
      "operationMap": {
        "list": "string",
        "detail": "string",
        "create": "string",
        "update": "string",
        "delete": "string",
        "status": "string",
        "review": "string",
        "attach": "string",
        "audit": "string",
        "prioritize": "string"
      },
      "operations": [
        {
          "name": "string",
          "method": "GET | POST | PATCH | DELETE",
          "path": "string",
          "requestSchema": "object",
          "responseSchema": "object",
          "statusCodes": ["string"],
          "permissions": ["string"],
          "sideEffects": ["string"]
        }
      ],
      "contracts": {
        "request": ["string"],
        "response": ["string"],
        "errors": ["string"]
      },
      "fields": ["string"]
    }
  },
  "qa": {
    "testPlan": [
      {
        "id": "string",
        "title": "string",
        "journeyId": "string",
        "storyId": "string",
        "type": "happy-path | edge-case | failure | regression",
        "steps": ["string"],
        "expectedResult": "string",
        "automationHint": "string"
      }
    ],
    "traceability": [
      {
        "acceptanceCriterion": "string",
        "storyId": "string",
        "testId": "string",
        "uiSectionId": "string",
        "apiOperation": "string"
      }
    ]
  },
  "nfrs": [
    {
      "id": "string",
      "category": "performance | security | observability | accessibility | reliability | scalability",
      "requirement": "string",
      "metric": "string",
      "target": "string"
    }
  ],
  "observability": {
    "auditEvents": [
      {
        "name": "string",
        "description": "string",
        "actor": "string",
        "payloadFields": ["string"]
      }
    ],
    "telemetry": [
      {
        "name": "string",
        "description": "string",
        "successSignal": "string",
        "failureSignal": "string"
      }
    ]
  },
  "changeLog": [
    {
      "version": "string",
      "date": "string",
      "summary": "string"
    }
  ]
}
```

## O que muda em relacao ao que existe hoje

### 1. `problemStatement`, `goals`, `inScope` e `outOfScope`

Hoje a spec entende o produto, mas ainda nao descreve o problema com clareza suficiente. Esses campos deixam o briefing mais objetivo e ajudam a impedir derivacoes fora de escopo.

### 2. `personas` com responsabilidade e permissao

Hoje existe persona em nivel de sugestao. Na V2, cada persona passa a ter:

- responsabilidades
- permissoes
- dores
- jornadas principais

Isso melhora a geracao de UI, permissao e testes.

### 3. `journeys`

As jornadas passam a ser um contrato real e nao apenas uma lista de ideias. Cada jornada pode ser usada para:

- orientar backlog
- mapear tela
- criar aceite
- montar teste

### 4. `domainModel`

O dominio deixa de ser apenas lista de entidades. A V2 traz:

- relacoes
- estados
- invariantes
- regras de negocio

Isso ajuda a evitar specs rasas demais para implementacao.

### 5. `ui.screenSpec.sections`

As seções passam a ter:

- intencao
- prioridade
- conteudo esperado
- CTAs
- estados
- regras de visibilidade

Hoje o sistema ja usa `sections` e `componentMap`, mas a V2 formaliza o comportamento de cada area.

### 6. `api.moduleSpec.operations`

O backend deixa de ser apenas mapa de arquivos e passa a descrever:

- request
- response
- status codes
- permissao
- efeitos colaterais

Isso reduz ambiguidade na geracao e na validacao.

### 7. `qa.traceability`

A V2 obriga ligacao entre:

- criterio de aceite
- story
- teste
- secao de UI
- operacao de API

Esse e o ponto que mais aproxima a spec de uma base de entrega auditavel.

## Compatibilidade com a estrutura atual

Mapeamento sugerido:

- `productSpec` atual -> `project`, `personas`, `domainModel`, `backlog`
- `screenSpec` atual -> `ui.screenSpec`
- `moduleSpec` atual -> `api.moduleSpec`
- backlog do PM -> `backlog.stories`, `backlog.epics`, `backlog.releaseSlices`
- criterios de aceite -> `backlog.stories[].acceptanceCriteria`
- testes -> `qa.testPlan`

## Ordem recomendada de implementacao

1. Criar a spec V2 como camada de leitura, sem substituir nada.
2. Mapear a spec atual para V2.
3. Fazer a UI e o backend consumirem V2 em paralelo com o formato atual.
4. Validar se backlog, tela e API continuam gerando corretamente.
5. So depois descontinuar os campos antigos.

## Resultado esperado

- Menos ambiguidade no briefing.
- Melhor qualidade de backlog.
- UI mais semantica.
- API com contrato mais claro.
- Testes mais rastreaveis.
- Base melhor para auditoria e governanca.

