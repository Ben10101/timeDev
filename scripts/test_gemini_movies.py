"""
Script de teste para integração com Gemini
Gera: Catálogo de Filmes
"""

import sys
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from orchestrator.factory import Factory

def main():
    project_id = "movies-catalog-gemini"
    
    # Prompt específico para testar a inteligência do Gemini
    idea = """
    Catálogo de Filmes com título, ano de lançamento e diretor.
    O sistema deve permitir cadastrar novos filmes e listar os existentes.
    Gostaria também de um campo para a sinopse do filme.
    """
    
    print("\n🎬 Iniciando Teste de Integração Gemini - Catálogo de Filmes")
    print("=" * 60)
    print(f"Ideia: {idea.strip()}")
    print("=" * 60)
    
    # Criar e executar a factory
    factory = Factory(project_id, idea)
    results = factory.run()
    
    print(f"\n✅ Projeto gerado em: outputs/projects/{project_id}")

if __name__ == '__main__':
    main()