#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Diagnóstico de Performance - AI Software Factory
Analisa gargalos e oferece recomendações de otimização
"""

import sys
import os
import time

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

print("\n" + "="*80)
print("⚡ Diagnóstico de Performance - AI Software Factory")
print("="*80 + "\n")

# Setup paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'agents'))

from dotenv import load_dotenv
load_dotenv()

import ollama as ollama_lib
from agents.developer.llm_service import generate_text_from_llm

results = {}

# 1. Verificar configuração
print("🔍 [1/5] Verificando Configuração...\n")

llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()
ollama_model = os.getenv("OLLAMA_MODEL", "mistral")

print(f"   LLM_PROVIDER: {llm_provider}")
print(f"   OLLAMA_MODEL: {ollama_model}\n")

if llm_provider == "ollama":
    print("   ⚠️  Você está usando Ollama (local).")
    print("       Modelos locais são mais lentos que APIs em nuvem.")
    print("       Mas têm vantagem: sem custo e sem latência de rede.\n")
else:
    print("   ℹ️  Você está usando Gemini (nuvem).")
    print("       Geralmente mais rápido que Ollama local.\n")

# 2. Testar velocidade do Ollama
print("⚡ [2/5] Testando Velocidade do Ollama...\n")

try:
    print(f"   Testando modelo: {ollama_model}")
    
    start = time.time()
    response = ollama_lib.generate(
        model=ollama_model,
        prompt="Responda com uma frase curta: O que é IA?",
        stream=False
    )
    elapsed = time.time() - start
    
    print(f"   ✅ Tempo de resposta: {elapsed:.2f}s")
    
    if elapsed > 3:
        print(f"   ⚠️  LENTO! ({elapsed:.2f}s é lento)")
        print(f"       Recomendação: Use um modelo mais rápido (neural-chat, dolphin-phi)")
    elif elapsed > 1:
        print(f"   ℹ️  Aceitável ({elapsed:.2f}s)")
    else:
        print(f"   ✅ RÁPIDO! ({elapsed:.2f}s)")
    
    results['ollama_speed'] = elapsed
    print()
    
except Exception as e:
    print(f"   ❌ Erro ao testar: {e}")
    print(f"   Certifique-se que Ollama está rodando: ollama serve\n")

# 3. Verificar modelos disponíveis
print("📦 [3/5] Modelos Disponíveis no Ollama...\n")

try:
    models_response = ollama_lib.list()
    models = models_response.models if hasattr(models_response, 'models') else models_response
    
    if models:
        print(f"   {len(models)} modelo(s) encontrado(s):\n")
        for model in models:
            model_name = model.model if hasattr(model, 'model') else str(model)
            print(f"      • {model_name}")
        print()
    else:
        print("   ⚠️  Nenhum modelo encontrado!")
        print("       Execute: ollama pull neural-chat\n")
        
except Exception as e:
    print(f"   ❌ Erro: {e}\n")

# 4. Recomendações de Otimização
print("💡 [4/5] Recomendações de Otimização...\n")

recommendations = []

if llm_provider == "ollama":
    recommendations.append({
        'title': '🚀 Usar Modelo Mais Rápido',
        'description': 'neural-chat é mais rápido que mistral',
        'action': 'ollama pull neural-chat\nDepois edite .env: OLLAMA_MODEL=neural-chat'
    })
    
    recommendations.append({
        'title': '💾 Reduzir Tamanho do Modelo',
        'description': 'Modelos menores são exeucados mais rápido',
        'action': 'Opções: neural-chat, dolphin-phi (ainda menores e rápidos)'
    })

recommendations.append({
    'title': '🔄 Paralelizar Agentes',
    'description': 'Executar agentes em paralelo em vez de sequencial',
    'action': 'Ativar no código: use ThreadPoolExecutor para rodar agentes simultaneamente'
})

recommendations.append({
    'title': '🗂️  Adicionar Cache',
    'description': 'Cachear respostas idênticas para reutilizar',
    'action': 'Implementar cache em um banco de dados rápido (Redis ou SQLite)'
})

recommendations.append({
    'title': '⚙️  Simplificar Prompts',
    'description': 'Prompts menores = respostas mais rápidas',
    'action': 'Reduzir exemplos e contexto desnecessário nos prompts'
})

recommendations.append({
    'title': '🔌 Usar API em Nuvem',
    'description': 'APIs em nuvem são geralmente mais rápidas que modelos locais',
    'action': 'Mude para: LLM_PROVIDER=gemini (se tiver quota disponível)'
})

for i, rec in enumerate(recommendations, 1):
    print(f"   {i}. {rec['title']}")
    print(f"      └─ {rec['description']}")
    print(f"      └─ Ação: {rec['action']}\n")

# 5. Opções Rápidas de Configuração
print("⚡ [5/5] Opções de Configuração de Performance...\n")

print("   OPÇÃO A - Mais Rápido (sacrifica qualidade):")
print("      - Use modelo: neural-chat")
print("      - Reduz qualidade, mas é ~2x mais rápido\n")

print("   OPÇÃO B - Balanceado (recomendado):")
print("      - Use modelo: dolphin-phi")
print("      - Bom equilíbrio entre velocidade e qualidade\n")

print("   OPÇÃO C - Melhor Qualidade (mais lento):")
print("      - Use modelo: mistral ou llama2")
print("      - Qualidade superior, mas ~3-5s por requisição\n")

print("   OPÇÃO D - Ultra Rápido (em nuvem):")
print("      - Use Gemini com API válida")
print("      - Responde em <1s, mas com custo\n")

# Recomendação
print("="*80)
print("\n✅ RECOMENDAÇÃO PARA SEU SISTEMA:\n")

if llm_provider == "ollama":
    print("   1. Teste este modelo rápido:")
    print("      $ ollama pull neural-chat\n")
    
    print("   2. Atualize .env:")
    print("      OLLAMA_MODEL=neural-chat\n")
    
    print("   3. Rode novamente e compare o tempo\n")
    
else:
    print("   Seu sistema está configurado para Gemini.\n")
    print("   Se estiver lento:")
    print("   - Verifique sua quota de API")
    print("   - Tente com modelo mais rápido: GEMINI_MODEL=gemini-2.0-flash\n")

print("="*80 + "\n")
