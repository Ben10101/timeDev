# UI Archetype System

## Objetivo
Dar ao Aligna uma camada profissional de generalização para telas desconhecidas, evitando dependência exclusiva de casos já vistos.

## Camadas
- `domainSignals`: sinais inferidos do briefing, campos e contexto técnico
- `pageArchetype`: classe de tela escolhida por scoring
- `fallbackPattern`: padrão de mercado usado como referência de composição
- `recommendedSections`: estrutura recomendada para o `Generation IR`
- `patternHints`: pistas adicionais para o gerador de UI

## Archetypes atuais
- `executive-dashboard`
  Uso: leitura executiva, comparação, métricas, desvios
  Pattern: `vercel-analytics`
- `operations-queue`
  Uso: fila operacional, urgência, ownership, próxima ação
  Pattern: `linear-queue`
- `review-queue`
  Uso: triagem, revisão, decisão com contexto
  Pattern: `linear-queue`
- `approval-flow`
  Uso: aprovação, parecer, histórico, auditoria
  Pattern: `github-review`
- `settings-console`
  Uso: configuração, preferências, governança, estado atual
  Pattern: `stripe-settings`
- `evidence-workbench`
  Uso: anexos, evidências, caso, contexto vivo
  Pattern: `notion-evidence`
- `intake-form`
  Uso: captura estruturada com ação principal clara
  Pattern: `stripe-records`
- `record-management`
  Uso: fallback geral para CRUD/lista
  Pattern: `stripe-records`

## Domain Signals
- `hasWorkflow`
- `hasApproval`
- `hasVolume`
- `hasPriority`
- `hasOwner`
- `hasSla`
- `hasAttachment`
- `hasSettings`
- `hasMonitoring`
- `hasAuditTrail`
- `hasCollaboration`
- `dataDensity`
- `primaryAction`
- `primaryEntity`

## Regra de decisão
O sistema usa scoring por archetype, não `if/else` único. Isso permite:
- maior auditabilidade
- alternativas ranqueadas
- confiança relativa
- ajuste incremental sem quebrar toda a taxonomia

## Critério profissional
- toda resolução deve expor `confidenceScore`
- toda resolução deve expor `alternativeArchetypes`
- toda resolução deve ser validável por fixture
- o `Generation IR` deve carregar o resultado para comparação em evals

## Próximo passo
- usar `pageArchetype` para dirigir materialização visual mais profunda
- incluir evals visuais por domínio desconhecido
- calibrar scoring com histórico real de projetos gerados
