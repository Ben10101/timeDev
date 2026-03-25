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
Project Manager Agent
Responsavel por transformar o briefing do projeto em backlog inicial coerente
"""

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response
from agents.developer.response_validation import validate_backlog_output


class ProjectManager:
    STORY_RANGE = (15, 25)
    PERSONA_NORMALIZATION = {
        "colaborador do setor administrativo": "colaborador",
        "colaborador da operacao": "colaborador",
        "colaborador da operação": "colaborador",
        "analista de suporte": "atendente",
        "gestor de ti": "gestor",
        "gestor de suporte": "gestor",
        "administrador do sistema": "administrador",
        "operador": "atendente",
    }

    def __init__(self, project_id):
        self.project_id = project_id

    def _normalize_text(self, value):
        text = (value or "").strip()
        normalized = unicodedata.normalize("NFD", text.lower())
        normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return text, normalized

    def _compact_briefing(self, idea):
        text = re.sub(r"\n{3,}", "\n\n", (idea or "").strip())
        text = re.sub(r"[ \t]+", " ", text)
        if len(text) <= 1800:
            return text
        return text[:1800].rsplit(" ", 1)[0] + "..."

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

        original_sections = re.split(r"(?=^##\s+)", text, flags=re.MULTILINE)
        for section in original_sections:
            _, normalized_section = self._normalize_text(section)
            if normalized_section.startswith(f"## {normalized_title}"):
                original_body = re.sub(r"^##\s+.+?$", "", section, count=1, flags=re.MULTILINE).strip()
                return original_body

        return match.group(1).strip()

    def _extract_story_count(self, content):
        return len(
            [
                line.strip()
                for line in (content or "").splitlines()
                if re.search(r"^(?:[-*]\s*)?(?:US-\d+\s*\|\s*)?Como\b", line.strip(), re.IGNORECASE)
            ]
        )

    def _extract_story_lines(self, content):
        stories = []
        current = []

        for raw_line in (content or "").splitlines():
            line = raw_line.rstrip()
            if re.search(r"^\s*[-*]\s*US-\d+\s*\|\s*Como\b", line, re.IGNORECASE):
                if current:
                    stories.append("\n".join(current).strip())
                current = [line.strip()]
                continue

            if current:
                current.append(line.strip())

        if current:
            stories.append("\n".join(current).strip())

        return [item for item in stories if item]

    def _normalize_persona_in_story(self, story_block):
        lines = (story_block or "").splitlines()
        if not lines:
            return ""

        first_line = lines[0]
        match = re.search(r"(\bComo\s+)([^,|]+)", first_line, re.IGNORECASE)
        if not match:
            return story_block.strip()

        persona_raw = match.group(2).strip()
        _, normalized_persona = self._normalize_text(persona_raw)
        replacement = self.PERSONA_NORMALIZATION.get(normalized_persona)
        if not replacement:
            return story_block.strip()

        replaced_first_line = first_line[: match.start(2)] + replacement + first_line[match.end(2) :]
        return "\n".join([replaced_first_line, *lines[1:]]).strip()

    def _looks_truncated_story(self, story_block):
        lines = [line.strip() for line in (story_block or "").splitlines() if line.strip()]
        if not lines:
            return True

        title_line = lines[0]
        if not re.search(r"\bComo\b.+\beu quero\b.+\bpara\b.+", title_line, re.IGNORECASE):
            return True

        if len(lines) < 4:
            return True

        if not any(re.match(r"^-?\s*Contexto\s*:", line, re.IGNORECASE) for line in lines[1:]):
            return True

        if not any(re.match(r"^-?\s*Valor\s*:", line, re.IGNORECASE) for line in lines[1:]):
            return True

        if not any(re.match(r"^-?\s*Criterios de aceite\s*:", line, re.IGNORECASE) for line in lines[1:]):
            return True

        terminal_line = lines[-1]
        if re.search(r"[:;,(\[{/\-]$", terminal_line):
            return True

        if terminal_line.lower() == "fim_do_backlog":
            return True

        short_fragments = {
            "dado que estou configurando o",
            "valor: facilitar o diagnostico",
            "contexto: preciso",
        }
        if terminal_line.lower() in short_fragments:
            return True

        return False

    def _story_similarity_key(self, story_block):
        first_line = (story_block or "").splitlines()[0] if story_block else ""
        normalized = re.sub(r"^\s*[-*]\s*US-\d+\s*\|\s*", "", first_line, flags=re.IGNORECASE).strip()
        _, normalized = self._normalize_text(normalized)
        normalized = re.sub(r"\b(como|eu quero|para|um|uma|o|a|de|do|da|dos|das)\b", " ", normalized)
        normalized = re.sub(r"[^a-z0-9 ]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return " ".join(normalized.split()[:10])

    def _dedupe_and_polish_stories(self, story_blocks):
        cleaned = []
        seen = set()

        for block in story_blocks:
            normalized_block = self._normalize_persona_in_story(block)
            if self._looks_truncated_story(normalized_block):
                continue

            similarity_key = self._story_similarity_key(normalized_block)
            if not similarity_key or similarity_key in seen:
                continue

            seen.add(similarity_key)
            cleaned.append(normalized_block.strip())

        return cleaned

    def _renumber_stories(self, story_blocks):
        normalized_blocks = []
        for index, story in enumerate(story_blocks, start=1):
            lines = story.splitlines()
            if not lines:
                continue

            title_line = re.sub(r"^\s*[-*]\s*US-\d+\s*\|\s*", "", lines[0], flags=re.IGNORECASE).strip()
            rebuilt = [f"- US-{index:02d} | {title_line}"]
            rebuilt.extend([line.rstrip() for line in lines[1:]])
            normalized_blocks.append("\n".join(rebuilt).strip())

        return normalized_blocks

    def _build_full_backlog(self, overview, story_blocks):
        cleaned_overview = (overview or "").strip()
        stories = self._renumber_stories(story_blocks)
        stories_body = "\n\n".join(stories).strip()

        sections = [
            "# BACKLOG DO PROJETO",
            "## Visao Geral",
            cleaned_overview or "Backlog inicial gerado a partir do briefing informado.",
            "## Historias de Usuario",
            stories_body or "- US-01 | Como colaborador, eu quero registrar uma demanda, para iniciar o backlog.",
            "FIM_DO_BACKLOG",
        ]

        return "\n\n".join(sections).strip()

    def _build_stories_section(self, story_blocks):
        stories = self._renumber_stories(story_blocks)
        return "## Historias de Usuario\n\n" + "\n\n".join(stories).strip()

    def _generate_block(self, prompt, *, num_predict):
        result = generate_text_from_llm(
            prompt,
            options_override={
                "temperature": 0.1,
                "num_predict": int(num_predict),
            },
            use_cache=False,
        )

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Resposta vazia ou invalida.")

        return result

    def _curate_story_batch(self, base_context, story_blocks, *, min_stories, max_stories):
        draft_section = self._build_stories_section(story_blocks)
        prompt = f"""
{base_context}

Voce vai atuar como editor final do backlog.

Receba as historias abaixo, consolide e devolva APENAS a secao em Markdown:

{draft_section}

REGRAS DE CURADORIA
- Mantenha entre {min_stories} e {max_stories} historias.
- Remova historias duplicadas ou muito parecidas.
- Prefira a versao mais forte e mais especifica quando houver sobreposicao.
- Padronize personas em torno de: colaborador, atendente, gestor e administrador.
- Nao deixe historias truncadas.
- Cada historia precisa manter:
  - titulo no formato "Como ..., eu quero ..., para ..."
  - Contexto
  - Valor
  - Criterios de aceite com Dado / Quando / Entao
- Nao invente escopo fora do briefing.
- Responda APENAS com:
  - ## Historias de Usuario
  - as historias finais
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_CURATION_NUM_PREDICT", "1300"),
        )
        curated_section = self._extract_section(result, "Historias de Usuario")
        if not curated_section:
            raise RuntimeError("Bloco de curadoria sem secao de historias.")
        return curated_section

    def _generate_multi_block_backlog(self, idea):
        compact_briefing = self._compact_briefing(idea)
        min_stories, max_stories = self.STORY_RANGE
        retry_count = max(1, int(os.getenv("PROJECT_MANAGER_MAX_RETRIES", "1")))
        last_reason = "sem detalhes"

        base_context = f"""
Voce e um Project Manager Senior especializado em discovery e definicao de backlog.

PROJETO
ID: {self.project_id}

BRIEFING
{compact_briefing}

REGRAS GERAIS
- Responda em portugues.
- Gere apenas user stories.
- Nao inclua epicos nem tarefas tecnicas.
- Use personas especificas e reais.
- Evite repetir "usuario" de forma generica.
- Cada story precisa ter Contexto, Valor e Criterios de aceite.
- Mantenha o backlog entre {min_stories} e {max_stories} historias.
"""

        for _attempt in range(1, retry_count + 1):
            try:
                overview_prompt = f"""
{base_context}

Gere APENAS esta secao em Markdown:

## Visao Geral
- Resuma o problema, o objetivo e a primeira versao do produto em no maximo 5 linhas.
"""
                overview_result = self._generate_block(
                    overview_prompt,
                    num_predict=os.getenv("PROJECT_MANAGER_BLOCK_OVERVIEW_NUM_PREDICT", "240"),
                )
                overview = self._extract_section(overview_result, "Visao Geral")
                if not overview:
                    raise RuntimeError("Bloco de visao geral sem conteudo.")

                first_batch_prompt = f"""
{base_context}

Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario
- Gere de 8 a 12 historias cobrindo abertura, classificacao, acompanhamento, colaboracao e atendimento.
- Use o formato:
  - US-01 | Como ..., eu quero ..., para ...
    - Contexto: ...
    - Valor: ...
    - Criterios de aceite:
      - Dado ...
      - Quando ...
      - Entao ...
"""
                first_batch_result = self._generate_block(
                    first_batch_prompt,
                    num_predict=os.getenv("PROJECT_MANAGER_BLOCK_STORIES_A_NUM_PREDICT", "1100"),
                )
                first_batch_section = self._extract_section(first_batch_result, "Historias de Usuario")
                first_batch_stories = self._extract_story_lines(first_batch_section)
                if len(first_batch_stories) < 7:
                    raise RuntimeError("Primeiro bloco de historias veio curto demais.")

                second_batch_prompt = f"""
{base_context}

Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario
- Gere de 7 a 13 historias complementares sem repetir as jornadas principais ja cobertas.
- Foque em administracao, governanca, notificacoes, relatorios, redistribuicao, seguranca e operacao.
- Use o formato:
  - US-01 | Como ..., eu quero ..., para ...
    - Contexto: ...
    - Valor: ...
    - Criterios de aceite:
      - Dado ...
      - Quando ...
      - Entao ...
"""
                second_batch_result = self._generate_block(
                    second_batch_prompt,
                    num_predict=os.getenv("PROJECT_MANAGER_BLOCK_STORIES_B_NUM_PREDICT", "1100"),
                )
                second_batch_section = self._extract_section(second_batch_result, "Historias de Usuario")
                second_batch_stories = self._extract_story_lines(second_batch_section)
                if len(second_batch_stories) < 6:
                    raise RuntimeError("Segundo bloco de historias veio curto demais.")

                combined_story_blocks = self._dedupe_and_polish_stories(first_batch_stories + second_batch_stories)
                if len(combined_story_blocks) >= min_stories:
                    curated_section = self._curate_story_batch(
                        base_context,
                        combined_story_blocks,
                        min_stories=min_stories,
                        max_stories=max_stories,
                    )
                    combined_story_blocks = self._dedupe_and_polish_stories(
                        self._extract_story_lines(curated_section)
                    )
                combined_story_blocks = combined_story_blocks[:max_stories]
                full_backlog = self._build_full_backlog(overview, combined_story_blocks)

                story_count = self._extract_story_count(full_backlog)
                if story_count < min_stories:
                    raise RuntimeError(
                        f"Backlog consolidado com poucas historias ({story_count}). Minimo esperado: {min_stories}."
                    )

                is_complete, reason = validate_backlog_output(full_backlog)
                if is_complete:
                    return full_backlog

                last_reason = reason or "Backlog considerado incompleto."
            except Exception as error:
                last_reason = str(error) or "Falha ao montar o backlog."

        raise RuntimeError(
            f"O agente project_manager nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def process(self, idea):
        return self._generate_multi_block_backlog(idea)
