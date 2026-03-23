#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificador de Projetos - Diagnóstico completo
Mostra exatamente onde os projetos estão sendo salvos
"""

import os
import json
from pathlib import Path
from datetime import datetime

def main():
    """Verifica onde os projetos foram salvos"""
    
    # Script está na raiz do projeto
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("\n" + "="*75)
    print("  🔍 VERIFICADOR DE PROJETOS - AI Software Factory")
    print("="*75)
    
    print(f"\n📍 Raiz do Projeto: {script_dir}\n")
    
    # Caminho esperado
    projects_dir = os.path.join(script_dir, 'outputs', 'projects')
    print(f"📁 Procurando em: {projects_dir}\n")
    
    # Verificar se a pasta existe
    if not os.path.exists(projects_dir):
        print("❌ ATENÇÃO: Pasta 'outputs/projects' não existe!")
        print("\n✅ Criando pasta...")
        os.makedirs(projects_dir, exist_ok=True)
        print("✅ Pasta criada com sucesso!")
        print("\n📋 Próximos passos:")
        print("   1. Abra http://localhost:5173")
        print("   2. Digite uma ideia (ex: 'Sistema de Tarefas')")
        print("   3. Clique em 'Gerar Projeto'")
        print("   4. Aguarde 30-60 segundos")
        print("   5. Execute este script novamente\n")
        return
    
    # Listar projetos
    try:
        projects = sorted([
            d for d in os.listdir(projects_dir) 
            if os.path.isdir(os.path.join(projects_dir, d))
        ])
        
        if not projects:
            print("⚠️  NENHUM PROJETO ENCONTRADO ainda!")
            print("\n📋 Para criar seu primeiro projeto:")
            print("   1. Abra http://localhost:5173")
            print("   2. Digite sua ideia (ex: 'Aplicativo de Notas')")
            print("   3. Clique em 'Gerar Projeto'")
            print("   4. Aguarde 30-60 segundos")
            print("   5. Execute este script novamente\n")
            return
        
        print(f"✅ {len(projects)} PROJETO(S) ENCONTRADO(S)!\n")
        
        for idx, project_id in enumerate(projects, 1):
            project_path = os.path.join(projects_dir, project_id)
            
            print(f"\n{'─'*75}")
            print(f"📦 Projeto #{idx}")
            print(f"{'─'*75}")
            print(f"ID: {project_id}")
            print(f"Caminho: {project_path}\n")
            
            # Verificar estrutura
            folders = []
            files = []
            
            for item in os.listdir(project_path):
                item_path = os.path.join(project_path, item)
                if os.path.isdir(item_path):
                    folders.append(item)
                else:
                    files.append(item)
            
            if folders:
                print("Pastas:")
                for folder in folders:
                    folder_path = os.path.join(project_path, folder)
                    item_count = len(os.listdir(folder_path))
                    print(f"  ✅ {folder}/ ({item_count} itens)")
            
            if files:
                print("\nArquivos:")
                for file in files:
                    file_path = os.path.join(project_path, file)
                    size_kb = os.path.getsize(file_path) / 1024
                    print(f"  📄 {file} ({size_kb:.1f} KB)")
            
            # Ler metadata se existir
            metadata_path = os.path.join(project_path, 'metadata.json')
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        if 'idea' in metadata:
                            print(f"\nIdeia: {metadata['idea']}")
                        if 'created_at' in metadata:
                            print(f"Criado em: {metadata['created_at']}")
                except:
                    pass
        
        print(f"\n{'='*75}")
        print("✅ TUDO PRONTO!")
        print(f"{'='*75}\n")
        print("Como executar um projeto:\n")
        print("1️⃣  Abra 2 terminais\n")
        print("2️⃣  Terminal 1 (Backend):")
        print("   cd outputs/projects/[seu-projeto-id]/backend")
        print("   npm install")
        print("   npm start\n")
        print("3️⃣  Terminal 2 (Frontend):")
        print("   cd outputs/projects/[seu-projeto-id]/frontend")
        print("   npm install")
        print("   npm run dev\n")
        print("4️⃣  Acesse http://localhost:5173\n")
        
    except Exception as e:
        print(f"❌ Erro: {e}\n")

if __name__ == '__main__':
    main()
