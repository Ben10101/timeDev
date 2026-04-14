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
Architect Agent
Responsavel por consolidar a arquitetura tecnica do projeto a partir das historias refinadas
"""

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response
from agents.developer.response_validation import validate_architecture_output


class Architect:
    REQUIRED_SECTIONS = [
        "Visao Geral",
        "Stack Tecnologico",
        "Modulos e Responsabilidades",
        "Diagrama de Arquitetura",
        "Estrutura de Diretorios Sugerida",
        "Modelo de Dados e Entidades Principais",
        "Contratos e Integracoes",
        "Padroes de Design",
        "Observabilidade e Operacao",
        "Estrategia de Deploy",
        "Seguranca",
        "Riscos Tecnicos e Trade-offs",
        "Sequencia Recomendada de Implementacao",
    ]

    def __init__(self, project_id):
        self.project_id = project_id

    def _compact_project_context(self, project_context):
        context = project_context or {}
        project_dna = context.get("project_dna") or {}
        backlog_contract = context.get("backlog_contract") or {}

        if isinstance(project_dna, str):
            project_dna = {
                "summary": project_dna,
            }
        if isinstance(backlog_contract, str):
            backlog_contract = {
                "summary": backlog_contract,
            }

        compact = {
            "product_mode": project_dna.get("productMode"),
            "experience_style": project_dna.get("experienceStyle"),
            "primary_actor": project_dna.get("primaryActor"),
            "domain_language": project_dna.get("domainLanguage") or [],
            "allowed_screen_families": project_dna.get("allowedScreenFamilies") or [],
            "project_dna_summary": project_dna.get("summary"),
            "backlog_overview": backlog_contract.get("overview") or backlog_contract.get("summary"),
            "mvp_goal": None,
            "stories_sample": [],
        }

        release_slices = backlog_contract.get("releaseSlices") or []
        mvp_slice = next(
            (item for item in release_slices if "mvp" in str(item.get("name") or "").lower()),
            None,
        )
        if mvp_slice:
            compact["mvp_goal"] = mvp_slice.get("goal")

        stories = context.get("stories") or []
        compact["stories_sample"] = [
            {
                "taskUuid": story.get("taskUuid"),
                "title": story.get("title"),
            }
            for story in stories[:8]
            if story.get("title")
        ]

        compact_text = json.dumps(compact, ensure_ascii=False, indent=2).strip()
        return compact_text[:2800]

    def _normalize_text(self, value):
        text = (value or "").strip()
        normalized = unicodedata.normalize("NFD", text.lower())
        normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return text, normalized

    def _is_unusable_llm_response(self, result):
        if not result or is_error_text_response(result):
            return True

        normalized = result.strip().lower()
        return normalized.startswith("# documentacao gerada") or normalized.startswith("# documentacao gerada por ia")

    def _extract_first_matching_line(self, block, marker):
        lines = [line.strip() for line in (block or "").splitlines()]
        for index, line in enumerate(lines):
            if line.lower().startswith(marker):
                for candidate in lines[index + 1:]:
                    if candidate and not candidate.endswith(":"):
                        return candidate
        return None

    def _collect_bullets_after_marker(self, block, marker, max_items=2):
        lines = [line.rstrip() for line in (block or "").splitlines()]
        collecting = False
        bullets = []

        for raw_line in lines:
            line = raw_line.strip()
            normalized = line.lower()

            if normalized.startswith(marker):
                collecting = True
                continue

            if collecting and line.endswith(":") and not normalized.startswith(("-", "*")):
                break

            if collecting and re.match(r"^(\d+\.|[-*])\s+", line):
                bullets.append(line)
                if len(bullets) >= max_items:
                    break

        return bullets

    def _compact_requirements(self, requirements):
        text = (requirements or "").strip()
        if len(text) <= 9000:
            return text

        stories = [chunk.strip() for chunk in re.split(r"\n-{3,}\n", text) if chunk.strip()]
        compacted_blocks = []

        for story in stories:
            title = next(
                (line.strip() for line in story.splitlines() if line.strip().startswith("## Historia")),
                None,
            )
            refined_story = self._extract_first_matching_line(story, "user story refinada:")
            requirements_bullets = self._collect_bullets_after_marker(story, "requisitos funcionais:", max_items=2)
            rules_bullets = self._collect_bullets_after_marker(story, "regras de negocio:", max_items=2)

            lines = [line for line in [title, refined_story] if line]
            if requirements_bullets:
                lines.append("Requisitos chave:")
                lines.extend(requirements_bullets)
            if rules_bullets:
                lines.append("Regras chave:")
                lines.extend(rules_bullets)

            compacted_blocks.append("\n".join(lines))

        compacted_text = "\n\n---\n\n".join(compacted_blocks)
        if compacted_text:
            return compacted_text[:9000]

        return text[:9000]

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

    def _generate_block(self, prompt, architecture_model, *, num_predict):
        result = generate_text_from_llm(
            prompt,
            model=architecture_model,
            options_override={
                "temperature": 0.1,
                "num_predict": int(num_predict),
            },
            use_cache=False,
        )

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Resposta vazia ou invalida.")

        return result

    def _collect_required_sections(self, content, titles):
        sections = {}
        missing = []
        for title in titles:
            body = self._extract_section(content, title)
            if body:
                sections[title] = body
            else:
                missing.append(title)
        return sections, missing

    def _extract_missing_sections(self, reason):
        mapping = {self._normalize_text(title)[1]: title for title in self.REQUIRED_SECTIONS}
        match = re.search(r"Secoes ausentes:\s*(.+)$", reason or "", re.IGNORECASE)
        if not match:
            return []

        raw_sections = [item.strip() for item in match.group(1).split(",")]
        normalized_targets = []
        for item in raw_sections:
            _, normalized_item = self._normalize_text(item)
            if normalized_item in mapping:
                normalized_targets.append(mapping[normalized_item])
                continue
            for normalized_title, original_title in mapping.items():
                if normalized_item in normalized_title or normalized_title in normalized_item:
                    normalized_targets.append(original_title)
                    break

        deduped = []
        for title in normalized_targets:
            if title not in deduped:
                deduped.append(title)
        return deduped

    def _repair_missing_sections(self, base_context, block_result, missing_titles, architecture_model):
        if not missing_titles:
            return {}

        repaired_sections = {}
        still_missing = []

        for title in missing_titles:
            repair_prompt = f"""
{base_context}

ARQUITETURA PARCIAL JA GERADA
{block_result}

TAREFA
Complete somente a secao abaixo, em Markdown, usando exatamente o titulo informado.

## {title}

REGRAS
- Nao inclua nenhuma outra secao.
- Nao renomeie o titulo.
- Entregue entre 3 e 6 bullets objetivos ou um bloco curto equivalente.
- Se a secao for "Padroes de Design", cite explicitamente padroes, onde se aplicam e o motivo.
- Se a secao for "Contratos e Integracoes", cite endpoints, eventos ou integracoes relevantes.
- Se a secao for "Estrategia de Deploy", cubra ambientes, pipeline e rollout.
- Se a secao for "Seguranca", cubra autenticacao, autorizacao, dados sensiveis e auditoria.
"""
            repair_result = self._generate_block(
                repair_prompt,
                architecture_model,
                num_predict=os.getenv("ARCHITECT_BLOCK_REPAIR_NUM_PREDICT", "360"),
            )
            section_body = self._extract_section(repair_result, title)
            if section_body:
                repaired_sections[title] = section_body
            else:
                still_missing.append(title)

        if still_missing:
            raise RuntimeError(f"Reparo do bloco nao entregou secoes {', '.join(still_missing)}.")

        return repaired_sections

    def _repair_final_architecture(self, base_context, sections, reason, architecture_model):
        missing_titles = self._extract_missing_sections(reason)
        if not missing_titles:
            return sections

        current_document = self._build_full_architecture(sections)
        repaired_sections = self._repair_missing_sections(
            base_context,
            current_document,
            missing_titles,
            architecture_model,
        )

        merged = dict(sections)
        merged.update(repaired_sections)
        return merged

    def _build_full_architecture(self, sections):
        ordered_sections = []
        for title in self.REQUIRED_SECTIONS:
            body = self._sanitize_section_body(sections.get(title) or "", title=title)
            if body:
                ordered_sections.append(f"## {title}\n{body}")

        assembled = "\n\n".join(ordered_sections).strip()
        if not assembled:
            return "# ARQUITETURA DO PROJETO\n\nFIM_DA_ARQUITETURA"

        assembled = self._sanitize_section_body(assembled)
        return f"# ARQUITETURA DO PROJETO\n\n{assembled}\n\nFIM_DA_ARQUITETURA"

    def _fallback_diagram_body(self):
        return """```text
[Frontend Web]
      |
      v
[API / Backend]
      |
      +--> [Modulo de Chamados]
      +--> [Modulo de Atendimento]
      +--> [Modulo de Notificacoes]
      +--> [Modulo de Relatorios]
      |
      +--> [Banco de Dados]
      +--> [Storage de Arquivos]
```"""

    def _sanitize_section_body(self, body, title=None):
        text = (body or "").strip()
        if not text:
            return ""

        text = text.replace("---.", "---")
        text = text.replace("|.", "|")
        text = text.replace("```mermaid\n", "```mermaid\n")
        text = re.sub(r"^\s*---\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"\n\s*---\s*\n", "\n\n", text)

        if "```mermaid" in text and text.count("```") < 2:
            text = self._fallback_diagram_body()

        if text.count("```") % 2 != 0:
            text = f"{text.rstrip()}\n```"

        if "```mermaid" in text:
            mermaid_block = re.search(r"```mermaid\s*([\s\S]*?)```", text, re.IGNORECASE)
            if mermaid_block:
                mermaid_body = mermaid_block.group(1).strip()
                if len(mermaid_body.splitlines()) < 4 or mermaid_body.endswith(("->", "-->", "[")):
                    text = self._fallback_diagram_body()

        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"^\s*\.\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"\b([A-Za-z0-9_]+)\.java\b", r"\1.ts", text)
        text = text.replace("LocalDateTime", "Date")
        text = text.replace("Boolean", "boolean")
        text = text.replace("String", "string")
        text = text.replace("Integer", "number")

        banned_line_markers = [
            "sendgrid",
            "firebase",
            "fcm",
            "apns",
            "aws ses",
            "redis",
            "prometheus",
            "grafana",
            "pagerduty",
            "/metrics",
            "google oauth",
            "terminus",
            "typeorm",
        ]
        filtered_lines = []
        for line in text.splitlines():
            normalized_line = line.lower()
            if any(marker in normalized_line for marker in banned_line_markers):
                continue
            if normalized_line.strip().endswith(":."):
                continue
            filtered_lines.append(line)
        text = "\n".join(filtered_lines).strip()

        if title == "Padroes de Design":
            filtered_lines = []
            for line in text.splitlines():
                if "cqrs" in line.lower():
                    continue
                filtered_lines.append(line)
            text = "\n".join(filtered_lines).strip()

        if title == "Contratos e Integracoes":
            text = re.sub(r"```json\s*\{[\s\S]{0,400}?```", "", text, flags=re.IGNORECASE)
            filtered_lines = []
            for line in text.splitlines():
                stripped = line.strip()
                if stripped.startswith("- `") and stripped.count("`") % 2 != 0:
                    continue
                filtered_lines.append(line)
            text = "\n".join(filtered_lines).strip()
            text = re.sub(r"\n{3,}", "\n\n", text)

        if not text.strip():
            return ""

        last_line = text.splitlines()[-1].rstrip()
        if re.search(r"[:|*_\-/(\[{,;]$", last_line):
            text = f"{text.rstrip()}.\n"

        return text.strip()

    def _has_explicit_api_contract(self, compact_requirements, project_context=None):
        haystack = "\n".join(
            [
                str(compact_requirements or ""),
                json.dumps(project_context or {}, ensure_ascii=False),
            ]
        )
        return bool(
            re.search(r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+/[A-Za-z0-9_./{}-]+", haystack, re.IGNORECASE)
            or re.search(r"\bstatus\s+HTTP\s+\d{3}\b", haystack, re.IGNORECASE)
        )

    def _derive_story_titles(self, project_context=None):
        stories = (project_context or {}).get("stories") or []
        titles = []
        for story in stories:
            title = re.sub(r"\s+", " ", str(story.get("title") or "")).strip()
            if title:
                titles.append(title)
        return titles[:8]

    def _synthesize_contracts_section(self, compact_requirements, project_context=None):
        story_titles = self._derive_story_titles(project_context)
        signals = " ".join(story_titles + [str(compact_requirements or "")]).lower()
        lines = []
        if "criar o evento" in signals or "novo evento" in signals:
            lines.append("- Operacao de cadastro de evento: criar o evento com os campos essenciais definidos no refinamento e retornar confirmacao de sucesso sem assumir payload tecnico fechado.")
        if "escopo" in signals:
            lines.append("- Operacao de definicao de escopo: registrar volume estimado, formato e parametros principais vinculados ao evento ja existente, respeitando regras de validacao do requisito.")
        if "responsavel operacional" in signals:
            lines.append("- Operacao de responsavel operacional: vincular nome, contato e tipo de suporte a um evento, com contrato de entrada definido pela validacao de dominio.")
        if "participantes" in signals:
            lines.append("- Operacao de participantes: registrar ou atualizar a lista inicial de participantes de um evento sem assumir batch, fila ou integracao externa como obrigatorios.")
        if "aprovar" in signals or "reprovar" in signals:
            lines.append("- Operacao de decisao: registrar aprovacao ou reprovacao do registro operacional com justificativa e efeito observavel no status do fluxo.")
        if "historico" in signals:
            lines.append("- Operacao de historico: consultar alteracoes do evento em modo somente leitura, com trilha auditavel de quem alterou, o que mudou e quando.")
        if "pesquisar" in signals or "busca" in signals:
            lines.append("- Operacao de pesquisa: consultar eventos por termo ou referencia usando filtros compatíveis com os campos explicitados no backlog e nos refinamentos.")
        if "encerrar" in signals:
            lines.append("- Operacao de encerramento: concluir o fluxo do evento somente quando as condicoes do requisito forem satisfeitas, registrando o efeito de fechamento de forma auditavel.")
        if not lines:
            lines = [
                "- Contratos do MVP: expor poucas operacoes nucleares alinhadas as historias refinadas, com validacao de entrada, resposta observavel e persistencia auditavel.",
                "- Integracoes externas: nao se aplicam como dependencia obrigatoria do MVP atual; priorizar modulo interno unico e contratos HTTP simples.",
                "- Decisoes assumidas para o MVP: detalhes de endpoint, payload e codigos HTTP devem ser fechados na implementacao tecnica, e nao inferidos a partir do backlog.",
            ]
        else:
            lines.append("- Integracoes externas: nao se aplicam como dependencia obrigatoria do MVP atual; manter fronteiras internas simples e contratos evolutivos.")
            lines.append("- Decisoes assumidas para o MVP: nomes de endpoint, payload detalhado e codigos HTTP exatos so devem ser fechados quando o time consolidar a API de implementacao.")
        return "\n".join(lines[:6])

    def _synthesize_risks_section(self, compact_requirements, project_context=None):
        signals = " ".join(self._derive_story_titles(project_context) + [str(compact_requirements or "")]).lower()
        risks = [
            "- Risco: regras de validacao espalhadas entre modulos de evento, participantes e aprovacao -> impacto: comportamento inconsistente entre telas e fluxos; mitigacao: centralizar regras de dominio em services e schemas compartilhados.",
            "- Risco: transicoes de status e decisoes financeiras ocorrerem sem trilha auditavel suficiente -> impacto: perda de rastreabilidade operacional e contestacao de decisao; mitigacao: registrar ator, timestamp e justificativa em todas as mudancas sensiveis.",
            "- Risco: busca e listagens crescerem sem estrategia minima de indices e filtros -> impacto: degradacao de tempo de resposta no uso operacional; mitigacao: modelar consultas principais cedo e revisar indices conforme os cenarios de uso do MVP.",
        ]
        if "participantes" in signals:
            risks.append(
                "- Risco: cadastro de participantes gerar duplicidade ou persistencia parcial em cargas maiores -> impacto: lista inconsistente e retrabalho operacional; mitigacao: validar unicidade e tratar gravacao da lista com consistencia transacional."
            )
        return "\n".join(risks[:4])

    def _synthesize_sequence_section(self, compact_requirements, project_context=None):
        return "\n".join(
            [
                "1. Fundacao do MVP: modelar entidades centrais, autenticacao simples por roles, CRUD inicial de evento e trilha basica de auditoria.",
                "2. Fluxo operacional: implementar escopo, responsavel operacional, participantes, consulta de resumo e pesquisa com validacoes coerentes entre frontend e backend.",
                "3. Governanca: implementar registro operacional, decisao de aprovacao, historico de mudancas e encerramento do evento com regras de bloqueio e rastreabilidade.",
                "4. Evolucao futura: revisar contratos tecnicos detalhados, observabilidade ampliada e otimizações de performance somente apos estabilidade do fluxo principal.",
            ]
        )

    def _normalize_architecture_sections(self, sections, compact_requirements, project_context=None):
        normalized_sections = dict(sections)

        contracts_body = self._sanitize_section_body(normalized_sections.get("Contratos e Integracoes") or "", title="Contratos e Integracoes")
        if (
            not contracts_body
            or not self._has_explicit_api_contract(compact_requirements, project_context)
            or re.search(r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+/[A-Za-z0-9_./{}-]+", contracts_body, re.IGNORECASE)
        ):
            normalized_sections["Contratos e Integracoes"] = self._synthesize_contracts_section(
                compact_requirements,
                project_context,
            )
        else:
            normalized_sections["Contratos e Integracoes"] = contracts_body

        risks_body = self._sanitize_section_body(normalized_sections.get("Riscos Tecnicos e Trade-offs") or "", title="Riscos Tecnicos e Trade-offs")
        risk_count = len(re.findall(r"(?:^|\n)\s*[-*]\s+", risks_body))
        if risk_count < 3 or re.search(r"\bmitigac[aã]o\s*$", risks_body, re.IGNORECASE):
            normalized_sections["Riscos Tecnicos e Trade-offs"] = self._synthesize_risks_section(
                compact_requirements,
                project_context,
            )
        else:
            normalized_sections["Riscos Tecnicos e Trade-offs"] = risks_body

        sequence_body = self._sanitize_section_body(normalized_sections.get("Sequencia Recomendada de Implementacao") or "", title="Sequencia Recomendada de Implementacao")
        sequence_count = len(re.findall(r"(?:^|\n)\s*(?:\d+[\.\)]|[-*]\s+)", sequence_body))
        if sequence_count < 3 or "FIM_DA_ARQUITETURA" in sequence_body or re.search(r"rollback\s+via\s+`[^`]*$", sequence_body, re.IGNORECASE):
            normalized_sections["Sequencia Recomendada de Implementacao"] = self._synthesize_sequence_section(
                compact_requirements,
                project_context,
            )
        else:
            normalized_sections["Sequencia Recomendada de Implementacao"] = sequence_body

        return normalized_sections

    def _generate_multi_block_architecture(self, idea, compact_requirements, architecture_model, project_context=None):
        compact_project_context = self._compact_project_context(project_context)
        base_context = f"""
Voce e um Arquiteto de Software Principal.

PROJETO
ID: {self.project_id}

BRIEFING
{idea}

RESUMO DAS HISTORIAS
{compact_requirements}

CONTRATO ESTRUTURADO DO PROJETO
{compact_project_context}

REGRAS GERAIS
- Responda em portugues.
- Nao invente escopo fora das historias.
- Seja tecnico, objetivo e economico em tokens.
- Nao inclua introducao nem conclusao fora das secoes pedidas.
- Prefira bullets curtos, contratos claros e decisoes implementaveis.
- Trate isto como arquitetura de MVP implementavel, nao como arquitetura enterprise aspiracional.
- Priorize web-first, backend REST simples e modular monolith antes de mobile, microsservicos ou plataforma distribuida.
- Quando nao houver stack obrigatoria explicita no briefing, prefira a stack-base desta factory: React + TypeScript + Vite no frontend, Node.js + Express no backend, Prisma como ORM e PostgreSQL como banco relacional.
- Nao trate endpoint, payload, codigo HTTP, indice, timeout, retry ou integracao externa como decisao fechada sem evidencia explicita nas historias ou no contrato do projeto.
- Quando precisar assumir uma decisao tecnica para o MVP, marque como "Decisao assumida para o MVP:" em vez de apresentar como requisito confirmado.
- Se o briefing e as historias nao pedirem explicitamente, nao use como escolha principal: React Native, GraphQL, CQRS, Event Sourcing, Redis, Kafka, Kubernetes, EKS, Keycloak, Firebase, SMS, LaunchDarkly, Terraform, Helm, PagerDuty ou Grafana/Prometheus.
- Quando citar evolucoes futuras, deixe-as claramente separadas do MVP e em no maximo 1 ou 2 bullets por secao.
- O stack principal deve caber no contexto atual do produto e da esteira: frontend web, backend HTTP, banco relacional, auth/roles, logs, healthcheck e deploy simples.
- Cada secao obrigatoria deve ter densidade real e pelo menos 3 bullets ou um equivalente claramente tecnico quando a estrutura for mais curta.
- Evite vendor lock-in e nomes de produtos cloud como padrao, a menos que estejam explicitamente pedidos.
- Mantenha consistencia de linguagem e stack em todo o documento: se o backend for Node/Nest, exemplos de pastas, arquivos, tipos e classes devem ser TypeScript, nunca Java/.java.
- Nao deixe exemplos ou blocos truncados; se incluir payload/exemplo, feche-o completamente.
- Nao misture frameworks de backend ou runtime no mesmo documento. Escolha uma linha principal e sustente-a ate o fim.
- Cada secao obrigatoria precisa ter densidade real: nao aceite texto genérico de uma linha para Operacao, Riscos, Deploy, Seguranca ou Contratos.
- Em Observabilidade e Operacao, inclua pelo menos logs, metricas/sinais, alerta ou acompanhamento e estrategia de recovery.
- Em Riscos Tecnicos e Trade-offs, inclua pelo menos 3 riscos distintos com impacto e mitigacao.
- Em Sequencia Recomendada de Implementacao, entregue pelo menos 3 passos ordenados.
- Em Contratos e Integracoes, descreva contratos concretos, mesmo que simples, em vez de apenas citar "API" ou "integracao".
"""

        retry_count = max(1, int(os.getenv("ARCHITECT_MAX_RETRIES", "2")))
        last_reason = "sem detalhes"

        for _attempt in range(1, retry_count + 1):
            sections = {}
            try:
                foundation_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Visao Geral

## Stack Tecnologico

REGRAS ESPECIFICAS
- Liste a stack principal do MVP agora.
- Prefira algo como frontend web + backend REST + PostgreSQL.
- Prefira explicitamente: React + TypeScript + Vite, Node.js + Express, Prisma e PostgreSQL.
- Se houver evolucao futura relevante, coloque no maximo 1 bullet final iniciado por "Evolucao futura:".
- Nao troque Express/Prisma por NestJS/TypeORM sem necessidade explicita muito forte no backlog.
- Nao misture com convenÃ§Ãµes Java, Spring, .NET, arquivos `.java` ou tipos como `LocalDateTime`.
- Se escolher Node/Nest, nao misture com convenções Java, Spring ou arquivos `.java`.

## Modulos e Responsabilidades

## Diagrama de Arquitetura
Use Mermaid ou ASCII curto.
- Diagrama curto, com poucos blocos, refletindo um sistema implementavel agora.
"""
                foundation_result = self._generate_block(
                    foundation_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_FOUNDATION_NUM_PREDICT", "700"),
                )
                foundation_titles = [
                    "Visao Geral",
                    "Stack Tecnologico",
                    "Modulos e Responsabilidades",
                    "Diagrama de Arquitetura",
                ]
                foundation_sections, missing_foundation = self._collect_required_sections(foundation_result, foundation_titles)
                if missing_foundation:
                    foundation_sections.update(
                        self._repair_missing_sections(base_context, foundation_result, missing_foundation, architecture_model)
                    )
                sections.update(foundation_sections)

                design_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Estrutura de Diretorios Sugerida
- Use exemplos de pastas e arquivos coerentes com o stack escolhido.
- Para o stack padrao da factory, exemplos de backend devem parecer `src/routes`, `src/controllers`, `src/services`, `src/repositories`, `src/middlewares`, `src/lib/prisma.ts`.
- Nunca use estrutura Java, Spring ou .NET como exemplo se o stack principal for Node.js.
- Se o backend for Node/Nest, use nomes `.ts` e estrutura de módulos/controllers/services típica de TypeScript.

## Modelo de Dados e Entidades Principais

REGRAS ESPECIFICAS
- Modele somente entidades e campos bem sustentados pelo backlog/refinamentos.
- Nao antecipe QR code, foto, biometria, push, SSO corporativo, integrações externas ou event store como parte central se ainda nao forem necessarios no MVP.

## Contratos e Integracoes

REGRAS ESPECIFICAS
- Prefira contratos REST simples e poucos endpoints nucleares.
- Nao invente integracoes corporativas externas como LDAP/AD, RH, catracas ou impressoras como parte obrigatoria do MVP sem base explicita.
- Se as historias nao fecharem contrato de API, descreva operacoes de negocio e fronteiras do modulo sem forcar nome de endpoint ou codigo HTTP.
- Se incluir exemplo de request/response, entregue JSON completo e curto, sem cortar no meio.
- Se nao houver seguranca suficiente para montar um JSON completo e curto, liste somente endpoint + finalidade, sem exemplo.
- Se o MVP nao exigir integracao externa, deixe isso explicito em vez de sugerir SendGrid, Firebase, SES, FCM, APNS ou equivalentes como parte central.

## Padroes de Design
- Prefira padroes simples e justificaveis para o estagio atual.
- Evite CQRS/Event Sourcing como padrao principal, salvo necessidade explicita muito forte.
- Prefira Service + Repository + schema validation + RBAC simples.
- Nao cite CQRS, mesmo "leve", neste projeto.
"""
                design_result = self._generate_block(
                    design_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_DESIGN_NUM_PREDICT", "760"),
                )
                design_titles = [
                    "Estrutura de Diretorios Sugerida",
                    "Modelo de Dados e Entidades Principais",
                    "Contratos e Integracoes",
                    "Padroes de Design",
                ]
                design_sections, missing_design = self._collect_required_sections(design_result, design_titles)
                if missing_design:
                    design_sections.update(
                        self._repair_missing_sections(base_context, design_result, missing_design, architecture_model)
                    )
                sections.update(design_sections)

                operations_prompt = f"""
{base_context}

Gere APENAS estas secoes em Markdown:

## Observabilidade e Operacao
Cubra logs, metricas, alertas, suporte operacional e recovery.
- Entregue no minimo 3 bullets.
- Cite pelo menos 1 sinal de observabilidade, 1 ponto de alerta e 1 acao de recovery.
- Traga explicitamente logs, uma ou mais metricas/sinais, um alerta pratico e uma acao de recovery em bullets separados.

REGRAS ESPECIFICAS
- Mantenha observabilidade proporcional ao MVP: logs estruturados, healthcheck, poucos indicadores operacionais.
- Evite vendors e stacks de observabilidade enterprise como padrao do MVP sem necessidade explicita.
- Nao proponha `/metrics` Prometheus, Grafana, PagerDuty, Terminus ou stacks similares como base do MVP.

## Estrategia de Deploy

- Descreva deploy simples e implementavel agora. Prefira ambientes basicos e pipeline direta.
- Nao assuma Kubernetes, canario, blue/green, Terraform ou feature flags corporativas como base.
- Prefira Docker Compose + processo Node + proxy reverso simples.

## Seguranca

- Cubra autenticacao, autorizacao, protecao de dados e auditoria de forma pragmatica para o MVP.
- Nao assuma SSO corporativo, Azure AD, Keycloak, WAF enterprise ou requisitos bancarios sem base explicita.
- Prefira JWT + roles + hashing de senha + trilha de auditoria simples.
- Entregue pelo menos 3 bullets e nao deixe seguranca como frase de apoio apenas.

## Riscos Tecnicos e Trade-offs
- Liste pelo menos 3 riscos com impacto e mitigacao.
- Inclua trade-off real entre simplicidade, custo, operacao ou evolucao futura.
- Cada risco deve citar impacto e mitigacao clara, sem ficar em frase conceitual.

## Sequencia Recomendada de Implementacao
- Separar claramente MVP agora vs evolucao futura.
- Entregue no minimo 3 passos curtos, na ordem em que o time deveria implementar.
- Garanta que o primeiro passo seja o mais viavel agora e que o ultimo aponte a evolucao futura.
"""
                operations_result = self._generate_block(
                    operations_prompt,
                    architecture_model,
                    num_predict=os.getenv("ARCHITECT_BLOCK_OPERATIONS_NUM_PREDICT", "760"),
                )
                operations_titles = [
                    "Observabilidade e Operacao",
                    "Estrategia de Deploy",
                    "Seguranca",
                    "Riscos Tecnicos e Trade-offs",
                    "Sequencia Recomendada de Implementacao",
                ]
                operations_sections, missing_operations = self._collect_required_sections(operations_result, operations_titles)
                if missing_operations:
                    operations_sections.update(
                        self._repair_missing_sections(base_context, operations_result, missing_operations, architecture_model)
                    )
                sections.update(operations_sections)
                sections = self._normalize_architecture_sections(
                    sections,
                    compact_requirements,
                    project_context=project_context,
                )

                full_architecture = self._build_full_architecture(sections)
                is_complete, reason = validate_architecture_output(full_architecture)
                if is_complete:
                    return full_architecture

                repaired_sections = self._repair_final_architecture(
                    base_context,
                    sections,
                    reason or "",
                    architecture_model,
                )
                repaired_sections = self._normalize_architecture_sections(
                    repaired_sections,
                    compact_requirements,
                    project_context=project_context,
                )
                repaired_architecture = self._build_full_architecture(repaired_sections)
                repaired_ok, repaired_reason = validate_architecture_output(repaired_architecture)
                if repaired_ok:
                    return repaired_architecture

                last_reason = repaired_reason or reason or "Arquitetura considerada incompleta."
            except Exception as error:
                last_reason = str(error) or "Falha ao montar a arquitetura."

        raise RuntimeError(
            f"O agente architect nao conseguiu gerar uma resposta completa apos {retry_count} tentativas. "
            f"Ultimo motivo: {last_reason}"
        )

    def process(self, idea, requirements, project_context=None):
        architecture_model = os.getenv("ARCHITECT_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        previous_timeout = os.environ.get("OLLAMA_REQUEST_TIMEOUT_SECONDS")
        os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = os.getenv(
            "ARCHITECT_OLLAMA_TIMEOUT_SECONDS",
            previous_timeout or "120",
        )

        compact_requirements = self._compact_requirements(requirements)

        try:
            result = self._generate_multi_block_architecture(
                idea,
                compact_requirements,
                architecture_model,
                project_context=project_context,
            )
        finally:
            if previous_timeout is None:
                os.environ.pop("OLLAMA_REQUEST_TIMEOUT_SECONDS", None)
            else:
                os.environ["OLLAMA_REQUEST_TIMEOUT_SECONDS"] = previous_timeout

        if self._is_unusable_llm_response(result):
            raise RuntimeError("Nenhum modelo de IA conseguiu gerar uma arquitetura valida para este projeto.")

        return result
