# Auditoria de testes — Aligna

Data: 2026-08-19

## Matriz de cobertura

| Prioridade | Componente | Cenário | Tipo de teste | Existe? | Resultado |
| --- | --- | --- | --- | --- | --- |
| P0 | Alignment API / contrato | Análise determinística retorna score, story e critérios | Smoke de serviço | Sim | Passou |
| P0 | Scoring | Limites, média e deduções por dimensão | Unidade | Sim | Passou |
| P0 | Validators | Evidência sem rastreabilidade é rejeitada | Unidade | Sim | Passou |
| P0 | Requirement engine | Entrada completa, incompleta, ambígua, contraditória e longa | Smoke de serviço | Sim | Passou |
| P0 | Challenger / judge | Problemas e decisão determinística | Unidade / smoke | Sim | Passou |
| P0 | Clarification loop | Estado requerido e concluído | Unidade de serviço | Parcial | Passou; falta persistência real |
| P0 | Persistência | Criar sessão, versionar, responder e reabrir sessão | Integração Prisma | Não | Não coberto |
| P0 | API de alinhamento | POST análise + POST esclarecimentos com banco migrado | E2E | Sim | Passou após aplicar a migração |
| P0 | Observabilidade | Readiness e governance com auditoria indisponível | Integração HTTP | Sim | Passou após correção |
| P1 | Model router | Seleção por capability, fallback e registro inválido | Unidade Python | Sim | Passou (6 testes) |
| P1 | Agentes | Saída estruturada, retry, schema e metadados do provider | Unidade com doubles | Não | Não coberto |
| P1 | Orquestração AI | Fallback LLM, rejeição de saída inválida e retries do judge | Integração com fake runner | Parcial | Judge cobre parte; faltam falhas em cada estágio |
| P1 | Visual requirement | Elementos e requisitos ausentes | Smoke de serviço | Sim | Passou |
| P2 | HomePage | Entrada, contexto, scores, prioridades, perguntas e histórico | Componente / interação | Não | Não coberto |
| P2 | Frontend | Contrato textual de páginas | Smoke textual | Sim | Passou; permanece frágil por depender de copy |
| P2 | API client | Erros, sessão expirada e submit de esclarecimentos | Unidade | Não | Não coberto |
| P3 | Edge cases | Unicode, payload vazio, limites, sessão inexistente e respostas duplicadas | Unidade / integração | Parcial | Apenas limite longo e entrada curta cobertos |

## Achados

### P0

1. Corrigido: falha de leitura de `runtime/audit-log.ndjson` derrubava endpoints de observabilidade com HTTP 500. A leitura agora retorna histórico vazio, pois auditoria é telemetria auxiliar.
2. Corrigido: `getGovernanceOverview` referenciava `repairGovernance` fora de escopo, gerando HTTP 500. O resumo agora é derivado dos eventos de reparo da própria consulta.
3. Resolvido: a migração `202608191900_alignment_clarification_loop` foi aplicada ao banco local e o E2E da plataforma passou.
4. Persistência do loop de esclarecimentos não possui teste com Prisma real: faltam criar sessão, gravar versões, validar IDs de perguntas, isolar usuários e recuperar histórico.

### P1

1. Os testes Python de agentes não são testes unitários isolados: executam lógica no import, chamam `sys.exit`, carregam `.env` e dependem de Ollama/Gemini. Isso torna `unittest discover` impróprio e frágil.
2. Só o model router tem testes unitários convencionais. Não há cobertura isolada para `alignment_semantic`, requirement engine/challenger/judge Python, nem para respostas inválidas dos provedores.
3. Faltam doubles determinísticos para LLM e contrato de metadados de fallback (`provider`, `retry`, `fallback`, erro normalizado).

### P2

1. O contrato visual é uma busca de strings, não renderiza React nem verifica interações. Os textos foram sincronizados; ainda não detecta regressões de estado, acessibilidade ou requisições.
2. A HomePage nova não possui teste de componente para análise, loading, erro, perguntas inline, versão ativa ou comparação.
3. Não há testes do cliente Axios para 401/refresh nem para a nova chamada de esclarecimentos.

### P3

1. Faltam casos para respostas parcialmente preenchidas, pergunta inválida ou repetida, sessão inexistente, duas submissões concorrentes e banco indisponível.
2. Faltam casos com severidade `critical` e `informational`, pois o motor atual produz majoritariamente `high`, `medium` e `low`.
3. Faltam testes de caracteres acentuados, payloads malformados e upload visual inválido/limite de arquivo no endpoint real.

## Testes executados

- Passaram: alignment contract, scoring, clarification state, visual requirement, requirement engine, challenger, judge, security baseline/smoke, governance smoke, recovery de agent/project-manager/architect/requirements/QA, runtime observability, pipeline coherence, status de projeto, model router, E2E da plataforma e build/smoke do frontend.
- Ainda não executáveis como suíte isolada: descoberta Python dos agentes, por dependências externas e execução no import.
- Corrigidos durante a auditoria: expectativas de recovery atualizadas de `failed` para o status de domínio `stale`; contrato textual da HomePage atualizado para a arquitetura nova.
