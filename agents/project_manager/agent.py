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
Project Manager Agent
Responsavel por transformar o briefing do projeto em backlog inicial coerente
"""

from agents.developer.response_validation import generate_complete_text, validate_backlog_output


class ProjectManager:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea):
        prompt = f"""
Voce e um Project Manager Senior especializado em discovery e definicao de backlog.

Sua tarefa e gerar o backlog inicial do projeto abaixo.

PROJETO
ID: {self.project_id}

BRIEFING
{idea}

REGRAS CRITICAS
- Pense como produto, nao como desenvolvedor isolado
- Gere backlog coerente com o briefing recebido
- Priorize o que realmente faz sentido para uma primeira versao robusta
- Nao invente modulos desconectados do problema descrito
- As historias devem estar prontas para refinamento posterior
- Trabalhe com sintese; o briefing recebido ja esta resumido
- Evite justificativas longas e descricoes repetidas

RESPONDA EM MARKDOWN USANDO EXATAMENTE ESTA ESTRUTURA

# BACKLOG DO PROJETO

## Visao Geral

## Epicos
- EP-01 ...

## Historias de Usuario
- Como ...

## Tarefas Tecnicas Iniciais
- ...

REGRAS FINAIS
- Gere pelo menos 9 epicos coerentes
- Gere pelo menos 15 historias de usuario claras
- Use historias no formato "Como ..., eu quero ..., para ..."
- Encerre OBRIGATORIAMENTE a resposta com a linha exata: FIM_DO_BACKLOG
"""

        return generate_complete_text(
            prompt,
            agent_label="project_manager",
            validator=validate_backlog_output,
            options_override={
                "temperature": 0.1,
                "num_predict": int(os.getenv("PROJECT_MANAGER_LLM_NUM_PREDICT", "1600")),
            },
            max_retries=int(os.getenv("PROJECT_MANAGER_MAX_RETRIES", "3")),
        )
