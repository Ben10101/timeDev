#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de teste para o agente Developer
"""

import sys
import os

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

# Setup paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'orchestrator'))
sys.path.insert(0, os.path.join(project_root, 'agents'))

print("\n" + "="*80)
print("💻 Teste do Agente Developer")
print("="*80 + "\n")

from dotenv import load_dotenv
load_dotenv()

# Importar agentes
print("[1/5] Importando agentes...")
try:
    from agents.project_manager.agent import ProjectManager
    from agents.requirements_analyst.agent import RequirementsAnalyst
    from agents.architect.agent import Architect
    from agents.developer.agent import Developer
    print("✅ Agentes importados com sucesso\n")
except Exception as e:
    print(f"❌ Erro ao importar: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Dados de teste
project_id = "developer-test-001"
idea = "Sistema de gerenciamento de tarefas com notificações em tempo real"

print(f"[2/5] Configurando teste...")
print(f"   Project ID: {project_id}")
print(f"   Ideia: {idea}\n")

# Executar agentes dependentes
print("[3/5] Executando agentes dependentes...")
try:
    pm = ProjectManager(project_id)
    backlog = pm.process(idea)
    print(f"✅ ProjectManager executado")
    
    ra = RequirementsAnalyst(project_id)
    requirements = ra.process(idea, backlog)
    print(f"✅ RequirementsAnalyst executado")
    
    arc = Architect(project_id)
    architecture = arc.process(idea, requirements)
    print(f"✅ Architect executado\n")
except Exception as e:
    print(f"❌ Erro: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Executar Developer
print("[4/5] Executando agente Developer...")
print("-" * 80 + "\n")

try:
    dev = Developer(project_id)
    code_structure = dev.process(idea, architecture)
    
    print("\n" + "-" * 80)
    print("\n✅ SUCESSO! Estrutura de código gerada.\n")
    
    print("📄 Resultado (primeiros 1000 caracteres):\n")
    print(code_structure[:1000] + "...\n" if len(code_structure) > 1000 else code_structure + "\n")
    
    # Estatísticas
    print("\n" + "="*80)
    print(f"\n📊 Estatísticas:")
    print(f"   Caracteres: {len(code_structure)}")
    print(f"   Linhas: {len(code_structure.split(chr(10)))}")
    
    # Salvar resultado
    output_dir = os.path.join(project_root, 'outputs', 'developer_test')
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, f'{project_id}_code.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(code_structure)
    
    print(f"   Arquivo salvo em: {output_file}")
    
    print("\n" + "="*80)
    print("\n🎉 Teste do Developer concluído com SUCESSO!\n")

except Exception as e:
    print(f"\n❌ ERRO ao executar Developer: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)
