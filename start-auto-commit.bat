@echo off
REM Startet den Auto-Commit Watcher (Windows Batch)
powershell -ExecutionPolicy Bypass -File "%~dp0start-auto-commit.ps1"
pause
