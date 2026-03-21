# -*- coding: utf-8 -*-
import os
import re
import sys

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
QA Engineer Agent
Responsavel por gerar cenarios de teste
"""

from agents.developer.llm_service import is_error_text_response
from agents.developer.response_validation import generate_complete_text, validate_qa_output


class QAEngineer:
    def __init__(self, project_id):
        self.project_id = project_id

    def _summarize_requirements(self, code_structure):
        text = (code_structure or "").strip()
        if not text:
            return "Sem requisitos detalhados informados."

        cleaned = re.sub(r"\n{3,}", "\n\n", text)
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        headings = [
            "User Story Refinada",
            "Requisitos Funcionais",
            "Fluxo Principal",
            "Fluxos Alternativos",
            "Fluxos de Exceção",
            "Regras de Negócio",
            "Critérios de Aceite",
        ]

        sections = []
        for heading in headings:
            match = re.search(rf"##+\s+.*{re.escape(heading)}(.*?)(?=\n##+\s+|\Z)", cleaned, re.IGNORECASE | re.DOTALL)
            if not match:
                continue

            snippet = match.group(1).strip()
            if len(snippet) > 500:
                snippet = snippet[:500].rsplit(" ", 1)[0] + "..."
            sections.append(f"{heading}:\n{snippet}")

        summary = "\n\n".join(sections) if sections else cleaned
        if len(summary) > 1800:
            summary = summary[:1800].rsplit(" ", 1)[0] + "..."

        return summary

    def _is_unusable_llm_response(self, result):
        if not result or is_error_text_response(result):
            return True

        normalized = result.strip().lower()
        return normalized.startswith("# documentacao gerada") or normalized.startswith("# documentação gerada")

    def process(self, idea, code_structure):
        requirement_summary = self._summarize_requirements(code_structure)
        qa_model = os.getenv("QA_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv("QA_OLLAMA_TIMEOUT_SECONDS", previous_timeout or "45")

        prompt = f"""
Atue como um Engenheiro de QA Senior e gere um plano de testes objetivo em Markdown.

Historia:
"{idea}"

Resumo estrutural dos requisitos:
{requirement_summary}

Responda em portugues com as secoes abaixo, de forma direta e implementavel:

1. Estrategia de testes
Inclua testes unitarios, integracao, API, UI e E2E em no maximo 6 bullets.

2. Dados de teste sugeridos
Inclua dados validos, invalidos, limites e cenarios de falha.

3. Riscos e metricas
Liste cobertura esperada, riscos criticos e severidade.

4. Cenarios de teste
Gere exatamente 5 cenarios de caminho feliz e 5 cenarios de excecao.

5. Casos de teste funcionais
Para cada caso, use:
- Acao
- Resultado esperado

6. Usabilidade e acessibilidade
Considere heuristicas de Nielsen, leis de UX e WCAG.

Regras finais:
- Nao invente escopo fora da historia.
- Seja especifico, mas evite texto excessivamente longo.
- Limite a resposta a aproximadamente 900 palavras.
- Encerre OBRIGATORIAMENTE a resposta com a linha exata: FIM_DO_PLANO_DE_TESTES
"""

        try:
            result = generate_complete_text(
                prompt,
                agent_label="qa_engineer",
                validator=validate_qa_output,
                model=qa_model,
                options_override={
                    "temperature": 0.1,
                    "num_predict": int(os.getenv("QA_OLLAMA_NUM_PREDICT", "1500")),
                },
                max_retries=int(os.getenv("QA_MAX_RETRIES", "3")),
            )
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar um plano de testes valido para esta tarefa.")

        return result
