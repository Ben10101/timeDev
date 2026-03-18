#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de teste isolado para o agente UI UX Specialist
"""

import sys
import os
import json

# Configuração de Encoding para Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

# Adiciona diretórios ao path para importação
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'orchestrator'))
sys.path.insert(0, os.path.join(project_root, 'agents'))

print("\n" + "="*80)
print("🎨 Teste do Agente UI UX Specialist (Low-Code JSON)")
print("="*80 + "\n")

from dotenv import load_dotenv
load_dotenv()

# Tenta importar o agente do local correto
print("[1/3] Importando agente...")
try:
    # O import deve vir de agents.ui_ux_specialist.agent
    from agents.ui_ux_specialist.agent import run as run_ui_agent
    print("✅ Agente UI UX Specialist importado com sucesso.\n")
except ImportError as e:
    print(f"❌ Erro ao importar agente: {e}")
    print("Certifique-se de que o arquivo está em: agents/ui_ux_specialist/agent.py")
    sys.exit(1)

# Dados de teste (Mock)
project_id = "ui-ux-test-001"
mock_requirements = """
# REQUISITOS DO SISTEMA
1. O sistema deve ter uma tela de Login com email e senha.
"""
mock_idea = "Sistema de gestão de vendas simples."

print(f"[2/3] Configurando teste...")
print(f"   Project ID: {project_id}")
print(f"   Cenário: {mock_idea}\n")

# Execução
print("[3/3] Executando agente UI UX Specialist...")
print("-" * 80 + "\n")

try:
    # Simula o payload que o orchestrator enviaria
    payload = {
        'requirements': mock_requirements,
        'idea': mock_idea
    }
    
    # Chama a função run do agente
    result_json_str = run_ui_agent(project_id, payload)
    
    print("\n" + "-" * 80)
    print("\n✅ SUCESSO! JSON de UI gerado:\n")
    print(result_json_str)
    print("\n" + "-" * 80)
    
    # Validação do JSON
    try:
        if not result_json_str:
            raise ValueError("O retorno do agente está vazio.")

        # Limpeza de markdown (```json ... ```) para evitar erros de parse
        clean_json = result_json_str.strip()
        if "```" in clean_json:
            clean_json = clean_json.replace("```json", "").replace("```", "").strip()

        result_data = json.loads(clean_json)
        
        if "app_name" in result_data and "pages" in result_data:
            print("✅ Estrutura JSON parece válida (contém 'app_name' e 'pages').")
        else:
            print("⚠️  Aviso: O JSON gerado pode não estar no formato esperado.")
    except json.JSONDecodeError as e:
        print(f"❌ ERRO DE PARSING: A saída do modelo não é um JSON válido.\nDetalhes: {e}")

except Exception as e:
    print(f"\n❌ ERRO DURANTE A EXECUÇÃO: {e}")
    import traceback
    traceback.print_exc()