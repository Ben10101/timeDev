# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Script de teste para verificar se os agentes estão funcionando
"""

import sys
import os
import io

# Configurar UTF-8 para output
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Obter caminhos
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

print(f"[OK] Script dir: {script_dir}")
print(f"[OK] Project root: {project_root}")

# Adicionar ao path
sys.path.insert(0, project_root)

print("\n[TEST] Testando imports dos agentes...\n")

try:
    from agents.project_manager.agent import ProjectManager
    print("[OK] ProjectManager importado com sucesso!")
except Exception as e:
    print(f"[ERROR] Erro ao importar ProjectManager: {e}")
    sys.exit(1)

try:
    from agents.requirements_analyst.agent import RequirementsAnalyst
    print("[OK] RequirementsAnalyst importado com sucesso!")
except Exception as e:
    print(f"[ERROR] Erro ao importar RequirementsAnalyst: {e}")
    sys.exit(1)

try:
    from agents.architect.agent import Architect
    print("[OK] Architect importado com sucesso!")
except Exception as e:
    print(f"[ERROR] Erro ao importar Architect: {e}")
    sys.exit(1)

try:
    from agents.developer.agent import Developer
    print("[OK] Developer importado com sucesso!")
except Exception as e:
    print(f"[ERROR] Erro ao importar Developer: {e}")
    sys.exit(1)

try:
    from agents.qa_engineer.agent import QAEngineer
    print("[OK] QAEngineer importado com sucesso!")
except Exception as e:
    print(f"[ERROR] Erro ao importar QAEngineer: {e}")
    sys.exit(1)

print("\n[SUCCESS] Todos os agentes foram importados com sucesso!")
print("\n[TEST] Testando execução simples...")

try:
    pm = ProjectManager("test-001")
    backlog = pm.process("Um TODO app simples")
    print(f"[OK] ProjectManager executado! Gerou {len(backlog)} caracteres")
except Exception as e:
    print(f"[ERROR] Erro ao executar ProjectManager: {e}")
    sys.exit(1)

print("\n[SUCCESS] Todos os testes passaram!")
