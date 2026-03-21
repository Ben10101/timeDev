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
Developer Agent
Responsavel por gerar documentacao tecnica inicial de implementacao
"""

from agents.developer.llm_service import generate_text_from_llm


def _compact_text(value, max_length=500):
    text = str(value or "").replace("\r", "").strip()
    text = " ".join(text.split())
    if len(text) <= max_length:
        return text
    return text[:max_length].rsplit(" ", 1)[0] + "..."


class Developer:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, architecture):
        compact_idea = _compact_text(idea, 320)
        compact_architecture = _compact_text(architecture, 900)

        prompt = f"""
Atue como um Desenvolvedor Senior.
Crie uma documentacao tecnica objetiva da estrutura de codigo para o projeto.

Projeto: {self.project_id}
Ideia: "{compact_idea}"
Arquitetura: "{compact_architecture}"

Retorne markdown contendo:
# ESTRUTURA DE CODIGO
## Arvore de Arquivos Detalhada
## Modelos de Dados
## Endpoints da API
## Componentes e Modulos Principais

Regras:
- Seja direto e tecnico
- Evite repetir a arquitetura inteira
- Priorize estrutura, contratos e responsabilidades
"""

        return generate_text_from_llm(
            prompt,
            options_override={
                "temperature": 0.1,
                "num_predict": int(os.getenv("DEVELOPER_LLM_NUM_PREDICT", "1400")),
            },
        )
