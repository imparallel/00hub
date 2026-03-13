@echo off
title 00Hub Launcher
:: 00Hub Smart Launcher (Pure ASCII Version)
setlocal

echo.
echo   ----------------------------------------------
echo      ___   ___   _   _  _   _  ____  
echo     / _ \ / _ \ ^| ^| ^| ^|^| ^| ^| ^|^|  _ \ 
echo    ^| ^| ^| ^| ^| ^| ^|^| ^|_^| ^|^| ^| ^| ^|^| ^|_) ^|
echo    ^| ^| ^| ^| ^| ^| ^|^|  _  ^|^| ^| ^| ^|^|  _ ^< 
echo    ^| ^|_^| ^| ^|_^| ^|^| ^| ^| ^|^| ^|_^| ^|^| ^|_) ^|
echo     \___/ \___/ ^|_^| ^|_^| \___/ ^|____/ 
echo.
echo     [ Personal Command Center : Active ]
echo   ----------------------------------------------
echo.

cd /d "%~dp0"

:: Check dependencies
if not exist "node_modules" (
    echo [!] node_modules not found. Initializing...
    call npm install
)

:: Clean port 5173 if busy
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Launch
echo [+] Starting dev server in background (Hidden)...
echo.

:: Start Vite dev server completely hidden without parent CMD hanging
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process npm -ArgumentList 'run', 'dev' -WindowStyle Hidden"

:: Wait for server initialization
timeout /t 3 /nobreak >nul

:: Launch browser in app mode (Maintains 'New Window' and 'App' look)
echo [+] Launching Hub in App Mode...
start chrome --app="http://localhost:5173" 2>nul
if %ERRORLEVEL% NEQ 0 (
    start msedge --app="http://localhost:5173" 2>nul
)
if %ERRORLEVEL% NEQ 0 (
    start "" "http://localhost:5173"
)

:: Exit the launcher immediately and completely
echo [!] Hub is active. Launcher closing.
exit
