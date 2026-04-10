# -*- coding: utf-8 -*-
import json
import re
import sys
from agents.developer.llm_service import extract_json_from_text, generate_text_from_llm, is_error_text_response

def _truncate(value, limit=2400):
    return str(value or "").strip()[:limit]

def _compact_json(value, limit=2800):
    if not value: return "{}"
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)[:limit]
    except Exception:
        return _truncate(value, limit)

class BackendAgent:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_prompt(self, payload):
        schema_output = payload.get("schema_output") or {}
        backend_spec = payload.get("backend_spec") or {}
        
        entity_name = schema_output.get("entityName") or "GeneratedItem"
        contracts = schema_output.get("contracts") or {}
        prisma_fields = schema_output.get("prismaFields") or []
        
        route_base = backend_spec.get("routeBase") or f"/api/v1/{entity_name.lower()}s"
        operation_map = backend_spec.get("operationMap") or {}

        repair_context = payload.get("repair_context")
        repair_block = ""
        if repair_context:
            repair_block = f"\n\nATENCAO: Houve um erro na tentativa anterior. Por favor, corrija:\n{_compact_json(repair_context)}"

        return f"""
Voce e o BackendAgent do Aligna Factory.
Sua tarefa e gerar o CODIGO DO SERVIDOR seguindo o padrao de ARQUITETURA ORIENTADA A OBJETOS (OOP) com Decorators (estilo NestJS/Enterprise).

REGRAS ARQUITETURAIS:
1. MATERIALIZACAO OOP: Todos os serviços e controladores DEVEM ser classes.
2. DECORATORS: Utilize decoradores semânticos (mesmo que simulados via comentários ou metadados se a stack for Express puro) para definir rotas e dependências.
   - Exemplo: `@Service() class {entity_name}Service`
   - Exemplo: `@Get('{route_base}') async list()`
3. PERSISTENCIA: Use APENAS Prisma Client via `prisma.__PRISMA_MODEL_ID__`.
4. CONTRATOS: Utilize estritamente os nomes abaixo:
   - Request: {contracts.get('request')}
   - Response: {contracts.get('response')}
   - List: {contracts.get('list')}

CONTEUDO:
- ENTIDADE: {entity_name}
- CAMPOS: {_compact_json(prisma_fields)}
- ROUTE BASE: {route_base}
- OPERACOES: {_compact_json(operation_map)}

PRODUCAO:
Gere os arquivos `serviceTsTemplate`, `routerTsTemplate` e `indexTsTemplate` de forma completa, profissional e com tipagem forte.{repair_block}

RESPONDA APENAS UM JSON NO FORMATO:
{{
  "serviceTsTemplate": "string",
  "routerTsTemplate": "string",
  "indexTsTemplate": "string"
}}
""".strip()

    def _clean_code(self, code):
        if not code: return ""
        text = str(code).strip()
        fenced = re.match(r"^```(?:tsx|ts|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE)
        if fenced:
            text = fenced.group(1).strip()
        return text

    def _normalize_result(self, result):
        if not isinstance(result, dict):
            return None
        return {
            "serviceTsTemplate": self._clean_code(result.get("serviceTsTemplate")),
            "routerTsTemplate": self._clean_code(result.get("routerTsTemplate")),
            "indexTsTemplate": self._clean_code(result.get("indexTsTemplate"))
        }

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.2, "num_predict": 2000},
                use_cache=False
            )
            if not raw or is_error_text_response(raw):
                return None
            
            parsed = extract_json_from_text(raw)
            return self._normalize_result(parsed)
        except Exception:
            return None
