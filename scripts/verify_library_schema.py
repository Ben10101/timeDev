"""
Script de verificação do schema gerado para library-system-v1
"""
import os
import sys

def verify_library_schema():
    # Caminho base do projeto
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_file = os.path.join(base_dir, 'outputs', 'projects', 'library-system-v1', 'backend', 'src', 'server.js')
    
    print(f"🔎 Inspecionando: {target_file}")
    
    if not os.path.exists(target_file):
        print(f"❌ Erro: Arquivo não encontrado. Execute scripts/test_library_system.py primeiro.")
        return

    with open(target_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    print("\n---------------------------------------------------")
    
    # Busca a seção de criação da tabela
    if "CREATE TABLE IF NOT EXISTS" in content:
        # Tenta extrair o bloco da tabela principal (livros/books)
        # Assumindo que a tabela terá o nome da entidade plural, ignoramos 'users'
        print("📝 Definição SQL Gerada (Trecho):")
        
        lines = content.split('\n')
        in_table = False
        for line in lines:
            # Procura por create table que não seja a de usuários
            if "CREATE TABLE IF NOT EXISTS" in line and "users" not in line:
                in_table = True
                print(line.strip())
            elif in_table:
                print(line.strip())
                if ");" in line: # Fim da definição da tabela
                    in_table = False
                    break
    else:
        print("❌ Criação de tabela não encontrada.")

    print("---------------------------------------------------\n")

    # Verificação de campos específicos
    expected_fields = ['isbn', 'author', 'title']
    
    print("📊 Status dos Campos:")
    for field in expected_fields:
        # Verifica se o campo existe no conteúdo
        if field in content.lower():
            print(f"✅ {field.upper()}: Presente no código")
        else:
            print(f"❌ {field.upper()}: Ausente")

if __name__ == "__main__":
    verify_library_schema()