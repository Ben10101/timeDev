"""
Script de teste dedicado para a conexão com a API do Gemini.
"""

import sys
import os
import json

# Adicionar o diretório raiz ao path para encontrar os módulos
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importar a função específica que queremos testar
from agents.developer.llm_service import get_attributes_from_llm

def test_gemini_connection():
    """
    Executa um teste simples para verificar a conexão com a API do Gemini
    e a capacidade de extrair atributos.
    """
    
    idea = "Um sistema simples para uma biblioteca, para gerenciar livros com título, autor e ano de publicação."
    
    print("\n" + "="*60)
    print("🧪  Iniciando teste de conexão com a API do Gemini...")
    print("="*60)
    print(f"\n💡 Ideia de teste: \"{idea}\"")
    
    try:
        # Chamar a função que usa a IA
        attributes = get_attributes_from_llm(idea)
        
        if attributes:
            print("\n✅ SUCESSO! Conexão com o Gemini funcionando.")
            print("   A IA extraiu os seguintes atributos:")
            print("-" * 30)
            print(json.dumps(attributes, indent=2, ensure_ascii=False))
            print("-" * 30)
            print("\n🎉 Agora você pode gerar projetos completos usando a IA!")
        else:
            print("\n❌ FALHA! A chamada para a IA foi bem-sucedida, mas não retornou atributos.")
            print("   Isso pode ser um problema no prompt ou na resposta do modelo.")
            print("   Verifique os logs do 'LLM Service' no terminal para mais detalhes.")

    except Exception as e:
        print("\n" + "!"*60)
        print("❌ ERRO CRÍTICO! Não foi possível conectar ou processar a resposta do Gemini.")
        print(f"   Erro: {e}")
        print("!"*60)
        print("\n📋 Possíveis causas:")
        print("   1. Chave de API Inválida: Verifique se a 'GEMINI_API_KEY' no seu arquivo .env está correta.")
        print("   2. Pacotes não instalados: Rode 'pip install google-generativeai python-dotenv'.")
        print("   3. Problema de Conexão: Verifique sua conexão com a internet.")
        print("   4. Erro na API do Google: O serviço do Gemini pode estar temporariamente fora do ar.")

if __name__ == '__main__':
    test_gemini_connection()