# -*- coding: utf-8 -*-
"""
Shared helpers for the legacy developer pipeline.

This module keeps the old single "developer" contract compatible while
allowing backend and frontend specializations to produce focused artifacts.
"""

from __future__ import annotations

import sys
import re

from agents.developer.llm_service import get_attributes_from_llm


def extract_domain_entities(idea: str) -> list[str]:
    lower_idea = str(idea or "").lower()
    entities = []

    detection_rules = [
        (["chamado", "ticket", "atendimento", "solicitacao", "solicitação"], "Ticket"),
        (["usuario", "usuário", "user", "conta", "account"], "User"),
        (["tarefa", "task", "todo", "item"], "Task"),
        (["projeto", "project"], "Project"),
        (["equipe", "team", "grupo"], "Team"),
        (["comentario", "comentário", "comment", "nota", "note"], "Comment"),
        (["notificacao", "notificação", "notification", "alerta"], "Notification"),
        (["arquivo", "file", "documento", "document"], "File"),
        (["relatorio", "relatório", "report", "analise", "análise", "analytics"], "Report"),
    ]

    for aliases, label in detection_rules:
        if any(alias in lower_idea for alias in aliases):
            entities.append(label)

    if not entities:
        return ["Item"]

    if "User" in entities and len(entities) > 1 and entities[0] == "User":
        entities.append(entities.pop(0))

    return entities


def extract_entity_attributes(idea: str) -> list[dict]:
    print("[Developer] Chamando LLM para extrair atributos...", file=sys.stderr)
    attributes = get_attributes_from_llm(idea)
    if attributes:
        print(
            f"[Developer] Atributos extraidos com sucesso: {[attr['name'] for attr in attributes]}",
            file=sys.stderr,
        )
        return attributes

    print(
        "[Developer] AVISO: Falha ao extrair atributos do LLM. Usando fallback (title, description).",
        file=sys.stderr,
    )
    return [
        {"name": "title", "type": "string", "sql_type": "VARCHAR(255) NOT NULL"},
        {"name": "description", "type": "text", "sql_type": "TEXT"},
    ]


def _architecture_lines(architecture: str) -> list[str]:
    return [line.strip() for line in str(architecture or "").splitlines() if line.strip()]


def summarize_architecture(architecture: str) -> dict:
    lines = _architecture_lines(architecture)
    summary = {
        "stack": [],
        "modules": [],
        "data": [],
        "contracts": [],
        "security": [],
    }

    patterns = {
        "stack": r"\b(react|vite|express|node|python|mysql|postgres|prisma|typescript|javascript|redis|queue|worker)\b",
        "modules": r"\b(modulo|m[oó]dulo|module|feature|dominio|domínio|domain|frontend|backend|api)\b",
        "data": r"\b(model|entidade|entity|tabela|table|schema|database|banco)\b",
        "contracts": r"\b(endpoint|rota|route|api|contract|contrato|payload|request|response)\b",
        "security": r"\b(auth|autentic|permiss|role|perfil|access|seguran|token|secret|jwt)\b",
    }

    for line in lines:
        lowered = line.lower()
        for key, pattern in patterns.items():
            if len(summary[key]) >= 5:
                continue
            if re.search(pattern, lowered):
                summary[key].append(line)

    return summary


def infer_validation_rules(attributes: list[dict]) -> list[str]:
    rules = []
    for attr in attributes:
        name = str(attr.get("name") or "").lower()
        attr_type = str(attr.get("type") or "").lower()
        if "email" in name:
            rules.append("Validar formato de email e impedir duplicidade quando aplicavel.")
        elif "password" in name or "senha" in name:
            rules.append("Exigir politica minima de senha e nunca retornar segredo em respostas.")
        elif "status" in name:
            rules.append("Restringir status a uma lista controlada de transicoes validas.")
        elif "date" in name or "data" in name:
            rules.append("Normalizar datas e rejeitar formatos invalidos.")
        elif attr_type in {"number", "integer", "float", "decimal"}:
            rules.append(f"Validar intervalo e tipo numerico de `{attr.get('name')}` antes de persistir.")

    return list(dict.fromkeys(rules))


def infer_backend_modules(primary_entity: str) -> list[str]:
    entity_lower = primary_entity.lower()
    return [
        f"backend/src/routes/{entity_lower}.js",
        f"backend/src/controllers/{entity_lower}Controller.js",
        f"backend/src/services/{entity_lower}Service.js",
        f"backend/src/repositories/{entity_lower}Repository.js",
        f"backend/src/models/{primary_entity}.js",
    ]


def infer_frontend_modules(primary_entity: str) -> list[str]:
    entity_lower = primary_entity.lower()
    return [
        f"frontend/src/pages/{primary_entity}ListPage.jsx",
        f"frontend/src/pages/{primary_entity}DetailPage.jsx",
        f"frontend/src/components/forms/{primary_entity}Form.jsx",
        f"frontend/src/components/{primary_entity}/{primary_entity}Toolbar.jsx",
        f"frontend/src/services/{entity_lower}Service.js",
    ]


def infer_api_contracts(primary_entity: str, attributes: list[dict]) -> dict:
    entity_lower = primary_entity.lower()
    request_fields = list(dict.fromkeys([attr["name"] for attr in attributes]))
    return {
        "collection_route": f"/api/v1/{entity_lower}s",
        "resource_route": f"/api/v1/{entity_lower}s/:id",
        "request_fields": request_fields,
        "response_fields": list(dict.fromkeys(["id", *request_fields, "status", "created_at", "updated_at"])),
        "operations": ["list", "detail", "create", "update", "delete", "change_status"],
    }


def infer_frontend_experience(primary_entity: str, attributes: list[dict]) -> dict:
    fields = [attr["name"] for attr in attributes]
    main_field = fields[0] if fields else "title"
    secondary_field = fields[1] if len(fields) > 1 else "status"
    return {
        "routes": [
            f"/{primary_entity.lower()}s",
            f"/{primary_entity.lower()}s/:id",
        ],
        "states": ["loading", "empty", "error", "success"],
        "main_field": main_field,
        "secondary_field": secondary_field,
        "ui_sections": ["page_header", "filters", "list_or_table", "form_panel", "feedback_banner"],
    }


def build_backend_module_spec(primary_entity: str, attributes: list[dict]) -> dict:
    api_contract = infer_api_contracts(primary_entity, attributes)
    field_names = {attr["name"] for attr in attributes}
    operation_map = {
        "list": "collectionRead",
        "detail": "detailRead",
        "create": "recordCreate",
        "update": "recordUpdate",
        "delete": "recordDelete",
    }
    if {"priority", "slaStatus", "owner"} & field_names:
        operation_map["list"] = "paginatedQueue"
        operation_map["prioritize"] = "prioritySort"
        operation_map["audit"] = "timelineRead"
        operation_map["status"] = "statusTransition"
    if {"approver", "approvalStatus", "decision"} & field_names:
        operation_map["review"] = "decisionAction"
        operation_map["audit"] = "timelineRead"
        operation_map["status"] = "statusTransition"
    if {"attachmentUrl", "attachmentName", "fileUrl", "fileName", "evidenceUrl"} & field_names:
        operation_map["attach"] = "evidenceIngest"
        operation_map["audit"] = "timelineRead"
    if {"notificationChannel", "enabled", "digestFrequency"} & field_names:
        operation_map["update"] = "settingsUpdate"
        operation_map["audit"] = "timelineRead"

    return {
        "version": 1,
        "entity": primary_entity,
        "route_base": api_contract["collection_route"],
        "files": [
            "router.ts",
            "controller.ts",
            "service.ts",
            "repository.ts",
            "schema.ts",
            "mapper.ts",
            "seed.ts",
            f"{primary_entity.lower()}.test.ts",
        ],
        "validation_library": "zod",
        "logger": "pino",
        "test_stack": ["vitest", "supertest"],
        "operation_map": operation_map,
        "contracts": {
            "request_fields": api_contract["request_fields"],
            "response_fields": api_contract["response_fields"],
            "operations": list(dict.fromkeys([*api_contract["operations"], *operation_map.keys()])),
        },
    }


def build_frontend_screen_spec(primary_entity: str, attributes: list[dict]) -> dict:
    experience = infer_frontend_experience(primary_entity, attributes)
    return {
        "version": 1,
        "entity": primary_entity,
        "routes": experience["routes"],
        "sections": experience["ui_sections"],
        "states": experience["states"],
        "main_field": experience["main_field"],
        "secondary_field": experience["secondary_field"],
        "data_stack": {
            "query_client": "tanstack-query",
            "form_library": "react-hook-form",
            "schema_library": "zod",
        },
    }


def _markdown_list(items: list[str], fallback: str) -> str:
    return "\n".join([f"- {item}" for item in items]) if items else f"- {fallback}"


def build_backend_structure(project_id: str, idea: str, architecture: str, primary_entity: str, attributes: list[dict]) -> str:
    entity_lower = primary_entity.lower()
    normalized_attributes = []
    seen_names = set()
    for attr in attributes:
        name = attr["name"]
        if name in seen_names:
            continue
        seen_names.add(name)
        normalized_attributes.append(attr)
    sql_columns = "\n".join(
        [f"  {attr['name']} {attr['sql_type']}," for attr in normalized_attributes if attr["name"] not in {"status", "created_at", "updated_at"}]
    )
    api_field_names = [attr["name"] for attr in normalized_attributes]
    api_fields = ", ".join(api_field_names)
    architecture_excerpt = " ".join(str(architecture or "").split())[:700]
    architecture_summary = summarize_architecture(architecture)
    validation_rules = infer_validation_rules(normalized_attributes)
    backend_modules = infer_backend_modules(primary_entity)
    api_contract = infer_api_contracts(primary_entity, normalized_attributes)
    update_fields = ", ".join(list(dict.fromkeys([*api_field_names, "status"])))
    response_fields = ", ".join(api_contract["response_fields"])

    return f"""# BACKEND IMPLEMENTATION
Projeto: {project_id}
Entidade principal: {primary_entity}

## Objetivo tecnico
- Entregar a camada de dominio, API e persistencia para a ideia: {idea}
- Respeitar a arquitetura existente sem reescreve-la inteira.
- Priorizar contratos claros e organizacao modular.

## Contexto arquitetural resumido
{architecture_excerpt or 'Sem resumo adicional de arquitetura.'}

## Stack e sinais arquiteturais
{_markdown_list(architecture_summary['stack'], 'Sem stack explicita detectada.')}

## Modulos e limites relevantes
{_markdown_list(architecture_summary['modules'], 'Sem modulos explicitos detectados.')}

## Modulos sugeridos
{_markdown_list([f"`{module}`" for module in backend_modules], 'Sem modulos sugeridos.')}

## Responsabilidades da camada backend
- Controller: validar entrada HTTP, mapear erros e delegar tudo para service.
- Service: aplicar regras de negocio, ownership, transicoes e coordenar persistencia.
- Repository/Model: encapsular queries e evitar SQL espalhado por controller.
- Validation: concentrar regras de payload e invariantes do dominio.

## Modelo de dados
```sql
CREATE TABLE {entity_lower}s (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
{sql_columns}
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Endpoints da API
{_markdown_list([f"`{method}`" for method in [
    f"GET {api_contract['collection_route']}",
    f"GET {api_contract['resource_route']}",
    f"POST {api_contract['collection_route']}",
    f"PUT {api_contract['resource_route']}",
    f"DELETE {api_contract['resource_route']}",
    f"PATCH {api_contract['resource_route']}/status",
]], 'Sem endpoints sugeridos.')}

## Contratos principais
- Payload de criacao: `{{ {api_fields} }}`
- Payload de atualizacao: `{{ {update_fields} }}`
- Resposta padrao: `{{ {response_fields} }}`

## Validacoes essenciais
{_markdown_list(validation_rules, 'Validar campos obrigatorios e tipos basicos.')}

## Erros e comportamento operacional
- Retornar `404` quando o recurso nao existir ou nao pertencer ao usuario.
- Retornar `400` para payload invalido e `409` para conflitos previsiveis.
- Garantir idempotencia basica em operacoes de update e status.
- Deixar logs suficientes para rastrear falhas de persistencia e validacao.

## Testes recomendados
- unitario de service cobrindo regra de criacao, update e status
- integracao de rotas cobrindo `200`, `400`, `404` e `409`
- teste de ownership/permissao quando houver `user_id`

## Regras de implementacao
- Separar controller de service.
- Validar payload no middleware.
- Garantir ownership por `user_id` quando aplicavel.
- Preparar testes unitarios para service e integracao para rotas.
"""


def build_frontend_structure(project_id: str, idea: str, architecture: str, primary_entity: str, attributes: list[dict]) -> str:
    entity_lower = primary_entity.lower()
    entity_label = f"{primary_entity}s"
    fields = "\n".join([f"- `{attr['name']}` ({attr['type']})" for attr in attributes])
    architecture_excerpt = " ".join(str(architecture or "").split())[:700]
    architecture_summary = summarize_architecture(architecture)
    frontend_modules = infer_frontend_modules(primary_entity)
    frontend_experience = infer_frontend_experience(primary_entity, attributes)

    return f"""# FRONTEND IMPLEMENTATION
Projeto: {project_id}
Entidade principal: {primary_entity}

## Objetivo da experiencia
- Entregar a interface principal para a ideia: {idea}
- Organizar fluxo de listagem, detalhe e edicao da entidade principal.
- Manter a UI coerente com a arquitetura definida.

## Contexto arquitetural resumido
{architecture_excerpt or 'Sem resumo adicional de arquitetura.'}

## Sinais de arquitetura relevantes
{_markdown_list(architecture_summary['modules'], 'Sem modulos explicitos detectados.')}

## Estrutura sugerida
{_markdown_list([f"`{module}`" for module in frontend_modules], 'Sem modulos sugeridos.')}

## Campos visiveis na UI
{fields or '- title (string)'}

## Fluxos visiveis
- Listar {entity_label.lower()} com loading, empty state e erro
- Criar novo registro
- Editar registro existente
- Atualizar status
- Exibir feedback de sucesso e falha

## Rotas e experiencia sugeridas
{_markdown_list([f"`{route}`" for route in frontend_experience['routes']], 'Sem rotas sugeridas.')}

## Secoes de interface
{_markdown_list(frontend_experience['ui_sections'], 'Sem secoes sugeridas.')}

## Estados obrigatorios
{_markdown_list(frontend_experience['states'], 'loading')}

## Integracoes esperadas
- `GET /api/v1/{entity_lower}s`
- `POST /api/v1/{entity_lower}s`
- `PUT /api/v1/{entity_lower}s/:id`
- `PATCH /api/v1/{entity_lower}s/:id/status`

## Regras de interacao
- Destacar o campo principal `{frontend_experience['main_field']}` na listagem e no detalhe.
- Usar `{frontend_experience['secondary_field']}` como apoio de contexto, status ou agrupamento.
- Exibir empty state com proximo passo claro, nao apenas ausencia de dados.
- Mostrar feedback de submit, erro de API e loading sem bloquear a navegacao inteira.

## Testes recomendados
- componente de formulario com submit feliz e erro de API
- listagem com loading, vazio e dados carregados
- navegacao entre lista e detalhe sem perder contexto
- service isolado cobrindo success e failure path

## Regras de implementacao
- Priorizar componentes pequenos e reutilizaveis.
- Exibir estados de loading, empty state e erro.
- Manter copy orientada ao usuario e nao a requisitos tecnicos.
- Preparar hooks e service isolados para facilitar testes e manutencao.
"""


def merge_developer_outputs(backend_output: dict, frontend_output: dict) -> dict:
    backend_code = backend_output.get("code", "").strip()
    frontend_code = frontend_output.get("code", "").strip()
    primary_entity = backend_output.get("primary_entity") or frontend_output.get("primary_entity") or "Item"
    attributes = backend_output.get("attributes") or frontend_output.get("attributes") or []

    sections = [
        "# FULL STACK IMPLEMENTATION PLAN",
        "",
        "## Backend",
        backend_code or "Backend planning unavailable.",
        "",
        "## Frontend",
        frontend_code or "Frontend planning unavailable.",
    ]

    return {
        "code": "\n".join(sections).strip(),
        "primary_entity": primary_entity,
        "attributes": attributes,
        "artifact_version": 2,
        "delivery_summary": {
            "backend_focus": backend_output.get("delivery_summary", {}),
            "frontend_focus": frontend_output.get("delivery_summary", {}),
        },
        "backend": backend_output,
        "frontend": frontend_output,
    }
