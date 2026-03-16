"""
Script de teste dedicado para o agente Architect.
"""

import sys
import os

# Força o uso do provedor Ollama para este teste específico
os.environ['LLM_PROVIDER'] = 'ollama'

# Adicionar o diretório raiz ao path para encontrar os módulos
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.architect.agent import Architect

def test_architect():
    """
    Executa um teste isolado para o agente Architect,
    fornecendo dados de entrada simulados.
    """
    
    project_id = "architect-test-001"
    idea = "Um sistema de e-commerce para venda de produtos eletrônicos, com catálogo, carrinho de compras e área de administrador."
    
    # Simula o output do agente de requisitos
    simulated_requirements = """
    # ESPECIFICAÇÃO DE REQUISITOS
    ## Requisitos Funcionais
    - RF-01: O sistema deve permitir o cadastro de produtos com nome, preço, estoque e imagem.
    - RF-02: Os usuários devem poder navegar pelo catálogo de produtos.
    - RF-03: O sistema deve ter um carrinho de compras funcional.
    - RF-04: Deve haver um processo de checkout.
    - RF-05: Administradores devem ter um painel para gerenciar produtos e pedidos.
    
    ## Requisitos Não-Funcionais
    - RNF-01: O site deve carregar em menos de 3 segundos.
    - RNF-02: A plataforma deve ser segura e proteger os dados dos usuários.
    """
    
    print("\n" + "="*60)
    print("🏛️  Iniciando teste do Agente Architect (usando OLLAMA)...")
    print("="*60)
    print(f"\n💡 Ideia de teste: \"{idea}\"")
    
    try:
        architect_agent = Architect(project_id)
        architecture_doc = architect_agent.process(idea, simulated_requirements)
        
        print("\n✅ SUCESSO! O agente Architect gerou o seguinte documento de arquitetura:")
        print("-" * 60)
        print(architecture_doc)
        print("-" * 60)

    except Exception as e:
        print(f"\n❌ ERRO CRÍTICO ao executar o agente Architect: {e}")

if __name__ == '__main__':
    test_architect()