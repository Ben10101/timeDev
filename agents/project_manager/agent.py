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
    PLANNING_LANES = [
        ("fundacao", "fundacao do produto", "cadastro inicial, configuracao basica, entidade principal e primeiro fluxo utilizavel"),
        ("operacao", "operacao principal", "acompanhamento, execucao, atualizacao de status, filas e trabalho do dia a dia"),
        ("gestao", "gestao e visibilidade", "consultas gerenciais, relatorios, dashboards e leitura consolidada"),
        ("governanca", "governanca e controle", "aprovacoes, permissoes, auditoria, compliance e controle de mudancas"),
    ]
    FOUNDATION_SIGNAL_PROMPTS = [
        {
            "key": "criar",
            "pattern": r"\b(criar|cadastrar|registrar|abrir)\b",
            "label": "criacao e cadastro inicial",
            "instruction": "Cubra a criacao da entidade principal, o cadastro inicial e o primeiro registro necessario para colocar o produto em uso.",
        },
        {
            "key": "configurar",
            "pattern": r"\b(configurar|definir|planejar|organizar)\b",
            "label": "configuracao e planejamento",
            "instruction": "Cubra configuracao inicial, definicao de parametros operacionais e planejamento basico do fluxo principal.",
        },
        {
            "key": "visualizar",
            "pattern": r"\b(visualizar|consultar|listar|buscar)\b",
            "label": "consulta e visibilidade",
            "instruction": "Cubra consulta, listagem, busca e visibilidade do estado atual do produto para o papel principal.",
        },
        {
            "key": "acompanhar",
            "pattern": r"\b(acompanhar|monitorar|atualizar|gerenciar)\b",
            "label": "operacao e acompanhamento",
            "instruction": "Cubra acompanhamento operacional, atualizacao do trabalho em andamento e monitoramento do fluxo do dia a dia.",
        },
        {
            "key": "aprovar",
            "pattern": r"\b(aprovar|validar|autorizar|revisar)\b",
            "label": "decisao e governanca",
            "instruction": "Cubra decisao, aprovacao, validacao ou governanca minima para que o fluxo principal fique controlado.",
        },
    ]
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
    ADVANCED_STORY_PATTERNS = [
        r"\bwebhook\b",
        r"\bintegrac",
        r"\bexportar\b",
        r"\bcsv\b",
        r"\bsap\b",
        r"\berp\b",
        r"\bcrm\b",
        r"\bmarketplace\b",
        r"\bblockchain\b",
        r"\bwearables?\b",
        r"\bwhite-?label\b",
        r"\bgamifica",
        r"\bpegada de carbono\b",
        r"\besg\b",
        r"\broi\b",
        r"\bia\b",
        r"\bpredit",
        r"\bbenchmark",
    ]
    TECHNICAL_STORY_PATTERNS = [
        r"\bentidade\b",
        r"\bnumero sequencial\b",
        r"\bidentificador unico\b",
        r"\bchave primaria\b",
        r"\btabela\b",
        r"\bapi\b",
        r"\bendpoint\b",
        r"\bschema\b",
        r"\bmodelo de dados\b",
        r"\bcrud\b",
    ]
    FOUNDATION_FRONTLOAD_RULES = [
        ("criar", r"\b(criar|cadastrar|registrar|abrir)\b"),
        ("configurar", r"\b(configurar|definir|planejar|organizar|montar)\b"),
        ("visualizar", r"\b(visualizar|consultar|listar|buscar|resumo|painel)\b"),
        ("acompanhar", r"\b(acompanhar|monitorar|atualizar|gerenciar|status)\b"),
        ("aprovar", r"\b(aprovar|validar|autorizar|revisar)\b"),
    ]
    CORE_PACK_REQUIREMENTS = [
        ("criar_evento", "Criar a entidade principal do produto"),
        ("definir_escopo", "Definir escopo, configuracao ou planejamento inicial"),
        ("registrar_orcamento", "Registrar orcamento ou informacao operacional central"),
        ("cadastrar_fornecedor", "Cadastrar fornecedor, recurso ou parceiro essencial"),
        ("cadastrar_convidado", "Cadastrar convidado, participante ou publico principal"),
        ("aprovar_fluxo", "Aprovar ou validar o fluxo basico"),
        ("visualizar_resumo", "Visualizar resumo ou painel inicial do trabalho"),
        ("acompanhar_status", "Acompanhar status ou atualizacao operacional"),
    ]
    CORE_PACK_SLOTS = [
        ("criar_evento", "criar o evento principal com campos basicos"),
        ("definir_escopo", "definir escopo ou planejamento inicial do evento"),
        ("registrar_orcamento", "registrar orcamento inicial ou categorias de custo"),
        ("cadastrar_fornecedor", "cadastrar fornecedor ou recurso essencial"),
        ("cadastrar_convidado", "cadastrar convidado, participante ou lista inicial"),
        ("aprovar_fluxo", "aprovar ou validar o fluxo basico do evento"),
        ("visualizar_resumo", "visualizar resumo inicial ou painel do evento"),
        ("acompanhar_status", "acompanhar ou atualizar status/andamento do trabalho"),
    ]

    def __init__(self, project_id):
        self.project_id = project_id

    def _story_block_format_rules(self):
        return """
- Cada story deve vir em um bloco de 2 linhas.
- A primeira linha deve ser a user story no formato "US-XX | Como ..., eu quero ..., para ...".
- A segunda linha deve ser uma descricao curta e util, com contexto, regra, excecao ou expectativa importante.
- A descricao nao deve repetir o titulo; ela deve acrescentar informacao nova para produto, arquitetura ou QA.
- Mantenha a descricao objetiva, com 1 ou 2 frases.
""".strip()

    def _compose_story_block(self, index, title, description):
        cleaned_title = re.sub(r"\s+", " ", (title or "")).strip()
        cleaned_description = re.sub(r"\s+", " ", (description or "")).strip()
        lines = [f"- US-{index:02d} | {cleaned_title}"]
        if cleaned_description:
            lines.append(f"  Descricao: {cleaned_description}")
        return "\n".join(lines).strip()

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

    def _infer_core_pack_terms(self, base_context):
        semantic_source = (base_context or "").strip()
        briefing_match = re.search(
            r"\bBRIEFING\b\s*(.*?)(?=\n(?:REGRAS GERAIS|EXPECTATIVA|PLANO ESTRUTURAL DO BACKLOG|## )\b|$)",
            semantic_source,
            re.IGNORECASE | re.DOTALL,
        )
        if briefing_match and briefing_match.group(1).strip():
            semantic_source = briefing_match.group(1).strip()

        _, normalized = self._normalize_text(semantic_source)

        entity_label = "item principal"
        entity_article = "o"
        if re.search(r"\bevento|credenci|convidad\b", normalized):
            entity_label = "evento"
            entity_article = "o"
        elif re.search(r"\bvisita|visitante|portaria\b", normalized):
            entity_label = "visita"
            entity_article = "a"
        elif re.search(r"\bchamad|ticket|incidente|suporte\b", normalized):
            entity_label = "chamado"
            entity_article = "o"
        elif re.search(r"\breembolso|despesa|prestacao de contas\b", normalized):
            entity_label = "reembolso"
            entity_article = "o"
        elif re.search(r"\bcurso|matricula|aluno|ead\b", normalized):
            entity_label = "curso"
            entity_article = "o"
        elif re.search(r"\bcontrato|fornecedor|compra\b", normalized):
            entity_label = "contrato"
            entity_article = "o"

        participant_label = "participante"
        if re.search(r"\bconvidad\b", normalized):
            participant_label = "convidado"
        elif re.search(r"\bcredenci\b", normalized):
            participant_label = "participante"
        elif re.search(r"\bvisitante|visita\b", normalized):
            participant_label = "visitante"
        elif re.search(r"\baluno|matricula\b", normalized):
            participant_label = "aluno"
        elif re.search(r"\bcolaborador|usuario interno\b", normalized):
            participant_label = "colaborador"

        supplier_label = "recurso essencial"
        if re.search(r"\bfornecedor|prestador|parceiro|buffet|espaco|servico\b", normalized):
            supplier_label = "fornecedor"
        elif re.search(r"\bequipe|responsavel|area interna\b", normalized):
            supplier_label = "responsavel operacional"

        baseline_label = "registro operacional inicial"
        baseline_article = "o"
        if re.search(r"\borcamento|custo|verba|despesa|financeir\b", normalized):
            baseline_label = "orcamento"
            baseline_article = "o"
        elif entity_label == "visita":
            baseline_label = "dados iniciais de autorizacao"
            baseline_article = "os"
        elif entity_label == "chamado":
            baseline_label = "classificacao inicial"
            baseline_article = "a"
        elif entity_label == "curso":
            baseline_label = "configuracao inicial"
            baseline_article = "a"

        summary_label = f"resumo do {entity_label}"
        if entity_label in {"visita", "chamado", "reembolso", "curso", "contrato"}:
            summary_label = f"resumo da {entity_label}" if entity_label in {"visita"} else f"resumo do {entity_label}"

        owner_persona = "Mariana, coordenadora operacional"
        finance_persona = "Carlos, analista financeiro"
        support_persona = "Felipe, assistente operacional"
        approver_persona = "Roberto, gestor responsavel"

        if entity_label == "evento":
            owner_persona = "Mariana, coordenadora de eventos"
            finance_persona = "Carlos, analista financeiro"
            support_persona = "Felipe, assistente de eventos"
            approver_persona = "Roberto, diretor financeiro"
        elif entity_label == "visita":
            owner_persona = "Patricia, supervisora de recepcao"
            finance_persona = "Luciana, analista administrativa"
            support_persona = "Bruno, assistente de recepcao"
            approver_persona = "Rafael, gestor da unidade"
        elif entity_label == "chamado":
            owner_persona = "Mariana, coordenadora de suporte"
            finance_persona = "Carlos, analista operacional"
            support_persona = "Felipe, atendente"
            approver_persona = "Roberto, gestor de suporte"

        return {
            "entity_label": entity_label,
            "entity_article": entity_article,
            "participant_label": participant_label,
            "supplier_label": supplier_label,
            "baseline_label": baseline_label,
            "baseline_article": baseline_article,
            "summary_label": summary_label,
            "owner_persona": owner_persona,
            "finance_persona": finance_persona,
            "support_persona": support_persona,
            "approver_persona": approver_persona,
        }

    def _article_for_term(self, term):
        _, normalized = self._normalize_text(term)
        if re.search(r"\bdados\b", normalized):
            return "os"
        if normalized.endswith("a") or normalized.endswith("cao") or normalized.endswith("sao"):
            return "a"
        return "o"

    def _prep_article_for_entity(self, article):
        return "da" if article == "a" else "do"

    def _article_for_summary(self, summary_label):
        return "o"

    def _infer_domain_guardrails(self, base_context):
        inferred = self._infer_core_pack_terms(base_context)
        _, normalized = self._normalize_text(base_context)
        entity_label = inferred["entity_label"]
        finance_explicit = bool(re.search(r"\b(orcamento|custo|verba|despesa|financeir|refeic|estacionamento)\b", normalized))
        forbidden = []

        if entity_label == "visita":
            forbidden.extend(
                [
                    r"\bevento\b",
                    r"\bbuffet\b",
                    r"\bauditorio\b",
                    r"\bpalestr",
                    r"\bconvidad",
                    r"\bcredenciamento\b",
                ]
            )
            if not finance_explicit:
                forbidden.extend(
                    [
                        r"\borcamento\b",
                        r"\bcusto\b",
                        r"\bverba\b",
                        r"\bdespesa\b",
                        r"\brefeic",
                        r"\bestacionamento\b",
                    ]
                )
        elif entity_label == "chamado":
            forbidden.extend([r"\bevento\b", r"\bvisit", r"\bfornecedor de buffet\b"])
        elif entity_label == "evento":
            forbidden.extend([r"\bvisitante corporativo\b", r"\bportaria\b"])

        return {
            "entity_label": entity_label,
            "finance_explicit": finance_explicit,
            "forbidden_patterns": forbidden,
        }

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

    def _is_advanced_story(self, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)
        return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in self.ADVANCED_STORY_PATTERNS)

    def _is_technical_story(self, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)
        return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in self.TECHNICAL_STORY_PATTERNS)

    def _is_domain_drift_story(self, base_context, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)
        guardrails = self._infer_domain_guardrails(base_context)
        return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in guardrails["forbidden_patterns"])

    def _story_intent_bucket(self, base_context, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)
        entity_label = self._infer_core_pack_terms(base_context)["entity_label"]
        entity_pattern = re.escape(entity_label)

        if re.search(r"\b(cadastrar|registrar|listar|consultar)\b", normalized) and re.search(r"\b(visitante|convidad|participante|lista inicial)\b", normalized):
            return "core:participant"
        if re.search(r"\b(cadastrar|registrar|vincular|definir)\b", normalized) and re.search(r"\b(responsavel|fornecedor|recurso|anfitri|unidade)\b", normalized):
            return "core:resource"
        if re.search(r"\b(registrar|definir|informar|classificar)\b", normalized) and re.search(r"\b(autoriz|classific|orcamento|dados iniciais|base operacional)\b", normalized):
            return "core:baseline"
        if re.search(r"\b(definir|configurar|planejar|montar|organizar)\b", normalized) and re.search(r"\b(escopo|parametr|planejamento|contexto|volume|unidade)\b", normalized):
            return "core:define_scope"
        if re.search(r"\b(aprovar|reprovar|recusar|validar|autorizar|revisar)\b", normalized):
            return "core:approval"
        if re.search(r"\b(visualizar|consultar|listar)\b", normalized) and re.search(r"\b(resumo|painel|status|dia)\b", normalized):
            return "core:summary"
        if re.search(r"\b(atualizar|alterar|acompanhar|monitorar|marcar)\b", normalized) and re.search(r"\b(status|andamento|rascunho|aprovacao|finalizada|atendimento)\b", normalized):
            return "core:status"
        if (
            re.search(r"\b(criar|abrir)\b", normalized)
            and re.search(rf"\b{entity_pattern}\b", normalized)
            and not re.search(r"\b(visitante|convidad|participante|responsavel|fornecedor|recurso|anfitri|autoriz|classific|status|resumo)\b", normalized)
        ):
            return "core:create_entity"
        if re.search(r"\b(check-?in|entrada)\b", normalized):
            return "ops:checkin"
        if re.search(r"\b(check-?out|saida)\b", normalized):
            return "ops:checkout"
        return ""

    def _story_priority_score(self, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)

        score = 0
        if re.search(r"\b(criar|cadastrar|registrar|abrir)\b", normalized):
            score += 5
        if re.search(r"\b(configurar|definir|planejar|montar|organizar)\b", normalized):
            score += 4
        if re.search(r"\b(aprovar|validar|autorizar|revisar)\b", normalized):
            score += 4
        if re.search(r"\b(visualizar|consultar|listar|resumo|painel)\b", normalized):
            score += 3
        if re.search(r"\b(acompanhar|monitorar|atualizar|gerenciar|status)\b", normalized):
            score += 3
        if re.search(r"\b(fornecedor|orcamento|cronograma|convidad|credenciamento|evento)\b", normalized):
            score += 2
        if self._is_advanced_story(story_block):
            score -= 6
        return score

    def _story_stage_rank(self, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)

        if re.search(r"\b(criar|cadastrar|registrar|abrir)\b", normalized) and re.search(r"\b(evento|visita|chamado|curso|contrato|reembolso)\b", normalized):
            return 1
        if re.search(r"\b(definir|configurar|planejar|montar|organizar)\b", normalized) and re.search(r"\b(escopo|evento|visita|chamado|workspace|conta|categoria|cronograma|unidade)\b", normalized):
            return 2
        if re.search(r"\b(cadastrar|registrar|definir|inserir)\b", normalized) and re.search(r"\b(orcamento|custo|verba|despesa|autorizacao|classificacao)\b", normalized):
            return 3
        if re.search(r"\b(cadastrar|registrar|vincular|gerenciar|definir)\b", normalized) and re.search(r"\b(fornecedor|parceiro|prestador|responsavel|anfitri|unidade)\b", normalized):
            return 4
        if re.search(r"\b(cadastrar|registrar|confirmar|gerar)\b", normalized) and re.search(r"\b(convidad|participante|credencial|check-?in|visitante)\b", normalized):
            return 5
        if re.search(r"\b(aprovar|validar|autorizar|revisar)\b", normalized):
            return 6
        if re.search(r"\b(visualizar|consultar|listar)\b", normalized) and re.search(r"\b(resumo|painel|evento|visita|status|orcamento)\b", normalized):
            return 7
        if re.search(r"\b(acompanhar|monitorar|atualizar|gerenciar|alterar|marcar)\b", normalized) and re.search(r"\b(status|andamento|evento|visita|tarefa|execucao|atendimento)\b", normalized):
            return 8
        if self._is_advanced_story(story_block):
            return 20
        return 12

    def _prioritize_story_blocks(self, story_blocks):
        prioritized = sorted(
            story_blocks,
            key=lambda block: (
                self._story_priority_score(block),
                -len(self._story_seed_title(block)),
            ),
            reverse=True,
        )
        return prioritized

    def _sequence_story_blocks_for_mvp(self, story_blocks, *, window=8):
        head = list(story_blocks[:window])
        tail = list(story_blocks[window:])
        head = sorted(
            head,
            key=lambda block: (
                self._story_stage_rank(block),
                -self._story_priority_score(block),
                self._story_seed_title(block),
            ),
        )
        tail = sorted(
            tail,
            key=lambda block: (
                self._story_stage_rank(block),
                -self._story_priority_score(block),
                self._story_seed_title(block),
            ),
        )
        return head + tail

    def _frontload_foundation_coverage(self, story_blocks, window=8):
        selected = story_blocks[:window]
        covered = set()
        for block in selected:
            title = self._story_seed_title(block)
            _, normalized = self._normalize_text(title)
            for key, pattern in self.FOUNDATION_FRONTLOAD_RULES:
                if re.search(pattern, normalized, re.IGNORECASE):
                    covered.add(key)
        return covered

    def _core_pack_coverage(self, story_blocks, window=8):
        selected = story_blocks[:window]
        coverage = set()

        for block in selected:
            title = self._story_seed_title(block)
            _, normalized = self._normalize_text(title)
            if re.search(r"\b(criar|cadastrar|registrar|abrir)\b", normalized) and re.search(r"\bevento\b", normalized):
                coverage.add("criar_evento")
            if re.search(r"\b(definir|configurar|planejar|montar|organizar)\b", normalized):
                coverage.add("definir_escopo")
            if re.search(r"\b(orcamento|custo|verba)\b", normalized) and re.search(r"\b(registrar|definir|visualizar|controlar)\b", normalized):
                coverage.add("registrar_orcamento")
            if re.search(r"\bfornecedor|parceiro|prestador\b", normalized) and re.search(r"\b(criar|cadastrar|registrar|vincular|gerenciar)\b", normalized):
                coverage.add("cadastrar_fornecedor")
            if re.search(r"\b(convidad|participante|publico)\b", normalized) and re.search(r"\b(criar|cadastrar|registrar|confirmar|gerenciar)\b", normalized):
                coverage.add("cadastrar_convidado")
            if re.search(r"\b(aprovar|validar|autorizar|revisar)\b", normalized):
                coverage.add("aprovar_fluxo")
            if re.search(r"\b(visualizar|consultar|listar)\b", normalized) and re.search(r"\b(resumo|painel|evento|orcamento|status)\b", normalized):
                coverage.add("visualizar_resumo")
            if re.search(r"\b(acompanhar|monitorar|atualizar|gerenciar)\b", normalized) and re.search(r"\b(status|evento|execucao|andamento)\b", normalized):
                coverage.add("acompanhar_status")

        return coverage

    def _dedupe_and_polish_stories(self, story_blocks, base_context=None):
        cleaned = []
        seen = set()
        seen_buckets = set()

        for block in story_blocks:
            normalized_block = self._normalize_persona_in_story(block)
            if self._looks_truncated_story(normalized_block):
                continue
            if self._is_technical_story(normalized_block):
                continue
            if base_context and self._is_domain_drift_story(base_context, normalized_block):
                continue

            similarity_key = self._story_similarity_key(normalized_block)
            if not similarity_key or similarity_key in seen:
                continue

            bucket = self._story_intent_bucket(base_context, normalized_block) if base_context else ""
            if bucket and bucket.startswith("core:") and bucket in seen_buckets:
                continue

            seen.add(similarity_key)
            if bucket:
                seen_buckets.add(bucket)
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

        technical_blocks = [block for block in story_blocks if self._is_technical_story(block)]
        if technical_blocks:
            raise RuntimeError("Curadoria final ainda deixou historia tecnica demais para backlog de usuario.")

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
        return self._build_full_backlog_with_structure(
            overview=overview,
            capabilities=[],
            epics=[],
            release_slices=[],
            story_blocks=story_blocks,
        )

    def _build_full_backlog_with_structure(self, overview, capabilities, epics, release_slices, story_blocks):
        cleaned_overview = (overview or "").strip()
        capabilities_body = "\n".join(f"- {item}" for item in (capabilities or []) if item).strip()
        epics_body = "\n".join(f"- {item}" for item in (epics or []) if item).strip()
        release_body = "\n".join(f"- {item}" for item in (release_slices or []) if item).strip()
        stories = self._renumber_stories(story_blocks)
        stories_body = "\n\n".join(stories).strip()

        sections = [
            "# BACKLOG DO PROJETO",
            "## Visao Geral",
            cleaned_overview or "Backlog inicial gerado a partir do briefing informado.",
            "## Capacidades do Produto",
            capabilities_body or "- Capacidade principal ainda nao consolidada.",
            "## Epicos Recomendados",
            epics_body or "- Epic 1: Fundacao operacional do produto.",
            "## Fatias de Release",
            release_body or "- MVP: fluxo principal e governanca minima.",
            "## Historias de Usuario",
            stories_body or "- US-01 | Como colaborador, eu quero registrar uma demanda, para iniciar o backlog.",
            "FIM_DO_BACKLOG",
        ]

        return "\n\n".join(sections).strip()

    def _build_stories_section(self, story_blocks):
        stories = self._renumber_stories(story_blocks)
        return "## Historias de Usuario\n\n" + "\n\n".join(stories).strip()

    def _get_foundation_signal_matches(self, story_blocks):
        normalized_titles = [self._story_seed_title(block) for block in story_blocks if block]
        matches = {}
        for signal in self.FOUNDATION_SIGNAL_PROMPTS:
            matches[signal["key"]] = any(
                re.search(signal["pattern"], title, re.IGNORECASE) for title in normalized_titles
            )
        return matches

    def _get_missing_foundation_signals(self, story_blocks):
        matches = self._get_foundation_signal_matches(story_blocks)
        return [signal for signal in self.FOUNDATION_SIGNAL_PROMPTS if not matches.get(signal["key"])]

    def _extract_bullet_lines(self, content):
        return [
            re.sub(r"^\s*(?:[-*]\s*|\d+[\.\)]\s*)", "", line).strip().strip("*").strip()
            for line in (content or "").splitlines()
            if re.match(r"^\s*(?:[-*]\s+|\d+[\.\)]\s+).+", line.strip())
        ]

    def _extract_release_slices(self, content):
        bullet_lines = self._extract_bullet_lines(content)
        if len(bullet_lines) >= 3:
            return self._normalize_release_slices(bullet_lines)

        slices = []
        current_title = ""
        current_lines = []

        def flush_current():
            if not current_title:
                return
            body = " ".join(line.strip(" -*") for line in current_lines if line.strip()).strip()
            if body:
                slices.append(f"{current_title}: {body}")
            else:
                slices.append(current_title)

        for raw_line in (content or "").splitlines():
            line = raw_line.strip()
            heading_match = re.match(r"^#{1,6}\s*(MVP|Fase\s+2|Fase\s+3)\b[:\-\s]*", line, re.IGNORECASE)
            if heading_match:
                flush_current()
                current_title = re.sub(r"\s+", " ", heading_match.group(1)).strip()
                current_lines = []
                continue

            if current_title and line:
                current_lines.append(line)

        flush_current()
        return self._normalize_release_slices(slices)

    def _normalize_release_slices(self, release_slices):
        normalized = [item.strip() for item in (release_slices or []) if item and item.strip()]
        adjusted = []
        for item in normalized:
            lowered = item.lower()
            if "mvp" in lowered and not re.search(r"\b(fundacao|espinha|fluxo principal|primeira versao|base)\b", lowered, re.IGNORECASE):
                if ":" in item:
                    head, tail = item.split(":", 1)
                    item = f"{head}: foco na espinha dorsal do produto, {tail.strip()}"
                else:
                    item = f"{item} com foco na espinha dorsal do produto"
            adjusted.append(item)
        return adjusted

    def _build_default_release_slices(self, overview, capabilities, epics):
        capability_preview = ", ".join(item.split("**")[0].strip(" -*") for item in capabilities[:3] if item).strip()
        epic_preview = ", ".join(item.split("**")[0].strip(" -*") for item in epics[:3] if item).strip()
        mvp_focus = capability_preview or "criacao da entidade principal, fluxo basico e operacao inicial"
        phase2_focus = epic_preview or "expansao operacional, controles e visibilidade gerencial"
        return [
            f"MVP: foco na espinha dorsal do produto, priorizando {mvp_focus}. O que fica para depois: automacoes sofisticadas, integracoes avancadas e analytics profundo.",
            f"Fase 2: foco em ampliar a operacao com {phase2_focus}. O que fica para depois: inteligencia avancada, ecossistema aberto e features premium.",
            "Fase 3: foco em inteligencia, automacao avancada e expansao do produto. O que fica para depois: iniciativas experimentais e especializacoes de nicho.",
        ]

    def _build_planning_context(self, overview, capabilities, epics, release_slices):
        capabilities_text = "\n".join(f"- {item}" for item in capabilities if item).strip() or "- Sem capacidades consolidadas."
        epics_text = "\n".join(f"- {item}" for item in epics if item).strip() or "- Sem epicos consolidados."
        releases_text = "\n".join(f"- {item}" for item in release_slices if item).strip() or "- MVP: espinha dorsal do produto."
        return (
            "PLANO ESTRUTURAL DO BACKLOG\n"
            f"## Visao Geral\n{(overview or '').strip()}\n\n"
            f"## Capacidades do Produto\n{capabilities_text}\n\n"
            f"## Epicos Recomendados\n{epics_text}\n\n"
            f"## Fatias de Release\n{releases_text}"
        ).strip()

    def _generate_backlog_blueprint(self, base_context):
        lane_text = "\n".join(
            f"- {label}: {guidance}" for _, label, guidance in self.PLANNING_LANES
        )
        prompt = f"""
{base_context}

TAREFA
Gere APENAS as secoes abaixo em Markdown:

## Visao Geral
## Capacidades do Produto
## Epicos Recomendados
## Fatias de Release

REGRAS
- A visao geral deve resumir problema, objetivo e primeira versao do produto em no maximo 5 linhas.
- Gere entre 4 e 6 capacidades do produto.
- Gere entre 4 e 6 epicos recomendados.
- Gere exatamente 3 fatias de release: MVP, Fase 2 e Fase 3.
- O MVP deve cobrir a espinha dorsal do produto.
- Cada fatia deve explicitar foco e o que fica para depois.
- Distribua capacidades e epicos cobrindo estes eixos:
{lane_text}
- Nao escreva user stories nesta resposta.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLUEPRINT_NUM_PREDICT", "900"),
        )
        overview = self._extract_section(result, "Visao Geral")
        capabilities = self._extract_bullet_lines(self._extract_section(result, "Capacidades do Produto"))
        epics = self._extract_bullet_lines(self._extract_section(result, "Epicos Recomendados"))
        release_slices = self._extract_release_slices(self._extract_section(result, "Fatias de Release"))

        if not overview:
            raise RuntimeError("Planner do PM nao gerou visao geral.")
        if len(capabilities) < 4:
            raise RuntimeError("Planner do PM gerou poucas capacidades.")
        if len(epics) < 4:
            raise RuntimeError("Planner do PM gerou poucos epicos.")
        normalized_release_text = " ".join(release_slices).lower()
        if len(release_slices) < 3 or "mvp" not in normalized_release_text or "fase 2" not in normalized_release_text or "fase 3" not in normalized_release_text:
            release_slices = self._generate_simple_bullet_section(
                base_context,
                section_title="Fatias de Release",
                task_label="releases",
                rules="- Liste exatamente 3 fatias de release: MVP, Fase 2 e Fase 3.\n- Em cada item, diga o foco da fatia e o que fica para depois.\n- O MVP deve citar explicitamente a espinha dorsal, fundacao ou fluxo principal.\n- Nao escreva user stories.",
                num_predict=os.getenv("PROJECT_MANAGER_BLOCK_RELEASES_NUM_PREDICT", "420"),
            )
            normalized_release_text = " ".join(release_slices).lower()

        if len(release_slices) < 3 or "mvp" not in normalized_release_text or "fase 2" not in normalized_release_text or "fase 3" not in normalized_release_text:
            release_slices = self._build_default_release_slices(overview, capabilities, epics)
            normalized_release_text = " ".join(release_slices).lower()

        if len(release_slices) < 3:
            raise RuntimeError("Planner do PM gerou poucas fatias de release.")
        if "mvp" not in normalized_release_text or "fase 2" not in normalized_release_text or "fase 3" not in normalized_release_text:
            raise RuntimeError("Planner do PM nao marcou MVP, Fase 2 e Fase 3 explicitamente.")

        return overview.strip(), capabilities[:6], epics[:6], release_slices[:3]

    def _estimate_story_lane(self, story_block):
        title = self._story_seed_title(story_block)
        _, normalized = self._normalize_text(title)
        lane_patterns = {
            "fundacao": r"\b(criar|cadastrar|registrar|abrir|definir|configurar|planejar)\b",
            "operacao": r"\b(atualizar|acompanhar|executar|monitorar|registrar ocorrencia|fila|status)\b",
            "gestao": r"\b(visualizar|consultar|relatorio|dashboard|painel|resumo)\b",
            "governanca": r"\b(aprovar|validar|autorizar|auditar|permiss|governanca|controle)\b",
        }
        for lane, pattern in lane_patterns.items():
            if re.search(pattern, normalized, re.IGNORECASE):
                return lane
        return "operacao"

    def _ensure_lane_story_coverage(self, base_context, story_blocks, *, min_stories, max_stories):
        consolidated = list(story_blocks)
        covered = {self._estimate_story_lane(block) for block in consolidated}
        missing_lanes = [lane for lane, _, _ in self.PLANNING_LANES if lane not in covered]
        if not missing_lanes:
            return consolidated[:max_stories]

        focus_lines = []
        for lane, label, guidance in self.PLANNING_LANES:
            if lane in missing_lanes:
                focus_lines.append(f"- {label}: {guidance}")

        existing_titles = "\n".join(f"- {self._story_seed_title(block)}" for block in consolidated[:30]) or "- Nenhuma historia consolidada."
        prompt = f"""
{base_context}

HISTORIAS JA CONSOLIDADAS
{existing_titles}

EIXOS QUE AINDA FALTAM NO BACKLOG
{chr(10).join(focus_lines)}

TAREFA
Gere APENAS esta secao em Markdown:

## Historias de Usuario

REGRAS
- Gere entre {len(missing_lanes)} e {len(missing_lanes) + 2} historias.
- Cubra SOMENTE os eixos ausentes.
- Nao repita nem reformule historias ja consolidadas.
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_LANE_COVERAGE_NUM_PREDICT", "850"),
        )
        extra_section = self._extract_section(result, "Historias de Usuario")
        extra_blocks = self._extract_story_lines(extra_section)
        if extra_blocks:
            consolidated = self._dedupe_and_polish_stories(consolidated + extra_blocks, base_context)
            consolidated = self._ensure_minimum_story_count(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )
        return consolidated[:max_stories]

    def _generate_mvp_frontload_stories(self, base_context, existing_story_blocks):
        existing_titles = [
            self._story_seed_title(block)
            for block in existing_story_blocks
            if block and self._story_seed_title(block)
        ]
        existing_titles_text = "\n".join(f"- {title}" for title in existing_titles[:30]) or "- Nenhuma historia consolidada."

        prompt = f"""
{base_context}

HISTORIAS JA CONSOLIDADAS
{existing_titles_text}

TAREFA
Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario

REGRAS
- Gere entre 6 e 8 historias fundadoras para abrir o backlog.
- Priorize estas coberturas no comeco do produto:
  - criar a entidade principal
  - definir escopo, configuracao ou planejamento inicial
  - cadastrar recursos ou fornecedores essenciais
  - registrar orcamento ou informacao operacional central
  - aprovar ou validar o fluxo basico
  - visualizar resumo inicial do trabalho
  - acompanhar atualizacao de status
- Evite integrações, webhooks, exportacoes, IA, ESG, ROI, marketplace, analytics avancado e automacoes sofisticadas.
- Nao repita nem reformule historias ja consolidadas.
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_FRONTLOAD_NUM_PREDICT", "900"),
        )
        frontload_section = self._extract_section(result, "Historias de Usuario")
        if not frontload_section:
            return []
        return self._extract_story_lines(frontload_section)

    def _generate_core_pack_stories(self, base_context, existing_story_blocks, missing_requirements):
        if not missing_requirements:
            return []

        existing_titles = [
            self._story_seed_title(block)
            for block in existing_story_blocks
            if block and self._story_seed_title(block)
        ]
        existing_titles_text = "\n".join(f"- {title}" for title in existing_titles[:30]) or "- Nenhuma historia consolidada."
        requirement_lines = "\n".join(f"- {label}" for _key, label in missing_requirements)

        prompt = f"""
{base_context}

HISTORIAS JA CONSOLIDADAS
{existing_titles_text}

CORE PACK OBRIGATORIO AINDA FALTANTE
{requirement_lines}

TAREFA
Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario

REGRAS
- Gere entre {len(missing_requirements)} e {len(missing_requirements) + 1} historias.
- Cubra SOMENTE os itens faltantes do core pack.
- Escreva historias claramente fundadoras, de MVP, e evite qualquer sofisticacao desnecessaria.
- Nao use integracoes, webhooks, exportacoes, IA, ESG, ROI, marketplace, analytics avancado, templates complexos ou automacoes sofisticadas.
- Nao repita nem reformule historias ja consolidadas.
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_CORE_PACK_NUM_PREDICT", "950"),
        )
        section = self._extract_section(result, "Historias de Usuario")
        if not section:
            return []
        return self._extract_story_lines(section)

    def _generate_fixed_core_pack_stories(self, base_context):
        inferred = self._infer_core_pack_terms(base_context)
        entity_label = inferred["entity_label"]
        entity_article = inferred["entity_article"]
        participant_label = inferred["participant_label"]
        supplier_label = inferred["supplier_label"]
        baseline_label = inferred["baseline_label"]
        baseline_article = inferred["baseline_article"]
        summary_label = inferred["summary_label"]
        owner_persona = inferred["owner_persona"]
        finance_persona = inferred["finance_persona"]
        support_persona = inferred["support_persona"]
        approver_persona = inferred["approver_persona"]
        supplier_article = self._article_for_term(supplier_label)
        summary_article = self._article_for_summary(summary_label)
        entity_prep = self._prep_article_for_entity(entity_article)
        stories = [
            self._compose_story_block(
                1,
                f"Como {owner_persona}, eu quero criar {entity_article} {entity_label} informando nome, objetivo, data e contexto inicial, para iniciar o fluxo principal de forma estruturada.",
                f"Descricao: permite registrar o {entity_label} com os dados essenciais para abrir a operacao e evitar um inicio solto ou incompleto.",
            ),
            self._compose_story_block(
                2,
                f"Como {owner_persona}, eu quero definir o escopo basico {entity_prep} {entity_label} com volume estimado, formato e parametros principais, para dimensionar os recursos iniciais corretamente.",
                f"Descricao: deixa claro o tamanho do trabalho e os parametros de partida, ajudando a organizar a primeira versao do fluxo.",
            ),
            self._compose_story_block(
                3,
                f"Como {finance_persona}, eu quero registrar {baseline_article} {baseline_label} {entity_prep} {entity_label}, para ter uma referencia operacional antes da aprovacao.",
                f"Descricao: cria a base para validar planejamento, custos ou dados operacionais antes de liberar a execucao.",
            ),
            self._compose_story_block(
                4,
                f"Como {support_persona}, eu quero cadastrar {supplier_article} {supplier_label} com nome, contato e tipo de suporte, para vincular os recursos essenciais {entity_prep} {entity_label}.",
                f"Descricao: garante que os recursos centrais fiquem identificados e prontos para uso na operacao inicial.",
            ),
            self._compose_story_block(
                5,
                f"Como {support_persona}, eu quero cadastrar a lista inicial de {participant_label}s {entity_prep} {entity_label}, para preparar a operacao sem depender de planilhas.",
                f"Descricao: organiza a entrada de participantes ou envolvidos no processo e evita controles paralelos fora do sistema.",
            ),
            self._compose_story_block(
                6,
                f"Como {approver_persona}, eu quero aprovar ou reprovar {baseline_article} {baseline_label} {entity_prep} {entity_label} com justificativa, para liberar a execucao com controle minimo.",
                f"Descricao: registra a decisao de governanca e a justificativa, mantendo rastreabilidade da liberacao.",
            ),
            self._compose_story_block(
                7,
                f"Como {owner_persona}, eu quero visualizar {summary_article} {summary_label}, com escopo, base operacional e status atual, para confirmar se o planejamento inicial esta completo.",
                f"Descricao: consolida a leitura executiva da primeira versao e permite conferir se faltou algum detalhe importante.",
            ),
            self._compose_story_block(
                8,
                f"Como {support_persona}, eu quero atualizar o status {entity_prep} {entity_label} entre rascunho, em planejamento, em aprovacao e aprovado, para acompanhar o andamento operacional do trabalho.",
                f"Descricao: permite acompanhar a evolucao do trabalho sem perder o contexto do estado atual.",
            ),
        ]
        return stories

    def _generate_deterministic_support_stories(self, base_context):
        inferred = self._infer_core_pack_terms(base_context)
        entity_label = inferred["entity_label"]
        entity_article = inferred["entity_article"]
        entity_prep = self._prep_article_for_entity(entity_article)
        participant_label = inferred["participant_label"]
        owner_persona = inferred["owner_persona"]
        finance_persona = inferred["finance_persona"]
        support_persona = inferred["support_persona"]
        approver_persona = inferred["approver_persona"]

        return [
            self._compose_story_block(
                9,
                f"Como {owner_persona}, eu quero listar {entity_article} {entity_label}s em uma visao consolidada, para acompanhar o volume de trabalho sem perder contexto.",
                f"Descricao: oferece uma leitura rapida dos registros de {entity_label} e ajuda a priorizar a operacao do dia.",
            ),
            self._compose_story_block(
                10,
                f"Como {support_persona}, eu quero consultar os detalhes de cada {entity_label}, para revisar informacoes antes de executar a proxima etapa.",
                f"Descricao: facilita a conferencia dos dados ja informados e reduz erros durante a continuidade do fluxo.",
            ),
            self._compose_story_block(
                11,
                f"Como {support_persona}, eu quero atualizar as informacoes principais {entity_prep} {entity_label}, para manter o cadastro coerente com a operacao real.",
                f"Descricao: permite corrigir dados que mudaram ao longo do processo sem recriar o registro.",
            ),
            self._compose_story_block(
                12,
                f"Como {approver_persona}, eu quero revisar os itens pendentes {entity_prep} {entity_label}, para decidir com mais clareza antes de liberar a execucao.",
                f"Descricao: concentra os pontos que aguardam validacao e reduz retrabalho na governanca.",
            ),
            self._compose_story_block(
                13,
                f"Como {owner_persona}, eu quero acompanhar o historico de mudancas {entity_prep} {entity_label}, para entender quem alterou o que e quando.",
                f"Descricao: reforca rastreabilidade e ajuda na analise de inconsistencias do fluxo.",
            ),
            self._compose_story_block(
                14,
                f"Como {support_persona}, eu quero pesquisar {entity_article} {entity_label}s por termo ou referencia, para localizar registros sem depender de planilhas paralelas.",
                f"Descricao: agiliza a recuperacao de informacoes e melhora a operacao diaria da equipe.",
            ),
            self._compose_story_block(
                15,
                f"Como {finance_persona}, eu quero registrar observacoes de acompanhamento {entity_prep} {entity_label}, para apoiar a leitura operacional e a tomada de decisao.",
                f"Descricao: organiza notas de contexto que ajudam a explicar prioridades, riscos ou pendencias.",
            ),
            self._compose_story_block(
                16,
                f"Como {owner_persona}, eu quero encerrar o fluxo {entity_prep} {entity_label} quando tudo estiver concluido, para manter o backlog limpo e rastreavel.",
                f"Descricao: indica que a etapa terminou e evita que o registro fique aberto sem necessidade.",
            ),
        ]

    def _build_deterministic_backlog(self, idea):
        compact_briefing = self._compact_briefing(idea)
        inferred = self._infer_core_pack_terms(compact_briefing)
        entity_label = inferred["entity_label"]
        summary_label = inferred["summary_label"]

        overview = (
            f"Backlog inicial estruturado para organizar o produto em torno de {entity_label}, "
            f"com foco na primeira versao operacional e na rastreabilidade entre briefing, execucao e governanca."
        )
        capabilities = [
            f"Definir a base operacional de {entity_label}.",
            f"Registrar e consultar informacoes essenciais do fluxo.",
            f"Acompanhar status, pendencias e validacoes do trabalho.",
            f"Consolidar leitura de {summary_label} para decisao rapida.",
            "Manter governanca e rastreabilidade das mudancas principais.",
        ]
        epics = [
            "Epic 1: Fundacao operacional do produto.",
            "Epic 2: Operacao principal e acompanhamento do fluxo.",
            "Epic 3: Gestao e visibilidade do trabalho.",
            "Epic 4: Governanca, validacao e rastreabilidade.",
        ]
        release_slices = [
            "MVP: foco na espinha dorsal do produto, priorizando cadastro inicial, consulta basica e governanca minima.",
            "Fase 2: foco em ampliar operacao e visibilidade com apoio de filtros, acompanhamento e edicao controlada.",
            "Fase 3: foco em evolucao, auditoriabilidade e refinamento da experiencia sem perder estabilidade.",
        ]

        story_blocks = [
            *self._generate_fixed_core_pack_stories(compact_briefing),
            *self._generate_deterministic_support_stories(compact_briefing),
        ][: self.STORY_RANGE[1]]

        if len(story_blocks) < self.STORY_RANGE[0]:
            return None

        backlog = self._build_full_backlog_with_structure(
            overview=overview,
            capabilities=capabilities,
            epics=epics,
            release_slices=release_slices,
            story_blocks=story_blocks,
        )
        is_complete, _ = validate_backlog_output(backlog)
        return backlog if is_complete else None

    def _ensure_core_pack_frontload(self, base_context, story_blocks, *, min_stories, max_stories):
        consolidated = self._dedupe_and_polish_stories(story_blocks, base_context)
        consolidated = self._prioritize_story_blocks(consolidated)

        fixed_core_pack = self._generate_fixed_core_pack_stories(base_context)
        if fixed_core_pack and len(fixed_core_pack) >= 6:
            head_blocks = self._dedupe_and_polish_stories(fixed_core_pack, base_context)[:8]
            tail_candidates = []
            core_keys = {self._story_similarity_key(block) for block in head_blocks}
            for block in consolidated:
                key = self._story_similarity_key(block)
                if not key or key in core_keys:
                    continue
                tail_candidates.append(block)
            tail_non_advanced = [block for block in tail_candidates if not self._is_advanced_story(block)]
            tail_advanced = [block for block in tail_candidates if self._is_advanced_story(block)]
            consolidated = self._dedupe_and_polish_stories(head_blocks + tail_non_advanced + tail_advanced, base_context)
            consolidated = self._ensure_minimum_story_count(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            # Preserve the deterministic head even after count repair.
            remaining = []
            head_keys = {self._story_similarity_key(block) for block in head_blocks}
            for block in consolidated:
                key = self._story_similarity_key(block)
                if key in head_keys:
                    continue
                remaining.append(block)
            remaining = sorted(
                remaining,
                key=lambda block: (
                    self._is_advanced_story(block),
                    self._story_stage_rank(block),
                    -self._story_priority_score(block),
                    self._story_seed_title(block),
                ),
            )
            consolidated = (head_blocks + remaining)[:max_stories]
            return consolidated[:max_stories]
        else:
            coverage = self._core_pack_coverage(consolidated)
            missing_requirements = [item for item in self.CORE_PACK_REQUIREMENTS if item[0] not in coverage]
            if missing_requirements:
                core_pack_blocks = self._generate_core_pack_stories(base_context, consolidated, missing_requirements)
                if core_pack_blocks:
                    consolidated = self._dedupe_and_polish_stories(core_pack_blocks + consolidated, base_context)
                    consolidated = self._prioritize_story_blocks(consolidated)

        front = [block for block in consolidated if not self._is_advanced_story(block)]
        tail = [block for block in consolidated if self._is_advanced_story(block)]
        consolidated = (front + tail)[:max_stories]
        consolidated = self._sequence_story_blocks_for_mvp(consolidated, window=min(8, len(consolidated)))
        consolidated = self._ensure_minimum_story_count(
            base_context,
            consolidated,
            min_stories=min_stories,
            max_stories=max_stories,
        )
        return consolidated[:max_stories]

    def _rebalance_story_batch_for_mvp(self, base_context, story_blocks, *, min_stories, max_stories):
        consolidated = self._dedupe_and_polish_stories(story_blocks, base_context)
        consolidated = self._prioritize_story_blocks(consolidated)

        frontload_coverage = self._frontload_foundation_coverage(consolidated)
        if len(frontload_coverage) < 5:
            frontload_blocks = self._generate_mvp_frontload_stories(base_context, consolidated)
            if frontload_blocks:
                consolidated = self._dedupe_and_polish_stories(frontload_blocks + consolidated, base_context)
                consolidated = self._prioritize_story_blocks(consolidated)

        # If the top of the backlog is still too advanced, push advanced items down.
        front = [block for block in consolidated if not self._is_advanced_story(block)]
        tail = [block for block in consolidated if self._is_advanced_story(block)]
        consolidated = (front + tail)[:max_stories]
        consolidated = self._ensure_core_pack_frontload(
            base_context,
            consolidated,
            min_stories=min_stories,
            max_stories=max_stories,
        )
        consolidated = self._ensure_minimum_story_count(
            base_context,
            consolidated,
            min_stories=min_stories,
            max_stories=max_stories,
        )
        return consolidated[:max_stories]

    def _generate_simple_bullet_section(self, base_context, *, section_title, task_label, rules, num_predict):
        prompt = f"""
{base_context}

TAREFA
Gere APENAS esta secao em Markdown:

## {section_title}

REGRAS
{rules}
"""
        result = self._generate_block(prompt, num_predict=num_predict)
        section = self._extract_section(result, section_title)
        if not section:
            raise RuntimeError(f"Secao {section_title} vazia.")
        if section_title.strip().lower() == "fatias de release":
            bullets = self._extract_release_slices(section)
        else:
            bullets = self._extract_bullet_lines(section)
        if not bullets:
            raise RuntimeError(f"Secao {section_title} sem itens.")
        return bullets

    def _repair_backlog_output(self, base_context, full_backlog, overview, story_blocks, reason, *, min_stories, max_stories):
        repaired_overview = (overview or "").strip()
        extracted_overview = self._extract_section(full_backlog, "Visao Geral")
        extracted_capabilities = self._extract_bullet_lines(self._extract_section(full_backlog, "Capacidades do Produto"))
        extracted_epics = self._extract_bullet_lines(self._extract_section(full_backlog, "Epicos Recomendados"))
        extracted_releases = self._extract_release_slices(self._extract_section(full_backlog, "Fatias de Release"))
        if not repaired_overview and extracted_overview:
            repaired_overview = extracted_overview.strip()

        consolidated_blocks = self._dedupe_and_polish_stories(
            list(story_blocks) + self._extract_story_lines(self._extract_section(full_backlog, "Historias de Usuario"))
        , base_context)

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

        capabilities = extracted_capabilities
        if len(capabilities) < 3:
            capabilities = self._generate_simple_bullet_section(
                base_context,
                section_title="Capacidades do Produto",
                task_label="capacidades",
                rules="- Liste entre 4 e 6 capacidades do produto.\n- Foque em capacidades de negocio e operacao.\n- Nao escreva user stories.\n- Cada item deve ser um bullet curto.",
                num_predict=os.getenv("PROJECT_MANAGER_BLOCK_CAPABILITIES_NUM_PREDICT", "320"),
            )

        epics = extracted_epics
        if len(epics) < 3:
            epics = self._generate_simple_bullet_section(
                base_context,
                section_title="Epicos Recomendados",
                task_label="epicos",
                rules="- Liste entre 4 e 6 epicos recomendados.\n- Cada item deve agrupar um conjunto coerente de historias.\n- Nomeie o epic e descreva o foco em uma linha.\n- Nao escreva user stories.",
                num_predict=os.getenv("PROJECT_MANAGER_BLOCK_EPICS_NUM_PREDICT", "360"),
            )

        release_slices = extracted_releases
        if len(release_slices) < 2:
            release_slices = self._generate_simple_bullet_section(
                base_context,
                section_title="Fatias de Release",
                task_label="releases",
                rules="- Liste 3 fatias de release: MVP, Fase 2 e Fase 3.\n- Em cada item, diga o foco da fatia e o que fica de fora.\n- Nao escreva user stories completas.",
                num_predict=os.getenv("PROJECT_MANAGER_BLOCK_RELEASES_NUM_PREDICT", "320"),
            )

        if len(consolidated_blocks) < min_stories or "trunc" in (reason or "").lower():
            consolidated_blocks = self._ensure_minimum_story_count(
                base_context,
                consolidated_blocks,
                min_stories=min_stories,
                max_stories=max_stories,
            )

        consolidated_blocks = self._ensure_foundation_story_coverage(
            base_context,
            consolidated_blocks,
            min_stories=min_stories,
            max_stories=max_stories,
        )
        consolidated_blocks = self._rebalance_story_batch_for_mvp(
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
                consolidated_blocks = self._dedupe_and_polish_stories(consolidated_blocks + fallback_blocks, base_context)

        if len(consolidated_blocks) >= min_stories:
            curated_section = self._curate_story_batch(
                base_context,
                consolidated_blocks,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            consolidated_blocks = self._dedupe_and_polish_stories(self._extract_story_lines(curated_section), base_context)

        consolidated_blocks = self._ensure_minimum_story_count(
            base_context,
            consolidated_blocks,
            min_stories=min_stories,
            max_stories=max_stories,
        )[:max_stories]
        consolidated_blocks = self._ensure_foundation_story_coverage(
            base_context,
            consolidated_blocks,
            min_stories=min_stories,
            max_stories=max_stories,
        )[:max_stories]
        consolidated_blocks = self._rebalance_story_batch_for_mvp(
            base_context,
            consolidated_blocks,
            min_stories=min_stories,
            max_stories=max_stories,
        )[:max_stories]

        self._validate_story_batch_quality(consolidated_blocks, min_stories=min_stories)
        return self._build_full_backlog_with_structure(
            overview=repaired_overview,
            capabilities=capabilities,
            epics=epics,
            release_slices=release_slices,
            story_blocks=consolidated_blocks,
        )

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
- Remova historias tecnicas ou internas demais, como modelagem de entidade, numero sequencial, tabela, API ou schema.
- Padronize personas em torno de: colaborador, atendente, gestor e administrador.
- Nao deixe historias truncadas.
- Nao deixe nenhuma historia terminar com frase cortada ou titulo generico.
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Garanta que as primeiras 8 historias representem o MVP e cubram majoritariamente criacao, configuracao, consulta, aprovacao e acompanhamento do fluxo principal.
- Empurre para o fim ou remova historias de integracoes, exportacoes, analytics avancado, IA, ESG, marketplace, webhooks e automacoes sofisticadas quando ainda faltarem historias basicas.
- Nao introduza financeiro, orcamento ou custos quando o briefing nao citar essa dimensao explicitamente.
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
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
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

    def _generate_foundation_stories(self, base_context, existing_story_blocks, missing_signals):
        if not missing_signals:
            return []

        existing_titles = [
            self._story_seed_title(block)
            for block in existing_story_blocks
            if block and self._story_seed_title(block)
        ]
        existing_titles_text = "\n".join(f"- {title}" for title in existing_titles[:30]) or "- Nenhuma historia consolidada ainda."
        focus_text = "\n".join(
            f"- {signal['label']}: {signal['instruction']}" for signal in missing_signals
        )

        prompt = f"""
{base_context}

HISTORIAS JA CONSOLIDADAS
{existing_titles_text}

EIXOS FUNDADORES QUE AINDA FALTAM
{focus_text}

TAREFA
Gere APENAS a secao abaixo em Markdown:

## Historias de Usuario

REGRAS
- Gere entre {len(missing_signals)} e {len(missing_signals) + 2} historias.
- Cubra SOMENTE os eixos fundadores que ainda faltam.
- Nao repita nem reformule historias ja consolidadas.
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Nao invente escopo fora do briefing.
"""
        result = self._generate_block(
            prompt,
            num_predict=os.getenv("PROJECT_MANAGER_BLOCK_FOUNDATION_NUM_PREDICT", "800"),
        )
        foundation_section = self._extract_section(result, "Historias de Usuario")
        if not foundation_section:
            return []
        return self._extract_story_lines(foundation_section)

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
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
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
- Cada historia deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
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
- Para cada historia, entregue um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
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

            updated = self._dedupe_and_polish_stories(consolidated + complement_blocks, base_context)
            if len(updated) <= len(consolidated):
                break

            consolidated = updated[:max_stories]

        return consolidated[:max_stories]

    def _ensure_foundation_story_coverage(self, base_context, story_blocks, *, min_stories, max_stories):
        consolidated = list(story_blocks)

        for _round in range(3):
            missing_signals = self._get_missing_foundation_signals(consolidated)
            if len(self.FOUNDATION_SIGNAL_PROMPTS) - len(missing_signals) >= 4:
                break

            complement_blocks = self._generate_foundation_stories(
                base_context,
                consolidated,
                missing_signals,
            )
            if not complement_blocks:
                break

            updated = self._dedupe_and_polish_stories(consolidated + complement_blocks, base_context)
            if len(updated) <= len(consolidated):
                break

            consolidated = updated[:max_stories]
            consolidated = self._ensure_minimum_story_count(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )

        return consolidated[:max_stories]

    def _collect_story_blocks_incrementally(self, base_context, *, min_stories, max_stories):
        themes = [
            (
                "Fluxo fundador do produto",
                "Cubra cadastro inicial, criacao da entidade principal, planejamento basico, consulta inicial e confirmacao do fluxo principal.",
                (4, 6),
            ),
            (
                "Operacao e acompanhamento",
                "Cubra acompanhamento operacional, atualizacao de status, execucao do trabalho, alertas, fila e excecoes principais do dia a dia.",
                (4, 6),
            ),
            (
                "Gestao e colaboracao",
                "Cubra visao gerencial, colaboracao entre papeis, configuracao operacional, relatorios principais e tomada de decisao.",
                (3, 5),
            ),
            (
                "Governanca e evolucao",
                "Cubra permissoes, auditoria, automacoes, integracoes, relatorios avancados e cenarios de administracao do produto.",
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
                consolidated = self._dedupe_and_polish_stories(consolidated + batch, base_context)
            if len(consolidated) >= min_stories:
                break

        consolidated = self._ensure_minimum_story_count(
            base_context,
            consolidated,
            min_stories=min_stories,
            max_stories=max_stories,
        )
        consolidated = self._ensure_foundation_story_coverage(
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
                    consolidated = self._dedupe_and_polish_stories(consolidated + expanded, base_context)

            consolidated = self._ensure_minimum_story_count(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            consolidated = self._ensure_foundation_story_coverage(
                base_context,
                consolidated,
                min_stories=min_stories,
                max_stories=max_stories,
            )
            consolidated = self._rebalance_story_batch_for_mvp(
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
                        consolidated = self._dedupe_and_polish_stories(consolidated + expanded, base_context)

                consolidated = self._ensure_minimum_story_count(
                    base_context,
                    consolidated,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                consolidated = self._ensure_foundation_story_coverage(
                    base_context,
                    consolidated,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                consolidated = self._rebalance_story_batch_for_mvp(
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

        planning_context_base = f"""
Voce e um Project Manager Senior especializado em discovery e definicao de backlog.

PROJETO
ID: {self.project_id}

BRIEFING
{compact_briefing}

REGRAS GERAIS
- Responda em portugues.
- Pense primeiro na estrutura do backlog antes de escrever historias.
- Use linguagem de produto clara, especifica e executavel.
- Cubra fundacao, operacao, gestao e governanca.
"""

        story_generation_base = f"""
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
- Cada story deve vir em um bloco com titulo e descricao curta.
{self._story_block_format_rules()}
- Mantenha o backlog entre {min_stories} e {max_stories} historias.
"""

        for _attempt in range(1, retry_count + 1):
            try:
                overview, capabilities, epics, release_slices = self._generate_backlog_blueprint(planning_context_base)
                planning_context = self._build_planning_context(overview, capabilities, epics, release_slices)
                execution_context = f"{story_generation_base}\n\n{planning_context}".strip()

                combined_story_blocks = self._collect_story_blocks_incrementally(
                    execution_context,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

                if len(combined_story_blocks) >= min_stories:
                    curated_section = self._curate_story_batch(
                        execution_context,
                        combined_story_blocks,
                        min_stories=min_stories,
                        max_stories=max_stories,
                    )
                    combined_story_blocks = self._dedupe_and_polish_stories(
                        self._extract_story_lines(curated_section),
                        execution_context,
                    )

                combined_story_blocks = self._ensure_minimum_story_count(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._ensure_foundation_story_coverage(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._ensure_lane_story_coverage(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._rebalance_story_batch_for_mvp(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

                if len(combined_story_blocks) < min_stories:
                    fallback_blocks = self._generate_missing_stories_fallback(
                        execution_context,
                        combined_story_blocks,
                        needed_count=min_stories - len(combined_story_blocks),
                    )
                    if fallback_blocks:
                        combined_story_blocks = self._dedupe_and_polish_stories(
                            combined_story_blocks + fallback_blocks,
                            execution_context,
                        )

                combined_story_blocks = self._ensure_minimum_story_count(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._ensure_foundation_story_coverage(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._ensure_lane_story_coverage(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )
                combined_story_blocks = self._rebalance_story_batch_for_mvp(
                    execution_context,
                    combined_story_blocks,
                    min_stories=min_stories,
                    max_stories=max_stories,
                )

                combined_story_blocks = combined_story_blocks[:max_stories]
                self._validate_story_batch_quality(combined_story_blocks, min_stories=min_stories)
                full_backlog = self._build_full_backlog_with_structure(
                    overview=overview,
                    capabilities=capabilities,
                    epics=epics,
                    release_slices=release_slices,
                    story_blocks=combined_story_blocks,
                )

                story_count = self._extract_story_count(full_backlog)
                if story_count < min_stories:
                    raise RuntimeError(
                        f"Backlog consolidado com poucas historias ({story_count}). Minimo esperado: {min_stories}."
                    )

                is_complete, reason = validate_backlog_output(full_backlog)
                if is_complete:
                    return full_backlog

                repaired_backlog = self._repair_backlog_output(
                    execution_context,
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
        deterministic_backlog = self._build_deterministic_backlog(idea)
        if deterministic_backlog:
            return deterministic_backlog
        return self._generate_multi_block_backlog(idea)
