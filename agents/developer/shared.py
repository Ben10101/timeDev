# -*- coding: utf-8 -*-
"""
Shared helpers for the legacy developer pipeline.

This module keeps the old single "developer" contract compatible while
allowing backend and frontend specializations to produce focused artifacts.
"""

from __future__ import annotations

import sys

from agents.developer.llm_service import get_attributes_from_llm


def extract_domain_entities(idea: str) -> list[str]:
    lower_idea = str(idea or "").lower()
    entities = []

    detection_rules = [
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


def build_backend_structure(project_id: str, idea: str, architecture: str, primary_entity: str, attributes: list[dict]) -> str:
    entity_lower = primary_entity.lower()
    sql_columns = "\n".join([f"  {attr['name']} {attr['sql_type']}," for attr in attributes])
    api_fields = ", ".join([attr["name"] for attr in attributes])
    architecture_excerpt = " ".join(str(architecture or "").split())[:700]

    return f"""# BACKEND IMPLEMENTATION
Projeto: {project_id}
Entidade principal: {primary_entity}

## Objetivo tecnico
- Entregar a camada de dominio, API e persistencia para a ideia: {idea}
- Respeitar a arquitetura existente sem reescreve-la inteira.
- Priorizar contratos claros e organizacao modular.

## Contexto arquitetural resumido
{architecture_excerpt or 'Sem resumo adicional de arquitetura.'}

## Modulos sugeridos
- `backend/src/server.js`: bootstrap HTTP e middleware globais
- `backend/src/routes/{entity_lower}.js`: rotas REST da feature
- `backend/src/controllers/{entity_lower}Controller.js`: entrada/saida HTTP
- `backend/src/services/{entity_lower}Service.js`: regras de negocio
- `backend/src/models/{primary_entity}.js`: acesso a dados
- `backend/src/middleware/validators.js`: validacoes de entrada
- `backend/src/utils/response.js`: responses padronizadas

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
- `GET /api/v1/{entity_lower}s`
- `GET /api/v1/{entity_lower}s/:id`
- `POST /api/v1/{entity_lower}s`
- `PUT /api/v1/{entity_lower}s/:id`
- `DELETE /api/v1/{entity_lower}s/:id`
- `PATCH /api/v1/{entity_lower}s/:id/status`

## Contratos principais
- Payload de criacao: `{{ {api_fields} }}`
- Payload de atualizacao: `{{ {api_fields}, status }}`
- Resposta padrao: `{{ id, {api_fields}, status, created_at, updated_at }}`

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

    return f"""# FRONTEND IMPLEMENTATION
Projeto: {project_id}
Entidade principal: {primary_entity}

## Objetivo da experiencia
- Entregar a interface principal para a ideia: {idea}
- Organizar fluxo de listagem, detalhe e edicao da entidade principal.
- Manter a UI coerente com a arquitetura definida.

## Contexto arquitetural resumido
{architecture_excerpt or 'Sem resumo adicional de arquitetura.'}

## Estrutura sugerida
- `frontend/src/App.jsx`: shell da aplicacao e rotas base
- `frontend/src/pages/{primary_entity}ListPage.jsx`: listagem e filtros
- `frontend/src/pages/{primary_entity}DetailPage.jsx`: detalhe e estado vazio
- `frontend/src/components/forms/{primary_entity}Form.jsx`: formulario principal
- `frontend/src/services/{entity_lower}Service.js`: integracao HTTP
- `frontend/src/store/{entity_lower}Store.js`: estado local/global da feature

## Campos visiveis na UI
{fields or '- title (string)'}

## Fluxos visiveis
- Listar {entity_label.lower()} com loading, empty state e erro
- Criar novo registro
- Editar registro existente
- Atualizar status
- Exibir feedback de sucesso e falha

## Integracoes esperadas
- `GET /api/v1/{entity_lower}s`
- `POST /api/v1/{entity_lower}s`
- `PUT /api/v1/{entity_lower}s/:id`
- `PATCH /api/v1/{entity_lower}s/:id/status`

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
        "backend": backend_output,
        "frontend": frontend_output,
    }
