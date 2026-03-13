@echo off
REM Script para rodar AI Software Factory no Windows

echo.
echo.
echo    [1;36m████████████████████████████████████████[0m
echo    [1;36m  AI Software Factory - Startup[0m
echo    [1;36m████████████████████████████████████████[0m
echo.

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [1;31m[X] Node.js nao encontrado![0m
    echo Baixe em: https://nodejs.org
    pause
    exit /b 1
)

echo [1;32m[OK][0m Node.js: 
node --version

echo [1;32m[OK][0m npm: 
npm --version

echo.
echo Escolha uma opcao:
echo [1;36m1[0m - Rodar Factory Completa (Frontend + Backend)
echo [1;36m2[0m - Apenas Frontend
echo [1;36m3[0m - Apenas Backend
echo [1;36m4[0m - Instalar Dependencias
echo.
set /p choice=Digite a opcao (1-4): 

if "%choice%"=="1" (
    cls
    echo [1;32m[OK][0m Iniciando Factory Completa...
    echo.
    
    REM Verificar se node_modules existe
    if not exist "frontend\node_modules" (
        echo [1;33m[..][0m Instalando dependencias do Frontend...
        cd frontend
        call npm install
        cd ..
    )
    
    if not exist "backend\node_modules" (
        echo [1;33m[..][0m Instalando dependencias do Backend...
        cd backend
        call npm install
        cd ..
    )
    
    cls
    echo [1;32m[OK][0m Iniciando servicos...
    echo.
    echo Backend rodara em: http://localhost:3001
    echo Frontend rodara em: http://localhost:5173
    echo.
    echo Abrindo 2 terminais...
    echo.
    
    REM Iniciar Backend em novo terminal
    start "AI Factory - Backend" cmd /k "cd backend && npm start"
    
    timeout /t 2 /nobreak >nul
    
    REM Iniciar Frontend em novo terminal
    start "AI Factory - Frontend" cmd /k "cd frontend && npm run dev"
    
) else if "%choice%"=="2" (
    cls
    echo [1;32m[OK][0m Iniciando apenas Frontend...
    echo.
    cd frontend
    if not exist "node_modules" (
        call npm install
    )
    call npm run dev
    
) else if "%choice%"=="3" (
    cls
    echo [1;32m[OK][0m Iniciando apenas Backend...
    echo.
    cd backend
    if not exist "node_modules" (
        call npm install
    )
    call npm start
    
) else if "%choice%"=="4" (
    cls
    echo [1;33m[..][0m Instalando dependencias do Frontend...
    cd frontend
    call npm install
    cd ..
    
    echo.
    echo [1;33m[..][0m Instalando dependencias do Backend...
    cd backend
    call npm install
    cd ..
    
    echo.
    echo [1;32m[OK][0m Dependencias instaladas!
    echo.
    pause
    
) else (
    echo [1;31m[X] Opcao invalida[0m
    pause
    exit /b 1
)
