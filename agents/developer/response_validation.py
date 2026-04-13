# -*- coding: utf-8 -*-
import os
import re
import unicodedata

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response


def _normalize_text(value):
    text = (value or "").strip()
    normalized = unicodedata.normalize("NFD", text.lower())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return text, normalized


def has_truncated_ending(value):
    text = (value or "").rstrip()
    if not text:
        return True

    if text.count("```") % 2 != 0:
        return True

    last_line = text.splitlines()[-1].strip()
    if not last_line:
        return True

    if re.fullmatch(r"-{3,}", last_line):
        return False

    if re.fullmatch(r"\|.*\|", last_line):
        return False

    if re.fullmatch(r"\*\*.+\*\*", last_line):
        return False

    if re.fullmatch(r"#+\s+.+", last_line):
        return False

    if re.search(r"[A-Za-zÀ-ÿ0-9.!?)]$", last_line):
        return False

    if re.search(r"[:|*_\-/(\[{,;]$", last_line):
        return True

    return False


def _extract_backlog_story_blocks(text):
    stories = []
    current = []

    for raw_line in (text or "").splitlines():
        line = raw_line.rstrip()
        if re.search(
            r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?Como\b",
            line,
            re.IGNORECASE,
        ):
            if current:
                stories.append("\n".join(current).strip())
            current = [line.strip()]
            continue
        if current:
            current.append(line.strip())

    if current:
        stories.append("\n".join(current).strip())

    return [story for story in stories if story]


def _backlog_story_has_complete_structure(story_block):
    lines = [line.strip() for line in (story_block or "").splitlines() if line.strip()]
    if len(lines) < 1:
      return False

    title_line = lines[0]
    if not re.search(r"^\s*Como\b.+\beu quero\b.+", title_line, re.IGNORECASE):
        return False

    if len(re.sub(r"\s+", " ", title_line).strip()) < 20:
        return False

    return True


def _backlog_story_has_description(story_block):
    lines = [line.strip() for line in (story_block or "").splitlines() if line.strip()]
    if len(lines) < 2:
        return False

    detail_text = " ".join(lines[1:]).strip()
    if len(detail_text.split()) < 6:
        return False

    if re.fullmatch(r"(?:descricao|contexto|detalhe)\s*[:\-]?\s*", detail_text, re.IGNORECASE):
        return False

    return True


def _story_similarity_key(title_line):
    normalized = re.sub(
        r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
        "",
        title_line or "",
        flags=re.IGNORECASE,
    ).strip().lower()
    normalized = unicodedata.normalize("NFD", normalized)
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = re.sub(r"\b(como|eu quero|para|um|uma|o|a|de|do|da|dos|das)\b", " ", normalized)
    normalized = re.sub(r"[^a-z0-9 ]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return " ".join(normalized.split()[:8])


def parse_bullets_from_section(section_text):
    bullet_items = [
        re.sub(r"^\s*(?:[-*]\s*|\d+[\.\)]\s*)", "", line).strip()
        for line in (section_text or "").splitlines()
        if re.match(r"^\s*(?:[-*]\s+|\d+[\.\)]\s+).+", line.strip())
    ]
    if len(bullet_items) >= 3:
        return bullet_items

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

    for raw_line in (section_text or "").splitlines():
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
    return slices


def validate_requirements_output(result):
    text, normalized = _normalize_text(result)
    required_sections = [
        "user story refinada",
        "requisitos funcionais",
        "fluxo principal",
        "fluxos alternativos",
        "fluxos de excecao",
        "regras de negocio",
        "estados da interface e feedback",
        "validacoes e dados",
        "permissoes e auditoria",
        "criterios de aceite",
    ]

    missing = [section for section in required_sections if section not in normalized]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    if not re.search(r"\bdado\b", normalized) or not re.search(r"\bquando\b", normalized) or not re.search(r"\bentao\b", normalized):
        return False, "Criterios de aceite sem estrutura BDD completa."

    rf_matches = re.findall(r"###\s*rf[-\s]?\d+", normalized, re.IGNORECASE)
    if len(rf_matches) < 1:
        return False, "Requisitos funcionais sem RFs estruturados."

    if re.search(r'\beu quero\s+(cadastrar|criar|registrar|aprovar|atualizar)\b', normalized):
        has_secondary_rf = len(rf_matches) > 1
        derived_expansion_terms = [
            "vincular",
            "associar",
            "painel",
            "dashboard",
            "consultar",
            "visualizar",
            "listar",
            "relatorio",
            "exportar",
        ]
        if has_secondary_rf and any(term in normalized for term in derived_expansion_terms):
            return False, "Escopo expandido com funcionalidade derivada."

    flow_section = re.search(r"##\s+fluxo principal([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    if not flow_section or len(re.findall(r"(?:^|\n)\s*\d+[\.\)]", flow_section.group(1))) < 3:
        return False, "Fluxo principal sem passos suficientes."

    rules_section = re.search(r"##\s+regras de negocio([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    if not rules_section or len(re.findall(r"(?:^|\n)\s*(?:\d+[\.\)]|[-*]\s+)", rules_section.group(1))) < 2:
        return False, "Regras de negocio insuficientes."

    interface_section = re.search(r"##\s+estados da interface e feedback([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    validations_section = re.search(r"##\s+validacoes e dados([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    permissions_section = re.search(r"##\s+permissoes e auditoria([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)

    def _section_has_content_or_na(section_match):
        if not section_match:
            return False
        body = section_match.group(1).strip()
        if not body:
            return False
        if re.search(r"nao se aplica", body, re.IGNORECASE):
            return True
        return len(re.findall(r"(?:^|\n)\s*(?:\d+[\.\)]|[-*]\s+)", body)) >= 1 or len(body.split()) >= 6

    if not _section_has_content_or_na(interface_section):
        return False, "Estados da interface e feedback sem detalhe suficiente."

    if not _section_has_content_or_na(validations_section):
        return False, "Validacoes e dados sem detalhe suficiente."

    validations_body = validations_section.group(1).strip() if validations_section else ""
    permissions_body = permissions_section.group(1).strip() if permissions_section else ""

    if validations_body and not re.search(
        r"(formato|obrigator|limite|valor controlado|consist|tipo|tamanho|regex|ponto a validar|nao se aplica)",
        validations_body,
        re.IGNORECASE,
    ):
        return False, "Validacoes e dados sem detalhes operacionais suficientes."

    if permissions_body and not re.search(
        r"(execut|aprova|visualiz|edit|audit|trilha|nao se aplica)",
        permissions_body,
        re.IGNORECASE,
    ):
        return False, "Permissoes e auditoria sem detalhes operacionais suficientes."

    if not _section_has_content_or_na(permissions_section):
        return False, "Permissoes e auditoria sem detalhe suficiente."

    if "fim_do_refinamento" not in normalized:
        return False, "Marcador final do refinamento nao foi encontrado."

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

    user_story_section = re.search(r"##\s+user story refinada([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    validations_section_body = validations_section.group(1) if validations_section else ""
    assumptions_section = re.search(r"##\s+premissas e pontos a validar([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    assumptions_body = assumptions_section.group(1) if assumptions_section else ""

    core_story_terms = [
        "cadastrar",
        "criar",
        "registrar",
        "responsavel operacional",
        "visitante",
        "visita",
        "autorizacao",
        "escopo",
        "contato",
        "tipo de suporte",
    ]
    has_core_story = any(term in normalized for term in core_story_terms)
    central_field_markers = [
        "contato",
        "tipo de suporte",
        "nome",
        "data",
        "objetivo",
        "visitante",
        "responsavel",
        "autorizacao",
    ]

    if has_core_story:
        unresolved_validations = [
            line.strip()
            for line in validations_section_body.splitlines()
            if "ponto a validar" in line.lower()
            and any(marker in line.lower() for marker in central_field_markers)
        ]
        unresolved_assumptions = [
            line.strip()
            for line in assumptions_body.splitlines()
            if any(marker in line.lower() for marker in central_field_markers)
        ]
        if unresolved_validations or unresolved_assumptions:
            return False, "Campos centrais da feature ainda estao como ponto a validar."

        normalized_validations = validations_section_body.lower()
        if "contato" in normalized and (
            re.search(r"contato[\s\S]{0,120}texto livre", normalized_validations)
            or re.search(r"contato[\s\S]{0,120}formato livre", normalized_validations)
            or (
                "contato" in normalized_validations
                and "telefone" not in normalized_validations
                and "e-mail" not in normalized_validations
                and "email" not in normalized_validations
            )
        ):
            return False, "Campo central de contato precisa de contrato mais fechado."

        if "tipo de suporte" in normalized and (
            re.search(r"tipo de suporte[\s\S]{0,120}texto livre", normalized_validations)
            or re.search(r"tipo de suporte[\s\S]{0,120}formato livre", normalized_validations)
            or (
                "tipo de suporte" in normalized_validations
                and "lista" not in normalized_validations
                and "predefinid" not in normalized_validations
                and "enum" not in normalized_validations
            )
        ):
            return False, "Campo central de tipo precisa de contrato mais fechado."

        if "visita" in normalized and (
            "formato do evento" in normalized
            or "evento corporativo" in normalized
            or re.search(r"\bevento\b", normalized)
        ):
            return False, "Bleed de dominio: historia de visita trouxe linguagem de evento."

        if "escopo" in normalized and (
            "status inicial" in normalized
            or 'status "escopo definido"' in normalized
            or "status escopo definido" in normalized
            or "pendente de aprovacao" in normalized
            or "numero sequencial" in normalized
            or "identificador unico sequencial" in normalized
            or "identificador unico" in normalized
                or "identificador gerado" in normalized
            or "uuid" in normalized
            or "guid" in normalized
            or "timestamp" in normalized
            or "protocolo" in normalized
        ):
            return False, "Story de escopo expandiu para workflow ou identificacao indevida."

        if "escopo" in normalized and (
            "duracao estimada" in normalized
            or "dura??o estimada" in normalized
            or "areas da empresa" in normalized
            or "?reas da empresa" in normalized
            or "acesso especial" in normalized
            or "estimativa de recursos" in normalized
            or "salvar como rascunho" in normalized
        ):
            return False, "Story de escopo expandiu para parametros nao pedidos pela task."

        if (
            ("eu quero criar" in normalized or "eu quero registrar" in normalized)
            and ("contexto inicial" in normalized or "dados iniciais" in normalized)
            and (
                "status inicial" in normalized
                or "aguardando aprovacao" in normalized
                or "aguardando aprova??o" in normalized
                or "status registrado" in normalized
                or "status pendente" in normalized
                or "pendente de analise" in normalized
                or "pendente de an?lise" in normalized
                or "numero sequencial" in normalized
                or "identificador unico" in normalized
                or "identificador gerado" in normalized
                or "timestamp de criacao" in normalized
                or "timestamp de cria??o" in normalized
                or "data/hora de criacao" in normalized
                or "data/hora de cria??o" in normalized
                or "protocolo" in normalized
            )
        ):
            return False, "Story de cadastro inicial antecipou workflow ou identificacao sem base explicita."

    return True, None


def validate_qa_output(result):
    text, normalized = _normalize_text(result)
    section_aliases = {
        "Estrategia de testes": [
            "estrategia de testes",
            "estrategia de teste",
            "estrategia",
        ],
        "Dados de teste": [
            "dados de teste",
            "dados testes",
        ],
        "Riscos e metricas": [
            "riscos e metricas",
            "riscos e sinais",
            "riscos e metricas operacionais",
            "riscos",
        ],
        "Qualidade nao funcional": [
            "qualidade nao funcional",
            "qualidade nao funcional e operacao",
            "qualidade nao funcional / operacao",
            "qualidade operacional",
            "nfr",
        ],
        "Rastreabilidade dos Criterios de Aceite": [
            "rastreabilidade dos criterios de aceite",
            "rastreabilidade de criterios de aceite",
            "rastreabilidade criterios de aceite",
            "rastreabilidade dos criterios aceite",
            "rastreabilidade de criterios aceite",
            "traceabilidade dos criterios de aceite",
        ],
        "Smoke Minimo da Feature": [
            "smoke minimo da feature",
            "smoke minimo",
            "smoke da feature",
            "smoke feature",
        ],
        "Cenarios de teste": [
            "cenarios de teste",
            "cenarios",
        ],
        "Casos de teste funcionais": [
            "casos de teste funcionais",
            "casos funcionais",
            "casos de teste",
        ],
        "Usabilidade e acessibilidade": [
            "usabilidade e acessibilidade",
            "usabilidade",
            "acessibilidade",
        ],
    }

    def _is_heading_line(line, aliases):
        stripped = line.strip()
        if not stripped:
            return None

        match = re.match(r"^#{1,6}\s+(.+?)\s*$", stripped)
        if not match:
            return None

        title = match.group(1).strip()
        for alias in aliases:
            if title == alias:
                return alias
            if title.startswith(f"{alias} "):
                return alias
            if title.startswith(f"{alias}:"):
                return alias
            if title.startswith(f"{alias} -"):
                return alias
            if title.startswith(f"{alias} /"):
                return alias
        return None

    def _parse_sections(source):
        sections = {}
        current_name = None
        current_lines = []

        for raw_line in source.splitlines():
            matched_name = None
            for canonical_name, aliases in section_aliases.items():
                if _is_heading_line(raw_line, aliases):
                    matched_name = canonical_name
                    break

            if matched_name:
                if current_name and current_name not in sections:
                    sections[current_name] = "\n".join(current_lines).strip()
                current_name = matched_name
                current_lines = []
                continue

            if current_name:
                current_lines.append(raw_line)

        if current_name and current_name not in sections:
            sections[current_name] = "\n".join(current_lines).strip()

        for canonical_name, aliases in section_aliases.items():
            if canonical_name in sections:
                continue
            for alias in aliases:
                heading_pattern = re.compile(rf"^#+\s+{re.escape(alias)}(?:\s*[:\-/].*)?$", re.IGNORECASE | re.MULTILINE)
                if heading_pattern.search(source):
                    sections[canonical_name] = ""
                    break

        return sections

    sections_by_name = _parse_sections(normalized)
    missing = [name for name in section_aliases if not sections_by_name.get(name, "").strip()]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    def count_numbered_items(section_text):
        return len(
            re.findall(
                r"(?:^|\n)\s*(?:[-*]\s+)?(?:ct\s*0*\d+|\d+[\.\)])",
                section_text,
                re.IGNORECASE,
            )
        )

    happy_match = re.search(r"caminho feliz(.+?)(?:excecao|limite|resiliencia|$)", normalized, re.DOTALL)
    exception_match = re.search(r"excecao(.+?)(?:limite|resiliencia|casos de teste funcionais|$)", normalized, re.DOTALL)
    limit_match = re.search(r"limite(.+?)(?:resiliencia|casos de teste funcionais|$)", normalized, re.DOTALL)
    resilience_match = re.search(r"resiliencia(.+?)(?:casos de teste funcionais|$)", normalized, re.DOTALL)
    functional_cases_section = sections_by_name.get("Casos de teste funcionais", "")
    traceability_section = sections_by_name.get("Rastreabilidade dos Criterios de Aceite", "")
    smoke_section = sections_by_name.get("Smoke Minimo da Feature", "")
    scenarios_section = sections_by_name.get("Cenarios de teste", "")
    non_functional_section = sections_by_name.get("Qualidade nao funcional", "")
    cases_match = re.search(r"ct\s*0*1", functional_cases_section)

    happy_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", happy_match.group(1))) if happy_match else 0
    exception_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", exception_match.group(1))) if exception_match else 0
    limit_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", limit_match.group(1))) if limit_match else 0
    resilience_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", resilience_match.group(1))) if resilience_match else 0
    if happy_count == 0 and happy_match:
        happy_count = len(re.findall(r"caminho feliz", happy_match.group(1), re.IGNORECASE))
    if exception_count == 0 and exception_match:
        exception_count = len(re.findall(r"excecao", exception_match.group(1), re.IGNORECASE))
    if happy_count < 3 and scenarios_section:
        happy_count = max(happy_count, len(re.findall(r"caminho feliz", scenarios_section, re.IGNORECASE)))
    if exception_count < 3 and scenarios_section:
        exception_count = max(exception_count, len(re.findall(r"excecao", scenarios_section, re.IGNORECASE)))
    if limit_count < 2 and scenarios_section:
        limit_count = max(limit_count, len(re.findall(r"limite", scenarios_section, re.IGNORECASE)))
    if resilience_count < 2 and scenarios_section:
        resilience_count = max(resilience_count, len(re.findall(r"resiliencia", scenarios_section, re.IGNORECASE)))
    functional_cases_count = count_numbered_items(functional_cases_section)
    action_count = len(re.findall(r"\bacao\b", functional_cases_section))
    expected_result_count = len(re.findall(r"resultado esperado", functional_cases_section))
    if functional_cases_count == 0:
        functional_cases_count = min(action_count, expected_result_count)

    if happy_count < 3:
        return False, "Menos de 3 cenarios de caminho feliz."

    if exception_count < 3:
        return False, "Menos de 3 cenarios de excecao."

    if limit_count < 2:
        return False, "Menos de 2 cenarios de limite."

    if resilience_count < 2:
        return False, "Menos de 2 cenarios de resiliencia."

    has_structured_functional_cases = (
        functional_cases_count >= 3 and action_count >= 3 and expected_result_count >= 3
    )
    non_functional_keywords = ["performance", "seguranca", "confiabilidade", "observabilidade"]
    covered_non_functional_topics = sum(
        1 for keyword in non_functional_keywords if keyword in non_functional_section
    )

    if not cases_match and not has_structured_functional_cases:
        return False, "Casos de teste funcionais nao foram gerados."

    if covered_non_functional_topics < 3:
        return False, "Cobertura nao funcional insuficiente."

    if re.search(r"acompanhar\s+falhas\b", non_functional_section) or re.search(r"acompanhar\s+falhas\b", normalized):
        return False, "Metricas genericas demais."

    risks_section = sections_by_name.get("Riscos e metricas", "")
    if re.search(r"sinal:\s*nenhum", risks_section):
        return False, "Riscos sem sinal operacional verificavel."

    risk_count = len(re.findall(r"(?:^|\n)\s*[-*]\s*\*?\*?risco", risks_section, re.IGNORECASE))
    if risk_count < 2:
        return False, "Menos de 2 riscos distintos."

    traceability_count = len(re.findall(r"(?:^|\n)\s*[-*]\s*ca[\s\-]*0*\d+\b", traceability_section, re.IGNORECASE))
    if traceability_count < 2 and "ponto a validar" not in traceability_section:
        return False, "Rastreabilidade dos criterios de aceite insuficiente."

    if "ponto a validar" in traceability_section:
        return False, "Rastreabilidade ainda depende de ponto a validar."

    test_data_section = sections_by_name.get("Dados de teste", "")
    if re.search(r"ponto a verificar", test_data_section) or re.search(r"ponto a validar", test_data_section):
        return False, "Dados de teste ainda abrem lacunas em vez de provar o requisito."

    smoke_items = len(re.findall(r"(?:^|\n)\s*[-*]\s+", smoke_section))
    if smoke_items < 3 and "nao se aplica" not in smoke_section:
        return False, "Smoke minimo da feature insuficiente."

    limit_lines = [line.strip() for line in scenarios_section.splitlines() if "limite" in line.lower()]
    weak_limit_markers = ["vazia", "vazio", "null", "nulo", "em branco", "\"\"", "''"]
    if any(any(marker in line.lower() for marker in weak_limit_markers) for line in limit_lines):
        return False, "Cenario de limite fraco ou confundido com excecao."

    if "fim_do_plano_de_testes" not in normalized:
        return False, "Marcador final do plano de testes nao foi encontrado."

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

    return True, None


def validate_backlog_output(result):
    text, normalized = _normalize_text(result)
    required_sections = [
        "backlog do projeto",
        "visao geral",
        "capacidades do produto",
        "epicos recomendados",
        "fatias de release",
        "historias de usuario",
    ]

    missing = [section for section in required_sections if section not in normalized]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    story_lines = [
        line.strip()
        for line in text.splitlines()
        if re.search(r"^(?:[-*]\s*)?(?:(?:us|story)-\d+\s*\|\s*|\d+[\.\)]\s*)?como\b", line.strip(), re.IGNORECASE)
    ]

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

    if len(story_lines) < 15:
        return False, "Foram geradas poucas historias de usuario. O minimo esperado e 15."

    if len(story_lines) > 25:
        return False, "Foram geradas historias demais. O maximo esperado e 25."

    normalized_story_lines = [
        re.sub(
            r"^\s*(?:[-*]\s*)?(?:(?:US|STORY)-\d+\s*\|\s*|\d+[\.\)]\s*)?",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()
        for line in story_lines
    ]

    invalid_titles = [
        title for title in normalized_story_lines if not re.search(r"^\s*Como\b.+\beu quero\b.+", title, re.IGNORECASE)
    ]
    if invalid_titles:
        return False, "Existe historia com estrutura incompleta ou aparencia de truncamento."

    story_blocks = _extract_backlog_story_blocks(text)
    if len(story_blocks) < len(story_lines):
        return False, "Historias com bloco estrutural incompleto."

    incomplete_blocks = [block for block in story_blocks if not _backlog_story_has_description(block)]
    if incomplete_blocks:
        return False, "Historias sem descricao contextual suficiente."

    similarity_keys = [_story_similarity_key(title) for title in normalized_story_lines]
    duplicate_count = len(similarity_keys) - len(set(key for key in similarity_keys if key))
    if duplicate_count > 0:
        return False, "Foram detectadas historias muito parecidas ou duplicadas."

    technical_story_titles = [
        title
        for title in normalized_story_lines
        if re.search(r"\b(entidade|numero sequencial|identificador unico|chave primaria|tabela|api|endpoint|schema|modelo de dados|crud)\b", title, re.IGNORECASE)
    ]
    if technical_story_titles:
        return False, "Foram detectadas historias tecnicas demais para um backlog de usuario."

    personas = set()
    generic_user_count = 0
    for line in story_lines:
        match = re.search(r"como\s+([^,|]+)", line, re.IGNORECASE)
        if match:
            persona = match.group(1).strip().lower()
            personas.add(persona)
            if re.search(r"\b(um|uma)\s+usuario\b", persona):
                generic_user_count += 1

    if len(story_lines) >= 3 and len(personas) < 2:
        return False, "Historias com pouca diversidade de personas."

    if len(story_lines) >= 3 and generic_user_count > max(1, len(story_lines) // 3):
        return False, 'Historias ainda estao genericas demais ("Como um usuario").'

    capabilities_section = re.search(r"##\s+capacidade[s]?\s+do\s+produto([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    epics_section = re.search(r"##\s+epicos\s+recomendados([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)
    release_section = re.search(r"##\s+fatias\s+de\s+release([\s\S]*?)(?=\n##\s+|$)", normalized, re.IGNORECASE)

    def _count_bullets(section_match):
        if not section_match:
            return 0
        return len(re.findall(r"(?:^|\n)\s*[-*]\s+", section_match.group(1)))

    capabilities_count = _count_bullets(capabilities_section)
    epics_count = _count_bullets(epics_section)

    if capabilities_count < 4:
        return False, "Capacidades do produto insuficientes."

    if epics_count < 4:
        return False, "Epicos recomendados insuficientes."

    if capabilities_count > 6:
        return False, "Capacidades do produto em excesso."

    if epics_count > 6:
        return False, "Epicos recomendados em excesso."

    for section_name, section_match in [("capacidades", capabilities_section), ("epicos", epics_section)]:
        if section_match:
            bullet_lines = [
                re.sub(r"^\s*[-*]\s+", "", line).strip()
                for line in section_match.group(1).splitlines()
                if re.search(r"^\s*[-*]\s+", line)
            ]
            short_lines = [line for line in bullet_lines if len(line.split()) < 3]
            if short_lines:
                return False, f"{section_name.capitalize()} do produto com itens curtos ou genericos demais."

    release_text = release_section.group(1) if release_section else ""
    release_items = parse_bullets_from_section(release_text)
    release_joined = " ".join(release_items)
    if "mvp" not in release_joined or "fase 2" not in release_joined or "fase 3" not in release_joined:
        return False, "Fatias de release sem MVP, Fase 2 e Fase 3 explicitos."

    if len(release_items) < 3:
        return False, "Fatias de release insuficientes."

    release_bodies = [item.lower() for item in release_items]
    if any(not re.search(r"\b(foco|depois|posterior|nao agora|fase seguinte)\b", item) for item in release_bodies):
        return False, "Fatias de release sem foco e diferimento suficiente."

    mvp_line = next((item for item in release_items if "mvp" in item.lower()), "")
    if not re.search(r"\b(fundacao|espinha|fluxo principal|primeira versao|base)\b", mvp_line, re.IGNORECASE):
        return False, "MVP sem foco explicito na fundacao do produto."

    foundation_signals = [
        r"\bcriar\b",
        r"\bcadastrar\b",
        r"\bregistrar\b",
        r"\bconfigurar\b",
        r"\bvisualizar\b",
        r"\bacompanhar\b",
        r"\baprovar\b",
    ]
    covered_signals = sum(1 for pattern in foundation_signals if any(re.search(pattern, line, re.IGNORECASE) for line in normalized_story_lines))
    if covered_signals < 4:
        return False, "Backlog sem cobertura suficiente da espinha dorsal do produto."

    lane_signal_groups = {
        "fundacao": [r"\bcriar\b", r"\bcadastrar\b", r"\bregistrar\b", r"\bconfigurar\b", r"\bplanejar\b"],
        "operacao": [r"\bacompanhar\b", r"\batualizar\b", r"\bexecut", r"\bmonitorar\b", r"\bstatus\b"],
        "gestao": [r"\bvisualizar\b", r"\bconsultar\b", r"\bdashboard\b", r"\brelatorio\b", r"\bpainel\b", r"\bresumo\b"],
        "governanca": [r"\baprovar\b", r"\bvalidar\b", r"\bautorizar\b", r"\bauditor", r"\bpermiss", r"\bgovernanca\b"],
    }
    covered_lanes = 0
    for patterns in lane_signal_groups.values():
        if any(any(re.search(pattern, line, re.IGNORECASE) for line in normalized_story_lines) for pattern in patterns):
            covered_lanes += 1
    if covered_lanes < 4:
        return False, "Backlog sem cobertura suficiente de fundacao, operacao, gestao e governanca."

    # O marcador final continua sendo desejavel, mas nao deve derrubar um backlog
    # estruturalmente completo quando o modelo apenas esquece a linha final.

    return True, None


def validate_architecture_output(result):
    text, normalized = _normalize_text(result)
    required_sections = [
        "arquitetura do projeto",
        "visao geral",
        "stack tecnologico",
        "modulos e responsabilidades",
        "diagrama de arquitetura",
        "estrutura de diretorios",
        "modelo de dados",
        "contratos e integracoes",
        "observabilidade e operacao",
        "riscos tecnicos e trade-offs",
        "sequencia recomendada de implementacao",
    ]

    missing = [section for section in required_sections if section not in normalized]

    has_design_section = any(
        marker in normalized
        for marker in [
            "padroes de design",
            "padroes arquiteturais",
            "boas praticas arquiteturais",
        ]
    )
    if not has_design_section:
        missing.append("padroes de design")

    has_combined_deploy_security_section = "estrategia de deploy e seguranca" in normalized
    has_deploy_section = has_combined_deploy_security_section or "estrategia de deploy" in normalized
    has_security_section = has_combined_deploy_security_section or "seguranca" in normalized

    if not has_deploy_section:
        missing.append("estrategia de deploy")

    if not has_security_section:
        missing.append("seguranca")

    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    if "fim_da_arquitetura" not in normalized:
        return False, "Marcador final da arquitetura nao foi encontrado."

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

    advanced_stack_markers = [
        "react native",
        "graphql",
        "kubernetes",
        "eks",
        "keycloak",
        "firebase",
        "launchdarkly",
        "terraform",
        "helm",
        "pagerduty",
        "grafana",
        "prometheus",
        "event sourcing",
        "cqrs",
    ]
    advanced_hits = [marker for marker in advanced_stack_markers if marker in normalized]
    if len(advanced_hits) >= 5:
        return False, "Arquitetura ambiciosa demais para o estagio atual do backlog."

    if "cqrs" in normalized:
        return False, "Arquitetura ainda usa CQRS, o que foge da simplicidade esperada para o MVP atual."

    if "react native" in normalized and "mobile" in normalized and "web" in normalized:
        return False, "Arquitetura abriu frente mobile sem necessidade explicita suficiente."

    if re.search(r"(?:^|\n)\s*get\s+/api\s*(?:\n|$)", normalized, re.IGNORECASE):
        return False, "Contratos e integracoes contem endpoint incompleto."

    if "fase 3" in normalized and re.search(r"fase 3[\s\S]{0,80}gestao de polit\s*$", normalized, re.IGNORECASE):
        return False, "Fatias de implementacao aparentam truncadas."

    if "nestjs" in normalized and re.search(r"\.java\b|localdatetime\b", normalized, re.IGNORECASE):
        return False, "Arquitetura misturou stack Node/Nest com convencoes Java."

    if "nestjs" in normalized and re.search(r"\btypeorm\b|\bterminus\b", normalized, re.IGNORECASE):
        return False, "Arquitetura desviou da stack-base da factory com Nest/TypeORM/Terminus."

    if re.search(r"\bserilog\b|\.net\b|dotnet\b", normalized, re.IGNORECASE):
        return False, "Arquitetura misturou referencias de .NET/Serilog com stack Node."

    if re.search(r"\bsendgrid\b|\bgoogle oauth\b|\bprometheus\b|/metrics\b", normalized, re.IGNORECASE):
        return False, "Arquitetura ainda traz integracoes ou observabilidade alem do necessario para o MVP."

    if re.search(r"\|\.\s*$", text, re.MULTILINE):
        return False, "Arquitetura contem artefato editorial malformado."

    if re.search(r"\"scheduleddate\"\s*:\s*\"20\d?$", normalized, re.IGNORECASE | re.MULTILINE):
        return False, "Exemplo de request/response aparenta truncado."

    if re.search(r"```json\s*\{[\s\S]{0,240}```", text, re.IGNORECASE) and not re.search(r"```json\s*\{[\s\S]{0,240}\}\s*```", text, re.IGNORECASE):
        return False, "Exemplo JSON em contratos aparenta truncado ou sem fechamento."

    if re.search(r"^\s*-\s*`[^`\n]*$", text, re.MULTILINE):
        return False, "Lista de endpoints contem linha truncada ou com backtick sem fechamento."

    return True, None


def generate_complete_text(prompt, *, agent_label, validator, model=None, options_override=None, max_retries=3):
    base_options = dict(options_override or {})
    base_num_predict = int(base_options.get("num_predict", 1200))
    retry_count = max(1, int(max_retries))
    last_reason = "sem detalhes"

    for attempt in range(1, retry_count + 1):
        current_options = {
            **base_options,
            "num_predict": int(base_num_predict * (1.4 ** (attempt - 1))),
        }
        current_prompt = prompt

        if attempt > 1:
            current_prompt = (
                f"{prompt}\n\n"
                "IMPORTANTE: sua resposta anterior foi considerada incompleta. "
                f"Motivo detectado: {last_reason}. "
                "Gere novamente do zero, entregando TODAS as secoes completas, sem interromper no meio."
            )

        result = generate_text_from_llm(
            current_prompt,
            model=model,
            options_override=current_options,
            use_cache=False,
        )
        if not result or is_error_text_response(result):
            last_reason = "Resposta vazia ou invalida."
            continue

        is_complete, reason = validator(result)
        if is_complete:
            return result

        last_reason = reason or "Resposta considerada incompleta."

    raise RuntimeError(
        f"O agente {agent_label} nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
        f"Ultimo motivo: {last_reason}"
    )
