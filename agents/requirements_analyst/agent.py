# -*- coding: utf-8 -*-
import os
import re
import sys

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

"""
Requirements Analyst Agent
Refinamento detalhado de User Story em nivel pronto para desenvolvimento
"""

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response
from agents.developer.response_validation import validate_requirements_output


class RequirementsAnalyst:
    SECTION_TITLES = [
        "User Story Refinada",
        "Requisitos Funcionais",
        "Fluxo Principal",
        "Fluxos Alternativos",
        "Fluxos de Excecao",
        "Regras de Negocio",
        "Estados da Interface e Feedback",
        "Validacoes e Dados",
        "Permissoes e Auditoria",
        "Criterios de Aceite (BDD)",
    ]

    SECTION_KEYS = {
        "user story refinada": "User Story Refinada",
        "requisitos funcionais": "Requisitos Funcionais",
        "fluxo principal": "Fluxo Principal",
        "fluxos alternativos": "Fluxos Alternativos",
        "fluxos de excecao": "Fluxos de Excecao",
        "regras de negocio": "Regras de Negocio",
        "estados da interface e feedback": "Estados da Interface e Feedback",
        "validacoes e dados": "Validacoes e Dados",
        "permissoes e auditoria": "Permissoes e Auditoria",
        "criterios de aceite": "Criterios de Aceite (BDD)",
    }

    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, backlog):
        prompt = self._build_main_prompt(idea, backlog)
        max_retries = max(1, int(os.getenv("REQUIREMENTS_MAX_RETRIES", "1")))
        base_num_predict = int(os.getenv("REQUIREMENTS_LLM_NUM_PREDICT", "1800"))
        last_reason = "sem detalhes"

        for attempt in range(1, max_retries + 1):
            current_prompt = prompt
            if attempt > 1:
                current_prompt = (
                    f"{prompt}\n\n"
                    "IMPORTANTE: sua resposta anterior foi considerada incompleta. "
                    f"Motivo detectado: {last_reason}. "
                    "Gere novamente o refinamento completo, sem omitir secoes e sem interromper no meio."
                )

            result = generate_text_from_llm(
                current_prompt,
                options_override={
                    "temperature": 0.1,
                    "num_predict": int(base_num_predict * (1.4 ** (attempt - 1))),
                },
                use_cache=False,
            )

            if not result or is_error_text_response(result):
                last_reason = "Resposta vazia ou invalida."
                continue

            sanitized = self._sanitize_requirements(result)
            is_complete, reason = validate_requirements_output(sanitized)
            if is_complete:
                return sanitized

            repaired = self._repair_requirements(sanitized, idea, backlog, reason or "")
            repaired = self._sanitize_requirements(repaired)
            is_complete, repaired_reason = validate_requirements_output(repaired)
            if is_complete:
                return repaired

            last_reason = repaired_reason or reason or "Refinamento considerado incompleto."

        raise RuntimeError(
            f"O agente requirements_analyst nao conseguiu gerar uma resposta completa apos {max_retries} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def _build_main_prompt(self, idea, backlog):
        return f"""
Voce e um Analista de Requisitos Senior especializado em transformar User Stories em requisitos funcionais claros, completos e sem ambiguidades.

Sua unica missao e refinar requisitos para implementacao.

REGRAS CRITICAS:
- Voce esta refinando apenas UMA unica User Story
- NAO expanda escopo
- NAO crie novas funcionalidades fora da historia
- NAO invente modulos, dashboards, relatorios ou integracoes
- NAO invente prazo, SLA, frequencia, intervalo, tempo limite, link, canal configuravel, autosave, notificacao extra ou regra operacional sem evidencia explicita
- NAO transforme uma boa ideia em requisito confirmado
- NAO assuma escolha de canal, preferencia configuravel, atualizacao de preferencia, notificacao para equipe interna ou acao de outro ator sem base textual
- Quando a User Story citar "SMS ou e-mail", interprete isso apenas como canais possiveis, nunca como preferencia ou escolha explicita do paciente, salvo evidencia textual.
- Se um detalhe nao estiver sustentado pela User Story ou pelo contexto curto, trate como lacuna
- Seja direto, tecnico e implementavel
- Elimine qualquer ambiguidade

---

ENTRADA

User Story:
"{idea}"

Contexto curto do backlog/projeto (apenas referencia, NAO expandir escopo):
{backlog}

---

TAREFA

Refinar a User Story em requisitos completos seguindo EXATAMENTE a estrutura abaixo:

HIERARQUIA DE EVIDENCIA:
1. A User Story e a fonte principal da verdade
2. O contexto curto do backlog so pode ajudar a interpretar o dominio
3. Qualquer detalhe nao sustentado deve virar premissa ou ponto a validar, nunca regra confirmada

COMO LIDAR COM INFORMACAO FALTANTE:
- Se faltar dado operacional, use linguagem neutra
- Se faltar regra de negocio, registre como "Ponto a validar"
- Se existir mais de uma interpretacao plausivel, escolha a mais conservadora
- Nao adicione numeros ou comportamentos especificos sem base textual
- Prefira "o sistema deve permitir" apenas quando a historia realmente afirmar isso
- Evite frases como "deve enviar 24h antes", "deve conter link", "deve ocorrer uma vez por dia" sem evidencia explicita
- Evite frases como "paciente escolhe o canal", "recepcionista e notificado", "sistema atualiza preferencia" ou "novo lembrete e gerado" sem evidencia explicita
- Se a historia disser apenas "por SMS ou e-mail", escreva "via SMS ou e-mail" ou "pelos canais previstos", sem introduzir configuracao, selecao ou preferencia.

SECAO OPCIONAL:
- Quando houver lacunas reais, inclua ao final uma secao "## Premissas e Pontos a Validar"
- Nessa secao, liste apenas itens que NAO puderam ser confirmados pela historia
- Essa secao nao substitui requisitos; ela evita invencao

---

# REFINAMENTO DE REQUISITO

## User Story Refinada
(Reescreva a historia de forma clara, especifica e objetiva)

---

## Requisitos Funcionais

### RF-01
- Descricao:
- Atores:
- Entradas:
- Processamento:
- Saidas:

(Adicionar quantos RFs forem necessarios, sem extrapolar escopo)

---

## Fluxo Principal
(Passo a passo numerado do fluxo principal)

---

## Fluxos Alternativos
(Variacoes validas do fluxo principal)

---

## Fluxos de Excecao
(Erros e comportamentos do sistema)

---

## Regras de Negocio
(Lista numerada, clara e sem ambiguidade)

---

## Estados da Interface e Feedback
- Liste estados relevantes como carregando, vazio, sucesso, erro, bloqueado ou "Nao se aplica".
- Se a historia nao expuser interface direta, escreva "Nao se aplica" e justifique em uma linha.

---

## Validacoes e Dados
- Liste campos, validacoes, formatos, obrigatoriedades, consistencia e "Ponto a validar" quando faltar evidência.
- Se a historia nao exigir entrada de dados, escreva "Nao se aplica" e justifique em uma linha.

---

## Permissoes e Auditoria
- Liste quem pode executar, aprovar, visualizar, editar, auditar ou "Nao se aplica".
- Registre necessidade de rastreabilidade, historico ou justificativa quando houver decisao sensivel.
- Se a historia nao exigir controle adicional, escreva "Nao se aplica" e justifique em uma linha.

---

## Criterios de Aceite (BDD)

DADO que ...
QUANDO ...
ENTAO ...

(Incluir cenarios positivos, negativos e edge cases)

---

DIRETRIZES FINAIS:
- Seja extremamente claro e tecnico
- Nada pode ficar implicito
- Escreva como se um desenvolvedor fosse implementar diretamente
- Se faltar informacao, sinalize a lacuna sem inventar a regra
- Toda especificidade adicionada deve estar rastreavel a historia ou ao contexto curto
- Encerre OBRIGATORIAMENTE a resposta com a linha exata: FIM_DO_REFINAMENTO
"""

    def _extract_missing_sections(self, reason):
        match = re.search(r"Secoes ausentes:\s*(.+)$", reason or "", re.IGNORECASE)
        if not match:
            return []
        raw_sections = [item.strip().lower() for item in match.group(1).split(",")]
        return [self.SECTION_KEYS[item] for item in raw_sections if item in self.SECTION_KEYS]

    def _extract_sections(self, content):
        sections = {}
        text = (content or "").strip()
        for title in self.SECTION_TITLES:
            pattern = re.compile(
                rf"^##\s+{re.escape(title)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
                re.IGNORECASE | re.MULTILINE,
            )
            match = pattern.search(text)
            if match:
                sections[title] = match.group(1).strip()
        premissas_pattern = re.compile(
            r"^##\s+Premissas e Pontos a Validar\s*$([\s\S]*?)(?=^##\s+|\Z)",
            re.IGNORECASE | re.MULTILINE,
        )
        premissas_match = premissas_pattern.search(text)
        if premissas_match:
            sections["Premissas e Pontos a Validar"] = premissas_match.group(1).strip()
        return sections

    def _build_document(self, sections):
        ordered = []
        for title in self.SECTION_TITLES:
            body = (sections.get(title) or "").strip()
            if body:
                ordered.append(f"## {title}\n{body}")
        premissas = (sections.get("Premissas e Pontos a Validar") or "").strip()
        if premissas:
            ordered.append(f"## Premissas e Pontos a Validar\n{premissas}")
        assembled = "\n\n---\n\n".join(ordered).strip()
        if not assembled:
            return "FIM_DO_REFINAMENTO"
        if "FIM_DO_REFINAMENTO" not in assembled:
            assembled = f"{assembled}\n\nFIM_DO_REFINAMENTO"
        return assembled

    def _repair_requirements(self, current_text, idea, backlog, reason):
        sections = self._extract_sections(current_text)
        missing_sections = self._extract_missing_sections(reason)

        if "criterios de aceite" in (reason or "").lower() and "Criterios de Aceite (BDD)" not in missing_sections:
            missing_sections.append("Criterios de Aceite (BDD)")

        if not missing_sections:
            return current_text

        current_document = self._build_document(sections)
        repair_prompt = f"""
Voce vai reparar um refinamento de requisitos incompleto.

User Story:
"{idea}"

Contexto curto do backlog/projeto:
{backlog}

Rascunho atual:
{current_document}

Motivo do reparo:
{reason or "Documento incompleto."}

Tarefa:
- Gere APENAS as secoes faltantes ou incompletas listadas abaixo.
- Nao repita secoes que ja estao corretas.
- Nao invente funcionalidades, SLA, links, janelas de tempo, preferencia de canal ou comportamento extra sem base textual.
- Se faltar informacao, use linguagem neutra ou registre como ponto a validar.
- Em "Criterios de Aceite (BDD)", use obrigatoriamente DADO, QUANDO e ENTAO.

Secoes para reparar:
{chr(10).join(f"## {section}" for section in missing_sections)}
"""

        repair_result = generate_text_from_llm(
            repair_prompt,
            options_override={
                "temperature": 0.1,
                "num_predict": int(os.getenv("REQUIREMENTS_REPAIR_NUM_PREDICT", "900")),
            },
            use_cache=False,
        )

        if not repair_result or is_error_text_response(repair_result):
            return current_text

        repaired_sections = self._extract_sections(repair_result)
        for section in missing_sections:
            body = (repaired_sections.get(section) or "").strip()
            if body:
                sections[section] = body

        return self._build_document(sections)

    def _sanitize_requirements(self, content):
        text = (content or "").strip()
        if not text:
            return ""

        replacements = {
            "após a confirmação da marcação.": "de acordo com o fluxo definido pelo produto.",
            "apos a confirmacao da marcacao.": "de acordo com o fluxo definido pelo produto.",
            "canal de comunicação preferencial (SMS ou e-mail) especificado durante a marcação": "canal de comunicacao definido para o envio do lembrete",
            "canal de comunicacao preferencial (SMS ou e-mail) especificado durante a marcacao": "canal de comunicacao definido para o envio do lembrete",
            "seleciona SMS ou e-mail como canal de comunicação preferencial": "segue o canal de comunicacao definido pelo produto",
            "seleciona SMS ou e-mail como canal de comunicacao preferencial": "segue o canal de comunicacao definido pelo produto",
            "Paciente altera o canal de comunicação preferencial:": "Ponto a validar sobre alteracao de canal:",
            "Paciente altera o canal de comunicacao preferencial:": "Ponto a validar sobre alteracao de canal:",
            "o sistema deve atualizar o canal de comunicação preferencial do paciente no banco de dados e gerar um novo lembrete no novo canal.": "registrar como ponto a validar caso o produto permita alteracao de canal apos a marcacao.",
            "o sistema deve atualizar o canal de comunicacao preferencial do paciente no banco de dados e gerar um novo lembrete no novo canal.": "registrar como ponto a validar caso o produto permita alteracao de canal apos a marcacao.",
            "o sistema registra a falha e notifica o recepcionista.": "o sistema registra a falha conforme definicao operacional do produto.",
            "o sistema deve registrar o falha no envio do e-mail e notificar o recepcionista.": "o sistema deve registrar a falha no envio conforme definicao operacional do produto.",
            "o recepcionista deve ser notificado da falha no envio do e-mail.": "a falha no envio deve ser tratada conforme definicao operacional do produto.",
        }

        for source, target in replacements.items():
            text = text.replace(source, target)

        text = re.sub(r"canal de comunica(?:ç|c)ao preferencial", "canal de envio", text, flags=re.IGNORECASE)
        text = re.sub(
            r"paciente\s+(?:marca|agend[aou]*)\s+consulta\s+e\s+seleciona\s+sms\s+ou\s+e-mail\s+como\s+canal\s+de\s+(?:comunicacao\s+preferencial|envio)",
            "o sistema identifica a consulta agendada e prepara o envio do lembrete por SMS ou e-mail",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"paciente\s+tenha\s+optado\s+por\s+e-mail", "o envio ocorrer por e-mail", text, flags=re.IGNORECASE)
        text = re.sub(r"paciente\s+tenha\s+optado\s+por\s+sms", "o envio ocorrer por SMS", text, flags=re.IGNORECASE)
        text = re.sub(
            r"nao ha configuracao de preferencia",
            "nao ha definicao adicional de canal",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"a escolha do paciente por um canal especifico",
            "uma definicao explicita de canal pelo paciente",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"canal de envio e determinado conforme dados do paciente",
            "o canal de envio deve seguir a definicao do produto e os dados disponiveis para contato",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"o lembrete deve conter a data,\s*o horario e o profissional da consulta\.?",
            "o lembrete deve conter as informacoes da consulta conforme definicao do produto.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"Ponto a validar:\s*Qual a antecedencia do envio do lembrete\s*\([^)]*\)\??",
            "Ponto a validar: definir a antecedencia do envio do lembrete.",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"Ponto a validar:\s*qual a antecedencia do envio do lembrete\s*\([^)]*\)\??",
            "Ponto a validar: definir a antecedencia do envio do lembrete.",
            text,
            flags=re.IGNORECASE,
        )

        return text
