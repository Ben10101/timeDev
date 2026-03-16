"""
Script de teste para gerar Sistema de Biblioteca e validar correções
"""

import sys
import os

# Adicionar o diretório raiz ao path para garantir que imports funcionem
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from orchestrator.factory import Factory
except ImportError as e:
    print(f"❌ Erro de importação: {e}")
    print("Verifique se o arquivo orchestrator/__init__.py existe.")
    sys.exit(1)

def main():
    project_id = "library-system-v1"
    
    idea = """
    Sistema de Gestão de Biblioteca.
    Deve permitir o cadastro de Livros (título, autor, ISBN, ano), 
    gerenciamento de Usuários (leitores) e controle de Empréstimos.
    O sistema deve ter validação de disponibilidade do livro e cálculo de data de entrega.
    """
    
    print("\n" + "="*60)
    print("📚 Iniciando Teste de Integração - Sistema de Biblioteca")
    print("="*60)
    print(f"Ideia: {idea.strip()}")
    print("-" * 60)
    
    try:
        # Criar e executar a factory
        factory = Factory(project_id, idea)
        factory.run()
        
        print(f"\n✅ SUCESSO! Projeto gerado em: outputs/projects/{project_id}")
        
    except Exception as e:
        print(f"\n❌ ERRO durante a execução: {e}")

if __name__ == '__main__':
    main()