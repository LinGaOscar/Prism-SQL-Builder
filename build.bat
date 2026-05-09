@echo off
title Prism SQL Builder -- Build

echo.
echo  ================================
echo   Prism SQL Builder - Build
echo  ================================
echo.

cd /d "%~dp0"

echo [1/2] Generating Tailwind CSS...
if not exist "tailwindcss.exe" (
    echo  [ERROR] tailwindcss.exe not found.
    echo  Download from: https://github.com/tailwindlabs/tailwindcss/releases/latest
    echo  Rename tailwindcss-windows-x64.exe to tailwindcss.exe
    echo.
    pause
    exit /b 1
)

tailwindcss.exe -i ./src/input.css -o ./tailwind.css --minify
if errorlevel 1 (
    echo  [ERROR] Tailwind CSS generation failed.
    pause
    exit /b 1
)
echo  [OK] tailwind.css generated.
echo.

echo [2/2] Bundling prism.html...
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1" < NUL
if errorlevel 1 (
    echo  [ERROR] Build failed. Make sure PowerShell 7 (pwsh) is installed.
    pause
    exit /b 1
)

echo.
echo  ================================
echo   Done! Output: prism.html
echo  ================================
echo.
pause
