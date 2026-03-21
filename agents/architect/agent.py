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
Architect Agent
Responsavel por consolidar a arquitetura tecnica do projeto a partir das historias refinadas
"""

from agents.developer.llm_service import is_error_text_response
from agents.developer.response_validation import generate_complete_text, validate_architecture_output


class Architect:
    def __init__(self, project_id):
        self.project_id = project_id

    def _is_unusable_llm_response(self, result):
        if not result or is_error_text_response(result):
            return True

        normalized = result.strip().lower()
        return normalized.startswith("# documentacao gerada") or normalized.startswith("# documentacao gerada por ia")

    def process(self, idea, requirements):
        architecture_model = os.getenv("ARCHITECT_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv(
            "ARCHITECT_OLLAMA_TIMEOUT_SECONDS",
            previous_timeout or "120",
        )

        prompt = f"""
Voce e um Arquiteto de Software Principal.

Sua missao e consolidar uma arquitetura tecnica completa para o projeto, usando um briefing compacto e resumos das historias refinadas.

PROJETO
ID: {self.project_id}

BRIEFING
{idea}

HISTORIAS REFINADAS
{requirements}

INSTRUCOES CRITICAS
- Nao invente modulos sem relacao com as historias refinadas
- Mantenha coerencia entre frontend, backend, banco e integracoes
- Pense em estrutura real de projeto full stack
- Seja objetivo, tecnico e implementavel
- Considere reaproveitamento, escalabilidade e seguranca
- Trabalhe com sintese arquitetural, nao reescreva os requisitos recebidos
- Priorize modulos, entidades, contratos, pastas e sequencia de entrega
- Evite listas gigantes e texto redundante
- Considere que as historias refinadas ja estao resumidas; extraia padroes e consolidacoes

RESPONDA EM MARKDOWN USANDO EXATAMENTE ESTA ESTRUTURA

# ARQUITETURA DO PROJETO

## Visao Geral

## Stack Tecnologico

## Modulos e Responsabilidades

## Diagrama de Arquitetura
(Mermaid ou ASCII)

## Estrutura de Diretorios Sugerida

## Modelo de Dados e Entidades Principais

## Contratos e Integracoes

## Padroes de Design

## Estrategia de Deploy e Seguranca

## Sequencia Recomendada de Implementacao

REGRAS FINAIS
- Nao saia do escopo das historias refinadas
- Nao devolva JSON
- Mantenha a resposta enxuta, mas suficiente para orientar implementacao
- Encerre OBRIGATORIAMENTE a resposta com a linha exata: FIM_DA_ARQUITETURA
"""

        try:
            result = generate_complete_text(
                prompt,
                agent_label="architect",
                validator=validate_architecture_output,
                model=architecture_model,
                options_override={
                    "temperature": 0.1,
                    "num_predict": int(os.getenv("ARCHITECT_LLM_NUM_PREDICT", "1700")),
                },
                max_retries=int(os.getenv("ARCHITECT_MAX_RETRIES", "3")),
            )
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar uma arquitetura valida para este projeto.")

        return result
