# -*- coding: utf-8 -*-
import json
import re
import sys

from agents.developer.llm_service import extract_json_from_text, generate_text_from_llm, is_error_text_response


def _truncate(value, limit=2400):
    return str(value or "").strip()[:limit]


def _compact_json(value, limit=2800):
    if not value:
        return "{}"
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)[:limit]
    except Exception:
        return _truncate(value, limit)


def _unique(items):
    seen = set()
    output = []
    for item in items or []:
        text = str(item or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def _clean_text(value, fallback=""):
    text = str(value or fallback).strip()
    return text if text else fallback


def _as_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    text = str(value or "").strip()
    return [text] if text else []


class UiUxSpecialist:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_fallback_contract(self, payload):
        technical_spec = payload.get("technical_spec") or {}
        frontend_spec = payload.get("frontend_spec") or {}
        design_reference = payload.get("design_reference") or {}
        page_archetype = _clean_text(
            frontend_spec.get("pageArchetype")
            or design_reference.get("pageArchetype")
            or "record-management",
            "record-management",
        )
        fallback_pattern = _clean_text(
            frontend_spec.get("fallbackPattern")
            or design_reference.get("fallbackPattern")
            or "stripe-records",
            "stripe-records",
        )
        pattern_hints = _unique(
            _as_list(frontend_spec.get("patternHints"))
            + _as_list(design_reference.get("patternHints"))
        )
        page_title = _clean_text(frontend_spec.get("pageTitle") or technical_spec.get("frontend", {}).get("pageTitle"), "Fluxo principal")
        page_description = _clean_text(
            frontend_spec.get("pageDescription")
            or technical_spec.get("frontend", {}).get("pageDescription")
            or technical_spec.get("summary"),
            "Registre apenas o essencial para avançar com clareza operacional.",
        )
        navigation_label = _clean_text(frontend_spec.get("navigationLabel") or technical_spec.get("frontend", {}).get("navigationLabel"), page_title)
        submit_label = _clean_text(technical_spec.get("domain", {}).get("submitLabel") or frontend_spec.get("submitLabel"), "Salvar")

        if page_archetype == "intake-form":
            copy_overrides = {
                "badge": "Abertura principal",
                "summaryTitle": "Dados iniciais da visita",
                "summaryTone": "Registre apenas o essencial para iniciar a triagem da visita com clareza operacional.",
                "asideTitle": "Abertura da visita",
                "asideTone": "Registre nome, objetivo, data prevista e contexto inicial para iniciar a triagem sem ruido operacional.",
                "heroEyebrow": "Visitas",
                "heroTitle": "Crie uma nova visita",
                "heroDescription": "Registre nome, objetivo, data prevista e contexto inicial para abrir a visita com clareza operacional.",
                "formCardTitle": "Dados da visita",
                "formCardDescription": "Informe os dados essenciais para que a recepcao inicie a triagem sem retrabalho.",
                "recordsTitle": "Visitas em andamento",
                "recordsEmptyState": "Nenhuma visita iniciada ainda. Assim que a primeira entrar, ela aparecera aqui com contexto e proximo passo.",
                "profileSummaryTitle": "Leitura da visita",
                "profileSummaryDescription": "Veja rapidamente o status, o objetivo e o contexto inicial de cada visita aberta.",
                "navigationLabel": navigation_label,
                "pageTitle": page_title,
                "pageDescription": page_description,
                "submitLabel": _clean_text(frontend_spec.get("submitLabel") or submit_label, "Criar Visita"),
            }
            interface_examples = {
                "summaryItems": [
                    "Nome, objetivo e data precisam aparecer juntos para a recepcao entender a demanda.",
                    "O contexto inicial deve orientar a triagem sem depender de alinhamento adicional imediato.",
                    "A tela deve parecer o inicio de uma visita real, nao um cadastro generico.",
                ],
                "promptExamples": [
                    "Tela de abertura de visita com foco em triagem, contexto inicial e proximo passo da recepcao.",
                    "Fluxo operacional de visita com copy especifica, sem cair em linguagem de cadastro generico.",
                ],
                "sectionLabels": ["Dados da visita", "Contexto inicial", "Proximos passos"],
                "ctaLabels": ["Criar visita", "Salvar abertura", "Registrar contexto"],
                "emptyStates": [
                    "Nenhuma visita iniciada ainda.",
                    "Assim que a primeira visita for aberta, ela aparecera aqui com contexto suficiente para a recepcao seguir.",
                ],
                "reviewSignals": [
                    "abertura de visita",
                    "triagem da recepcao",
                    "evitar copy generica",
                ],
                "helperTexts": [
                    "Registre o contexto inicial minimo para que recepcao e operacao entendam a solicitacao.",
                    "Defina a data prevista para iniciar o fluxo principal de atendimento da visita.",
                ],
                "summaryStateTitle": "Visita pronta para triagem",
                "summaryStateEmpty": "Nenhuma visita iniciada ainda. Registre a primeira para acompanhar o fluxo principal.",
            }
        else:
            copy_overrides = {
                "badge": "Fluxo principal",
                "summaryTitle": "Resumo da tela",
                "summaryTone": "Entenda rapidamente o que esta pagina ajuda a concluir.",
                "asideTitle": "Operacao viva",
                "asideTone": "Acompanhe o contexto principal desta area sem perder clareza.",
                "navigationLabel": navigation_label,
                "pageTitle": page_title,
                "pageDescription": page_description,
                "submitLabel": submit_label,
            }
            interface_examples = {
                "summaryItems": [
                    "Apresente o contexto principal em linguagem de produto, nao de template.",
                    "Mantenha o proximo passo evidente para o usuario da operacao.",
                    "Evite copy interna, placeholders genéricos ou termos de framework.",
                ],
                "promptExamples": [
                    "Tela operacional com linguagem especifica da feature e foco no fluxo principal.",
                    "Experiencia enxuta com copy humana, clara e orientada ao usuario final.",
                ],
                "sectionLabels": ["Resumo atual", "Contexto principal", "Proximos passos"],
                "ctaLabels": ["Salvar", "Atualizar", "Registrar"],
                "emptyStates": [
                    "Nenhum registro disponivel ainda.",
                    "Assim que houver movimentacao, ela aparecera aqui com contexto util.",
                ],
                "reviewSignals": [
                    "copy humana",
                    "evitar linguagem interna",
                    "fluxo principal evidente",
                ],
                "helperTexts": [
                    "Registre apenas o essencial para iniciar o fluxo com clareza operacional.",
                    "A tela deve parecer produto, nao artefato tecnico.",
                ],
                "summaryStateTitle": "Resumo atual",
                "summaryStateEmpty": "Nenhum dado disponivel ainda.",
            }

        return {
            "uxContract": {
                "pageArchetype": page_archetype,
                "fallbackPattern": fallback_pattern,
                "patternHints": pattern_hints,
                "uiIntent": _clean_text(frontend_spec.get("uiIntent") or technical_spec.get("structured", {}).get("classification", {}).get("intent"), "custom"),
                "copyOverrides": copy_overrides,
                "interfaceExamples": interface_examples,
                "reviewChecklist": [
                    "Remover copy genérica e termos de template.",
                    "Manter a hierarquia visual centrada no fluxo principal.",
                    "Garantir que o CTA descreva a ação real da tela.",
                ],
                "doNotUsePhrases": [
                    "Cadastro principal",
                    "Contexto do cadastro",
                    "Contexto do registro",
                    "Atividade recente",
                    "Carregando dados da feature",
                ],
            }
        }

    def _normalize_result(self, result, payload):
        if not isinstance(result, dict):
            return self._build_fallback_contract(payload)

        contract = result.get("uxContract") if isinstance(result.get("uxContract"), dict) else result
        fallback = self._build_fallback_contract(payload).get("uxContract") or {}

        normalized = {
            "pageArchetype": _clean_text(contract.get("pageArchetype") or fallback.get("pageArchetype"), fallback.get("pageArchetype", "record-management")),
            "fallbackPattern": _clean_text(contract.get("fallbackPattern") or fallback.get("fallbackPattern"), fallback.get("fallbackPattern", "stripe-records")),
            "patternHints": _unique(_as_list(contract.get("patternHints")) or _as_list(fallback.get("patternHints"))),
            "uiIntent": _clean_text(contract.get("uiIntent") or fallback.get("uiIntent"), fallback.get("uiIntent", "custom")),
            "copyOverrides": {**fallback.get("copyOverrides", {}), **(contract.get("copyOverrides") or {})},
            "interfaceExamples": {**fallback.get("interfaceExamples", {}), **(contract.get("interfaceExamples") or {})},
            "reviewChecklist": _unique(list(contract.get("reviewChecklist") or []) or list(fallback.get("reviewChecklist") or [])),
            "doNotUsePhrases": _unique(list(contract.get("doNotUsePhrases") or []) or list(fallback.get("doNotUsePhrases") or [])),
        }

        return {"uxContract": normalized}

    def _build_prompt(self, payload):
        technical_spec = payload.get("technical_spec") or {}
        frontend_spec = payload.get("frontend_spec") or {}
        design_reference = payload.get("design_reference") or {}
        current_context = payload.get("current_implementation_context") or {}
        repair_context = payload.get("repair_context")

        repair_block = ""
        if repair_context:
            repair_block = f"\n\nHouve uma rodada anterior com problemas. Use isso como restricao:\n{_compact_json(repair_context)}"

        return f"""
Voce e o UiUxSpecialist do Aligna Factory.
Sua funcao e transformar o technical spec em um contrato de UX mais humano, mais especifico e menos generico.

OBJETIVO:
- evitar copy interna como "Cadastro principal" ou "Contexto do registro"
- explicitar a intencao da tela em linguagem de produto
- orientar a geracao de UI com seções, empty states, labels e CTAs coerentes

ENTRADA:
- task: {payload.get("task_uuid") or "n/a"}
- title: {payload.get("idea") or technical_spec.get("taskTitle") or "n/a"}
- technical_spec: {_compact_json(technical_spec)}
- frontend_spec: {_compact_json(frontend_spec)}
- design_reference: {_compact_json(design_reference)}
- current_implementation_context: {_compact_json(current_context)}
{repair_block}

REGRAS:
1. Retorne apenas JSON valido.
2. Priorize copy especifica da feature, sem termos de template.
3. Se a tela for de abertura de visita, use linguagem de recepcao e triagem operacional.
4. Se nao houver contexto suficiente, produza um contrato conservador e consistente.

FORMATO:
{{
  "uxContract": {{
    "pageArchetype": "string",
    "fallbackPattern": "string",
    "patternHints": ["string"],
    "uiIntent": "string",
    "copyOverrides": {{
      "navigationLabel": "string",
      "pageTitle": "string",
      "pageDescription": "string",
      "heroEyebrow": "string",
      "heroTitle": "string",
      "heroDescription": "string",
      "formCardTitle": "string",
      "formCardDescription": "string",
      "recordsTitle": "string",
      "recordsEmptyState": "string",
      "profileSummaryTitle": "string",
      "profileSummaryDescription": "string",
      "asideTitle": "string",
      "asideTone": "string",
      "badge": "string",
      "summaryTitle": "string",
      "summaryTone": "string",
      "submitLabel": "string"
    }},
    "interfaceExamples": {{
      "summaryItems": ["string"],
      "promptExamples": ["string"],
      "sectionLabels": ["string"],
      "ctaLabels": ["string"],
      "emptyStates": ["string"],
      "reviewSignals": ["string"],
      "helperTexts": ["string"],
      "summaryStateTitle": "string",
      "summaryStateEmpty": "string"
    }},
    "reviewChecklist": ["string"],
    "doNotUsePhrases": ["string"]
  }}
}}
""".strip()

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.2, "num_predict": 2200},
                use_cache=False,
            )
            if not raw or is_error_text_response(raw):
                return self._build_fallback_contract(payload)

            parsed = extract_json_from_text(raw)
            return self._normalize_result(parsed, payload)
        except Exception:
            return self._build_fallback_contract(payload)
