@echo off
chcp 65001 >nul
color 0B
title Instalacao de Banco de Dados MAX DRIVE (PostgreSQL)

echo ==========================================================
echo       MAX DRIVE - INSTALADOR DO BANCO DE DADOS LOCAL
echo ==========================================================
echo.
echo Antes de continuar, certifique-se de que voce instalou o PostgreSQL!
echo Se ainda nao instalou, baixe aqui: https://www.postgresql.org/download/windows/
echo.
echo Durante a instalacao do PostgreSQL, voce escolheu uma SENHA para o
echo superusuario "postgres". Voce vai precisar dessa senha agora.
echo.
pause

set /p PGPASSWORD="> Digite a senha do seu PostgreSQL (usuario postgres): "
set PGUSER=postgres

echo.
echo [1/3] Criando a database "maxdrive" no seu computador...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1
"C:\Program Files\PostgreSQL\14\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1
"C:\Program Files\PostgreSQL\13\bin\psql.exe" -U postgres -c "CREATE DATABASE maxdrive;" >nul 2>&1

echo.
echo [2/3] Criando as tabelas e importando as Cidades...
node database/migrate.js "postgresql://postgres:%PGPASSWORD%@localhost:5432/maxdrive"

echo.
echo [3/3] Atualizando as configuracoes do seu servidor...
echo PORT=3000> CONFIGURACAO_DO_SERVIDOR.env
echo DATABASE_URL=postgresql://postgres:%PGPASSWORD%@localhost:5432/maxdrive>> CONFIGURACAO_DO_SERVIDOR.env

echo.
echo ==========================================================
echo PARABENS! BANCO DE DADOS INSTALADO E CONFIGURADO COM SUCESSO!
echo ==========================================================
echo.
echo O servidor MAX DRIVE agora esta 100%% conectado ao SQL local.
echo Voce ja pode ligar o servidor no arquivo "servidor.bat"!
echo.
echo Para acessar as tabelas visualmente, abra o programa "pgAdmin"
echo que foi instalado junto com o PostgreSQL no seu computador.
echo.
pause
