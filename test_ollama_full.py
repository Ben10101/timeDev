#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Teste End-to-End do AI Software Factory com Ollama
"""

import sys
import os
from pathlib import Path

# Setup paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'orchestrator'))
sys.path.insert(0, os.path.join(project_root, 'agents'))

print("🚀 Teste End-to-End: AI Software Factory com Ollama Local\n")
print("=" * 80)

# Verificar configuração
from dotenv import load_dotenv
load_dotenv()

llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()
ollama_model = os.getenv("OLLAMA_MODEL", "mistral")

print(f"\n📋 Configuração:")
print(f"   LLM_PROVIDER: {llm_provider}")
print(f"   OLLAMA_MODEL: {ollama_model}")

if llm_provider != "ollama":
    print("\n⚠️ AVISO: LLM_PROVIDER não está configurado para ollama!")
    print("   Atualize seu .env com: LLM_PROVIDER=ollama")
    sys.exit(1)

print("\n✅ Sistema configurado para usar Ollama!\n")

# Verificar Ollama
print("[1/3] Verificando Ollama...")
try:
    import ollama
    ollama.list()
    print("✅ Ollama está rodando corretamente\n")
except Exception as e:
    print(f"❌ Ollama não está disponível: {e}")
    print("   Execute em outro terminal: ollama serve")
    sys.exit(1)

# Importar factory
print("[2/3] Importando AI Software Factory...")
try:
    from factory import SoftwareFactory
    print("✅ Factory importada com sucesso\n")
except Exception as e:
    print(f"❌ Erro ao importar factory: {e}")
    sys.exit(1)

# Testar geração de projeto
print("[3/3] Gerando projeto de teste com Ollama...\n")
try:
    project_id = "ollama-test-001"
    idea = "Sistema simples de lista de tarefas com prioridade e status"
    
    print(f"   Project ID: {project_id}")
    print(f"   Ideia: {idea}\n")
    print("-" * 80 + "\n")
    
    factory = SoftwareFactory(project_id, idea)
    results = factory.run()
    
    print("\n" + "-" * 80)
    print("\n✅ SUCESSO! Projeto gerado com Ollama!\n")
    
    # Mostrar resultados
    print("📊 Artefatos Gerados:")
    for key, value in results.items():
        if isinstance(value, str):
            lines = len(value.split('\n'))
            chars = len(value)
            print(f"   ✅ {key.upper()}: {chars} caracteres, {lines} linhas")
        else:
            print(f"   ✅ {key.upper()}: {type(value).__name__}")
    
    # Caminho do projeto
    project_path = os.path.join(project_root, 'outputs', 'projects', project_id)
    if os.path.exists(project_path):
        print(f"\n📁 Projeto salvo em: {project_path}\n")
        
        # Listar arquivos criados
        files_created = []
        for root, dirs, files in os.walk(project_path):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), project_path)
                files_created.append(rel_path)
        
        print(f"📦 {len(files_created)} arquivos criados:")
        for f in sorted(files_created)[:10]:
            print(f"   - {f}")
        if len(files_created) > 10:
            print(f"   ... e mais {len(files_created) - 10} arquivos")
    
    print("\n" + "=" * 80)
    print("\n🎉 Teste concluído com SUCESSO!\n")
    print("Seu Ollama local está funcionando perfeitamente com o AI Software Factory!")
    
except Exception as e:
    print(f"\n❌ ERRO durante a geração: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)
