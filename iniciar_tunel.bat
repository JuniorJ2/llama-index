@echo off
title Tunel Cloudflare - Sistema IA TDR + CV
cd /d "%~dp0"
cls
echo ===================================================================
echo    Iniciando Tunel Seguro Cloudflare (Frontend + Backend)
echo ===================================================================
echo.
echo Conectando a los servidores seguros de Cloudflare...
echo.
echo Presiona Ctrl+C en cualquier momento para detener el tunel.
echo ===================================================================
echo.

.\cloudflared.exe tunnel --url http://127.0.0.1:5173 --protocol http2 --edge-ip-version 4 --no-autoupdate

echo.
echo ===================================================================
echo El tunel se ha detenido.
echo ===================================================================
pause
