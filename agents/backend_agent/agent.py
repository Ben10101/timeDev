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


def _clean_code(code):
    if not code:
        return ""
    text = str(code).strip()
    fenced = re.match(r"^```(?:tsx|ts|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    return text


def _pascal_case(value, fallback="GeneratedItem"):
    parts = [part for part in re.split(r"[^a-zA-Z0-9]+", str(value or fallback)) if part]
    if not parts:
        return fallback
    return "".join(part[:1].upper() + part[1:] for part in parts)


def _camel_case(value, fallback="generatedItem"):
    pascal = _pascal_case(value, fallback[:1].upper() + fallback[1:])
    return pascal[:1].lower() + pascal[1:] if pascal else fallback


def _normalize_field_name(value):
    field_name = re.sub(r"[^a-zA-Z0-9_]", "", str(value or "").strip())
    if not field_name:
        return ""
    if re.match(r"^\d", field_name):
        return f"field{field_name}"
    return field_name


def _ts_type_from_field(field):
    raw = str((field or {}).get("tsType") or (field or {}).get("type") or "string").strip().lower()
    if raw in {"number", "int", "float", "decimal"}:
        return "number"
    if raw in {"boolean", "bool"}:
        return "boolean"
    if raw in {"date", "datetime"}:
        return "string"
    return "string"


def _router_field_assignment(field):
    field_name = _normalize_field_name((field or {}).get("name"))
    if not field_name:
        return ""
    ts_type = _ts_type_from_field(field)
    if ts_type == "number":
        return f"      {field_name}: Number(payload.{field_name} ?? 0),"
    if ts_type == "boolean":
        return f"      {field_name}: Boolean(payload.{field_name}),"
    return f"      {field_name}: String(payload.{field_name} ?? '').trim(),"


def _service_field_assignment(field):
    field_name = _normalize_field_name((field or {}).get("name"))
    if not field_name:
        return ""
    ts_type = _ts_type_from_field(field)
    if ts_type == "number":
        return f"        {field_name}: Number(input.{field_name} ?? 0),"
    if ts_type == "boolean":
        return f"        {field_name}: Boolean(input.{field_name}),"
    if field_name == "email":
        return "        email: String(input.email ?? '').trim().toLowerCase(),"
    return f"        {field_name}: String(input.{field_name} ?? '').trim(),"


def _validation_rule(field):
    field_name = _normalize_field_name((field or {}).get("name"))
    if not field_name:
        return []
    required = bool((field or {}).get("required"))
    ts_type = _ts_type_from_field(field)
    rules = []
    if required and ts_type == "string":
        rules.append(f"  if (!String(input.{field_name} ?? '').trim()) throw new Error('{field_name} is required.');")
    elif required and ts_type == "number":
        rules.append(f"  if (Number.isNaN(Number(input.{field_name}))) throw new Error('{field_name} must be a number.');")
    if field_name == "email":
        rules.append("  if (!String(input.email ?? '').includes('@')) throw new Error('E-mail invalido.');")
    return rules


def _normalize_expectation_items(value, max_items=8):
    if isinstance(value, dict):
        items = []
        for key in ("scenarios", "functionalCases", "cases", "assertions", "checks"):
            candidate = value.get(key)
            if isinstance(candidate, list):
                items.extend(candidate)
        if items:
            return [str(item).strip() for item in items if str(item or "").strip()][:max_items]
        return [str(item).strip() for item in value.values() if str(item or "").strip()][:max_items]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item or "").strip()][:max_items]
    if str(value or "").strip():
        return [str(value).strip()]
    return []


def _build_default_backend_templates(payload):
    schema_output = payload.get("schema_output") or {}
    backend_spec = payload.get("backend_spec") or {}
    entity_name = _pascal_case(schema_output.get("entityName") or "GeneratedItem")
    contracts = schema_output.get("contracts") or {}
    prisma_fields = schema_output.get("prismaFields") or []
    route_base = backend_spec.get("routeBase") or f"/api/{_camel_case(entity_name)}s"
    shared_import_path = backend_spec.get("sharedImportPath") or "__SHARED_IMPORT_PATH__"
    prisma_model_id = backend_spec.get("prismaModelId") or _camel_case(entity_name)
    service_name = backend_spec.get("serviceName") or f"{entity_name}Service"
    service_instance_name = backend_spec.get("serviceInstanceName") or f"{entity_name}ServiceInstance"
    router_name = backend_spec.get("routerName") or f"{entity_name}Router"
    request_contract = contracts.get("request") or f"{entity_name}Request"
    response_contract = contracts.get("response") or f"{entity_name}Response"

    router_assignments = "\n".join(
        assignment for assignment in (_router_field_assignment(field) for field in prisma_fields) if assignment
    ) or "      ...payload,"
    service_assignments = "\n".join(
        assignment for assignment in (_service_field_assignment(field) for field in prisma_fields) if assignment
    ) or "        ...input,"

    validation_rules = []
    for field in prisma_fields:
        validation_rules.extend(_validation_rule(field))

    validate_input_block = ""
    if validation_rules:
        validate_input_block = (
            f"function validateInput(input: {request_contract}): void {{\n" +
            "\n".join(validation_rules) +
            "\n}\n\n"
        )
    validate_input_call = "    validateInput(input);\n" if validate_input_block else ""

    service_template = f"""import {{ PrismaClient }} from '@prisma/client';
import type {{ {request_contract}, {response_contract} }} from '{shared_import_path}';

const prisma = new PrismaClient();

{validate_input_block}export class {service_name} {{
  async list(): Promise<{{ items: {response_contract}[] }}> {{
    const items = await prisma['{prisma_model_id}'].findMany({{
      orderBy: {{ createdAt: 'desc' }},
    }});
    return {{ items: items as unknown as {response_contract}[] }};
  }}

  async create(input: {request_contract}): Promise<{response_contract}> {{
{validate_input_call}    const item = await prisma['{prisma_model_id}'].create({{
      data: {{
{service_assignments}
        status: 'active',
      }},
    }});
    return item as unknown as {response_contract};
  }}
}}

export const {service_instance_name} = new {service_name}();
"""

    router_template = f"""import {{ Router }} from 'express';
import type {{ {request_contract} }} from '{shared_import_path}';
import {{ {service_instance_name} }} from './service';

export const {router_name} = Router();

{router_name}.get('/', async (_req, res) => {{
  try {{
    const data = await {service_instance_name}.list();
    res.json(data);
  }} catch (error) {{
    res.status(500).json({{ message: 'Falha ao buscar registros.' }});
  }}
}});

{router_name}.post('/', async (req, res) => {{
  try {{
    const payload = req.body || {{}};
    const input: {request_contract} = {{
{router_assignments}
    }};
    const created = await {service_instance_name}.create(input);
    res.status(201).json(created);
  }} catch (error) {{
    res.status(400).json({{ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' }});
  }}
}});
"""

    index_template = f"""export {{ {router_name} }} from './router';
export {{ {service_instance_name} }} from './service';
"""

    return {
        "serviceTsTemplate": service_template,
        "routerTsTemplate": router_template,
        "indexTsTemplate": index_template,
    }


def _is_healthy_backend_result(result, payload=None):
    if not isinstance(result, dict):
        return False
    service = _clean_code(result.get("serviceTsTemplate"))
    router = _clean_code(result.get("routerTsTemplate"))
    index_file = _clean_code(result.get("indexTsTemplate"))
    schema_output = (payload or {}).get("schema_output") or {}
    backend_spec = (payload or {}).get("backend_spec") or {}
    contracts = schema_output.get("contracts") or {}
    entity_name = schema_output.get("entityName") or "GeneratedItem"
    prisma_model_id = backend_spec.get("prismaModelId") or _camel_case(entity_name)
    service_name = backend_spec.get("serviceName") or f"{entity_name}Service"
    service_instance_name = backend_spec.get("serviceInstanceName") or f"{entity_name}ServiceInstance"
    router_name = backend_spec.get("routerName") or f"{entity_name}Router"

    if not service or not router or not index_file:
        return False

    checks = [
        "from '@prisma/client'" in service,
        "const prisma = new PrismaClient()" in service,
        f"export class {service_name}" in service,
        f"export const {service_instance_name} = new {service_name}()" in service,
        prisma_model_id in service,
        "async list()" in service,
        "return { items:" in service,
        "async create(" in service,
        ".create({" in service,
        "const records" not in service,
        ".get('/'," in router,
        ".post('/'," in router,
        "Router()" in router,
        "req.body" in router,
        "res.status(201).json(created)" in router,
        "from './service'" in router,
        f"export {{ {router_name} }} from './router'" in index_file,
        f"export {{ {service_instance_name} }} from './service'" in index_file,
    ]

    if contracts.get("request"):
        checks.append(contracts["request"] in service)
        checks.append(contracts["request"] in router)
    if contracts.get("response"):
        checks.append(contracts["response"] in service)

    return all(checks)


class BackendAgent:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_prompt(self, payload):
        schema_output = payload.get("schema_output") or {}
        backend_spec = payload.get("backend_spec") or {}

        entity_name = schema_output.get("entityName") or "GeneratedItem"
        contracts = schema_output.get("contracts") or {}
        prisma_fields = schema_output.get("prismaFields") or []

        route_base = backend_spec.get("routeBase") or f"/api/v1/{str(entity_name).lower()}s"
        operation_map = backend_spec.get("operationMap") or {}
        test_expectations = backend_spec.get("testExpectations") or payload.get("test_expectations") or []
        normalized_test_expectations = _normalize_expectation_items(test_expectations)

        repair_context = payload.get("repair_context")
        repair_block = ""
        if repair_context:
            repair_block = f"\n\nATENCAO: Houve um erro na tentativa anterior. Corrija localmente:\n{_compact_json(repair_context)}"

        return f"""
Voce e o BackendAgent do Aligna Factory.
Sua tarefa e gerar o backend com foco em PASSAR NOS TESTES REAIS, manter contratos consistentes e obedecer o smoke test do monorepo gerado.

REGRAS OBRIGATORIAS:
1. STACK REAL: use Express + Prisma. Nao use NestJS real, decorators reais, inversao de controle externa, axios, arrays `records` ou storage em memoria.
2. SERVICE OOP: o service deve ser uma classe exportada com uma instancia exportada no final.
3. PERSISTENCIA: use APENAS `const prisma = new PrismaClient()` e `prisma.__PRISMA_MODEL_ID__`.
4. CONTRATOS:
   - Request: {contracts.get('request')}
   - Response: {contracts.get('response')}
   - List: {contracts.get('list')}
5. ROTAS MINIMAS:
   - GET `{route_base}` retornando `{{ items: ... }}`
   - POST `{route_base}` retornando `201`
6. O router deve importar o service local e o index deve apenas reexportar router e service.
7. Priorize comportamento confiavel e tipagem forte sobre sofisticacao desnecessaria.
8. O service precisa retornar lista tipada como `{{ items: ... }}` e o router precisa transformar `req.body` em request contratual antes de chamar o service.
9. Se existir expectativa de teste ou smoke, ela precisa aparecer refletida na estrutura do codigo, nao apenas citada no texto.

CONTEXTO:
- ENTIDADE: {entity_name}
- CAMPOS: {_compact_json(prisma_fields)}
- ROUTE BASE: {route_base}
- OPERACOES: {_compact_json(operation_map)}
- EXPECTATIVAS DE TESTE/SMOKE: {_compact_json(normalized_test_expectations, 1600)}

PRODUCAO:
Gere `serviceTsTemplate`, `routerTsTemplate` e `indexTsTemplate` completos e prontos para materializacao.{repair_block}

RESPONDA APENAS UM JSON NO FORMATO:
{{
  "serviceTsTemplate": "string",
  "routerTsTemplate": "string",
  "indexTsTemplate": "string"
}}
""".strip()

    def _normalize_result(self, result):
        if not isinstance(result, dict):
            return None
        return {
            "serviceTsTemplate": _clean_code(result.get("serviceTsTemplate")),
            "routerTsTemplate": _clean_code(result.get("routerTsTemplate")),
            "indexTsTemplate": _clean_code(result.get("indexTsTemplate")),
        }

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.15, "num_predict": 2200},
                use_cache=False,
            )
            if not raw or is_error_text_response(raw):
                return _build_default_backend_templates(payload)

            parsed = extract_json_from_text(raw)
            normalized = self._normalize_result(parsed)
            if _is_healthy_backend_result(normalized, payload):
                return normalized
            return _build_default_backend_templates(payload)
        except Exception:
            return _build_default_backend_templates(payload)
