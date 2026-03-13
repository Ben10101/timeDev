# -*- coding: utf-8 -*-
"""
Direct agent test - circumvent factory.py
Run each agent independently and check output
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.project_manager.agent import ProjectManager
from agents.requirements_analyst.agent import RequirementsAnalyst
from agents.architect.agent import Architect
from agents.developer.agent import Developer
from agents.qa_engineer.agent import QAEngineer

def test_agents():
    """Test each agent directly"""
    
    project_id = "test-direct-001"
    idea = "Sistema de controle de clientes para loja de eletrônicos com dashboard e relatórios"
    
    print("[START] Testing agents directly", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    # Test ProjectManager
    print("\n[1/5] Testing ProjectManager...", file=sys.stderr)
    pm = ProjectManager(project_id)
    backlog = pm.process(idea)
    print(f"[OK] ProjectManager output: {len(backlog)} chars, {backlog.count(chr(10))} lines", file=sys.stderr)
    
    # Test RequirementsAnalyst
    print("\n[2/5] Testing RequirementsAnalyst...", file=sys.stderr)
    ra = RequirementsAnalyst(project_id)
    requirements = ra.process(idea, backlog)
    print(f"[OK] RequirementsAnalyst output: {len(requirements)} chars, {requirements.count(chr(10))} lines", file=sys.stderr)
    
    # Test Architect
    print("\n[3/5] Testing Architect...", file=sys.stderr)
    arc = Architect(project_id)
    architecture = arc.process(idea, requirements)
    print(f"[OK] Architect output: {len(architecture)} chars, {architecture.count(chr(10))} lines", file=sys.stderr)
    
    # Test Developer
    print("\n[4/5] Testing Developer...", file=sys.stderr)
    dev = Developer(project_id)
    code = dev.process(idea, architecture)
    print(f"[OK] Developer output: {len(code)} chars, {code.count(chr(10))} lines", file=sys.stderr)
    
    # Test QAEngineer
    print("\n[5/5] Testing QAEngineer...", file=sys.stderr)
    qa = QAEngineer(project_id)
    tests = qa.process(idea, code)
    print(f"[OK] QAEngineer output: {len(tests)} chars, {tests.count(chr(10))} lines", file=sys.stderr)
    
    print("\n" + "=" * 80, file=sys.stderr)
    print("[SUCCESS] All agents tested!", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    # Print results
    print("\n[DEBUG] Printing backlog:\n")
    print(backlog)
    print("\n" + "="*80 + "\n")
    
    print("[DEBUG] Printing requirements:\n")
    print(requirements)
    print("\n" + "="*80 + "\n")
    
    print("[DEBUG] Printing architecture:\n")
    print(architecture[:500] + "...\n")
    print("\n" + "="*80 + "\n")
    
    print("[DEBUG] Printing code (first 500 chars):\n")
    print(code[:500] + "...\n")
    print("\n" + "="*80 + "\n")
    
    print("[DEBUG] Printing tests (first 500 chars):\n")
    print(tests[:500] + "...\n")

if __name__ == '__main__':
    test_agents()
