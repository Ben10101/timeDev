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

class SchemaAgent:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_prompt(self, payload):
        idea = payload.get("idea") or ""
        technical_spec = payload.get("technical_spec") or {}
        requirement_spec = payload.get("requirement_spec") or {}
        architecture = payload.get("architecture") or {}

        return f"""
Voce e o SchemaAgent do Aligna. 
Sua tarefa e definir a MODELAGEM DE DADOS e os CONTRATOS de uma feature.

REGRAS:
1. Identifique a entidade principal em PascalCase e no singular (ex: 'Lead', 'VisitRecord').
2. Defina os campos para o Prisma (nome, tipo, obrigatoriedade).
   - Tipos validos: String, Int, Float, Boolean, DateTime, Json.
   - Campos obrigatorios de sistema (id, createdAt, updatedAt) serao adicionados automaticamente, nao os inclua.
3. Defina os nomes dos contratos compartilhados:
   - Request: NomeEntidadeRequest
   - Response: NomeEntidadeResponse
   - List: NomeEntidadeListResponse

CONTEXTO:
IDEA: {_truncate(idea, 1000)}
TECHNICAL SPEC: {_compact_json(technical_spec, 3000)}
REQUIREMENT SPEC: {_compact_json(requirement_spec, 2000)}
ARCHITECTURE: {_compact_json(architecture, 1500)}

RESPONDA APENAS UM JSON NO FORMATO:
{{
  "entityName": "string",
  "prismaFields": [
    {{ "name": "string", "type": "string", "required": boolean, "default": "any|null" }}
  ],
  "contracts": {{
    "request": "string",
    "response": "string",
    "list": "string"
  }},
  "domainSummary": "string"
}}
""".strip()

    def _normalize_result(self, result):
        if not isinstance(result, dict):
            return None
        
        entity_name = str(result.get("entityName") or "GeneratedItem").strip()
        # Garantir PascalCase simples
        entity_name = "".join(x.capitalize() for x in entity_name.split("_"))
        
        prisma_fields = result.get("prismaFields") or []
        if not isinstance(prisma_fields, list):
            prisma_fields = []
            
        contracts = result.get("contracts") or {}
        return {
            "entityName": entity_name,
            "prismaFields": prisma_fields,
            "contracts": {
                "request": str(contracts.get("request") or f"{entity_name}Request"),
                "response": str(contracts.get("response") or f"{entity_name}Response"),
                "list": str(contracts.get("list") or f"{entity_name}ListResponse")
            },
            "domainSummary": str(result.get("domainSummary") or "")
        }

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.1, "num_predict": 1000},
                use_cache=False
            )
            if not raw or is_error_text_response(raw):
                return None
            
            parsed = extract_json_from_text(raw)
            return self._normalize_result(parsed)
        except Exception:
            return None
