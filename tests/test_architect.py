#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de teste para o agente Architect (Arquiteto)
"""

import sys
import os

# Setup paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'orchestrator'))
sys.path.insert(0, os.path.join(project_root, 'agents'))

print("\n" + "="*80)
print("🏗️  Teste do Agente Architect (Arquiteto)")
print("="*80 + "\n")

# Configuração
from dotenv import load_dotenv
load_dotenv()

llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()
print(f"📋 Configuração: LLM_PROVIDER = {llm_provider}\n")

# Importar agentes necessários
print("[1/4] Importando agentes...")
try:
    from agents.project_manager.agent import ProjectManager
    from agents.requirements_analyst.agent import RequirementsAnalyst
    from agents.architect.agent import Architect
    print("✅ Agentes importados com sucesso\n")
except Exception as e:
    print(f"❌ Erro ao importar agentes: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Dados de teste
project_id = "architect-test-001"
idea = "Sistema de gerenciamento de tarefas com notificações em tempo real e colaboração em equipe"

print(f"[2/4] Inicializando teste...")
print(f"   Project ID: {project_id}")
print(f"   Ideia: {idea}\n")

# Executar ProjectManager
print("[3/4] Executando agentes dependentes (ProjectManager e RequirementsAnalyst)...")
try:
    pm = ProjectManager(project_id)
    backlog = pm.process(idea)
    print(f"✅ ProjectManager executado ({len(backlog)} caracteres gerados)")
    
    ra = RequirementsAnalyst(project_id)
    requirements = ra.process(idea, backlog)
    print(f"✅ RequirementsAnalyst executado ({len(requirements)} caracteres gerados)\n")
except Exception as e:
    print(f"❌ Erro ao executar agentes dependentes: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Executar Architect
print("[4/4] Executando agente Architect...")
print("-" * 80 + "\n")

try:
    architect = Architect(project_id)
    
    print(f"[Architect] Processando ideia...\n")
    architecture = architect.process(idea, requirements)
    
    print("\n" + "-" * 80)
    print("\n✅ SUCESSO! Arquitetura gerada pelo agente Architect:\n")
    
    # Mostrar resultado
    print(architecture)
    
    # Estatísticas
    print("\n" + "="*80)
    print(f"\n📊 Estatísticas:")
    print(f"   Caracteres: {len(architecture)}")
    print(f"   Linhas: {len(architecture.split(chr(10)))}")
    
    # Salvar resultado
    output_dir = os.path.join(project_root, 'outputs', 'architect_test')
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, f'{project_id}_architecture.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(architecture)
    
    print(f"   Arquivo salvo em: {output_file}")
    print("\n" + "="*80)
    print("\n🎉 Teste do Architect concluído com SUCESSO!\n")

except Exception as e:
    print(f"\n❌ ERRO ao executar Architect: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)
