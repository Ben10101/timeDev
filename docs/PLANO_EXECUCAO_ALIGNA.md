# Plano de Execucao

Vou seguir numa ordem que reduz risco primeiro e deixa o sistema mais facil de manter depois.

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

## 4. Decisao final sobre o template compartilhado
- Avaliar se vale quebrar mais o arquivo do template ou encerrar a divida por agora
- Objetivo: evitar continuar abstraindo sem ganho real

## 5. Higiene de documentacao e texto
- Corrigir pontos de encoding e inconsistencias textuais onde isso ainda atrapalha manutencao
- Objetivo: melhorar leitura, onboarding e confianca na documentacao

## Criterio de pronto
- Backend critico revisado
- Smokes principais passando
- `CodeStudioPage` estabilizada
- Template compartilhado sem pendencias obvias
- Nenhum ponto funcional quebrado durante a limpeza

## Ordem recomendada
1. backend critico
2. validacoes
3. `CodeStudioPage`
4. template
5. docs/higiene
