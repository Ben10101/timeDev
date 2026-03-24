# -*- coding: utf-8 -*-
import os
import re
import sys
import unicodedata

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

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response
from agents.developer.response_validation import validate_qa_output


class QAEngineer:
    QA_SECTIONS = [
        "Estrategia de testes",
        "Dados de teste",
        "Riscos e metricas",
        "Qualidade nao funcional",
        "Cenarios de teste",
        "Casos de teste funcionais",
        "Usabilidade e acessibilidade",
    ]

    def __init__(self, project_id):
        self.project_id = project_id

    def _normalize_text(self, value):
        text = (value or "").strip()
        normalized = unicodedata.normalize("NFD", text.lower())
        normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return text, normalized

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
            "Fluxos de Excecao",
            "Regras de Negocio",
            "Criterios de Aceite",
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
        if len(summary) > 1200:
            summary = summary[:1200].rsplit(" ", 1)[0] + "..."

        return summary

    def _is_unusable_llm_response(self, result):
        if not result or is_error_text_response(result):
            return True

        normalized = result.strip().lower()
        return normalized.startswith("# documentacao gerada") or normalized.startswith("# documentacao gerada por ia")

    def _extract_section(self, content, title):
        text, normalized_content = self._normalize_text(content)
        _, normalized_title = self._normalize_text(title)
        pattern = re.compile(
            rf"^##\s+{re.escape(normalized_title)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
            re.IGNORECASE | re.MULTILINE,
        )
        match = pattern.search(normalized_content)
        if not match:
            return ""

        # Reaproveita o slice no texto original usando o mesmo trecho normalizado como guia.
        matched_body_normalized = match.group(1).strip()
        if not matched_body_normalized:
            return ""

        original_sections = re.split(r"(?=^##\s+)", text, flags=re.MULTILINE)
        for section in original_sections:
            _, normalized_section = self._normalize_text(section)
            if normalized_section.startswith(f"## {normalized_title}"):
                original_body = re.sub(r"^##\s+.+?$", "", section, count=1, flags=re.MULTILINE).strip()
                return original_body

        return matched_body_normalized

    def _build_full_plan(self, sections):
        ordered_sections = []
        for title in self.QA_SECTIONS:
            body = (sections.get(title) or "").strip()
            if body:
                ordered_sections.append(f"## {title}\n{body}")

        assembled = "\n\n".join(ordered_sections).strip()
        if not assembled:
            return "FIM_DO_PLANO_DE_TESTES"
        return f"{assembled}\n\nFIM_DO_PLANO_DE_TESTES"

    def _generate_block(self, prompt, qa_model, *, num_predict):
        result = generate_text_from_llm(
            prompt,
            model=qa_model,
            options_override={
                "temperature": 0.1,
                "num_predict": int(num_predict),
            },
            use_cache=False,
        )

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Resposta vazia ou invalida.")

        return result

    def _generate_multi_block_plan(self, idea, requirement_summary, qa_model):
        base_context = f"""
Historia:
"{idea}"

Resumo estrutural dos requisitos:
{requirement_summary}

Regras gerais:
- Responda em portugues.
- Nao invente escopo fora da historia.
- Seja especifico e economico em tokens.
- Prefira bullets curtos e objetivos.
- Nao inclua introducao nem conclusao.
"""

        retry_count = max(1, int(os.getenv("QA_MAX_RETRIES", "1")))
        last_reason = "sem detalhes"

        for _attempt in range(1, retry_count + 1):
            sections = {}
            try:
                planning_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Estrategia de testes
Inclua testes unitarios, integracao, API, UI e E2E em no maximo 5 bullets.

## Dados de teste
Inclua dados validos, invalidos, limites e cenarios de falha em no maximo 5 bullets.

## Riscos e metricas
Liste cobertura esperada, riscos criticos e severidade em no maximo 5 bullets.
"""
                planning_result = self._generate_block(
                    planning_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_PLANNING_NUM_PREDICT", "420"),
                )
                for title in ["Estrategia de testes", "Dados de teste", "Riscos e metricas"]:
                    body = self._extract_section(planning_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco de planejamento sem secao {title}.")
                    sections[title] = body

                functional_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Cenarios de teste
Gere exatamente 10 itens numerados:
- 5 cenarios de caminho feliz numerados de 1. a 5.
- 5 cenarios de excecao numerados de 1. a 5.
- Inclua explicitamente a expressao "Caminho Feliz" nos 5 primeiros itens.
- Inclua explicitamente a expressao "Excecao" nos 5 ultimos itens.

## Casos de teste funcionais
Gere pelo menos 3 casos numerados.
Para cada caso, use explicitamente as linhas:
- Acao:
- Resultado esperado:
"""
                functional_result = self._generate_block(
                    functional_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_FUNCTIONAL_NUM_PREDICT", "620"),
                )
                for title in ["Cenarios de teste", "Casos de teste funcionais"]:
                    body = self._extract_section(functional_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco funcional sem secao {title}.")
                    sections[title] = body

                quality_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Qualidade nao funcional
Liste exatamente 4 bullets, um para cada topico abaixo, usando explicitamente estas palavras no inicio de cada bullet:
- Performance:
- Seguranca:
- Confiabilidade:
- Observabilidade:

## Usabilidade e acessibilidade
Liste checks objetivos cobrindo heuristicas de Nielsen, leis de UX e WCAG em no maximo 4 bullets.
"""
                quality_result = self._generate_block(
                    quality_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_QUALITY_NUM_PREDICT", "320"),
                )
                for title in ["Qualidade nao funcional", "Usabilidade e acessibilidade"]:
                    body = self._extract_section(quality_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco de qualidade sem secao {title}.")
                    sections[title] = body

                full_plan = self._build_full_plan(sections)
                is_complete, reason = validate_qa_output(full_plan)
                if is_complete:
                    return full_plan

                last_reason = reason or "Plano de testes considerado incompleto."
            except Exception as error:
                last_reason = str(error) or "Falha ao montar o plano de testes."

        raise RuntimeError(
            f"O agente qa_engineer nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def process(self, idea, code_structure):
        requirement_summary = self._summarize_requirements(code_structure)
        qa_model = os.getenv("QA_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv("QA_OLLAMA_TIMEOUT_SECONDS", previous_timeout or "45")

        try:
            result = self._generate_multi_block_plan(idea, requirement_summary, qa_model)
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar um plano de testes valido para esta tarefa.")

        return result
