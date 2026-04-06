# Roadmap Execution Status

## Objective

Registrar o que do roadmap ja saiu do papel e o que ainda esta em andamento.

Referencias:

- [ROADMAP_TO_10_PRODUCT_MATURITY.md](/c:/Users/bleao/ai-software-factory/docs/ROADMAP_TO_10_PRODUCT_MATURITY.md)
- [PRODUCT_PROFESSIONALISM_SCORECARD.md](/c:/Users/bleao/ai-software-factory/docs/PRODUCT_PROFESSIONALISM_SCORECARD.md)
- [security_best_practices_report.md](/c:/Users/bleao/ai-software-factory/security_best_practices_report.md)

---

## Completed

- [x] segredo de autenticacao obrigatorio no backend
- [x] remocao de fallback previsivel de JWT
- [x] protecao CSRF para refresh/logout
- [x] criptografia de credenciais de IA em repouso
- [x] resposta mascarada de credenciais para o frontend
- [x] migracao automatica de segredos legados em texto puro
- [x] smoke test de seguranca local
- [x] smoke test de auth e governanca local
- [x] smoke test autenticado de ponta a ponta com registro, sessao, governanca e logout
- [x] baseline segura aplicada aos geradores principais
- [x] scorecard de profissionalismo documentado
- [x] roadmap para chegar a 10 documentado
- [x] checklist de producao criado
- [x] `.env.example` raiz criado com baseline mais segura
- [x] validacao automatizada da baseline de seguranca dos templates criada
- [x] workflow de CI criado para baseline, smoke, build e validacao Python
- [x] outputs atuais em `generated-projects` revisados e alinhados com a baseline segura
- [x] classificacao automatizada dos outputs gerados criada
- [x] runbook de incidente criado
- [x] runbook de release e rollback criado
- [x] permissoes locais endurecidas para `.env` e `backend/runtime`

## In Progress

- [ ] ativacao e estabilizacao do CI no repositorio
- [ ] policy de release e rollback no processo cotidiano
- [ ] expansao da cobertura de testes dos fluxos criticos alem dos smokes atuais e2e

## Current Checkpoint

Data: `2026-04-02`

- workflow de qualidade em `.github/workflows/quality.yml` atualizado para incluir:
  - baseline de seguranca
  - smoke de seguranca
  - smoke de auth e governanca
  - smoke autenticado de ponta a ponta
  - build do frontend
  - validacao Python
- todos os gates principais foram validados localmente com sucesso
- os scripts de smoke do backend foram ajustados para usar portas dedicadas e evitar interferencia entre execucoes
- readiness continua com pendencias esperadas de ambiente/producao, nao de regressao funcional do core
- o frontend principal do Aligna ja recebeu code-splitting por rota e chunking basico
- os geradores de frontend passaram a emitir lazy loading e chunking basico para novos projetos
- os outputs legados em `generated-projects` foram atualizados e validados com build de frontend
- o gerador de UI do Aligna em `orchestrator/generate_implementation_ui.py` foi reestruturado em formato de prompt mais proximo de cookbook, com contexto, workflow, regras de design e contrato de saida explicitos

## Next

- [ ] executar e acompanhar o workflow de CI no repositorio remoto
- [ ] revisar readiness para reduzir alertas criticos conhecidos
- [ ] validar manualmente os fluxos principais de autenticacao e governanca de IA
- [ ] atacar performance do bundle principal do frontend com code-splitting
