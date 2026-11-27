@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在以开发模式启动小说阅读器（热更新，关闭窗口即退出）...
node scripts\run.mjs dev
if errorlevel 1 pause
