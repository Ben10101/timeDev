# -*- coding: utf-8 -*-
import sys
import json
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent_new import Developer as NewDeveloper
from agents.qa_engineer.agent import QAEngineer
from orchestrator.projectBuilder import ProjectBuilder

def main():
    try:
        input_data = json.load(sys.stdin)
        
        agent_name = input_data.get("agent")
        payload = input_data.get("payload", {})
        project_id = payload.get("project_id")
        idea = payload.get("idea")

        if not agent_name or not project_id or not idea:
            raise ValueError("Faltando 'agent', 'project_id', ou 'idea' no payload.")

        result = None
        
        if agent_name == "project_manager":
            agent = ProjectManager(project_id)
            result = agent.process(idea)
        
        elif agent_name == "requirements_analyst":
            backlog = payload.get("backlog")
            if not backlog: raise ValueError("Faltando 'backlog' para o requirements_analyst.")
            agent = RequirementsAnalyst(project_id)
            result = agent.process(idea, backlog)

        elif agent_name == "architect":
            requirements = payload.get("requirements")
            if not requirements: raise ValueError("Faltando 'requirements' para o architect.")
            agent = Architect(project_id)
            result = agent.process(idea, requirements)

        elif agent_name == "developer":
            architecture = payload.get("architecture")
            if not architecture: raise ValueError("Faltando 'architecture' para o developer.")
            agent = NewDeveloper(project_id)
            result = agent.process(idea, architecture) # Retorna um dicionário

        elif agent_name == "qa_engineer":
            developer_output = payload.get("developer_output")
            if not developer_output or 'code' not in developer_output:
                raise ValueError("Faltando 'developer_output' com 'code' para o qa_engineer.")
            agent = QAEngineer(project_id)
            result = agent.process(idea, developer_output['code'])

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
            
        else:
            raise ValueError(f"Agente desconhecido: {agent_name}")

        print(json.dumps({"success": True, "data": result}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stdout)
        sys.exit(1)

if __name__ == '__main__':
    main()