# -*- coding: utf-8 -*-
"""
Developer aggregate agent.

Keeps the old `developer` contract compatible while delegating the legacy
planning artifact into backend and frontend specialized tracks.
"""

from agents.developer.shared import merge_developer_outputs
from agents.developer_backend.agent import DeveloperBackend
from agents.developer_frontend.agent import DeveloperFrontend


class Developer:
    def __init__(self, project_id):
        self.project_id = project_id
        self.backend_agent = DeveloperBackend(project_id)
        self.frontend_agent = DeveloperFrontend(project_id)

    def process(self, idea, architecture):
        backend_output = self.backend_agent.process(idea, architecture)
        frontend_output = self.frontend_agent.process(idea, architecture, backend_output)
        return merge_developer_outputs(backend_output, frontend_output)
