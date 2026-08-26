# -*- coding: utf-8 -*-
import json
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
from agents.backlog_challenger.agent import BacklogChallenger
from agents.backlog_judge.agent import BacklogJudge
from agents.requirement_engine.agent import RequirementEngineAgent


class BacklogGenerationError(RuntimeError):
    def __init__(self, message, rejected_draft=None):
        super().__init__(message)
        self.rejected_draft = rejected_draft


class ProjectManager:
    # A backlog is complete when it covers the confirmed journeys, not when it
    # reaches an arbitrary number.  The range only protects the initial
    # generation from being too shallow or unmanageably broad.
    STORY_RANGE = (8, 25)
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
        self._clarifications_answered = False
        self._requirements_contract = None

    def _story_block_format_rules(self):
        return """
- Cada story deve vir em um bloco de 2 linhas.
- A primeira linha deve ser a user story no formato "US-XX | Como ..., eu quero ..., para ...".
- A segunda linha deve ser uma descricao curta e util, com contexto, regra, excecao ou expectativa importante.
- A descricao nao deve repetir o titulo; ela deve acrescentar informacao nova para produto, arquitetura ou QA.
- Mantenha a descricao objetiva, com 1 ou 2 frases.
- A historia precisa apontar uma acao de produto real, nao uma frase abstrata sobre processo interno.
- Quando houver campo, estado, permissão ou excecao, mencione isso na descricao.
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
        elif re.search(r"\bcredito|emprestimo|financiamento|score|bureau\b", normalized):
            entity_label = "solicitacao de credito"
            entity_article = "a"
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
        elif entity_label == "solicitacao de credito":
            owner_persona = "Ana, cliente solicitante"
            finance_persona = "Carlos, analista de credito"
            support_persona = "Fernanda, analista de cadastro"
            approver_persona = "Roberto, gestor de credito"

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
- Gere entre 4 e 6 capacidades do produto, todas com verbo de acao, objeto e efeito de negocio claros.
- Gere entre 4 e 6 epicos recomendados, todos concretos e ligados a partes reais do produto.
- Gere exatamente 3 fatias de release: MVP, Fase 2 e Fase 3.
- O MVP deve cobrir a espinha dorsal do produto e mostrar o primeiro fluxo utilizavel.
- Cada fatia deve explicitar foco, o que entra agora e o que fica para depois.
- Em cada fatia, use pelo menos 1 item que deixe claro o diferimento de funcionalidade mais sofisticada.
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
        if inferred["entity_label"] == "solicitacao de credito":
            return self._generate_credit_core_pack_stories()

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

    def _generate_credit_core_pack_stories(self):
        """Return a domain-safe MVP backbone when the briefing is about credit."""
        return [
            self._compose_story_block(1,
                "Como Ana, cliente solicitante, eu quero simular valor, prazo e parcela do credito, para avaliar uma opcao antes de iniciar a proposta.",
                "Descricao: a simulacao deve informar que o resultado e uma estimativa e nao representa aprovacao automatica."),
            self._compose_story_block(2,
                "Como Ana, cliente solicitante, eu quero iniciar uma solicitacao de credito a partir da simulacao, para registrar a proposta com o valor e prazo escolhidos.",
                "Descricao: o sistema deve salvar a proposta como rascunho e permitir sua retomada antes do envio."),
            self._compose_story_block(3,
                "Como Ana, cliente solicitante, eu quero informar meus dados pessoais e de contato, para que a instituicao identifique corretamente quem solicita o credito.",
                "Descricao: os campos obrigatorios e as validacoes devem ser apresentados de forma clara antes do envio."),
            self._compose_story_block(4,
                "Como Ana, cliente solicitante, eu quero informar renda, vinculo e demais dados financeiros solicitados, para que minha capacidade de pagamento possa ser analisada.",
                "Descricao: a proposta nao pode seguir para analise enquanto os dados obrigatorios estiverem incompletos."),
            self._compose_story_block(5,
                "Como Ana, cliente solicitante, eu quero enviar os documentos obrigatorios da proposta, para comprovar as informacoes declaradas.",
                "Descricao: o sistema deve indicar tipos de documento aceitos, pendencias e o resultado basico da validacao do envio."),
            self._compose_story_block(6,
                "Como Ana, cliente solicitante, eu quero registrar meu consentimento para o tratamento de dados e consultas necessarias, para enviar a proposta em conformidade com a LGPD.",
                "Descricao: o consentimento deve ser explicito, versionado e associado a proposta enviada."),
            self._compose_story_block(7,
                "Como Fernanda, analista de cadastro, eu quero validar dados e documentos recebidos, para encaminhar somente propostas completas para analise de credito.",
                "Descricao: quando houver divergencia ou ausencia, a proposta deve ficar com status de pendencia e motivo compreensivel para o cliente."),
            self._compose_story_block(8,
                "Como Carlos, analista de credito, eu quero consultar a proposta com dados, documentos e resultado das validacoes, para avaliar a elegibilidade conforme as politicas de credito.",
                "Descricao: a analise deve registrar as informacoes utilizadas e preservar a rastreabilidade da decisao."),
        ]

    def _generate_deterministic_support_stories(self, base_context):
        inferred = self._infer_core_pack_terms(base_context)
        if inferred["entity_label"] == "solicitacao de credito":
            return self._generate_credit_support_stories()

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

    def _generate_credit_support_stories(self):
        return [
            self._compose_story_block(9,
                "Como Carlos, analista de credito, eu quero registrar uma decisao de aprovar, reprovar ou solicitar complementos, para concluir a analise com uma justificativa rastreavel.",
                "Descricao: a decisao deve respeitar os estados permitidos da proposta e registrar data, responsavel e motivo."),
            self._compose_story_block(10,
                "Como Ana, cliente solicitante, eu quero acompanhar o status da minha proposta, para saber se ela esta em rascunho, enviada, em analise, com pendencia, aprovada ou reprovada.",
                "Descricao: o status deve explicar a proxima acao esperada sem expor informacoes internas de risco."),
            self._compose_story_block(11,
                "Como Ana, cliente solicitante, eu quero receber e atender uma solicitacao de complemento, para corrigir pendencias sem criar uma nova proposta.",
                "Descricao: a pendencia deve informar quais dados ou documentos precisam de ajuste e permitir novo envio."),
            self._compose_story_block(12,
                "Como Ana, cliente solicitante, eu quero visualizar a decisao da minha proposta de forma clara, para entender o resultado e os proximos passos aplicaveis.",
                "Descricao: a comunicacao deve evitar promessas de aprovacao antes da decisao registrada pelo analista."),
            self._compose_story_block(13,
                "Como Roberto, gestor de credito, eu quero consultar uma fila de propostas por status e prioridade, para distribuir a analise e acompanhar os prazos operacionais.",
                "Descricao: a fila deve destacar propostas com pendencias ou que aguardam analise por mais tempo."),
            self._compose_story_block(14,
                "Como Roberto, gestor de credito, eu quero revisar o historico de alteracoes e decisoes de cada proposta, para auditar o processo de concessao.",
                "Descricao: o historico deve identificar a acao, o responsavel e o momento em que ocorreu."),
            self._compose_story_block(15,
                "Como Fernanda, analista de cadastro, eu quero registrar o resultado de verificacoes de identidade e fraude, para sinalizar propostas que exigem revisao adicional.",
                "Descricao: a sinalizacao nao deve decidir automaticamente a proposta e precisa ficar visivel ao analista responsavel."),
            self._compose_story_block(16,
                "Como Roberto, gestor de credito, eu quero configurar limites e politicas de elegibilidade aplicaveis ao produto, para que a analise siga regras operacionais vigentes.",
                "Descricao: alteracoes de politica devem manter historico e ser aplicadas apenas a novas analises ou conforme regra definida."),
        ]

    def _build_deterministic_backlog(self, idea):
        compact_briefing = self._compact_briefing(idea)
        inferred = self._infer_core_pack_terms(compact_briefing)
        entity_label = inferred["entity_label"]
        summary_label = inferred["summary_label"]

        if entity_label == "solicitacao de credito":
            overview = (
                "Backlog inicial para uma jornada digital de solicitacao de credito, da simulacao e envio da proposta "
                "ate a analise, decisao e acompanhamento pelo cliente, com controles de seguranca e rastreabilidade."
            )
            capabilities = [
                "Simular condicoes de credito e iniciar propostas digitais.",
                "Coletar dados, documentos e consentimentos obrigatorios.",
                "Validar pendencias e encaminhar propostas para analise de credito.",
                "Decidir propostas e comunicar status de forma clara ao cliente.",
                "Manter controles de fraude, politicas e auditoria da operacao.",
            ]
            epics = [
                "Epic 1: Simulacao, cadastro e envio da proposta de credito.",
                "Epic 2: Documentos, consentimento e validacao cadastral.",
                "Epic 3: Analise de credito, pendencias e decisao da proposta.",
                "Epic 4: Acompanhamento do cliente, governanca e prevencao a fraude.",
            ]
            release_slices = [
                "MVP: foco na espinha dorsal do fluxo principal, com simulacao, proposta, documentos, analise manual e decisao; integracoes externas ficam para depois.",
                "Fase 2: foco em ampliar a operacao com fila, notificacoes, regras configuraveis e verificacoes adicionais; automacao avancada fica para fase seguinte.",
                "Fase 3: foco em evolucao com integracoes a bureaus, monitoramento de fraude e refinamento de politicas; somente apos a estabilizacao do MVP.",
            ]
        else:
            overview = (
                f"Backlog inicial estruturado para organizar o produto em torno de {entity_label}, "
                f"com foco na primeira versao operacional e na rastreabilidade entre briefing, execucao e governanca."
            )
            capabilities = [
                f"Definir a base operacional de {entity_label}.",
                "Registrar e consultar informacoes essenciais do fluxo.",
                "Acompanhar status, pendencias e validacoes do trabalho.",
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

    def _extract_json_object(self, response):
        """Extract the most likely backlog object without requiring perfect framing.

        JSON mode is a provider hint, not a guarantee.  Free and routed models
        commonly wrap valid JSON in prose or a code fence; selecting a decoded
        object is safe because semantic validation remains mandatory afterwards.
        """
        text = str(response or "").lstrip("\ufeff").strip()
        decoder = json.JSONDecoder()
        candidates = []

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                candidates.append(parsed)
        except json.JSONDecodeError:
            pass

        # raw_decode understands a complete JSON object followed by arbitrary
        # prose, unlike the old first-{ / last-} approach.
        for index, char in enumerate(text):
            if char != "{":
                continue
            try:
                parsed, _ = decoder.raw_decode(text[index:])
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                candidates.append(parsed)

        expanded = []
        envelope_keys = ("backlog_contract", "contract", "data", "result", "output")
        for candidate in candidates:
            expanded.append(candidate)
            for key in envelope_keys:
                nested = candidate.get(key)
                if isinstance(nested, dict):
                    expanded.append(nested)
                elif isinstance(nested, str):
                    try:
                        decoded_nested = json.loads(nested)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(decoded_nested, dict):
                        expanded.append(decoded_nested)

        if not expanded:
            raise ValueError(f"A IA deve responder um objeto JSON valido (resposta com {len(text)} caracteres).")

        backlog_keys = {"overview", "capabilities", "epics", "releases", "stories", "coverage"}
        return max(expanded, key=lambda item: len(backlog_keys.intersection(item.keys())))

    def _build_evidence_contract(self, idea):
        # Project DNA guides product coherence and UI choices; it is not proof
        # that a business capability, policy or workflow was requested.
        business_briefing = re.split(r"(?:^|\n)\s*Project DNA\s*:", str(idea or ""), maxsplit=1, flags=re.IGNORECASE)[0]
        facts = []
        for index, line in enumerate(re.split(r"[\n.;]+", business_briefing)):
            text = re.sub(r"\s+", " ", line).strip(" -")
            # Section labels are context delimiters, never business evidence.
            if len(text) >= 12 and not re.fullmatch(r"(?:respostas[- ]?chave|briefing|contexto)\s*:?", text, re.IGNORECASE):
                facts.append({"id": f"briefing.{index + 1}", "text": text, "type": "briefing"})
        return {"facts": facts[:30]}

    def _analyze_requirements_contract(self, idea):
        """Build the pre-backlog contract; it never turns a gap into a fact."""
        evidence = self._build_evidence_contract(idea)
        analysis_status = "completed"
        try:
            report = RequirementEngineAgent().process({"stage": "requirements_analysis", "idea": idea})
        except ValueError as error:
            # The preflight is advisory input to a stricter downstream gate.
            # A fallback provider can return prose despite JSON mode; do not
            # convert that transport-format failure into an HTTP 500.
            if "json" not in str(error).lower():
                raise
            analysis_status = "degraded"
            report = {"findings": []}
            print(json.dumps({
                "event": "project_manager_requirements_analysis_degraded",
                "reason": str(error),
            }, ensure_ascii=False), file=sys.stderr)
        raw_findings = report.get("findings", []) if isinstance(report, dict) else []
        findings, assumptions, questions = [], [], []
        valid_categories = {"missing_information", "ambiguity", "assumption", "contradiction"}
        for index, item in enumerate(raw_findings, start=1):
            if not isinstance(item, dict):
                continue
            category = str(item.get("category") or "").strip().lower()
            severity = str(item.get("severity") or "medium").strip().lower()
            message = str(item.get("message") or "").strip()
            if category not in valid_categories or severity not in {"low", "medium", "high"} or not message:
                continue
            finding = {
                "id": f"RF-{index:02d}", "category": category, "severity": severity,
                "message": message, "evidence": str(item.get("evidence") or "").strip(),
                "recommendation": str(item.get("recommendation") or "").strip(),
                "clarification_question": str(item.get("clarification_question") or "").strip(),
                "answer_hint": str(item.get("answer_hint") or "").strip(),
            }
            findings.append(finding)
            if category == "assumption":
                assumptions.append({"id": f"ASM-{len(assumptions) + 1:02d}", "text": message, "source": "requirements_analyzer"})
            if category in {"missing_information", "ambiguity", "contradiction"} and severity in {"medium", "high"}:
                question_text = finding["clarification_question"] or finding["recommendation"]
                if not question_text.endswith("?"):
                    question_text = f"Qual decisao de produto deve ser tomada sobre: {message.rstrip('.')}?"
                questions.append({
                    "id": f"CQ-{len(questions) + 1:02d}",
                    "question": question_text,
                    "reason": message,
                    "answer_hint": finding["answer_hint"] or "Informe a decisao e, se aplicavel, a regra, limite ou criterio que deve ser usado.",
                    "blocking": severity == "high", "finding_id": finding["id"],
                })
        if self._clarifications_answered:
            for question in questions:
                question["resolved_by"] = "user_briefing"
            blocking_questions = []
        else:
            blocking_questions = [question for question in questions if question["blocking"]]
        return {
            "version": 1, "evidence": evidence,
            "requirements": [
                {"id": fact["id"].replace("briefing.", "REQ-"), "text": fact["text"], "source_ids": [fact["id"]]}
                for fact in evidence["facts"]
            ],
            "assumptions": assumptions, "questions": questions,
            "blocking_questions": blocking_questions, "findings": findings,
            "analysis_status": analysis_status,
            "decision": "BLOCK" if blocking_questions else "READY",
        }

    @staticmethod
    def _semantic_terms(value):
        normalized = unicodedata.normalize("NFKD", str(value or ""))
        normalized = "".join(char for char in normalized if not unicodedata.combining(char)).lower()
        ignored = {
            "como", "eu", "quero", "para", "uma", "um", "uns", "umas", "de", "da", "do", "das", "dos",
            "e", "ou", "a", "o", "as", "os", "na", "no", "nas", "nos", "em", "com", "por", "sem",
            "que", "sua", "seu", "suas", "seus", "ao", "aos", "cliente", "analista", "gestor", "operacao",
            "sistema", "plataforma", "forma", "sobre", "antes", "depois", "mais", "menos", "para",
        }
        return {
            token[:6]
            for token in re.findall(r"[a-z0-9]{3,}", normalized)
            if token not in ignored
        }

    def _has_direct_business_evidence(self, story, evidence_by_id):
        source_text = " ".join(evidence_by_id[source_id] for source_id in story.get("source_ids", []) if source_id in evidence_by_id)
        story_text = " ".join([str(story.get("goal") or ""), str(story.get("description") or "")])
        return len(self._semantic_terms(source_text) & self._semantic_terms(story_text)) >= 2

    @staticmethod
    def _unsupported_sensitive_details(story, evidence_by_id):
        source_text = " ".join(evidence_by_id[source_id] for source_id in story.get("source_ids", []) if source_id in evidence_by_id)
        normalized_source = unicodedata.normalize("NFKD", source_text).encode("ascii", "ignore").decode("ascii").lower()
        normalized_story = unicodedata.normalize(
            "NFKD", " ".join([str(story.get("goal") or ""), str(story.get("description") or "")])
        ).encode("ascii", "ignore").decode("ascii").lower()
        # These details materially change a product's policy, regulatory
        # treatment, automation or service commitment.  The same concept must
        # be present in the selected business evidence before it is confirmed.
        sensitive_details = {
            "automacao": r"\bautomat",
            "configuracao_de_politica": r"\b(parametr|configur).{0,35}\b(regra|politic|criter|limite|marg)",
            "calculo_financeiro": r"\b(calcul|formula|cet|tarifa|taxa|parcela)\b",
            "limite_ou_prazo": r"\b(limite|margem|prazo|valor maximo)\b",
            "compromisso_de_tempo": r"\b(tempo real|sla)\b",
            "consentimento": r"\bconsent",
            "auditoria": r"\b(log|auditor)",
            "solucao_de_seguranca": r"\b(criptograf|controle de acesso|autentica|autorizacao)\b",
            "retencao_ou_exclusao": r"\b(expurg|exclus|anonimiz|retenc|cancelamento)\b",
            "integracao_externa": r"\b(integra|bureau|score|provedor)\b",
        }
        return [
            label for label, pattern in sensitive_details.items()
            if re.search(pattern, normalized_story) and not re.search(pattern, normalized_source)
        ]

    @staticmethod
    def _is_high_impact_statement(value):
        return bool(re.search(
            r"\b(calcul|pre[cç]o|tarifa|taxa|limite|prazo|elegibil|aprova|autoriza|permiss|dados pessoais|reten[cç]|auditori|integra[cç]|sla|notifica[cç])\b",
            str(value or ""), re.IGNORECASE,
        ))

    @staticmethod
    def _append_unique(items, value):
        value = str(value or "").strip()
        if value and value not in items:
            items.append(value)

    @staticmethod
    def _story_priority_for_lane(lane):
        return {
            "foundation": "high",
            "operation": "high",
            "visibility": "medium",
            "governance": "medium",
        }.get(str(lane or "").strip().lower(), "medium")

    @staticmethod
    def _story_release_for_lane(lane):
        return {
            "foundation": "MVP",
            "operation": "Fase 2",
            "visibility": "Fase 2",
            "governance": "Fase 3",
        }.get(str(lane or "").strip().lower(), "Fase 2")

    @staticmethod
    def _compound_story_actions(goal):
        normalized = unicodedata.normalize("NFKD", str(goal or "")).encode("ascii", "ignore").decode("ascii").lower()
        actions = re.findall(
            r"\b(simular|iniciar|preencher|enviar|validar|registrar|revisar|aprovar|reprovar|solicitar|acompanhar|receber|gerenciar|assegurar|consultar|decidir|cancelar)\b",
            normalized,
        )
        return sorted(set(actions))

    def _canonicalize_decision_outcomes(self, story):
        """Keep alternative outcomes of one proposal decision as one action.

        Approve, reject and request-complement are outcomes of recording the
        analyst's decision; they are not three independently deliverable
        journeys. This normalization preserves the original wording in the
        description so the confirmed flow remains traceable.
        """
        goal = str(story.get("goal") or "")
        normalized = unicodedata.normalize("NFKD", goal).encode("ascii", "ignore").decode("ascii").lower()
        actions = set(self._compound_story_actions(goal))
        decision_actions = {"aprovar", "reprovar", "solicitar", "decidir"}
        proposal_context = bool(re.search(r"\b(proposta|solicitacao|analise)\b", normalized))
        if proposal_context and len(actions) > 1 and actions.issubset(decision_actions):
            description = str(story.get("description") or "").strip()
            story["goal"] = "registrar a decisao da proposta"
            outcome_note = f"Resultados possiveis da decisao: {goal}."
            if outcome_note not in description:
                story["description"] = " ".join(part for part in (description, outcome_note) if part)
        return story

    def _normalize_release_dependencies(self, stories):
        """Move a dependent story to its prerequisite's release when needed."""
        by_id = {str(story.get("id") or "").upper(): story for story in stories if isinstance(story, dict)}
        for story in stories:
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            for dependency in context.get("dependencies", []) if isinstance(context.get("dependencies"), list) else []:
                prerequisite = by_id.get(str(dependency).upper())
                if prerequisite and self._release_rank(story.get("release")) < self._release_rank(prerequisite.get("release")):
                    story["release"] = prerequisite.get("release")
        return stories

    def _apply_story_quality_guardrails(self, story, tags, questions, refinement_context):
        """Expose missing product decisions without manufacturing their answer.

        These guardrails do not generate a replacement story.  They preserve
        the AI proposal and make its unresolved, high-impact parts explicit
        for the requirements analyst and product review.
        """
        goal = str(story.get("goal") or "")
        description = str(story.get("description") or "")
        actor = str(story.get("actor") or "")
        text = f"{goal} {description}"
        normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
        actor_normalized = unicodedata.normalize("NFKD", actor).encode("ascii", "ignore").decode("ascii").lower()

        actions = self._compound_story_actions(goal)
        if len(actions) > 1:
            self._append_unique(tags, "REVIEW_SCOPE")
            self._append_unique(
                questions,
                "Separar as acoes independentes desta historia ou confirmar que devem ser entregues e aceitas como uma unica capacidade.",
            )

        # Qualificadores subjetivos não são critérios de aceite. Preserve a
        # proposta, mas force o produto a convertê-los em sinais observáveis.
        subjective_terms = re.findall(r"\b(simples|f[aá]cil|rápido|rapido|intuitivo|eficiente|seguro)\b", normalized, re.IGNORECASE)
        if subjective_terms:
            self._append_unique(tags, "REVIEW_TESTABILITY")
            self._append_unique(
                questions,
                "Quais indicadores observaveis definem '" + subjective_terms[0] + "' nesta historia (passos, validacoes, tempo ou resultado esperado)?",
            )

        automatic_actions = {"validar", "registrar"}
        goal_actions = set(self._compound_story_actions(goal))
        system_executes_goal = bool(re.search(
            r"\bsistema\b.{0,80}\b(valid(?:a|am|ou|ara|aria|ar)|registra(?:r|do)|registrou)\b",
            normalized,
        ))
        if (
            re.search(r"\b(operador|analista|gestor)\b", actor_normalized)
            and system_executes_goal
            and goal_actions.intersection(automatic_actions)
        ):
            self._append_unique(tags, "REVIEW_ROLE")
            self._append_unique(
                questions,
                "Confirmar o ator responsavel: a historia descreve um comportamento automatico do sistema, mas o ator informado e humano.",
            )

        if re.search(r"\b(acompanhar a operacao geral|assegurar a conformidade|garantir a conformidade)\b", normalized):
            self._append_unique(tags, "REVIEW_SCOPE")
            self._append_unique(
                questions,
                "Quais indicadores, decisoes ou controles concretos esta historia deve suportar?",
            )

        credit_domain = bool(re.search(r"\b(credit\w*|emprestimo\w*|financiamento\w*|score\w*|bureau\w*)", normalized))
        if credit_domain and re.search(r"\bsimul", normalized):
            self._append_unique(tags, "REVIEW_HIGH_IMPACT")
            for question in (
                "Qual politica ou taxa de precificacao deve ser aplicada na simulacao?",
                "Qual metodo de calculo deve ser utilizado e qual e a regra de arredondamento?",
                "Qual e a relacao entre prazo e numero de parcelas?",
                "Quais limites de valor e prazo se aplicam a simulacao?",
            ):
                self._append_unique(questions, question)

        if re.search(r"\bdocumentos? obrigator", normalized):
            self._append_unique(tags, "REVIEW_SCOPE")
            self._append_unique(
                questions,
                "Quais documentos sao obrigatorios e quais formatos, validacoes e criterios de aceite se aplicam?",
            )

        if re.search(r"\b(elegibilidade|limites|politicas? de credito)\b", normalized):
            self._append_unique(tags, "REVIEW_HIGH_IMPACT")
            self._append_unique(
                questions,
                "Quais regras de elegibilidade, limites e politicas sao aplicaveis e qual e sua fonte de configuracao?",
            )

        if re.search(r"\b(bureau\w*|score\w*|integrac\w*)", normalized):
            self._append_unique(tags, "REVIEW_HIGH_IMPACT")
            self._append_unique(
                questions,
                "A integracao com bureau, score ou sistema externo faz parte desta entrega? Se sim, qual servico e qual comportamento esperado?",
            )

        context_questions = refinement_context.setdefault("open_questions", [])
        for question in questions:
            self._append_unique(context_questions, question)
        return refinement_context

    @staticmethod
    def _release_rank(release):
        return {"mvp": 1, "fase 2": 2, "fase 3": 3}.get(str(release or "").strip().lower(), 99)

    def _lint_backlog_contract(self, contract, evidence_by_id):
        """Return repairable findings; never fabricate a replacement story."""
        findings = []
        stories_by_id = {str(story.get("id") or "").upper(): story for story in contract.get("stories", [])}
        for story in contract.get("stories", []):
            story_id = str(story.get("id") or "").upper()
            tags = set(story.get("review_tags") or [])
            goal = str(story.get("goal") or "")
            description = str(story.get("description") or "")
            if len(self._compound_story_actions(goal)) > 1 or re.search(r"\b(acompanhar a operacao geral|assegurar a conformidade|garantir a conformidade)\b", f"{goal} {description}", re.IGNORECASE):
                findings.append({"story_id": story_id, "code": "needs_split_or_scope", "reason": "A historia contem escopo composto ou ainda nao observavel."})
            if "REVIEW_ROLE" in tags:
                findings.append({"story_id": story_id, "code": "role_conflict", "reason": "O ator declarado conflita com o comportamento automatico descrito."})
            actor_normalized = unicodedata.normalize("NFKD", str(story.get("actor") or "")).encode("ascii", "ignore").decode("ascii").lower()
            if re.fullmatch(r"(?:o )?sistema", actor_normalized.strip()):
                findings.append({"story_id": story_id, "code": "system_actor", "reason": "Sistema nao e uma persona de user story; mantenha a automacao como comportamento e use o ator de negocio beneficiado."})
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            selected_evidence = " ".join(evidence_by_id.get(source_id, "") for source_id in story.get("source_ids", []))
            for field in ("inputs", "outputs", "confirmed_rules", "dependencies"):
                for item in context.get(field, []) if isinstance(context.get(field), list) else []:
                    text = str(item)
                    if re.search(r"\b(bureau\w*|score\w*|integrac\w*)", unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()) and not re.search(r"\b(bureau\w*|score\w*|integrac\w*)", unicodedata.normalize("NFKD", selected_evidence).encode("ascii", "ignore").decode("ascii").lower()):
                        findings.append({"story_id": story_id, "code": "unconfirmed_context", "reason": f"{field} contem integracao ou dado externo sem evidencia direta: {text}."})
                        break
            for dependency in context.get("dependencies", []) if isinstance(context.get("dependencies"), list) else []:
                target = stories_by_id.get(str(dependency).upper())
                if target and self._release_rank(story.get("release")) < self._release_rank(target.get("release")):
                    findings.append({"story_id": story_id, "code": "release_dependency_conflict", "reason": f"Depende de {dependency} em release posterior."})
        return findings

    @staticmethod
    def _deduplicate_texts(items):
        """Deduplicate user-facing text while treating accents as equivalent."""
        unique, seen = [], set()
        for item in items if isinstance(items, list) else []:
            value = str(item or "").strip()
            normalized = unicodedata.normalize("NFKD", value)
            normalized = "".join(char for char in normalized if not unicodedata.combining(char)).lower()
            if value and normalized not in seen:
                seen.add(normalized)
                unique.append(value)
        return unique

    def _review_backlog_contract(self, contract, evidence_contract, evidence_by_id):
        """Combine static contract rules with the read-only challenger and judge."""
        findings = self._lint_backlog_contract(contract, evidence_by_id)
        challenger = BacklogChallenger().process(contract, evidence_contract)
        seen = {(item.get("story_id"), item.get("code")) for item in findings}
        for finding in challenger.get("findings", []):
            key = (finding.get("story_id"), finding.get("code"))
            if key not in seen:
                findings.append(finding)
                seen.add(key)
        return BacklogJudge().process(findings)

    def _collect_backlog_clarifications(self, contract):
        """Return product questions outside the user-story delivery contract."""
        questions_by_text = {}
        for story in contract.get("stories", []):
            if not isinstance(story, dict):
                continue
            story_id = str(story.get("id") or "").upper()
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            for question in [*(story.get("open_questions") or []), *(context.get("open_questions") or [])]:
                value = str(question or "").strip()
                normalized = unicodedata.normalize("NFKD", value)
                normalized = "".join(char for char in normalized if not unicodedata.combining(char)).lower()
                if value:
                    questions_by_text.setdefault(normalized, {"question": value, "story_ids": []})["story_ids"].append(story_id)
        return [
            {"id": f"CQ-{index:02d}", "question": item["question"], "story_ids": sorted(set(item["story_ids"]))}
            for index, item in enumerate(questions_by_text.values(), start=1)
        ][:8]

    def _build_story_repair_prompt(self, contract, evidence_contract, findings):
        affected_ids = sorted({item["story_id"] for item in findings if item.get("story_id")})
        affected = [story for story in contract.get("stories", []) if str(story.get("id") or "").upper() in affected_ids]
        role_conflict = any(item.get("code") == "role_conflict" for item in findings)
        # A single broken story may need to become multiple atomic stories.
        # Therefore the response envelope must always support a 1-to-N
        # replacement, including when only one story is currently affected.
        response_format = '{"replacements":[{"replace_ids":["US-01"],"stories":[{"id":"US-01","actor":"persona","goal":"acao unica verificavel","benefit":"efeito de negocio","description":"contexto","lane":"foundation|operation|visibility|governance","priority":"high|medium|low","release":"MVP|Fase 2|Fase 3","source_ids":["briefing.1"],"status":"confirmed|proposed|question","review_tags":[],"open_questions":[],"refinement_context":{"inputs":[],"outputs":[],"confirmed_rules":[],"constraints":[],"dependencies":[],"open_questions":[],"acceptance_hints":[],"acceptance_criteria":[{"id":"US-01-CA-01","given":"precondicao","when":"acao","then":"resultado","source_ids":["briefing.1"],"status":"confirmed|proposed"}]}}]}]}'
        return f"""
Voce e um Product Manager senior e deve reparar SOMENTE historias problemáticas de um contrato de backlog.
Nao invente regras, integracoes, limites, calculos ou politicas. Use apenas as evidencias.

EVIDENCIAS: {json.dumps(evidence_contract, ensure_ascii=False)}
ACHADOS: {json.dumps(findings, ensure_ascii=False)}
HISTORIAS A SUBSTITUIR: {json.dumps(affected, ensure_ascii=False)}

Para cada historia composta, gere historias atomicas separadas. Se "aprovar ou reprovar" forem apenas resultados da mesma acao, reescreva o goal como "registrar a decisao da proposta" e deixe os resultados como cenarios/descricao; nao mantenha os dois verbos no goal. Para conflito de ator ou ator "Sistema", use a persona de negocio beneficiada pela automacao e descreva o comportamento automatico na descricao/regras. Nesse caso, nao use "validar" ou "registrar" como goal de um ator humano quando a descricao disser que o sistema executa essa acao; o goal deve representar consulta, acompanhamento ou decisao efetivamente feita pela persona. Para dependencia de release, ajuste a release ou remova a dependencia nao confirmada. Dados de bureau/score/integracao sem evidencia devem sair de inputs e virar open_questions.
Se o achado indicar fluxo confirmado ausente, substitua a historia relacionada por historias atomicas que cubram tambem esse fluxo, sem inventar regras. Remova dependencias inexistentes. Elimine perguntas duplicadas, inclusive quando a diferenca for apenas de acentuacao.
Se uma integracao confirmada estiver sem planejamento, crie uma historia proposta para seu planejamento e deixe em open_questions o servico, os dados trocados, erros e criterio de aceite ainda nao confirmados; nao invente esses detalhes.
{"Este reparo trata conflito de ator: nao devolva REVIEW_ROLE em review_tags; deixe review_tags como [] e descreva apenas o apoio do sistema, nao o sistema executando a acao do ator." if role_conflict else ""}
Mantenha IDs unicos no formato US-XX. Cada historia deve ter todos os campos do contrato, incluindo priority, release, source_ids, status, review_tags, open_questions e refinement_context.
Responda SOMENTE JSON, exatamente neste formato: {response_format}
""".strip()

    def _apply_story_repairs(self, contract, repair, affected_story_ids=None):
        def story_lists(value):
            candidates = []
            if isinstance(value, dict):
                for key, child in value.items():
                    if isinstance(child, list) and child and all(isinstance(item, dict) for item in child):
                        if sum(bool((item.get("goal") or item.get("title")) and item.get("actor")) for item in child) >= max(1, len(child) // 2):
                            candidates.append(child)
                    candidates.extend(story_lists(child))
            elif isinstance(value, list):
                for child in value:
                    candidates.extend(story_lists(child))
            return candidates

        def story_objects(value):
            candidates = []
            if isinstance(value, dict):
                if value.get("actor") and (value.get("goal") or value.get("title")):
                    candidates.append(value)
                for child in value.values():
                    candidates.extend(story_objects(child))
            elif isinstance(value, list):
                for child in value:
                    candidates.extend(story_objects(child))
            return candidates

        def replacement_groups(value):
            groups = []
            if isinstance(value, dict):
                if isinstance(value.get("replace_ids"), list) and isinstance(value.get("stories"), list):
                    groups.append(value)
                for child in value.values():
                    groups.extend(replacement_groups(child))
            elif isinstance(value, list):
                for child in value:
                    groups.extend(replacement_groups(child))
            return groups

        scoped_ids = {str(story_id).upper() for story_id in (affected_story_ids or []) if str(story_id).strip()}
        used_scoped_partial = False
        replacements = repair.get("replacements") if isinstance(repair, dict) else None
        if not isinstance(replacements, list):
            # Models commonly wrap the prescribed envelope in `result`,
            # `data` or a singular `replacement` key. Preserve the explicit
            # replace_ids whenever it exists instead of guessing from IDs.
            nested_groups = replacement_groups(repair)
            if nested_groups:
                replacements = nested_groups
        if isinstance(replacements, list):
            replacement_by_id = {}
            for replacement in replacements:
                if not isinstance(replacement, dict):
                    continue
                ids = {str(value).upper() for value in replacement.get("replace_ids", [])}
                stories = replacement.get("stories") if isinstance(replacement.get("stories"), list) else []
                if scoped_ids:
                    ids &= scoped_ids
                if ids and stories:
                    replacement_by_id.update({story_id: stories for story_id in ids})
            if not replacement_by_id:
                raise ValueError("Reparo da IA sem substituicoes utilizaveis.")
            repaired = []
            for story in contract.get("stories", []):
                story_id = str(story.get("id") or "").upper()
                if story_id in replacement_by_id:
                    repaired.extend(replacement_by_id[story_id])
                else:
                    repaired.append(story)
        else:
            # Several providers ignore the narrow repair envelope and return a
            # complete corrected contract. Accept it only when it is genuinely
            # a full replacement, then run the same semantic validation below.
            candidates = sorted(story_lists(repair), key=len, reverse=True)
            repaired = candidates[0] if candidates else None
            if not repaired:
                # Some models emit {"replacement": {"id": "US-04", ...}}
                # instead of wrapping the repaired story in an array.
                repaired = story_objects(repair)
            if isinstance(repaired, list) and len(repaired) < len(contract.get("stories", [])):
                # A partial response is safe only when each returned story
                # identifies an original story to replace; a single scoped
                # repair may also safely split that one story into 1-to-N.
                if len(scoped_ids) == 1:
                    target_id = next(iter(scoped_ids))
                    repaired = [
                        replacement_story
                        for story in contract.get("stories", [])
                        for replacement_story in (repaired if str(story.get("id") or "").upper() == target_id else [story])
                    ]
                    used_scoped_partial = True
                else:
                    existing = {str(story.get("id") or "").upper(): story for story in contract.get("stories", [])}
                    returned_ids = {str(story.get("id") or "").upper() for story in repaired}
                    if returned_ids and returned_ids.issubset(existing) and all(returned_ids):
                        existing.update({str(story.get("id") or "").upper(): story for story in repaired})
                        repaired = list(existing.values())
            if not isinstance(repaired, list) or len(repaired) < len(contract.get("stories", [])):
                raise ValueError("Reparo da IA sem replacements ou contrato completo de historias.")
        # Some providers ignore the narrow repair prompt and send the whole
        # contract.  Do not let unrelated returned stories undo a replacement
        # that has already been validated in an earlier repair pass.
        if scoped_ids and not isinstance(replacements, list) and not used_scoped_partial:
            replacement_by_id = {
                str(story.get("id") or "").upper(): story
                for story in repaired
                if str(story.get("id") or "").upper() in scoped_ids
            }
            if not replacement_by_id:
                raise ValueError("Reparo da IA nao incluiu a historia solicitada.")
            repaired = [
                replacement_by_id.get(str(story.get("id") or "").upper(), story)
                for story in contract.get("stories", [])
            ]
        aliases = {}
        for index, story in enumerate(repaired, start=1):
            if not str(story.get("goal") or "").strip() and str(story.get("title") or "").strip():
                match = re.match(
                    r"\s*como\s+(.+?),\s*eu\s+quero\s+(.+?)(?:,\s*para\s+(.+?))?\.?\s*$",
                    str(story["title"]),
                    re.IGNORECASE,
                )
                if match:
                    story["actor"] = story.get("actor") or match.group(1).strip()
                    story["goal"] = match.group(2).strip()
                    story["benefit"] = story.get("benefit") or (match.group(3) or "resultado de negocio").strip()
            old_id = str(story.get("id") or "").upper()
            new_id = f"US-{index:02d}"
            aliases.setdefault(old_id, new_id)
            story["id"] = new_id
        for story in repaired:
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            if isinstance(context.get("dependencies"), list):
                context["dependencies"] = [aliases.get(str(item).upper(), str(item)) for item in context["dependencies"]]
        valid_ids = {str(story.get("id") or "").upper() for story in repaired}
        for story in repaired:
            context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            if isinstance(context.get("dependencies"), list):
                own_id = str(story.get("id") or "").upper()
                context["dependencies"] = self._deduplicate_texts([
                    dependency for dependency in context["dependencies"]
                    if str(dependency).upper() in valid_ids and str(dependency).upper() != own_id
                ])
        contract["stories"] = repaired
        # The AI repair can split a story, invalidating positional coverage.
        # Rebuild it from the repaired source_ids during validation.
        contract["coverage"] = None
        return contract

    def _validate_backlog_contract(self, contract, evidence_contract=None):
        if not isinstance(contract, dict):
            raise ValueError("Contrato de backlog deve ser um objeto JSON.")
        required_text = ("overview",)
        required_lists = ("capabilities", "epics", "releases", "stories")
        for key in required_text:
            if not isinstance(contract.get(key), str) or not contract[key].strip():
                raise ValueError(f"Contrato sem {key}.")
        for key in required_lists:
            if not isinstance(contract.get(key), list) or not contract[key]:
                raise ValueError(f"Contrato sem lista {key}.")
        releases_by_name = {str(item.get("name") or "").strip().lower(): item for item in contract["releases"] if isinstance(item, dict)}
        for release_name in ("mvp", "fase 2", "fase 3"):
            release = releases_by_name.get(release_name)
            if not release or not str(release.get("focus") or "").strip() or not str(release.get("deferred") or "").strip():
                raise ValueError(f"Contrato sem foco ou diferimento para {release_name.upper()}.")
        stories = contract["stories"]
        min_stories, max_stories = self.STORY_RANGE
        if not min_stories <= len(stories) <= max_stories:
            raise ValueError(f"Contrato possui {len(stories)} historias; esperado entre {min_stories} e {max_stories}.")
        seen_ids = set()
        evidence_by_id = {
            str(fact.get("id")): str(fact.get("text") or "")
            for fact in (evidence_contract or {}).get("facts", [])
            if isinstance(fact, dict) and fact.get("id")
        }
        evidence_ids = set(evidence_by_id)
        for story in stories:
            if not isinstance(story, dict):
                raise ValueError("Historia do contrato deve ser um objeto.")
            missing = [key for key in ("id", "actor", "goal", "benefit", "description", "lane") if not str(story.get(key) or "").strip()]
            if missing:
                raise ValueError(f"Historia sem campos obrigatorios: {', '.join(missing)}.")
            story_id = str(story["id"]).strip().upper()
            if not re.fullmatch(r"US-\d{2}", story_id) or story_id in seen_ids:
                raise ValueError("IDs de historia devem ser unicos no formato US-XX.")
            seen_ids.add(story_id)
            story = self._canonicalize_decision_outcomes(story)
            source_ids = [str(item).strip() for item in story.get("source_ids", []) if str(item).strip()]
            if any(source_id not in evidence_ids for source_id in source_ids):
                raise ValueError("Historia referencia evidencia inexistente.")
            status = str(story.get("status") or "").strip().lower()
            tags = [
                str(item).strip()
                for item in story.get("review_tags", [])
                if str(item).strip() and str(item).strip() != "REVIEW_ROLE"
            ]
            questions = self._deduplicate_texts(story.get("open_questions", []))
            if status not in {"confirmed", "proposed", "question"}:
                status = "confirmed" if source_ids else "proposed"
            if status == "confirmed" and not source_ids:
                status = "proposed"
                tags.append("REVIEW_EVIDENCE")
            direct_evidence = self._has_direct_business_evidence(story, evidence_by_id) if source_ids else False
            unsupported_details = self._unsupported_sensitive_details(story, evidence_by_id) if source_ids else []
            if status == "confirmed" and source_ids and not direct_evidence:
                status = "proposed"
                tags.append("REVIEW_EVIDENCE")
                if not questions:
                    questions.append("Confirmar qual evidencia de negocio sustenta o comportamento descrito, alem do ator ou contexto geral.")
            if unsupported_details:
                status = "proposed"
                tags.extend(["REVIEW_SCOPE", "REVIEW_HIGH_IMPACT"])
                if not questions:
                    questions.append("Confirmar o escopo e a politica aplicavel para: " + ", ".join(unsupported_details) + ".")
            if self._is_high_impact_statement(" ".join([story.get("goal", ""), story.get("description", "")])) and not source_ids:
                status = "proposed"
                tags.append("REVIEW_HIGH_IMPACT")
            refinement_context = story.get("refinement_context") if isinstance(story.get("refinement_context"), dict) else {}
            # Keep a stable hand-off shape even when the model has no evidence
            # for a field. Empty lists mean unknown, never an inferred rule.
            refinement_context = {
                "inputs": refinement_context.get("inputs") if isinstance(refinement_context.get("inputs"), list) else [],
                "outputs": refinement_context.get("outputs") if isinstance(refinement_context.get("outputs"), list) else [],
                "confirmed_rules": refinement_context.get("confirmed_rules") if isinstance(refinement_context.get("confirmed_rules"), list) else [],
                "constraints": refinement_context.get("constraints") if isinstance(refinement_context.get("constraints"), list) else [],
                "dependencies": refinement_context.get("dependencies") if isinstance(refinement_context.get("dependencies"), list) else [],
                "open_questions": refinement_context.get("open_questions") if isinstance(refinement_context.get("open_questions"), list) else [],
                "acceptance_hints": refinement_context.get("acceptance_hints") if isinstance(refinement_context.get("acceptance_hints"), list) else [],
                "acceptance_criteria": refinement_context.get("acceptance_criteria") if isinstance(refinement_context.get("acceptance_criteria"), list) else [],
            }
            if not refinement_context["acceptance_criteria"]:
                refinement_context["acceptance_criteria"] = [{
                    "id": f"{story_id}-CA-01",
                    "given": "os dados necessarios estao disponiveis",
                    "when": str(story.get("goal") or "a acao principal e executada"),
                    "then": str(story.get("benefit") or "o resultado esperado e apresentado"),
                    "source_ids": source_ids,
                    "status": "proposed" if not source_ids else "confirmed",
                }]
            refinement_context = self._apply_story_quality_guardrails(story, tags, questions, refinement_context)
            refinement_context["open_questions"] = self._deduplicate_texts(refinement_context.get("open_questions", []))
            source_text = " ".join(evidence_by_id.get(source_id, "") for source_id in source_ids)
            normalized_source = unicodedata.normalize("NFKD", source_text).encode("ascii", "ignore").decode("ascii").lower()
            traceability = {}
            for field in ("inputs", "outputs", "confirmed_rules", "constraints", "dependencies", "acceptance_hints"):
                values = refinement_context.get(field, [])
                retained = []
                traceability[field] = []
                for value in values if isinstance(values, list) else []:
                    value_text = str(value).strip()
                    normalized_value = unicodedata.normalize("NFKD", value_text).encode("ascii", "ignore").decode("ascii").lower()
                    external_detail = bool(re.search(r"\b(bureau\w*|score\w*|integrac\w*)", normalized_value))
                    if external_detail and not re.search(r"\b(bureau\w*|score\w*|integrac\w*)", normalized_source):
                        self._append_unique(questions, f"Confirmar evidencia e escopo para: {value_text}.")
                        self._append_unique(refinement_context["open_questions"], f"Confirmar evidencia e escopo para: {value_text}.")
                        self._append_unique(tags, "REVIEW_EVIDENCE")
                        continue
                    retained.append(value)
                    direct_terms = self._semantic_terms(value_text) & self._semantic_terms(source_text)
                    traceability[field].append({
                        "text": value_text,
                        "source_ids": source_ids,
                        "status": "confirmed" if len(direct_terms) >= 2 else ("derived" if source_ids else "proposed"),
                    })
                refinement_context[field] = retained
            criteria = []
            for index, criterion in enumerate(refinement_context.get("acceptance_criteria", []), start=1):
                if not isinstance(criterion, dict):
                    continue
                given = str(criterion.get("given") or "").strip()
                when = str(criterion.get("when") or "").strip()
                then = str(criterion.get("then") or "").strip()
                if not (given and when and then):
                    continue
                criteria.append({
                    "id": str(criterion.get("id") or f"{story_id}-CA-{index:02d}"),
                    "given": given,
                    "when": when,
                    "then": then,
                    "source_ids": [item for item in criterion.get("source_ids", source_ids) if item in evidence_ids],
                    "status": str(criterion.get("status") or ("confirmed" if source_ids else "proposed")),
                })
            refinement_context["acceptance_criteria"] = criteria
            refinement_context["traceability"] = traceability
            if self._clarifications_answered:
                # Clarifications belong to the dialogue, never to a story
                # delivered to the board. The answered briefing remains the
                # evidence source; this only removes the review residue.
                questions = []
                refinement_context["open_questions"] = []
                tags = [tag for tag in tags if not str(tag).startswith("REVIEW_")]
            if status != "confirmed" and not tags and not self._clarifications_answered:
                tags.append("REVIEW_SCOPE")
            story["source_ids"] = source_ids
            story["status"] = status
            story["review_tags"] = sorted(set(tags))
            story["open_questions"] = self._deduplicate_texts(questions)
            story["priority"] = str(story.get("priority") or self._story_priority_for_lane(story.get("lane"))).lower()
            if story["priority"] not in {"low", "medium", "high", "urgent"}:
                story["priority"] = self._story_priority_for_lane(story.get("lane"))
            story["release"] = str(story.get("release") or self._story_release_for_lane(story.get("lane"))).strip()
            story["refinement_context"] = refinement_context
        self._normalize_release_dependencies(stories)
        foundation_count = sum(1 for story in stories if str(story.get("lane") or "").strip().lower() == "foundation")
        if foundation_count < 2:
            raise ValueError("Contrato sem historias suficientes de fundacao para sustentar o MVP.")
        # Coverage is derived traceability, not a business decision. Rebuild it
        # from the validated source_ids so an AI repair cannot retain obsolete
        # story IDs after splitting or renumbering stories.
        coverage = []
        for source_id in sorted({source_id for story in stories for source_id in story["source_ids"]}):
            coverage.append({
                "source_id": source_id,
                "story_ids": [story["id"] for story in stories if source_id in story["source_ids"]],
            })
        contract["coverage"] = coverage
        return contract

    def _render_backlog_contract(self, contract):
        def bullets(items):
            return "\n".join(f"- {str(item).strip()}" for item in items if str(item).strip())

        release_lines = []
        for release in contract["releases"]:
            if isinstance(release, dict):
                name = str(release.get("name") or "").strip()
                focus = str(release.get("focus") or "").strip()
                deferred = str(release.get("deferred") or "").strip()
                if name and focus and deferred:
                    mvp_bridge = " Base do produto: historias iniciais do contrato." if name.lower() == "mvp" else ""
                    release_lines.append(f"- {name}: Foco: {focus}.{mvp_bridge} Depois: {deferred}.")
            elif str(release).strip():
                release_lines.append(f"- {str(release).strip()}")
        if len(release_lines) < 3:
            raise ValueError("Contrato deve conter tres fatias de release utilizaveis.")

        story_lines = []
        for story in contract["stories"]:
            actor = re.sub(r"^como\s+", "", str(story["actor"]).strip(), flags=re.IGNORECASE)
            goal = re.sub(r"^eu quero\s+", "", str(story["goal"]).strip(), flags=re.IGNORECASE).rstrip(".")
            benefit = re.sub(r"^para\s+", "", str(story["benefit"]).strip(), flags=re.IGNORECASE).rstrip(".")
            story_lines.extend([
                f"- {str(story['id']).strip().upper()} | Como {actor}, eu quero {goal}, para {benefit}.",
                f"  Descricao: {str(story['description']).strip()}",
            ])
            review_tags = [str(tag).strip() for tag in story.get("review_tags", []) if str(tag).strip()]
            open_questions = [str(question).strip() for question in story.get("open_questions", []) if str(question).strip()]
            if review_tags:
                story_lines.append(f"  Revisao: [{', '.join(sorted(set(review_tags)))}]")
            for question in open_questions:
                story_lines.append(f"  Ponto a validar: {question}")
        markdown = "\n".join([
            "# Backlog do Projeto",
            "", "## Visao Geral", contract["overview"].strip(),
            "", "## Capacidades do Produto", bullets(contract["capabilities"]),
            "", "## Epicos Recomendados", bullets(contract["epics"]),
            "", "## Fatias de Release", "\n".join(release_lines),
            "", "## Historias de Usuario", "\n".join(story_lines),
        ])
        valid, reason = validate_backlog_output(markdown)
        if not valid:
            raise ValueError(reason or "Markdown renderizado invalido.")
        return markdown

    def _build_single_pass_backlog_prompt(self, idea, evidence_contract, repair_reason=None):
        briefing = self._compact_briefing(idea)
        repair_instruction = ""
        if repair_reason:
            repair_instruction = f"""
CORRECAO OBRIGATORIA DE FORMATO
A tentativa anterior foi rejeitada por: {repair_reason}
Comece a resposta diretamente com {{ e termine diretamente com }}. Nao use cercas ```json, texto introdutorio, explicacoes ou um segundo objeto JSON.
"""
        return f"""
Voce e um Product Manager senior. Gere um contrato JSON de backlog somente a partir do briefing fornecido.

BRIEFING DO PROJETO
{briefing}

EVIDENCIAS APROVADAS
{json.dumps(evidence_contract, ensure_ascii=False)}

REGRAS DE CONFIABILIDADE
- Responda em portugues e nao invente integracoes, limites, politicas, formulas ou regras que nao estejam sustentadas pelo briefing.
- Quando uma decisao nao estiver definida, registre a necessidade na descricao sem apresentá-la como fato.
- Gere somente a quantidade de historias necessaria para cobrir as jornadas e restricoes confirmadas: no minimo 8 e no maximo 25. Nao adicione historias para atingir uma quantidade-alvo e nao fragmente uma jornada sem ganho de negocio.
- Distribua as historias entre os lanes foundation, operation, visibility e governance quando forem aplicaveis ao briefing.
- Gere 4 a 6 capacidades concretas, com verbo, objeto e efeito de negocio; gere 4 a 6 epicos concretos.
- Gere exatamente as fatias MVP, Fase 2 e Fase 3; cada uma deve ter focus (o que entra) e deferred (o que fica para depois).
- Use pelo menos tres personas coerentes com o briefing e evite historias tecnicas internas.
- Cada historia deve ter um resultado de negocio observavel e independente. Separe etapas sequenciais quando puderem ser entregues, testadas ou revisadas separadamente; por exemplo, submeter uma solicitacao, o sistema validar/registrar e um analista decidir nao devem virar uma unica historia.
- Uma historia deve conter uma unica acao principal. Nao combine "simular e iniciar", nem "revisar, aprovar, reprovar ou solicitar complemento"; gere uma historia por capacidade ou registre REVIEW_SCOPE e uma pergunta objetiva quando a separacao depender de decisao de produto.
- Respeite a responsabilidade declarada no briefing: se a evidencia disser que o sistema valida ou registra, nao reescreva isso como uma acao executada pelo analista. Descreva o efeito para o ator ou mantenha o comportamento do sistema como regra da historia.
- Para credito, uma historia de simulacao nao pode inferir taxa, CET, juros, parcela, politica de precificacao, limites, prazo, arredondamento ou relacao entre prazo e parcelas. Quando algum desses dados nao constar nas evidencias, mantenha a capacidade e registre a lacuna em open_questions e refinement_context.open_questions com REVIEW_HIGH_IMPACT.
- Para documentos obrigatorios, politicas de credito, elegibilidade, limites, score, bureau ou integracoes, nao trate os detalhes como definidos se a evidencia nao os especificar: registre perguntas sobre escopo, fonte da regra e criterio de aceite.
- Historias de governanca ou visibilidade devem declarar a decisao observavel que habilitam; "acompanhar a operacao geral" ou "assegurar conformidade" sem indicador, controle ou decisao deve receber REVIEW_SCOPE e uma open_question.
- Declare priority (low, medium, high ou urgent) e release (MVP, Fase 2 ou Fase 3) por historia. Use prioridade alta para a fundacao do primeiro fluxo utilizavel e nao atribua a mesma prioridade a todo o backlog sem justificativa.
- Cada descricao deve acrescentar contexto, regra, excecao, estado ou efeito observavel, sem escolher tecnologia, criptografia, painel, fila, filtro, API ou mecanismo de automacao se isso nao foi informado.
- Cada historia deve declarar source_ids com IDs da lista de evidencias, status (confirmed, proposed ou question), review_tags e open_questions.
- Um source_id comprova somente o comportamento que ele menciona; ator, linguagem de dominio, familia de tela ou contexto geral nao comprovam fila, dashboard, configuracao, automacao, limite, calculo ou politica.
- Use confirmed somente quando o goal e a descricao estiverem diretamente sustentados pelas evidencias citadas. Ideias uteis sem evidencia devem ser proposed com REVIEW_SCOPE e uma open_question objetiva; decisoes de alto impacto sem evidencia tambem recebem REVIEW_HIGH_IMPACT.
- Declare coverage, relacionando cada evidencia efetivamente usada aos IDs das historias que a cobrem. Uma evidencia sem historia correspondente deve virar uma lacuna, nao uma historia inventada.

RESPONDA SOMENTE JSON VALIDO, sem markdown e sem comentarios, no formato:
{{
  "overview": "texto curto",
  "capabilities": ["capacidade"],
  "epics": ["epico"],
  "releases": [{{"name":"MVP","focus":"...","deferred":"..."}}, {{"name":"Fase 2","focus":"...","deferred":"..."}}, {{"name":"Fase 3","focus":"...","deferred":"..."}}],
  "stories": [{{"id":"US-01","actor":"persona","goal":"acao verificavel","benefit":"efeito de negocio","description":"contexto adicional","lane":"foundation","priority":"high","release":"MVP","source_ids":["briefing.1"],"status":"confirmed","review_tags":[],"open_questions":[],"refinement_context":{{"inputs":[],"outputs":[],"confirmed_rules":[],"constraints":[],"dependencies":[],"open_questions":[],"acceptance_hints":[],"acceptance_criteria":[{{"id":"US-01-CA-01","given":"precondicao","when":"acao","then":"resultado","source_ids":["briefing.1"],"status":"confirmed"}}]}}}}],
  "coverage": [{{"source_id":"briefing.1","story_ids":["US-01"]}}]
}}
{repair_instruction}
""".strip()

    def _build_missing_stories_prompt(self, contract, needed_count):
        existing_stories = contract.get("stories", [])
        existing_titles = [f"{story.get('id')}: {story.get('goal')}" for story in existing_stories]
        next_index = len(existing_stories) + 1
        return f"""
Complete um contrato de backlog. Preserve as historias existentes; gere SOMENTE {needed_count} historias novas.

Historias existentes:
{json.dumps(existing_titles, ensure_ascii=False)}

Sua resposta deve comecar exatamente por {{"stories":[ e terminar em ]}}. Nao inclua overview, releases, texto explicativo, markdown ou uma copia do contrato.
Responda SOMENTE JSON valido no formato {{"stories":[...]}}. Cada objeto exige id, actor, goal, benefit, description e lane.
Use IDs sequenciais de US-{next_index:02d} ate US-{next_index + needed_count - 1:02d}. Nao repita objetivo das historias existentes.
""".strip()

    def _build_release_repair_prompt(self, contract, reason):
        return f"""
Corrija SOMENTE as fatias de release deste contrato de backlog. Nao altere overview, capacidades, epicos ou historias.
Motivo da revisao: {reason}
Historias de fundacao disponiveis: {sum(1 for story in contract.get('stories', []) if str(story.get('lane') or '').lower() == 'foundation')}.
Responda SOMENTE JSON valido no formato:
{{"releases":[{{"name":"MVP","focus":"o primeiro fluxo utilizavel","deferred":"o que fica para depois"}},{{"name":"Fase 2","focus":"...","deferred":"..."}},{{"name":"Fase 3","focus":"...","deferred":"..."}}]}}
""".strip()

    def _build_overview_repair_prompt(self, contract, evidence_contract):
        return f"""
Corrija SOMENTE o campo overview do contrato de backlog abaixo.
O overview deve resumir o objetivo e a jornada confirmada do produto em uma ou duas frases.
Use exclusivamente as evidencias fornecidas. Nao invente funcionalidades, integracoes, politicas ou regras.

EVIDENCIAS:
{json.dumps(evidence_contract, ensure_ascii=False)}

CONTRATO PARCIAL:
{json.dumps(contract, ensure_ascii=False)}

Responda SOMENTE um objeto JSON valido exatamente neste formato:
{{"overview":"resumo objetivo baseado nas evidencias"}}
""".strip()

    def _generate_ai_backlog(self, idea):
        """Generate the complete backlog in one bounded AI call, with one focused repair at most."""
        max_attempts = max(1, min(2, int(os.getenv("PROJECT_MANAGER_BACKLOG_MAX_ATTEMPTS", "2"))))
        request_timeout = max(30, min(60, int(os.getenv("PROJECT_MANAGER_LLM_REQUEST_TIMEOUT_SECONDS", "45"))))
        rejected_draft = None
        last_reason = "sem detalhes"
        evidence_contract = self._build_evidence_contract(idea)

        for attempt in range(1, max_attempts + 1):
            prompt = self._build_single_pass_backlog_prompt(
                idea,
                evidence_contract,
                repair_reason=last_reason if attempt > 1 else None,
            )
            print(
                f"[Project Manager] etapa=backlog_completo tentativa={attempt}/{max_attempts} timeout={request_timeout}s",
                file=sys.stderr,
            )
            try:
                result = generate_text_from_llm(
                    prompt,
                    options_override={
                        "temperature": 0.1,
                        "num_predict": int(os.getenv("PROJECT_MANAGER_BACKLOG_NUM_PREDICT", "3400")),
                        "request_timeout_seconds": request_timeout,
                        "transient_retries": 0,
                        "json_mode": True,
                        # Reject tiny/non-JSON provider replies before the
                        # router marks them successful, so another model can
                        # be tried in the same AI-only generation attempt.
                        "min_response_chars": 256,
                        "require_json_object": True,
                    },
                    use_cache=False,
                    task="requirements_analysis",
                )
            except Exception as error:
                last_reason = f"Falha de provider na tentativa {attempt}: {error}"
                print(f"[Project Manager] {last_reason}", file=sys.stderr)
                continue

            rejected_draft = result
            try:
                contract = self._validate_backlog_contract(self._extract_json_object(result), evidence_contract)
                evidence_by_id = {str(fact.get("id")): str(fact.get("text") or "") for fact in evidence_contract.get("facts", []) if isinstance(fact, dict)}
                clarifications = self._collect_backlog_clarifications(contract)
                if clarifications and not self._clarifications_answered:
                    return {
                        "clarification_required": True,
                        "clarifications": clarifications,
                        "requirements_contract": self._requirements_contract,
                    }
                quality_review = self._review_backlog_contract(contract, evidence_contract, evidence_by_id)
                quality_history = [{"stage": "initial_review", **quality_review}]
                repair_attempts = 0
                if quality_review.get("advisories"):
                    print(json.dumps({
                        "event": "project_manager_backlog_advisories",
                        "count": len(quality_review["advisories"]),
                        "findings": quality_review["advisories"],
                    }, ensure_ascii=False), file=sys.stderr)
                if quality_review["decision"] != "PASS":
                    remaining = quality_review["findings"]
                    # A repair can surface a new finding for the same story
                    # or fail to correct the original one. Permit one focused
                    # retry for the same finding, while bounding the complete
                    # loop so a weak provider response cannot spin forever.
                    finding_attempts = {}
                    max_attempts_per_finding = 2
                    # Four rounds can repair only the first batches of a
                    # larger contract and leave the final newly-found story
                    # without its permitted retry. Five rounds cover that
                    # tail without turning recovery into an unbounded loop.
                    max_story_repairs = max(1, min(6, int(os.getenv("PROJECT_MANAGER_MAX_STORY_REPAIRS", "5"))))
                    for repair_attempt in range(1, max_story_repairs + 1):
                        repair_attempts = repair_attempt
                        eligible_findings = [
                            item for item in remaining
                            if item.get("story_id") and finding_attempts.get((item.get("story_id"), item.get("code")), 0) < max_attempts_per_finding
                        ]
                        if not eligible_findings:
                            break
                        # Repair the currently independent stories together.
                        # One serial call per story made a single backlog
                        # generation depend on several provider round-trips.
                        target_story_ids = list(dict.fromkeys(item["story_id"] for item in eligible_findings))[:4]
                        target_story_id_set = set(target_story_ids)
                        story_findings = [item for item in remaining if item.get("story_id") in target_story_id_set]
                        for item in story_findings:
                            key = (item.get("story_id"), item.get("code"))
                            finding_attempts[key] = finding_attempts.get(key, 0) + 1
                        print(json.dumps({"event": "project_manager_story_repair", "attempt": repair_attempt, "story_ids": target_story_ids, "findings": story_findings}, ensure_ascii=False), file=sys.stderr)
                        repair_result = generate_text_from_llm(
                            self._build_story_repair_prompt(contract, evidence_contract, story_findings),
                            options_override={"temperature": 0.1, "num_predict": 2600, "request_timeout_seconds": request_timeout, "transient_retries": 0, "json_mode": True, "min_response_chars": 100, "require_json_object": True},
                            use_cache=False,
                            task="requirements_analysis",
                        )
                        contract = self._apply_story_repairs(
                            contract,
                            self._extract_json_object(repair_result),
                            affected_story_ids=target_story_ids,
                        )
                        contract = self._validate_backlog_contract(contract, evidence_contract)
                        quality_review = self._review_backlog_contract(contract, evidence_contract, evidence_by_id)
                        quality_history.append({"stage": f"repair_{repair_attempt}_review", **quality_review})
                        remaining = quality_review["findings"]
                        if not remaining:
                            break
                    if remaining:
                        raise BacklogGenerationError(
                            "Reparo de historias nao concluiu os achados obrigatorios: " + "; ".join(
                                f"{item['story_id']}:{item['code']}" for item in remaining
                            ),
                            rejected_draft=rejected_draft,
                        )
                contract["quality_review"] = {
                    "decision": quality_review["decision"],
                    "repair_attempts": repair_attempts,
                    "history": quality_history,
                }
                return {
                    "markdown": self._render_backlog_contract(contract),
                    "backlog_contract": {
                        **contract,
                        "evidence": evidence_contract,
                        "requirements_contract": self._requirements_contract,
                    },
                }
            except (TypeError, ValueError, RuntimeError, json.JSONDecodeError) as error:
                last_reason = str(error)
                print(json.dumps({
                    "event": "project_manager_contract_parse_rejected",
                    "attempt": attempt,
                    "response_chars": len(str(result or "")),
                    "reason": last_reason,
                }, ensure_ascii=False), file=sys.stderr)
            print(
                f"[Project Manager] etapa=validacao tentativa={attempt}/{max_attempts} motivo={last_reason}",
                file=sys.stderr,
            )

            if attempt < max_attempts:
                try:
                    partial_contract = self._extract_json_object(result)
                    stories = partial_contract.get("stories") if isinstance(partial_contract, dict) else None
                    if isinstance(partial_contract, dict) and "contrato sem overview" in last_reason.lower():
                        print("[Project Manager] etapa=reparo_overview", file=sys.stderr)
                        overview = self._extract_json_object(generate_text_from_llm(
                            self._build_overview_repair_prompt(partial_contract, evidence_contract),
                            options_override={"temperature": 0.1, "num_predict": 350, "request_timeout_seconds": request_timeout, "transient_retries": 0, "json_mode": True, "min_response_chars": 20, "require_json_object": True},
                            use_cache=False,
                            task="requirements_analysis",
                        )).get("overview")
                        if not isinstance(overview, str) or not overview.strip():
                            raise ValueError("Reparo da IA sem overview valido.")
                        partial_contract["overview"] = overview.strip()
                        rejected_draft = json.dumps(partial_contract, ensure_ascii=False)
                        contract = self._validate_backlog_contract(partial_contract, evidence_contract)
                        return {"markdown": self._render_backlog_contract(contract), "backlog_contract": {**contract, "evidence": evidence_contract, "requirements_contract": self._requirements_contract}}
                    if isinstance(partial_contract, dict) and any(marker in last_reason.lower() for marker in ("release", "fatias", "mvp")):
                        print("[Project Manager] etapa=reparo_fatias_release", file=sys.stderr)
                        repaired_releases = self._extract_json_object(generate_text_from_llm(
                            self._build_release_repair_prompt(partial_contract, last_reason),
                            options_override={"temperature": 0.1, "num_predict": 700, "request_timeout_seconds": request_timeout, "transient_retries": 0, "json_mode": True},
                            use_cache=False,
                            task="requirements_analysis",
                        )).get("releases", [])
                        partial_contract["releases"] = repaired_releases
                        rejected_draft = json.dumps(partial_contract, ensure_ascii=False)
                        contract = self._validate_backlog_contract(partial_contract, evidence_contract)
                        return {"markdown": self._render_backlog_contract(contract), "backlog_contract": {**contract, "evidence": evidence_contract, "requirements_contract": self._requirements_contract}}
                    if isinstance(stories, list) and stories and len(stories) < self.STORY_RANGE[0]:
                        needed_count = self.STORY_RANGE[0] - len(stories)
                        print(f"[Project Manager] etapa=complemento_historias quantidade={needed_count}", file=sys.stderr)
                        completion = generate_text_from_llm(
                            self._build_missing_stories_prompt(partial_contract, needed_count),
                            options_override={"temperature": 0.1, "num_predict": 1200, "request_timeout_seconds": request_timeout, "transient_retries": 0, "json_mode": True},
                            use_cache=False,
                            task="requirements_analysis",
                        )
                        additions = self._extract_json_object(completion).get("stories", [])
                        partial_contract["stories"] = [*stories, *additions]
                        rejected_draft = json.dumps(partial_contract, ensure_ascii=False)
                        contract = self._validate_backlog_contract(partial_contract, evidence_contract)
                        return {"markdown": self._render_backlog_contract(contract), "backlog_contract": {**contract, "evidence": evidence_contract, "requirements_contract": self._requirements_contract}}
                except (TypeError, ValueError, json.JSONDecodeError, RuntimeError) as repair_error:
                    last_reason = f"Complemento de historias invalido: {repair_error}"
                    print(f"[Project Manager] {last_reason}", file=sys.stderr)
                # A malformed focused repair must not discard the remaining
                # full-contract attempt.  The next iteration is still AI-only
                # and has the complete briefing/evidence context.
                continue

        raise BacklogGenerationError(
            f"O agente project_manager nao conseguiu gerar um backlog valido apos {max_attempts} tentativas. "
            f"Ultimo motivo: {last_reason}",
            rejected_draft=rejected_draft,
        )

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
- Mantenha as historias de backlog ligadas a acoes observaveis de produto, nao a intencoes abstratas.
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
- Nao aceite historias genéricas como "visualizar dados" ou "gerenciar fluxo" sem objeto, contexto ou efeito observavel.
- Prefira historias com ator, acao, objeto e efeito de negocio claros.
- Se a ideia for ampla, transforme em backlog com cobrancas concretas e nao em frases conceituais.
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
- Cada story deve cobrir uma acao verificavel de negocio e nao apenas uma intencao abstrata.
- Cada story deve deixar claro o que o usuario faz, o que o sistema confirma e qual o efeito observavel.
- Distribua o backlog para que haja historias de fundacao, operacao, visibilidade e governanca.
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

    def _is_backlog_aligned_with_briefing(self, idea, backlog):
        """Reject structurally valid but domain-generic AI output before it is persisted."""
        _, briefing = self._normalize_text(idea)
        _, generated = self._normalize_text(backlog)
        is_credit_domain = bool(re.search(r"\b(credito|emprestimo|financiamento|score|bureau)\b", briefing))
        if not is_credit_domain:
            return True

        required_capabilities = {
            "simulacao": r"\bsimul",
            "proposta": r"\bpropost",
            "documentos": r"\bdocument",
            "analise": r"\banalis[ea].{0,30}\bcredit|\banalista de credito\b",
            "decisao": r"\b(aprovar|reprovar|decisao)\b",
            "acompanhamento": r"\b(status|acompanhar|andamento)\b",
        }
        missing = [
            capability
            for capability, pattern in required_capabilities.items()
            if not re.search(pattern, generated, re.IGNORECASE)
        ]
        if missing:
            raise RuntimeError(
                "Backlog gerado por IA nao cobriu capacidades obrigatorias do dominio de credito: "
                + ", ".join(missing)
            )
        return True

    def process(self, idea):
        # Stories are product decisions. Never replace an unavailable or invalid
        # AI result with deterministic content that can silently invent scope.
        normalized_idea = unicodedata.normalize("NFKD", str(idea or ""))
        normalized_idea = "".join(char for char in normalized_idea if not unicodedata.combining(char)).lower()
        self._clarifications_answered = "clarificacoes respondidas:" in normalized_idea
        self._requirements_contract = self._analyze_requirements_contract(idea)
        blocking_questions = self._requirements_contract.get("blocking_questions", [])
        if blocking_questions and not self._clarifications_answered:
            return {
                "clarification_required": True,
                "clarifications": [
                    {
                        "id": item["id"], "question": item["question"], "story_ids": [],
                        "reason": item.get("reason", ""), "answer_hint": item.get("answer_hint", ""),
                    }
                    for item in blocking_questions
                ],
                "requirements_contract": self._requirements_contract,
            }
        generated_backlog = self._generate_ai_backlog(idea)
        if isinstance(generated_backlog, dict) and generated_backlog.get("clarification_required"):
            return generated_backlog
        if isinstance(generated_backlog, str):
            generated_backlog = {"markdown": generated_backlog, "backlog_contract": {"evidence": {"facts": []}, "stories": []}}
        generated_backlog.setdefault("backlog_contract", {})["requirements_contract"] = self._requirements_contract
        self._is_backlog_aligned_with_briefing(idea, generated_backlog["markdown"])
        return generated_backlog
