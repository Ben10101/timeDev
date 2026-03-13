# -*- coding: utf-8 -*-
"""
Script de teste direto do Factory sem passar por Node.js
Executa os agentes e mostra o output
"""

import sys
import os
import json

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator.factory import Factory

def main():
    project_id = "test-001"
    idea = "Sistema de controle de clientes para loja de eletrônicos"
    
    print("[TEST] Iniciando teste direto...", file=sys.stderr)
    print(f"[TEST] Project ID: {project_id}", file=sys.stderr)
    print(f"[TEST] Idea: {idea}", file=sys.stderr)
    
    # Criar factory
    factory = Factory(project_id, idea)
    
    # Executar
    print("[TEST] Executando factory.run()...", file=sys.stderr)
    results = factory.run()
    
    # Verificar resultados
    print("[TEST] Verificando tamanhos dos resultados:", file=sys.stderr)
    for key, value in results.items():
        lines = value.count('\n') if isinstance(value, str) else 0
        chars = len(value) if isinstance(value, str) else 0
        print(f"[TEST]   - {key}: {chars} chars, {lines} lines", file=sys.stderr)
    
    # Tentar imprimir como JSON (igual factory.py faz)
    print("[TEST] Tentando imprimir JSON para stdout...", file=sys.stderr)
    output = {
        'projectId': project_id,
        'timestamp': 'test',
        **results
    }
    
    try:
        json_str = json.dumps(output, ensure_ascii=False, indent=2)
        print(json_str)  # Isto deve ir para stdout
        print(f"[TEST] JSON impresso com sucesso, {len(json_str)} caracteres", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] Falha ao serializar JSON: {e}", file=sys.stderr)
        print(f"[ERROR] Results keys: {list(results.keys())}", file=sys.stderr)

if __name__ == '__main__':
    main()
