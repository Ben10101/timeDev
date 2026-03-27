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

    def _is_story_start_line(self, line):
        candidate = (line or "").strip()
        return bool(
            re.search(
                r"^(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?Como\b",
                candidate,
                re.IGNORECASE,
            )
        )

    def _extract_story_lines(self, content):
        stories = []
        current = []

        for raw_line in (content or "").splitlines():
            line = raw_line.rstrip()
            if self._is_story_start_line(line):
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
        if not re.search(r"^\s*Como\b.+\beu quero\b.+", title_line, re.IGNORECASE):
            return True

        short_fragments = {
            "como",
            "como atendente",
            "como gestor",
            "como colaborador",
            "eu quero",
        }
        normalized_title = re.sub(r"\s+", " ", title_line).strip().lower()
        if normalized_title in short_fragments:
            return True

        if len(re.sub(r"\s+", " ", title_line).strip()) < 20:
            return True

        return False

    def _story_similarity_key(self, story_block):
        first_line = (story_block or "").splitlines()[0] if story_block else ""
        normalized = re.sub(
            r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
            "",
            first_line,
            flags=re.IGNORECASE,
        ).strip()
        _, normalized = self._normalize_text(normalized)
        normalized = re.sub(r"\b(como|eu quero|para|um|uma|o|a|de|do|da|dos|das)\b", " ", normalized)
        normalized = re.sub(r"[^a-z0-9 ]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return " ".join(normalized.split()[:10])

    def _story_seed_title(self, story_block):
        first_line = (story_block or "").splitlines()[0] if story_block else ""
        return re.sub(
            r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
            "",
            first_line,
            flags=re.IGNORECASE,
        ).strip()

    def _story_has_strong_structure(self, story_block):
        if self._looks_truncated_story(story_block):
            return False

        lines = [line.strip() for line in (story_block or "").splitlines() if line.strip()]
        title_line = lines[0] if lines else ""
        if not re.search(r"^\s*Como\b.+\beu quero\b.+", title_line, re.IGNORECASE):
            return False

        return True

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

    def _validate_story_batch_quality(self, story_blocks, *, min_stories):
        if len(story_blocks) < min_stories:
            raise RuntimeError(
                f"Lote final com poucas historias confiaveis ({len(story_blocks)}). Minimo esperado: {min_stories}."
            )

        invalid_blocks = [block for block in story_blocks if not self._story_has_strong_structure(block)]
        if invalid_blocks:
            raise RuntimeError("Curadoria final deixou historia com estrutura incompleta.")

        keys = [self._story_similarity_key(block) for block in story_blocks]
        if len(keys) != len(set(keys)):
            raise RuntimeError("Curadoria final ainda deixou historias muito parecidas.")

    def _renumber_stories(self, story_blocks):
        normalized_blocks = []
        for index, story in enumerate(story_blocks, start=1):
            lines = story.splitlines()
            if not lines:
                continue

            title_line = re.sub(
                r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
                "",
                lines[0],
                flags=re.IGNORECASE,
            ).strip()
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

    def _repair_backlog_output(self, base_context, full_backlog, overview, story_blocks, reason, *, min_stories, max_stories):
        repaired_overview = (overview or "").strip()
        extracted_overview = self._extract_section(full_backlog, "Visao Geral")
        if not repaired_overview and extracted_overview:
            repaired_overview = extracted_overview.strip()

        consolidated_blocks = self._dedupe_and_polish_stories(
            list(story_blocks) + self._extract_story_lines(self._extract_section(full_backlog, "Historias de Usuario"))
        )

        if not repaired_overview:
            overview_prompt = f"""
{base_context}

TAREFA
Gere APENAS esta secao em Markdown:

## Visao Geral
- Resuma o problema, o objetivo e a primeira versao do produto em no maximo 5 linhas.
"""
            overview_result = self._generate_block(
                overview_prompt,
                num_predict=os.getenv("PROJECT_MANAGER_BLOCK_OVERVIEW_NUM_PREDICT", "240"),
            )
            repaired_overview = self._extract_section(overview_result, "Visao Geral") or repaired_overview

        if len(consolidated_blocks) < min_stories or "trunc" in (reason or "").lower():
            consolidated_blocks = self._ensure_minimum_story_count(
                base_context,
                consolidated_blocks,
                min_stories=min_stories,
                max_stories=max_stories,
            )

        if len(consolidated_blocks) < min_stories:
            fallback_blocks = self._generate_missing_stories_fallback(
                base_context,
                consolidated_blocks,
                needed_count=min_stories - len(consolidated_blocks),
            )
            if fallback_blocks:
                consolidated_blocks = self._dedupe_and_polish_stories(consolidated_blocks + fallback_blocks)

        if len(consolidated_blocks) >= min_stories:
            curated_section = self._curate_story_batch(
                base_context,
                consolidated_blocks,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            consolidated_blocks = self._dedupe_and_polish_stories(self._extract_story_lines(curated_section))

        consolidated_blocks = self._ensure_minimum_story_count(
            base_context,
            consolidated_blocks,
            min_stories=min_stories,
            max_stories=max_stories,
        )[:max_stories]

        self._validate_story_batch_quality(consolidated_blocks, min_stories=min_stories)
        return self._build_full_backlog(repaired_overview, consolidated_blocks)

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
- Nao deixe nenhuma historia terminar com frase cortada ou titulo generico.
- Cada historia deve ser somente um titulo no formato "Como ..., eu quero ..., para ...".
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

    def _generate_complementary_stories(self, base_context, existing_story_blocks, *, needed_count):
        if needed_count <= 0:
            return []

        existing_titles = [
            re.sub(
                r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
                "",
                block.splitlines()[0],
                flags=re.IGNORECASE,
            ).strip()
            for block in existing_story_blocks
            if block.splitlines()
        ]
        existing_titles_text = "\n".join(f"- {title}" for title in existing_titles[:25])

        prompt = f"""
{base_context}

HISTORIAS JA CONSOLIDADAS
{existing_titles_text}

TAREFA
Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario

REGRAS
- Gere de {needed_count} a {max(needed_count + 2, needed_count)} historias COMPLEMENTARES.
- Nao repita nem reformule historias ja consolidadas.
- Foque nos fluxos que ainda costumam faltar em backlog inicial: administracao, governanca, relatorios, notificacoes, operacao e excecoes de negocio.
- Cada historia deve ser somente um titulo no formato "Como ..., eu quero ..., para ...".
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_COMPLEMENT_NUM_PREDICT", "700"),
        )
        complement_section = self._extract_section(result, "Historias de Usuario")
        if not complement_section:
            return []
        return self._extract_story_lines(complement_section)

    def _generate_thematic_stories(self, base_context, theme_label, instructions, *, target_range):
        prompt = f"""
{base_context}

TEMA DESTA RODADA
{theme_label}

TAREFA
Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario

REGRAS
- Gere de {target_range[0]} a {target_range[1]} historias.
- Foque somente no tema desta rodada.
- {instructions}
- Cada historia deve ser somente um titulo no formato "Como ..., eu quero ..., para ...".
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_THEME_NUM_PREDICT", "900"),
        )
        themed_section = self._extract_section(result, "Historias de Usuario")
        if not themed_section:
            return []
        return self._extract_story_lines(themed_section)

    def _generate_missing_stories_fallback(self, base_context, existing_story_blocks, *, needed_count):
        if needed_count <= 0:
            return []

        existing_titles = [
            self._story_seed_title(block)
            for block in existing_story_blocks
            if block and self._story_seed_title(block)
        ]
        existing_titles_text = "\n".join(f"- {title}" for title in existing_titles[:30])

        prompt = f"""
{base_context}

HISTORIAS JA ACEITAS
{existing_titles_text}

TAREFA
Gere APENAS {needed_count} historias faltantes para completar o backlog minimo.
Responda APENAS com:

## Historias de Usuario

REGRAS
- Nao repita nenhuma historia ja aceita.
- Foque no que costuma faltar para fechar um backlog inicial completo.
- Seja direto e especifico.
- Cada historia deve ser somente um titulo no formato "Como ..., eu quero ..., para ...".
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_MISSING_NUM_PREDICT", "950"),
        )
        missing_section = self._extract_section(result, "Historias de Usuario")
        if not missing_section:
            return []
        return self._extract_story_lines(missing_section)

    def _extract_seed_titles_from_text(self, content):
        titles = []
        for raw_line in (content or "").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            cleaned = re.sub(
                r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
                "",
                line,
                flags=re.IGNORECASE,
            ).strip()
            if re.search(r"^Como\b.+\beu quero\b.+\bpara\b.+", cleaned, re.IGNORECASE):
                titles.append(cleaned)
        return titles

    def _generate_seed_titles_fallback(self, base_context, *, min_stories, max_stories):
        prompt = f"""
{base_context}

TAREFA
Gere APENAS uma lista curta de titulos de historias de usuario.

REGRAS
- Gere entre {min_stories} e {max_stories} titulos.
- Cada linha deve conter somente:
  Como ..., eu quero ..., para ...
- Nao adicione Contexto, Valor ou Criterios nesta etapa.
- Nao inclua explicacoes, secoes extras ou observacoes.
- Cubra jornadas principais, operacao, gestao e governanca do produto.
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_SEEDS_NUM_PREDICT", "900"),
        )
        return self._extract_seed_titles_from_text(result)

    def _expand_story_seeds(self, base_context, seed_titles):
        titles = [title.strip() for title in seed_titles if title and title.strip()]
        if not titles:
            return []

        titles_text = "\n".join(f"- {title}" for title in titles)
        prompt = f"""
{base_context}

TITULOS DE HISTORIAS PARA EXPANDIR
{titles_text}

TAREFA
Padronize esses titulos como user stories finais e devolva APENAS:

## Historias de Usuario

REGRAS
- Mantenha o mesmo sentido de cada titulo.
- Nao crie titulos extras fora da lista.
- Para cada historia, entregue somente um titulo no formato "Como ..., eu quero ..., para ...".
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_EXPAND_NUM_PREDICT", "900"),
        )
        expanded_section = self._extract_section(result, "Historias de Usuario")
        if not expanded_section:
            return []
        return self._extract_story_lines(expanded_section)

    def _ensure_minimum_story_count(self, base_context, story_blocks, *, min_stories, max_stories):
        consolidated = list(story_blocks)

        for _round in range(3):
            if len(consolidated) >= min_stories:
                break

            complement_blocks = self._generate_complementary_stories(
                base_context,
                consolidated,
                needed_count=max(min_stories - len(consolidated), 2),
            )
            if not complement_blocks:
                break

            updated = self._dedupe_and_polish_stories(consolidated + complement_blocks)
            if len(updated) <= len(consolidated):
                break

            consolidated = updated[:max_stories]

        return consolidated[:max_stories]

    def _collect_story_blocks_incrementally(self, base_context, *, min_stories, max_stories):
        themes = [
            (
                "Jornada principal e agendamento",
                "Cubra descoberta de horarios, agendamento inicial, cadastro basico e confirmacao de consulta.",
                (4, 6),
            ),
            (
                "Recepcao e operacao diaria",
                "Cubra recepcao, remarcacao, cancelamento, encaixe, fila e acompanhamento operacional.",
                (4, 6),
            ),
            (
                "Profissional e agenda clinica",
                "Cubra visao do medico, disponibilidade, bloqueio de agenda e organizacao dos atendimentos.",
                (3, 5),
            ),
            (
                "Gestao, relatorios e governanca",
                "Cubra relatorios, administracao, permissao, notificacoes, auditoria e controles de operacao.",
                (3, 5),
            ),
        ]

        consolidated = []
        seed_titles = []
        for theme_label, instructions, target_range in themes:
            batch = self._generate_thematic_stories(
                base_context,
                theme_label,
                instructions,
                target_range=target_range,
            )
            for block in batch:
                title = self._story_seed_title(block)
                similarity_key = self._story_similarity_key(block)
                if title and similarity_key and all(
                    self._story_similarity_key(existing_title) != similarity_key for existing_title in seed_titles
                ):
                    seed_titles.append(title)
            if batch:
                consolidated = self._dedupe_and_polish_stories(consolidated + batch)
            if len(consolidated) >= min_stories:
                break

        consolidated = self._ensure_minimum_story_count(
            base_context,
            consolidated,
            min_stories=min_stories,
            max_stories=max_stories,
        )

        if len(consolidated) < min_stories and seed_titles:
            existing_keys = {self._story_similarity_key(block) for block in consolidated}
            remaining_titles = []
            seen_seed_keys = set()
            for title in seed_titles:
                key = self._story_similarity_key(title)
                if not key or key in existing_keys or key in seen_seed_keys:
                    continue
                seen_seed_keys.add(key)
                remaining_titles.append(title)

            for start in range(0, len(remaining_titles), 4):
                if len(consolidated) >= min_stories:
                    break
                batch_titles = remaining_titles[start:start + 4]
                expanded = self._expand_story_seeds(base_context, batch_titles)
                if expanded:
                    consolidated = self._dedupe_and_polish_stories(consolidated + expanded)

            consolidated = self._ensure_minimum_story_count(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )

        if len(consolidated) < min_stories:
            seed_titles_from_fallback = self._generate_seed_titles_fallback(
                base_context,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            if seed_titles_from_fallback:
                existing_keys = {self._story_similarity_key(block) for block in consolidated}
                new_seed_titles = []
                for title in seed_titles_from_fallback:
                    key = self._story_similarity_key(title)
                    if key and key not in existing_keys:
                        existing_keys.add(key)
                        new_seed_titles.append(title)

                for start in range(0, len(new_seed_titles), 4):
                    if len(consolidated) >= min_stories:
                        break
                    batch_titles = new_seed_titles[start:start + 4]
                    expanded = self._expand_story_seeds(base_context, batch_titles)
                    if expanded:
                        consolidated = self._dedupe_and_polish_stories(consolidated + expanded)

                consolidated = self._ensure_minimum_story_count(
                    base_context,
                    consolidated,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

        return consolidated[:max_stories]

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
- Cada story deve ser somente uma user story no formato "Como ..., eu quero ..., para ...".
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

                combined_story_blocks = self._collect_story_blocks_incrementally(
                    base_context,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

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

                combined_story_blocks = self._ensure_minimum_story_count(
                    base_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

                if len(combined_story_blocks) < min_stories:
                    fallback_blocks = self._generate_missing_stories_fallback(
                        base_context,
                        combined_story_blocks,
                        needed_count=min_stories - len(combined_story_blocks),
                    )
                    if fallback_blocks:
                        combined_story_blocks = self._dedupe_and_polish_stories(
                            combined_story_blocks + fallback_blocks
                        )

                combined_story_blocks = self._ensure_minimum_story_count(
                    base_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

                combined_story_blocks = combined_story_blocks[:max_stories]
                self._validate_story_batch_quality(combined_story_blocks, min_stories=min_stories)
                full_backlog = self._build_full_backlog(overview, combined_story_blocks)

                story_count = self._extract_story_count(full_backlog)
                if story_count < min_stories:
                    raise RuntimeError(
                        f"Backlog consolidado com poucas historias ({story_count}). Minimo esperado: {min_stories}."
                    )

                is_complete, reason = validate_backlog_output(full_backlog)
                if is_complete:
                    return full_backlog

                repaired_backlog = self._repair_backlog_output(
                    base_context,
                    full_backlog,
                    overview,
                    combined_story_blocks,
                    reason or "",
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                repaired_ok, repaired_reason = validate_backlog_output(repaired_backlog)
                if repaired_ok:
                    return repaired_backlog

                last_reason = repaired_reason or reason or "Backlog considerado incompleto."
            except Exception as error:
                last_reason = str(error) or "Falha ao montar o backlog."

        raise RuntimeError(
            f"O agente project_manager nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def process(self, idea):
        return self._generate_multi_block_backlog(idea)
