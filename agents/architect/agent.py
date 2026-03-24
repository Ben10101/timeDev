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
Architect Agent
Responsavel por consolidar a arquitetura tecnica do projeto a partir das historias refinadas
"""

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response
from agents.developer.response_validation import validate_architecture_output


class Architect:
    REQUIRED_SECTIONS = [
        "Visao Geral",
        "Stack Tecnologico",
        "Modulos e Responsabilidades",
        "Diagrama de Arquitetura",
        "Estrutura de Diretorios Sugerida",
        "Modelo de Dados e Entidades Principais",
        "Contratos e Integracoes",
        "Padroes de Design",
        "Observabilidade e Operacao",
        "Estrategia de Deploy",
        "Seguranca",
        "Riscos Tecnicos e Trade-offs",
        "Sequencia Recomendada de Implementacao",
    ]

    def __init__(self, project_id):
        self.project_id = project_id

    def _normalize_text(self, value):
        text = (value or "").strip()
        normalized = unicodedata.normalize("NFD", text.lower())
        normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return text, normalized

    def _is_unusable_llm_response(self, result):
        if not result or is_error_text_response(result):
            return True

        normalized = result.strip().lower()
        return normalized.startswith("# documentacao gerada") or normalized.startswith("# documentacao gerada por ia")

    def _extract_first_matching_line(self, block, marker):
        lines = [line.strip() for line in (block or "").splitlines()]
        for index, line in enumerate(lines):
            if line.lower().startswith(marker):
                for candidate in lines[index + 1:]:
                    if candidate and not candidate.endswith(":"):
                        return candidate
        return None

    def _collect_bullets_after_marker(self, block, marker, max_items=2):
        lines = [line.rstrip() for line in (block or "").splitlines()]
        collecting = False
        bullets = []

        for raw_line in lines:
            line = raw_line.strip()
            normalized = line.lower()

            if normalized.startswith(marker):
                collecting = True
                continue

            if collecting and line.endswith(":") and not normalized.startswith(("-", "*")):
                break

            if collecting and re.match(r"^(\d+\.|[-*])\s+", line):
                bullets.append(line)
                if len(bullets) >= max_items:
                    break

        return bullets

    def _compact_requirements(self, requirements):
        text = (requirements or "").strip()
        if len(text) <= 9000:
            return text

        stories = [chunk.strip() for chunk in re.split(r"\n-{3,}\n", text) if chunk.strip()]
        compacted_blocks = []

        for story in stories:
            title = next(
                (line.strip() for line in story.splitlines() if line.strip().startswith("## Historia")),
                None,
            )
            refined_story = self._extract_first_matching_line(story, "user story refinada:")
            requirements_bullets = self._collect_bullets_after_marker(story, "requisitos funcionais:", max_items=2)
            rules_bullets = self._collect_bullets_after_marker(story, "regras de negocio:", max_items=2)

            lines = [line for line in [title, refined_story] if line]
            if requirements_bullets:
                lines.append("Requisitos chave:")
                lines.extend(requirements_bullets)
            if rules_bullets:
                lines.append("Regras chave:")
                lines.extend(rules_bullets)

            compacted_blocks.append("\n".join(lines))

        compacted_text = "\n\n---\n\n".join(compacted_blocks)
        if compacted_text:
            return compacted_text[:9000]

        return text[:9000]

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

        original_sections = re.split(r"(?=^##\s+)", text, flags=re.MULTILINE)
        for section in original_sections:
            _, normalized_section = self._normalize_text(section)
            if normalized_section.startswith(f"## {normalized_title}"):
                original_body = re.sub(r"^##\s+.+?$", "", section, count=1, flags=re.MULTILINE).strip()
                return original_body

        return match.group(1).strip()

    def _generate_block(self, prompt, architecture_model, *, num_predict):
        result = generate_text_from_llm(
            prompt,
            model=architecture_model,
            options_override={
                "temperature": 0.1,
                "num_predict": int(num_predict),
            },
            use_cache=False,
        )

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Resposta vazia ou invalida.")

        return result

    def _build_full_architecture(self, sections):
        ordered_sections = []
        for title in self.REQUIRED_SECTIONS:
            body = (sections.get(title) or "").strip()
            if body:
                ordered_sections.append(f"## {title}\n{body}")

        assembled = "\n\n".join(ordered_sections).strip()
        if not assembled:
            return "# ARQUITETURA DO PROJETO\n\nFIM_DA_ARQUITETURA"

        return f"# ARQUITETURA DO PROJETO\n\n{assembled}\n\nFIM_DA_ARQUITETURA"

    def _generate_multi_block_architecture(self, idea, compact_requirements, architecture_model):
        base_context = f"""
Voce e um Arquiteto de Software Principal.

PROJETO
ID: {self.project_id}

BRIEFING
{idea}

RESUMO DAS HISTORIAS
{compact_requirements}

REGRAS GERAIS
- Responda em portugues.
- Nao invente escopo fora das historias.
- Seja tecnico, objetivo e economico em tokens.
- Nao inclua introducao nem conclusao fora das secoes pedidas.
- Prefira bullets curtos, contratos claros e decisoes implementaveis.
"""

        retry_count = max(1, int(os.getenv("ARCHITECT_MAX_RETRIES", "1")))
        last_reason = "sem detalhes"

        for _attempt in range(1, retry_count + 1):
            sections = {}
            try:
                foundation_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Visao Geral

## Stack Tecnologico

## Modulos e Responsabilidades

## Diagrama de Arquitetura
Use Mermaid ou ASCII curto.
"""
                foundation_result = self._generate_block(
                    foundation_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_FOUNDATION_NUM_PREDICT", "700"),
                )
                for title in [
                    "Visao Geral",
                    "Stack Tecnologico",
                    "Modulos e Responsabilidades",
                    "Diagrama de Arquitetura",
                ]:
                    body = self._extract_section(foundation_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco base sem secao {title}.")
                    sections[title] = body

                design_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Estrutura de Diretorios Sugerida

## Modelo de Dados e Entidades Principais

## Contratos e Integracoes

## Padroes de Design
"""
                design_result = self._generate_block(
                    design_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_DESIGN_NUM_PREDICT", "760"),
                )
                for title in [
                    "Estrutura de Diretorios Sugerida",
                    "Modelo de Dados e Entidades Principais",
                    "Contratos e Integracoes",
                    "Padroes de Design",
                ]:
                    body = self._extract_section(design_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco de design sem secao {title}.")
                    sections[title] = body

                operations_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Observabilidade e Operacao
Cubra logs, metricas, alertas, suporte operacional e recovery.

## Estrategia de Deploy

## Seguranca

## Riscos Tecnicos e Trade-offs

## Sequencia Recomendada de Implementacao
"""
                operations_result = self._generate_block(
                    operations_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_OPERATIONS_NUM_PREDICT", "760"),
                )
                for title in [
                    "Observabilidade e Operacao",
                    "Estrategia de Deploy",
                    "Seguranca",
                    "Riscos Tecnicos e Trade-offs",
                    "Sequencia Recomendada de Implementacao",
                ]:
                    body = self._extract_section(operations_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco operacional sem secao {title}.")
                    sections[title] = body

                full_architecture = self._build_full_architecture(sections)
                is_complete, reason = validate_architecture_output(full_architecture)
                if is_complete:
                    return full_architecture

                last_reason = reason or "Arquitetura considerada incompleta."
            except Exception as error:
                last_reason = str(error) or "Falha ao montar a arquitetura."

        raise RuntimeError(
            f"O agente architect nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def process(self, idea, requirements):
        architecture_model = os.getenv("ARCHITECT_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv(
            "ARCHITECT_OLLAMA_TIMEOUT_SECONDS",
            previous_timeout or "120",
        )

        compact_requirements = self._compact_requirements(requirements)

        try:
            result = self._generate_multi_block_architecture(idea, compact_requirements, architecture_model)
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar uma arquitetura valida para este projeto.")

        return result
