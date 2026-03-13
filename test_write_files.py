# -*- coding: utf-8 -*-
"""
Quick test that writes output to a file we can read
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent import Developer
from agents.qa_engineer.agent import QAEngineer

project_id = "test-file-001"
idea = "Sistema de controle de clientes"

# Test agents
pm = ProjectManager(project_id)
backlog = pm.process(idea)

ra = RequirementsAnalyst(project_id)
requirements = ra.process(idea, backlog)

arc = Architect(project_id)
architecture = arc.process(idea, requirements)

dev = Developer(project_id)
code = dev.process(idea, architecture)

qa = QAEngineer(project_id)
tests = qa.process(idea, code)

# Write results to file
results = {
    'backlog_size': len(backlog),
    'requirements_size': len(requirements),
    'architecture_size': len(architecture),
    'code_size': len(code),
    'tests_size': len(tests),
    'backlog_lines': backlog.count('\n'),
    'requirements_lines': requirements.count('\n'),
    'architecture_lines': architecture.count('\n'),
    'code_lines': code.count('\n'),
    'tests_lines': tests.count('\n'),
}

with open('test_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

# Write each content to separate files for inspection
with open('test_backlog.md', 'w', encoding='utf-8') as f:
    f.write(backlog)
    
with open('test_requirements.md', 'w', encoding='utf-8') as f:
    f.write(requirements)
    
with open('test_architecture.md', 'w', encoding='utf-8') as f:
    f.write(architecture)
    
with open('test_code.md', 'w', encoding='utf-8') as f:
    f.write(code)
    
with open('test_tests.md', 'w', encoding='utf-8') as f:
    f.write(tests)

print("✅ Test completed! Files written:")
print("  test_results.json")
print("  test_backlog.md")
print("  test_requirements.md")
print("  test_architecture.md")
print("  test_code.md")
print("  test_tests.md")
