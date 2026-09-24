@echo off
chcp 65001 >nul
title MAX DRIVE - Iniciar
color 0A
cd /d "%~dp0servidor"

echo ==========================================================
echo           MAX DRIVE - INICIANDO SISTEMA
echo ==========================================================
echo.
echo [1/2] Abrindo aplicativo no navegador...
start http://localhost:3000
echo [2/2] Iniciando servidor Node.js...
echo.
echo URL Aplicativo: http://localhost:3000
echo Painel Admin:   http://localhost:3000/admin.html
echo.
echo Pressione Ctrl+C para encerrar o servidor.
echo ==========================================================
node server.js
pause
