#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para baixar modelos Ollama necessários para o AI Software Factory
"""

import sys
import os

print("\n" + "="*80)
print("📥 Gerenciador de Modelos Ollama para AI Software Factory")
print("="*80 + "\n")

# Verificar se ollama está instalado
try:
    import ollama
    print("✅ Módulo ollama encontrado\n")
except ImportError:
    print("❌ Módulo ollama não está instalado!")
    print("   Execute: pip install ollama\n")
    sys.exit(1)

# Verificar conexão com servidor Ollama
print("🔍 Verificando conexão com servidor Ollama...")
try:
    models_response = ollama.list()
    models = models_response.models if hasattr(models_response, 'models') else models_response
    print("✅ Servidor Ollama está rodando!\n")
    
    # Listar modelos disponíveis
    if models:
        print("📦 Modelos disponíveis no seu Ollama:")
        for model in models:
            model_name = model.model if hasattr(model, 'model') else str(model)
            print(f"   ✅ {model_name}")
    else:
        print("⚠️ Nenhum modelo foi encontrado. Você precisa baixar um.\n")

except Exception as e:
    print(f"❌ Erro ao conectar ao Ollama: {e}")
    print("\n🔧 Solução:")
    print("   1. Abra um novo terminal")
    print("   2. Execute: ollama serve")
    print("   3. Volte aqui e tente novamente\n")
    sys.exit(1)

# Modelos recomendados
print("\n" + "-"*80)
print("\n📋 Modelos Recomendados para AI Software Factory:\n")
print("   1. mistral (7B) - Rápido e eficiente - RECOMENDADO")
print("   2. neural-chat (7B) - Bom para conversas")
print("   3. llama2 (7B) - Versátil")
print("   4. dolphin-mixtral (8x7B) - Mais poderoso, usa mais RAM\n")

# Oferecer opção de download
print("-"*80)
print("\nDeseja baixar um modelo agora? (s/n): ", end="")
resposta = input().strip().lower()

if resposta == 's':
    print("\nQual modelo deseja baixar?")
    print("   1. mistral (padrão)")
    print("   2. neural-chat")
    print("   3. llama2")
    print("   4. dolphin-mixtral")
    print("   5. Todos os recomendados")
    print("\nEscolha (1-5): ", end="")
    
    opcao = input().strip()
    
    modelos_map = {
        '1': ['mistral'],
        '2': ['neural-chat'],
        '3': ['llama2'],
        '4': ['dolphin-mixtral'],
        '5': ['mistral', 'neural-chat', 'llama2'],
    }
    
    modelos_para_baixar = modelos_map.get(opcao, ['mistral'])
    
    print(f"\nBaixando {len(modelos_para_baixar)} modelo(s)...\n")
    
    for modelo in modelos_para_baixar:
        try:
            print(f"📥 Baixando '{modelo}'... (isso pode levar alguns minutos)")
            ollama.pull(modelo)
            print(f"✅ '{modelo}' baixado com sucesso!\n")
        except Exception as e:
            print(f"❌ Erro ao baixar '{modelo}': {e}\n")
            print(f"   Tente manualmente: ollama pull {modelo}\n")
    
    # Atualizar .env
    print("-"*80)
    print("\n🔧 Atualizando configuração do AI Software Factory...\n")
    
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            env_content = f.read()
        
        # If mistral was chosen, set it as default
        model_to_use = modelos_para_baixar[0]
        
        if f"OLLAMA_MODEL={model_to_use}" not in env_content:
            # Replace or add the line
            if "OLLAMA_MODEL=" in env_content:
                env_content = env_content.replace(
                    f"OLLAMA_MODEL=mistral",
                    f"OLLAMA_MODEL={model_to_use}"
                )
            else:
                env_content += f"\nOLLAMA_MODEL={model_to_use}\n"
            
            with open(env_file, 'w', encoding='utf-8') as f:
                f.write(env_content)
            
            print(f"✅ .env atualizado com OLLAMA_MODEL={model_to_use}\n")
    
    print("="*80)
    print("\n✅ Tudo pronto! Agora você pode usar Ollama com AI Software Factory!\n")
    print("Próximos passos:")
    print("   1. Certifique-se que 'ollama serve' está rodando em outro terminal")
    print("   2. Acesse: http://localhost:5173")
    print("   3. Digite uma ideia de projeto")
    print("   4. Seu Ollama local gerará o projeto!\n")

else:
    print("\n⏭️  Para usar Ollama depois, basta executar:")
    print("   python download_ollama_models.py\n")

print("="*80 + "\n")
