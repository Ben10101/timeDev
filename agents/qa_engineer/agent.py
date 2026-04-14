# -*- coding: utf-8 -*-
import os
import re
import sys
import unicodedata
import json

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
        "Rastreabilidade dos Criterios de Aceite",
        "Smoke Minimo da Feature",
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

    def _section_aliases(self, title):
        aliases = {
            "Estrategia de testes": ["estrategia de testes", "estrategia de teste", "estrategia"],
            "Dados de teste": ["dados de teste", "dados testes"],
            "Riscos e metricas": ["riscos e metricas", "riscos e sinais", "riscos", "riscos e metricas operacionais"],
            "Qualidade nao funcional": [
                "qualidade nao funcional",
                "qualidade nao funcional e operacao",
                "qualidade operacional",
                "nfr",
            ],
            "Rastreabilidade dos Criterios de Aceite": [
                "rastreabilidade dos criterios de aceite",
                "rastreabilidade de criterios de aceite",
                "rastreabilidade criterios de aceite",
                "rastreabilidade de criterios aceite",
                "traceabilidade dos criterios de aceite",
            ],
            "Smoke Minimo da Feature": ["smoke minimo da feature", "smoke minimo", "smoke da feature", "smoke feature"],
            "Cenarios de teste": ["cenarios de teste", "cenarios"],
            "Casos de teste funcionais": ["casos de teste funcionais", "casos funcionais", "casos de teste"],
            "Usabilidade e acessibilidade": ["usabilidade e acessibilidade", "usabilidade", "acessibilidade"],
        }
        return aliases.get(title, [title])

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
            "Estados da Interface e Feedback",
            "Validacoes e Dados",
            "Permissoes e Auditoria",
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

    def _sanitize_plan(self, plan_text):
        text = (plan_text or "").strip()
        if not text:
            return ""

        replacements = {
            "O formulario deve salvar automaticamente o rascunho do chamado a cada 30 segundos durante o preenchimento.":
                "Se houver autosave definido no produto, o comportamento deve ser validado de ponta a ponta.",
            "A autenticacao do usuario deve ser verificada antes de permitir o envio do formulario.":
                "Validar que o acesso ao fluxo respeita as regras de autenticacao e permissao definidas no produto.",
            "Cobertura de código esperada: 80% em todos os cenarios":
                "Cobertura esperada definida pelo time conforme criticidade da historia.",
            "Cobertura esperada: 80% dos cenários de envio automático de lembretes":
                "Cobertura esperada definida pelo time conforme criticidade da historia.",
            "O sistema deve permitir ao paciente escolher o canal de lembrete (SMS ou e-mail), caso configuravel.":
                "Validar o envio do lembrete pelos canais previstos no requisito.",
        }

        for source, target in replacements.items():
            text = text.replace(source, target)

        text = re.sub(
            r"cobertura\s+(?:de codigo\s+)?esperad[a|o]\s*:\s*\d+%\s*(?:dos|em)?[^.\n]*",
            "Cobertura esperada definida pelo time conforme criticidade da historia.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"o sistema deve permitir ao paciente escolher o canal de lembrete[^.\n]*",
            "Validar o envio do lembrete pelos canais previstos no requisito.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"interface de configuracao de canais de lembrete[^.\n]*",
            "fluxo de envio de lembretes pelos canais previstos no requisito.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"configurar envio de lembrete por\s+(sms|e-mail)",
            r"acionar envio de lembrete por \1 conforme o fluxo previsto",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"canal escolhido",
            "canal previsto",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"caso configuravel",
            "conforme definido no produto",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"em ate \d+\s+segundos[^.\n]*",
            "em tempo compativel com a experiencia definida pelo produto.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\b\d+\s+lembretes?\s+simultaneos?[^.\n]*",
            "em volume compativel com a demanda esperada do produto.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\b\d+%\s+dos casos[^.\n]*",
            "com taxa de entrega acompanhada conforme meta operacional definida pelo time.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"paciente\s+altera\s+o\s+canal\s+de\s+comunicacao\s+preferencial[^.\n]*",
            "Se o produto permitir alteracao de canal apos a marcacao, validar esse fluxo separadamente.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"canal\s+preferencial", "canal de envio", text, flags=re.IGNORECASE)
        text = re.sub(
            r"escolha\s+do\s+canal\s+pe(?:lo|la)\s+paciente",
            "definicao do canal no fluxo do produto",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"paciente\s+altera\s+a\s+preferencia\s+de\s+canal[^.\n]*",
            "Se o produto permitir alteracao de canal apos a marcacao, validar esse fluxo separadamente.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"no exato momento em que a consulta esta prestes a ocorrer",
            "em momento compativel com a estrategia operacional definida pelo produto",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"(?im)^-\s*Performance:\s*$",
            "- Performance: Validar tempo de resposta e estabilidade do envio conforme a experiencia esperada do produto.",
            text,
        )
        text = re.sub(
            r"(?im)^-\s*Confiabilidade:\s*$",
            "- Confiabilidade: Validar registro de falhas e reprocessamento conforme politica operacional definida pelo produto.",
            text,
        )
        text = re.sub(
            r"(?im)^-\s*Observabilidade:\s*$",
            "- Observabilidade: Validar disponibilidade de logs e sinais operacionais para acompanhar o envio dos lembretes.",
            text,
        )
        text = re.sub(
            r"\bacompanhar falhas\b",
            "acompanhar taxa de erro do fluxo principal",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\bacompanhar tempo de resposta\b",
            "acompanhar tempo de resposta do endpoint e da submissao principal",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\bacompanhar entrega\b",
            "acompanhar taxa de sucesso do fluxo principal",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"sinal:\s*nenhum",
            "sinal: ausencia de registro de auditoria ou log operacional",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"ponto a verificar",
            "risco de inconsistencia a observar em execucao",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(
            r"(?:\n\s*FIM_DO_PLANO_DE_TESTES\s*){2,}$",
            "\n\nFIM_DO_PLANO_DE_TESTES",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\n\s*FIM_DO_PLANO_DE_TESTES\s*$",
            "\n\nFIM_DO_PLANO_DE_TESTES",
            text,
            flags=re.IGNORECASE,
        )
        return text.strip()

    def _extract_section(self, content, title):
        text, normalized_content = self._normalize_text(content)
        _, normalized_title = self._normalize_text(title)
        aliases = self._section_aliases(title)
        match = None
        for alias in aliases:
            _, normalized_alias = self._normalize_text(alias)
            pattern = re.compile(
                rf"^##\s+{re.escape(normalized_alias)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
                re.IGNORECASE | re.MULTILINE,
            )
            match = pattern.search(normalized_content)
            if match:
                break
        if not match:
            return ""

        # Reaproveita o slice no texto original usando o mesmo trecho normalizado como guia.
        matched_body_normalized = match.group(1).strip()
        if not matched_body_normalized:
            return ""

        original_sections = re.split(r"(?=^##\s+)", text, flags=re.MULTILINE)
        for section in original_sections:
            _, normalized_section = self._normalize_text(section)
            if any(normalized_section.startswith(f"## {self._normalize_text(alias)[1]}") for alias in aliases):
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

    def _parse_requirement_spec(self, requirement_spec):
        if isinstance(requirement_spec, dict):
            return requirement_spec
        if not requirement_spec:
            return {}
        try:
            parsed = json.loads(requirement_spec)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def _coerce_lines(self, value):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, dict):
            lines = []
            for item in value.values():
                lines.extend(self._coerce_lines(item))
            return lines
        text = str(value or "").strip()
        if not text:
            return []
        return [line.strip("- ").strip() for line in text.splitlines() if line.strip()]

    def _compact_phrase(self, value, *, max_words=14):
        text = re.sub(r"\s+", " ", str(value or "")).strip()
        text = re.sub(r"(?i)^(dado|quando|entao|então|cenario \d+:|cenário \d+:)\s*", "", text)
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words]).rstrip(" ,;:.")

    def _extract_requirement_signals(self, requirement_summary, requirement_spec=None):
        spec = self._parse_requirement_spec(requirement_spec)
        signals = []
        sources = []
        for key in [
            "functionalRequirements",
            "businessRules",
            "validationsAndData",
            "permissionsAndAudit",
            "acceptanceCriteria",
            "flows",
        ]:
            sources.extend(self._coerce_lines(spec.get(key)))
        sources.extend(self._coerce_lines(requirement_summary))
        for line in sources:
            normalized = unicodedata.normalize("NFD", str(line).lower())
            normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
            signals.append(normalized)
        return signals

    def _extract_text_fields(self, requirement_summary, requirement_spec=None):
        fields = []
        for match in re.findall(r"-\s*([A-Za-zÀ-ÿ0-9 _/-]+)\s*\(", requirement_summary or "", re.IGNORECASE):
            cleaned = re.sub(r"\s+", " ", match).strip(" -:")
            if cleaned and cleaned.lower() not in {field.lower() for field in fields}:
                fields.append(cleaned)
        spec = self._parse_requirement_spec(requirement_spec)
        for item in self._coerce_lines(spec.get("validationsAndData")):
            normalized = re.sub(r"\s+", " ", item)
            for match in re.findall(r"([A-Za-zÀ-ÿ0-9 _/-]{3,40})\s*:", normalized):
                cleaned = re.sub(r"\s+", " ", match).strip(" -:")
                if cleaned and cleaned.lower() not in {field.lower() for field in fields}:
                    fields.append(cleaned)
        return fields[:6]

    def _extract_primary_route_label(self, idea):
        text = (idea or "").lower()
        if "criar visita" in text:
            return "POST /visitas"
        if "aprovar" in text and "visita" in text:
            return "POST /visitas/{id}/aprovacao"
        if "cadastrar" in text and "responsavel" in text:
            return "POST /responsaveis-operacionais"
        return "endpoint principal da feature"

    def _normalize_section_lines(self, body):
        return [
            line.strip()
            for line in (body or "").splitlines()
            if line.strip()
        ]

    def _synthesize_risk_lines(self, idea, requirement_summary, requirement_spec=None):
        route_label = self._extract_primary_route_label(idea)
        fields = self._extract_text_fields(requirement_summary, requirement_spec)
        field_label = ", ".join(fields[:3]) if fields else "campos obrigatorios"
        signals = self._extract_requirement_signals(requirement_summary, requirement_spec)
        risks = []
        if any("protocolo" in line for line in signals):
            risks.append(
                "- Risco: protocolo inicial ausente, duplicado ou fora do padrao esperado -> sinal: confirmacoes com identificador repetido ou consulta posterior sem protocolo recuperavel."
            )
        if any("data" in line for line in signals):
            risks.append(
                f"- Risco: validacao inconsistente de data ou janela operacional -> sinal: aumento de rejeicoes por formato/data invalida ou registros aceitos fora da regra prevista no {route_label}."
            )
        if any(term in line for line in signals for term in ["contato", "email", "telefone"]):
            risks.append(
                f"- Risco: contato salvo em formato inutilizavel para a operacao -> sinal: respostas 400 por validacao de contato ou registro persistido sem canal acionavel no {route_label}."
            )
        if any(term in line for line in signals for term in ["tipo de suporte", "formato", "status", "categoria"]):
            risks.append(
                "- Risco: valor fora da lista controlada comprometer classificacao operacional -> sinal: registros persistidos com tipo/status invalido ou filtragem inconsistente na consulta."
            )
        if any(term in line for line in signals for term in ["auditoria", "permiss", "usuario responsavel"]):
            risks.append(
                "- Risco: ausencia de trilha de auditoria na acao principal -> sinal: criacao sem timestamp, usuario responsavel ou evento registravel de acompanhamento."
            )
        if any(term in line for line in signals for term in ["aprova", "autorizacao"]):
            risks.append(
                "- Risco: dados iniciais inconsistentes comprometerem a aprovacao posterior -> sinal: alto volume de retrabalho ou reprovacoes por informacao inicial incompleta."
            )
        if not risks:
            risks = [
                f"- Risco: validacao insuficiente dos campos {field_label} -> sinal: aumento de respostas 400 ou registros invalidos no {route_label}.",
                "- Risco: persistencia incompleta apos confirmacao -> sinal: diferenca entre confirmacoes de sucesso e registros recuperaveis na consulta subsequente.",
                "- Risco: ausencia de log/auditoria da acao principal -> sinal: criacao sem timestamp ou sem usuario responsavel registrado.",
            ]
        elif len(risks) == 1:
            risks.extend([
                "- Risco: persistencia incompleta apos confirmacao -> sinal: diferenca entre confirmacoes de sucesso e registros recuperaveis na consulta subsequente.",
                "- Risco: ausencia de log/auditoria da acao principal -> sinal: criacao sem timestamp ou sem usuario responsavel registrado.",
            ])
        elif len(risks) == 2:
            risks.append(
                "- Risco: ausencia de trilha de auditoria na acao principal -> sinal: criacao sem timestamp ou sem usuario responsavel registrado."
            )
        return risks[:4]

    def _synthesize_limit_lines(self, idea, requirement_summary, requirement_spec=None):
        fields = self._extract_text_fields(requirement_summary, requirement_spec)
        text_fields = [field for field in fields if not re.search(r"\bdata\b|\bid\b", field, re.IGNORECASE)]
        primary_text = text_fields[0] if text_fields else "campo textual principal"
        secondary_text = text_fields[1] if len(text_fields) > 1 else primary_text
        return [
            f"7. Limite: valor no tamanho maximo permitido para {primary_text}; sistema aceita sem truncar nem corromper o dado.",
            f"8. Limite: valor exatamente no limite minimo aceito para {secondary_text}; sistema aceita e persiste corretamente.",
        ]

    def _synthesize_smoke_lines(self, idea, requirement_summary, requirement_spec=None):
        route_label = self._extract_primary_route_label(idea)
        fields = self._extract_text_fields(requirement_summary, requirement_spec)
        primary_field = fields[0] if fields else "campo principal"
        secondary_field = fields[1] if len(fields) > 1 else "campo complementar"
        return [
            f"- UI: abrir a tela/fluxo principal da feature sem erro visivel.",
            f"- Validacao: submeter {primary_field} e {secondary_field} com valores validos e verificar aceite do formulario.",
            f"- API: confirmar resposta de sucesso no {route_label} ou no endpoint principal equivalente.",
            "- Persistencia: consultar em seguida e verificar que o registro/reflexo da acao ficou disponivel.",
            "- Auditoria: verificar existencia de feedback de sucesso ou sinal operacional minimo apos a acao principal.",
        ]

    def _synthesize_scenarios(self, idea, requirement_summary, requirement_spec=None):
        fields = self._extract_text_fields(requirement_summary, requirement_spec)
        primary_field = fields[0] if fields else "campo principal"
        secondary_field = fields[1] if len(fields) > 1 else "campo complementar"
        tertiary_field = fields[2] if len(fields) > 2 else secondary_field
        return [
            f"1. Caminho Feliz: criar/registrar a feature com {primary_field} e {secondary_field} validos; sistema conclui a operacao com sucesso.",
            f"2. Caminho Feliz: repetir o fluxo principal com variacao valida de {secondary_field}; sistema persiste e exibe confirmacao coerente.",
            f"3. Caminho Feliz: consultar o registro apos a acao principal; sistema apresenta os dados mais recentes sem divergencia.",
            f"4. Excecao: submeter a feature sem {primary_field}; sistema bloqueia a operacao e informa o erro.",
            f"5. Excecao: informar {secondary_field} em formato invalido; sistema rejeita a submissao sem persistencia parcial.",
            "6. Excecao: simular falha do backend durante a confirmacao; sistema exibe erro tratado e evita inconsistencias.",
            f"7. Limite: informar {primary_field} exatamente no tamanho maximo permitido; sistema aceita e persiste corretamente.",
            f"8. Limite: informar {tertiary_field} exatamente no menor valor valido previsto; sistema aceita sem degradar a experiencia.",
            "9. Resiliencia: repetir a operacao apos falha transitória; sistema recupera o fluxo sem duplicar registros.",
            "10. Resiliencia: executar consulta/acao principal com lentidao moderada da API; sistema preserva feedback e nao trava a interface.",
        ]

    def _synthesize_functional_cases(self, idea, requirement_summary, requirement_spec=None):
        route_label = self._extract_primary_route_label(idea)
        spec = self._parse_requirement_spec(requirement_spec)
        fields = self._extract_text_fields(requirement_summary, requirement_spec)
        primary_field = fields[0] if fields else "campo principal"
        secondary_field = fields[1] if len(fields) > 1 else "campo complementar"
        rule_lines = self._coerce_lines(spec.get("businessRules"))
        acceptance_lines = self._coerce_lines(spec.get("acceptanceCriteria"))
        first_rule = self._compact_phrase(rule_lines[0]) if rule_lines else "regras de negocio aplicaveis"
        first_acceptance = (
            self._compact_phrase(acceptance_lines[0]) if acceptance_lines else "confirmacao exibida ao usuario"
        )
        return "\n".join(
            [
                "1. CT-01",
                f"Acao: preencher {primary_field} e {secondary_field} com valores validos e confirmar a acao principal.",
                f"Resultado esperado: requisicao enviada ao {route_label} com sucesso, persistencia concluida e {first_acceptance.lower()}.",
                "",
                "2. CT-02",
                f"Acao: deixar {primary_field} ausente ou invalido e tentar confirmar a acao principal.",
                f"Resultado esperado: submissao bloqueada ou rejeitada com mensagem clara, sem persistencia parcial e respeitando {first_rule.lower()}.",
                "",
                "3. CT-03",
                "Acao: simular falha operacional durante a confirmacao, como indisponibilidade temporaria da API ou erro de validacao no backend.",
                "Resultado esperado: erro tratado sem travar a interface, sem dado inconsistente persistido e com sinal operacional registravel.",
            ]
        ).strip()

    def _synthesize_traceability_lines(self, idea, requirement_summary, requirement_spec=None):
        spec = self._parse_requirement_spec(requirement_spec)
        acceptance_lines = self._coerce_lines(spec.get("acceptanceCriteria"))
        rules_lines = self._coerce_lines(spec.get("businessRules"))
        fields = self._extract_text_fields(requirement_summary, requirement_spec)

        primary_subject = fields[0] if fields else "campo principal"
        secondary_subject = fields[1] if len(fields) > 1 else primary_subject
        first_acceptance = acceptance_lines[0] if acceptance_lines else "confirmacao do fluxo principal"
        first_rule = rules_lines[0] if rules_lines else "regra principal da historia"

        return "\n".join(
            [
                f"- CA-01 -> Cenarios 1, 2 e 3; Casos CT-01 e CT-02; Smoke: validar {primary_subject} no fluxo principal.",
                f"- CA-02 -> Cenarios 4, 5 e 6; Casos CT-02 e CT-03; Smoke: bloquear {primary_subject} invalido sem persistencia parcial.",
                f"- CA-03 -> Cenarios 7 e 8; Casos CT-01 e CT-03; Smoke: confirmar o efeito observavel de {secondary_subject} apos a acao.",
                f"- CA-04 -> Cenarios 9 e 10; Casos CT-03; Smoke: manter resiliencia e rastreabilidade apos falha no fluxo principal.",
                f"- CA-05 -> Regra: {first_rule}; cobertura associada aos cenarios e casos acima.",
                f"- CA-06 -> Aceite: {first_acceptance}; deve aparecer no smoke e nos casos funcionais.",
            ]
        ).strip()

    def _stabilize_plan(self, full_plan, idea, requirement_summary, requirement_spec=None):
        sections = {}
        for title in self.QA_SECTIONS:
            body = self._extract_section(full_plan, title)
            if body:
                sections[title] = body

        risks_body = sections.get("Riscos e metricas", "")
        risk_lines = [
            line for line in self._normalize_section_lines(risks_body)
            if re.search(r"risco", line, re.IGNORECASE)
        ]
        if len(risk_lines) < 2 or any(re.search(r"sinal:\s*nenhum", line, re.IGNORECASE) for line in risk_lines):
            sections["Riscos e metricas"] = "\n".join(self._synthesize_risk_lines(idea, requirement_summary, requirement_spec))

        scenarios_body = sections.get("Cenarios de teste", "")
        scenario_lines = self._normalize_section_lines(scenarios_body)
        happy_lines = [line for line in scenario_lines if "caminho feliz" in line.lower()]
        limit_lines = [line for line in scenario_lines if "limite" in line.lower()]
        weak_limit_markers = ["vazia", "vazio", "null", "nulo", "em branco", "\"\"", "''"]
        if (
            len(happy_lines) < 3
            or len(limit_lines) < 2
            or any(any(marker in line.lower() for marker in weak_limit_markers) for line in limit_lines)
        ):
            sections["Cenarios de teste"] = "\n".join(self._synthesize_scenarios(idea, requirement_summary, requirement_spec))

        functional_cases_body = sections.get("Casos de teste funcionais", "")
        functional_case_lines = self._normalize_section_lines(functional_cases_body)
        action_count = sum(1 for line in functional_case_lines if line.lower().startswith("acao:"))
        expected_count = sum(1 for line in functional_case_lines if line.lower().startswith("resultado esperado:"))
        if action_count < 3 or expected_count < 3:
            sections["Casos de teste funcionais"] = self._synthesize_functional_cases(idea, requirement_summary, requirement_spec)

        traceability_body = sections.get("Rastreabilidade dos Criterios de Aceite", "")
        traceability_lines = self._normalize_section_lines(traceability_body)
        traceability_count = len([
            line
            for line in traceability_lines
            if re.search(r"\bca[\s\-]*0*\d+\b", line, re.IGNORECASE)
            or re.search(r"\bcriterio(?:s)? de aceite\b", line, re.IGNORECASE)
        ])
        if traceability_count < 3 or "ponto a validar" in traceability_body.lower():
            sections["Rastreabilidade dos Criterios de Aceite"] = self._synthesize_traceability_lines(
                idea,
                requirement_summary,
                requirement_spec,
            )

        smoke_body = sections.get("Smoke Minimo da Feature", "")
        smoke_lines = [line for line in self._normalize_section_lines(smoke_body) if re.match(r"^\s*[-*]", line)]
        if len(smoke_lines) < 3:
            sections["Smoke Minimo da Feature"] = "\n".join(self._synthesize_smoke_lines(idea, requirement_summary, requirement_spec))

        return self._sanitize_plan(self._build_full_plan(sections))

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

    def _generate_multi_block_plan(self, idea, requirement_summary, qa_model, requirement_spec=None):
        structured_requirement_spec = self._parse_requirement_spec(requirement_spec)
        base_context = f"""
Historia:
"{idea}"

Resumo estrutural dos requisitos:
{requirement_summary}

Requirement Spec estruturado:
{json.dumps(structured_requirement_spec, ensure_ascii=False) if structured_requirement_spec else "Nao informado."}

Regras gerais:
- Responda em portugues.
- Nao invente escopo fora da historia.
- Nao invente comportamento de produto que nao esteja sustentado pelo requisito.
- Se alguma regra nao estiver explicita no requisito, trate como ponto de verificacao ou risco, nunca como funcionalidade confirmada.
- Nao transforme heuristica de QA em verdade do produto.
- Nao introduza metas numericas arbitrarias, como cobertura de 80 por cento, sem fonte explicita.
- Nao afirme canais configuraveis, links, janelas de envio, retries ou automatismos extras se isso nao estiver no requisito.
- Nao introduza metas como 2 segundos, 99 por cento, 1000 eventos simultaneos ou volume especifico sem fonte explicita.
- Se o requisito nao confirmar variacao de canal, alteracao de preferencia ou notificacao para equipe interna, trate isso como risco ou ponto a validar.
- Quando o requisito citar "SMS ou e-mail", interprete isso como canais possiveis do fluxo, nao como escolha do paciente ou preferencia configuravel, salvo evidencia explicita.
- Nao use verbos como "configurar", "escolher" ou "selecionar" para o canal de envio, salvo se o requisito disser isso explicitamente.
- Seja especifico e economico em tokens.
- Prefira bullets curtos e objetivos.
- Nao inclua introducao nem conclusao.
- Evite repeticao: cada item deve cobrir um risco, validacao ou comportamento diferente.
- Prefira checagens verificaveis como status HTTP, bloqueio de submissao, mensagem de erro, persistencia, log/auditoria e ausencia de erro 5xx.
"""

        retry_count = max(1, int(os.getenv("QA_MAX_RETRIES", "1")))
        last_reason = "sem detalhes"

        for _attempt in range(1, retry_count + 1):
            sections = {}
            try:
                planning_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:
Use exatamente estes titulos de secao, sem variações:
- ## Estrategia de testes
- ## Dados de teste
- ## Riscos e metricas

## Estrategia de testes
Inclua testes unitarios, integracao, API, UI e E2E em no maximo 6 bullets.
- Cite explicitamente qual camada deve absorver o maior risco.
- Diga quando algo e "Nao se aplica" em vez de inventar cobertura.
- Cada bullet deve cobrir um angulo diferente da feature.

## Dados de teste
Inclua dados validos, invalidos, limites e cenarios de falha em no maximo 5 bullets.
- Se o requisito nao mencionar duplicidade, permissao extra ou comportamento opcional, nao crie bullet de "ponto a verificar" para isso.
- Dados de teste devem refletir o requisito atual, nao abrir novas decisoes de produto.

## Riscos e metricas
Liste apenas riscos criticos, impacto e sinais operacionais de acompanhamento em no maximo 5 bullets.
- Nao transforme risco em requisito.
- Se a metrica nao estiver definida no requisito, use sinais verificaveis e especificos, como taxa de erro do endpoint principal, tempo de resposta do submit, quantidade de rejeicoes por validacao ou presenca de log/auditoria.
- Nao use metricas genericas como "acompanhar falhas" sem dizer falhas de que.
- Nunca use "sinal: nenhum". Todo risco listado deve ter pelo menos um sinal observavel.
- Gere pelo menos 2 riscos realmente distintos entre validacao, persistencia, UX operacional, observabilidade e resiliencia.
- Inclua pelo menos 1 risco de validacao e 1 risco de resiliencia ou operacao.
"""
                planning_result = self._generate_block(
                    planning_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_PLANNING_NUM_PREDICT", "420"),
                )
                for title in ["Estrategia de testes", "Dados de teste", "Riscos e metricas"]:
                    body = self._extract_section(planning_result, title)
                    if not body:
                        if title == "Riscos e metricas":
                            body = "\n".join(self._synthesize_risk_lines(idea, requirement_summary, requirement_spec))
                        else:
                            raise RuntimeError(f"Bloco de planejamento sem secao {title}.")
                    sections[title] = body

                functional_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:
Use exatamente estes titulos de secao, sem variações:
- ## Cenarios de teste
- ## Casos de teste funcionais

## Cenarios de teste
Gere exatamente 10 itens numerados e variados:
- 3 cenarios de Caminho Feliz
- 3 cenarios de Excecao
- 2 cenarios de Limite
- 2 cenarios de Resiliencia
- Inclua explicitamente essas expressoes nos itens.
- Evite expressoes temporais fortes como "no exato momento", "imediatamente" ou equivalentes sem base no requisito.
- Cada item deve cobrir um comportamento diferente; nao repita cinco variacoes do mesmo submit com outra frase.
- Cenario de Limite deve usar fronteira real de tamanho, formato ou valor maximo/minimo aceito. Nao use campo vazio, dado nulo ou ausencia de preenchimento como limite.
- Os 10 itens precisam ficar equilibrados entre Caminho Feliz, Excecao, Limite e Resiliencia.
- Cada item precisa ser verificavel na pratica, com entrada e saida observaveis.
- Pelo menos 1 item de resiliencia deve citar comportamento apos falha, nao apenas repeticao de fluxo.

## Casos de teste funcionais
Gere exatamente 3 casos numerados.
Para cada caso, use explicitamente as linhas:
- Acao:
- Resultado esperado:
- Cada caso deve poder ser rastreado para um criterio de aceite concreto.
- Cada caso precisa apontar pelo menos 1 CA de forma clara no texto ou na descricao.
- Use exatamente o titulo "## Casos de teste funcionais" para esta secao.
"""
                functional_result = self._generate_block(
                    functional_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_FUNCTIONAL_NUM_PREDICT", "620"),
                )
                scenarios_body = self._extract_section(functional_result, "Cenarios de teste")
                if not scenarios_body:
                    scenarios_body = "\n".join(self._synthesize_scenarios(idea, requirement_summary, requirement_spec))
                sections["Cenarios de teste"] = scenarios_body

                functional_cases_body = self._extract_section(functional_result, "Casos de teste funcionais")
                if not functional_cases_body:
                    functional_cases_body = self._synthesize_functional_cases(idea, requirement_summary, requirement_spec)
                sections["Casos de teste funcionais"] = functional_cases_body

                traceability_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:
Use exatamente estes titulos de secao, sem variações:
- ## Rastreabilidade dos Criterios de Aceite
- ## Smoke Minimo da Feature

## Rastreabilidade dos Criterios de Aceite
- Liste entre 3 e 6 bullets no formato:
  - CA-01 -> testes/cenarios relacionados
- Faça a ponte entre criterios de aceite, regras de negocio e testes planejados.
- Se o requisito estiver fechado, nao use "Ponto a validar".
- Prefira ligar cada CA a verificacao concreta de UI, API, persistencia ou validacao.
- Cada CA deve apontar claramente para pelo menos 1 cenario de teste, 1 caso funcional e 1 smoke quando aplicavel.
- Se faltar criterio claro, escreva o gap de forma objetiva, sem inventar cobertura.

## Smoke Minimo da Feature
- Liste entre 3 e 5 verificacoes minimas de smoke que provam o fluxo principal.
- Cubra o essencial de UI/API/fluxo quando aplicavel.
- Se alguma camada nao se aplicar, escreva "Nao se aplica" na linha correspondente.
- Cada linha deve ser verificavel em execucao, nao apenas descritiva.
- Ao menos uma verificacao precisa comprovar persistencia real ou efeito observavel depois da acao principal.
"""
                traceability_result = self._generate_block(
                    traceability_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_TRACEABILITY_NUM_PREDICT", "360"),
                )
                traceability_body = self._extract_section(traceability_result, "Rastreabilidade dos Criterios de Aceite")
                if not traceability_body:
                    traceability_body = self._synthesize_traceability_lines(idea, requirement_summary, requirement_spec)
                sections["Rastreabilidade dos Criterios de Aceite"] = traceability_body

                smoke_body = self._extract_section(traceability_result, "Smoke Minimo da Feature")
                if not smoke_body:
                    smoke_body = "\n".join(self._synthesize_smoke_lines(idea, requirement_summary, requirement_spec))
                sections["Smoke Minimo da Feature"] = smoke_body

                quality_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:
Use exatamente estes titulos de secao, sem variações:
- ## Qualidade nao funcional
- ## Usabilidade e acessibilidade

## Qualidade nao funcional
Liste exatamente 4 bullets, um para cada topico abaixo, usando explicitamente estas palavras no inicio de cada bullet:
- Performance:
- Seguranca:
- Confiabilidade:
- Observabilidade:
- Baseie os bullets no requisito e no fluxo descrito.
- Nenhum bullet pode ficar vazio.
- Se algo nao estiver explicito, escreva de forma neutra como verificacao operacional, sem inventar comportamento de produto.
- Nao use numeros ou metas fechadas sem fonte no requisito.
- Cada bullet precisa mencionar um sinal pratico de verificacao, mesmo que simples.

## Usabilidade e acessibilidade
Liste checks objetivos cobrindo heuristicas de Nielsen, leis de UX e WCAG em no maximo 4 bullets.
- Se o requisito nao explicitar configuracoes de UI, trate como validacao de clareza, feedback, navegacao e acessibilidade, nao como feature confirmada.
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

                full_plan = self._sanitize_plan(self._build_full_plan(sections))
                full_plan = self._stabilize_plan(full_plan, idea, requirement_summary, requirement_spec)
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

    def process(self, idea, code_structure, requirement_spec=None):
        requirement_summary = self._summarize_requirements(code_structure)
        qa_model = os.getenv("QA_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv("QA_OLLAMA_TIMEOUT_SECONDS", previous_timeout or "45")

        try:
            result = self._generate_multi_block_plan(idea, requirement_summary, qa_model, requirement_spec=requirement_spec)
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar um plano de testes valido para esta tarefa.")

        return result
