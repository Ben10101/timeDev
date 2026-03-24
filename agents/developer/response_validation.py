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


def validate_requirements_output(result):
    text, normalized = _normalize_text(result)
    required_sections = [
        "user story refinada",
        "requisitos funcionais",
        "fluxo principal",
        "fluxos alternativos",
        "fluxos de excecao",
        "regras de negocio",
        "criterios de aceite",
    ]

    missing = [section for section in required_sections if section not in normalized]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    if not re.search(r"\bdado\b", normalized) or not re.search(r"\bquando\b", normalized) or not re.search(r"\bentao\b", normalized):
        return False, "Criterios de aceite sem estrutura BDD completa."

    if "fim_do_refinamento" not in normalized:
        return False, "Marcador final do refinamento nao foi encontrado."

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

    return True, None


def validate_qa_output(result):
    text, normalized = _normalize_text(result)
    required_sections = [
        "estrategia de testes",
        "dados de teste",
        "riscos e metricas",
        "qualidade nao funcional",
        "cenarios de teste",
        "casos de teste funcionais",
        "usabilidade e acessibilidade",
    ]

    missing = [section for section in required_sections if section not in normalized]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    def extract_section_body(source, start_marker, next_markers):
        start_index = source.find(start_marker)
        if start_index == -1:
            return ""

        start_index += len(start_marker)
        end_index = len(source)
        for marker in next_markers:
            marker_index = source.find(marker, start_index)
            if marker_index != -1:
                end_index = min(end_index, marker_index)
        return source[start_index:end_index]

    def count_numbered_items(section_text):
        return len(
            re.findall(
                r"(?:^|\n)\s*(?:[-*]\s+)?(?:ct\s*0*\d+|\d+[\.\)])",
                section_text,
                re.IGNORECASE,
            )
        )

    happy_match = re.search(r"caminho feliz(.+?)(?:excecao|$)", normalized, re.DOTALL)
    exception_match = re.search(r"excecao(.+?)(?:casos de teste funcionais|$)", normalized, re.DOTALL)
    functional_cases_section = extract_section_body(
        normalized,
        "casos de teste funcionais",
        ["usabilidade e acessibilidade", "fim_do_plano_de_testes"],
    )
    scenarios_section = extract_section_body(
        normalized,
        "cenarios de teste",
        ["casos de teste funcionais", "usabilidade e acessibilidade"],
    )
    non_functional_section = extract_section_body(
        normalized,
        "qualidade nao funcional",
        ["cenarios de teste", "casos de teste funcionais"],
    )
    cases_match = re.search(r"ct\s*0*1", functional_cases_section)

    happy_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", happy_match.group(1))) if happy_match else 0
    exception_count = len(re.findall(r"(?:^|\n)\s*(?:[-*]\s+)?(?:[1-5]\.|\d+\.)", exception_match.group(1))) if exception_match else 0
    if happy_count == 0 and happy_match:
        happy_count = len(re.findall(r"caminho feliz", happy_match.group(1), re.IGNORECASE))
    if exception_count == 0 and exception_match:
        exception_count = len(re.findall(r"excecao", exception_match.group(1), re.IGNORECASE))
    if happy_count < 5 and scenarios_section:
        happy_count = max(happy_count, len(re.findall(r"caminho feliz", scenarios_section, re.IGNORECASE)))
    if exception_count < 5 and scenarios_section:
        exception_count = max(exception_count, len(re.findall(r"excecao", scenarios_section, re.IGNORECASE)))
    functional_cases_count = count_numbered_items(functional_cases_section)
    action_count = len(re.findall(r"\bacao\b", functional_cases_section))
    expected_result_count = len(re.findall(r"resultado esperado", functional_cases_section))
    if functional_cases_count == 0:
        functional_cases_count = min(action_count, expected_result_count)

    if happy_count < 5:
        return False, "Menos de 5 cenarios de caminho feliz."

    if exception_count < 5:
        return False, "Menos de 5 cenarios de excecao."

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
        "epicos",
        "historias de usuario",
        "tarefas tecnicas iniciais",
    ]

    missing = [section for section in required_sections if section not in normalized]
    if missing:
        return False, f"Secoes ausentes: {', '.join(missing)}"

    story_count = len(re.findall(r"\bcomo\b", normalized))
    if story_count < 10:
        return False, "Quantidade insuficiente de historias de usuario."

    if "fim_do_backlog" not in normalized:
        return False, "Marcador final do backlog nao foi encontrado."

    if has_truncated_ending(text):
        return False, "Resposta aparenta ter sido cortada no final."

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
