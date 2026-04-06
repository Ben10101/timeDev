# -*- coding: utf-8 -*-
"""
Legacy frontend-focused developer agent.
"""

from agents.developer.shared import (
    build_frontend_structure,
    build_frontend_screen_spec,
    extract_domain_entities,
    extract_entity_attributes,
    infer_frontend_experience,
    infer_frontend_modules,
    summarize_architecture,
)


class DeveloperFrontend:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, architecture, backend_output=None):
        entities = extract_domain_entities(idea)
        primary_entity = (
            (backend_output or {}).get("primary_entity")
            or (entities[0] if entities else "Item")
        )
        attributes = (backend_output or {}).get("attributes") or extract_entity_attributes(idea)
        code = build_frontend_structure(self.project_id, idea, architecture, primary_entity, attributes)
        architecture_summary = summarize_architecture(architecture)
        return {
            "code": code,
            "primary_entity": primary_entity,
            "attributes": attributes,
            "specialization": "frontend",
            "artifact_version": 2,
            "modules": infer_frontend_modules(primary_entity),
            "screen_spec": build_frontend_screen_spec(primary_entity, attributes),
            "experience": infer_frontend_experience(primary_entity, attributes),
            "delivery_summary": {
                "entity": primary_entity,
                "module_count": len(infer_frontend_modules(primary_entity)),
                "ui_sections": infer_frontend_experience(primary_entity, attributes).get("ui_sections", []),
                "module_signals": architecture_summary.get("modules", []),
            },
        }
