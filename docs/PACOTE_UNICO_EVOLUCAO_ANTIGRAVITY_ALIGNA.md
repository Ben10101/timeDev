# Pacote Unico de Evolucao Antigravity do Aligna

Este documento consolida, em um unico pacote, tudo o que precisa ser resolvido para elevar a geracao de codigo do Aligna do patamar atual para um nivel claramente superior de maturidade `antigravity`.

## Objetivo do pacote

Elevar a geracao de codigo do Aligna de `2.8 / 5` para uma faixa `3.8+ / 5`, com foco em:

- fazer a `Technical Spec` mandar mais que a memoria do workspace
- quebrar a gravidade de template no frontend
- estabilizar a classificacao semantica
- manter repair e reconciliacao fortes sem voltar ao molde generico
- fazer a UI nascer da operacao, e nao apenas dos campos

## Resultado esperado ao final

Ao final deste pacote, uma feature nova deve:

- nascer semanticamente coerente com a story
- gerar frontend estruturalmente distinto de features anteriores
- usar a spec como autoridade principal
- evitar reaproveitar pagina antiga sem motivo forte
- sair com shell, layout e componentes guiados pela intencao operacional
- passar por review e validacao sem depender de reparo conservador para ficar aceitavel

## Nota alvo por criterio

| Criterio | Nota atual | Meta apos pacote |
| --- | --- | --- |
| A spec vence a memoria do workspace | `3/5` | `4/5` |
| A variacao visual e estrutural e real | `2/5` | `4/5` |
| O mapeamento semantico e estavel | `3/5` | `4/5` |
| O repair e a reconciliacao sao inteligentes | `4/5` | `4.5/5` |
| A tela nasce da operacao, nao apenas dos campos | `2/5` | `4/5` |

## Estrutura do pacote

O pacote esta dividido em 5 frentes que precisam ser tratadas como uma unica entrega coordenada.

## Frente 1. Autoridade real da Technical Spec

### Problema atual

A spec ja tem peso forte, mas ainda divide autoridade com:

- memoria do workspace
- preservacao automatica de template antigo
- sinais residuais de geracoes anteriores

### Objetivo

Fazer a `Technical Spec` ser a fonte primaria e explicita da experiencia gerada.

### Mudancas

1. Reduzir a preservacao automatica de `pageTsxTemplate`.
2. So permitir preservacao quando houver aderencia forte entre:
   - `featureKey`
   - `intent`
   - `screenTemplate`
   - `productMode`
   - `pageArchetype`
3. Introduzir um `spec authority gate`:
   - se a nova spec divergir do template anterior, a spec vence por default
4. Persistir em log o motivo de:
   - preservar template
   - rejeitar template
   - regenerar do zero

### Criterios de aceite

- uma feature nova nao deve nascer com `workspace_preserved` sem justificativa auditavel
- a spec mais recente deve prevalecer sobre o page template anterior
- o runtime deve indicar por que preservou ou descartou o template anterior

## Frente 2. Variacao estrutural real do frontend

### Problema atual

Muitas telas ainda convergem para:

- hero
- formulario
- lista
- shell semelhante

Mesmo quando a semantica muda.

### Objetivo

Fazer a composicao da tela mudar de verdade conforme o tipo de operacao.

### Mudancas

1. Transformar `screenTemplate`, `pageArchetype`, `variationProfile` e `componentMap` em drivers reais de composicao.
2. Criar familias estruturais mais distintas, por exemplo:
   - `queue-first`
   - `review-desk`
   - `evidence-workbench`
   - `decision-flow`
   - `timeline-console`
   - `manager-cockpit`
   - `registry-form`
3. Fazer o `implementationFrontendGenerator` escolher blocos diferentes por combinacao semantica.
4. Penalizar no review telas que sejam semanticamente corretas, mas estruturalmente repetidas demais.

### Criterios de aceite

- duas stories com intencoes diferentes nao podem gerar a mesma composicao basica
- `review`, `approval`, `search`, `history`, `dashboard` e `register` devem produzir layouts perceptivelmente distintos
- a analise automatica deve conseguir sinalizar “layout repetido demais”

## Frente 3. Estabilidade do mapeamento semantico

### Problema atual

O sistema melhorou, mas ainda pode:

- cair em dominio errado
- escolher template seguro demais
- interpretar uma tarefa operacional como configuracao/perfil

### Objetivo

Melhorar a robustez da classificacao entre story, spec e feature gerada.

### Mudancas

1. Endurecer a inferencia de `intent`.
2. Endurecer a inferencia de `featureKey` e `domain`.
3. Expandir filtros de coerencia semantica para:
   - `featureKey`
   - `routeBase`
   - `navigationLabel`
   - `templateKey`
4. Penalizar mais o fallback para `generic/form` e similares quando a story tiver sinais fortes.
5. Criar um conjunto de testes de regressao semantica com stories reais do projeto.

### Criterios de aceite

- stories historicamente problematicas nao podem voltar a cair em dominio errado
- o pipeline deve identificar e bloquear mismatch forte entre story e feature gerada
- o reuso de spec integrada antiga desalinhada deve ser descartado automaticamente

## Frente 4. Repair e reconciliacao com comportamento menos conservador

### Problema atual

O repair ja e forte, mas ainda pode corrigir voltando para o caminho mais previsivel e pouco expressivo.

### Objetivo

Manter a robustez operacional sem sacrificar intencao, composicao e diferenciacao.

### Mudancas

1. Fazer o repair considerar o `variationProfile` e a identidade da feature.
2. Impedir que o repair substitua uma tela rica por uma tela genericamente segura.
3. Adicionar telemetria de “repair conservador”.
4. Expandir a reconciliacao automatica para:
   - manifesto
   - rotas
   - contratos
   - schema
   - residuos de dist
   - residuos de docs
   - metadados persistidos

### Criterios de aceite

- repair nao pode reduzir a diferenciacao estrutural sem registrar justificativa
- o app recomposto deve refletir apenas as features semanticamente validas
- o sistema deve distinguir repair corretivo de repair regressivo

## Frente 5. UX orientada pela operacao

### Problema atual

A tela ainda nasce mais de “campos + CRUD” do que de “operacao + decisao + fluxo”.

### Objetivo

Fazer a experiencia nascer do tipo de trabalho que o usuario esta realizando.

### Mudancas

1. Elevar `primaryAction`, `intent`, `businessRules` e `qaScenarios` como drivers de UX.
2. Fazer componentes de alto nivel refletirem a operacao:
   - fila
   - revisao
   - aprovacao
   - evidencia
   - historico
   - monitoramento
   - consolidado
3. Incluir na spec sinais mais fortes de operacao:
   - `interactionMode`
   - `decisionPattern`
   - `primaryWorkObject`
   - `evidenceNeed`
   - `reviewMode`
4. Fazer o review penalizar “tela de formulario generica” quando a story pedir fluxo operacional mais rico.

### Criterios de aceite

- a natureza da operacao deve ser visivel sem ler todo o texto da tela
- uma story de aprovacao nao pode parecer um cadastro comum
- uma story de historico nao pode parecer apenas um CRUD com lista

## Ordem de execucao recomendada

### Bloco 1. Governanca da spec

1. reduzir preservacao automatica de templates
2. introduzir `spec authority gate`
3. registrar decisoes de preservacao e descarte

### Bloco 2. Semantica

1. endurecer inferencia de `intent`
2. endurecer inferencia de dominio/template
3. criar suite de regressao semantica

### Bloco 3. Frontend composicional

1. ampliar familias estruturais
2. ligar `screenTemplate`, `pageArchetype`, `componentMap` e `variationProfile` a composicoes reais
3. rever blocos genericos do frontend generator

### Bloco 4. Repair e reconciliacao

1. impedir repair regressivo
2. ampliar telemetria
3. endurecer reconciliacao final

### Bloco 5. Gate final de qualidade

1. penalizar repeticao visual
2. penalizar semantica correta com UX generica
3. revisar score final para refletir diferenciacao estrutural

## Entregaveis do pacote

### Backend e pipeline

- ajuste da autoridade da spec no `implementationService`
- filtros semanticos mais fortes
- logs de decisao de preservacao/regeneracao
- telemetria de repair conservador
- reconciliacao expandida

### Frontend generator

- novas familias estruturais
- composicao real por `pageArchetype`
- variacao visual e interacional mais forte
- menor dependencia de layout repetido

### Validacao

- suite de regressao semantica
- suite de repeticao estrutural
- score mais honesto para “antigravity readiness”

### Documentacao

- criterios objetivos do que conta como tela generica
- matriz de intencao x tipo de tela
- exemplos de antes/depois

## Como saber se o pacote foi bem sucedido

O pacote sera considerado bem sucedido se, ao final, uma rodada de geracao em stories diferentes mostrar:

1. `featureKey` coerente com a task
2. manifesto limpo, sem residuos antigos
3. frontend com composicao distinta por tipo de operacao
4. sem preservacao indevida de template antigo
5. review final aprovando nao so build/test, mas tambem diferenciacao estrutural

## Teste de prova final

Selecionar pelo menos 5 stories com intencoes diferentes:

1. cadastrar
2. editar
3. aprovar
4. consultar/historico
5. dashboard/resumo

E validar que:

- nenhuma delas cai no mesmo molde estrutural
- todas permanecem semanticamente corretas
- o repair nao regride a diferenciacao
- a nota consolidada sobe para a faixa alvo

## Fechamento

Este pacote nao e apenas uma limpeza tecnica. Ele e a etapa necessaria para o Aligna sair de uma geracao `agentic hibrida com gravidade de template` e entrar em uma geracao realmente mais proxima de `antigravity`.
