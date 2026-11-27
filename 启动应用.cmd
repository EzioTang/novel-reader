@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "out\main\index.js" (
  echo 还没有构建产物，先执行一次构建...
  node scripts\run.mjs build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo 正在启动已构建的小说阅读器...
node scripts\run.mjs preview
if errorlevel 1 pause
