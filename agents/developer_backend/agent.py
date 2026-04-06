# -*- coding: utf-8 -*-
"""
Legacy backend-focused developer agent.
"""

from agents.developer.shared import (
    build_backend_structure,
    build_backend_module_spec,
    extract_domain_entities,
    extract_entity_attributes,
    infer_api_contracts,
    infer_backend_modules,
    infer_validation_rules,
    summarize_architecture,
)


class DeveloperBackend:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, architecture):
        entities = extract_domain_entities(idea)
        primary_entity = entities[0] if entities else "Item"
        attributes = extract_entity_attributes(idea)
        code = build_backend_structure(self.project_id, idea, architecture, primary_entity, attributes)
        architecture_summary = summarize_architecture(architecture)
        return {
            "code": code,
            "primary_entity": primary_entity,
            "attributes": attributes,
            "specialization": "backend",
            "artifact_version": 2,
            "modules": infer_backend_modules(primary_entity),
            "module_spec": build_backend_module_spec(primary_entity, attributes),
            "api_contract": infer_api_contracts(primary_entity, attributes),
            "validation_rules": infer_validation_rules(attributes),
            "delivery_summary": {
                "entity": primary_entity,
                "module_count": len(infer_backend_modules(primary_entity)),
                "validation_count": len(infer_validation_rules(attributes)),
                "stack_signals": architecture_summary.get("stack", []),
            },
        }
