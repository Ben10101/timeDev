#!/bin/bash

# Scripts para rodar AI Software Factory

echo "🏭 AI Software Factory - Startup Script"
echo "========================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    echo "Baixe em: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo ""

# Perguntar ao usuário
echo "O que você deseja fazer?"
echo "1) Rodar a Factory (frontend + backend)"
echo "2) Apenas Frontend"
echo "3) Apenas Backend"
read -p "Escolha uma opção (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Iniciando Frontend e Backend..."
        echo ""
        echo "Abrindo 2 terminais..."
        echo ""
        
        # Instalar dependências se necessário
        if [ ! -d "frontend/node_modules" ]; then
            echo "📦 Instalando dependências do Frontend..."
            cd frontend
            npm install
            cd ..
        fi
        
        if [ ! -d "backend/node_modules" ]; then
            echo "📦 Instalando dependências do Backend..."
            cd backend
            npm install
            cd ..
        fi
        
        echo "✅ Dependências instaladas!"
        echo ""
        echo "Iniciando Frontend em http://localhost:5173"
        echo "Iniciando Backend em http://localhost:3001"
        echo ""
        
        # Terminal 1 - Backend
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            start cmd /k "cd backend && npm start"
        else
            open -a Terminal "cd $PWD/backend && npm start"
        fi
        
        # Terminal 2 - Frontend
        sleep 2
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            start cmd /k "cd frontend && npm run dev"
        else
            open -a Terminal "cd $PWD/frontend && npm run dev"
        fi
        ;;
        
    2)
        echo "🎨 Iniciando apenas Frontend..."
        cd frontend
        npm install 2>/dev/null || true
        npm run dev
        ;;
        
    3)
        echo "🔧 Iniciando apenas Backend..."
        cd backend
        npm install 2>/dev/null || true
        npm start
        ;;
        
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac
