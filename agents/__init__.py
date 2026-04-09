"""
Arquivo __init__.py para tornar a pasta agents um pacote Python
"""

from .project_manager.agent import ProjectManager
from .requirements_analyst.agent import RequirementsAnalyst
from .architect.agent import Architect
from .implementation_autonomous.agent import ImplementationAutonomousAgent
from .developer.agent_new import Developer
from .developer_backend.agent import DeveloperBackend
from .developer_frontend.agent import DeveloperFrontend
from .qa_engineer.agent import QAEngineer

__all__ = [
    'ProjectManager',
    'RequirementsAnalyst',
    'Architect',
    'ImplementationAutonomousAgent',
    'Developer',
    'DeveloperBackend',
    'DeveloperFrontend',
    'QAEngineer'
]
