#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Teste de encoding UTF-8 para o AI Software Factory
"""

import sys
import os

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

print("\n" + "="*80)
print("🧪 Teste de Encoding UTF-8")
print("="*80 + "\n")

print(f"Encoding do stdout: {sys.stdout.encoding}")
print(f"Encoding do stderr: {sys.stderr.encoding}\n")

# Teste com caracteres acentuados
teste_strings = [
    "Projeto com acentuação: descrição, análise, método",
    "Caracteres especiais: é, ã, ô, ü, ç",
    "Emojis: 🎉 ✅ ❌ 📋 🔍",
    "Múltiplos idiomas: café, naïve, déjà vu",
]

print("Testando impressão de strings com acentuação:\n")
for texto in teste_strings:
    print(f"   ✅ {texto}")

print("\n" + "="*80)
print("\nAgora testando com Ollama...\n")

# Setup paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(project_root, 'agents'))

from dotenv import load_dotenv
load_dotenv()

# Teste com Ollama
try:
    from agents.developer.ollama_service import generate_with_ollama
    
    print("Testando resposta do Ollama com acentuação...\n")
    
    prompt = "Descreva em uma frase o que é um catálogo de filmes."
    resposta = generate_with_ollama(prompt, model="mistral", is_json=False)
    
    print(f"Resposta do Ollama:\n{resposta}\n")
    
    if "?" not in resposta:
        print("✅ Encoding funcionando corretamente! Nenhum caractere corrompido.")
    else:
        print("⚠️ Ainda há caracteres com problemas de encoding.")
        
except Exception as e:
    print(f"⚠️ Não foi possível testar com Ollama: {e}")

print("\n" + "="*80 + "\n")
