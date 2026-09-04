@echo off
setlocal
cd /d "%~dp0"
title Minecrack
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est requis. Installez la version LTS depuis https://nodejs.org
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  if not exist "node_modules\vite" call npm ci
  if errorlevel 1 goto fail
  call npm run build
  if errorlevel 1 goto fail
)
node scripts\serve.mjs --open
if errorlevel 1 goto fail
exit /b 0
:fail
echo Le lancement a echoue. Consultez le message ci-dessus.
pause
exit /b 1
