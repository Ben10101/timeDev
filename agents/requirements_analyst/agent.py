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

    SECTION_ALIASES = {
        "User Story Refinada": ["User Story Refinada", "User Story"],
        "Requisitos Funcionais": ["Requisitos Funcionais", "RFs", "Requisitos"],
        "Fluxo Principal": ["Fluxo Principal", "Fluxo"],
        "Fluxos Alternativos": ["Fluxos Alternativos", "Alternativas"],
        "Fluxos de Excecao": ["Fluxos de Excecao", "Excecoes"],
        "Regras de Negocio": ["Regras de Negocio", "Regras"],
        "Estados da Interface e Feedback": ["Estados da Interface e Feedback", "Estados", "Feedback"],
        "Validacoes e Dados": ["Validacoes e Dados", "Validacoes", "Dados"],
        "Permissoes e Auditoria": ["Permissoes e Auditoria", "Permissoes", "Auditoria"],
        "Criterios de Aceite (BDD)": ["Criterios de Aceite (BDD)", "Criterios de Aceite", "BDD"],
    }

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

    def _normalize_text(self, value):
        return re.sub(r"\s+", " ", str(value or "").strip().lower())

    def _classify_story_type(self, idea):
        normalized = self._normalize_text(idea)
        if "definir escopo" in normalized:
            return "scope-definition"
        if "cadastrar" in normalized:
            return "register"
        if "criar" in normalized:
            return "create"
        if "registrar" in normalized:
            return "record"
        if "aprovar" in normalized or "reprovar" in normalized:
            return "approval"
        if "visualizar" in normalized or "consultar" in normalized:
            return "view"
        if "atualizar status" in normalized or "alterar status" in normalized:
            return "status-update"
        return "generic"

    def _extract_domain_vocabulary(self, backlog):
        match = re.search(r"Linguagem do dominio:\s*(.+)", str(backlog or ""), re.IGNORECASE)
        if not match:
            return []
        return [item.strip() for item in match.group(1).split(",") if item.strip()]

    def _extract_actor(self, idea):
        match = re.search(r"como\s+([^,]+)", str(idea or ""), re.IGNORECASE)
        return match.group(1).strip() if match else "usuario autenticado"

    def _infer_entity(self, idea, backlog):
        normalized = self._normalize_text(f"{idea} {backlog}")
        if "evento" in normalized:
            return "evento"
        if "visita" in normalized:
            return "visita"
        if "visitante" in normalized:
            return "visitante"
        if "responsavel operacional" in normalized:
            return "responsavel operacional"
        return "registro principal"

    def _infer_scope_fields(self, idea):
        normalized = self._normalize_text(idea)
        fields = []
        if "volume" in normalized:
            fields.append(("Volume estimado", "numero inteiro positivo", "Sim", "minimo 1"))
        if "formato" in normalized:
            fields.append(("Formato da visita", "lista predefinida", "Sim", "valor controlado"))
        if "parametro" in normalized or "contexto" in normalized or "escopo" in normalized:
            fields.append(("Parametros principais", "texto curto", "Nao", "maximo 240 caracteres"))
        if (" data " in f" {normalized} " or " hora " in f" {normalized} ") and "escopo" not in normalized:
            fields.append(("Data/hora prevista", "data/hora", "Sim", "nao pode ser no passado"))
        if not fields:
            fields.append(("Campo principal da feature", "texto", "Sim", "conforme regra da historia"))
        unique_fields = []
        seen_fields = set()
        for field in fields:
            if field[0] in seen_fields:
                continue
            seen_fields.add(field[0])
            unique_fields.append(field)
        return unique_fields[:4]

    def _prune_scope_definition_content(self, content, idea):
        text = (content or "").strip()
        if not text:
            return ""

        normalized_idea = self._normalize_text(idea)
        concept_rules = [
            (("data/hora prevista", "data prevista", "hora prevista"), (" data ", " hora ")),
            (("duracao estimada", "duração estimada"), ("duracao", "duração")),
            (("areas da empresa", "áreas da empresa", "area da empresa", "área da empresa"), ("area", "área")),
            (("acesso especial",), ("acesso especial",)),
            (("estimativa de recursos", "recursos iniciais"), ("recurso",)),
            (("salvar como rascunho", "rascunho"), ("rascunho",)),
            (("responsavel interno", "responsável interno"), ("responsavel interno", "responsável interno")),
        ]

        for forbidden_terms, allow_tokens in concept_rules:
            if any(token in normalized_idea for token in allow_tokens):
                continue
            pattern = "|".join(re.escape(term) for term in forbidden_terms)
            text = re.sub(rf"(?im)^.*(?:{pattern}).*$\n?", "", text)

        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _prune_initial_registration_content(self, content, idea):
        text = (content or "").strip()
        if not text:
            return ""

        story_type = self._classify_story_type(idea)
        if story_type not in {"create", "record"}:
            return text

        normalized_idea = self._normalize_text(idea)
        if not any(
            marker in normalized_idea
            for marker in ["contexto inicial", "dados iniciais", "iniciar o fluxo", "antes da aprovacao", "antes da aprovação"]
        ):
            return text

        guarded_concepts = [
            (("identificador unico", "identificador único", "numero sequencial", "número sequencial", "id gerado"), ("identificador", "id", "numero", "número")),
            (("status inicial", "status aguardando", "status registrado", "status pendente", "aguardando aprovacao", "aguardando aprova??o", "pendente de analise", "pendente de an?lise"), ("status",)),
            (("timestamp de criacao", "timestamp de criação", "data/hora de criacao", "data/hora de criação", "registrar data/hora de criacao", "registrar data/hora de criação"), ("timestamp", "data/hora de criacao", "data/hora de criação")),
            (("protocolo",), ("protocolo",)),
        ]

        for forbidden_terms, allow_tokens in guarded_concepts:
            if any(token in normalized_idea for token in allow_tokens):
                continue
            pattern = "|".join(re.escape(term) for term in forbidden_terms)
            text = re.sub(rf"(?im)^.*(?:{pattern}).*$\n?", "", text)

        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _synthesize_missing_sections(self, sections, idea, backlog, missing_sections):
        story_type = self._classify_story_type(idea)
        actor = self._extract_actor(idea)
        entity = self._infer_entity(idea, backlog)
        field_specs = self._infer_scope_fields(idea)

        if "Requisitos Funcionais" in missing_sections or not re.search(r"###\s*RF-?0*1", sections.get("Requisitos Funcionais", ""), re.IGNORECASE):
            inputs = "\n".join([f"- {field}: {field_type}" for field, field_type, _, _ in field_specs[:4]])
            output_lines = [
                f"### RF-01 - Registro principal de {entity.title()}",
                f"- Descricao: Permitir que {actor} execute a acao principal da historia sem expandir para etapas posteriores.",
                f"- Atores: {actor}",
                "- Entradas:",
                inputs,
                "- Processamento:",
                "- Validar obrigatoriedade e formato dos dados desta etapa",
                "- Registrar apenas as informacoes necessarias para a acao central",
                "- Saidas:",
                f"- Confirmacao do registro da etapa de {entity}",
                "- Visualizacao resumida dos dados informados",
            ]
            sections["Requisitos Funcionais"] = "\n".join(output_lines)

        if "Fluxos de Excecao" in missing_sections and not sections.get("Fluxos de Excecao"):
            first_field = field_specs[0][0]
            sections["Fluxos de Excecao"] = (
                f"**FE-01 - Campo obrigatorio invalido**\n"
                f"- Sistema detecta {first_field.lower()} ausente ou invalido\n"
                f"- Sistema exibe mensagem clara e impede continuidade\n"
                f"- Fluxo retorna ao preenchimento\n\n"
                f"**FE-02 - Dado fora da regra da historia**\n"
                f"- Sistema detecta valor fora do limite ou formato esperado\n"
                f"- Sistema destaca o campo problemático\n"
                f"- {actor} corrige e tenta novamente"
            )

        if "Regras de Negocio" in missing_sections and not sections.get("Regras de Negocio"):
            rules = []
            for index, (field, _, required, validation) in enumerate(field_specs, start=1):
                required_text = "obrigatorio" if required.lower() == "sim" else "opcional"
                rules.append(f"{index}. {field} e {required_text} e deve respeitar a regra: {validation}.")
            if story_type == "scope-definition":
                rules.append(f"{len(rules)+1}. O registro de escopo da {entity} nao deve introduzir identificador, protocolo, aprovacao ou status de workflow nesta etapa.")
            sections["Regras de Negocio"] = "\n".join(rules[:6])

        if "Validacoes e Dados" in missing_sections and not sections.get("Validacoes e Dados"):
            lines = []
            for field, field_type, required, validation in field_specs:
                lines.append(f"- {field}: {field_type}, obrigatorio: {required}, validacao: {validation}.")
            sections["Validacoes e Dados"] = "\n".join(lines)

        if "Permissoes e Auditoria" in missing_sections and not sections.get("Permissoes e Auditoria"):
            sections["Permissoes e Auditoria"] = (
                f"- Execucao: {actor}.\n"
                f"- Visualizacao: perfis autorizados do fluxo de {entity}.\n"
                f"- Auditoria: registrar usuario responsavel, data/hora e alteracoes relevantes desta etapa."
            )

        if "Criterios de Aceite (BDD)" in missing_sections and not sections.get("Criterios de Aceite (BDD)"):
            main_field = field_specs[0][0]
            sections["Criterios de Aceite (BDD)"] = (
                f"DADO que {actor} acessa a funcionalidade da {entity}\n"
                f"QUANDO informa os dados obrigatorios e confirma a operacao\n"
                f"ENTAO o sistema registra a etapa com sucesso e exibe confirmacao adequada\n\n"
                f"DADO que {actor} deixa {main_field.lower()} ausente ou invalido\n"
                f"QUANDO tenta confirmar a operacao\n"
                f"ENTAO o sistema bloqueia a continuidade e exibe mensagem clara\n\n"
                f"DADO que existe dado fora da regra definida para a etapa\n"
                f"QUANDO o sistema valida a solicitacao\n"
                f"ENTAO a operacao nao e concluida ate que a inconsistencia seja corrigida"
            )

        return sections

    def _build_scope_definition_document(self, idea, backlog):
        actor = self._extract_actor(idea)
        entity = self._infer_entity(idea, backlog)
        entity_ref = "do evento" if entity == "evento" else f"da {entity}"
        field_specs = self._infer_scope_fields(idea)
        user_story = (
            f"Como {actor}, eu quero registrar o escopo básico {entity_ref} "
            "com os parâmetros iniciais necessários, para dimensionar a operação sem antecipar etapas posteriores do fluxo."
        )
        requirements = [
            "### RF-01 - Registro de Escopo Básico",
            f"- Descricao: Permitir que {actor} registre apenas os parâmetros iniciais necessários para o escopo {entity_ref}.",
            f"- Atores: {actor}",
            "- Entradas:",
        ]
        for field, field_type, _, _ in field_specs[:4]:
            requirements.append(f"- {field}: {field_type}")
        requirements.extend([
            "- Processamento:",
            "- Validar obrigatoriedade e formato dos dados da etapa",
            "- Registrar somente os parâmetros de escopo informados",
            "- Saidas:",
            f"- Confirmação do registro do escopo {entity_ref}",
            "- Resumo dos parâmetros informados",
        ])
        rules = []
        validations = []
        for index, (field, field_type, required, validation) in enumerate(field_specs, start=1):
            req_text = "obrigatorio" if required.lower() == "sim" else "opcional"
            rules.append(f"{index}. {field} e {req_text} e deve respeitar a regra: {validation}.")
            validations.append(f"- {field}: {field_type}, obrigatorio: {required}, validacao: {validation}.")
        rules.append(f"{len(rules)+1}. Esta etapa registra apenas escopo da {entity}; nao define aprovacao, protocolo, status de workflow ou identificador da entidade.")

        sections = {
            "User Story Refinada": user_story,
            "Requisitos Funcionais": "\n".join(requirements),
            "Fluxo Principal": (
                f"1. {actor} acessa a funcionalidade de escopo {entity_ref}\n"
                "2. Sistema apresenta os campos iniciais da etapa\n"
                "3. Usuário informa os parâmetros de escopo exigidos\n"
                "4. Usuário confirma o registro\n"
                "5. Sistema valida os dados\n"
                "6. Sistema grava o escopo e exibe confirmação"
            ),
            "Fluxos Alternativos": (
                "**FA-01 - Cancelamento antes da confirmação**\n"
                "- Usuário cancela a operação antes de confirmar\n"
                "- Sistema descarta dados não confirmados e retorna à tela inicial"
            ),
            "Fluxos de Excecao": (
                "**FE-01 - Campo obrigatório ausente**\n"
                "- Sistema identifica dado obrigatório não informado\n"
                "- Sistema exibe mensagem clara e impede a continuidade\n\n"
                "**FE-02 - Dado fora da regra definida**\n"
                "- Sistema identifica valor fora do formato ou limite aceito\n"
                "- Sistema solicita correção antes de concluir a etapa"
            ),
            "Regras de Negocio": "\n".join(rules[:6]),
            "Estados da Interface e Feedback": (
                "- Carregando: durante a validação e gravação.\n"
                "- Sucesso: após registro do escopo.\n"
                "- Erro: quando houver inconsistência de validação.\n"
                "- Vazio: formulário inicial sem dados."
            ),
            "Validacoes e Dados": "\n".join(validations),
            "Permissoes e Auditoria": (
                f"- Execucao: {actor}.\n"
                f"- Visualizacao: perfis autorizados da operação {entity_ref}.\n"
                "- Auditoria: registrar usuário responsável e data/hora da ação."
            ),
            "Criterios de Aceite (BDD)": (
                f"DADO que {actor} acessa a funcionalidade de escopo {entity_ref}\n"
                "QUANDO informa os dados obrigatórios e confirma a operação\n"
                "ENTAO o sistema registra o escopo e exibe confirmação adequada\n\n"
                f"DADO que {actor} deixa um campo obrigatório sem preenchimento\n"
                "QUANDO tenta confirmar a operação\n"
                "ENTAO o sistema bloqueia a continuidade e informa o erro\n\n"
                "DADO que um valor é informado fora do formato ou limite aceito\n"
                "QUANDO o sistema valida os dados\n"
                "ENTAO a operação não é concluída até que a inconsistência seja corrigida"
            ),
        }
        return self._build_document(sections)

    def _build_view_summary_document(self, idea, backlog):
        actor = self._extract_actor(idea)
        entity = self._infer_entity(idea, backlog)
        entity_ref = "do evento" if entity == "evento" else f"da {entity}"
        user_story = (
            f"Como {actor}, eu quero visualizar o resumo {entity_ref} "
            "com escopo, base operacional e status atual, para confirmar se o planejamento inicial esta completo."
        )
        sections = {
            "User Story Refinada": user_story,
            "Requisitos Funcionais": (
                "### RF-01 - Visualizacao do resumo consolidado\n"
                f"- Descricao: Permitir que {actor} consulte o resumo consolidado {entity_ref}, em modo somente leitura.\n"
                f"- Atores: {actor}\n"
                "- Entradas: Nao se aplica\n"
                "- Processamento:\n"
                "- Recuperar os dados consolidados da etapa\n"
                "- Exibir escopo, base operacional e status atual em modo somente leitura\n"
                "- Indicar ausencia de informacoes quando algum bloco do resumo nao estiver disponivel\n"
                "- Saidas:\n"
                "- Resumo consolidado exibido\n"
                "- Indicacao visual de que o planejamento inicial pode ser conferido"
            ),
            "Fluxo Principal": (
                f"1. {actor} acessa o resumo consolidado {entity_ref}\n"
                "2. Sistema carrega os dados disponiveis\n"
                "3. Sistema exibe escopo, base operacional e status atual\n"
                "4. Usuario confere se o planejamento inicial esta completo\n"
                "5. Sistema mantem a tela em modo somente leitura"
            ),
            "Fluxos Alternativos": (
                "**FA-01 - Dados parciais**\n"
                "- Sistema exibe o resumo com os blocos disponiveis\n"
                "- Sistema sinaliza quais informacoes ainda nao foram consolidadas\n\n"
                "**FA-02 - Falha ao carregar o resumo**\n"
                "- Sistema informa a indisponibilidade do carregamento\n"
                "- Usuario pode tentar novamente"
            ),
            "Fluxos de Excecao": (
                "**FE-01 - Base operacional ausente**\n"
                "- Sistema nao encontra dados suficientes para compor o resumo\n"
                "- Sistema exibe mensagem clara sobre informacoes pendentes\n\n"
                "**FE-02 - Falha tecnica ao carregar dados**\n"
                "- Sistema registra o erro de leitura\n"
                "- Sistema informa indisponibilidade temporaria"
            ),
            "Regras de Negocio": (
                "1. A visualizacao do resumo nao altera dados da entidade.\n"
                "2. O status atual e apenas informativo nesta tela.\n"
                "3. A base operacional e o escopo devem ser exibidos somente se houver dados consolidados.\n"
                "4. A tela permanece em modo somente leitura.\n"
                "5. A consulta deve respeitar as permissoes do perfil autenticado."
            ),
            "Estados da Interface e Feedback": (
                "- Carregando: enquanto o resumo e montado.\n"
                "- Sucesso: quando o resumo e exibido.\n"
                "- Vazio: quando ainda nao houver base operacional consolidada.\n"
                "- Erro: quando o carregamento falhar."
            ),
            "Validacoes e Dados": (
                "- Escopo: texto consolidado exibido sem edicao.\n"
                "- Base operacional: resumo informativo somente leitura.\n"
                "- Status atual: valor exibido de forma consistente com o contexto.\n"
                "- Identificacao da entidade: Ponto a validar se o acesso sera por selecao, lista ou contexto predefinido."
            ),
            "Permissoes e Auditoria": (
                f"- Execucao: {actor} autenticado.\n"
                "- Visualizacao: perfis autorizados para leitura do resumo.\n"
                "- Auditoria: registrar acesso ao resumo e consulta realizada."
            ),
            "Criterios de Aceite (BDD)": (
                f"DADO que {actor} acessa o resumo consolidado {entity_ref}\n"
                "QUANDO a tela carrega com sucesso\n"
                "ENTAO o sistema exibe escopo, base operacional e status atual em modo somente leitura\n\n"
                f"DADO que parte das informacoes ainda nao foi consolidada\n"
                "QUANDO o usuario acessa o resumo\n"
                "ENTAO o sistema exibe os blocos disponiveis e sinaliza o que esta pendente\n\n"
                "DADO que ocorre falha tecnica ao carregar os dados\n"
                "QUANDO a consulta e processada\n"
                "ENTAO o sistema informa indisponibilidade temporaria sem alterar dados"
            ),
        }
        return self._build_document(sections)

    def process(self, idea, backlog):
        prompt = self._build_main_prompt(idea, backlog)
        max_retries = max(2, int(os.getenv("REQUIREMENTS_MAX_RETRIES", "2")))
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

            sanitized = self._apply_story_type_guardrails(self._sanitize_requirements(result), idea)
            is_complete, reason = validate_requirements_output(sanitized)
            if is_complete:
                return sanitized

            repaired = self._repair_requirements(sanitized, idea, backlog, reason or "")
            repaired = self._apply_story_type_guardrails(self._sanitize_requirements(repaired), idea)
            is_complete, repaired_reason = validate_requirements_output(repaired)
            if is_complete:
                return repaired

            deterministic = self._complete_requirements_deterministically(repaired, idea, backlog, repaired_reason or reason or "")
            deterministic = self._apply_story_type_guardrails(self._sanitize_requirements(deterministic), idea)
            is_complete, deterministic_reason = validate_requirements_output(deterministic)
            if is_complete:
                return deterministic

            if self._classify_story_type(idea) == "scope-definition" and (
                "identificacao indevida" in (deterministic_reason or "")
                or "bleed de dominio" in (deterministic_reason or "").lower()
            ):
                scope_safe = self._apply_story_type_guardrails(self._sanitize_requirements(self._build_scope_definition_document(idea, backlog)), idea)
                scope_ok, scope_reason = validate_requirements_output(scope_safe)
                if scope_ok:
                    return scope_safe
                deterministic_reason = scope_reason or deterministic_reason
            if self._classify_story_type(idea) == "view" and (
                "workflow" in (deterministic_reason or "").lower()
                or "identificacao indevida" in (deterministic_reason or "").lower()
                or "bleed de dominio" in (deterministic_reason or "").lower()
            ):
                view_safe = self._apply_story_type_guardrails(self._sanitize_requirements(self._build_view_summary_document(idea, backlog)), idea)
                view_ok, view_reason = validate_requirements_output(view_safe)
                if view_ok:
                    return view_safe
                deterministic_reason = view_reason or deterministic_reason

            last_reason = deterministic_reason or repaired_reason or reason or "Refinamento considerado incompleto."

        raise RuntimeError(
            f"O agente requirements_analyst nao conseguiu gerar uma resposta completa apos {max_retries} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def _build_main_prompt(self, idea, backlog):
        story_type = self._classify_story_type(idea)
        domain_vocabulary = self._extract_domain_vocabulary(backlog)
        domain_vocabulary_text = ", ".join(domain_vocabulary) if domain_vocabulary else "nao informado"
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
- O documento final deve ser implementavel sem interpretacao generica em fluxo principal, validacoes, regras e criterios de aceite
- Cada secao obrigatoria precisa ter densidade real; uma linha generica nao basta para campos centrais, permissao ou auditoria
- Se houver campo central da feature, descreva pelo menos formato base, obrigatoriedade e regra minima implementavel
- Em Validacoes e Dados, detalhe formato, obrigatoriedade, limites, valores controlados e consistencia com o contexto
- Em Permissoes e Auditoria, diga quem executa, quem visualiza, quem aprova quando aplicavel e o que deve ficar rastreado
- Em Criterios de Aceite (BDD), cubra caminho feliz, falha de validacao e edge case relevante quando houver evidencia suficiente
- Use exatamente os titulos de secao abaixo, sem variacoes, abreviacoes ou sinônimos:
  - ## User Story Refinada
  - ## Requisitos Funcionais
  - ## Fluxo Principal
  - ## Fluxos Alternativos
  - ## Fluxos de Excecao
  - ## Regras de Negocio
  - ## Estados da Interface e Feedback
  - ## Validacoes e Dados
  - ## Permissoes e Auditoria
  - ## Criterios de Aceite (BDD)

---

ENTRADA

User Story:
"{idea}"

Contexto curto do backlog/projeto (apenas referencia, NAO expandir escopo):
{backlog}

Tipo estrutural da story:
{story_type}

Vocabulário central do dominio:
{domain_vocabulary_text}

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
- Para campos centrais da feature (por exemplo nome, contato, tipo, data, identificador, responsavel, visitante, autorizacao), NAO deixe a definicao principal como "Ponto a validar".
- Se um campo central existir na historia, voce deve especificar pelo menos formato base, obrigatoriedade e regra conservadora minima implementavel.
- Use "Ponto a validar" apenas para detalhes secundarios, nunca para o significado do campo principal da feature.
- Para campos de contato, prefira contrato fechado e conservador, por exemplo: "e-mail ou telefone", com formato e obrigatoriedade explicitos.
- Para campos de tipo, categoria ou suporte, prefira lista predefinida, enum ou conjunto controlado de valores. Evite "texto livre" para o campo principal.
- So use "texto livre" para campo central quando a propria historia exigir claramente descricao aberta.
- A clausula de beneficio da historia ("para ...") explica objetivo de negocio e contexto, mas NAO cria um segundo fluxo principal por si so.
- Nao crie RF separado para efeito posterior, vinculo, painel, consulta ou operacao derivada quando a acao principal da historia for cadastro, criacao, registro, aprovacao ou atualizacao.
- Quando a historia tiver uma unica acao central, mantenha um unico RF principal; efeitos posteriores devem aparecer em processamento, saidas, regras ou criterios de aceite, nao como nova funcionalidade.
- Para historias de cadastro/criacao/registro com uma unica acao central, gere EXATAMENTE 1 RF principal, a menos que a historia traga explicitamente uma segunda acao de usuario independente.
- Preserve rigorosamente o vocabulario do dominio informado. Nao troque "visita" por "evento", "chamado", "solicitacao" ou outra entidade de outro contexto.
- Se a story for do tipo "scope-definition", foque apenas em parametros de escopo. Nao introduza ID sequencial, numero da entidade, status de workflow, aprovacao, protocolo ou ciclo de vida completo, salvo se isso estiver explicitamente na historia.
- Se a story for do tipo "create" ou "record" com foco em contexto inicial, dados iniciais ou cadastro minimo, NAO antecipe status, protocolo, timestamp, identificador, aprovacao ou ciclo posterior, salvo quando a propria historia pedir isso de forma explicita.
- Para stories de criacao/registro, descreva a confirmacao do cadastro e os dados salvos, mas nao transforme consequencias de workflow em nucleo do requisito.
- Se a story for do tipo "view", nao invente comandos de cadastro, aprovacao, alteracao ou processamento.
- Se a story for do tipo "view" ou "summary", trate status atual e base operacional apenas como dados exibidos em modo somente leitura. Nao converta a historia em fluxo de cadastro, workflow, aprovacao, protocolo ou identificacao.
- Se a story for do tipo "approval", nao invente campos de criacao pertencentes a etapas anteriores.
- Em Fluxos Alternativos, prefira cancelamento ou correcao de dados com impacto real no fluxo; evite bullets genéricos como "limpar campos" sem comportamento adicional.
- Em Saídas, privilegie a confirmação da criacao do evento e so destaque identificador quando ele for efetivamente parte da historia ou do criterio de aceite.

DECISOES PADRAO CONSERVADORAS:
- Se a historia citar "contato" sem detalhar, feche como "e-mail ou telefone".
- Se a historia citar "tipo", "categoria" ou "suporte" sem detalhar, feche como lista predefinida curta e controlada.
- Se a historia citar identificador, considere identificador unico gerado pelo sistema.
- Se a historia for de cadastro, o efeito posterior da historia deve aparecer em saidas, regras ou criterios de aceite, nao como novo RF.
- Se estiver em duvida entre omitir secao e usar uma regra conservadora simples, prefira a regra conservadora simples.

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
            for alias in self.SECTION_ALIASES.get(title, [title]):
                pattern = re.compile(
                    rf"^##\s+{re.escape(alias)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
                    re.IGNORECASE | re.MULTILINE,
                )
                match = pattern.search(text)
                if match:
                    sections[title] = match.group(1).strip()
                    break
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
        normalized_reason = (reason or "").lower()
        rebuild_full_document = len(missing_sections) >= 3

        if "criterios de aceite" in normalized_reason and "Criterios de Aceite (BDD)" not in missing_sections:
            missing_sections.append("Criterios de Aceite (BDD)")
        if "campos centrais da feature" in normalized_reason:
            for section in [
                "Requisitos Funcionais",
                "Regras de Negocio",
                "Validacoes e Dados",
                "Permissoes e Auditoria",
            ]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "campo central de contato precisa de contrato mais fechado" in normalized_reason:
            for section in ["Requisitos Funcionais", "Validacoes e Dados", "Regras de Negocio"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "campo central de tipo precisa de contrato mais fechado" in normalized_reason:
            for section in ["Requisitos Funcionais", "Validacoes e Dados", "Regras de Negocio"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "escopo expandido com funcionalidade derivada" in normalized_reason:
            for section in ["Requisitos Funcionais", "Fluxo Principal", "Regras de Negocio", "Criterios de Aceite (BDD)"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "bleed de dominio" in normalized_reason:
            for section in ["User Story Refinada", "Requisitos Funcionais", "Fluxo Principal", "Regras de Negocio"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "story de escopo expandiu para workflow" in normalized_reason:
            for section in ["Requisitos Funcionais", "Fluxo Principal", "Regras de Negocio", "Validacoes e Dados"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "identificacao indevida" in normalized_reason:
            for section in ["Requisitos Funcionais", "Fluxo Principal", "Regras de Negocio", "Validacoes e Dados", "Criterios de Aceite (BDD)"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "workflow" in normalized_reason and self._classify_story_type(idea) == "view":
            for section in ["User Story Refinada", "Requisitos Funcionais", "Fluxo Principal", "Regras de Negocio", "Validacoes e Dados", "Criterios de Aceite (BDD)"]:
                if section not in missing_sections:
                    missing_sections.append(section)
        if "regras de negocio insuficientes" in normalized_reason and "Regras de Negocio" not in missing_sections:
            missing_sections.append("Regras de Negocio")

        if not missing_sections:
            return current_text

        current_document = self._build_document(sections)
        repair_scope = "Reescreva o documento inteiro, preservando apenas o escopo da historia." if rebuild_full_document else "Gere APENAS as secoes faltantes ou incompletas listadas abaixo."
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
- {repair_scope}
- Se reescrever o documento inteiro, mantenha EXATAMENTE a estrutura obrigatoria do refinamento.
- Se nao reescrever o documento inteiro, nao repita secoes que ja estao corretas.
- Nao invente funcionalidades, SLA, links, janelas de tempo, preferencia de canal ou comportamento extra sem base textual.
- Se faltar informacao, use linguagem neutra ou registre como ponto a validar.
- Campos centrais da feature NAO podem permanecer como "Ponto a validar". Defina formato base, obrigatoriedade e regra minima implementavel para esses campos.
- Para contato central, feche o contrato com formato conservador como e-mail, telefone ou ambos. Nao deixe como texto livre.
- Para tipo, categoria ou suporte central, feche o contrato com lista controlada, enum ou conjunto predefinido. Nao deixe como texto livre.
- Nao transforme a clausula "para ..." em novo RF. Se a historia descreve uma unica acao central, mantenha um unico RF principal e mova efeitos derivados para processamento, saidas, regras ou BDD.
- Se a historia for de cadastro/criacao/registro com uma unica acao central, gere EXATAMENTE 1 RF principal.
- Preserve o vocabulario do dominio do backlog. Se a historia for de visitas, nao use "evento" ou linguagem de outro dominio.
- Se a historia for de escopo/configuracao, remova qualquer expansao para workflow, status, aprovacao, protocolo, ID, UUID, GUID ou timestamp como parte do requisito, salvo se a propria historia disser isso explicitamente.
- Em "Criterios de Aceite (BDD)", use obrigatoriamente DADO, QUANDO e ENTAO.

Secoes para reparar:
{chr(10).join(f"## {section}" for section in missing_sections)}
"""

        repair_result = generate_text_from_llm(
            repair_prompt,
            options_override={
                "temperature": 0.1,
                "num_predict": int(os.getenv("REQUIREMENTS_REPAIR_NUM_PREDICT", "1200")),
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

        still_missing = [section for section in missing_sections if not (sections.get(section) or "").strip()]
        if still_missing:
            sections = self._synthesize_missing_sections(sections, idea, backlog, still_missing)

        return self._build_document(sections)

    def _complete_requirements_deterministically(self, current_text, idea, backlog, reason):
        sections = self._extract_sections(current_text)
        missing_sections = self._extract_missing_sections(reason)
        if not missing_sections:
            missing_sections = [
                section
                for section in self.SECTION_TITLES
                if not (sections.get(section) or "").strip()
            ]
        normalized_reason = (reason or "").lower()
        if "requisitos funcionais sem rfs estruturados" in normalized_reason and "Requisitos Funcionais" not in missing_sections:
            missing_sections.append("Requisitos Funcionais")
        if not missing_sections:
            return current_text
        sections = self._synthesize_missing_sections(sections, idea, backlog, missing_sections)
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

    def _apply_story_type_guardrails(self, content, idea):
        text = (content or "").strip()
        if not text:
            return ""

        if self._classify_story_type(idea) == "scope-definition":
            replacements = {
                "com identificador ??nico": "com confirma????o do registro",
                "com identificador unico": "com confirma????o do registro",
                "com ID gerado": "com confirma????o do registro",
                "com ID da visita": "com confirma????o do registro",
                "com n??mero da solicita????o": "com confirma????o do registro",
            }
            for source, target in replacements.items():
                text = text.replace(source, target)

            text = re.sub(r"(?im)^.*\bidentificador unico\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bnumero sequencial\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bprotocolo\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\btimestamp\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\buuid\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bguid\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bstatus\b.*$\n?", "", text)
            text = self._prune_scope_definition_content(text, idea)
        elif self._classify_story_type(idea) == "view":
            text = re.sub(r"(?im)^.*\bworkflow\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\baprov(a|á)cao\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bcadastro\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bcriar\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bregistrar\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bidentificador\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\buuid\b.*$\n?", "", text)
            text = re.sub(r"(?im)^.*\bguid\b.*$\n?", "", text)
            text = re.sub(r"\n{3,}", "\n\n", text)

        text = self._prune_initial_registration_content(text, idea)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
