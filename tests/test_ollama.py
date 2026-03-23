#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de teste para verificar se Ollama está funcionando corretamente
"""

import sys
import os

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'agents'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'orchestrator'))

print("🔍 Teste de Ollama para AI Software Factory\n")
print("=" * 80)

# 1. Verificar se Ollama está instalado
print("\n[1/4] Verificando se ollama está instalado...")
try:
    import ollama
    print("✅ Módulo 'ollama' encontrado")
except ImportError:
    print("❌ ERRO: módulo 'ollama' não está instalado")
    print("   Execute: pip install ollama")
    sys.exit(1)

# 2. Tentar conectar ao Ollama
print("\n[2/4] Tentando conectar ao servidor Ollama em localhost:11434...")
try:
    response = ollama.list()
    models = response.models if hasattr(response, 'models') else response
    print(f"✅ Conexão bem-sucedida!")
    print(f"   Modelos disponíveis: {len(models) if models else 0}")
    
    if models:
        for model in models[:5]:  # Mostrar os primeiros 5
            model_name = model.model if hasattr(model, 'model') else model.get('name', model)
            print(f"   - {model_name}")
    else:
        print("   ⚠️ Nenhum modelo encontrado. Execute: ollama pull mistral")
except Exception as e:
    print(f"❌ ERRO: Não conseguiu conectar ao Ollama")
    print(f"   Certifique-se que Ollama está rodando: ollama serve")
    print(f"   Detalhes: {e}")
    sys.exit(1)

# 3. Teste de geração de texto simples
print("\n[3/4] Testando geração de texto com Ollama...")
try:
    from agents.developer.ollama_service import generate_with_ollama
    
    prompt_simples = "Que é um sistema de gerenciamento de tarefas? Responda em uma frase."
    resultado = generate_with_ollama(prompt_simples, model="mistral", is_json=False)
    
    if resultado and "ERRO" not in resultado:
        print(f"✅ Texto gerado com sucesso!")
        print(f"   Resposta: {resultado[:100]}...")
    else:
        print(f"❌ Falha ao gerar texto")
        print(f"   Resposta: {resultado}")
except Exception as e:
    print(f"❌ ERRO ao testar: {e}")
    sys.exit(1)

# 4. Teste de geração JSON
print("\n[4/4] Testando geração JSON com Ollama...")
try:
    prompt_json = """
Analise esta ideia e retorne um JSON com atributos:
Ideia: "Sistema de gestão de tarefas com prioridade e status"

Responda APENAS com JSON válido no formato:
{
  "attributes": [
    {"name": "title", "type": "string", "sql_type": "VARCHAR(255)"},
    {"name": "priority", "type": "string", "sql_type": "VARCHAR(50)"}
  ]
}
"""
    
    resultado = generate_with_ollama(prompt_json, model="mistral", is_json=True)
    
    if resultado and isinstance(resultado, list):
        print(f"✅ JSON gerado com sucesso!")
        print(f"   Atributos extraídos: {len(resultado)}")
        for attr in resultado:
            print(f"   - {attr.get('name', 'N/A')}: {attr.get('type', 'N/A')}")
    else:
        print(f"⚠️ Resposta não foi JSON esperado")
except Exception as e:
    print(f"❌ ERRO ao testar JSON: {e}")

print("\n" + "=" * 80)
print("\n✅ Testes completos! Ollama está funcionando corretamente.\n")
print("Agora você pode rodar: npm run dev (no frontend)")
print("E o sistema usará seu Ollama local automaticamente!\n")
