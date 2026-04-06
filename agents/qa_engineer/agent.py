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
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

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

        # Reaproveita o slice no texto original usando o mesmo trecho normalizado como guia.
        matched_body_normalized = match.group(1).strip()
        if not matched_body_normalized:
            return ""

        original_sections = re.split(r"(?=^##\s+)", text, flags=re.MULTILINE)
        for section in original_sections:
            _, normalized_section = self._normalize_text(section)
            if normalized_section.startswith(f"## {normalized_title}"):
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

    def _generate_multi_block_plan(self, idea, requirement_summary, qa_model):
        base_context = f"""
Historia:
"{idea}"

Resumo estrutural dos requisitos:
{requirement_summary}

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
"""

        retry_count = max(1, int(os.getenv("QA_MAX_RETRIES", "1")))
        last_reason = "sem detalhes"

        for _attempt in range(1, retry_count + 1):
            sections = {}
            try:
                planning_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Estrategia de testes
Inclua testes unitarios, integracao, API, UI e E2E em no maximo 6 bullets.
- Cite explicitamente qual camada deve absorver o maior risco.
- Diga quando algo e "Nao se aplica" em vez de inventar cobertura.

## Dados de teste
Inclua dados validos, invalidos, limites e cenarios de falha em no maximo 5 bullets.

## Riscos e metricas
Liste apenas riscos criticos, impacto e sinais operacionais de acompanhamento em no maximo 5 bullets.
- Nao transforme risco em requisito.
- Se a metrica nao estiver definida no requisito, use linguagem neutra como "acompanhar falhas", "acompanhar tempo de resposta" ou "acompanhar entrega".
"""
                planning_result = self._generate_block(
                    planning_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_PLANNING_NUM_PREDICT", "420"),
                )
                for title in ["Estrategia de testes", "Dados de teste", "Riscos e metricas"]:
                    body = self._extract_section(planning_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco de planejamento sem secao {title}.")
                    sections[title] = body

                functional_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Cenarios de teste
Gere exatamente 10 itens numerados:
- 5 cenarios de caminho feliz numerados de 1. a 5.
- 5 cenarios de excecao numerados de 1. a 5.
- Inclua explicitamente a expressao "Caminho Feliz" nos 5 primeiros itens.
- Inclua explicitamente a expressao "Excecao" nos 5 ultimos itens.
- Evite expressoes temporais fortes como "no exato momento", "imediatamente" ou equivalentes sem base no requisito.

## Casos de teste funcionais
Gere pelo menos 3 casos numerados.
Para cada caso, use explicitamente as linhas:
- Acao:
- Resultado esperado:
"""
                functional_result = self._generate_block(
                    functional_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_FUNCTIONAL_NUM_PREDICT", "620"),
                )
                for title in ["Cenarios de teste", "Casos de teste funcionais"]:
                    body = self._extract_section(functional_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco funcional sem secao {title}.")
                    sections[title] = body

                traceability_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Rastreabilidade dos Criterios de Aceite
- Liste entre 3 e 6 bullets no formato:
  - CA-01 -> testes/cenarios relacionados
- Faça a ponte entre criterios de aceite, regras de negocio e testes planejados.
- Se algum criterio nao estiver claro, sinalize como "Ponto a validar".

## Smoke Minimo da Feature
- Liste entre 3 e 5 verificacoes minimas de smoke que provam o fluxo principal.
- Cubra o essencial de UI/API/fluxo quando aplicavel.
- Se alguma camada nao se aplicar, escreva "Nao se aplica" na linha correspondente.
"""
                traceability_result = self._generate_block(
                    traceability_prompt,
                    qa_model,
                    num_predict=os.getenv("QA_BLOCK_TRACEABILITY_NUM_PREDICT", "360"),
                )
                for title in ["Rastreabilidade dos Criterios de Aceite", "Smoke Minimo da Feature"]:
                    body = self._extract_section(traceability_result, title)
                    if not body:
                        raise RuntimeError(f"Bloco de rastreabilidade sem secao {title}.")
                    sections[title] = body

                quality_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

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

    def process(self, idea, code_structure):
        requirement_summary = self._summarize_requirements(code_structure)
        qa_model = os.getenv("QA_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv("QA_OLLAMA_TIMEOUT_SECONDS", previous_timeout or "45")

        try:
            result = self._generate_multi_block_plan(idea, requirement_summary, qa_model)
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar um plano de testes valido para esta tarefa.")

        return result
