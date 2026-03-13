"""
Script para iniciar os agentes e o orchestrator
"""

import subprocess
import sys
import os


def run_backend():
    """Inicia o backend Node.js"""
    print("🚀 Iniciando Backend Node.js...")
    backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
    subprocess.run([sys.executable, '-m', 'npm', 'install'], cwd=backend_dir)
    subprocess.run(['npm', 'start'], cwd=backend_dir)


def run_frontend():
    """Inicia o frontend React"""
    print("🚀 Iniciando Frontend React...")
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    subprocess.run(['npm', 'install'], cwd=frontend_dir)
    subprocess.run(['npm', 'run', 'dev'], cwd=frontend_dir)


def main():
    """Menu principal"""
    
    print("=" * 60)
    print("AI Software Factory - Inicializador")
    print("=" * 60)
    print("\n1. Iniciar Backend Node.js")
    print("2. Iniciar Frontend React")
    print("3. Iniciar Ambos (Terminal separado)")
    print("4. Sair")
    
    choice = input("\nEscolha uma opção: ").strip()
    
    if choice == '1':
        run_backend()
    elif choice == '2':
        run_frontend()
    elif choice == '3':
        print("Iniciando ambos os serviços...")
        import threading
        t1 = threading.Thread(target=run_backend)
        t2 = threading.Thread(target=run_frontend)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    else:
        print("Saindo...")


if __name__ == '__main__':
    main()
