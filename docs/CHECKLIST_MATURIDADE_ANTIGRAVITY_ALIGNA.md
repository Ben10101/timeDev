# Checklist de Maturidade Antigravity do Aligna

Este documento resume, de forma executiva, o nivel atual de maturidade da geracao de codigo do Aligna sob a lente de `antigravity`.

## Escala

- `0`: ausente
- `1`: muito fraco
- `2`: parcial
- `3`: bom
- `4`: forte
- `5`: maduro

## Leitura consolidada

- Score sugerido atual: `2.8 / 5`
- Classificacao: `sistema agentic hibrido, proximo de antigravity`

## Resumo Executivo

O Aligna ja superou a fase de software factory baseada apenas em prompt e scaffold. Hoje ele opera com spec, agentes especializados, validacao, repair e recomposicao do app gerado.

O principal gap para um comportamento realmente `antigravity` ainda esta no frontend: a esteira melhorou a coerencia semantica, mas ainda nao quebra de forma consistente a gravidade do template visual e composicional.

## Avaliacao por criterio

| Criterio | Nota | O que significa | Evidencia observada | Acao recomendada |
| --- | --- | --- | --- | --- |
| A spec vence a memoria do workspace | `3/5` | A `Technical Spec` ja governa boa parte da geracao, mas ainda divide espaco com heranca de template | houve limpeza e reconciliacao automatica, mas ainda apareceu `workspace_preserved` na pagina gerada | reduzir preservacao automatica de `pageTsxTemplate` |
| A variacao visual e estrutural e real | `2/5` | O sistema diferencia melhor a semantica do que a forma | muitas telas ainda convergem para `form + list + shell` | endurecer variacao por `screenTemplate`, `pageArchetype`, `componentMap` e `variationProfile` |
| O mapeamento semantico e estavel | `3/5` | O sistema ja evita varios erros antigos, mas ainda nao e totalmente confiavel | task de observacoes deixou de cair em desvio grave, mas houve historico de classificacao incorreta | reforcar filtros de coerencia entre story, spec e featureKey |
| O repair e a reconciliacao sao inteligentes | `4/5` | O sistema ja consegue corrigir, reconciliar e recompor o app com maturidade | repair, cleanup, manifesto e validacao funcionam como esteira real | manter esse eixo forte e expandir a telemetria de reparo |
| A tela nasce da operacao, nao apenas dos campos | `2/5` | A operacao ainda aparece menos do que deveria na composicao visual | semantica correta, mas UI ainda com cara de molde repetido | fazer a UI nascer de fila, trilha, decisao, evidencia e governanca, e nao apenas de formulario |

## Nota Final

### Score sugerido

- `2.8 / 5`

### Interpretacao

- `0 a 1`: geracao fortemente template-driven
- `2`: esteira avancada, mas ainda com forte gravidade de molde
- `3`: sistema agentic hibrido, proximo de antigravity
- `4`: agent-native forte, com pouca gravidade residual
- `5`: antigravity maduro

O Aligna hoje se encontra entre `2` e `3`, mais precisamente na borda de um sistema `agentic hibrido` que ja mostra sinais fortes de evolucao para `antigravity`, mas ainda nao atingiu esse patamar de forma consistente.

## Evidencias principais

- A geracao ja parte de `Technical Spec`, e nao apenas de prompt solto.
- A esteira ja conecta requisito, QA, arquitetura e implementacao.
- O sistema possui review, validacao, repair e reconciliacao.
- O app gerado ja consegue ser recomposto a partir das features integradas.
- O maior desvio residual esta no frontend, especialmente na repeticao estrutural das telas.

## Prioridades para subir a maturidade

1. Fazer a `Technical Spec` mandar mais que a memoria do workspace.
2. Reduzir ou condicionar melhor a preservacao automatica de templates antigos.
3. Aumentar a variacao estrutural real das telas por dominio e intencao.
4. Penalizar mais fortemente geracao semanticamente correta, mas visualmente generica.
5. Melhorar a expressao do tipo de operacao na UI final.

## Pergunta de diagnostico rapido

Se a proxima feature sair:

- semanticamente correta,
- visualmente distinta,
- coerente com a operacao,
- sem reutilizar molde antigo por default,

entao o Aligna sobe de forma concreta na direcao de `antigravity`.
