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
echo [+] Launching 00Hub (Smart Launcher)...
start "" "00Hub.exe"

:: Exit
echo [!] Hub is active.
exit
