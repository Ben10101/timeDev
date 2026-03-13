@echo off
REM Script para encontrar e abrir pastas de projetos gerados

echo.
echo =====================================================================
echo   Localizador de Projetos Gerados - AI Software Factory
echo =====================================================================
echo.

setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0outputs\projects"

if not exist "%PROJECT_DIR%" (
    echo [ERRO] Pasta de projetos nao encontrada!
    echo.
    echo Esperado em: %PROJECT_DIR%
    echo.
    echo Criando pasta...
    mkdir "%PROJECT_DIR%"
    echo OK!
    echo.
    pause
    exit /b 1
)

echo Procurando projetos em:
echo %PROJECT_DIR%
echo.

REM Contar projetos
setlocal enabledelayedexpansion
set count=0
for /d %%D in ("%PROJECT_DIR%\*") do (
    set /a count+=1
    echo   [1;36m!count![0m - %%~nxD
)

if %count% equ 0 (
    echo   [1;33m(nenhum projeto gerado ainda)[0m
    echo.
    echo Para gerar um projeto:
    echo   1. Acesse http://localhost:5173
    echo   2. Descreva sua ideia de software
    echo   3. Clique em "Gerar Projeto"
    echo   4. Aguarde a conclusao
    echo.
    pause
    exit /b 0
)

echo.
echo Digite o numero do projeto que deseja acessar (1-%count%):
set /p choice=
echo.

setlocal enabledelayedexpansion
set index=0
for /d %%D in ("%PROJECT_DIR%\*") do (
    set /a index+=1
    if !index! equ %choice% (
        set "SELECTED=%%D"
        goto :found
    )
)

echo [1;31m[X] Opcao invalida[0m
pause
exit /b 1

:found
echo.
echo [1;32m[OK][0m Abrindo: %SELECTED%
echo.

REM Mostrar opcoes
echo Escolha uma opcao:
echo   [1;36m1[0m - Abrir pasta no Explorador
echo   [1;36m2[0m - Listar arquivos
echo   [1;36m3[0m - Abrir Backend no Terminal
echo   [1;36m4[0m - Abrir Frontend no Terminal
echo   [1;36m5[0m - Default (Explorador)
echo.
set /p sub_choice=Digite a opcao (1-5): 

if "%sub_choice%"=="1" (
    start explorer.exe "%SELECTED%"
    echo [1;32m[OK][0m Pasta aberta no Explorador
    
) else if "%sub_choice%"=="2" (
    echo.
    echo Estrutura do projeto:
    dir /s "%SELECTED%"
    pause
    
) else if "%sub_choice%"=="3" (
    start "Backend" cmd /k "cd /d %SELECTED%\backend && cls && echo [1;32m[OK][0m Backend de: %SELECTED% && echo. && echo Digite: npm install && npm start && echo. && cmd /k"
    
) else if "%sub_choice%"=="4" (
    start "Frontend" cmd /k "cd /d %SELECTED%\frontend && cls && echo [1;32m[OK][0m Frontend de: %SELECTED% && echo. && echo Digite: npm install && npm run dev && echo. && cmd /k"
    
) else (
    start explorer.exe "%SELECTED%"
    echo [1;32m[OK][0m Pasta aberta no Explorador
)

echo.
echo [1;32m[OK][0m Concluido!
echo.
pause
