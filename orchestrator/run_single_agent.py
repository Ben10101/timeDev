# -*- coding: utf-8 -*-
import sys
import json
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.implementation_autonomous.agent import ImplementationAutonomousAgent
from agents.developer.agent_new import Developer as NewDeveloper
from agents.developer_backend.agent import DeveloperBackend
from agents.developer_frontend.agent import DeveloperFrontend
from agents.qa_engineer.agent import QAEngineer
from agents.debug_agent.agent import DebugAgent
from agents.schema_agent.agent import SchemaAgent
from agents.backend_agent.agent import BackendAgent
from agents.frontend_agent.agent import FrontendAgent
from agents.ui_ux_specialist.agent import UiUxSpecialist
from agents.alignment_semantic.agent import AlignmentSemanticAgent
from agents.requirement_engine.agent import RequirementEngineAgent
from agents.requirement_challenger.agent import RequirementChallenger
from agents.visual_requirement_analyst.agent import VisualRequirementAnalyst
from agents.artifact_repair.agent import ArtifactRepairAgent
from agents.backlog_challenger.agent import BacklogChallenger
from agents.backlog_judge.agent import BacklogJudge
from agents.story_reviewer.agent import StoryReviewer
from orchestrator.projectBuilder import ProjectBuilder

def main():
    try:
        input_data = json.load(sys.stdin)
        
        agent_name = input_data.get("agent")
        payload = input_data.get("payload", {})
        project_id = payload.get("project_id")
        idea = payload.get("idea")
        runtime_mode = input_data.get("runtime_mode") or os.getenv("ALIGNA_AGENT_RUNTIME_MODE") or "modern-single-agent"

        if not agent_name or (not idea and agent_name not in {"visual_requirement_analyst", "backlog_challenger", "backlog_judge"}):
            raise ValueError("Faltando 'agent' ou 'idea' no payload.")

        project_id = project_id or f"freeform-{agent_name}"

        result = None
        
        if agent_name == "project_manager":
            agent = ProjectManager(project_id)
            result = agent.process(
                idea,
                elicitation_state=payload.get("elicitation"),
                elicitation_answers=payload.get("elicitation_answers"),
            )
        
        elif agent_name == "requirements_analyst":
            backlog = payload.get("backlog")
            if not backlog: raise ValueError("Faltando 'backlog' para o requirements_analyst.")
            agent = RequirementsAnalyst(project_id)
            markdown = agent.process(idea, backlog, project_context=payload.get("project_context"))
            # Keep the Markdown contract for every existing consumer while
            # exposing the AI-produced, validated contract for traceability.
            result = {
                "markdown": markdown,
                "requirement_contract": agent.last_refinement_contract,
            }

        elif agent_name == "artifact_repair":
            agent = ArtifactRepairAgent(project_id)
            result = agent.process(payload)

        elif agent_name == "architect":
            requirements = payload.get("requirements")
            if not requirements: raise ValueError("Faltando 'requirements' para o architect.")
            project_context = payload.get("project_context")
            agent = Architect(project_id)
            result = agent.process(idea, requirements, project_context=project_context)

        elif agent_name == "implementation_autonomous_agent":
            implementation_manifest = payload.get("implementation_manifest")
            technical_spec = payload.get("technical_spec")
            if not implementation_manifest or not technical_spec:
                raise ValueError("Faltando 'implementation_manifest' ou 'technical_spec' para o implementation_autonomous_agent.")
            agent = ImplementationAutonomousAgent(project_id)
            result = agent.process(payload)

        elif agent_name == "developer":
            architecture = payload.get("architecture")
            if not architecture: raise ValueError("Faltando 'architecture' para o developer.")
            agent = NewDeveloper(project_id)
            result = agent.process(idea, architecture) # Retorna um dicionário

        elif agent_name == "developer_backend":
            architecture = payload.get("architecture")
            if not architecture: raise ValueError("Faltando 'architecture' para o developer_backend.")
            agent = DeveloperBackend(project_id)
            result = agent.process(idea, architecture)

        elif agent_name == "developer_frontend":
            architecture = payload.get("architecture")
            if not architecture: raise ValueError("Faltando 'architecture' para o developer_frontend.")
            backend_output = payload.get("developer_backend_output")
            agent = DeveloperFrontend(project_id)
            result = agent.process(idea, architecture, backend_output)

        elif agent_name == "qa_engineer":
            developer_output = payload.get("developer_output")
            if not developer_output or 'code' not in developer_output:
                raise ValueError("Faltando 'developer_output' com 'code' para o qa_engineer.")
            requirement_spec = payload.get("requirement_spec")
            agent = QAEngineer(project_id)
            result = agent.process(idea, developer_output['code'], requirement_spec=requirement_spec)

        elif agent_name == "project_builder":
            # Coleta todos os artefatos necessários do payload
            backlog = payload.get("backlog")
            requirements = payload.get("requirements")
            architecture = payload.get("architecture")
            developer_output = payload.get("developer_output")
            tests = payload.get("tests")

            if not all([backlog, requirements, architecture, developer_output, tests]):
                raise ValueError("Faltando um ou mais artefatos para o ProjectBuilder.")

            builder = ProjectBuilder(project_id)
            project_path = builder.create_project(
                idea,
                backlog,
                requirements,
                architecture,
                developer_output.get('code'),
                tests,
                developer_output.get('primary_entity', 'Task'),
                developer_output.get('attributes', [])
            )
            result = {"project_path": project_path}
            
        elif agent_name == "DebugAgent" or agent_name == "debug_agent":
            agent = DebugAgent(project_id)
            result = agent.process(payload)
        elif agent_name == "schema_agent":
            agent = SchemaAgent(project_id)
            result = agent.process(payload)
        elif agent_name == "backend_agent":
            agent = BackendAgent(project_id)
            result = agent.process(payload)
        elif agent_name == "frontend_agent":
            agent = FrontendAgent(project_id)
            result = agent.process(payload)
        elif agent_name == "ui_ux_specialist":
            agent = UiUxSpecialist(project_id)
            result = agent.process(payload)
        elif agent_name == "alignment_semantic":
            agent = AlignmentSemanticAgent()
            result = agent.process(idea)
        elif agent_name == "requirement_engine":
            agent = RequirementEngineAgent()
            result = agent.process(payload)
        elif agent_name == "requirement_challenger":
            agent = RequirementChallenger()
            result = agent.process(payload)
        elif agent_name == "backlog_challenger":
            agent = BacklogChallenger()
            result = agent.process(payload.get("backlog_contract"), payload.get("evidence_contract"))
        elif agent_name == "backlog_judge":
            agent = BacklogJudge()
            result = agent.process(payload.get("findings"))
        elif agent_name == "story_reviewer":
            agent = StoryReviewer(project_id)
            result = agent.process(payload)
        elif agent_name == "visual_requirement_analyst":
            agent = VisualRequirementAnalyst()
            result = agent.process(payload)
        else:
            raise ValueError(f"Agente desconhecido: {agent_name}")

        print(json.dumps({
            "success": True,
            "data": result,
            "meta": {
                "runtime_mode": runtime_mode,
                "runner": "orchestrator/run_single_agent.py",
            },
        }, ensure_ascii=False))

    except Exception as e:
        diagnostic = getattr(e, "rejected_draft", None)
        print(json.dumps({"success": False, "error": str(e), "diagnostic": diagnostic}, ensure_ascii=False), file=sys.stdout)
        sys.exit(1)

if __name__ == '__main__':
    main()
