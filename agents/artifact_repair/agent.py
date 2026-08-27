import json

from agents.developer.llm_service import generate_text_from_llm, is_error_text_response


def parse_first_json_object(raw):
    """Decode the first complete JSON object and ignore model trailing text."""
    text = str(raw or '').strip()
    decoder = json.JSONDecoder()
    start = text.find('{')
    while start >= 0:
        try:
            value, _ = decoder.raw_decode(text[start:])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            start = text.find('{', start + 1)
            continue
        break
    raise ValueError('Agente de reparo retornou JSON invalido.')


class ArtifactRepairAgent:
    """Repairs only the sections named by the Quality Gate."""

    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, payload):
        artifact_type = str(payload.get("artifact_type") or "").strip()
        findings = payload.get("findings") or []
        current = str(payload.get("current_artifact") or "").strip()
        source = str(payload.get("source_context") or "").strip()
        if not artifact_type or not findings or not current:
            raise ValueError("Reparo direcionado exige artifact_type, findings e current_artifact.")
        prompt = f"""
Voce e um agente de reparo direcionado. Corrija SOMENTE o trecho afetado pelos achados abaixo.
Nao reescreva o artefato inteiro. Nao invente regra, limite, status, endpoint ou permissao.
Quando faltar evidencia, marque o item como proposed e registre requires_confirmation=true.
Responda apenas JSON valido com as chaves: section, content, changes, source_ids, status, requires_confirmation.

Tipo: {artifact_type}
Achados: {json.dumps(findings, ensure_ascii=False)}
Fonte aprovada: {source}
Artefato atual (somente contexto): {current[:12000]}
"""
        result = generate_text_from_llm(
            prompt,
            options_override={
                "temperature": 0.0,
                "num_predict": 900,
                # O reparo é consumido pelo controller como patch; exigir JSON
                # evita que uma resposta em prosa quebre a revisão no frontend.
                "json_mode": True,
                "require_json_object": True,
            },
            use_cache=False,
            task="artifact_repair",
        )
        if not result or is_error_text_response(result):
            raise RuntimeError("Agente de reparo nao retornou uma resposta valida.")
        patch = parse_first_json_object(result)
        if not isinstance(patch, dict) or not patch.get("section") or not patch.get("content"):
            raise ValueError("Patch de reparo sem section ou content.")
        patch["status"] = patch.get("status") or "proposed"
        patch["requires_confirmation"] = bool(patch.get("requires_confirmation", True))
        return patch
