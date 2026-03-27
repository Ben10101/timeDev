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

    def _collect_required_sections(self, content, titles):
        sections = {}
        missing = []
        for title in titles:
            body = self._extract_section(content, title)
            if body:
                sections[title] = body
            else:
                missing.append(title)
        return sections, missing

    def _extract_missing_sections(self, reason):
        mapping = {self._normalize_text(title)[1]: title for title in self.REQUIRED_SECTIONS}
        match = re.search(r"Secoes ausentes:\s*(.+)$", reason or "", re.IGNORECASE)
        if not match:
            return []

        raw_sections = [item.strip() for item in match.group(1).split(",")]
        normalized_targets = []
        for item in raw_sections:
            _, normalized_item = self._normalize_text(item)
            if normalized_item in mapping:
                normalized_targets.append(mapping[normalized_item])
                continue
            for normalized_title, original_title in mapping.items():
                if normalized_item in normalized_title or normalized_title in normalized_item:
                    normalized_targets.append(original_title)
                    break

        deduped = []
        for title in normalized_targets:
            if title not in deduped:
                deduped.append(title)
        return deduped

    def _repair_missing_sections(self, base_context, block_result, missing_titles, architecture_model):
        if not missing_titles:
            return {}

        repaired_sections = {}
        still_missing = []

        for title in missing_titles:
            repair_prompt = f"""
{base_context}

ARQUITETURA PARCIAL JA GERADA
{block_result}

TAREFA
Complete somente a secao abaixo, em Markdown, usando exatamente o titulo informado.

## {title}

REGRAS
- Nao inclua nenhuma outra secao.
- Nao renomeie o titulo.
- Entregue entre 3 e 6 bullets objetivos ou um bloco curto equivalente.
- Se a secao for "Padroes de Design", cite explicitamente padroes, onde se aplicam e o motivo.
- Se a secao for "Contratos e Integracoes", cite endpoints, eventos ou integracoes relevantes.
- Se a secao for "Estrategia de Deploy", cubra ambientes, pipeline e rollout.
- Se a secao for "Seguranca", cubra autenticacao, autorizacao, dados sensiveis e auditoria.
"""
            repair_result = self._generate_block(
                repair_prompt,
                architecture_model,
                num_predict=os.getenv("ARCHITECT_BLOCK_REPAIR_NUM_PREDICT", "360"),
            )
            section_body = self._extract_section(repair_result, title)
            if section_body:
                repaired_sections[title] = section_body
            else:
                still_missing.append(title)

        if still_missing:
            raise RuntimeError(f"Reparo do bloco nao entregou secoes {', '.join(still_missing)}.")

        return repaired_sections

    def _repair_final_architecture(self, base_context, sections, reason, architecture_model):
        missing_titles = self._extract_missing_sections(reason)
        if not missing_titles:
            return sections

        current_document = self._build_full_architecture(sections)
        repaired_sections = self._repair_missing_sections(
            base_context,
            current_document,
            missing_titles,
            architecture_model,
        )

        merged = dict(sections)
        merged.update(repaired_sections)
        return merged

    def _build_full_architecture(self, sections):
        ordered_sections = []
        for title in self.REQUIRED_SECTIONS:
            body = self._sanitize_section_body(sections.get(title) or "")
            if body:
                ordered_sections.append(f"## {title}\n{body}")

        assembled = "\n\n".join(ordered_sections).strip()
        if not assembled:
            return "# ARQUITETURA DO PROJETO\n\nFIM_DA_ARQUITETURA"

        assembled = self._sanitize_section_body(assembled)
        return f"# ARQUITETURA DO PROJETO\n\n{assembled}\n\nFIM_DA_ARQUITETURA"

    def _fallback_diagram_body(self):
        return """```text
[Frontend Web]
      |
      v
[API / Backend]
      |
      +--> [Modulo de Chamados]
      +--> [Modulo de Atendimento]
      +--> [Modulo de Notificacoes]
      +--> [Modulo de Relatorios]
      |
      +--> [Banco de Dados]
      +--> [Storage de Arquivos]
```"""

    def _sanitize_section_body(self, body):
        text = (body or "").strip()
        if not text:
            return ""

        text = text.replace("---.", "---")
        text = text.replace("```mermaid\n", "```mermaid\n")
        text = re.sub(r"^\s*---\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"\n\s*---\s*\n", "\n\n", text)

        if "```mermaid" in text and text.count("```") < 2:
            text = self._fallback_diagram_body()

        if text.count("```") % 2 != 0:
            text = f"{text.rstrip()}\n```"

        if "```mermaid" in text:
            mermaid_block = re.search(r"```mermaid\s*([\s\S]*?)```", text, re.IGNORECASE)
            if mermaid_block:
                mermaid_body = mermaid_block.group(1).strip()
                if len(mermaid_body.splitlines()) < 4 or mermaid_body.endswith(("->", "-->", "[")):
                    text = self._fallback_diagram_body()

        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"^\s*\.\s*$", "", text, flags=re.MULTILINE)

        last_line = text.splitlines()[-1].rstrip()
        if re.search(r"[:|*_\-/(\[{,;]$", last_line):
            text = f"{text.rstrip()}.\n"

        return text.strip()

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
                foundation_titles = [
                    "Visao Geral",
                    "Stack Tecnologico",
                    "Modulos e Responsabilidades",
                    "Diagrama de Arquitetura",
                ]
                foundation_sections, missing_foundation = self._collect_required_sections(foundation_result, foundation_titles)
                if missing_foundation:
                    foundation_sections.update(
                        self._repair_missing_sections(base_context, foundation_result, missing_foundation, architecture_model)
                    )
                sections.update(foundation_sections)

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
                design_titles = [
                    "Estrutura de Diretorios Sugerida",
                    "Modelo de Dados e Entidades Principais",
                    "Contratos e Integracoes",
                    "Padroes de Design",
                ]
                design_sections, missing_design = self._collect_required_sections(design_result, design_titles)
                if missing_design:
                    design_sections.update(
                        self._repair_missing_sections(base_context, design_result, missing_design, architecture_model)
                    )
                sections.update(design_sections)

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
                operations_titles = [
                    "Observabilidade e Operacao",
                    "Estrategia de Deploy",
                    "Seguranca",
                    "Riscos Tecnicos e Trade-offs",
                    "Sequencia Recomendada de Implementacao",
                ]
                operations_sections, missing_operations = self._collect_required_sections(operations_result, operations_titles)
                if missing_operations:
                    operations_sections.update(
                        self._repair_missing_sections(base_context, operations_result, missing_operations, architecture_model)
                    )
                sections.update(operations_sections)

                full_architecture = self._build_full_architecture(sections)
                is_complete, reason = validate_architecture_output(full_architecture)
                if is_complete:
                    return full_architecture

                repaired_sections = self._repair_final_architecture(
                    base_context,
                    sections,
                    reason or "",
                    architecture_model,
                )
                repaired_architecture = self._build_full_architecture(repaired_sections)
                repaired_ok, repaired_reason = validate_architecture_output(repaired_architecture)
                if repaired_ok:
                    return repaired_architecture

                last_reason = repaired_reason or reason or "Arquitetura considerada incompleta."
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
