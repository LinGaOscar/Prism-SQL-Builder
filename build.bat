@echo off
chcp 65001 >nul
title Prism SQL Builder — 打包

echo.
echo  ================================
echo   Prism SQL Builder 離線打包
echo  ================================
echo.

:: 確認在正確目錄
cd /d "%~dp0"

:: 步驟 1：產生 Tailwind CSS
echo [1/2] 產生 Tailwind CSS...
if not exist "tailwindcss.exe" (
    echo  [錯誤] 找不到 tailwindcss.exe
    echo  請先下載：https://github.com/tailwindlabs/tailwindcss/releases/latest
    echo  將 tailwindcss-windows-x64.exe 重新命名為 tailwindcss.exe 放到專案根目錄
    echo.
    pause
    exit /b 1
)

tailwindcss.exe -i ./src/input.css -o ./tailwind.css --minify
if errorlevel 1 (
    echo  [錯誤] Tailwind CSS 產生失敗
    pause
    exit /b 1
)
echo  [OK] tailwind.css 產生完成
echo.

:: 步驟 2：執行 PowerShell 打包腳本
echo [2/2] 打包為單一 prism.html...
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1"
if errorlevel 1 (
    echo  [錯誤] 打包失敗，請確認 PowerShell 7 (pwsh) 已安裝
    pause
    exit /b 1
)

echo.
echo  ================================
echo   打包完成！檔案：prism.html
echo  ================================
echo.
pause
