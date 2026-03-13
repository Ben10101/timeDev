#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificador de Projetos Gerados
Mostra onde estão seus projetos e como acessá-los
"""

import os
import sys
from pathlib import Path

def print_header():
    print("\n" + "="*60)
    print(" 🔍 VERIFICADOR DE PROJETOS GERADOS")
    print("="*60 + "\n")

def find_projects():
    base_path = Path("outputs/projects")
    
    if not base_path.exists():
        print(f"❌ Pasta NÃO encontrada: {base_path.absolute()}")
        print("\nCaminho esperado:")
        print(f"  📁 {base_path.absolute()}")
        return []
    
    # Listar projetos
    projects = [d for d in base_path.iterdir() if d.is_dir()]
    
    if not projects:
        print(f"⚠️  Pasta vazia: {base_path.absolute()}")
        print("\n📋 PRÓXIMOS PASSOS:")
        print("  1. Abra http://localhost:5173")
        print("  2. Descreva uma ideia de software")
        print("  3. Clique em 'Gerar Projeto'")
        print("  4. Aguarde 30-60 segundos")
        print("  5. Execute este script novamente")
        return []
    
    print(f"✅ Pasta encontrada: {base_path.absolute()}\n")
    print(f"📊 Total de projetos: {len(projects)}\n")
    
    for i, project in enumerate(projects, 1):
        project_name = project.name
        frontend_exists = (project / "frontend").exists()
        backend_exists = (project / "backend").exists()
        docs_exists = (project / "docs").exists()
        
        print(f"{i}. 📂 {project_name}")
        print(f"   ├─ Frontend: {'✅' if frontend_exists else '❌'}")
        print(f"   ├─ Backend:  {'✅' if backend_exists else '❌'}")
        print(f"   └─ Docs:     {'✅' if docs_exists else '❌'}")
        print()
    
    return projects

def show_instructions():
    print("\n" + "="*60)
    print(" 📋 COMO ACESSAR SEUS PROJETOS")
    print("="*60 + "\n")
    
    print("➤ OPÇÃO 1: Explorador (Windows)")
    print("  1. Abra o Explorador de Arquivos")
    print("  2. Cole na barra de endereço:")
    print("     C:\\Users\\bleao\\ai-software-factory\\outputs\\projects")
    print("  3. Pressione Enter\n")
    
    print("➤ OPÇÃO 2: Terminal (CMD/PowerShell)")
    print("  1. Abra terminal em qualquer lugar")
    print("  2. Execute:")
    print("     cd c:\\Users\\bleao\\ai-software-factory\\outputs\\projects")
    print("     dir\n")
    
    print("➤ OPÇÃO 3: Scripts (Automático)")
    print("  1. Execute find_projects.bat")
    print("  2. Ele mostra tudo automaticamente\n")

def show_run_instructions(projects):
    if not projects:
        return
    
    print("\n" + "="*60)
    print(" 🚀 COMO RODAR UM PROJETO")
    print("="*60 + "\n")
    
    project = projects[0]
    project_path = project.absolute()
    
    print(f"Usando projeto exemplo: {project.name}\n")
    
    print("TERMINAL 1 (Backend):")
    print(f"  cd \"{project_path}\\backend\"")
    print("  npm install")
    print("  npm start\n")
    
    print("TERMINAL 2 (Frontend):")
    print(f"  cd \"{project_path}\\frontend\"")
    print("  npm install")
    print("  npm run dev\n")
    
    print("Então abra: http://localhost:5173")

def main():
    print_header()
    
    projects = find_projects()
    show_instructions()
    show_run_instructions(projects)
    
    print("\n" + "="*60)
    print(" ✅ FIM DO DIAGNÓSTICO")
    print("="*60 + "\n")
    
    if not projects:
        print("📌 IMPORTANTE: Gere um projeto primeiro acessando http://localhost:5173\n")

if __name__ == "__main__":
    main()
