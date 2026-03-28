# -*- coding: utf-8 -*-
"""
Legacy backend-focused developer agent.
"""

from agents.developer.shared import (
    build_backend_structure,
    extract_domain_entities,
    extract_entity_attributes,
)


class DeveloperBackend:
    def __init__(self, project_id):
        self.project_id = project_id

    def process(self, idea, architecture):
        entities = extract_domain_entities(idea)
        primary_entity = entities[0] if entities else "Item"
        attributes = extract_entity_attributes(idea)
        code = build_backend_structure(self.project_id, idea, architecture, primary_entity, attributes)
        return {
            "code": code,
            "primary_entity": primary_entity,
            "attributes": attributes,
            "specialization": "backend",
        }
