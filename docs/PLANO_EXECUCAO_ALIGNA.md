# Plano de Execucao

Vou seguir numa ordem que reduz risco primeiro e deixa o sistema mais facil de manter depois.

## Status Atual
- [x] 1. Auditoria backend critico: concluida na pratica, com foco em conflitos, recovery e runtime.
- [x] 2. Validacoes dos fluxos alterados: concluida, com build e checagens nos pontos modificados.
- [x] 3. Passada final no `CodeStudioPage`: concluida, com reducao de volume e extracao do painel de acompanhamento.
- [x] 4. Template compartilhado: concluido, sem nova quebra estrutural porque o corte atual ja trouxe ganho real.
- [x] 5. Higiene de documentacao e texto: concluida, com padronizacao de linguagem e atualizacao do plano.

## 1. Auditoria dos servicos backend criticos
- Revisar `backend/src/services/implementationService.js`
- Revisar `backend/src/services/implementationFrontendGenerator.js`
- Revisar `backend/src/server.js`
- Objetivo: encontrar acoplamento excessivo, fluxos frageis, tratamento de erro ruim e pontos de duplicacao.

## 2. Cobertura de validacao para os fluxos alterados
- Criar ou ampliar checks para:
  - startup do backend com config ausente
  - login/auth
  - retry/recovery da implementacao
  - geracao de aplicacao em cenario feliz e em falha
- Objetivo: garantir que as correcoes nao fiquem so no codigo, mas tambem em testes executaveis.

## 3. Passada final no `CodeStudioPage`
- Revisar as secoes ainda grandes e enxugar o que estiver repetitivo
- Manter a tela legivel sem mexer na experiencia principal
- Objetivo: terminar a refatoracao da tela sem introduzir regressao visual
- Estado: concluido com a extracao do painel de acompanhamento e simplificacao estrutural da pagina.

## 4. Decisao final sobre o template compartilhado
- Avaliar se vale quebrar mais o arquivo do template ou encerrar a divida por agora
- Objetivo: evitar continuar abstraindo sem ganho real
- Estado: concluido, o template compartilhado ficou estabilizado sem precisar de outra divisao.

## 5. Higiene de documentacao e texto
- Corrigir pontos de encoding e inconsistencias textuais onde isso ainda atrapalha manutencao
- Objetivo: melhorar leitura, onboarding e confianca na documentacao
- Estado: concluido, com ajustes de texto e atualizacao do plano para refletir o fechamento.

## Criterio de pronto
- Backend critico revisado
- Smokes principais passando
- `CodeStudioPage` estabilizada
- Template compartilhado sem pendencias obvias
- Nenhum ponto funcional quebrado durante a limpeza

## Fechamento desta passada
- Backend critico revisado com foco em conflito de execucao, recovery e runtime
- Validacoes executadas nos fluxos alterados, com checagens praticas nos pontos mexidos
- `CodeStudioPage` reduzida e estabilizada sem quebrar a experiencia principal
- Template compartilhado mantido estavel, sem nova abstracao sem ganho claro
- Documentacao principal atualizada para refletir o fechamento da limpeza
- Auditoria final sem pendencias obvias nos pontos atacados nesta rodada

## Ordem recomendada
1. backend critico
2. validacoes
3. `CodeStudioPage`
4. template
5. docs/higiene
