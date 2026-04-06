# PM Backlog Quality Contract

Este documento descreve o contrato novo esperado para o agente `project_manager`.

## Objetivo

O `project_manager` nao deve apenas listar historias plausiveis.

Ele deve gerar um backlog inicial executavel, com:

- cobertura do fluxo principal
- agrupamento por capacidades e epicos
- separacao entre MVP e evolucao
- historias coerentes com o briefing
- curadoria contra duplicacao, truncamento e backlog "bonito porem vazio"

## Estrutura obrigatoria do backlog

Todo backlog novo deve conter:

- `## Visao Geral`
- `## Capacidades do Produto`
- `## Epicos Recomendados`
- `## Fatias de Release`
- `## Historias de Usuario`

## Regras de qualidade

### 1. Cobertura da espinha dorsal

O backlog precisa cobrir sinais minimos do fluxo principal, como:

- criar ou cadastrar
- configurar ou planejar
- visualizar ou consultar
- acompanhar ou operar
- aprovar ou decidir

### 2. Historias

- entre 15 e 25 historias
- cada historia no formato `Como ..., eu quero ..., para ...`
- sem historias truncadas
- sem duplicacoes fortes
- sem excesso de `Como um usuario`

### 3. Capacidades

- entre 4 e 6 capacidades
- descrevem o que o produto precisa permitir
- nao devem ser tasks tecnicas

### 4. Epicos

- entre 4 e 6 epicos
- precisam cobrir fundacao, operacao, gestao e governanca

### 5. Fatias de release

Devem existir pelo menos:

- `MVP`
- `Fase 2`
- `Fase 3`

O MVP precisa priorizar a fundacao do produto.

## Falhas comuns que o PM deve evitar

- backlog com edge cases antes do fluxo principal
- backlog sem historias de fundacao
- backlog com atores demais cedo demais
- backlog com todas as prioridades parecidas
- backlog com historias plausiveis, mas sem sequencia de entrega

## Implicacoes para o runtime

O importador de backlog continua lendo a secao `Historias de Usuario`.

As novas secoes existem para:

- elevar a qualidade do planejamento
- melhorar revisao humana
- dar mais contexto para avaliacao do backlog
- facilitar reorganizacao em MVP e fases seguintes
