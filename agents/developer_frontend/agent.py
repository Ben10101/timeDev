# -*- coding: utf-8 -*-
"""
Legacy frontend-focused developer agent.
"""

from agents.developer.shared import (
    build_frontend_structure,
    extract_domain_entities,
    extract_entity_attributes,
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
        return {
            "code": code,
            "primary_entity": primary_entity,
            "attributes": attributes,
            "specialization": "frontend",
        }
