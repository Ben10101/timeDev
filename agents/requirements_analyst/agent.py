# -*- coding: utf-8 -*-
import os
import sys

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
Requirements Analyst Agent
Refinamento detalhado de User Story em nivel pronto para desenvolvimento
"""

from agents.developer.response_validation import generate_complete_text, validate_requirements_output


class RequirementsAnalyst:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, backlog):
        prompt = f"""
Voce e um Analista de Requisitos Senior especializado em transformar User Stories em requisitos funcionais claros, completos e sem ambiguidades.

Sua unica missao e refinar requisitos para implementacao.

REGRAS CRITICAS:
- Voce esta refinando apenas UMA unica User Story
- NAO expanda escopo
- NAO crie novas funcionalidades fora da historia
- NAO invente modulos, dashboards, relatorios ou integracoes
- Seja direto, tecnico e implementavel
- Elimine qualquer ambiguidade

---

ENTRADA

User Story:
"{idea}"

Contexto curto do backlog/projeto (apenas referencia, NAO expandir escopo):
{backlog}

---

TAREFA

Refinar a User Story em requisitos completos seguindo EXATAMENTE a estrutura abaixo:

---

# REFINAMENTO DE REQUISITO

## User Story Refinada
(Reescreva a historia de forma clara, especifica e objetiva)

---

## Requisitos Funcionais

### RF-01
- Descricao:
- Atores:
- Entradas:
- Processamento:
- Saidas:

(Adicionar quantos RFs forem necessarios, sem extrapolar escopo)

---

## Fluxo Principal
(Passo a passo numerado do fluxo principal)

---

## Fluxos Alternativos
(Variacoes validas do fluxo principal)

---

## Fluxos de Excecao
(Erros e comportamentos do sistema)

---

## Regras de Negocio
(Lista numerada, clara e sem ambiguidade)

---

## Criterios de Aceite (BDD)

DADO que ...
QUANDO ...
ENTAO ...

(Incluir cenarios positivos, negativos e edge cases)

---

DIRETRIZES FINAIS:
- Seja extremamente claro e tecnico
- Nada pode ficar implicito
- Escreva como se um desenvolvedor fosse implementar diretamente
- Se faltar informacao, assuma o cenario mais comum e sinalize
- Encerre OBRIGATORIAMENTE a resposta com a linha exata: FIM_DO_REFINAMENTO
"""

        return generate_complete_text(
            prompt,
            agent_label="requirements_analyst",
            validator=validate_requirements_output,
            options_override={
                "temperature": 0.1,
                "num_predict": int(os.getenv("REQUIREMENTS_LLM_NUM_PREDICT", "1800")),
            },
            max_retries=int(os.getenv("REQUIREMENTS_MAX_RETRIES", "3")),
        )
