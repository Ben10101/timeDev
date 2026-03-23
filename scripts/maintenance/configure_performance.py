#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Configurador de Performance - Define as melhores configurações para seu sistema
"""

import sys
import os

# Garantir UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf8', buffering=1)

print("\n" + "="*80)
print("⚡ Configurador de Performance Interativo")
print("="*80 + "\n")

print("Escolha sua prioridade:\n")
print("   1️⃣  VELOCIDADE (priorizar rapidez)")
print("   2️⃣  QUALIDADE (priorizar qualidade dos resultados)")
print("   3️⃣  BALANCEADO (equilíbrio entre velocidade e qualidade)")
print()

choice = input("Sua escolha (1-3): ").strip()

env_file = os.path.join(os.path.dirname(__file__), '.env')

if not os.path.exists(env_file):
    print("\n❌ Erro: Arquivo .env não encontrado!")
    sys.exit(1)

# Ler arquivo atual
with open(env_file, 'r', encoding='utf-8') as f:
    env_content = f.read()

# Configurações recomendadas
configs = {
    '1': {
        'name': '⚡ VELOCIDADE',
        'settings': {
            'LLM_PROVIDER': 'ollama',
            'OLLAMA_MODEL': 'neural-chat',
        },
        'description': 'Modelo mais rápido (neural-chat)',
        'instructions': [
            'ollama pull neural-chat',
        ]
    },
    '2': {
        'name': '🎯 QUALIDADE',
        'settings': {
            'LLM_PROVIDER': 'ollama',
            'OLLAMA_MODEL': 'mistral',
        },
        'description': 'Melhor qualidade, mais lento (mistral)',
        'instructions': [
            'ollama pull mistral',
        ]
    },
    '3': {
        'name': '⚖️  BALANCEADO',
        'settings': {
            'LLM_PROVIDER': 'ollama',
            'OLLAMA_MODEL': 'dolphin-phi',
        },
        'description': 'Bom equilíbrio (dolphin-phi)',
        'instructions': [
            'ollama pull dolphin-phi',
        ]
    }
}

if choice not in configs:
    print("\n❌ Opção inválida!")
    sys.exit(1)

config = configs[choice]

print(f"\n✅ Configuração Selecionada: {config['name']}")
print(f"   Descrição: {config['description']}\n")

print("📋 Passo a Passo:\n")

# Executar instruções
for i, instruction in enumerate(config['instructions'], 1):
    print(f"   {i}. {instruction}")

print("\n💾 Atualizando .env...\n")

# Atualizar .env
for key, value in config['settings'].items():
    # Se já existe a linha, substitui
    if f"{key}=" in env_content:
        env_content = env_content.replace(
            [line for line in env_content.split('\n') if line.startswith(key + '=')][0],
            f"{key}={value}"
        )
    else:
        # Caso contrário, adiciona
        env_content += f"\n{key}={value}"

# Salvar arquivo atualizado
with open(env_file, 'w', encoding='utf-8') as f:
    f.write(env_content)

print("✅ .env atualizado com sucesso!\n")

print("="*80)
print(f"\n✅ Configuração '{config['name']}' ativada!\n")

print("📌 Próximos passos:\n")
print("   1. Abra um terminal e execute:")
print(f"      {config['instructions'][0]}\n")
print("   2. Aguarde o download do modelo (pode levar alguns minutos)\n")
print("   3. Volte à aplicação e teste!\n")

print("="*80 + "\n")
