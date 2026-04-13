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

class FrontendAgent:
    def __init__(self, project_id):
        self.project_id = project_id

    def _build_prompt(self, payload):
        schema_output = payload.get("schema_output") or {}
        frontend_spec = payload.get("frontend_spec") or {}
        
        entity_name = schema_output.get("entityName") or "GeneratedItem"
        contracts = schema_output.get("contracts") or {}
        prisma_fields = schema_output.get("prismaFields") or []
        
        page_title = frontend_spec.get("pageTitle") or f"Gestao de {entity_name}"
        page_description = frontend_spec.get("pageDescription") or "Interface operacional para gestao da feature."
        archetype = frontend_spec.get("pageArchetype") or "crud"

        repair_context = payload.get("repair_context")
        repair_block = ""
        if repair_context:
            repair_block = f"\n\nATENCAO: Houve um erro na tentativa anterior. Por favor, corrija:\n{_compact_json(repair_context)}"

        return f"""
Voce e o FrontendAgent do Aligna Factory.
Sua tarefa e gerar a INTERFACE DO USUARIO (React/TypeScript/Tailwind) seguindo o padrao de SEPARACAO DE PREOCUPACOES (SOC).

REGRAS ARQUITETURAIS:
1. MATERIALIZACAO OOP: Extraia a logica de comunicacao com o backend para uma CLASSE de servico dedicada.
   - Exemplo: `class {entity_name}Service {{ ... }}`
2. HOOKS & UI: O `page.tsx` deve focar na renderizacao e estado de UI, delegando chamadas complexas para o Service.
3. DESIGN SYSTEM: Utilize componentes de `__UI_IMPORT_PATH__` (`SurfaceCard`, `PrimaryButton`, etc.).
4. CONTRATOS: Utilize estritamente os nomes abaixo:
   - Request: {contracts.get('request')}
   - Response: {contracts.get('response')}
   - List: {contracts.get('list')}
5. SHELL EXPLICITO: Declare explicitamente `productMode`, `uiIntent` e `layoutVariant` na pagina.
6. EXPERIENCIA FINAL: Prefira shells compartilhados como `OperationsWorkspace`, `PlannerWorkbench`, `ExecutiveCockpit` ou `SettingsConsole` quando a tela pedir contexto operacional.
7. COPY DE PRODUTO: Nao use textos genericos como "Salvar", "Enviar", "Concluir operacao", "Atividade recente", "Feedback imediato em caso de sucesso ou erro" ou placeholders de template.

CONTEUDO:
- ENTIDADE: {entity_name}
- TITULO: {page_title}
- ARQUETIPO: {archetype}
- CAMPOS: {_compact_json(prisma_fields)}

PRODUCAO:
Gere os arquivos `pageTsxTemplate`, `serviceTsTemplate` (Classe de Servico) e `indexTsTemplate`.{repair_block}

RESPONDA APENAS UM JSON NO FORMATO:
{{
  "pageTsxTemplate": "string",
  "serviceTsTemplate": "string",
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
            "pageTsxTemplate": self._clean_code(result.get("pageTsxTemplate")),
            "serviceTsTemplate": self._clean_code(result.get("serviceTsTemplate")),
            "indexTsTemplate": self._clean_code(result.get("indexTsTemplate"))
        }

    def process(self, payload):
        prompt = self._build_prompt(payload)
        model = payload.get("model")

        try:
            raw = generate_text_from_llm(
                prompt,
                model=model,
                options_override={"temperature": 0.3, "num_predict": 3000},
                use_cache=False
            )
            if not raw or is_error_text_response(raw):
                return None
            
            parsed = extract_json_from_text(raw)
            return self._normalize_result(parsed)
        except Exception:
            return None
        
