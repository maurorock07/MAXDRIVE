@echo off
title MAX DRIVE - Gerenciador do Servidor
color 0E
cd /d "%~dp0"

set "SCRIPT_DIR=%~dp0"

if exist "%SCRIPT_DIR%server.js" (
    set "SERVER_PATH=%SCRIPT_DIR%server.js"
) else (
    set "SERVER_PATH=%SCRIPT_DIR%servidor\server.js"
)

:MENU
cls
echo ==========================================================
echo        MAX DRIVE - CORRIDAS A PRECO JUSTO (POSTGRESQL)
echo ==========================================================
echo.
echo   --- CONTROLE DO SERVIDOR ---
echo   [1]  Ligar Servidor (Iniciar em nova janela)
echo   [2]  Desligar Servidor
echo   [3]  Ligar App (Iniciar Servidor e abrir no Navegador)
echo   [4]  Reiniciar Servidor
echo   [5]  Mostrar Status do Servidor
echo.
echo   --- GERENCIAMENTO DO BANCO DE DADOS E MODO MANUTENCAO ---
echo   [6]  Fazer Backup do Banco de Dados
echo   [7]  Restaurar Backup Mais Recente
echo   [8]  Liberar Acesso para Motoristas e Passageiros (Desativar Manutencao)
echo   [9]  Liberar Acesso SOMENTE Administradores (Ativar Manutencao)
echo   [10] Resetar Banco de Dados (Restaurar Padrao)
echo   [11] Migrar Dados JSON -> PostgreSQL
echo   [12] Executar Testes Automatizados
echo   [0]  Sair
echo.
echo ==========================================================
set /p OPTION="Escolha uma opcao [0-12]: "

if "%OPTION%"=="1" goto LIGAR
if "%OPTION%"=="2" goto DESLIGAR
if "%OPTION%"=="3" goto LIGAR_APP
if "%OPTION%"=="4" goto REINICIAR
if "%OPTION%"=="5" goto STATUS
if "%OPTION%"=="6" goto BACKUP
if "%OPTION%"=="7" goto RESTAURAR_BACKUP
if "%OPTION%"=="8" goto LIBERAR_TODOS
if "%OPTION%"=="9" goto LIBERAR_ADMIN
if "%OPTION%"=="10" goto RESETAR_DB
if "%OPTION%"=="11" goto MIGRAR_POSTGRES
if "%OPTION%"=="12" goto TESTES
if "%OPTION%"=="0" goto SAIR

echo Opcao invalida!
pause
goto MENU

:BACKUP
echo.
node "%SCRIPT_DIR%db_admin_tools.js" backup
echo.
pause
goto MENU

:RESTAURAR_BACKUP
echo.
node "%SCRIPT_DIR%db_admin_tools.js" restore
echo.
pause
goto MENU

:LIBERAR_TODOS
echo.
node "%SCRIPT_DIR%db_admin_tools.js" unlock
echo.
pause
goto MENU

:LIBERAR_ADMIN
echo.
node "%SCRIPT_DIR%db_admin_tools.js" admin-only
echo.
pause
goto MENU

:RESETAR_DB
echo.
echo [ATENCAO] Esta operacao ira resetar as corridas e tabelas!
echo [INFO] Um backup preventivo sera criado automaticamente.
set /p CONFIRM="Deseja continuar? (S/N): "
if /i "%CONFIRM%"=="S" goto CONFIRM_RESET
echo Operacao cancelada pelo usuario.
pause
goto MENU

:CONFIRM_RESET
node "%SCRIPT_DIR%db_admin_tools.js" reset
echo.
pause
goto MENU

:MIGRAR_POSTGRES
echo.
echo ==========================================================
echo        MIGRACAO DE DADOS: JSON -> POSTGRESQL
echo ==========================================================
if exist "%SCRIPT_DIR%database\migrate.js" (
    node "%SCRIPT_DIR%database\migrate.js"
) else (
    node "%SCRIPT_DIR%servidor\database\migrate.js"
)
echo.
pause
goto MENU

:TESTES
echo.
echo [INFO] Executando bateria completa de testes automatizados...
if exist "%SCRIPT_DIR%test_suite.js" (
    node "%SCRIPT_DIR%test_suite.js"
) else (
    node "%SCRIPT_DIR%servidor\test_suite.js"
)
echo.
pause
goto MENU

:LIGAR
echo.
echo [INFO] Verificando se o servidor ja esta em execucao...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [AVISO] O servidor MAX DRIVE ja esta rodando na porta 3000!
    echo [URL] http://localhost:3000
    echo.
    pause
    goto MENU
)

echo [INFO] Iniciando o servidor MAX DRIVE...
start "MAX DRIVE Servidor" /d "%SCRIPT_DIR%" cmd /k node "%SERVER_PATH%"
timeout /t 2 >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [SUCESSO] Servidor ligado com sucesso na porta 3000!
    echo [URL] http://localhost:3000
) else (
    echo [ERRO] Nao foi possivel confirmar o inicio na porta 3000.
    echo [DICA] Verifique se a janela do servidor foi aberta.
)
echo.
pause
goto MENU

:DESLIGAR
echo.
echo [INFO] Encerrando o processo do servidor na porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [SUCESSO] Servidor MAX DRIVE desligado com sucesso.
) else (
    echo [INFO] Nenhum servidor ativo encontrado na porta 3000.
)
echo.
pause
goto MENU

:LIGAR_APP
echo.
echo [INFO] Preparando aplicativo MAX DRIVE...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [INFO] Servidor nao detectado. Ligando servidor primeiro...
    start "MAX DRIVE Servidor" /d "%SCRIPT_DIR%" cmd /k node "%SERVER_PATH%"
    timeout /t 2 >nul
)
echo [INFO] Abrindo o frontend no navegador padrao...
start http://localhost:3000
echo [SUCESSO] Aplicativo iniciado no navegador!
echo.
pause
goto MENU

:REINICIAR
echo.
echo [INFO] Reiniciando o servidor MAX DRIVE...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 >nul
start "MAX DRIVE Servidor" /d "%SCRIPT_DIR%" cmd /k node "%SERVER_PATH%"
timeout /t 2 >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [SUCESSO] Servidor MAX DRIVE reiniciado com sucesso!
) else (
    echo [ERRO] Falha ao reiniciar o servidor.
)
echo.
pause
goto MENU

:STATUS
echo.
echo ==========================================================
echo               STATUS ATUAL DO SERVIDOR
echo ==========================================================
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [STATUS] ONLINE (Ativo na porta 3000)
    echo [URL]    http://localhost:3000
    echo [ADMIN]  http://localhost:3000/admin.html
) else (
    echo [STATUS] OFFLINE (Nenhum processo ativo na porta 3000)
)
echo ==========================================================
echo.
pause
goto MENU

:SAIR
cls
echo Obrigado por utilizar o MAX DRIVE!
timeout /t 1 >nul
exit
