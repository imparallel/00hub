@echo off
title 00Hub Stopper
echo [+] Stopping 00Hub Server...

:: Kill any processes running on port 5173 (Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
    echo [!] Server process (PID: %%a) terminated.
)

:: Also kill node/vite processes just in case
taskkill /f /im node.exe /t >nul 2>&1

echo.
echo [x] Hub Server has been stopped safely.
timeout /t 2 >nul
exit
