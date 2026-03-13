"""
Script para executar a fábrica de software localmente
"""

import sys
import os

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from orchestrator.factory import Factory


def main():
    """Executa a fábrica com uma ideia de exemplo"""
    
    project_id = "demo-001"
    idea = """
    Sistema de controle de clientes para uma loja de eletrônicos.
    Deve incluir:
    - Cadastro e gerenciamento de clientes
    - Histórico de compras
    - Dashboard com estadísticas
    - Gerenciamento de produtos
    - Sistema de recomendações
    """
    
    print("🚀 AI Software Factory - Demo")
    print("=" * 60)
    
    # Criar e executar a factory
    factory = Factory(project_id, idea)
    results = factory.run()
    
    # Salvar os artefatos
    factory.save_artifacts()
    
    print("\n📊 Resumo dos artefatos gerados:")
    for key in results.keys():
        lines = results[key].count('\n')
        print(f"  - {key}: {lines} linhas")


if __name__ == '__main__':
    main()
