# Arquitetura de Análise do Aligna

O endpoint `POST /api/alignment/analyze` mantém os campos públicos existentes e adiciona o objeto `analysis` na versão `2.0`.

## Estágios

1. `deterministic`: extrai ator, ação, objetivo, regras explícitas e lacunas usando regras locais.
2. `semantic`: opcional, usa o runtime de providers já configurado e produz somente achados candidatos.
3. `validation`: rejeita achados sem categoria, severidade, mensagem, recomendação ou evidência rastreável quando exigida.
4. `scoring`: calcula score exclusivamente a partir dos achados determinísticos e do tamanho da entrada.
5. `traceability`: registra a origem e a evidência de cada achado aceito.

O LLM não gera score, regra de negócio, critério de aceite final nem altera os resultados determinísticos. `assumption` continua um achado explícito e nunca é promovido a `business_rule`.

## Configuração

`ALIGNMENT_SEMANTIC_ANALYSIS_ENABLED=true` habilita a etapa semântica. Por padrão ela permanece desativada. Quando habilitada, a análise usa a configuração de IA do usuário autenticado; sem sessão, aplica apenas as variáveis de ambiente já suportadas pelo runtime. Falhas de provider são registradas e retornam a análise determinística com `analysis.semantic.status = "unavailable"`.

## Compatibilidade

Os campos anteriores continuam presentes: `input_summary`, `user_story`, `acceptance_criteria`, `business_rules`, `test_scenarios`, `clarity_score` e `ambiguity_alerts`.
