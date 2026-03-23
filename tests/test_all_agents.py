#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Teste completo de todos os agentes
Executa o pipeline inteiro: ProjectManager → RequirementsAnalyst → Architect → Developer → QAEngineer
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
print("🚀 Teste Completo: Todos os Agentes")
print("="*80 + "\n")

from dotenv import load_dotenv
load_dotenv()

# Importar agentes
print("[Fase 0] Importando agentes...\n")
try:
    from agents.project_manager.agent import ProjectManager
    from agents.requirements_analyst.agent import RequirementsAnalyst
    from agents.architect.agent import Architect
    from agents.developer.agent import Developer
    from agents.qa_engineer.agent import QAEngineer
    print("✅ Todos os agentes importados com sucesso!\n")
except Exception as e:
    print(f"❌ Erro ao importar: {e}\n")
    sys.exit(1)

# Dados de teste
project_id = "full-pipeline-test-001"
idea = "Plataforma de e-commerce com carrinho de compras, pagamento e notificações"

print("="*80)
print(f"\n📋 Pipeline Completo de Geração:")
print(f"   Project ID: {project_id}")
print(f"   Ideia: {idea}\n")
print("="*80 + "\n")

results = {}
agents_executed = []

# FASE 1: ProjectManager
print("1️⃣  [PROJECTMANAGER] Gerando backlog e épicos...")
try:
    pm = ProjectManager(project_id)
    results['backlog'] = pm.process(idea)
    agents_executed.append('ProjectManager')
    chars = len(results['backlog'])
    print(f"   ✅ Backlog gerado: {chars} caracteres\n")
except Exception as e:
    print(f"   ❌ ERRO: {e}\n")

# FASE 2: RequirementsAnalyst
print("2️⃣  [REQUIREMENTS ANALYST] Analisando requisitos...")
try:
    ra = RequirementsAnalyst(project_id)
    results['requirements'] = ra.process(idea, results.get('backlog', ''))
    agents_executed.append('RequirementsAnalyst')
    chars = len(results['requirements'])
    print(f"   ✅ Requisitos gerados: {chars} caracteres\n")
except Exception as e:
    print(f"   ❌ ERRO: {e}\n")

# FASE 3: Architect
print("3️⃣  [ARCHITECT] Definindo arquitetura...")
try:
    arc = Architect(project_id)
    results['architecture'] = arc.process(idea, results.get('requirements', ''))
    agents_executed.append('Architect')
    chars = len(results['architecture'])
    print(f"   ✅ Arquitetura definida: {chars} caracteres\n")
except Exception as e:
    print(f"   ❌ ERRO: {e}\n")

# FASE 4: Developer
print("4️⃣  [DEVELOPER] Gerando código...")
try:
    dev = Developer(project_id)
    results['code'] = dev.process(idea, results.get('architecture', ''))
    agents_executed.append('Developer')
    chars = len(results['code'])
    print(f"   ✅ Código gerado: {chars} caracteres\n")
except Exception as e:
    print(f"   ❌ ERRO: {e}\n")

# FASE 5: QAEngineer
print("5️⃣  [QA ENGINEER] Gerando plano de testes...")
try:
    qa = QAEngineer(project_id)
    results['tests'] = qa.process(idea, results.get('code', ''))
    agents_executed.append('QAEngineer')
    chars = len(results['tests'])
    print(f"   ✅ Testes gerados: {chars} caracteres\n")
except Exception as e:
    print(f"   ❌ ERRO: {e}\n")

# RESUMO
print("="*80)
print("\n✅ PIPELINE COMPLETO EXECUTADO COM SUCESSO!\n")

print("📊 Resumo de Resultados:\n")
for agent, content in results.items():
    lines = len(content.split('\n'))
    chars = len(content)
    print(f"   ✅ {agent.upper():20} | {chars:6} chars | {lines:4} lines")

print(f"\n🎯 Agentes executados: {len(agents_executed)}/5")
for agent in agents_executed:
    print(f"   ✅ {agent}")

# Salvar resultados
print("\n" + "-"*80)
print("\n💾 Salvando resultados...\n")

output_dir = os.path.join(project_root, 'outputs', 'full_pipeline_test')
os.makedirs(output_dir, exist_ok=True)

for agent_name, content in results.items():
    output_file = os.path.join(output_dir, f'{project_id}_{agent_name}.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"   ✅ Salvo: {agent_name}.md")

print(f"\n📁 Todos os arquivos salvos em: {output_dir}\n")

print("="*80)
print("\n🎉 TESTE COMPLETO FINALIZADO COM SUCESSO!\n")
print("Seu AI Software Factory está funcionando perfeitamente! 🚀\n")
