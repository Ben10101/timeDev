# -*- coding: utf-8 -*-
import sys
import json
import os
from copy import deepcopy

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.schema_agent.agent import SchemaAgent
from agents.backend_agent.agent import BackendAgent
from agents.frontend_agent.agent import FrontendAgent

def load_payload():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Entrada JSON invalida para o pipeline: {exc.msg}") from exc

    if not isinstance(input_data, dict):
        raise ValueError("A entrada do pipeline precisa ser um objeto JSON.")

    payload = input_data.get("payload", {})
    if not isinstance(payload, dict):
        raise ValueError("O campo 'payload' do pipeline precisa ser um objeto JSON.")

    return input_data, deepcopy(payload)

def require_field(payload, key, label=None):
    value = payload.get(key)
    if value in (None, "", [], {}):
        raise ValueError(f"Faltando '{label or key}' no payload.")
    return value

def run_agent_with_retry(agent_class, payload, project_id, max_retries=2):
    attempt = 0
    base_payload = deepcopy(payload)
    repair_context = base_payload.get("repair_context")

    while attempt <= max_retries:
        current_payload = deepcopy(base_payload)
        if repair_context:
            current_payload["repair_context"] = repair_context

        agent = agent_class(project_id)
        output = agent.process(current_payload)

        # Simulação de Validação Estática (Fase 10)
        validation_error = validate_agent_output(agent_class.__name__, output)

        if not validation_error:
            return output

        # Se falhou na validação, incrementa tentativa e define contexto de reparo
        attempt += 1
        repair_context = {
            "error": validation_error,
            "failed_output": output,
            "attempt": attempt
        }

    return None

def validate_agent_output(agent_name, output):
    """
    Realiza verificações de sanidade no output do agente.
    Em uma versão futura, isso pode chamar o compilador TS real.
    """
    if not output:
        return "Output vazio ou inválido."

    if agent_name == "BackendAgent":
        if not output.get("serviceTsTemplate") or "class" not in output.get("serviceTsTemplate", "").lower():
            return "O código gerado não utiliza o padrão de Classes (OOP) obrigatório."

    if agent_name == "FrontendAgent":
        if not output.get("pageTsxTemplate"):
            return "Faltando template principal da página (pageTsxTemplate)."

    return None

def main():
    try:
        input_data, payload = load_payload()
        project_id = require_field(payload, "project_id")
        idea = require_field(payload, "idea")

        # Debug: Mostrar provedores e modelos (Requerido pelo usuário)
        provider_order = os.getenv("AI_PROVIDER_ORDER", "nao configurada")
        print(f"[Orchestrator] Modo: autonomous_build_loop", file=sys.stderr)
        print(f"[Orchestrator] Ordem de Provedores: {provider_order}", file=sys.stderr)
        print(f"[Orchestrator] Modelo Gemini: {os.getenv('GEMINI_MODEL', 'default')}", file=sys.stderr)
        print(f"[Orchestrator] Modelo Nvidia: {os.getenv('NVIDIA_MODEL', 'default')}", file=sys.stderr)

        # 1. Executar SchemaAgent
        schema_output = run_agent_with_retry(SchemaAgent, payload, project_id)
        if not schema_output:
            raise RuntimeError("Falha crítica no SchemaAgent após retentativas.")

        # 2. Executar BackendAgent
        backend_payload = {
            **payload,
            "schema_output": schema_output,
            "backend_spec": payload.get("technical_spec", {}).get("backend", {})
        }
        backend_output = run_agent_with_retry(BackendAgent, backend_payload, project_id)

        # 3. Executar FrontendAgent
        frontend_payload = {
            **payload,
            "schema_output": schema_output,
            "frontend_spec": payload.get("technical_spec", {}).get("frontend", {})
        }
        frontend_output = run_agent_with_retry(FrontendAgent, frontend_payload, project_id)

        # 4. Consolidar Resultado Final
        final_result = {
            "frontend": {
                **(frontend_output or {}),
                "layoutVariant": payload.get("technical_spec", {}).get("frontend", {}).get("layoutVariant", "default")
            },
            "backend": {
                **(backend_output or {})
            },
            "schema": schema_output,
            "generationSource": "autonomous_build_loop_v1"
        }

        print(json.dumps({
            "success": True,
            "data": final_result
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stdout)
        sys.exit(1)

if __name__ == '__main__':
    main()
